/**
 * Shipmate Yard Digital Twin — discrete-time simulation engine.
 *
 * Pure TypeScript: no React, no DOM, no timers, no globals. The UI owns the
 * clock and calls `step()`; the engine only ever maps state -> state. That
 * separation is what makes the engine unit-testable and the run reproducible.
 *
 * See ./README.md for the full method write-up (stacking algorithm, rehandle
 * accounting, and the parameter provenance) intended for citation.
 */

import { Rng } from "./rng";
import type {
  Bucket,
  Container,
  ContainerSize,
  CargoType,
  KpiSnapshot,
  PolicyId,
  SimConfig,
  SimState,
  Slot,
  Yard,
} from "./types";

// ── Yard geometry ────────────────────────────────────────────────────────────
// 8 blocks × 12 ground slots × 2 tiers = 192 positions. Two-high is the ceiling
// because Indian CFS yards are predominantly surface-load / reach-stacker
// operations rather than RTG-served terminals.
export const BLOCKS = 8;
export const SLOTS_PER_BLOCK = 12;
export const MAX_TIER = 2;
export const GROUND_SLOTS = BLOCKS * SLOTS_PER_BLOCK; // 96
export const TOTAL_POSITIONS = GROUND_SLOTS * MAX_TIER; // 192

// ── Cost model ───────────────────────────────────────────────────────────────
export const MINUTES_PER_REHANDLE = 4;
export const RUPEES_PER_REHANDLE = 450;

// ── Dwell distribution parameters ────────────────────────────────────────────
/** Arithmetic mean dwell in days, by cargo class. */
export const DWELL_MEAN_DAYS: Record<CargoType, number> = {
  DPD: 2,
  NONDPD: 6,
  EXPORT: 3,
};
/** Log-space shape of the dwell distribution — the right-skew CFS yards live with. */
export const DWELL_SIGMA = 0.55;
/** Arrival mix across cargo classes. */
export const TYPE_WEIGHTS: Record<CargoType, number> = {
  DPD: 0.3,
  NONDPD: 0.45,
  EXPORT: 0.25,
};

/**
 * Which dwell bucket each block is reserved for under the predictive policy.
 * Segregating by bucket keeps fast-moving DPD boxes away from long-dwell
 * non-DPD boxes, so a stack is far less likely to be broken open early.
 */
export const BLOCK_BUCKETS: Bucket[] = [
  "short",
  "short",
  "medium",
  "medium",
  "medium",
  "long",
  "long",
  "long",
];

/** Bucket thresholds, in days of *predicted* dwell. */
export function bucketOf(dwellDays: number): Bucket {
  if (dwellDays < 2) return "short";
  if (dwellDays <= 5) return "medium";
  return "long";
}

// ── Yard construction ────────────────────────────────────────────────────────

/**
 * Slots are size-designated when the yard is built: the last `k` slots of each
 * block are marked 40ft, where k tracks the arrival mix. A 40ft box occupies one
 * designated 40ft ground slot; 20ft and 40ft boxes never share a stack.
 */
export function fortySlotsPerBlock(fortyFootShare: number): number {
  return Math.round(SLOTS_PER_BLOCK * fortyFootShare);
}

export function buildYard(policy: PolicyId, fortyFootShare: number): Yard {
  const k = fortySlotsPerBlock(fortyFootShare);
  const slots: Slot[] = [];
  for (let b = 0; b < BLOCKS; b++) {
    for (let s = 0; s < SLOTS_PER_BLOCK; s++) {
      slots.push({
        index: b * SLOTS_PER_BLOCK + s,
        block: b,
        slotInBlock: s,
        size: s >= SLOTS_PER_BLOCK - k ? 40 : 20,
        stack: [null, null],
      });
    }
  }
  return {
    policy,
    slots,
    rehandles: 0,
    flashes: [],
    queue: [],
    placed: 0,
    departed: 0,
    forcedStacks: 0,
  };
}

// ── Container generation ─────────────────────────────────────────────────────

/**
 * Forecast noise. `predictionAccuracy` A ∈ [0.50, 0.95] maps to a multiplicative
 * log-normal error with log-space sigma = 2(1 − A): A = 0.95 -> sigma 0.10
 * (tight), A = 0.50 -> sigma 1.00 (near-useless). The exp term is mean-corrected
 * so the forecast is unbiased — accuracy changes the *spread* of the error, not
 * its centre, which isolates the variable the demo is arguing about.
 */
export function noiseSigma(predictionAccuracy: number): number {
  return 2 * (1 - predictionAccuracy);
}

export function makeContainer(
  rng: Rng,
  seq: number,
  hour: number,
  config: SimConfig
): Container {
  const types: CargoType[] = ["DPD", "NONDPD", "EXPORT"];
  const type = types[rng.weightedIndex(types.map((t) => TYPE_WEIGHTS[t]))];
  const size: ContainerSize = rng.next() < config.fortyFootShare ? 40 : 20;

  const actualDwellDays = rng.logNormal(DWELL_MEAN_DAYS[type], DWELL_SIGMA);
  const sigma = noiseSigma(config.predictionAccuracy);
  const noise = Math.exp(sigma * rng.normal() - (sigma * sigma) / 2);
  // Floor at 2h so a wild draw can't produce a non-positive forecast.
  const predictedDwellDays = Math.max(actualDwellDays * noise, 2 / 24);

  const actualDwellHours = actualDwellDays * 24;
  const predictedDwellHours = predictedDwellDays * 24;

  return {
    id: `${size === 40 ? "SMLU" : "SMCU"}${String(1000000 + seq).slice(1)}`,
    size,
    type,
    arrivalHour: hour,
    actualDwellHours,
    predictedDwellHours,
    departureHour: hour + actualDwellHours,
    predictedDepartureHour: hour + predictedDwellHours,
    bucket: bucketOf(predictedDwellDays),
  };
}

// ── Placement ────────────────────────────────────────────────────────────────

export interface Placement {
  slotIndex: number;
  tier: 0 | 1;
  /** True when the LIFO rule had to be broken because nothing better was free. */
  forced: boolean;
}

/**
 * (a) BASELINE — "nearest available position, top slot used whenever a ground
 * container is present." Scans in fixed slot order and takes the first legal
 * top slot; only when no stackable ground box exists does it open new ground.
 * This is the yard-space-maximising heuristic most CFS yards actually run, and
 * it is dwell-blind by construction.
 */
export function findPlacementBaseline(yard: Yard, c: Container): Placement | null {
  for (const s of yard.slots) {
    if (s.size !== c.size) continue;
    if (s.stack[0] && !s.stack[1]) return { slotIndex: s.index, tier: 1, forced: false };
  }
  for (const s of yard.slots) {
    if (s.size !== c.size) continue;
    if (!s.stack[0]) return { slotIndex: s.index, tier: 0, forced: false };
  }
  return null;
}

/**
 * (b) PREDICTIVE — dwell-aware. Two mechanisms:
 *
 *   1. Block segregation. Each block is reserved for a dwell bucket
 *      (<2d / 2–5d / >5d, from the *predicted* dwell). The box tries its own
 *      bucket's blocks before spilling into the rest of the yard.
 *   2. LIFO-consistent stacking. B may go on top of A only if B's predicted
 *      departure is earlier than A's — i.e. only if B is expected to be lifted
 *      off before A is called for. Otherwise an empty ground slot is preferred.
 *
 * Search order: preferred-bucket ground -> preferred-bucket legal stack ->
 * other-block ground -> other-block legal stack -> any stack at all (recorded
 * as a forced stack) -> null (yard full).
 *
 * Among legal stacks the engine picks the ground box with the *latest* predicted
 * departure, maximising the forecast margin so that ordinary prediction error is
 * least likely to invert the pair.
 */
export function findPlacementPredictive(yard: Yard, c: Container): Placement | null {
  const preferred = (s: Slot) => BLOCK_BUCKETS[s.block] === c.bucket;

  const groups: ((s: Slot) => boolean)[] = [preferred, (s) => !preferred(s)];

  for (const inGroup of groups) {
    // 1. empty ground first — never stack when open ground is available here.
    for (const s of yard.slots) {
      if (s.size !== c.size || !inGroup(s)) continue;
      if (!s.stack[0]) return { slotIndex: s.index, tier: 0, forced: false };
    }
    // 2. best legal stack in this group.
    let best: Slot | null = null;
    for (const s of yard.slots) {
      if (s.size !== c.size || !inGroup(s)) continue;
      const ground = s.stack[0];
      if (!ground || s.stack[1]) continue;
      if (c.predictedDepartureHour >= ground.predictedDepartureHour) continue;
      if (!best || ground.predictedDepartureHour > best.stack[0]!.predictedDepartureHour) {
        best = s;
      }
    }
    if (best) return { slotIndex: best.index, tier: 1, forced: false };
  }

  // 3. last resort — the yard has no open ground and no LIFO-safe stack left.
  // Take any top slot and record that the rule was broken under pressure.
  for (const s of yard.slots) {
    if (s.size !== c.size) continue;
    if (s.stack[0] && !s.stack[1]) return { slotIndex: s.index, tier: 1, forced: true };
  }
  return null;
}

export function findPlacement(yard: Yard, c: Container): Placement | null {
  return yard.policy === "baseline"
    ? findPlacementBaseline(yard, c)
    : findPlacementPredictive(yard, c);
}

function place(yard: Yard, c: Container, p: Placement): void {
  yard.slots[p.slotIndex].stack[p.tier] = c;
  yard.placed++;
  if (p.forced) yard.forcedStacks++;
}

// ── Simulation loop ──────────────────────────────────────────────────────────

/** Chart resolution: one history point every 6 sim hours. */
export const HISTORY_INTERVAL_HOURS = 6;

export function createSimulation(config: SimConfig): SimState {
  return {
    hour: 0,
    config,
    rng: new Rng(config.seed),
    seq: 0,
    yards: {
      baseline: buildYard("baseline", config.fortyFootShare),
      predictive: buildYard("predictive", config.fortyFootShare),
    },
    history: [{ hour: 0, day: 0, baseline: 0, predictive: 0 }],
    arrivalsTotal: 0,
    done: false,
  };
}

function cloneYard(y: Yard): Yard {
  return {
    ...y,
    slots: y.slots.map((s) => ({ ...s, stack: [s.stack[0], s.stack[1]] as Slot["stack"] })),
    flashes: [],
    queue: [...y.queue],
  };
}

function cloneState(s: SimState): SimState {
  return {
    ...s,
    rng: s.rng.clone(),
    yards: {
      baseline: cloneYard(s.yards.baseline),
      predictive: cloneYard(s.yards.predictive),
    },
    history: [...s.history],
  };
}

/**
 * Departures for the current hour.
 *
 * Tier 1 is swept before tier 0 on purpose: if a top box is itself due out this
 * hour it leaves on its own move and the box beneath it is then clear. Charging
 * a rehandle in that case would inflate the count with a move that never
 * happened.
 *
 * REHANDLE ACCOUNTING — exactly one rehandle is charged each time a ground box
 * is called for while another box still sits on top of it. The blocking box is
 * lifted and set down on the ground slot the departing box just vacated, which
 * is the single reach-stacker move a yard actually performs. No rehandle is
 * charged for the productive move itself (gate-in, gate-out, or the departure
 * lift) — only for the unproductive shuffle.
 */
function processDepartures(yard: Yard, hour: number): void {
  for (const s of yard.slots) {
    const top = s.stack[1];
    if (top && top.departureHour <= hour) {
      s.stack[1] = null;
      yard.departed++;
    }
  }
  for (const s of yard.slots) {
    const ground = s.stack[0];
    if (!ground || ground.departureHour > hour) continue;
    const blocking = s.stack[1];
    if (blocking) {
      yard.rehandles++;
      yard.flashes.push(s.index);
      s.stack[1] = null;
      s.stack[0] = blocking; // set the lifted box down in the freed ground position
    } else {
      s.stack[0] = null;
    }
    yard.departed++;
  }
}

function processArrivals(yard: Yard, incoming: Container[]): void {
  // Boxes that could not be placed in an earlier hour get first refusal.
  const pending = [...yard.queue, ...incoming];
  yard.queue = [];
  for (const c of pending) {
    const p = findPlacement(yard, c);
    if (p) place(yard, c, p);
    else yard.queue.push(c);
  }
}

/** Advance the simulation by one hour. Returns a new state; the input is untouched. */
export function step(prev: SimState): SimState {
  if (prev.done) return prev;
  const s = cloneState(prev);
  const hour = s.hour;

  processDepartures(s.yards.baseline, hour);
  processDepartures(s.yards.predictive, hour);

  // One arrival stream, shared by both yards. This is what makes the comparison
  // a controlled experiment: the twins differ only in stacking policy.
  const n = s.rng.poisson(s.config.arrivalRatePerHour);
  const arrivals: Container[] = [];
  for (let i = 0; i < n; i++) {
    arrivals.push(makeContainer(s.rng, s.seq++, hour, s.config));
  }
  s.arrivalsTotal += n;

  processArrivals(s.yards.baseline, arrivals);
  processArrivals(s.yards.predictive, arrivals.map((c) => ({ ...c })));

  s.hour = hour + 1;
  s.done = s.hour >= s.config.runDays * 24;

  if (s.hour % HISTORY_INTERVAL_HOURS === 0 || s.done) {
    s.history.push({
      hour: s.hour,
      day: +(s.hour / 24).toFixed(2),
      baseline: s.yards.baseline.rehandles,
      predictive: s.yards.predictive.rehandles,
    });
  }
  return s;
}

/** Convenience for tests and for fast-forwarding: run n steps. */
export function advance(state: SimState, steps: number): SimState {
  let s = state;
  for (let i = 0; i < steps && !s.done; i++) s = step(s);
  return s;
}

/** Run a config to completion. */
export function runToCompletion(config: SimConfig): SimState {
  return advance(createSimulation(config), config.runDays * 24 + 1);
}

// ── KPIs ─────────────────────────────────────────────────────────────────────

export function kpis(yard: Yard): KpiSnapshot {
  let occupied = 0;
  let ground = 0;
  let twoHigh = 0;
  for (const s of yard.slots) {
    if (s.stack[0]) {
      ground++;
      occupied++;
    }
    if (s.stack[1]) {
      occupied++;
      twoHigh++;
    }
  }
  return {
    rehandles: yard.rehandles,
    moveMinutes: yard.rehandles * MINUTES_PER_REHANDLE,
    groundUtilizationPct: (ground / GROUND_SLOTS) * 100,
    costRupees: yard.rehandles * RUPEES_PER_REHANDLE,
    occupied,
    twoHighStacks: twoHigh,
    queued: yard.queue.length,
    forcedStacks: yard.forcedStacks,
  };
}

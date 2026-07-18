/**
 * Interactive scenario generation for "Operate the Yard".
 *
 * Pure TypeScript, seeded, and framework-free like the rest of the engine. The
 * scenario is generated *once* from a seed and then replayed identically by the
 * human operator and by the predictive policy, so the end-of-run scorecard is a
 * like-for-like comparison rather than two unrelated runs.
 *
 * See ./README.md §10 for the method write-up covering this module.
 */

import { Rng } from "./rng";
import { RUPEES_PER_REHANDLE } from "./engine";
import type { Bucket, Container, ContainerSize, CargoType, Slot, Yard } from "./types";

// ── Scenario yard: a single block, deliberately small ────────────────────────
// The benchmark yard proves the statistical claim over 96 slots. This one is a
// teaching instrument: small enough that a human can hold the whole state in
// their head and feel the consequence of one bad decision.
export const SCENARIO_SLOT_SIZES: ContainerSize[] = [20, 20, 20, 20, 20, 40, 40, 40];
export const SCENARIO_SLOTS = SCENARIO_SLOT_SIZES.length; // 8
export const SCENARIO_TIERS = 2;
export const SCENARIO_POSITIONS = SCENARIO_SLOTS * SCENARIO_TIERS; // 16

// ── Scenario timing ──────────────────────────────────────────────────────────
/** Arrivals stop here so their consequences land inside the run. */
export const ARRIVAL_WINDOW_HOURS = 48;
/** Total scenario length: 3 simulated days. */
export const HORIZON_HOURS = 72;
/**
 * Arrivals per scenario. Fixed rather than drawn, so every seed yields a demo of
 * predictable length (~25 events once pickups are interleaved). Arrival *times*
 * are still uniform over the window, which is exactly the conditional
 * distribution of a Poisson process given its arrival count — so this is a
 * genuine Poisson process observed at fixed N, not a different model.
 */
export const TARGET_ARRIVALS = 13;

/**
 * Compressed dwell means, in hours.
 *
 * Benchmark mode uses the full-scale distributions (DPD 2d, non-DPD 6d). A
 * 3-day interactive scenario at those means would be almost all arrivals and
 * hardly any pickups, so the operator would never see a rehandle — the whole
 * point of the exercise. These means preserve the *ordering and ratio* that
 * matters (DPD clears fastest, non-DPD slowest, export in between) while fitting
 * the arrival→pickup→rehandle cycle inside 72 hours.
 *
 * This is an accelerated teaching scenario, not a claim about real dwell.
 */
export const SCENARIO_DWELL_MEAN_HOURS: Record<CargoType, number> = {
  DPD: 14,
  NONDPD: 46,
  EXPORT: 26,
};
export const SCENARIO_DWELL_SIGMA = 0.45;
export const SCENARIO_TYPE_WEIGHTS: Record<CargoType, number> = {
  DPD: 0.3,
  NONDPD: 0.45,
  EXPORT: 0.25,
};
export const SCENARIO_FORTY_SHARE = 0.35;
export const SCENARIO_ACCURACY = 0.85;

/** Bucket thresholds rescaled to the compressed dwell above. */
export function scenarioBucketOf(dwellHours: number): Bucket {
  if (dwellHours < 18) return "short";
  if (dwellHours <= 40) return "medium";
  return "long";
}

// ── Event types ──────────────────────────────────────────────────────────────

export interface ArrivalEvent {
  kind: "arrival";
  index: number;
  hour: number;
  container: Container;
}

export interface PickupEvent {
  kind: "pickup";
  index: number;
  hour: number;
  containerId: string;
}

export type ScenarioEvent = ArrivalEvent | PickupEvent;

export interface Scenario {
  seed: number;
  horizonHours: number;
  slotSizes: ContainerSize[];
  events: ScenarioEvent[];
}

// ── Yard construction ────────────────────────────────────────────────────────

export function buildScenarioYard(): Yard {
  const slots: Slot[] = SCENARIO_SLOT_SIZES.map((size, index) => ({
    index,
    block: 0,
    slotInBlock: index,
    size,
    stack: [null, null] as Slot["stack"],
  }));
  return {
    policy: "predictive",
    slots,
    rehandles: 0,
    flashes: [],
    queue: [],
    placed: 0,
    departed: 0,
    forcedStacks: 0,
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

function slotsOfSize(size: ContainerSize): number {
  return SCENARIO_SLOT_SIZES.filter((s) => s === size).length;
}

// ── Container generation ─────────────────────────────────────────────────────

function makeScenarioContainer(rng: Rng, seq: number, hour: number): Container {
  const types: CargoType[] = ["DPD", "NONDPD", "EXPORT"];
  const type = types[rng.weightedIndex(types.map((t) => SCENARIO_TYPE_WEIGHTS[t]))];
  const size: ContainerSize = rng.next() < SCENARIO_FORTY_SHARE ? 40 : 20;

  const actualDwellHours = rng.logNormal(SCENARIO_DWELL_MEAN_HOURS[type], SCENARIO_DWELL_SIGMA);
  const sigma = 2 * (1 - SCENARIO_ACCURACY);
  const noise = Math.exp(sigma * rng.normal() - (sigma * sigma) / 2);
  const predictedDwellHours = Math.max(actualDwellHours * noise, 2);

  return {
    id: `${size === 40 ? "SMLU" : "SMCU"}${String(1000000 + seq).slice(1)}`,
    size,
    type,
    arrivalHour: hour,
    actualDwellHours,
    predictedDwellHours,
    departureHour: hour + actualDwellHours,
    predictedDepartureHour: hour + predictedDwellHours,
    bucket: scenarioBucketOf(predictedDwellHours),
  };
}

// ── Scenario generation ──────────────────────────────────────────────────────

/**
 * Build a deterministic, always-solvable event sequence.
 *
 * Feasibility guarantee: an arrival is only emitted when the boxes already on
 * yard of that size number fewer than `2 × slots of that size`. Because sizes
 * never share a stack and a stack's top tier is only usable when its ground tier
 * is filled, that condition is exactly the condition for at least one legal
 * position to exist. The operator therefore can never be dealt a dead end — any
 * rehandle they incur is a consequence of their own choice, never of the deal.
 *
 * Pickup times derive from each container's *actual* dwell, fixed at generation.
 * They do not depend on where a box was placed, so the human and the policy face
 * a byte-identical event sequence.
 */
export function generateScenario(seed: number): Scenario {
  const rng = new Rng(seed);
  const events: ScenarioEvent[] = [];
  const live: Container[] = [];
  let index = 0;

  // Arrival instants: uniform over the window, sorted.
  const arrivalHours = Array.from({ length: TARGET_ARRIVALS }, () =>
    Math.floor(rng.next() * ARRIVAL_WINDOW_HOURS)
  ).sort((a, b) => a - b);
  const pendingArrivals = arrivalHours.map((hour, seq) =>
    makeScenarioContainer(rng, seq, hour)
  );

  let nextArrival = 0;
  for (let hour = 0; hour < HORIZON_HOURS; hour++) {
    // Pickups first: a box due out this hour leaves before any new box lands.
    const due = live
      .filter((c) => c.departureHour <= hour)
      .sort((a, b) => a.departureHour - b.departureHour || a.id.localeCompare(b.id));
    for (const c of due) {
      events.push({ kind: "pickup", index: index++, hour, containerId: c.id });
      live.splice(live.indexOf(c), 1);
    }

    while (nextArrival < pendingArrivals.length && pendingArrivals[nextArrival].arrivalHour === hour) {
      const c = pendingArrivals[nextArrival++];
      const onYard = live.filter((x) => x.size === c.size).length;
      // Drop the arrival rather than deal an unplaceable box.
      if (onYard + 1 > SCENARIO_TIERS * slotsOfSize(c.size)) continue;
      events.push({ kind: "arrival", index: index++, hour, container: c });
      live.push(c);
    }
  }

  return { seed, horizonHours: HORIZON_HOURS, slotSizes: [...SCENARIO_SLOT_SIZES], events };
}

// ── Placement ────────────────────────────────────────────────────────────────

export interface ScenarioPlacement {
  slotIndex: number;
  tier: 0 | 1;
}

/** Every position an arriving box may legally occupy right now. */
export function legalPlacements(yard: Yard, c: Container): ScenarioPlacement[] {
  const out: ScenarioPlacement[] = [];
  for (const s of yard.slots) {
    if (s.size !== c.size) continue;
    if (!s.stack[0]) out.push({ slotIndex: s.index, tier: 0 });
    else if (!s.stack[1]) out.push({ slotIndex: s.index, tier: 1 });
  }
  return out;
}

export function isLegalPlacement(yard: Yard, c: Container, p: ScenarioPlacement): boolean {
  return legalPlacements(yard, c).some(
    (x) => x.slotIndex === p.slotIndex && x.tier === p.tier
  );
}

export type AdviceKind = "ground" | "safe-stack" | "forced-stack";

export interface Advice extends ScenarioPlacement {
  kind: AdviceKind;
  /** One sentence, written for a yard planner rather than a modeller. */
  rationale: string;
}

const hrs = (n: number) => `${Math.round(n)}h`;

/**
 * The predictive policy, reduced to a single block.
 *
 * Block segregation by dwell bucket is meaningless with one block, so what
 * remains is the LIFO rule that does the real work:
 *
 *   1. Prefer open ground — a box on the ground can never be buried.
 *   2. Otherwise stack only where the box beneath is forecast to leave *later*,
 *      choosing the greatest forecast margin so ordinary prediction error is
 *      least likely to invert the pair.
 *   3. If neither exists, stack anyway and say plainly that it will probably
 *      cost a rehandle.
 */
export function chooseSlot(yard: Yard, c: Container): Advice | null {
  const legal = legalPlacements(yard, c);
  if (legal.length === 0) return null;

  const ground = legal.filter((p) => p.tier === 0);
  if (ground.length > 0) {
    const pick = ground[0];
    return {
      ...pick,
      kind: "ground",
      rationale: `Slot ${pick.slotIndex + 1} is open ground — never stack while ground is free, because a box on the ground can never be buried.`,
    };
  }

  const stacks = legal.filter((p) => p.tier === 1);
  let best: ScenarioPlacement | null = null;
  let bestMargin = 0;
  for (const p of stacks) {
    const below = yard.slots[p.slotIndex].stack[0]!;
    const margin = below.predictedDepartureHour - c.predictedDepartureHour;
    if (margin > 0 && (!best || margin > bestMargin)) {
      best = p;
      bestMargin = margin;
    }
  }

  if (best) {
    const below = yard.slots[best.slotIndex].stack[0]!;
    return {
      ...best,
      kind: "safe-stack",
      rationale: `Stack on ${below.id} in slot ${best.slotIndex + 1}: this box is forecast out ${hrs(bestMargin)} earlier, so it lifts off before the box beneath is ever called for.`,
    };
  }

  const fallback = stacks[0];
  const below = yard.slots[fallback.slotIndex].stack[0]!;
  return {
    ...fallback,
    kind: "forced-stack",
    rationale: `No open ground and nothing here leaves after this box — stacking on ${below.id} is forced and will most likely cost a rehandle.`,
  };
}

// ── Applying events ──────────────────────────────────────────────────────────

export function applyArrival(yard: Yard, c: Container, p: ScenarioPlacement): Yard {
  const next = cloneYard(yard);
  next.slots[p.slotIndex].stack[p.tier] = c;
  next.placed++;
  return next;
}

export interface PickupResult {
  yard: Yard;
  /** Slot the pickup happened in, or null when the container was not found. */
  slotIndex: number | null;
  /** True when a box had to be lifted off to reach the departing container. */
  rehandled: boolean;
  /** The box that was shuffled, when a rehandle occurred. */
  movedContainerId: string | null;
}

/**
 * Remove a container by id, charging a rehandle when it was buried.
 *
 * Identical accounting to the benchmark engine: one rehandle each time a
 * ground-tier box is called for while another box sits on top of it, and the
 * blocking box is set down in the ground position the departing box vacates.
 */
export function applyPickup(yard: Yard, containerId: string): PickupResult {
  const next = cloneYard(yard);
  for (const s of next.slots) {
    if (s.stack[1]?.id === containerId) {
      s.stack[1] = null;
      next.departed++;
      return { yard: next, slotIndex: s.index, rehandled: false, movedContainerId: null };
    }
    if (s.stack[0]?.id === containerId) {
      const blocking = s.stack[1];
      next.departed++;
      if (blocking) {
        next.rehandles++;
        next.flashes = [s.index];
        s.stack[1] = null;
        s.stack[0] = blocking;
        return { yard: next, slotIndex: s.index, rehandled: true, movedContainerId: blocking.id };
      }
      s.stack[0] = null;
      return { yard: next, slotIndex: s.index, rehandled: false, movedContainerId: null };
    }
  }
  return { yard, slotIndex: null, rehandled: false, movedContainerId: null };
}

// ── Policy replay (scorecard + "Replay as Shipmate") ─────────────────────────

export interface ReplayMove {
  eventIndex: number;
  kind: "arrival" | "pickup";
  /** Yard state *after* this move — lets the UI animate without re-deriving. */
  yard: Yard;
  slotIndex: number | null;
  tier: 0 | 1 | null;
  rehandled: boolean;
  containerId: string;
  rationale: string;
  rehandlesSoFar: number;
}

export interface ReplayResult {
  moves: ReplayMove[];
  rehandles: number;
  costRupees: number;
}

/** Run the predictive policy over the identical event sequence. */
export function replayWithPolicy(scenario: Scenario): ReplayResult {
  let yard = buildScenarioYard();
  const moves: ReplayMove[] = [];

  for (const ev of scenario.events) {
    if (ev.kind === "arrival") {
      const advice = chooseSlot(yard, ev.container);
      if (!advice) continue; // unreachable: generation guarantees a legal slot
      yard = applyArrival(yard, ev.container, advice);
      moves.push({
        eventIndex: ev.index,
        kind: "arrival",
        yard,
        slotIndex: advice.slotIndex,
        tier: advice.tier,
        rehandled: false,
        containerId: ev.container.id,
        rationale: advice.rationale,
        rehandlesSoFar: yard.rehandles,
      });
    } else {
      const res = applyPickup(yard, ev.containerId);
      yard = res.yard;
      moves.push({
        eventIndex: ev.index,
        kind: "pickup",
        yard,
        slotIndex: res.slotIndex,
        tier: null,
        rehandled: res.rehandled,
        containerId: ev.containerId,
        rationale: res.rehandled
          ? `${ev.containerId} was buried — ${res.movedContainerId} had to be lifted off first. That is the move the placement rule exists to avoid.`
          : `${ev.containerId} was clear on top of the stack and lifted straight out — no shuffle.`,
        rehandlesSoFar: yard.rehandles,
      });
    }
  }

  return {
    moves,
    rehandles: yard.rehandles,
    costRupees: yard.rehandles * RUPEES_PER_REHANDLE,
  };
}

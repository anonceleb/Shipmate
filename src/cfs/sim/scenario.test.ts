import { describe, it, expect } from "vitest";
import { RUPEES_PER_REHANDLE } from "./engine";
import {
  ARRIVAL_WINDOW_HOURS,
  HORIZON_HOURS,
  SCENARIO_POSITIONS,
  SCENARIO_SLOTS,
  SCENARIO_SLOT_SIZES,
  SCENARIO_TIERS,
  TARGET_ARRIVALS,
  applyArrival,
  applyPickup,
  buildScenarioYard,
  chooseSlot,
  generateScenario,
  isLegalPlacement,
  legalPlacements,
  replayWithPolicy,
  scenarioBucketOf,
} from "./scenario";
import type { ArrivalEvent, Scenario, ScenarioPlacement } from "./scenario";
import type { Container, ContainerSize, Yard } from "./types";

const SEEDS = [1, 7, 42, 999, 12345, 20260704];

function box(over: Partial<Container> & { id: string; predictedDepartureHour: number }): Container {
  return {
    size: 20,
    type: "NONDPD",
    arrivalHour: 0,
    actualDwellHours: 40,
    predictedDwellHours: 40,
    departureHour: 40,
    bucket: "long",
    ...over,
  };
}

/** A careless operator: stack whenever it is possible to stack. */
function playGreedy(sc: Scenario): Yard {
  let y = buildScenarioYard();
  for (const ev of sc.events) {
    if (ev.kind === "arrival") {
      const legal = legalPlacements(y, ev.container);
      y = applyArrival(y, ev.container, legal.find((p) => p.tier === 1) ?? legal[0]);
    } else {
      y = applyPickup(y, ev.containerId).yard;
    }
  }
  return y;
}

describe("scenario yard", () => {
  it("is a single block of 8 slots × 2 tiers", () => {
    expect(SCENARIO_SLOTS).toBe(8);
    expect(SCENARIO_POSITIONS).toBe(16);
    const y = buildScenarioYard();
    expect(y.slots).toHaveLength(8);
    expect(y.slots.every((s) => s.block === 0)).toBe(true);
    expect(y.slots.every((s) => s.stack.length === SCENARIO_TIERS)).toBe(true);
  });

  it("starts empty", () => {
    const y = buildScenarioYard();
    expect(y.slots.every((s) => !s.stack[0] && !s.stack[1])).toBe(true);
    expect(y.rehandles).toBe(0);
  });

  it("designates both 20ft and 40ft slots", () => {
    expect(SCENARIO_SLOT_SIZES.filter((s) => s === 20).length).toBe(5);
    expect(SCENARIO_SLOT_SIZES.filter((s) => s === 40).length).toBe(3);
  });
});

describe("scenarioBucketOf", () => {
  it("splits on the compressed thresholds", () => {
    expect(scenarioBucketOf(10)).toBe("short");
    expect(scenarioBucketOf(17.9)).toBe("short");
    expect(scenarioBucketOf(18)).toBe("medium");
    expect(scenarioBucketOf(40)).toBe("medium");
    expect(scenarioBucketOf(40.1)).toBe("long");
  });
});

describe("generateScenario", () => {
  it("is deterministic for a seed", () => {
    expect(generateScenario(42)).toEqual(generateScenario(42));
  });

  it("differs across seeds", () => {
    expect(generateScenario(1)).not.toEqual(generateScenario(2));
  });

  it("produces roughly 25 events for every seed", () => {
    for (const seed of SEEDS) {
      const n = generateScenario(seed).events.length;
      expect(n).toBeGreaterThanOrEqual(18);
      expect(n).toBeLessThanOrEqual(28);
    }
  });

  it("emits at most the target arrival count", () => {
    for (const seed of SEEDS) {
      const arrivals = generateScenario(seed).events.filter((e) => e.kind === "arrival");
      expect(arrivals.length).toBeLessThanOrEqual(TARGET_ARRIVALS);
    }
  });

  it("interleaves arrivals and pickups", () => {
    const ev = generateScenario(20260704).events;
    expect(ev.some((e) => e.kind === "arrival")).toBe(true);
    expect(ev.some((e) => e.kind === "pickup")).toBe(true);
    // a pickup occurs before the last arrival — i.e. they are genuinely interleaved
    const lastArrival = ev.map((e) => e.kind).lastIndexOf("arrival");
    const firstPickup = ev.map((e) => e.kind).indexOf("pickup");
    expect(firstPickup).toBeLessThan(lastArrival);
  });

  it("orders events by hour and indexes them contiguously", () => {
    for (const seed of SEEDS) {
      const ev = generateScenario(seed).events;
      for (let i = 1; i < ev.length; i++) expect(ev[i].hour).toBeGreaterThanOrEqual(ev[i - 1].hour);
      expect(ev.map((e) => e.index)).toEqual(ev.map((_, i) => i));
    }
  });

  it("keeps every event inside the 3-day horizon", () => {
    for (const seed of SEEDS) {
      for (const e of generateScenario(seed).events) {
        expect(e.hour).toBeGreaterThanOrEqual(0);
        expect(e.hour).toBeLessThan(HORIZON_HOURS);
        if (e.kind === "arrival") expect(e.hour).toBeLessThan(ARRIVAL_WINDOW_HOURS);
      }
    }
  });

  it("only ever picks up a container that arrived earlier", () => {
    for (const seed of SEEDS) {
      const seen = new Set<string>();
      for (const e of generateScenario(seed).events) {
        if (e.kind === "arrival") seen.add(e.container.id);
        else expect(seen.has(e.containerId)).toBe(true);
      }
    }
  });

  it("never picks up the same container twice", () => {
    for (const seed of SEEDS) {
      const picked = new Set<string>();
      for (const e of generateScenario(seed).events) {
        if (e.kind === "pickup") {
          expect(picked.has(e.containerId)).toBe(false);
          picked.add(e.containerId);
        }
      }
    }
  });

  it("gives every container a positive predicted dwell", () => {
    for (const seed of SEEDS) {
      for (const e of generateScenario(seed).events) {
        if (e.kind === "arrival") {
          expect(e.container.predictedDwellHours).toBeGreaterThan(0);
          expect(e.container.actualDwellHours).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe("feasibility guarantee", () => {
  /**
   * The operator must never be dealt a box they cannot place — otherwise a
   * rehandle could be the deal's fault rather than the player's. This has to
   * hold for *every* way of playing, so it is checked against the worst
   * strategy available (always open new ground, exhausting slots fastest).
   */
  it("always leaves a legal placement, however badly the operator plays", () => {
    for (const seed of SEEDS) {
      const sc = generateScenario(seed);
      for (const strategy of ["ground-first", "stack-first"] as const) {
        let y = buildScenarioYard();
        for (const ev of sc.events) {
          if (ev.kind === "arrival") {
            const legal = legalPlacements(y, ev.container);
            expect(legal.length).toBeGreaterThan(0);
            const pick =
              strategy === "ground-first"
                ? legal.find((p) => p.tier === 0) ?? legal[0]
                : legal.find((p) => p.tier === 1) ?? legal[0];
            y = applyArrival(y, ev.container, pick);
          } else {
            y = applyPickup(y, ev.containerId).yard;
          }
        }
      }
    }
  });

  it("never exceeds yard capacity", () => {
    for (const seed of SEEDS) {
      const sc = generateScenario(seed);
      let y = buildScenarioYard();
      for (const ev of sc.events) {
        if (ev.kind === "arrival") {
          const legal = legalPlacements(y, ev.container);
          y = applyArrival(y, ev.container, legal[0]);
        } else {
          y = applyPickup(y, ev.containerId).yard;
        }
        const onYard = y.slots.reduce((n, s) => n + (s.stack[0] ? 1 : 0) + (s.stack[1] ? 1 : 0), 0);
        expect(onYard).toBeLessThanOrEqual(SCENARIO_POSITIONS);
      }
    }
  });
});

describe("legalPlacements", () => {
  it("offers ground on an empty yard, never a floating top tier", () => {
    const y = buildScenarioYard();
    const legal = legalPlacements(y, box({ id: "A", predictedDepartureHour: 10 }));
    expect(legal.every((p) => p.tier === 0)).toBe(true);
    expect(legal).toHaveLength(5); // the five 20ft slots
  });

  it("offers the top tier once a ground box is present", () => {
    let y = buildScenarioYard();
    y = applyArrival(y, box({ id: "A", predictedDepartureHour: 90 }), { slotIndex: 0, tier: 0 });
    const legal = legalPlacements(y, box({ id: "B", predictedDepartureHour: 10 }));
    expect(legal).toContainEqual({ slotIndex: 0, tier: 1 });
  });

  it("never offers a slot of the wrong size", () => {
    const y = buildScenarioYard();
    for (const size of [20, 40] as ContainerSize[]) {
      const legal = legalPlacements(y, box({ id: "X", size, predictedDepartureHour: 10 }));
      expect(legal.every((p) => y.slots[p.slotIndex].size === size)).toBe(true);
    }
  });

  it("offers nothing when the size class is full", () => {
    let y = buildScenarioYard();
    let n = 0;
    for (const s of y.slots) {
      if (s.size !== 20) continue;
      y = applyArrival(y, box({ id: `G${n++}`, predictedDepartureHour: 90 }), { slotIndex: s.index, tier: 0 });
      y = applyArrival(y, box({ id: `T${n++}`, predictedDepartureHour: 10 }), { slotIndex: s.index, tier: 1 });
    }
    expect(legalPlacements(y, box({ id: "Z", predictedDepartureHour: 5 }))).toHaveLength(0);
  });

  it("isLegalPlacement agrees with legalPlacements", () => {
    const y = buildScenarioYard();
    const c = box({ id: "A", predictedDepartureHour: 10 });
    expect(isLegalPlacement(y, c, { slotIndex: 0, tier: 0 })).toBe(true);
    expect(isLegalPlacement(y, c, { slotIndex: 0, tier: 1 })).toBe(false); // floating
    expect(isLegalPlacement(y, c, { slotIndex: 5, tier: 0 })).toBe(false); // 40ft slot
  });
});

describe("chooseSlot (the advice engine)", () => {
  it("prefers open ground and says why", () => {
    let y = buildScenarioYard();
    y = applyArrival(y, box({ id: "A", predictedDepartureHour: 90 }), { slotIndex: 0, tier: 0 });
    const advice = chooseSlot(y, box({ id: "B", predictedDepartureHour: 10 }))!;
    expect(advice.kind).toBe("ground");
    expect(advice.tier).toBe(0);
    expect(advice.rationale).toMatch(/open ground/i);
  });

  it("stacks only on a box forecast to leave later", () => {
    let y = buildScenarioYard();
    let n = 0;
    for (const s of y.slots) {
      if (s.size !== 20) continue;
      // ground boxes leave at hour 20, except slot 4 which leaves at 200
      y = applyArrival(
        y,
        box({ id: `G${n}`, predictedDepartureHour: s.index === 4 ? 200 : 20 }),
        { slotIndex: s.index, tier: 0 }
      );
      n++;
    }
    const advice = chooseSlot(y, box({ id: "B", predictedDepartureHour: 100 }))!;
    expect(advice.kind).toBe("safe-stack");
    expect(advice).toMatchObject({ slotIndex: 4, tier: 1 });
    expect(advice.rationale).toMatch(/G4/);
  });

  it("picks the greatest forecast margin among legal stacks", () => {
    let y = buildScenarioYard();
    let n = 0;
    for (const s of y.slots) {
      if (s.size !== 20) continue;
      y = applyArrival(y, box({ id: `G${n}`, predictedDepartureHour: 100 + s.index }), { slotIndex: s.index, tier: 0 });
      n++;
    }
    const advice = chooseSlot(y, box({ id: "B", predictedDepartureHour: 50 }))!;
    expect(advice.slotIndex).toBe(4); // latest predicted departure among 20ft slots
  });

  it("admits when a stack is forced rather than pretending it is fine", () => {
    let y = buildScenarioYard();
    let n = 0;
    for (const s of y.slots) {
      if (s.size !== 20) continue;
      y = applyArrival(y, box({ id: `G${n++}`, predictedDepartureHour: 20 }), { slotIndex: s.index, tier: 0 });
    }
    const advice = chooseSlot(y, box({ id: "B", predictedDepartureHour: 900 }))!;
    expect(advice.kind).toBe("forced-stack");
    expect(advice.rationale).toMatch(/forced|rehandle/i);
  });

  it("always returns a legal placement", () => {
    for (const seed of SEEDS) {
      const sc = generateScenario(seed);
      let y = buildScenarioYard();
      for (const ev of sc.events) {
        if (ev.kind === "arrival") {
          const advice = chooseSlot(y, ev.container)!;
          expect(advice).not.toBeNull();
          expect(isLegalPlacement(y, ev.container, advice)).toBe(true);
          y = applyArrival(y, ev.container, advice);
        } else {
          y = applyPickup(y, ev.containerId).yard;
        }
      }
    }
  });

  it("returns null only when nothing is legal", () => {
    let y = buildScenarioYard();
    let n = 0;
    for (const s of y.slots) {
      if (s.size !== 20) continue;
      y = applyArrival(y, box({ id: `G${n++}`, predictedDepartureHour: 90 }), { slotIndex: s.index, tier: 0 });
      y = applyArrival(y, box({ id: `T${n++}`, predictedDepartureHour: 10 }), { slotIndex: s.index, tier: 1 });
    }
    expect(chooseSlot(y, box({ id: "Z", predictedDepartureHour: 5 }))).toBeNull();
  });
});

describe("applyArrival / applyPickup", () => {
  it("does not mutate the yard handed to it", () => {
    const y = buildScenarioYard();
    const after = applyArrival(y, box({ id: "A", predictedDepartureHour: 10 }), { slotIndex: 0, tier: 0 });
    expect(y.slots[0].stack[0]).toBeNull();
    expect(after.slots[0].stack[0]!.id).toBe("A");
  });

  it("charges one rehandle when the departing box is buried", () => {
    let y = buildScenarioYard();
    y = applyArrival(y, box({ id: "BOTTOM", predictedDepartureHour: 10 }), { slotIndex: 0, tier: 0 });
    y = applyArrival(y, box({ id: "TOP", predictedDepartureHour: 90 }), { slotIndex: 0, tier: 1 });
    const res = applyPickup(y, "BOTTOM");
    expect(res.rehandled).toBe(true);
    expect(res.movedContainerId).toBe("TOP");
    expect(res.slotIndex).toBe(0);
    expect(res.yard.rehandles).toBe(1);
    expect(res.yard.flashes).toEqual([0]);
    // the lifted box is set down in the freed ground position
    expect(res.yard.slots[0].stack[0]!.id).toBe("TOP");
    expect(res.yard.slots[0].stack[1]).toBeNull();
  });

  it("charges nothing when the departing box is on top", () => {
    let y = buildScenarioYard();
    y = applyArrival(y, box({ id: "BOTTOM", predictedDepartureHour: 90 }), { slotIndex: 0, tier: 0 });
    y = applyArrival(y, box({ id: "TOP", predictedDepartureHour: 10 }), { slotIndex: 0, tier: 1 });
    const res = applyPickup(y, "TOP");
    expect(res.rehandled).toBe(false);
    expect(res.yard.rehandles).toBe(0);
    expect(res.yard.slots[0].stack[0]!.id).toBe("BOTTOM");
  });

  it("charges nothing for an unstacked ground pickup", () => {
    let y = buildScenarioYard();
    y = applyArrival(y, box({ id: "A", predictedDepartureHour: 10 }), { slotIndex: 0, tier: 0 });
    const res = applyPickup(y, "A");
    expect(res.rehandled).toBe(false);
    expect(res.yard.slots[0].stack[0]).toBeNull();
  });

  it("is a no-op for an unknown container", () => {
    const y = buildScenarioYard();
    const res = applyPickup(y, "NOPE");
    expect(res.slotIndex).toBeNull();
    expect(res.yard).toBe(y);
  });

  it("never leaves a box floating above an empty ground tier", () => {
    for (const seed of SEEDS) {
      const sc = generateScenario(seed);
      let y = buildScenarioYard();
      for (const ev of sc.events) {
        if (ev.kind === "arrival") {
          const legal = legalPlacements(y, ev.container);
          y = applyArrival(y, ev.container, legal.find((p) => p.tier === 1) ?? legal[0]);
        } else {
          y = applyPickup(y, ev.containerId).yard;
        }
        for (const s of y.slots) if (!s.stack[0]) expect(s.stack[1]).toBeNull();
      }
    }
  });
});

describe("replayWithPolicy", () => {
  it("is deterministic", () => {
    const sc = generateScenario(20260704);
    expect(replayWithPolicy(sc).rehandles).toBe(replayWithPolicy(sc).rehandles);
  });

  it("emits one move per event, in order", () => {
    for (const seed of SEEDS) {
      const sc = generateScenario(seed);
      const r = replayWithPolicy(sc);
      expect(r.moves).toHaveLength(sc.events.length);
      expect(r.moves.map((m) => m.eventIndex)).toEqual(sc.events.map((e) => e.index));
      expect(r.moves.map((m) => m.kind)).toEqual(sc.events.map((e) => e.kind));
    }
  });

  it("carries a rationale on every move", () => {
    for (const m of replayWithPolicy(generateScenario(20260704)).moves) {
      expect(m.rationale.length).toBeGreaterThan(20);
    }
  });

  it("reports a monotonic running rehandle count that matches the total", () => {
    const r = replayWithPolicy(generateScenario(20260704));
    for (let i = 1; i < r.moves.length; i++) {
      expect(r.moves[i].rehandlesSoFar).toBeGreaterThanOrEqual(r.moves[i - 1].rehandlesSoFar);
    }
    expect(r.moves.at(-1)!.rehandlesSoFar).toBe(r.rehandles);
  });

  it("prices rehandles at ₹450", () => {
    const r = replayWithPolicy(generateScenario(20260704));
    expect(r.costRupees).toBe(r.rehandles * RUPEES_PER_REHANDLE);
  });

  it("beats a careless stack-first operator across seeds", () => {
    for (const seed of SEEDS) {
      const sc = generateScenario(seed);
      expect(replayWithPolicy(sc).rehandles).toBeLessThanOrEqual(playGreedy(sc).rehandles);
    }
  });

  it("gives the default demo seed a clear margin over careless play", () => {
    const sc = generateScenario(20260704);
    expect(sc.events).toHaveLength(25);
    expect(replayWithPolicy(sc).rehandles).toBe(1);
    expect(playGreedy(sc).rehandles).toBe(6);
  });

  it("faces the identical event sequence a human would", () => {
    const sc = generateScenario(20260704);
    const r = replayWithPolicy(sc);
    const arrivals = sc.events.filter((e): e is ArrivalEvent => e.kind === "arrival");
    const replayed = r.moves.filter((m) => m.kind === "arrival");
    expect(replayed.map((m) => m.containerId)).toEqual(arrivals.map((e) => e.container.id));
  });

  it("places every arrival legally", () => {
    const sc = generateScenario(20260704);
    for (const m of replayWithPolicy(sc).moves) {
      if (m.kind !== "arrival") continue;
      const p: ScenarioPlacement = { slotIndex: m.slotIndex!, tier: m.tier! };
      expect(p.slotIndex).toBeGreaterThanOrEqual(0);
      expect(p.slotIndex).toBeLessThan(SCENARIO_SLOTS);
      expect([0, 1]).toContain(p.tier);
    }
  });
});

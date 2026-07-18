import { describe, it, expect } from "vitest";
import { Rng } from "./rng";
import {
  BLOCKS,
  BLOCK_BUCKETS,
  GROUND_SLOTS,
  MINUTES_PER_REHANDLE,
  RUPEES_PER_REHANDLE,
  SLOTS_PER_BLOCK,
  TOTAL_POSITIONS,
  advance,
  bucketOf,
  buildYard,
  createSimulation,
  findPlacementBaseline,
  findPlacementPredictive,
  fortySlotsPerBlock,
  kpis,
  makeContainer,
  noiseSigma,
  runToCompletion,
  step,
} from "./engine";
import type { Container, ContainerSize, SimConfig, Yard } from "./types";

const CONFIG: SimConfig = {
  seed: 42,
  arrivalRatePerHour: 1.2,
  fortyFootShare: 0.35,
  predictionAccuracy: 0.8,
  runDays: 30,
};

/** Minimal hand-built container, so placement tests aren't at the mercy of the RNG. */
function box(over: Partial<Container> & { predictedDepartureHour: number }): Container {
  return {
    id: "TEST0000001",
    size: 20,
    type: "NONDPD",
    arrivalHour: 0,
    actualDwellHours: 144,
    predictedDwellHours: 144,
    departureHour: 144,
    bucket: "long",
    ...over,
  };
}

describe("Rng", () => {
  it("is reproducible for a given seed", () => {
    const a = Array.from({ length: 20 }, () => new Rng(7).next());
    expect(new Set(a).size).toBe(1); // fresh Rng(7) always yields the same first draw
    const s1 = new Rng(7);
    const s2 = new Rng(7);
    expect(Array.from({ length: 50 }, () => s1.next())).toEqual(
      Array.from({ length: 50 }, () => s2.next())
    );
  });

  it("diverges for different seeds", () => {
    expect(new Rng(1).next()).not.toBe(new Rng(2).next());
  });

  it("clone() forks the stream without disturbing the original", () => {
    const r = new Rng(99);
    r.next();
    const c = r.clone();
    expect(c.next()).toBe(r.next());
  });

  it("logNormal reproduces the requested arithmetic mean", () => {
    const r = new Rng(3);
    let sum = 0;
    const n = 40000;
    for (let i = 0; i < n; i++) sum += r.logNormal(6, 0.55);
    expect(sum / n).toBeCloseTo(6, 0);
  });

  it("poisson reproduces the requested rate", () => {
    const r = new Rng(11);
    let sum = 0;
    const n = 40000;
    for (let i = 0; i < n; i++) sum += r.poisson(1.2);
    expect(sum / n).toBeCloseTo(1.2, 1);
  });

  it("poisson is zero for a non-positive rate", () => {
    expect(new Rng(5).poisson(0)).toBe(0);
  });
});

describe("yard geometry", () => {
  it("is 8 blocks × 12 slots × 2 tiers = 192 positions", () => {
    expect(BLOCKS * SLOTS_PER_BLOCK).toBe(GROUND_SLOTS);
    expect(GROUND_SLOTS).toBe(96);
    expect(TOTAL_POSITIONS).toBe(192);
    expect(buildYard("baseline", 0.3).slots).toHaveLength(96);
  });

  it("designates 40ft slots at the tail of each block, in proportion to the mix", () => {
    const y = buildYard("baseline", 0.25);
    expect(fortySlotsPerBlock(0.25)).toBe(3);
    for (let b = 0; b < BLOCKS; b++) {
      const inBlock = y.slots.filter((s) => s.block === b);
      expect(inBlock.filter((s) => s.size === 40)).toHaveLength(3);
      // ...and they are the last three
      expect(inBlock.slice(-3).every((s) => s.size === 40)).toBe(true);
    }
  });

  it("gives every block a dwell bucket", () => {
    expect(BLOCK_BUCKETS).toHaveLength(BLOCKS);
    expect(new Set(BLOCK_BUCKETS)).toEqual(new Set(["short", "medium", "long"]));
  });
});

describe("bucketOf", () => {
  it("splits at <2d / 2–5d / >5d", () => {
    expect(bucketOf(0.5)).toBe("short");
    expect(bucketOf(1.99)).toBe("short");
    expect(bucketOf(2)).toBe("medium");
    expect(bucketOf(5)).toBe("medium");
    expect(bucketOf(5.01)).toBe("long");
  });
});

describe("noiseSigma", () => {
  it("shrinks as accuracy rises", () => {
    expect(noiseSigma(0.95)).toBeCloseTo(0.1);
    expect(noiseSigma(0.5)).toBeCloseTo(1.0);
    expect(noiseSigma(0.95)).toBeLessThan(noiseSigma(0.5));
  });

  it("makes the forecast tighter at high accuracy", () => {
    const err = (acc: number) => {
      const r = new Rng(21);
      let e = 0;
      for (let i = 0; i < 3000; i++) {
        const c = makeContainer(r, i, 0, { ...CONFIG, predictionAccuracy: acc });
        e += Math.abs(Math.log(c.predictedDwellHours / c.actualDwellHours));
      }
      return e / 3000;
    };
    expect(err(0.95)).toBeLessThan(err(0.5));
  });
});

describe("makeContainer", () => {
  it("respects the 40ft mix", () => {
    const r = new Rng(8);
    const n = 5000;
    let forty = 0;
    for (let i = 0; i < n; i++) {
      if (makeContainer(r, i, 0, { ...CONFIG, fortyFootShare: 0.35 }).size === 40) forty++;
    }
    expect(forty / n).toBeCloseTo(0.35, 1);
  });

  it("gives DPD boxes a shorter mean dwell than non-DPD", () => {
    const r = new Rng(4);
    const mean = (want: string) => {
      let sum = 0;
      let n = 0;
      for (let i = 0; i < 20000; i++) {
        const c = makeContainer(r, i, 0, CONFIG);
        if (c.type === want) {
          sum += c.actualDwellHours / 24;
          n++;
        }
      }
      return sum / n;
    };
    expect(mean("DPD")).toBeCloseTo(2, 0);
    expect(mean("NONDPD")).toBeCloseTo(6, 0);
  });

  it("derives departureHour from arrival + actual dwell", () => {
    const c = makeContainer(new Rng(2), 0, 100, CONFIG);
    expect(c.departureHour).toBeCloseTo(100 + c.actualDwellHours);
    expect(c.predictedDepartureHour).toBeCloseTo(100 + c.predictedDwellHours);
  });

  it("never forecasts a non-positive dwell", () => {
    const r = new Rng(77);
    for (let i = 0; i < 5000; i++) {
      expect(makeContainer(r, i, 0, { ...CONFIG, predictionAccuracy: 0.5 }).predictedDwellHours)
        .toBeGreaterThan(0);
    }
  });
});

describe("baseline placement", () => {
  it("prefers a top slot whenever a ground container is present", () => {
    const y = buildYard("baseline", 0);
    y.slots[3].stack[0] = box({ predictedDepartureHour: 100 });
    const p = findPlacementBaseline(y, box({ predictedDepartureHour: 500 }));
    expect(p).toEqual({ slotIndex: 3, tier: 1, forced: false });
  });

  it("stacks regardless of predicted departure order — it is dwell-blind", () => {
    const y = buildYard("baseline", 0);
    y.slots[0].stack[0] = box({ predictedDepartureHour: 24 }); // leaves first
    const p = findPlacementBaseline(y, box({ predictedDepartureHour: 999 })); // leaves last
    expect(p!.tier).toBe(1); // stacked anyway
  });

  it("opens new ground only when nothing is stackable", () => {
    const y = buildYard("baseline", 0);
    const p = findPlacementBaseline(y, box({ predictedDepartureHour: 100 }));
    expect(p).toEqual({ slotIndex: 0, tier: 0, forced: false });
  });

  it("never mixes sizes in a stack", () => {
    const y = buildYard("baseline", 0.5); // slots 6..11 of each block are 40ft
    y.slots[0].stack[0] = box({ size: 20, predictedDepartureHour: 100 });
    const p = findPlacementBaseline(y, box({ size: 40, predictedDepartureHour: 50 }));
    expect(y.slots[p!.slotIndex].size).toBe(40);
  });

  it("returns null when the yard is full", () => {
    const y = buildYard("baseline", 0);
    for (const s of y.slots) {
      s.stack[0] = box({ predictedDepartureHour: 100 });
      s.stack[1] = box({ predictedDepartureHour: 50 });
    }
    expect(findPlacementBaseline(y, box({ predictedDepartureHour: 10 }))).toBeNull();
  });
});

describe("predictive placement", () => {
  it("prefers empty ground over a legal stack", () => {
    const y = buildYard("predictive", 0);
    const shortBlock = BLOCK_BUCKETS.indexOf("short") * SLOTS_PER_BLOCK;
    y.slots[shortBlock].stack[0] = box({ predictedDepartureHour: 999, bucket: "short" });
    const p = findPlacementPredictive(y, box({ predictedDepartureHour: 10, bucket: "short" }));
    expect(p!.tier).toBe(0); // open ground exists, so no stack is formed
  });

  it("stacks B on A only when B departs first", () => {
    const y = buildYard("predictive", 0);
    // Fill every ground slot so stacking is the only option.
    y.slots.forEach((s, i) => {
      s.stack[0] = box({ predictedDepartureHour: i === 0 ? 1000 : 5 });
    });
    const p = findPlacementPredictive(y, box({ predictedDepartureHour: 500 }));
    expect(p).toEqual({ slotIndex: 0, tier: 1, forced: false }); // the only LIFO-safe pair
  });

  it("picks the ground box with the greatest forecast margin", () => {
    const y = buildYard("predictive", 0);
    y.slots.forEach((s, i) => {
      s.stack[0] = box({ predictedDepartureHour: 600 + i });
    });
    const p = findPlacementPredictive(y, box({ predictedDepartureHour: 100 }));
    expect(p!.slotIndex).toBe(GROUND_SLOTS - 1); // latest predicted departure wins
  });

  it("segregates by dwell bucket while blocks in the bucket remain open", () => {
    const y = buildYard("predictive", 0);
    const p = findPlacementPredictive(y, box({ predictedDepartureHour: 10, bucket: "long" }));
    expect(BLOCK_BUCKETS[y.slots[p!.slotIndex].block]).toBe("long");
  });

  it("spills out of its bucket once those blocks are full", () => {
    const y = buildYard("predictive", 0);
    // Fill both "short" blocks completely.
    for (const s of y.slots) {
      if (BLOCK_BUCKETS[s.block] === "short") {
        s.stack[0] = box({ predictedDepartureHour: 5 });
        s.stack[1] = box({ predictedDepartureHour: 1 });
      }
    }
    const p = findPlacementPredictive(y, box({ predictedDepartureHour: 10, bucket: "short" }));
    expect(BLOCK_BUCKETS[y.slots[p!.slotIndex].block]).not.toBe("short");
  });

  it("marks a forced stack when no LIFO-safe option is left", () => {
    const y = buildYard("predictive", 0);
    y.slots.forEach((s) => {
      s.stack[0] = box({ predictedDepartureHour: 5 }); // everything leaves early
    });
    const p = findPlacementPredictive(y, box({ predictedDepartureHour: 900 }));
    expect(p!.forced).toBe(true);
    expect(p!.tier).toBe(1);
  });

  it("never mixes sizes in a stack", () => {
    const y = buildYard("predictive", 0.5);
    const p = findPlacementPredictive(y, box({ size: 40, predictedDepartureHour: 100 }));
    expect(y.slots[p!.slotIndex].size).toBe(40);
  });

  it("returns null when the yard is full", () => {
    const y = buildYard("predictive", 0);
    for (const s of y.slots) {
      s.stack[0] = box({ predictedDepartureHour: 100 });
      s.stack[1] = box({ predictedDepartureHour: 50 });
    }
    expect(findPlacementPredictive(y, box({ predictedDepartureHour: 10 }))).toBeNull();
  });
});

describe("rehandle accounting", () => {
  /** Drive a single yard through departures via the public step() loop. */
  function yardAfterStep(policy: "baseline" | "predictive", build: (y: Yard) => void) {
    const s = createSimulation({ ...CONFIG, arrivalRatePerHour: 0, runDays: 30 });
    build(s.yards[policy]);
    return step(s).yards[policy];
  }

  it("charges exactly one rehandle when a buried box is called for", () => {
    const y = yardAfterStep("baseline", (y) => {
      y.slots[0].stack[0] = box({ departureHour: 0, predictedDepartureHour: 0 });
      y.slots[0].stack[1] = box({ departureHour: 500, predictedDepartureHour: 500, id: "TOP" });
    });
    expect(y.rehandles).toBe(1);
    expect(y.flashes).toEqual([0]);
  });

  it("sets the lifted box down in the freed ground position", () => {
    const y = yardAfterStep("baseline", (y) => {
      y.slots[0].stack[0] = box({ departureHour: 0, predictedDepartureHour: 0 });
      y.slots[0].stack[1] = box({ departureHour: 500, predictedDepartureHour: 500, id: "TOP" });
    });
    expect(y.slots[0].stack[0]!.id).toBe("TOP");
    expect(y.slots[0].stack[1]).toBeNull();
  });

  it("charges nothing when the departing box is on top", () => {
    const y = yardAfterStep("baseline", (y) => {
      y.slots[0].stack[0] = box({ departureHour: 900, predictedDepartureHour: 900 });
      y.slots[0].stack[1] = box({ departureHour: 0, predictedDepartureHour: 0 });
    });
    expect(y.rehandles).toBe(0);
    expect(y.slots[0].stack[0]).not.toBeNull();
  });

  it("charges nothing when both boxes leave in the same hour", () => {
    const y = yardAfterStep("baseline", (y) => {
      y.slots[0].stack[0] = box({ departureHour: 0, predictedDepartureHour: 0 });
      y.slots[0].stack[1] = box({ departureHour: 0, predictedDepartureHour: 0 });
    });
    expect(y.rehandles).toBe(0);
    expect(y.slots[0].stack[0]).toBeNull();
  });

  it("charges nothing for an unstacked ground departure", () => {
    const y = yardAfterStep("baseline", (y) => {
      y.slots[0].stack[0] = box({ departureHour: 0, predictedDepartureHour: 0 });
    });
    expect(y.rehandles).toBe(0);
    expect(y.slots[0].stack[0]).toBeNull();
  });

  it("clears flashes on the following step", () => {
    const s = createSimulation({ ...CONFIG, arrivalRatePerHour: 0 });
    s.yards.baseline.slots[0].stack[0] = box({ departureHour: 0, predictedDepartureHour: 0 });
    s.yards.baseline.slots[0].stack[1] = box({ departureHour: 500, predictedDepartureHour: 500 });
    const a = step(s);
    expect(a.yards.baseline.flashes).toHaveLength(1);
    expect(step(a).yards.baseline.flashes).toHaveLength(0);
  });
});

describe("kpis", () => {
  it("prices rehandles at 4 minutes and ₹450 each", () => {
    const y = buildYard("baseline", 0);
    y.rehandles = 25;
    const k = kpis(y);
    expect(k.moveMinutes).toBe(25 * MINUTES_PER_REHANDLE);
    expect(k.costRupees).toBe(25 * RUPEES_PER_REHANDLE);
  });

  it("reports ground utilisation against the 96 ground slots only", () => {
    const y = buildYard("baseline", 0);
    for (let i = 0; i < 48; i++) {
      y.slots[i].stack[0] = box({ predictedDepartureHour: 10 });
      y.slots[i].stack[1] = box({ predictedDepartureHour: 5 }); // tier 1 must not count
    }
    const k = kpis(y);
    expect(k.groundUtilizationPct).toBeCloseTo(50);
    expect(k.occupied).toBe(96);
    expect(k.twoHighStacks).toBe(48);
  });
});

describe("simulation loop", () => {
  it("is deterministic given a seed", () => {
    const a = runToCompletion(CONFIG);
    const b = runToCompletion(CONFIG);
    expect(a.yards.baseline.rehandles).toBe(b.yards.baseline.rehandles);
    expect(a.yards.predictive.rehandles).toBe(b.yards.predictive.rehandles);
    expect(a.arrivalsTotal).toBe(b.arrivalsTotal);
    expect(a.history).toEqual(b.history);
  });

  it("produces a different run for a different seed", () => {
    const a = runToCompletion(CONFIG);
    const b = runToCompletion({ ...CONFIG, seed: 43 });
    expect(a.arrivalsTotal).not.toBe(b.arrivalsTotal);
  });

  it("step() does not mutate the state handed to it", () => {
    const s = createSimulation(CONFIG);
    const s10 = advance(s, 10);
    expect(s.hour).toBe(0);
    expect(s.yards.baseline.slots.every((x) => !x.stack[0])).toBe(true);
    expect(s10.hour).toBe(10);
  });

  it("feeds both yards the identical arrival stream", () => {
    const s = advance(createSimulation(CONFIG), 240);
    const b = s.yards.baseline;
    const p = s.yards.predictive;
    expect(b.placed + b.queue.length).toBe(p.placed + p.queue.length);
    expect(b.departed + countBoxes(b)).toBe(p.departed + countBoxes(p));
  });

  it("stops after runDays × 24 hours", () => {
    const s = runToCompletion({ ...CONFIG, runDays: 30 });
    expect(s.hour).toBe(720);
    expect(s.done).toBe(true);
    expect(step(s)).toBe(s); // stepping a finished run is a no-op
  });

  it("keeps tier 1 empty whenever tier 0 is empty, at every hour", () => {
    let s = createSimulation(CONFIG);
    for (let i = 0; i < 720; i++) {
      s = step(s);
      for (const y of [s.yards.baseline, s.yards.predictive]) {
        for (const slot of y.slots) {
          if (!slot.stack[0]) expect(slot.stack[1]).toBeNull();
        }
      }
    }
  });

  it("never puts a box in a slot of the wrong size", () => {
    const s = runToCompletion(CONFIG);
    for (const y of [s.yards.baseline, s.yards.predictive]) {
      for (const slot of y.slots) {
        for (const c of slot.stack) {
          if (c) expect(c.size).toBe(slot.size as ContainerSize);
        }
      }
    }
  });

  it("records cumulative, monotonically non-decreasing rehandle history", () => {
    const s = runToCompletion(CONFIG);
    expect(s.history.length).toBeGreaterThan(100);
    for (let i = 1; i < s.history.length; i++) {
      expect(s.history[i].baseline).toBeGreaterThanOrEqual(s.history[i - 1].baseline);
      expect(s.history[i].predictive).toBeGreaterThanOrEqual(s.history[i - 1].predictive);
    }
    expect(s.history.at(-1)!.baseline).toBe(s.yards.baseline.rehandles);
  });

  it("conserves containers: placed = departed + still on the ground", () => {
    const s = runToCompletion(CONFIG);
    for (const y of [s.yards.baseline, s.yards.predictive]) {
      expect(y.placed).toBe(y.departed + countBoxes(y));
    }
  });
});

describe("the claim the demo makes", () => {
  it("predictive stacking beats baseline on rehandles at usable accuracy", () => {
    for (const seed of [1, 7, 42, 101, 2024]) {
      const s = runToCompletion({ ...CONFIG, seed, predictionAccuracy: 0.85 });
      expect(s.yards.predictive.rehandles).toBeLessThan(s.yards.baseline.rehandles);
    }
  });

  it("the predictive advantage narrows as forecast accuracy degrades", () => {
    const saved = (acc: number) => {
      let total = 0;
      for (const seed of [1, 7, 42, 101, 2024]) {
        const s = runToCompletion({ ...CONFIG, seed, predictionAccuracy: acc });
        total += s.yards.baseline.rehandles - s.yards.predictive.rehandles;
      }
      return total;
    };
    expect(saved(0.95)).toBeGreaterThan(saved(0.5));
  });

  it("a busier yard produces more rehandles under the baseline policy", () => {
    const quiet = runToCompletion({ ...CONFIG, arrivalRatePerHour: 0.4 });
    const busy = runToCompletion({ ...CONFIG, arrivalRatePerHour: 2.0 });
    expect(busy.yards.baseline.rehandles).toBeGreaterThan(quiet.yards.baseline.rehandles);
  });
});

function countBoxes(y: Yard): number {
  return y.slots.reduce(
    (n, s) => n + (s.stack[0] ? 1 : 0) + (s.stack[1] ? 1 : 0),
    0
  ) + y.queue.length;
}

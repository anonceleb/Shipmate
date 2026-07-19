/**
 * The method write-up in ./README.md is intended to be citable. That only holds
 * if the numbers printed in it are still the numbers the engine produces.
 *
 * These tests parse README.md and re-derive its published figures from the
 * engine, so re-tuning any constant fails the build instead of silently
 * invalidating a document someone may already have cited.
 */

import { describe, it, expect } from "vitest";
import README from "./README.md?raw";
import {
  GROUND_SLOTS,
  MINUTES_PER_REHANDLE,
  RUPEES_PER_REHANDLE,
  TOTAL_POSITIONS,
  kpis,
  runToCompletion,
} from "./engine";
import { generateScenario, replayWithPolicy } from "./scenario";
import {
  SCENARIO_DWELL_MEAN_HOURS,
  SCENARIO_POSITIONS,
  SCENARIO_SLOTS,
  applyArrival,
  applyPickup,
  buildScenarioYard,
  legalPlacements,
} from "./scenario";
import type { Scenario } from "./scenario";

/** The careless operator §10.6 quotes: stack whenever stacking is possible. */
function playGreedy(sc: Scenario): number {
  let y = buildScenarioYard();
  for (const ev of sc.events) {
    if (ev.kind === "arrival") {
      const legal = legalPlacements(y, ev.container);
      y = applyArrival(y, ev.container, legal.find((p) => p.tier === 1) ?? legal[0]);
    } else {
      y = applyPickup(y, ev.containerId).yard;
    }
  }
  return y.rehandles;
}

interface DocRow {
  lambda: number;
  accuracy: number;
  baseline: number;
  predictive: number;
  forced: number;
  costAvoided: number;
}

/** Parse the §7 "Representative results" table straight out of the document. */
function parseResultsTable(): DocRow[] {
  const section = README.split("## 7. Representative results")[1]?.split("## 8.")[0];
  expect(section, "§7 not found in README.md").toBeTruthy();

  const rows: DocRow[] = [];
  for (const line of section!.split("\n")) {
    const m = line.match(
      /^\|\s*([\d.]+)\s*\|\s*(\d+)%\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*₹([\d,]+)\s*\|$/
    );
    if (!m) continue;
    rows.push({
      lambda: parseFloat(m[1]),
      accuracy: parseInt(m[2], 10) / 100,
      baseline: parseInt(m[3], 10),
      predictive: parseInt(m[4], 10),
      forced: parseInt(m[5], 10),
      costAvoided: parseInt(m[6].replace(/,/g, ""), 10),
    });
  }
  return rows;
}

describe("§7 — the published results table is reproducible", () => {
  const rows = parseResultsTable();

  it("finds every documented row", () => {
    expect(rows.length).toBe(7);
  });

  it.each(rows)(
    "λ=$lambda, accuracy=$accuracy reproduces the documented figures",
    ({ lambda, accuracy, baseline, predictive, forced, costAvoided }) => {
      // §7 states: seed 42, 35% 40ft mix, 30-day run.
      const s = runToCompletion({
        seed: 42,
        arrivalRatePerHour: lambda,
        fortyFootShare: 0.35,
        predictionAccuracy: accuracy,
        runDays: 30,
      });
      const b = kpis(s.yards.baseline);
      const p = kpis(s.yards.predictive);

      expect(b.rehandles, "baseline rehandles").toBe(baseline);
      expect(p.rehandles, "predictive rehandles").toBe(predictive);
      expect(p.forcedStacks, "forced stacks").toBe(forced);
      expect(b.costRupees - p.costRupees, "cost avoided").toBe(costAvoided);
    }
  );

  it("keeps the table internally consistent with the ₹450 rate", () => {
    for (const r of rows) {
      expect((r.baseline - r.predictive) * RUPEES_PER_REHANDLE).toBe(r.costAvoided);
    }
  });
});

describe("§7 — the three stated findings still hold", () => {
  const rows = parseResultsTable();
  const at = (lambda: number, accuracy: number) =>
    rows.find((r) => r.lambda === lambda && r.accuracy === accuracy)!;

  it("finding 1: predictive removes most rehandles at moderate utilisation", () => {
    const r = at(1.2, 0.95);
    expect(1 - r.predictive / r.baseline).toBeGreaterThan(0.85);
  });

  it("finding 2: the saving degrades gracefully as accuracy falls", () => {
    const good = at(1.2, 0.95);
    const bad = at(1.2, 0.5);
    expect(bad.costAvoided).toBeLessThan(good.costAvoided);
    // "costs back only part of the gain" — still worth well over half.
    expect(bad.costAvoided / good.costAvoided).toBeGreaterThan(0.5);
  });

  it("finding 3: the advantage compresses under congestion", () => {
    const moderate = at(1.2, 0.95);
    const congested = at(2.5, 0.95);
    expect(congested.costAvoided).toBeLessThan(moderate.costAvoided);
    expect(congested.forced).toBeGreaterThan(moderate.forced);
  });
});

describe("documented constants match the implementation", () => {
  it("§2 — 96 ground slots and 192 addressable positions", () => {
    expect(README).toContain("| Ground slots (total) | 96 |");
    expect(GROUND_SLOTS).toBe(96);
    expect(README).toContain("| Addressable positions | 192 |");
    expect(TOTAL_POSITIONS).toBe(192);
  });

  it("§5 — 4 minutes and ₹450 per rehandle", () => {
    expect(README).toContain("**4 minutes** per rehandle");
    expect(MINUTES_PER_REHANDLE).toBe(4);
    expect(README).toContain("**₹450** per rehandle");
    expect(RUPEES_PER_REHANDLE).toBe(450);
  });

  it("§10.1 — 8 slots × 2 tiers = 16 positions", () => {
    expect(README).toContain("**8 ground slots × 2 tiers = 16 positions**");
    expect(SCENARIO_SLOTS).toBe(8);
    expect(SCENARIO_POSITIONS).toBe(16);
  });

  it("§10.2 — the compressed dwell table matches the constants", () => {
    expect(README).toContain("| Import DPD | 14h |");
    expect(SCENARIO_DWELL_MEAN_HOURS.DPD).toBe(14);
    expect(README).toContain("| Import non-DPD | 46h |");
    expect(SCENARIO_DWELL_MEAN_HOURS.NONDPD).toBe(46);
    expect(README).toContain("| Export | 26h |");
    expect(SCENARIO_DWELL_MEAN_HOURS.EXPORT).toBe(26);
  });

  it("§10.6 — the default demo seed still scores 6 against 1", () => {
    const sc = generateScenario(20260704);
    const greedy = playGreedy(sc);
    const policy = replayWithPolicy(sc);

    expect(sc.events).toHaveLength(25);
    expect(greedy).toBe(6);
    expect(policy.rehandles).toBe(1);

    // The prose quotes these; line wrapping in the source must not matter.
    const flat = README.replace(/\s+/g, " ");
    expect(flat).toContain("`20260704` yields 25 events");
    expect(flat).toContain(`**${greedy} rehandles (₹2,700)**`);
    expect(flat).toContain(`**${policy.rehandles} (₹450)**`);
    expect(greedy * RUPEES_PER_REHANDLE).toBe(2700);
    expect(policy.costRupees).toBe(450);
  });
});

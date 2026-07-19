/**
 * Generates docs/DEMO-FLOW.md — the click-by-click script for the live demo.
 *
 * The script is derived from the engine, never written by hand, and pinned as a
 * file snapshot. If a constant, the seed, or the placement rule changes, this
 * test fails rather than letting someone follow a stale script in front of a
 * customer.
 *
 * To regenerate after an intentional change:  npx vitest -u
 */

import { describe, it, expect } from "vitest";
import {
  DEFAULT_DEMO_SEED,
  applyArrival,
  applyPickup,
  buildScenarioYard,
  chooseSlot,
  generateScenario,
  legalPlacements,
  replayWithPolicy,
} from "./scenario";
import { RUPEES_PER_REHANDLE } from "./engine";

const CARGO = { DPD: "Import DPD", NONDPD: "Import non-DPD", EXPORT: "Export" } as const;

const at = (h: number) => `Day ${Math.floor(h / 24) + 1}, ${String(h % 24).padStart(2, "0")}:00`;
const inr = (n: number) => "₹" + n.toLocaleString("en-IN");

interface Row {
  step: number;
  hour: number;
  kind: "arrival" | "pickup";
  what: string;
  click: string;
  costAfter: number;
  rehandle: boolean;
  note: string;
  /** For a rehandle: the step at which the blocking box was stacked. */
  causeStep?: number;
}

/**
 * Walk the scenario the way a yard runs today: stack whenever stacking is
 * possible, because ground space feels like the scarce thing. This is the
 * baseline policy of §4(a), played by hand.
 */
function buildScript() {
  const sc = generateScenario(DEFAULT_DEMO_SEED);
  let yard = buildScenarioYard();
  const placedAt = new Map<string, number>();
  const rows: Row[] = [];
  let step = 0;
  let rehandles = 0;

  for (const ev of sc.events) {
    step++;
    if (ev.kind === "arrival") {
      const c = ev.container;
      const legal = legalPlacements(yard, c);
      const pick = legal.find((p) => p.tier === 1) ?? legal[0];
      const advice = chooseSlot(yard, c)!;
      const differs = advice.slotIndex !== pick.slotIndex || advice.tier !== pick.tier;

      let note = "";
      if (differs && pick.tier === 1) {
        const below = yard.slots[pick.slotIndex].stack[0]!;
        const gap = Math.round(below.predictedDepartureHour - c.predictedDepartureHour);
        note =
          gap < 0
            ? `Buries ${below.id}, which is forecast out ${Math.abs(gap)}h **before** this box. A rehandle is now essentially booked.`
            : `Shipmate would open ground at slot ${advice.slotIndex + 1} instead.`;
      }

      rows.push({
        step,
        hour: ev.hour,
        kind: "arrival",
        what: `**${c.id}** · ${c.size}ft · ${CARGO[c.type]} · predicted dwell **~${Math.round(c.predictedDwellHours)}h**`,
        click: `Slot ${pick.slotIndex + 1} → **${pick.tier === 1 ? "STACK HERE" : "GROUND"}**`,
        costAfter: rehandles * RUPEES_PER_REHANDLE,
        rehandle: false,
        note,
      });
      yard = applyArrival(yard, c, pick);
      placedAt.set(c.id, step);
    } else {
      const res = applyPickup(yard, ev.containerId);
      if (res.rehandled) rehandles++;
      rows.push({
        step,
        hour: ev.hour,
        kind: "pickup",
        what: `**${ev.containerId}** called for delivery — sitting in slot ${(res.slotIndex ?? 0) + 1}`,
        click: "**Dispatch →**",
        costAfter: rehandles * RUPEES_PER_REHANDLE,
        rehandle: res.rehandled,
        note: res.rehandled
          ? `**REHANDLE ${rehandles}.** Buried under ${res.movedContainerId}, which you stacked at step ${placedAt.get(res.movedContainerId!)}. +${inr(RUPEES_PER_REHANDLE)}`
          : "Clear on top — lifts straight out, no charge.",
        causeStep: res.rehandled ? placedAt.get(res.movedContainerId!) : undefined,
      });
      yard = res.yard;
    }
  }

  return { sc, rows, rehandles, cost: rehandles * RUPEES_PER_REHANDLE };
}

function render(): string {
  const { sc, rows, rehandles, cost } = buildScript();
  const ai = replayWithPolicy(sc);
  const money = rows.filter((r) => r.rehandle);
  const firstMistake = rows.find((r) => r.note.includes("essentially booked"))!;
  const firstBill = money[0];

  const L: string[] = [];
  L.push("# Shipmate Yard Twin — Demo Flow");
  L.push("");
  L.push("<!-- GENERATED FILE — do not edit by hand.");
  L.push("     Source: src/cfs/sim/demo-flow.test.ts · regenerate with `npx vitest -u`");
  L.push("     Pinned as a snapshot, so a change to the engine or seed fails the build");
  L.push("     rather than leaving a stale script to be followed in front of a customer. -->");
  L.push("");
  L.push("## Setup");
  L.push("");
  L.push("1. Open the **CFS Analytics Intelligence** workspace.");
  L.push("2. Analytics rail → **Yard Twin**.");
  L.push("3. Stay on the default **Operate the Yard** tab.");
  L.push(`4. Confirm the seed reads **${sc.seed}**. If not, type it into the Seed box and press Reset —`);
  L.push("   the whole script below depends on it.");
  L.push("");
  L.push("## The arc");
  L.push("");
  L.push("You are going to play the yard the way it runs today: **stack whenever you can**, because");
  L.push("ground space feels like the scarce resource. That instinct is the whole problem, and the");
  L.push("demo makes it cost real money in front of the customer.");
  L.push("");
  L.push(`- **Step ${firstMistake.step}** is the fateful click. Nothing appears to go wrong.`);
  L.push(`- **Step ${firstBill.step}** is where the bill arrives — the meter moves for the first time.`);
  L.push(`- By the end you are at **${rehandles} rehandles, ${inr(cost)}**.`);
  L.push(`- Shipmate, on the identical sequence, finishes at **${ai.rehandles} (${inr(ai.costRupees)})**.`);
  L.push("");
  L.push(`Total: **${sc.events.length} clicks**, about two to three minutes.`);
  L.push("");
  L.push("---");
  L.push("");
  L.push("## Full click-by-click");
  L.push("");
  L.push("| # | Time | What appears | Click | Cost after |");
  L.push("|---|---|---|---|---|");
  for (const r of rows) {
    const flag = r.rehandle ? " 🔴" : "";
    L.push(`| ${r.step} | ${at(r.hour)} | ${r.what} | ${r.click} | ${inr(r.costAfter)}${flag} |`);
  }
  L.push("");
  L.push("---");
  L.push("");
  L.push("## The moments to actually narrate");
  L.push("");
  L.push("Everything else is just clicking. These are the beats.");
  L.push("");

  L.push(`### Step ${firstMistake.step} — the mistake nobody notices`);
  L.push("");
  L.push(`${firstMistake.what}`);
  L.push("");
  L.push(`Click ${firstMistake.click}. ${firstMistake.note}`);
  L.push("");
  L.push('> Before you click, press **"What would Shipmate do?"**. It will tell you to use open');
  L.push("> ground instead, and say why. Then click the stack anyway — you are demonstrating the");
  L.push("> habit, not the fix. The cost meter does not move, which is exactly the point: the");
  L.push("> mistake is invisible at the moment you make it.");
  L.push("");

  for (const [i, m] of money.entries()) {
    L.push(`### Step ${m.step} — ${i === 0 ? "the first bill" : `rehandle ${i + 1}`}`);
    L.push("");
    L.push(`${m.what}`);
    L.push("");
    L.push(`Click **Dispatch →**. ${m.note}`);
    L.push("");
    if (i === 0) {
      L.push("> The slot flashes red and the meter moves for the first time. This is the line:");
      L.push(`> *\"That ${inr(RUPEES_PER_REHANDLE)} was decided ${m.step - m.causeStep!} steps ago, and there was no way to feel it at the time.\"*`);
      L.push("");
    }
  }

  L.push("### The scorecard");
  L.push("");
  L.push(`After step ${rows.length} the scorecard appears:`);
  L.push("");
  L.push("| | Rehandles | Cost |");
  L.push("|---|---|---|");
  L.push(`| You | ${rehandles} | ${inr(cost)} |`);
  L.push(`| Shipmate | ${ai.rehandles} | ${inr(ai.costRupees)} |`);
  L.push("");
  L.push(`On one block, over three days, on ${sc.events.length} moves. Say that out loud —`);
  L.push("the number is small on purpose and the customer should scale it themselves.");
  L.push("");
  L.push("### Replay as Shipmate");
  L.push("");
  L.push("Click **▶ Replay as Shipmate**. It re-runs the identical sequence at 1.5s per move with");
  L.push("the reasoning shown for each placement. Let it run — the rationale text is the product.");
  L.push("");
  L.push(`Note that Shipmate takes **${ai.rehandles}** rehandle${ai.rehandles === 1 ? "" : "s"}, not zero. Point at it:`);
  L.push("the rule is beatable on eight slots and a careful human can match it. The argument is 96");
  L.push("slots and ~800 boxes a month, which is the **Benchmark** tab.");
  L.push("");
  L.push("### Handing over to Benchmark");
  L.push("");
  L.push("Switch to the **Benchmark** tab, press **Play** at **20×**, and let the 30-day run finish");
  L.push("in about four seconds. Same rule, full-scale yard, and the gap between the two lines is");
  L.push("the actual business case.");
  L.push("");
  L.push("---");
  L.push("");
  L.push("## If someone asks");
  L.push("");
  L.push("**\"Is this real data?\"** No — it is a seeded simulation, and the seed is on screen. Type a");
  L.push("different one and it deals a different yard. Nothing here is a recording.");
  L.push("");
  L.push("**\"Did you pick a scenario that makes you look good?\"** The seed is visible and editable;");
  L.push("press **New scenario** and play a random one live. The placement rule is in");
  L.push("`src/cfs/sim/README.md` §10.5 and the dwell parameters are listed as measured or");
  L.push("placeholder in §11.");
  L.push("");
  L.push("**\"What if the dwell prediction is wrong?\"** Benchmark tab, drag **Prediction accuracy**");
  L.push("down to 50% and re-run. The advantage narrows but does not vanish — §7, finding 2.");
  L.push("");
  L.push("**\"What happens when the yard is full?\"** The advantage compresses to almost nothing above");
  L.push("~90% ground utilisation, because there is no spare ground to exploit. Raise the arrival");
  L.push("rate on Benchmark and show it. Better to volunteer this than be caught by it — §7,");
  L.push("finding 3.");
  L.push("");
  return L.join("\n");
}

describe("demo flow", () => {
  it("matches the committed script in docs/DEMO-FLOW.md", async () => {
    await expect(render()).toMatchFileSnapshot("../../../docs/DEMO-FLOW.md");
  });

  it("still produces the contrast the script is built around", () => {
    const { rehandles, cost } = buildScript();
    const ai = replayWithPolicy(generateScenario(DEFAULT_DEMO_SEED));
    expect(rehandles).toBeGreaterThan(ai.rehandles);
    expect(cost).toBe(rehandles * RUPEES_PER_REHANDLE);
    // A demo with no visible cost jump is not a demo.
    expect(rehandles).toBeGreaterThanOrEqual(3);
  });

  it("never asks the presenter to make an illegal click", () => {
    const sc = generateScenario(DEFAULT_DEMO_SEED);
    let yard = buildScenarioYard();
    for (const ev of sc.events) {
      if (ev.kind === "arrival") {
        const legal = legalPlacements(yard, ev.container);
        expect(legal.length).toBeGreaterThan(0);
        yard = applyArrival(yard, ev.container, legal.find((p) => p.tier === 1) ?? legal[0]);
      } else {
        yard = applyPickup(yard, ev.containerId).yard;
      }
    }
  });
});

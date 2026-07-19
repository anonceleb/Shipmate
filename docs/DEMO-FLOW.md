# Shipmate Yard Twin — Demo Flow

<!-- GENERATED FILE — do not edit by hand.
     Source: src/cfs/sim/demo-flow.test.ts · regenerate with `npx vitest -u`
     Pinned as a snapshot, so a change to the engine or seed fails the build
     rather than leaving a stale script to be followed in front of a customer. -->

## Setup

1. Open the **CFS Analytics Intelligence** workspace.
2. Analytics rail → **Yard Twin**.
3. Stay on the default **Operate the Yard** tab.
4. Confirm the seed reads **20260704**. If not, type it into the Seed box and press Reset —
   the whole script below depends on it.

## The arc

You are going to play the yard the way it runs today: **stack whenever you can**, because
ground space feels like the scarce resource. That instinct is the whole problem, and the
demo makes it cost real money in front of the customer.

- **Step 3** is the fateful click. Nothing appears to go wrong.
- **Step 8** is where the bill arrives — the meter moves for the first time.
- By the end you are at **6 rehandles, ₹2,700**.
- Shipmate, on the identical sequence, finishes at **1 (₹450)**.

Total: **25 clicks**, about two to three minutes.

---

## Full click-by-click

| # | Time | What appears | Click | Cost after |
|---|---|---|---|---|
| 1 | Day 1, 03:00 | **SMLU000000** · 40ft · Import non-DPD · predicted dwell **~69h** | Slot 6 → **GROUND** | ₹0 |
| 2 | Day 1, 06:00 | **SMCU000001** · 20ft · Import non-DPD · predicted dwell **~14h** | Slot 1 → **GROUND** | ₹0 |
| 3 | Day 1, 06:00 | **SMCU000002** · 20ft · Import non-DPD · predicted dwell **~25h** | Slot 1 → **STACK HERE** | ₹0 |
| 4 | Day 1, 12:00 | **SMCU000003** · 20ft · Import non-DPD · predicted dwell **~35h** | Slot 2 → **GROUND** | ₹0 |
| 5 | Day 1, 13:00 | **SMCU000004** · 20ft · Import non-DPD · predicted dwell **~49h** | Slot 2 → **STACK HERE** | ₹0 |
| 6 | Day 1, 16:00 | **SMLU000005** · 40ft · Import non-DPD · predicted dwell **~22h** | Slot 6 → **STACK HERE** | ₹0 |
| 7 | Day 1, 16:00 | **SMCU000006** · 20ft · Export · predicted dwell **~31h** | Slot 3 → **GROUND** | ₹0 |
| 8 | Day 1, 21:00 | **SMCU000001** called for delivery — sitting in slot 1 | **Dispatch →** | ₹450 🔴 |
| 9 | Day 2, 09:00 | **SMCU000007** · 20ft · Export · predicted dwell **~7h** | Slot 1 → **STACK HERE** | ₹450 |
| 10 | Day 2, 09:00 | **SMCU000008** · 20ft · Import DPD · predicted dwell **~7h** | Slot 3 → **STACK HERE** | ₹450 |
| 11 | Day 2, 14:00 | **SMCU000002** called for delivery — sitting in slot 1 | **Dispatch →** | ₹900 🔴 |
| 12 | Day 2, 14:00 | **SMLU000009** · 40ft · Export · predicted dwell **~28h** | Slot 7 → **GROUND** | ₹900 |
| 13 | Day 2, 15:00 | **SMCU000010** · 20ft · Export · predicted dwell **~13h** | Slot 1 → **STACK HERE** | ₹900 |
| 14 | Day 2, 15:00 | **SMLU000011** · 40ft · Export · predicted dwell **~32h** | Slot 7 → **STACK HERE** | ₹900 |
| 15 | Day 2, 19:00 | **SMLU000005** called for delivery — sitting in slot 6 | **Dispatch →** | ₹900 |
| 16 | Day 2, 19:00 | **SMCU000006** called for delivery — sitting in slot 3 | **Dispatch →** | ₹1,350 🔴 |
| 17 | Day 2, 20:00 | **SMCU000007** called for delivery — sitting in slot 1 | **Dispatch →** | ₹1,800 🔴 |
| 18 | Day 2, 21:00 | **SMCU000008** called for delivery — sitting in slot 3 | **Dispatch →** | ₹1,800 |
| 19 | Day 2, 22:00 | **SMCU000003** called for delivery — sitting in slot 2 | **Dispatch →** | ₹2,250 🔴 |
| 20 | Day 2, 23:00 | **SMCU000012** · 20ft · Import non-DPD · predicted dwell **~49h** | Slot 1 → **STACK HERE** | ₹2,250 |
| 21 | Day 3, 06:00 | **SMCU000010** called for delivery — sitting in slot 1 | **Dispatch →** | ₹2,700 🔴 |
| 22 | Day 3, 08:00 | **SMLU000000** called for delivery — sitting in slot 6 | **Dispatch →** | ₹2,700 |
| 23 | Day 3, 14:00 | **SMLU000011** called for delivery — sitting in slot 7 | **Dispatch →** | ₹2,700 |
| 24 | Day 3, 17:00 | **SMCU000004** called for delivery — sitting in slot 2 | **Dispatch →** | ₹2,700 |
| 25 | Day 3, 18:00 | **SMLU000009** called for delivery — sitting in slot 7 | **Dispatch →** | ₹2,700 |

---

## The moments to actually narrate

Everything else is just clicking. These are the beats.

### Step 3 — the mistake nobody notices

**SMCU000002** · 20ft · Import non-DPD · predicted dwell **~25h**

Click Slot 1 → **STACK HERE**. Buries SMCU000001, which is forecast out 12h **before** this box. A rehandle is now essentially booked.

> Before you click, press **"What would Shipmate do?"**. It will tell you to use open
> ground instead, and say why. Then click the stack anyway — you are demonstrating the
> habit, not the fix. The cost meter does not move, which is exactly the point: the
> mistake is invisible at the moment you make it.

### Step 8 — the first bill

**SMCU000001** called for delivery — sitting in slot 1

Click **Dispatch →**. **REHANDLE 1.** Buried under SMCU000002, which you stacked at step 3. +₹450

> The slot flashes red and the meter moves for the first time. This is the line:
> *"That ₹450 was decided 5 steps ago, and there was no way to feel it at the time."*

### Step 11 — rehandle 2

**SMCU000002** called for delivery — sitting in slot 1

Click **Dispatch →**. **REHANDLE 2.** Buried under SMCU000007, which you stacked at step 9. +₹450

### Step 16 — rehandle 3

**SMCU000006** called for delivery — sitting in slot 3

Click **Dispatch →**. **REHANDLE 3.** Buried under SMCU000008, which you stacked at step 10. +₹450

### Step 17 — rehandle 4

**SMCU000007** called for delivery — sitting in slot 1

Click **Dispatch →**. **REHANDLE 4.** Buried under SMCU000010, which you stacked at step 13. +₹450

### Step 19 — rehandle 5

**SMCU000003** called for delivery — sitting in slot 2

Click **Dispatch →**. **REHANDLE 5.** Buried under SMCU000004, which you stacked at step 5. +₹450

### Step 21 — rehandle 6

**SMCU000010** called for delivery — sitting in slot 1

Click **Dispatch →**. **REHANDLE 6.** Buried under SMCU000012, which you stacked at step 20. +₹450

### The scorecard

After step 25 the scorecard appears:

| | Rehandles | Cost |
|---|---|---|
| You | 6 | ₹2,700 |
| Shipmate | 1 | ₹450 |

On one block, over three days, on 25 moves. Say that out loud —
the number is small on purpose and the customer should scale it themselves.

### Replay as Shipmate

Click **▶ Replay as Shipmate**. It re-runs the identical sequence at 1.5s per move with
the reasoning shown for each placement. Let it run — the rationale text is the product.

Note that Shipmate takes **1** rehandle, not zero. Point at it:
the rule is beatable on eight slots and a careful human can match it. The argument is 96
slots and ~800 boxes a month, which is the **Benchmark** tab.

### Handing over to Benchmark

Switch to the **Benchmark** tab, press **Play** at **20×**, and let the 30-day run finish
in about four seconds. Same rule, full-scale yard, and the gap between the two lines is
the actual business case.

---

## If someone asks

**"Is this real data?"** No — it is a seeded simulation, and the seed is on screen. Type a
different one and it deals a different yard. Nothing here is a recording.

**"Did you pick a scenario that makes you look good?"** The seed is visible and editable;
press **New scenario** and play a random one live. The placement rule is in
`src/cfs/sim/README.md` §10.5 and the dwell parameters are listed as measured or
placeholder in §11.

**"What if the dwell prediction is wrong?"** Benchmark tab, drag **Prediction accuracy**
down to 50% and re-run. The advantage narrows but does not vanish — §7, finding 2.

**"What happens when the yard is full?"** The advantage compresses to almost nothing above
~90% ground utilisation, because there is no spare ground to exploit. Raise the arrival
rate on Benchmark and show it. Better to volunteer this than be caught by it — §7,
finding 3.

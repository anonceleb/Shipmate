# Shipmate Yard Digital Twin — Simulation Method

A discrete-time simulation of container stacking in an Indian Container Freight
Station (CFS), built to quantify the rehandle cost of dwell-blind stacking and
the saving available from dwell-aware stacking.

This document specifies the model precisely enough to be cited in academic work
or an IP filing, and to be reproduced independently from this description alone.

**Implementation:** `engine.ts` (model), `rng.ts` (stochastics), `types.ts`
(domain types), `scenario.ts` (interactive scenario generation), and
`engine.test.ts` + `scenario.test.ts` + `docs.test.ts` (108 unit tests). The engine is pure
TypeScript with no rendering dependency; `../InteractiveYard.jsx` and
`../BenchmarkYard.jsx` are presentation layers over it and contain no model
logic.

The module supports two modes, both driven by this engine:

| | **Operate the Yard** (`scenario.ts`) | **Benchmark** (`engine.ts`) |
|---|---|---|
| Purpose | Teaching / demo — a person plays | Statistical proof of the claim |
| Yard | 1 block, 8 slots × 2 tiers | 8 blocks, 96 slots × 2 tiers |
| Horizon | 3 days, ~25 discrete events | 30 days, 720 hourly steps |
| Advance | Turn-based; nothing moves until the operator acts | Auto-run at 1× / 5× / 20× |
| Dwell | Compressed (§10.2) | Full-scale (§3.2) |

§§1–9 below describe benchmark mode. §10 describes the interactive scenario.

---

## 1. Scope and claim

The simulator runs **two yards in parallel** — identical geometry, identical
container arrivals, identical true dwell times — that differ in exactly one
respect: the rule used to choose where an arriving box is placed. Any difference
in outcome is therefore attributable to stacking policy alone. This is a
controlled numerical experiment, not an illustration.

The quantity being compared is the **rehandle**: an unproductive reach-stacker
move performed only because a box was stacked on top of another box that was
subsequently called for first.

---

## 2. Yard model

| Element | Value | Justification |
|---|---|---|
| Blocks | 8 | |
| Ground slots per block | 12 | |
| Ground slots (total) | 96 | |
| Maximum tiers | 2 | Indian CFS yards are predominantly surface-load, reach-stacker-served operations rather than RTG-served terminals; 2-high is the working norm for laden boxes on a surfaced yard. |
| Addressable positions | 192 | 96 × 2 |

A **slot** is a ground position with a stack of at most two boxes:
`stack[0]` is the ground tier, `stack[1]` the top tier. The invariant
`stack[1] ≠ null ⟹ stack[0] ≠ null` holds at every hour of every run and is
asserted by test.

### Size designation

Each slot is designated 20ft or 40ft when the yard is built. The last `k` slots
of each block are 40ft, where `k = round(12 × fortyFootShare)`. A 40ft box
occupies **one designated 40ft ground slot**; a 20ft box occupies a 20ft slot.
**Mixed-size stacking never occurs** — it is excluded structurally by the slot
designation rather than by a runtime check, so no policy can produce it.

Both yards are built with identical designations, so neither policy gains an
advantage from slot supply.

---

## 3. Stochastic model

All randomness derives from a single seeded `Rng` (mulberry32). Given a seed and
a configuration, a 30-day run is bit-for-bit reproducible. The seed is displayed
in the UI and asserted by test.

### 3.1 Arrivals

Containers arrive by a **Poisson process** with configurable rate λ boxes per
hour. Each simulated hour draws `k ~ Poisson(λ)` arrivals (Knuth's product
method). The default λ = 1.2 produces ≈ 800 boxes over 30 days.

### 3.2 Container attributes

| Attribute | Distribution |
|---|---|
| Size | 40ft with probability `fortyFootShare`, else 20ft |
| Cargo type | Import DPD 30%, import non-DPD 45%, export 25% |
| Actual dwell | Log-normal, arithmetic mean by type, log-space σ = 0.55 |

Mean dwell by cargo type: **DPD 2 days**, **non-DPD 6 days**, **export 3 days**.
DPD (Direct Port Delivery) boxes clear at the port and move out of the CFS
quickly; non-DPD boxes wait on customs clearance and documentation, which is the
long right tail CFS yards actually plan around. The log-normal is parameterised
as μ = ln(mean) − σ²/2 so that E[X] equals the stated mean exactly.

A container's **actual departure hour** is `arrivalHour + actualDwellHours`. It
is fixed at generation and is identical in both yards — the true departure never
depends on where the box was put.

### 3.3 Dwell prediction and the accuracy parameter

The predictive policy may only read a *forecast* of dwell, never the truth:

```
predictedDwell = actualDwell × exp(σ·Z − σ²/2),   Z ~ N(0,1)
σ = 2 × (1 − A)
```

where **A** is the Prediction Accuracy control, A ∈ [0.50, 0.95].

- A = 0.95 → σ = 0.10 — forecast typically within ~10% of truth
- A = 0.50 → σ = 1.00 — forecast is close to uninformative

The `−σ²/2` term makes the multiplicative error **mean-unbiased**: raising or
lowering accuracy changes the *spread* of the forecast error and nothing else.
This isolates forecast quality as the single independent variable, which is what
makes the accuracy sweep in §7 interpretable. Forecasts are floored at 2 hours so
an extreme draw cannot produce a non-positive dwell.

### 3.4 Dwell buckets

Each container is assigned a bucket from its **predicted** dwell (never its
actual dwell — the policy cannot see the truth):

- `short` — under 2 days
- `medium` — 2 to 5 days inclusive
- `long` — over 5 days

---

## 4. Stacking policies

### (a) Baseline — nearest available position

> Scan slots in fixed index order. Take the first legal **top** slot (a slot
> whose ground tier is occupied and top tier is free). Only if no such slot
> exists, take the first empty ground slot.

This is the yard-space-maximising heuristic: the top slot is used whenever a
ground container is present. It is **dwell-blind by construction** — it never
inspects any departure time, predicted or actual. This is the practice the
simulator is arguing against, and it is deliberately not strawmanned: it is a
rational rule if ground space is the binding constraint.

### (b) Predictive — dwell-aware

Two mechanisms operate together.

**1. Block segregation by dwell bucket.** Blocks 1–2 are reserved for `short`,
blocks 3–5 for `medium`, blocks 6–8 for `long`. An arriving box prefers blocks
matching its own bucket. Segregation reduces the *variance* of departure times
within a block, which is what makes any stacking decision inside it safer.

**2. LIFO-consistent stacking.** Box B may be placed on top of box A **only if
B's predicted departure is earlier than A's** — only if B is expected to be
lifted off before A is called for. Otherwise an empty ground slot is preferred.

Search order for an arriving box:

1. Empty ground slot in a **preferred-bucket** block
2. LIFO-legal stack in a **preferred-bucket** block
3. Empty ground slot in **any other** block
4. LIFO-legal stack in **any other** block
5. **Any** top slot — recorded as a *forced stack* (see below)
6. Nothing available → the box waits at the gate and is retried next hour

Among candidate legal stacks the policy selects the ground box with the
**latest** predicted departure. This maximises the forecast margin between the
pair, so ordinary prediction error is least likely to invert their true order.

**Forced stacks.** Step 5 fires when the yard has no open ground and no
LIFO-safe stack remains. The rule is broken under congestion pressure rather
than refusing the box, and the event is counted separately (`forcedStacks`) and
surfaced in the UI. This count is the honest measure of where the policy's
advantage decays: at high utilisation the predictive yard is forced into the same
behaviour as the baseline, and §7 shows the advantage compressing accordingly.

---

## 5. Rehandle accounting

This is the core measured quantity and its definition is deliberately narrow.

> **One rehandle is charged each time a ground-tier container is called for
> departure while another container still sits on top of it.**

Each simulated hour, departures are processed in two passes:

**Pass 1 — top tier.** Every top-tier box whose departure hour has arrived
leaves. **No rehandle is charged.** A top box is directly accessible; removing it
is the productive move it was always going to require.

**Pass 2 — ground tier.** For each ground box whose departure hour has arrived:

- If the top tier is **empty**, the box leaves. **No rehandle is charged.**
- If the top tier is **occupied**, the blocking box is lifted and set down in the
  ground position the departing box vacates. **Exactly one rehandle is charged**,
  and the slot is flagged for the UI's red flash.

The two-pass order matters and is a modelling decision, not an implementation
detail: if a top box is itself due out in the same hour, it leaves in pass 1 and
the box beneath it is clear by pass 2. Charging a rehandle in that case would
count a move that never happened. This is asserted by test
(*"charges nothing when both boxes leave in the same hour"*).

**What is not charged.** Gate-in placement, gate-out lifting, and the departure
move itself are all productive moves that every policy incurs equally; charging
them would add a constant to both yards and dilute the comparison. Only the
unproductive shuffle is counted. Consequently the reported figures are a **lower
bound** on the true handling difference — a real yard would also incur travel
time and, in a >2-high yard, cascading digs.

### Cost model

| Quantity | Rate | Note |
|---|---|---|
| Reach-stacker time | **4 minutes** per rehandle | Lift, reposition, set down within the same block |
| Cost | **₹450** per rehandle | Machine hire, fuel, and operator time at prevailing Chennai CFS rates |

Ground-slot utilisation is reported as occupied ground slots ÷ 96. Top-tier
occupancy is deliberately excluded: the operational question is how much *yard
footprint* is consumed, and a stacked box consumes no additional footprint.

---

## 6. Simulation loop

One step = **one hour** of simulated time. A run is **30 simulated days**
(720 steps). Each step:

1. Process departures for both yards (§5).
2. Draw `k ~ Poisson(λ)` arrivals and generate `k` containers **once**.
3. Present that same container set to both yards; each applies its own policy.
4. Advance the clock; record cumulative rehandles every 6 hours.

Step 2/3 is what makes the experiment controlled: a single arrival stream, one
RNG, shared by both yards.

`step(state)` returns a new state and does not mutate its argument, so any hour
of a run can be retained, replayed, or diffed. The UI's play/pause and 1×/5×/20×
speeds only change how often `step` is called; they cannot change the result.

---

## 7. Representative results

Seed 42, 35% 40ft mix, 30-day run.

**This table is executable.** `docs.test.ts` parses it out of this file and
re-derives every cell from the engine, so re-tuning a constant fails the build
rather than silently invalidating a document someone may already have cited.

| λ (boxes/hr) | Accuracy | Baseline rehandles | Predictive rehandles | Forced stacks | Cost avoided |
|---|---|---|---|---|---|
| 0.8 | 95% | 288 | 4 | 0 | ₹1,27,800 |
| 0.8 | 50% | 288 | 17 | 0 | ₹1,21,950 |
| 1.2 | 95% | 405 | 19 | 3 | ₹1,73,700 |
| 1.2 | 75% | 405 | 56 | 6 | ₹1,57,050 |
| 1.2 | 50% | 405 | 81 | 5 | ₹1,45,800 |
| 1.8 | 95% | 633 | 319 | 326 | ₹1,41,300 |
| 2.5 | 95% | 805 | 695 | 719 | ₹49,500 |

Three findings, each reproducible from the seed:

1. **At moderate utilisation the saving is large.** At λ = 1.2 (≈52% ground
   utilisation under baseline) the predictive policy removes ~86–95% of
   rehandles depending on forecast accuracy.
2. **The saving degrades gracefully with forecast quality.** Halving accuracy
   from 95% to 50% costs back only part of the gain — segregation continues to
   work even when the per-box forecast is poor, because bucketing depends on the
   forecast's rank order rather than its precision.
3. **The advantage compresses under congestion.** Above ~90% ground utilisation
   the predictive yard runs out of LIFO-safe options, forced stacks climb, and
   the two policies converge. **Dwell-aware stacking is a slack-exploiting
   strategy: it converts spare ground into avoided moves, and cannot help a yard
   that has no spare ground.** This is the model's most important limitation and
   is stated here rather than left for a reader to discover.

---

## 8. Validation

`engine.test.ts` — 49 tests, run with `npm test`:

- **Stochastics** — seeded reproducibility; seed divergence; stream forking;
  log-normal recovers its stated arithmetic mean; Poisson recovers its rate.
- **Geometry** — 8 × 12 × 2 = 192; 40ft designation count and position; every
  block carries a bucket.
- **Placement** — baseline prefers top slots and is dwell-blind; predictive
  prefers ground, respects the LIFO rule, maximises forecast margin, segregates
  by bucket, spills correctly when its bucket is full, and flags forced stacks;
  neither policy ever mixes sizes; both return null on a full yard.
- **Rehandle accounting** — one charge per buried departure; the lifted box lands
  in the freed position; nothing charged for a top departure, a same-hour double
  departure, or an unstacked departure; flashes clear on the next step.
- **Invariants over full runs** — no floating box (tier 1 non-empty over an empty
  tier 0) at any hour; no box in a wrong-size slot; container conservation
  (`placed = departed + on-yard`); monotonic cumulative history; `step` does not
  mutate its input; the run halts at exactly 720 hours.
- **The claim itself** — predictive beats baseline across five independent seeds;
  the advantage narrows as accuracy degrades; a busier yard produces more
  baseline rehandles.
- **This document** (`docs.test.ts`) — the §7 results table is parsed from this
  file and every cell re-derived from the engine; the three findings stated
  under it are re-checked as inequalities; and the constants quoted in §2, §5,
  §10.1, §10.2 and §10.6 are asserted equal to the values in the code. A change
  to any modelling constant fails these tests, which is the signal to
  regenerate the table.

---

## 9. Known limitations

Stated explicitly so that any citation is bounded correctly.

1. **Two tiers only.** Real yards stack 3–4 high in places, where a dig can
   cascade. The model cannot represent multi-box digs, so it understates the
   baseline's cost.
2. **No spatial travel cost.** A rehandle is priced at a flat 4 minutes
   regardless of distance; block-to-block relocations are not modelled, and the
   lifted box always lands in the freed position rather than being relocated.
3. **No gate-hour or shift structure.** Arrivals are homogeneous Poisson across
   all 24 hours; real CFS gates are strongly peaked and shift-bound, which would
   concentrate rehandles rather than spread them.
4. **Departure timing is exogenous.** Actual dwell is drawn at gate-in and is
   unaffected by yard congestion, customs queueing, or the rehandles themselves.
5. **No equipment contention.** Reach-stackers are assumed always available; no
   queueing for machines is modelled.
6. **Synthetic parameters.** The dwell means, type mix, and the ₹450 rate are
   representative planning figures, not measurements from a specific terminal.
   Any external citation should re-parameterise from the operator's own data.
   See §11.

---

## 10. Interactive scenario (`scenario.ts`)

Benchmark mode answers *"does the rule pay?"* over 30 days and 96 slots.
Interactive mode answers a different question — *"would you have done better?"* —
by making the reader place the boxes themselves. The two share the rehandle
definition and the cost model exactly; they differ in scale and in how time
advances.

### 10.1 Yard

A single block of **8 ground slots × 2 tiers = 16 positions**, of which five
slots are designated 20ft and three 40ft. Small enough that an operator can hold
the entire yard state in their head, which is the precondition for the exercise
teaching anything.

The UI renders this as an **elevation (side-on) view** rather than the
benchmark's top-down plan. "B is stacked on A" has to be literally visible for
the lesson to land; a badge on a top-down cell does not carry it.

### 10.2 Compressed dwell

Interactive mode uses reduced dwell means, in hours:

| Cargo type | Interactive mean | Benchmark mean |
|---|---|---|
| Import DPD | 14h | 2 days |
| Import non-DPD | 46h | 6 days |
| Export | 26h | 3 days |

with log-space σ = 0.45 and bucket thresholds rescaled to match
(short < 18h, medium 18–40h, long > 40h).

**This is an accelerated teaching scenario, not a claim about real dwell.** At
full-scale means a 3-day window would be almost entirely arrivals with hardly
any pickups, so the operator would never experience a rehandle — the one thing
the exercise exists to demonstrate. The compression preserves the ordering and
the ratios that drive the stacking decision (DPD clears fastest, non-DPD
slowest, export between) while fitting the whole arrival → pickup → rehandle
cycle inside the window. Any citation of dwell figures should use §3.2, not this
table.

### 10.3 Event generation

A scenario is a fixed list of ~25 events over 72 hours, generated once from a
seed:

- **Arrivals** — 13 per scenario, at instants drawn uniformly over the first 48
  hours. Fixing the count rather than drawing it keeps every seed's demo a
  predictable length; arrival *times* remain uniform over the window, which is
  exactly the conditional distribution of a Poisson process given its arrival
  count. It is therefore the same process as §3.1, observed at fixed N.
- **Pickups** — derived from each container's actual dwell, fixed at generation.
  Crucially, a pickup time **does not depend on where the box was placed**, so
  the human operator and the policy face a byte-identical event sequence. This
  is what makes the end-of-run scorecard a like-for-like comparison rather than
  two unrelated runs.

Arrivals stop at hour 48 so their consequences land inside the run.

### 10.4 Feasibility guarantee

An arrival is emitted only when the boxes already on yard of that size number
fewer than `2 × (slots of that size)`. Because sizes never share a stack, and a
top tier is only usable when its ground tier is filled, that condition is
exactly the condition for at least one legal position to exist.

**The operator can therefore never be dealt an unplaceable box.** Any rehandle
they incur is a consequence of their own choice, never of the deal. This is
asserted by test against both extreme strategies (always-open-ground, which
exhausts slots fastest, and always-stack).

### 10.5 The advice engine

`chooseSlot()` is the predictive policy of §4(b) reduced to a single block.
Block segregation by dwell bucket is meaningless with one block, so what remains
is the LIFO rule that does the real work:

1. **Prefer open ground** — a box on the ground can never be buried.
2. Otherwise **stack only where the box beneath is forecast to leave later**,
   choosing the greatest forecast margin so ordinary prediction error is least
   likely to invert the pair.
3. If neither exists, stack anyway and **say plainly that it will probably cost
   a rehandle**.

Each branch returns a one-sentence rationale written for a yard planner rather
than a modeller. These surface in the UI's "What would Shipmate do?" hint and in
the move-by-move replay. Case 3 matters for credibility: the tool states when it
is out of good options instead of presenting a forced stack as a considered
choice.

### 10.6 Scorecard

After the run, `replayWithPolicy()` executes the identical event sequence under
the policy and the two results are compared side by side. The default demo seed
`20260704` yields 25 events, on which a careless stack-first operator incurs **6
rehandles (₹2,700)** against the policy's **1 (₹450)**.

The policy scores 1 rather than 0 by design. It is beatable on a single block —
a careful human can match or beat it — and the copy says so. The argument for
automating the decision is 96 slots and ~800 boxes a month, which is what
benchmark mode measures; overstating it at this scale would invite exactly the
scepticism the interactive mode exists to defuse.

### 10.7 Additional limitations

Beyond those in §9, specific to interactive mode:

1. **Compressed dwell** (§10.2) — the timings are pedagogical, not empirical.
2. **Fixed arrival count** — real gate arrivals vary day to day; here N is fixed
   at 13 so demo length is predictable.
3. **Perfect pickup notice** — the operator learns of a pickup at the moment it
   happens, with no advance call-forward. A real yard often has hours of notice,
   which would make good placement easier than the exercise implies.

---

## 11. Re-parameterising from real data

Everything marked *placeholder* below was chosen for plausibility, not measured.
Before any figure from this model is published or filed, replace it with the
operator's own number. Each is a single named constant:

| Constant | File | Currently | Status |
|---|---|---|---|
| `DWELL_MEAN_DAYS.DPD` | `engine.ts` | 2 days | supplied |
| `DWELL_MEAN_DAYS.NONDPD` | `engine.ts` | 6 days | supplied |
| `RUPEES_PER_REHANDLE` | `engine.ts` | ₹450 | supplied |
| `MINUTES_PER_REHANDLE` | `engine.ts` | 4 min | supplied |
| `DWELL_MEAN_DAYS.EXPORT` | `engine.ts` | 3 days | **placeholder** |
| `TYPE_WEIGHTS` | `engine.ts` | 30 / 45 / 25 | **placeholder** |
| `DWELL_SIGMA` | `engine.ts` | 0.55 | **placeholder** |
| `noiseSigma()` mapping | `engine.ts` | σ = 2(1 − A) | **placeholder** |
| `BLOCK_BUCKETS` | `engine.ts` | 2 / 3 / 3 blocks | **placeholder** |
| `SCENARIO_DWELL_MEAN_HOURS` | `scenario.ts` | 14 / 46 / 26 h | **placeholder** (§10.2) |

"Supplied" means the value came from the brief this model was built to. It is
still worth confirming against the terminal's own records before publication.

**Procedure.** Change the constant and run `npm test`. The §7 tests in
`docs.test.ts` fail with the newly-derived figures in the assertion message;
copy those into the table in §7 and re-run. The document cannot drift from the
code without the build going red.

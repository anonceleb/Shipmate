import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { C } from "../data/constants.js";
import { RUPEES_PER_REHANDLE } from "./sim/engine.ts";
import {
  DEFAULT_DEMO_SEED, HORIZON_HOURS, SCENARIO_SLOTS,
  applyArrival, applyPickup, buildScenarioYard, chooseSlot, generateScenario,
  legalPlacements, replayWithPolicy,
} from "./sim/scenario.ts";

// ── style tokens (mirrors CfsApp) ────────────────────────────────────────────
const mono = { fontFamily: "'Space Mono', monospace" };
const card = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20, marginBottom: 20 };
const sectionTitle = { fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 10 };

const BUCKET_COLOR = { short: "#2ECC71", medium: "#E8A838", long: "#8B7BF0" };
const BUCKET_LABEL = { short: "leaves soon", medium: "mid dwell", long: "long dwell" };
const FLASH = "#E74C3C";

/** Every transition is kept under 400ms so a turn feels immediate. */
const ANIM_MS = 340;
/** Replay pace — slow enough to read the rationale on each move. */
const REPLAY_MS = 1500;

const inr = n => "₹" + Math.round(n).toLocaleString("en-IN");
const hoursLabel = h => `Day ${Math.floor(h / 24) + 1}, ${String(Math.floor(h % 24)).padStart(2, "0")}:00`;

// ── SVG elevation view ───────────────────────────────────────────────────────
// Deliberately an elevation (side-on) view rather than the benchmark's top-down
// plan: "B is on top of A" has to be literally visible for the stacking lesson
// to land, and a top-down badge does not carry that.
const CELL_W = 104, CELL_H = 74, GAP = 12;
const PAD_X = 14, PAD_TOP = 26, GROUND_H = 22;
const SVG_W = SCENARIO_SLOTS * (CELL_W + GAP) - GAP + PAD_X * 2;
const SVG_H = PAD_TOP + 2 * (CELL_H + 6) + GROUND_H + 20;

const cellX = i => PAD_X + i * (CELL_W + GAP);
const cellY = tier => PAD_TOP + (tier === 1 ? 0 : CELL_H + 6);

function ContainerBox({ x, y, container, flash, dim, ghost }) {
  const colour = container ? BUCKET_COLOR[container.bucket] : C.border;
  return (
    <g style={{ transition: `opacity ${ANIM_MS}ms ease, transform ${ANIM_MS}ms ease` }}
      opacity={ghost ? 0.35 : dim ? 0.45 : 1}>
      <rect
        x={x} y={y} width={CELL_W} height={CELL_H} rx={7}
        fill={flash ? FLASH + "CC" : colour + "2E"}
        stroke={flash ? FLASH : colour}
        strokeWidth={flash ? 3 : 1.5}
        style={{ transition: `fill ${ANIM_MS}ms ease, stroke ${ANIM_MS}ms ease` }}
      />
      <text x={x + CELL_W / 2} y={y + 26} fontSize={13} textAnchor="middle"
        fill={flash ? "#fff" : colour} fontWeight="700" {...mono}>
        {container.size}FT
      </text>
      <text x={x + CELL_W / 2} y={y + 44} fontSize={10.5} textAnchor="middle"
        fill={flash ? "#fff" : C.text} {...mono}>
        {container.id}
      </text>
      <text x={x + CELL_W / 2} y={y + 60} fontSize={9.5} textAnchor="middle"
        fill={flash ? "#fff" : C.muted} {...mono}>
        out ~{Math.round(container.predictedDwellHours)}h
      </text>
    </g>
  );
}

function YardElevation({ yard, legal, onPick, hovered, setHovered, flashSlot, pickingSlot, interactive }) {
  const legalKey = useMemo(
    () => new Set((legal || []).map(p => `${p.slotIndex}:${p.tier}`)),
    [legal]
  );

  return (
    <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} width="100%"
      style={{ display: "block", touchAction: "manipulation" }}>
      {/* ground line */}
      <rect x={PAD_X - 6} y={cellY(0) + CELL_H + 4} width={SVG_W - (PAD_X - 6) * 2} height={4}
        rx={2} fill={C.border} />

      {yard.slots.map(slot => {
        const x = cellX(slot.index);
        const isFlash = flashSlot === slot.index;
        const isPicking = pickingSlot === slot.index;
        return (
          <g key={slot.index}>
            {/* slot label + size designation */}
            <text x={x + CELL_W / 2} y={PAD_TOP - 10} fontSize={11} textAnchor="middle"
              fill={C.muted} {...mono}>
              SLOT {slot.index + 1} · {slot.size}FT
            </text>

            {[1, 0].map(tier => {
              const y = cellY(tier);
              const container = slot.stack[tier];
              const key = `${slot.index}:${tier}`;
              const isLegal = legalKey.has(key);
              const isHovered = hovered && hovered.slotIndex === slot.index && hovered.tier === tier;

              if (container) {
                return (
                  <ContainerBox key={tier} x={x} y={y} container={container}
                    flash={isFlash && tier === 0} dim={isPicking && !isFlash} />
                );
              }

              return (
                <g key={tier}
                  onClick={isLegal && interactive ? () => onPick({ slotIndex: slot.index, tier }) : undefined}
                  onMouseEnter={isLegal && interactive ? () => setHovered({ slotIndex: slot.index, tier }) : undefined}
                  onMouseLeave={isLegal && interactive ? () => setHovered(null) : undefined}
                  style={{ cursor: isLegal && interactive ? "pointer" : "default" }}>
                  <rect
                    x={x} y={y} width={CELL_W} height={CELL_H} rx={7}
                    fill={isHovered ? C.accent + "33" : isLegal ? C.accent + "12" : "transparent"}
                    stroke={isLegal ? C.accent : C.border}
                    strokeWidth={isHovered ? 3 : isLegal ? 1.8 : 1}
                    strokeDasharray={isLegal ? undefined : "4 4"}
                    style={{ transition: `fill ${ANIM_MS}ms ease, stroke-width 120ms ease` }}
                  />
                  {isLegal && (
                    <text x={x + CELL_W / 2} y={y + CELL_H / 2 + 5} fontSize={12} textAnchor="middle"
                      fill={C.accent} {...mono}>
                      {tier === 1 ? "STACK HERE" : "GROUND"}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}

function Stat({ label, value, sub, tone }) {
  return (
    <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 14px" }}>
      <div style={{ fontSize: 9.5, color: C.muted, textTransform: "uppercase", letterSpacing: "0.7px" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, ...mono, color: tone || C.text, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 10.5, color: C.muted, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

const bigBtn = (accent, disabled) => ({
  padding: "13px 20px", minHeight: 46, borderRadius: 9, fontSize: 13.5, fontWeight: 600,
  cursor: disabled ? "default" : "pointer", fontFamily: "inherit",
  border: `1px solid ${disabled ? C.border : accent}`,
  background: disabled ? "transparent" : accent + "1E",
  color: disabled ? C.muted : accent,
  opacity: disabled ? 0.5 : 1,
  touchAction: "manipulation",
});

export default function InteractiveYard() {
  const [seed, setSeed] = useState(DEFAULT_DEMO_SEED);
  const scenario = useMemo(() => generateScenario(seed), [seed]);
  const aiReplay = useMemo(() => replayWithPolicy(scenario), [scenario]);

  const [yard, setYard] = useState(buildScenarioYard);
  const [cursor, setCursor] = useState(0);
  const [hovered, setHovered] = useState(null);
  const [flashSlot, setFlashSlot] = useState(null);
  const [pickingSlot, setPickingSlot] = useState(null);
  const [hint, setHint] = useState(null);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [log, setLog] = useState([]);
  const [busy, setBusy] = useState(false);

  // Replay mode ("Replay as Shipmate"). The replay drives the same `yard` state,
  // so the operator's finished yard is snapshotted before it is overwritten.
  const [replayIdx, setReplayIdx] = useState(null);
  const savedYard = useRef(null);
  const timers = useRef([]);

  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  useEffect(() => clearTimers, []);

  const reset = useCallback((nextSeed = seed) => {
    clearTimers();
    setSeed(nextSeed);
    setYard(buildScenarioYard());
    setCursor(0);
    setHovered(null);
    setFlashSlot(null);
    setPickingSlot(null);
    setHint(null);
    setHintsUsed(0);
    setLog([]);
    setBusy(false);
    setReplayIdx(null);
    savedYard.current = null;
  }, [seed]);

  const event = scenario.events[cursor] || null;
  const finished = cursor >= scenario.events.length;
  const replaying = replayIdx !== null;

  const legal = useMemo(
    () => (event && event.kind === "arrival" && !replaying ? legalPlacements(yard, event.container) : []),
    [event, yard, replaying]
  );

  // Derived from the operator's own move log rather than the live yard, so the
  // Shipmate replay (which reuses `yard`) cannot overwrite their result.
  const userRehandles = useMemo(() => log.filter(l => l.rehandled).length, [log]);
  const userCost = userRehandles * RUPEES_PER_REHANDLE;

  // ── turn actions ───────────────────────────────────────────────────────────
  const place = p => {
    if (busy || !event || event.kind !== "arrival") return;
    const advice = chooseSlot(yard, event.container);
    const agreed = advice && advice.slotIndex === p.slotIndex && advice.tier === p.tier;
    setYard(applyArrival(yard, event.container, p));
    setHovered(null);
    setHint(null);
    setLog(l => [...l, {
      hour: event.hour, kind: "arrival", text: `Placed ${event.container.id} in slot ${p.slotIndex + 1} ${p.tier === 1 ? "(stacked)" : "(ground)"}`,
      agreed,
    }]);
    setCursor(c => c + 1);
  };

  const dispatch = () => {
    if (busy || !event || event.kind !== "pickup") return;
    setBusy(true);
    const res = applyPickup(yard, event.containerId);
    setPickingSlot(res.slotIndex);
    if (res.rehandled) setFlashSlot(res.slotIndex);
    timers.current.push(setTimeout(() => {
      setYard(res.yard);
      setFlashSlot(null);
      setPickingSlot(null);
      setHint(null);
      setLog(l => [...l, {
        hour: event.hour, kind: "pickup", rehandled: res.rehandled,
        text: res.rehandled
          ? `${event.containerId} was buried — lifted ${res.movedContainerId} off first (+${inr(RUPEES_PER_REHANDLE)})`
          : `${event.containerId} lifted straight out — no shuffle`,
      }]);
      setCursor(c => c + 1);
      setBusy(false);
    }, ANIM_MS));
  };

  const askHint = () => {
    if (!event) return;
    if (event.kind === "arrival") {
      const advice = chooseSlot(yard, event.container);
      setHint(advice ? { ...advice, forPickup: false } : null);
    } else {
      const res = applyPickup(yard, event.containerId);
      setHint({
        forPickup: true,
        kind: res.rehandled ? "forced-stack" : "ground",
        rationale: res.rehandled
          ? `${event.containerId} is buried under another box. Dispatching it costs a rehandle — ${inr(RUPEES_PER_REHANDLE)} that a different placement earlier would have avoided.`
          : `${event.containerId} is clear on top, so this lifts straight out at no extra cost.`,
      });
    }
    setHintsUsed(n => n + 1);
  };

  // ── replay as Shipmate ─────────────────────────────────────────────────────
  const startReplay = () => {
    clearTimers();
    savedYard.current = yard;
    setReplayIdx(0);
    setYard(buildScenarioYard());
    aiReplay.moves.forEach((m, i) => {
      timers.current.push(setTimeout(() => {
        setReplayIdx(i);
        if (m.rehandled) {
          setFlashSlot(m.slotIndex);
          timers.current.push(setTimeout(() => setFlashSlot(null), ANIM_MS));
        }
        setYard(m.yard);
      }, i * REPLAY_MS));
    });
    timers.current.push(setTimeout(() => setReplayIdx(aiReplay.moves.length), aiReplay.moves.length * REPLAY_MS));
  };

  const stopReplay = () => {
    clearTimers();
    setReplayIdx(null);
    setFlashSlot(null);
    if (savedYard.current) setYard(savedYard.current);
  };

  const replayMove = replaying ? aiReplay.moves[Math.min(replayIdx, aiReplay.moves.length - 1)] : null;
  const replayDone = replaying && replayIdx >= aiReplay.moves.length;

  // ── hover detail: what sits under the position being considered ────────────
  const hoverGroundBox = hovered && hovered.tier === 1 ? yard.slots[hovered.slotIndex].stack[0] : null;

  const progress = (Math.min(cursor, scenario.events.length) / scenario.events.length) * 100;
  const beat = aiReplay.rehandles - userRehandles;
  // While replaying, the meters track Shipmate's running total, not the operator's.
  const shownRehandles = replaying && replayMove ? replayMove.rehandlesSoFar : userRehandles;
  const shownCost = shownRehandles * RUPEES_PER_REHANDLE;

  return (
    <>
      <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 6, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>Operate the Yard</h1>
        <span style={{ fontSize: 13, color: C.muted, ...mono }}>
          1 block · {SCENARIO_SLOTS} ground slots × 2 tiers · {scenario.events.length} events over {HORIZON_HOURS / 24} days
        </span>
      </div>
      <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 20, maxWidth: 860, lineHeight: 1.6 }}>
        You are the yard planner. Every box that arrives has to go somewhere, and nothing moves until you decide.
        Bury a box that gets called for early and you pay {inr(RUPEES_PER_REHANDLE)} to dig it out. At the end,
        we replay the identical sequence using Shipmate&rsquo;s placement rule and compare.
      </div>

      {/* ── meters ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
        <Stat label={replaying ? "Shipmate rehandles" : "Rehandles"} value={shownRehandles}
          sub={shownRehandles === 0 ? "clean so far" : "boxes dug out"}
          tone={shownRehandles > 0 ? C.red : C.green} />
        <Stat label="Cost incurred" value={inr(shownCost)}
          sub={`${inr(RUPEES_PER_REHANDLE)} per rehandle`} tone={shownCost > 0 ? C.red : C.green} />
        <Stat label="Progress" value={`${Math.min(cursor, scenario.events.length)} / ${scenario.events.length}`}
          sub={event ? hoursLabel(event.hour) : "scenario complete"} />
        <Stat label="Hints used" value={hintsUsed} sub="no penalty — this is a teaching tool" />
        <Stat label="Seed" value={seed} sub="deterministic scenario" tone={C.accent} />
      </div>

      <div style={{ height: 5, background: C.bg, borderRadius: 3, border: `1px solid ${C.border}`, overflow: "hidden", marginBottom: 20 }}>
        <div style={{ width: `${progress}%`, height: "100%", background: C.accent, transition: "width 200ms ease" }} />
      </div>

      {/* ── event card / replay narration ── */}
      {replaying ? (
        <div style={{ ...card, borderColor: C.accent }}>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 10 }}>
            <span style={{ ...sectionTitle, marginBottom: 0, color: C.accent }}>
              {replayDone ? "Replay complete" : `Shipmate replay · move ${replayIdx + 1} of ${aiReplay.moves.length}`}
            </span>
            <button onClick={stopReplay} style={bigBtn(C.muted)}>Stop replay</button>
          </div>
          {replayMove && (
            <>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
                {replayMove.kind === "arrival"
                  ? `Arrival · ${replayMove.containerId} → slot ${replayMove.slotIndex + 1}${replayMove.tier === 1 ? " (stacked)" : " (ground)"}`
                  : `Pickup · ${replayMove.containerId}${replayMove.rehandled ? " — REHANDLE" : ""}`}
              </div>
              <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>{replayMove.rationale}</div>
            </>
          )}
        </div>
      ) : finished ? null : event.kind === "arrival" ? (
        <div style={{ ...card, borderColor: C.accent }}>
          <div style={sectionTitle}>Arrival · {hoursLabel(event.hour)}</div>
          <div style={{ display: "flex", gap: 26, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, ...mono }}>{event.container.id}</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
                {event.container.size}ft ·{" "}
                {event.container.type === "DPD" ? "Import DPD"
                  : event.container.type === "NONDPD" ? "Import non-DPD" : "Export"}
              </div>
            </div>
            <div style={{ borderLeft: `1px solid ${C.border}`, paddingLeft: 26 }}>
              <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.7px" }}>
                Predicted dwell
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, ...mono, color: BUCKET_COLOR[event.container.bucket] }}>
                ~{Math.round(event.container.predictedDwellHours)}h
              </div>
              <div style={{ fontSize: 11, color: BUCKET_COLOR[event.container.bucket] }}>
                {BUCKET_LABEL[event.container.bucket]}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 200, fontSize: 13, color: C.accent }}>
              Pick a highlighted position below.
              {hoverGroundBox && (
                <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>
                  Stacking on <span style={mono}>{hoverGroundBox.id}</span>, forecast out in{" "}
                  <span style={{ ...mono, color: BUCKET_COLOR[hoverGroundBox.bucket] }}>
                    ~{Math.round(hoverGroundBox.predictedDepartureHour - event.hour)}h
                  </span>
                  {hoverGroundBox.predictedDepartureHour <= event.container.predictedDepartureHour && (
                    <span style={{ color: C.red }}> — that is sooner than this box, so it would get buried.</span>
                  )}
                </div>
              )}
            </div>
            <button onClick={askHint} style={bigBtn(C.accent)}>What would Shipmate do?</button>
          </div>
        </div>
      ) : (
        <div style={{ ...card, borderColor: C.yellow }}>
          <div style={sectionTitle}>Pickup · {hoursLabel(event.hour)}</div>
          <div style={{ display: "flex", gap: 26, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, ...mono }}>{event.containerId}</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>has been called for delivery</div>
            </div>
            <div style={{ flex: 1, minWidth: 180, fontSize: 13, color: C.muted }}>
              If it is buried, you pay to dig it out.
            </div>
            <button onClick={askHint} style={bigBtn(C.accent)}>What would Shipmate do?</button>
            <button onClick={dispatch} disabled={busy} style={bigBtn(C.yellow, busy)}>Dispatch →</button>
          </div>
        </div>
      )}

      {/* ── hint ── */}
      {hint && !replaying && (
        <div style={{
          ...card, marginTop: -8,
          borderColor: hint.kind === "forced-stack" ? C.red : C.green,
          background: (hint.kind === "forced-stack" ? C.red : C.green) + "12",
        }}>
          <div style={{ ...sectionTitle, color: hint.kind === "forced-stack" ? C.red : C.green }}>
            Shipmate says
          </div>
          <div style={{ fontSize: 13.5, lineHeight: 1.6 }}>
            {!hint.forPickup && (
              <strong style={{ ...mono, color: C.accent }}>
                Slot {hint.slotIndex + 1}, {hint.tier === 1 ? "top tier" : "ground"} —{" "}
              </strong>
            )}
            {hint.rationale}
          </div>
        </div>
      )}

      {/* ── the yard ── */}
      <div style={{ ...card, padding: 16 }}>
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: 720 }}>
            <YardElevation
              yard={yard}
              legal={legal}
              onPick={place}
              hovered={hovered}
              setHovered={setHovered}
              flashSlot={flashSlot}
              pickingSlot={pickingSlot}
              interactive={!busy && !replaying && !finished}
            />
          </div>
        </div>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
          {Object.keys(BUCKET_COLOR).map(b => (
            <span key={b} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11.5, color: C.muted }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: BUCKET_COLOR[b] + "2E", border: `1px solid ${BUCKET_COLOR[b]}` }} />
              {BUCKET_LABEL[b]}
            </span>
          ))}
          <span style={{ fontSize: 11.5, color: C.muted }}>Top tier sits above the ground tier — a box on top must come off first.</span>
        </div>
      </div>

      {/* ── scorecard ── */}
      {finished && !replaying && (
        <div style={{ ...card, borderColor: beat >= 0 ? C.green : C.accent }}>
          <div style={sectionTitle}>Scorecard — identical event sequence, seed {seed}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, marginBottom: 16 }}>
            <Stat label="Your rehandles" value={userRehandles} sub={inr(userCost)}
              tone={userRehandles > aiReplay.rehandles ? C.red : C.green} />
            <Stat label="Shipmate's rehandles" value={aiReplay.rehandles} sub={inr(aiReplay.costRupees)} tone={C.accent} />
            <Stat label="Difference"
              value={beat === 0 ? "level" : beat > 0 ? `you −${beat}` : `you +${-beat}`}
              sub={beat === 0 ? "same result" : beat > 0 ? "you did better" : "Shipmate did better"}
              tone={beat >= 0 ? C.green : C.red} />
            <Stat label="Cost delta" value={inr(Math.abs(userCost - aiReplay.costRupees))}
              sub={userCost === aiReplay.costRupees ? "no difference" : userCost > aiReplay.costRupees ? "you paid more" : "you paid less"} />
          </div>
          <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.65, marginBottom: 16 }}>
            {beat > 0
              ? "You beat the rule. Worth noting the rule is deliberately simple — prefer open ground, and only stack when the box on top is forecast to leave first — so a careful human can match or beat it on a single block. The value at yard scale is that it applies that judgement to every box, every hour, without getting tired."
              : beat === 0
                ? "You matched the rule exactly. On one block with eight slots that is very achievable; the argument for automating it is 96 slots and 800 boxes a month, not this."
                : "Shipmate placed the same boxes with fewer digs. Replay it below to see the reasoning move by move — the difference is almost always a stack formed when open ground was still available."}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={startReplay} style={bigBtn(C.accent)}>▶ Replay as Shipmate</button>
            <button onClick={() => reset(seed)} style={bigBtn(C.muted)}>Try this scenario again</button>
            <button onClick={() => reset(Math.floor(Math.random() * 99999999))} style={bigBtn(C.muted)}>New scenario</button>
          </div>
        </div>
      )}

      {replayDone && (
        <div style={{ ...card, borderColor: C.accent }}>
          <div style={sectionTitle}>Replay finished</div>
          <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, marginBottom: 14 }}>
            Shipmate finished the same {scenario.events.length} events with {aiReplay.rehandles} rehandle
            {aiReplay.rehandles === 1 ? "" : "s"} ({inr(aiReplay.costRupees)}); you finished with {userRehandles}{" "}
            ({inr(userCost)}).
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={() => reset(seed)} style={bigBtn(C.accent)}>Play it yourself again</button>
            <button onClick={() => reset(Math.floor(Math.random() * 99999999))} style={bigBtn(C.muted)}>New scenario</button>
          </div>
        </div>
      )}

      {/* ── move log ── */}
      {log.length > 0 && !replaying && (
        <div style={card}>
          <div style={sectionTitle}>Your moves</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 220, overflowY: "auto" }}>
            {log.map((l, i) => (
              <div key={i} style={{
                display: "flex", gap: 10, alignItems: "baseline", fontSize: 12.5,
                color: l.rehandled ? C.red : C.muted,
              }}>
                <span style={{ ...mono, fontSize: 11, color: C.border, minWidth: 74 }}>{hoursLabel(l.hour)}</span>
                <span>{l.text}</span>
                {l.kind === "arrival" && l.agreed === false && (
                  <span style={{ fontSize: 10.5, color: C.yellow, ...mono }}>· differs from Shipmate</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {!finished && !replaying && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={() => reset(seed)} style={bigBtn(C.muted)}>Restart scenario</button>
          <button onClick={() => reset(Math.floor(Math.random() * 99999999))} style={bigBtn(C.muted)}>New scenario</button>
        </div>
      )}
    </>
  );
}

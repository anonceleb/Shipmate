import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { C } from "../data/constants.js";
import { RUPEES_PER_REHANDLE } from "./sim/engine.ts";
import {
  DEFAULT_DEMO_SEED, HORIZON_HOURS, SCENARIO_SLOTS,
  applyArrival, applyPickup, buildScenarioYard, chooseSlot, costPreview, generateScenario,
  legalPlacements, replayWithPolicy,
} from "./sim/scenario.ts";

// ── style tokens (mirrors CfsApp) ────────────────────────────────────────────
const mono = { fontFamily: "'Space Mono', monospace" };
const card = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20, marginBottom: 20 };
const sectionTitle = { fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 10 };

const BUCKET_COLOR = { short: "#2ECC71", medium: "#E8A838", long: "#8B7BF0" };
const BUCKET_LABEL = { short: "leaves soon", medium: "mid dwell", long: "long dwell" };
const FLASH = "#E74C3C";

/** Risk colours for the live cost preview — colour-coded slot borders. */
const RISK_COLOR = { safe: "#2ECC71", risky: "#E8A838", danger: "#E74C3C" };
const RISK_BORDER = { safe: C.accent, risky: "#E8A838", danger: "#E74C3C" };

/** Every transition is kept under 400ms so a turn feels immediate. */
const ANIM_MS = 340;
/** Replay pace — slow enough to read the rationale on each move. */
const REPLAY_MS = 1500;
/**
 * How long the post-move "did that match Shipmate?" verdict stays up before
 * auto-advancing — long enough to read, short enough not to stall a demo.
 * "Continue →" skips the wait for anyone who doesn't want it.
 */
const FEEDBACK_MS = 1300;
/** Pointer movement, in px, before a press on the staged container counts as a drag rather than a tap. */
const DRAG_THRESHOLD = 6;

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

function ContainerBox({ x, y, container, flash, dim, ghost, heatMap, searchHit }) {
  const colour = container ? BUCKET_COLOR[container.bucket] : C.border;
  // Heat-map overlay: greenish if LIFO-safe, reddish if LIFO-violated
  let heatFill = null;
  if (heatMap && container) {
    heatFill = heatMap === "safe" ? "#2ECC7144" : heatMap === "risky" ? "#E8A83844" : heatMap === "danger" ? "#E74C3C55" : null;
  }
  return (
    <g style={{ transition: `opacity ${ANIM_MS}ms ease, transform ${ANIM_MS}ms ease` }}
      opacity={ghost ? 0.35 : dim ? 0.45 : 1}>
      <rect
        x={x} y={y} width={CELL_W} height={CELL_H} rx={7}
        fill={flash ? FLASH + "CC" : heatFill || colour + "2E"}
        stroke={searchHit ? "#FFD700" : flash ? FLASH : colour}
        strokeWidth={searchHit ? 3.5 : flash ? 3 : 1.5}
        style={{ transition: `fill ${ANIM_MS}ms ease, stroke ${ANIM_MS}ms ease` }}
      />
      {searchHit && (
        <rect x={x} y={y} width={CELL_W} height={CELL_H} rx={7}
          fill="none" stroke="#FFD700" strokeWidth={3.5}
          style={{ animation: "searchPulse 1.2s ease-in-out infinite" }} />
      )}
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

/** Inline keyframes for search pulse animation (injected once). */
const PULSE_STYLE = `@keyframes searchPulse { 0%,100% { opacity: 0.4; } 50% { opacity: 1; } }`;
let _pulseInjected = false;
function ensurePulseStyle() {
  if (_pulseInjected) return;
  const s = document.createElement("style");
  s.textContent = PULSE_STYLE;
  document.head.appendChild(s);
  _pulseInjected = true;
}

function YardElevation({ yard, legal, onPick, hovered, setHovered, flashSlot, pickingSlot, interactive, costPreviews, showHeatMap, searchId }) {
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
              const cp = costPreviews && costPreviews[key];

              if (container) {
                // Heat map: for stacked containers, check LIFO safety of the pair
                let hm = null;
                if (showHeatMap && tier === 0 && slot.stack[1]) {
                  const top = slot.stack[1];
                  const margin = container.predictedDepartureHour - top.predictedDepartureHour;
                  hm = margin > 12 ? "safe" : margin > 0 ? "risky" : "danger";
                } else if (showHeatMap && tier === 1 && slot.stack[0]) {
                  const below = slot.stack[0];
                  const margin = below.predictedDepartureHour - container.predictedDepartureHour;
                  hm = margin > 12 ? "safe" : margin > 0 ? "risky" : "danger";
                }
                const isSearchHit = searchId && container.id.toLowerCase().includes(searchId.toLowerCase());
                return (
                  <ContainerBox key={tier} x={x} y={y} container={container}
                    flash={isFlash && tier === 0} dim={isPicking && !isFlash}
                    heatMap={hm} searchHit={isSearchHit} />
                );
              }

              // Risk-coded colours for the live cost preview
              const riskColor = cp ? RISK_BORDER[cp.risk] : C.accent;
              const fillHover = cp ? RISK_COLOR[cp.risk] + "33" : C.accent + "33";
              const fillIdle = cp ? RISK_COLOR[cp.risk] + "12" : C.accent + "12";

              return (
                <g key={tier}
                  data-slot-index={slot.index}
                  data-tier={tier}
                  onClick={isLegal && interactive ? () => onPick({ slotIndex: slot.index, tier }) : undefined}
                  onMouseEnter={isLegal && interactive ? () => setHovered({ slotIndex: slot.index, tier }) : undefined}
                  onMouseLeave={isLegal && interactive ? () => setHovered(null) : undefined}
                  style={{ cursor: isLegal && interactive ? "pointer" : "default" }}>
                  <rect
                    x={x} y={y} width={CELL_W} height={CELL_H} rx={7}
                    fill={isHovered ? fillHover : isLegal ? fillIdle : "transparent"}
                    stroke={isLegal ? riskColor : C.border}
                    strokeWidth={isHovered ? 3 : isLegal ? 1.8 : 1}
                    strokeDasharray={isLegal ? undefined : "4 4"}
                    style={{ transition: `fill ${ANIM_MS}ms ease, stroke-width 120ms ease` }}
                  />
                  {isLegal && (
                    <>
                      <text x={x + CELL_W / 2} y={y + CELL_H / 2 - 2} fontSize={12} textAnchor="middle"
                        fill={riskColor} {...mono}>
                        {tier === 1 ? "STACK" : "GROUND"}
                      </text>
                      {/* Cost badge */}
                      {cp && (
                        <>
                          <rect x={x + CELL_W / 2 - 24} y={y + CELL_H / 2 + 6} width={48} height={18} rx={9}
                            fill={RISK_COLOR[cp.risk] + "28"} stroke={RISK_COLOR[cp.risk]} strokeWidth={1} />
                          <text x={x + CELL_W / 2} y={y + CELL_H / 2 + 19} fontSize={10} textAnchor="middle"
                            fill={RISK_COLOR[cp.risk]} fontWeight="700" {...mono}>
                            {cp.badge}
                          </text>
                        </>
                      )}
                    </>
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

/** Floating copy of the staged container that tracks the pointer while dragging. */
function DragGhost({ x, y, container, costLabel }) {
  const colour = BUCKET_COLOR[container.bucket];
  const w = 92, h = 76;
  return (
    <div style={{
      position: "fixed", left: x - w / 2, top: y - h / 2 - 24, width: w, height: h,
      pointerEvents: "none", zIndex: 1000,
      background: colour + "3A", border: `2px solid ${colour}`, borderRadius: 8,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      boxShadow: "0 10px 26px rgba(0,0,0,0.45)", transform: "scale(1.05) rotate(-1.5deg)",
    }}>
      <span style={{ fontSize: 13, fontWeight: 700, ...mono, color: colour }}>{container.size}FT</span>
      <span style={{ fontSize: 10, ...mono, color: C.text }}>{container.id}</span>
      {costLabel && (
        <span style={{
          fontSize: 10, fontWeight: 700, ...mono, marginTop: 3, padding: "2px 8px",
          borderRadius: 6,
          background: costLabel.risk === "danger" ? RISK_COLOR.danger + "33" : costLabel.risk === "risky" ? RISK_COLOR.risky + "33" : RISK_COLOR.safe + "33",
          color: RISK_COLOR[costLabel.risk],
        }}>
          {costLabel.badge}
        </span>
      )}
    </div>
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
  // Set the instant a placement lands, cleared once the verdict is dismissed
  // (timeout or "Continue →"). Drives the in-card verdict below.
  const [feedback, setFeedback] = useState(null);
  // In-progress drag of the staged incoming container. `active` only flips
  // true once the pointer clears DRAG_THRESHOLD, so a plain tap on the chip
  // is never mistaken for a failed drag.
  const [drag, setDrag] = useState(null);
  // Running cost history for the inline sparkline chart.
  const [costHistory, setCostHistory] = useState([{ step: 0, you: 0, shipmate: 0 }]);
  // Index of the log entry currently highlighted by the blame trail.
  const [blameIdx, setBlameIdx] = useState(null);
  // Heat map toggle.
  const [showHeatMap, setShowHeatMap] = useState(false);
  // Container search.
  const [searchQuery, setSearchQuery] = useState("");

  // Replay mode ("Replay as Shipmate"). The replay drives the same `yard` state,
  // so the operator's finished yard is snapshotted before it is overwritten.
  const [replayIdx, setReplayIdx] = useState(null);
  const savedYard = useRef(null);
  const timers = useRef([]);
  // Drag-start info that must not change mid-gesture (pointerId, origin, and
  // whether the threshold has been cleared). Lives in a ref rather than state
  // so the window listener below doesn't need to re-bind on every pointermove.
  const dragRef = useRef(null);

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
    setFeedback(null);
    setDrag(null);
    dragRef.current = null;
    setReplayIdx(null);
    setCostHistory([{ step: 0, you: 0, shipmate: 0 }]);
    setBlameIdx(null);
    setSearchQuery("");
    savedYard.current = null;
  }, [seed]);

  const event = scenario.events[cursor] || null;
  const finished = cursor >= scenario.events.length;
  const replaying = replayIdx !== null;

  // Cleared while `feedback` is showing — the container is already placed, so
  // there is nothing left to highlight until the next event arrives.
  const legal = useMemo(
    () => (event && event.kind === "arrival" && !replaying && !feedback ? legalPlacements(yard, event.container) : []),
    [event, yard, replaying, feedback]
  );

  // Cost preview for every legal position — fed into the SVG for risk badges.
  const costPreviews = useMemo(() => {
    if (!event || event.kind !== "arrival" || legal.length === 0) return null;
    const map = {};
    for (const p of legal) {
      map[`${p.slotIndex}:${p.tier}`] = costPreview(yard, event.container, p, event.hour);
    }
    return map;
  }, [event, yard, legal]);

  // Derived from the operator's own move log rather than the live yard, so the
  // Shipmate replay (which reuses `yard`) cannot overwrite their result.
  const userRehandles = useMemo(() => log.filter(l => l.rehandled).length, [log]);
  const userCost = userRehandles * RUPEES_PER_REHANDLE;

  // ── turn actions ───────────────────────────────────────────────────────────
  const place = p => {
    if (busy || !event || event.kind !== "arrival") return;
    const advice = chooseSlot(yard, event.container);
    const agreed = !!advice && advice.slotIndex === p.slotIndex && advice.tier === p.tier;
    const preview = costPreview(yard, event.container, p, event.hour);
    setYard(applyArrival(yard, event.container, p));
    setHovered(null);
    setHint(null);
    setDrag(null);
    setLog(l => [...l, {
      hour: event.hour, kind: "arrival",
      text: `Placed ${event.container.id} in slot ${p.slotIndex + 1} ${p.tier === 1 ? "(stacked)" : "(ground)"}`,
      agreed,
      containerId: event.container.id,
      slotIndex: p.slotIndex,
      tier: p.tier,
      risk: preview.risk,
    }]);
    // Hold on the current event, showing the verdict, before moving on — that
    // verdict is the whole point of moving the box yourself.
    setFeedback({ agreed, advice, placed: p });
    setBusy(true);
    timers.current.push(setTimeout(() => {
      setFeedback(null);
      setBusy(false);
      setCursor(c => c + 1);
    }, FEEDBACK_MS));
  };

  const skipFeedback = () => {
    clearTimers();
    setFeedback(null);
    setBusy(false);
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
      // Blame trail: find the arrival log entry that placed the blocking container
      const causedByStep = res.rehandled
        ? log.findIndex(l => l.kind === "arrival" && l.containerId === res.movedContainerId)
        : null;
      setLog(l => [...l, {
        hour: event.hour, kind: "pickup", rehandled: res.rehandled,
        causedByStep: causedByStep != null && causedByStep >= 0 ? causedByStep : null,
        text: res.rehandled
          ? `${event.containerId} was buried — lifted ${res.movedContainerId} off first (+${inr(RUPEES_PER_REHANDLE)})`
          : `${event.containerId} lifted straight out — no shuffle`,
      }]);
      // Update cost history for sparkline
      const newRehandles = log.filter(l => l.rehandled).length + (res.rehandled ? 1 : 0);
      const aiCost = aiReplay.moves.filter((m, mi) => m.rehandled && mi <= cursor).reduce((s) => s + 1, 0);
      setCostHistory(h => [...h, {
        step: h.length,
        you: newRehandles * RUPEES_PER_REHANDLE,
        shipmate: aiCost * RUPEES_PER_REHANDLE,
      }]);
      // Flash the blame trail briefly
      if (causedByStep != null && causedByStep >= 0) {
        setBlameIdx(causedByStep);
        timers.current.push(setTimeout(() => setBlameIdx(null), 4000));
      }
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

  // ── drag the staged container onto a slot ──────────────────────────────────
  const dropTargetAt = (clientX, clientY) => {
    const el = document.elementFromPoint(clientX, clientY);
    const cellEl = el && el.closest ? el.closest("[data-slot-index]") : null;
    if (!cellEl) return null;
    const slotIndex = Number(cellEl.getAttribute("data-slot-index"));
    const tier = Number(cellEl.getAttribute("data-tier"));
    return legal.some(p => p.slotIndex === slotIndex && p.tier === tier) ? { slotIndex, tier } : null;
  };

  const handleDragStart = e => {
    if (busy || !event || event.kind !== "arrival" || replaying || finished) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    // Best-effort only — correctness below does not depend on this succeeding.
    // Relying on capture alone meant that if it failed or behaved differently
    // across browsers/trackpads, the drag would die the instant the pointer
    // left this 92x60 chip, before ever reaching a slot.
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not fatal */ }
    e.preventDefault();
    dragRef.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, active: false };
    setDrag({ x: e.clientX, y: e.clientY, active: false });
  };

  // Tracks the gesture via window-level listeners rather than relying on the
  // originating element to keep receiving events — works regardless of
  // pointer capture support, and regardless of which element the pointer
  // ends up over.
  useEffect(() => {
    if (!drag) return undefined;
    // Raw pointermove fires far faster than the display can paint (well over
    // 60/sec on a real mouse or trackpad). Calling setDrag/setHovered on every
    // one of them — as this used to — re-renders the whole component that
    // often, and each render of the hover-dependent text in the event card
    // below is a different length, so the card's height changed on every one
    // of those renders and shoved the gate queue and yard beneath it up and
    // down in step: the "shaking" the whole page did during a drag. Coalescing
    // to one update per animation frame, and only touching `hovered` when the
    // hovered *cell* actually changes (not just the raw pointer position),
    // fixes both the wasted renders and the layout shift they were causing.
    let rafId = null;
    let pending = null;
    let lastHoverKey;

    const applyFrame = () => {
      rafId = null;
      const st = dragRef.current;
      if (!st || !pending) return;
      const { clientX, clientY } = pending;
      pending = null;
      setDrag({ x: clientX, y: clientY, active: st.active });
      const target = st.active ? dropTargetAt(clientX, clientY) : null;
      const key = target ? `${target.slotIndex}:${target.tier}` : "none";
      if (key !== lastHoverKey) {
        lastHoverKey = key;
        setHovered(target);
      }
    };

    const onMove = e => {
      const st = dragRef.current;
      if (!st || e.pointerId !== st.pointerId) return;
      const dx = e.clientX - st.startX, dy = e.clientY - st.startY;
      if (!st.active && Math.hypot(dx, dy) > DRAG_THRESHOLD) st.active = true;
      pending = { clientX: e.clientX, clientY: e.clientY };
      if (rafId === null) rafId = requestAnimationFrame(applyFrame);
    };
    const onUp = e => {
      if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
      const st = dragRef.current;
      dragRef.current = null;
      if (!st || e.pointerId !== st.pointerId) { setDrag(null); return; }
      setDrag(null);
      setHovered(null);
      if (!st.active) return; // a tap on the chip, not a drag — nothing to do
      const target = dropTargetAt(e.clientX, e.clientY);
      if (target) place(target);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    // Only (re)bind when a drag starts or ends, not on every intermediate
    // position update — `drag !== null` alone captures that transition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag !== null]);

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
  const hoverIsOpenGround = hovered && hovered.tier === 0;
  // Cost preview for the currently hovered slot (for the drag ghost label + tooltip text)
  const hoveredCostPreview = hovered && costPreviews ? costPreviews[`${hovered.slotIndex}:${hovered.tier}`] : null;

  const progress = (Math.min(cursor, scenario.events.length) / scenario.events.length) * 100;
  const beat = aiReplay.rehandles - userRehandles;
  // While replaying, the meters track Shipmate's running total, not the operator's.
  const shownRehandles = replaying && replayMove ? replayMove.rehandlesSoFar : userRehandles;
  const shownCost = shownRehandles * RUPEES_PER_REHANDLE;

  const interactive = !busy && !replaying && !finished && !(drag && drag.active);

  // Yard utilisation gauge — ground slots occupied / total ground slots
  const groundOccupied = yard.slots.filter(s => s.stack[0]).length;
  const totalTeu = yard.slots.reduce((t, s) => t + (s.stack[0] ? 1 : 0) + (s.stack[1] ? 1 : 0), 0);
  const groundUtilPct = Math.round((groundOccupied / SCENARIO_SLOTS) * 100);

  // Upcoming events for gate queue (next 3 events after cursor)
  const upcomingEvents = scenario.events.slice(cursor, cursor + 3);

  // Inject search pulse animation
  useEffect(() => { ensurePulseStyle(); }, []);

  return (
    <>
      {drag && drag.active && event && event.kind === "arrival" && (
        <DragGhost x={drag.x} y={drag.y} container={event.container} costLabel={hoveredCostPreview} />
      )}

      <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 6, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>Operate the Yard</h1>
        <span style={{ fontSize: 13, color: C.muted, ...mono }}>
          1 block · {SCENARIO_SLOTS} ground slots × 2 tiers · {scenario.events.length} events over {HORIZON_HOURS / 24} days
        </span>
      </div>
      <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 20, maxWidth: 860, lineHeight: 1.6 }}>
        You are the yard planner. Every box that arrives has to go somewhere, and nothing moves until you decide.
        Drag it onto a slot — or tap one — and see immediately whether that was the move Shipmate would have made.
        Bury a box that gets called for early and you pay {inr(RUPEES_PER_REHANDLE)} to dig it out. At the end,
        replay the identical sequence using Shipmate&rsquo;s rule and compare.
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

      <div style={{ height: 5, background: C.bg, borderRadius: 3, border: `1px solid ${C.border}`, overflow: "hidden", marginBottom: 10 }}>
        <div style={{ width: `${progress}%`, height: "100%", background: C.accent, transition: "width 200ms ease" }} />
      </div>

      {/* ── cost sparkline ── */}
      {costHistory.length > 1 && !replaying && (
        <div style={{ ...card, padding: "12px 16px", marginBottom: 20 }}>
          <div style={{ ...sectionTitle, marginBottom: 6 }}>Running cost</div>
          <svg viewBox={`0 0 ${Math.max(costHistory.length * 20, 200)} 60`} width="100%" height={60}
            style={{ display: "block" }} preserveAspectRatio="none">
            {/* Shipmate line */}
            <polyline
              fill="none" stroke={C.accent} strokeWidth={2} strokeDasharray="4 3"
              points={costHistory.map((p, i) => `${i * (Math.max(costHistory.length * 20, 200) / costHistory.length)},${60 - (p.shipmate / Math.max(userCost, aiReplay.costRupees, 1)) * 50}`).join(" ")}
            />
            {/* User line */}
            <polyline
              fill="none" stroke={userCost > aiReplay.costRupees ? C.red : C.green} strokeWidth={2.5}
              points={costHistory.map((p, i) => `${i * (Math.max(costHistory.length * 20, 200) / costHistory.length)},${60 - (p.you / Math.max(userCost, aiReplay.costRupees, 1)) * 50}`).join(" ")}
            />
          </svg>
          <div style={{ display: "flex", gap: 16, marginTop: 6, fontSize: 10.5, color: C.muted }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 16, height: 2, background: userCost > aiReplay.costRupees ? C.red : C.green, display: "inline-block" }} />
              You: {inr(userCost)}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 16, height: 2, background: C.accent, display: "inline-block", borderTop: "1px dashed " + C.accent }} />
              Shipmate: {inr(aiReplay.costRupees)}
            </span>
          </div>
        </div>
      )}

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
        <div style={{ ...card, borderColor: feedback ? (feedback.agreed ? C.green : C.accent) : C.accent }}>
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

            {feedback ? (
              <>
                <div style={{ flex: 1, minWidth: 240, fontSize: 13, lineHeight: 1.55 }}>
                  {feedback.agreed ? (
                    <span style={{ color: C.green }}>
                      ✓ That&rsquo;s exactly what Shipmate would have done — slot {feedback.placed.slotIndex + 1},{" "}
                      {feedback.placed.tier === 1 ? "stacked" : "ground"}.
                    </span>
                  ) : feedback.advice ? (
                    <>
                      <span style={{ color: C.text }}>
                        You used slot {feedback.placed.slotIndex + 1} ({feedback.placed.tier === 1 ? "stacked" : "ground"}).{" "}
                      </span>
                      <span style={{ color: C.accent }}>
                        Shipmate would use slot {feedback.advice.slotIndex + 1} instead ({feedback.advice.tier === 1 ? "stacked" : "ground"}):
                      </span>
                      <div style={{ color: C.muted, marginTop: 4 }}>{feedback.advice.rationale}</div>
                    </>
                  ) : (
                    <span style={{ color: C.muted }}>Shipmate had no safer option here either.</span>
                  )}
                </div>
                <button onClick={skipFeedback} style={bigBtn(C.accent)}>Continue →</button>
              </>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div
                    onPointerDown={handleDragStart}
                    style={{
                      width: 92, height: 60, borderRadius: 8, flexShrink: 0,
                      background: BUCKET_COLOR[event.container.bucket] + "2E",
                      border: `2px solid ${BUCKET_COLOR[event.container.bucket]}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: drag ? "grabbing" : "grab", touchAction: "none", userSelect: "none",
                      opacity: drag && drag.active ? 0.3 : 1,
                      transition: "opacity 150ms ease",
                    }}
                  >
                    <span style={{ fontSize: 10, ...mono, color: BUCKET_COLOR[event.container.bucket], textAlign: "center", lineHeight: 1.3 }}>
                      DRAG<br />ME
                    </span>
                  </div>
                  <div style={{ fontSize: 12.5, color: C.accent, maxWidth: 260 }}>
                    Drag onto a highlighted slot, or tap one directly.
                    {/* Fixed height regardless of which (if any) of the three hover states
                        below is showing — otherwise the card resizes on every cell the
                        pointer crosses while dragging, and everything below it (gate queue,
                        yard) visibly shifts in step. 56px measured against the longest real
                        cost-preview rationale the engine actually produces (3 lines at this
                        font/line-height/width), not a guess. */}
                    <div style={{ minHeight: 56, marginTop: 6 }}>
                      {hoveredCostPreview && (
                        <div style={{ fontSize: 12, color: RISK_COLOR[hoveredCostPreview.risk], lineHeight: 1.5 }}>
                          {hoveredCostPreview.rationale}
                        </div>
                      )}
                      {!hoveredCostPreview && hoverGroundBox && (
                        <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
                          Stacking on <span style={mono}>{hoverGroundBox.id}</span>, forecast out in{" "}
                          <span style={{ ...mono, color: BUCKET_COLOR[hoverGroundBox.bucket] }}>
                            ~{Math.round(hoverGroundBox.predictedDepartureHour - event.hour)}h
                          </span>
                          {hoverGroundBox.predictedDepartureHour <= event.container.predictedDepartureHour && (
                            <span style={{ color: C.red }}> — that is sooner than this box, so it would get buried.</span>
                          )}
                        </div>
                      )}
                      {!hoveredCostPreview && hoverIsOpenGround && (
                        <div style={{ fontSize: 12, color: C.green, lineHeight: 1.5 }}>
                          Open ground — nothing sits beneath it, so it can never be buried later.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <button onClick={askHint} style={bigBtn(C.accent)}>What would Shipmate do?</button>
              </>
            )}
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

      {/* ── gate queue + controls ── */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        {/* Gate queue — upcoming events */}
        <div style={{ flex: 1, minWidth: 300 }}>
          <div style={{ ...sectionTitle, marginBottom: 6, fontSize: 10 }}>Gate queue</div>
          <div style={{ display: "flex", gap: 8, minHeight: 42, alignItems: "center" }}>
            {upcomingEvents.length === 0 ? (
              <span style={{ fontSize: 11, color: C.muted, ...mono }}>— empty —</span>
            ) : upcomingEvents.map((ev, i) => {
              const isArrival = ev.kind === "arrival";
              const colour = isArrival ? BUCKET_COLOR[ev.container.bucket] : C.yellow;
              const label = isArrival ? ev.container.id : ev.containerId;
              return (
                <div key={i} style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                  padding: "6px 10px", borderRadius: 7, minWidth: 70,
                  background: colour + "18", border: `1px solid ${colour}`,
                  opacity: i === 0 ? 1 : 0.5 + (0.2 * (3 - i)),
                  transform: `translateX(${i * 2}px)`,
                  transition: "all 300ms ease",
                }}>
                  <span style={{ fontSize: 9, color: colour, textTransform: "uppercase", fontWeight: 700, ...mono }}>
                    {isArrival ? "IN" : "OUT"}
                  </span>
                  <span style={{ fontSize: 10, color: C.text, ...mono }}>{label}</span>
                  {isArrival && (
                    <span style={{ fontSize: 8.5, color: C.muted, ...mono }}>
                      {ev.container.size}ft · ~{Math.round(ev.container.predictedDwellHours)}h
                    </span>
                  )}
                </div>
              );
            })}
            {upcomingEvents.length > 0 && (
              <span style={{ fontSize: 10, color: C.muted, ...mono }}>→</span>
            )}
          </div>
        </div>

        {/* Utilisation gauge */}
        <div style={{ textAlign: "center", minWidth: 80 }}>
          <div style={{ ...sectionTitle, marginBottom: 4, fontSize: 10 }}>Yard use</div>
          <svg viewBox="0 0 60 60" width={56} height={56}>
            <circle cx={30} cy={30} r={24} fill="none" stroke={C.border} strokeWidth={5} />
            <circle cx={30} cy={30} r={24} fill="none"
              stroke={groundUtilPct > 85 ? C.red : groundUtilPct > 60 ? C.yellow : C.green}
              strokeWidth={5}
              strokeDasharray={`${groundUtilPct * 1.508} 200`}
              strokeLinecap="round"
              transform="rotate(-90 30 30)"
              style={{ transition: "stroke-dasharray 400ms ease, stroke 400ms ease" }}
            />
            <text x={30} y={34} fontSize={14} textAnchor="middle" fill={C.text} fontWeight="700" {...mono}>
              {groundUtilPct}%
            </text>
          </svg>
          <div style={{ fontSize: 9, color: C.muted, marginTop: 2 }}>{totalTeu} TEU on yard</div>
        </div>

        {/* Controls: heat map toggle + search */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 160 }}>
          <button onClick={() => setShowHeatMap(h => !h)} style={{
            padding: "6px 12px", borderRadius: 7, fontSize: 11, cursor: "pointer", fontFamily: "inherit",
            border: `1px solid ${showHeatMap ? C.accent : C.border}`,
            background: showHeatMap ? C.accentDim : "transparent",
            color: showHeatMap ? C.accent : C.muted,
            transition: "all 150ms ease",
          }}>
            {showHeatMap ? "◆ Heat map ON" : "◇ Heat map"}
          </button>
          <input
            type="text" placeholder="Search box ID…"
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            style={{
              padding: "6px 10px", borderRadius: 7, border: `1px solid ${C.border}`,
              background: C.bg, color: C.text, fontSize: 11, ...mono,
              outline: "none",
            }}
          />
        </div>
      </div>

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
              interactive={interactive}
              costPreviews={costPreviews}
              showHeatMap={showHeatMap}
              searchId={searchQuery}
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
          {showHeatMap && (
            <>
              <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: C.muted }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: "#2ECC7144" }} /> LIFO safe
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: C.muted }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: "#E8A83844" }} /> tight margin
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: C.muted }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: "#E74C3C55" }} /> LIFO violated
              </span>
            </>
          )}
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
                color: l.rehandled ? C.red : blameIdx === i ? "#E74C3C" : C.muted,
                background: blameIdx === i ? "#E74C3C12" : "transparent",
                borderRadius: blameIdx === i ? 5 : 0,
                padding: blameIdx === i ? "3px 6px" : 0,
                transition: "background 300ms ease, color 300ms ease",
              }}>
                <span style={{ ...mono, fontSize: 11, color: blameIdx === i ? "#E74C3C" : C.border, minWidth: 74 }}>{hoursLabel(l.hour)}</span>
                <span>{l.text}</span>
                {l.kind === "arrival" && l.agreed === false && (
                  <span style={{ fontSize: 10.5, color: C.yellow, ...mono }}>· differs from Shipmate</span>
                )}
                {l.kind === "arrival" && l.risk === "danger" && (
                  <span style={{ fontSize: 10.5, color: RISK_COLOR.danger, ...mono }}>⚠ rehandle risk</span>
                )}
                {l.kind === "arrival" && l.risk === "risky" && (
                  <span style={{ fontSize: 10.5, color: RISK_COLOR.risky, ...mono }}>⚠ tight margin</span>
                )}
                {blameIdx === i && (
                  <span style={{ fontSize: 10.5, color: "#E74C3C", ...mono, fontWeight: 600 }}>← caused rehandle</span>
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

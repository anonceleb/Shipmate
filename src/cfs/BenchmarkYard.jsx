import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { C } from "../data/constants.js";
import {
  BLOCKS, BLOCK_BUCKETS, GROUND_SLOTS, MINUTES_PER_REHANDLE, RUPEES_PER_REHANDLE,
  SLOTS_PER_BLOCK, TOTAL_POSITIONS, createSimulation, kpis, step,
} from "./sim/engine.ts";

// ── style tokens (mirrors CfsApp) ────────────────────────────────────────────
const mono = { fontFamily: "'Space Mono', monospace" };
const card = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20, marginBottom: 20 };
const sectionTitle = { fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 10 };

/** Dwell-bucket palette. Red is deliberately reserved for the rehandle flash. */
const BUCKET_COLOR = { short: "#2ECC71", medium: "#E8A838", long: "#8B7BF0" };
const BUCKET_LABEL = { short: "< 2 days", medium: "2–5 days", long: "> 5 days" };
const FLASH = "#E74C3C";

const DEFAULTS = {
  seed: 20260718,
  arrivalRatePerHour: 1.2,
  fortyFootShare: 0.35,
  predictionAccuracy: 0.8,
  runDays: 30,
};

const inr = n => "₹" + Math.round(n).toLocaleString("en-IN");

// ── SVG yard geometry ────────────────────────────────────────────────────────
const CELL_W = 30, CELL_H = 22, CELL_GAP = 3;
const BLOCK_COLS = 6;                                   // 12 slots drawn 6 wide × 2 deep
const BLOCK_PAD_X = 8, BLOCK_PAD_TOP = 19, BLOCK_PAD_BOT = 8;
const BLOCK_W = BLOCK_COLS * (CELL_W + CELL_GAP) - CELL_GAP + BLOCK_PAD_X * 2;
const BLOCK_H = 2 * (CELL_H + CELL_GAP) - CELL_GAP + BLOCK_PAD_TOP + BLOCK_PAD_BOT;
const GRID_GAP_X = 12, GRID_GAP_Y = 10;
const SVG_W = 2 * BLOCK_W + GRID_GAP_X;
const SVG_H = 4 * BLOCK_H + 3 * GRID_GAP_Y;

function blockOrigin(b) {
  return { x: (b % 2) * (BLOCK_W + GRID_GAP_X), y: Math.floor(b / 2) * (BLOCK_H + GRID_GAP_Y) };
}

function slotOrigin(slot) {
  const { x, y } = blockOrigin(slot.block);
  const c = slot.slotInBlock % BLOCK_COLS;
  const r = Math.floor(slot.slotInBlock / BLOCK_COLS);
  return {
    x: x + BLOCK_PAD_X + c * (CELL_W + CELL_GAP),
    y: y + BLOCK_PAD_TOP + r * (CELL_H + CELL_GAP),
  };
}

/**
 * Top-down yard plan. Colour encodes the dwell bucket of the *ground* box, the
 * corner badge marks a 2-high stack, and a slot flashes red on the hour it takes
 * a rehandle. Purely presentational — every number comes from the engine.
 */
function YardPlan({ yard, segregated, showHeatMap }) {
  const flashed = useMemo(() => new Set(yard.flashes), [yard.flashes]);
  return (
    <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} width="100%" style={{ display: "block" }}>
      {Array.from({ length: BLOCKS }, (_, b) => {
        const { x, y } = blockOrigin(b);
        const bucket = BLOCK_BUCKETS[b];
        return (
          <g key={`b${b}`}>
            <rect x={x} y={y} width={BLOCK_W} height={BLOCK_H} rx={6}
              fill="transparent" stroke={C.border} strokeWidth={1} />
            <text x={x + BLOCK_PAD_X} y={y + 13} fontSize={9} fill={C.muted} {...mono}>
              BLOCK {b + 1}
            </text>
            {segregated && (
              <>
                <rect x={x + BLOCK_W - BLOCK_PAD_X - 46} y={y + 5} width={46} height={10} rx={5}
                  fill={BUCKET_COLOR[bucket] + "22"} stroke={BUCKET_COLOR[bucket]} strokeWidth={0.6} />
                <text x={x + BLOCK_W - BLOCK_PAD_X - 23} y={y + 12.5} fontSize={6.5}
                  fill={BUCKET_COLOR[bucket]} textAnchor="middle" {...mono}>
                  {bucket.toUpperCase()}
                </text>
              </>
            )}
          </g>
        );
      })}

      {yard.slots.map(slot => {
        const { x, y } = slotOrigin(slot);
        const ground = slot.stack[0];
        const stacked = !!slot.stack[1];
        const isFlash = flashed.has(slot.index);
        const colour = ground ? BUCKET_COLOR[ground.bucket] : C.border;

        // Heat map: override fill for stacked pairs based on LIFO safety
        let heatFill = null;
        if (showHeatMap && ground && stacked) {
          const top = slot.stack[1];
          const margin = ground.predictedDepartureHour - top.predictedDepartureHour;
          heatFill = margin > 12 ? "#2ECC7155" : margin > 0 ? "#E8A83855" : "#E74C3C66";
        }

        return (
          <g key={slot.index}>
            <rect
              x={x} y={y} width={CELL_W} height={CELL_H} rx={3}
              fill={isFlash ? FLASH + "AA" : heatFill || (ground ? colour + "33" : "transparent")}
              stroke={isFlash ? FLASH : ground ? colour : C.border}
              strokeWidth={isFlash ? 2 : ground ? 1 : 0.7}
              strokeDasharray={ground ? undefined : "2 2"}
            />
            <text
              x={x + CELL_W / 2} y={y + CELL_H / 2 + 3} fontSize={8.5} textAnchor="middle"
              fill={isFlash ? "#fff" : ground ? colour : C.border} {...mono}
            >
              {slot.size}
            </text>
            {stacked && (
              <>
                <circle cx={x + CELL_W - 5} cy={y + 5} r={4.5}
                  fill={isFlash ? FLASH : colour} stroke={C.card} strokeWidth={0.8} />
                <text x={x + CELL_W - 5} y={y + 7.5} fontSize={6} textAnchor="middle"
                  fill={C.card} fontWeight="700" {...mono}>2</text>
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function Kpi({ label, value, sub, tone }) {
  return (
    <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px" }}>
      <div style={{ fontSize: 9.5, color: C.muted, textTransform: "uppercase", letterSpacing: "0.7px" }}>{label}</div>
      <div style={{ fontSize: 19, fontWeight: 700, ...mono, color: tone || C.text, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function YardPanel({ title, tag, yard, accent, segregated, showHeatMap }) {
  const k = kpis(yard);
  return (
    <div style={{ ...card, marginBottom: 0, flex: 1, minWidth: 430 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
        <div style={{ fontSize: 10, color: accent, ...mono, letterSpacing: "0.8px" }}>{tag}</div>
      </div>
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 14, minHeight: 30 }}>
        {segregated
          ? "Blocks reserved by dwell bucket. Stacks only where the top box is forecast to leave first."
          : "Nearest available position; a top slot is taken whenever a ground box is present."}
      </div>

      <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: 10, marginBottom: 14 }}>
        <YardPlan yard={yard} segregated={segregated} showHeatMap={showHeatMap} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
        <Kpi label="Total rehandles" value={k.rehandles.toLocaleString("en-IN")}
          sub={segregated
            ? `${k.forcedStacks} stack${k.forcedStacks === 1 ? "" : "s"} forced by congestion`
            : "every stack formed without a dwell check"}
          tone={k.rehandles > 0 ? C.red : C.green} />
        <Kpi label="Reach-stacker minutes" value={k.moveMinutes.toLocaleString("en-IN")}
          sub={`${MINUTES_PER_REHANDLE} min per rehandle`} />
        <Kpi label="Ground-slot utilisation" value={`${k.groundUtilizationPct.toFixed(1)}%`}
          sub={`${k.occupied} of ${TOTAL_POSITIONS} positions · ${k.twoHighStacks} two-high`} />
        <Kpi label="Rehandle cost" value={inr(k.costRupees)}
          sub={`${inr(RUPEES_PER_REHANDLE)} per rehandle`} tone={C.yellow} />
      </div>
      {k.queued > 0 && (
        <div style={{ marginTop: 10, fontSize: 11, color: C.red }}>
          {k.queued} box{k.queued === 1 ? "" : "es"} waiting at the gate — yard is full.
        </div>
      )}
    </div>
  );
}

function Slider({ label, value, min, max, stepSize, onChange, format }) {
  return (
    <div style={{ minWidth: 190, flex: 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.6px" }}>{label}</span>
        <span style={{ fontSize: 12, ...mono, color: C.accent }}>{format(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={stepSize} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ width: "100%", accentColor: C.accent, cursor: "pointer" }} />
    </div>
  );
}

export default function BenchmarkYard() {
  const [config, setConfig] = useState(DEFAULTS);
  const [seedInput, setSeedInput] = useState(String(DEFAULTS.seed));
  const [sim, setSim] = useState(() => createSimulation(DEFAULTS));
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(5);
  const [showHeatMap, setShowHeatMap] = useState(false);

  // Any parameter change rebuilds the run from hour zero — a run is only
  // meaningful against a fixed config, and this keeps the seed honest.
  const setParam = patch => {
    const next = { ...config, ...patch };
    setConfig(next);
    setSim(createSimulation(next));
    setPlaying(false);
  };

  const reset = () => {
    const seed = parseInt(seedInput, 10);
    setParam({ seed: Number.isFinite(seed) ? seed : DEFAULTS.seed });
  };

  const randomSeed = () => {
    const seed = Math.floor(Math.random() * 99999999);
    setSeedInput(String(seed));
    setParam({ seed });
  };

  // A finished run stops on its own — `running` is derived, not a second state
  // that has to be kept in sync with `sim.done`.
  const running = playing && !sim.done;

  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => {
      setSim(prev => {
        if (prev.done) return prev;
        let s = prev;
        const flashB = [];
        const flashP = [];
        for (let i = 0; i < speed && !s.done; i++) {
          s = step(s);
          flashB.push(...s.yards.baseline.flashes);
          flashP.push(...s.yards.predictive.flashes);
        }
        // At >1x several sim hours collapse into one frame; union their flashes
        // so a fast run still shows every rehandle it charged.
        if (speed > 1) {
          s = {
            ...s,
            yards: {
              baseline: { ...s.yards.baseline, flashes: flashB },
              predictive: { ...s.yards.predictive, flashes: flashP },
            },
          };
        }
        return s;
      });
    }, 100);
    return () => clearInterval(id);
  }, [running, speed]);

  const kb = kpis(sim.yards.baseline);
  const kp = kpis(sim.yards.predictive);
  const savedRehandles = kb.rehandles - kp.rehandles;
  const savedRupees = kb.costRupees - kp.costRupees;
  const savedPct = kb.rehandles > 0 ? (savedRehandles / kb.rehandles) * 100 : 0;

  const day = Math.floor(sim.hour / 24);
  const hourOfDay = sim.hour % 24;
  const progress = (sim.hour / (config.runDays * 24)) * 100;

  const ctlBtn = active => ({
    padding: "7px 14px", borderRadius: 7, fontSize: 12, cursor: "pointer", fontFamily: "inherit",
    border: `1px solid ${active ? C.accent : C.border}`,
    background: active ? C.accentDim : "transparent",
    color: active ? C.accent : C.muted,
  });

  return (
    <>
      <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 6, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>Benchmark — full-scale policy comparison</h1>
        <span style={{ fontSize: 13, color: C.muted, ...mono }}>
          {BLOCKS} blocks × {SLOTS_PER_BLOCK} ground slots × 2 tiers · {TOTAL_POSITIONS} positions · {config.runDays}-day run
        </span>
      </div>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 20, maxWidth: 900, lineHeight: 1.6 }}>
        Two identical yards receive the identical arrival stream and differ in one respect only: how they choose
        where to put a box. The left yard stacks to save ground; the right yard stacks only when the dwell forecast
        says the top box will leave first. Everything below is generated by a seeded engine — no recorded data.
      </div>

      {/* ── controls ── */}
      <div style={card}>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 18 }}>
          <Slider label="Arrival rate" value={config.arrivalRatePerHour} min={0.2} max={3} stepSize={0.1}
            onChange={v => setParam({ arrivalRatePerHour: v })}
            format={v => `${v.toFixed(1)} boxes/hr · λ`} />
          <Slider label="40ft share of arrivals" value={config.fortyFootShare} min={0} max={0.6} stepSize={0.05}
            onChange={v => setParam({ fortyFootShare: v })}
            format={v => `${Math.round(v * 100)}% · ${Math.round((1 - v) * 100)}% 20ft`} />
          <Slider label="Prediction accuracy" value={config.predictionAccuracy} min={0.5} max={0.95} stepSize={0.05}
            onChange={v => setParam({ predictionAccuracy: v })}
            format={v => `${Math.round(v * 100)}%`} />
          <div style={{ minWidth: 190 }}>
            <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 6 }}>
              Seed
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <input value={seedInput} onChange={e => setSeedInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && reset()}
                style={{
                  flex: 1, minWidth: 0, padding: "6px 10px", borderRadius: 6, border: `1px solid ${C.border}`,
                  background: C.bg, color: C.text, fontSize: 12, ...mono,
                }} />
              <button onClick={reset} style={ctlBtn(false)}>Reset</button>
              <button onClick={randomSeed} style={ctlBtn(false)} title="New random seed">⟳</button>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap",
          borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
          <button onClick={() => setPlaying(p => !p)} disabled={sim.done}
            style={{ ...ctlBtn(running), opacity: sim.done ? 0.4 : 1, minWidth: 92, fontWeight: 600 }}>
            {running ? "❚❚ Pause" : "▶ Play"}
          </button>
          <div style={{ display: "flex", gap: 4 }}>
            {[1, 5, 20].map(s => (
              <button key={s} onClick={() => setSpeed(s)} style={ctlBtn(speed === s)}>{s}×</button>
            ))}
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ height: 6, background: C.bg, borderRadius: 3, border: `1px solid ${C.border}`, overflow: "hidden" }}>
              <div style={{ width: `${progress}%`, height: "100%", background: C.accent, transition: "width .1s linear" }} />
            </div>
          </div>
          <div style={{ fontSize: 12, ...mono, color: C.muted, whiteSpace: "nowrap" }}>
            Day {day} · {String(hourOfDay).padStart(2, "0")}:00 · {sim.arrivalsTotal.toLocaleString("en-IN")} boxes gated in
            {sim.done && <span style={{ color: C.green }}> · run complete</span>}
          </div>
          <div style={{ fontSize: 11, ...mono, color: C.muted, whiteSpace: "nowrap",
            borderLeft: `1px solid ${C.border}`, paddingLeft: 12 }}>
            SEED <span style={{ color: C.accent }}>{config.seed}</span> · deterministic
          </div>
        </div>
      </div>

      {/* ── twin yards ── */}
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 20 }}>
        <YardPanel title="Yard A — Baseline" tag="NEAREST-SLOT STACKING"
          yard={sim.yards.baseline} accent={C.muted} segregated={false} showHeatMap={showHeatMap} />
        <YardPanel title="Yard B — Predictive" tag="DWELL-AWARE STACKING"
          yard={sim.yards.predictive} accent={C.accent} segregated showHeatMap={showHeatMap} />
      </div>

      {/* ── legend ── */}
      <div style={{ ...card, display: "flex", gap: 26, flexWrap: "wrap", alignItems: "center", padding: "14px 20px" }}>
        <span style={sectionTitle}>Legend</span>
        {Object.keys(BUCKET_COLOR).map(b => (
          <span key={b} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: C.muted }}>
            <span style={{ width: 13, height: 13, borderRadius: 3, background: BUCKET_COLOR[b] + "33",
              border: `1px solid ${BUCKET_COLOR[b]}` }} />
            Dwell {BUCKET_LABEL[b]}
          </span>
        ))}
        <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: C.muted }}>
          <span style={{ width: 13, height: 13, borderRadius: "50%", background: C.muted, color: C.card,
            fontSize: 8, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>2</span>
          Two-high stack
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: C.muted }}>
          <span style={{ width: 13, height: 13, borderRadius: 3, background: FLASH + "AA", border: `2px solid ${FLASH}` }} />
          Rehandle this hour
        </span>
        <span style={{ fontSize: 12, color: C.muted }}>Cell text = slot size (20ft / 40ft designated)</span>
        <button onClick={() => setShowHeatMap(h => !h)} style={{
          padding: "5px 12px", borderRadius: 7, fontSize: 11, cursor: "pointer", fontFamily: "inherit",
          border: `1px solid ${showHeatMap ? C.accent : C.border}`,
          background: showHeatMap ? C.accentDim : "transparent",
          color: showHeatMap ? C.accent : C.muted,
          transition: "all 150ms ease",
        }}>
          {showHeatMap ? "◆ Heat map ON" : "◇ Heat map"}
        </button>
        {showHeatMap && (
          <>
            <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: C.muted }}>
              <span style={{ width: 11, height: 11, borderRadius: 3, background: "#2ECC7155" }} /> LIFO safe
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: C.muted }}>
              <span style={{ width: 11, height: 11, borderRadius: 3, background: "#E8A83855" }} /> tight
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: C.muted }}>
              <span style={{ width: 11, height: 11, borderRadius: 3, background: "#E74C3C66" }} /> violated
            </span>
          </>
        )}
      </div>

      {/* ── the delta ── */}
      <div style={{ ...card, borderColor: savedRehandles > 0 ? C.green : C.border }}>
        <div style={sectionTitle}>Predictive vs baseline — 30-day delta</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
          <Kpi label="Rehandles avoided" value={savedRehandles.toLocaleString("en-IN")}
            sub={`${savedPct.toFixed(1)}% of baseline`} tone={C.green} />
          <Kpi label="Reach-stacker time freed" value={`${(savedRehandles * MINUTES_PER_REHANDLE / 60).toFixed(1)} hrs`}
            sub={`${(savedRehandles * MINUTES_PER_REHANDLE).toLocaleString("en-IN")} minutes`} tone={C.green} />
          <Kpi label="Cost avoided" value={inr(savedRupees)}
            sub={`at ${inr(RUPEES_PER_REHANDLE)} per rehandle`} tone={C.green} />
          <Kpi label="Annualised" value={inr(savedRupees * (365 / config.runDays))}
            sub="straight-line from the 30-day run" tone={C.green} />
          <Kpi label="Ground utilisation" value={`${kb.groundUtilizationPct.toFixed(0)}% → ${kp.groundUtilizationPct.toFixed(0)}%`}
            sub={`of ${GROUND_SLOTS} ground slots`} />
        </div>
      </div>

      {/* ── cumulative rehandles ── */}
      <div style={card}>
        <div style={sectionTitle}>Cumulative rehandles over the run</div>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={sim.history} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
            <XAxis dataKey="day" stroke={C.muted} tick={{ fontSize: 11 }}
              domain={[0, config.runDays]} type="number" allowDecimals={false}
              label={{ value: "Simulated day", position: "insideBottom", offset: -2, fill: C.muted, fontSize: 11 }} />
            <YAxis stroke={C.muted} tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: C.muted }}
              labelFormatter={d => `Day ${Number(d).toFixed(1)}`} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="baseline" name="Baseline (nearest slot)"
              stroke={C.red} strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="predictive" name="Predictive (dwell-aware)"
              stroke={C.green} strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 10, lineHeight: 1.6 }}>
          A rehandle is charged once each time a ground box is called for while another box sits on top of it.
          Both yards process the same containers with the same true dwell times, so the gap between the lines is
          attributable to stacking policy alone. Method and parameter provenance:{" "}
          <span style={{ ...mono, color: C.accent }}>src/cfs/sim/README.md</span>.
        </div>
      </div>
    </>
  );
}

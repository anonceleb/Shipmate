import { useCallback, useMemo, useState } from "react";
import { C } from "../data/constants.js";
import { RUPEES_PER_REHANDLE, runToCompletion } from "./sim/engine.ts";
import InteractiveYard from "./InteractiveYard.jsx";
import BenchmarkYard from "./BenchmarkYard.jsx";

const mono = { fontFamily: "'Space Mono', monospace" };
const card = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20, marginBottom: 20 };
const sectionTitle = { fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 10 };

const inr = n => "₹" + Math.round(n).toLocaleString("en-IN");

const MODES = [
  {
    id: "operate",
    label: "Operate the Yard",
    hint: "Turn-based — you place every box",
  },
  {
    id: "benchmark",
    label: "Benchmark",
    hint: "Auto-run — 30 days, 96 slots, both policies",
  },
  {
    id: "tournament",
    label: "Tournament",
    hint: "50 seeds — statistical proof at a glance",
  },
];

const TOURNAMENT_SEEDS = 50;
const TOURNAMENT_CONFIG = {
  arrivalRatePerHour: 1.2,
  fortyFootShare: 0.35,
  predictionAccuracy: 0.8,
  runDays: 30,
};

/**
 * Run a single seed to completion and return the delta.
 * This is O(720 steps) — ~2ms per seed, so 50 seeds ≈ 100ms.
 */
function runSeed(seed) {
  const sim = runToCompletion({ ...TOURNAMENT_CONFIG, seed });
  const baseline = sim.yards.baseline.rehandles;
  const predictive = sim.yards.predictive.rehandles;
  return {
    seed,
    baseline,
    predictive,
    saved: baseline - predictive,
    savedPct: baseline > 0 ? ((baseline - predictive) / baseline) * 100 : 0,
    savedRupees: (baseline - predictive) * RUPEES_PER_REHANDLE,
  };
}

function TournamentMode() {
  const [results, setResults] = useState(null);
  const [running, setRunning] = useState(false);

  const run = useCallback(() => {
    setRunning(true);
    // Use requestAnimationFrame to let the UI update before blocking
    requestAnimationFrame(() => {
      const out = [];
      for (let i = 0; i < TOURNAMENT_SEEDS; i++) {
        const seed = 1000000 + i * 7919; // deterministic, spread-out seeds
        out.push(runSeed(seed));
      }
      setResults(out);
      setRunning(false);
    });
  }, []);

  // Stats
  const stats = useMemo(() => {
    if (!results) return null;
    const saved = results.map(r => r.saved);
    const savedPct = results.map(r => r.savedPct);
    const wins = results.filter(r => r.saved > 0).length;
    const ties = results.filter(r => r.saved === 0).length;
    const losses = results.filter(r => r.saved < 0).length;
    const totalSaved = saved.reduce((a, b) => a + b, 0);
    const avgSaved = totalSaved / results.length;
    const avgPct = savedPct.reduce((a, b) => a + b, 0) / results.length;
    const minSaved = Math.min(...saved);
    const maxSaved = Math.max(...saved);
    const totalRupees = results.reduce((a, r) => a + r.savedRupees, 0);
    return { wins, ties, losses, avgSaved, avgPct, minSaved, maxSaved, totalRupees, totalSaved };
  }, [results]);

  // Histogram: bucket savings into ranges
  const histogram = useMemo(() => {
    if (!results) return null;
    const buckets = {};
    for (const r of results) {
      const key = Math.floor(r.savedPct / 10) * 10;
      const label = `${key}–${key + 10}%`;
      buckets[label] = (buckets[label] || 0) + 1;
    }
    // Ensure we have a full range from 0 to 100
    const labels = [];
    for (let i = 0; i <= 90; i += 10) {
      const label = `${i}–${i + 10}%`;
      labels.push({ label, count: buckets[label] || 0 });
    }
    // Add negative bucket if any losses
    if (results.some(r => r.savedPct < 0)) {
      labels.unshift({ label: "< 0%", count: results.filter(r => r.savedPct < 0).length });
    }
    return labels.filter(l => l.count > 0 || l.label === "0–10%" || l.label === "50–60%");
  }, [results]);

  const maxBar = histogram ? Math.max(...histogram.map(h => h.count)) : 1;

  return (
    <>
      <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 6, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>Tournament — multi-seed proof</h1>
        <span style={{ fontSize: 13, color: C.muted, ...mono }}>
          {TOURNAMENT_SEEDS} independent scenarios · identical config · different random seeds
        </span>
      </div>
      <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 20, maxWidth: 860, lineHeight: 1.6 }}>
        Does the predictive policy win because we chose a friendly seed, or does it win in general?
        This runs {TOURNAMENT_SEEDS} complete 30-day simulations with different seeds and shows the
        distribution of rehandle savings. If the histogram is overwhelmingly to the right of zero,
        the result is structural, not luck.
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        <button onClick={run} disabled={running} style={{
          padding: "13px 24px", borderRadius: 9, fontSize: 14, fontWeight: 600,
          cursor: running ? "default" : "pointer", fontFamily: "inherit",
          border: `1px solid ${C.accent}`,
          background: C.accentDim,
          color: C.accent,
          opacity: running ? 0.5 : 1,
        }}>
          {running ? "Running…" : results ? `Re-run ${TOURNAMENT_SEEDS} scenarios` : `▶ Run ${TOURNAMENT_SEEDS} scenarios`}
        </button>
      </div>

      {results && stats && (
        <>
          {/* ── Summary stats ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
            <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 14px" }}>
              <div style={{ fontSize: 9.5, color: C.muted, textTransform: "uppercase", letterSpacing: "0.7px" }}>Shipmate wins</div>
              <div style={{ fontSize: 22, fontWeight: 700, ...mono, color: C.green, marginTop: 4 }}>
                {stats.wins} / {TOURNAMENT_SEEDS}
              </div>
              <div style={{ fontSize: 10.5, color: C.muted, marginTop: 3 }}>
                {stats.ties} tie{stats.ties !== 1 ? "s" : ""}, {stats.losses} loss{stats.losses !== 1 ? "es" : ""}
              </div>
            </div>
            <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 14px" }}>
              <div style={{ fontSize: 9.5, color: C.muted, textTransform: "uppercase", letterSpacing: "0.7px" }}>Avg rehandles saved</div>
              <div style={{ fontSize: 22, fontWeight: 700, ...mono, color: C.green, marginTop: 4 }}>
                {stats.avgSaved.toFixed(1)}
              </div>
              <div style={{ fontSize: 10.5, color: C.muted, marginTop: 3 }}>
                {stats.avgPct.toFixed(1)}% avg reduction
              </div>
            </div>
            <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 14px" }}>
              <div style={{ fontSize: 9.5, color: C.muted, textTransform: "uppercase", letterSpacing: "0.7px" }}>Range</div>
              <div style={{ fontSize: 22, fontWeight: 700, ...mono, color: C.text, marginTop: 4 }}>
                {stats.minSaved}–{stats.maxSaved}
              </div>
              <div style={{ fontSize: 10.5, color: C.muted, marginTop: 3 }}>rehandles saved (min–max)</div>
            </div>
            <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 14px" }}>
              <div style={{ fontSize: 9.5, color: C.muted, textTransform: "uppercase", letterSpacing: "0.7px" }}>Total cost avoided</div>
              <div style={{ fontSize: 22, fontWeight: 700, ...mono, color: C.green, marginTop: 4 }}>
                {inr(stats.totalRupees)}
              </div>
              <div style={{ fontSize: 10.5, color: C.muted, marginTop: 3 }}>
                across all {TOURNAMENT_SEEDS} runs
              </div>
            </div>
          </div>

          {/* ── Histogram ── */}
          <div style={card}>
            <div style={sectionTitle}>Rehandle savings distribution (% reduction)</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 160, marginBottom: 8 }}>
              {histogram.map((h, i) => (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
                  <div style={{ fontSize: 10, ...mono, color: C.text, marginBottom: 4 }}>
                    {h.count > 0 ? h.count : ""}
                  </div>
                  <div style={{
                    width: "100%", maxWidth: 48,
                    height: `${Math.max((h.count / maxBar) * 120, h.count > 0 ? 6 : 0)}px`,
                    background: h.label.startsWith("<") ? C.red + "66"
                      : h.label.startsWith("0") ? C.yellow + "55"
                      : C.green + "55",
                    border: `1px solid ${h.label.startsWith("<") ? C.red : h.label.startsWith("0") ? C.yellow : C.green}`,
                    borderRadius: "4px 4px 0 0",
                    transition: "height 400ms ease",
                  }} />
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {histogram.map((h, i) => (
                <div key={i} style={{
                  flex: 1, textAlign: "center",
                  fontSize: 8.5, color: C.muted, ...mono,
                }}>
                  {h.label}
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 14, lineHeight: 1.6 }}>
              Each bar counts how many of the {TOURNAMENT_SEEDS} scenarios fell into that savings bracket.
              {stats.wins === TOURNAMENT_SEEDS
                ? " The predictive policy won every single scenario — this is not a cherry-picked result."
                : ` The predictive policy won in ${stats.wins} of ${TOURNAMENT_SEEDS} scenarios (${((stats.wins / TOURNAMENT_SEEDS) * 100).toFixed(0)}%).`}
            </div>
          </div>

          {/* ── Per-seed table ── */}
          <div style={card}>
            <div style={sectionTitle}>Per-seed breakdown</div>
            <div style={{ maxHeight: 320, overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5, ...mono }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                    <th style={{ textAlign: "left", padding: "6px 10px", color: C.muted, fontWeight: 500 }}>Seed</th>
                    <th style={{ textAlign: "right", padding: "6px 10px", color: C.muted, fontWeight: 500 }}>Baseline</th>
                    <th style={{ textAlign: "right", padding: "6px 10px", color: C.muted, fontWeight: 500 }}>Predictive</th>
                    <th style={{ textAlign: "right", padding: "6px 10px", color: C.muted, fontWeight: 500 }}>Saved</th>
                    <th style={{ textAlign: "right", padding: "6px 10px", color: C.muted, fontWeight: 500 }}>%</th>
                    <th style={{ textAlign: "right", padding: "6px 10px", color: C.muted, fontWeight: 500 }}>₹ saved</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map(r => (
                    <tr key={r.seed} style={{
                      borderBottom: `1px solid ${C.border}22`,
                      background: r.saved > 0 ? C.green + "08" : r.saved < 0 ? C.red + "08" : "transparent",
                    }}>
                      <td style={{ padding: "5px 10px", color: C.accent }}>{r.seed}</td>
                      <td style={{ padding: "5px 10px", textAlign: "right", color: C.red }}>{r.baseline}</td>
                      <td style={{ padding: "5px 10px", textAlign: "right", color: C.green }}>{r.predictive}</td>
                      <td style={{ padding: "5px 10px", textAlign: "right", fontWeight: 600, color: r.saved > 0 ? C.green : r.saved < 0 ? C.red : C.muted }}>
                        {r.saved > 0 ? `+${r.saved}` : r.saved}
                      </td>
                      <td style={{ padding: "5px 10px", textAlign: "right", color: r.savedPct > 0 ? C.green : C.muted }}>
                        {r.savedPct.toFixed(1)}%
                      </td>
                      <td style={{ padding: "5px 10px", textAlign: "right", color: r.savedRupees > 0 ? C.green : C.muted }}>
                        {inr(r.savedRupees)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}

/**
 * Yard Digital Twin. Three ways in:
 *
 *   - "Operate the Yard" (default) — a single block a person actually plays,
 *     one decision at a time. This is the one that changes minds in a demo.
 *   - "Benchmark" — the full-scale 30-day auto-run that proves the claim
 *     statistically.
 *   - "Tournament" — 50-seed batch run that proves the claim across many
 *     random scenarios, addressing the "cherry-picked seed" objection.
 *
 * All three are driven by the same pure engine in ./sim.
 */
export default function YardSimulator() {
  const [mode, setMode] = useState("operate");

  return (
    <>
      <div style={{
        display: "flex", gap: 8, marginBottom: 22, flexWrap: "wrap", alignItems: "stretch",
      }}>
        {MODES.map(m => {
          const active = mode === m.id;
          return (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              style={{
                textAlign: "left", padding: "11px 18px", minHeight: 46, borderRadius: 9,
                cursor: "pointer", fontFamily: "inherit", touchAction: "manipulation",
                border: `1px solid ${active ? C.accent : C.border}`,
                background: active ? C.accentDim : "transparent",
                color: active ? C.accent : C.muted,
                transition: "border-color .15s, color .15s",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600 }}>{m.label}</div>
              <div style={{ fontSize: 10.5, ...mono, marginTop: 3, opacity: 0.8 }}>{m.hint}</div>
            </button>
          );
        })}
      </div>

      {mode === "operate" ? <InteractiveYard />
        : mode === "benchmark" ? <BenchmarkYard />
        : <TournamentMode />}
    </>
  );
}

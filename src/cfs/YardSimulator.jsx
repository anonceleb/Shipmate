import { useState } from "react";
import { C } from "../data/constants.js";
import InteractiveYard from "./InteractiveYard.jsx";
import BenchmarkYard from "./BenchmarkYard.jsx";

const mono = { fontFamily: "'Space Mono', monospace" };

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
];

/**
 * Yard Digital Twin. Two ways in:
 *
 *   - "Operate the Yard" (default) — a single block a person actually plays,
 *     one decision at a time. This is the one that changes minds in a demo.
 *   - "Benchmark" — the full-scale 30-day auto-run that proves the claim
 *     statistically.
 *
 * Both are driven by the same pure engine in ./sim.
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

      {mode === "operate" ? <InteractiveYard /> : <BenchmarkYard />}
    </>
  );
}

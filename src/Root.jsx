import { useState } from "react";
import App from "./App.jsx";
import CfsApp from "./cfs/CfsApp.jsx";
import { C } from "./data/constants.js";

const MODULES = [
  {
    id: "cff", title: "CFF Analytics Intelligence", tag: "FREIGHT FORWARDER",
    desc: "Combined Freight Forwarders, Chennai — jobs, customs filings, duty drawback recovery, quote intelligence, profitability.",
    accent: "#E8A838", initials: "CFF",
  },
  {
    id: "cfs", title: "CFS Analytics Intelligence", tag: "CONTAINER FREIGHT STATION",
    desc: "Northgate Container Terminal, Manali — tariff reconciliation & leakage recovery, dwell & ground rent, Section 48 auction track, activity-based profitability.",
    accent: "#1a9fd9", initials: "NXS",
  },
];

export default function Root() {
  const [module, setModule] = useState(() => sessionStorage.getItem("demo_module") || null);
  const pick = id => { sessionStorage.setItem("demo_module", id); setModule(id); };
  const reset = () => { sessionStorage.removeItem("demo_module"); setModule(null); };

  if (module === "cff") return <App onSwitch={reset} />;
  if (module === "cfs") return <CfsApp onSwitch={reset} />;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'DM Sans', sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ fontSize: 12, color: C.muted, fontFamily: "'Space Mono', monospace", letterSpacing: 2, marginBottom: 10 }}>STREAK · LOGISTICS INTELLIGENCE DEMOS</div>
      <div style={{ fontSize: 26, fontWeight: 600, marginBottom: 36 }}>Choose a demo workspace</div>
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", justifyContent: "center", maxWidth: 980 }}>
        {MODULES.map(m => (
          <div key={m.id} onClick={() => pick(m.id)}
            style={{ width: 420, background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 28, cursor: "pointer", transition: "border-color .15s" }}
            onMouseEnter={e => e.currentTarget.style.borderColor = m.accent}
            onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
              <div style={{ width: 42, height: 42, background: m.accent, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", color: m.id === "cff" ? "#000" : "#fff", fontFamily: "'Space Mono', monospace", fontWeight: 700, fontSize: 14 }}>{m.initials}</div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 16 }}>{m.title}</div>
                <div style={{ fontSize: 10, color: m.accent, fontFamily: "'Space Mono', monospace", letterSpacing: 1.5 }}>{m.tag}</div>
              </div>
            </div>
            <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>{m.desc}</div>
            <div style={{ marginTop: 18, fontSize: 12, color: m.accent }}>Open workspace →</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 36, fontSize: 11, color: C.muted, fontFamily: "'Space Mono', monospace" }}>ALL DATA SYNTHETIC · DEMO ONLY</div>
    </div>
  );
}

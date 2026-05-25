import React, { useState } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { C } from "../data/constants.js";
import { MONTHLY_TREND, MODE_BREAKDOWN, fmt } from "../utils/computations.js";
import TradeLaneMap from "./TradeLaneMap.jsx";

// ── CHARTS TAB ─────────────────────────────────────────────────────────────────
export default function ChartsTab({ onSelectClient }) {
  const [view, setView] = useState("revenue");
  const tooltipStyle = { background: C.surface, border: `1px solid ${C.border}`, color: C.text, fontSize: 12, borderRadius: 6 };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", gap: 8 }}>
        {[["revenue","Revenue Trends"], ["lanes","Trade Lane Map"]].map(([v, l]) => (
          <button key={v} onClick={() => setView(v)}
            style={{ padding: "7px 16px", borderRadius: 6, border: `1px solid ${view === v ? C.accent : C.border}`,
              background: view === v ? C.accentDim : "transparent",
              color: view === v ? C.accent : C.muted, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
            {l}
          </button>
        ))}
      </div>

      {view === "revenue" ? (
        <>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 16 }}>Monthly Revenue vs Cost vs Margin</div>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={MONTHLY_TREND} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                <XAxis dataKey="month" tick={{ fill: C.muted, fontSize: 11 }} axisLine={{ stroke: C.border }} />
                <YAxis tickFormatter={v => `₹${fmt(v)}`} tick={{ fill: C.muted, fontSize: 10 }} axisLine={{ stroke: C.border }} width={72} />
                <Tooltip formatter={v => `₹${fmt(v)}`} contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12, color: C.muted }} />
                <Line type="monotone" dataKey="revenue" stroke={C.accent}  strokeWidth={2} dot={false} name="Revenue" />
                <Line type="monotone" dataKey="cost"    stroke={C.muted}   strokeWidth={1.5} dot={false} name="Cost" strokeDasharray="4 2" />
                <Line type="monotone" dataKey="margin"  stroke={C.green}   strokeWidth={2} dot={false} name="Margin" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 16 }}>Revenue & Margin by Freight Mode</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={MODE_BREAKDOWN} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                <XAxis dataKey="mode" tick={{ fill: C.muted, fontSize: 11 }} axisLine={{ stroke: C.border }} />
                <YAxis tickFormatter={v => `₹${fmt(v)}`} tick={{ fill: C.muted, fontSize: 10 }} axisLine={{ stroke: C.border }} width={72} />
                <Tooltip formatter={v => `₹${fmt(v)}`} contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12, color: C.muted }} />
                <Bar dataKey="revenue" fill={C.accent}  name="Revenue" radius={[4, 4, 0, 0]} fillOpacity={0.85} />
                <Bar dataKey="margin"  fill={C.green}   name="Margin"  radius={[4, 4, 0, 0]} fillOpacity={0.85} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : (
        <TradeLaneMap onSelectClient={onSelectClient} />
      )}
    </div>
  );
}



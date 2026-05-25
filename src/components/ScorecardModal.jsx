import React from "react";
import { CLIENTS, JOBS, CUSTOMS_FILINGS, WAREHOUSE, C } from "../data/constants.js";
import { COMPLIANCE_RISK, WAREHOUSE_STATS, fmt, pct, riskColour } from "../utils/computations.js";

// ── SCORECARD MODAL ────────────────────────────────────────────────────────────
export default function ScorecardModal({ clientId, onClose }) {
  const client  = CLIENTS.find(c => c.client_id === clientId);
  const jobs    = JOBS.filter(j => j.client_id === clientId);
  const done    = jobs.filter(j => j.status === "Completed");
  const revenue = done.reduce((s, j) => s + j.revenue, 0);
  const cost    = done.reduce((s, j) => s + j.cost, 0);
  const margin  = revenue - cost;
  const risk    = COMPLIANCE_RISK.find(r => r.client_id === clientId);
  const wh      = WAREHOUSE_STATS.find(w => w.client_id === clientId);

  const STAT_FONT = { fontFamily: "'Space Mono',monospace" };

  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div onClick={e => e.stopPropagation()} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, width:"100%", maxWidth:780, maxHeight:"90vh", overflowY:"auto" }}>
        {/* Header */}
        <div style={{ padding:"20px 24px", borderBottom:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontSize:18, fontWeight:700, color:C.text }}>{client.name}</div>
            <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>{client.industry} · Client since {client.onboarded_year}</div>
          </div>
          <button onClick={onClose} style={{ background:"transparent", border:`1px solid ${C.border}`, color:C.muted, borderRadius:6, padding:"6px 12px", cursor:"pointer", fontSize:13 }}>✕ Close</button>
        </div>

        <div style={{ padding:24, display:"flex", flexDirection:"column", gap:20 }}>
          {/* Revenue strip */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
            {[
              { label:"Revenue", val:`₹${fmt(revenue)}` },
              { label:"Cost",    val:`₹${fmt(cost)}` },
              { label:"Margin",  val:`₹${fmt(margin)}` },
              { label:"Margin %",val:pct(margin, revenue) },
            ].map(s => (
              <div key={s.label} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:14 }}>
                <div style={{ fontSize:10, color:C.muted, textTransform:"uppercase", letterSpacing:"0.6px", marginBottom:6 }}>{s.label}</div>
                <div style={{ ...STAT_FONT, fontSize:15, color:C.accent }}>{s.val}</div>
              </div>
            ))}
          </div>

          {/* Compliance */}
          {risk && (
            <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:16 }}>
              <div style={{ fontSize:11, color:C.muted, textTransform:"uppercase", letterSpacing:"0.8px", marginBottom:12 }}>Compliance Profile</div>
              <div style={{ display:"flex", gap:16, alignItems:"center" }}>
                <div style={{ width:64, height:64, borderRadius:"50%", background:`conic-gradient(${riskColour(risk.level)} ${risk.riskScore}%, ${C.border} 0)`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <div style={{ width:46, height:46, borderRadius:"50%", background:C.card, display:"flex", alignItems:"center", justifyContent:"center", ...STAT_FONT, fontSize:14, color:riskColour(risk.level), fontWeight:700 }}>{risk.riskScore}</div>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, flex:1 }}>
                  {[
                    { label:"Risk Level",    val:risk.level, colour:riskColour(risk.level) },
                    { label:"Exam Rate",     val:`${risk.examinationRate}%` },
                    { label:"Amendments",    val:`${risk.totalAmendments} across ${risk.totalFilings} filings` },
                  ].map(s => (
                    <div key={s.label}>
                      <div style={{ fontSize:10, color:C.muted, textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:4 }}>{s.label}</div>
                      <div style={{ ...STAT_FONT, fontSize:13, color: s.colour || C.text }}>{s.val}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Warehouse */}
          {wh && (
            <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:16 }}>
              <div style={{ fontSize:11, color:C.muted, textTransform:"uppercase", letterSpacing:"0.8px", marginBottom:12 }}>Warehouse Usage</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
                {[
                  { label:"Total CBM",   val:wh.total_cbm },
                  { label:"Charges",     val:`₹${fmt(wh.total_charges)}` },
                  { label:"₹ per CBM",   val:`₹${fmt(wh.cost_per_cbm)}` },
                ].map(s => (
                  <div key={s.label}>
                    <div style={{ fontSize:10, color:C.muted, textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:4 }}>{s.label}</div>
                    <div style={{ ...STAT_FONT, fontSize:14, color:C.text }}>{s.val}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Job history */}
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, overflow:"hidden" }}>
            <div style={{ padding:"12px 16px", borderBottom:`1px solid ${C.border}`, fontSize:11, color:C.muted, textTransform:"uppercase", letterSpacing:"0.8px" }}>
              Job History ({jobs.length})
            </div>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
              <thead>
                <tr style={{ background:C.surface }}>
                  {["Job","Date","Mode","Route","Service","Revenue","Margin","Status"].map(h => (
                    <th key={h} style={{ padding:"8px 12px", textAlign:"left", color:C.muted, fontSize:10, textTransform:"uppercase", letterSpacing:"0.5px", borderBottom:`1px solid ${C.border}`, whiteSpace:"nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {jobs.map(j => (
                  <tr key={j.job_id} style={{ borderBottom:`1px solid ${C.border}40` }}>
                    <td style={{ padding:"8px 12px", ...STAT_FONT, fontSize:11, color:C.accent }}>{j.job_id}</td>
                    <td style={{ padding:"8px 12px", color:C.muted }}>{j.job_date}</td>
                    <td style={{ padding:"8px 12px", color:C.text }}>{j.mode}</td>
                    <td style={{ padding:"8px 12px", color:C.muted, whiteSpace:"nowrap" }}>{j.origin} → {j.destination}</td>
                    <td style={{ padding:"8px 12px", color:C.muted, fontSize:11 }}>{j.service}</td>
                    <td style={{ padding:"8px 12px", ...STAT_FONT, fontSize:11, color:C.text }}>₹{fmt(j.revenue)}</td>
                    <td style={{ padding:"8px 12px", ...STAT_FONT, fontSize:11, color:C.green }}>₹{fmt(j.revenue - j.cost)}</td>
                    <td style={{ padding:"8px 12px" }}>
                      <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background: j.status === "Completed" ? "#1a3a2a" : "#2a1a3a", color: j.status === "Completed" ? C.green : "#A78BFA" }}>
                        {j.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── TRADE LANE MAP ─────────────────────────────────────────────────────────────

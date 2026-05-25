import React, { useState } from "react";
import { LineChart, BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from "recharts";
import { CLIENTS, JOBS, C, JOB_COST_LINES, CARRIERS, RATE_HISTORY } from "../data/constants.js";
import { fmt } from "../utils/computations.js";
import ClientLink from "./ClientLink.jsx";

export default function ProfitabilityTab({ onSelectClient }) {
  const [selectedLane, setSelectedLane] = useState(null);
  const [selectedRateClient, setSelectedRateClient] = useState(4);

  // -- SECTION 1 --
  const completedJobs = JOBS.filter(j => j.status === "Completed");
  
  const laneStatsMap = {};
  completedJobs.forEach(j => {
    const laneKey = `${j.origin}||${j.destination}`;
    if (!laneStatsMap[laneKey]) {
      laneStatsMap[laneKey] = { origin: j.origin, destination: j.destination, total_revenue: 0, total_buy: 0, total_sell: 0, unrecovered: 0, job_count: 0 };
    }
    const st = laneStatsMap[laneKey];
    st.total_revenue += j.revenue;
    st.job_count += 1;
  });

  JOB_COST_LINES.forEach(cl => {
    const job = completedJobs.find(j => j.job_id === cl.job_id);
    if (!job) return;
    const laneKey = `${job.origin}||${job.destination}`;
    const st = laneStatsMap[laneKey];
    st.total_buy += cl.buy_amount;
    st.total_sell += cl.sell_amount;
    if (!cl.billed_to_customer) st.unrecovered += cl.buy_amount;
  });

  const laneStats = Object.values(laneStatsMap).map(st => {
    const margin_pct = st.total_revenue > 0 ? ((st.total_revenue - st.total_buy) / st.total_revenue) * 100 : 0;
    return { ...st, margin_pct, laneKey: `${st.origin}||${st.destination}` };
  });

  const filteredJobs = selectedLane ? completedJobs.filter(j => `${j.origin}||${j.destination}` === selectedLane) : completedJobs;
  const filteredJobIds = new Set(filteredJobs.map(j => j.job_id));

  // -- SECTION 2 --
  const clientRates = RATE_HISTORY.filter(r => r.client_id === selectedRateClient);
  const avgSell = clientRates.length > 0 ? clientRates.reduce((s, r) => s + r.sell_rate, 0) / clientRates.length : 0;
  const avgBuy = clientRates.length > 0 ? clientRates.reduce((s, r) => s + r.buy_rate, 0) / clientRates.length : 0;
  const avgMargin = avgSell > 0 ? ((avgSell - avgBuy) / avgSell) * 100 : 0;
  
  const earliestQuarterMargin = clientRates.length > 0 ? ((clientRates[0].sell_rate - clientRates[0].buy_rate) / clientRates[0].sell_rate) * 100 : 0;
  const latestQuarterMargin = clientRates.length > 0 ? ((clientRates[clientRates.length - 1].sell_rate - clientRates[clientRates.length - 1].buy_rate) / clientRates[clientRates.length - 1].sell_rate) * 100 : 0;
  const marginDiff = latestQuarterMargin - earliestQuarterMargin;
  const selectedClientName = CLIENTS.find(c => c.client_id === selectedRateClient)?.name || "";

  // -- SECTION 3 --
  const carrierBenchMap = {};
  JOB_COST_LINES.filter(cl => filteredJobIds.has(cl.job_id)).forEach(cl => {
    if (!carrierBenchMap[cl.carrier_id]) {
      carrierBenchMap[cl.carrier_id] = { carrier_id: cl.carrier_id, jobs: new Set(), total_buy_freight: 0, total_sell_freight: 0, freight_count: 0, total_unrecovered: 0 };
    }
    const cbm = carrierBenchMap[cl.carrier_id];
    cbm.jobs.add(cl.job_id);
    if (cl.cost_type === "Freight") {
      cbm.total_buy_freight += cl.buy_amount;
      cbm.total_sell_freight += cl.sell_amount;
      cbm.freight_count += 1;
    }
    if (!cl.billed_to_customer) {
      cbm.total_unrecovered += cl.buy_amount;
    }
  });

  const carrierBench = Object.values(carrierBenchMap).map(cbm => {
    const carrier = CARRIERS.find(c => c.carrier_id === cbm.carrier_id);
    const avg_buy = cbm.freight_count > 0 ? cbm.total_buy_freight / cbm.freight_count : 0;
    const avg_sell = cbm.freight_count > 0 ? cbm.total_sell_freight / cbm.freight_count : 0;
    const margin_pct = avg_sell > 0 ? ((avg_sell - avg_buy) / avg_sell) * 100 : 0;
    return {
      carrier_id: cbm.carrier_id,
      name: carrier?.name || cbm.carrier_id,
      mode: carrier?.mode || "",
      jobs_count: cbm.jobs.size,
      jobsSet: cbm.jobs,
      avg_buy, avg_sell, margin_pct, total_unrecovered: cbm.total_unrecovered
    };
  });
  
  carrierBench.sort((a, b) => {
    if (a.mode === b.mode) return b.margin_pct - a.margin_pct;
    return a.mode.localeCompare(b.mode);
  });

  const worstCarrier = [...carrierBench].sort((a, b) => b.total_unrecovered - a.total_unrecovered)[0];
  let worstCarrierInsight = null;
  if (worstCarrier && worstCarrier.total_unrecovered > 0) {
    const jobsForWC = [...worstCarrier.jobsSet];
    const totalRevForWC = JOBS.filter(j => jobsForWC.includes(j.job_id)).reduce((s, j) => s + j.revenue, 0);
    const pctImprove = totalRevForWC > 0 ? (worstCarrier.total_unrecovered / totalRevForWC) * 100 : 0;
    worstCarrierInsight = {
      name: worstCarrier.name, unrec: worstCarrier.total_unrecovered, jobs: worstCarrier.jobs_count, pct: pctImprove
    };
  }

  // -- SECTION 4 --
  const unrecoveredLines = JOB_COST_LINES.filter(cl => !cl.billed_to_customer && filteredJobIds.has(cl.job_id));
  const totalLeakage = unrecoveredLines.reduce((s, cl) => s + cl.buy_amount, 0);
  
  const leakageByTypeMap = {};
  unrecoveredLines.forEach(cl => {
    if (!leakageByTypeMap[cl.cost_type]) leakageByTypeMap[cl.cost_type] = { cost_type: cl.cost_type, unrecovered: 0, count: 0 };
    leakageByTypeMap[cl.cost_type].unrecovered += cl.buy_amount;
    leakageByTypeMap[cl.cost_type].count += 1;
  });
  const leakageByType = Object.values(leakageByTypeMap).sort((a, b) => b.unrecovered - a.unrecovered);

  const leakageByClientMap = {};
  unrecoveredLines.forEach(cl => {
    const job = JOBS.find(j => j.job_id === cl.job_id);
    if (!job) return;
    if (!leakageByClientMap[job.client_id]) leakageByClientMap[job.client_id] = { client_id: job.client_id, unrecovered: 0, jobs: new Set() };
    leakageByClientMap[job.client_id].unrecovered += cl.buy_amount;
    leakageByClientMap[job.client_id].jobs.add(job.job_id);
  });
  const leakageByClient = Object.values(leakageByClientMap).map(lbc => {
    return { ...lbc, job_count: lbc.jobs.size, avg: lbc.unrecovered / lbc.jobs.size };
  }).sort((a, b) => b.unrecovered - a.unrecovered);

  const leakageByCarrierMap = {};
  unrecoveredLines.forEach(cl => {
    if (!leakageByCarrierMap[cl.carrier_id]) leakageByCarrierMap[cl.carrier_id] = { carrier_id: cl.carrier_id, unrecovered: 0, jobs: new Set() };
    leakageByCarrierMap[cl.carrier_id].unrecovered += cl.buy_amount;
    leakageByCarrierMap[cl.carrier_id].jobs.add(cl.job_id);
  });
  const leakageByCarrier = Object.values(leakageByCarrierMap).map(lbc => {
    const carrier = CARRIERS.find(c => c.carrier_id === lbc.carrier_id);
    return { ...lbc, name: carrier?.name, job_count: lbc.jobs.size };
  }).sort((a, b) => b.unrecovered - a.unrecovered);

  const totalFilteredRev = filteredJobs.reduce((s, j) => s + j.revenue, 0);
  const totalFilteredBuy = JOB_COST_LINES.filter(cl => filteredJobIds.has(cl.job_id)).reduce((s, cl) => s + cl.buy_amount, 0);
  const currentNetMargin = totalFilteredRev > 0 ? ((totalFilteredRev - totalFilteredBuy) / totalFilteredRev) * 100 : 0;
  const projectedNetMargin = totalFilteredRev > 0 ? ((totalFilteredRev - (totalFilteredBuy - totalLeakage)) / totalFilteredRev) * 100 : 0;
  const leakagePctRev = totalFilteredRev > 0 ? (totalLeakage / totalFilteredRev) * 100 : 0;

  const tooltipStyle = { background: C.surface, border: `1px solid ${C.border}`, color: C.text, fontSize: 12, borderRadius: 6 };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      
      {selectedLane && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ background: C.accentDim, border: `1px solid ${C.accent}`, color: C.accent, padding: "4px 12px", borderRadius: 16, fontSize: 12, display: "flex", alignItems: "center", gap: 8 }}>
            Showing: {selectedLane.split("||").join(" → ")}
            <button onClick={() => setSelectedLane(null)} style={{ background: "transparent", border: "none", color: C.accent, cursor: "pointer", fontSize: 14 }}>✕</button>
          </div>
        </div>
      )}

      {/* SECTION 1 — LANE PROFITABILITY MATRIX */}
      <section>
        <h3 style={{ fontSize: 14, color: C.text, marginBottom: 16, textTransform: "uppercase", letterSpacing: "1px" }}>Lane Profitability Matrix</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
          {laneStats.map(ls => {
            const isSelected = selectedLane === ls.laneKey;
            let baseColor = C.red;
            if (ls.margin_pct >= 25) baseColor = C.green;
            else if (ls.margin_pct >= 15) baseColor = C.yellow;

            return (
              <div 
                key={ls.laneKey} 
                onClick={() => setSelectedLane(isSelected ? null : ls.laneKey)}
                style={{
                  position: "relative",
                  border: `1px solid ${isSelected ? C.accent : C.border}`,
                  borderRadius: 8,
                  overflow: "hidden",
                  cursor: "pointer",
                  padding: 16
                }}
              >
                <div style={{ position: "absolute", inset: 0, backgroundColor: baseColor, opacity: 0.15, zIndex: 0 }} />
                <div style={{ position: "relative", zIndex: 1 }}>
                  <div style={{ fontSize: 13, color: C.muted, marginBottom: 8 }}>{ls.origin} &rarr; {ls.destination}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 10, textTransform: "uppercase", color: C.muted }}>Jobs</div>
                      <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 16, color: C.text }}>{ls.job_count}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 10, textTransform: "uppercase", color: C.muted }}>Margin</div>
                      <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 16, color: baseColor }}>{ls.margin_pct.toFixed(1)}%</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, borderTop: `1px solid ${C.border}50`, paddingTop: 8 }}>
                    <span style={{ color: C.muted }}>Rev: ₹{fmt(ls.total_revenue)}</span>
                    {ls.unrecovered > 0 && <span style={{ color: C.red }}>Unrec: ₹{fmt(ls.unrecovered)}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* SECTION 2 — CUSTOMER RATE PRESSURE */}
      <section style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, color: C.text, textTransform: "uppercase", letterSpacing: "1px", margin: 0 }}>Customer Rate Pressure</h3>
          <select 
            value={selectedRateClient} 
            onChange={(e) => setSelectedRateClient(Number(e.target.value))}
            style={{ background: C.surface, color: C.text, border: `1px solid ${C.border}`, padding: "6px 12px", borderRadius: 6, fontSize: 13 }}
          >
            {CLIENTS.map(c => <option key={c.client_id} value={c.client_id}>{c.name}</option>)}
          </select>
        </div>

        {clientRates.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: C.muted, fontSize: 14 }}>No rate history for this client.</div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={clientRates} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorMargin" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C.green} stopOpacity={0.1}/>
                    <stop offset="95%" stopColor={C.green} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                <XAxis dataKey="quarter" tick={{ fill: C.muted, fontSize: 11 }} axisLine={{ stroke: C.border }} />
                <YAxis tickFormatter={v => \`₹\${fmt(v)}\`} tick={{ fill: C.muted, fontSize: 10 }} axisLine={{ stroke: C.border }} width={72} />
                <Tooltip formatter={v => \`₹\${fmt(v)}\`} contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12, color: C.muted }} />
                <Area type="monotone" dataKey="sell_rate" stroke={C.accent} fill="url(#colorMargin)" name="Sell Rate" strokeWidth={2} />
                <Line type="monotone" dataKey="buy_rate" stroke={C.muted} strokeDasharray="4 2" name="Buy Rate" strokeWidth={1.5} dot={false} />
              </AreaChart>
            </ResponsiveContainer>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginTop: 20 }}>
              {[
                { label: "Avg Sell Rate", val: \`₹\${fmt(avgSell)}\` },
                { label: "Avg Buy Rate", val: \`₹\${fmt(avgBuy)}\` },
                { label: "Avg Margin", val: \`\${avgMargin.toFixed(1)}%\` },
              ].map(s => (
                <div key={s.label} style={{ background: C.surface, border: \`1px solid \${C.border}\`, borderRadius: 8, padding: 14 }}>
                  <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 6 }}>{s.label}</div>
                  <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 15, color: C.text }}>{s.val}</div>
                </div>
              ))}
            </div>

            {marginDiff < 0 ? (
              <div style={{ marginTop: 16, background: "#3a1a1a", border: \`1px solid \${C.red}\`, color: C.red, padding: "12px 16px", borderRadius: 8, fontSize: 13 }}>
                ⚠ <strong>Margin compression detected</strong> — {selectedClientName} margin has declined {Math.abs(marginDiff).toFixed(1)}pp since {clientRates[0].quarter}.
              </div>
            ) : (
              <div style={{ marginTop: 16, background: "#1a3a2a", border: \`1px solid \${C.green}\`, color: C.green, padding: "12px 16px", borderRadius: 8, fontSize: 13 }}>
                ✓ <strong>Margin stable/improving</strong> — {selectedClientName} margin has improved by {Math.abs(marginDiff).toFixed(1)}pp since {clientRates[0].quarter}.
              </div>
            )}
          </>
        )}
      </section>

      {/* SECTION 3 — CARRIER BENCHMARKING */}
      <section style={{ background: C.card, borderRadius: 10, border: \`1px solid \${C.border}\`, padding: 24 }}>
        <h3 style={{ fontSize: 14, color: C.text, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 20 }}>Carrier Benchmarking</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: C.surface }}>
                <th style={{ padding: "10px 14px", textAlign: "left", color: C.muted, borderBottom: \`1px solid \${C.border}\` }}>Carrier</th>
                <th style={{ padding: "10px 14px", textAlign: "left", color: C.muted, borderBottom: \`1px solid \${C.border}\` }}>Mode</th>
                <th style={{ padding: "10px 14px", textAlign: "left", color: C.muted, borderBottom: \`1px solid \${C.border}\` }}>Jobs</th>
                <th style={{ padding: "10px 14px", textAlign: "left", color: C.muted, borderBottom: \`1px solid \${C.border}\` }}>Avg Buy Rate</th>
                <th style={{ padding: "10px 14px", textAlign: "left", color: C.muted, borderBottom: \`1px solid \${C.border}\` }}>Avg Sell Rate</th>
                <th style={{ padding: "10px 14px", textAlign: "left", color: C.muted, borderBottom: \`1px solid \${C.border}\` }}>Freight Margin %</th>
                <th style={{ padding: "10px 14px", textAlign: "left", color: C.muted, borderBottom: \`1px solid \${C.border}\` }}>Unrecovered Costs</th>
              </tr>
            </thead>
            <tbody>
              {carrierBench.map(c => {
                let marginColor = C.red;
                if (c.margin_pct >= 25) marginColor = C.green;
                else if (c.margin_pct >= 15) marginColor = C.yellow;

                return (
                  <tr key={c.carrier_id} style={{ borderBottom: \`1px solid \${C.border}50\` }}>
                    <td style={{ padding: "11px 14px", color: C.text, fontWeight: 500 }}>{c.name}</td>
                    <td style={{ padding: "11px 14px", color: C.muted }}>{c.mode}</td>
                    <td style={{ padding: "11px 14px", color: C.text }}>{c.jobs_count}</td>
                    <td style={{ padding: "11px 14px", fontFamily: "'Space Mono', monospace", color: C.muted }}>₹{fmt(c.avg_buy)}</td>
                    <td style={{ padding: "11px 14px", fontFamily: "'Space Mono', monospace", color: C.text }}>₹{fmt(c.avg_sell)}</td>
                    <td style={{ padding: "11px 14px", fontFamily: "'Space Mono', monospace", color: marginColor }}>{c.margin_pct.toFixed(1)}%</td>
                    <td style={{ padding: "11px 14px", fontFamily: "'Space Mono', monospace", color: c.total_unrecovered > 0 ? C.red : C.muted }} title={c.total_unrecovered > 0 ? "This cost was absorbed by CFF — not billed to customer." : ""}>
                      {c.total_unrecovered > 0 ? \`₹\${fmt(c.total_unrecovered)}\` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {worstCarrierInsight && (
          <div style={{ marginTop: 20, background: C.accentDim, padding: 16, borderRadius: 8, color: C.accent, fontSize: 13, lineHeight: "1.5" }}>
            <strong>Insight:</strong> {worstCarrierInsight.name} has generated ₹{fmt(worstCarrierInsight.unrec)} in unrecovered costs across {worstCarrierInsight.jobs} jobs. Reviewing recovery policy on this carrier could improve net margin by {worstCarrierInsight.pct.toFixed(1)}pp.
          </div>
        )}
      </section>

      {/* SECTION 4 — COST LEAKAGE SUMMARY */}
      <section style={{ background: C.card, borderRadius: 10, border: \`1px solid \${C.border}\`, padding: 24 }}>
        <h3 style={{ fontSize: 14, color: C.text, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 20 }}>Cost Leakage Summary</h3>
        
        <div style={{ height: 200, marginBottom: 32 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart layout="vertical" data={leakageByType} margin={{ top: 0, right: 50, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={true} vertical={false} />
              <XAxis type="number" tickFormatter={v => \`₹\${fmt(v)}\`} tick={{ fill: C.muted, fontSize: 11 }} axisLine={{ stroke: C.border }} />
              <YAxis dataKey="cost_type" type="category" tick={{ fill: C.text, fontSize: 12 }} axisLine={{ stroke: C.border }} width={120} />
              <Tooltip formatter={v => \`₹\${fmt(v)}\`} contentStyle={tooltipStyle} />
              <Bar dataKey="unrecovered" fill={C.red} fillOpacity={0.8} radius={[0, 4, 4, 0]}>
                {/* Note: In a full impl we'd use LabelList here, but omitting for brevity if recharts doesn't auto-support without it */}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ display: "flex", gap: 24, marginBottom: 32 }}>
          {/* Left table */}
          <div style={{ flex: 1 }}>
            <h4 style={{ fontSize: 12, color: C.muted, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 12 }}>Leakage by Client</h4>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: C.surface }}>
                    <th style={{ padding: "8px 12px", textAlign: "left", color: C.muted, borderBottom: \`1px solid \${C.border}\` }}>Client</th>
                    <th style={{ padding: "8px 12px", textAlign: "left", color: C.muted, borderBottom: \`1px solid \${C.border}\` }}>Total Unrecovered</th>
                    <th style={{ padding: "8px 12px", textAlign: "left", color: C.muted, borderBottom: \`1px solid \${C.border}\` }}>Jobs Affected</th>
                    <th style={{ padding: "8px 12px", textAlign: "left", color: C.muted, borderBottom: \`1px solid \${C.border}\` }}>Avg per Job</th>
                  </tr>
                </thead>
                <tbody>
                  {leakageByClient.map(lbc => (
                    <tr key={lbc.client_id} style={{ borderBottom: \`1px solid \${C.border}40\` }}>
                      <td style={{ padding: "8px 12px" }}>
                        <ClientLink id={lbc.client_id} openScorecard={onSelectClient} />
                      </td>
                      <td style={{ padding: "8px 12px", fontFamily: "'Space Mono', monospace", color: C.red }}>₹{fmt(lbc.unrecovered)}</td>
                      <td style={{ padding: "8px 12px", color: C.text }}>{lbc.job_count}</td>
                      <td style={{ padding: "8px 12px", fontFamily: "'Space Mono', monospace", color: C.muted }}>₹{fmt(lbc.avg)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right table */}
          <div style={{ flex: 1 }}>
            <h4 style={{ fontSize: 12, color: C.muted, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 12 }}>Leakage by Carrier</h4>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: C.surface }}>
                    <th style={{ padding: "8px 12px", textAlign: "left", color: C.muted, borderBottom: \`1px solid \${C.border}\` }}>Carrier</th>
                    <th style={{ padding: "8px 12px", textAlign: "left", color: C.muted, borderBottom: \`1px solid \${C.border}\` }}>Total Unrecovered</th>
                    <th style={{ padding: "8px 12px", textAlign: "left", color: C.muted, borderBottom: \`1px solid \${C.border}\` }}>Jobs Affected</th>
                  </tr>
                </thead>
                <tbody>
                  {leakageByCarrier.map(lbc => (
                    <tr key={lbc.carrier_id} style={{ borderBottom: \`1px solid \${C.border}40\` }}>
                      <td style={{ padding: "8px 12px", color: C.text }}>{lbc.name}</td>
                      <td style={{ padding: "8px 12px", fontFamily: "'Space Mono', monospace", color: C.red }}>₹{fmt(lbc.unrecovered)}</td>
                      <td style={{ padding: "8px 12px", color: C.text }}>{lbc.job_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div style={{ background: C.accentDim, border: \`1px solid \${C.accent}\`, padding: 24, borderRadius: 8, textAlign: "center" }}>
          <div style={{ fontSize: 14, color: C.text, marginBottom: 12 }}>Total unrecovered costs across all completed jobs:</div>
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 32, fontWeight: 700, color: C.red, marginBottom: 16 }}>₹{fmt(totalLeakage)}</div>
          <div style={{ fontSize: 13, color: C.text, lineHeight: "1.6" }}>
            At current revenue of ₹{fmt(totalFilteredRev)}, this represents <span style={{ color: C.accent }}>{leakagePctRev.toFixed(1)}%</span> of gross revenue absorbed internally.<br/>
            Full recovery would increase net margin from <span style={{ color: C.accent }}>{currentNetMargin.toFixed(1)}%</span> to <span style={{ color: C.green }}>{projectedNetMargin.toFixed(1)}%</span>.
          </div>
        </div>
      </section>

    </div>
  );
}

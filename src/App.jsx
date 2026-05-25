import { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

import ScorecardModal from "./components/ScorecardModal.jsx";
import ChartsTab from "./components/ChartsTab.jsx";
import ClientLink from "./components/ClientLink.jsx";
import ProfitabilityTab from "./components/ProfitabilityTab.jsx";
import { CLIENTS, JOBS, CUSTOMS_FILINGS, WAREHOUSE, SCHEMA_DESC, C, DRAWBACK_RATES, DRAWBACK_CLAIMS, BASELINE_METRICS, QUOTES, SAMPLE_QUESTIONS } from "./data/constants.js";
import { JOB_CLIENT_MAP, COMPLIANCE_RISK, WAREHOUSE_STATS, fmt, pct } from "./utils/computations.js";



export default function App() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [activeTab, setActiveTab] = useState("query");

  const [filterClient, setFilterClient] = useState("All");
  const [filterMode, setFilterMode] = useState("All");
  const [filterTradeLane, setFilterTradeLane] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [sortCol, setSortCol] = useState("job_date");
  const [sortAsc, setSortAsc] = useState(false);
  const [hsSearch, setHsSearch] = useState("");
  const [scorecardId, setScorecardId] = useState(null);
  const openScorecard = id => setScorecardId(id);
  const [draftClaim, setDraftClaim]         = useState(null); // enriched claim object
  const [claimsState, setClaimsState]       = useState(() => {
    try { const s = localStorage.getItem("cff_claims"); return s ? JSON.parse(s) : DRAWBACK_CLAIMS; } catch { return DRAWBACK_CLAIMS; }
  });
  const [filingRegister, setFilingRegister] = useState(() => {
    try { const s = localStorage.getItem("cff_filing_register"); return s ? JSON.parse(s) : []; } catch { return []; }
  });

  const [quoteLane, setQuoteLane] = useState("Export");
  const [quoteOrigin, setQuoteOrigin] = useState("");
  const [quoteDest, setQuoteDest] = useState("");
  const [quoteMode, setQuoteMode] = useState("Ocean FCL");
  const [quoteCommodity, setQuoteCommodity] = useState("");
  const [quoteResult, setQuoteResult] = useState(null);
  const [quoteDraft, setQuoteDraft] = useState({ revenue: "", cost: "", validUntil: "" });
  const [pipelineArray, setPipelineArray] = useState([]);
  const [toastMessage, setToastMessage] = useState(null);
  const [checkClient, setCheckClient] = useState("");
  const [checkHs, setCheckHs] = useState("");
  const [checkResult, setCheckResult] = useState(null);
  
  const clientById = useMemo(() => {
    return CLIENTS.reduce((acc, c) => {
      acc[c.client_id] = c;
      return acc;
    }, {});
  }, []);


  const uniqueCommodities = useMemo(() => {
    return [...new Set(QUOTES.map(q => q.commodity_type))].sort();
  }, []);

  const runQuoteAssist = () => {
    if (!quoteMode || !quoteCommodity) return;
    // Note: quoteLane / quoteOrigin / quoteDest are collected for UX context but not filtered
    // on — mock data is too sparse for exact route matches; mode + commodity gives enough signal.
    const matches = QUOTES.filter(q => q.mode === quoteMode && q.commodity_type === quoteCommodity);
    if (matches.length === 0) {
      setQuoteResult({ matches: [], floor: 0, median: 0, ceiling: 0, winRate: 0, targetMargin: 0, aboveWinRate: 0, belowWinRate: 0, threshold: 0 });
      return;
    }
    const costs = matches.map(m => m.actual_cost).sort((a, b) => a - b);
    const p25idx = Math.floor(costs.length * 0.25);
    const p75idx = Math.min(Math.floor(costs.length * 0.75), costs.length - 1);
    const floor = costs[p25idx];
    const ceiling = costs[p75idx];
    const median = costs[Math.floor(costs.length / 2)];
    
    const totalWon = matches.filter(m => m.won).length;
    const winRate = Math.round((totalWon / matches.length) * 100);
    
    const margins = matches.map(m => (m.quoted_revenue - m.actual_cost) / m.quoted_revenue);
    margins.sort((a, b) => a - b);
    const medianMargin = margins[Math.floor(margins.length / 2)];
    
    const threshold = median * 1.15;
    const above = matches.filter(m => m.quoted_revenue > threshold);
    const below = matches.filter(m => m.quoted_revenue <= threshold);
    const aboveWinRate = above.length ? Math.round((above.filter(m => m.won).length / above.length) * 100) : 0;
    const belowWinRate = below.length ? Math.round((below.filter(m => m.won).length / below.length) * 100) : 0;

    const wonRevenues = matches.filter(m => m.won).map(m => m.quoted_revenue);
    const winningRevenueMax = wonRevenues.length > 0 ? Math.max(...wonRevenues) : 0;

    setQuoteResult({ matches, floor, median, ceiling, winRate, targetMargin: Math.round(medianMargin * 100), aboveWinRate, belowWinRate, threshold, winningRevenueMax });

    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 30);
    const dateStr = defaultDate.toISOString().slice(0, 10);
    setQuoteDraft({ revenue: wonRevenues.length > 0 ? wonRevenues[Math.floor(wonRevenues.length / 2)] : "", cost: median, validUntil: dateStr });
  };

  const handleSaveToPipeline = () => {
    const id = "QP00" + (pipelineArray.length + 1);
    const newQuote = {
      quote_id: id,
      client: "",
      tradeLane: quoteLane,
      origin: quoteOrigin,
      destination: quoteDest,
      mode: quoteMode,
      commodityType: quoteCommodity,
      quoted_revenue: Number(quoteDraft.revenue),
      actual_cost: Number(quoteDraft.cost),
      valid_until: quoteDraft.validUntil,
      created_date: new Date().toISOString().slice(0, 10),
      status: "Pending",
      won: null
    };
    setPipelineArray([newQuote, ...pipelineArray]);
    setToastMessage(`Quote ${id} saved to pipeline`);
    setTimeout(() => setToastMessage(null), 3000);
    setQuoteResult(null);
    setQuoteOrigin("");
    setQuoteDest("");
  };

  const exportPipelineCSV = () => {
    const headers = ["Quote ID","Client","Trade Lane","Mode","Origin","Destination","Commodity","Quoted Revenue","Actual Cost","Status","Created Date"];
    const rows = pipelineArray.map(r =>
      [r.quote_id, r.client, r.tradeLane, r.mode, r.origin, r.destination, r.commodityType, r.quoted_revenue, r.actual_cost, r.status, r.created_date].join(",")
    );
    const csv  = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `CFF_Quote_Pipeline_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const uniqueHsCodes = useMemo(() => {
    return [...new Set(CUSTOMS_FILINGS.map(f => f.hs_code))].sort();
  }, []);

  const runPreFilingCheck = () => {
    if (!checkClient || !checkHs) return;
    const clientId = Number(checkClient);
    const hsChapter = checkHs.substring(0, 4);
    const clientJobs = new Set(JOBS.filter(j => j.client_id === clientId).map(j => j.job_id));
    const historicalFilings = CUSTOMS_FILINGS.filter(f => clientJobs.has(f.job_id) && f.hs_code.startsWith(hsChapter));
    const hasAmendments = historicalFilings.some(f => f.amendments > 0);
    const baselineData = BASELINE_METRICS.filter(b => b.client_id === clientId);
    const avgAmendments = baselineData.length ? baselineData.reduce((s, b) => s + b.amendment_count, 0) / baselineData.length : 0;
    const hoursSaved = avgAmendments * 2.5;
    const costRecovered = hoursSaved * 800;
    setCheckResult({ historicalFilings, hasAmendments, baselineData, avgAmendments, hoursSaved, costRecovered, hsChapter });
  };

  const filteredJobs = useMemo(() => {
    let filtered = [...JOBS];
    if (filterClient !== "All") filtered = filtered.filter(j => j.client_id === Number(filterClient));
    if (filterMode !== "All") filtered = filtered.filter(j => j.mode === filterMode);
    if (filterTradeLane !== "All") filtered = filtered.filter(j => j.trade_lane === filterTradeLane);
    if (filterStatus !== "All") filtered = filtered.filter(j => j.status === filterStatus);
    
    filtered.sort((a, b) => {
      let valA = a[sortCol];
      let valB = b[sortCol];
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      
      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
    
    return filtered;
  }, [filterClient, filterMode, filterTradeLane, filterStatus, sortCol, sortAsc]);

  const handleSort = (col) => {
    if (sortCol === col) setSortAsc(!sortAsc);
    else { setSortCol(col); setSortAsc(true); }
  };

  const handleQuery = async (q) => {
    const qText = q || question;
    if (!qText.trim()) return;
    setLoading(true);
    setResult(null);

    // Determine relevant data slices based on query
    const qLower = qText.toLowerCase();
    let dataContext = "\\nDATA:\\n";
    if (qLower.includes("client") || qLower.includes("industry")) dataContext += `CLIENTS: ${JSON.stringify(CLIENTS)}\\n`;
    if (qLower.match(/job|margin|revenue|cost|profit|lane|mode/)) dataContext += `JOBS: ${JSON.stringify(JOBS)}\\n`;
    if (qLower.match(/customs|filing|amend|duty|hs|exam/)) dataContext += `CUSTOMS_FILINGS: ${JSON.stringify(CUSTOMS_FILINGS)}\\n`;
    if (qLower.match(/warehouse|cbm|storage/)) dataContext += `WAREHOUSE: ${JSON.stringify(WAREHOUSE)}\\n`;
    
    // Fallback: if no specific keywords matched, provide jobs and clients
    if (dataContext === "\\nDATA:\\n") {
      dataContext += `CLIENTS: ${JSON.stringify(CLIENTS)}\\nJOBS: ${JSON.stringify(JOBS)}\\n`;
    }

    try {
      const res = await fetch("/api/claude", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 1000,
          system: SCHEMA_DESC + dataContext + `
Respond ONLY with a valid JSON object, no markdown, no explanation. Format:
{
  "sql": "SELECT ... -- the SQL query that would answer this",
  "summary": "1-2 sentence plain English answer with specific numbers",
  "table": [{"col1": val, "col2": val, ...}],
  "insight": "1 sentence business insight or recommendation"
}
The table should have 3-8 rows maximum, with the most relevant data.
Column names should be human-readable (e.g., "Client Name" not "client_id").
Use INR formatting for monetary values (include ₹ symbol).`,
          messages: [{ role: "user", content: qText }],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to fetch response");
      }
      const raw = data.content?.find(b => b.type === "text")?.text || "{}";
      const clean = raw.replace(/```json|```/g, "").trim();
      let parsed;
      try {
        parsed = JSON.parse(clean);
      } catch (err) {
        throw new Error("Claude returned malformed JSON: " + err.message);
      }
      setResult({ question: qText, ...parsed });
    } catch (e) {
      setResult({ question: qText, sql: "", summary: `Error processing query. ${e.message}`, table: [], insight: "" });
    }
    setLoading(false);
  };

  const handleSample = (q) => {
    setQuestion(q);
    handleQuery(q);
  };

  // ── Confirm & file drawback claim ─────────────────────────────────────────
  const confirmFileClaim = () => {
    const { claim_id, client_id, hs_chapter, eligible_amount, icegateRef } = draftClaim;
    const cff_fee    = Math.round(eligible_amount * 0.18);
    const filed_date = new Date().toISOString().slice(0, 10);
    const n          = filingRegister.length + 1;
    const newEntry   = { register_id: "FR" + String(n).padStart(3, "0"), claim_id, client_id, hs_chapter, eligible_amount, cff_fee, filed_date, icegate_ref: icegateRef, status: "Filed" };
    const nextClaims = claimsState.map(c => c.claim_id === claim_id ? { ...c, status: "Filed" } : c);
    const nextRegister = [...filingRegister, newEntry];
    setClaimsState(nextClaims);
    setFilingRegister(nextRegister);
    localStorage.setItem("cff_claims", JSON.stringify(nextClaims));
    localStorage.setItem("cff_filing_register", JSON.stringify(nextRegister));
    setDraftClaim(null);
    setToastMessage(`Claim filed. ICEGATE Ref: ${icegateRef}`);
    setTimeout(() => setToastMessage(null), 5000);
  };

  // Summary stats
  const completedJobs = JOBS.filter(j => j.status === "Completed");
  const totalRevenue = completedJobs.reduce((s, j) => s + j.revenue, 0);
  const totalCost = completedJobs.reduce((s, j) => s + j.cost, 0);
  const totalMargin = totalRevenue - totalCost;
  const examCount = CUSTOMS_FILINGS.filter(f => f.examination).length;
  const amendCount = CUSTOMS_FILINGS.filter(f => f.amendments > 0).length;
  const unclaimedDrawbacks = claimsState.filter(c => c.status === "Unclaimed");
  const totalUnclaimedDrawback = unclaimedDrawbacks.reduce((s, c) => s + c.eligible_amount, 0);
  const cffFee = Math.round(totalUnclaimedDrawback * 0.18);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'DM Sans', sans-serif" }}>
      {toastMessage && (
        <div style={{
          position: "fixed", bottom: 28, right: 28, zIndex: 2000,
          background: C.green, color: "#000", padding: "14px 20px",
          borderRadius: 10, fontWeight: 600, fontSize: 13,
          boxShadow: "0 4px 24px rgba(0,0,0,0.4)", maxWidth: 380,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span>✓</span>
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} style={{
            marginLeft: "auto", background: "transparent", border: "none",
            color: "#000", cursor: "pointer", fontSize: 16, lineHeight: 1,
          }}>×</button>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(231, 76, 60, 0.7); }
          70% { box-shadow: 0 0 0 6px rgba(231, 76, 60, 0); }
          100% { box-shadow: 0 0 0 0 rgba(231, 76, 60, 0); }
        }
      `}</style>
      {scorecardId && <ScorecardModal clientId={scorecardId} onClose={() => setScorecardId(null)} />}
      {draftClaim && (
        <div onClick={() => setDraftClaim(null)} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.card, borderRadius: 12, padding: 32, width: 520, border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: C.text, marginBottom: 4 }}>Draft Drawback Claim</div>
            <div style={{ fontSize: 12, color: C.muted, fontFamily: "'Space Mono', monospace", marginBottom: 24 }}>{draftClaim.claim_id}</div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
              {[
                ["Client Name",          draftClaim.clientName],
                ["IEC Code",             "AAACL1234F"],
                ["HS Chapter",           draftClaim.hs_chapter],
                ["HS Description",       draftClaim.rateRow?.description ?? "—"],
                ["Import Filing Ref",    draftClaim.filing?.filing_ref ?? "—"],
                ["CIF Value",            draftClaim.filing ? `₹${fmt(draftClaim.filing.cif_value)}` : "—"],
                ["Duty Drawback Rate",   draftClaim.rateRow ? `${draftClaim.rateRow.drawback_rate_pct}%` : "—"],
              ].map(([label, value]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: C.muted, fontSize: 12 }}>{label}</span>
                  <span style={{ color: C.text, fontSize: 13, fontFamily: ["IEC Code","Import Filing Ref"].includes(label) ? "'Space Mono', monospace" : "inherit" }}>{value}</span>
                </div>
              ))}

              {/* Highlighted eligible amount */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: C.accentDim, borderRadius: 6, padding: "8px 12px", margin: "4px 0" }}>
                <span style={{ color: C.accent, fontSize: 12, fontWeight: 600 }}>Eligible Drawback Amount</span>
                <span style={{ color: C.accent, fontSize: 15, fontWeight: 700, fontFamily: "'Space Mono', monospace" }}>₹{fmt(draftClaim.eligible_amount)}</span>
              </div>

              {[
                ["CFF Fee (18%)",  `₹${fmt(Math.round(draftClaim.eligible_amount * 0.18))}`],
                ["ICEGATE Ref",   draftClaim.icegateRef],
              ].map(([label, value]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: C.muted, fontSize: 12 }}>{label}</span>
                  <span style={{ color: C.text, fontSize: 13, fontFamily: "'Space Mono', monospace" }}>{value}</span>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button onClick={() => setDraftClaim(null)} style={{ padding: "8px 16px", borderRadius: 6, border: `1px solid ${C.border}`, background: "transparent", color: C.muted, cursor: "pointer", fontSize: 13 }}>Cancel</button>
              <button
                onClick={() => {
                  const text = [
                    `Claim ID: ${draftClaim.claim_id}`,
                    `Client: ${draftClaim.clientName}`,
                    `HS Chapter: ${draftClaim.hs_chapter}`,
                    `Eligible Amount: ₹${fmt(draftClaim.eligible_amount)}`,
                    `ICEGATE Ref: ${draftClaim.icegateRef}`,
                  ].join("\n");
                  navigator.clipboard.writeText(text);
                  setToastMessage("Claim details copied to clipboard");
                  setTimeout(() => setToastMessage(null), 3000);
                }}
                style={{ padding: "8px 16px", borderRadius: 6, border: `1px solid ${C.border}`, background: "transparent", color: C.text, cursor: "pointer", fontSize: 13 }}
              >Copy to Clipboard</button>
              <button
                onClick={confirmFileClaim}
                style={{ padding: "8px 20px", borderRadius: 6, border: "none", background: C.accent, color: "#000", cursor: "pointer", fontWeight: 700, fontSize: 13 }}
              >Confirm &amp; File Claim →</button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "20px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 36, height: 36, background: C.accent, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#000", fontFamily: "'Space Mono', monospace", fontWeight: 700, fontSize: 14 }}>CFF</span>
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15, letterSpacing: "-0.2px" }}>CFF Analytics Intelligence</div>
            <div style={{ fontSize: 12, color: C.muted, fontFamily: "'Space Mono', monospace" }}>DEMO · MOCK DATA · 2024–2025</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {["query", "explore", "operations", "quoteassist", "profitability", "charts", "schema"].map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              style={{ padding: "6px 16px", borderRadius: 6, border: `1px solid ${activeTab === t ? C.accent : C.border}`,
                background: activeTab === t ? C.accentDim : "transparent",
                color: activeTab === t ? C.accent : C.muted, fontSize: 12, cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* STAT BAR */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1, background: C.border }}>
        {[
          { label: "Total Jobs", value: completedJobs.length, sub: `+ ${JOBS.filter(j=>j.status==="In Progress").length} in progress` },
          { label: "Revenue (FY)", value: "₹" + fmt(totalRevenue), sub: pct(totalMargin, totalRevenue) + " margin" },
          { label: "Customs Filings", value: CUSTOMS_FILINGS.length, sub: `${examCount} examinations` },
          { label: "Amendment Rate", value: pct(amendCount, CUSTOMS_FILINGS.length), sub: `${amendCount} filings amended` },
        ].map((s, i) => (
          <div key={i} style={{ background: C.card, padding: "16px 24px" }}>
            <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 600, fontFamily: "'Space Mono', monospace", color: C.accent }}>{s.value}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: "28px 32px", maxWidth: 1100, margin: "0 auto" }}>
        {activeTab === "query" ? (
          <>
            {/* SAMPLE QUESTIONS */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 10 }}>Try a sample question</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {SAMPLE_QUESTIONS.map((q, i) => (
                  <button key={i} onClick={() => handleSample(q)}
                    style={{ padding: "7px 14px", borderRadius: 20, border: `1px solid ${C.border}`,
                      background: "transparent", color: C.muted, fontSize: 12, cursor: "pointer",
                      fontFamily: "inherit", transition: "all 0.15s" }}
                    onMouseEnter={e => { e.target.style.borderColor = C.accent; e.target.style.color = C.accent; }}
                    onMouseLeave={e => { e.target.style.borderColor = C.border; e.target.style.color = C.muted; }}>
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {/* QUERY INPUT */}
            <div style={{ display: "flex", gap: 10, marginBottom: 28 }}>
              <div style={{ flex: 1, position: "relative" }}>
                <input
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleQuery()}
                  placeholder="Ask anything about CFF's operations, clients, margins, or compliance..."
                  style={{ width: "100%", padding: "14px 18px", borderRadius: 10, border: `1px solid ${C.border}`,
                    background: C.card, color: C.text, fontSize: 14, fontFamily: "inherit", outline: "none",
                    boxSizing: "border-box", transition: "border 0.2s" }}
                  onFocus={e => e.target.style.borderColor = C.accent}
                  onBlur={e => e.target.style.borderColor = C.border}
                />
              </div>
              <button onClick={() => handleQuery()}
                disabled={loading || !question.trim()}
                style={{ padding: "14px 28px", borderRadius: 10, border: "none",
                  background: loading ? C.accentDim : C.accent,
                  color: loading ? C.muted : "#000", fontSize: 13, fontWeight: 600,
                  cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                {loading ? "Querying…" : "Run Query →"}
              </button>
            </div>

            {/* LOADING */}
            {loading && (
              <div style={{ textAlign: "center", padding: "48px 0", color: C.muted }}>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, marginBottom: 8 }}>ANALYSING DATA</div>
                <div style={{ color: C.accent, fontSize: 13 }}>Generating SQL and interpreting results…</div>
              </div>
            )}

            {/* RESULTS */}
            {result && !loading && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Question echo */}
                <div style={{ padding: "12px 18px", background: C.accentDim, borderRadius: 8, border: `1px solid ${C.accent}30`, fontSize: 13, color: C.accent }}>
                  <span style={{ color: C.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px", marginRight: 10 }}>Query</span>
                  {result.question}
                </div>

                {/* Summary card */}
                <div style={{ padding: "18px 20px", background: C.card, borderRadius: 10, border: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 8 }}>Answer</div>
                  <div style={{ fontSize: 15, lineHeight: 1.6 }}>{result.summary}</div>
                  {result.insight && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}`, fontSize: 12, color: C.accent, display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <span style={{ marginTop: 1 }}>💡</span>
                      <span>{result.insight}</span>
                    </div>
                  )}
                </div>

                {/* Table */}
                {result.table?.length > 0 && (
                  <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, overflow: "hidden" }}>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                        <thead>
                          <tr style={{ background: C.surface }}>
                            {Object.keys(result.table[0]).map(col => (
                              <th key={col} style={{ padding: "10px 16px", textAlign: "left", color: C.muted,
                                fontSize: 11, textTransform: "uppercase", letterSpacing: "0.6px",
                                borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {result.table.map((row, i) => (
                            <tr key={i} style={{ borderBottom: `1px solid ${C.border}80` }}
                              onMouseEnter={e => e.currentTarget.style.background = C.surface}
                              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                              {Object.values(row).map((val, j) => (
                                <td key={j} style={{ padding: "11px 16px", color: i === 0 ? C.text : C.muted }}>
                                  {String(val)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* SQL */}
                {result.sql && (
                  <details style={{ cursor: "pointer" }}>
                    <summary style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.8px", padding: "8px 0", userSelect: "none" }}>
                      View Generated SQL ▸
                    </summary>
                    <pre style={{ margin: "8px 0 0 0", padding: "14px 16px", background: C.surface,
                      borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12,
                      fontFamily: "'Space Mono', monospace", color: "#7EC8A4", overflowX: "auto", lineHeight: 1.6 }}>
                      {result.sql}
                    </pre>
                  </details>
                )}
              </div>
            )}
          </>
        ) : activeTab === "profitability" ? (
          <ProfitabilityTab onSelectClient={openScorecard} />
        ) : activeTab === "explore" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {/* In Progress Tracker */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
              {JOBS.filter(j => j.status === "In Progress").map(job => {
                const client = clientById[job.client_id];
                const daysElapsed = Math.floor((new Date() - new Date(job.job_date)) / (1000 * 60 * 60 * 24));
                return (
                  <div key={job.job_id} style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, borderLeft: `4px solid ${C.accent}`, padding: 20 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 14, color: C.text }}>{job.job_id}</span>
                      <span style={{ fontSize: 12, background: C.accentDim, color: C.accent, padding: "2px 8px", borderRadius: 12 }}>{daysElapsed} days active</span>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 4 }}>{client?.name}</div>
                    <div style={{ fontSize: 13, color: C.muted }}>{job.origin} → {job.destination} • {job.mode}</div>
                  </div>
                );
              })}
            </div>

            {/* Filter Bar */}
            <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: 20 }}>
              <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 12 }}>Filter & Explore Jobs</div>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                <select value={filterClient} onChange={e => setFilterClient(e.target.value)} style={{ padding: "10px", borderRadius: 8, background: C.surface, color: C.text, border: `1px solid ${C.border}`, outline: "none", cursor: "pointer" }}>
                  <option value="All">All Clients</option>
                  {CLIENTS.map(c => <option key={c.client_id} value={c.client_id}>{c.name}</option>)}
                </select>
                <select value={filterMode} onChange={e => setFilterMode(e.target.value)} style={{ padding: "10px", borderRadius: 8, background: C.surface, color: C.text, border: `1px solid ${C.border}`, outline: "none", cursor: "pointer" }}>
                  <option value="All">All Modes</option>
                  {[...new Set(JOBS.map(j => j.mode))].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <select value={filterTradeLane} onChange={e => setFilterTradeLane(e.target.value)} style={{ padding: "10px", borderRadius: 8, background: C.surface, color: C.text, border: `1px solid ${C.border}`, outline: "none", cursor: "pointer" }}>
                  <option value="All">All Trade Lanes</option>
                  <option value="Export">Export</option>
                  <option value="Import">Import</option>
                </select>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ padding: "10px", borderRadius: 8, background: C.surface, color: C.text, border: `1px solid ${C.border}`, outline: "none", cursor: "pointer" }}>
                  <option value="All">All Statuses</option>
                  <option value="Completed">Completed</option>
                  <option value="In Progress">In Progress</option>
                </select>
              </div>
            </div>

            {/* Interactive Table */}
            <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: C.surface }}>
                      {["job_id", "client_id", "mode", "trade_lane", "job_date", "revenue", "status"].map(col => (
                        <th key={col} onClick={() => handleSort(col)} style={{ padding: "12px 16px", textAlign: "left", color: sortCol === col ? C.accent : C.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.6px", borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap", cursor: "pointer", userSelect: "none", transition: "color 0.2s" }} onMouseEnter={e => e.target.style.color = C.accent} onMouseLeave={e => e.target.style.color = sortCol === col ? C.accent : C.muted}>
                          {col.replaceAll("_", " ")} {sortCol === col ? (sortAsc ? "↑" : "↓") : ""}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredJobs.map((job, i) => (
                      <tr key={job.job_id} style={{ borderBottom: `1px solid ${C.border}80`, transition: "background 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = C.surface} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        <td style={{ padding: "12px 16px", color: C.text, fontFamily: "'Space Mono', monospace" }}>{job.job_id}</td>
                        <td style={{ padding: "12px 16px", color: C.text }}>{clientById[job.client_id]?.name}</td>
                        <td style={{ padding: "12px 16px", color: C.muted }}>{job.mode}</td>
                        <td style={{ padding: "12px 16px", color: C.muted }}>{job.trade_lane}</td>
                        <td style={{ padding: "12px 16px", color: C.muted }}>{job.job_date}</td>
                        <td style={{ padding: "12px 16px", color: C.text }}>₹{fmt(job.revenue)}</td>
                        <td style={{ padding: "12px 16px" }}>
                          <span style={{ fontSize: 11, background: job.status === "Completed" ? "#2ECC7120" : C.accentDim, color: job.status === "Completed" ? C.green : C.accent, padding: "4px 8px", borderRadius: 12 }}>{job.status}</span>
                        </td>
                      </tr>
                    ))}
                    {filteredJobs.length === 0 && (
                      <tr>
                        <td colSpan={7} style={{ padding: "32px", textAlign: "center", color: C.muted }}>No jobs match your filters.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : activeTab === "charts" ? (
          <ChartsTab onSelectClient={openScorecard} />
        ) : activeTab === "operations" ? (
          /* OPERATIONS TAB */
          <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>

            {/* ── DUTY DRAWBACK ── */}
            <section>
              <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 12 }}>Duty Drawback</div>
              
              {/* Part A: Alert */}
              <div style={{ background: C.accentDim, borderRadius: 10, padding: 24, marginBottom: 24, border: `1px solid ${C.accent}40`, textAlign: "center" }}>
                <div style={{ color: C.accent, fontSize: 12, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 8, fontWeight: 600 }}>Recoverable Duty Drawback — Action Required</div>
                <div style={{ fontSize: 32, fontWeight: 700, fontFamily: "'Space Mono', monospace", color: C.accent, marginBottom: 8 }}>₹{fmt(totalUnclaimedDrawback)}</div>
                <div style={{ fontSize: 13, color: C.text }}>CFF fee at 18% contingency: <span style={{ color: C.green }}>₹{fmt(cffFee)}</span></div>
              </div>

              {/* Part B: Table */}
              <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: C.surface }}>
                        {["Claim ID", "Client", "HS Chapter", "Description", "Eligible Amount", "Status", "Action"].map(col => (
                          <th key={col} style={{ padding: "12px 16px", textAlign: "left", color: C.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.6px", borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {claimsState.map(claim => {
                        const cName   = clientById[claim.client_id]?.name || "—";
                        const rateRow = DRAWBACK_RATES.find(r => r.hs_chapter === claim.hs_chapter);
                        const filing  = CUSTOMS_FILINGS.find(f => f.filing_id === claim.import_filing);
                        return (
                          <tr key={claim.claim_id} style={{ borderBottom: `1px solid ${C.border}80` }}>
                            <td style={{ padding: "12px 16px", color: C.text, fontFamily: "'Space Mono', monospace" }}>{claim.claim_id}</td>
                            <td style={{ padding: "12px 16px" }}><ClientLink id={claim.client_id} openScorecard={openScorecard} /></td>
                            <td style={{ padding: "12px 16px", color: C.text, fontFamily: "'Space Mono', monospace" }}>{claim.hs_chapter}</td>
                            <td style={{ padding: "12px 16px", color: C.muted }}>{rateRow?.description || "—"}</td>
                            <td style={{ padding: "12px 16px", color: C.text, fontFamily: "'Space Mono', monospace" }}>₹{fmt(claim.eligible_amount)}</td>
                            <td style={{ padding: "12px 16px" }}>
                              {claim.status === "Unclaimed" ? (
                                <div style={{ display: "flex", alignItems: "center", gap: 6, color: C.red, fontSize: 12 }}>
                                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.red, animation: "pulse 2s infinite" }} />
                                  Unclaimed
                                </div>
                              ) : (
                                <div style={{ color: C.green, fontSize: 12 }}>Filed ✓</div>
                              )}
                            </td>
                            <td style={{ padding: "12px 16px" }}>
                              {claim.status === "Unclaimed" ? (
                                <button
                                  onClick={() => setDraftClaim({
                                    ...claim, clientName: cName, rateRow, filing,
                                    icegateRef: "ICG" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0"),
                                  })}
                                  style={{ background: "transparent", border: `1px solid ${C.accent}`, color: C.accent, padding: "4px 10px", borderRadius: 4, fontSize: 11, cursor: "pointer" }}>
                                  Draft &amp; File →
                                </button>
                              ) : (
                                <span style={{ color: C.green, fontSize: 12 }}>Filed ✓</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            {/* ── FILING REGISTER ───────────────────────────────────────────── */}
            {filingRegister.length > 0 && (
              <section style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: 24 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 4 }}>Filing Register</div>
                    <div style={{ fontSize: 13, color: C.text }}>{filingRegister.length} claim{filingRegister.length !== 1 ? "s" : ""} filed this session</div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => {
                      if (!confirm("Reset all claims to Unclaimed and clear the filing register?")) return;
                      localStorage.removeItem("cff_claims");
                      localStorage.removeItem("cff_filing_register");
                      setClaimsState(DRAWBACK_CLAIMS);
                      setFilingRegister([]);
                    }}
                    style={{ padding: "7px 16px", borderRadius: 6, border: `1px solid ${C.border}`, background: "transparent", color: C.muted, cursor: "pointer", fontSize: 12 }}
                  >Reset</button>
                  <button
                    onClick={() => {
                      const headers = ["Register ID","Claim ID","Client","HS Chapter","Eligible Amount","CFF Fee","Filed Date","ICEGATE Ref","Status"];
                      const rows = filingRegister.map(r => [
                        r.register_id, r.claim_id,
                        CLIENTS.find(c => c.client_id === r.client_id)?.name ?? r.client_id,
                        r.hs_chapter, r.eligible_amount, r.cff_fee, r.filed_date, r.icegate_ref, r.status,
                      ]);
                      const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
                      const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })), download: "cff_filing_register.csv" });
                      a.click();
                    }}
                    style={{ padding: "7px 16px", borderRadius: 6, border: `1px solid ${C.border}`, background: "transparent", color: C.muted, cursor: "pointer", fontSize: 12 }}
                  >Export CSV ↓</button>
                  </div>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr>
                        {["Reg ID","Claim ID","Client","HS Chapter","Eligible ₹","CFF Fee ₹","Filed Date","ICEGATE Ref","Status"].map(h => (
                          <th key={h} style={{ padding: "8px 10px", textAlign: "left", borderBottom: `1px solid ${C.border}`, color: C.muted, fontWeight: 500, whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filingRegister.map(r => (
                        <tr key={r.register_id} style={{ borderBottom: `1px solid ${C.border}` }}>
                          <td style={{ padding: "8px 10px", fontFamily: "'Space Mono',monospace", color: C.muted }}>{r.register_id}</td>
                          <td style={{ padding: "8px 10px", fontFamily: "'Space Mono',monospace", color: C.text }}>{r.claim_id}</td>
                          <td style={{ padding: "8px 10px", color: C.text }}>{CLIENTS.find(c => c.client_id === r.client_id)?.name ?? r.client_id}</td>
                          <td style={{ padding: "8px 10px", color: C.text }}>{r.hs_chapter}</td>
                          <td style={{ padding: "8px 10px", fontFamily: "'Space Mono',monospace", color: C.accent }}>₹{fmt(r.eligible_amount)}</td>
                          <td style={{ padding: "8px 10px", fontFamily: "'Space Mono',monospace", color: C.text }}>₹{fmt(r.cff_fee)}</td>
                          <td style={{ padding: "8px 10px", color: C.muted }}>{r.filed_date}</td>
                          <td style={{ padding: "8px 10px", fontFamily: "'Space Mono',monospace", color: C.text, fontSize: 11 }}>{r.icegate_ref}</td>
                          <td style={{ padding: "8px 10px" }}>
                            <span style={{ background: "#16a34a22", color: "#4ade80", borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>Filed</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* ── AMENDMENT PREVENTION CHECK ── */}
            <section>
              <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 12 }}>Amendment Prevention Check</div>
              <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: 20, marginBottom: 32 }}>
                <div style={{ display: "flex", gap: 16, marginBottom: checkResult ? 20 : 0, alignItems: "center" }}>
                  <select value={checkClient} onChange={e => { setCheckClient(e.target.value); setCheckResult(null); }} style={{ flex: 1, padding: "10px", borderRadius: 8, background: C.surface, color: C.text, border: `1px solid ${C.border}`, outline: "none" }}>
                    <option value="">Select Client</option>
                    {CLIENTS.map(c => <option key={c.client_id} value={c.client_id}>{c.name}</option>)}
                  </select>
                  <select value={checkHs} onChange={e => { setCheckHs(e.target.value); setCheckResult(null); }} style={{ flex: 1, padding: "10px", borderRadius: 8, background: C.surface, color: C.text, border: `1px solid ${C.border}`, outline: "none" }}>
                    <option value="">Select HS Code</option>
                    {uniqueHsCodes.map(hs => <option key={hs} value={hs}>{hs}</option>)}
                  </select>
                  <button onClick={runPreFilingCheck} disabled={!checkClient || !checkHs} style={{ padding: "10px 20px", borderRadius: 8, background: (!checkClient || !checkHs) ? C.accentDim : C.accent, color: (!checkClient || !checkHs) ? C.muted : "#000", border: "none", cursor: (!checkClient || !checkHs) ? "not-allowed" : "pointer", fontWeight: 600 }}>Run Pre-Filing Check</button>
                </div>
                
                {checkResult && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {/* Panel 1 */}
                    <div style={{ background: C.surface, borderRadius: 8, padding: 16, border: `1px solid ${C.border}` }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 12 }}>Historical Usage (Chapter {checkResult.hsChapter})</div>
                      {checkResult.hasAmendments && (
                        <div style={{ background: `${C.yellow}20`, color: C.yellow, padding: "8px 12px", borderRadius: 6, fontSize: 12, marginBottom: 12, border: `1px solid ${C.yellow}50` }}>
                          ⚠ This HS code has triggered amendments for this client before. Review classification before filing.
                        </div>
                      )}
                      {checkResult.historicalFilings.length === 0 ? (
                        <div style={{ color: C.muted, fontSize: 12 }}>No historical filings found for this chapter.</div>
                      ) : (
                        <div style={{ overflowX: "auto" }}>
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                            <thead>
                              <tr style={{ color: C.muted, textTransform: "uppercase", letterSpacing: "0.5px", fontSize: 10 }}>
                                <th style={{ padding: 8, textAlign: "left", borderBottom: `1px solid ${C.border}` }}>Filing ID</th>
                                <th style={{ padding: 8, textAlign: "left", borderBottom: `1px solid ${C.border}` }}>Description</th>
                                <th style={{ padding: 8, textAlign: "left", borderBottom: `1px solid ${C.border}` }}>Amendments</th>
                                <th style={{ padding: 8, textAlign: "left", borderBottom: `1px solid ${C.border}` }}>Examined</th>
                                <th style={{ padding: 8, textAlign: "left", borderBottom: `1px solid ${C.border}` }}>Days to Clear</th>
                              </tr>
                            </thead>
                            <tbody>
                              {checkResult.historicalFilings.map(f => (
                                <tr key={f.filing_id}>
                                  <td style={{ padding: 8, borderBottom: `1px solid ${C.border}50` }}>{f.filing_id}</td>
                                  <td style={{ padding: 8, borderBottom: `1px solid ${C.border}50` }}>{f.description}</td>
                                  <td style={{ padding: 8, borderBottom: `1px solid ${C.border}50`, color: f.amendments > 0 ? C.red : C.text, fontWeight: f.amendments > 0 ? 600 : 400 }}>{f.amendments}</td>
                                  <td style={{ padding: 8, borderBottom: `1px solid ${C.border}50` }}>{f.examination ? "Yes" : "No"}</td>
                                  <td style={{ padding: 8, borderBottom: `1px solid ${C.border}50` }}>{f.days_to_clear}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                    
                    <div style={{ display: "flex", gap: 16 }}>
                      {/* Panel 2 */}
                      <div style={{ flex: 1, background: C.surface, borderRadius: 8, padding: 16, border: `1px solid ${C.border}` }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 12 }}>Baseline Comparison</div>
                        <div style={{ height: 120, width: "100%", marginBottom: 8 }}>
                          {checkResult.baselineData.length === 0 ? (
                            <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: C.muted, fontSize: 12 }}>
                              No quarterly baseline data for this client
                            </div>
                          ) : (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={checkResult.baselineData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                              <XAxis dataKey="quarter" stroke={C.muted} fontSize={10} tickLine={false} axisLine={false} />
                              <Tooltip cursor={{ fill: C.border }} contentStyle={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 11 }} />
                              <Bar dataKey="amendment_count" name="Amendments" fill={C.accent} radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: C.text }}>
                          <div>Client baseline: <span style={{ fontWeight: 600 }}>{checkResult.avgAmendments.toFixed(1)}</span> amendments / quarter (avg)</div>
                          <div style={{ color: C.green, marginTop: 6 }}>Q1-2025 actuals: <span style={{ fontWeight: 600 }}>0</span> amendments — <span style={{ fontWeight: 600 }}>{checkResult.avgAmendments.toFixed(1)}</span> below baseline</div>
                        </div>
                      </div>
                      
                      {/* Panel 3 */}
                      <div style={{ flex: 1, background: C.accentDim, borderRadius: 8, padding: 20, border: `1px solid ${C.accent}40`, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                        <div style={{ fontSize: 12, color: C.accent, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 12, fontWeight: 600 }}>Value at Stake</div>
                        <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6 }}>
                          Each amendment costs CFF approximately 2–3 hours of staff time. At a baseline of {checkResult.avgAmendments.toFixed(1)} amendments/quarter, that is {checkResult.hoursSaved.toFixed(1)} hours/quarter.
                        </div>
                        <div style={{ marginTop: 16, fontSize: 14 }}>
                          At ₹800/hour fully loaded cost, that is <span style={{ color: C.green, fontWeight: 600, fontSize: 18 }}>₹{fmt(checkResult.costRecovered)}</span> recoverable per quarter.
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* ── HS CODE LOOKUP ── */}
            <section>
              <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 12 }}>HS Code Lookup</div>
              <input
                value={hsSearch}
                onChange={e => setHsSearch(e.target.value)}
                placeholder="Search by HS code or commodity description…"
                style={{ width: "100%", padding: "12px 16px", borderRadius: 8, border: `1px solid ${C.border}`,
                  background: C.card, color: C.text, fontSize: 13, fontFamily: "inherit", outline: "none",
                  boxSizing: "border-box", marginBottom: 14 }}
                onFocus={e => e.target.style.borderColor = C.accent}
                onBlur={e => e.target.style.borderColor = C.border}
              />
              {hsSearch.trim() && (() => {
                const q = hsSearch.toLowerCase();
                const matches = CUSTOMS_FILINGS.filter(f =>
                  f.hs_code.includes(q) || f.description.toLowerCase().includes(q)
                );
                const clientName = id => CLIENTS.find(c => c.client_id === JOB_CLIENT_MAP[id])?.name ?? "—";
                return matches.length === 0 ? (
                  <div style={{ color: C.muted, fontSize: 13, padding: "12px 0" }}>No filings match that search.</div>
                ) : (
                  <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, overflow: "hidden" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: C.surface }}>
                          {["Filing ID", "Client", "Type", "HS Code", "Description", "CIF Value", "Duty ₹", "Amendments"].map(h => (
                            <th key={h} style={{ padding: "9px 14px", textAlign: "left", color: C.muted,
                              fontSize: 10, textTransform: "uppercase", letterSpacing: "0.6px",
                              borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {matches.map((f, i) => (
                          <tr key={f.filing_id} style={{ borderBottom: `1px solid ${C.border}50` }}
                            onMouseEnter={e => e.currentTarget.style.background = C.surface}
                            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                            <td style={{ padding: "9px 14px", fontFamily: "'Space Mono',monospace", fontSize: 11, color: C.accent }}>{f.filing_id}</td>
                            <td style={{ padding: "9px 14px" }}><ClientLink id={JOB_CLIENT_MAP[f.job_id]} openScorecard={openScorecard} /></td>
                            <td style={{ padding: "9px 14px", color: C.muted, fontSize: 11 }}>{f.filing_type}</td>
                            <td style={{ padding: "9px 14px", fontFamily: "'Space Mono',monospace", fontSize: 11, color: C.text }}>{f.hs_code}</td>
                            <td style={{ padding: "9px 14px", color: C.muted }}>{f.description}</td>
                            <td style={{ padding: "9px 14px", color: C.muted, fontFamily: "'Space Mono',monospace", fontSize: 11 }}>₹{fmt(f.cif_value)}</td>
                            <td style={{ padding: "9px 14px", color: f.duty_amount > 0 ? C.yellow : C.muted, fontFamily: "'Space Mono',monospace", fontSize: 11 }}>
                              {f.duty_amount > 0 ? `₹${fmt(f.duty_amount)}` : "—"}
                            </td>
                            <td style={{ padding: "9px 14px", textAlign: "center",
                              color: f.amendments > 0 ? C.red : C.green, fontWeight: 600, fontSize: 12 }}>
                              {f.amendments > 0 ? f.amendments : "✓"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div style={{ padding: "8px 14px", borderTop: `1px solid ${C.border}`, fontSize: 11, color: C.muted }}>
                      {matches.length} filing{matches.length !== 1 ? "s" : ""} found
                    </div>
                  </div>
                );
              })()}
            </section>

            {/* ── COMPLIANCE RISK SCORE ── */}
            <section>
              <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 4 }}>Compliance Risk Score</div>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 14 }}>
                Weighted score: 60% examination rate + 40% amendment rate per client
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                {[...COMPLIANCE_RISK].sort((a, b) => b.riskScore - a.riskScore).map(r => {
                  const colour = r.level === "High" ? C.red : r.level === "Medium" ? C.yellow : C.green;
                  return (
                    <div key={r.client_id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, position: "relative", overflow: "hidden" }}>
                      {/* colour accent strip */}
                      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: colour, borderRadius: "10px 10px 0 0" }} />
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 2 }}>{r.name}</div>
                          <div style={{ fontSize: 11, color: C.muted }}>{r.industry}</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'Space Mono',monospace", color: colour }}>{r.riskScore}</div>
                          <div style={{ fontSize: 10, color: colour, textTransform: "uppercase", letterSpacing: "0.5px" }}>{r.level}</div>
                        </div>
                      </div>
                      {/* score bar */}
                      <div style={{ height: 4, background: C.border, borderRadius: 2, marginBottom: 12 }}>
                        <div style={{ height: "100%", width: `${r.riskScore}%`, background: colour, borderRadius: 2, transition: "width 0.4s" }} />
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                        {[
                          { label: "Filings", val: r.totalFilings },
                          { label: "Examined", val: `${r.examined} (${r.examinationRate}%)` },
                          { label: "Amendments", val: `${r.totalAmendments} (${r.amendmentRate}%)` },
                        ].map(s => (
                          <div key={s.label}>
                            <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2 }}>{s.label}</div>
                            <div style={{ fontSize: 12, fontFamily: "'Space Mono',monospace", color: C.text }}>{s.val}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* ── WAREHOUSE UTILISATION ── */}
            <section>
              <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 4 }}>Warehouse Utilisation</div>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 14 }}>CBM usage and storage cost efficiency by client</div>
              <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: 4 }}>
                {WAREHOUSE_STATS.map((w, i) => (
                  <div key={w.name} style={{ padding: "14px 16px", borderBottom: i < WAREHOUSE_STATS.length - 1 ? `1px solid ${C.border}` : "none" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <div>
                        <span style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{w.name}</span>
                        <span style={{ fontSize: 11, color: C.muted, marginLeft: 10 }}>{w.jobs} storage event{w.jobs !== 1 ? "s" : ""}</span>
                      </div>
                      <div style={{ display: "flex", gap: 24, textAlign: "right" }}>
                        <div>
                          <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.5px" }}>Total CBM</div>
                          <div style={{ fontSize: 13, fontFamily: "'Space Mono',monospace", color: C.accent }}>{w.total_cbm}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.5px" }}>Charges</div>
                          <div style={{ fontSize: 13, fontFamily: "'Space Mono',monospace", color: C.text }}>₹{fmt(w.total_charges)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.5px" }}>₹/CBM</div>
                          <div style={{ fontSize: 13, fontFamily: "'Space Mono',monospace", color: C.text }}>₹{fmt(w.cost_per_cbm)}</div>
                        </div>
                      </div>
                    </div>
                    <div style={{ height: 6, background: C.border, borderRadius: 3 }}>
                      <div style={{ height: "100%", width: `${w.pct}%`, background: `linear-gradient(90deg, ${C.accent}, ${C.accent}88)`, borderRadius: 3, transition: "width 0.4s" }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>


          </div>
        ) : activeTab === "quoteassist" ? (
          <div style={{ display: "flex", gap: 24 }}>
            {/* Left Panel: RFQ Input */}
            <div style={{ width: "40%", background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: 24, alignSelf: "flex-start" }}>
              <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 20 }}>RFQ Input</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>Trade Lane</div>
                  <select value={quoteLane} onChange={e => { setQuoteLane(e.target.value); setQuoteResult(null); }} style={{ width: "100%", padding: "10px", borderRadius: 8, background: C.surface, color: C.text, border: `1px solid ${C.border}`, outline: "none" }}>
                    <option value="Export">Export</option>
                    <option value="Import">Import</option>
                  </select>
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>Origin</div>
                    <input value={quoteOrigin} onChange={e => setQuoteOrigin(e.target.value)} placeholder="e.g. Chennai" style={{ width: "100%", padding: "10px", borderRadius: 8, background: C.surface, color: C.text, border: `1px solid ${C.border}`, outline: "none", boxSizing: "border-box" }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>Destination</div>
                    <input value={quoteDest} onChange={e => setQuoteDest(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: 8, background: C.surface, color: C.text, border: `1px solid ${C.border}`, outline: "none", boxSizing: "border-box" }} />
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>Mode</div>
                  <select value={quoteMode} onChange={e => { setQuoteMode(e.target.value); setQuoteResult(null); }} style={{ width: "100%", padding: "10px", borderRadius: 8, background: C.surface, color: C.text, border: `1px solid ${C.border}`, outline: "none" }}>
                    <option value="Ocean FCL">Ocean FCL</option>
                    <option value="Ocean LCL">Ocean LCL</option>
                    <option value="Air">Air</option>
                    <option value="Project Cargo">Project Cargo</option>
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>Commodity Type</div>
                  <select value={quoteCommodity} onChange={e => { setQuoteCommodity(e.target.value); setQuoteResult(null); }} style={{ width: "100%", padding: "10px", borderRadius: 8, background: C.surface, color: C.text, border: `1px solid ${C.border}`, outline: "none" }}>
                    <option value="">Select Commodity</option>
                    {uniqueCommodities.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <button onClick={runQuoteAssist} disabled={!quoteMode || !quoteCommodity} style={{ marginTop: 8, padding: "12px", borderRadius: 8, background: (!quoteMode || !quoteCommodity) ? C.accentDim : C.accent, color: (!quoteMode || !quoteCommodity) ? C.muted : "#000", border: "none", cursor: (!quoteMode || !quoteCommodity) ? "not-allowed" : "pointer", fontWeight: 600, width: "100%" }}>Find Comparable Jobs</button>
              </div>

              {quoteResult !== null && (
                <div style={{ marginTop: 24, background: C.card, padding: 24, borderRadius: 12, border: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Create Quote from Intelligence</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", marginBottom: 6 }}>Quoted Revenue (₹)</div>
                      <input type="number" value={quoteDraft.revenue} onChange={e => setQuoteDraft({...quoteDraft, revenue: e.target.value})} style={{ width: "100%", padding: 10, background: C.surface, color: C.text, border: `1px solid ${C.border}`, borderRadius: 6, boxSizing: "border-box" }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", marginBottom: 6 }}>Estimated Cost (₹)</div>
                      <input type="number" value={quoteDraft.cost} onChange={e => setQuoteDraft({...quoteDraft, cost: e.target.value})} style={{ width: "100%", padding: 10, background: C.surface, color: C.text, border: `1px solid ${C.border}`, borderRadius: 6, boxSizing: "border-box" }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", marginBottom: 6 }}>Valid Until</div>
                      <input type="date" value={quoteDraft.validUntil} onChange={e => setQuoteDraft({...quoteDraft, validUntil: e.target.value})} style={{ width: "100%", padding: 10, background: C.surface, color: C.text, border: `1px solid ${C.border}`, borderRadius: 6, boxSizing: "border-box" }} />
                    </div>
                    <button onClick={handleSaveToPipeline} style={{ marginTop: 8, padding: 12, background: "transparent", color: C.accent, border: `1px solid ${C.accent}`, borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>Save to Pipeline →</button>
                  </div>
                </div>
              )}
            </div>

            {/* Right Panel: Quote Intelligence */}
            <div style={{ width: "60%", display: "flex", flexDirection: "column", gap: 24 }}>
              {!quoteResult ? (
                <div style={{ background: C.card, borderRadius: 10, border: `1px dashed ${C.border}`, padding: 48, textAlign: "center", color: C.muted, display: "flex", alignItems: "center", justifyContent: "center", flex: 1 }}>
                  Enter RFQ details to generate quote intelligence
                </div>
              ) : quoteResult.matches.length === 0 ? (
                <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: 48, textAlign: "center", color: C.muted }}>
                  No comparable shipments found for this mode and commodity.
                </div>
              ) : (
                <>
                  {/* Section 4: Recommended Quote Range */}
                  <div style={{ background: C.accentDim, borderRadius: 10, padding: 24, border: `1px solid ${C.accent}40`, textAlign: "center" }}>
                    <div style={{ fontSize: 15, color: C.text, marginBottom: 8 }}>
                      Based on <span style={{ fontWeight: 600, color: C.accent }}>{quoteResult.matches.length}</span> comparable shipments, quote between
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "'Space Mono', monospace", color: C.accent, marginBottom: 8 }}>
                      ₹{fmt(Math.round(quoteResult.floor * (1 + quoteResult.targetMargin/100)))} — ₹{fmt(quoteResult.winningRevenueMax || Math.round(quoteResult.ceiling * (1 + quoteResult.targetMargin/100)))}
                    </div>
                    <div style={{ fontSize: 13, color: C.text, marginBottom: 12 }}>Target margin: <span style={{ color: C.green, fontWeight: 600 }}>{quoteResult.targetMargin}%</span></div>
                    <div style={{ fontSize: 11, color: C.muted }}>Quotes outside this range have historically lost {100 - quoteResult.winRate}% of the time.</div>
                  </div>

                  {/* Section 2: Cost Distribution */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                    {[
                      { label: "P25 (Floor Cost)", value: quoteResult.floor },
                      { label: "Median Cost", value: quoteResult.median },
                      { label: "P75 (Ceiling Cost)", value: quoteResult.ceiling },
                    ].map(stat => (
                      <div key={stat.label} style={{ background: C.card, borderRadius: 8, padding: 16, border: `1px solid ${C.border}`, textAlign: "center" }}>
                        <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>{stat.label}</div>
                        <div style={{ fontSize: 16, fontWeight: 600, fontFamily: "'Space Mono', monospace", color: C.accent }}>₹{fmt(stat.value)}</div>
                      </div>
                    ))}
                  </div>

                  {/* Section 3: Win Rate Analysis */}
                  <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: 20 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <span style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.8px" }}>Win Rate Analysis</span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: C.green }}>{quoteResult.winRate}% Overall</span>
                    </div>
                    <div style={{ height: 8, background: C.border, borderRadius: 4, marginBottom: 16, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${quoteResult.winRate}%`, background: C.green }} />
                    </div>
                    <div style={{ display: "flex", gap: 24, fontSize: 12 }}>
                      <div style={{ flex: 1, padding: 12, background: C.surface, borderRadius: 6, border: `1px solid ${C.border}` }}>
                        <div style={{ color: C.muted, marginBottom: 4 }}>Quotes &gt; ₹{fmt(Math.round(quoteResult.threshold))}</div>
                        <div style={{ color: C.text, fontWeight: 600 }}>{quoteResult.aboveWinRate}% win rate</div>
                      </div>
                      <div style={{ flex: 1, padding: 12, background: C.surface, borderRadius: 6, border: `1px solid ${C.border}` }}>
                        <div style={{ color: C.muted, marginBottom: 4 }}>Quotes &le; ₹{fmt(Math.round(quoteResult.threshold))}</div>
                        <div style={{ color: C.text, fontWeight: 600 }}>{quoteResult.belowWinRate}% win rate</div>
                      </div>
                    </div>
                  </div>

                  {/* Section 1: Comparable Shipments */}
                  <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, overflow: "hidden" }}>
                    <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.8px" }}>Comparable Shipments</div>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: C.surface }}>
                            <th style={{ padding: "10px 16px", textAlign: "left", color: C.muted, fontWeight: 500, borderBottom: `1px solid ${C.border}` }}>Quote ID</th>
                            <th style={{ padding: "10px 16px", textAlign: "left", color: C.muted, fontWeight: 500, borderBottom: `1px solid ${C.border}` }}>Route</th>
                            <th style={{ padding: "10px 16px", textAlign: "left", color: C.muted, fontWeight: 500, borderBottom: `1px solid ${C.border}` }}>Revenue</th>
                            <th style={{ padding: "10px 16px", textAlign: "left", color: C.muted, fontWeight: 500, borderBottom: `1px solid ${C.border}` }}>Cost</th>
                            <th style={{ padding: "10px 16px", textAlign: "left", color: C.muted, fontWeight: 500, borderBottom: `1px solid ${C.border}` }}>Margin</th>
                            <th style={{ padding: "10px 16px", textAlign: "center", color: C.muted, fontWeight: 500, borderBottom: `1px solid ${C.border}` }}>Won</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...quoteResult.matches].reverse().map(m => {
                            const marginAmt = m.quoted_revenue - m.actual_cost;
                            const marginPct = Math.round((marginAmt / m.quoted_revenue) * 100);
                            return (
                              <tr key={m.quote_id} style={{ borderBottom: `1px solid ${C.border}50` }}>
                                <td style={{ padding: "10px 16px", fontFamily: "'Space Mono', monospace", color: C.accent }}>{m.quote_id}</td>
                                <td style={{ padding: "10px 16px", color: C.text }}>{m.origin} → {m.destination}</td>
                                <td style={{ padding: "10px 16px", fontFamily: "'Space Mono', monospace", color: C.text }}>₹{fmt(m.quoted_revenue)}</td>
                                <td style={{ padding: "10px 16px", fontFamily: "'Space Mono', monospace", color: C.muted }}>₹{fmt(m.actual_cost)}</td>
                                <td style={{ padding: "10px 16px", color: marginAmt > 0 ? C.green : C.red }}>
                                  ₹{fmt(marginAmt)} ({marginPct}%)
                                </td>
                                <td style={{ padding: "10px 16px", textAlign: "center", fontSize: 14 }}>
                                  {m.won ? "✅" : "❌"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

              {/* BOTTOM: Quote Pipeline */}
              <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, overflow: "hidden", display: "flex", flexDirection: "column", flexShrink: 0 }}>
                <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>
                    Quote Pipeline <span style={{ background: C.surface, padding: "2px 8px", borderRadius: 12, fontSize: 12, marginLeft: 8, color: C.muted }}>{pipelineArray.length}</span>
                  </div>
                  <button onClick={exportPipelineCSV} style={{ padding: "6px 12px", background: "transparent", border: `1px solid ${C.border}`, borderRadius: 6, color: C.muted, fontSize: 12, cursor: "pointer" }}>Export CSV</button>
                </div>
                
                {pipelineArray.length === 0 ? (
                  <div style={{ padding: 40, textAlign: "center", color: C.muted, fontSize: 14 }}>
                    No quotes created yet — use the form above.
                  </div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ background: C.surface }}>
                          <th style={{ padding: "10px 14px", textAlign: "left", color: C.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.6px", borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>Quote ID</th>
                          <th style={{ padding: "10px 14px", textAlign: "left", color: C.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.6px", borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>Client</th>
                          <th style={{ padding: "10px 14px", textAlign: "left", color: C.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.6px", borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>Route</th>
                          <th style={{ padding: "10px 14px", textAlign: "left", color: C.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.6px", borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>Mode</th>
                          <th style={{ padding: "10px 14px", textAlign: "left", color: C.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.6px", borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>Revenue</th>
                          <th style={{ padding: "10px 14px", textAlign: "left", color: C.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.6px", borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>Est. Cost</th>
                          <th style={{ padding: "10px 14px", textAlign: "left", color: C.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.6px", borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>Margin %</th>
                          <th style={{ padding: "10px 14px", textAlign: "left", color: C.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.6px", borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>Created</th>
                          <th style={{ padding: "10px 14px", textAlign: "left", color: C.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.6px", borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>Valid Until</th>
                          <th style={{ padding: "10px 14px", textAlign: "left", color: C.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.6px", borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>Status</th>
                          <th style={{ padding: "10px 14px", textAlign: "left", color: C.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.6px", borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pipelineArray.map(p => {
                          const marginPct = ((p.quoted_revenue - p.actual_cost) / p.quoted_revenue * 100).toFixed(1);
                          return (
                            <tr key={p.quote_id} style={{ borderBottom: `1px solid ${C.border}50` }}>
                              <td style={{ padding: "11px 14px", fontSize: 13, fontFamily: "'Space Mono', monospace", color: C.muted }}>{p.quote_id}</td>
                              <td style={{ padding: "11px 14px", fontSize: 13 }}>{p.client || "—"}</td>
                              <td style={{ padding: "11px 14px", fontSize: 13 }}>{p.origin} → {p.destination}</td>
                              <td style={{ padding: "11px 14px", fontSize: 12 }}>{p.mode}</td>
                              <td style={{ padding: "11px 14px", fontSize: 13, fontFamily: "'Space Mono', monospace" }}>₹{fmt(p.quoted_revenue)}</td>
                              <td style={{ padding: "11px 14px", fontSize: 13, fontFamily: "'Space Mono', monospace" }}>₹{fmt(p.actual_cost)}</td>
                              <td style={{ padding: "11px 14px", fontSize: 13, fontFamily: "'Space Mono', monospace" }}>{marginPct}%</td>
                              <td style={{ padding: "11px 14px", fontSize: 11, fontFamily: "'Space Mono', monospace", color: C.muted }}>{p.created_date}</td>
                              <td style={{ padding: "11px 14px", fontSize: 11, fontFamily: "'Space Mono', monospace", color: C.muted }}>{p.valid_until}</td>
                              <td style={{ padding: "11px 14px", fontSize: 13 }}>
                                <span style={{
                                  color: p.status === "Pending" ? C.accent : p.status === "Won" ? C.green : C.red,
                                  background: p.status === "Pending" ? C.accentDim : "transparent",
                                  padding: "2px 6px", borderRadius: 4, fontSize: 11, fontWeight: 600, textTransform: "uppercase"
                                }}>{p.status}</span>
                              </td>
                              <td style={{ padding: "11px 14px", fontSize: 13 }}>
                                {p.status === "Pending" && (
                                  <div style={{ display: "flex", gap: 6 }}>
                                    <button onClick={() => setPipelineArray(prev => prev.map(item => item.quote_id === p.quote_id ? {...item, status: "Won", won: true} : item))} style={{ background: "transparent", border: `1px solid ${C.green}`, color: C.green, borderRadius: 4, padding: "2px 6px", fontSize: 11, cursor: "pointer" }}>Won ✓</button>
                                    <button onClick={() => setPipelineArray(prev => prev.map(item => item.quote_id === p.quote_id ? {...item, status: "Lost", won: false} : item))} style={{ background: "transparent", border: `1px solid ${C.red}`, color: C.red, borderRadius: 4, padding: "2px 6px", fontSize: 11, cursor: "pointer" }}>Lost ✗</button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>
          </div>
        ) : (
          /* SCHEMA TAB */
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {[
              { name: "CLIENTS", fields: ["client_id", "name", "industry", "country", "onboarded_year"], count: CLIENTS.length },
              { name: "JOBS", fields: ["job_id", "client_id", "mode", "origin", "destination", "trade_lane", "service", "job_date", "revenue ₹", "cost ₹", "status", "days_to_close"], count: JOBS.length },
              { name: "CUSTOMS_FILINGS", fields: ["filing_id", "job_id", "filing_type", "hs_code", "description", "cif_value ₹", "duty_amount ₹", "examination", "amendments", "days_to_clear"], count: CUSTOMS_FILINGS.length },
              { name: "WAREHOUSE", fields: ["record_id", "client_id", "commodity", "cbm", "entry_date", "exit_date", "charges ₹"], count: WAREHOUSE.length },
            ].map(tbl => (
              <div key={tbl.name} style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: C.accent }}>{tbl.name}</span>
                  <span style={{ fontSize: 11, color: C.muted }}>{tbl.count} records</span>
                </div>
                {tbl.fields.map(f => (
                  <div key={f} style={{ padding: "5px 0", borderBottom: `1px solid ${C.border}40`, fontSize: 12, color: C.muted, fontFamily: "'Space Mono', monospace" }}>
                    {f}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

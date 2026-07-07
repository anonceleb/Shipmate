import { useState, useMemo, useRef } from "react";
import { BarChart, Bar, XAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

import ScorecardModal from "./components/ScorecardModal.jsx";
import ChartsTab from "./components/ChartsTab.jsx";
import ClientLink from "./components/ClientLink.jsx";
import ProfitabilityTab from "./components/ProfitabilityTab.jsx";
import { CLIENTS, JOBS, CUSTOMS_FILINGS, WAREHOUSE, SCHEMA_DESC, C, applyTheme, DRAWBACK_RATES, DRAWBACK_CLAIMS, BASELINE_METRICS, QUOTES, SAMPLE_QUESTIONS } from "./data/constants.js";
import { JOB_CLIENT_MAP, COMPLIANCE_RISK, WAREHOUSE_STATS, fmt, pct } from "./utils/computations.js";
import { useClaudeQuery } from "./core/query.js";
import { buildPrintableHtml } from "./core/artifacts.js";
import { LifecycleShell } from "./core/LifecycleShell.jsx";

const CFF_TERMINAL = {
  abbr: "CFF",
  name: "COMBINED FREIGHT FORWARDERS PVT LTD",
  label: "CFF Analytics Intelligence",
  address: "Combined Freight Forwarders · No.45, Greams Road, Chennai-600006",
  color: "#E8A838",
};
const CFF_BOOKING_SLA_DAYS = 14;

const StageHeader = ({ title, stat }) => (
  <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
    <h1 style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>{title}</h1>
    {stat && <span style={{ fontSize: 13, color: C.muted, fontFamily: "'Space Mono', monospace" }}>{stat}</span>}
  </div>
);

export default function App({ onSwitch }) {
  const [isLightMode, setIsLightMode] = useState(false);
  applyTheme(isLightMode);

  const [activeTab, setActiveTab] = useState("overview");

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

  const [printDoc, setPrintDoc] = useState(null);
  const printDocRef = useRef(null);

  const [bookingRegister, setBookingRegister] = useState(() => {
    try { const s = localStorage.getItem("cff_booking_register"); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  const [bookingConfirmed, setBookingConfirmed] = useState({});

  const [settlePayments, setSettlePayments] = useState(() => {
    try { const s = localStorage.getItem("cff_settle_payments"); return s ? JSON.parse(s) : []; } catch { return []; }
  });

  const [billRegister, setBillRegister] = useState(() => {
    try { const s = localStorage.getItem("cff_bill_register"); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  const [billIssued, setBillIssued] = useState({});

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

  const buildCffSystem = (qText) => {
    const qLower = qText.toLowerCase();
    let dataContext = "\nDATA:\n";
    if (qLower.includes("client") || qLower.includes("industry")) dataContext += `CLIENTS: ${JSON.stringify(CLIENTS)}\n`;
    if (qLower.match(/job|margin|revenue|cost|profit|lane|mode/)) dataContext += `JOBS: ${JSON.stringify(JOBS)}\n`;
    if (qLower.match(/customs|filing|amend|duty|hs|exam/)) dataContext += `CUSTOMS_FILINGS: ${JSON.stringify(CUSTOMS_FILINGS)}\n`;
    if (qLower.match(/warehouse|cbm|storage/)) dataContext += `WAREHOUSE: ${JSON.stringify(WAREHOUSE)}\n`;
    if (dataContext === "\nDATA:\n") dataContext += `CLIENTS: ${JSON.stringify(CLIENTS)}\nJOBS: ${JSON.stringify(JOBS)}\n`;
    return SCHEMA_DESC + dataContext + `
Respond ONLY with a valid JSON object, no markdown, no explanation. Format:
{
  "sql": "SELECT ... -- the SQL query that would answer this",
  "summary": "1-2 sentence plain English answer with specific numbers",
  "table": [{"col1": val, "col2": val, ...}],
  "insight": "1 sentence business insight or recommendation"
}
The table should have 3-8 rows maximum, with the most relevant data.
Column names should be human-readable (e.g., "Client Name" not "client_id").
Use INR formatting for monetary values (include ₹ symbol).`;
  };

  const { question, setQuestion, loading, result, handleQuery } = useClaudeQuery(buildCffSystem, 1000);

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

  // Batch-file every unclaimed drawback claim in one state update — looping
  // confirmFileClaim-style pushes would drop entries via a stale `filingRegister` closure.
  const fileAllClaims = () => {
    const pending = claimsState.filter(c => c.status === "Unclaimed");
    if (!pending.length) { setToastMessage("All claims already filed"); setTimeout(() => setToastMessage(null), 3000); return; }
    const filed_date = new Date().toISOString().slice(0, 10);
    const base = filingRegister.length;
    const newEntries = pending.map((c, i) => {
      const cff_fee = Math.round(c.eligible_amount * 0.18);
      const icegateRef = "ICG" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
      return { register_id: "FR" + String(base + i + 1).padStart(3, "0"), claim_id: c.claim_id, client_id: c.client_id, hs_chapter: c.hs_chapter, eligible_amount: c.eligible_amount, cff_fee, filed_date, icegate_ref: icegateRef, status: "Filed" };
    });
    const pendingIds = new Set(pending.map(c => c.claim_id));
    const nextClaims = claimsState.map(c => pendingIds.has(c.claim_id) ? { ...c, status: "Filed" } : c);
    const nextRegister = [...filingRegister, ...newEntries];
    setClaimsState(nextClaims);
    setFilingRegister(nextRegister);
    localStorage.setItem("cff_claims", JSON.stringify(nextClaims));
    localStorage.setItem("cff_filing_register", JSON.stringify(nextRegister));
    setToastMessage(`${pending.length} claims filed & logged — ₹${fmt(pending.reduce((s, c) => s + c.eligible_amount, 0))} raised`);
    setTimeout(() => setToastMessage(null), 5000);
  };

  // Summary stats
  const completedJobs = JOBS.filter(j => j.status === "Completed");
  const inProgressJobs = JOBS.filter(j => j.status === "In Progress");
  const totalRevenue = completedJobs.reduce((s, j) => s + j.revenue, 0);
  const totalCost = completedJobs.reduce((s, j) => s + j.cost, 0);
  const totalMargin = totalRevenue - totalCost;
  const examCount = CUSTOMS_FILINGS.filter(f => f.examination).length;
  const amendCount = CUSTOMS_FILINGS.filter(f => f.amendments > 0).length;
  const unclaimedDrawbacks = claimsState.filter(c => c.status === "Unclaimed");
  const totalUnclaimedDrawback = unclaimedDrawbacks.reduce((s, c) => s + c.eligible_amount, 0);
  const cffFee = Math.round(totalUnclaimedDrawback * 0.18);
  const highRiskClients = COMPLIANCE_RISK.filter(r => r.level === "High");
  const sessionRecovered = filingRegister.reduce((s, r) => s + (r.eligible_amount || 0), 0);

  // ── Book — overdue tracking & booking confirmations ──────────────────────────
  const overdueJobs = inProgressJobs.filter(j =>
    Math.floor((new Date() - new Date(j.job_date)) / 86400000) > CFF_BOOKING_SLA_DAYS
  );

  const printArtifact = (title, bodyHtml, refNo) => {
    setPrintDoc({ title, html: buildPrintableHtml(CFF_TERMINAL, title, bodyHtml, refNo) });
  };

  const issueBookingConfirmation = job => {
    const client = clientById[job.client_id];
    const n = bookingRegister.length + 1;
    const ref = `CFF/BKNG/${String(n).padStart(4, "0")}`;
    const daysElapsed = Math.floor((new Date() - new Date(job.job_date)) / 86400000);
    const entry = { ref, job_id: job.job_id, client_id: job.client_id, clientName: client?.name || "—", date: new Date().toISOString().slice(0, 10) };
    const next = [...bookingRegister, entry];
    setBookingRegister(next);
    localStorage.setItem("cff_booking_register", JSON.stringify(next));
    setBookingConfirmed(prev => ({ ...prev, [job.job_id]: ref }));
    printArtifact("Booking Confirmation", `
      <h2>Booking Confirmation</h2>
      <p>To: <b>${client?.name}</b></p>
      <p>This confirms that CFF has registered and is actively processing the following shipment:</p>
      <table>
        <tr><td>Job ID</td><td><b>${job.job_id}</b></td></tr>
        <tr><td>Mode</td><td>${job.mode}</td></tr>
        <tr><td>Trade Lane</td><td>${job.trade_lane}</td></tr>
        <tr><td>Origin → Destination</td><td>${job.origin} → ${job.destination}</td></tr>
        <tr><td>Job Date</td><td>${job.job_date}</td></tr>
        <tr><td>Days Active</td><td>${daysElapsed}</td></tr>
      </table>
      <p>Our team is coordinating documentation, customs, and freight. Please revert to confirm receipt.</p>`, ref);
    setToastMessage(`Booking confirmation ${ref} issued`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // ── Bill — job invoicing for completed jobs ───────────────────────────────────
  const isJobInvoiced = jobId => !!(billIssued[jobId] || billRegister.find(b => b.job_id === jobId));

  const issueJobInvoice = job => {
    const client = clientById[job.client_id];
    const n = billRegister.length + 1;
    const ref = `CFF/INV/${String(n).padStart(4, "0")}`;
    const gst = Math.round(job.revenue * 0.18);
    const total = job.revenue + gst;
    const entry = { ref, job_id: job.job_id, client_id: job.client_id, clientName: client?.name || "—", revenue: job.revenue, gst, total, date: new Date().toISOString().slice(0, 10) };
    const next = [...billRegister, entry];
    setBillRegister(next);
    localStorage.setItem("cff_bill_register", JSON.stringify(next));
    setBillIssued(prev => ({ ...prev, [job.job_id]: ref }));
    printArtifact("Tax Invoice", `
      <h2>Tax Invoice</h2>
      <p>To: <b>${client?.name}</b></p>
      <table>
        <tr><td>Job ID</td><td><b>${job.job_id}</b></td></tr>
        <tr><td>Mode</td><td>${job.mode}</td></tr>
        <tr><td>Trade Lane</td><td>${job.trade_lane}</td></tr>
        <tr><td>Origin → Destination</td><td>${job.origin} → ${job.destination}</td></tr>
        <tr><td>Job Date</td><td>${job.job_date}</td></tr>
      </table>
      <table>
        <tr><th>Description</th><th>Amount (₹)</th></tr>
        <tr><td>Freight forwarding services — ${job.mode}</td><td>${fmt(job.revenue)}</td></tr>
        <tr><td>GST @ 18%</td><td>${fmt(gst)}</td></tr>
        <tr><th>Total payable</th><th>₹${fmt(total)}</th></tr>
      </table>
      <p>Payment due within 30 days of invoice date. GSTIN: 33AAACL1234F1Z5</p>`, ref);
    setToastMessage(`Invoice ${ref} issued — ₹${fmt(total)} (incl. GST)`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const pendingBillJobs = completedJobs.filter(j => !isJobInvoiced(j.job_id));
  const invoicedJobs = billRegister;
  const totalBilled = billRegister.reduce((s, b) => s + b.total, 0);
  const totalPendingRevenue = pendingBillJobs.reduce((s, j) => s + j.revenue, 0);

  // ── Settle — CFF fee receivables from filed drawback claims ──────────────────
  const cffFeesByClient = {};
  filingRegister.forEach(r => {
    if (!cffFeesByClient[r.client_id])
      cffFeesByClient[r.client_id] = { client_id: r.client_id, clientName: clientById[r.client_id]?.name || "—", entries: [], totalFees: 0 };
    cffFeesByClient[r.client_id].entries.push(r);
    cffFeesByClient[r.client_id].totalFees += r.cff_fee || 0;
  });
  const paidByClient = {};
  settlePayments.forEach(p => { paidByClient[p.client_id] = (paidByClient[p.client_id] || 0) + (p.amount || 0); });
  const SETTLE_OUTSTANDING = Object.values(cffFeesByClient)
    .map(g => ({ ...g, paid: paidByClient[g.client_id] || 0, outstanding: Math.max(0, g.totalFees - (paidByClient[g.client_id] || 0)) }))
    .filter(g => g.outstanding > 0.5)
    .sort((a, b) => b.outstanding - a.outstanding);
  const SETTLE_SETTLED = Object.values(cffFeesByClient)
    .map(g => ({ ...g, paid: paidByClient[g.client_id] || 0 }))
    .filter(g => g.totalFees > 0 && (paidByClient[g.client_id] || 0) >= g.totalFees - 0.5 && settlePayments.some(p => p.client_id === g.client_id));
  const totalSettleOutstanding = SETTLE_OUTSTANDING.reduce((s, g) => s + g.outstanding, 0);
  const totalSettleCollected = settlePayments.reduce((s, p) => s + (p.amount || 0), 0);

  const issueSettleReceipt = g => {
    const n = settlePayments.length + 1;
    const ref = `CFF/RCPT/${String(n).padStart(4, "0")}`;
    const totalEligible = g.entries.reduce((s, e) => s + (e.eligible_amount || 0), 0);
    const entry = { ref, client_id: g.client_id, clientName: g.clientName, claim_count: g.entries.length, amount: g.outstanding, date: new Date().toISOString().slice(0, 10) };
    const next = [...settlePayments, entry];
    setSettlePayments(next);
    localStorage.setItem("cff_settle_payments", JSON.stringify(next));
    printArtifact("Payment Receipt", `
      <h2>Payment Receipt — CFF Professional Fees</h2>
      <p>Received from: <b>${g.clientName}</b></p>
      <table>
        <tr><th>Reg ID</th><th>Eligible Amount (₹)</th><th>CFF Fee (₹)</th><th>Filed Date</th></tr>
        ${g.entries.map(e => `<tr><td>${e.register_id}</td><td>${fmt(e.eligible_amount)}</td><td>${fmt(e.cff_fee)}</td><td>${e.filed_date}</td></tr>`).join("")}
        <tr><th>Total CFF fees received</th><td></td><th>₹${fmt(g.outstanding)}</th><td></td></tr>
      </table>
      <p>Based on ${g.entries.length} filed duty drawback claim${g.entries.length !== 1 ? "s" : ""} totalling ₹${fmt(totalEligible)} eligible amount. CFF professional fee at 18%.</p>
      <p>This receipt confirms full settlement of outstanding CFF professional fees for duty drawback filing services.</p>`, ref);
    setToastMessage(`Payment receipt ${ref} issued — ₹${fmt(g.outstanding)} collected from ${g.clientName}`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const CFF_STAGES = [
    { id: "overview", label: "Overview", hint: "why this exists — three numbers", sub: "the business case" },
    { id: "quote",    label: "Quote",    hint: "price the job — quoting intelligence", sub: `${pipelineArray.length} in pipeline` },
    { id: "book",     label: "Book",     hint: "open the job — booking confirmations & SLA",
      sub: overdueJobs.length > 0 ? `${overdueJobs.length} overdue` : `${inProgressJobs.length} in progress`,
      subColor: overdueJobs.length > 0 ? C.red : C.yellow },
    { id: "operate",  label: "Operate",  hint: "compliance check & pre-filing", sub: `${amendCount} filings amended`, subColor: C.yellow },
    { id: "bill",     label: "Bill",     hint: "job invoicing — issue tax invoices for completed jobs",
      sub: pendingBillJobs.length ? `${pendingBillJobs.length} uninvoiced` : "all invoiced",
      subColor: pendingBillJobs.length ? C.red : C.green },
    { id: "recover",  label: "Recover",  hint: "duty drawback & filing register", sub: `₹${fmt(totalUnclaimedDrawback)} recoverable`, subColor: C.red },
    { id: "settle",   label: "Settle",   hint: "collect CFF fees — outstanding against filed claims",
      sub: SETTLE_OUTSTANDING.length ? `₹${fmt(totalSettleOutstanding)} outstanding` : "all collected",
      subColor: SETTLE_OUTSTANDING.length ? C.yellow : C.green },
  ];
  const CFF_RAILS = [
    { id: "intelligence",  label: "Intelligence" },
    { id: "profitability", label: "Profitability" },
  ];

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
      {/* ── Printable document viewer ── */}
      {printDoc && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 3000 }}>
          <div style={{ width: "100%", maxWidth: 860, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 8px 10px" }}>
            <span style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>{printDoc.title}</span>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => printDocRef.current?.contentWindow?.print()} style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${C.accent}`, background: "transparent", color: C.accent, cursor: "pointer", fontSize: 11 }}>Print / Save PDF</button>
              <button onClick={() => setPrintDoc(null)} style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid #444", background: "transparent", color: "#aaa", cursor: "pointer", fontSize: 11 }}>Close</button>
            </div>
          </div>
          <iframe
            ref={printDocRef}
            srcDoc={printDoc.html}
            style={{ width: "100%", maxWidth: 860, height: "82vh", border: "none", borderRadius: 10, background: "#fff" }}
            title={printDoc.title}
          />
        </div>
      )}

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

      <LifecycleShell
        brand={{ abbr: "CFF", name: "CFF Analytics Intelligence", subtitle: "DEMO · MOCK DATA · 2024–2025", color: C.accent }}
        stages={CFF_STAGES}
        rails={[...CFF_RAILS, { id: "schema", label: "Schema" }]}
        active={activeTab}
        onSelect={setActiveTab}
        onGapClick={() => { setToastMessage("Roadmap stage — part of the full lifecycle story"); setTimeout(() => setToastMessage(null), 4000); }}
        headerExtra={
          <>
            <div style={{ textAlign: "right", borderLeft: `1px solid ${C.border}`, paddingLeft: 20 }}>
              <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.8px" }}>Recovered this session</div>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'Space Mono', monospace", color: C.green }}>₹{fmt(sessionRecovered)}</div>
            </div>
            {onSwitch && (
              <button onClick={onSwitch} style={{ padding: "6px 12px", borderRadius: 6, border: `1px solid ${C.border}`, background: C.surface, color: C.muted, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                ⇄ Switch demo
              </button>
            )}
          </>
        }
        themeToggle={
          <button
            onClick={() => setIsLightMode(!isLightMode)}
            title={isLightMode ? "Switch to dark mode" : "Switch to light mode"}
            style={{ padding: "8px 14px", borderRadius: 20, border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontSize: 13, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 2px 8px rgba(0,0,0,0.3)" }}
          >
            {isLightMode ? "🌙" : "☀️"}
          </button>
        }
      >
        {/* ── OVERVIEW — the business case ── */}
        {activeTab === "overview" && (
          <>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 22 }}>
              <div style={{ fontSize: 13, color: C.muted }}>{JOBS.length} jobs on file · as of {new Date().toISOString().slice(0, 10)}</div>
              <div style={{ fontSize: 11, color: C.muted, fontFamily: "'Space Mono', monospace" }}>COMBINED FREIGHT FORWARDERS · SYNTHETIC DATA</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 18, marginBottom: 36 }}>
              <div style={{ background: C.card, border: `1px solid ${C.red}`, borderRadius: 14, padding: 26 }}>
                <div style={{ fontSize: 11, color: C.red, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 14, fontFamily: "'Space Mono', monospace" }}>Recoverable duty drawback</div>
                <div style={{ fontSize: 34, fontWeight: 700, fontFamily: "'Space Mono', monospace", color: C.red }}>₹{fmt(totalUnclaimedDrawback)}</div>
                <div style={{ fontSize: 13, color: C.muted, marginTop: 8, lineHeight: 1.6 }}>{unclaimedDrawbacks.length} of {claimsState.length} claims · CFF fee ₹{fmt(cffFee)} at 18%</div>
                <button onClick={() => setActiveTab("recover")} style={{ marginTop: 18, padding: "9px 16px", borderRadius: 8, border: `1px solid ${C.red}`, background: "transparent", color: C.red, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit" }}>Recover it →</button>
              </div>
              <div style={{ background: C.card, border: `1px solid ${C.yellow}`, borderRadius: 14, padding: 26 }}>
                <div style={{ fontSize: 11, color: C.yellow, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 14, fontFamily: "'Space Mono', monospace" }}>Jobs in progress</div>
                <div style={{ fontSize: 34, fontWeight: 700, fontFamily: "'Space Mono', monospace", color: C.yellow }}>{inProgressJobs.length}</div>
                <div style={{ fontSize: 13, color: C.muted, marginTop: 8, lineHeight: 1.6 }}>{examCount} examinations · {amendCount} amendments this FY</div>
                <button onClick={() => setActiveTab("book")} style={{ marginTop: 18, padding: "9px 16px", borderRadius: 8, border: `1px solid ${C.yellow}`, background: "transparent", color: C.yellow, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit" }}>Manage jobs →</button>
              </div>
              <div style={{ background: C.card, border: `1px solid ${C.accent}`, borderRadius: 14, padding: 26 }}>
                <div style={{ fontSize: 11, color: C.accent, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 14, fontFamily: "'Space Mono', monospace" }}>Compliance risk</div>
                <div style={{ fontSize: 34, fontWeight: 700, fontFamily: "'Space Mono', monospace", color: C.accent }}>{highRiskClients.length} <span style={{ fontSize: 16, color: C.muted, fontWeight: 400 }}>clients</span></div>
                <div style={{ fontSize: 13, color: C.muted, marginTop: 8, lineHeight: 1.6 }}>weighted score ≥ 60 — examination + amendment rate</div>
                <button onClick={() => setActiveTab("operate")} style={{ marginTop: 18, padding: "9px 16px", borderRadius: 8, border: `1px solid ${C.accent}`, background: "transparent", color: C.accent, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit" }}>Check compliance →</button>
              </div>
            </div>
            <div style={{ display: "flex", gap: 28, flexWrap: "wrap", borderTop: `1px solid ${C.border}`, paddingTop: 18, fontSize: 13, color: C.muted, fontFamily: "'Space Mono', monospace" }}>
              <span>{completedJobs.length} jobs · FY</span>
              <span>₹{fmt(totalRevenue)} invoiced</span>
              <span>₹{fmt(totalMargin)} margin</span>
            </div>
          </>
        )}

        {activeTab === "intelligence" && (
          <>
            <StageHeader title="Ask the data" />
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
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}`, fontSize: 12, color: C.accent }}>
                      {result.insight}
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
              </div>
            )}
          </>
        )}
        {activeTab === "profitability" && (
          <>
            <StageHeader title="Profitability" stat={`${pct(totalMargin, totalRevenue)} blended margin · ${completedJobs.length} jobs`} />
            <ProfitabilityTab onSelectClient={openScorecard} />
            <ChartsTab onSelectClient={openScorecard} />
            <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: 4, marginTop: 4 }}>
              <div style={{ padding: "14px 16px", fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.8px", borderBottom: `1px solid ${C.border}` }}>Warehouse Utilisation — CBM & storage cost by client</div>
              {WAREHOUSE_STATS.map((w, i) => (
                <div key={w.name} style={{ padding: "14px 16px", borderBottom: i < WAREHOUSE_STATS.length - 1 ? `1px solid ${C.border}` : "none" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div>
                      <span style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{w.name}</span>
                      <span style={{ fontSize: 11, color: C.muted, marginLeft: 10 }}>{w.jobs} storage event{w.jobs !== 1 ? "s" : ""}</span>
                    </div>
                    <div style={{ display: "flex", gap: 24, textAlign: "right" }}>
                      {[["Total CBM", w.total_cbm, C.accent], ["Charges", `₹${fmt(w.total_charges)}`, C.text], ["₹/CBM", `₹${fmt(w.cost_per_cbm)}`, C.text]].map(([label, val, color]) => (
                        <div key={label}>
                          <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</div>
                          <div style={{ fontSize: 13, fontFamily: "'Space Mono',monospace", color }}>{val}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ height: 6, background: C.border, borderRadius: 3 }}>
                    <div style={{ height: "100%", width: `${w.pct}%`, background: `linear-gradient(90deg, ${C.accent}, ${C.accent}88)`, borderRadius: 3 }} />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        {activeTab === "book" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <StageHeader title="Job pipeline" stat={`${inProgressJobs.length} in progress · ${overdueJobs.length} overdue · ${JOBS.length} total`} />

            {/* KPI tiles */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
              {[
                ["Total jobs", JOBS.length, C.text],
                ["In progress", inProgressJobs.length, C.yellow],
                ["Completed (FY)", completedJobs.length, C.accent],
                [`Overdue (>${CFF_BOOKING_SLA_DAYS}d)`, overdueJobs.length, overdueJobs.length > 0 ? C.red : C.green],
              ].map(([label, value, color]) => (
                <div key={label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px 20px" }}>
                  <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 8 }}>{label}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'Space Mono', monospace", color }}>{value}</div>
                </div>
              ))}
            </div>

            {/* In-progress jobs with booking confirmation */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20 }}>
              <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 14 }}>In-progress jobs — {CFF_BOOKING_SLA_DAYS}-day SLA</div>
              {inProgressJobs.length === 0 && <div style={{ color: C.muted, fontSize: 13 }}>No jobs currently in progress.</div>}
              {inProgressJobs.length > 0 && (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr>
                    {["Job", "Client", "Route / Mode", "Job date", "Days active", ""].map((h, i) => (
                      <th key={i} style={{ textAlign: i >= 4 ? "right" : "left", padding: "9px 10px", fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.6px", borderBottom: `1px solid ${C.border}` }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>{inProgressJobs.map(job => {
                    const client = clientById[job.client_id];
                    const daysElapsed = Math.floor((new Date() - new Date(job.job_date)) / 86400000);
                    const isOverdue = daysElapsed > CFF_BOOKING_SLA_DAYS;
                    const confirmed = bookingConfirmed[job.job_id] || bookingRegister.find(b => b.job_id === job.job_id)?.ref;
                    return (
                      <tr key={job.job_id}>
                        <td style={{ padding: "10px", fontSize: 13, borderBottom: `1px solid ${C.border}`, fontFamily: "'Space Mono', monospace", color: C.accent }}>{job.job_id}</td>
                        <td style={{ padding: "10px", fontSize: 13, borderBottom: `1px solid ${C.border}` }}>{client?.name}</td>
                        <td style={{ padding: "10px", fontSize: 12, borderBottom: `1px solid ${C.border}`, color: C.muted }}>{job.origin} → {job.destination} · {job.mode}</td>
                        <td style={{ padding: "10px", fontSize: 12, borderBottom: `1px solid ${C.border}`, fontFamily: "'Space Mono', monospace" }}>{job.job_date}</td>
                        <td style={{ padding: "10px", fontSize: 13, borderBottom: `1px solid ${C.border}`, textAlign: "right", fontFamily: "'Space Mono', monospace", fontWeight: 700, color: isOverdue ? C.red : daysElapsed > 7 ? C.yellow : C.green }}>{daysElapsed}d</td>
                        <td style={{ padding: "10px", borderBottom: `1px solid ${C.border}`, textAlign: "right" }}>
                          {confirmed
                            ? <span style={{ fontSize: 12, color: C.green }}>✓ Confirmed · {confirmed}</span>
                            : <button style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${C.accent}`, background: "transparent", color: C.accent, cursor: "pointer", fontSize: 11, fontFamily: "inherit" }} onClick={() => issueBookingConfirmation(job)}>Send booking confirmation →</button>}
                        </td>
                      </tr>
                    );
                  })}</tbody>
                </table>
              )}
              {overdueJobs.length > 0 && (
                <div style={{ marginTop: 14, fontSize: 12, color: C.red }}>
                  {overdueJobs.length} job{overdueJobs.length > 1 ? "s" : ""} past the {CFF_BOOKING_SLA_DAYS}-day SLA — send booking confirmations and follow up with the shipping line.
                </div>
              )}
            </div>

            {/* Filter Bar */}
            <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: 20 }}>
              <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 12 }}>Filter & explore all jobs</div>
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

            {/* Jobs table */}
            <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: C.surface }}>
                      {["job_id", "client_id", "mode", "trade_lane", "job_date", "revenue", "status"].map(col => (
                        <th key={col} onClick={() => handleSort(col)} style={{ padding: "12px 16px", textAlign: "left", color: sortCol === col ? C.accent : C.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.6px", borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap", cursor: "pointer", userSelect: "none" }} onMouseEnter={e => e.target.style.color = C.accent} onMouseLeave={e => e.target.style.color = sortCol === col ? C.accent : C.muted}>
                          {col.replaceAll("_", " ")} {sortCol === col ? (sortAsc ? "↑" : "↓") : ""}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredJobs.map(job => (
                      <tr key={job.job_id} style={{ borderBottom: `1px solid ${C.border}80` }} onMouseEnter={e => e.currentTarget.style.background = C.surface} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        <td style={{ padding: "12px 16px", color: C.text, fontFamily: "'Space Mono', monospace" }}>{job.job_id}</td>
                        <td style={{ padding: "12px 16px" }}>{clientById[job.client_id]?.name}</td>
                        <td style={{ padding: "12px 16px", color: C.muted }}>{job.mode}</td>
                        <td style={{ padding: "12px 16px", color: C.muted }}>{job.trade_lane}</td>
                        <td style={{ padding: "12px 16px", color: C.muted }}>{job.job_date}</td>
                        <td style={{ padding: "12px 16px" }}>₹{fmt(job.revenue)}</td>
                        <td style={{ padding: "12px 16px" }}>
                          <span style={{ fontSize: 11, background: job.status === "Completed" ? "#2ECC7120" : C.accentDim, color: job.status === "Completed" ? C.green : C.accent, padding: "4px 8px", borderRadius: 12 }}>{job.status}</span>
                        </td>
                      </tr>
                    ))}
                    {filteredJobs.length === 0 && (
                      <tr><td colSpan={7} style={{ padding: "32px", textAlign: "center", color: C.muted }}>No jobs match your filters.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        {/* ── RECOVER — duty drawback + filing register ── */}
        {activeTab === "recover" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>

            {/* ── DUTY DRAWBACK ── */}
            <section>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 24, flexWrap: "wrap", marginBottom: 22 }}>
                <StageHeader title="Duty drawback" stat={`₹${fmt(totalUnclaimedDrawback)} · ${unclaimedDrawbacks.length} of ${claimsState.length} claims · fee ₹${fmt(cffFee)} at 18%`} />
                <button
                  onClick={fileAllClaims}
                  style={{ padding: "12px 22px", borderRadius: 9, border: "none", background: C.accent, color: "#000", fontWeight: 700, cursor: "pointer", fontSize: 14, flexShrink: 0, fontFamily: "inherit" }}
                >
                  {unclaimedDrawbacks.length ? `File all ${unclaimedDrawbacks.length} claims · ₹${fmt(totalUnclaimedDrawback)} →` : "All claims filed ✓"}
                </button>
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
              <section>
                <StageHeader title="Filing register" stat={`${filingRegister.length} claim${filingRegister.length !== 1 ? "s" : ""} filed · ₹${fmt(sessionRecovered)} raised this session`} />
                <div style={{ display: "flex", gap: 16, marginBottom: 22, flexWrap: "wrap" }}>
                  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px 22px", minWidth: 180 }}>
                    <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.8px" }}>Recoverable filed</div>
                    <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'Space Mono', monospace", marginTop: 5, color: C.green }}>₹{fmt(sessionRecovered)}</div>
                  </div>
                  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px 22px", minWidth: 180 }}>
                    <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.8px" }}>CFF fee earned</div>
                    <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'Space Mono', monospace", marginTop: 5, color: C.text }}>₹{fmt(filingRegister.reduce((s, r) => s + (r.cff_fee || 0), 0))}</div>
                  </div>
                </div>
                <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: 24 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", marginBottom: 16 }}>
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
                </div>
              </section>
            )}

          </div>
        )}
        {/* ── BILL — job invoicing ── */}
        {activeTab === "bill" && (
          <>
            <StageHeader
              title="Job invoicing"
              stat={`${pendingBillJobs.length} uninvoiced · ${billRegister.length} issued · ₹${fmt(totalBilled)} billed this session`}
            />

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 20 }}>
              {[
                ["Completed jobs", completedJobs.length, C.text],
                ["Invoiced", billRegister.length, C.green],
                ["Pending invoice", pendingBillJobs.length, pendingBillJobs.length > 0 ? C.red : C.green],
                ["Billed this session", `₹${fmt(totalBilled)}`, C.accent],
              ].map(([label, value, color]) => (
                <div key={label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px 20px" }}>
                  <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 8 }}>{label}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'Space Mono', monospace", color }}>{value}</div>
                </div>
              ))}
            </div>

            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20, marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.8px" }}>
                  Completed jobs — pending invoice {pendingBillJobs.length > 0 && `· ₹${fmt(totalPendingRevenue)} revenue to bill`}
                </div>
                {pendingBillJobs.length > 1 && (
                  <button
                    onClick={() => pendingBillJobs.forEach(j => !isJobInvoiced(j.job_id) && issueJobInvoice(j))}
                    style={{ padding: "7px 16px", borderRadius: 7, border: "none", background: C.accent, color: "#000", fontWeight: 700, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}
                  >
                    Issue all {pendingBillJobs.length} invoices →
                  </button>
                )}
              </div>
              {pendingBillJobs.length === 0 ? (
                <div style={{ color: C.green, fontSize: 13 }}>✓ All completed jobs have been invoiced this session.</div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr>
                    {["Job", "Client", "Route / Mode", "Job date", "Revenue", ""].map((h, i) => (
                      <th key={i} style={{ textAlign: i >= 4 ? "right" : "left", padding: "9px 10px", fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.6px", borderBottom: `1px solid ${C.border}` }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>{pendingBillJobs.map(job => (
                    <tr key={job.job_id}>
                      <td style={{ padding: "10px", fontSize: 13, borderBottom: `1px solid ${C.border}`, fontFamily: "'Space Mono', monospace", color: C.accent }}>{job.job_id}</td>
                      <td style={{ padding: "10px", fontSize: 13, borderBottom: `1px solid ${C.border}` }}>{clientById[job.client_id]?.name}</td>
                      <td style={{ padding: "10px", fontSize: 12, borderBottom: `1px solid ${C.border}`, color: C.muted }}>{job.origin} → {job.destination} · {job.mode}</td>
                      <td style={{ padding: "10px", fontSize: 12, borderBottom: `1px solid ${C.border}`, fontFamily: "'Space Mono', monospace" }}>{job.job_date}</td>
                      <td style={{ padding: "10px", fontSize: 13, borderBottom: `1px solid ${C.border}`, textAlign: "right", fontFamily: "'Space Mono', monospace", fontWeight: 700 }}>₹{fmt(job.revenue)}</td>
                      <td style={{ padding: "10px", borderBottom: `1px solid ${C.border}`, textAlign: "right" }}>
                        <button style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${C.accent}`, background: "transparent", color: C.accent, cursor: "pointer", fontSize: 11, fontFamily: "inherit" }} onClick={() => issueJobInvoice(job)}>Issue invoice →</button>
                      </td>
                    </tr>
                  ))}</tbody>
                </table>
              )}
            </div>

            {billRegister.length > 0 && (
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20 }}>
                <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 14 }}>Issued invoices — this session</div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr>
                    {["Invoice ref", "Client", "Job", "Revenue", "GST (18%)", "Total", "Date"].map((h, i) => (
                      <th key={i} style={{ textAlign: i >= 3 ? "right" : "left", padding: "9px 10px", fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.6px", borderBottom: `1px solid ${C.border}` }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>{billRegister.map(b => (
                    <tr key={b.ref}>
                      <td style={{ padding: "10px", fontSize: 12, borderBottom: `1px solid ${C.border}`, fontFamily: "'Space Mono', monospace", color: C.accent }}>{b.ref}</td>
                      <td style={{ padding: "10px", fontSize: 13, borderBottom: `1px solid ${C.border}` }}>{b.clientName}</td>
                      <td style={{ padding: "10px", fontSize: 12, borderBottom: `1px solid ${C.border}`, fontFamily: "'Space Mono', monospace" }}>{b.job_id}</td>
                      <td style={{ padding: "10px", fontSize: 13, borderBottom: `1px solid ${C.border}`, textAlign: "right", fontFamily: "'Space Mono', monospace" }}>₹{fmt(b.revenue)}</td>
                      <td style={{ padding: "10px", fontSize: 13, borderBottom: `1px solid ${C.border}`, textAlign: "right", fontFamily: "'Space Mono', monospace", color: C.muted }}>₹{fmt(b.gst)}</td>
                      <td style={{ padding: "10px", fontSize: 13, borderBottom: `1px solid ${C.border}`, textAlign: "right", fontFamily: "'Space Mono', monospace", fontWeight: 700, color: C.green }}>₹{fmt(b.total)}</td>
                      <td style={{ padding: "10px", fontSize: 12, borderBottom: `1px solid ${C.border}`, fontFamily: "'Space Mono', monospace", color: C.muted }}>{b.date}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ── SETTLE — CFF fee collections ── */}
        {activeTab === "settle" && (
          <>
            <StageHeader
              title="Collections"
              stat={`₹${fmt(totalSettleOutstanding)} outstanding · ${SETTLE_OUTSTANDING.length} client${SETTLE_OUTSTANDING.length === 1 ? "" : "s"} · ₹${fmt(totalSettleCollected)} collected this session`}
            />

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 20 }}>
              {[
                ["CFF fees outstanding", `₹${fmt(totalSettleOutstanding)}`, totalSettleOutstanding > 0 ? C.red : C.green],
                ["Clients outstanding", SETTLE_OUTSTANDING.length, C.text],
                ["Claims filed (basis)", filingRegister.length, C.accent],
                ["Collected this session", `₹${fmt(totalSettleCollected)}`, C.green],
              ].map(([label, value, color]) => (
                <div key={label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px 20px" }}>
                  <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 8 }}>{label}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'Space Mono', monospace", color }}>{value}</div>
                </div>
              ))}
            </div>

            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20, marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 14 }}>Outstanding CFF fees — against filed drawback claims (18% of eligible)</div>
              {filingRegister.length === 0 && (
                <div style={{ border: `1px dashed ${C.border}`, borderRadius: 12, padding: 40, textAlign: "center", color: C.muted, fontSize: 14 }}>
                  No claims filed yet. File drawback claims from{" "}
                  <a href="#" onClick={e => { e.preventDefault(); setActiveTab("recover"); }} style={{ color: C.accent }}>Recover</a>{" "}
                  and the outstanding CFF fees land here for collection.
                </div>
              )}
              {filingRegister.length > 0 && SETTLE_OUTSTANDING.length === 0 && (
                <div style={{ color: C.green, fontSize: 13 }}>✓ All CFF fees collected from clients this session.</div>
              )}
              {SETTLE_OUTSTANDING.length > 0 && (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr>
                    {["Client", "Claims", "Eligible drawn", "CFF fee due (18%)", ""].map((h, i) => (
                      <th key={i} style={{ textAlign: i >= 1 && i <= 3 ? "right" : "left", padding: "9px 10px", fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.6px", borderBottom: `1px solid ${C.border}` }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>{SETTLE_OUTSTANDING.map(g => {
                    const totalEligible = g.entries.reduce((s, e) => s + (e.eligible_amount || 0), 0);
                    return (
                      <tr key={g.client_id}>
                        <td style={{ padding: "10px", fontSize: 14, borderBottom: `1px solid ${C.border}` }}>{g.clientName}</td>
                        <td style={{ padding: "10px", fontSize: 13, borderBottom: `1px solid ${C.border}`, textAlign: "right", fontFamily: "'Space Mono', monospace" }}>{g.entries.length}</td>
                        <td style={{ padding: "10px", fontSize: 13, borderBottom: `1px solid ${C.border}`, textAlign: "right", fontFamily: "'Space Mono', monospace" }}>₹{fmt(totalEligible)}</td>
                        <td style={{ padding: "10px", fontSize: 14, borderBottom: `1px solid ${C.border}`, textAlign: "right", fontFamily: "'Space Mono', monospace", fontWeight: 700 }}>₹{fmt(g.outstanding)}</td>
                        <td style={{ padding: "10px", borderBottom: `1px solid ${C.border}`, textAlign: "right" }}>
                          <button style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${C.accent}`, background: "transparent", color: C.accent, cursor: "pointer", fontSize: 11, fontFamily: "inherit" }} onClick={() => issueSettleReceipt(g)}>Record payment →</button>
                        </td>
                      </tr>
                    );
                  })}</tbody>
                </table>
              )}
            </div>

            {settlePayments.length > 0 && (
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20 }}>
                <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 14 }}>Recently settled — this session</div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr>
                    {["Client", "Amount collected", "Receipt · Date"].map((h, i) => (
                      <th key={i} style={{ textAlign: i === 1 ? "right" : "left", padding: "9px 10px", fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.6px", borderBottom: `1px solid ${C.border}` }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>{settlePayments.map(p => (
                    <tr key={p.ref}>
                      <td style={{ padding: "10px", fontSize: 14, borderBottom: `1px solid ${C.border}` }}>{p.clientName}</td>
                      <td style={{ padding: "10px", fontSize: 13, borderBottom: `1px solid ${C.border}`, textAlign: "right", fontFamily: "'Space Mono', monospace", color: C.green, fontWeight: 700 }}>₹{fmt(p.amount)}</td>
                      <td style={{ padding: "10px", fontSize: 12, borderBottom: `1px solid ${C.border}`, fontFamily: "'Space Mono', monospace" }}>{p.ref} · {p.date}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ── OPERATE — compliance check & pre-filing ── */}
        {activeTab === "operate" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            <StageHeader title="Compliance check" stat={`${amendCount} filings amended · ${examCount} examinations · Section 48 track`} />
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

          </div>
        )}
        {/* ── QUOTE — quoting intelligence ── */}
        {activeTab === "quote" && (
          <>
          <StageHeader title="Quoting intelligence" stat={`${pipelineArray.length} in pipeline`} />
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
          </>
        )}
        {activeTab === "schema" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {[
              { name: "CLIENTS", fields: ["client_id", "name", "industry", "country", "onboarded_year"], count: CLIENTS.length },
              { name: "JOBS", fields: ["job_id", "client_id", "mode", "origin", "destination", "trade_lane", "service", "job_date", "revenue ₹", "cost ₹", "status", "days_to_close"], count: JOBS.length },
              { name: "CUSTOMS_FILINGS", fields: ["filing_id", "job_id", "filing_type", "hs_code", "description", "cif_value ₹", "duty_amount ₹", "examination", "amendments", "days_to_clear"], count: CUSTOMS_FILINGS.length },
              { name: "WAREHOUSE", fields: ["record_id", "client_id", "commodity", "cbm", "entry_date", "exit_date", "charges ₹"], count: WAREHOUSE.length },
              { name: "DRAWBACK_RATES", fields: ["hs_chapter", "description", "rate_pct"], count: DRAWBACK_RATES.length },
              { name: "DRAWBACK_CLAIMS", fields: ["claim_id", "client_id", "import_filing", "export_filing", "hs_chapter", "eligible_amount ₹", "status", "identified_date"], count: DRAWBACK_CLAIMS.length },
              { name: "BASELINE_METRICS", fields: ["client_id", "quarter", "amendment_count", "examination_count", "filings"], count: BASELINE_METRICS.length },
              { name: "QUOTES", fields: ["quote_id", "client_id", "trade_lane", "origin", "destination", "mode", "commodity_type", "quoted_revenue ₹", "actual_cost ₹", "won"], count: QUOTES.length },
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
      </LifecycleShell>
    </div>
  );
}

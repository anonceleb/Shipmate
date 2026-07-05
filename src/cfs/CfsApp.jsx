import { useState, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ScatterChart, Scatter, ReferenceLine, LineChart, Line } from "recharts";
import { C, applyTheme } from "../data/constants.js";
import { SCHEMA_DESC_CFS, CFS_SAMPLE_QUESTIONS, TARIFF, BOOKING_SLA_DAYS } from "./constants.js";
import {
  fmt, TODAY, MANALI_CAPACITY, getComputations,
} from "./computations.js";
import { buildPrintableHtml } from "../core/artifacts.js";
import { useRegister } from "../core/register.js";
import { useClaudeQuery } from "../core/query.js";
import { LifecycleShell } from "../core/LifecycleShell.jsx";

const TERMINALS = [
  {
    abbr: "NXS",
    name: "NEXUS LOGISTICS & WAREHOUSING PVT LTD",
    label: "Northgate Container Terminal",
    address: `Container Freight Station · "Northgate Container Terminal" · No.126/A, Industrial Bypass Road, Chennai-600103`,
    color: "#1a9fd9",
    storageKey: "nexus_action_register",
  },
  {
    abbr: "BCT",
    name: "BALMER LAWRIE & CO LTD — CFS DIVISION",
    label: "Balmer Lawrie Container Terminal",
    address: `Container Freight Station · "Balmer Lawrie Container Terminal" · No.42, Maduravoyal Bypass Road, Chennai-600095`,
    color: "#16a34a",
    storageKey: "balmer_action_register",
  },
];

// ── shared style tokens ───────────────────────────────────────────────────────
const card = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20, marginBottom: 20 };
const TH = { textAlign: "left", padding: "9px 10px", fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.6px", borderBottom: `1px solid ${C.border}` };
const TD = { padding: "10px 10px", fontSize: 14, borderBottom: `1px solid ${C.border}` };
const mono = { fontFamily: "'Space Mono', monospace" };
const btn = { padding: "5px 12px", borderRadius: 6, border: `1px solid ${C.accent}`, background: "transparent", color: C.accent, cursor: "pointer", fontSize: 11, fontFamily: "inherit" };
const sectionTitle = { fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 10 };
const SLAB_COLORS = ["#22c55e","#84cc16","#eab308","#fb923c","#f97316","#ef4444","#dc2626","#b91c1c","#7f1d1d"];
const MARGIN_FLOOR = 35;

const StageHeader = ({ title, stat }) => (
  <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
    <h1 style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>{title}</h1>
    {stat && <span style={{ fontSize: 13, color: C.muted, fontFamily: "'Space Mono', monospace" }}>{stat}</span>}
  </div>
);

export default function CfsApp({ onSwitch }) {
  const [isLightMode, setIsLightMode] = useState(false);
  applyTheme(isLightMode);

  const [termIdx, setTermIdx] = useState(0);
  const terminal = TERMINALS[termIdx];

  // ── Rate card overrides (persisted per terminal) — must be before getComputations ──
  const [allRateOverrides, setAllRateOverrides] = useState(() => {
    try { return JSON.parse(localStorage.getItem("shipmate_rate_overrides") || "{}"); }
    catch { return {}; }
  });
  const rateOverrides = allRateOverrides[terminal.abbr] || {};

  const {
    LEDGER, LEAKS, TOTAL_LEAKAGE, YARD, YARD_ACCRUED, LONG_STAY,
    BY_CONSIGNEE, BY_CHA, BY_CLASS, BY_PORT, SLOT_ECONOMICS, MONTHLY_THROUGHPUT,
    TOTALS, BOOK_MATCHED, BOOK_PENDING, BOOK_STATS,
  } = getComputations(terminal.abbr, rateOverrides);

  const [stage, setStage] = useState("overview");
  const [toast, setToast] = useState(null);
  const [issued, setIssued] = useState({});
  const [detail, setDetail] = useState(null);
  const [printDoc, setPrintDoc] = useState(null);
  const [demandModal, setDemandModal] = useState(null);
  const [demandStep, setDemandStep] = useState("notice"); // "notice" | "credit"
  const [demandNoticeRef, setDemandNoticeRef] = useState(null);
  const [creditNoteAmount, setCreditNoteAmount] = useState("");
  const printDocRef = useRef(null);
  const setRateOverride = (key, val) => {
    const next = { ...allRateOverrides, [terminal.abbr]: { ...rateOverrides, [key]: val } };
    setAllRateOverrides(next);
    localStorage.setItem("shipmate_rate_overrides", JSON.stringify(next));
  };
  const resetRateOverrides = () => {
    const next = { ...allRateOverrides, [terminal.abbr]: {} };
    setAllRateOverrides(next);
    localStorage.setItem("shipmate_rate_overrides", JSON.stringify(next));
  };

  const [allRateEffDates, setAllRateEffDates] = useState(() => {
    try { return JSON.parse(localStorage.getItem("shipmate_rate_eff_dates") || "{}"); }
    catch { return {}; }
  });
  const rateEffDate = allRateEffDates[terminal.abbr] || "2024-06-01";
  const setRateEffDate = val => {
    const next = { ...allRateEffDates, [terminal.abbr]: val };
    setAllRateEffDates(next);
    localStorage.setItem("shipmate_rate_eff_dates", JSON.stringify(next));
  };

  const [editingCell, setEditingCell] = useState(null);
  const [editingVal, setEditingVal] = useState("");

  const rc = (rkey, fallback) => {
    const current = rateOverrides[rkey] !== undefined ? rateOverrides[rkey] : fallback;
    const isModified = rateOverrides[rkey] !== undefined;
    if (editingCell === rkey) return (
      <input
        value={editingVal}
        onChange={e => setEditingVal(e.target.value)}
        onBlur={() => { const n = Number(editingVal); if (!isNaN(n) && n >= 0) setRateOverride(rkey, n); setEditingCell(null); }}
        onKeyDown={e => { if (e.key === "Enter") e.target.blur(); if (e.key === "Escape") setEditingCell(null); }}
        autoFocus
        style={{ width: 80, fontFamily: "'Space Mono', monospace", fontSize: 12, background: C.card, color: C.accent, border: `1px solid ${C.accent}`, borderRadius: 4, padding: "2px 6px", textAlign: "right", outline: "none" }}
      />
    );
    return (
      <span
        onClick={() => { setEditingCell(rkey); setEditingVal(String(current)); }}
        title={isModified ? `Modified — published rate ₹${fmt(fallback)}` : "Click to edit"}
        style={{ ...mono, cursor: "pointer", color: isModified ? C.yellow : "inherit", fontSize: 12 }}
      >
        ₹{fmt(current)}
      </span>
    );
  };

  const makeRef = (n, { type }, abbr) =>
    `${abbr}/${type.split(" ")[0].toUpperCase()}/${String(n).padStart(4, "0")}`;

  const [reg0, push0, clear0, pushMany0] = useRegister("nexus_action_register",  (n, f) => makeRef(n, f, "NXS"));
  const [reg1, push1, clear1, pushMany1] = useRegister("balmer_action_register",   (n, f) => makeRef(n, f, "BCT"));
  const register      = termIdx === 0 ? reg0  : reg1;
  const pushToRegister = termIdx === 0 ? push0 : push1;
  const clearRegister  = termIdx === 0 ? clear0 : clear1;
  const pushManyToRegister = termIdx === 0 ? pushMany0 : pushMany1;

  const markIssued = id => setIssued(prev => ({ ...prev, [terminal.abbr + id]: true }));
  const isIssued = id => !!issued[terminal.abbr + id];

  const print = (title, bodyHtml, refNo) => {
    setPrintDoc({ title, html: buildPrintableHtml(terminal, title, bodyHtml, refNo) });
  };

  const buildSystem = () =>
    SCHEMA_DESC_CFS +
    `\nDATA (today=${TODAY}):\nLEDGER: ${JSON.stringify(
      LEDGER.map(l => ({
        id: l.container_id, no: l.container_no, size: l.size, port: l.port, cls: l.cargo_class,
        dir: l.direction, consignee: l.consignee, cha: l.cha, line: l.line,
        arrival: l.arrival_date, gate_out: l.gate_out, dwell: l.dwell, in_yard: l.in_yard,
        expected: l.expected, invoiced: l.invoiced, variance: l.variance, leak: l.leak_reason,
        cost: l.cost, margin: l.margin,
      }))
    )}\n` +
    `Respond ONLY with a valid JSON object, no markdown. Format:\n` +
    `{"sql":"SELECT ...","summary":"1-2 sentence answer with numbers","table":[{...}],"insight":"1 sentence recommendation"}\n` +
    `Table max 8 rows, human-readable columns, INR with ₹.`;

  const { question, setQuestion, loading, result, handleQuery } = useClaudeQuery(buildSystem);

  const showToast = m => { setToast(m); setTimeout(() => setToast(null), 4000); };

  const logAction = (type, party, container_no, amount) =>
    pushToRegister({ type, party, container_no, amount });

  // ── artifact actions ──────────────────────────────────────────────────────
  const issueDebitNote = (l, silent) => {
    const ref = logAction("Debit Note", l.consignee, l.container_no, -l.variance);
    markIssued(l.container_id);
    if (!silent) {
      print("Supplementary Debit Note", `
        <h2>Supplementary Debit Note</h2>
        <p>To: <b>${l.consignee}</b> (through CHA: ${l.cha})</p>
        <p>Re: Container <b>${l.container_no}</b> (${l.size}', ${l.cargo_class}, ex-${l.port}) — gate-in ${l.arrival_date}.</p>
        <p>On reconciliation of charges against our published tariff (effective 15-06-2023), the following shortfall was identified:</p>
        <table><tr><th>Particulars</th><th>Amount (₹)</th></tr>
        <tr><td>${l.leak_reason}</td><td>${fmt(-l.variance)}</td></tr>
        <tr><th>Total payable</th><th>₹${fmt(-l.variance)} + GST as applicable</th></tr></table>
        <p>Kindly arrange payment through your PD account within 7 days.</p>`, ref);
      showToast(`Debit note ${ref} generated & logged`);
    }
    return ref;
  };

  const issueAllDebitNotes = () => {
    const pending = LEAKS.filter(l => !isIssued(l.container_id));
    if (!pending.length) { showToast("All debit notes already issued"); return; }
    pushManyToRegister(pending.map(l => ({ type: "Debit Note", party: l.consignee, container_no: l.container_no, amount: -l.variance })));
    setIssued(prev => {
      const next = { ...prev };
      pending.forEach(l => { next[terminal.abbr + l.container_id] = true; });
      return next;
    });
    showToast(`${pending.length} debit notes generated & logged — ₹${fmt(pending.reduce((s, l) => s - l.variance, 0))} raised`);
  };

  const issueDemandNotice = l => {
    setDemandModal(l);
    setDemandStep("notice");
    setDemandNoticeRef(null);
    setCreditNoteAmount("");
  };

  const confirmDemandNotice = l => {
    const ref = logAction("Demand Notice", l.consignee, l.container_no, l.expected);
    print("Demand Notice", `
      <h2>Demand Notice — Accrued CFS Charges</h2>
      <p>To: <b>${l.consignee}</b> (through CHA: ${l.cha})</p>
      <p>Container <b>${l.container_no}</b> (${l.size}', ${l.commodity}) arrived at our CFS on ${l.arrival_date} and remains uncleared for <b>${l.dwell} days</b>.</p>
      <table><tr><th>Charge head</th><th>Amount (₹)</th></tr>
      ${l.billing_lines.map(b => `<tr><td>${b.label}</td><td>${fmt(b.amount)}</td></tr>`).join("")}
      <tr><th>Total accrued to date</th><th>₹${fmt(l.expected)} + GST</th></tr>
      </table>
      <p>Ground rent continues to accrue daily per the published slab. You are requested to clear the consignment and settle all dues within 7 days, failing which action under Section 48 of the Customs Act, 1962 (disposal of uncleared goods) will be initiated.</p>`, ref);
    setDemandNoticeRef(ref);
    setDemandStep("credit");
    showToast(`Demand notice ${ref} generated & logged`);
  };

  const issueCreditNote = (l, creditAmt, dnRef) => {
    const settlementAmt = l.expected - creditAmt;
    const ref = logAction("Credit Note", l.consignee, l.container_no, -creditAmt);
    print("Credit Note", `
      <h2>Credit Note</h2>
      <p>To: <b>${l.consignee}</b> (through CHA: ${l.cha})</p>
      <p>Container <b>${l.container_no}</b> (${l.size}', ${l.commodity})</p>
      <p>With reference to Demand Notice <b>${dnRef}</b> for accrued CFS charges of ₹${fmt(l.expected)}, and pursuant to commercial settlement negotiated at ₹${fmt(settlementAmt)}, we hereby issue this credit note for the agreed reduction:</p>
      <table>
        <tr><th>Particulars</th><th>Amount (₹)</th></tr>
        <tr><td>Accrued CFS charges per demand notice (${dnRef})</td><td>₹${fmt(l.expected)}</td></tr>
        <tr><td>Agreed settlement amount</td><td>₹${fmt(settlementAmt)}</td></tr>
        <tr><th>Credit note amount</th><th>₹${fmt(creditAmt)}</th></tr>
      </table>
      <p>This credit of ₹${fmt(creditAmt)} will be applied to the party's PD account within 3 working days. The net liability of ₹${fmt(settlementAmt)} + GST remains payable against the original demand notice.</p>`, ref);
    setDemandModal(null);
    showToast(`Credit note ${ref} generated & logged`);
  };

  const issueAuctionDocket = l => {
    const ref = logAction("Auction Docket", l.consignee, l.container_no, l.expected + TARIFF.auction.handling_per_box + TARIFF.auction.valuation_noc);
    print("Section 48 Auction Docket", `
      <h2>Auction Initiation Docket — Section 48, Customs Act 1962</h2>
      <p>Container <b>${l.container_no}</b> · Consignee: ${l.consignee} · CHA: ${l.cha} · Line: ${l.line}</p>
      <table>
      <tr><td>Arrival date</td><td>${l.arrival_date} (${l.dwell} days in yard)</td></tr>
      <tr><td>Cargo</td><td>${l.commodity}</td></tr>
      <tr><td>Accrued CFS dues</td><td>₹${fmt(l.expected)}</td></tr>
      <tr><td>Auction cargo handling</td><td>₹${fmt(TARIFF.auction.handling_per_box)}</td></tr>
      <tr><td>Valuation & NOC charges</td><td>₹${fmt(TARIFF.auction.valuation_noc)}</td></tr>
      </table>
      <p>Checklist: ☐ Final notice to consignee &nbsp; ☐ Shipping line NOC &nbsp; ☐ Customs NOC &nbsp; ☐ Valuation report &nbsp; ☐ e-auction listing</p>`, ref);
    showToast(`Auction docket ${ref} generated & logged`);
  };

  const issueMovementReminder = b => {
    const ref = logAction("Movement Reminder", b.consignee, b.container_no, 0);
    markIssued(b.booking_id);
    print("Movement Reminder", `
      <h2>Movement Reminder — Nominated Container Not Gated In</h2>
      <p>To: <b>${b.cha}</b> (CHA) &nbsp;·&nbsp; cc: ${b.line}</p>
      <p>Container <b>${b.container_no}</b> (${b.size}', ${b.commodity}) was nominated to our CFS per IGM <b>${b.igm_no}</b> (vessel ${b.vessel} / voy ${b.voyage}) on ${b.nomination_date} and has not yet gated in — <b>${b.daysPending} days</b> since nomination, against our ${BOOKING_SLA_DAYS}-day movement SLA.</p>
      <p>Consignee: ${b.consignee}</p>
      <p>Kindly arrange immediate movement of this container to avoid the nomination lapsing and being diverted to an alternate CFS, and to limit port demurrage exposure.</p>`, ref);
    showToast(`Movement reminder ${ref} generated & logged`);
  };

  const issueRepricingMemo = row => {
    const ref = logAction("Repricing Memo", row.key, "—", 0);
    print("Commercial Repricing Memo", `
      <h2>Repricing Memo — ${row.key}</h2>
      <p>Internal memo: account performance review based on activity-based costing.</p>
      <table><tr><th>Metric</th><th>Value</th></tr>
      <tr><td>Boxes handled</td><td>${row.boxes} (${row.teu} TEU)</td></tr>
      <tr><td>Revenue</td><td>₹${fmt(row.revenue)}</td></tr>
      <tr><td>Allocated cost</td><td>₹${fmt(row.cost)}</td></tr>
      <tr><td>Margin</td><td>₹${fmt(row.margin)} (${row.marginPct}%)</td></tr>
      <tr><td>Average dwell</td><td>${row.avgDwell} days</td></tr></table>
      <p>Recommendation: ${row.marginPct < MARGIN_FLOOR ? `renegotiate volume discount / apply surcharges on actuals — account margin is below the ${MARGIN_FLOOR}% contribution floor.` : "margin healthy; protect account with volume-discount renewal."}</p>`, ref);
    showToast(`Repricing memo ${ref} generated & logged`);
  };

  const yardUtilPct = Math.round((TOTALS.teu / MANALI_CAPACITY) * 100 * 12);

  const belowFloor = BY_CONSIGNEE.filter(r => r.marginPct < MARGIN_FLOOR);
  const sessionRecovered = register
    .filter(r => r.type === "Debit Note" || r.type === "Demand Notice")
    .reduce((s, r) => s + (r.amount || 0), 0);
  const nextEsc = YARD
    .filter(l => l.slabInfo && !l.slabInfo.isMaxSlab && l.slabInfo.daysUntilEscalation != null)
    .sort((a, b) => a.slabInfo.daysUntilEscalation - b.slabInfo.daysUntilEscalation)[0];

  // ── SETTLE — collections ledger, derived live from the persisted action register ──
  const RECEIVABLE_TYPES = new Set(["Debit Note", "Demand Notice", "Credit Note", "Auction Docket", "Payment Receipt"]);
  const receivablesByContainer = {};
  register.filter(r => RECEIVABLE_TYPES.has(r.type) && r.container_no && r.container_no !== "—").forEach(r => {
    if (!receivablesByContainer[r.container_no]) receivablesByContainer[r.container_no] = { container_no: r.container_no, party: r.party, entries: [], net: 0, earliestDate: r.date };
    const g = receivablesByContainer[r.container_no];
    g.entries.push(r);
    g.net += r.amount || 0;
    if (r.date < g.earliestDate) g.earliestDate = r.date;
  });
  const RECEIVABLES = Object.values(receivablesByContainer).map(g => ({
    ...g,
    ageDays: Math.max(0, Math.round((new Date(TODAY) - new Date(g.earliestDate)) / 86400000)),
  }));
  const OUTSTANDING = RECEIVABLES.filter(g => g.net > 0.5).sort((a, b) => b.ageDays - a.ageDays);
  const SETTLED = RECEIVABLES.filter(g => g.net <= 0.5 && g.entries.some(e => e.type === "Payment Receipt"));
  const totalOutstanding = OUTSTANDING.reduce((s, g) => s + g.net, 0);
  const sessionCollected = register.filter(r => r.type === "Payment Receipt").reduce((s, r) => s + Math.abs(r.amount || 0), 0);
  const oldestOutstandingAge = OUTSTANDING.length ? Math.max(...OUTSTANDING.map(g => g.ageDays)) : 0;

  const issuePaymentReceipt = g => {
    const ref = logAction("Payment Receipt", g.party, g.container_no, -g.net);
    print("Payment Receipt", `
      <h2>Payment Receipt</h2>
      <p>Received from: <b>${g.party}</b></p>
      <p>Container <b>${g.container_no}</b></p>
      <table><tr><th>Reference</th><th>Type</th><th>Amount (₹)</th></tr>
      ${g.entries.map(e => `<tr><td>${e.ref}</td><td>${e.type}</td><td>${fmt(e.amount)}</td></tr>`).join("")}
      <tr><th>Amount received</th><th>₹${fmt(g.net)}</th></tr></table>
      <p>This receipt confirms settlement of the outstanding balance referenced above against container ${g.container_no}.</p>`, ref);
    showToast(`Payment receipt ${ref} generated — ₹${fmt(g.net)} collected`);
  };

  const STAGES = [
    { id: "overview", label: "Overview", hint: "why this exists — three numbers", sub: "the business case" },
    { id: "quote",    label: "Quote",    hint: "commercial repricing — accounts below margin floor", sub: `${belowFloor.length} accts below floor` },
    { id: "book",     label: "Book",     hint: "advance nomination — IGM to gate-in", sub: `${BOOK_STATS.overdueCount} nominations overdue`, subColor: BOOK_STATS.overdueCount > 0 ? C.red : C.green },
    { id: "operate",  label: "Operate",  hint: "yard & dwell tracking", sub: `₹${fmt(YARD_ACCRUED)} accruing`, subColor: C.yellow },
    { id: "bill",     label: "Bill",     hint: "demand notices & long-stay escalation", sub: `${LONG_STAY.length} boxes past 30d` },
    { id: "recover",  label: "Recover",  hint: "tariff reconciliation & leakage recovery", sub: `₹${fmt(TOTAL_LEAKAGE)} found`, subColor: C.red },
    { id: "settle",   label: "Settle",   hint: "collections — outstanding balances against issued artifacts",
      sub: OUTSTANDING.length ? `₹${fmt(totalOutstanding)} outstanding` : "all settled",
      subColor: oldestOutstandingAge > 30 ? C.red : OUTSTANDING.length ? C.yellow : C.green },
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'DM Sans', sans-serif" }}>

      {toast && (
        <div style={{ position: "fixed", bottom: 28, right: 28, zIndex: 2000, background: C.green, color: "#000", padding: "14px 20px", borderRadius: 10, fontWeight: 600, fontSize: 13, maxWidth: 400 }}>✓ {toast}</div>
      )}

      {/* ── Printable document viewer (replaces window.open — works in preview) ── */}
      {printDoc && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 3000 }}>
          <div style={{ width: "100%", maxWidth: 860, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 8px 10px" }}>
            <span style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>{printDoc.title}</span>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => printDocRef.current?.contentWindow?.print()} style={{ ...btn, borderColor: C.accent, color: C.accent }}>Print / Save PDF</button>
              <button onClick={() => setPrintDoc(null)} style={{ ...btn, borderColor: C.border, color: C.muted }}>Close</button>
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

      {/* ── Demand notice / credit note modal (two-step) ── */}
      {demandModal && (
        <div onClick={() => setDemandModal(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.card, borderRadius: 12, padding: 28, width: 560, maxHeight: "88vh", overflowY: "auto", border: `1px solid ${C.border}` }}>

            {/* step indicator */}
            <div style={{ display: "flex", gap: 0, marginBottom: 22, borderRadius: 8, overflow: "hidden", border: `1px solid ${C.border}` }}>
              {[["1", "Demand Notice"], ["2", "Credit Note"]].map(([n, label], i) => {
                const active = (i === 0 && demandStep === "notice") || (i === 1 && demandStep === "credit");
                const done = i === 0 && demandStep === "credit";
                return (
                  <div key={n} style={{ flex: 1, padding: "8px 14px", background: active ? C.accent + "22" : done ? C.surface : "transparent", borderRight: i === 0 ? `1px solid ${C.border}` : "none", display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 20, height: 20, borderRadius: "50%", background: done ? C.green : active ? C.accent : C.border, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: done || active ? "#000" : C.muted, flexShrink: 0 }}>
                      {done ? "✓" : n}
                    </div>
                    <span style={{ fontSize: 12, color: active ? C.accent : done ? C.green : C.muted, fontWeight: active ? 600 : 400 }}>{label}</span>
                    {i === 0 && demandStep === "credit" && <span style={{ fontSize: 11, color: C.green, ...mono, marginLeft: "auto" }}>{demandNoticeRef}</span>}
                  </div>
                );
              })}
            </div>

            <div style={{ fontSize: 13, color: C.muted, marginBottom: 16, ...mono }}>
              {demandModal.container_no} · {demandModal.consignee} · {demandModal.size}' · {demandModal.dwell}d in yard
            </div>

            {/* ── STEP 1: issue demand notice for full accrued amount ── */}
            {demandStep === "notice" && <>
              <div style={sectionTitle}>Accrued charges — full amount to be notified</div>
              {demandModal.billing_lines.map((b, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "5px 0", borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ color: C.muted }}>{b.label}</span>
                  <span style={mono}>₹{fmt(b.amount)}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, padding: "10px 0", color: C.accent, marginBottom: 8 }}>
                <span>Total accrued</span><span style={mono}>₹{fmt(demandModal.expected)}</span>
              </div>
              <div style={{ fontSize: 12, color: C.muted, background: C.surface, borderRadius: 6, padding: "10px 14px", marginBottom: 20 }}>
                The demand notice will be issued for the <b style={{ color: C.text }}>full accrued amount of ₹{fmt(demandModal.expected)}</b>. If a negotiated settlement is agreed, issue a separate credit note in Step 2.
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button style={{ ...btn, borderColor: C.border, color: C.muted }} onClick={() => setDemandModal(null)}>Cancel</button>
                <button style={{ ...btn, background: C.accent + "22", color: C.accent, borderColor: C.accent }}
                  onClick={() => confirmDemandNotice(demandModal)}>
                  Issue demand notice ₹{fmt(demandModal.expected)} →
                </button>
              </div>
            </>}

            {/* ── STEP 2: optional credit note for negotiated reduction ── */}
            {demandStep === "credit" && <>
              <div style={{ background: C.surface, borderRadius: 8, padding: "10px 14px", marginBottom: 20, fontSize: 13 }}>
                <span style={{ color: C.green }}>✓</span> Demand notice <span style={{ ...mono, color: C.accent }}>{demandNoticeRef}</span> issued for <b>₹{fmt(demandModal.expected)}</b>.
              </div>
              <div style={sectionTitle}>Issue credit note for negotiated reduction (optional)</div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>
                If the consignee agreed to pay a lower amount, enter the <b style={{ color: C.text }}>reduction</b> (not the settlement amount). The credit note references the demand notice above.
              </div>
              <div style={{ background: C.surface, borderRadius: 8, padding: 16, marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 10 }}>Credit note amount (reduction)</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 15, color: C.muted, ...mono }}>₹</span>
                  <input
                    type="number"
                    value={creditNoteAmount}
                    onChange={e => setCreditNoteAmount(e.target.value)}
                    placeholder="e.g. 200"
                    style={{ flex: 1, padding: "10px 12px", borderRadius: 6, border: `1px solid ${Number(creditNoteAmount) > demandModal.expected ? C.red : C.border}`, background: C.card, color: C.text, fontSize: 15, fontFamily: "'Space Mono', monospace", outline: "none" }}
                  />
                </div>
                {creditNoteAmount > 0 && Number(creditNoteAmount) < demandModal.expected && (
                  <div style={{ marginTop: 10, fontSize: 12, display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: C.muted }}>Demand notice total</span><span style={mono}>₹{fmt(demandModal.expected)}</span>
                  </div>
                )}
                {creditNoteAmount > 0 && Number(creditNoteAmount) < demandModal.expected && (
                  <div style={{ fontSize: 12, display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                    <span style={{ color: C.muted }}>Credit note (reduction)</span><span style={{ ...mono, color: C.yellow }}>− ₹{fmt(Number(creditNoteAmount))}</span>
                  </div>
                )}
                {creditNoteAmount > 0 && Number(creditNoteAmount) < demandModal.expected && (
                  <div style={{ fontSize: 13, fontWeight: 700, display: "flex", justifyContent: "space-between", marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.border}`, color: C.accent }}>
                    <span>Net payable by consignee</span><span style={mono}>₹{fmt(demandModal.expected - Number(creditNoteAmount))}</span>
                  </div>
                )}
                {Number(creditNoteAmount) > demandModal.expected && (
                  <div style={{ marginTop: 8, fontSize: 12, color: C.red }}>Reduction cannot exceed total accrued.</div>
                )}
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
                <button style={{ ...btn, borderColor: C.border, color: C.muted }} onClick={() => setDemandModal(null)}>Close (no credit note)</button>
                <button
                  disabled={!creditNoteAmount || Number(creditNoteAmount) <= 0 || Number(creditNoteAmount) > demandModal.expected}
                  style={{ ...btn, background: creditNoteAmount && Number(creditNoteAmount) > 0 && Number(creditNoteAmount) <= demandModal.expected ? C.yellow + "22" : "transparent", color: creditNoteAmount && Number(creditNoteAmount) > 0 && Number(creditNoteAmount) <= demandModal.expected ? C.yellow : C.muted, borderColor: creditNoteAmount && Number(creditNoteAmount) > 0 && Number(creditNoteAmount) <= demandModal.expected ? C.yellow : C.border }}
                  onClick={() => issueCreditNote(demandModal, Number(creditNoteAmount), demandNoticeRef)}
                >
                  Issue credit note ₹{creditNoteAmount ? fmt(Number(creditNoteAmount)) : "—"} →
                </button>
              </div>
            </>}
          </div>
        </div>
      )}

      {detail && (
        <div onClick={() => setDetail(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.card, borderRadius: 12, padding: 28, width: 640, maxHeight: "85vh", overflowY: "auto", border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 17, fontWeight: 600 }}>{detail.container_no} <span style={{ color: C.muted, fontSize: 13 }}>· {detail.size}' {detail.cargo_class} · {detail.consignee}</span></div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 18, ...mono }}>ex-{detail.port} · arrived {detail.arrival_date} · dwell {detail.dwell}d {detail.in_yard ? "· IN YARD" : `· gated out ${detail.gate_out}`}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <div>
                <div style={sectionTitle}>
                  {detail.stale_rate_card ? "Charges per current published tariff (Jun 2024)" : "Charges per published tariff"}
                </div>
                {detail.billing_lines.map((b, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0", borderBottom: `1px solid ${C.border}` }}>
                    <span style={{ color: C.muted }}>{b.label}</span><span style={mono}>₹{fmt(b.amount)}</span>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, padding: "8px 0", color: C.accent }}>
                  <span>Expected (current rates)</span><span style={mono}>₹{fmt(detail.expected)}</span>
                </div>

                {detail.stale_rate_card && detail.invoiced_lines ? (
                  <>
                    <div style={{ fontSize: 11, color: C.yellow, textTransform: "uppercase", letterSpacing: "0.6px", marginTop: 14, marginBottom: 6 }}>
                      Billing system applied — 2023 rate card
                    </div>
                    {detail.invoiced_lines.map((b, i) => {
                      const expLine = detail.billing_lines.find(l => l.label === b.label);
                      const isDiff = expLine && expLine.amount !== b.amount;
                      return (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0", borderBottom: `1px solid ${C.border}`, background: isDiff ? C.red + "18" : "transparent" }}>
                          <span style={{ color: isDiff ? C.red : C.muted }}>{b.label}</span>
                          <span style={mono}>
                            ₹{fmt(b.amount)}
                            {isDiff && <span style={{ color: C.red, marginLeft: 8, fontSize: 11 }}>↓ from ₹{fmt(expLine.amount)}</span>}
                          </span>
                        </div>
                      );
                    })}
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 12 }}>
                      <span style={{ color: C.muted }}>Invoiced (2023 rate card)</span><span style={mono}>₹{fmt(detail.invoiced)}</span>
                    </div>
                    <div style={{ marginTop: 4, padding: "8px 10px", background: C.red + "18", borderRadius: 6, fontSize: 12, color: C.red }}>
                      Shortfall ₹{fmt(-detail.variance)} — rate card not updated after Jun 2024 revision
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                      <span style={{ color: C.muted }}>Invoiced (billing system)</span><span style={mono}>₹{fmt(detail.invoiced)}</span>
                    </div>
                    {detail.variance < 0 && <div style={{ marginTop: 8, fontSize: 12, color: C.red }}>Leakage ₹{fmt(-detail.variance)} — {detail.leak_reason}</div>}
                  </>
                )}
              </div>
              <div>
                <div style={sectionTitle}>Allocated cost (activity-based)</div>
                {detail.cost_lines.map((b, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0", borderBottom: `1px solid ${C.border}` }}>
                    <span style={{ color: C.muted }}>{b.label}</span><span style={mono}>₹{fmt(b.amount)}</span>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, padding: "8px 0" }}>
                  <span>Cost</span><span style={mono}>₹{fmt(detail.cost)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, color: detail.margin >= 0 ? C.green : C.red }}>
                  <span>Margin</span><span style={mono}>₹{fmt(detail.margin)}</span>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
              <button onClick={() => setDetail(null)} style={{ ...btn, borderColor: C.border, color: C.muted }}>Close</button>
            </div>
          </div>
        </div>
      )}

      <LifecycleShell
        brand={{ abbr: terminal.abbr, name: `Nexus CFS Intelligence — ${terminal.label}`, subtitle: "OVERLAY ON EXISTING YARD & BILLING SYSTEMS · DEMO · SYNTHETIC DATA", color: terminal.color }}
        stages={STAGES}
        rails={[
          { id: "intelligence",  label: "Intelligence" },
          { id: "profitability", label: "Profitability" },
          { id: "ratecard",      label: "Rate Card" },
          { id: "register",      label: `Register · ${register.length} artifact${register.length === 1 ? "" : "s"}` },
        ]}
        active={stage}
        onSelect={setStage}
        onGapClick={() => showToast("Roadmap stage — part of the full lifecycle story")}
        headerExtra={
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.6px" }}>Terminal</span>
              <div style={{ display: "flex", gap: 4 }}>
                {TERMINALS.map((t, i) => (
                  <button key={i} onClick={() => setTermIdx(i)} title={t.label} style={{
                    padding: "6px 12px", borderRadius: 7, fontSize: 12, cursor: "pointer", fontFamily: "inherit",
                    border: `1px solid ${i === termIdx ? t.color : C.border}`,
                    background: i === termIdx ? t.color + "22" : "transparent",
                    color: i === termIdx ? t.color : C.muted,
                  }}>
                    {t.label.split(" ")[0]}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ textAlign: "right", borderLeft: `1px solid ${C.border}`, paddingLeft: 20 }}>
              <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.8px" }}>Recovered this session</div>
              <div style={{ fontSize: 20, fontWeight: 700, ...mono, color: C.green }}>₹{fmt(sessionRecovered)}</div>
            </div>
            <button onClick={onSwitch} style={{ padding: "6px 12px", borderRadius: 6, border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
              ⇄ Switch demo
            </button>
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
        {stage === "overview" && (() => {
          const leakPct = ((TOTAL_LEAKAGE / TOTALS.revenue) * 100).toFixed(1);
          const leakAnnual = Math.round((TOTAL_LEAKAGE / TOTALS.teu) * MANALI_CAPACITY);
          return (
            <>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 22 }}>
                <div style={{ fontSize: 13, color: C.muted }}>{TOTALS.boxes} boxes reconciled against published tariff · as of {TODAY}</div>
                <div style={{ fontSize: 11, color: C.muted, ...mono }}>OVERLAY ON EXISTING YARD &amp; BILLING SYSTEMS · SYNTHETIC DATA</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 18, marginBottom: 36 }}>
                <div style={{ background: C.card, border: `1px solid ${C.red}`, borderRadius: 14, padding: 26 }}>
                  <div style={{ fontSize: 11, color: C.red, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 14, ...mono }}>Revenue leakage</div>
                  <div style={{ fontSize: 34, fontWeight: 700, ...mono, color: C.red }}>₹{fmt(TOTAL_LEAKAGE)}</div>
                  <div style={{ fontSize: 13, color: C.muted, marginTop: 8, lineHeight: 1.6 }}>{LEAKS.length} of {TOTALS.boxes} boxes · {leakPct}% of revenue · ≈₹{fmt(leakAnnual)}/yr at {fmt(MANALI_CAPACITY)} TEU</div>
                  <button onClick={() => setStage("recover")} style={{ marginTop: 18, padding: "9px 16px", borderRadius: 8, border: `1px solid ${C.red}`, background: "transparent", color: C.red, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit" }}>Recover it →</button>
                </div>
                <div style={{ background: C.card, border: `1px solid ${C.yellow}`, borderRadius: 14, padding: 26 }}>
                  <div style={{ fontSize: 11, color: C.yellow, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 14, ...mono }}>Accruing in yard now</div>
                  <div style={{ fontSize: 34, fontWeight: 700, ...mono, color: C.yellow }}>₹{fmt(YARD_ACCRUED)}</div>
                  <div style={{ fontSize: 13, color: C.muted, marginTop: 8, lineHeight: 1.6 }}>{YARD.length} in yard · {LONG_STAY.length} past 30d · {nextEsc ? `next escalation in ${nextEsc.slabInfo.daysUntilEscalation}d` : "no escalations pending"}</div>
                  <button onClick={() => setStage("operate")} style={{ marginTop: 18, padding: "9px 16px", borderRadius: 8, border: `1px solid ${C.yellow}`, background: "transparent", color: C.yellow, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit" }}>Manage dwell →</button>
                </div>
                <div style={{ background: C.card, border: `1px solid ${C.accent}`, borderRadius: 14, padding: 26 }}>
                  <div style={{ fontSize: 11, color: C.accent, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 14, ...mono }}>Accounts below floor</div>
                  <div style={{ fontSize: 34, fontWeight: 700, ...mono, color: C.accent }}>{belowFloor.length} <span style={{ fontSize: 16, color: C.muted, fontWeight: 400 }}>accounts</span></div>
                  <div style={{ fontSize: 13, color: C.muted, marginTop: 8, lineHeight: 1.6 }}>under {MARGIN_FLOOR}% contribution after activity-based cost allocation</div>
                  <button onClick={() => setStage("quote")} style={{ marginTop: 18, padding: "9px 16px", borderRadius: 8, border: `1px solid ${C.accent}`, background: "transparent", color: C.accent, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit" }}>Reprice →</button>
                </div>
              </div>
              <div style={{ display: "flex", gap: 28, flexWrap: "wrap", borderTop: `1px solid ${C.border}`, paddingTop: 18, fontSize: 13, color: C.muted, ...mono }}>
                <span>{TOTALS.teu} TEU · 11 mo</span>
                <span>₹{fmt(TOTALS.revenue)} invoiced</span>
                <span>₹{fmt(TOTALS.margin)} margin</span>
              </div>
            </>
          );
        })()}

        {/* ── QUOTE — commercial repricing ── */}
        {stage === "quote" && (
          <>
            <StageHeader title="Repricing review" stat={`${belowFloor.length} of ${BY_CONSIGNEE.length} accounts below ${MARGIN_FLOOR}% floor`} />
            <div style={card}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr>
                  <th style={TH}>Consignee</th>
                  <th style={{ ...TH, textAlign: "right" }}>Boxes</th>
                  <th style={{ ...TH, textAlign: "right" }}>Revenue</th>
                  <th style={{ ...TH, textAlign: "right" }}>Cost</th>
                  <th style={{ ...TH, textAlign: "right" }}>Margin %</th>
                  <th style={{ ...TH, textAlign: "right" }}>Avg dwell</th>
                  <th style={TH}></th>
                </tr></thead>
                <tbody>{BY_CONSIGNEE.map(r => (
                  <tr key={r.key}>
                    <td style={TD}>{r.key}</td>
                    <td style={{ ...TD, ...mono, textAlign: "right" }}>{r.boxes}</td>
                    <td style={{ ...TD, ...mono, textAlign: "right" }}>₹{fmt(r.revenue)}</td>
                    <td style={{ ...TD, ...mono, textAlign: "right" }}>₹{fmt(r.cost)}</td>
                    <td style={{ ...TD, ...mono, textAlign: "right", color: r.marginPct < MARGIN_FLOOR ? C.red : C.green, fontWeight: r.marginPct < MARGIN_FLOOR ? 700 : 400 }}>{r.marginPct}%</td>
                    <td style={{ ...TD, ...mono, textAlign: "right" }}>{r.avgDwell}d</td>
                    <td style={{ ...TD, textAlign: "right" }}>
                      {r.marginPct < MARGIN_FLOOR && <button style={btn} onClick={() => issueRepricingMemo(r)}>Repricing memo →</button>}
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </>
        )}

        {/* ── BOOK — advance nomination / gate-in reconciliation ── */}
        {stage === "book" && (
          <>
            <StageHeader
              title="Nomination & gate-in pipeline"
              stat={`${BOOK_STATS.conversionPct}% nominated boxes gated in · ${BOOK_STATS.overdueCount} overdue · avg lead time ${BOOK_STATS.avgLeadTime}d`}
            />

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 20 }}>
              {[
                ["Nominated (IGM)", BOOK_STATS.nominatedCount, C.text],
                ["Gate-in conversion", `${BOOK_STATS.conversionPct}%`, C.accent],
                ["Avg nomination → gate-in", `${BOOK_STATS.avgLeadTime}d`, C.text],
                ["Overdue · at risk", `${BOOK_STATS.overdueCount} · ${fmt(BOOK_STATS.teuAtRisk)} TEU`, BOOK_STATS.overdueCount > 0 ? C.red : C.green],
              ].map(([label, value, color]) => (
                <div key={label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px 20px" }}>
                  <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 8 }}>{label}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, ...mono, color }}>{value}</div>
                </div>
              ))}
            </div>

            <div style={card}>
              <div style={sectionTitle}>Pending nominations — not yet gated in ({BOOKING_SLA_DAYS}-day movement SLA)</div>
              {BOOK_PENDING.length === 0 && <div style={{ color: C.muted, fontSize: 13 }}>No pending nominations. Everything nominated to us has gated in.</div>}
              {BOOK_PENDING.length > 0 && (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr>
                    <th style={TH}>IGM / Booking</th><th style={TH}>Container</th><th style={TH}>Line / Vessel</th>
                    <th style={TH}>Consignee (CHA)</th><th style={TH}>Nominated</th>
                    <th style={{ ...TH, textAlign: "right" }}>Days pending</th><th style={TH}></th>
                  </tr></thead>
                  <tbody>{BOOK_PENDING.map(b => {
                    const bIssued = isIssued(b.booking_id);
                    return (
                      <tr key={b.booking_id}>
                        <td style={{ ...TD, fontSize: 12 }}>{b.igm_no}</td>
                        <td style={{ ...TD, ...mono }}>{b.container_no} <span style={{ color: C.muted }}>({b.size}')</span></td>
                        <td style={{ ...TD, fontSize: 12 }}>{b.line}<div style={{ fontSize: 11, color: C.muted }}>{b.vessel} / {b.voyage}</div></td>
                        <td style={TD}>{b.consignee}<div style={{ fontSize: 11, color: C.muted }}>{b.cha}</div></td>
                        <td style={{ ...TD, ...mono, fontSize: 12 }}>{b.nomination_date}</td>
                        <td style={{ ...TD, ...mono, textAlign: "right", fontWeight: 700, color: b.overdue ? C.red : C.muted }}>{b.daysPending}d</td>
                        <td style={{ ...TD, textAlign: "right" }}>
                          {bIssued
                            ? <span style={{ fontSize: 12, color: C.green }}>✓ Sent</span>
                            : b.overdue && <button style={btn} onClick={() => issueMovementReminder(b)}>Movement reminder →</button>}
                        </td>
                      </tr>
                    );
                  })}</tbody>
                </table>
              )}
              {BOOK_STATS.overdueCount > 0 && (
                <div style={{ marginTop: 14, fontSize: 12, color: C.red }}>
                  ₹{fmt(BOOK_STATS.revenueAtRisk)} of estimated revenue at risk if these {BOOK_STATS.teuAtRisk} TEU divert to another CFS.
                </div>
              )}
            </div>

            <div style={card}>
              <div style={sectionTitle}>Recent gate-in confirmations — nomination lead time</div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr>
                  <th style={TH}>Container</th><th style={TH}>Consignee / CHA</th><th style={TH}>Line</th>
                  <th style={TH}>Nominated</th><th style={TH}>Gated in</th><th style={{ ...TH, textAlign: "right" }}>Lead time</th>
                </tr></thead>
                <tbody>{BOOK_MATCHED.map(b => (
                  <tr key={b.container_id}>
                    <td style={{ ...TD, ...mono }}>{b.container_no} <span style={{ color: C.muted }}>({b.size}')</span></td>
                    <td style={TD}>{b.consignee}<div style={{ fontSize: 11, color: C.muted }}>{b.cha}</div></td>
                    <td style={{ ...TD, fontSize: 12 }}>{b.line}</td>
                    <td style={{ ...TD, ...mono, fontSize: 12 }}>{b.nomination_date}</td>
                    <td style={{ ...TD, ...mono, fontSize: 12 }}>{b.gate_in_date}</td>
                    <td style={{ ...TD, ...mono, textAlign: "right" }}>{b.leadDays}d</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </>
        )}

        {/* ── OPERATE — yard & dwell ── */}
        {stage === "operate" && (
          <>
            <StageHeader
              title="Yard & dwell"
              stat={`${YARD.length} in yard · ₹${fmt(YARD_ACCRUED)} accrued` + (nextEsc ? ` · next escalation ${nextEsc.slabInfo.daysUntilEscalation}d (${nextEsc.container_no})` : "")}
            />

            {/* Slab timeline (gantt) */}
            {(() => {
              const maxDays = Math.max(...YARD.map(l => l.dwell)) + 14;
              const pct = d => `${(d / maxDays * 100).toFixed(2)}%`;
              return (
                <div style={card}>
                  <div style={sectionTitle}>Slab timeline — colour = tariff slab · white tick = next escalation</div>
                  {/* Day markers */}
                  <div style={{ position: "relative", height: 18, marginLeft: 188, marginRight: 50, marginBottom: 6 }}>
                    {TARIFF.holding_import.slice(1).map(s => s.from <= maxDays && (
                      <div key={s.from} style={{ position: "absolute", left: pct(s.from), transform: "translateX(-50%)", fontSize: 9, color: C.muted }}>d{s.from}</div>
                    ))}
                    <div style={{ position: "absolute", right: 0, fontSize: 9, color: C.accent }}>TODAY</div>
                  </div>
                  {[...YARD].sort((a, b) => b.dwell - a.dwell).map(l => {
                    const segments = [];
                    for (let i = 0; i < TARIFF.holding_import.length; i++) {
                      const slab = TARIFF.holding_import[i];
                      if (l.dwell < slab.from) break;
                      const segEnd = Math.min(slab.to === 9999 ? l.dwell : slab.to, l.dwell);
                      const days = segEnd - slab.from + 1;
                      if (days > 0) segments.push({ days, color: SLAB_COLORS[i] });
                    }
                    const si = l.slabInfo;
                    return (
                      <div key={l.container_id} style={{ display: "flex", alignItems: "center", marginBottom: 7 }}>
                        <div style={{ width: 186, flexShrink: 0, paddingRight: 8 }}>
                          <div style={{ fontSize: 11, ...mono, color: C.accent, lineHeight: 1.3 }}>{l.container_no}</div>
                          <div style={{ fontSize: 10, color: C.muted }}>{l.consignee.split(' ').slice(0, 2).join(' ')}</div>
                        </div>
                        <div style={{ flex: 1, position: "relative", marginRight: 8 }}>
                          {/* Slab boundary guides */}
                          {TARIFF.holding_import.slice(1).map(s => s.from <= maxDays && (
                            <div key={s.from} style={{ position: "absolute", left: pct(s.from), top: -1, bottom: -1, width: 1, background: "rgba(255,255,255,0.08)", zIndex: 1, pointerEvents: "none" }} />
                          ))}
                          {/* Bar */}
                          <div style={{ width: "100%", height: 16, background: C.surface, borderRadius: 3, overflow: "hidden", display: "flex" }}>
                            {segments.map((seg, j) => (
                              <div key={j} style={{ width: pct(seg.days), height: "100%", background: seg.color, opacity: 0.88, flexShrink: 0,
                                borderRadius: j === 0 ? "3px 0 0 3px" : j === segments.length - 1 && !si?.daysUntilEscalation ? "0 3px 3px 0" : 0 }} />
                            ))}
                          </div>
                          {/* Next escalation tick */}
                          {si && !si.isMaxSlab && si.daysUntilEscalation != null && (
                            <div style={{ position: "absolute", left: pct(l.dwell + si.daysUntilEscalation), top: -3, bottom: -3, width: 2, background: "#fff", borderRadius: 1, zIndex: 2, opacity: 0.9 }} />
                          )}
                        </div>
                        <div style={{ width: 42, textAlign: "right", fontSize: 11, ...mono, color: l.dwell > 30 ? C.red : l.dwell > 15 ? C.yellow : C.muted, flexShrink: 0 }}>
                          {l.dwell}d
                        </div>
                      </div>
                    );
                  })}
                  <div style={{ display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
                    {["Free (0–3)","Slab 1","Slab 2","Slab 3","Slab 4","Slab 5","Slab 6","Slab 7","Max (91+)"].map((label, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: C.muted }}>
                        <div style={{ width: 12, height: 12, borderRadius: 2, background: SLAB_COLORS[i] }} />
                        {label}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Yard table */}
            <div style={card}>
              <div style={sectionTitle}>Containers in yard — ground rent accruing daily (as of {TODAY})</div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr>
                  <th style={TH}>Container</th><th style={TH}>Consignee / CHA</th><th style={TH}>Cargo</th>
                  <th style={{ ...TH, textAlign: "right" }}>Dwell</th><th style={TH}>Next escalation</th>
                  <th style={{ ...TH, textAlign: "right" }}>Accrued</th><th style={TH}></th>
                </tr></thead>
                <tbody>{YARD.map(l => {
                  const si = l.slabInfo;
                  const escColor = si && (si.isMaxSlab || si.daysUntilEscalation <= 2) ? C.red : si && si.daysUntilEscalation <= 5 ? C.yellow : C.muted;
                  const escLabel = si?.isMaxSlab
                    ? "Max slab"
                    : si?.daysUntilEscalation === 1
                    ? `Tomorrow → ₹${fmt(si.nextRate)}/d`
                    : si?.daysUntilEscalation != null
                    ? `${si.daysUntilEscalation} days → ₹${fmt(si.nextRate)}/d`
                    : "—";
                  return (
                    <tr key={l.container_id}>
                      <td style={{ ...TD, ...mono, cursor: "pointer", color: C.accent }} onClick={() => setDetail(l)}>{l.container_no} <span style={{ color: C.muted }}>({l.size}')</span></td>
                      <td style={TD}>{l.consignee}<div style={{ fontSize: 11, color: C.muted }}>{l.cha}</div></td>
                      <td style={{ ...TD, fontSize: 12 }}>{l.commodity}</td>
                      <td style={{ ...TD, ...mono, textAlign: "right", fontWeight: 700, color: l.dwell > 30 ? C.red : l.dwell > 15 ? C.yellow : C.green }}>{l.dwell}d</td>
                      <td style={{ ...TD, fontSize: 13, color: escColor }}>{escLabel}</td>
                      <td style={{ ...TD, ...mono, textAlign: "right" }}>₹{fmt(l.expected)}</td>
                      <td style={{ ...TD, textAlign: "right" }}>
                        {l.dwell > 3 && <button style={btn} onClick={() => issueDemandNotice(l)}>Demand notice →</button>}
                      </td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          </>
        )}

        {/* ── BILL — demand notices & long-stay escalation ── */}
        {stage === "bill" && (() => {
          const longStayAccrued = LONG_STAY.reduce((s, l) => s + l.expected, 0);
          return (
            <>
              <StageHeader title="Long-stay escalation" stat={`${LONG_STAY.length} past 30d · ₹${fmt(longStayAccrued)} accrued · Section 48 track`} />
              {LONG_STAY.length === 0 && <div style={{ color: C.muted }}>No boxes over 30 days. Clean yard.</div>}
              {LONG_STAY.map(l => {
                const auctionCosts = TARIFF.auction.handling_per_box + TARIFF.auction.valuation_noc;
                return (
                  <div key={l.container_id} style={{ background: C.card, border: `1px solid ${l.dwell > 90 ? C.red : C.border}`, borderRadius: 12, padding: 22, marginBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, alignItems: "baseline" }}>
                      <div>
                        <span style={{ ...mono, color: C.accent, cursor: "pointer", fontSize: 16 }} onClick={() => setDetail(l)}>{l.container_no}</span>
                        <span style={{ color: C.muted, fontSize: 13 }}> · {l.size}' · {l.commodity} · {l.consignee} ({l.cha})</span>
                      </div>
                      <div style={{ ...mono, fontWeight: 700, fontSize: 18, color: l.dwell > 90 ? C.red : C.yellow }}>{l.dwell} days</div>
                    </div>
                    <div style={{ display: "flex", gap: 28, marginTop: 12, fontSize: 13, flexWrap: "wrap" }}>
                      <span>Accrued dues: <b style={{ ...mono, fontSize: 15 }}>₹{fmt(l.expected)}</b></span>
                      <span style={{ color: C.muted }}>Auction-track costs: ₹{fmt(auctionCosts)}</span>
                      <span style={{ color: C.muted }}>Slot blocked: {l.dwell} days × {l.teu} TEU</span>
                    </div>
                    <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                      <button style={{ padding: "8px 15px", borderRadius: 8, border: `1px solid ${C.accent}`, background: "transparent", color: C.accent, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit" }} onClick={() => issueDemandNotice(l)}>Final demand notice →</button>
                      {l.dwell > 60 && <button style={{ padding: "8px 15px", borderRadius: 8, border: `1px solid ${C.red}`, background: "transparent", color: C.red, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit" }} onClick={() => issueAuctionDocket(l)}>Section 48 auction docket →</button>}
                    </div>
                  </div>
                );
              })}
            </>
          );
        })()}

        {/* ── RECOVER — tariff reconciliation & leakage ── */}
        {stage === "recover" && (() => {
          const leakPct = ((TOTAL_LEAKAGE / TOTALS.revenue) * 100).toFixed(1);
          const pendingLeaks = LEAKS.filter(l => !isIssued(l.container_id));
          const pendingAmt = pendingLeaks.reduce((s, l) => s - l.variance, 0);
          const causeTotals = {};
          LEAKS.forEach(l => { const cause = l.leak_reason || "Other"; causeTotals[cause] = (causeTotals[cause] || 0) + (-l.variance); });
          const causeData = Object.entries(causeTotals).map(([cause, amount]) => ({ cause, amount: Math.round(amount) })).sort((a, b) => b.amount - a.amount);
          const cMax = Math.max(...causeData.map(c => c.amount), 1);

          return (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 24, flexWrap: "wrap", marginBottom: 30 }}>
                <StageHeader title="Tariff reconciliation" stat={`₹${fmt(TOTAL_LEAKAGE)} · ${LEAKS.length} of ${LEDGER.length} boxes · ${leakPct}% of revenue`} />
                <button
                  onClick={issueAllDebitNotes}
                  style={{ padding: "12px 22px", borderRadius: 9, border: "none", background: C.accent, color: "#000", fontWeight: 700, cursor: "pointer", fontSize: 14, flexShrink: 0, fontFamily: "inherit" }}
                >
                  {pendingLeaks.length ? `Issue all ${pendingLeaks.length} debit notes · ₹${fmt(pendingAmt)} →` : "All debit notes issued ✓"}
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(440px, 1fr))", gap: 18, alignItems: "start" }}>
                <div style={card}>
                  <div style={sectionTitle}>Leakage by cause — fix the process, not just the invoice</div>
                  {causeData.map(c => (
                    <div key={c.cause} style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 12, color: C.muted, marginBottom: 5, lineHeight: 1.4 }}>{c.cause}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: `${Math.max(3, Math.round((c.amount / cMax) * 100) * 0.75)}%`, height: 14, background: C.red, opacity: 0.85, borderRadius: "0 4px 4px 0" }} />
                        <span style={{ fontSize: 12, ...mono }}>₹{fmt(c.amount)}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={card}>
                  <div style={sectionTitle}>Undercharged boxes — billing system vs published tariff</div>
                  <div style={{ display: "grid", gridTemplateColumns: "118px minmax(0,1.3fr) 92px 84px 110px" }}>
                    <div style={{ ...TH, textAlign: "left" }}>Container</div>
                    <div style={{ ...TH, textAlign: "left" }}>Consignee</div>
                    <div style={{ ...TH, textAlign: "right" }}>Shortfall</div>
                    <div style={{ ...TH, textAlign: "left", paddingLeft: 16 }}>Status</div>
                    <div style={{ borderBottom: `1px solid ${C.border}` }}></div>
                  </div>
                  {LEAKS.map(l => {
                    const issued = isIssued(l.container_id);
                    return (
                      <div key={l.container_id} style={{ display: "grid", gridTemplateColumns: "118px minmax(0,1.3fr) 92px 84px 110px", alignItems: "center" }}>
                        <div title={l.leak_reason} style={{ ...TD, ...mono, color: C.accent }}>{l.container_no}</div>
                        <div title={l.leak_reason} style={TD}>{l.consignee}</div>
                        <div style={{ ...TD, textAlign: "right", color: C.red, fontWeight: 700, ...mono }}>₹{fmt(-l.variance)}</div>
                        <div style={{ ...TD, fontSize: 12, paddingLeft: 16, color: issued ? C.green : C.muted }}>{issued ? "✓ Issued" : "Pending"}</div>
                        <div style={{ ...TD, textAlign: "right" }}>
                          {!issued && <button style={btn} onClick={() => issueDebitNote(l)}>Debit note →</button>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          );
        })()}

        {/* ── SETTLE — collections ledger ── */}
        {stage === "settle" && (
          <>
            <StageHeader
              title="Collections"
              stat={`₹${fmt(totalOutstanding)} outstanding · ${OUTSTANDING.length} account${OUTSTANDING.length === 1 ? "" : "s"} · ₹${fmt(sessionCollected)} collected this session`}
            />

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 20 }}>
              {[
                ["Outstanding", `₹${fmt(totalOutstanding)}`, totalOutstanding > 0 ? C.red : C.green],
                ["Accounts outstanding", OUTSTANDING.length, C.text],
                ["Oldest outstanding", `${oldestOutstandingAge}d`, oldestOutstandingAge > 30 ? C.red : oldestOutstandingAge > 15 ? C.yellow : C.text],
                ["Collected this session", `₹${fmt(sessionCollected)}`, C.green],
              ].map(([label, value, color]) => (
                <div key={label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px 20px" }}>
                  <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 8 }}>{label}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, ...mono, color }}>{value}</div>
                </div>
              ))}
            </div>

            <div style={card}>
              <div style={sectionTitle}>Outstanding balances — against issued debit notes, demand notices &amp; auction dockets</div>
              {RECEIVABLES.length === 0 && (
                <div style={{ border: `1px dashed ${C.border}`, borderRadius: 12, padding: 40, textAlign: "center", color: C.muted, fontSize: 14 }}>
                  No monetary artifacts issued yet this session. Issue a debit note from{" "}
                  <a href="#" onClick={e => { e.preventDefault(); setStage("recover"); }} style={{ color: C.accent }}>Recover</a>{" "}
                  or a demand notice from{" "}
                  <a href="#" onClick={e => { e.preventDefault(); setStage("operate"); }} style={{ color: C.accent }}>Operate</a>{" "}
                  and the outstanding balance lands here for collection.
                </div>
              )}
              {RECEIVABLES.length > 0 && OUTSTANDING.length === 0 && (
                <div style={{ color: C.green, fontSize: 13 }}>✓ All issued artifacts fully collected.</div>
              )}
              {OUTSTANDING.length > 0 && (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr>
                    <th style={TH}>Container</th><th style={TH}>Party</th><th style={TH}>Artifacts</th>
                    <th style={{ ...TH, textAlign: "right" }}>Age</th>
                    <th style={{ ...TH, textAlign: "right" }}>Outstanding</th><th style={TH}></th>
                  </tr></thead>
                  <tbody>{OUTSTANDING.map(g => (
                    <tr key={g.container_no}>
                      <td style={{ ...TD, ...mono }}>{g.container_no}</td>
                      <td style={TD}>{g.party}</td>
                      <td style={{ ...TD, fontSize: 12, color: C.muted }}>{g.entries.map(e => e.type).join(" + ")}</td>
                      <td style={{ ...TD, ...mono, textAlign: "right", fontWeight: 700, color: g.ageDays > 30 ? C.red : g.ageDays > 15 ? C.yellow : C.muted }}>{g.ageDays}d</td>
                      <td style={{ ...TD, ...mono, textAlign: "right", fontWeight: 700 }}>₹{fmt(g.net)}</td>
                      <td style={{ ...TD, textAlign: "right" }}>
                        <button style={btn} onClick={() => issuePaymentReceipt(g)}>Record payment →</button>
                      </td>
                    </tr>
                  ))}</tbody>
                </table>
              )}
            </div>

            {SETTLED.length > 0 && (
              <div style={card}>
                <div style={sectionTitle}>Recently settled — this session</div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr>
                    <th style={TH}>Container</th><th style={TH}>Party</th>
                    <th style={{ ...TH, textAlign: "right" }}>Amount collected</th><th style={TH}>Receipt</th><th style={TH}>Date</th>
                  </tr></thead>
                  <tbody>{SETTLED.map(g => {
                    const receipt = g.entries.find(e => e.type === "Payment Receipt");
                    return (
                      <tr key={g.container_no}>
                        <td style={{ ...TD, ...mono }}>{g.container_no}</td>
                        <td style={TD}>{g.party}</td>
                        <td style={{ ...TD, ...mono, textAlign: "right", color: C.green, fontWeight: 700 }}>₹{fmt(Math.abs(receipt?.amount || 0))}</td>
                        <td style={{ ...TD, ...mono, fontSize: 12 }}>{receipt?.ref}</td>
                        <td style={{ ...TD, ...mono, fontSize: 12 }}>{receipt?.date}</td>
                      </tr>
                    );
                  })}</tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ── INTELLIGENCE rail — AI query ── */}
        {stage === "intelligence" && (
          <>
            <StageHeader title="Ask the data" />
            <div style={{ display: "flex", gap: 10, marginBottom: 16, maxWidth: 860 }}>
              <input value={question} onChange={e => setQuestion(e.target.value)} onKeyDown={e => e.key === "Enter" && handleQuery()}
                placeholder="Ask about dwell, leakage, margins, consignees, CHAs…"
                style={{ flex: 1, padding: "14px 18px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.card, color: C.text, fontSize: 15, fontFamily: "inherit", outline: "none" }} />
              <button onClick={() => handleQuery()} disabled={loading}
                style={{ padding: "14px 26px", borderRadius: 10, border: "none", background: C.accent, color: "#000", fontWeight: 700, cursor: "pointer", fontSize: 14, fontFamily: "inherit" }}>
                {loading ? "Analysing…" : "Ask →"}
              </button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 26, maxWidth: 860 }}>
              {CFS_SAMPLE_QUESTIONS.map((q, i) => (
                <button key={i} onClick={() => { setQuestion(q); handleQuery(q); }}
                  style={{ padding: "7px 14px", borderRadius: 20, border: `1px solid ${C.border}`, background: "transparent", color: C.muted, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                  {q}
                </button>
              ))}
            </div>
            {result && (
              <div style={{ ...card, maxWidth: 860 }}>
                <div style={{ fontSize: 13, color: C.muted, marginBottom: 8 }}>{result.question}</div>
                <div style={{ fontSize: 16, marginBottom: 14, lineHeight: 1.55 }}>{result.summary}</div>
                {result.table?.length > 0 && (
                  <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 14 }}>
                    <thead><tr>{Object.keys(result.table[0]).map(k => <th key={k} style={TH}>{k}</th>)}</tr></thead>
                    <tbody>{result.table.map((row, i) => (
                      <tr key={i}>{Object.values(row).map((v, j) => <td key={j} style={{ ...TD, fontSize: 12 }}>{String(v)}</td>)}</tr>
                    ))}</tbody>
                  </table>
                )}
                {result.insight && <div style={{ fontSize: 13, color: C.accent }}>{result.insight}</div>}
              </div>
            )}
          </>
        )}

        {/* ── PROFITABILITY rail ── */}
        {stage === "profitability" && (
          <>
            <StageHeader
              title="Profitability"
              stat={`${Math.round((TOTALS.margin / TOTALS.revenue) * 100)}% blended margin · ${belowFloor.length} accounts below ${MARGIN_FLOOR}% floor`}
            />
            <div style={card}>
              <div style={sectionTitle}>Margin by consignee</div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr>
                  <th style={TH}>Consignee</th><th style={{ ...TH, textAlign: "right" }}>Boxes</th>
                  <th style={{ ...TH, textAlign: "right" }}>Revenue</th><th style={{ ...TH, textAlign: "right" }}>Cost</th>
                  <th style={{ ...TH, textAlign: "right" }}>Margin</th><th style={{ ...TH, textAlign: "right" }}>Margin %</th>
                  <th style={{ ...TH, textAlign: "right" }}>Avg dwell</th>
                </tr></thead>
                <tbody>{BY_CONSIGNEE.map(r => (
                  <tr key={r.key}>
                    <td style={TD}>{r.key}</td>
                    <td style={{ ...TD, ...mono, textAlign: "right" }}>{r.boxes}</td>
                    <td style={{ ...TD, ...mono, textAlign: "right" }}>₹{fmt(r.revenue)}</td>
                    <td style={{ ...TD, ...mono, textAlign: "right" }}>₹{fmt(r.cost)}</td>
                    <td style={{ ...TD, ...mono, textAlign: "right", color: r.margin >= 0 ? C.green : C.red }}>₹{fmt(r.margin)}</td>
                    <td style={{ ...TD, ...mono, textAlign: "right", color: r.marginPct < MARGIN_FLOOR ? C.red : C.green }}>{r.marginPct}%</td>
                    <td style={{ ...TD, ...mono, textAlign: "right" }}>{r.avgDwell}d</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            {(() => {
              const scatterData = BY_CONSIGNEE
                .filter(r => r.closedImportBoxes > 0)
                .map(r => ({ dwell: parseFloat(r.avgDwell), margin: r.marginPct, boxes: r.boxes, name: r.key }));
              return (
                <div style={card}>
                  <div style={sectionTitle}>Margin % vs avg dwell — per consignee (import boxes only)</div>
                  <ResponsiveContainer width="100%" height={280}>
                    <ScatterChart margin={{ top: 20, right: 30, bottom: 40, left: 10 }}>
                      <CartesianGrid stroke={C.border} strokeDasharray="3 3" />
                      <XAxis type="number" dataKey="dwell" name="Avg Dwell" stroke={C.muted} fontSize={11} tick={{ fill: C.muted }}
                        label={{ value: "Avg dwell (days)", position: "insideBottom", offset: -24, fill: C.muted, fontSize: 11 }} />
                      <YAxis type="number" dataKey="margin" name="Margin" stroke={C.muted} fontSize={11} tick={{ fill: C.muted }}
                        tickFormatter={v => `${v}%`} label={{ value: "Margin %", angle: -90, position: "insideLeft", offset: 10, fill: C.muted, fontSize: 11 }} />
                      <ReferenceLine x={5} stroke={C.green} strokeDasharray="4 4" label={{ value: "5d target", position: "top", fill: C.green, fontSize: 10 }} />
                      <ReferenceLine y={MARGIN_FLOOR} stroke={C.yellow} strokeDasharray="4 4" label={{ value: `${MARGIN_FLOOR}% floor`, position: "right", fill: C.yellow, fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12 }}
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const d = payload[0].payload;
                          return (
                            <div style={{ background: C.card, border: `1px solid ${C.border}`, padding: "8px 12px", borderRadius: 6, fontSize: 12 }}>
                              <div style={{ fontWeight: 600, marginBottom: 4 }}>{d.name}</div>
                              <div style={{ color: C.muted }}>Avg dwell: <span style={mono}>{d.dwell}d</span></div>
                              <div style={{ color: C.muted }}>Margin: <span style={{ ...mono, color: d.margin < MARGIN_FLOOR ? C.red : C.green }}>{d.margin}%</span></div>
                              <div style={{ color: C.muted }}>{d.boxes} boxes</div>
                            </div>
                          );
                        }}
                      />
                      <Scatter
                        data={scatterData}
                        shape={({ cx, cy, payload }) => {
                          const ok = payload.margin >= MARGIN_FLOOR && payload.dwell <= 10;
                          const r = Math.max(5, Math.sqrt(payload.boxes) * 3.5);
                          return <circle cx={cx} cy={cy} r={r} fill={ok ? C.green : C.red} fillOpacity={0.7} stroke={ok ? C.green : C.red} strokeWidth={1} />;
                        }}
                      />
                    </ScatterChart>
                  </ResponsiveContainer>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>Dot size ∝ boxes handled. Red = below {MARGIN_FLOOR}% floor or above 10-day avg dwell.</div>
                </div>
              );
            })()}

            {/* ── SECONDARY EXHIBITS ── */}
            <div style={{ borderTop: `2px solid ${C.border}`, margin: "4px 0 20px", position: "relative" }}>
              <span style={{ position: "absolute", top: -10, left: 0, background: C.bg, paddingRight: 12, fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "1px" }}>Secondary exhibits</span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <div style={card}>
                <div style={sectionTitle}>Margin by cargo class</div>
                {BY_CLASS.map(r => (
                  <div key={r.key} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
                    <span>{r.key} <span style={{ color: C.muted, fontSize: 11 }}>({r.boxes} boxes)</span></span>
                    <span style={{ ...mono, color: r.marginPct < MARGIN_FLOOR ? C.red : C.green }}>₹{fmt(r.margin)} · {r.marginPct}%</span>
                  </div>
                ))}
              </div>
              <div style={card}>
                <div style={sectionTitle}>Margin by port of discharge & CHA</div>
                {BY_PORT.map(r => (
                  <div key={r.key} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13 }}>
                    <span>{r.key}</span><span style={mono}>₹{fmt(r.revPerTeu)}/TEU · {r.marginPct}%</span>
                  </div>
                ))}
                <div style={{ borderTop: `1px solid ${C.border}`, margin: "10px 0" }} />
                {BY_CHA.map(r => (
                  <div key={r.key} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 12, color: C.muted }}>
                    <span>{r.key}</span><span style={mono}>{r.teu} TEU · {r.marginPct}%</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={card}>
              <div style={sectionTitle}>Slot economics by dwell bucket — does ground rent beat throughput?</div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr><th style={TH}>Dwell bucket</th><th style={{ ...TH, textAlign: "right" }}>Boxes</th><th style={{ ...TH, textAlign: "right" }}>TEU slot-days</th><th style={{ ...TH, textAlign: "right" }}>Revenue / slot-day</th><th style={{ ...TH, textAlign: "right" }}>Margin / slot-day</th></tr></thead>
                <tbody>{SLOT_ECONOMICS.map(r => (
                  <tr key={r.bucket}>
                    <td style={TD}>{r.bucket}</td>
                    <td style={{ ...TD, ...mono, textAlign: "right" }}>{r.boxes}</td>
                    <td style={{ ...TD, ...mono, textAlign: "right" }}>{fmt(r.slotDays)}</td>
                    <td style={{ ...TD, ...mono, textAlign: "right" }}>₹{fmt(r.revPerSlotDay)}</td>
                    <td style={{ ...TD, ...mono, textAlign: "right", color: r.marginPerSlotDay >= 0 ? C.green : C.red }}>₹{fmt(r.marginPerSlotDay)}</td>
                  </tr>
                ))}</tbody>
              </table>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 10 }}>A fast-turning box earns its whole handling margin in days; a long-stay box earns slab rent but blocks the slot. Where margin/slot-day of long buckets falls below the fast buckets, the auction track is the more profitable decision — not patience.</div>
            </div>
            <div style={card}>
              <div style={sectionTitle}>Monthly throughput (TEU) & capacity utilisation</div>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={MONTHLY_THROUGHPUT}>
                  <CartesianGrid stroke={C.border} strokeDasharray="3 3" />
                  <XAxis dataKey="month" stroke={C.muted} fontSize={11} />
                  <YAxis stroke={C.muted} fontSize={11} />
                  <Tooltip contentStyle={{ background: C.card, border: `1px solid ${C.border}` }} />
                  <Legend />
                  <Bar dataKey="teu" name="TEU" fill={C.accent} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
                {[
                  ["Annualised run-rate vs Manali capacity (120K TEU)", `${yardUtilPct}%`],
                  ["Import : Export split", `${LEDGER.filter(l => l.direction === "Import").length} : ${LEDGER.filter(l => l.direction === "Export").length}`],
                  ["Chennai / Ennore / Kattupalli sourcing", `${LEDGER.filter(l => l.port === "Chennai").length} / ${LEDGER.filter(l => l.port === "Ennore").length} / ${LEDGER.filter(l => l.port === "Kattupalli").length}`],
                  ["DPD-risk TEU (Hyundai · TVS · Saint-Gobain)", `${LEDGER.filter(l => ["Hyundai Motor India", "TVS Motor Company", "Saint-Gobain India"].includes(l.consignee)).reduce((s, l) => s + l.teu, 0)} TEU`],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
                    <span style={{ color: C.muted }}>{k}</span><span style={{ ...mono, fontWeight: 600 }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── RATE CARD rail ── */}
        {stage === "ratecard" && (() => {
          const T = TARIFF;
          const staleLeaks = LEAKS.filter(l => l.leak_reason?.toLowerCase().includes("rate card"));
          return (
            <>
              {/* header + effective date */}
              <div style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <div style={sectionTitle}>Published tariff — active rate card</div>
                  <div style={{ fontSize: 12, color: C.muted }}>Click any rate to edit. Changes auto-saved to session and highlighted in amber. Edits are for simulation only — they do not reprice historical invoices.</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ fontSize: 11, color: C.muted }}>Effective from</div>
                  <input
                    type="date"
                    value={rateEffDate}
                    onChange={e => setRateEffDate(e.target.value)}
                    style={{ padding: "5px 10px", borderRadius: 6, border: `1px solid ${C.border}`, background: C.card, color: C.text, fontSize: 12, fontFamily: "inherit" }}
                  />
                  <button onClick={() => { resetRateOverrides(); showToast("Rate card reset to published tariff"); }}
                    style={{ ...btn, borderColor: C.muted, color: C.muted }}>
                    Reset to published
                  </button>
                </div>
              </div>

              {/* import handling fees */}
              <div style={card}>
                <div style={sectionTitle}>Import handling & movement (per container)</div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr>
                    <th style={TH}>Port of discharge</th><th style={TH}>Class</th><th style={TH}>Service</th>
                    <th style={{ ...TH, textAlign: "right" }}>20'</th>
                    <th style={{ ...TH, textAlign: "right" }}>40'</th>
                  </tr></thead>
                  <tbody>
                    {[
                      ["Chennai", "GP",  "Load-out delivery",  "ch_gp_lo_20",  T.handling_import.Chennai.GP.loadout.s20,  "ch_gp_lo_40",  T.handling_import.Chennai.GP.loadout.s40],
                      ["Chennai", "GP",  "De-stuffing service","ch_gp_ds_20",  T.handling_import.Chennai.GP.destuff.s20,  "ch_gp_ds_40",  T.handling_import.Chennai.GP.destuff.s40],
                      ["Chennai", "ODC", "Load-out delivery",  "ch_od_lo_20",  T.handling_import.Chennai.ODC.loadout.s20, "ch_od_lo_40",  T.handling_import.Chennai.ODC.loadout.s40],
                      ["Chennai", "ODC", "De-stuffing service","ch_od_ds_20",  T.handling_import.Chennai.ODC.destuff.s20, "ch_od_ds_40",  T.handling_import.Chennai.ODC.destuff.s40],
                      ["Ennore",  "GP",  "Load-out delivery",  "en_gp_lo_20",  T.handling_import.Ennore.GP.loadout.s20,   "en_gp_lo_40",  T.handling_import.Ennore.GP.loadout.s40],
                      ["Ennore",  "GP",  "De-stuffing service","en_gp_ds_20",  T.handling_import.Ennore.GP.destuff.s20,   "en_gp_ds_40",  T.handling_import.Ennore.GP.destuff.s40],
                      ["Kattupalli","GP","Load-out delivery",  "kt_gp_lo_20",  T.handling_import.Kattupalli.GP.loadout.s20,"kt_gp_lo_40", T.handling_import.Kattupalli.GP.loadout.s40],
                      ["Kattupalli","GP","De-stuffing service","kt_gp_ds_20",  T.handling_import.Kattupalli.GP.destuff.s20,"kt_gp_ds_40", T.handling_import.Kattupalli.GP.destuff.s40],
                    ].map(([port, cls, svc, k20, v20, k40, v40]) => (
                      <tr key={k20}>
                        <td style={TD}>{port}</td>
                        <td style={{ ...TD, fontSize: 12, color: C.muted }}>{cls}</td>
                        <td style={{ ...TD, fontSize: 12 }}>{svc}</td>
                        <td style={{ ...TD, textAlign: "right" }}>{rc(k20, v20)}</td>
                        <td style={{ ...TD, textAlign: "right" }}>{rc(k40, v40)}</td>
                      </tr>
                    ))}
                    <tr>
                      <td style={TD}>All ports</td>
                      <td style={{ ...TD, fontSize: 12, color: C.muted }}>–</td>
                      <td style={{ ...TD, fontSize: 12 }}>Customs exam de-stuffing (&gt;25%)</td>
                      <td style={{ ...TD, textAlign: "right" }}>{rc("exam_s20", T.exam_destuff.s20)}</td>
                      <td style={{ ...TD, textAlign: "right" }}>{rc("exam_s40", T.exam_destuff.s40)}</td>
                    </tr>
                  </tbody>
                </table>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 10 }}>Hazardous / Reefer: +25% on handling. ODC: billed at ODC rate (no additional multiplier on handling, 2× on holding).</div>
              </div>

              {/* holding slabs */}
              <div style={card}>
                <div style={sectionTitle}>Import holding slabs (₹/day · GP). Hazardous/Reefer = ×1.25 · ODC holding = ×2</div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr>
                    <th style={TH}>Dwell (days)</th>
                    <th style={{ ...TH, textAlign: "right" }}>20' rate/day</th>
                    <th style={{ ...TH, textAlign: "right" }}>40' rate/day</th>
                  </tr></thead>
                  <tbody>
                    {T.holding_import.map((slab, i) => (
                      <tr key={i}>
                        <td style={{ ...TD, fontSize: 12 }}>
                          {slab.from === slab.to ? `Day ${slab.from}` : slab.to === 9999 ? `Day ${slab.from}+` : `Days ${slab.from}–${slab.to}`}
                          {i === 0 && <span style={{ marginLeft: 8, fontSize: 11, color: C.green }}>free</span>}
                        </td>
                        <td style={{ ...TD, textAlign: "right" }}>
                          {slab.s20 === 0 ? <span style={{ color: C.muted, fontSize: 12 }}>—</span> : rc(`slab_${i}_s20`, slab.s20)}
                        </td>
                        <td style={{ ...TD, textAlign: "right" }}>
                          {slab.s40 === 0 ? <span style={{ color: C.muted, fontSize: 12 }}>—</span> : rc(`slab_${i}_s40`, slab.s40)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* slab step chart */}
              {(() => {
                const slabChartData = [];
                T.holding_import.forEach((slab) => {
                  const days = slab.to === 9999 ? [slab.from, slab.from + 14] : [slab.from, slab.to];
                  days.forEach(d => {
                    if (!slabChartData.some(p => p.day === d)) {
                      slabChartData.push({ day: d, "20'": slab.s20, "40'": slab.s40 });
                    }
                  });
                });
                slabChartData.sort((a, b) => a.day - b.day);
                return (
                  <div style={card}>
                    <div style={sectionTitle}>Holding slab escalation curve — ₹/day vs dwell (GP class, import)</div>
                    <div style={{ fontSize: 13, color: C.muted, marginBottom: 14 }}>
                      Step chart shows how the daily ground rent rate jumps at each slab boundary. Days 1–3 are free; after day 91 the rate is capped at the maximum slab.
                    </div>
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={slabChartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                        <CartesianGrid stroke={C.border} strokeDasharray="3 3" />
                        <XAxis dataKey="day" stroke={C.muted} fontSize={11} tick={{ fill: C.muted }} label={{ value: "Dwell (days)", position: "insideBottom", offset: -2, fill: C.muted, fontSize: 11 }} />
                        <YAxis stroke={C.muted} fontSize={11} tick={{ fill: C.muted }} tickFormatter={v => `₹${(v/1000).toFixed(0)}K`} />
                        <Tooltip
                          contentStyle={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12 }}
                          formatter={(v, name) => [`₹${v.toLocaleString()}/day`, name]}
                        />
                        <Legend wrapperStyle={{ fontSize: 12, color: C.muted }} />
                        <Line type="stepAfter" dataKey="20'" stroke={C.accent} strokeWidth={2} dot={false} />
                        <Line type="stepAfter" dataKey="40'" stroke={C.red} strokeWidth={2} dot={false} strokeDasharray="5 3" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                );
              })()}

              {/* ancillaries */}
              <div style={card}>
                <div style={sectionTitle}>Ancillary charges</div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr>
                    <th style={TH}>Charge</th>
                    <th style={{ ...TH, textAlign: "right" }}>20'</th>
                    <th style={{ ...TH, textAlign: "right" }}>40'</th>
                  </tr></thead>
                  <tbody>
                    {[
                      ["Energy surcharge",          "anc_en_20", T.ancillary.energy_surcharge.s20,  "anc_en_40", T.ancillary.energy_surcharge.s40],
                      ["Reefer plugging (per day)", "anc_rp_20", T.ancillary.reefer_plugging.s20,   "anc_rp_40", T.ancillary.reefer_plugging.s40],
                      ["Lift on/off (laden)",        "anc_ll_20", T.ancillary.lift_onoff_laden.s20,  "anc_ll_40", T.ancillary.lift_onoff_laden.s40],
                    ].map(([label, k20, v20, k40, v40]) => (
                      <tr key={k20}>
                        <td style={{ ...TD, fontSize: 12 }}>{label}</td>
                        <td style={{ ...TD, textAlign: "right" }}>{rc(k20, v20)}</td>
                        <td style={{ ...TD, textAlign: "right" }}>{rc(k40, v40)}</td>
                      </tr>
                    ))}
                    {[
                      ["RFID container tracking (per TEU)", "anc_rfid", T.ancillary.rfid_per_teu],
                      ["Risk management / insurance (per TEU)", "anc_risk", T.ancillary.risk_mgmt_per_teu],
                      ["Weighment",             "anc_wt",   T.ancillary.weighment],
                      ["Scanning movement",     "anc_scan", T.ancillary.scanning_movement],
                      ["Seal (OTL)",            "anc_seal", T.ancillary.seal_otl],
                      ["Auction cargo handling","anc_auc",  T.auction.handling_per_box],
                      ["Valuation & NOC",       "anc_noc",  T.auction.valuation_noc],
                    ].map(([label, key, val]) => (
                      <tr key={key}>
                        <td style={{ ...TD, fontSize: 12 }}>{label}</td>
                        <td style={{ ...TD, textAlign: "right" }}>{rc(key, val)}</td>
                        <td style={{ ...TD, textAlign: "right", color: C.muted, fontSize: 12 }}>—</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* stale rate card leakage */}
              {staleLeaks.length > 0 && (
                <div style={card}>
                  <div style={sectionTitle}>Detected leakage — stale rate card ({staleLeaks.length} containers)</div>
                  <div style={{ fontSize: 13, color: C.muted, marginBottom: 14 }}>
                    Containers reconciled against the current rate card where the billing system applied an older tariff version.
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead><tr>
                      <th style={TH}>Container</th><th style={TH}>Consignee</th><th style={TH}>Issue</th>
                      <th style={{ ...TH, textAlign: "right" }}>Shortfall</th><th style={TH}></th>
                    </tr></thead>
                    <tbody>{staleLeaks.map(l => (
                      <tr key={l.container_id}>
                        <td style={{ ...TD, ...mono, cursor: "pointer", color: C.accent }} onClick={() => setDetail(l)}>{l.container_no}</td>
                        <td style={TD}>{l.consignee}</td>
                        <td style={{ ...TD, fontSize: 12, color: C.muted }}>{l.leak_reason}</td>
                        <td style={{ ...TD, ...mono, textAlign: "right", color: C.red, fontWeight: 700 }}>₹{fmt(-l.variance)}</td>
                        <td style={{ ...TD, textAlign: "right" }}><button style={btn} onClick={() => issueDebitNote(l)}>Debit note →</button></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </>
          );
        })()}

        {/* ── REGISTER rail ── */}
        {stage === "register" && (() => {
          const totalsByType = {};
          register.forEach(x => { totalsByType[x.type] = (totalsByType[x.type] || 0) + Math.abs(x.amount || 0); });
          return (
            <>
              <StageHeader
                title="Action register"
                stat={register.length ? `${register.length} artifact${register.length === 1 ? "" : "s"} · ₹${fmt(sessionRecovered)} raised this session` : "no artifacts this session"}
              />
              <div style={{ display: "flex", gap: 16, marginBottom: 22, flexWrap: "wrap" }}>
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px 22px", minWidth: 180 }}>
                  <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.8px" }}>Recoverable raised</div>
                  <div style={{ fontSize: 22, fontWeight: 700, ...mono, marginTop: 5, color: C.green }}>₹{fmt(sessionRecovered)}</div>
                </div>
                {Object.entries(totalsByType).map(([type, amt]) => (
                  <div key={type} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px 22px", minWidth: 180 }}>
                    <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.8px" }}>{type}s</div>
                    <div style={{ fontSize: 22, fontWeight: 700, ...mono, marginTop: 5, color: C.text }}>{amt ? `₹${fmt(amt)}` : register.filter(x => x.type === type).length}</div>
                  </div>
                ))}
              </div>

              {register.length === 0 && (
                <div style={{ border: `1px dashed ${C.border}`, borderRadius: 12, padding: 40, textAlign: "center", color: C.muted, fontSize: 14 }}>
                  No artifacts yet this session. Issue a debit note from{" "}
                  <a href="#" onClick={e => { e.preventDefault(); setStage("recover"); }} style={{ color: C.accent }}>Recover</a>{" "}
                  or a demand notice from{" "}
                  <a href="#" onClick={e => { e.preventDefault(); setStage("operate"); }} style={{ color: C.accent }}>Operate</a>{" "}
                  and it lands here.
                </div>
              )}

              {register.length > 0 && (
                <div style={card}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead><tr><th style={TH}>Ref</th><th style={TH}>Type</th><th style={TH}>Party</th><th style={TH}>Container</th><th style={{ ...TH, textAlign: "right" }}>Amount</th><th style={TH}>Date</th></tr></thead>
                    <tbody>{register.map(r => (
                      <tr key={r.ref}>
                        <td style={{ ...TD, ...mono, fontSize: 12 }}>{r.ref}</td>
                        <td style={TD}>{r.type}</td>
                        <td style={TD}>{r.party}</td>
                        <td style={{ ...TD, ...mono, fontSize: 12 }}>{r.container_no}</td>
                        <td style={{ ...TD, ...mono, textAlign: "right" }}>{r.amount ? `₹${fmt(Math.abs(r.amount))}` : "—"}</td>
                        <td style={{ ...TD, ...mono, fontSize: 12 }}>{r.date}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                  <button style={{ ...btn, marginTop: 14, borderColor: C.border, color: C.muted }}
                    onClick={() => { clearRegister(); setIssued({}); showToast("Session register cleared"); }}>
                    Clear session register
                  </button>
                </div>
              )}
            </>
          );
        })()}

      </LifecycleShell>
    </div>
  );
}

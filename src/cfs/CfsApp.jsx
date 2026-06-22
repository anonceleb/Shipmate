import { useState, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { C, applyTheme } from "../data/constants.js";
import { SCHEMA_DESC_CFS, CFS_SAMPLE_QUESTIONS, TARIFF, TARIFF_REVISION } from "./constants.js";
import {
  fmt, TODAY, MANALI_CAPACITY, bucketOf, getComputations,
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
const TH = { textAlign: "left", padding: "8px 10px", fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.6px", borderBottom: `1px solid ${C.border}` };
const TD = { padding: "8px 10px", fontSize: 13, borderBottom: `1px solid ${C.border}` };
const mono = { fontFamily: "'Space Mono', monospace" };
const btn = { padding: "5px 12px", borderRadius: 6, border: `1px solid ${C.accent}`, background: "transparent", color: C.accent, cursor: "pointer", fontSize: 11, fontFamily: "inherit" };
const sectionTitle = { fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 10 };

const STAGES = [
  { id: "quote",   label: "Quote",   hint: "commercial repricing — accounts below margin floor" },
  { id: "book",    label: "Book",    hint: "gate-in — not yet tracked", gap: true },
  { id: "operate", label: "Operate", hint: "yard & dwell tracking" },
  { id: "bill",    label: "Bill",    hint: "demand notices & long-stay escalation" },
  { id: "recover", label: "Recover", hint: "tariff reconciliation & leakage recovery" },
  { id: "settle",  label: "Settle",  hint: "collect payment — not yet built", gap: true },
];

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
    TOTALS, DWELL_SUMMARY,
  } = getComputations(terminal.abbr, rateOverrides);

  const [stage, setStage] = useState("operate");
  const [toast, setToast] = useState(null);
  const [detail, setDetail] = useState(null);
  const [printDoc, setPrintDoc] = useState(null);
  const [demandModal, setDemandModal] = useState(null);
  const [demandFinalAmount, setDemandFinalAmount] = useState(0);
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

  const [reg0, push0, clear0] = useRegister("nexus_action_register",  (n, f) => makeRef(n, f, "NXS"));
  const [reg1, push1, clear1] = useRegister("balmer_action_register",   (n, f) => makeRef(n, f, "BCT"));
  const register      = termIdx === 0 ? reg0  : reg1;
  const pushToRegister = termIdx === 0 ? push0 : push1;
  const clearRegister  = termIdx === 0 ? clear0 : clear1;

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
  const issueDebitNote = l => {
    const ref = logAction("Debit Note", l.consignee, l.container_no, -l.variance);
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
  };

  const issueDemandNotice = l => {
    setDemandModal(l);
    setDemandFinalAmount(l.expected);
  };

  const confirmDemandNotice = (l, finalAmt) => {
    const hasReduction = finalAmt < l.expected;
    const ref = logAction("Demand Notice", l.consignee, l.container_no, finalAmt);
    print("Demand Notice", `
      <h2>Demand Notice — Accrued CFS Charges</h2>
      <p>To: <b>${l.consignee}</b> (through CHA: ${l.cha})</p>
      <p>Container <b>${l.container_no}</b> (${l.size}', ${l.commodity}) arrived at our CFS on ${l.arrival_date} and remains uncleared for <b>${l.dwell} days</b>.</p>
      <table><tr><th>Charge head</th><th>Amount (₹)</th></tr>
      ${l.billing_lines.map(b => `<tr><td>${b.label}</td><td>${fmt(b.amount)}</td></tr>`).join("")}
      <tr><th>Total accrued to date</th><th>₹${fmt(l.expected)} + GST</th></tr>
      ${hasReduction ? `<tr><th>Agreed settlement amount</th><th>₹${fmt(finalAmt)} + GST</th></tr>` : ""}
      </table>
      ${hasReduction ? `<p style="color:#c00"><b>Note:</b> Agreed settlement of ₹${fmt(finalAmt)} represents a reduction of ₹${fmt(l.expected - finalAmt)} from the accrued total. A credit note will be issued separately for the balance.</p>` : ""}
      <p>Ground rent continues to accrue daily per the published slab. You are requested to clear the consignment and settle all dues within 7 days, failing which action under Section 48 of the Customs Act, 1962 (disposal of uncleared goods) will be initiated.</p>`, ref);
    setDemandModal(null);
    showToast(`Demand notice ${ref} generated & logged`);
  };

  const issueCreditNote = (l, finalAmt) => {
    const creditAmt = l.expected - finalAmt;
    const ref = logAction("Credit Note", l.consignee, l.container_no, -creditAmt);
    print("Credit Note", `
      <h2>Credit Note</h2>
      <p>To: <b>${l.consignee}</b> (through CHA: ${l.cha})</p>
      <p>Container <b>${l.container_no}</b> (${l.size}', ${l.commodity})</p>
      <p>With reference to the demand notice for accrued CFS charges of ₹${fmt(l.expected)}, and pursuant to commercial settlement at ₹${fmt(finalAmt)}, we hereby issue a credit note for the agreed reduction:</p>
      <table>
        <tr><th>Particulars</th><th>Amount (₹)</th></tr>
        <tr><td>Accrued CFS charges per demand notice</td><td>₹${fmt(l.expected)}</td></tr>
        <tr><td>Agreed settlement amount</td><td>₹${fmt(finalAmt)}</td></tr>
        <tr><th>Credit to PD account</th><th>₹${fmt(creditAmt)}</th></tr>
      </table>
      <p>This credit of ₹${fmt(creditAmt)} will be applied to the party's PD account within 3 working days.</p>`, ref);
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
      <p>Recommendation: ${row.marginPct < 35 ? "renegotiate volume discount / apply surcharges on actuals — account margin is below the 35% contribution floor." : "margin healthy; protect account with volume-discount renewal."}</p>`, ref);
    showToast(`Repricing memo ${ref} generated & logged`);
  };

  const yardUtilPct = Math.round((TOTALS.teu / MANALI_CAPACITY) * 100 * 12);

  const stats = [
    { label: "Boxes (11 mo)", value: `${TOTALS.boxes}`, sub: `${TOTALS.teu} TEU handled` },
    { label: "Revenue", value: "₹" + fmt(TOTALS.revenue), sub: `₹${fmt(TOTALS.margin)} margin` },
    { label: "Leakage found", value: "₹" + fmt(TOTAL_LEAKAGE), sub: `${LEAKS.length} undercharged boxes`, hot: true },
    { label: "In yard now", value: `${YARD.length}`, sub: `₹${fmt(YARD_ACCRUED)} accrued` },
    { label: "Long-stay (>30d)", value: `${LONG_STAY.length}`, sub: "Section 48 candidates", hot: LONG_STAY.length > 0 },
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

      {/* ── Demand notice input modal ── */}
      {demandModal && (
        <div onClick={() => setDemandModal(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.card, borderRadius: 12, padding: 28, width: 560, maxHeight: "88vh", overflowY: "auto", border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 4 }}>Demand Notice — {demandModal.container_no}</div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 18, ...mono }}>
              {demandModal.consignee} · {demandModal.size}' {demandModal.cargo_class} · arrived {demandModal.arrival_date} · {demandModal.dwell} days in yard
            </div>
            <div style={sectionTitle}>Accrued charges</div>
            {demandModal.billing_lines.map((b, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "5px 0", borderBottom: `1px solid ${C.border}` }}>
                <span style={{ color: C.muted }}>{b.label}</span>
                <span style={mono}>₹{fmt(b.amount)}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, padding: "10px 0", color: C.accent, marginBottom: 20 }}>
              <span>Total accrued</span><span style={mono}>₹{fmt(demandModal.expected)}</span>
            </div>
            <div style={{ background: C.surface, borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 8 }}>Final settlement amount</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 15, color: C.muted, ...mono }}>₹</span>
                <input
                  type="number"
                  value={demandFinalAmount}
                  onChange={e => setDemandFinalAmount(Math.max(0, Number(e.target.value)))}
                  style={{ flex: 1, padding: "10px 12px", borderRadius: 6, border: `1px solid ${demandFinalAmount > demandModal.expected ? C.red : C.border}`, background: C.card, color: C.text, fontSize: 15, fontFamily: "'Space Mono', monospace", outline: "none" }}
                />
              </div>
              {demandFinalAmount < demandModal.expected && demandFinalAmount > 0 && (
                <div style={{ marginTop: 8, fontSize: 12, color: C.yellow }}>
                  Negotiated reduction: ₹{fmt(demandModal.expected - demandFinalAmount)} — a credit note will be raised for this amount.
                </div>
              )}
              {demandFinalAmount > demandModal.expected && (
                <div style={{ marginTop: 8, fontSize: 12, color: C.red }}>Amount exceeds total accrued.</div>
              )}
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button style={{ ...btn, borderColor: C.border, color: C.muted }} onClick={() => setDemandModal(null)}>Cancel</button>
              {demandFinalAmount > 0 && demandFinalAmount < demandModal.expected && (
                <button style={{ ...btn, borderColor: C.yellow, color: C.yellow }} onClick={() => issueCreditNote(demandModal, demandFinalAmount)}>
                  Credit note ₹{fmt(demandModal.expected - demandFinalAmount)} →
                </button>
              )}
              <button
                disabled={demandFinalAmount <= 0 || demandFinalAmount > demandModal.expected}
                style={{ ...btn, background: demandFinalAmount > 0 && demandFinalAmount <= demandModal.expected ? C.accent + "22" : "transparent", color: demandFinalAmount > 0 && demandFinalAmount <= demandModal.expected ? C.accent : C.muted, borderColor: demandFinalAmount > 0 && demandFinalAmount <= demandModal.expected ? C.accent : C.border }}
                onClick={() => confirmDemandNotice(demandModal, demandFinalAmount)}
              >
                Generate demand notice →
              </button>
            </div>
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
          { id: "register",      label: `Register (${register.length})` },
        ]}
        active={stage}
        onSelect={setStage}
        stats={stats}
        headerExtra={
          <>
            <div style={{ display: "flex", gap: 4 }}>
              {TERMINALS.map((t, i) => (
                <button key={i} onClick={() => setTermIdx(i)} style={{
                  padding: "5px 11px", borderRadius: 6, fontSize: 11, cursor: "pointer", fontFamily: "inherit",
                  border: `1px solid ${i === termIdx ? t.color : C.border}`,
                  background: i === termIdx ? t.color + "22" : "transparent",
                  color: i === termIdx ? t.color : C.muted,
                  textTransform: "uppercase", letterSpacing: "0.5px",
                }}>
                  {t.abbr}
                </button>
              ))}
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

        {/* ── QUOTE — commercial repricing ── */}
        {stage === "quote" && (
          <>
            <div style={card}>
              <div style={sectionTitle}>Accounts for repricing review — below 35% contribution margin</div>
              <div style={{ fontSize: 13, color: C.muted, marginBottom: 14 }}>
                Activity-based cost allocation against invoiced revenue per consignee. Accounts below the 35% floor indicate volume-discount erosion, stale rate cards, or adverse cargo mix — generate a repricing memo to initiate renegotiation.
              </div>
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
                    <td style={{ ...TD, ...mono, textAlign: "right", color: r.marginPct < 35 ? C.red : C.green, fontWeight: r.marginPct < 35 ? 700 : 400 }}>{r.marginPct}%</td>
                    <td style={{ ...TD, ...mono, textAlign: "right" }}>{r.avgDwell}d</td>
                    <td style={{ ...TD, textAlign: "right" }}>
                      {r.marginPct < 35 && <button style={btn} onClick={() => issueRepricingMemo(r)}>Repricing memo →</button>}
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <div style={card}>
              <div style={sectionTitle}>Rate revision exhibit — 2023 tariff vs current published sheet (Chennai Port, GP)</div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr>
                  <th style={TH}>Service</th>
                  <th style={{ ...TH, textAlign: "right" }}>20' (2023)</th>
                  <th style={{ ...TH, textAlign: "right" }}>20' (current)</th>
                  <th style={{ ...TH, textAlign: "right" }}>40' (2023)</th>
                  <th style={{ ...TH, textAlign: "right" }}>40' (current)</th>
                </tr></thead>
                <tbody>
                  {[["Load-out delivery", TARIFF.handling_import.Chennai.GP.loadout, TARIFF_REVISION.handling_import_chennai_GP.loadout],
                    ["De-stuffing service", TARIFF.handling_import.Chennai.GP.destuff, TARIFF_REVISION.handling_import_chennai_GP.destuff]].map(([label, old, nw]) => (
                    <tr key={label}>
                      <td style={TD}>{label}</td>
                      <td style={{ ...TD, ...mono, textAlign: "right" }}>₹{fmt(old.s20)}</td>
                      <td style={{ ...TD, ...mono, textAlign: "right", color: C.green }}>₹{fmt(nw.s20)} <span style={{ fontSize: 11, color: C.muted }}>(+{Math.round((nw.s20 / old.s20 - 1) * 100)}%)</span></td>
                      <td style={{ ...TD, ...mono, textAlign: "right" }}>₹{fmt(old.s40)}</td>
                      <td style={{ ...TD, ...mono, textAlign: "right", color: C.green }}>₹{fmt(nw.s40)} <span style={{ fontSize: 11, color: C.muted }}>(+{Math.round((nw.s40 / old.s40 - 1) * 100)}%)</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 10 }}>If any box was billed on the old sheet after the revision date, the reconciliation engine flags it — the same diff that catches slab errors catches stale rate cards.</div>
            </div>
          </>
        )}

        {/* ── OPERATE — yard & dwell ── */}
        {stage === "operate" && (
          <>
            {/* Yard snapshot */}
            <div style={card}>
              <div style={sectionTitle}>Containers in yard — ground rent accruing daily (as of {TODAY})</div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr>
                  <th style={TH}>Container</th><th style={TH}>Consignee / CHA</th><th style={TH}>Cargo</th>
                  <th style={{ ...TH, textAlign: "right" }}>Dwell</th><th style={TH}>Slab today</th>
                  <th style={{ ...TH, textAlign: "right" }}>Accrued</th><th style={TH}></th>
                </tr></thead>
                <tbody>{YARD.map(l => {
                  const b = bucketOf(l.dwell);
                  const slabColor = l.dwell <= 3 ? C.green : l.dwell <= 15 ? C.yellow : C.red;
                  return (
                    <tr key={l.container_id}>
                      <td style={{ ...TD, ...mono, cursor: "pointer", color: C.accent }} onClick={() => setDetail(l)}>{l.container_no} <span style={{ color: C.muted }}>({l.size}')</span></td>
                      <td style={TD}>{l.consignee}<div style={{ fontSize: 11, color: C.muted }}>{l.cha}</div></td>
                      <td style={{ ...TD, fontSize: 12 }}>{l.commodity}</td>
                      <td style={{ ...TD, ...mono, textAlign: "right", fontWeight: 700, color: slabColor }}>{l.dwell}d</td>
                      <td style={{ ...TD, fontSize: 12, color: slabColor }}>{b?.label}</td>
                      <td style={{ ...TD, ...mono, textAlign: "right" }}>₹{fmt(l.expected)}</td>
                      <td style={{ ...TD, textAlign: "right" }}>
                        {l.dwell > 3 && <button style={btn} onClick={() => issueDemandNotice(l)}>Demand notice →</button>}
                      </td>
                    </tr>
                  );
                })}</tbody>
              </table>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 12 }}>
                Aging mirrors the published holding slabs — 3 free days, then ₹500/day (20') escalating to ₹5,000/day from day 91 (40' = 2×). Click a container for the itemised charge sheet.
              </div>
            </div>

            {/* ── DWELL OPTIMISATION ── */}
            <div style={{ borderTop: `2px solid ${C.border}`, margin: "4px 0 20px", position: "relative" }}>
              <span style={{ position: "absolute", top: -10, left: 0, background: C.bg, paddingRight: 12, fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "1px" }}>Dwell Optimisation</span>
            </div>

            {/* Summary chips */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 20 }}>
              {[
                {
                  label: "Closed boxes cleared ≤5 days",
                  value: `${DWELL_SUMMARY.pctCleared5d}%`,
                  sub: "target: >70% — handling trumps ground rent",
                  hot: DWELL_SUMMARY.pctCleared5d < 70,
                },
                {
                  label: "Ground rent share of revenue",
                  value: `${DWELL_SUMMARY.groundRentShareOfTotal}%`,
                  sub: `₹${fmt(DWELL_SUMMARY.totalGroundRentRevenue)} earned — slot cost not captured`,
                  hot: DWELL_SUMMARY.groundRentShareOfTotal > 20,
                },
                {
                  label: "Escalations within 5 days",
                  value: `${DWELL_SUMMARY.nudgeCount}`,
                  sub: "containers crossing to next slab this week",
                  hot: DWELL_SUMMARY.nudgeCount > 0,
                },
              ].map(s => (
                <div key={s.label} style={{ background: C.surface, border: `1px solid ${s.hot ? C.red : C.border}`, borderRadius: 8, padding: 14 }}>
                  <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.7px" }}>{s.label}</div>
                  <div style={{ fontSize: 24, fontWeight: 700, ...mono, marginTop: 6, color: s.hot ? C.red : C.text }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{s.sub}</div>
                </div>
              ))}
            </div>

            {/* Escalation tracker */}
            <div style={card}>
              <div style={sectionTitle}>Escalation tracker — slab countdown for in-yard containers</div>
              <div style={{ fontSize: 13, color: C.muted, marginBottom: 14 }}>
                Handling fees are earned once at clearance regardless of dwell. Each additional day in a paid slab earns ground rent but blocks the slot from the next consignment's handling fee. Prioritise clearance of containers approaching slab jumps.
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr>
                  <th style={TH}>Container</th>
                  <th style={TH}>Consignee</th>
                  <th style={TH}>Cargo / class</th>
                  <th style={{ ...TH, textAlign: "right" }}>Dwell</th>
                  <th style={{ ...TH, textAlign: "right" }}>Rate today</th>
                  <th style={TH}>Next escalation</th>
                  <th style={{ ...TH, textAlign: "right" }}>Next rate/day</th>
                  <th style={{ ...TH, textAlign: "right" }}>Accrued</th>
                </tr></thead>
                <tbody>
                  {[...YARD].sort((a, b) => {
                    const da = a.slabInfo?.isMaxSlab ? 9999 : (a.slabInfo?.daysUntilEscalation ?? 9998);
                    const db = b.slabInfo?.isMaxSlab ? 9999 : (b.slabInfo?.daysUntilEscalation ?? 9998);
                    return da - db;
                  }).map(l => {
                    const si = l.slabInfo;
                    const urgencyColor = si?.isMaxSlab ? C.red
                      : si?.daysUntilEscalation <= 2 ? C.red
                      : si?.daysUntilEscalation <= 5 ? C.yellow
                      : C.muted;
                    return (
                      <tr key={l.container_id}>
                        <td style={{ ...TD, ...mono, cursor: "pointer", color: C.accent }} onClick={() => setDetail(l)}>
                          {l.container_no} <span style={{ color: C.muted }}>({l.size}')</span>
                        </td>
                        <td style={TD}>{l.consignee}<div style={{ fontSize: 11, color: C.muted }}>{l.cha}</div></td>
                        <td style={{ ...TD, fontSize: 12 }}>{l.commodity}<div style={{ fontSize: 11, color: C.muted }}>{l.cargo_class}</div></td>
                        <td style={{ ...TD, ...mono, textAlign: "right", fontWeight: 700, color: l.dwell > 30 ? C.red : l.dwell > 15 ? C.yellow : C.text }}>
                          {l.dwell}d
                        </td>
                        <td style={{ ...TD, ...mono, textAlign: "right" }}>
                          {si?.isFree
                            ? <span style={{ color: C.green }}>Free</span>
                            : si ? `₹${fmt(si.currentRate)}/d` : "—"}
                        </td>
                        <td style={{ ...TD, fontSize: 12, color: urgencyColor, fontWeight: si?.daysUntilEscalation <= 5 ? 600 : 400 }}>
                          {si?.isMaxSlab
                            ? <span style={{ color: C.red }}>Max slab — no further escalation</span>
                            : si?.daysUntilEscalation === 1
                            ? `Tomorrow · ${si.escalationDate}`
                            : si?.daysUntilEscalation != null
                            ? `${si.daysUntilEscalation} days · ${si.escalationDate}`
                            : "—"}
                        </td>
                        <td style={{ ...TD, ...mono, textAlign: "right", color: si?.nextRate ? C.muted : C.red }}>
                          {si?.nextRate ? `₹${fmt(si.nextRate)}/d` : si?.isMaxSlab ? `₹${fmt(si.currentRate)}/d` : "—"}
                        </td>
                        <td style={{ ...TD, ...mono, textAlign: "right" }}>₹{fmt(l.expected)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Consignee dwell profile */}
            <div style={card}>
              <div style={sectionTitle}>Consignee dwell profile — handling vs ground rent revenue split (import)</div>
              <div style={{ fontSize: 13, color: C.muted, marginBottom: 14 }}>
                When ground rent forms a high share of an account's revenue, that consignee is occupying slots beyond their billing value — the handling fees a fast-turning replacement box would have generated are foregone. Target: ≥70% of boxes cleared within 5 days.
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr>
                  <th style={TH}>Consignee</th>
                  <th style={{ ...TH, textAlign: "right" }}>Boxes</th>
                  <th style={{ ...TH, textAlign: "right" }}>Avg dwell</th>
                  <th style={{ ...TH, textAlign: "right" }}>≤5d cleared</th>
                  <th style={{ ...TH, textAlign: "right" }}>Avg handling</th>
                  <th style={{ ...TH, textAlign: "right" }}>Avg ground rent</th>
                  <th style={{ ...TH, textAlign: "right" }}>Ground rent %</th>
                  <th style={TH}>Profile</th>
                </tr></thead>
                <tbody>
                  {BY_CONSIGNEE
                    .filter(r => LEDGER.some(l => l.consignee === r.key && l.direction === "Import"))
                    .sort((a, b) => parseFloat(b.avgDwell) - parseFloat(a.avgDwell))
                    .map(r => {
                      const isSlow = r.groundRentShare > 30 || (r.pctCleared5d !== null && r.pctCleared5d < 20);
                      const isFast = r.pctCleared5d !== null && r.pctCleared5d >= 70 && r.groundRentShare < 15;
                      const dwellNum = parseFloat(r.avgDwell);
                      return (
                        <tr key={r.key}>
                          <td style={TD}>{r.key}</td>
                          <td style={{ ...TD, ...mono, textAlign: "right" }}>{r.boxes}</td>
                          <td style={{ ...TD, ...mono, textAlign: "right", color: dwellNum > 15 ? C.red : dwellNum > 7 ? C.yellow : C.green }}>
                            {r.avgDwell}d
                          </td>
                          <td style={{ ...TD, ...mono, textAlign: "right", color: r.pctCleared5d === null ? C.muted : r.pctCleared5d >= 70 ? C.green : r.pctCleared5d >= 40 ? C.yellow : C.red }}>
                            {r.pctCleared5d === null ? "—" : `${r.pctCleared5d}%`}
                          </td>
                          <td style={{ ...TD, ...mono, textAlign: "right" }}>₹{fmt(r.avgHandling)}</td>
                          <td style={{ ...TD, ...mono, textAlign: "right", color: r.groundRentShare > 30 ? C.red : r.groundRentShare > 15 ? C.yellow : C.muted }}>
                            ₹{fmt(r.avgGroundRent)}
                          </td>
                          <td style={{ ...TD, ...mono, textAlign: "right", fontWeight: r.groundRentShare > 30 ? 700 : 400, color: r.groundRentShare > 30 ? C.red : r.groundRentShare > 15 ? C.yellow : C.green }}>
                            {r.groundRentShare}%
                          </td>
                          <td style={{ ...TD, fontSize: 12 }}>
                            {isFast
                              ? <span style={{ color: C.green, fontWeight: 600 }}>Fast clearer</span>
                              : isSlow
                              ? <span style={{ color: C.red, fontWeight: 600 }}>Chronic slow</span>
                              : <span style={{ color: C.muted }}>Normal</span>}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 12 }}>
                Ground rent % = ground rent revenue as share of total invoiced revenue per account. In-yard containers counted in avg dwell but excluded from ≤5d cleared (not yet closed).
              </div>
            </div>
          </>
        )}

        {/* ── BILL — demand notices & long-stay escalation ── */}
        {stage === "bill" && (
          <div style={card}>
            <div style={sectionTitle}>Long-stay exposure & Section 48 auction track (&gt;30 days in yard)</div>
            {LONG_STAY.length === 0 && <div style={{ color: C.muted }}>No boxes over 30 days. Clean yard.</div>}
            {LONG_STAY.map(l => {
              const auctionCosts = TARIFF.auction.handling_per_box + TARIFF.auction.valuation_noc;
              return (
                <div key={l.container_id} style={{ border: `1px solid ${l.dwell > 90 ? C.red : C.border}`, borderRadius: 8, padding: 16, marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                    <div>
                      <span style={{ ...mono, color: C.accent, cursor: "pointer" }} onClick={() => setDetail(l)}>{l.container_no}</span>
                      <span style={{ color: C.muted, fontSize: 12 }}> · {l.size}' · {l.commodity} · {l.consignee} ({l.cha})</span>
                    </div>
                    <div style={{ ...mono, fontWeight: 700, color: l.dwell > 90 ? C.red : C.yellow }}>{l.dwell} days</div>
                  </div>
                  <div style={{ display: "flex", gap: 24, marginTop: 10, fontSize: 12, flexWrap: "wrap" }}>
                    <span>Accrued dues: <b style={mono}>₹{fmt(l.expected)}</b></span>
                    <span style={{ color: C.muted }}>Auction-track costs: ₹{fmt(auctionCosts)} (handling ₹{fmt(TARIFF.auction.handling_per_box)} + valuation/NOC ₹{fmt(TARIFF.auction.valuation_noc)})</span>
                    <span style={{ color: C.muted }}>Slot blocked: {l.dwell} days × {l.teu} TEU</span>
                  </div>
                  <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                    <button style={btn} onClick={() => issueDemandNotice(l)}>Final demand notice →</button>
                    {l.dwell > 60 && <button style={{ ...btn, borderColor: C.red, color: C.red }} onClick={() => issueAuctionDocket(l)}>Section 48 auction docket →</button>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── RECOVER — tariff reconciliation & leakage ── */}
        {stage === "recover" && (
          <>
            <div style={card}>
              <div style={sectionTitle}>Tariff reconciliation — billing system vs published tariff</div>
              <div style={{ fontSize: 13, color: C.muted, marginBottom: 14 }}>
                Every container's charges recomputed from the published tariff and diffed against the invoiced amount from your billing extract.
                <b style={{ color: C.red }}> ₹{fmt(TOTAL_LEAKAGE)} of undercharges found across {LEAKS.length} of {LEDGER.length} boxes ({((LEAKS.length / LEDGER.length) * 100).toFixed(0)}%).</b>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr>
                  <th style={TH}>Container</th><th style={TH}>Consignee</th><th style={TH}>Cause detected</th>
                  <th style={{ ...TH, textAlign: "right" }}>Expected</th><th style={{ ...TH, textAlign: "right" }}>Invoiced</th>
                  <th style={{ ...TH, textAlign: "right" }}>Shortfall</th><th style={TH}></th>
                </tr></thead>
                <tbody>{LEAKS.map(l => (
                  <tr key={l.container_id}>
                    <td style={{ ...TD, ...mono, cursor: "pointer", color: C.accent }} onClick={() => setDetail(l)}>{l.container_no}</td>
                    <td style={TD}>{l.consignee}</td>
                    <td style={{ ...TD, fontSize: 12, color: C.muted }}>{l.leak_reason}</td>
                    <td style={{ ...TD, ...mono, textAlign: "right" }}>₹{fmt(l.expected)}</td>
                    <td style={{ ...TD, ...mono, textAlign: "right" }}>₹{fmt(l.invoiced)}</td>
                    <td style={{ ...TD, ...mono, textAlign: "right", color: C.red, fontWeight: 700 }}>₹{fmt(-l.variance)}</td>
                    <td style={{ ...TD, textAlign: "right" }}><button style={btn} onClick={() => issueDebitNote(l)}>Debit note →</button></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <div style={card}>
              <div style={sectionTitle}>Rate revision exhibit — 2023 sheet vs current published sheet (Chennai Port, GP)</div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr><th style={TH}>Service</th><th style={{ ...TH, textAlign: "right" }}>20' (2023)</th><th style={{ ...TH, textAlign: "right" }}>20' (current)</th><th style={{ ...TH, textAlign: "right" }}>40' (2023)</th><th style={{ ...TH, textAlign: "right" }}>40' (current)</th></tr></thead>
                <tbody>
                  {[["Load-out delivery", TARIFF.handling_import.Chennai.GP.loadout, TARIFF_REVISION.handling_import_chennai_GP.loadout],
                    ["De-stuffing service", TARIFF.handling_import.Chennai.GP.destuff, TARIFF_REVISION.handling_import_chennai_GP.destuff]].map(([label, old, nw]) => (
                    <tr key={label}>
                      <td style={TD}>{label}</td>
                      <td style={{ ...TD, ...mono, textAlign: "right" }}>₹{fmt(old.s20)}</td>
                      <td style={{ ...TD, ...mono, textAlign: "right", color: C.green }}>₹{fmt(nw.s20)} <span style={{ fontSize: 11, color: C.muted }}>(+{Math.round((nw.s20 / old.s20 - 1) * 100)}%)</span></td>
                      <td style={{ ...TD, ...mono, textAlign: "right" }}>₹{fmt(old.s40)}</td>
                      <td style={{ ...TD, ...mono, textAlign: "right", color: C.green }}>₹{fmt(nw.s40)} <span style={{ fontSize: 11, color: C.muted }}>(+{Math.round((nw.s40 / old.s40 - 1) * 100)}%)</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 10 }}>If any box was billed on the old sheet after the revision date, the reconciliation engine flags it — the same diff that catches slab errors catches stale rate cards.</div>
            </div>
          </>
        )}

        {/* ── INTELLIGENCE rail — AI query ── */}
        {stage === "intelligence" && (
          <>
            <div style={{ marginBottom: 20 }}>
              <div style={sectionTitle}>Try a sample question</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {CFS_SAMPLE_QUESTIONS.map((q, i) => (
                  <button key={i} onClick={() => { setQuestion(q); handleQuery(q); }}
                    style={{ padding: "7px 14px", borderRadius: 20, border: `1px solid ${C.border}`, background: "transparent", color: C.muted, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                    {q}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
              <input value={question} onChange={e => setQuestion(e.target.value)} onKeyDown={e => e.key === "Enter" && handleQuery()}
                placeholder="Ask about dwell, leakage, margins, consignees, CHAs…"
                style={{ flex: 1, padding: "12px 16px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, color: C.text, fontSize: 14, fontFamily: "inherit", outline: "none" }} />
              <button onClick={() => handleQuery()} disabled={loading}
                style={{ padding: "12px 24px", borderRadius: 8, border: "none", background: C.accent, color: "#000", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
                {loading ? "Analysing…" : "Ask →"}
              </button>
            </div>
            {result && (
              <div style={card}>
                <div style={{ fontSize: 13, color: C.muted, marginBottom: 8 }}>{result.question}</div>
                <div style={{ fontSize: 15, marginBottom: 14 }}>{result.summary}</div>
                {result.table?.length > 0 && (
                  <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 14 }}>
                    <thead><tr>{Object.keys(result.table[0]).map(k => <th key={k} style={TH}>{k}</th>)}</tr></thead>
                    <tbody>{result.table.map((row, i) => (
                      <tr key={i}>{Object.values(row).map((v, j) => <td key={j} style={{ ...TD, fontSize: 12 }}>{String(v)}</td>)}</tr>
                    ))}</tbody>
                  </table>
                )}
                {result.insight && <div style={{ fontSize: 13, color: C.accent }}>💡 {result.insight}</div>}
                {result.sql && <pre style={{ fontSize: 11, color: C.muted, ...mono, marginTop: 12, whiteSpace: "pre-wrap" }}>{result.sql}</pre>}
              </div>
            )}
          </>
        )}

        {/* ── PROFITABILITY rail ── */}
        {stage === "profitability" && (
          <>
            <div style={card}>
              <div style={sectionTitle}>Margin by consignee (revenue = invoiced · cost = activity-based allocation)</div>
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
                    <td style={{ ...TD, ...mono, textAlign: "right", color: r.marginPct < 35 ? C.red : C.green }}>{r.marginPct}%</td>
                    <td style={{ ...TD, ...mono, textAlign: "right" }}>{r.avgDwell}d</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <div style={card}>
                <div style={sectionTitle}>Margin by cargo class</div>
                {BY_CLASS.map(r => (
                  <div key={r.key} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
                    <span>{r.key} <span style={{ color: C.muted, fontSize: 11 }}>({r.boxes} boxes)</span></span>
                    <span style={{ ...mono, color: r.marginPct < 35 ? C.red : C.green }}>₹{fmt(r.margin)} · {r.marginPct}%</span>
                  </div>
                ))}
                <div style={{ fontSize: 12, color: C.muted, marginTop: 10 }}>ODC's +25% handling premium vs crane hire & double holding — check whether the premium actually covers the equipment cost.</div>
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
        {stage === "register" && (
          <div style={card}>
            <div style={sectionTitle}>Action register — every artifact generated, auditable</div>
            {register.length === 0 && <div style={{ color: C.muted, fontSize: 13 }}>No actions yet. Debit notes, demand notices, auction dockets and memos generated from other stages land here.</div>}
            {register.length > 0 && (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr><th style={TH}>Ref</th><th style={TH}>Type</th><th style={TH}>Party</th><th style={TH}>Container</th><th style={{ ...TH, textAlign: "right" }}>Amount</th><th style={TH}>Date</th></tr></thead>
                <tbody>{register.map(r => (
                  <tr key={r.ref}>
                    <td style={{ ...TD, ...mono, fontSize: 12 }}>{r.ref}</td>
                    <td style={TD}>{r.type}</td>
                    <td style={TD}>{r.party}</td>
                    <td style={{ ...TD, ...mono, fontSize: 12 }}>{r.container_no}</td>
                    <td style={{ ...TD, ...mono, textAlign: "right" }}>{r.amount ? `₹${fmt(r.amount)}` : "—"}</td>
                    <td style={{ ...TD, ...mono, fontSize: 12 }}>{r.date}</td>
                  </tr>
                ))}</tbody>
              </table>
            )}
            {register.length > 0 && (
              <button style={{ ...btn, marginTop: 14, borderColor: C.border, color: C.muted }}
                onClick={() => { clearRegister(); showToast("Register cleared"); }}>
                Clear register
              </button>
            )}
          </div>
        )}

      </LifecycleShell>
    </div>
  );
}

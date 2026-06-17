import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { C, applyTheme } from "../data/constants.js";
import { SCHEMA_DESC_CFS, CFS_SAMPLE_QUESTIONS, TARIFF, TARIFF_REVISION } from "./constants.js";
import {
  fmt, TODAY, MANALI_CAPACITY, bucketOf, getComputations,
} from "./computations.js";
import { openPrintable } from "../core/artifacts.js";
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

  const {
    LEDGER, LEAKS, TOTAL_LEAKAGE, YARD, YARD_ACCRUED, LONG_STAY,
    BY_CONSIGNEE, BY_CHA, BY_CLASS, BY_PORT, SLOT_ECONOMICS, MONTHLY_THROUGHPUT,
    TOTALS,
  } = getComputations(terminal.abbr);

  const [stage, setStage] = useState("recover");
  const [toast, setToast] = useState(null);
  const [detail, setDetail] = useState(null);

  const makeRef = (n, { type }, abbr) =>
    `${abbr}/${type.split(" ")[0].toUpperCase()}/${String(n).padStart(4, "0")}`;

  const [reg0, push0, clear0] = useRegister("nexus_action_register",  (n, f) => makeRef(n, f, "NXS"));
  const [reg1, push1, clear1] = useRegister("balmer_action_register",   (n, f) => makeRef(n, f, "BCT"));
  const register      = termIdx === 0 ? reg0  : reg1;
  const pushToRegister = termIdx === 0 ? push0 : push1;
  const clearRegister  = termIdx === 0 ? clear0 : clear1;

  const print = (title, bodyHtml, refNo) => openPrintable(terminal, title, bodyHtml, refNo);

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
    const ref = logAction("Demand Notice", l.consignee, l.container_no, l.expected);
    print("Demand Notice", `
      <h2>Demand Notice — Accrued CFS Charges</h2>
      <p>To: <b>${l.consignee}</b> (through CHA: ${l.cha})</p>
      <p>Container <b>${l.container_no}</b> (${l.size}', ${l.commodity}) arrived at our CFS on ${l.arrival_date} and remains uncleared for <b>${l.dwell} days</b>.</p>
      <table><tr><th>Charge head</th><th>Amount (₹)</th></tr>
      ${l.billing_lines.map(b => `<tr><td>${b.label}</td><td>${fmt(b.amount)}</td></tr>`).join("")}
      <tr><th>Total accrued to date</th><th>₹${fmt(l.expected)} + GST</th></tr></table>
      <p>Ground rent continues to accrue daily per the published slab. You are requested to clear the consignment and settle all dues within 7 days, failing which action under Section 48 of the Customs Act, 1962 (disposal of uncleared goods) will be initiated.</p>`, ref);
    showToast(`Demand notice ${ref} generated & logged`);
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

      {detail && (
        <div onClick={() => setDetail(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.card, borderRadius: 12, padding: 28, width: 640, maxHeight: "85vh", overflowY: "auto", border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 17, fontWeight: 600 }}>{detail.container_no} <span style={{ color: C.muted, fontSize: 13 }}>· {detail.size}' {detail.cargo_class} · {detail.consignee}</span></div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 18, ...mono }}>ex-{detail.port} · arrived {detail.arrival_date} · dwell {detail.dwell}d {detail.in_yard ? "· IN YARD" : `· gated out ${detail.gate_out}`}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <div>
                <div style={sectionTitle}>Charges per published tariff</div>
                {detail.billing_lines.map((b, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0", borderBottom: `1px solid ${C.border}` }}>
                    <span style={{ color: C.muted }}>{b.label}</span><span style={mono}>₹{fmt(b.amount)}</span>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, padding: "8px 0", color: C.accent }}>
                  <span>Expected</span><span style={mono}>₹{fmt(detail.expected)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: C.muted }}>Invoiced (billing system)</span><span style={mono}>₹{fmt(detail.invoiced)}</span>
                </div>
                {detail.variance < 0 && <div style={{ marginTop: 8, fontSize: 12, color: C.red }}>Leakage ₹{fmt(-detail.variance)} — {detail.leak_reason}</div>}
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

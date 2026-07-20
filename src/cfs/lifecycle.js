// ── CFS LIFECYCLE RECORDS — deterministic derivations from a container ────────
// The yard/billing export gives us the commercial spine (arrival, destuff, gate-out,
// flags). A real TOS also holds the *physical* record behind each of those dates:
// the gate transaction that issued an EIR, the customs milestones ICEGATE pushed,
// the rehandles the yard actually paid for, and the de-stuff work order that ended
// the box's dwell. None of that is in the source data, so we synthesise it here —
// deterministically from container_id, so a given box always shows the same record.
//
// Everything is a pure function of the container. No storage, no side effects.

import { TARIFF } from "./constants.js";
import { dwellDays, TODAY } from "./computations.js";

// Deterministic 0..1 stream keyed by (id, salt) — stable across reloads.
function rand(id, salt) {
  let h = 2166136261 ^ salt;
  for (const ch of id) { h = Math.imul(h ^ ch.charCodeAt(0), 16777619); }
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
  return ((h >>> 0) % 100000) / 100000;
}
const pick = (id, salt, arr) => arr[Math.floor(rand(id, salt) * arr.length)];
const between = (id, salt, lo, hi) => lo + Math.floor(rand(id, salt) * (hi - lo + 1));
const addDays = (iso, n) => { const d = new Date(iso); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

const TRANSPORTERS = ["Sanco Trans", "SKS Roadways", "Triway Carriers", "Everest Transport", "Natesa Fleet", "Coastal Haulage"];
const DRIVERS = ["Murugan S", "Rajesh K", "Anand P", "Selvam R", "Karthik V", "Iqbal M", "Prakash D", "Venkat N"];
const RTO = ["TN 22", "TN 04", "TN 18", "TN 88", "TN 11", "TN 23"];
const RTO_SERIES = ["BQ", "CH", "AL", "DK", "AG", "CP"];
const CONDITIONS = [
  { code: "SOUND", label: "Sound — no exceptions", tone: "ok" },
  { code: "DENT-MNR", label: "Minor door dent, no ingress", tone: "warn" },
  { code: "SCRATCH", label: "Surface scratches, cosmetic", tone: "ok" },
  { code: "RAIL-BENT", label: "Bottom rail slightly bent", tone: "warn" },
  { code: "SEAL-INTACT", label: "Line seal intact, verified", tone: "ok" },
];

// Approx unladen tare (kg) — realistic for standard steel boxes.
const TARE = { 20: 2230, 40: 3740 };

/** The gate-in transaction: truck, driver, weighbridge, seal, EIR survey. */
export function gateRecord(c) {
  const plate = `${pick(c.container_id, 1, RTO)} ${pick(c.container_id, 2, RTO_SERIES)} ${between(c.container_id, 3, 1000, 9989)}`;
  const tare = TARE[c.size];
  const net = c.direction === "Export"
    ? between(c.container_id, 4, c.size === 20 ? 6000 : 10000, c.size === 20 ? 18000 : 24000)
    : between(c.container_id, 4, c.size === 20 ? 8000 : 12000, c.size === 20 ? 21000 : 26000);
  const cond = pick(c.container_id, 6, CONDITIONS);
  // Gate-in lands on the arrival date; time-of-day is seeded.
  const hh = String(between(c.container_id, 7, 6, 21)).padStart(2, "0");
  const mm = String(between(c.container_id, 8, 0, 59)).padStart(2, "0");
  return {
    eir_no: `EIR/${c.container_id.replace("CN", "")}/${c.arrival_date.slice(2, 4)}`,
    gate: c.direction === "Export" ? "OUT" : "IN",
    datetime: `${c.arrival_date} ${hh}:${mm}`,
    truck_no: plate,
    driver: pick(c.container_id, 5, DRIVERS),
    transporter: pick(c.container_id, 9, TRANSPORTERS),
    seal_no: `${c.line.slice(0, 3).toUpperCase()}${between(c.container_id, 10, 100000, 999999)}`,
    seal_status: "Intact — verified at gate",
    tare_kg: tare,
    gross_kg: tare + net,
    net_kg: net,
    weighbridge: `WB-${between(c.container_id, 11, 1, 3)}`,
    condition: cond,
  };
}

// ── Customs status trail (ICEGATE / PCS feed) ────────────────────────────────
// Import boxes clear through Bill of Entry; the milestones below are the events
// ICEGATE would push to the CFS. Dates hang off arrival and de-stuff.
export function customsTrail(c) {
  if (c.direction === "Export") {
    return {
      source: "ICEGATE",
      doc_no: `SB ${between(c.container_id, 20, 4000000, 8999999)}`,
      doc_label: "Shipping Bill",
      milestones: [
        { code: "SB-FILED", label: "Shipping Bill filed", date: addDays(c.arrival_date, -2), done: true },
        { code: "LEO", label: "Let Export Order (LEO)", date: c.arrival_date, done: true },
        { code: "STUFFED", label: "Stuffed & sealed under supervision", date: c.destuff_date || c.arrival_date, done: !!c.destuff_date },
        { code: "GATED-OUT", label: "Gated out to port", date: c.gate_out, done: !!c.gate_out },
      ],
    };
  }
  const beDate = addDays(c.arrival_date, -between(c.container_id, 21, 0, 2));
  const assessDate = addDays(c.arrival_date, 1);
  const oocDate = c.destuff_date ? addDays(c.destuff_date, between(c.container_id, 22, 0, 2)) : null;
  const ms = [
    { code: "IGM", label: "IGM filed by line", date: addDays(c.arrival_date, -3), done: true },
    { code: "BE-FILED", label: "Bill of Entry filed", date: beDate, done: true },
    { code: "ASSESSED", label: "Assessed — duty determined", date: assessDate, done: true },
  ];
  if (c.examined) ms.push({ code: "EXAM", label: "Examination order — 25%+ de-stuff", date: addDays(assessDate, 1), done: true });
  if (c.scanned) ms.push({ code: "SCAN", label: "Scanning referred (Nact/SIIB)", date: addDays(assessDate, 1), done: true });
  ms.push({ code: "OOC", label: "Out of Charge (OOC)", date: oocDate, done: !!oocDate && oocDate <= TODAY });
  ms.push({ code: "DELIVERED", label: "Duty paid & delivery order", date: c.gate_out, done: !!c.gate_out });
  return {
    source: "ICEGATE",
    doc_no: `BE ${between(c.container_id, 20, 4000000, 8999999)}`,
    doc_label: "Bill of Entry",
    hold: c.container_id === "CN052" ? "Customs query — valuation dispute" : null,
    milestones: ms,
  };
}

// ── Rehandle events — what the yard twin's policy is trying to prevent ────────
// A rehandle is an unplanned lift to dig out a buried box whose neighbour was
// called first. The interactive yard twin teaches the LIFO rule that avoids it;
// this is the production side — rehandles that actually happened and must be
// billed. Priced at the published lift-on/lift-off (laden) rate.
export function rehandleEvents(c) {
  if (!c.in_yard || c.direction === "Export") return [];
  const dwell = dwellDays(c);
  // Deeper-buried, longer-dwelling boxes accumulate more digs. Short-dwell boxes: none.
  const count = dwell < 8 ? 0 : dwell < 20 ? (rand(c.container_id, 30) > 0.55 ? 1 : 0) : between(c.container_id, 31, 1, 2);
  const rate = TARIFF.ancillary.lift_onoff_laden[c.size === 20 ? "s20" : "s40"];
  const REASONS = [
    "Buried box called for delivery — top box lifted off",
    "Customs examination — box dug out of stack",
    "Survey re-inspection — restacked after access",
  ];
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push({
      date: addDays(c.arrival_date, between(c.container_id, 32 + i, 2, Math.max(3, dwell - 1))),
      reason: pick(c.container_id, 33 + i, REASONS),
      cost: rate,
    });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

// ── De-stuff / stuff work order — the job that ends an import box's dwell ─────
export function workOrder(c) {
  const isExport = c.direction === "Export";
  const done = !!c.destuff_date && c.destuff_date <= TODAY;
  // LCL boxes carry many packages; FCL a single consignment.
  const lcl = rand(c.container_id, 40) > 0.7;
  const packages = lcl ? between(c.container_id, 41, 40, 260) : between(c.container_id, 41, 1, 4);
  return {
    wo_no: `WO/${isExport ? "STF" : "DST"}/${c.container_id.replace("CN", "")}`,
    kind: isExport ? "Stuffing" : "De-stuffing",
    lcl,
    packages,
    dock: `Dock ${pick(c.container_id, 42, ["A", "B", "C", "D"])}-${between(c.container_id, 43, 1, 6)}`,
    crew: `Gang ${between(c.container_id, 44, 1, 5)}`,
    scheduled_date: c.destuff_date,
    status: done ? "Completed" : c.destuff_date ? "Scheduled" : "Awaiting order",
    examined: c.examined,
  };
}

export const REHANDLE_RATE = TARIFF.ancillary.lift_onoff_laden;

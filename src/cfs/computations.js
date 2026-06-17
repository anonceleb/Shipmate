// ── SATTVA CFS — TARIFF BILLING / COST / PROFITABILITY ENGINE ─────────────────
import { TARIFF, CONTAINERS, INVOICE_ADJUSTMENTS, COST_DRIVERS, FACILITIES } from "./constants.js";

export const fmt = n => new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n);
export const TODAY = new Date().toISOString().slice(0, 10);

const dayDiff = (a, b) => Math.max(1, Math.round((new Date(b) - new Date(a)) / 86400000) + 1); // inclusive occupancy days
const sz = c => (c.size === 20 ? "s20" : "s40");
const teu = c => (c.size === 20 ? 1 : 2);

export const dwellDays = c => dayDiff(c.arrival_date, c.gate_out || TODAY);
export const inYard = c => !c.gate_out;

// Ground rent for a span of [1..days] occupancy under the import slabs.
export function groundRent(days, size, holdingMult = 1) {
  let total = 0;
  for (const slab of TARIFF.holding_import) {
    if (days < slab.from) break;
    const upto = Math.min(days, slab.to);
    total += (upto - slab.from + 1) * slab[size === 20 ? "s20" : "s40"];
  }
  return Math.round(total * holdingMult);
}

// Itemised expected billing per container, straight from the published tariff.
export function computeBilling(c) {
  const s = sz(c), lines = [];
  const add = (label, amount) => { if (amount > 0) lines.push({ label, amount: Math.round(amount) }); };

  if (c.direction === "Export") {
    add("Stuffing (yard, mechanical)", TARIFF.export.stuffing_yard_mech[s]);
    add("Documentation", TARIFF.export.documentation);
    add("RFID / Transecure / seal scanning", TARIFF.export.rfid_seal[s]);
    if (c.weighment) add("Weighment", TARIFF.export.weighment);
    const days = dwellDays(c);
    let hold = 0;
    for (const slab of TARIFF.export.holding) {
      if (days < slab.from) break;
      hold += (Math.min(days, slab.to) - slab.from + 1) * slab[s];
    }
    add(`Holding (${days} days)`, hold);
  } else {
    const rules = TARIFF.class_rules[c.cargo_class] || TARIFF.class_rules.GP;
    const handlingClass = c.cargo_class === "ODC" ? "ODC" : "GP";
    const base = TARIFF.handling_import[c.port][handlingClass].destuff[s];
    add(`Handling & movement — ${c.port} (${c.cargo_class})`, base * rules.handling_mult);
    if (c.examined) add("De-stuffing >25% for customs examination", TARIFF.exam_destuff[s]);
    const days = dwellDays(c);
    add(`Ground rent (${days} days, ${c.cargo_class})`, groundRent(days, c.size, rules.holding_mult));
    add("Energy surcharge", TARIFF.ancillary.energy_surcharge[s]);
    if (c.weighment) add("Weighment", TARIFF.ancillary.weighment);
    if (c.scanned) add("Scanning movement", TARIFF.ancillary.scanning_movement);
    if (c.cargo_class === "Reefer") {
      const plugDays = dayDiff(c.arrival_date, c.destuff_date || c.gate_out || TODAY);
      add(`Reefer plugging & monitoring (${plugDays} days)`, TARIFF.ancillary.reefer_plugging[s] * plugDays);
    }
    add("RFID container tracking", TARIFF.ancillary.rfid_per_teu * teu(c));
    add("Risk management / insurance", TARIFF.ancillary.risk_mgmt_per_teu * teu(c));
    add("Seal (OTL)", TARIFF.ancillary.seal_otl);
  }
  const total = lines.reduce((t, l) => t + l.amount, 0);
  return { lines, total };
}

// Activity-based cost allocation per container.
export function computeCost(c) {
  const s = sz(c), lines = [];
  const add = (label, amount) => { if (amount > 0) lines.push({ label, amount: Math.round(amount) }); };
  const days = dwellDays(c);

  if (c.direction === "Export") {
    add("Stuffing labour & equipment", COST_DRIVERS.export_stuffing_labour[s]);
    add("Lifts (2 moves)", COST_DRIVERS.lift_per_move[s] * 2);
  } else {
    add(`Trailer trip (${c.port})`, COST_DRIVERS.trailer_trip[c.port][s]);
    add("Lifts (2 moves)", COST_DRIVERS.lift_per_move[s] * 2);
    add("De-stuffing labour", COST_DRIVERS.destuff_labour[s]);
    if (c.cargo_class === "ODC") add("Crane hire", COST_DRIVERS.crane_hire_odc[s]);
    if (c.cargo_class === "Reefer") add(`Reefer power (${days} days)`, COST_DRIVERS.reefer_power_day[s] * days);
    if (c.examined) add("Examination supervision", COST_DRIVERS.exam_extra[s]);
    if (c.scanned) add("Scanner shuttle", COST_DRIVERS.scan_shuttle);
  }
  add(`Yard overhead (${days} slot-days)`, COST_DRIVERS.overhead_slot_day[s] * days);
  add("Documentation & admin", COST_DRIVERS.admin_per_box);
  const total = lines.reduce((t, l) => t + l.amount, 0);
  return { lines, total };
}

// ── PER-CONTAINER LEDGER (the spine everything renders from) ──────────────────
const ADJ = Object.fromEntries(INVOICE_ADJUSTMENTS.map(a => [a.container_id, a]));

export const DWELL_BUCKETS = [
  { label: "0–3 (free)", min: 1, max: 3 },
  { label: "4–7",        min: 4, max: 7 },
  { label: "8–15",       min: 8, max: 15 },
  { label: "16–30",      min: 16, max: 30 },
  { label: "31–60",      min: 31, max: 60 },
  { label: "61–90",      min: 61, max: 90 },
  { label: "91+",        min: 91, max: 99999 },
];
export const bucketOf = d => DWELL_BUCKETS.find(b => d >= b.min && d <= b.max);

export function getComputations(terminalAbbr) {
  const terminalContainers = CONTAINERS.filter((c, idx) => {
    return terminalAbbr === "NXS" ? idx % 2 === 0 : idx % 2 !== 0;
  });

  const LEDGER = terminalContainers.map(c => {
    const billing = computeBilling(c);
    const cost = computeCost(c);
    const adj = ADJ[c.container_id];
    const invoiced = billing.total + (adj?.delta || 0);
    return {
      ...c,
      teu: teu(c),
      dwell: dwellDays(c),
      in_yard: inYard(c),
      expected: billing.total,
      billing_lines: billing.lines,
      invoiced,
      variance: invoiced - billing.total,         // negative = leakage
      leak_reason: adj?.reason || null,
      cost: cost.total,
      cost_lines: cost.lines,
      margin: invoiced - cost.total,
    };
  });

  const LEAKS = LEDGER.filter(l => l.variance < 0).sort((a, b) => a.variance - b.variance);
  const TOTAL_LEAKAGE = LEAKS.reduce((s, l) => s - l.variance, 0);

  const YARD = LEDGER.filter(l => l.in_yard).sort((a, b) => b.dwell - a.dwell);
  const YARD_ACCRUED = YARD.reduce((s, l) => s + l.expected, 0);

  const LONG_STAY = YARD.filter(l => l.dwell > 30);

  function aggregateBy(keyFn) {
    const map = {};
    LEDGER.forEach(l => {
      const k = keyFn(l);
      if (!map[k]) map[k] = { key: k, boxes: 0, teu: 0, revenue: 0, cost: 0, margin: 0, dwellSum: 0 };
      const m = map[k];
      m.boxes++; m.teu += l.teu; m.revenue += l.invoiced; m.cost += l.cost; m.margin += l.margin; m.dwellSum += l.dwell;
    });
    return Object.values(map).map(m => ({
      ...m,
      marginPct: m.revenue ? Math.round((m.margin / m.revenue) * 100) : 0,
      revPerTeu: m.teu ? Math.round(m.revenue / m.teu) : 0,
      avgDwell: (m.dwellSum / m.boxes).toFixed(1),
    })).sort((a, b) => b.margin - a.margin);
  }

  const BY_CONSIGNEE = aggregateBy(l => l.consignee);
  const BY_CHA = aggregateBy(l => l.cha);
  const BY_CLASS = aggregateBy(l => l.cargo_class);
  const BY_PORT = aggregateBy(l => l.port);

  // Dwell-bucket slot economics: is ground rent compensating for blocked throughput?
  const SLOT_ECONOMICS = DWELL_BUCKETS.map(b => {
    const rows = LEDGER.filter(l => l.direction === "Import" && l.dwell >= b.min && l.dwell <= b.max);
    if (!rows.length) return null;
    const slotDays = rows.reduce((s, l) => s + l.dwell * l.teu, 0);
    const revenue = rows.reduce((s, l) => s + l.invoiced, 0);
    const margin = rows.reduce((s, l) => s + l.margin, 0);
    return {
      bucket: b.label, boxes: rows.length, slotDays,
      revPerSlotDay: Math.round(revenue / slotDays),
      marginPerSlotDay: Math.round(margin / slotDays),
    };
  }).filter(Boolean);

  // ── THROUGHPUT ────────────────────────────────────────────────────────────────
  const MONTHLY_THROUGHPUT = (() => {
    const map = {};
    const names = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    LEDGER.forEach(l => {
      const [y, m] = l.arrival_date.split("-");
      const key = `${y}-${m}`;
      if (!map[key]) map[key] = { key, month: `${names[+m]} '${y.slice(2)}`, teu: 0, revenue: 0, margin: 0 };
      map[key].teu += l.teu; map[key].revenue += l.invoiced; map[key].margin += l.margin;
    });
    return Object.values(map).sort((a, b) => a.key.localeCompare(b.key));
  })();

  const TOTALS = (() => {
    const revenue = LEDGER.reduce((s, l) => s + l.invoiced, 0);
    const cost = LEDGER.reduce((s, l) => s + l.cost, 0);
    const teuTotal = LEDGER.reduce((s, l) => s + l.teu, 0);
    return { revenue, cost, margin: revenue - cost, teu: teuTotal, boxes: LEDGER.length };
  })();

  return {
    LEDGER,
    LEAKS,
    TOTAL_LEAKAGE,
    YARD,
    YARD_ACCRUED,
    LONG_STAY,
    BY_CONSIGNEE,
    BY_CHA,
    BY_CLASS,
    BY_PORT,
    SLOT_ECONOMICS,
    MONTHLY_THROUGHPUT,
    TOTALS,
  };
}

export const MANALI_CAPACITY = FACILITIES[0].annual_teu_capacity;

// ── SATTVA CFS — TARIFF BILLING / COST / PROFITABILITY ENGINE ─────────────────
import { TARIFF, TARIFF_LEGACY_HANDLING, STALE_RATE_CARD_IDS, CONTAINERS, INVOICE_ADJUSTMENTS, COST_DRIVERS, FACILITIES } from "./constants.js";

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

// Current slab rate + next escalation info for an in-yard container.
export function getSlabEscalation(dwell, size, holdingMult = 1) {
  const s = size === 20 ? "s20" : "s40";
  for (let i = 0; i < TARIFF.holding_import.length; i++) {
    const slab = TARIFF.holding_import[i];
    if (dwell >= slab.from && dwell <= slab.to) {
      const currentRate = Math.round(slab[s] * holdingMult);
      const next = TARIFF.holding_import[i + 1];
      return {
        currentRate,
        isFree: currentRate === 0,
        daysUntilEscalation: next ? next.from - dwell : null,
        nextRate: next ? Math.round(next[s] * holdingMult) : null,
        isMaxSlab: !next,
      };
    }
  }
  return null;
}

// Itemised billing per container.
// T = effective tariff (current published rates + any UI overrides).
// handlingRates overrides T.handling_import — used for stale-rate-card containers
// so ancillaries still come from the current effective tariff while only handling
// is re-priced at the legacy 2023 rates.
export function computeBilling(c, handlingRates = null, T = TARIFF) {
  const handling = handlingRates || T.handling_import;
  const s = sz(c), lines = [];
  const add = (label, amount) => { if (amount > 0) lines.push({ label, amount: Math.round(amount) }); };

  if (c.direction === "Export") {
    add("Stuffing (yard, mechanical)", T.export.stuffing_yard_mech[s]);
    add("Documentation", T.export.documentation);
    add("RFID / Transecure / seal scanning", T.export.rfid_seal[s]);
    if (c.weighment) add("Weighment", T.export.weighment);
    const days = dwellDays(c);
    let hold = 0;
    for (const slab of T.export.holding) {
      if (days < slab.from) break;
      hold += (Math.min(days, slab.to) - slab.from + 1) * slab[s];
    }
    add(`Holding (${days} days)`, hold);
  } else {
    const rules = T.class_rules[c.cargo_class] || T.class_rules.GP;
    const handlingClass = c.cargo_class === "ODC" ? "ODC" : "GP";
    const base = handling[c.port][handlingClass].destuff[s];
    add(`Handling & movement — ${c.port} (${c.cargo_class})`, base * rules.handling_mult);
    if (c.examined) add("De-stuffing >25% for customs examination", T.exam_destuff[s]);
    const days = dwellDays(c);
    add(`Ground rent (${days} days, ${c.cargo_class})`, groundRent(days, c.size, rules.holding_mult));
    add("Energy surcharge", T.ancillary.energy_surcharge[s]);
    if (c.weighment) add("Weighment", T.ancillary.weighment);
    if (c.scanned) add("Scanning movement", T.ancillary.scanning_movement);
    if (c.cargo_class === "Reefer") {
      const plugDays = dayDiff(c.arrival_date, c.destuff_date || c.gate_out || TODAY);
      add(`Reefer plugging & monitoring (${plugDays} days)`, T.ancillary.reefer_plugging[s] * plugDays);
    }
    add("RFID container tracking", T.ancillary.rfid_per_teu * teu(c));
    add("Risk management / insurance", T.ancillary.risk_mgmt_per_teu * teu(c));
    add("Seal (OTL)", T.ancillary.seal_otl);
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

export function getComputations(terminalAbbr, rateOverrides = {}) {
  const ET = buildEffectiveTariff(rateOverrides);   // effective tariff with UI overrides applied

  const terminalContainers = CONTAINERS.filter((c, idx) => {
    return terminalAbbr === "NXS" ? idx % 2 === 0 : idx % 2 !== 0;
  });

  const LEDGER = terminalContainers.map(c => {
    const billing = computeBilling(c, null, ET);                // current effective rates
    const cost = computeCost(c);

    const groundRentLine = billing.lines.find(l => l.label.startsWith("Ground rent"));
    const handlingLine = billing.lines.find(l => l.label.startsWith("Handling"));
    const holdingMult = (ET.class_rules[c.cargo_class] || ET.class_rules.GP).holding_mult;
    let slabInfo = null;
    if (inYard(c)) {
      slabInfo = getSlabEscalation(dwellDays(c), c.size, holdingMult);
      if (slabInfo && slabInfo.daysUntilEscalation !== null) {
        const d = new Date(TODAY);
        d.setDate(d.getDate() + slabInfo.daysUntilEscalation);
        slabInfo = { ...slabInfo, escalationDate: d.toISOString().slice(0, 10) };
      }
    }

    let invoiced, invoiced_lines, leak_reason, stale_rate_card;
    if (STALE_RATE_CARD_IDS.has(c.container_id)) {
      // invoiced = recomputed using legacy 2023 handling rates + current ancillaries
      const legacyBilling = computeBilling(c, TARIFF_LEGACY_HANDLING, ET);
      invoiced        = legacyBilling.total;
      invoiced_lines  = legacyBilling.lines;
      stale_rate_card = true;
      const expH = billing.lines.find(l => l.label.startsWith("Handling"));
      const legH = legacyBilling.lines.find(l => l.label.startsWith("Handling"));
      leak_reason = `Stale rate card — de-stuffing billed at 2023 rate (₹${fmt(legH.amount)}); current published rate ₹${fmt(expH.amount)}`;
    } else {
      const adj = ADJ[c.container_id];
      invoiced        = billing.total + (adj?.delta || 0);
      invoiced_lines  = null;
      stale_rate_card = false;
      leak_reason     = adj?.reason || null;
    }

    return {
      ...c,
      teu: teu(c),
      dwell: dwellDays(c),
      in_yard: inYard(c),
      expected: billing.total,
      billing_lines: billing.lines,
      invoiced,
      invoiced_lines,
      stale_rate_card,
      variance: invoiced - billing.total,         // negative = leakage
      leak_reason,
      cost: cost.total,
      cost_lines: cost.lines,
      margin: invoiced - cost.total,
      groundRentCharged: groundRentLine?.amount || 0,
      handlingCharged: handlingLine?.amount || 0,
      slabInfo,
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
      if (!map[k]) map[k] = { key: k, boxes: 0, teu: 0, revenue: 0, cost: 0, margin: 0, dwellSum: 0, groundRentSum: 0, handlingSum: 0, clearedIn5d: 0, closedImportBoxes: 0 };
      const m = map[k];
      m.boxes++; m.teu += l.teu; m.revenue += l.invoiced; m.cost += l.cost; m.margin += l.margin; m.dwellSum += l.dwell;
      m.groundRentSum += l.groundRentCharged;
      m.handlingSum += l.handlingCharged;
      if (!l.in_yard && l.direction === "Import") {
        m.closedImportBoxes++;
        if (l.dwell <= 5) m.clearedIn5d++;
      }
    });
    return Object.values(map).map(m => ({
      ...m,
      marginPct: m.revenue ? Math.round((m.margin / m.revenue) * 100) : 0,
      revPerTeu: m.teu ? Math.round(m.revenue / m.teu) : 0,
      avgDwell: (m.dwellSum / m.boxes).toFixed(1),
      groundRentShare: m.revenue ? Math.round((m.groundRentSum / m.revenue) * 100) : 0,
      avgGroundRent: m.boxes ? Math.round(m.groundRentSum / m.boxes) : 0,
      avgHandling: m.boxes ? Math.round(m.handlingSum / m.boxes) : 0,
      pctCleared5d: m.closedImportBoxes > 0 ? Math.round((m.clearedIn5d / m.closedImportBoxes) * 100) : null,
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

  const closedImport = LEDGER.filter(l => !l.in_yard && l.direction === "Import");
  const totalGroundRent = LEDGER.reduce((s, l) => s + l.groundRentCharged, 0);
  const DWELL_SUMMARY = {
    pctCleared5d: closedImport.length ? Math.round(closedImport.filter(l => l.dwell <= 5).length / closedImport.length * 100) : 0,
    totalGroundRentRevenue: totalGroundRent,
    groundRentShareOfTotal: TOTALS.revenue ? Math.round(totalGroundRent / TOTALS.revenue * 100) : 0,
    nudgeCount: YARD.filter(l => l.slabInfo?.daysUntilEscalation !== null && l.slabInfo.daysUntilEscalation <= 5).length,
  };

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
    DWELL_SUMMARY,
  };
}

export const MANALI_CAPACITY = FACILITIES[0].annual_teu_capacity;

// Maps rate card UI keys (from CfsApp rateOverrides) to paths in TARIFF.
const OVERRIDE_PATHS = {
  ch_gp_lo_20:  ["handling_import", "Chennai",    "GP",  "loadout", "s20"],
  ch_gp_lo_40:  ["handling_import", "Chennai",    "GP",  "loadout", "s40"],
  ch_gp_ds_20:  ["handling_import", "Chennai",    "GP",  "destuff", "s20"],
  ch_gp_ds_40:  ["handling_import", "Chennai",    "GP",  "destuff", "s40"],
  ch_od_lo_20:  ["handling_import", "Chennai",    "ODC", "loadout", "s20"],
  ch_od_lo_40:  ["handling_import", "Chennai",    "ODC", "loadout", "s40"],
  ch_od_ds_20:  ["handling_import", "Chennai",    "ODC", "destuff", "s20"],
  ch_od_ds_40:  ["handling_import", "Chennai",    "ODC", "destuff", "s40"],
  en_gp_lo_20:  ["handling_import", "Ennore",     "GP",  "loadout", "s20"],
  en_gp_lo_40:  ["handling_import", "Ennore",     "GP",  "loadout", "s40"],
  en_gp_ds_20:  ["handling_import", "Ennore",     "GP",  "destuff", "s20"],
  en_gp_ds_40:  ["handling_import", "Ennore",     "GP",  "destuff", "s40"],
  kt_gp_lo_20:  ["handling_import", "Kattupalli", "GP",  "loadout", "s20"],
  kt_gp_lo_40:  ["handling_import", "Kattupalli", "GP",  "loadout", "s40"],
  kt_gp_ds_20:  ["handling_import", "Kattupalli", "GP",  "destuff", "s20"],
  kt_gp_ds_40:  ["handling_import", "Kattupalli", "GP",  "destuff", "s40"],
  exam_s20:     ["exam_destuff", "s20"],
  exam_s40:     ["exam_destuff", "s40"],
  anc_en_20:    ["ancillary", "energy_surcharge",  "s20"],
  anc_en_40:    ["ancillary", "energy_surcharge",  "s40"],
  anc_rp_20:    ["ancillary", "reefer_plugging",   "s20"],
  anc_rp_40:    ["ancillary", "reefer_plugging",   "s40"],
  anc_ll_20:    ["ancillary", "lift_onoff_laden",  "s20"],
  anc_ll_40:    ["ancillary", "lift_onoff_laden",  "s40"],
  anc_rfid:     ["ancillary", "rfid_per_teu"],
  anc_risk:     ["ancillary", "risk_mgmt_per_teu"],
  anc_wt:       ["ancillary", "weighment"],
  anc_scan:     ["ancillary", "scanning_movement"],
  anc_seal:     ["ancillary", "seal_otl"],
  anc_auc:      ["auction",   "handling_per_box"],
  anc_noc:      ["auction",   "valuation_noc"],
};

// Returns a TARIFF clone with any rate card UI overrides applied.
export function buildEffectiveTariff(overrides = {}) {
  if (!overrides || Object.keys(overrides).length === 0) return TARIFF;
  const t = JSON.parse(JSON.stringify(TARIFF));
  for (const [key, val] of Object.entries(overrides)) {
    const path = OVERRIDE_PATHS[key];
    if (!path) continue;
    let node = t;
    for (let i = 0; i < path.length - 1; i++) node = node[path[i]];
    node[path[path.length - 1]] = val;
  }
  return t;
}

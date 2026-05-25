import { CLIENTS, JOBS, CUSTOMS_FILINGS, WAREHOUSE, C, CITY_COORDS } from "../data/constants.js";

// ── OPERATIONS COMPUTATIONS ────────────────────────────────────────────────────

// Join job → client for filing lookups
export const JOB_CLIENT_MAP = Object.fromEntries(JOBS.map(j => [j.job_id, j.client_id]));

// Compliance risk per client
export const COMPLIANCE_RISK = CLIENTS.map(client => {
  const clientJobs = JOBS.filter(j => j.client_id === client.client_id).map(j => j.job_id);
  const filings = CUSTOMS_FILINGS.filter(f => clientJobs.includes(f.job_id));
  if (!filings.length) return null;
  const examinationRate = filings.filter(f => f.examination).length / filings.length;
  const amendmentRate = filings.reduce((s, f) => s + f.amendments, 0) / filings.length;
  // weighted: 60% examination, 40% amendment (normalised — amendment rate capped at 1.0 for scoring)
  const riskScore = Math.round((examinationRate * 0.6 + Math.min(amendmentRate, 1) * 0.4) * 100);
  const level = riskScore >= 40 ? "High" : riskScore >= 20 ? "Medium" : "Low";
  return {
    client_id: client.client_id,
    name: client.name,
    industry: client.industry,
    totalFilings: filings.length,
    examined: filings.filter(f => f.examination).length,
    examinationRate: (examinationRate * 100).toFixed(0),
    totalAmendments: filings.reduce((s, f) => s + f.amendments, 0),
    amendmentRate: (amendmentRate * 100).toFixed(0),
    riskScore,
    level,
  };
}).filter(Boolean);

// Warehouse utilisation per client
export const maxCbm = Math.max(...CLIENTS.map(c =>
  WAREHOUSE.filter(w => w.client_id === c.client_id).reduce((s, w) => s + w.cbm, 0)
), 1);

export const WAREHOUSE_STATS = CLIENTS.map(client => {
  const records = WAREHOUSE.filter(w => w.client_id === client.client_id);
  if (!records.length) return null;
  const total_cbm = records.reduce((s, w) => s + w.cbm, 0);
  const total_charges = records.reduce((s, w) => s + w.charges, 0);
  return {
    client_id: client.client_id,
    name: client.name,
    jobs: records.length,
    total_cbm,
    total_charges,
    cost_per_cbm: (total_charges / total_cbm).toFixed(0),
    pct: Math.round((total_cbm / maxCbm) * 100),
  };
}).filter(Boolean).sort((a, b) => b.total_cbm - a.total_cbm);


// ── CHART DATA ─────────────────────────────────────────────────────────────────
export const MONTHLY_TREND = (() => {
  const map = {};
  JOBS.filter(j => j.status === "Completed").forEach(j => {
    const [y, m] = j.job_date.split("-");
    const key = `${y}-${m}`;
    if (!map[key]) map[key] = { month: `${["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][+m]} '${y.slice(2)}`, revenue: 0, cost: 0 };
    map[key].revenue += j.revenue;
    map[key].cost    += j.cost;
  });
  return Object.values(map).map(d => ({ ...d, margin: d.revenue - d.cost }));
})();

export const MODE_BREAKDOWN = (() => {
  const map = {};
  JOBS.filter(j => j.status === "Completed").forEach(j => {
    if (!map[j.mode]) map[j.mode] = { mode: j.mode, revenue: 0, margin: 0 };
    map[j.mode].revenue += j.revenue;
    map[j.mode].margin  += (j.revenue - j.cost);
  });
  return Object.values(map);
})();

// ── TRADE LANE MAP ─────────────────────────────────────────────────────────────
// Equirectangular projection: x = (lng+180)/360*W,  y = (90-lat)/180*H

export function project([lng, lat], W, H) {
  return [(lng + 180) / 360 * W, (90 - lat) / 180 * H];
}

export function arcPath([x1, y1], [x2, y2]) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2 - Math.abs(x2 - x1) * 0.25;
  return `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`;
}

// ── HELPERS ────────────────────────────────────────────────────────────────────
export const fmt  = n  => new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n);
export const pct  = (a, b) => b ? ((a / b) * 100).toFixed(1) + "%" : "—";
export const riskColour = l => l === "High" ? C.red : l === "Medium" ? C.yellow : C.green;


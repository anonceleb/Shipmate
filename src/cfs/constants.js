// ── NEXUS CFS DEMO MODULE — DATA LAYER ───────────────────────────────────────
// Tariff figures based on a representative published CFS tariff schedule
// ("Northgate Container Terminal", effective 15-06-2023, plus a revised sheet).
// Container/invoice/cost data is 100% synthetic and plays
// the role of an export from the CFS's existing yard & billing systems.

export const FACILITIES = [
  { facility_id: "MANALI",  name: "Manali CFS",  area_acres: 18, warehouse_sft: 40000,  bonded: true, annual_teu_capacity: 120000 },
  { facility_id: "VICHOOR", name: "Vichoor CFS", area_acres: 27, warehouse_sft: 240000, bonded: true, annual_teu_capacity: 200000 },
];

// ── PUBLISHED TARIFF (effective 15-06-2023, fully transcribed) ────────────────
export const TARIFF = {
  effective_from: "2023-06-15",
  // Import handling (terminal handling + movement), by port of discharge.
  // loadout = delivery on load-out basis; destuff = destuffing service.
  handling_import: {
    "Chennai":    { GP:  { loadout: { s20: 7500,  s40: 9750  }, destuff: { s20: 9000,  s40: 11850 } },
                    ODC: { loadout: { s20: 12000, s40: 15000 }, destuff: { s20: 15000, s40: 21500 } } },
    "Ennore":     { GP:  { loadout: { s20: 9200,  s40: 12400 }, destuff: { s20: 10700, s40: 14500 } },
                    ODC: { loadout: { s20: 13700, s40: 17650 }, destuff: { s20: 16700, s40: 24150 } } },
    "Kattupalli": { GP:  { loadout: { s20: 9200,  s40: 12400 }, destuff: { s20: 10700, s40: 14500 } },
                    ODC: { loadout: { s20: 13700, s40: 17650 }, destuff: { s20: 16700, s40: 24150 } } },
  },
  exam_destuff: { s20: 3600, s40: 5400 },           // de-stuffing above 25% for customs examination
  // Import holding slabs (GP, Rs/day). Free days count from move-in.
  holding_import: [
    { from: 1,  to: 3,    s20: 0,    s40: 0     },
    { from: 4,  to: 7,    s20: 500,  s40: 1000  },
    { from: 8,  to: 10,   s20: 750,  s40: 1500  },
    { from: 11, to: 15,   s20: 1200, s40: 2400  },
    { from: 16, to: 20,   s20: 1600, s40: 3200  },
    { from: 21, to: 30,   s20: 2000, s40: 4000  },
    { from: 31, to: 60,   s20: 2500, s40: 5000  },
    { from: 61, to: 90,   s20: 3000, s40: 6000  },
    { from: 91, to: 9999, s20: 5000, s40: 10000 },
  ],
  // Class multipliers per published conditions
  class_rules: {
    Hazardous: { handling_mult: 1.25, holding_mult: 1.25 },   // +25% on handling & holding
    Reefer:    { handling_mult: 1.25, holding_mult: 1.25 },
    Tanker:    { handling_mult: 1.25, holding_mult: 1.25 },
    ODC:       { handling_mult: 1.0,  holding_mult: 2.0  },   // OOG/ODC: 100% extra on holding
    GP:        { handling_mult: 1.0,  holding_mult: 1.0  },
  },
  ancillary: {
    energy_surcharge:   { s20: 1000, s40: 2000 },
    weighment:          200,                       // per container
    reefer_plugging:    { s20: 2000, s40: 3000 },  // per day (8-hr blocks, simplified daily)
    risk_mgmt_per_teu:  200,
    seal_otl:           50,
    rfid_per_teu:       150,
    scanning_movement:  1500,
    lift_onoff_laden:   { s20: 1000, s40: 2000 },
  },
  auction: { handling_per_box: 7500, valuation_noc: 5000 },
  // Export tariff (general cargo)
  export: {
    stuffing_yard_mech: { s20: 4300, s40: 6450 },
    documentation:      400,
    rfid_seal:          { s20: 225, s40: 325 },
    weighment:          200,
    holding: [
      { from: 1,  to: 5,    s20: 0,   s40: 0    },
      { from: 6,  to: 10,   s20: 250, s40: 500  },
      { from: 11, to: 9999, s20: 500, s40: 1000 },
    ],
  },
};

// Revised rates from the newer published sheet (Chennai Port lines verified).
// Used only for the rate-revision impact exhibit, not for billing.
export const TARIFF_REVISION = {
  label: "Revised sheet (current published rates)",
  handling_import_chennai_GP: { loadout: { s20: 12200, s40: 17150 }, destuff: { s20: 13700, s40: 19250 } },
};

// ── CONTAINER REGISTER (synthetic — stands in for the yard system export) ─────
// gate_out null ⇒ still in yard as of today.
const ct = (id, no, size, port, cls, direction, consignee, cha, line, commodity, arrival, destuff, gate_out, f = {}) => ({
  container_id: id, container_no: no, size, port, cargo_class: cls, direction,
  consignee, cha, line, commodity, arrival_date: arrival, destuff_date: destuff, gate_out,
  examined: !!f.x, scanned: !!f.s, weighment: !!f.w, bonded: !!f.b,
});

export const CONTAINERS = [
  // ── 2025 H2 (closed boxes) ──
  ct("CN001","MSKU4821170",20,"Chennai","GP","Import","Hyundai Motor India","Sanco Trans","Maersk","CKD auto kits","2025-07-03","2025-07-05","2025-07-08",{w:1}),
  ct("CN002","MSCU7715906",40,"Chennai","GP","Import","Saint-Gobain India","Natesa Iyer & Co","MSC","Float glass","2025-07-08","2025-07-10","2025-07-15",{w:1}),
  ct("CN003","CMAU3318245",20,"Ennore","GP","Import","Agarwal Metal Traders","SKS Logistics","CMA CGM","HMS scrap","2025-07-14","2025-07-17","2025-07-24",{x:1,s:1,w:1}),
  ct("CN004","ONEU1204583",40,"Kattupalli","GP","Import","TVS Motor Company","Triway Forwarders","ONE","Two-wheeler parts","2025-07-21","2025-07-23","2025-07-26",{}),
  ct("CN005","HLBU5529034",40,"Chennai","Reefer","Import","Apex Pharma Cold Chain","Everest Shipping","Hapag-Lloyd","Pharma API (reefer)","2025-08-04","2025-08-05","2025-08-09",{w:1}),
  ct("CN006","MSKU6643317",20,"Chennai","GP","Import","Lucas TVS","Sanco Trans","Maersk","Alternator components","2025-08-09","2025-08-11","2025-08-14",{}),
  ct("CN007","EGHU2210458",40,"Ennore","ODC","Import","L&T Construction Equipment","SKS Logistics","Evergreen","Crawler crane boom","2025-08-18","2025-08-22","2025-08-30",{x:1,w:1}),
  ct("CN008","COSU4456712",20,"Chennai","GP","Import","Wheels India","Natesa Iyer & Co","COSCO","Steel wheel rims","2025-08-25","2025-08-27","2025-08-30",{}),
  ct("CN009","MSCU8830125",40,"Chennai","GP","Import","Salcomp Manufacturing","Triway Forwarders","MSC","Charger sub-assemblies","2025-09-02","2025-09-04","2025-09-08",{s:1}),
  ct("CN010","MSKU7754201",20,"Kattupalli","Hazardous","Import","Tagros Chemicals","Everest Shipping","Maersk","Agrochemical intermediates","2025-09-09","2025-09-12","2025-09-18",{x:1,w:1}),
  ct("CN011","CMAU6671893",40,"Chennai","GP","Import","Hyundai Motor India","Sanco Trans","CMA CGM","CKD auto kits","2025-09-15","2025-09-17","2025-09-20",{}),
  ct("CN012","HLBU3398540",20,"Chennai","GP","Import","MRF Tyres","Natesa Iyer & Co","Hapag-Lloyd","Tyre-cord fabric","2025-09-23","2025-09-25","2025-09-30",{w:1}),
  ct("CN013","ONEU5582217",40,"Ennore","GP","Import","Daebu Automotive Seats","SKS Logistics","ONE","Seat frames","2025-10-01","2025-10-03","2025-10-08",{}),
  ct("CN014","MSKU1127845",20,"Chennai","GP","Import","Agarwal Metal Traders","SKS Logistics","Maersk","HMS scrap","2025-10-07","2025-10-10","2025-10-21",{x:1,s:1,w:1}),
  ct("CN015","MSCU2245890",40,"Chennai","Reefer","Import","Apex Pharma Cold Chain","Everest Shipping","MSC","Vaccines (reefer)","2025-10-14","2025-10-15","2025-10-18",{w:1}),
  ct("CN016","EGHU7733120",20,"Chennai","GP","Import","Lucas TVS","Sanco Trans","Evergreen","Wiring harnesses","2025-10-21","2025-10-23","2025-10-27",{}),
  ct("CN017","COSU9914467",40,"Kattupalli","GP","Import","Saint-Gobain India","Natesa Iyer & Co","COSCO","Abrasives","2025-10-28","2025-10-30","2025-11-04",{w:1}),
  ct("CN018","MSKU3349906",40,"Chennai","ODC","Import","BGR Energy Systems","Triway Forwarders","Maersk","Boiler pressure parts","2025-11-04","2025-11-08","2025-11-19",{x:1,w:1}),
  ct("CN019","CMAU1058839",20,"Chennai","GP","Import","Wheels India","Natesa Iyer & Co","CMA CGM","Steel wheel rims","2025-11-11","2025-11-13","2025-11-16",{}),
  ct("CN020","HLBU6620744",40,"Chennai","GP","Import","TVS Motor Company","Triway Forwarders","Hapag-Lloyd","Two-wheeler parts","2025-11-18","2025-11-20","2025-11-24",{s:1}),
  ct("CN021","ONEU8847552",20,"Ennore","GP","Import","Agarwal Metal Traders","SKS Logistics","ONE","HMS scrap","2025-11-25","2025-11-28","2025-12-09",{x:1,w:1}),
  ct("CN022","MSCU5573308",40,"Chennai","GP","Import","Salcomp Manufacturing","Triway Forwarders","MSC","Charger sub-assemblies","2025-12-02","2025-12-04","2025-12-08",{}),
  ct("CN023","MSKU9921053",20,"Chennai","Hazardous","Import","Tagros Chemicals","Everest Shipping","Maersk","Agrochemical intermediates","2025-12-09","2025-12-12","2025-12-19",{x:1,w:1}),
  ct("CN024","EGHU4452219",40,"Chennai","GP","Import","Hyundai Motor India","Sanco Trans","Evergreen","CKD auto kits","2025-12-16","2025-12-18","2025-12-21",{}),
  ct("CN025","COSU2238716",20,"Kattupalli","GP","Import","MRF Tyres","Natesa Iyer & Co","COSCO","Carbon black","2025-12-23","2025-12-26","2026-01-02",{w:1}),
  // ── 2026 (closed boxes) ──
  ct("CN026","MSKU5538829",40,"Chennai","GP","Import","Saint-Gobain India","Natesa Iyer & Co","Maersk","Float glass","2026-01-06","2026-01-08","2026-01-13",{w:1}),
  ct("CN027","CMAU8870143",20,"Chennai","GP","Import","Lucas TVS","Sanco Trans","CMA CGM","Alternator components","2026-01-13","2026-01-15","2026-01-19",{}),
  ct("CN028","HLBU1147205",40,"Ennore","ODC","Import","L&T Construction Equipment","SKS Logistics","Hapag-Lloyd","Excavator superstructure","2026-01-20","2026-01-24","2026-02-04",{x:1,w:1}),
  ct("CN029","ONEU3320981",20,"Chennai","GP","Import","Wheels India","Natesa Iyer & Co","ONE","Steel wheel rims","2026-01-27","2026-01-29","2026-02-02",{}),
  ct("CN030","MSCU6692753",40,"Chennai","Reefer","Import","Apex Pharma Cold Chain","Everest Shipping","MSC","Pharma API (reefer)","2026-02-03","2026-02-04","2026-02-09",{w:1}),
  ct("CN031","MSKU2204176",20,"Chennai","GP","Import","Agarwal Metal Traders","SKS Logistics","Maersk","HMS scrap","2026-02-10","2026-02-13","2026-02-25",{x:1,s:1,w:1}),
  ct("CN032","EGHU9956304",40,"Kattupalli","GP","Import","TVS Motor Company","Triway Forwarders","Evergreen","Two-wheeler parts","2026-02-17","2026-02-19","2026-02-23",{}),
  ct("CN033","COSU7741850",20,"Chennai","GP","Import","Salcomp Manufacturing","Triway Forwarders","COSCO","Charger sub-assemblies","2026-02-24","2026-02-26","2026-03-02",{s:1}),
  ct("CN034","MSKU8814532",40,"Chennai","GP","Import","Hyundai Motor India","Sanco Trans","Maersk","CKD auto kits","2026-03-03","2026-03-05","2026-03-09",{}),
  ct("CN035","CMAU2290617",20,"Ennore","Hazardous","Import","Tagros Chemicals","Everest Shipping","CMA CGM","Agrochemical intermediates","2026-03-10","2026-03-13","2026-03-20",{x:1,w:1}),
  ct("CN036","HLBU8804921",40,"Chennai","GP","Import","Daebu Automotive Seats","SKS Logistics","Hapag-Lloyd","Seat frames","2026-03-17","2026-03-19","2026-03-24",{}),
  ct("CN037","ONEU6618390",20,"Chennai","GP","Import","MRF Tyres","Natesa Iyer & Co","ONE","Tyre-cord fabric","2026-03-24","2026-03-26","2026-03-31",{w:1}),
  ct("CN038","MSCU3361174",40,"Chennai","GP","Import","Saint-Gobain India","Natesa Iyer & Co","MSC","Float glass","2026-04-07","2026-04-09","2026-04-14",{w:1}),
  ct("CN039","MSKU6650298",20,"Kattupalli","GP","Import","Wheels India","Natesa Iyer & Co","Maersk","Steel wheel rims","2026-04-14","2026-04-16","2026-04-20",{}),
  ct("CN040","EGHU1183947",40,"Chennai","GP","Import","TVS Motor Company","Triway Forwarders","Evergreen","Two-wheeler parts","2026-04-21","2026-04-23","2026-04-27",{s:1}),
  ct("CN041","COSU5527081",20,"Chennai","GP","Import","Lucas TVS","Sanco Trans","COSCO","Wiring harnesses","2026-04-28","2026-04-30","2026-05-05",{}),
  ct("CN042","MSKU4472613",40,"Chennai","Reefer","Import","Apex Pharma Cold Chain","Everest Shipping","Maersk","Vaccines (reefer)","2026-05-05","2026-05-06","2026-05-11",{w:1}),
  ct("CN043","CMAU7708254",20,"Ennore","GP","Import","Agarwal Metal Traders","SKS Logistics","CMA CGM","HMS scrap","2026-05-12","2026-05-15","2026-05-27",{x:1,s:1,w:1}),
  ct("CN044","HLBU2261497",40,"Chennai","GP","Import","Salcomp Manufacturing","Triway Forwarders","Hapag-Lloyd","Charger sub-assemblies","2026-05-19","2026-05-21","2026-05-26",{}),
  // ── Boxes currently in yard (gate_out = null) ──
  ct("CN045","MSKU9938221",40,"Chennai","GP","Import","Hyundai Motor India","Sanco Trans","Maersk","CKD auto kits","2026-06-05","2026-06-08",null,{}),
  ct("CN046","ONEU2241068",20,"Chennai","GP","Import","MRF Tyres","Natesa Iyer & Co","ONE","Carbon black","2026-05-30","2026-06-02",null,{w:1}),
  ct("CN047","MSCU9917436",40,"Chennai","GP","Import","Daebu Automotive Seats","SKS Logistics","MSC","Seat frames","2026-05-20","2026-05-22",null,{}),
  ct("CN048","MSKU1106529",20,"Ennore","GP","Import","Agarwal Metal Traders","SKS Logistics","Maersk","HMS scrap","2026-05-04","2026-05-07",null,{x:1,s:1,w:1}),
  ct("CN049","EGHU6634015",40,"Chennai","Reefer","Import","Coromandel Frozen Foods","Everest Shipping","Evergreen","Frozen seafood (reefer)","2026-04-25","2026-04-26",null,{w:1}),
  ct("CN050","COSU8852170",40,"Chennai","ODC","Import","BGR Energy Systems","Triway Forwarders","COSCO","Turbine casing","2026-03-28","2026-04-02",null,{x:1,w:1}),
  ct("CN051","CMAU5519604",20,"Kattupalli","GP","Import","Sri Velan Impex","Everest Shipping","CMA CGM","Mixed household goods","2026-03-01","2026-03-06",null,{x:1,s:1,w:1}),
  ct("CN052","HLBU7790312",40,"Chennai","GP","Import","Orient Traders & Co","Everest Shipping","Hapag-Lloyd","Used machinery (disputed)","2026-01-29","2026-02-05",null,{x:1,s:1,w:1}),
  // ── Export boxes (stuffing jobs) ──
  ct("CN053","MSKU3327719",40,"Chennai","GP","Export","KPR Mill Ltd","Sanco Trans","Maersk","Knitted garments","2026-04-18","2026-04-20","2026-04-22",{w:1}),
  ct("CN054","MSCU1184226",20,"Chennai","GP","Export","Madhucon Granites","SKS Logistics","MSC","Granite blocks","2026-05-02","2026-05-06","2026-05-09",{w:1}),
  ct("CN055","ONEU7765843",40,"Chennai","GP","Export","Sundaram Fasteners","Triway Forwarders","ONE","High-tensile fasteners","2026-05-21","2026-05-23","2026-05-25",{w:1}),
  ct("CN056","EGHU3308157",40,"Chennai","GP","Export","KPR Mill Ltd","Sanco Trans","Evergreen","Knitted garments","2026-06-03","2026-06-06","2026-06-08",{w:1}),
];

// ── BILLING ADJUSTMENTS (synthetic stand-in for the billing system extract) ───
// invoiced = engine-expected + delta. Negative delta = undercharge (leakage).
export const INVOICE_ADJUSTMENTS = [
  { container_id: "CN003", delta: -1000,  reason: "Energy surcharge not billed" },
  { container_id: "CN007", delta: -8800,  reason: "ODC holding billed at GP rates (100% OOG uplift missed)" },
  { container_id: "CN010", delta: -3340,  reason: "Hazardous +25% surcharge missed on handling" },
  { container_id: "CN014", delta: -1500,  reason: "Scanning movement charge unbilled" },
  { container_id: "CN015", delta: -6000,  reason: "Reefer plugging billed 2 days short" },
  { container_id: "CN018", delta: -6400,  reason: "Holding held at 11–15 day slab beyond day 16" },
  { container_id: "CN021", delta: -2750,  reason: "Free days extended to 7 without recorded approval" },
  { container_id: "CN025", delta: -550,   reason: "RFID + risk management charges missed" },
  { container_id: "CN031", delta: -1200,  reason: "Weighment & seal charges unbilled" },
  { container_id: "CN035", delta: -4310,  reason: "Hazardous +25% surcharge missed on holding" },
  { container_id: "CN043", delta: -2000,  reason: "Lift-on/lift-off second move unbilled" },
];

// ── COST DRIVERS (activity-based, synthetic) ──────────────────────────────────
export const COST_DRIVERS = {
  trailer_trip:      { Chennai: { s20: 4200, s40: 5800 }, Ennore: { s20: 6500, s40: 8800 }, Kattupalli: { s20: 6500, s40: 8800 } },
  lift_per_move:     { s20: 350, s40: 550 },     // ×2 moves minimum (lift-off + lift-on/delivery)
  destuff_labour:    { s20: 1400, s40: 2200 },
  crane_hire_odc:    { s20: 6000, s40: 9000 },
  reefer_power_day:  { s20: 900, s40: 1400 },
  exam_extra:        { s20: 1100, s40: 1600 },   // extra labour/supervision when customs examines
  scan_shuttle:      1100,                       // trip to scanner
  overhead_slot_day: { s20: 120, s40: 240 },     // yard lease, security, staff amortised per occupied slot-day
  admin_per_box:     250,
  export_stuffing_labour: { s20: 1600, s40: 2400 },
};

// ── AI QUERY LAYER ────────────────────────────────────────────────────────────
export const SCHEMA_DESC_CFS = `
You are a CFS (Container Freight Station) data analyst for Nexus CFS — "Northgate Container Terminal", Manali, Chennai. Nexus operates an 18-acre CFS (120,000 TEU/yr capacity) with public bonded warehousing on premises. This analytics layer sits ON TOP of the existing yard and billing systems; data below is an extract from those systems.

DATABASE SCHEMA:
1. CONTAINERS (container_id, container_no, size [20|40], port [Chennai|Ennore|Kattupalli — port of discharge], cargo_class [GP|ODC|Reefer|Hazardous], direction [Import|Export], consignee, cha, line, commodity, arrival_date, destuff_date, gate_out [null = still in yard], examined, scanned, weighment, bonded)
2. TARIFF — published tariff effective 15-06-2023: import handling by port & class (e.g. Chennai GP destuff 20' ₹9,000 / 40' ₹11,850; Ennore +~₹1,700), import holding slabs per day (3 free days, then ₹500/day 20' rising through 8 slabs to ₹5,000/day from day 91; 40' = 2×), Hazardous/Reefer +25%, ODC holding +100%, ancillaries (energy ₹1000/2000, weighment ₹200, reefer plugging ₹2000/3000 per day, RFID ₹150/TEU, scanning ₹1500, auction handling ₹7,500).
3. BILLING (container_id, expected_total [computed from tariff], invoiced_total [from billing system], variance, leak_reason) — negative variance = revenue leakage.
4. COSTS (container_id, trailer, lifts, labour, crane, reefer_power, overhead, total) — activity-based cost allocation per box.
5. PROFITABILITY (per container: revenue = invoiced_total, cost, margin; aggregate by consignee / CHA / cargo_class / port / dwell bucket).

All amounts in INR. Dwell days = arrival_date to gate_out (or today if in yard). Free days count from move-in.
`;

export const CFS_SAMPLE_QUESTIONS = [
  "Which consignee has the highest average dwell time and what does it cost us?",
  "How much revenue leakage have we found, and what are the top causes?",
  "Which CHA brings the most profitable business per TEU?",
  "Are Ennore-sourced containers less profitable than Chennai ones?",
  "Which boxes in the yard right now have crossed 30 days, and what's accrued?",
  "Show margin by cargo class — does ODC pricing cover crane costs?",
];

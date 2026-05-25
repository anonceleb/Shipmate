// ── MOCK DATA ──────────────────────────────────────────────────────────────────
export const CLIENTS = [
  { client_id: 1, name: "Ashok Leyland Ltd", industry: "Automotive", country: "India", onboarded_year: 2019 },
  { client_id: 2, name: "Pfizer Healthcare India", industry: "Pharmaceuticals", country: "India", onboarded_year: 2020 },
  { client_id: 3, name: "Texport Industries", industry: "Textiles", country: "India", onboarded_year: 2018 },
  { client_id: 4, name: "Larsen & Toubro", industry: "Engineering", country: "India", onboarded_year: 2017 },
  { client_id: 5, name: "Sundaram Fasteners", industry: "Automotive", country: "India", onboarded_year: 2021 },
  { client_id: 6, name: "Orchid Pharma", industry: "Pharmaceuticals", country: "India", onboarded_year: 2022 },
  { client_id: 7, name: "KPR Mill Ltd", industry: "Textiles", country: "India", onboarded_year: 2019 },
  { client_id: 8, name: "Bharat Forge", industry: "Engineering", country: "India", onboarded_year: 2020 },
];

export const JOBS = [
  { job_id: "J001", client_id: 1, mode: "Ocean FCL", origin: "Chennai", destination: "Rotterdam", trade_lane: "Export", service: "Forwarding+Customs", job_date: "2024-01-15", revenue: 72000, cost: 54000, status: "Completed", days_to_close: 18 },
  { job_id: "J002", client_id: 2, mode: "Air", origin: "Chennai", destination: "Frankfurt", trade_lane: "Export", service: "Forwarding+Customs", job_date: "2024-01-22", revenue: 48000, cost: 33000, status: "Completed", days_to_close: 5 },
  { job_id: "J003", client_id: 3, mode: "Ocean LCL", origin: "Chennai", destination: "Los Angeles", trade_lane: "Export", service: "Forwarding+Customs", job_date: "2024-02-03", revenue: 28000, cost: 19000, status: "Completed", days_to_close: 24 },
  { job_id: "J004", client_id: 4, mode: "Ocean FCL", origin: "Shanghai", destination: "Chennai", trade_lane: "Import", service: "Forwarding+Customs", job_date: "2024-02-14", revenue: 85000, cost: 61000, status: "Completed", days_to_close: 22 },
  { job_id: "J005", client_id: 1, mode: "Ocean FCL", origin: "Chennai", destination: "Antwerp", trade_lane: "Export", service: "Forwarding+Customs", job_date: "2024-02-28", revenue: 68000, cost: 52000, status: "Completed", days_to_close: 20 },
  { job_id: "J006", client_id: 5, mode: "Air", origin: "Chennai", destination: "Detroit", trade_lane: "Export", service: "Forwarding+Customs", job_date: "2024-03-05", revenue: 55000, cost: 38000, status: "Completed", days_to_close: 6 },
  { job_id: "J007", client_id: 6, mode: "Air", origin: "Singapore", destination: "Chennai", trade_lane: "Import", service: "Forwarding+Customs", job_date: "2024-03-12", revenue: 42000, cost: 29000, status: "Completed", days_to_close: 4 },
  { job_id: "J008", client_id: 7, mode: "Ocean LCL", origin: "Chennai", destination: "Hamburg", trade_lane: "Export", service: "Forwarding", job_date: "2024-03-18", revenue: 22000, cost: 16000, status: "Completed", days_to_close: 26 },
  { job_id: "J009", client_id: 8, mode: "Ocean FCL", origin: "Chennai", destination: "New York", trade_lane: "Export", service: "Forwarding+Customs", job_date: "2024-04-02", revenue: 79000, cost: 58000, status: "Completed", days_to_close: 21 },
  { job_id: "J010", client_id: 2, mode: "Air", origin: "Mumbai", destination: "Chicago", trade_lane: "Export", service: "Forwarding+Customs", job_date: "2024-04-08", revenue: 61000, cost: 44000, status: "Completed", days_to_close: 5 },
  { job_id: "J011", client_id: 4, mode: "Project Cargo", origin: "Guangzhou", destination: "Chennai", trade_lane: "Import", service: "Forwarding+Customs+3PL", job_date: "2024-04-15", revenue: 180000, cost: 138000, status: "Completed", days_to_close: 35 },
  { job_id: "J012", client_id: 3, mode: "Ocean LCL", origin: "Chennai", destination: "Dubai", trade_lane: "Export", service: "Forwarding+Customs", job_date: "2024-04-22", revenue: 19000, cost: 13000, status: "Completed", days_to_close: 12 },
  { job_id: "J013", client_id: 1, mode: "Ocean FCL", origin: "Chennai", destination: "Rotterdam", trade_lane: "Export", service: "Forwarding+Customs", job_date: "2024-05-07", revenue: 74000, cost: 56000, status: "Completed", days_to_close: 19 },
  { job_id: "J014", client_id: 5, mode: "Ocean FCL", origin: "Chennai", destination: "Detroit", trade_lane: "Export", service: "Forwarding+Customs", job_date: "2024-05-14", revenue: 69000, cost: 51000, status: "Completed", days_to_close: 22 },
  { job_id: "J015", client_id: 6, mode: "Air", origin: "Frankfurt", destination: "Chennai", trade_lane: "Import", service: "Forwarding+Customs", job_date: "2024-05-20", revenue: 38000, cost: 26000, status: "Completed", days_to_close: 4 },
  { job_id: "J016", client_id: 7, mode: "Ocean FCL", origin: "Chennai", destination: "Hamburg", trade_lane: "Export", service: "Forwarding+Customs+3PL", job_date: "2024-06-03", revenue: 82000, cost: 61000, status: "Completed", days_to_close: 24 },
  { job_id: "J017", client_id: 8, mode: "Air", origin: "Chennai", destination: "Stuttgart", trade_lane: "Export", service: "Forwarding+Customs", job_date: "2024-06-11", revenue: 52000, cost: 37000, status: "Completed", days_to_close: 5 },
  { job_id: "J018", client_id: 4, mode: "Ocean FCL", origin: "Busan", destination: "Chennai", trade_lane: "Import", service: "Forwarding+Customs+3PL", job_date: "2024-06-18", revenue: 95000, cost: 72000, status: "Completed", days_to_close: 23 },
  { job_id: "J019", client_id: 2, mode: "Air", origin: "Chennai", destination: "London", trade_lane: "Export", service: "Forwarding+Customs", job_date: "2024-07-02", revenue: 44000, cost: 30000, status: "Completed", days_to_close: 5 },
  { job_id: "J020", client_id: 1, mode: "Ocean LCL", origin: "Chennai", destination: "Jebel Ali", trade_lane: "Export", service: "Forwarding", job_date: "2024-07-09", revenue: 17000, cost: 12000, status: "Completed", days_to_close: 11 },
  { job_id: "J021", client_id: 3, mode: "Ocean FCL", origin: "Chennai", destination: "New York", trade_lane: "Export", service: "Forwarding+Customs", job_date: "2024-07-16", revenue: 76000, cost: 58000, status: "Completed", days_to_close: 22 },
  { job_id: "J022", client_id: 5, mode: "Air", origin: "Chennai", destination: "Tokyo", trade_lane: "Export", service: "Forwarding+Customs", job_date: "2024-07-23", revenue: 39000, cost: 27000, status: "Completed", days_to_close: 4 },
  { job_id: "J023", client_id: 8, mode: "Ocean FCL", origin: "Chennai", destination: "Antwerp", trade_lane: "Export", service: "Forwarding+Customs", job_date: "2024-08-05", revenue: 71000, cost: 54000, status: "Completed", days_to_close: 21 },
  { job_id: "J024", client_id: 6, mode: "Air", origin: "Amsterdam", destination: "Chennai", trade_lane: "Import", service: "Forwarding+Customs", job_date: "2024-08-13", revenue: 46000, cost: 32000, status: "Completed", days_to_close: 4 },
  { job_id: "J025", client_id: 4, mode: "Project Cargo", origin: "Chennai", destination: "Dammam", trade_lane: "Export", service: "Forwarding+Customs", job_date: "2024-08-20", revenue: 210000, cost: 162000, status: "Completed", days_to_close: 28 },
  { job_id: "J026", client_id: 7, mode: "Ocean LCL", origin: "Chennai", destination: "Los Angeles", trade_lane: "Export", service: "Forwarding+Customs", job_date: "2024-09-04", revenue: 25000, cost: 18000, status: "Completed", days_to_close: 28 },
  { job_id: "J027", client_id: 1, mode: "Ocean FCL", origin: "Chennai", destination: "Rotterdam", trade_lane: "Export", service: "Forwarding+Customs", job_date: "2024-09-11", revenue: 75000, cost: 57000, status: "Completed", days_to_close: 18 },
  { job_id: "J028", client_id: 2, mode: "Air", origin: "Chennai", destination: "Frankfurt", trade_lane: "Export", service: "Forwarding+Customs", job_date: "2024-09-18", revenue: 50000, cost: 35000, status: "Completed", days_to_close: 5 },
  { job_id: "J029", client_id: 5, mode: "Ocean FCL", origin: "Ningbo", destination: "Chennai", trade_lane: "Import", service: "Forwarding+Customs", job_date: "2024-10-02", revenue: 88000, cost: 66000, status: "Completed", days_to_close: 24 },
  { job_id: "J030", client_id: 3, mode: "Ocean FCL", origin: "Chennai", destination: "Hamburg", trade_lane: "Export", service: "Forwarding+Customs+3PL", job_date: "2024-10-09", revenue: 84000, cost: 63000, status: "Completed", days_to_close: 23 },
  { job_id: "J031", client_id: 8, mode: "Air", origin: "Chennai", destination: "Detroit", trade_lane: "Export", service: "Forwarding+Customs", job_date: "2024-10-16", revenue: 58000, cost: 41000, status: "Completed", days_to_close: 5 },
  { job_id: "J032", client_id: 4, mode: "Ocean FCL", origin: "Shanghai", destination: "Chennai", trade_lane: "Import", service: "Forwarding+Customs+3PL", job_date: "2024-11-01", revenue: 91000, cost: 69000, status: "Completed", days_to_close: 22 },
  { job_id: "J033", client_id: 6, mode: "Ocean LCL", origin: "Chennai", destination: "Jebel Ali", trade_lane: "Export", service: "Forwarding+Customs", job_date: "2024-11-08", revenue: 21000, cost: 15000, status: "Completed", days_to_close: 13 },
  { job_id: "J034", client_id: 1, mode: "Ocean FCL", origin: "Chennai", destination: "Antwerp", trade_lane: "Export", service: "Forwarding+Customs", job_date: "2024-11-15", revenue: 73000, cost: 55000, status: "Completed", days_to_close: 20 },
  { job_id: "J035", client_id: 7, mode: "Air", origin: "Chennai", destination: "Los Angeles", trade_lane: "Export", service: "Forwarding+Customs", job_date: "2024-11-22", revenue: 43000, cost: 30000, status: "Completed", days_to_close: 6 },
  { job_id: "J036", client_id: 5, mode: "Ocean FCL", origin: "Chennai", destination: "Rotterdam", trade_lane: "Export", service: "Forwarding+Customs", job_date: "2024-12-04", revenue: 70000, cost: 53000, status: "Completed", days_to_close: 19 },
  { job_id: "J037", client_id: 2, mode: "Air", origin: "Chennai", destination: "Chicago", trade_lane: "Export", service: "Forwarding+Customs", job_date: "2024-12-11", revenue: 63000, cost: 45000, status: "Completed", days_to_close: 5 },
  { job_id: "J038", client_id: 8, mode: "Ocean FCL", origin: "Chennai", destination: "Hamburg", trade_lane: "Export", service: "Forwarding+Customs", job_date: "2025-01-08", revenue: 77000, cost: 58000, status: "Completed", days_to_close: 21 },
  { job_id: "J039", client_id: 4, mode: "Project Cargo", origin: "Chennai", destination: "Jubail", trade_lane: "Export", service: "Forwarding+Customs", job_date: "2025-01-15", revenue: 195000, cost: 151000, status: "Completed", days_to_close: 32 },
  { job_id: "J040", client_id: 3, mode: "Ocean FCL", origin: "Chennai", destination: "New York", trade_lane: "Export", service: "Forwarding+Customs", job_date: "2025-02-05", revenue: 78000, cost: 59000, status: "In Progress", days_to_close: null },
  { job_id: "J041", client_id: 6, mode: "Air", origin: "Basel", destination: "Chennai", trade_lane: "Import", service: "Forwarding+Customs", job_date: "2025-02-12", revenue: 49000, cost: 34000, status: "In Progress", days_to_close: null },
  { job_id: "J042", client_id: 1, mode: "Ocean FCL", origin: "Chennai", destination: "Rotterdam", trade_lane: "Export", service: "Forwarding+Customs", job_date: "2025-02-18", revenue: 74000, cost: 55000, status: "In Progress", days_to_close: null },
];

export const CUSTOMS_FILINGS = [
  { filing_id: "CF001", job_id: "J001", filing_type: "Shipping Bill", hs_code: "8708.99", description: "Auto parts - suspension components", cif_value: 320000, duty_amount: 0, examination: false, amendments: 0, days_to_clear: 2 },
  { filing_id: "CF002", job_id: "J002", filing_type: "Shipping Bill", hs_code: "3004.90", description: "Pharmaceutical preparations", cif_value: 185000, duty_amount: 0, examination: false, amendments: 1, days_to_clear: 1 },
  { filing_id: "CF003", job_id: "J003", filing_type: "Shipping Bill", hs_code: "6006.32", description: "Knitted fabric - polyester", cif_value: 145000, duty_amount: 0, examination: true, amendments: 0, days_to_clear: 3 },
  { filing_id: "CF004", job_id: "J004", filing_type: "Bill of Entry", hs_code: "8429.51", description: "Bulldozers and angledozers", cif_value: 2800000, duty_amount: 196000, examination: true, amendments: 2, days_to_clear: 5 },
  { filing_id: "CF005", job_id: "J005", filing_type: "Shipping Bill", hs_code: "8708.29", description: "Auto parts - body panels", cif_value: 290000, duty_amount: 0, examination: false, amendments: 0, days_to_clear: 1 },
  { filing_id: "CF006", job_id: "J006", filing_type: "Shipping Bill", hs_code: "7318.15", description: "Threaded fasteners - steel", cif_value: 210000, duty_amount: 0, examination: false, amendments: 0, days_to_clear: 1 },
  { filing_id: "CF007", job_id: "J007", filing_type: "Bill of Entry", hs_code: "3004.20", description: "Antibiotics formulations", cif_value: 420000, duty_amount: 12600, examination: false, amendments: 0, days_to_clear: 2 },
  { filing_id: "CF008", job_id: "J009", filing_type: "Shipping Bill", hs_code: "7326.90", description: "Forged steel components", cif_value: 380000, duty_amount: 0, examination: false, amendments: 1, days_to_clear: 2 },
  { filing_id: "CF009", job_id: "J010", filing_type: "Shipping Bill", hs_code: "3004.50", description: "Vitamins and pharmaceutical prep", cif_value: 220000, duty_amount: 0, examination: false, amendments: 0, days_to_clear: 1 },
  { filing_id: "CF010", job_id: "J011", filing_type: "Bill of Entry", hs_code: "8474.20", description: "Crushing and grinding machinery", cif_value: 5600000, duty_amount: 392000, examination: true, amendments: 3, days_to_clear: 8 },
  { filing_id: "CF011", job_id: "J012", filing_type: "Shipping Bill", hs_code: "6006.31", description: "Knitted fabric - cotton", cif_value: 98000, duty_amount: 0, examination: false, amendments: 0, days_to_clear: 1 },
  { filing_id: "CF012", job_id: "J013", filing_type: "Shipping Bill", hs_code: "8708.99", description: "Auto parts - engine mounts", cif_value: 310000, duty_amount: 0, examination: false, amendments: 0, days_to_clear: 1 },
  { filing_id: "CF013", job_id: "J014", filing_type: "Shipping Bill", hs_code: "7318.16", description: "Nuts and bolts - high tensile", cif_value: 240000, duty_amount: 0, examination: true, amendments: 1, days_to_clear: 3 },
  { filing_id: "CF014", job_id: "J015", filing_type: "Bill of Entry", hs_code: "3004.90", description: "Pharmaceutical API", cif_value: 580000, duty_amount: 17400, examination: false, amendments: 0, days_to_clear: 2 },
  { filing_id: "CF015", job_id: "J016", filing_type: "Shipping Bill", hs_code: "6006.22", description: "Woven fabric - cotton", cif_value: 195000, duty_amount: 0, examination: false, amendments: 0, days_to_clear: 1 },
  { filing_id: "CF016", job_id: "J017", filing_type: "Shipping Bill", hs_code: "7326.19", description: "Forged components - alloy steel", cif_value: 295000, duty_amount: 0, examination: false, amendments: 0, days_to_clear: 1 },
  { filing_id: "CF017", job_id: "J018", filing_type: "Bill of Entry", hs_code: "8456.11", description: "Laser cutting machines", cif_value: 3800000, duty_amount: 266000, examination: true, amendments: 2, days_to_clear: 6 },
  { filing_id: "CF018", job_id: "J019", filing_type: "Shipping Bill", hs_code: "3004.31", description: "Insulin preparations", cif_value: 195000, duty_amount: 0, examination: false, amendments: 0, days_to_clear: 1 },
  { filing_id: "CF019", job_id: "J021", filing_type: "Shipping Bill", hs_code: "6006.33", description: "Knitted fabric - man-made fibre", cif_value: 162000, duty_amount: 0, examination: false, amendments: 1, days_to_clear: 2 },
  { filing_id: "CF020", job_id: "J023", filing_type: "Shipping Bill", hs_code: "7326.90", description: "Machined forging - crankshafts", cif_value: 410000, duty_amount: 0, examination: false, amendments: 0, days_to_clear: 1 },
  { filing_id: "CF021", job_id: "J024", filing_type: "Bill of Entry", hs_code: "3004.90", description: "Biological drug substances", cif_value: 640000, duty_amount: 19200, examination: false, amendments: 0, days_to_clear: 2 },
  { filing_id: "CF022", job_id: "J025", filing_type: "Shipping Bill", hs_code: "8474.39", description: "Industrial mixing machinery", cif_value: 4200000, duty_amount: 0, examination: true, amendments: 1, days_to_clear: 4 },
  { filing_id: "CF023", job_id: "J026", filing_type: "Shipping Bill", hs_code: "6006.34", description: "Warp knit fabric", cif_value: 118000, duty_amount: 0, examination: false, amendments: 0, days_to_clear: 1 },
  { filing_id: "CF024", job_id: "J027", filing_type: "Shipping Bill", hs_code: "8708.30", description: "Auto parts - brakes and servos", cif_value: 305000, duty_amount: 0, examination: false, amendments: 0, days_to_clear: 1 },
  { filing_id: "CF025", job_id: "J028", filing_type: "Shipping Bill", hs_code: "3004.20", description: "Antibiotic formulations - export", cif_value: 240000, duty_amount: 0, examination: false, amendments: 0, days_to_clear: 1 },
  { filing_id: "CF026", job_id: "J029", filing_type: "Bill of Entry", hs_code: "7318.21", description: "Spring washers - alloy steel", cif_value: 460000, duty_amount: 32200, examination: false, amendments: 0, days_to_clear: 3 },
  { filing_id: "CF027", job_id: "J030", filing_type: "Shipping Bill", hs_code: "6006.22", description: "Cotton woven - export", cif_value: 205000, duty_amount: 0, examination: false, amendments: 1, days_to_clear: 2 },
  { filing_id: "CF028", job_id: "J031", filing_type: "Shipping Bill", hs_code: "7326.90", description: "Forged steel rings", cif_value: 320000, duty_amount: 0, examination: true, amendments: 2, days_to_clear: 4 },
  { filing_id: "CF029", job_id: "J032", filing_type: "Bill of Entry", hs_code: "8457.10", description: "Machining centres for metals", cif_value: 4900000, duty_amount: 343000, examination: true, amendments: 3, days_to_clear: 9 },
  { filing_id: "CF030", job_id: "J034", filing_type: "Shipping Bill", hs_code: "8708.99", description: "Auto parts - transmission", cif_value: 340000, duty_amount: 0, examination: false, amendments: 0, days_to_clear: 1 },
  { filing_id: "CF031", job_id: "J036", filing_type: "Shipping Bill", hs_code: "7318.15", description: "Threaded fasteners - stainless", cif_value: 255000, duty_amount: 0, examination: false, amendments: 0, days_to_clear: 1 },
  { filing_id: "CF032", job_id: "J038", filing_type: "Shipping Bill", hs_code: "7326.11", description: "Grinding balls - forged steel", cif_value: 350000, duty_amount: 0, examination: false, amendments: 1, days_to_clear: 2 },
  { filing_id: "CF033", job_id: "J039", filing_type: "Shipping Bill", hs_code: "8474.10", description: "Sorting and screening machinery", cif_value: 3900000, duty_amount: 0, examination: false, amendments: 0, days_to_clear: 2 },
];

export const WAREHOUSE = [
  { record_id: "W001", client_id: 4, commodity: "Crushing machinery components", cbm: 48, entry_date: "2024-02-20", exit_date: "2024-03-05", charges: 28800 },
  { record_id: "W002", client_id: 4, commodity: "Laser cutting machine", cbm: 62, entry_date: "2024-06-25", exit_date: "2024-07-08", charges: 40300 },
  { record_id: "W003", client_id: 3, commodity: "Cotton fabric rolls", cbm: 35, entry_date: "2024-10-12", exit_date: "2024-10-22", charges: 17500 },
  { record_id: "W004", client_id: 7, commodity: "Knitted fabric - export ready", cbm: 28, entry_date: "2024-06-05", exit_date: "2024-06-14", charges: 12600 },
  { record_id: "W005", client_id: 5, commodity: "Fastener components - staging", cbm: 18, entry_date: "2024-10-05", exit_date: "2024-10-15", charges: 9000 },
  { record_id: "W006", client_id: 4, commodity: "Machining centre - bonded", cbm: 74, entry_date: "2024-11-05", exit_date: "2024-11-20", charges: 51800 },
];

// ── SCHEMA DESCRIPTION FOR CLAUDE ─────────────────────────────────────────────
export const SCHEMA_DESC = `
You are a logistics data analyst for CFF (Combined Freight Forwarders), a Chennai-based freight forwarding company.

DATABASE SCHEMA:
1. CLIENTS (client_id, name, industry, country, onboarded_year)
2. JOBS (job_id, client_id, mode, origin, destination, trade_lane, service, job_date, revenue, cost, status, days_to_close)
   - mode: "Ocean FCL", "Ocean LCL", "Air", "Project Cargo"
   - trade_lane: "Export", "Import"
   - service: "Forwarding", "Forwarding+Customs", "Forwarding+Customs+3PL"
   - status: "Completed", "In Progress"
   - revenue, cost in INR
3. CUSTOMS_FILINGS (filing_id, job_id, filing_type, hs_code, description, cif_value, duty_amount, examination, amendments, days_to_clear)
   - filing_type: "Shipping Bill" (export) or "Bill of Entry" (import)
   - examination: boolean (true = customs examined the cargo)
   - amendments: number of post-filing corrections needed
4. WAREHOUSE (record_id, client_id, commodity, cbm, entry_date, exit_date, charges)
5. DRAWBACK_RATES (hs_chapter, description, rate_pct)
6. DRAWBACK_CLAIMS (claim_id, client_id, import_filing, export_filing, hs_chapter, eligible_amount, status, identified_date)
7. BASELINE_METRICS (client_id, quarter, amendment_count, examination_count, filings)
8. QUOTES (quote_id, client_id, trade_lane, origin, destination, mode, commodity_type, quoted_revenue, actual_cost, won)

`;

// ── SAMPLE QUESTIONS ───────────────────────────────────────────────────────────
export const SAMPLE_QUESTIONS = [
  "Which client gives us the highest gross margin across all services?",
  "How many of our customs filings needed amendments in the last 12 months and for which clients?",
  "Show me profit margin by freight mode",
  "Which trade lane — import or export — is more profitable for us?",
  "Which clients use more than one service type?",
  "Show customs examination rate by industry",
];

// ── TRADE LANE COORDINATES ────────────────────────────────────────────────────
export const CITY_COORDS = {
  "Chennai": [80.27, 13.08], "Mumbai": [72.88, 19.08],
  "Rotterdam": [4.48, 51.92], "Frankfurt": [8.68, 50.11],
  "Los Angeles": [-118.24, 34.05], "Antwerp": [4.40, 51.22],
  "Detroit": [-83.05, 42.33], "Singapore": [103.82, 1.35],
  "Hamburg": [9.99, 53.55], "New York": [-74.01, 40.71],
  "Chicago": [-87.63, 41.88], "London": [-0.13, 51.51],
  "Jebel Ali": [55.17, 25.07], "Shanghai": [121.47, 31.23],
  "Tokyo": [139.69, 35.68], "Stuttgart": [9.18, 48.78],
  "Busan": [129.08, 35.18], "Ningbo": [121.55, 29.87],
  "Guangzhou": [113.26, 23.13], "Amsterdam": [4.90, 52.37],
  "Dammam": [50.09, 26.42], "Jubail": [49.66, 27.00],
  "Dubai": [55.30, 25.20], "Basel": [7.59, 47.56],
};

// ── COLOUR SYSTEM ──────────────────────────────────────────────────────────────
export const C = {
  bg: "#0B0F1A",
  surface: "#111827",
  card: "#161D2E",
  border: "#1E2A3E",
  accent: "#E8A838",
  accentDim: "#3D2E0E",
  text: "#E8EDF4",
  muted: "#7A8BAA",
  green: "#2ECC71",
  yellow: "#F39C12",
  red: "#E74C3C",
};

// CBIC drawback rates by HS chapter (simplified)
export const DRAWBACK_RATES = [
  { hs_chapter: "84", description: "Machinery & mechanical appliances", rate_pct: 2.0 },
{ hs_chapter: "87", description: "Vehicles & auto parts", rate_pct: 1.8 },
{ hs_chapter: "73", description: "Articles of iron or steel", rate_pct: 1.5 },
{ hs_chapter: "63", description: "Textile made-up articles", rate_pct: 3.5 },
{ hs_chapter: "60", description: "Knitted or crocheted fabrics", rate_pct: 3.2 },
{ hs_chapter: "30", description: "Pharmaceutical products", rate_pct: 1.0 },
{ hs_chapter: "74", description: "Copper and articles thereof", rate_pct: 1.6 },
];

// Duty drawback claims log
export const DRAWBACK_CLAIMS = [
  { claim_id: "DB001", client_id: 4, import_filing: "CF010", export_filing: null, hs_chapter: "84", eligible_amount: 11200, status: "Unclaimed", identified_date: "2025-02-01" },
{ claim_id: "DB002", client_id: 4, import_filing: "CF017", export_filing: null, hs_chapter: "84", eligible_amount: 5320, status: "Unclaimed", identified_date: "2025-02-01" },
{ claim_id: "DB003", client_id: 4, import_filing: "CF029", export_filing: null, hs_chapter: "84", eligible_amount: 6860, status: "Unclaimed", identified_date: "2025-02-01" },
{ claim_id: "DB004", client_id: 5, import_filing: "CF026", export_filing: "CF031", hs_chapter: "73", eligible_amount: 4830, status: "Filed", identified_date: "2025-01-10" },
{ claim_id: "DB005", client_id: 1, import_filing: null, export_filing: "CF001", hs_chapter: "87", eligible_amount: 5760, status: "Unclaimed", identified_date: "2025-02-01" },
];

// Quarterly baseline: amendment and examination history per client
export const BASELINE_METRICS = [
  { client_id: 1, quarter: "Q1-2024", amendment_count: 0, examination_count: 0, filings: 2 },
{ client_id: 1, quarter: "Q2-2024", amendment_count: 0, examination_count: 0, filings: 2 },
{ client_id: 1, quarter: "Q3-2024", amendment_count: 0, examination_count: 0, filings: 2 },
{ client_id: 1, quarter: "Q4-2024", amendment_count: 0, examination_count: 1, filings: 2 },
{ client_id: 2, quarter: "Q1-2024", amendment_count: 1, examination_count: 0, filings: 2 },
{ client_id: 2, quarter: "Q2-2024", amendment_count: 0, examination_count: 0, filings: 1 },
{ client_id: 2, quarter: "Q3-2024", amendment_count: 0, examination_count: 0, filings: 2 },
{ client_id: 2, quarter: "Q4-2024", amendment_count: 0, examination_count: 0, filings: 2 },
{ client_id: 4, quarter: "Q1-2024", amendment_count: 2, examination_count: 1, filings: 2 },
{ client_id: 4, quarter: "Q2-2024", amendment_count: 3, examination_count: 2, filings: 2 },
{ client_id: 4, quarter: "Q3-2024", amendment_count: 1, examination_count: 1, filings: 1 },
{ client_id: 4, quarter: "Q4-2024", amendment_count: 3, examination_count: 2, filings: 2 },
{ client_id: 5, quarter: "Q1-2024", amendment_count: 0, examination_count: 0, filings: 1 },
{ client_id: 5, quarter: "Q2-2024", amendment_count: 1, examination_count: 1, filings: 1 },
{ client_id: 5, quarter: "Q3-2024", amendment_count: 0, examination_count: 0, filings: 1 },
{ client_id: 5, quarter: "Q4-2024", amendment_count: 0, examination_count: 0, filings: 1 },
{ client_id: 8, quarter: "Q1-2024", amendment_count: 1, examination_count: 0, filings: 1 },
{ client_id: 8, quarter: "Q2-2024", amendment_count: 0, examination_count: 0, filings: 2 },
{ client_id: 8, quarter: "Q3-2024", amendment_count: 2, examination_count: 1, filings: 2 },
{ client_id: 8, quarter: "Q4-2024", amendment_count: 2, examination_count: 1, filings: 2 },
];

// Historical quote log with win/loss outcomes
export const QUOTES = [
  { quote_id: "Q001", client_id: 1, trade_lane: "Export", origin: "Chennai", destination: "Rotterdam", mode: "Ocean FCL", commodity_type: "Auto Parts", quoted_revenue: 74000, actual_cost: 54000, won: true },
{ quote_id: "Q002", client_id: 1, trade_lane: "Export", origin: "Chennai", destination: "Antwerp", mode: "Ocean FCL", commodity_type: "Auto Parts", quoted_revenue: 70000, actual_cost: 52000, won: true },
{ quote_id: "Q003", client_id: 3, trade_lane: "Export", origin: "Chennai", destination: "Los Angeles", mode: "Ocean LCL", commodity_type: "Textiles", quoted_revenue: 25000, actual_cost: 19000, won: true },
{ quote_id: "Q004", client_id: 3, trade_lane: "Export", origin: "Chennai", destination: "Los Angeles", mode: "Ocean LCL", commodity_type: "Textiles", quoted_revenue: 32000, actual_cost: 19000, won: false },
{ quote_id: "Q005", client_id: 5, trade_lane: "Export", origin: "Chennai", destination: "Detroit", mode: "Air", commodity_type: "Fasteners", quoted_revenue: 52000, actual_cost: 38000, won: true },
{ quote_id: "Q006", client_id: 5, trade_lane: "Export", origin: "Chennai", destination: "Detroit", mode: "Air", commodity_type: "Fasteners", quoted_revenue: 48000, actual_cost: 38000, won: true },
{ quote_id: "Q007", client_id: 5, trade_lane: "Export", origin: "Chennai", destination: "Detroit", mode: "Air", commodity_type: "Fasteners", quoted_revenue: 62000, actual_cost: 38000, won: false },
{ quote_id: "Q008", client_id: 8, trade_lane: "Export", origin: "Chennai", destination: "Antwerp", mode: "Ocean FCL", commodity_type: "Forged Steel", quoted_revenue: 73000, actual_cost: 54000, won: true },
{ quote_id: "Q009", client_id: 8, trade_lane: "Export", origin: "Chennai", destination: "Hamburg", mode: "Ocean FCL", commodity_type: "Forged Steel", quoted_revenue: 79000, actual_cost: 58000, won: true },
{ quote_id: "Q010", client_id: 8, trade_lane: "Export", origin: "Chennai", destination: "Hamburg", mode: "Ocean FCL", commodity_type: "Forged Steel", quoted_revenue: 85000, actual_cost: 58000, won: false },
{ quote_id: "Q011", client_id: 4, trade_lane: "Import", origin: "Shanghai", destination: "Chennai", mode: "Ocean FCL", commodity_type: "Machinery", quoted_revenue: 88000, actual_cost: 61000, won: true },
{ quote_id: "Q012", client_id: 4, trade_lane: "Import", origin: "Guangzhou", destination: "Chennai", mode: "Project Cargo", commodity_type: "Machinery", quoted_revenue: 175000, actual_cost: 138000, won: true },
{ quote_id: "Q013", client_id: 2, trade_lane: "Export", origin: "Chennai", destination: "Frankfurt", mode: "Air", commodity_type: "Pharma", quoted_revenue: 46000, actual_cost: 33000, won: true },
{ quote_id: "Q014", client_id: 2, trade_lane: "Export", origin: "Chennai", destination: "Frankfurt", mode: "Air", commodity_type: "Pharma", quoted_revenue: 55000, actual_cost: 33000, won: false },
{ quote_id: "Q015", client_id: 6, trade_lane: "Import", origin: "Frankfurt", destination: "Chennai", mode: "Air", commodity_type: "Pharma", quoted_revenue: 40000, actual_cost: 26000, won: true },
];

export const CARRIERS = [
  { carrier_id:"C01", name:"Maersk Line",        mode:"Ocean FCL",    primary_lanes:["Chennai-Rotterdam","Chennai-Antwerp","Chennai-Hamburg"] },
  { carrier_id:"C02", name:"MSC",                mode:"Ocean FCL",    primary_lanes:["Chennai-Rotterdam","Chennai-New York","Busan-Chennai"] },
  { carrier_id:"C03", name:"CMA CGM",            mode:"Ocean FCL",    primary_lanes:["Shanghai-Chennai","Ningbo-Chennai","Chennai-Hamburg"] },
  { carrier_id:"C04", name:"Hapag-Lloyd",        mode:"Ocean FCL",    primary_lanes:["Chennai-Antwerp","Chennai-New York","Guangzhou-Chennai"] },
  { carrier_id:"C05", name:"Emirates SkyCargo",  mode:"Air",          primary_lanes:["Chennai-Frankfurt","Chennai-London","Amsterdam-Chennai"] },
  { carrier_id:"C06", name:"Qatar Airways Cargo",mode:"Air",          primary_lanes:["Chennai-Frankfurt","Chennai-Chicago","Chennai-Detroit"] },
  { carrier_id:"C07", name:"Air India Cargo",    mode:"Air",          primary_lanes:["Chennai-London","Mumbai-Chicago","Chennai-Detroit"] },
  { carrier_id:"C08", name:"Evergreen",          mode:"Ocean LCL",    primary_lanes:["Chennai-Los Angeles","Chennai-Hamburg","Chennai-Dubai"] },
  { carrier_id:"C09", name:"PIL",                mode:"Ocean LCL",    primary_lanes:["Chennai-Jebel Ali","Chennai-Dubai","Singapore-Chennai"] },
  { carrier_id:"C10", name:"Blue Dart",          mode:"Project Cargo",primary_lanes:["Chennai-Dammam","Chennai-Jubail","Guangzhou-Chennai"] },
];

export const JOB_COST_LINES = [
  { line_id:"JCL001", job_id:"J001", carrier_id:"C01", cost_type:"Freight",       buy_amount:42000, sell_amount:54000, billed_to_customer:true  },
  { line_id:"JCL002", job_id:"J001", carrier_id:"C01", cost_type:"Port Handling", buy_amount:8000,  sell_amount:10000, billed_to_customer:true  },
  { line_id:"JCL003", job_id:"J001", carrier_id:"C01", cost_type:"Documentation", buy_amount:2000,  sell_amount:2000,  billed_to_customer:true  },
  { line_id:"JCL004", job_id:"J001", carrier_id:"C01", cost_type:"Detention",     buy_amount:2000,  sell_amount:0,     billed_to_customer:false },

  { line_id:"JCL005", job_id:"J002", carrier_id:"C05", cost_type:"Freight",       buy_amount:26000, sell_amount:36000, billed_to_customer:true  },
  { line_id:"JCL006", job_id:"J002", carrier_id:"C05", cost_type:"Fuel Surcharge",buy_amount:5000,  sell_amount:7000,  billed_to_customer:true  },
  { line_id:"JCL007", job_id:"J002", carrier_id:"C05", cost_type:"Documentation", buy_amount:2000,  sell_amount:5000,  billed_to_customer:true  },

  { line_id:"JCL008", job_id:"J004", carrier_id:"C03", cost_type:"Freight",       buy_amount:48000, sell_amount:62000, billed_to_customer:true  },
  { line_id:"JCL009", job_id:"J004", carrier_id:"C03", cost_type:"Port Handling", buy_amount:9000,  sell_amount:11000, billed_to_customer:true  },
  { line_id:"JCL010", job_id:"J004", carrier_id:"C03", cost_type:"Demurrage",     buy_amount:4000,  sell_amount:0,     billed_to_customer:false },

  { line_id:"JCL011", job_id:"J005", carrier_id:"C01", cost_type:"Freight",       buy_amount:40000, sell_amount:50000, billed_to_customer:true  },
  { line_id:"JCL012", job_id:"J005", carrier_id:"C01", cost_type:"Port Handling", buy_amount:8000,  sell_amount:10000, billed_to_customer:true  },
  { line_id:"JCL013", job_id:"J005", carrier_id:"C01", cost_type:"Detention",     buy_amount:2000,  sell_amount:0,     billed_to_customer:false },
  { line_id:"JCL014", job_id:"J005", carrier_id:"C01", cost_type:"Documentation", buy_amount:2000,  sell_amount:8000,  billed_to_customer:true  },

  { line_id:"JCL015", job_id:"J006", carrier_id:"C06", cost_type:"Freight",       buy_amount:30000, sell_amount:42000, billed_to_customer:true  },
  { line_id:"JCL016", job_id:"J006", carrier_id:"C06", cost_type:"Fuel Surcharge",buy_amount:6000,  sell_amount:8000,  billed_to_customer:true  },
  { line_id:"JCL017", job_id:"J006", carrier_id:"C06", cost_type:"Documentation", buy_amount:2000,  sell_amount:5000,  billed_to_customer:true  },

  { line_id:"JCL018", job_id:"J009", carrier_id:"C02", cost_type:"Freight",       buy_amount:44000, sell_amount:58000, billed_to_customer:true  },
  { line_id:"JCL019", job_id:"J009", carrier_id:"C02", cost_type:"Port Handling", buy_amount:8000,  sell_amount:10000, billed_to_customer:true  },
  { line_id:"JCL020", job_id:"J009", carrier_id:"C02", cost_type:"Demurrage",     buy_amount:6000,  sell_amount:3000,  billed_to_customer:true  },
  { line_id:"JCL021", job_id:"J009", carrier_id:"C02", cost_type:"Detention",     buy_amount:3000,  sell_amount:0,     billed_to_customer:false },

  { line_id:"JCL022", job_id:"J013", carrier_id:"C01", cost_type:"Freight",       buy_amount:44000, sell_amount:56000, billed_to_customer:true  },
  { line_id:"JCL023", job_id:"J013", carrier_id:"C01", cost_type:"Port Handling", buy_amount:8000,  sell_amount:10000, billed_to_customer:true  },
  { line_id:"JCL024", job_id:"J013", carrier_id:"C01", cost_type:"Documentation", buy_amount:2000,  sell_amount:4000,  billed_to_customer:true  },
  { line_id:"JCL025", job_id:"J013", carrier_id:"C01", cost_type:"Detention",     buy_amount:3000,  sell_amount:0,     billed_to_customer:false },

  { line_id:"JCL026", job_id:"J016", carrier_id:"C08", cost_type:"Freight",       buy_amount:46000, sell_amount:58000, billed_to_customer:true  },
  { line_id:"JCL027", job_id:"J016", carrier_id:"C08", cost_type:"Port Handling", buy_amount:9000,  sell_amount:12000, billed_to_customer:true  },
  { line_id:"JCL028", job_id:"J016", carrier_id:"C08", cost_type:"Demurrage",     buy_amount:6000,  sell_amount:0,     billed_to_customer:false },

  { line_id:"JCL029", job_id:"J018", carrier_id:"C03", cost_type:"Freight",       buy_amount:56000, sell_amount:72000, billed_to_customer:true  },
  { line_id:"JCL030", job_id:"J018", carrier_id:"C03", cost_type:"Port Handling", buy_amount:10000, sell_amount:14000, billed_to_customer:true  },
  { line_id:"JCL031", job_id:"J018", carrier_id:"C03", cost_type:"Detention",     buy_amount:6000,  sell_amount:0,     billed_to_customer:false },

  { line_id:"JCL032", job_id:"J023", carrier_id:"C04", cost_type:"Freight",       buy_amount:42000, sell_amount:54000, billed_to_customer:true  },
  { line_id:"JCL033", job_id:"J023", carrier_id:"C04", cost_type:"Port Handling", buy_amount:8000,  sell_amount:10000, billed_to_customer:true  },
  { line_id:"JCL034", job_id:"J023", carrier_id:"C04", cost_type:"Documentation", buy_amount:2000,  sell_amount:4000,  billed_to_customer:true  },
  { line_id:"JCL035", job_id:"J023", carrier_id:"C04", cost_type:"Fuel Surcharge",buy_amount:2000,  sell_amount:3000,  billed_to_customer:true  },

  { line_id:"JCL036", job_id:"J027", carrier_id:"C02", cost_type:"Freight",       buy_amount:44000, sell_amount:57000, billed_to_customer:true  },
  { line_id:"JCL037", job_id:"J027", carrier_id:"C02", cost_type:"Port Handling", buy_amount:8000,  sell_amount:10000, billed_to_customer:true  },
  { line_id:"JCL038", job_id:"J027", carrier_id:"C02", cost_type:"Detention",     buy_amount:5000,  sell_amount:0,     billed_to_customer:false },

  { line_id:"JCL039", job_id:"J030", carrier_id:"C08", cost_type:"Freight",       buy_amount:48000, sell_amount:62000, billed_to_customer:true  },
  { line_id:"JCL040", job_id:"J030", carrier_id:"C08", cost_type:"Port Handling", buy_amount:9000,  sell_amount:12000, billed_to_customer:true  },
  { line_id:"JCL041", job_id:"J030", carrier_id:"C08", cost_type:"Demurrage",     buy_amount:6000,  sell_amount:0,     billed_to_customer:false },

  { line_id:"JCL042", job_id:"J034", carrier_id:"C01", cost_type:"Freight",       buy_amount:42000, sell_amount:54000, billed_to_customer:true  },
  { line_id:"JCL043", job_id:"J034", carrier_id:"C01", cost_type:"Port Handling", buy_amount:8000,  sell_amount:10000, billed_to_customer:true  },
  { line_id:"JCL044", job_id:"J034", carrier_id:"C01", cost_type:"Documentation", buy_amount:3000,  sell_amount:5000,  billed_to_customer:true  },
  { line_id:"JCL045", job_id:"J034", carrier_id:"C01", cost_type:"Detention",     buy_amount:2000,  sell_amount:0,     billed_to_customer:false },

  { line_id:"JCL046", job_id:"J038", carrier_id:"C04", cost_type:"Freight",       buy_amount:44000, sell_amount:58000, billed_to_customer:true  },
  { line_id:"JCL047", job_id:"J038", carrier_id:"C04", cost_type:"Port Handling", buy_amount:9000,  sell_amount:11000, billed_to_customer:true  },
  { line_id:"JCL048", job_id:"J038", carrier_id:"C04", cost_type:"Demurrage",     buy_amount:5000,  sell_amount:0,     billed_to_customer:false },
];

export const RATE_HISTORY = [
  { rate_id:"R001", client_id:1, origin:"Chennai", destination:"Rotterdam",   mode:"Ocean FCL", quarter:"Q1-2024", sell_rate:72000, buy_rate:54000 },
  { rate_id:"R002", client_id:1, origin:"Chennai", destination:"Rotterdam",   mode:"Ocean FCL", quarter:"Q2-2024", sell_rate:74000, buy_rate:55000 },
  { rate_id:"R003", client_id:1, origin:"Chennai", destination:"Rotterdam",   mode:"Ocean FCL", quarter:"Q3-2024", sell_rate:75000, buy_rate:56000 },
  { rate_id:"R004", client_id:1, origin:"Chennai", destination:"Rotterdam",   mode:"Ocean FCL", quarter:"Q4-2024", sell_rate:73000, buy_rate:55000 },

  { rate_id:"R005", client_id:4, origin:"Shanghai",  destination:"Chennai",   mode:"Ocean FCL", quarter:"Q1-2024", sell_rate:85000, buy_rate:61000 },
  { rate_id:"R006", client_id:4, origin:"Shanghai",  destination:"Chennai",   mode:"Ocean FCL", quarter:"Q2-2024", sell_rate:83000, buy_rate:61000 },
  { rate_id:"R007", client_id:4, origin:"Shanghai",  destination:"Chennai",   mode:"Ocean FCL", quarter:"Q3-2024", sell_rate:80000, buy_rate:61000 },
  { rate_id:"R008", client_id:4, origin:"Shanghai",  destination:"Chennai",   mode:"Ocean FCL", quarter:"Q4-2024", sell_rate:91000, buy_rate:69000 },

  { rate_id:"R009", client_id:2, origin:"Chennai", destination:"Frankfurt",   mode:"Air",       quarter:"Q1-2024", sell_rate:48000, buy_rate:33000 },
  { rate_id:"R010", client_id:2, origin:"Chennai", destination:"Frankfurt",   mode:"Air",       quarter:"Q2-2024", sell_rate:47000, buy_rate:33000 },
  { rate_id:"R011", client_id:2, origin:"Chennai", destination:"Frankfurt",   mode:"Air",       quarter:"Q3-2024", sell_rate:50000, buy_rate:35000 },
  { rate_id:"R012", client_id:2, origin:"Chennai", destination:"Frankfurt",   mode:"Air",       quarter:"Q4-2024", sell_rate:63000, buy_rate:45000 },

  { rate_id:"R013", client_id:5, origin:"Chennai", destination:"Detroit",     mode:"Air",       quarter:"Q1-2024", sell_rate:55000, buy_rate:38000 },
  { rate_id:"R014", client_id:5, origin:"Chennai", destination:"Detroit",     mode:"Air",       quarter:"Q2-2024", sell_rate:69000, buy_rate:51000 },
  { rate_id:"R015", client_id:5, origin:"Chennai", destination:"Detroit",     mode:"Air",       quarter:"Q3-2024", sell_rate:39000, buy_rate:27000 },
  { rate_id:"R016", client_id:5, origin:"Chennai", destination:"Detroit",     mode:"Air",       quarter:"Q4-2024", sell_rate:70000, buy_rate:53000 },

  { rate_id:"R017", client_id:8, origin:"Chennai", destination:"Hamburg",     mode:"Ocean FCL", quarter:"Q1-2024", sell_rate:79000, buy_rate:58000 },
  { rate_id:"R018", client_id:8, origin:"Chennai", destination:"Antwerp",     mode:"Ocean FCL", quarter:"Q2-2024", sell_rate:71000, buy_rate:54000 },
  { rate_id:"R019", client_id:8, origin:"Chennai", destination:"Hamburg",     mode:"Ocean FCL", quarter:"Q4-2024", sell_rate:77000, buy_rate:58000 },

  { rate_id:"R020", client_id:3, origin:"Chennai", destination:"Los Angeles", mode:"Ocean LCL", quarter:"Q1-2024", sell_rate:28000, buy_rate:19000 },
  { rate_id:"R021", client_id:3, origin:"Chennai", destination:"Hamburg",     mode:"Ocean FCL", quarter:"Q3-2024", sell_rate:84000, buy_rate:63000 },
  { rate_id:"R022", client_id:3, origin:"Chennai", destination:"New York",    mode:"Ocean FCL", quarter:"Q4-2024", sell_rate:76000, buy_rate:58000 },
];
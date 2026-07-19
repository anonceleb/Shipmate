# CFF Analytics Intelligence

**AI-powered logistics, customs, and profitability analytics dashboard** for Combined Freight Forwarders (CFF) — a Chennai-based freight forwarding and customs brokerage company.

This interactive prototype lets operations, compliance, and commercial teams explore shipment data, recover duty drawbacks, stress-test quotes, and ask complex questions in natural language.

> **Two demo workspaces.** The app opens with a workspace picker:
> 1. **CFF Analytics Intelligence** — the freight-forwarder demo described below.
> 2. **Sattva CFS Intelligence** (`src/cfs/`) — a separate module targeted at Sattva Hi-Tech & Conware's "Balaji Container Terminal" CFS (Manali, Chennai). Positioned as an *overlay on their existing yard & billing systems*: tariff reconciliation & revenue-leakage recovery, dwell/ground-rent tracking, Section 48 long-stay/auction track, activity-based per-container profitability, throughput analytics, and an AI query tab. Every insight tab ends in an executable artifact (debit notes, demand notices, auction dockets, repricing memos — printable, logged to a persistent action register). Tariff figures are transcribed from Sattva's published tariff sheets (effective 15-06-2023 + current revision); all container/billing/cost data is synthetic.

## Features

### 🤖 AI Query Interface (`query` tab)
Ask anything about clients, margins, lanes, compliance, or customs activity.  
The app injects relevant slices of the live dataset plus the complete schema into a carefully engineered prompt. Claude returns a structured response containing:
- Equivalent SQL
- Plain-English summary with numbers
- Relevant data table (3–8 rows)
- Actionable business insight or recommendation

Includes a set of curated sample questions for instant exploration.

### 🔍 Job Exploration (`explore` tab)
Filterable, sortable table of 40+ jobs across Ocean FCL/LCL, Air, and Project Cargo.  
- Multi-dimensional filters (client, mode, trade lane, status)
- In-progress tracker with days-elapsed calculation
- Clickable client names that open rich scorecards

### 📋 Operations & Duty Drawback (`operations` tab)
- Automatically identifies unclaimed duty drawback opportunities from paired import/export filings using HS-chapter rates.
- Draft claims with live 18% CFF fee calculation.
- One-click "filing" (simulated) that generates ICEGATE-style references and persists to localStorage.
- Pre-filing compliance checker: historical amendment/examination patterns + estimated hours & cost savings.
- Export the full filing register to CSV.

### 💰 Quote Assist & Pipeline (`quoteassist` tab)
Historical quoting intelligence by transport mode + commodity type:
- Floor / median / ceiling actual costs
- Win-rate analysis at different pricing thresholds
- Draft quotes and save them to an in-app pipeline
- One-click CSV export of the entire pipeline

### 📈 Profitability & Visual Analytics (`profitability` + `charts` tabs)
- Client compliance risk scoring (weighted examination + amendment rates)
- Warehouse utilization and cost-per-CBM metrics
- Recharts-driven monthly revenue/cost/margin trends and mode breakdowns
- Interactive SVG trade-lane map with great-circle-style arcs

### 🏗️ Yard Digital Twin (CFS workspace → `Yard Twin` rail)
A simulation of container stacking in a CFS yard, in two modes.

**Operate the Yard (default)** — a turn-based exercise on a single block of 8 ground slots × 2 tiers.
A seeded scenario deals ~25 interleaved arrivals and pickups over 3 sim-days, and **nothing moves until you
act**: each arrival shows the container's size, type and predicted dwell, and you click where it goes. Hovering
a stack position tells you when the box underneath is forecast to leave. Bury a box that gets called for early
and you watch the rehandle animate and the cost meter tick up ₹450. A per-event **"What would Shipmate do?"**
button gives the policy's slot choice plus a one-sentence rationale. At the end, a scorecard compares your
rehandles and cost against the predictive policy replayed on the identical event sequence, with
**Replay as Shipmate** stepping through its reasoning move by move.

**Benchmark** — the full-scale auto-run: 8 blocks × 12 ground slots × 2 tiers, two yards on an identical
seeded arrival stream differing only in stacking policy — **baseline** (nearest available position, stack
whenever possible) versus **predictive** (dwell-bucket block segregation plus LIFO-consistent stacking driven
by a noisy dwell forecast). Top-down SVG yard views flash red on each rehandle; KPI panels and a
cumulative-rehandle chart price the difference at 4 reach-stacker minutes and ₹450 per rehandle.

Both modes are driven by the same pure TypeScript engine in `src/cfs/sim/`, fully separated from rendering and
covered by 108 unit tests. Scenario generation is seeded so the human operator and the policy face a
byte-identical event sequence, and the generator guarantees you can never be dealt an unplaceable box.
**The stacking algorithm, the rehandle accounting rule, parameter provenance, validation, and known limitations
are specified in [`src/cfs/sim/README.md`](src/cfs/sim/README.md)** — written to be cited directly in academic
work or an IP filing.

## Tech Stack

| Layer       | Technology                                      |
|-------------|-------------------------------------------------|
| Frontend    | React 19, Vite 8, Recharts, custom dark theme   |
| Backend     | Node.js + Express 5 (lightweight AI proxy only) |
| AI          | Anthropic Claude (`claude-sonnet-5`) |
| Data        | 100% synthetic mock dataset (no external DB)    |
| Persistence | Browser localStorage (`cff_claims`, `cff_filing_register`) |
| Styling     | CSS variables + inline styles + Space Mono accents |

## Getting Started

### Prerequisites
- Node.js ≥ 18
- npm
- Anthropic API key (required for AI features)

### Installation

```bash
npm install
```

### Environment Variables

Create a `.env` file in the project root (already ignored by Git):

```env
ANTHROPIC_API_KEY=sk-ant-api03-...
# Optional
PORT=3001
FRONTEND_URL=http://localhost:5173
```

### Running the App

You must run **both** the backend proxy and the frontend dev server.

**Terminal 1 – Backend (AI Proxy)**
```bash
node server.js
```
The server starts on port 3001 with rate limiting and CORS.

**Terminal 2 – Frontend**
```bash
npm run dev
```
Vite serves the app on http://localhost:5173 and automatically proxies `/api/*` calls to the backend.

## Project Structure

```
.
├── src/
│   ├── App.jsx                 # Central controller, all tab logic, AI query handler
│   ├── main.jsx                # React entry point
│   ├── components/
│   │   ├── ChartsTab.jsx
│   │   ├── ProfitabilityTab.jsx
│   │   ├── ScorecardModal.jsx
│   │   ├── TradeLaneMap.jsx
│   │   └── ClientLink.jsx
│   ├── cfs/                    # Sattva CFS Intelligence Module
│   │   ├── CfsApp.jsx          # Main controller and view engine for CFS workspace
│   │   ├── computations.js     # Dynamic metrics, yard rent, aggregates, and data partitioning
│   │   ├── constants.js        # CFS static tariff lists, synthetic containers, and schemas
│   │   ├── YardSimulator.jsx   # Yard Twin shell — mode tabs only
│   │   ├── InteractiveYard.jsx # "Operate the Yard" — turn-based, rendering only
│   │   ├── BenchmarkYard.jsx   # "Benchmark" — 30-day auto-run, rendering only
│   │   └── sim/                # Pure TypeScript simulation engine (no React, unit-tested)
│   │       ├── engine.ts       # Yard model, stacking policies, rehandle accounting, KPIs
│   │       ├── scenario.ts     # Seeded interactive scenarios, advice engine, policy replay
│   │       ├── rng.ts          # Seeded mulberry32 + normal/log-normal/Poisson draws
│   │       ├── types.ts        # Domain types
│   │       ├── engine.test.ts  # 49 unit tests (`npm test`)
│   │       ├── scenario.test.ts # 42 unit tests
│   │       ├── docs.test.ts    # 17 tests pinning README.md's figures to the engine
│   │       └── README.md       # Method write-up — citable in academic/IP filings
│   ├── data/
│   │   └── constants.js        # Full mock dataset + Claude schema prompt + color system
│   ├── utils/
│   │   └── computations.js     # Risk scoring, aggregates, formatters, map math
│   └── *.css
├── server.js                   # Express proxy to Anthropic (only place the API key is used)
├── vite.config.js              # React plugin + dev proxy for /api
├── package.json
├── ENGINEERING.md              # Detailed feature & architecture notes
├── update.cjs                  # Legacy one-time code-migration script (historical)
└── public/
```

## How the AI Integration Works

1. User types a question (or picks a sample).
2. Frontend (`App.jsx`) heuristically selects which tables are relevant based on keywords.
3. It assembles a rich system prompt: `SCHEMA_DESC` (full relational description) + selected JSON data + strict output contract.
4. POSTs to `/api/claude` (proxied by Vite during dev).
5. `server.js` forwards the request to Anthropic using `ANTHROPIC_API_KEY` from the environment.
6. Response is parsed for the first text block, cleaned of markdown fences, and rendered.

The key never touches the browser.

## Data Model Highlights

See `src/data/constants.js` for the complete values.

**Primary entities**:
- `CLIENTS` (8 Indian companies)
- `JOBS` (40+ shipments with revenue, cost, mode, lane, status, service scope)
- `CUSTOMS_FILINGS` (Shipping Bills & Bills of Entry, HS codes, CIF, examinations, amendments)
- `DRAWBACK_CLAIMS`, `QUOTES` (won/lost history), `WAREHOUSE`, `CARRIERS`, `JOB_COST_LINES`, `RATE_HISTORY`, `BASELINE_METRICS`

All amounts in INR. HS chapters and drawback rates are simplified but realistic.

## Scripts

| Command         | Description                              |
|-----------------|------------------------------------------|
| `npm run dev`   | Start Vite dev server (with HMR)         |
| `npm run build` | Build production bundle to `dist/`       |
| `npm run lint`  | Run ESLint                               |
| `npm test`      | Run the simulation-engine unit tests (also gates CI) |
| `npm run typecheck` | Type-check the TypeScript sim engine |
| `npm run preview`| Preview production build locally        |
| `node server.js`| Start the required AI proxy backend      |

## Deploying to GitHub Pages

GitHub Pages only serves static files, so only the frontend can be hosted there — the Express proxy (`server.js`) that holds `ANTHROPIC_API_KEY` needs to run somewhere with a Node runtime (Render, Railway, Fly.io, a VM, etc.).

1. **Deploy the backend** to a Node host of your choice. Set its `ANTHROPIC_API_KEY` there, and set `FRONTEND_URL` to your Pages URL (e.g. `https://<user>.github.io`) — comma-separate multiple values if you also want local dev to keep working (`http://localhost:5173,https://<user>.github.io`).
2. **Point the frontend at that backend** by setting the repository variable `VITE_API_BASE_URL` (Settings → Secrets and variables → Actions → Variables) to the backend's base URL, e.g. `https://your-backend.onrender.com`. Leave it unset for a static-only demo (the AI `query` tab will show a "proxy not reachable" error; everything else still works off the synthetic dataset).
3. **Enable Pages**: repo Settings → Pages → Source: "GitHub Actions".
4. Push to `main` (or run the workflow manually) — `.github/workflows/deploy-pages.yml` builds the Vite app with the correct `/<repo-name>/` base path and `VITE_API_BASE_URL`, then publishes `dist/` to Pages.

### Hosting the AI proxy on Vercel

`api/claude.js` is a serverless-function equivalent of `server.js`, ready to deploy on Vercel with no cold-start sleep (unlike a free Render/Railway web service):

1. Import this repo into Vercel ([vercel.com/new](https://vercel.com/new)) as a new project.
2. In the project's Settings → Environment Variables, add:
   - `ANTHROPIC_API_KEY` — your Anthropic key.
   - `FRONTEND_URL` — your GitHub Pages origin, e.g. `https://<user>.github.io` (comma-separate to also allow `http://localhost:5173` for local dev).
3. Deploy. Vercel will also build and serve the Vite frontend at the same URL (harmless bonus copy) — the endpoint you actually need is `https://<your-project>.vercel.app/api/claude`.
4. Set the GitHub repository variable `VITE_API_BASE_URL` to that Vercel project URL (e.g. `https://your-project.vercel.app`), then re-run the Pages deploy workflow so the GitHub Pages build points at it.

## Notes & Limitations

- **Demo / internal tool** — 100% synthetic data.
- AI answers are non-deterministic and only as good as the injected context.
- No authentication, real database, or production-grade backend.
- Claim and pipeline state live only in your browser’s localStorage (clears on hard reset or different browser).
- `update.cjs` is a historical patch script and is no longer used.

For deeper technical context and future roadmap items (real database, server-side aggregations, CSS modules, etc.), read [ENGINEERING.md](./ENGINEERING.md).

## License

Internal / proprietary project. All rights reserved.

---

Built with React 19 + Vite + Claude.

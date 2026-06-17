# Engineering Knowhow & Features Document

## Project Overview
**CFF Analytics Intelligence** is a React-based analytics and operations management dashboard built for managing logistics, customs filings, duty drawbacks, and quoting workflows. The application provides intelligent, AI-powered query capabilities alongside interactive data exploration.

## Tech Stack
- **Frontend**: React 19, Vite, Recharts (for data visualization).
- **Backend/Proxy**: Node.js, Express 5, `express-rate-limit`, `cors`.
- **AI Integration**: Anthropic Claude API (claude-3-5-sonnet-20241022) proxied through the backend.
- **Styling**: Inline styles and dynamic theme variables.
- **Data**: Mock constants stored locally (no external database for now).

## Architecture
The application runs as a monolithic frontend with a lightweight backend proxy.
1. **Frontend (`src/App.jsx`)**: The main controller, holding state for tabs, queries, claims, and local storage synchronization.
2. **Backend (`server.js`)**: An Express server running on port 3001 (or environment variable). Its primary purpose is to securely proxy requests to the Anthropic API without exposing the `ANTHROPIC_API_KEY` to the client. It includes rate-limiting.

## Application Features

### 1. AI Query Interface (`query` tab)
- **Natural Language to Data**: Users can ask questions about CFF's operations, clients, margins, or compliance.
- **Under the hood**: The frontend injects contextual data (clients, jobs, customs filings, warehouse data) into the prompt and sends it to the backend `/api/claude`. Claude returns a structured JSON response containing:
  - `sql`: The equivalent SQL query.
  - `summary`: A plain English answer.
  - `table`: Tabular data relevant to the query.
  - `insight`: Business insight derived from the query.

### 2. Job Exploration (`explore` tab)
- **Interactive Data Table**: View, filter, and sort jobs by client, mode, trade lane, and status.
- **In-Progress Tracker**: Highlights jobs that are currently active and calculates days elapsed.

### 3. Operations & Duty Drawback (`operations` tab)
- **Recoverable Duty Drawback**: Calculates and displays unclaimed drawbacks.
- **Claim Drafting & Filing**: Users can select unclaimed drawbacks, view a draft claim with calculated CFF fees (18%), and "file" the claim.
- **Persistence**: Filed claims are stored in `localStorage` (`cff_claims` and `cff_filing_register`) to persist across sessions.
- **CSV Export**: The filing register can be exported to a CSV.

### 4. Quote Assist (`quoteassist` tab)
- **Historical Quoting**: Helps generate quotes by comparing against historical data based on transport mode and commodity type.
- **Win/Loss Analysis**: Provides insights into floor, ceiling, and median costs, along with target margins and win rates.
- **Pipeline Management**: Users can save drafted quotes to a pipeline, which can also be exported to CSV.

### 5. Profitability & Analytics (`profitability` & `charts` tabs)
- **Client Scorecards**: Detailed modals to view specific client metrics and risk compliance.
- **Visualizations**: Powered by Recharts to display trends, margins, and operational stats.

## State Management & Local Storage
The application heavily relies on React's `useState` and `useMemo` for client-side state.
To maintain a demo-friendly persistence without a database, it uses browser `localStorage`:
- `cff_claims`: Tracks the status of drawback claims (Unclaimed vs. Filed).
- `cff_filing_register`: Maintains a log of all filed claims with their generated ICEGATE references.

## Running the Application
- **Development**: Run `npm run dev` to start the Vite frontend. The backend server (`node server.js`) needs to run concurrently to proxy AI requests.
- **Environment Variables**: Requires `.env` containing `ANTHROPIC_API_KEY` for the AI features to work.

## Future Considerations
- Migrate mock data to a real database (e.g., PostgreSQL).
- Move complex aggregations from the frontend (`src/utils/computations.js`) to the backend.
- Replace inline styles with a more robust CSS framework or module system.

## Sattva CFS Intelligence Architecture (`src/cfs/`)
The CFS workspace operates as an overlay prototype on top of a Container Freight Station yard and billing system.

### Dynamic Calculations & Terminal Toggling
- **Stateful Switching**: Toggling between **STV** (Sattva Hi-Tech) and **BCT** (Balmer Lawrie) is handled dynamically in [CfsApp.jsx](file:///Users/ashwin/Streak/Shipmate/src/cfs/CfsApp.jsx).
- **Data Partitioning**: The computations engine in [computations.js](file:///Users/ashwin/Streak/Shipmate/src/cfs/computations.js) exports a dynamic `getComputations(terminalAbbr)` function. It partitions the synthetic `CONTAINERS` dataset (even indices for `STV` and odd indices for `BCT`) to filter each terminal's active and history metrics.
- **Dynamic Aggregations**: Dues, aging, leakage reconciliation, and profitability metrics are recalculated on the selected terminal's partition.
- **AI Query Syncing**: The prompt compiler `buildSystem()` inside the component injects the terminal-specific `LEDGER` context dynamically so that the natural language analytics engine analyzes the correct dataset based on the active terminal.


const fs = require("fs");

let app = fs.readFileSync("src/App.jsx", "utf-8");
const charts = fs.readFileSync("charts_components.jsx", "utf-8");

// 1. Add recharts imports
app = app.replace(
  'import { useState, useMemo } from "react";',
  'import { useState, useMemo } from "react";\nimport {\n  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,\n  Tooltip, Legend, ResponsiveContainer\n} from "recharts";'
);

// 2. Insert components before `export default function App() {`
app = app.replace(
  'export default function App() {',
  charts + '\nexport default function App() {'
);

// 3. Add state variables
app = app.replace(
  'const [hsSearch, setHsSearch] = useState("");',
  'const [hsSearch, setHsSearch] = useState("");\n  const [scorecardId, setScorecardId] = useState(null);\n  const openScorecard = id => setScorecardId(id);\n  const ClientLink = ({ id }) => {\n    const name = CLIENTS.find(c => c.client_id === id)?.name ?? "—";\n    return (\n      <span onClick={() => openScorecard(id)} style={{ color: C.accent, cursor: "pointer", textDecoration: "underline dotted", textDecorationColor: C.accentDim }}>\n        {name}\n      </span>\n    );\n  };'
);

// 4. Update TABS
app = app.replace(
  '{["explore", "query", "operations", "schema"].map(t => (',
  '{["explore", "operations", "charts", "query", "schema"].map(t => ('
);

// 5. Add scorecard modal conditionally
app = app.replace(
  '{/* HEADER */}',
  '{scorecardId && <ScorecardModal clientId={scorecardId} onClose={() => setScorecardId(null)} />}\n\n      {/* HEADER */}'
);

// 6. Update operations HS Code Client render
app = app.replace(
  '<td style={{ padding: "9px 14px", color: C.text, fontSize: 12 }}>{clientName(f.job_id)}</td>',
  '<td style={{ padding: "9px 14px" }}><ClientLink id={JOB_CLIENT_MAP[f.job_id]} /></td>'
);

// 7. Insert the Charts Tab logic in the main switch
app = app.replace(
  ') : activeTab === "operations" ? (',
  ') : activeTab === "charts" ? (\n          <ChartsTab onSelectClient={openScorecard} />\n        ) : activeTab === "operations" ? ('
);

fs.writeFileSync("src/App.jsx", app);
console.log("Updated App.jsx successfully");

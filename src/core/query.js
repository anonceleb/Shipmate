import { useState } from "react";

/**
 * Shared Claude query hook used by both CFF and CFS apps.
 *
 * @param {function} buildSystem  - (questionText) => string  — assembles the system prompt
 * @param {number}   [maxTokens]  - default 2000
 */
export function useClaudeQuery(buildSystem, maxTokens = 2000) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleQuery = async (q) => {
    const qText = (q ?? question).trim();
    if (!qText) return;
    setLoading(true);
    setResult(null);
    try {
      const apiBase = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
        ? "http://localhost:3001"
        : (import.meta.env.VITE_API_BASE_URL || "");
      const res = await fetch(`${apiBase}/api/claude`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-5",
          max_tokens: maxTokens,
          system: buildSystem(qText),
          messages: [{ role: "user", content: qText }],
        }),
      });
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("AI proxy not reachable — start it with `node server.js` (port 3001).");
      }
      if (!res.ok) throw new Error(data.error?.message || "Request failed");
      const raw = data.content?.find(b => b.type === "text")?.text || "{}";
      const start = raw.indexOf("{");
      const end = raw.lastIndexOf("}");
      if (start === -1 || end <= start) throw new Error("Model returned no JSON. Try rephrasing.");
      setResult({ question: qText, ...JSON.parse(raw.slice(start, end + 1)) });
    } catch (e) {
      setResult({ question: qText, sql: "", summary: `Error: ${e.message}`, table: [], insight: "" });
    }
    setLoading(false);
  };

  return { question, setQuestion, loading, result, handleQuery };
}

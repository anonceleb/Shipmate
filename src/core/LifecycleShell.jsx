import { C } from "../data/constants.js";

const mono = { fontFamily: "'Space Mono', monospace" };

function GapPlaceholder({ stage }) {
  return (
    <div style={{
      border: `1px dashed ${C.border}`,
      borderRadius: 12,
      padding: "48px 32px",
      textAlign: "center",
      color: C.muted,
    }}>
      <div style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 10, color: C.border }}>
        {stage.label}
      </div>
      <div style={{ fontSize: 14, color: C.muted, marginBottom: 6 }}>{stage.hint}</div>
      <div style={{ fontSize: 12, color: C.border }}>Not yet built — this stage sits in the lifecycle but has no content.</div>
    </div>
  );
}

/**
 * LifecycleShell — shared nav chrome for CFF and CFS.
 *
 * @param {object}   brand         { abbr, name, subtitle, color }
 * @param {object[]} stages        { id, label, hint, gap? }  — the spine left→right
 * @param {object[]} rails         { id, label }              — cross-cutting always-on
 * @param {string}   active        currently active id
 * @param {function} onSelect      (id) => void
 * @param {object[]} stats         { label, value, sub, hot? }
 * @param {ReactNode} headerExtra  slot for domain controls (switch button, terminal picker, etc.)
 * @param {ReactNode} themeToggle  slot for the light/dark toggle — rendered fixed bottom-right
 * @param {ReactNode} children     stage/rail content; null → renders GapPlaceholder
 */
export function LifecycleShell({ brand, stages, rails, active, onSelect, stats, headerExtra, themeToggle, children }) {
  const activeStage = stages.find(s => s.id === active);
  const isGap = activeStage?.gap === true;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'DM Sans', sans-serif" }}>

      {/* ── HEADER ── */}
      <div style={{
        background: C.surface,
        borderBottom: `1px solid ${C.border}`,
        padding: "16px 32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 12,
      }}>
        {/* brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 36, height: 36,
            background: brand.color,
            borderRadius: 8,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ color: "#fff", ...mono, fontWeight: 700, fontSize: 13 }}>{brand.abbr}</span>
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{brand.name}</div>
            <div style={{ fontSize: 11, color: C.muted, ...mono }}>{brand.subtitle}</div>
          </div>
        </div>

        {/* lifecycle spine + rails nav */}
        <div style={{ display: "flex", alignItems: "center", gap: 3, flexWrap: "wrap" }}>
          {stages.map((s, i) => (
            <span key={s.id} style={{ display: "flex", alignItems: "center", gap: 3 }}>
              {i > 0 && (
                <span style={{ color: C.border, fontSize: 10, padding: "0 1px" }}>›</span>
              )}
              <button
                onClick={() => !s.gap && onSelect(s.id)}
                title={s.hint}
                style={{
                  padding: "5px 11px",
                  borderRadius: 6,
                  border: `1px ${s.gap ? "dashed" : "solid"} ${active === s.id ? C.accent : C.border}`,
                  background: active === s.id ? C.accentDim : "transparent",
                  color: active === s.id ? C.accent : s.gap ? C.border : C.muted,
                  fontSize: 11,
                  cursor: s.gap ? "default" : "pointer",
                  fontFamily: "inherit",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  opacity: s.gap ? 0.6 : 1,
                }}
              >
                {s.label}
              </button>
            </span>
          ))}

          {/* divider between stages and rails */}
          <div style={{ width: 1, height: 22, background: C.border, margin: "0 8px" }} />

          {rails.map(r => (
            <button
              key={r.id}
              onClick={() => onSelect(r.id)}
              style={{
                padding: "5px 11px",
                borderRadius: 6,
                border: `1px solid ${active === r.id ? C.accent : C.border}`,
                background: active === r.id ? C.accentDim : "transparent",
                color: active === r.id ? C.accent : C.muted,
                fontSize: 11,
                cursor: "pointer",
                fontFamily: "inherit",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              {r.label}
            </button>
          ))}
        </div>

        {headerExtra && <div style={{ display: "flex", gap: 8, alignItems: "center" }}>{headerExtra}</div>}
      </div>

      {/* ── STAT BAR ── */}
      {stats?.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${stats.length}, 1fr)`, gap: 1, background: C.border }}>
          {stats.map((s, i) => (
            <div key={i} style={{ background: C.card, padding: "16px 24px" }}>
              <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: 21, fontWeight: 600, ...mono, color: s.hot ? C.red : C.accent }}>{s.value}</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{s.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── CONTENT ── */}
      <div style={{ padding: "28px 32px", maxWidth: 1150, margin: "0 auto" }}>
        {isGap ? <GapPlaceholder stage={activeStage} /> : children}
      </div>

      {/* ── THEME TOGGLE — fixed bottom-right ── */}
      {themeToggle && (
        <div style={{ position: "fixed", bottom: 20, right: 20, zIndex: 3000 }}>
          {themeToggle}
        </div>
      )}
    </div>
  );
}

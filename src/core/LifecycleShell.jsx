import { useEffect } from "react";
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
 * @param {object[]} stages        { id, label, hint, gap?, sub?, subColor? } — the journey spine, left→right
 * @param {object[]} rails         { id, label }              — cross-cutting always-on underline tabs
 * @param {string}   active        currently active id
 * @param {function} onSelect      (id) => void
 * @param {function} onGapClick    (stage) => void — called instead of onSelect when a gap stage is clicked
 * @param {object[]} stats         { label, value, sub, hot? } — legacy stat bar, optional
 * @param {ReactNode} headerExtra  slot for domain controls (terminal switcher, session counter, switch-demo, etc.)
 * @param {ReactNode} themeToggle  slot for the light/dark toggle — rendered inline in the header
 * @param {ReactNode} children     stage/rail content; null → renders GapPlaceholder
 */
export function LifecycleShell({ brand, stages, rails, active, onSelect, onGapClick, stats, headerExtra, themeToggle, children }) {
  const activeStage = stages.find(s => s.id === active);
  const isGap = activeStage?.gap === true;

  useEffect(() => {
    const nav = stages.filter(s => !s.gap).map(s => s.id);
    const handler = ev => {
      if (ev.target.tagName === "INPUT" || ev.target.tagName === "TEXTAREA") return;
      const i = nav.indexOf(active);
      if (i === -1) return;
      if (ev.key === "ArrowRight" && i < nav.length - 1) onSelect(nav[i + 1]);
      if (ev.key === "ArrowLeft" && i > 0) onSelect(nav[i - 1]);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [stages, active, onSelect]);

  let n = 0;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'DM Sans', sans-serif" }}>

      {/* ── HEADER (full-bleed) ── */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "18px 32px 0" }}>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            {/* brand */}
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{
                width: 38, height: 38,
                background: brand.color,
                borderRadius: 9,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <span style={{ color: "#fff", ...mono, fontWeight: 700, fontSize: 13 }}>{brand.abbr}</span>
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{brand.name}</div>
                <div style={{ fontSize: 11, color: C.muted, ...mono }}>{brand.subtitle}</div>
              </div>
            </div>

            {(headerExtra || themeToggle) && (
              <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                {headerExtra}
                {themeToggle}
              </div>
            )}
          </div>

          {/* ── journey spine ── */}
          <div style={{ display: "flex", alignItems: "stretch", gap: 0, padding: "16px 0 0", overflowX: "auto" }}>
            {stages.map((s, i) => {
              const isActive = active === s.id;
              const num = s.id === "overview" ? "◆" : String(++n);
              const subColor = s.gap ? C.muted : isActive ? C.accent : (s.subColor || C.muted);
              return (
                <div key={s.id} style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 120 }}>
                  {i > 0 && <div style={{ width: 14, height: 1, background: C.border, flexShrink: 0 }} />}
                  <button
                    onClick={() => s.gap ? onGapClick?.(s) : onSelect(s.id)}
                    title={s.hint}
                    style={{
                      flex: 1,
                      textAlign: "left",
                      padding: "10px 14px 12px",
                      borderRadius: "10px 10px 0 0",
                      border: `1px ${s.gap ? "dashed" : "solid"} ${isActive ? C.accent : C.border}`,
                      borderBottom: isActive ? `2px solid ${C.accent}` : "1px solid transparent",
                      background: isActive ? C.accentDim : s.gap ? "transparent" : C.card,
                      color: isActive ? C.accent : s.gap ? C.muted : C.text,
                      cursor: s.gap && !onGapClick ? "default" : "pointer",
                      opacity: s.gap ? 0.75 : 1,
                      minWidth: 0,
                      width: "100%",
                      fontFamily: "inherit",
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={{
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        width: 18, height: 18, borderRadius: "50%", fontSize: 10, ...mono,
                        background: isActive ? C.accent : C.border, color: isActive ? "#000" : C.muted, flexShrink: 0,
                      }}>{num}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.6px" }}>{s.label}</span>
                    </span>
                    <span style={{ display: "block", fontSize: 11, ...mono, marginTop: 5, color: subColor }}>{s.sub || ""}</span>
                  </button>
                </div>
              );
            })}
          </div>

          {/* ── rails tier ── */}
          <div style={{
            display: "flex", gap: 6, padding: "10px 0 12px", marginTop: 2,
            alignItems: "center", borderTop: `1px solid ${C.border}`,
          }}>
            <span style={{
              fontSize: 9, color: C.muted, textTransform: "uppercase",
              letterSpacing: "1.2px", marginRight: 10, whiteSpace: "nowrap",
              ...mono, paddingTop: 1,
            }}>Analytics</span>
            <div style={{ width: 1, height: 14, background: C.border, marginRight: 6, flexShrink: 0 }} />
            {rails.map(r => {
              const isRailActive = active === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() => onSelect(r.id)}
                  onMouseEnter={e => {
                    if (!isRailActive) {
                      e.currentTarget.style.borderColor = C.accent;
                      e.currentTarget.style.color = C.accent;
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isRailActive) {
                      e.currentTarget.style.borderColor = C.border;
                      e.currentTarget.style.color = C.muted;
                    }
                  }}
                  style={{
                    padding: "5px 14px",
                    borderRadius: 20,
                    border: `1px solid ${isRailActive ? C.accent : C.border}`,
                    background: isRailActive ? C.accentDim : "transparent",
                    color: isRailActive ? C.accent : C.muted,
                    fontSize: 11,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    textTransform: "uppercase",
                    letterSpacing: "0.7px",
                    fontWeight: isRailActive ? 600 : 400,
                    transition: "border-color 0.15s, color 0.15s",
                  }}
                >
                  {r.label}
                </button>
              );
            })}
            <div style={{ marginLeft: "auto", fontSize: 10, color: C.border, ...mono, whiteSpace: "nowrap" }}>← → keys</div>
          </div>
        </div>
      </div>

      {/* ── STAT BAR — legacy, only rendered when a caller still passes stats ── */}
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
      <div style={{ padding: "28px 32px", maxWidth: 1280, margin: "0 auto" }}>
        {isGap ? <GapPlaceholder stage={activeStage} /> : children}
      </div>
    </div>
  );
}

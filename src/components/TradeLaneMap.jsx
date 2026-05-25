import React, { useMemo } from "react";
import { JOBS, C, CITY_COORDS } from "../data/constants.js";
import { project, arcPath, fmt } from "../utils/computations.js";

// ── TRADE LANE MAP ─────────────────────────────────────────────────────────────
export default function TradeLaneMap({ onSelectClient }) {
  const W = 800, H = 400;
  const lanes = useMemo(() => {
    const map = {};
    JOBS.forEach(j => {
      const key = `${j.origin}||${j.destination}`;
      if (!map[key]) map[key] = { origin: j.origin, destination: j.destination, count: 0, revenue: 0 };
      map[key].count++;
      map[key].revenue += j.revenue;
    });
    return Object.values(map).filter(l => CITY_COORDS[l.origin] && CITY_COORDS[l.destination]);
  }, []);

  const maxRev = Math.max(...lanes.map(l => l.revenue));

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.8px" }}>Trade Lane Flow Map</span>
        <span style={{ fontSize: 11, color: C.muted }}>Arc thickness = shipment volume · hover for details</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", display: "block", background: "#0B0F1A" }}>
        {/* Simplified world outline using a rough SVG path */}
        <rect width={W} height={H} fill="#0B0F1A" />
        {/* Grid lines */}
        {[0,30,60,90,120,150,180,210,240,270,300,330,360].map(lng => {
          const x = (lng / 360) * W;
          return <line key={lng} x1={x} y1={0} x2={x} y2={H} stroke={C.border} strokeWidth="0.3" />;
        })}
        {[0,30,60,90,120,150,180].map(lat => {
          const y = (lat / 180) * H;
          return <line key={lat} x1={0} y1={y} x2={W} y2={y} stroke={C.border} strokeWidth="0.3" />;
        })}
        {/* Arcs */}
        {lanes.map((lane, i) => {
          const p1 = project(CITY_COORDS[lane.origin], W, H);
          const p2 = project(CITY_COORDS[lane.destination], W, H);
          const intensity = lane.revenue / maxRev;
          const opacity = 0.3 + intensity * 0.7;
          const strokeW = 0.5 + intensity * 3;
          return (
            <path key={i} d={arcPath(p1, p2)}
              fill="none" stroke={C.accent} strokeWidth={strokeW} strokeOpacity={opacity}
              strokeLinecap="round">
              <title>{lane.origin} → {lane.destination} · {lane.count} shipment{lane.count > 1 ? "s" : ""} · ₹{fmt(lane.revenue)}</title>
            </path>
          );
        })}
        {/* City dots */}
        {Object.entries(CITY_COORDS).map(([city, coords]) => {
          const [x, y] = project(coords, W, H);
          const isHub = city === "Chennai" || city === "Mumbai";
          return (
            <g key={city}>
              {isHub && <circle cx={x} cy={y} r={8} fill={C.accent} fillOpacity={0.15} />}
              <circle cx={x} cy={y} r={isHub ? 3 : 2} fill={isHub ? C.accent : "#7A8BAA"} />
              <text x={x + 5} y={y - 3} fontSize={isHub ? 8 : 7} fill={isHub ? C.accent : C.muted} fontFamily="DM Sans, sans-serif">
                {city}
              </text>
            </g>
          );
        })}
      </svg>
      {/* Legend */}
      <div style={{ padding: "10px 20px", borderTop: `1px solid ${C.border}`, display: "flex", gap: 24, fontSize: 11, color: C.muted }}>
        {[["Thin arc","Low volume"], ["Thick arc","High volume"], ["● Amber","CFF hub port"]].map(([sym, lab]) => (
          <span key={sym}><span style={{ color: C.accent }}>{sym}</span> = {lab}</span>
        ))}
      </div>
    </div>
  );
}


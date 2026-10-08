import React from "react";

export function MetricCard({ title, value, subtitle, icon: Icon, trend }) {
  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.5rem", position: "relative" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {title}
        </span>
        {Icon && <Icon size={18} style={{ color: "var(--accent-blue)" }} />}
      </div>
      <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
        {value}
      </div>
      {subtitle && (
        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}

import React from "react";

export function MetricCard({ title, value, subtitle, icon: Icon, trend }) {
  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.5rem", position: "relative", overflow: "hidden" }}>
      {/* Background glow effect */}
      <div style={{ position: "absolute", top: "-50%", right: "-50%", width: "100%", height: "100%", background: "radial-gradient(circle, rgba(160, 210, 235, 0.1) 0%, transparent 70%)", zIndex: 0 }}></div>
      
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative", zIndex: 1 }}>
        <span style={{ fontSize: "0.8rem", color: "var(--color-text-secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {title}
        </span>
        {Icon && (
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(160, 210, 235, 0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon size={16} style={{ color: "var(--color-primary)" }} />
          </div>
        )}
      </div>
      <div style={{ fontSize: "2rem", fontWeight: 700, color: "var(--color-text-primary)", letterSpacing: "-0.03em", marginTop: "0.5rem", position: "relative", zIndex: 1 }}>
        {value}
      </div>
      {subtitle && (
        <div style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", position: "relative", zIndex: 1, marginTop: "0.25rem" }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}

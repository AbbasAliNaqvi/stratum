import React from "react";
import { Activity, AlertCircle } from "lucide-react";

export function HealthBadge({ isHealthy = true, text = "Healthy" }) {
  if (isHealthy) {
    return (
      <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.35rem 0.85rem", borderRadius: "20px", background: "rgba(46, 204, 113, 0.15)", border: "1px solid rgba(46, 204, 113, 0.3)", color: "var(--color-success)", fontWeight: 600, fontSize: "0.85rem", letterSpacing: "0.02em" }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--color-success)" }} className="animate-pulse-slow" />
        {text}
      </div>
    );
  }

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.35rem 0.85rem", borderRadius: "20px", background: "rgba(248, 113, 113, 0.15)", border: "1px solid rgba(248, 113, 113, 0.3)", color: "var(--color-error)", fontWeight: 600, fontSize: "0.85rem", letterSpacing: "0.02em" }}>
      <AlertCircle size={14} />
      Degraded
    </div>
  );
}

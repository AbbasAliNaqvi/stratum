import React from "react";
import { Activity, AlertCircle } from "lucide-react";

export function HealthBadge({ isHealthy = true, text = "Healthy" }) {
  if (isHealthy) {
    return (
      <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.35rem 0.75rem", borderRadius: "9999px", background: "rgba(16, 185, 129, 0.12)", border: "1px solid rgba(16, 185, 129, 0.3)", color: "#10b981", fontWeight: 600, fontSize: "0.85rem" }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981" }} className="animate-pulse-slow" />
        {text}
      </div>
    );
  }

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.35rem 0.75rem", borderRadius: "9999px", background: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#f87171", fontWeight: 600, fontSize: "0.85rem" }}>
      <AlertCircle size={14} />
      Degraded
    </div>
  );
}

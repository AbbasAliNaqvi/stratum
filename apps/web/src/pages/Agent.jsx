import React from "react";
import { Bot, Shield, CheckCircle2, Cpu } from "lucide-react";

export function Agent() {
  return (
    <div style={{ maxWidth: 800, margin: "0 auto", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Status Banner */}
      <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(139, 92, 246, 0.08)", border: "1px solid rgba(139, 92, 246, 0.3)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: "rgba(139, 92, 246, 0.2)", display: "flex", alignItems: "center", justifyContent: "center", color: "#a78bfa" }}>
            <Bot size={24} />
          </div>
          <div>
            <h2 style={{ fontSize: "1.2rem", fontWeight: 800, color: "#ffffff" }}>
              STRATUM Agent
            </h2>
            <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
              Autonomous AI operations & diagnostics runtime layer
            </div>
          </div>
        </div>

        <span className="badge badge-secondary" style={{ padding: "0.4rem 0.8rem", fontSize: "0.75rem" }}>
          Status: Not Configured
        </span>
      </div>

      {/* Overview */}
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <h3 style={{ fontSize: "1rem", fontWeight: 700 }}>AI Operational Capabilities (V6 Protocol)</h3>
        <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
          The STRATUM Web Console control plane exposed here is built AI-ready. The upcoming Agent layer will consume the exact same application APIs, tool contracts, and telemetry endpoints.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "0.5rem" }}>
          {[
            "Understand automation goals & requirements",
            "Inspect active runs and system telemetry",
            "Generate verified DAG automation plans",
            "Diagnose execution failures & worker deaths",
            "Recommend self-healing recovery actions",
            "Execute policy-approved operations",
          ].map((cap, idx) => (
            <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", fontSize: "0.85rem", color: "var(--text-primary)" }}>
              <CheckCircle2 size={16} style={{ color: "var(--accent-purple)", flexShrink: 0, marginTop: 2 }} />
              <span>{cap}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

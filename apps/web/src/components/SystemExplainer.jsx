import React from "react";
import { Layers, GitBranch, Play, Cpu, CheckCircle2, ArrowRight } from "lucide-react";

export function SystemExplainer() {
  const steps = [
    { title: "AUTOMATION", desc: "Declared task & schedule spec", icon: Layers, color: "#3b82f6" },
    { title: "WORKFLOW", desc: "DAG step dependencies", icon: GitBranch, color: "#8b5cf6" },
    { title: "RUN", desc: "Durable state instance", icon: Play, color: "#06b6d4" },
    { title: "DISTRIBUTED EXECUTION", desc: "Jobs claimed by Workers", icon: Cpu, color: "#f59e0b" },
    { title: "RESULT", desc: "Verified state completion", icon: CheckCircle2, color: "#10b981" },
  ];

  return (
    <div className="card" style={{ padding: "1.5rem", background: "rgba(17, 24, 39, 0.6)", border: "1px solid var(--border-color)" }}>
      <div style={{ marginBottom: "1rem" }}>
        <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "0.02em" }}>
          HOW STRATUM WORKS
        </h3>
        <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
          AI-Native Orchestration Engine & Distributed Job Protocol
        </p>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
        {steps.map((step, idx) => {
          const Icon = step.icon;
          return (
            <React.Fragment key={step.title}>
              <div style={{ flex: "1 1 140px", minWidth: 130, padding: "0.85rem", borderRadius: 8, background: "var(--bg-elevated)", border: `1px solid var(--border-color)`, display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <Icon size={16} style={{ color: step.color }} />
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-primary)" }}>
                    {step.title}
                  </span>
                </div>
                <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                  {step.desc}
                </span>
              </div>

              {idx < steps.length - 1 && (
                <ArrowRight size={14} style={{ color: "var(--text-muted)", opacity: 0.6, display: "block" }} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

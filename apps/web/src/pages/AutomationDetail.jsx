import React, { useState } from "react";
import { ArrowLeft, Play, Calendar, Trash2, Power, Code, Edit3 } from "lucide-react";
import { DagViewer } from "../components/DagViewer.jsx";
import { StatusBadge } from "../components/StatusBadge.jsx";

export function AutomationDetail({
  automation,
  onNavigate,
  onRun,
  onToggleEnable,
  onDelete,
  onCreateSchedule,
}) {
  const [showJson, setShowJson] = useState(false);

  if (!automation) {
    return (
      <div className="card animate-in" style={{ padding: "4rem", textAlign: "center", maxWidth: 600, margin: "2rem auto" }}>
        <h3 style={{ fontSize: "1.25rem", color: "var(--color-text-primary)", marginBottom: "0.5rem" }}>Automation not found</h3>
        <p style={{ color: "var(--color-text-secondary)", marginBottom: "2rem" }}>The requested automation could not be loaded.</p>
        <button onClick={() => onNavigate("automations")} className="btn btn-secondary">
          <ArrowLeft size={16} /> Back to Automations
        </button>
      </div>
    );
  }

  const steps = automation.definition?.steps || [];

  return (
    <div className="animate-in" style={{ display: "flex", flexDirection: "column", gap: "1.5rem", maxWidth: 1200, margin: "0 auto" }}>
      {/* Back Button & Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
        <button onClick={() => onNavigate("automations")} className="btn btn-secondary btn-sm" style={{ paddingLeft: "0.5rem" }}>
          <ArrowLeft size={16} /> Back to Automations
        </button>

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button onClick={() => setShowJson(!showJson)} className="btn btn-secondary btn-sm">
            <Code size={14} /> {showJson ? "Hide Code" : "View Code"}
          </button>
          <button onClick={() => onCreateSchedule(automation.id)} className="btn btn-secondary btn-sm">
            <Calendar size={14} /> Schedule
          </button>
          <button onClick={() => onToggleEnable(automation.id, !automation.enabled)} className="btn btn-secondary btn-sm">
            <Power size={14} style={{ color: automation.enabled ? "var(--color-warning)" : "var(--color-success)" }} /> {automation.enabled ? "Disable" : "Enable"}
          </button>
          <button onClick={() => onRun(automation.id)} className="btn btn-primary btn-sm" style={{ gap: "0.4rem" }}>
            <Play size={14} /> Run Now
          </button>
        </div>
      </div>

      {/* Metadata Card */}
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h2 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--color-text-primary)", letterSpacing: "-0.02em" }}>
              {automation.name}
            </h2>
            <div style={{ fontFamily: "JetBrains Mono", fontSize: "0.8rem", color: "var(--color-text-muted)", marginTop: "0.35rem" }}>
              ID: {automation.id}
            </div>
          </div>
          <StatusBadge status={automation.enabled ? "enabled" : "disabled"} />
        </div>

        <div style={{ padding: "1.25rem", background: "var(--color-surface-elevated)", borderRadius: 8, border: "1px solid var(--color-border-glass)" }}>
          <p style={{ fontSize: "0.95rem", color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
            {automation.description || "No description provided for this automation workflow."}
          </p>
        </div>
      </div>

      {/* JSON Definition Drawer */}
      {showJson && (
        <div className="card animate-in" style={{ padding: "0" }}>
          <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid var(--color-border-glass)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--color-text-primary)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Code size={16} style={{ color: "var(--color-tertiary)" }} /> Definition JSON
            </h3>
          </div>
          <pre className="font-mono" style={{ background: "rgba(11, 15, 25, 0.5)", fontSize: "0.85rem", overflowX: "auto", padding: "1.5rem", color: "var(--color-text-secondary)", margin: 0, borderBottomLeftRadius: 16, borderBottomRightRadius: 16 }}>
            {JSON.stringify(automation.definition, null, 2)}
          </pre>
        </div>
      )}

      {/* DAG Visualizer Card */}
      <div className="card">
        <h3 style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--color-text-primary)", marginBottom: "1.25rem" }}>
          Workflow DAG Graph
        </h3>

        <div style={{ background: "var(--color-surface-glass)", borderRadius: 8, border: "1px solid var(--color-border-glass)", padding: "1rem" }}>
          <DagViewer steps={steps} />
        </div>
      </div>
    </div>
  );
}

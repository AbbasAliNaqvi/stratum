import React, { useState } from "react";
import { ArrowLeft, Play, Calendar, Trash2, Power, Code } from "lucide-react";
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
      <div className="card" style={{ padding: "3rem", textAlign: "center" }}>
        <h3>Automation not found</h3>
        <button onClick={() => onNavigate("automations")} className="btn btn-secondary" style={{ marginTop: "1rem" }}>
          <ArrowLeft size={16} /> Back to Automations
        </button>
      </div>
    );
  }

  const steps = automation.definition?.steps || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Back Button & Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
        <button onClick={() => onNavigate("automations")} className="btn btn-secondary btn-sm">
          <ArrowLeft size={14} /> Back to Automations
        </button>

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button onClick={() => setShowJson(!showJson)} className="btn btn-secondary btn-sm">
            <Code size={14} /> {showJson ? "Hide Definition" : "View Definition JSON"}
          </button>
          <button onClick={() => onCreateSchedule(automation.id)} className="btn btn-secondary btn-sm">
            <Calendar size={14} /> Schedule
          </button>
          <button onClick={() => onToggleEnable(automation.id, !automation.enabled)} className="btn btn-secondary btn-sm">
            <Power size={14} /> {automation.enabled ? "Disable" : "Enable"}
          </button>
          <button onClick={() => onRun(automation.id)} className="btn btn-primary btn-sm">
            <Play size={14} /> Run Automation
          </button>
        </div>
      </div>

      {/* Metadata Card */}
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h2 style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--text-primary)" }}>
              {automation.name}
            </h2>
            <div style={{ fontFamily: "JetBrains Mono", fontSize: "0.75rem", color: "var(--text-muted)" }}>
              ID: {automation.id}
            </div>
          </div>
          <StatusBadge status={automation.enabled ? "enabled" : "disabled"} />
        </div>

        <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>
          {automation.description || "No description provided for this automation workflow."}
        </p>
      </div>

      {/* JSON Definition Drawer */}
      {showJson && (
        <div className="card font-mono" style={{ background: "var(--bg-primary)", fontSize: "0.8rem", overflowX: "auto" }}>
          <pre>{JSON.stringify(automation.definition, null, 2)}</pre>
        </div>
      )}

      {/* DAG Visualizer Card */}
      <div className="card">
        <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "1rem" }}>
          Workflow DAG Graph
        </h3>

        <DagViewer steps={steps} />
      </div>
    </div>
  );
}

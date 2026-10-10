import React, { useState } from "react";
import { Play, Filter, RefreshCw, Eye, ArrowUpRight, Clock, Activity, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { StatusBadge } from "../components/StatusBadge.jsx";

export function Runs({ runs = [], automations = [], viewMode, onSelectRun, onRefresh }) {
  const [filterStatus, setFilterStatus] = useState("all");
  const isSimple = viewMode === "simple";

  const filteredRuns = runs.filter((r) => {
    if (filterStatus === "all") return true;
    return r.status === filterStatus;
  });

  const getDuration = (run) => {
    if (!run.startedAt) return "—";
    const start = new Date(run.startedAt);
    const end = run.completedAt ? new Date(run.completedAt) : new Date();
    const diff = Math.max(0, end - start);
    
    if (diff < 1000) return `${diff}ms`;
    if (diff < 60000) return `${(diff / 1000).toFixed(1)}s`;
    return `${Math.floor(diff / 60000)}m ${Math.floor((diff % 60000) / 1000)}s`;
  };

  const getSimpleStatus = (status) => {
    switch (status) {
      case "queued": return <span style={{color: "var(--color-text-secondary)"}}>Waiting to start</span>;
      case "running": return <span style={{color: "var(--color-primary)", display: "flex", alignItems: "center", gap: "0.25rem"}}><Activity size={14} /> In progress</span>;
      case "succeeded": return <span style={{color: "var(--color-success)", display: "flex", alignItems: "center", gap: "0.25rem"}}><CheckCircle2 size={14} /> Completed successfully</span>;
      case "failed": return <span style={{color: "var(--color-error)", display: "flex", alignItems: "center", gap: "0.25rem"}}><XCircle size={14} /> Did not complete successfully</span>;
      case "cancelled": return <span style={{color: "var(--color-text-muted)"}}>Stopped by a cancellation request</span>;
      default: return status;
    }
  };

  return (
    <div className="animate-in" style={{ display: "flex", flexDirection: "column", gap: "1.5rem", maxWidth: 1200, margin: "0 auto" }}>
      {/* Header & Filter Controls */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
          <Filter size={16} style={{ color: "var(--color-text-muted)" }} />
          <span style={{ fontSize: "0.85rem", color: "var(--color-text-secondary)", fontWeight: 500, marginRight: "0.5rem" }}>Status:</span>
          {["all", "queued", "running", "succeeded", "failed", "cancelled"].map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className="btn btn-sm"
              style={{
                textTransform: "capitalize",
                background: filterStatus === st ? "var(--color-surface-selected)" : "transparent",
                borderColor: filterStatus === st ? "var(--color-primary)" : "transparent",
                color: filterStatus === st ? "var(--color-primary)" : "var(--color-text-secondary)",
                borderRadius: "20px",
              }}
            >
              {st}
            </button>
          ))}
        </div>

        <button onClick={onRefresh} className="btn btn-secondary btn-sm" style={{ gap: "0.4rem" }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Runs Table */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {filteredRuns.length === 0 ? (
          <div className="empty-state">
            <Play size={48} className="empty-state-icon" style={{ opacity: 0.6 }} />
            <h3>No runs found</h3>
            <p>
              {filterStatus !== "all" 
                ? `There are no executions currently in the '${filterStatus}' state.` 
                : "Your execution history will appear here."}
            </p>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead>
              <tr>
                {isSimple ? (
                  <>
                    <th style={{ background: "transparent", borderBottom: "1px solid var(--color-border)", padding: "0.75rem 0", color: "var(--color-text-muted)", fontWeight: 500 }}>Automation Name</th>
                    <th style={{ background: "transparent", borderBottom: "1px solid var(--color-border)", padding: "0.75rem 0", color: "var(--color-text-muted)", fontWeight: 500 }}>Status</th>
                    <th style={{ background: "transparent", borderBottom: "1px solid var(--color-border)", padding: "0.75rem 0", color: "var(--color-text-muted)", fontWeight: 500 }}>Started</th>
                    <th style={{ background: "transparent", borderBottom: "1px solid var(--color-border)", padding: "0.75rem 0", color: "var(--color-text-muted)", fontWeight: 500 }}>Duration</th>
                    <th style={{ background: "transparent", borderBottom: "1px solid var(--color-border)", padding: "0.75rem 0", color: "var(--color-text-muted)", fontWeight: 500, textAlign: "right" }}>Action</th>
                  </>
                ) : (
                  <>
                    <th style={{ background: "transparent", borderBottom: "1px solid var(--color-border)", padding: "0.75rem 0", color: "var(--color-text-muted)", fontWeight: 500 }}>Run ID</th>
                    <th style={{ background: "transparent", borderBottom: "1px solid var(--color-border)", padding: "0.75rem 0", color: "var(--color-text-muted)", fontWeight: 500 }}>Automation ID</th>
                    <th style={{ background: "transparent", borderBottom: "1px solid var(--color-border)", padding: "0.75rem 0", color: "var(--color-text-muted)", fontWeight: 500 }}>Status</th>
                    <th style={{ background: "transparent", borderBottom: "1px solid var(--color-border)", padding: "0.75rem 0", color: "var(--color-text-muted)", fontWeight: 500 }}>Started</th>
                    <th style={{ background: "transparent", borderBottom: "1px solid var(--color-border)", padding: "0.75rem 0", color: "var(--color-text-muted)", fontWeight: 500 }}>Completed</th>
                    <th style={{ background: "transparent", borderBottom: "1px solid var(--color-border)", padding: "0.75rem 0", color: "var(--color-text-muted)", fontWeight: 500, textAlign: "right" }}></th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {filteredRuns.map((run) => {
                const auto = automations.find(a => a.id === run.automationId);
                
                if (isSimple) {
                  return (
                    <tr key={run.id} onClick={() => onSelectRun(run.id)} style={{ cursor: "pointer", borderBottom: "1px solid var(--color-border)" }}>
                      <td style={{ padding: "1rem 0", fontWeight: 500, color: "var(--color-text-primary)" }}>
                        {auto?.name || "Unknown Automation"}
                      </td>
                      <td style={{ padding: "1rem 0" }}>{getSimpleStatus(run.status)}</td>
                      <td style={{ padding: "1rem 0", color: "var(--color-text-secondary)" }}>
                        {run.startedAt ? new Date(run.startedAt).toLocaleString() : "—"}
                      </td>
                      <td style={{ padding: "1rem 0", color: "var(--color-text-secondary)" }}>
                        {getDuration(run)}
                      </td>
                      <td style={{ padding: "1rem 0", textAlign: "right" }}>
                        <span style={{ fontSize: "0.8rem", color: "var(--color-primary)", fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "0.25rem" }}>
                          View details <ArrowUpRight size={14} />
                        </span>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={run.id} onClick={() => onSelectRun(run.id)} style={{ cursor: "pointer", borderBottom: "1px solid var(--color-border)" }}>
                    <td className="font-mono" style={{ padding: "1rem 0", fontWeight: 600, color: "var(--color-primary)", fontSize: "0.8rem" }}>
                      {run.id}
                    </td>
                    <td className="font-mono" style={{ padding: "1rem 0", fontSize: "0.8rem", color: "var(--color-text-secondary)" }}>
                      {run.automationId}
                    </td>
                    <td style={{ padding: "1rem 0" }}>
                      <StatusBadge status={run.status} />
                    </td>
                    <td style={{ padding: "1rem 0", color: "var(--color-text-secondary)", fontSize: "0.85rem" }}>
                      {run.startedAt ? new Date(run.startedAt).toLocaleString() : "—"}
                    </td>
                    <td style={{ padding: "1rem 0", color: "var(--color-text-secondary)", fontSize: "0.85rem" }}>
                      {run.completedAt ? new Date(run.completedAt).toLocaleString() : "—"}
                    </td>
                    <td style={{ padding: "1rem 0", textAlign: "right" }}>
                      <ArrowUpRight size={16} color="var(--color-text-muted)" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

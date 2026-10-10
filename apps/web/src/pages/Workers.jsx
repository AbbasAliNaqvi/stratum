import React from "react";
import { Cpu, Server, Activity, RefreshCw, HardDrive } from "lucide-react";
import { StatusBadge } from "../components/StatusBadge.jsx";

function formatRelativeTime(isoString) {
  if (!isoString) return "Never";
  const diffSec = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diffSec < 5) return "Just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  return `${Math.floor(diffMin / 60)}h ago`;
}

export function Workers({ workers = [], jobs = [], onRefresh }) {
  return (
    <div className="animate-in" style={{ display: "flex", flexDirection: "column", gap: "1.5rem", maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--color-text-primary)", letterSpacing: "-0.02em" }}>Registered Execution Workers</h2>
        </div>

        <button onClick={onRefresh} className="btn btn-secondary btn-sm" style={{ gap: "0.4rem" }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Grid of Workers */}
      {workers.length === 0 ? (
        <div className="empty-state">
          <Cpu size={48} className="empty-state-icon" style={{ opacity: 0.6 }} />
          <h3>No workers available</h3>
          <p>
            There is currently no execution capacity. Please check the STRATUM runtime logs and start a worker node.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "1.25rem" }}>
          {workers.map((worker) => {
            const activeJobs = jobs.filter(
              (j) => j.lockedBy === worker.nodeId && j.status === "running"
            ).length;

            const heartbeatDiffSec = Math.floor(
              (Date.now() - new Date(worker.lastHeartbeatAt).getTime()) / 1000
            );

            const isUnreachable = heartbeatDiffSec > 30;
            const displayStatus = isUnreachable ? "unreachable" : worker.status;

            return (
              <div
                key={worker.id || worker.nodeId}
                className="card"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "1.25rem",
                  borderColor: isUnreachable ? "rgba(248, 113, 113, 0.4)" : undefined,
                  boxShadow: isUnreachable ? "0 0 12px rgba(248, 113, 113, 0.15)" : undefined,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <h3 className="font-mono" style={{ fontSize: "1rem", fontWeight: 700, color: "var(--color-primary)" }}>
                      {worker.nodeId}
                    </h3>
                    <div style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)", display: "flex", alignItems: "center", gap: "0.4rem", marginTop: "0.35rem" }}>
                      <Server size={14} style={{ color: "var(--color-tertiary)" }} /> {worker.hostname}
                    </div>
                  </div>
                  <StatusBadge status={displayStatus} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", padding: "1rem", borderRadius: 8, background: "var(--color-surface-elevated)", border: "1px solid var(--color-border-glass)", fontSize: "0.85rem" }}>
                  <div>
                    <div style={{ color: "var(--color-text-muted)", fontSize: "0.7rem", marginBottom: "0.25rem" }}>Heartbeat</div>
                    <div style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>{formatRelativeTime(worker.lastHeartbeatAt)}</div>
                  </div>

                  <div>
                    <div style={{ color: "var(--color-text-muted)", fontSize: "0.7rem", marginBottom: "0.25rem" }}>Current Workload</div>
                    <div style={{ fontWeight: 700, color: activeJobs > 0 ? "var(--color-success)" : "var(--color-text-primary)" }}>
                      {activeJobs} running jobs
                    </div>
                  </div>

                  <div>
                    <div style={{ color: "var(--color-text-muted)", fontSize: "0.7rem", marginBottom: "0.25rem" }}>CPU Cores</div>
                    <div style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>{worker.cpuCores} cores</div>
                  </div>

                  <div>
                    <div style={{ color: "var(--color-text-muted)", fontSize: "0.7rem", marginBottom: "0.25rem" }}>Memory</div>
                    <div style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>{worker.memoryMb} MB</div>
                  </div>
                </div>

                <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", display: "flex", justifyContent: "space-between", paddingTop: "0.5rem", borderTop: "1px dashed var(--color-border-glass)" }}>
                  <span>Platform: {worker.platform || "darwin/linux"}</span>
                  <span>Registered: {new Date(worker.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

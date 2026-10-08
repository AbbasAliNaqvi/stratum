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
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 800 }}>Registered Execution Workers</h2>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
            Distributed worker nodes heartbeat and execution workload
          </p>
        </div>

        <button onClick={onRefresh} className="btn btn-secondary btn-sm">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Grid of Workers */}
      {workers.length === 0 ? (
        <div className="card" style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)" }}>
          No worker nodes currently registered with the control plane.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1.25rem" }}>
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
                  gap: "1rem",
                  borderColor: isUnreachable ? "rgba(239, 68, 68, 0.4)" : undefined,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <h3 className="font-mono" style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)" }}>
                      {worker.nodeId}
                    </h3>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.35rem", marginTop: "0.2rem" }}>
                      <Server size={12} /> {worker.hostname}
                    </div>
                  </div>
                  <StatusBadge status={displayStatus} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", padding: "0.75rem", borderRadius: 6, background: "var(--bg-elevated)", fontSize: "0.8rem" }}>
                  <div>
                    <div style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>Heartbeat</div>
                    <div style={{ fontWeight: 600 }}>{formatRelativeTime(worker.lastHeartbeatAt)}</div>
                  </div>

                  <div>
                    <div style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>Current Workload</div>
                    <div style={{ fontWeight: 700, color: activeJobs > 0 ? "var(--accent-blue)" : "var(--text-primary)" }}>
                      {activeJobs} running jobs
                    </div>
                  </div>

                  <div>
                    <div style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>CPU Cores</div>
                    <div style={{ fontWeight: 600 }}>{worker.cpuCores} cores</div>
                  </div>

                  <div>
                    <div style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>Memory</div>
                    <div style={{ fontWeight: 600 }}>{worker.memoryMb} MB</div>
                  </div>
                </div>

                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "flex", justifyContent: "space-between" }}>
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

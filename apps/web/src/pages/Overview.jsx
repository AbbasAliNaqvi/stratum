import React from "react";
import { Cpu, Layers, Play, Clock, CheckCircle2, ArrowRight } from "lucide-react";
import { MetricCard } from "../components/MetricCard.jsx";
import { StatusBadge } from "../components/StatusBadge.jsx";
import { SystemExplainer } from "../components/SystemExplainer.jsx";

export function Overview({
  workers = [],
  automations = [],
  runs = [],
  jobs = [],
  onNavigate,
  onRunAutomation,
}) {
  const activeRuns = runs.filter((r) => r.status === "running" || r.status === "queued");
  const completedRuns = runs.filter((r) => r.status === "succeeded" || r.status === "failed");
  const succeededRuns = runs.filter((r) => r.status === "succeeded");
  const queuedJobs = jobs.filter((j) => j.status === "queued");
  const registeredWorkers = workers.filter((w) => w.status === "registered");

  const successRate =
    completedRuns.length > 0
      ? ((succeededRuns.length / completedRuns.length) * 100).toFixed(1) + "%"
      : "100%";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      {/* Top Metrics Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem" }}>
        <MetricCard title="Workers" value={registeredWorkers.length} subtitle={`${workers.length} registered nodes`} icon={Cpu} />
        <MetricCard title="Automations" value={automations.length} subtitle={`${automations.filter(a => a.enabled).length} active`} icon={Layers} />
        <MetricCard title="Active Runs" value={activeRuns.length} subtitle={`${runs.length} total runs`} icon={Play} />
        <MetricCard title="Queued Tasks" value={queuedJobs.length} subtitle="Pending worker claim" icon={Clock} />
        <MetricCard title="Success Rate" value={successRate} subtitle={`${succeededRuns.length} / ${completedRuns.length} runs`} icon={CheckCircle2} />
      </div>

      {/* System Architecture Explainer */}
      <SystemExplainer />

      {/* Active & Recent Executions */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "1.5rem" }}>
        {/* Active Executions */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 700 }}>Active Executions</h3>
            <button onClick={() => onNavigate("runs")} className="btn btn-secondary btn-sm">
              View All <ArrowRight size={12} />
            </button>
          </div>

          {activeRuns.length === 0 ? (
            <div style={{ padding: "1.5rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>
              No currently active automation runs.
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Run ID</th>
                    <th>Automation</th>
                    <th>Status</th>
                    <th>Started</th>
                  </tr>
                </thead>
                <tbody>
                  {activeRuns.slice(0, 5).map((run) => (
                    <tr
                      key={run.id}
                      onClick={() => onNavigate("run_detail", run.id)}
                      style={{ cursor: "pointer" }}
                    >
                      <td className="font-mono">{run.id}</td>
                      <td>{run.automationId}</td>
                      <td><StatusBadge status={run.status} /></td>
                      <td>{run.startedAt ? new Date(run.startedAt).toLocaleTimeString() : "Pending"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Worker Activity */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 700 }}>Worker Activity</h3>
            <button onClick={() => onNavigate("workers")} className="btn btn-secondary btn-sm">
              View Workers <ArrowRight size={12} />
            </button>
          </div>

          {workers.length === 0 ? (
            <div style={{ padding: "1.5rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>
              No workers registered with Control Plane.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {workers.slice(0, 4).map((worker) => {
                const activeWorkerJobs = jobs.filter((j) => j.lockedBy === worker.nodeId && j.status === "running").length;
                return (
                  <div
                    key={worker.id || worker.nodeId}
                    style={{
                      padding: "0.75rem 1rem",
                      borderRadius: 6,
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--border-color)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-primary)" }}>
                        {worker.nodeId}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        {worker.hostname} ({worker.cpuCores} CPU / {worker.memoryMb} MB)
                      </div>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <StatusBadge status={worker.status} />
                      <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                        {activeWorkerJobs} active jobs
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent Automations Grid */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <div>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 700 }}>Registered Automations</h3>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Workflow DAG specifications ready for trigger</p>
          </div>
          <button onClick={() => onNavigate("create_automation")} className="btn btn-primary btn-sm">
            + New Automation
          </button>
        </div>

        {automations.length === 0 ? (
          <div style={{ padding: "1.5rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>
            No automations configured. Create one to get started.
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Steps</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {automations.slice(0, 6).map((auto) => (
                  <tr key={auto.id}>
                    <td className="font-mono">{auto.id}</td>
                    <td style={{ fontWeight: 600 }}>{auto.name}</td>
                    <td style={{ color: "var(--text-secondary)" }}>{auto.description || "—"}</td>
                    <td>{auto.definition?.steps?.length || 0} tasks</td>
                    <td><StatusBadge status={auto.enabled ? "enabled" : "disabled"} /></td>
                    <td>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button
                          onClick={() => onNavigate("automation_detail", auto.id)}
                          className="btn btn-secondary btn-sm"
                        >
                          View DAG
                        </button>
                        <button
                          onClick={() => onRunAutomation(auto.id)}
                          className="btn btn-primary btn-sm"
                        >
                          Run
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

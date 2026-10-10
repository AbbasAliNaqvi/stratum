import React from "react";
import { Cpu, Layers, Play, Clock, CheckCircle2, ArrowRight, Bot, Plus, ArrowUpRight, Zap, Activity } from "lucide-react";
import { MetricCard } from "../components/MetricCard.jsx";
import { StatusBadge } from "../components/StatusBadge.jsx";
import { HealthBadge } from "../components/HealthBadge.jsx";

export function Overview({
  workers = [],
  automations = [],
  runs = [],
  jobs = [],
  health,
  viewMode,
  onNavigate,
  onRunAutomation,
}) {
  const isSimple = viewMode === "simple";
  const activeRuns = runs.filter((r) => r.status === "running" || r.status === "queued");
  const completedRuns = runs.filter((r) => r.status === "succeeded" || r.status === "failed");
  const succeededRuns = runs.filter((r) => r.status === "succeeded");
  const registeredWorkers = workers.filter((w) => w.status === "registered");

  const successRate =
    completedRuns.length > 0
      ? Math.round((succeededRuns.length / completedRuns.length) * 100) + "%"
      : "100%";

  const isNewUser = automations.length === 0;

  if (isSimple) {
    return (
      <div className="animate-in" style={{ maxWidth: "1000px", margin: "0 auto", padding: "2rem 0", display: "flex", flexDirection: "column", gap: "3rem" }}>
        
        {/* Header and Actions */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--color-text-primary)", marginBottom: "0.5rem" }}>
              Welcome to STRATUM
            </h1>
            <p style={{ fontSize: "1rem", color: "var(--color-text-secondary)", marginBottom: "1.5rem" }}>
              Create automations, run workflows, and use AI to investigate failures.
            </p>
            <div style={{ display: "flex", gap: "1rem" }}>
              <button onClick={() => onNavigate("create_automation")} className="btn btn-primary">
                Create automation
              </button>
              <button onClick={() => onNavigate("automations")} className="btn btn-secondary">
                Explore demo
              </button>
              <button onClick={() => onNavigate("agent")} className="btn btn-secondary" style={{ gap: "0.5rem" }}>
                <Bot size={16} /> AI Assistant
              </button>
            </div>
          </div>

          {/* System Status inline top right */}
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>
              System status
            </div>
            <HealthBadge isHealthy={health?.ok} text={health?.ok ? "Healthy" : "Unavailable"} />
          </div>
        </div>

        {/* Dynamic Content */}
        {isNewUser ? (
          <div className="empty-state" style={{ marginTop: "1rem" }}>
            <Layers size={32} className="empty-state-icon" />
            <h3 style={{ fontWeight: 600 }}>No automations yet</h3>
            <p>You haven't created any automations. Click "Create automation" above to get started.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "3rem" }}>
            
            {/* Your Automations (No Card Wrapper) */}
            <section>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--color-border)", paddingBottom: "0.75rem", marginBottom: "1rem" }}>
                <h3 style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Your Automations
                </h3>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                <thead>
                  <tr>
                    <th style={{ background: "transparent", borderBottom: "1px solid var(--color-border)", padding: "0.75rem 0", color: "var(--color-text-muted)", fontWeight: 500 }}>Automation name</th>
                    <th style={{ background: "transparent", borderBottom: "1px solid var(--color-border)", padding: "0.75rem 0", color: "var(--color-text-muted)", fontWeight: 500 }}>Status</th>
                    <th style={{ background: "transparent", borderBottom: "1px solid var(--color-border)", padding: "0.75rem 0", color: "var(--color-text-muted)", fontWeight: 500, textAlign: "right" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {automations.slice(0, 5).map((auto) => (
                    <tr key={auto.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                      <td style={{ padding: "1rem 0", fontWeight: 500, color: "var(--color-text-primary)" }}>
                        {auto.name}
                      </td>
                      <td style={{ padding: "1rem 0" }}>
                        <span className="badge" style={{ background: auto.enabled ? "var(--color-success)" : "var(--color-text-muted)", color: "#fff", border: "none" }}>
                          {auto.enabled ? "Enabled" : "Disabled"}
                        </span>
                      </td>
                      <td style={{ padding: "1rem 0", textAlign: "right" }}>
                        <button onClick={() => onNavigate("automation_detail", auto.id)} className="btn btn-secondary btn-sm" style={{ marginRight: "0.5rem" }}>
                          Open
                        </button>
                        <button onClick={() => onRunAutomation(auto.id)} className="btn btn-primary btn-sm">
                          Run
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            {/* Recent Activity (No Card Wrapper) */}
            <section>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--color-border)", paddingBottom: "0.75rem", marginBottom: "1rem" }}>
                <h3 style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Recent Activity
                </h3>
              </div>
              
              {runs.length === 0 ? (
                <div style={{ padding: "2rem 0", color: "var(--color-text-muted)" }}>
                  No recent activity
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                  <thead>
                    <tr>
                      <th style={{ background: "transparent", borderBottom: "1px solid var(--color-border)", padding: "0.75rem 0", color: "var(--color-text-muted)", fontWeight: 500 }}>Automation name</th>
                      <th style={{ background: "transparent", borderBottom: "1px solid var(--color-border)", padding: "0.75rem 0", color: "var(--color-text-muted)", fontWeight: 500 }}>Outcome</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.slice(0, 5).map((run) => {
                      const auto = automations.find(a => a.id === run.automationId);
                      return (
                        <tr key={run.id} onClick={() => onNavigate("run_detail", run.id)} style={{ cursor: "pointer", borderBottom: "1px solid var(--color-border)" }}>
                          <td style={{ padding: "1rem 0", fontWeight: 500, color: "var(--color-text-primary)" }}>
                            {auto?.name || "Unknown"}
                          </td>
                          <td style={{ padding: "1rem 0" }}>
                            <span style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--color-text-secondary)" }}>
                              {run.status === "running" || run.status === "queued" ? (
                                <><Activity size={14} style={{ color: "var(--color-primary)" }}/> In progress</>
                              ) : run.status === "succeeded" ? (
                                <><CheckCircle2 size={14} style={{ color: "var(--color-success)" }}/> Completed successfully</>
                              ) : run.status === "failed" ? (
                                <span style={{ color: "var(--color-error)", display: "flex", alignItems: "center", gap: "0.5rem" }}><Play size={14}/> Failed</span>
                              ) : (
                                "Stopped by cancellation"
                              )}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </section>
          </div>
        )}
      </div>
    );
  }

  // Technical View Home
  return (
    <div className="animate-in" style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* Key Activity */}
      <section>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "1rem", color: "var(--color-text-primary)" }}>System Overview</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1.25rem" }}>
          <MetricCard title="Active Runs" value={activeRuns.length} subtitle={`${runs.length} total history`} icon={Play} />
          <MetricCard title="Automations" value={automations.length} subtitle={`${automations.filter(a => a.enabled).length} enabled`} icon={Layers} />
          <MetricCard title="Workers" value={registeredWorkers.length} subtitle="Execution capacity" icon={Cpu} />
          <MetricCard title="Success Rate" value={successRate} subtitle="All time completed" icon={CheckCircle2} />
        </div>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "1.5rem" }}>
        {/* What is running */}
        <section className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--color-text-primary)" }}>Active Runs</h3>
            <button onClick={() => onNavigate("runs")} className="btn btn-secondary btn-sm" style={{ gap: "0.4rem" }}>
              View all <ArrowRight size={14} />
            </button>
          </div>

          {activeRuns.length === 0 ? (
            <div className="empty-state" style={{ padding: "3rem 1rem" }}>
              <Play size={32} className="empty-state-icon" />
              <h4 style={{ fontWeight: 500, fontSize: "1rem" }}>No active runs</h4>
              <p>Trigger an automation to see it execute live.</p>
              <button onClick={() => onNavigate("automations")} className="btn btn-primary btn-sm" style={{ marginTop: "0.5rem" }}>
                Go to Automations
              </button>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Automation</th>
                    <th>Status</th>
                    <th>Started</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {activeRuns.slice(0, 5).map((run) => {
                    const auto = automations.find(a => a.id === run.automationId);
                    return (
                      <tr key={run.id} onClick={() => onNavigate("run_detail", run.id)} style={{ cursor: "pointer" }}>
                        <td style={{ fontWeight: 500 }}>{auto?.name || run.automationId}</td>
                        <td><StatusBadge status={run.status} /></td>
                        <td style={{ color: "var(--color-text-secondary)" }}>
                          {run.startedAt ? new Date(run.startedAt).toLocaleTimeString() : "Pending"}
                        </td>
                        <td style={{ textAlign: "right" }}><ArrowUpRight size={16} color="var(--color-text-muted)" /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Recent Activity */}
        <section className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--color-text-primary)" }}>Recent Executions</h3>
            <button onClick={() => onNavigate("runs")} className="btn btn-secondary btn-sm" style={{ gap: "0.4rem" }}>
              History <ArrowRight size={14} />
            </button>
          </div>

          {completedRuns.length === 0 ? (
            <div className="empty-state" style={{ padding: "3rem 1rem" }}>
              <Clock size={32} className="empty-state-icon" />
              <h4 style={{ fontWeight: 500, fontSize: "1rem" }}>No execution history</h4>
              <p>Your completed automation runs will appear here.</p>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Automation</th>
                    <th>Status</th>
                    <th>Completed</th>
                  </tr>
                </thead>
                <tbody>
                  {completedRuns.slice(0, 5).map((run) => {
                    const auto = automations.find(a => a.id === run.automationId);
                    return (
                      <tr key={run.id} onClick={() => onNavigate("run_detail", run.id)} style={{ cursor: "pointer" }}>
                        <td style={{ fontWeight: 500 }}>{auto?.name || run.automationId}</td>
                        <td><StatusBadge status={run.status} /></td>
                        <td style={{ color: "var(--color-text-secondary)" }}>
                          {run.completedAt ? new Date(run.completedAt).toLocaleTimeString() : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

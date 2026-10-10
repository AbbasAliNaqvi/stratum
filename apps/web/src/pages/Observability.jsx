import React, { useEffect, useState } from "react";
import { Activity, Terminal, GitMerge, RefreshCw, BarChart } from "lucide-react";
import { getAllEvents, getMetrics } from "../api/client.js";

export function Observability() {
  const [activeTab, setActiveTab] = useState("metrics");
  const [rawMetrics, setRawMetrics] = useState("");
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [m, evts] = await Promise.all([
        getMetrics().catch(() => ""),
        getAllEvents(50).catch(() => []),
      ]);
      setRawMetrics(m || "# No metrics output from server");
      setEvents(evts || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="animate-in" style={{ display: "flex", flexDirection: "column", gap: "1.5rem", maxWidth: 1200, margin: "0 auto" }}>
      {/* Header & Tabs */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
        <div style={{ display: "flex", gap: "0.5rem", background: "var(--color-surface-glass)", padding: "0.35rem", borderRadius: "12px", border: "1px solid var(--color-border-glass)" }}>
          {[
            { id: "metrics", label: "Metrics", icon: BarChart },
            { id: "logs", label: "Logs", icon: Terminal },
            { id: "traces", label: "Traces", icon: GitMerge },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="btn btn-sm"
                style={{
                  background: isActive ? "var(--color-primary)" : "transparent",
                  color: isActive ? "#1a1c23" : "var(--color-text-secondary)",
                  borderRadius: "8px",
                  border: "none",
                  fontWeight: isActive ? 600 : 500,
                  boxShadow: isActive ? "0 2px 10px rgba(160, 210, 235, 0.2)" : "none",
                  transition: "all 0.2s"
                }}
              >
                <Icon size={14} /> {tab.label}
              </button>
            );
          })}
        </div>

        <button onClick={fetchData} className="btn btn-secondary btn-sm" style={{ gap: "0.4rem" }}>
          <RefreshCw size={14} className={loading ? "animate-spin-slow" : ""} /> Refresh
        </button>
      </div>

      {/* Tab 1: Metrics */}
      {activeTab === "metrics" && (
        <div className="card animate-in" style={{ background: "rgba(11, 15, 25, 0.4)", border: "1px solid var(--color-border-glass)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
            <BarChart size={16} style={{ color: "var(--color-primary)" }} />
            <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--color-primary)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
              Prometheus Telemetry (/metrics)
            </span>
          </div>
          <pre className="font-mono" style={{ whiteSpace: "pre-wrap", color: "var(--color-text-secondary)", fontSize: "0.8rem", maxHeight: "60vh", overflowY: "auto", padding: "1rem", background: "rgba(0,0,0,0.2)", borderRadius: 8 }}>
            {rawMetrics}
          </pre>
        </div>
      )}

      {/* Tab 2: Logs */}
      {activeTab === "logs" && (
        <div className="card animate-in">
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.25rem" }}>
            <Terminal size={16} style={{ color: "var(--color-tertiary)" }} />
            <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--color-text-primary)" }}>
              Structured Event Logs
            </span>
          </div>
          {events.length === 0 ? (
            <div className="empty-state">
              <Terminal size={48} className="empty-state-icon" style={{ opacity: 0.6 }} />
              <h3>No event logs found</h3>
              <p>System events will stream here as workers execute jobs.</p>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Event Type</th>
                    <th>Job ID</th>
                    <th>Worker Node</th>
                    <th>Message</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((evt) => (
                    <tr key={evt.id}>
                      <td style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
                        {new Date(evt.createdAt).toLocaleTimeString()}
                      </td>
                      <td>
                        <span className="badge font-mono" style={{ fontSize: "0.7rem", background: "rgba(229, 234, 245, 0.1)" }}>
                          {evt.eventType}
                        </span>
                      </td>
                      <td className="font-mono" style={{ fontSize: "0.8rem", color: "var(--color-text-primary)" }}>
                        {evt.jobId?.slice(0, 8)}...
                      </td>
                      <td className="font-mono" style={{ fontSize: "0.8rem", color: "var(--color-primary)" }}>
                        {evt.nodeId || "—"}
                      </td>
                      <td style={{ color: "var(--color-text-secondary)", fontSize: "0.85rem" }}>
                        {evt.message || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Traces */}
      {activeTab === "traces" && (
        <div className="card animate-in">
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.25rem" }}>
            <GitMerge size={16} style={{ color: "var(--color-secondary)" }} />
            <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--color-text-primary)" }}>
              Distributed Trace Propagation
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {events.filter(e => e.traceparent).length === 0 ? (
              <div className="empty-state">
                <GitMerge size={48} className="empty-state-icon" style={{ opacity: 0.6 }} />
                <h3>No active traces</h3>
                <p>Distributed trace headers are not present in recent job events.</p>
              </div>
            ) : (
              events
                .filter((e) => e.traceparent)
                .slice(0, 5)
                .map((evt) => (
                  <div key={evt.id} style={{ padding: "1.25rem", borderRadius: 8, background: "var(--color-surface-elevated)", border: "1px solid var(--color-border-glass)", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--color-secondary)" }}>
                        Trace Context
                      </span>
                      <span className="font-mono" style={{ fontSize: "0.7rem", color: "var(--color-text-muted)", background: "rgba(0,0,0,0.2)", padding: "0.2rem 0.5rem", borderRadius: 4 }}>
                        {evt.traceparent}
                      </span>
                    </div>

                    <div className="font-mono" style={{ display: "flex", flexDirection: "column", gap: "0.5rem", paddingLeft: "1rem", borderLeft: "2px solid var(--color-secondary)", marginTop: "0.5rem" }}>
                      <div style={{ fontSize: "0.8rem", color: "var(--color-text-secondary)" }}>
                        <span style={{ fontWeight: 600, color: "var(--color-primary)" }}>API Request</span> → Control Plane Dispatch
                      </div>
                      <div style={{ fontSize: "0.8rem", paddingLeft: "1rem", color: "var(--color-text-secondary)" }}>
                        <span style={{ fontWeight: 600, color: "var(--color-tertiary)" }}>Job Exec ({evt.jobId?.slice(0,8)})</span> → Event: {evt.eventType}
                      </div>
                      {evt.nodeId && (
                        <div style={{ fontSize: "0.8rem", paddingLeft: "2rem", color: "var(--color-text-secondary)" }}>
                          <span style={{ fontWeight: 600, color: "var(--color-success)" }}>Worker ({evt.nodeId})</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

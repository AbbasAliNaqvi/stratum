import React, { useEffect, useState } from "react";
import { Activity, Terminal, GitMerge, RefreshCw } from "lucide-react";
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
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Header & Tabs */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {[
            { id: "metrics", label: "Metrics", icon: Activity },
            { id: "logs", label: "Logs", icon: Terminal },
            { id: "traces", label: "Traces", icon: GitMerge },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="btn btn-secondary btn-sm"
                style={{
                  borderColor: isActive ? "var(--accent-blue)" : undefined,
                  color: isActive ? "#ffffff" : undefined,
                  backgroundColor: isActive ? "rgba(59, 130, 246, 0.15)" : undefined,
                }}
              >
                <Icon size={14} /> {tab.label}
              </button>
            );
          })}
        </div>

        <button onClick={fetchData} className="btn btn-secondary btn-sm">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {/* Tab 1: Metrics */}
      {activeTab === "metrics" && (
        <div className="card font-mono" style={{ fontSize: "0.8rem", background: "var(--bg-primary)" }}>
          <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--accent-blue)", marginBottom: "0.75rem", fontFamily: "Plus Jakarta Sans" }}>
            Prometheus Telemetry Metrics Output (/metrics)
          </div>
          <pre style={{ whiteSpace: "pre-wrap", color: "var(--text-secondary)", maxHeight: 500, overflowY: "auto" }}>
            {rawMetrics}
          </pre>
        </div>
      )}

      {/* Tab 2: Logs */}
      {activeTab === "logs" && (
        <div className="card">
          <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "0.75rem" }}>
            Structured Job Event Logs
          </div>
          {events.length === 0 ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
              No event logs captured.
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
                    <th>Traceparent</th>
                    <th>Message</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((evt) => (
                    <tr key={evt.id}>
                      <td style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        {new Date(evt.createdAt).toLocaleTimeString()}
                      </td>
                      <td>
                        <span className="badge badge-info" style={{ fontSize: "0.65rem" }}>
                          {evt.eventType}
                        </span>
                      </td>
                      <td className="font-mono" style={{ fontSize: "0.8rem" }}>
                        {evt.jobId?.slice(0, 8)}...
                      </td>
                      <td className="font-mono" style={{ fontSize: "0.8rem", color: "var(--accent-blue)" }}>
                        {evt.nodeId || "—"}
                      </td>
                      <td className="font-mono" style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                        {evt.traceparent || "—"}
                      </td>
                      <td style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}>
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
        <div className="card">
          <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "0.75rem" }}>
            Distributed Trace Propagation Hierarchy
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {events.filter(e => e.traceparent).length === 0 ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
                No active distributed trace headers recorded in job execution events.
              </div>
            ) : (
              events
                .filter((e) => e.traceparent)
                .slice(0, 5)
                .map((evt) => (
                  <div key={evt.id} style={{ padding: "1rem", borderRadius: 8, background: "var(--bg-elevated)", border: "1px solid var(--border-color)", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--accent-purple)" }}>
                        Trace Context
                      </span>
                      <span className="font-mono" style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                        {evt.traceparent}
                      </span>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", paddingLeft: "1rem", borderLeft: "2px solid var(--accent-purple)", marginTop: "0.25rem" }}>
                      <div style={{ fontSize: "0.78rem" }}>
                        <span style={{ fontWeight: 600, color: "#60a5fa" }}>CLI / API Request</span> → Control Plane Dispatch
                      </div>
                      <div style={{ fontSize: "0.78rem", paddingLeft: "0.75rem" }}>
                        <span style={{ fontWeight: 600, color: "#f59e0b" }}>Job Execution ({evt.jobId})</span> → Event: {evt.eventType}
                      </div>
                      {evt.nodeId && (
                        <div style={{ fontSize: "0.78rem", paddingLeft: "1.5rem" }}>
                          <span style={{ fontWeight: 600, color: "#10b981" }}>Worker Execution ({evt.nodeId})</span>
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

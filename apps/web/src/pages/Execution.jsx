import React, { useState } from "react";
import { Zap, Filter, RefreshCw, Cpu, CheckCircle, XCircle } from "lucide-react";
import { StatusBadge } from "../components/StatusBadge.jsx";

export function Execution({ jobs = [], onRefresh }) {
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedJob, setSelectedJob] = useState(null);

  const filteredJobs = jobs.filter((j) => {
    if (filterStatus === "all") return true;
    return j.status === filterStatus;
  });

  return (
    <div className="animate-in" style={{ display: "flex", flexDirection: "column", gap: "1.5rem", maxWidth: 1200, margin: "0 auto" }}>
      {/* Explanation Banner */}
      <div className="card" style={{ background: "rgba(160, 210, 235, 0.05)", border: "1px solid rgba(160, 210, 235, 0.2)", padding: "1.25rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.95rem", fontWeight: 700, color: "var(--color-primary)" }}>
          <Zap size={18} /> Technical Execution Primitives
        </div>
        <div style={{ fontSize: "0.85rem", color: "var(--color-text-secondary)", marginTop: "0.5rem" }}>
          Automation Runs spawn DAG steps, which resolve into atomic leased Jobs executed asynchronously by Workers.
        </div>
      </div>

      {/* Filter Toolbar */}
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
                background: filterStatus === st ? "rgba(160, 210, 235, 0.15)" : "transparent",
                borderColor: filterStatus === st ? "rgba(160, 210, 235, 0.3)" : "transparent",
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

      {/* Jobs Table */}
      <div className="card">
        {filteredJobs.length === 0 ? (
          <div className="empty-state">
            <Zap size={48} className="empty-state-icon" style={{ opacity: 0.6 }} />
            <h3>No jobs found</h3>
            <p>
              {filterStatus !== "all" 
                ? `There are no jobs currently in the '${filterStatus}' state.` 
                : "Execution jobs will appear here when an automation runs."}
            </p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Job ID</th>
                  <th>Task Type</th>
                  <th>Status</th>
                  <th>Worker (Locked By)</th>
                  <th>Retries</th>
                  <th>Priority</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {filteredJobs.map((job) => (
                  <tr
                    key={job.id}
                    onClick={() => setSelectedJob(selectedJob?.id === job.id ? null : job)}
                    style={{ cursor: "pointer", background: selectedJob?.id === job.id ? "rgba(160, 210, 235, 0.1)" : undefined }}
                  >
                    <td className="font-mono" style={{ fontWeight: 600, color: "var(--color-primary)", fontSize: "0.8rem" }}>
                      {job.id.slice(0, 8)}...
                    </td>
                    <td>
                      <span className="badge font-mono" style={{ fontSize: "0.75rem", background: "rgba(229, 234, 245, 0.1)", color: "var(--color-text-primary)" }}>
                        {job.type}
                      </span>
                    </td>
                    <td><StatusBadge status={job.status} /></td>
                    <td className="font-mono" style={{ fontSize: "0.8rem", color: job.lockedBy ? "var(--color-tertiary)" : "var(--color-text-muted)" }}>
                      {job.lockedBy || "Unassigned"}
                    </td>
                    <td style={{ color: "var(--color-text-secondary)" }}>{job.retryCount || 0} / {job.maxRetries || 3}</td>
                    <td style={{ color: "var(--color-text-secondary)" }}>{job.priority || 0}</td>
                    <td style={{ color: "var(--color-text-secondary)" }}>{new Date(job.createdAt).toLocaleTimeString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Job Details Drawer */}
      {selectedJob && (
        <div className="card animate-in" style={{ border: "1px solid var(--color-primary)", boxShadow: "0 0 20px rgba(160, 210, 235, 0.1)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
            <h3 className="font-mono" style={{ fontSize: "1rem", fontWeight: 700, color: "var(--color-text-primary)" }}>
              Job Details: {selectedJob.id}
            </h3>
            <button onClick={() => setSelectedJob(null)} className="btn btn-secondary btn-sm">
              Close
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
            <div>
              <div style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", marginBottom: "0.5rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Payload
              </div>
              <pre className="font-mono" style={{ fontSize: "0.75rem", background: "var(--color-surface-glass)", padding: "1rem", borderRadius: 8, overflowX: "auto", border: "1px solid var(--color-border-glass)", color: "var(--color-text-secondary)" }}>
                {JSON.stringify(selectedJob.payload, null, 2)}
              </pre>
            </div>

            <div>
              <div style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", marginBottom: "0.5rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Result / Error Output
              </div>
              <pre className="font-mono" style={{ fontSize: "0.75rem", background: "var(--color-surface-glass)", padding: "1rem", borderRadius: 8, overflowX: "auto", border: "1px solid var(--color-border-glass)", color: "var(--color-text-secondary)" }}>
                {JSON.stringify(selectedJob.result || selectedJob.error || {}, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

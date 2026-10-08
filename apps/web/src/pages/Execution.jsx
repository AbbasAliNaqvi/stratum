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
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Explanation Banner */}
      <div className="card" style={{ background: "rgba(59, 130, 246, 0.05)", border: "1px solid rgba(59, 130, 246, 0.2)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", fontWeight: 700, color: "var(--accent-blue)" }}>
          <Zap size={16} /> Technical Execution Primitives
        </div>
        <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
          Automation Runs spawn DAG steps, which resolve into atomic leased Jobs executed asynchronously by Workers.
        </div>
      </div>

      {/* Filter Toolbar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Filter size={16} style={{ color: "var(--text-muted)" }} />
          <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 600 }}>Status:</span>
          {["all", "queued", "running", "succeeded", "failed", "cancelled"].map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className="btn btn-secondary btn-sm"
              style={{
                textTransform: "capitalize",
                borderColor: filterStatus === st ? "var(--accent-blue)" : undefined,
                color: filterStatus === st ? "#ffffff" : undefined,
              }}
            >
              {st}
            </button>
          ))}
        </div>

        <button onClick={onRefresh} className="btn btn-secondary btn-sm">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Jobs Table */}
      <div className="card">
        {filteredJobs.length === 0 ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)" }}>
            No execution jobs found matching filter.
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
                    style={{ cursor: "pointer", background: selectedJob?.id === job.id ? "rgba(59, 130, 246, 0.08)" : undefined }}
                  >
                    <td className="font-mono" style={{ fontWeight: 700 }}>
                      {job.id.slice(0, 8)}...
                    </td>
                    <td>
                      <span className="badge badge-info font-mono" style={{ fontSize: "0.7rem" }}>
                        {job.type}
                      </span>
                    </td>
                    <td><StatusBadge status={job.status} /></td>
                    <td className="font-mono" style={{ fontSize: "0.8rem", color: job.lockedBy ? "var(--accent-blue)" : "var(--text-muted)" }}>
                      {job.lockedBy || "Unassigned"}
                    </td>
                    <td>{job.retryCount || 0} / {job.maxRetries || 3}</td>
                    <td>{job.priority || 0}</td>
                    <td>{new Date(job.createdAt).toLocaleTimeString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Job Details Drawer */}
      {selectedJob && (
        <div className="card" style={{ border: "1.5px solid var(--accent-blue)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h3 className="font-mono" style={{ fontSize: "1rem", fontWeight: 700 }}>
              Job Details: {selectedJob.id}
            </h3>
            <button onClick={() => setSelectedJob(null)} className="btn btn-secondary btn-sm">
              Close
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.25rem", fontWeight: 600 }}>
                Payload
              </div>
              <pre className="font-mono" style={{ fontSize: "0.75rem", background: "var(--bg-primary)", padding: "0.75rem", borderRadius: 6, overflowX: "auto" }}>
                {JSON.stringify(selectedJob.payload, null, 2)}
              </pre>
            </div>

            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.25rem", fontWeight: 600 }}>
                Result / Error Output
              </div>
              <pre className="font-mono" style={{ fontSize: "0.75rem", background: "var(--bg-primary)", padding: "0.75rem", borderRadius: 6, overflowX: "auto" }}>
                {JSON.stringify(selectedJob.result || selectedJob.error || {}, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

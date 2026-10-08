import React, { useState } from "react";
import { Play, Filter, RefreshCw, Eye } from "lucide-react";
import { StatusBadge } from "../components/StatusBadge.jsx";

export function Runs({ runs = [], onSelectRun, onRefresh }) {
  const [filterStatus, setFilterStatus] = useState("all");

  const filteredRuns = runs.filter((r) => {
    if (filterStatus === "all") return true;
    return r.status === filterStatus;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Header & Filter Controls */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Filter size={16} style={{ color: "var(--text-muted)" }} />
          <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 600 }}>Filter Status:</span>
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

      {/* Runs Table */}
      <div className="card">
        {filteredRuns.length === 0 ? (
          <div style={{ padding: "2.5rem", textAlign: "center", color: "var(--text-muted)" }}>
            No automation runs found matching filter criteria.
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Run ID</th>
                  <th>Automation ID</th>
                  <th>Status</th>
                  <th>Started</th>
                  <th>Completed</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRuns.map((run) => (
                  <tr key={run.id} onClick={() => onSelectRun(run.id)} style={{ cursor: "pointer" }}>
                    <td className="font-mono" style={{ fontWeight: 700 }}>
                      {run.id}
                    </td>
                    <td className="font-mono">{run.automationId}</td>
                    <td>
                      <StatusBadge status={run.status} />
                    </td>
                    <td>{run.startedAt ? new Date(run.startedAt).toLocaleString() : "—"}</td>
                    <td>{run.completedAt ? new Date(run.completedAt).toLocaleString() : "—"}</td>
                    <td>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectRun(run.id);
                        }}
                        className="btn btn-secondary btn-sm"
                      >
                        <Eye size={12} /> Inspect Live Run
                      </button>
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

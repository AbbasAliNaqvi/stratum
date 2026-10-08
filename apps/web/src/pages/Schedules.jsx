import React, { useState } from "react";
import { Plus, Calendar, Power, Play, Trash2, Clock } from "lucide-react";
import { StatusBadge } from "../components/StatusBadge.jsx";

export function Schedules({
  schedules = [],
  automations = [],
  onCreateSchedule,
  onToggleEnable,
  onDeleteSchedule,
  onRunNow,
}) {
  const [showModal, setShowModal] = useState(false);
  const [automationId, setAutomationId] = useState("");
  const [intervalMs, setIntervalMs] = useState(60000);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!automationId) return;
    await onCreateSchedule({
      automationId,
      intervalMs: Number(intervalMs),
      type: "interval",
    });
    setShowModal(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 800 }}>Automation Schedules</h2>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
            Durable recurring trigger schedules
          </p>
        </div>

        <button onClick={() => setShowModal(true)} className="btn btn-primary">
          <Plus size={16} /> Create Schedule
        </button>
      </div>

      {/* Modal */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="card" style={{ width: 450, maxWidth: "90vw" }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "1rem" }}>Create Recurring Schedule</h3>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.25rem", fontWeight: 600 }}>
                  Automation
                </label>
                <select
                  className="input"
                  value={automationId}
                  onChange={(e) => setAutomationId(e.target.value)}
                  required
                >
                  <option value="">Select an automation...</option>
                  {automations.map((a) => (
                    <option key={a.id} value={a.id}>{a.name} ({a.id})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.25rem", fontWeight: 600 }}>
                  Interval
                </label>
                <select
                  className="input"
                  value={intervalMs}
                  onChange={(e) => setIntervalMs(e.target.value)}
                >
                  <option value={10000}>Every 10 seconds</option>
                  <option value={30000}>Every 30 seconds</option>
                  <option value={60000}>Every 1 minute</option>
                  <option value={300000}>Every 5 minutes</option>
                  <option value={900000}>Every 15 minutes</option>
                  <option value={3600000}>Every 1 hour</option>
                </select>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.5rem" }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary btn-sm">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm">
                  Save Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Schedules Table */}
      <div className="card">
        {schedules.length === 0 ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)" }}>
            No active schedules configured.
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Schedule ID</th>
                  <th>Automation ID</th>
                  <th>Interval</th>
                  <th>Next Run</th>
                  <th>Last Run</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {schedules.map((sched) => {
                  const auto = automations.find((a) => a.id === sched.automationId);
                  return (
                    <tr key={sched.id}>
                      <td className="font-mono">{sched.id}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{auto?.name || sched.automationId}</div>
                        <div className="font-mono" style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{sched.automationId}</div>
                      </td>
                      <td>
                        <span className="badge badge-secondary font-mono" style={{ fontSize: "0.7rem" }}>
                          {sched.intervalMs ? `${sched.intervalMs / 1000}s` : sched.type}
                        </span>
                      </td>
                      <td>{sched.nextRunAt ? new Date(sched.nextRunAt).toLocaleTimeString() : "—"}</td>
                      <td>{sched.lastRunAt ? new Date(sched.lastRunAt).toLocaleTimeString() : "Never"}</td>
                      <td><StatusBadge status={sched.enabled ? "enabled" : "disabled"} /></td>
                      <td>
                        <div style={{ display: "flex", gap: "0.4rem" }}>
                          <button
                            onClick={() => onRunNow(sched.automationId)}
                            className="btn btn-primary btn-sm"
                            title="Run immediately"
                          >
                            <Play size={12} /> Run Now
                          </button>
                          <button
                            onClick={() => onToggleEnable(sched.id, !sched.enabled)}
                            className="btn btn-secondary btn-sm"
                            title={sched.enabled ? "Disable schedule" : "Enable schedule"}
                          >
                            <Power size={12} style={{ color: sched.enabled ? "#f59e0b" : "#10b981" }} />
                          </button>
                          <button
                            onClick={() => onDeleteSchedule(sched.id)}
                            className="btn btn-danger btn-sm"
                            title="Delete schedule"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

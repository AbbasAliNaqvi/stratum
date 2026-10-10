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
    <div className="animate-in" style={{ display: "flex", flexDirection: "column", gap: "1.5rem", maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--color-text-primary)", letterSpacing: "-0.02em" }}>Automation Schedules</h2>
        </div>

        <button onClick={() => setShowModal(true)} className="btn btn-primary" style={{ gap: "0.4rem" }}>
          <Plus size={16} /> Create Schedule
        </button>
      </div>

      {/* Modal */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(11, 15, 25, 0.8)", backdropFilter: "blur(12px)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="card animate-in" style={{ width: 450, maxWidth: "90vw", padding: "2rem", boxShadow: "0 24px 48px rgba(0,0,0,0.4)" }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "1.5rem", color: "var(--color-text-primary)" }}>Create Recurring Schedule</h3>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", color: "var(--color-text-secondary)", marginBottom: "0.4rem", fontWeight: 500 }}>
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
                <label style={{ display: "block", fontSize: "0.85rem", color: "var(--color-text-secondary)", marginBottom: "0.4rem", fontWeight: 500 }}>
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

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem" }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
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
          <div className="empty-state">
            <Calendar size={48} className="empty-state-icon" style={{ opacity: 0.6 }} />
            <h3>No active schedules</h3>
            <p>
              Create a recurring trigger to run your automations automatically on an interval.
            </p>
            <button onClick={() => setShowModal(true)} className="btn btn-primary" style={{ marginTop: "1rem" }}>
              Create Schedule
            </button>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Schedule ID</th>
                  <th>Automation</th>
                  <th>Interval</th>
                  <th>Next Run</th>
                  <th>Last Run</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {schedules.map((sched) => {
                  const auto = automations.find((a) => a.id === sched.automationId);
                  return (
                    <tr key={sched.id}>
                      <td className="font-mono" style={{ fontSize: "0.8rem", color: "var(--color-primary)" }}>{sched.id}</td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{auto?.name || sched.automationId}</div>
                        <div className="font-mono" style={{ fontSize: "0.7rem", color: "var(--color-text-muted)", marginTop: "0.2rem" }}>{sched.automationId}</div>
                      </td>
                      <td>
                        <span className="badge" style={{ background: "rgba(229, 234, 245, 0.05)", fontSize: "0.75rem" }}>
                          {sched.intervalMs ? `${sched.intervalMs / 1000}s` : sched.type}
                        </span>
                      </td>
                      <td style={{ color: "var(--color-text-secondary)" }}>{sched.nextRunAt ? new Date(sched.nextRunAt).toLocaleTimeString() : "—"}</td>
                      <td style={{ color: "var(--color-text-secondary)" }}>{sched.lastRunAt ? new Date(sched.lastRunAt).toLocaleTimeString() : "Never"}</td>
                      <td><StatusBadge status={sched.enabled ? "enabled" : "disabled"} /></td>
                      <td>
                        <div style={{ display: "flex", gap: "0.4rem", justifyContent: "flex-end" }}>
                          <button
                            onClick={() => onRunNow(sched.automationId)}
                            className="btn btn-primary btn-sm"
                            title="Run immediately"
                          >
                            <Play size={14} /> Run
                          </button>
                          <button
                            onClick={() => onToggleEnable(sched.id, !sched.enabled)}
                            className="btn btn-secondary btn-sm"
                            title={sched.enabled ? "Disable schedule" : "Enable schedule"}
                          >
                            <Power size={14} style={{ color: sched.enabled ? "var(--color-warning)" : "var(--color-success)" }} />
                          </button>
                          <button
                            onClick={() => onDeleteSchedule(sched.id)}
                            className="btn btn-danger btn-sm"
                            title="Delete schedule"
                          >
                            <Trash2 size={14} />
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

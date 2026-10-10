import React, { useState } from "react";
import { Plus, Play, Trash2, Power, Eye, Calendar, Layers } from "lucide-react";
import { StatusBadge } from "../components/StatusBadge.jsx";

export function Automations({
  automations = [],
  onNavigate,
  onRun,
  onToggleEnable,
  onDelete,
}) {
  const [searchTerm, setSearchTerm] = useState("");

  const filtered = automations.filter(
    (a) =>
      a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="animate-in" style={{ display: "flex", flexDirection: "column", gap: "1.5rem", maxWidth: 1200, margin: "0 auto" }}>
      {/* Top Controls */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="Search automations..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="input"
          style={{ maxWidth: 320, background: "var(--color-surface-glass)", backdropFilter: "blur(4px)" }}
        />

        <button
          onClick={() => onNavigate("create_automation")}
          className="btn btn-primary"
        >
          <Plus size={16} /> Create Automation
        </button>
      </div>

      {/* Grid of Automations */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <Layers size={48} className="empty-state-icon" style={{ opacity: 0.6 }} />
          <h3>No automations found</h3>
          <p>
            {searchTerm ? "Try a different search term." : "Create your first automation to start running workflows."}
          </p>
          {!searchTerm && (
            <button onClick={() => onNavigate("create_automation")} className="btn btn-primary" style={{ marginTop: "1rem" }}>
              Create Automation
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "1.5rem" }}>
          {filtered.map((auto) => (
            <div
              key={auto.id}
              className="card"
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: "1.25rem",
              }}
            >
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
                  <div>
                    <h3 style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--color-text-primary)", letterSpacing: "-0.01em" }}>
                      {auto.name}
                    </h3>
                    <div style={{ fontFamily: "JetBrains Mono", fontSize: "0.7rem", color: "var(--color-text-muted)" }}>
                      {auto.id}
                    </div>
                  </div>
                  <StatusBadge status={auto.enabled ? "enabled" : "disabled"} />
                </div>

                <p style={{ fontSize: "0.85rem", color: "var(--color-text-secondary)", marginBottom: "1rem", lineHeight: 1.4 }}>
                  {auto.description || "No description provided."}
                </p>

                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  <span className="badge" style={{ background: "rgba(229, 234, 245, 0.05)" }}>
                    {auto.definition?.steps?.length || 0} tasks
                  </span>
                  <span className="badge" style={{ background: "rgba(229, 234, 245, 0.05)" }}>
                    {new Date(auto.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingTop: "1rem",
                  borderTop: "1px solid var(--color-border-glass)",
                  gap: "0.5rem",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", gap: "0.4rem" }}>
                  <button
                    onClick={() => onNavigate("automation_detail", auto.id)}
                    className="btn btn-secondary btn-sm"
                    title="View details"
                  >
                    <Eye size={14} /> View
                  </button>

                  <button
                    onClick={() => onToggleEnable(auto.id, !auto.enabled)}
                    className="btn btn-secondary btn-sm"
                    title={auto.enabled ? "Disable automation" : "Enable automation"}
                  >
                    <Power size={14} style={{ color: auto.enabled ? "var(--color-warning)" : "var(--color-success)" }} />
                  </button>

                  <button
                    onClick={() => onDelete(auto.id)}
                    className="btn btn-danger btn-sm"
                    title="Delete automation"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <button
                  onClick={() => onRun(auto.id)}
                  className="btn btn-primary btn-sm"
                  style={{ gap: "0.35rem" }}
                >
                  <Play size={14} /> Run
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

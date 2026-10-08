import React, { useState } from "react";
import { Plus, Play, Trash2, Power, Eye, Calendar } from "lucide-react";
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
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Top Controls */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="Search automations..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="input"
          style={{ maxWidth: 320 }}
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
        <div className="card" style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--text-muted)" }}>
          {searchTerm ? "No automations match search filter." : "No automations configured in control plane."}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1.25rem" }}>
          {filtered.map((auto) => (
            <div
              key={auto.id}
              className="card"
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: "1rem",
              }}
            >
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                  <div>
                    <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)" }}>
                      {auto.name}
                    </h3>
                    <div style={{ fontFamily: "JetBrains Mono", fontSize: "0.7rem", color: "var(--text-muted)" }}>
                      {auto.id}
                    </div>
                  </div>
                  <StatusBadge status={auto.enabled ? "enabled" : "disabled"} />
                </div>

                <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "1rem" }}>
                  {auto.description || "No description provided."}
                </p>

                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  <span className="badge badge-secondary" style={{ fontSize: "0.7rem" }}>
                    {auto.definition?.steps?.length || 0} DAG steps
                  </span>
                  <span className="badge badge-secondary" style={{ fontSize: "0.7rem" }}>
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
                  paddingTop: "0.75rem",
                  borderTop: "1px solid var(--border-color)",
                  gap: "0.5rem",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", gap: "0.4rem" }}>
                  <button
                    onClick={() => onNavigate("automation_detail", auto.id)}
                    className="btn btn-secondary btn-sm"
                    title="View DAG details"
                  >
                    <Eye size={14} /> View DAG
                  </button>

                  <button
                    onClick={() => onToggleEnable(auto.id, !auto.enabled)}
                    className="btn btn-secondary btn-sm"
                    title={auto.enabled ? "Disable automation" : "Enable automation"}
                  >
                    <Power size={14} style={{ color: auto.enabled ? "#f59e0b" : "#10b981" }} />
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

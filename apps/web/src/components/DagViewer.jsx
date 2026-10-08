import React from "react";
import { CheckCircle2, XCircle, RefreshCw, Clock, ArrowDown, Play, CornerDownRight } from "lucide-react";

export function DagViewer({ steps = [], stepStates = {}, onSelectStep }) {
  if (!steps || steps.length === 0) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)", border: "1px dashed var(--border-color)", borderRadius: 8 }}>
        No steps defined in this automation workflow DAG.
      </div>
    );
  }

  // Calculate dependency levels for layout
  const levelMap = {};
  steps.forEach(step => {
    if (!step.dependsOn || step.dependsOn.length === 0) {
      levelMap[step.id] = 0;
    }
  });

  let changed = true;
  let passes = 0;
  while (changed && passes < 10) {
    changed = false;
    passes++;
    steps.forEach(step => {
      if (step.dependsOn && step.dependsOn.length > 0) {
        const parentLevels = step.dependsOn.map(depId => levelMap[depId]);
        if (parentLevels.every(l => l !== undefined)) {
          const maxParentLevel = Math.max(...parentLevels);
          if (levelMap[step.id] !== maxParentLevel + 1) {
            levelMap[step.id] = maxParentLevel + 1;
            changed = true;
          }
        }
      }
    });
  }

  // Group steps by level
  const levels = {};
  steps.forEach(step => {
    const lvl = levelMap[step.id] ?? 0;
    if (!levels[lvl]) levels[lvl] = [];
    levels[lvl].push(step);
  });

  const sortedLevels = Object.keys(levels).sort((a, b) => Number(a) - Number(b));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", alignItems: "center", padding: "1rem 0" }}>
      {/* Start Node */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.4rem 1rem", borderRadius: 20, background: "rgba(59, 130, 246, 0.15)", border: "1px solid rgba(59, 130, 246, 0.4)", color: "#60a5fa", fontSize: "0.8rem", fontWeight: 700 }}>
        <Play size={12} fill="#60a5fa" />
        START
      </div>

      <ArrowDown size={16} style={{ color: "var(--text-muted)" }} />

      {/* Levels */}
      {sortedLevels.map((lvlKey, lvlIdx) => {
        const levelSteps = levels[lvlKey];
        return (
          <React.Fragment key={lvlKey}>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "1.25rem", width: "100%", maxWidth: 800 }}>
              {levelSteps.map(step => {
                const state = stepStates[step.id] || {};
                const status = state.status || "queued";
                
                let borderColor = "var(--border-color)";
                let bgStyle = "var(--bg-surface)";
                let statusIcon = <Clock size={16} style={{ color: "var(--text-muted)" }} />;

                if (status === "succeeded") {
                  borderColor = "#10b981";
                  bgStyle = "rgba(16, 185, 129, 0.05)";
                  statusIcon = <CheckCircle2 size={16} style={{ color: "#10b981" }} />;
                } else if (status === "running") {
                  borderColor = "#3b82f6";
                  bgStyle = "rgba(59, 130, 246, 0.08)";
                  statusIcon = <RefreshCw size={16} className="animate-spin" style={{ color: "#3b82f6" }} />;
                } else if (status === "failed") {
                  borderColor = "#ef4444";
                  bgStyle = "rgba(239, 68, 68, 0.08)";
                  statusIcon = <XCircle size={16} style={{ color: "#ef4444" }} />;
                }

                return (
                  <div
                    key={step.id}
                    onClick={() => onSelectStep && onSelectStep(step)}
                    style={{
                      flex: "1 1 220px",
                      maxWidth: 280,
                      padding: "1rem",
                      borderRadius: 8,
                      border: `1.5px solid ${borderColor}`,
                      background: bgStyle,
                      cursor: onSelectStep ? "pointer" : "default",
                      transition: "transform 0.15s ease, box-shadow 0.15s ease",
                      boxShadow: status === "running" ? "0 0 15px rgba(59, 130, 246, 0.2)" : "none",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                      <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-primary)" }}>
                        {step.id}
                      </span>
                      {statusIcon}
                    </div>

                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.5rem" }}>
                      <span className="badge badge-info" style={{ fontSize: "0.65rem", padding: "0.15rem 0.4rem" }}>
                        {step.type}
                      </span>
                    </div>

                    {step.dependsOn && step.dependsOn.length > 0 && (
                      <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.25rem", marginTop: "0.4rem" }}>
                        <CornerDownRight size={10} />
                        Depends: {step.dependsOn.join(", ")}
                      </div>
                    )}

                    {state.jobId && (
                      <div style={{ fontSize: "0.65rem", fontFamily: "JetBrains Mono", color: "var(--text-muted)", marginTop: "0.4rem" }}>
                        Job: {state.jobId.slice(0, 8)}...
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {lvlIdx < sortedLevels.length - 1 && (
              <ArrowDown size={16} style={{ color: "var(--text-muted)" }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

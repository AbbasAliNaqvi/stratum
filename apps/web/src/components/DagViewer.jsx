import React from "react";
import { CheckCircle2, XCircle, RefreshCw, Clock, ArrowDown, Play, CornerDownRight } from "lucide-react";

export function DagViewer({ steps = [], stepStates = {}, onSelectStep }) {
  if (!steps || steps.length === 0) {
    return (
      <div className="empty-state">
        <Play size={32} className="empty-state-icon" style={{ opacity: 0.5 }} />
        <p>No steps defined in this automation workflow.</p>
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
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.4rem 1rem", borderRadius: 6, background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-text-secondary)", fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>
        <Play size={12} />
        Start
      </div>

      <ArrowDown size={18} style={{ color: "var(--color-text-muted)", opacity: 0.5 }} />

      {/* Levels */}
      {sortedLevels.map((lvlKey, lvlIdx) => {
        const levelSteps = levels[lvlKey];
        return (
          <React.Fragment key={lvlKey}>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "1.5rem", width: "100%", maxWidth: 900 }}>
              {levelSteps.map(step => {
                const state = stepStates[step.id] || {};
                const status = state.status || "queued";
                
                let borderColor = "var(--color-border)";
                let bgStyle = "var(--color-surface)";
                let statusIcon = <Clock size={16} style={{ color: "var(--color-text-muted)" }} />;

                if (status === "succeeded") {
                  borderColor = "var(--color-success)";
                  statusIcon = <CheckCircle2 size={16} style={{ color: "var(--color-success)" }} />;
                } else if (status === "running") {
                  borderColor = "var(--color-primary)";
                  statusIcon = <RefreshCw size={16} className="animate-spin-slow" style={{ color: "var(--color-primary)" }} />;
                } else if (status === "failed") {
                  borderColor = "var(--color-error)";
                  statusIcon = <XCircle size={16} style={{ color: "var(--color-error)" }} />;
                }

                return (
                  <div
                    key={step.id}
                    onClick={() => onSelectStep && onSelectStep(step)}
                    className="card-interactive"
                    style={{
                      flex: "1 1 240px",
                      maxWidth: 320,
                      padding: "1rem",
                      borderRadius: 6,
                      border: `1px solid ${borderColor}`,
                      background: bgStyle,
                      cursor: onSelectStep ? "pointer" : "default",
                      boxShadow: status === "running" ? "0 0 0 2px rgba(37, 99, 235, 0.1)" : "0 1px 2px rgba(0,0,0,0.02)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                      <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--color-text-primary)" }}>
                        {step.id}
                      </span>
                      {statusIcon}
                    </div>

                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.75rem" }}>
                      <span className="badge font-mono" style={{ fontSize: "0.7rem", background: "rgba(229, 234, 245, 0.1)" }}>
                        {step.type}
                      </span>
                    </div>

                    {step.dependsOn && step.dependsOn.length > 0 && (
                      <div style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)", display: "flex", alignItems: "center", gap: "0.35rem", marginTop: "0.5rem" }}>
                        <CornerDownRight size={12} style={{ opacity: 0.7 }} />
                        Depends: <span style={{ color: "var(--color-text-primary)" }}>{step.dependsOn.join(", ")}</span>
                      </div>
                    )}

                    {state.jobId && (
                      <div style={{ fontSize: "0.7rem", fontFamily: "JetBrains Mono", color: "var(--color-text-secondary)", marginTop: "0.75rem", padding: "0.2rem 0.4rem", borderRadius: 4, background: "var(--color-background)", border: "1px solid var(--color-border)", display: "inline-block" }}>
                        Job: {state.jobId.slice(0, 8)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {lvlIdx < sortedLevels.length - 1 && (
              <ArrowDown size={18} style={{ color: "var(--color-text-muted)", opacity: 0.5 }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

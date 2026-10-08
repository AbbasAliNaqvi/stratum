import React, { useState } from "react";
import { ArrowLeft, Plus, Trash2, CheckCircle, AlertCircle } from "lucide-react";
import { DagViewer } from "../components/DagViewer.jsx";

const TASK_TYPES = ["http", "echo", "validate", "shell", "db_query"];

export function CreateAutomation({ onNavigate, onCreate }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState([
    { id: "step_1", type: "http", payload: '{"url": "https://api.github.com", "method": "GET"}', dependsOn: [] },
  ]);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleAddStep = () => {
    const nextNum = steps.length + 1;
    const prevId = steps[steps.length - 1]?.id;
    setSteps([
      ...steps,
      {
        id: `step_${nextNum}`,
        type: "echo",
        payload: '{"message": "Hello from Stratum"}',
        dependsOn: prevId ? [prevId] : [],
      },
    ]);
  };

  const handleRemoveStep = (index) => {
    const stepIdToRemove = steps[index].id;
    const newSteps = steps.filter((_, i) => i !== index);
    // Remove reference from dependsOn
    const updated = newSteps.map((s) => ({
      ...s,
      dependsOn: s.dependsOn.filter((d) => d !== stepIdToRemove),
    }));
    setSteps(updated);
  };

  const handleStepChange = (index, field, value) => {
    const updated = [...steps];
    updated[index] = { ...updated[index], [field]: value };
    setSteps(updated);
  };

  const handleDependencyToggle = (index, depId) => {
    const updated = [...steps];
    const currentDeps = updated[index].dependsOn || [];
    if (currentDeps.includes(depId)) {
      updated[index].dependsOn = currentDeps.filter((d) => d !== depId);
    } else {
      updated[index].dependsOn = [...currentDeps, depId];
    }
    setSteps(updated);
  };

  const validate = () => {
    if (!name.trim()) return "Automation name is required.";
    if (steps.length === 0) return "At least one step is required.";

    const ids = new Set();
    for (const step of steps) {
      if (!step.id.trim()) return "Step ID cannot be empty.";
      if (ids.has(step.id)) return `Duplicate step ID: ${step.id}`;
      ids.add(step.id);
    }

    for (const step of steps) {
      if (step.dependsOn && step.dependsOn.length > 0) {
        for (const dep of step.dependsOn) {
          if (!ids.has(dep)) return `Step ${step.id} depends on unknown step: ${dep}`;
        }
      }
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    const err = validate();
    if (err) {
      setError(err);
      return;
    }

    setSubmitting(true);
    try {
      const formattedSteps = steps.map((s) => {
        let parsedPayload = {};
        try {
          parsedPayload = JSON.parse(s.payload);
        } catch (e) {
          parsedPayload = { raw: s.payload };
        }
        return {
          id: s.id,
          type: s.type,
          payload: parsedPayload,
          dependsOn: s.dependsOn,
        };
      });

      await onCreate({
        name,
        description,
        definition: { steps: formattedSteps },
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", maxWidth: 900, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button onClick={() => onNavigate("automations")} className="btn btn-secondary btn-sm">
          <ArrowLeft size={14} /> Back to Automations
        </button>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 800 }}>Create New Automation</h2>
      </div>

      {error && (
        <div style={{ padding: "0.85rem 1rem", borderRadius: 8, background: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#f87171", display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem" }}>
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <h3 style={{ fontSize: "0.95rem", fontWeight: 700 }}>Automation Details</h3>
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.25rem", fontWeight: 600 }}>
              Name
            </label>
            <input
              type="text"
              className="input"
              placeholder="e.g. API Health Monitor"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.25rem", fontWeight: 600 }}>
              Description
            </label>
            <textarea
              className="input"
              rows={2}
              placeholder="Brief description of what this workflow does"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        {/* Workflow Steps Builder */}
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 700 }}>Workflow DAG Steps</h3>
            <button type="button" onClick={handleAddStep} className="btn btn-secondary btn-sm">
              <Plus size={14} /> Add Task Step
            </button>
          </div>

          {steps.map((step, idx) => (
            <div
              key={idx}
              style={{
                padding: "1rem",
                borderRadius: 8,
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-color)",
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--accent-blue)" }}>
                  Task #{idx + 1}
                </span>
                {steps.length > 1 && (
                  <button type="button" onClick={() => handleRemoveStep(idx)} className="btn btn-danger btn-sm">
                    <Trash2 size={12} /> Remove
                  </button>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "0.25rem" }}>
                    Step ID
                  </label>
                  <input
                    type="text"
                    className="input font-mono"
                    value={step.id}
                    onChange={(e) => handleStepChange(idx, "id", e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "0.25rem" }}>
                    Task Type
                  </label>
                  <select
                    className="input font-mono"
                    value={step.type}
                    onChange={(e) => handleStepChange(idx, "type", e.target.value)}
                  >
                    {TASK_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "0.25rem" }}>
                  Payload (JSON)
                </label>
                <textarea
                  className="input font-mono"
                  rows={2}
                  value={step.payload}
                  onChange={(e) => handleStepChange(idx, "payload", e.target.value)}
                />
              </div>

              {/* Dependencies Checkboxes */}
              {idx > 0 && (
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "0.25rem" }}>
                    Depends On (Prerequisites)
                  </label>
                  <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                    {steps
                      .filter((s, i) => i !== idx && s.id !== step.id)
                      .map((otherStep) => {
                        const isChecked = (step.dependsOn || []).includes(otherStep.id);
                        return (
                          <label
                            key={otherStep.id}
                            style={{
                              fontSize: "0.75rem",
                              display: "flex",
                              alignItems: "center",
                              gap: "0.35rem",
                              cursor: "pointer",
                              color: isChecked ? "var(--accent-blue)" : "var(--text-muted)",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleDependencyToggle(idx, otherStep.id)}
                            />
                            {otherStep.id}
                          </label>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Live Preview */}
        <div className="card">
          <h3 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: "0.5rem" }}>
            Visual Graph Preview
          </h3>
          <DagViewer steps={steps} />
        </div>

        {/* Submit button */}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button type="submit" disabled={submitting} className="btn btn-primary">
            <CheckCircle size={16} /> Save & Create Automation
          </button>
        </div>
      </form>
    </div>
  );
}

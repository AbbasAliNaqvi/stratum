import React, { useState } from "react";
import { ArrowLeft, ArrowRight, Plus, Trash2, CheckCircle, AlertCircle, Server, FileCode2, Terminal, Clock, Settings, Play } from "lucide-react";
import { DagViewer } from "../components/DagViewer.jsx";

const TASK_DEFINITIONS = [
  { id: "http", name: "HTTP Request", icon: Server, desc: "Call an API or webhook endpoint.", defaultPayload: '{\n  "url": "https://api.example.com",\n  "method": "GET"\n}' },
  { id: "echo", name: "Echo", icon: FileCode2, desc: "Return a simple JSON value.", defaultPayload: '{\n  "message": "Hello from STRATUM"\n}' },
  { id: "sleep", name: "Delay", icon: Clock, desc: "Wait for a specified duration.", defaultPayload: '{\n  "durationMs": 5000\n}' },
  { id: "command", name: "Shell Command", icon: Terminal, desc: "Execute a shell command.", defaultPayload: '{\n  "command": "echo \\"Running script...\\""\n}' }
];

export function CreateAutomation({ viewMode, onNavigate, onCreate }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState([
    { id: "step_1", type: "http", payload: TASK_DEFINITIONS[0].defaultPayload, dependsOn: [] },
  ]);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  
  const isSimple = viewMode === "simple";

  const handleNext = () => {
    setError(null);
    if (currentStep === 1 && !name.trim()) {
      setError("Please provide a name for your automation.");
      return;
    }
    if (currentStep === 2) {
      if (steps.length === 0) {
        setError("Please add at least one task.");
        return;
      }
      const ids = new Set();
      for (const step of steps) {
        if (!step.id.trim()) {
          setError("All tasks must have an ID.");
          return;
        }
        if (ids.has(step.id)) {
          setError(`Duplicate task ID found: ${step.id}`);
          return;
        }
        ids.add(step.id);
      }
    }
    setCurrentStep(prev => prev + 1);
  };

  const handleBack = () => {
    setError(null);
    setCurrentStep(prev => prev - 1);
  };

  const handleAddStep = (typeId = "echo") => {
    const nextNum = steps.length + 1;
    const prevId = steps[steps.length - 1]?.id;
    setSteps([
      ...steps,
      {
        id: `task_${nextNum}`,
        type: typeId,
        payload: TASK_DEFINITIONS.find(t => t.id === typeId).defaultPayload,
        dependsOn: prevId ? [prevId] : [],
      },
    ]);
  };

  const handleRemoveStep = (index) => {
    const stepIdToRemove = steps[index].id;
    const newSteps = steps.filter((_, i) => i !== index);
    const updated = newSteps.map((s) => ({
      ...s,
      dependsOn: s.dependsOn.filter((d) => d !== stepIdToRemove),
    }));
    setSteps(updated);
  };

  const handleStepChange = (index, field, value) => {
    const updated = [...steps];
    updated[index] = { ...updated[index], [field]: value };
    
    if (field === "type") {
      const defaultPayload = TASK_DEFINITIONS.find(t => t.id === value)?.defaultPayload || "{}";
      updated[index].payload = defaultPayload;
    }
    
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
          if (!ids.has(dep)) return `Task '${step.id}' depends on unknown task: '${dep}'`;
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
    <div className="animate-in" style={{ display: "flex", flexDirection: "column", gap: "1.5rem", maxWidth: 800, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
        <div>
          <button onClick={() => onNavigate("automations")} className="btn btn-secondary btn-sm" style={{ marginBottom: "0.75rem" }}>
            <ArrowLeft size={14} /> Back
          </button>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 600, color: "var(--color-text-primary)" }}>Create Automation</h2>
        </div>
      </div>

      {/* Progress Tracker */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
        {[1, 2, 3, 4].map(num => (
          <div key={num} style={{ display: "flex", alignItems: "center", flex: num < 4 ? 1 : 0, gap: "0.5rem" }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
              background: currentStep >= num ? "var(--color-primary)" : "var(--color-background)",
              color: currentStep >= num ? "#fff" : "var(--color-text-muted)",
              border: currentStep >= num ? "none" : "1px solid var(--color-border)",
              fontWeight: 600, fontSize: "0.85rem"
            }}>
              {num}
            </div>
            {num < 4 && <div style={{ flex: 1, height: 2, background: currentStep > num ? "var(--color-primary)" : "var(--color-border)" }} />}
          </div>
        ))}
      </div>

      {error && (
        <div style={{ padding: "1rem", borderRadius: 8, background: "var(--color-background)", border: "1px solid var(--color-error)", color: "var(--color-error)", display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem" }}>
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Form Wizard */}
      <div className="card">
        {currentStep === 1 && (
          <div className="animate-in">
            <h3 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "0.5rem" }}>What do you want to automate?</h3>
            <p style={{ color: "var(--color-text-secondary)", fontSize: "0.9rem", marginBottom: "1.5rem" }}>
              Give your automation a recognizable name and a short description.
            </p>
            <div className="form-group">
              <label className="form-label">Name</label>
              <input
                type="text"
                className="input"
                placeholder="e.g. Daily API Health Check"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="form-group">
              <label className="form-label">Description (Optional)</label>
              <input
                type="text"
                className="input"
                placeholder="Briefly describe what this workflow does"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="animate-in">
            <h3 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "0.5rem" }}>What should happen?</h3>
            <p style={{ color: "var(--color-text-secondary)", fontSize: "0.9rem", marginBottom: "1.5rem" }}>
              Add the specific tasks you want STRATUM to perform.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              {steps.map((step, idx) => (
                <div key={idx} style={{ padding: "1.25rem", borderRadius: 8, border: "1px solid var(--color-border)", background: "var(--color-background)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                    <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--color-primary)" }}>
                      Task {idx + 1}
                    </span>
                    {steps.length > 1 && (
                      <button type="button" onClick={() => handleRemoveStep(idx)} className="btn btn-danger btn-sm" style={{ padding: "0.25rem 0.5rem" }}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: "0.8rem" }}>Task ID (Name)</label>
                      <input
                        type="text"
                        className="input font-mono"
                        value={step.id}
                        onChange={(e) => handleStepChange(idx, "id", e.target.value)}
                        placeholder="e.g. check_api"
                      />
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: "0.8rem" }}>Action Type</label>
                      <select
                        className="input"
                        value={step.type}
                        onChange={(e) => handleStepChange(idx, "type", e.target.value)}
                      >
                        {TASK_DEFINITIONS.map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                      <Settings size={12} /> Task Configuration Payload (JSON)
                    </label>
                    <textarea
                      className="input font-mono"
                      rows={4}
                      value={step.payload}
                      onChange={(e) => handleStepChange(idx, "payload", e.target.value)}
                      style={{ fontSize: "0.8rem" }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem" }}>
              <button type="button" onClick={() => handleAddStep("http")} className="btn btn-secondary btn-sm">
                <Plus size={14} /> Add Task
              </button>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="animate-in">
            <h3 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "0.5rem" }}>Connect tasks</h3>
            <p style={{ color: "var(--color-text-secondary)", fontSize: "0.9rem", marginBottom: "1.5rem" }}>
              Specify the order of execution. Should a task wait for another to finish?
            </p>

            {steps.length === 1 ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "var(--color-text-muted)", background: "var(--color-background)", borderRadius: 8, border: "1px dashed var(--color-border)" }}>
                You only have one task, so it will run immediately. No connections needed.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {steps.map((step, idx) => (
                  <div key={idx} style={{ padding: "1.25rem", borderRadius: 8, border: "1px solid var(--color-border)" }}>
                    <div style={{ fontWeight: 600, marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <Play size={14} style={{ color: "var(--color-primary)" }} /> {step.id}
                    </div>
                    {idx === 0 ? (
                      <div style={{ fontSize: "0.875rem", color: "var(--color-text-muted)" }}>
                        This is the first task. It will run immediately.
                      </div>
                    ) : (
                      <>
                        <label style={{ display: "block", fontSize: "0.875rem", color: "var(--color-text-secondary)", marginBottom: "0.5rem" }}>
                          Wait for these tasks to finish first:
                        </label>
                        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                          {steps.filter((s, i) => i !== idx && s.id !== step.id).map((otherStep) => {
                            const isChecked = (step.dependsOn || []).includes(otherStep.id);
                            return (
                              <button
                                key={otherStep.id}
                                type="button"
                                onClick={() => handleDependencyToggle(idx, otherStep.id)}
                                className={`btn btn-sm ${isChecked ? "btn-primary" : "btn-secondary"}`}
                                style={{ borderRadius: 6 }}
                              >
                                {isChecked && <CheckCircle size={14} />} {otherStep.id}
                              </button>
                            );
                          })}
                        </div>
                        {(step.dependsOn?.length === 0) && (
                          <div style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", marginTop: "0.5rem", fontStyle: "italic" }}>
                            Will run immediately in parallel with the first task.
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {currentStep === 4 && (
          <div className="animate-in">
            <h3 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "0.5rem" }}>Review</h3>
            <p style={{ color: "var(--color-text-secondary)", fontSize: "0.9rem", marginBottom: "1.5rem" }}>
              Check your workflow graph. Everything look good?
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.5rem" }}>
              <div><strong>Name:</strong> {name}</div>
              {description && <div><strong>Description:</strong> {description}</div>}
              <div><strong>Tasks:</strong> {steps.length}</div>
            </div>

            <div style={{ padding: "1.5rem", background: "var(--color-background)", borderRadius: 8, border: "1px solid var(--color-border)" }}>
              <DagViewer steps={steps} />
            </div>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.5rem" }}>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={handleBack}
          style={{ visibility: currentStep > 1 ? "visible" : "hidden" }}
        >
          <ArrowLeft size={16} /> Back
        </button>

        {currentStep < 4 ? (
          <button type="button" className="btn btn-primary" onClick={handleNext}>
            Next <ArrowRight size={16} />
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
            <CheckCircle size={16} /> {submitting ? "Saving..." : "Create Automation"}
          </button>
        )}
      </div>
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { ArrowLeft, RefreshCw, XOctagon, CheckCircle2, AlertTriangle, Cpu } from "lucide-react";
import { DagViewer } from "../components/DagViewer.jsx";
import { StatusBadge } from "../components/StatusBadge.jsx";
import { getRun, cancelRun, getAutomation } from "../api/client.js";

export function LiveRunView({ runId, onNavigate }) {
  const [run, setRun] = useState(null);
  const [automation, setAutomation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  const fetchRunDetails = async () => {
    try {
      const runData = await getRun(runId);
      setRun(runData);

      if (runData && runData.automationId) {
        const autoData = await getAutomation(runData.automationId).catch(() => null);
        setAutomation(autoData);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRunDetails();

    // Live polling interval if running or queued
    const timer = setInterval(() => {
      if (run && (run.status === "running" || run.status === "queued")) {
        fetchRunDetails();
      }
    }, 2000);

    return () => clearInterval(timer);
  }, [runId, run?.status]);

  const handleCancel = async () => {
    if (!window.confirm("Are you sure you want to cancel this automation run?")) return;
    setCancelling(true);
    try {
      await cancelRun(runId);
      await fetchRunDetails();
    } catch (err) {
      alert(`Failed to cancel run: ${err.message}`);
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)" }}>
        <RefreshCw size={24} className="animate-spin" style={{ margin: "0 auto 1rem" }} />
        Loading live run details...
      </div>
    );
  }

  if (error || !run) {
    return (
      <div className="card" style={{ padding: "3rem", textAlign: "center" }}>
        <h3>Error Loading Run</h3>
        <p style={{ color: "var(--text-muted)", marginTop: "0.5rem" }}>{error || "Run not found"}</p>
        <button onClick={() => onNavigate("runs")} className="btn btn-secondary" style={{ marginTop: "1rem" }}>
          <ArrowLeft size={16} /> Back to Runs
        </button>
      </div>
    );
  }

  const steps = automation?.definition?.steps || [];
  const stepStates = {};
  if (run.steps) {
    run.steps.forEach((s) => {
      stepStates[s.stepId] = {
        jobId: s.jobId,
        status: run.status === "succeeded" ? "succeeded" : run.status === "failed" ? "failed" : "running",
      };
    });
  }

  const isLive = run.status === "running" || run.status === "queued";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
        <button onClick={() => onNavigate("runs")} className="btn btn-secondary btn-sm">
          <ArrowLeft size={14} /> Back to Runs
        </button>

        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          {isLive && (
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="btn btn-danger btn-sm"
            >
              <XOctagon size={14} /> Cancel Run
            </button>
          )}

          <button onClick={fetchRunDetails} className="btn btn-secondary btn-sm">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Main Metadata Card */}
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>
              AUTOMATION RUN
            </div>
            <h2 className="font-mono" style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--text-primary)" }}>
              {run.id}
            </h2>
          </div>
          <StatusBadge status={run.status} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", paddingTop: "0.75rem", borderTop: "1px solid var(--border-color)" }}>
          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Automation</div>
            <div style={{ fontSize: "0.9rem", fontWeight: 600 }}>{automation?.name || run.automationId}</div>
          </div>

          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Started At</div>
            <div style={{ fontSize: "0.85rem", fontWeight: 500 }}>
              {run.startedAt ? new Date(run.startedAt).toLocaleTimeString() : "Pending"}
            </div>
          </div>

          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Completed At</div>
            <div style={{ fontSize: "0.85rem", fontWeight: 500 }}>
              {run.completedAt ? new Date(run.completedAt).toLocaleTimeString() : "In progress..."}
            </div>
          </div>
        </div>

        {/* Error banner if failed */}
        {run.error && (
          <div style={{ padding: "0.85rem 1rem", borderRadius: 6, background: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#f87171", fontSize: "0.85rem" }}>
            <div style={{ fontWeight: 700, marginBottom: "0.25rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <AlertTriangle size={14} /> Execution Error
            </div>
            <pre className="font-mono" style={{ fontSize: "0.8rem", whiteSpace: "pre-wrap" }}>
              {typeof run.error === "object" ? JSON.stringify(run.error, null, 2) : String(run.error)}
            </pre>
          </div>
        )}
      </div>

      {/* Live Workflow DAG Graph */}
      <div className="card">
        <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "1rem" }}>
          Live Step Execution Graph
        </h3>
        <DagViewer steps={steps} stepStates={stepStates} />
      </div>

      {/* Steps & Jobs Relationship Table (Technical Evaluation) */}
      <div className="card">
        <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "1rem" }}>
          Step ↔ Job ↔ Worker Relationships
        </h3>

        {!run.steps || run.steps.length === 0 ? (
          <div style={{ padding: "1.5rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>
            No executed step jobs linked to this run yet.
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Step ID</th>
                  <th>Step Database ID</th>
                  <th>Linked Job ID</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {run.steps.map((st) => (
                  <tr key={st.id}>
                    <td style={{ fontWeight: 600 }}>{st.stepId}</td>
                    <td className="font-mono">{st.id}</td>
                    <td className="font-mono" style={{ color: "var(--accent-blue)" }}>
                      {st.jobId || "None"}
                    </td>
                    <td><StatusBadge status={run.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Inputs & Results */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <div className="card">
          <h4 style={{ fontSize: "0.85rem", fontWeight: 700, marginBottom: "0.5rem" }}>Input Payload</h4>
          <pre className="font-mono" style={{ fontSize: "0.75rem", background: "var(--bg-primary)", padding: "0.75rem", borderRadius: 6, overflowX: "auto" }}>
            {JSON.stringify(run.input || {}, null, 2)}
          </pre>
        </div>

        <div className="card">
          <h4 style={{ fontSize: "0.85rem", fontWeight: 700, marginBottom: "0.5rem" }}>Execution Result</h4>
          <pre className="font-mono" style={{ fontSize: "0.75rem", background: "var(--bg-primary)", padding: "0.75rem", borderRadius: 6, overflowX: "auto" }}>
            {JSON.stringify(run.result || {}, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}

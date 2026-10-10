import React, { useEffect, useState } from "react";
import { ArrowLeft, RefreshCw, XOctagon, AlertTriangle, Cpu, Bot, Play, FileJson } from "lucide-react";
import { DagViewer } from "../components/DagViewer.jsx";
import { StatusBadge } from "../components/StatusBadge.jsx";
import { getRun, cancelRun, getAutomation, runAutomation } from "../api/client.js";

export function LiveRunView({ runId, viewMode, onNavigate }) {
  const [run, setRun] = useState(null);
  const [automation, setAutomation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [retriggering, setRetriggering] = useState(false);
  
  const isSimple = viewMode === "simple";

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

    const timer = setInterval(() => {
      if (run && (run.status === "running" || run.status === "queued")) {
        fetchRunDetails();
      }
    }, 2000);

    return () => clearInterval(timer);
  }, [runId, run?.status]);

  const handleCancel = async () => {
    if (!window.confirm("Are you sure you want to stop this run?")) return;
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

  const handleRetrigger = async () => {
    if (!automation) return;
    setRetriggering(true);
    try {
      const newRun = await runAutomation(automation.id);
      onNavigate("run_detail", newRun.id);
    } catch (err) {
      alert(`Failed to start a new run: ${err.message}`);
    } finally {
      setRetriggering(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "4rem", textAlign: "center", color: "var(--color-text-muted)" }}>
        <RefreshCw size={32} className="animate-spin-slow" style={{ margin: "0 auto 1.5rem", color: "var(--color-primary)" }} />
        <div style={{ fontSize: "1.1rem", fontWeight: 500 }}>Loading execution details...</div>
      </div>
    );
  }

  if (error || !run) {
    return (
      <div className="card animate-in" style={{ padding: "4rem", textAlign: "center", maxWidth: 600, margin: "2rem auto" }}>
        <AlertTriangle size={48} style={{ color: "var(--color-error)", margin: "0 auto 1.5rem" }} />
        <h3 style={{ fontSize: "1.25rem", color: "var(--color-text-primary)", marginBottom: "0.5rem" }}>Error Loading Run</h3>
        <p style={{ color: "var(--color-text-secondary)", marginBottom: "2rem" }}>{error || "Run not found"}</p>
        <button onClick={() => onNavigate("runs")} className="btn btn-secondary">
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
  const hasFailed = run.status === "failed";

  return (
    <div className="animate-in" style={{ display: "flex", flexDirection: "column", gap: "1.5rem", maxWidth: 1000, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
        <button onClick={() => onNavigate("runs")} className="btn btn-secondary btn-sm" style={{ paddingLeft: "0.5rem" }}>
          <ArrowLeft size={16} /> {isSimple ? "Back to Run History" : "Back to Runs"}
        </button>

        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          {isLive && (
            <button onClick={handleCancel} disabled={cancelling} className="btn btn-danger btn-sm" style={{ gap: "0.4rem" }}>
              <XOctagon size={14} /> Stop
            </button>
          )}
          <button onClick={fetchRunDetails} className="btn btn-secondary btn-sm" style={{ gap: "0.4rem" }}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", paddingBottom: "2rem", borderBottom: "1px solid var(--color-border)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: "0.85rem", color: "var(--color-primary)", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: "0.25rem" }}>
              Execution Details
            </div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--color-text-primary)", letterSpacing: "-0.01em", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              {automation?.name || "Unknown Automation"}
              {!isSimple && <span className="font-mono" style={{ fontSize: "0.9rem", color: "var(--color-text-muted)", fontWeight: 400 }}>({run.id})</span>}
            </h2>
          </div>
          <StatusBadge status={run.status} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1.25rem", padding: "1.25rem", background: "var(--color-surface-hover)", borderRadius: 8, border: "1px solid var(--color-border)" }}>
          <div>
            <div style={{ fontSize: "0.8rem", color: "var(--color-text-secondary)", marginBottom: "0.25rem" }}>Started</div>
            <div style={{ fontSize: "0.9rem", fontWeight: 500, color: "var(--color-text-primary)" }}>
              {run.startedAt ? new Date(run.startedAt).toLocaleString() : "Pending"}
            </div>
          </div>
          <div>
            <div style={{ fontSize: "0.8rem", color: "var(--color-text-secondary)", marginBottom: "0.25rem" }}>Completed</div>
            <div style={{ fontSize: "0.9rem", fontWeight: 500, color: "var(--color-text-primary)" }}>
              {run.completedAt ? new Date(run.completedAt).toLocaleString() : (isLive ? "In progress..." : "—")}
            </div>
          </div>
        </div>

        {/* Actionable Error State for Simple View */}
        {hasFailed && isSimple && (
          <div style={{ padding: "1.25rem", borderRadius: 8, background: "#FEF2F2", border: "1px solid #FECACA" }}>
            <div style={{ fontWeight: 600, color: "#991B1B", marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "1rem" }}>
              <AlertTriangle size={18} /> This execution did not complete successfully.
            </div>
            <p style={{ fontSize: "0.9rem", color: "#B91C1C", marginBottom: "1rem" }}>
              Something went wrong while running the tasks. You can view the technical error below, ask your AI Assistant to investigate, or try running it again.
            </p>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <details style={{ background: "#fff", borderRadius: 6, border: "1px solid #FECACA", overflow: "hidden" }}>
                <summary style={{ padding: "0.5rem 1rem", fontSize: "0.85rem", fontWeight: 500, color: "#991B1B", cursor: "pointer" }}>
                  View technical error
                </summary>
                <pre className="font-mono" style={{ padding: "1rem", fontSize: "0.8rem", color: "#991B1B", background: "#fef2f2", margin: 0, whiteSpace: "pre-wrap", borderTop: "1px solid #FECACA" }}>
                  {typeof run.error === "object" ? JSON.stringify(run.error, null, 2) : String(run.error || "Unknown error")}
                </pre>
              </details>
              
              <button onClick={() => onNavigate("agent")} className="btn btn-sm" style={{ background: "#F3E8FF", color: "#7E22CE", borderColor: "#E9D5FF" }}>
                <Bot size={14} /> Ask AI Assistant to investigate
              </button>

              <button onClick={handleRetrigger} disabled={retriggering} className="btn btn-sm btn-primary">
                <Play size={14} /> {retriggering ? "Starting..." : "Run Again"}
              </button>
            </div>
          </div>
        )}

        {/* Regular Error State for Technical View */}
        {hasFailed && !isSimple && (
          <div style={{ padding: "1rem", borderRadius: 8, background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", fontSize: "0.85rem" }}>
            <div style={{ fontWeight: 600, marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <AlertTriangle size={16} /> Execution Error
            </div>
            <pre className="font-mono" style={{ fontSize: "0.8rem", whiteSpace: "pre-wrap", opacity: 0.9 }}>
              {typeof run.error === "object" ? JSON.stringify(run.error, null, 2) : String(run.error)}
            </pre>
            <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem" }}>
              <button onClick={handleRetrigger} disabled={retriggering} className="btn btn-danger btn-sm" style={{ background: "#fff" }}>
                <Play size={14} /> Retry Run
              </button>
            </div>
          </div>
        )}
      </div>

      {/* DAG Viewer */}
      <div style={{ paddingTop: "1rem" }}>
        <h3 style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--color-text-primary)", marginBottom: "0.5rem" }}>
          Execution Flow
        </h3>
        <p style={{ fontSize: "0.85rem", color: "var(--color-text-secondary)", marginBottom: "1.25rem" }}>
          Visual representation of tasks and their progress.
        </p>
        <div style={{ padding: "1rem", background: "transparent", borderRadius: 8, border: "1px solid var(--color-border)" }}>
          <DagViewer steps={steps} stepStates={stepStates} />
        </div>
      </div>

      {/* Collapsible Technical Details */}
      <details style={{ paddingTop: "1rem" }} open={!isSimple}>
        <summary style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--color-text-primary)", cursor: "pointer", userSelect: "none" }}>
          Technical Execution Details
        </summary>
        
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem", marginTop: "1.5rem" }}>
          
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
            <div>
              <h4 style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--color-text-primary)", marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <FileJson size={14} /> Input Payload
              </h4>
              <pre className="font-mono" style={{ fontSize: "0.75rem", background: "var(--color-surface-hover)", padding: "1rem", borderRadius: 8, overflowX: "auto", border: "1px solid var(--color-border)", color: "var(--color-text-secondary)", minHeight: "80px" }}>
                {JSON.stringify(run.input || {}, null, 2)}
              </pre>
            </div>

            <div>
              <h4 style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--color-text-primary)", marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <FileJson size={14} /> Execution Result
              </h4>
              <pre className="font-mono" style={{ fontSize: "0.75rem", background: "var(--color-surface-hover)", padding: "1rem", borderRadius: 8, overflowX: "auto", border: "1px solid var(--color-border)", color: "var(--color-text-secondary)", minHeight: "80px" }}>
                {JSON.stringify(run.result || {}, null, 2)}
              </pre>
            </div>
          </div>

          <div>
            <h4 style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--color-text-primary)", marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <Cpu size={14} /> Job & Worker Allocations
            </h4>

            {!run.steps || run.steps.length === 0 ? (
              <div className="empty-state" style={{ padding: "1.5rem", borderRadius: 8 }}>
                <p style={{ fontSize: "0.85rem" }}>No executed jobs linked to this run yet.</p>
              </div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Step ID</th>
                      <th>Step DB ID</th>
                      <th>Linked Job ID</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {run.steps.map((st) => (
                      <tr key={st.id}>
                        <td style={{ fontWeight: 600, color: "var(--color-primary)", fontSize: "0.8rem" }}>{st.stepId}</td>
                        <td className="font-mono" style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)" }}>{st.id}</td>
                        <td className="font-mono" style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
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
        </div>
      </details>
    </div>
  );
}

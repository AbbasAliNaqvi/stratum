import React, { useState, useEffect } from "react";
import {
  Bot,
  Send,
  Plus,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ShieldAlert,
  Terminal,
  Activity,
  Layers,
  Play,
  Check,
  X,
} from "lucide-react";
import {
  getAgentConfig,
  getAgentSessions,
  getAgentSession,
  createAgentSession,
  sendAgentMessage,
  approveAgentAction,
  rejectAgentAction,
} from "../api/client.js";
import { MissionTimeline } from "../components/MissionTimeline.jsx";

export function Agent() {
  const [config, setConfig] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [currentSession, setCurrentSession] = useState(null);

  const [inputPrompt, setInputPrompt] = useState("");
  const [sending, setSending] = useState(false);
  const [processingApproval, setProcessingApproval] = useState(null);

  const fetchConfigAndSessions = async () => {
    try {
      const cfg = await getAgentConfig().catch(() => null);
      setConfig(cfg);

      const sessList = await getAgentSessions().catch(() => []);
      setSessions(sessList);

      if (!activeSessionId && sessList.length > 0) {
        setActiveSessionId(sessList[0].id);
      }
    } catch (err) {
      console.error("Agent init error:", err);
    }
  };

  const fetchActiveSession = async (id) => {
    if (!id) return;
    try {
      const s = await getAgentSession(id);
      setCurrentSession(s);
    } catch (err) {
      console.error("Fetch session error:", err);
    }
  };

  useEffect(() => {
    fetchConfigAndSessions();
  }, []);

  useEffect(() => {
    if (activeSessionId) {
      fetchActiveSession(activeSessionId);
    }
  }, [activeSessionId]);

  const handleCreateNewSession = async () => {
    try {
      const sess = await createAgentSession("New Operational Session");
      setSessions([sess, ...sessions]);
      setActiveSessionId(sess.id);
      setCurrentSession(sess);
    } catch (err) {
      alert(`Failed to create session: ${err.message}`);
    }
  };

  const handleSendMessage = async (customText = null) => {
    const text = customText || inputPrompt;
    if (!text || !text.trim() || sending) return;

    setSending(true);
    setInputPrompt("");

    let sessId = activeSessionId;
    if (!sessId) {
      const newSess = await createAgentSession(`Goal: ${text.slice(0, 25)}`);
      sessId = newSess.id;
      setActiveSessionId(sessId);
      setSessions([newSess, ...sessions]);
    }

    try {
      const updatedSess = await sendAgentMessage(sessId, text);
      setCurrentSession(updatedSess);
      fetchConfigAndSessions();
    } catch (err) {
      alert(`Agent execution error: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  const handleApprove = async (approvalId) => {
    setProcessingApproval(approvalId);
    try {
      const updatedSess = await approveAgentAction(approvalId);
      setCurrentSession(updatedSess);
      fetchConfigAndSessions();
    } catch (err) {
      alert(`Approval error: ${err.message}`);
    } finally {
      setProcessingApproval(null);
    }
  };

  const handleReject = async (approvalId) => {
    setProcessingApproval(approvalId);
    try {
      const updatedSess = await rejectAgentAction(approvalId, "Rejected by user");
      setCurrentSession(updatedSess);
      fetchConfigAndSessions();
    } catch (err) {
      alert(`Rejection error: ${err.message}`);
    } finally {
      setProcessingApproval(null);
    }
  };

  const promptChips = [
    "Show me current STRATUM system health",
    "List my automations",
    "Run API Health Monitor",
    "Why did the last run fail?",
    "Create an automation that checks my API every minute",
    "Cancel the active run",
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Top AI Status Banner */}
      <div
        className="card"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
          background: "linear-gradient(135deg, rgba(139, 92, 246, 0.12) 0%, rgba(59, 130, 246, 0.12) 100%)",
          border: "1px solid rgba(139, 92, 246, 0.3)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: "rgba(139, 92, 246, 0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#a78bfa",
            }}
          >
            <Bot size={24} />
          </div>
          <div>
            <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "#ffffff" }}>
              STRATUM AI Agent Runtime
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
              Autonomous Operations, Tool Calling & Governed Intelligence Protocol
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ textAlign: "right", fontSize: "0.75rem", color: "var(--text-muted)" }}>
            <div>Provider: <strong style={{ color: "#ffffff" }}>{config?.provider || "mock"}</strong></div>
            <div>Model: <strong style={{ color: "#ffffff" }}>{config?.model || "gpt-4o"}</strong></div>
          </div>

          <div style={{ textAlign: "right", fontSize: "0.75rem", color: "var(--text-muted)" }}>
            <div>Tools Registered: <strong style={{ color: "#a78bfa" }}>{config?.toolCount || 18}</strong></div>
            <div>Policy: <strong style={{ color: "#10b981" }}>Controlled</strong></div>
          </div>

          <span className="badge badge-success" style={{ padding: "0.4rem 0.75rem" }}>
            ● AI Ready
          </span>
        </div>
      </div>

      {/* Main Workspace split */}
      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: "1.5rem" }}>
        {/* Left Sessions Sidebar */}
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <button onClick={handleCreateNewSession} className="btn btn-primary btn-sm" style={{ width: "100%" }}>
            <Plus size={14} /> New Session
          </button>

          <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Agent Goal Sessions
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", maxHeight: 450, overflowY: "auto" }}>
            {sessions.length === 0 ? (
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", padding: "0.5rem" }}>No active sessions</div>
            ) : (
              sessions.map((sess) => {
                const isActive = sess.id === activeSessionId;
                return (
                  <button
                    key={sess.id}
                    onClick={() => setActiveSessionId(sess.id)}
                    style={{
                      textAlign: "left",
                      padding: "0.6rem 0.75rem",
                      borderRadius: 6,
                      fontSize: "0.8rem",
                      fontWeight: isActive ? 700 : 500,
                      color: isActive ? "#ffffff" : "var(--text-secondary)",
                      background: isActive ? "rgba(139, 92, 246, 0.2)" : "transparent",
                      border: isActive ? "1px solid rgba(139, 92, 246, 0.4)" : "1px solid transparent",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {sess.title}
                    </div>
                    <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
                      {new Date(sess.createdAt).toLocaleTimeString()}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Active Agent Workspace */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Quick Prompt Chips */}
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {promptChips.map((chip, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(chip)}
                disabled={sending}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: "0.75rem" }}
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Goal Input Bar */}
          <div className="card" style={{ display: "flex", gap: "0.75rem", padding: "0.75rem" }}>
            <input
              type="text"
              className="input"
              placeholder="What would you like STRATUM to automate or investigate?"
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
              disabled={sending}
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={sending || !inputPrompt.trim()}
              className="btn btn-primary"
            >
              {sending ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
              {sending ? "Processing..." : "Run Agent"}
            </button>
          </div>

            {/* Conversation Feed / Mission Timeline */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              {!currentSession || !currentSession.messages || currentSession.messages.length === 0 ? (
                <div className="card" style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)" }}>
                  <Bot size={32} style={{ margin: "0 auto 1rem", opacity: 0.5 }} />
                  <h3>No messages in this session yet</h3>
                  <p style={{ fontSize: "0.85rem", marginTop: "0.4rem" }}>
                    Select a goal chip above or enter a natural language command to execute.
                  </p>
                </div>
              ) : (
                <MissionTimeline 
                  session={currentSession} 
                  onApprove={handleApprove} 
                  onReject={handleReject} 
                  processingApproval={processingApproval} 
                />
              )}
            </div>
        </div>
      </div>
    </div>
  );
}

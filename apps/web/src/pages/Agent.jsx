import React, { useState, useEffect } from "react";
import {
  Bot,
  Send,
  Plus,
  RefreshCw,
  AlertCircle
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

export function Agent({ viewMode }) {
  const [config, setConfig] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [currentSession, setCurrentSession] = useState(null);

  const [inputPrompt, setInputPrompt] = useState("");
  const [sending, setSending] = useState(false);
  const [processingApproval, setProcessingApproval] = useState(null);

  const isSimple = viewMode === "simple";
  const isAvailable = config && config.provider && config.provider !== "mock";

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
    "Is STRATUM working correctly?",
    "Explain why my last automation failed.",
    "Run my API Health Monitor.",
    "Help me create an automation."
  ];

  if (!isAvailable) {
    return (
      <div className="animate-in empty-state" style={{ maxWidth: 800, margin: "2rem auto" }}>
        <Bot size={48} style={{ color: "var(--color-text-muted)" }} />
        <h3 style={{ fontSize: "1.25rem", color: "var(--color-text-primary)", marginTop: "1rem" }}>
          AI Assistant is not configured
        </h3>
        <p style={{ color: "var(--color-text-secondary)", maxWidth: 500, margin: "0 auto" }}>
          The AI provider is currently unavailable or set to mock mode. Please configure a valid AI provider in the STRATUM control plane environment variables to enable the AI Assistant.
        </p>
      </div>
    );
  }

  if (isSimple) {
    return (
      <div className="animate-in" style={{ display: "flex", flexDirection: "column", gap: "1.5rem", maxWidth: 800, margin: "0 auto" }}>
        {/* Top Header */}
        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: "1rem", color: "var(--color-primary)" }}>
            <Bot size={32} />
          </div>
          <h2 style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--color-text-primary)", marginBottom: "0.5rem" }}>
            AI Assistant
          </h2>
          <p style={{ fontSize: "1rem", color: "var(--color-text-secondary)" }}>
            I can investigate system health, explain failures, or help manage automations.
          </p>
        </div>

        {/* Goal Input Bar */}
        <div className="card" style={{ display: "flex", gap: "1rem", padding: "1rem", background: "var(--color-surface)", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)" }}>
          <input
            type="text"
            className="input"
            placeholder="What would you like me to do?"
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
            disabled={sending}
            style={{ fontSize: "1rem", border: "none", boxShadow: "none", background: "transparent", padding: 0 }}
          />
          <button
            onClick={() => handleSendMessage()}
            disabled={sending || !inputPrompt.trim()}
            className="btn btn-primary"
            style={{ padding: "0 1.5rem", borderRadius: 8 }}
          >
            {sending ? <RefreshCw size={18} className="animate-spin-slow" /> : <Send size={18} />}
          </button>
        </div>

        {/* Quick Prompt Chips */}
        {(!currentSession || !currentSession.messages || currentSession.messages.length === 0) && (
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center", marginTop: "0.5rem" }}>
            {promptChips.map((chip, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(chip)}
                disabled={sending}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: "0.85rem", borderRadius: 6, padding: "0.5rem 1rem", background: "var(--color-surface-hover)" }}
              >
                {chip}
              </button>
            ))}
          </div>
        )}

        {/* Conversation Feed */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", marginTop: "1rem" }}>
          {currentSession && currentSession.messages && currentSession.messages.length > 0 && (
            <div className="card" style={{ padding: "0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem", borderBottom: "1px solid var(--color-border)" }}>
                <span style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>Current Conversation</span>
                <button onClick={handleCreateNewSession} className="btn btn-secondary btn-sm">
                  <Plus size={14} /> New Chat
                </button>
              </div>
              <div style={{ padding: "1rem" }}>
                <MissionTimeline 
                  session={currentSession} 
                  onApprove={handleApprove} 
                  onReject={handleReject} 
                  processingApproval={processingApproval} 
                  simpleView={true}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Technical View
  return (
    <div className="animate-in" style={{ display: "flex", flexDirection: "column", gap: "1.5rem", maxWidth: 1200, margin: "0 auto" }}>
      {/* Top AI Status Banner */}
      <div
        className="card"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1.5rem",
          background: "var(--color-surface-hover)",
          padding: "1.5rem 2rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--color-text-secondary)",
            }}
          >
            <Bot size={28} />
          </div>
          <div>
            <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--color-text-primary)", letterSpacing: "-0.01em" }}>
              STRATUM AI Agent
            </div>
            <div style={{ fontSize: "0.85rem", color: "var(--color-text-secondary)", marginTop: "0.25rem" }}>
              Autonomous Operations, Tool Calling & Governed Intelligence Protocol
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "1.5rem", alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ textAlign: "right", fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
            <div>Provider: <strong style={{ color: "var(--color-text-primary)" }}>{config?.provider || "mock"}</strong></div>
            <div>Model: <strong style={{ color: "var(--color-text-primary)" }}>{config?.model || "gemini-3.1-pro"}</strong></div>
          </div>

          <div style={{ textAlign: "right", fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
            <div>Tools: <strong style={{ color: "var(--color-primary)" }}>{config?.toolCount || 18}</strong></div>
            <div>Policy: <strong style={{ color: "var(--color-success)" }}>Controlled</strong></div>
          </div>

          <span className="badge badge-success" style={{ padding: "0.4rem 0.85rem", fontSize: "0.75rem" }}>
            ● AI Ready
          </span>
        </div>
      </div>

      {/* Main Workspace split */}
      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: "1.5rem" }}>
        {/* Left Sessions Sidebar */}
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: "1.25rem", height: "fit-content" }}>
          <button onClick={handleCreateNewSession} className="btn btn-primary" style={{ width: "100%" }}>
            <Plus size={16} /> New Session
          </button>

          <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Recent Goals
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "60vh", overflowY: "auto" }}>
            {sessions.length === 0 ? (
              <div style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", padding: "1rem", textAlign: "center" }}>No active sessions</div>
            ) : (
              sessions.map((sess) => {
                const isActive = sess.id === activeSessionId;
                return (
                  <button
                    key={sess.id}
                    onClick={() => setActiveSessionId(sess.id)}
                    style={{
                      textAlign: "left",
                      padding: "0.75rem 1rem",
                      borderRadius: 8,
                      fontSize: "0.85rem",
                      fontWeight: isActive ? 600 : 500,
                      color: isActive ? "var(--color-primary)" : "var(--color-text-secondary)",
                      background: isActive ? "var(--color-surface-selected)" : "transparent",
                      cursor: "pointer",
                      border: "none",
                      transition: "all 0.15s"
                    }}
                  >
                    <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {sess.title}
                    </div>
                    <div style={{ fontSize: "0.7rem", color: "var(--color-text-muted)", marginTop: "0.35rem" }}>
                      {new Date(sess.createdAt).toLocaleTimeString()}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Active Agent Workspace */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Goal Input Bar */}
          <div className="card" style={{ display: "flex", gap: "1rem", padding: "1rem" }}>
            <input
              type="text"
              className="input"
              placeholder="What would you like STRATUM to automate or investigate?"
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
              disabled={sending}
              style={{ fontSize: "0.95rem" }}
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={sending || !inputPrompt.trim()}
              className="btn btn-primary"
              style={{ padding: "0 1.5rem" }}
            >
              {sending ? <RefreshCw size={18} className="animate-spin-slow" /> : <Send size={18} />}
              {sending ? "Processing..." : "Run"}
            </button>
          </div>

          {/* Quick Prompt Chips */}
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {promptChips.map((chip, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(chip)}
                disabled={sending}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: "0.8rem", borderRadius: 6 }}
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Conversation Feed */}
          <div className="card" style={{ padding: "1.5rem" }}>
            {!currentSession || !currentSession.messages || currentSession.messages.length === 0 ? (
              <div className="empty-state">
                <Bot size={48} className="empty-state-icon" style={{ opacity: 0.6 }} />
                <h3>How can I help you?</h3>
                <p>
                  Select a suggestion above or enter a natural language command to execute. 
                  I can inspect STRATUM state, create automations, and diagnose issues.
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

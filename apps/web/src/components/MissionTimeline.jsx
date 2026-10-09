import React, { useState } from "react";
import { CheckCircle2, RefreshCw, AlertTriangle, ShieldAlert, ChevronDown, ChevronRight, Check, X } from "lucide-react";

export function MissionTimeline({ session, onApprove, onReject, processingApproval }) {
  if (!session || !session.messages || session.messages.length === 0) return null;

  // Build unified timeline items
  const items = [];

  session.messages.forEach((msg) => {
    if (msg.role === "system") return;

    if (msg.role === "user") {
      items.push({
        id: msg.id,
        time: new Date(msg.createdAt),
        type: "goal",
        title: "Goal received",
        content: msg.content,
      });
    } else if (msg.role === "assistant") {
      if (msg.plan && msg.plan.length > 0) {
        items.push({
          id: `${msg.id}_plan`,
          time: new Date(msg.createdAt),
          type: "plan",
          title: "Plan created",
          plan: msg.plan,
        });
      }
      if (msg.content) {
        items.push({
          id: msg.id,
          time: new Date(msg.createdAt),
          type: "diagnosis",
          title: "Agent response",
          content: msg.content,
        });
      }
    }
  });

  if (session.toolCalls) {
    session.toolCalls.forEach((tc) => {
      items.push({
        id: tc.id,
        time: new Date(tc.createdAt),
        type: "tool",
        title: tc.toolName,
        status: tc.status,
        durationMs: tc.durationMs,
        result: tc.result,
        arguments: tc.arguments,
        riskLevel: tc.riskLevel
      });
    });
  }

  if (session.pendingApprovals) {
    session.pendingApprovals.forEach((appr) => {
      items.push({
        id: appr.id,
        time: new Date(appr.createdAt),
        type: "approval",
        title: `Awaiting human approval for ${appr.toolName}`,
        approval: appr,
      });
    });
  }

  items.sort((a, b) => a.time.getTime() - b.time.getTime());

  return (
    <div className="card" style={{ padding: "1.5rem" }}>
      <h3 style={{ marginBottom: "1rem", color: "var(--text-secondary)", letterSpacing: "0.05em", textTransform: "uppercase", fontSize: "0.85rem" }}>
        Mission Timeline
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", fontFamily: "JetBrains Mono", fontSize: "0.8rem" }}>
        {items.map((item) => (
          <TimelineItem 
            key={item.id} 
            item={item} 
            onApprove={onApprove} 
            onReject={onReject} 
            processingApproval={processingApproval} 
          />
        ))}
      </div>
    </div>
  );
}

function TimelineItem({ item, onApprove, onReject, processingApproval }) {
  const [expanded, setExpanded] = useState(false);
  const timeStr = item.time.toLocaleTimeString([], { hour12: false });

  const renderStatus = () => {
    if (item.type === "tool") {
      if (item.status === "executed" || item.status === "approved") return <span style={{color: "#10b981"}}>completed</span>;
      if (item.status === "waiting_approval") return <span style={{color: "#fbbf24"}}>waiting approval</span>;
      if (item.status === "failed") return <span style={{color: "#ef4444"}}>failed</span>;
      return <span>{item.status}</span>;
    }
    return null;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", borderBottom: "1px solid var(--border-color)", paddingBottom: "0.5rem" }}>
      <div style={{ display: "flex", gap: "1.5rem", alignItems: "flex-start" }}>
        <div style={{ color: "var(--text-muted)", whiteSpace: "nowrap" }}>{timeStr}</div>
        <div style={{ flex: 1, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ color: item.type === "tool" ? "var(--accent-purple)" : "var(--text-primary)", fontWeight: 600 }}>
            {item.title}
          </div>
          <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
            {renderStatus()}
            {(item.content || item.result || item.plan || item.arguments) && (
              <button onClick={() => setExpanded(!expanded)} style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 0 }}>
                {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
            )}
          </div>
        </div>
      </div>

      {expanded && (
        <div style={{ marginLeft: "5.5rem", padding: "0.75rem", background: "rgba(0,0,0,0.2)", borderRadius: 6, fontSize: "0.75rem", overflowX: "auto" }}>
          {item.type === "goal" && <div style={{ color: "#60a5fa" }}>{item.content}</div>}
          
          {item.type === "plan" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              {item.plan.map((p) => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  {p.status === "completed" ? <CheckCircle2 size={12} color="#10b981" /> : <RefreshCw size={12} color="#3b82f6" />}
                  <span>{p.title}</span>
                </div>
              ))}
            </div>
          )}

          {item.type === "diagnosis" && (
            <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit" }}>{item.content}</pre>
          )}

          {item.type === "tool" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <div><strong>Risk:</strong> <span className="badge badge-info">{item.riskLevel}</span></div>
              <div><strong>Arguments:</strong> <code>{JSON.stringify(item.arguments)}</code></div>
              <div><strong>Result:</strong> <pre>{JSON.stringify(item.result, null, 2)}</pre></div>
            </div>
          )}
        </div>
      )}

      {item.type === "approval" && (
        <div style={{ marginLeft: "5.5rem", padding: "0.75rem", background: "rgba(245, 158, 11, 0.1)", border: "1px solid #fbbf24", borderRadius: 6 }}>
          <div style={{ marginBottom: "0.5rem", color: "#fbbf24", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <ShieldAlert size={14} /> Action Requires Approval
          </div>
          <div style={{ marginBottom: "0.5rem" }}><strong>Reason:</strong> {item.approval.reason}</div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              onClick={() => onReject(item.approval.id)}
              disabled={processingApproval === item.approval.id}
              className="btn btn-danger btn-sm"
            >
              <X size={14} /> Reject
            </button>
            <button
              onClick={() => onApprove(item.approval.id)}
              disabled={processingApproval === item.approval.id}
              className="btn btn-primary btn-sm"
              style={{ backgroundColor: "#10b981" }}
            >
              <Check size={14} /> Approve
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

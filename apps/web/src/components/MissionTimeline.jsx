import React, { useState } from "react";
import { CheckCircle2, RefreshCw, AlertTriangle, ShieldAlert, ChevronDown, ChevronRight, Check, X, Bot, User } from "lucide-react";

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
    <div className="card animate-in" style={{ padding: "1.5rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.5rem" }}>
        <Bot size={18} style={{ color: "var(--color-primary)" }} />
        <h3 style={{ color: "var(--color-text-primary)", fontWeight: 600, fontSize: "1rem" }}>
          Mission Timeline
        </h3>
      </div>
      
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {items.map((item, index) => (
          <TimelineItem 
            key={item.id} 
            item={item} 
            isLast={index === items.length - 1}
            onApprove={onApprove} 
            onReject={onReject} 
            processingApproval={processingApproval} 
          />
        ))}
      </div>
    </div>
  );
}

function TimelineItem({ item, isLast, onApprove, onReject, processingApproval }) {
  const [expanded, setExpanded] = useState(item.type === "goal" || item.type === "diagnosis" || item.type === "approval");
  const timeStr = item.time.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const renderStatus = () => {
    if (item.type === "tool") {
      if (item.status === "executed" || item.status === "approved") return <span style={{color: "var(--color-success)", fontWeight: 500, fontSize: "0.75rem"}}>Completed</span>;
      if (item.status === "waiting_approval") return <span style={{color: "var(--color-warning)", fontWeight: 500, fontSize: "0.75rem"}}>Waiting Approval</span>;
      if (item.status === "failed") return <span style={{color: "var(--color-error)", fontWeight: 500, fontSize: "0.75rem"}}>Failed</span>;
      return <span style={{fontSize: "0.75rem", color: "var(--color-text-muted)"}}>{item.status}</span>;
    }
    return null;
  };

  const getIcon = () => {
    switch (item.type) {
      case "goal": return <User size={14} />;
      case "diagnosis": return <Bot size={14} />;
      case "tool": return <RefreshCw size={14} />;
      case "plan": return <CheckCircle2 size={14} />;
      case "approval": return <ShieldAlert size={14} />;
      default: return <div style={{width: 8, height: 8, borderRadius: "50%", background: "var(--color-primary)"}}></div>;
    }
  };

  const getIconColor = () => {
    switch (item.type) {
      case "goal": return "var(--color-primary)";
      case "diagnosis": return "var(--color-tertiary)";
      case "tool": return "var(--color-text-muted)";
      case "plan": return "var(--color-success)";
      case "approval": return "var(--color-warning)";
      default: return "var(--color-text-muted)";
    }
  };

  return (
    <div style={{ position: "relative", display: "flex", gap: "1rem", paddingBottom: isLast ? "0" : "1.5rem" }}>
      {/* Timeline track */}
      {!isLast && (
        <div style={{ position: "absolute", left: "11px", top: "28px", bottom: 0, width: "2px", background: "var(--color-border-glass)" }}></div>
      )}

      {/* Icon node */}
      <div style={{ 
        width: 24, 
        height: 24, 
        borderRadius: "50%", 
        background: "var(--color-surface-elevated)", 
        border: `1px solid ${getIconColor()}`,
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center",
        color: getIconColor(),
        flexShrink: 0,
        zIndex: 2
      }}>
        {getIcon()}
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.5rem", paddingTop: "2px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", cursor: (item.content || item.result || item.plan || item.arguments) ? "pointer" : "default" }} onClick={() => setExpanded(!expanded)}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div style={{ fontWeight: 600, color: "var(--color-text-primary)", fontSize: "0.9rem" }}>
              {item.title}
            </div>
            {renderStatus()}
          </div>
          
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div className="font-mono" style={{ color: "var(--color-text-muted)", fontSize: "0.75rem" }}>{timeStr}</div>
            {(item.content || item.result || item.plan || item.arguments) && (
              <div style={{ color: "var(--color-text-muted)", display: "flex", alignItems: "center" }}>
                {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </div>
            )}
          </div>
        </div>

        {expanded && (
          <div style={{ marginTop: "0.25rem", padding: "1rem", background: "var(--color-surface-glass)", borderRadius: 8, fontSize: "0.85rem", border: "1px solid var(--color-border-glass)" }}>
            {item.type === "goal" && <div style={{ color: "var(--color-primary)", fontSize: "0.95rem" }}>{item.content}</div>}
            
            {item.type === "plan" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {item.plan.map((p) => (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    {p.status === "completed" ? <CheckCircle2 size={14} color="var(--color-success)" /> : <RefreshCw size={14} color="var(--color-primary)" />}
                    <span style={{ color: p.status === "completed" ? "var(--color-text-secondary)" : "var(--color-text-primary)" }}>{p.title}</span>
                  </div>
                ))}
              </div>
            )}

            {item.type === "diagnosis" && (
              <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", color: "var(--color-text-secondary)", lineHeight: 1.5 }}>{item.content}</pre>
            )}

            {item.type === "tool" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", fontSize: "0.8rem" }}>
                {item.riskLevel && (
                  <div>
                    <span style={{ color: "var(--color-text-muted)", marginRight: "0.5rem" }}>Risk:</span>
                    <span className="badge" style={{ background: "rgba(229, 234, 245, 0.1)" }}>{item.riskLevel}</span>
                  </div>
                )}
                
                {item.arguments && Object.keys(item.arguments).length > 0 && (
                  <div>
                    <div style={{ color: "var(--color-text-muted)", marginBottom: "0.25rem" }}>Arguments:</div>
                    <pre className="font-mono" style={{ background: "rgba(0,0,0,0.2)", padding: "0.75rem", borderRadius: 4, overflowX: "auto", color: "var(--color-text-secondary)" }}>
                      {JSON.stringify(item.arguments, null, 2)}
                    </pre>
                  </div>
                )}
                
                {item.result && (
                  <div>
                    <div style={{ color: "var(--color-text-muted)", marginBottom: "0.25rem" }}>Result:</div>
                    <pre className="font-mono" style={{ background: "rgba(0,0,0,0.2)", padding: "0.75rem", borderRadius: 4, overflowX: "auto", color: "var(--color-success)" }}>
                      {JSON.stringify(item.result, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {item.type === "approval" && (
          <div style={{ marginTop: "0.5rem", padding: "1.25rem", background: "rgba(245, 158, 11, 0.05)", border: "1px solid rgba(245, 158, 11, 0.3)", borderRadius: 8 }}>
            <div style={{ marginBottom: "0.75rem", color: "var(--color-warning)", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.95rem" }}>
              <ShieldAlert size={16} /> Human Approval Required
            </div>
            <div style={{ marginBottom: "1rem", color: "var(--color-text-secondary)", fontSize: "0.85rem", lineHeight: 1.4 }}>
              <strong>Reason:</strong> {item.approval.reason}
            </div>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button
                onClick={() => onReject(item.approval.id)}
                disabled={processingApproval === item.approval.id}
                className="btn btn-danger"
              >
                <X size={16} /> Reject
              </button>
              <button
                onClick={() => onApprove(item.approval.id)}
                disabled={processingApproval === item.approval.id}
                className="btn btn-primary"
                style={{ backgroundColor: "var(--color-success)" }}
              >
                <Check size={16} /> Approve Execution
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

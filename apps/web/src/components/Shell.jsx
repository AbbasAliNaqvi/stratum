import React from "react";
import {
  LayoutDashboard,
  Layers,
  Play,
  Calendar,
  Cpu,
  Zap,
  Activity,
  Bot,
  Settings,
  RefreshCw,
  Server
} from "lucide-react";
import { HealthBadge } from "./HealthBadge.jsx";

export function Shell({ activeTab, setActiveTab, health, onRefresh, children }) {
  const navItems = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "automations", label: "Automations", icon: Layers },
    { id: "runs", label: "Runs", icon: Play },
    { id: "schedules", label: "Schedules", icon: Calendar },
    { id: "workers", label: "Workers", icon: Cpu },
    { id: "execution", label: "Execution", icon: Zap },
    { id: "observability", label: "Observability", icon: Activity },
    { id: "agent", label: "Agent", icon: Bot },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  const currentNav = navItems.find((n) => n.id === activeTab) || navItems[0];

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "var(--bg-primary)" }}>
      {/* Sidebar Navigation */}
      <aside
        style={{
          width: 240,
          backgroundColor: "var(--bg-surface)",
          borderRight: "1px solid var(--border-color)",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
        }}
      >
        {/* Brand Header */}
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border-color)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
                fontWeight: 800,
                fontSize: "1.1rem",
              }}
            >
              S
            </div>
            <div>
              <div style={{ fontSize: "1.1rem", fontWeight: 800, letterSpacing: "-0.03em", color: "#ffffff" }}>
                STRATUM
              </div>
              <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                Control Plane V5.4
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav style={{ padding: "1rem 0.75rem", display: "flex", flexDirection: "column", gap: "0.25rem", flex: 1 }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.6rem 0.85rem",
                  borderRadius: 6,
                  fontSize: "0.875rem",
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? "#ffffff" : "var(--text-secondary)",
                  backgroundColor: isActive ? "rgba(59, 130, 246, 0.15)" : "transparent",
                  border: isActive ? "1px solid rgba(59, 130, 246, 0.3)" : "1px solid transparent",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.15s ease",
                  width: "100%",
                }}
              >
                <Icon size={18} style={{ color: isActive ? "#3b82f6" : "var(--text-muted)" }} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Footer info */}
        <div style={{ padding: "1rem", borderTop: "1px solid var(--border-color)", fontSize: "0.75rem", color: "var(--text-muted)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.25rem" }}>
            <Server size={12} />
            <span>Control Plane API</span>
          </div>
          <div style={{ fontFamily: "JetBrains Mono", fontSize: "0.68rem", color: "var(--text-secondary)", wordBreak: "break-all" }}>
            {health?.endpoint || "http://localhost:3000"}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Top Header */}
        <header
          style={{
            height: 60,
            padding: "0 1.75rem",
            backgroundColor: "rgba(17, 24, 39, 0.7)",
            backdropFilter: "blur(8px)",
            borderBottom: "1px solid var(--border-color)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "sticky",
            top: 0,
            zIndex: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <h1 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>
              {currentNav.label}
            </h1>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <HealthBadge isHealthy={health?.ok} text={health?.ok ? "System Healthy" : "Offline"} />

            <button
              onClick={onRefresh}
              className="btn btn-secondary btn-sm"
              title="Refresh data"
            >
              <RefreshCw size={14} />
              Refresh
            </button>
          </div>
        </header>

        {/* Page Container */}
        <main style={{ flex: 1, padding: "1.75rem", overflowY: "auto" }}>
          {children}
        </main>
      </div>
    </div>
  );
}

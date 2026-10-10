import React, { useState } from "react";
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
  Server,
  ToggleLeft,
  ToggleRight
} from "lucide-react";
import { HealthBadge } from "./HealthBadge.jsx";

export function Shell({ activeTab, setActiveTab, health, onRefresh, viewMode, setViewMode, children }) {
  const isSimple = viewMode === "simple";

  const simpleNavItems = [
    { id: "overview", label: "Home", icon: LayoutDashboard },
    { id: "automations", label: "Automations", icon: Layers },
    { id: "runs", label: "Run History", icon: Play },
    { id: "agent", label: "AI Assistant", icon: Bot },
  ];

  const technicalNavItems = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "automations", label: "Automations", icon: Layers },
    { id: "runs", label: "Runs", icon: Play },
    { id: "schedules", label: "Schedules", icon: Calendar },
    { id: "workers", label: "Workers", icon: Cpu },
    { id: "execution", label: "Jobs and Execution", icon: Zap },
    { id: "observability", label: "Observability", icon: Activity },
    { id: "agent", label: "AI Agent Activity", icon: Bot },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  const currentNavItems = isSimple ? simpleNavItems : technicalNavItems;
  
  // Find current tab label safely
  let currentLabel = "STRATUM";
  const foundNav = currentNavItems.find(n => n.id === activeTab);
  if (foundNav) {
    currentLabel = foundNav.label;
  } else if (activeTab === "create_automation") {
    currentLabel = "Create Automation";
  } else if (activeTab === "automation_detail") {
    currentLabel = "Automation Details";
  } else if (activeTab === "run_detail") {
    currentLabel = isSimple ? "Execution Details" : "Live Run Details";
  }

  const renderNavItem = (item) => {
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
          padding: "0.5rem 0.75rem",
          borderRadius: "6px",
          fontSize: "0.875rem",
          fontWeight: isActive ? 600 : 500,
          color: isActive ? "var(--color-primary)" : "var(--color-text-secondary)",
          backgroundColor: isActive ? "var(--color-surface-selected)" : "transparent",
          cursor: "pointer",
          textAlign: "left",
          transition: "all 0.15s ease",
          width: "100%",
          border: "none",
        }}
      >
        <Icon size={18} style={{ color: isActive ? "var(--color-primary)" : "var(--color-text-muted)" }} />
        {item.label}
      </button>
    );
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "var(--color-background)" }}>
      {/* Sidebar Navigation */}
      <aside
        style={{
          width: 250,
          backgroundColor: "var(--color-surface)",
          borderRight: "1px solid var(--color-border)",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          zIndex: 20,
        }}
      >
        {/* Brand Header */}
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--color-border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                background: "var(--color-primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
                fontWeight: 700,
                fontSize: "1rem",
              }}
            >
              S
            </div>
            <div>
              <div style={{ fontSize: "1rem", fontWeight: 700, letterSpacing: "-0.02em", color: "var(--color-text-primary)" }}>
                STRATUM
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav style={{ padding: "1rem 0.75rem", display: "flex", flexDirection: "column", gap: "0.25rem", flex: 1, overflowY: "auto" }}>
          {currentNavItems.map(renderNavItem)}
        </nav>

        {/* View Toggle */}
        <div style={{ padding: "1rem", borderTop: "1px solid var(--color-border)" }}>
          <div style={{ display: "flex", background: "var(--color-background)", padding: "0.25rem", borderRadius: "6px", border: "1px solid var(--color-border)" }}>
            <button
              onClick={() => setViewMode("simple")}
              style={{
                flex: 1,
                padding: "0.4rem",
                fontSize: "0.75rem",
                fontWeight: isSimple ? 600 : 500,
                color: isSimple ? "var(--color-text-primary)" : "var(--color-text-muted)",
                background: isSimple ? "var(--color-surface)" : "transparent",
                border: isSimple ? "1px solid var(--color-border)" : "1px solid transparent",
                borderRadius: "4px",
                boxShadow: isSimple ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
                cursor: "pointer",
                transition: "all 0.15s"
              }}
            >
              Simple
            </button>
            <button
              onClick={() => setViewMode("technical")}
              style={{
                flex: 1,
                padding: "0.4rem",
                fontSize: "0.75rem",
                fontWeight: !isSimple ? 600 : 500,
                color: !isSimple ? "var(--color-text-primary)" : "var(--color-text-muted)",
                background: !isSimple ? "var(--color-surface)" : "transparent",
                border: !isSimple ? "1px solid var(--color-border)" : "1px solid transparent",
                borderRadius: "4px",
                boxShadow: !isSimple ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
                cursor: "pointer",
                transition: "all 0.15s"
              }}
            >
              Technical
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, position: "relative" }}>
        {/* Top Header */}
        <header
          style={{
            height: 60,
            padding: "0 2rem",
            backgroundColor: "var(--color-surface)",
            borderBottom: "1px solid var(--color-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "sticky",
            top: 0,
            zIndex: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <h1 style={{ fontSize: "1.125rem", fontWeight: 600, color: "var(--color-text-primary)" }}>
              {currentLabel}
            </h1>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <HealthBadge isHealthy={health?.ok} text={health?.ok ? "Healthy" : "Needs Attention"} />

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
        <main style={{ flex: 1, padding: "2rem", overflowY: "auto" }}>
          {children}
        </main>
      </div>
    </div>
  );
}

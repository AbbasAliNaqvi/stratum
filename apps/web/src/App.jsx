import React, { useEffect, useState, useCallback } from "react";
import { Shell } from "./components/Shell.jsx";
import { Overview } from "./pages/Overview.jsx";
import { Automations } from "./pages/Automations.jsx";
import { AutomationDetail } from "./pages/AutomationDetail.jsx";
import { CreateAutomation } from "./pages/CreateAutomation.jsx";
import { Runs } from "./pages/Runs.jsx";
import { LiveRunView } from "./pages/LiveRunView.jsx";
import { Workers } from "./pages/Workers.jsx";
import { Schedules } from "./pages/Schedules.jsx";
import { Execution } from "./pages/Execution.jsx";
import { Observability } from "./pages/Observability.jsx";
import { Agent } from "./pages/Agent.jsx";
import { Settings } from "./pages/Settings.jsx";
import * as api from "./api/client.js";

export function App() {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedAutomationId, setSelectedAutomationId] = useState(null);
  const [selectedRunId, setSelectedRunId] = useState(null);

  const [health, setHealth] = useState({ ok: false, endpoint: api.getBaseUrl() });
  const [automations, setAutomations] = useState([]);
  const [runs, setRuns] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [schedules, setSchedules] = useState([]);

  const refreshAllData = useCallback(async () => {
    try {
      const hData = await api.getHealth().catch(() => null);
      setHealth({ ok: Boolean(hData?.status === "ok"), endpoint: api.getBaseUrl() });

      const [autos, rns, wkrs, jbs, schs] = await Promise.all([
        api.getAutomations().catch(() => []),
        api.getRuns().catch(() => []),
        api.getWorkers().catch(() => []),
        api.getJobs().catch(() => []),
        api.getSchedules().catch(() => []),
      ]);

      setAutomations(autos);
      setRuns(rns);
      setWorkers(wkrs);
      setJobs(jbs);
      setSchedules(schs);
    } catch (err) {
      console.error("Dashboard refresh error:", err);
    }
  }, []);

  useEffect(() => {
    refreshAllData();

    // 3-second live polling loop
    const interval = setInterval(() => {
      refreshAllData();
    }, 3000);

    return () => clearInterval(interval);
  }, [refreshAllData]);

  const handleNavigate = (tab, payloadId = null) => {
    if (tab === "automation_detail") {
      setSelectedAutomationId(payloadId);
      setActiveTab("automation_detail");
    } else if (tab === "run_detail") {
      setSelectedRunId(payloadId);
      setActiveTab("run_detail");
    } else {
      setActiveTab(tab);
    }
  };

  const handleRunAutomation = async (id) => {
    try {
      const run = await api.runAutomation(id);
      await refreshAllData();
      handleNavigate("run_detail", run.id);
    } catch (err) {
      alert(`Failed to trigger run: ${err.message}`);
    }
  };

  const handleCreateAutomation = async (data) => {
    await api.createAutomation(data);
    await refreshAllData();
    handleNavigate("automations");
  };

  const handleToggleEnableAutomation = async (id, enabled) => {
    if (enabled) {
      await api.enableAutomation(id);
    } else {
      await api.disableAutomation(id);
    }
    await refreshAllData();
  };

  const handleDeleteAutomation = async (id) => {
    if (!window.confirm("Are you sure you want to delete this automation?")) return;
    await api.deleteAutomation(id);
    await refreshAllData();
    if (activeTab === "automation_detail") handleNavigate("automations");
  };

  const handleCreateSchedule = async (data) => {
    await api.createSchedule(data);
    await refreshAllData();
  };

  const handleToggleEnableSchedule = async (id, enabled) => {
    if (enabled) {
      await api.enableSchedule(id);
    } else {
      await api.disableSchedule(id);
    }
    await refreshAllData();
  };

  const handleDeleteSchedule = async (id) => {
    if (!window.confirm("Delete this schedule?")) return;
    await api.deleteSchedule(id);
    await refreshAllData();
  };

  const currentAutomation = automations.find((a) => a.id === selectedAutomationId);

  return (
    <Shell
      activeTab={activeTab}
      setActiveTab={(tab) => handleNavigate(tab)}
      health={health}
      onRefresh={refreshAllData}
    >
      {activeTab === "overview" && (
        <Overview
          workers={workers}
          automations={automations}
          runs={runs}
          jobs={jobs}
          onNavigate={handleNavigate}
          onRunAutomation={handleRunAutomation}
        />
      )}

      {activeTab === "automations" && (
        <Automations
          automations={automations}
          onNavigate={handleNavigate}
          onRun={handleRunAutomation}
          onToggleEnable={handleToggleEnableAutomation}
          onDelete={handleDeleteAutomation}
        />
      )}

      {activeTab === "automation_detail" && (
        <AutomationDetail
          automation={currentAutomation}
          onNavigate={handleNavigate}
          onRun={handleRunAutomation}
          onToggleEnable={handleToggleEnableAutomation}
          onDelete={handleDeleteAutomation}
          onCreateSchedule={(id) => handleNavigate("schedules")}
        />
      )}

      {activeTab === "create_automation" && (
        <CreateAutomation
          onNavigate={handleNavigate}
          onCreate={handleCreateAutomation}
        />
      )}

      {activeTab === "runs" && (
        <Runs
          runs={runs}
          onSelectRun={(id) => handleNavigate("run_detail", id)}
          onRefresh={refreshAllData}
        />
      )}

      {activeTab === "run_detail" && (
        <LiveRunView
          runId={selectedRunId}
          onNavigate={handleNavigate}
        />
      )}

      {activeTab === "workers" && (
        <Workers
          workers={workers}
          jobs={jobs}
          onRefresh={refreshAllData}
        />
      )}

      {activeTab === "schedules" && (
        <Schedules
          schedules={schedules}
          automations={automations}
          onCreateSchedule={handleCreateSchedule}
          onToggleEnable={handleToggleEnableSchedule}
          onDeleteSchedule={handleDeleteSchedule}
          onRunNow={handleRunAutomation}
        />
      )}

      {activeTab === "execution" && (
        <Execution
          jobs={jobs}
          onRefresh={refreshAllData}
        />
      )}

      {activeTab === "observability" && (
        <Observability />
      )}

      {activeTab === "agent" && (
        <Agent />
      )}

      {activeTab === "settings" && (
        <Settings onUpdateUrl={refreshAllData} />
      )}
    </Shell>
  );
}

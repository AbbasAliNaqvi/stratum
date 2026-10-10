import React from "react";
import { CheckCircle2, XCircle, RefreshCw, Clock, MinusCircle } from "lucide-react";

export function StatusBadge({ status }) {
  const s = (status || "unknown").toLowerCase();

  const getTooltip = (st) => {
    switch (st) {
      case "queued": return "Waiting for a worker to pick up the task.";
      case "running": return "The workflow is currently executing.";
      case "succeeded": return "All required workflow steps completed successfully.";
      case "failed": return "The execution stopped because a required step failed.";
      case "cancelled": return "The execution was cancelled.";
      case "retrying": return "A failed attempt is being retried.";
      default: return "";
    }
  };

  const tooltip = getTooltip(s);

  if (s === "succeeded" || s === "healthy" || s === "registered" || s === "enabled") {
    return (
      <span className="badge badge-success" title={tooltip}>
        <CheckCircle2 size={12} />
        {status}
      </span>
    );
  }

  if (s === "running") {
    return (
      <span className="badge badge-info" title={tooltip}>
        <RefreshCw size={12} className="animate-spin-slow" />
        Running
      </span>
    );
  }

  if (s === "retrying") {
    return (
      <span className="badge badge-warning" title={tooltip}>
        <RefreshCw size={12} className="animate-spin-slow" />
        Retrying
      </span>
    );
  }

  if (s === "queued") {
    return (
      <span className="badge badge-secondary" title={tooltip}>
        <Clock size={12} />
        Queued
      </span>
    );
  }

  if (s === "failed" || s === "error" || s === "unreachable" || s === "disabled") {
    return (
      <span className="badge badge-danger" title={tooltip}>
        <XCircle size={12} />
        {status}
      </span>
    );
  }

  if (s === "cancelled") {
    return (
      <span className="badge badge-secondary" title={tooltip}>
        <MinusCircle size={12} />
        Cancelled
      </span>
    );
  }

  return (
    <span className="badge" title={tooltip}>
      {status}
    </span>
  );
}

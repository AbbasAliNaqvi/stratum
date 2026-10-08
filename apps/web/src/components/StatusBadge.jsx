import React from "react";
import { CheckCircle2, XCircle, RefreshCw, Clock, AlertTriangle, MinusCircle } from "lucide-react";

export function StatusBadge({ status }) {
  const s = (status || "unknown").toLowerCase();

  if (s === "succeeded" || s === "healthy" || s === "registered" || s === "enabled") {
    return (
      <span className="badge badge-success">
        <CheckCircle2 size={12} />
        {status}
      </span>
    );
  }

  if (s === "running") {
    return (
      <span className="badge badge-info">
        <RefreshCw size={12} className="animate-spin" />
        Running
      </span>
    );
  }

  if (s === "retrying") {
    return (
      <span className="badge badge-warning">
        <RefreshCw size={12} className="animate-spin" />
        Retrying
      </span>
    );
  }

  if (s === "queued") {
    return (
      <span className="badge badge-secondary">
        <Clock size={12} />
        Queued
      </span>
    );
  }

  if (s === "failed" || s === "error" || s === "unreachable") {
    return (
      <span className="badge badge-danger">
        <XCircle size={12} />
        {status}
      </span>
    );
  }

  if (s === "cancelled") {
    return (
      <span className="badge badge-secondary">
        <MinusCircle size={12} />
        Cancelled
      </span>
    );
  }

  return (
    <span className="badge badge-secondary">
      {status}
    </span>
  );
}

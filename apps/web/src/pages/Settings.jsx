import React, { useState } from "react";
import { Server, Save, CheckCircle, AlertCircle } from "lucide-react";
import { getBaseUrl, getHealth } from "../api/client.js";

export function Settings({ onUpdateUrl }) {
  const [url, setUrl] = useState(getBaseUrl());
  const [status, setStatus] = useState(null);
  const [testing, setTesting] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    setTesting(true);
    setStatus(null);

    const cleanUrl = url.trim().replace(/\/$/, "");
    try {
      localStorage.setItem("stratum_cp_url", cleanUrl);
      if (onUpdateUrl) onUpdateUrl();

      const health = await getHealth();
      setStatus({ ok: true, msg: `Connected successfully! Uptime: ${health.uptimeSeconds || 0}s` });
    } catch (err) {
      setStatus({ ok: false, msg: err.message });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Server size={20} style={{ color: "var(--accent-blue)" }} />
          <div>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 700 }}>Control Plane Connection</h2>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
              Configure the STRATUM Control Plane API URL
            </p>
          </div>
        </div>

        <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.25rem", fontWeight: 600 }}>
              STRATUM_CONTROL_PLANE_URL
            </label>
            <input
              type="url"
              className="input font-mono"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="http://localhost:3000"
              required
            />
          </div>

          {status && (
            <div
              style={{
                padding: "0.75rem 1rem",
                borderRadius: 6,
                fontSize: "0.85rem",
                background: status.ok ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)",
                border: `1px solid ${status.ok ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
                color: status.ok ? "#34d399" : "#f87171",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              {status.ok ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
              {status.msg}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button type="submit" disabled={testing} className="btn btn-primary btn-sm">
              <Save size={14} /> {testing ? "Testing..." : "Save & Test Connection"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

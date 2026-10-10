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
    <div className="animate-in" style={{ maxWidth: 700, margin: "0 auto", display: "flex", flexDirection: "column", gap: "1.5rem", paddingTop: "2rem" }}>
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: "1.5rem", padding: "2rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(160, 210, 235, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-primary)" }}>
            <Server size={20} />
          </div>
          <div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--color-text-primary)", letterSpacing: "-0.01em" }}>Control Plane Connection</h2>
            <p style={{ fontSize: "0.85rem", color: "var(--color-text-secondary)", marginTop: "0.25rem" }}>
              Configure the STRATUM Control Plane API URL
            </p>
          </div>
        </div>

        <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.85rem", color: "var(--color-text-secondary)", marginBottom: "0.5rem", fontWeight: 500 }}>
              STRATUM_CONTROL_PLANE_URL
            </label>
            <input
              type="url"
              className="input font-mono"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="http://localhost:3000"
              required
              style={{ fontSize: "0.9rem" }}
            />
          </div>

          {status && (
            <div
              style={{
                padding: "1rem",
                borderRadius: 8,
                fontSize: "0.85rem",
                background: status.ok ? "rgba(46, 204, 113, 0.1)" : "rgba(248, 113, 113, 0.1)",
                border: `1px solid ${status.ok ? "rgba(46, 204, 113, 0.2)" : "rgba(248, 113, 113, 0.2)"}`,
                color: status.ok ? "var(--color-success)" : "var(--color-error)",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              {status.ok ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
              {status.msg}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.5rem" }}>
            <button type="submit" disabled={testing} className="btn btn-primary" style={{ padding: "0.6rem 1.25rem" }}>
              <Save size={16} /> {testing ? "Testing..." : "Save & Test Connection"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

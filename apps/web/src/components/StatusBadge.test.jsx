import { describe, it, expect } from "vitest";
import React from "react";
import { StatusBadge } from "./StatusBadge.jsx";

describe("StatusBadge Component", () => {
  it("renders status badge for succeeded status", () => {
    const badge = StatusBadge({ status: "succeeded" });
    expect(badge.props.className).toContain("badge-success");
  });

  it("renders status badge for running status", () => {
    const badge = StatusBadge({ status: "running" });
    expect(badge.props.className).toContain("badge-info");
  });

  it("renders status badge for failed status", () => {
    const badge = StatusBadge({ status: "failed" });
    expect(badge.props.className).toContain("badge-danger");
  });

  it("renders status badge for queued status", () => {
    const badge = StatusBadge({ status: "queued" });
    expect(badge.props.className).toContain("badge-secondary");
  });
});

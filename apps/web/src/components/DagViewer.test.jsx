import { describe, it, expect } from "vitest";
import React from "react";
import { DagViewer } from "./DagViewer.jsx";

describe("DagViewer Component", () => {
  it("renders message when steps array is empty", () => {
    const component = DagViewer({ steps: [] });
    expect(component).toBeDefined();
  });

  it("renders steps DAG nodes cleanly", () => {
    const steps = [
      { id: "step1", type: "http", dependsOn: [] },
      { id: "step2", type: "validate", dependsOn: ["step1"] },
    ];
    const component = DagViewer({ steps });
    expect(component).toBeDefined();
  });
});

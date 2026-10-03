import { randomUUID } from "node:crypto";

export const BUILTIN_AUTOMATIONS = [
  {
    id: "api-health-monitor",
    name: "API Health Monitor",
    description: "Check an API and produce a health result.",
    inputs: [
      { name: "endpoint", label: "Endpoint", default: "http://127.0.0.1:3000/health" },
      { name: "timeout", label: "Timeout (ms)", default: "5000" },
    ],
    retryPolicy: 3,
    steps: [
      {
        id: "check-api",
        type: "http",
        payload: {
          url: "{{inputs.endpoint}}",
          method: "GET",
          timeout: "{{inputs.timeout}}",
        },
      },
      {
        id: "validate",
        type: "validate",
        dependsOn: ["check-api"],
        payload: {
          data: "{{check-api.result}}",
        },
        condition: "check-api.status == succeeded",
      },
      {
        id: "summarize",
        type: "echo",
        dependsOn: ["validate"],
        payload: {
          message: "API {{inputs.endpoint}} is healthy. Response: {{validate.result.status}}",
        },
      },
    ],
  },
  {
    id: "data-processing",
    name: "Data Processing",
    description: "Load, validate, and process data concurrently.",
    inputs: [
      { name: "source", label: "Data Source", default: "db://records" },
    ],
    retryPolicy: 3,
    steps: [
      {
        id: "load-data",
        type: "echo",
        payload: { message: "Loading data from {{inputs.source}}..." },
      },
      {
        id: "validate",
        type: "validate",
        dependsOn: ["load-data"],
        payload: { data: "Validating 1000 records" },
      },
      {
        id: "process-a",
        type: "echo",
        dependsOn: ["validate"],
        payload: { message: "Processing partition A" },
      },
      {
        id: "process-b",
        type: "sleep",
        dependsOn: ["validate"],
        payload: { durationMs: 2000 },
      },
      {
        id: "process-c",
        type: "echo",
        dependsOn: ["validate"],
        payload: { message: "Processing partition C" },
      },
      {
        id: "combine",
        type: "combine",
        dependsOn: ["process-a", "process-b", "process-c"],
        payload: { results: "Combined partitions A, B, C" },
      },
      {
        id: "generate-result",
        type: "echo",
        dependsOn: ["combine"],
        payload: { message: "Processed 1000 records successfully" },
      }
    ],
  },
  {
    id: "repo-check",
    name: "Repository Check",
    description: "Run quality checks and summarize.",
    inputs: [
      { name: "repo", label: "Repository path", default: "./" },
    ],
    retryPolicy: 1,
    steps: [
      {
        id: "run-checks",
        type: "command",
        payload: { command: "echo 'Linting {{inputs.repo}}... OK'" },
      },
      {
        id: "collect-results",
        type: "echo",
        dependsOn: ["run-checks"],
        payload: { message: "All checks passed." },
      },
      {
        id: "summarize",
        type: "echo",
        dependsOn: ["collect-results"],
        payload: { message: "Repository is clean." },
      },
    ],
  },
];

export class Automation {
  constructor(def) {
    this.id = def.id || randomUUID();
    this.name = def.name;
    this.description = def.description;
    this.version = def.version || "1.0.0";
    this.inputs = def.inputs || [];
    this.steps = def.steps || [];
    this.retryPolicy = def.retryPolicy || 0;
    this.timeoutConfig = def.timeoutConfig || "30s";
  }

  getSteps() {
    return this.steps;
  }
}

export function getAutomations() {
  return BUILTIN_AUTOMATIONS.map(def => new Automation(def));
}

export function getAutomation(id) {
  const def = BUILTIN_AUTOMATIONS.find(a => a.id === id);
  return def ? new Automation(def) : null;
}

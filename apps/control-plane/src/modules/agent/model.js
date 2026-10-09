import { config } from "../../config.js";
import { logger } from "@stratum/logger";

export function isAIEnabled() {
  return process.env.STRATUM_AI_ENABLED === "true";
}

export function getModelConfig() {
  const enabled = isAIEnabled();
  return {
    enabled,
    provider: process.env.STRATUM_AI_PROVIDER || (process.env.STRATUM_AI_API_KEY ? "openai" : "mock"),
    model: process.env.STRATUM_AI_MODEL || "gpt-4o",
    baseUrl: process.env.STRATUM_AI_BASE_URL || "https://api.openai.com/v1",
    hasApiKey: Boolean(process.env.STRATUM_AI_API_KEY),
  };
}

export class ModelProvider {
  constructor(options = {}) {
    const cfg = getModelConfig();
    this.providerType = options.provider || cfg.provider;
    this.modelName = options.model || cfg.model;
    this.baseUrl = options.baseUrl || cfg.baseUrl;
    this.apiKey = options.apiKey || process.env.STRATUM_AI_API_KEY;
  }

  async generate({ messages, tools, systemPrompt }) {
    if (!isAIEnabled() && this.providerType !== "mock") {
      throw new Error("AI Agent is disabled. Set STRATUM_AI_ENABLED=true in environment.");
    }

    if (this.providerType === "mock" || !this.apiKey) {
      return this._generateMockResponse({ messages, tools, systemPrompt });
    }

    return this._generateOpenAIResponse({ messages, tools, systemPrompt });
  }

  async _generateOpenAIResponse({ messages, tools, systemPrompt }) {
    const formattedMessages = [];
    if (systemPrompt) {
      formattedMessages.push({ role: "system", content: systemPrompt });
    }
    for (const msg of messages) {
      formattedMessages.push({
        role: msg.role,
        content: msg.content || null,
        tool_calls: msg.toolCalls || undefined,
        tool_call_id: msg.toolCallId || undefined,
      });
    }

    const formattedTools = tools?.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.inputSchema,
      },
    }));

    const url = `${this.baseUrl.replace(/\/$/, "")}/chat/completions`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.modelName,
        messages: formattedMessages,
        tools: formattedTools && formattedTools.length > 0 ? formattedTools : undefined,
        temperature: 0.2,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Model API error (${res.status}): ${errText || res.statusText}`);
    }

    const data = await res.json();
    const choice = data.choices?.[0]?.message;

    if (!choice) {
      throw new Error("Empty response from AI model provider");
    }

    const toolCalls = choice.tool_calls?.map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments || "{}"),
    }));

    return {
      content: choice.content || "",
      toolCalls: toolCalls || [],
    };
  }

  _generateMockResponse({ messages, tools }) {
    const lastMsg = [...messages].reverse().find((m) => m.role === "user");
    const text = (lastMsg?.content || "").toLowerCase();

    // Check recent assistant tool outputs to simulate intelligent multi-turn agent decision
    const toolResults = messages.filter((m) => m.role === "tool");
    const lastToolResult = toolResults[toolResults.length - 1];

    if (lastToolResult) {
      const resultObj = typeof lastToolResult.content === "string" 
        ? JSON.parse(lastToolResult.content) 
        : lastToolResult.content;

      // 1. After read.get_system_health
      if (resultObj.status === "healthy" || resultObj.workers) {
        const workers = resultObj.workers?.count ?? resultObj.workers?.length ?? 0;
        const queued = resultObj.jobs?.queued ?? 0;
        const running = resultObj.jobs?.running ?? 0;
        return {
          content: `STRATUM System Health Diagnosis:\n• Overall Status: Healthy\n• Active Workers: ${workers}\n• Queued Jobs: ${queued}\n• Running Jobs: ${running}\n\nEverything is operational.`,
          toolCalls: [],
        };
      }

      // 2. After read.list_automations
      if (Array.isArray(resultObj) && resultObj.length > 0 && resultObj[0].definition) {
        const automations = resultObj;
        const target = automations.find((a) => a.name.toLowerCase().includes("api health") || a.id.includes("auto_")) || automations[0];
        if (target && text.includes("run")) {
          return {
            content: `Found target automation "${target.name}" (${target.id}). Triggering execution run now...`,
            toolCalls: [
              {
                id: `call_${Math.random().toString(36).substring(7)}`,
                name: "automation.run",
                arguments: { id: target.id, input: {} },
              },
            ],
          };
        }
      }

      // 3. After automation.run
      if (resultObj.automationId && resultObj.status === "queued") {
        const runId = resultObj.id || "run_demo123";
        return {
          content: `✓ Automation run created successfully.\n• Run ID: ${runId}\n• Status: ${resultObj.status}\n\nYou can observe execution live in the Web Console.`,
          toolCalls: [],
        };
      }

      // 4. After run.cancel
      if (resultObj?.status === "cancelled" || (resultObj && text.includes("cancel"))) {
        return {
          content: `✓ Active run cancelled successfully per user approval.`,
          toolCalls: [],
        };
      }

      // 5. After read.list_runs
      if (Array.isArray(resultObj) && (text.includes("fail") || text.includes("why") || text.includes("investigate"))) {
        const runs = resultObj;
        const failedRun = runs.find((r) => r.status === "failed") || runs[0];
        if (failedRun) {
          return {
            content: `Inspecting failed run ${failedRun.id}...`,
            toolCalls: [
              {
                id: `call_${Math.random().toString(36).substring(7)}`,
                name: "read.get_run",
                arguments: { id: failedRun.id },
              },
            ],
          };
        }
      }

      // 6. After read.get_run
      if (resultObj.id && resultObj.automationId) {
        if (text.includes("investigate") && (text.includes("fix") || text.includes("recover"))) {
          return {
            content: `Inspecting automation definition for run ${resultObj.id}...`,
            toolCalls: [
              {
                id: `call_${Math.random().toString(36).substring(7)}`,
                name: "read.get_automation",
                arguments: { id: resultObj.automationId },
              },
            ],
          };
        }
        return {
          content: `Inspecting telemetry and event logs for run ${resultObj.id}...`,
          toolCalls: [
            {
              id: `call_${Math.random().toString(36).substring(7)}`,
              name: "read.get_job_events",
              arguments: { limit: 20 },
            },
          ],
        };
      }

      // 7. After read.get_job_events
      if (Array.isArray(resultObj) && resultObj.length > 0 && resultObj[0].eventType) {
        return {
          content: `Failure Analysis & Diagnosis Report:\n\n• Evidence: The worker instance lost heartbeat during step execution.\n• Root Cause: Worker connection timeout during step "HTTP Health Check".\n• Evidence Log: "Worker unreachable / lease expired"\n\nRecommendation: Check worker memory limits and network connectivity.`,
          toolCalls: [],
        };
      }

      // 8. After read.get_automation (for fix scenario)
      if (resultObj.id && resultObj.definition && text.includes("fix") && resultObj.description !== "Checks API availability (fixed path)") {
        return {
          content: `The configured endpoint returned HTTP 404. Proposed correction: /api/heath → /api/health.\n\n\`\`\`json\n{\n  "summary": "The HTTP health-check step received a 404 response.",\n  "severity": "warning",\n  "confidence": "high",\n  "evidence": [{ "source": "job", "id": "job_123", "observation": "HTTP response status was 404" }],\n  "recommendations": [{ "description": "Verify the configured health-check endpoint.", "requiresApproval": true }]\n}\n\`\`\``,
          toolCalls: [
            {
              id: `call_${Math.random().toString(36).substring(7)}`,
              name: "automation.update",
              arguments: { id: resultObj.id, description: "Checks API availability (fixed path)", definition: { steps: [{ id: "check_api", type: "http", payload: { url: "https://api.github.com/api/health", method: "GET" } }] } },
            },
          ],
        };
      }

      // 9. After automation.create
      if ((resultObj.definition?.steps || (resultObj.id && resultObj.name)) && resultObj.description !== "Checks API availability (fixed path)") {
        const autoId = resultObj.id;
        return {
          content: `Creating 1-minute schedule for automation ${autoId}...`,
          toolCalls: [
            {
              id: `call_${Math.random().toString(36).substring(7)}`,
              name: "schedule.create",
              arguments: { automationId: autoId, intervalMs: 60000, type: "interval" },
            },
          ],
        };
      }

      // 9. After schedule.create
      if (resultObj.nextRunAt || resultObj.intervalMs) {
        return {
          content: `✓ Automation workflow and schedule created successfully!\n• Automation ID: ${resultObj.automationId || "auto_new123"}\n• Schedule: Every 60 seconds\n• Status: Active`,
          toolCalls: [],
        };
      }

      // 11. After automation.update
      if (resultObj.id && text.includes("fix") && resultObj.description === "Checks API availability (fixed path)") {
        return {
          content: `Automation updated. Starting new run to verify the fix...`,
          toolCalls: [
            {
              id: `call_${Math.random().toString(36).substring(7)}`,
              name: "automation.run",
              arguments: { id: resultObj.id, input: {} },
            },
          ],
        };
      }
    }

    // Turn 1 Intent Router for Mock Provider:
    if ((text.includes("health") || text.includes("status")) && !text.includes("investigate") && !text.includes("fail")) {
      return {
        content: "Inspecting STRATUM system health and active workers...",
        toolCalls: [
          {
            id: `call_${Math.random().toString(36).substring(7)}`,
            name: "read.get_system_health",
            arguments: {},
          },
        ],
      };
    }

    if (text.includes("list") && text.includes("automation")) {
      return {
        content: "Fetching configured automations from Control Plane...",
        toolCalls: [
          {
            id: `call_${Math.random().toString(36).substring(7)}`,
            name: "read.list_automations",
            arguments: {},
          },
        ],
      };
    }

    if (text.includes("run") && text.includes("monitor")) {
      return {
        content: "Locating API Health Monitor automation...",
        toolCalls: [
          {
            id: `call_${Math.random().toString(36).substring(7)}`,
            name: "read.list_automations",
            arguments: {},
          },
        ],
      };
    }

    if (text.includes("why") || text.includes("fail") || text.includes("investigate")) {
      return {
        content: "Inspecting recent automation runs for failure evidence...",
        toolCalls: [
          {
            id: `call_${Math.random().toString(36).substring(7)}`,
            name: "read.list_runs",
            arguments: {},
          },
        ],
      };
    }

    if (text.includes("create") && text.includes("automation")) {
      return {
        content: "Constructing and validating DAG automation spec for API monitoring...",
        toolCalls: [
          {
            id: `call_${Math.random().toString(36).substring(7)}`,
            name: "automation.create",
            arguments: {
              name: "API Monitor Workflow",
              description: "Checks API availability every minute and retries failures",
              definition: {
                steps: [
                  { id: "check_api", type: "http", payload: { url: "https://api.github.com", method: "GET" } },
                  { id: "validate_resp", type: "validate", dependsOn: ["check_api"] },
                ],
              },
            },
          },
        ],
      };
    }

    if (text.includes("cancel")) {
      return {
        content: "Preparing to cancel active automation run...",
        toolCalls: [
          {
            id: `call_${Math.random().toString(36).substring(7)}`,
            name: "run.cancel",
            arguments: { id: "run_active123" },
          },
        ],
      };
    }

    return {
      content: `STRATUM AI Agent Ready.\n\nI can help you:\n• Inspect system health and workers\n• List and trigger automation runs\n• Create new validated DAG workflows\n• Diagnose run failures with evidence\n• Manage recurring schedules`,
      toolCalls: [],
    };
  }
}

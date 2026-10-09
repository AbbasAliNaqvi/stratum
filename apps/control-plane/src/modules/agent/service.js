import crypto from "node:crypto";
import { ModelProvider } from "./model.js";
import { toolRegistry } from "./tools.js";
import { policyEngine } from "./policy.js";
import { assembleContext, buildSystemPrompt } from "./context.js";
import * as repo from "./repository.js";
import { registry } from "@stratum/metrics";
import { startSpan, withSpanContext } from "@stratum/tracing";
import { logger } from "@stratum/logger";

// Metrics
const agentRequestsTotal = registry.counter({
  name: "stratum_agent_requests_total",
  help: "Total AI Agent requests",
});
const agentToolCallsTotal = registry.counter({
  name: "stratum_agent_tool_calls_total",
  help: "Total AI Agent tool invocations",
});
const agentToolFailuresTotal = registry.counter({
  name: "stratum_agent_tool_failures_total",
  help: "Total AI Agent tool invocation failures",
});
const agentApprovalRequestsTotal = registry.counter({
  name: "stratum_agent_approval_requests_total",
  help: "Total AI Agent policy approval requests",
});
const agentRunDuration = registry.histogram({
  name: "stratum_agent_run_duration_seconds",
  help: "AI Agent runtime loop execution duration",
});

export async function createSession(title = "New Agent Goal Session") {
  const id = `session_${crypto.randomBytes(4).toString("hex")}`;
  return await repo.createAgentSession({
    id,
    title,
    status: "active",
  });
}

export async function getSessions() {
  return await repo.findAgentSessions();
}

export async function getSession(id) {
  const session = await repo.findAgentSessionById(id);
  if (!session) return null;

  const messages = await repo.findSessionMessages(id);
  const toolCalls = await repo.findSessionToolCalls(id);
  const pendingApprovals = await repo.findPendingAgentApprovals(id);

  return {
    ...session,
    messages,
    toolCalls,
    pendingApprovals,
  };
}

export async function processUserMessage(sessionId, userContent) {
  const span = startSpan("agent.processUserMessage");
  const startTime = Date.now();
  agentRequestsTotal.inc();

  try {
    let session = await repo.findAgentSessionById(sessionId);
    if (!session) {
      session = await createSession(`Goal: ${userContent.slice(0, 30)}`);
      sessionId = session.id;
    }

    // Save user message
    const userMsgId = `msg_${crypto.randomBytes(4).toString("hex")}`;
    await repo.insertAgentMessage({
      id: userMsgId,
      sessionId,
      role: "user",
      content: userContent,
    });

    // Run agent loop
    const result = await runAgentLoop(sessionId);
    agentRunDuration.observe((Date.now() - startTime) / 1000);
    return result;
  } catch (err) {
    logger.error({ err }, "Agent runtime execution error");
    if (span) span.setStatus("error");
    throw err;
  } finally {
    if (span) span.end();
  }
}

export async function runAgentLoop(sessionId, modelOptions = {}) {
  const provider = new ModelProvider(modelOptions);
  const tools = toolRegistry.getSchemas();
  const maxIterations = 10;
  let iteration = 0;

  await repo.updateAgentSessionStatus(sessionId, "active");

  while (iteration < maxIterations) {
    iteration++;

    // Fetch full session history & build context
    const dbMessages = await repo.findSessionMessages(sessionId);
    const contextData = await assembleContext();
    const systemPrompt = buildSystemPrompt(contextData);

    const modelMessages = dbMessages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // Generate response from model
    const response = await provider.generate({
      messages: modelMessages,
      tools,
      systemPrompt,
    });

    // Construct Plan steps based on decision
    const plan = constructPlan(response, iteration);

    // Assistant response message
    const assistantMsgId = `msg_${crypto.randomBytes(4).toString("hex")}`;
    await repo.insertAgentMessage({
      id: assistantMsgId,
      sessionId,
      role: "assistant",
      content: response.content || null,
      plan,
    });

    // If no tool calls, model is finished
    if (!response.toolCalls || response.toolCalls.length === 0) {
      await repo.updateAgentSessionStatus(sessionId, "completed");
      return await getSession(sessionId);
    }

    // Execute tool calls sequentially
    for (const call of response.toolCalls) {
      agentToolCallsTotal.inc({ tool_name: call.name });

      const toolObj = toolRegistry.get(call.name);
      const riskLevel = toolObj ? toolObj.riskLevel : "SAFE";

      // 1. Policy Evaluation
      const policyRes = policyEngine.evaluate(call.name, call.arguments, riskLevel);

      const toolCallId = `tc_${crypto.randomBytes(4).toString("hex")}`;
      
      if (policyRes.requiresApproval) {
        // Create approval request record and pause execution
        agentApprovalRequestsTotal.inc({ tool_name: call.name });
        
        const approvalId = `appr_${crypto.randomBytes(4).toString("hex")}`;
        await repo.insertAgentApproval({
          id: approvalId,
          sessionId,
          toolCallId,
          toolName: call.name,
          arguments: call.arguments,
          riskLevel,
          reason: policyRes.reason,
          status: "pending",
        });

        await repo.insertAgentToolCall({
          id: toolCallId,
          sessionId,
          messageId: assistantMsgId,
          toolName: call.name,
          arguments: call.arguments,
          result: { requiresApproval: true, approvalId, reason: policyRes.reason },
          status: "waiting_approval",
          riskLevel,
        });

        await repo.updateAgentSessionStatus(sessionId, "waiting_approval");
        return await getSession(sessionId);
      }

      // 2. Execute tool
      const execRes = await toolRegistry.execute(call.name, call.arguments, { sessionId });

      if (!execRes.success) {
        agentToolFailuresTotal.inc({ tool_name: call.name });
      }

      // Save tool call audit log
      await repo.insertAgentToolCall({
        id: toolCallId,
        sessionId,
        messageId: assistantMsgId,
        toolName: call.name,
        arguments: call.arguments,
        result: execRes.result || { error: execRes.error },
        status: execRes.success ? "executed" : "failed",
        riskLevel,
        durationMs: execRes.durationMs,
      });

      // Save tool output message into conversation history for next model turn
      const toolMsgId = `msg_${crypto.randomBytes(4).toString("hex")}`;
      await repo.insertAgentMessage({
        id: toolMsgId,
        sessionId,
        role: "tool",
        content: JSON.stringify(execRes.result || { error: execRes.error }),
      });
    }
  }

  await repo.updateAgentSessionStatus(sessionId, "completed");
  return await getSession(sessionId);
}

export async function approveAction(approvalId) {
  const approval = await repo.findAgentApprovalById(approvalId);
  if (!approval || approval.status !== "pending") {
    throw new Error("Approval request not found or already processed");
  }

  await repo.updateAgentApprovalStatus(approvalId, "approved");

  // Execute approved sensitive tool call directly
  const execRes = await toolRegistry.execute(approval.toolName, approval.arguments, { sessionId: approval.sessionId });

  if (approval.toolCallId) {
    await repo.updateAgentToolCall(approval.toolCallId, {
      status: execRes.success ? "approved" : "failed",
      result: execRes.result || { error: execRes.error },
    });
  }

  // Record tool result message into history
  const toolMsgId = `msg_${crypto.randomBytes(4).toString("hex")}`;
  await repo.insertAgentMessage({
    id: toolMsgId,
    sessionId: approval.sessionId,
    role: "tool",
    content: JSON.stringify(execRes.result || { error: execRes.error }),
  });

  // Resume agent loop!
  return await runAgentLoop(approval.sessionId);
}

export async function rejectAction(approvalId, reason = "User denied action") {
  const approval = await repo.findAgentApprovalById(approvalId);
  if (!approval || approval.status !== "pending") {
    throw new Error("Approval request not found or already processed");
  }

  await repo.updateAgentApprovalStatus(approvalId, "rejected");

  if (approval.toolCallId) {
    await repo.updateAgentToolCall(approval.toolCallId, {
      status: "rejected",
      result: { rejected: true, reason },
    });
  }

  // Record rejection message into history
  const toolMsgId = `msg_${crypto.randomBytes(4).toString("hex")}`;
  await repo.insertAgentMessage({
    id: toolMsgId,
    sessionId: approval.sessionId,
    role: "tool",
    content: JSON.stringify({ error: `Policy action rejected by user: ${reason}` }),
  });

  // Resume agent loop
  return await runAgentLoop(approval.sessionId);
}

function constructPlan(response, iteration) {
  if (!response.toolCalls || response.toolCalls.length === 0) {
    return [
      { id: "1", title: "Analyze goal requirement", status: "completed" },
      { id: "2", title: "Synthesize findings & evidence", status: "completed" },
      { id: "3", title: "Formulate final response", status: "completed" },
    ];
  }

  return response.toolCalls.map((tc, idx) => ({
    id: String(idx + 1),
    title: `Execute ${tc.name} (${JSON.stringify(tc.arguments)})`,
    status: "running",
  }));
}

import {
  NodeRegisterInputSchema,
  NodeSchema
} from "@stratum/contracts";

import { registerNode, heartbeatNode } from "./service.js";
import { db } from "../../db/client.js";
import { nodes } from "../../db/schema.js";
import { eq } from "drizzle-orm";

export async function nodeRoutes(app) {
  app.get("/nodes", async () => {
    const rows = await db
      .select()
      .from(nodes);

    return {
      nodes: rows,
      count: rows.length
    };
  });
  app.get("/nodes/:nodeId", async (request, reply) => {
    const { nodeId } = request.params;

    const rows = await db
      .select()
      .from(nodes)
      .where(eq(nodes.nodeId, nodeId))
      .limit(1);

    if (rows.length === 0) {
      return reply.code(404).send({
        error: {
          code: "NODE_NOT_FOUND",
          message: `Node '${nodeId}' not found`
        }
      });
    }

    const node = rows[0];

    return NodeSchema.parse({
      ...node,
      createdAt: node.createdAt.toISOString(),
      updatedAt: node.updatedAt.toISOString()
    });
  });
  app.post("/nodes", async (request, reply) => {
    const parsed = NodeRegisterInputSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        error: {
          code: "INVALID_REQUEST",
          message: "Invalid node registration payload",
          details: parsed.error.flatten()
        }
      });
    }

    try {
      const node = await registerNode(parsed.data);

      return reply.code(201).send(
        NodeSchema.parse({
          ...node,
          createdAt: node.createdAt.toISOString(),
          updatedAt: node.updatedAt.toISOString()
        })
      );
    } catch (error) {
      if (error.code === "NODE_ALREADY_EXISTS") {
        return reply.code(409).send({
          error: {
            code: error.code,
            message: error.message
          }
        });
      }

      request.log.error(
        { err: error },
        "Node registration failed"
      );

      return reply.code(500).send({
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to register node"
        }
      });
    }
  });
  app.post("/nodes/:nodeId/heartbeat", async (request, reply) => {
    const { nodeId } = request.params;

    try {
      const node = await heartbeatNode(nodeId);

      return reply.send(
        NodeSchema.parse({
          ...node,
          createdAt: node.createdAt.toISOString(),
          updatedAt: node.updatedAt.toISOString()
        })
      );
    } catch (error) {
      if (error.code === "NODE_NOT_FOUND") {
        return reply.code(404).send({
          error: {
            code: error.code,
            message: error.message
          }
        });
      }

      request.log.error(
        { err: error },
        "Node heartbeat failed"
      );

      return reply.code(500).send({
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to process node heartbeat"
        }
      });
    }
  });
}

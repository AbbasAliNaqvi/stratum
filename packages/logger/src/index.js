import pino from "pino";
import { getActiveSpan } from "@stratum/tracing";

const isDevelopment = process.env.NODE_ENV !== "production";

const transport = isDevelopment
  ? pino.transport({
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "HH:MM:ss",
        ignore:
          "pid,hostname,service,reqId,method,url,statusCode,responseTime,traceId,spanId",
        singleLine: true
      }
    })
  : undefined;

export const logger = pino(
  {
    level: process.env.LOG_LEVEL || "info",

    base: {
      service: "stratum-control-plane"
    },

    formatters: {
      log: (object) => {
        const span = getActiveSpan();
        if (span) {
          return {
            traceId: span.traceId,
            spanId: span.spanId,
            ...object
          };
        }
        return object;
      }
    }
  },
  transport
);

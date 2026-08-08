import pino from "pino";

const isDevelopment = process.env.NODE_ENV !== "production";

const transport = isDevelopment
  ? pino.transport({
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "HH:MM:ss",
        ignore:
          "pid,hostname,service,reqId,method,url,statusCode,responseTime",
        singleLine: true
      }
    })
  : undefined;

export const logger = pino(
  {
    level: process.env.LOG_LEVEL || "info",

    base: {
      service: "stratum-control-plane"
    }
  },
  transport
);

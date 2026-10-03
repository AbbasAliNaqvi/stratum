import { getActiveSpan } from "@stratum/tracing";

const timestamp = () => new Date().toISOString();

function getTraceMeta() {
  const span = getActiveSpan();
  if (span) {
    return {
      traceId: span.traceId,
      spanId: span.spanId,
    };
  }
  return {};
}

export const logger = {
  debug(message, meta = {}) {
    console.debug(
      JSON.stringify({
        level: "debug",
        service: "stratum-worker",
        time: timestamp(),
        message,
        ...getTraceMeta(),
        ...meta,
      }),
    );
  },

  info(message, meta = {}) {
    console.log(
      JSON.stringify({
        level: "info",
        service: "stratum-worker",
        time: timestamp(),
        message,
        ...getTraceMeta(),
        ...meta,
      }),
    );
  },

  warn(message, meta = {}) {
    console.warn(
      JSON.stringify({
        level: "warn",
        service: "stratum-worker",
        time: timestamp(),
        message,
        ...getTraceMeta(),
        ...meta,
      }),
    );
  },

  error(message, meta = {}) {
    console.error(
      JSON.stringify({
        level: "error",
        service: "stratum-worker",
        time: timestamp(),
        message,
        ...getTraceMeta(),
        ...meta,
      }),
    );
  },
};

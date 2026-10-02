const timestamp = () => new Date().toISOString();

export const logger = {
  info(message, meta = {}) {
    console.log(
      JSON.stringify({
        level: "info",
        service: "stratum-worker",
        time: timestamp(),
        message,
        ...meta,
      })
    );
  },

  warn(message, meta = {}) {
    console.warn(
      JSON.stringify({
        level: "warn",
        service: "stratum-worker",
        time: timestamp(),
        message,
        ...meta,
      })
    );
  },

  error(message, meta = {}) {
    console.error(
      JSON.stringify({
        level: "error",
        service: "stratum-worker",
        time: timestamp(),
        message,
        ...meta,
      })
    );
  },
};
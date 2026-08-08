export function formatDevelopmentLog(log) {
  const time = log.time
    ? new Date(log.time).toLocaleTimeString("en-GB", {
        hour12: false
      })
    : "";

  const level = (log.level || "INFO").toUpperCase().padEnd(5);

  if (log.msg === "request completed" && log.req && log.res) {
    const method = String(log.req.method || "").padEnd(4);
    const url = String(log.req.url || "").padEnd(28);
    const status = String(log.res.statusCode || "").padEnd(3);
    const duration = log.responseTime != null
      ? `${Number(log.responseTime).toFixed(1)}ms`
      : "";

    return `${time}  ${level} HTTP   ${method} ${url} ${status} ${duration}`;
  }

  if (log.msg === "incoming request" && log.req) {
    return null;
  }

  const category = String(log.category || "SYSTEM").padEnd(8);

  return `${time}  ${level} ${category} ${log.msg || ""}`;
}

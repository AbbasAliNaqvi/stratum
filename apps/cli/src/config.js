export const config = {
  CONTROL_PLANE_URL:
    process.env.STRATUM_CONTROL_PLANE_URL ?? "http://127.0.0.1:3000",

  REQUEST_TIMEOUT_MS: Number(process.env.STRATUM_REQUEST_TIMEOUT_MS ?? 5_000),
};

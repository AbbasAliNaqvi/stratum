const line = "────────────────────────────────────────────────────────────";

export function printStartup({ host, port, database }) {
  console.log("");
  console.log(line);
  console.log("  STRATUM  │  CONTROL PLANE");
  console.log("  Distributed Backend Control Plane");
  console.log(line);
  console.log(`  ● API        http://${host}:${port}`);
  console.log(`  ● DATABASE   ${database}`);
  console.log("  ● STATUS     ONLINE");
  console.log(line);
  console.log("");
}

export function printShutdown() {
  console.log("");
  console.log(line);
  console.log("  STRATUM  │  SHUTTING DOWN");
  console.log(line);
  console.log("");
}

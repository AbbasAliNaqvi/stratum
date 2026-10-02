import { Command } from "commander";

import { createClient } from "./client.js";
import { registerJobCommands } from "./commands/job.js";
import { registerLifecycleCommands } from "./commands/lifecycle.js";
import { runDashboard } from "./interactive.js";

export function createProgram({ client } = {}) {
  const resolvedClient = client ?? createClient();

  const program = new Command();

  program
    .name("stratum")
    .description(
      "Stratum CLI — distributed backend control plane",
    )
    .version("0.1.0");

  program.action(async () => {
    // If run without arguments, open interactive dashboard
    await runDashboard(resolvedClient);
  });

  registerJobCommands(program, {
    client: resolvedClient,
  });

  registerLifecycleCommands(program, {
    client: resolvedClient,
  });

  return program;
}

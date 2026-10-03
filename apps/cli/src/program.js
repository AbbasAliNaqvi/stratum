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
    .description("Stratum CLI — distributed backend control plane")
    .version("0.1.0");

  program.action(async () => {
    // If run without arguments, open interactive dashboard
    await runDashboard(resolvedClient);
  });

  program
    .command("demo")
    .description("Run the deterministic Data Processing Pipeline demo")
    .action(async () => {
      // Import dynamically to avoid top-level dependency if not used
      const { cmdDemo } = await import("./interactive.js");
      const { Orchestrator } = await import("./orchestrator.js");
      const orchestrator = new Orchestrator(resolvedClient);
      await cmdDemo(resolvedClient, null, orchestrator);
      orchestrator.destroy();
      process.exit(0);
    });

  registerJobCommands(program, {
    client: resolvedClient,
  });

  registerLifecycleCommands(program, {
    client: resolvedClient,
  });

  return program;
}

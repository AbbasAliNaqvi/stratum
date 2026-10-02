import { Command } from "commander";

import { createClient } from "./client.js";
import { registerJobCommands } from "./commands/job.js";

export function createProgram({ client } = {}) {
  const resolvedClient = client ?? createClient();

  const program = new Command();

  program
    .name("stratum")
    .description(
      "Stratum CLI — distributed backend control plane",
    )
    .version("0.1.0");

  registerJobCommands(program, {
    client: resolvedClient,
  });

  return program;
}

#!/usr/bin/env node

import { createProgram } from "../src/program.js";
import { checkNodeVersion, getProjectRoot } from "../src/runtime.js";
import { config as loadDotenv } from "dotenv";
import { join } from "node:path";

if (!checkNodeVersion()) {
  process.exit(1);
}
loadDotenv({ path: join(getProjectRoot(), ".env") });

const program = createProgram();

program.parseAsync(process.argv);

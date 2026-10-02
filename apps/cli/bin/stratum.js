#!/usr/bin/env node

import { createProgram } from "../src/program.js";

const program = createProgram();

program.parseAsync(process.argv);

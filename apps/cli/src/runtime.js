import { spawn } from "node:child_process";
import { resolve, join, dirname } from "node:path";
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  rmSync,
  openSync,
} from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "../../..");
const RUN_DIR = join(PROJECT_ROOT, ".stratum", "run");
const LOG_DIR = join(PROJECT_ROOT, ".stratum", "logs");

export function checkNodeVersion(versions = process.versions) {
  const pkgPath = join(PROJECT_ROOT, "package.json");
  if (!existsSync(pkgPath)) return true;
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  const req = pkg.engines?.node; // e.g. ">=22"
  const match = req?.match(/>=(\d+)/);
  if (match) {
    const requiredMajor = parseInt(match[1], 10);
    const currentMajor = parseInt(versions.node.split(".")[0], 10);
    if (currentMajor < requiredMajor) {
      console.error(
        `✗ Node.js\n\nStratum requires Node.js ${requiredMajor} or newer.\nDetected: v${versions.node}\n\nPlease install/use Node.js ${requiredMajor}+ and run the command again.\n`,
      );
      return false;
    }
  }
  return true;
}

export function initRuntimeDir() {
  if (!existsSync(RUN_DIR)) {
    mkdirSync(RUN_DIR, { recursive: true });
  }
  if (!existsSync(LOG_DIR)) {
    mkdirSync(LOG_DIR, { recursive: true });
  }
}

function getPidFile(name) {
  return join(RUN_DIR, `${name}.pid`);
}

export function isServiceRunning(name) {
  const pidFile = getPidFile(name);
  if (existsSync(pidFile)) {
    const pid = parseInt(readFileSync(pidFile, "utf8"), 10);
    try {
      process.kill(pid, 0); // test signal
      return pid;
    } catch (e) {
      // Process not running, stale pid file
      rmSync(pidFile);
    }
  }
  return null;
}

export function startService(name, command, args, env = {}) {
  initRuntimeDir();
  const existingPid = isServiceRunning(name);
  if (existingPid) {
    return existingPid;
  }

  const out = openSync(join(LOG_DIR, `${name}.log`), "a");
  const err = openSync(join(LOG_DIR, `${name}.err.log`), "a");

  const child = spawn(command, args, {
    cwd: PROJECT_ROOT,
    detached: true,
    stdio: ["ignore", out, err],
    env: { ...process.env, ...env },
  });

  child.unref();
  writeFileSync(getPidFile(name), child.pid.toString());
  return child.pid;
}

export function stopService(name) {
  const pidFile = getPidFile(name);
  if (!existsSync(pidFile)) {
    return false;
  }

  const pid = parseInt(readFileSync(pidFile, "utf8"), 10);
  try {
    process.kill(pid, "SIGTERM");
  } catch (e) {
    // Already dead
  }
  rmSync(pidFile);
  return true;
}

export function getProjectRoot() {
  return PROJECT_ROOT;
}

export function getLogDir() {
  return LOG_DIR;
}

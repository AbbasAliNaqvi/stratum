/**
 * Stratum UI — shared output primitives.
 *
 * Every visual element the CLI renders funnels through here
 * so there is exactly one place to change colours, widths,
 * and degraded-terminal fallbacks.
 */

const hasColor =
  process.env.FORCE_COLOR !== "0" &&
  process.env.NO_COLOR === undefined &&
  process.stdout.isTTY;

/* ── ANSI helpers ──────────────────────────────────────── */

const ESC = "\u001b";
const esc = (code) => (hasColor ? `${ESC}[${code}m` : "");

export const c = {
  reset: esc(0),
  bold: esc(1),
  dim: esc(2),
  italic: esc(3),
  underline: esc(4),
  red: esc(31),
  green: esc(32),
  yellow: esc(33),
  blue: esc(34),
  magenta: esc(35),
  cyan: esc(36),
  white: esc(37),
  gray: esc(90),
  bgGreen: esc(42),
  bgRed: esc(41),
  bgYellow: esc(43),
  bgBlue: esc(44),
  bgCyan: esc(46),
};

export const CLEAR = hasColor ? `${ESC}[2J${ESC}[3J${ESC}[H` : "";

/* ── Symbols ───────────────────────────────────────────── */

export const sym = {
  dot: "●",
  circle: "○",
  check: "✓",
  cross: "✗",
  arrow: "›",
  dash: "─",
  pipe: "│",
  tl: "╭",
  tr: "╮",
  bl: "╰",
  br: "╯",
  spinner: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
};

/* ── Box drawing ───────────────────────────────────────── */

export function box(lines, { width = 58 } = {}) {
  const inner = width - 2;
  const out = [];
  out.push(`${c.dim}${sym.tl}${sym.dash.repeat(inner)}${sym.tr}${c.reset}`);
  for (const line of lines) {
    const stripped = stripAnsi(line);
    const pad = Math.max(0, inner - 2 - stripped.length);
    out.push(
      `${c.dim}${sym.pipe}${c.reset} ${line}${" ".repeat(pad)} ${c.dim}${sym.pipe}${c.reset}`,
    );
  }
  out.push(`${c.dim}${sym.bl}${sym.dash.repeat(inner)}${sym.br}${c.reset}`);
  return out.join("\n");
}

/* ── Strip ANSI for width calculations ─────────────────── */

export function stripAnsi(str) {
  return str.replace(
    // eslint-disable-next-line no-control-regex
    /\u001b\[[0-9;]*m/g,
    "",
  );
}

/* ── Status helpers ────────────────────────────────────── */

export function statusDot(ok) {
  return ok
    ? `${c.green}${sym.dot}${c.reset}`
    : `${c.red}${sym.circle}${c.reset}`;
}

export function statusIcon(status) {
  switch (status) {
    case "succeeded":
      return `${c.green}${sym.check}${c.reset}`;
    case "running":
      return `${c.cyan}${sym.dot}${c.reset}`;
    case "queued":
      return `${c.yellow}${sym.circle}${c.reset}`;
    case "failed":
      return `${c.red}${sym.cross}${c.reset}`;
    case "cancelled":
      return `${c.gray}${sym.cross}${c.reset}`;
    default:
      return `${c.gray}${sym.dash}${c.reset}`;
  }
}

/* ── Key-Value panel ───────────────────────────────────── */

export function kvPanel(entries) {
  let maxKey = 0;
  for (const [k] of entries) {
    if (k.length > maxKey) maxKey = k.length;
  }
  return entries
    .map(([k, v]) => `  ${c.dim}${k.padEnd(maxKey + 2)}${c.reset}${v}`)
    .join("\n");
}

/* ── Table ─────────────────────────────────────────────── */

export function table(headers, rows) {
  const widths = headers.map((h) => h.length);
  for (const row of rows) {
    row.forEach((cell, i) => {
      const len = stripAnsi(String(cell)).length;
      if (len > widths[i]) widths[i] = len;
    });
  }

  const headerLine = headers
    .map((h, i) => `${c.dim}${h.padEnd(widths[i])}${c.reset}`)
    .join("  ");
  const sepLine = widths
    .map((w) => `${c.dim}${sym.dash.repeat(w)}${c.reset}`)
    .join("  ");
  const dataLines = rows.map((row) =>
    row.map((cell, i) => String(cell).padEnd(widths[i])).join("  "),
  );

  return [headerLine, sepLine, ...dataLines].join("\n");
}

/* ── Spinner ───────────────────────────────────────────── */

export function createSpinner(message) {
  let frame = 0;
  let interval;
  return {
    start() {
      if (!hasColor) {
        process.stdout.write(`  ${message}\n`);
        return;
      }
      interval = setInterval(() => {
        const s = sym.spinner[frame % sym.spinner.length];
        process.stdout.write(`\r${c.cyan}${s}${c.reset} ${message}`);
        frame++;
      }, 80);
    },
    stop(result) {
      if (interval) clearInterval(interval);
      if (hasColor) {
        process.stdout.write(`\r${result}\u001b[K\n`);
      }
    },
  };
}

/* ── Messages ──────────────────────────────────────────── */

export function success(msg) {
  console.log(`${c.green}${sym.check}${c.reset} ${msg}`);
}

export function error(msg) {
  console.log(`${c.red}${sym.cross}${c.reset} ${msg}`);
}

export function warn(msg) {
  console.log(`${c.yellow}!${c.reset} ${msg}`);
}

export function info(msg) {
  console.log(`${c.blue}i${c.reset} ${msg}`);
}

export function heading(msg) {
  console.log(`\n${c.bold}${msg}${c.reset}\n`);
}

export function dim(msg) {
  console.log(`${c.dim}${msg}${c.reset}`);
}

/* ── Age formatting ────────────────────────────────────── */

export function timeAgo(ts) {
  if (!ts) return "—";
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 1000) return "just now";
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export function shortTime(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * Conductor Start Command
 *
 * Start the Conductor development server with smart defaults:
 * - Auto-detects dev containers and adds --host 0.0.0.0
 * - Auto-finds available port if default is in use
 * - Tracks PID for clean stop command
 *
 * Usage:
 *   ensemble conductor start              # Start with smart defaults
 *   ensemble conductor start --port 3000  # Use specific port
 *   ensemble conductor start --foreground # Run in foreground (don't detach)
 */

import {
  existsSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  unlinkSync,
} from "node:fs";
import { spawn, execSync } from "node:child_process";
import { createServer } from "node:net";
import {
  colors,
  log,
  createSpinner,
  isDevContainer,
  box,
} from "../ui/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_PORT = 8787;
const MAX_PORT_ATTEMPTS = 10;
const PID_DIR = ".conductor";
const PID_FILE = `${PID_DIR}/server.pid`;
const LOG_FILE = `${PID_DIR}/server.log`;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface StartOptions {
  port?: number;
  foreground?: boolean;
  noAutoHost?: boolean;
  persistTo?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Port Detection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if a port is available
 */
function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();

    server.once("error", () => {
      resolve(false);
    });

    server.once("listening", () => {
      server.close();
      resolve(true);
    });

    server.listen(port, "0.0.0.0");
  });
}

/**
 * Find an available port starting from the given port
 */
async function findAvailablePort(startPort: number): Promise<number> {
  for (let i = 0; i < MAX_PORT_ATTEMPTS; i++) {
    const port = startPort + i;
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(
    `Could not find an available port (tried ${startPort}-${startPort + MAX_PORT_ATTEMPTS - 1})`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Process Management
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if a process with the given PID is running
 */
function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read stored PID from file
 */
function getStoredPid(): number | null {
  try {
    if (!existsSync(PID_FILE)) {
      return null;
    }
    const content = readFileSync(PID_FILE, "utf-8").trim();
    const pid = parseInt(content, 10);
    return isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

/**
 * Write PID to file
 */
function storePid(pid: number): void {
  if (!existsSync(PID_DIR)) {
    mkdirSync(PID_DIR, { recursive: true });
  }
  writeFileSync(PID_FILE, pid.toString());
}

/**
 * Clean up stale PID file
 */
function cleanupPidFile(): void {
  try {
    if (existsSync(PID_FILE)) {
      unlinkSync(PID_FILE);
    }
  } catch {
    // Ignore errors
  }
}

/**
 * Get the wrangler command to use
 */
function getWranglerCommand(): string {
  // Check for local binary first
  if (existsSync("node_modules/.bin/wrangler")) {
    return "node_modules/.bin/wrangler";
  }
  return "npx wrangler";
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Command
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Start the Conductor development server
 */
export async function conductorStart(args: string[]): Promise<void> {
  // Parse options
  const options = parseStartOptions(args);

  // Check if this is a Conductor project
  if (!isConductorProject()) {
    log.error("Not a Conductor project (no conductor.config.ts found)");
    log.dim("Run `ensemble conductor init` to create a new project");
    process.exit(1);
  }

  // Check for existing server
  const existingPid = getStoredPid();
  if (existingPid && isProcessRunning(existingPid)) {
    log.warn(`Server already running (PID: ${existingPid})`);
    log.dim("Run `ensemble conductor stop` to stop the server");
    log.dim("Or `ensemble conductor restart` to restart it");
    process.exit(1);
  } else if (existingPid) {
    // Stale PID file - clean it up
    cleanupPidFile();
  }

  // Determine port
  const requestedPort = options.port ?? DEFAULT_PORT;
  let port: number;

  const portSpinner = createSpinner(
    `Checking port ${requestedPort}...`,
  ).start();

  try {
    if (await isPortAvailable(requestedPort)) {
      port = requestedPort;
      portSpinner.success({ text: `Port ${port} is available` });
    } else {
      portSpinner.warn({
        text: `Port ${requestedPort} is in use, finding alternative...`,
      });
      port = await findAvailablePort(requestedPort + 1);
      log.info(`Using port ${colors.accent(port.toString())} instead`);
    }
  } catch (error) {
    portSpinner.error({ text: (error as Error).message });
    process.exit(1);
  }

  // Determine host
  const inContainer = isDevContainer();
  const host = options.noAutoHost
    ? undefined
    : inContainer
      ? "0.0.0.0"
      : undefined;

  // Build wrangler command
  const wranglerCmd = getWranglerCommand();
  const wranglerArgs = ["dev"];

  if (host) {
    wranglerArgs.push("--host", host);
  }
  wranglerArgs.push("--port", port.toString());

  if (options.persistTo) {
    wranglerArgs.push("--persist-to", options.persistTo);
  }

  // Show what we're doing
  console.log("");
  console.log(box(`${colors.bold("🎼 Starting Conductor")}`));
  console.log("");

  if (inContainer && !options.noAutoHost) {
    log.info(`Detected dev container - binding to ${colors.accent("0.0.0.0")}`);
  }

  const fullCmd = wranglerCmd.includes(" ")
    ? `${wranglerCmd} ${wranglerArgs.join(" ")}`
    : `${wranglerCmd} ${wranglerArgs.join(" ")}`;

  log.dim(`Running: ${fullCmd}`);
  console.log("");

  if (options.foreground) {
    // Foreground mode - just exec wrangler
    try {
      execSync(fullCmd, {
        stdio: "inherit",
        cwd: process.cwd(),
      });
    } catch {
      // User pressed Ctrl+C or process exited
      process.exit(0);
    }
  } else {
    // Background mode - spawn and detach
    const startSpinner = createSpinner("Starting server...").start();

    try {
      // Ensure log directory exists
      if (!existsSync(PID_DIR)) {
        mkdirSync(PID_DIR, { recursive: true });
      }

      // Spawn wrangler process
      const cmdParts = wranglerCmd.split(" ");
      const child = spawn(
        cmdParts[0],
        [...cmdParts.slice(1), ...wranglerArgs],
        {
          cwd: process.cwd(),
          detached: true,
          stdio: ["ignore", "pipe", "pipe"],
          env: { ...process.env },
        },
      );

      if (!child.pid) {
        throw new Error("Failed to start server process");
      }

      // Store PID
      storePid(child.pid);

      // Wait a moment for wrangler to start or fail
      await new Promise<void>((resolve, reject) => {
        let output = "";
        let errorOutput = "";
        let resolved = false;

        const timeout = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            // If we got here without error, assume success
            resolve();
          }
        }, 3000);

        child.stdout?.on("data", (data) => {
          output += data.toString();
          // Look for success indicators
          if (output.includes("Ready on") || output.includes("Listening on")) {
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              resolve();
            }
          }
        });

        child.stderr?.on("data", (data) => {
          errorOutput += data.toString();
          // Look for "Address already in use" error (shouldn't happen with port check)
          if (errorOutput.includes("Address already in use")) {
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              reject(new Error(`Port ${port} became unavailable`));
            }
          }
        });

        child.on("error", (err) => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            reject(err);
          }
        });

        child.on("exit", (code) => {
          if (!resolved && code !== 0) {
            resolved = true;
            clearTimeout(timeout);
            reject(
              new Error(`Server exited with code ${code}: ${errorOutput}`),
            );
          }
        });
      });

      // Detach from parent
      child.unref();

      startSpinner.success({ text: "Server started" });

      // Show success info
      console.log("");
      const url =
        host === "0.0.0.0"
          ? `http://0.0.0.0:${port}`
          : `http://localhost:${port}`;
      console.log(
        `  ${colors.success("✓")} Server running at ${colors.accent(url)}`,
      );
      console.log(`  ${colors.dim("PID:")} ${child.pid}`);
      console.log("");
      console.log(colors.dim("  Commands:"));
      console.log(
        colors.dim(`    ensemble conductor stop     Stop the server`),
      );
      console.log(
        colors.dim(`    ensemble conductor status   Check server status`),
      );
      console.log("");
    } catch (error) {
      startSpinner.error({ text: (error as Error).message });
      cleanupPidFile();
      process.exit(1);
    }
  }
}

/**
 * Parse start command options
 */
function parseStartOptions(args: string[]): StartOptions {
  const options: StartOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--port" || arg === "-p") {
      const value = args[++i];
      if (value) {
        options.port = parseInt(value, 10);
        if (isNaN(options.port)) {
          log.error(`Invalid port number: ${value}`);
          process.exit(1);
        }
      }
    } else if (arg === "--foreground" || arg === "-f") {
      options.foreground = true;
    } else if (arg === "--no-auto-host") {
      options.noAutoHost = true;
    } else if (arg === "--persist-to") {
      options.persistTo = args[++i];
    }
  }

  return options;
}

/**
 * Check if current directory is a Conductor project
 */
function isConductorProject(): boolean {
  return existsSync("conductor.config.ts") || existsSync("conductor.config.js");
}

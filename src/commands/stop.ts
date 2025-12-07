/**
 * Conductor Stop Command
 *
 * Stop the Conductor development server.
 *
 * Usage:
 *   ensemble conductor stop         # Graceful stop (SIGTERM)
 *   ensemble conductor stop --force # Force stop (SIGKILL)
 */

import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { colors, log, createSpinner } from "../ui/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const PID_DIR = ".conductor";
const PID_FILE = `${PID_DIR}/server.pid`;
const GRACEFUL_TIMEOUT = 5000; // 5 seconds

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface StopOptions {
  force?: boolean;
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
 * Clean up PID file
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
 * Wait for process to exit
 */
function waitForProcessExit(pid: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      if (!isProcessRunning(pid)) {
        clearInterval(interval);
        resolve(true);
      } else if (Date.now() - startTime > timeoutMs) {
        clearInterval(interval);
        resolve(false);
      }
    }, 100);
  });
}

/**
 * Kill a process with the given signal
 */
function killProcess(pid: number, signal: NodeJS.Signals): boolean {
  try {
    process.kill(pid, signal);
    return true;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Command
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stop the Conductor development server
 */
export async function conductorStop(args: string[]): Promise<void> {
  // Parse options
  const options = parseStopOptions(args);

  // Get stored PID
  const pid = getStoredPid();

  if (!pid) {
    log.warn("No server PID file found");
    log.dim(
      "The server may not have been started with `ensemble conductor start`",
    );
    log.dim("Or it may have already been stopped");
    return;
  }

  // Check if process is running
  if (!isProcessRunning(pid)) {
    log.warn(`Server process (PID: ${pid}) is not running`);
    log.dim("Cleaning up stale PID file...");
    cleanupPidFile();
    return;
  }

  console.log("");
  log.info(
    `Stopping Conductor server (PID: ${colors.accent(pid.toString())})...`,
  );
  console.log("");

  if (options.force) {
    // Force kill immediately
    const spinner = createSpinner("Force stopping server...").start();

    if (killProcess(pid, "SIGKILL")) {
      await waitForProcessExit(pid, 1000);
      cleanupPidFile();
      spinner.success({ text: "Server force stopped" });
    } else {
      spinner.error({ text: "Failed to stop server" });
      process.exit(1);
    }
  } else {
    // Graceful shutdown
    const spinner = createSpinner("Stopping server gracefully...").start();

    // Send SIGTERM for graceful shutdown
    if (!killProcess(pid, "SIGTERM")) {
      spinner.error({ text: "Failed to send stop signal" });
      cleanupPidFile();
      process.exit(1);
    }

    // Wait for process to exit
    const exited = await waitForProcessExit(pid, GRACEFUL_TIMEOUT);

    if (exited) {
      cleanupPidFile();
      spinner.success({ text: "Server stopped" });
    } else {
      spinner.warn({
        text: "Server did not stop gracefully, force killing...",
      });

      // Force kill
      if (killProcess(pid, "SIGKILL")) {
        await waitForProcessExit(pid, 1000);
        cleanupPidFile();
        log.success("Server force stopped");
      } else {
        log.error("Failed to force stop server");
        log.dim(`Try manually: kill -9 ${pid}`);
        process.exit(1);
      }
    }
  }

  console.log("");
}

/**
 * Parse stop command options
 */
function parseStopOptions(args: string[]): StopOptions {
  const options: StopOptions = {};

  for (const arg of args) {
    if (arg === "--force" || arg === "-f") {
      options.force = true;
    }
  }

  return options;
}

/**
 * Restart the Conductor development server
 */
export async function conductorRestart(args: string[]): Promise<void> {
  // Import dynamically to avoid circular dependency
  const { conductorStart } = await import("./start.js");

  // Stop first
  await conductorStop([]);

  // Then start
  await conductorStart(args);
}

/**
 * Get server status
 */
export function getServerStatus(): { running: boolean; pid?: number } {
  const pid = getStoredPid();

  if (!pid) {
    return { running: false };
  }

  if (isProcessRunning(pid)) {
    return { running: true, pid };
  }

  // Stale PID - clean it up
  cleanupPidFile();
  return { running: false };
}

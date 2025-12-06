/**
 * Authentication Wizard
 *
 * Handles Cloudflare/Wrangler authentication:
 * - Check if user is already logged in
 * - Prompt for login if needed
 * - Run wrangler login flow
 */

import { spawn } from "node:child_process";
import {
  colors,
  log,
  createSpinner,
  promptConfirm,
  isInteractive,
} from "../ui/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface AuthWizardOptions {
  /** Skip confirmation prompts */
  yes?: boolean;
  /** Working directory for wrangler commands */
  cwd?: string;
  /** Whether to show the initial confirmation prompt */
  skipPrompt?: boolean;
}

export interface AuthWizardResult {
  /** Whether authentication was successful or already authenticated */
  success: boolean;
  /** Whether user was already logged in */
  wasAlreadyLoggedIn: boolean;
  /** Whether user skipped authentication */
  skipped: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run a command silently, capturing output
 */
async function runCommandSilent(
  command: string,
  args: string[],
  cwd?: string,
): Promise<{ success: boolean; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      stdio: "pipe",
      shell: true,
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      resolve({ success: code === 0, stdout, stderr });
    });

    child.on("error", (err) => {
      resolve({ success: false, stdout, stderr: err.message });
    });
  });
}

/**
 * Run a command with inherited stdio (visible output)
 */
async function runCommand(
  command: string,
  args: string[],
  cwd?: string,
): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      stdio: "inherit",
      shell: true,
    });

    child.on("close", (code) => {
      resolve(code === 0);
    });

    child.on("error", () => {
      resolve(false);
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth Check
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if user is logged in to Cloudflare via wrangler
 */
export async function checkWranglerAuth(cwd?: string): Promise<boolean> {
  const result = await runCommandSilent("wrangler", ["whoami"], cwd);
  return result.success && !result.stdout.includes("Not logged in");
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Wizard
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run the authentication wizard
 *
 * Used by both init (during setup) and configure auth (post-init).
 *
 * @param options - Wizard options
 * @returns Result indicating success/skip status
 */
export async function authWizard(
  options: AuthWizardOptions = {},
): Promise<AuthWizardResult> {
  const interactive = isInteractive() && !options.yes;
  const cwd = options.cwd || process.cwd();

  // Prompt for confirmation unless skipped
  if (!options.skipPrompt && interactive) {
    const shouldConfigure = await promptConfirm(
      "Configure Cloudflare authentication?",
      true,
    );

    if (!shouldConfigure) {
      log.info("Skipped. Run 'ensemble configure auth' anytime to set up.");
      return { success: true, wasAlreadyLoggedIn: false, skipped: true };
    }
  }

  // Check current auth status
  log.newline();
  const spinner = createSpinner("Checking Cloudflare auth...").start();

  const isLoggedIn = await checkWranglerAuth(cwd);

  if (isLoggedIn) {
    spinner.success({ text: "Already logged in to Cloudflare" });
    return { success: true, wasAlreadyLoggedIn: true, skipped: false };
  }

  // Not logged in - run login flow
  spinner.stop();
  log.info("Opening browser for Cloudflare login...");
  log.newline();

  const loginSuccess = await runCommand("wrangler", ["login"], cwd);

  if (loginSuccess) {
    log.success("Successfully logged in to Cloudflare");
    return { success: true, wasAlreadyLoggedIn: false, skipped: false };
  } else {
    log.warn("Login was cancelled or failed");
    log.newline();
    log.plain("You can try again anytime:");
    console.log(`  ${colors.accent("wrangler login")}`);
    console.log(`  ${colors.dim("or")}`);
    console.log(`  ${colors.accent("ensemble configure auth")}`);
    return { success: false, wasAlreadyLoggedIn: false, skipped: false };
  }
}

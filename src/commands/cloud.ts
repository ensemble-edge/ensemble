/**
 * Ensemble Cloud Commands
 *
 * Cloud connects deployed workers to Ensemble Cloud platform.
 * Architecture:
 * - Cloud reads project state via /cloud endpoint
 * - Changes are pushed through GitHub (not direct API writes)
 * - Each environment gets its own cloud key
 */

import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import {
  colors,
  log,
  banners,
  createSpinner,
  successBox,
} from "../ui/index.js";
import { showInitHints } from "../discovery.js";

interface CloudConfig {
  enabled: boolean;
  github_repo?: string;
}

/**
 * Generate a cloud key with format: eck_<env>_<random>
 */
function generateCloudKey(env: string = "live"): string {
  const random = randomBytes(24).toString("base64url");
  return `eck_${env}_${random}`;
}

/**
 * Parse environment from args (--env <env>)
 */
function parseEnv(args: string[]): string {
  const envIndex = args.indexOf("--env");
  if (envIndex !== -1 && args[envIndex + 1]) {
    return args[envIndex + 1];
  }
  return "production";
}

/**
 * Check if --yes flag is present
 */
function hasYesFlag(args: string[]): boolean {
  return args.includes("--yes") || args.includes("-y");
}

/**
 * Run a wrangler command
 */
async function runWrangler(
  args: string[],
): Promise<{ success: boolean; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn("wrangler", args, {
      shell: true,
      stdio: ["pipe", "pipe", "pipe"],
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

    child.on("error", () => {
      resolve({ success: false, stdout, stderr: "Failed to run wrangler" });
    });
  });
}

/**
 * Store a secret via wrangler
 */
async function storeSecret(
  name: string,
  value: string,
  env?: string,
): Promise<boolean> {
  const args = ["secret", "put", name];
  if (env && env !== "production") {
    args.push("--env", env);
  }

  return new Promise((resolve) => {
    const child = spawn("wrangler", args, {
      shell: true,
      stdio: ["pipe", "inherit", "inherit"],
    });

    // Write the secret value to stdin
    child.stdin?.write(value);
    child.stdin?.end();

    child.on("close", (code) => {
      resolve(code === 0);
    });

    child.on("error", () => {
      resolve(false);
    });
  });
}

/**
 * Check if wrangler.toml exists
 */
function hasWranglerConfig(): boolean {
  return existsSync("wrangler.toml") || existsSync("wrangler.json");
}

/**
 * Read wrangler.toml and check for cloud config
 */
async function readCloudConfig(): Promise<CloudConfig | null> {
  try {
    const content = await readFile("wrangler.toml", "utf-8");

    // Simple TOML parsing for [ensemble.cloud] section
    const cloudMatch = content.match(/\[ensemble\.cloud\]([\s\S]*?)(?=\n\[|$)/);
    if (!cloudMatch) {
      return null;
    }

    const section = cloudMatch[1];
    const enabled = /enabled\s*=\s*true/.test(section);
    const repoMatch = section.match(/github_repo\s*=\s*"([^"]+)"/);

    return {
      enabled,
      github_repo: repoMatch?.[1],
    };
  } catch {
    return null;
  }
}

/**
 * Add cloud config to wrangler.toml
 */
async function enableCloudConfig(githubRepo?: string): Promise<boolean> {
  try {
    let content = await readFile("wrangler.toml", "utf-8");

    // Check if [ensemble.cloud] already exists
    if (content.includes("[ensemble.cloud]")) {
      // Update existing section
      content = content.replace(
        /\[ensemble\.cloud\][\s\S]*?(?=\n\[|$)/,
        `[ensemble.cloud]\nenabled = true${githubRepo ? `\ngithub_repo = "${githubRepo}"` : ""}\n`,
      );
    } else {
      // Add new section at the end
      content += `\n# Ensemble Cloud connection\n[ensemble.cloud]\nenabled = true${githubRepo ? `\ngithub_repo = "${githubRepo}"` : ""}\n`;
    }

    await writeFile("wrangler.toml", content);
    return true;
  } catch {
    return false;
  }
}

/**
 * Disable cloud config in wrangler.toml
 */
async function disableCloudConfig(): Promise<boolean> {
  try {
    let content = await readFile("wrangler.toml", "utf-8");

    if (content.includes("[ensemble.cloud]")) {
      content = content.replace(/enabled\s*=\s*true/, "enabled = false");
      await writeFile("wrangler.toml", content);
    }

    return true;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Cloud Init
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Initialize cloud connection
 *
 * Steps:
 * 1. Generate cloud key
 * 2. Store as wrangler secret
 * 3. Enable /cloud endpoint in wrangler.toml
 */
export async function cloudInit(args: string[]): Promise<void> {
  banners.cloud();
  console.log("");

  const env = parseEnv(args);

  // Check for wrangler.toml
  if (!hasWranglerConfig()) {
    log.error("No wrangler.toml found.");
    log.dim("Run this command from your Conductor project directory.");
    return;
  }

  // Step 1: Generate Key
  console.log(colors.dim("Step 1 of 3: Generate Key"));
  const spinner1 = createSpinner("Generating cloud key...").start();

  const cloudKey = generateCloudKey(env === "production" ? "live" : env);
  spinner1.success({ text: "Generated cloud key" });

  // Step 2: Store Secret
  console.log("");
  console.log(colors.dim("Step 2 of 3: Store Secret"));
  const spinner2 = createSpinner("Storing via wrangler secret...").start();

  const stored = await storeSecret("ENSEMBLE_CLOUD_KEY", cloudKey, env);
  if (!stored) {
    spinner2.error({ text: "Failed to store secret" });
    log.dim("Make sure wrangler is authenticated: wrangler login");
    return;
  }
  spinner2.success({ text: "Stored ENSEMBLE_CLOUD_KEY" });

  // Step 3: Enable Endpoint
  console.log("");
  console.log(colors.dim("Step 3 of 3: Enable Endpoint"));
  const spinner3 = createSpinner("Enabling /cloud endpoint...").start();

  const enabled = await enableCloudConfig();
  if (!enabled) {
    spinner3.error({ text: "Failed to update wrangler.toml" });
    return;
  }
  spinner3.success({ text: "Enabled /cloud endpoint" });

  // Success summary
  console.log("");
  console.log(
    successBox(
      "Cloud connection ready!",
      `Environment: ${env}
Key: ${cloudKey.substring(0, 20)}... (first 20 chars)

To connect Ensemble Cloud:
1. Go to cloud.ensemble.ai
2. Add Project → Paste your worker URL
3. Enter the full key when prompted`,
    ),
  );

  console.log("");
  log.dim("The full key was stored as a wrangler secret.");
  log.dim("View it with: wrangler secret list");

  // Show hints about related products
  showInitHints("cloud");
}

// ─────────────────────────────────────────────────────────────────────────────
// Cloud Status
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Show cloud connection status
 */
export async function cloudStatus(args: string[]): Promise<void> {
  banners.cloud();
  console.log("");

  const env = parseEnv(args);
  const isJson = args.includes("--json");

  // Check for wrangler.toml
  if (!hasWranglerConfig()) {
    if (isJson) {
      console.log(
        JSON.stringify({ enabled: false, error: "No wrangler.toml" }),
      );
    } else {
      log.error("No wrangler.toml found.");
    }
    return;
  }

  // Read cloud config
  const config = await readCloudConfig();

  if (isJson) {
    console.log(
      JSON.stringify({
        enabled: config?.enabled ?? false,
        environment: env,
        github_repo: config?.github_repo,
      }),
    );
    return;
  }

  console.log(colors.bold("Cloud Status"));
  console.log("");
  console.log(`  Environment:  ${colors.accent(env)}`);

  if (config?.enabled) {
    console.log(`  Status:       ${colors.success("✓ Enabled")}`);
    if (config.github_repo) {
      console.log(`  GitHub Repo:  ${colors.dim(config.github_repo)}`);
    }
    console.log("");
    log.dim("Key is stored as wrangler secret ENSEMBLE_CLOUD_KEY");
    log.dim("View with: wrangler secret list");
  } else {
    console.log(`  Status:       ${colors.warning("○ Not configured")}`);
    console.log("");
    log.dim("Run `ensemble cloud init` to set up cloud connection.");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Cloud Rotate
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Rotate cloud key
 */
export async function cloudRotate(args: string[]): Promise<void> {
  banners.cloud();
  console.log("");

  const env = parseEnv(args);
  const skipConfirm = hasYesFlag(args);

  // Check for wrangler.toml
  if (!hasWranglerConfig()) {
    log.error("No wrangler.toml found.");
    return;
  }

  // Warning
  if (!skipConfirm) {
    console.log(
      colors.warning(
        "⚠️  Warning: Rotating will invalidate the old key immediately.",
      ),
    );
    console.log(
      colors.dim(
        "   You'll need to update the key in Ensemble Cloud dashboard.",
      ),
    );
    console.log("");
    console.log(colors.dim("Run with --yes to skip this confirmation."));
    return;
  }

  // Generate new key
  const spinner = createSpinner("Rotating cloud key...").start();

  const newKey = generateCloudKey(env === "production" ? "live" : env);
  const stored = await storeSecret("ENSEMBLE_CLOUD_KEY", newKey, env);

  if (!stored) {
    spinner.error({ text: "Failed to store new key" });
    return;
  }

  spinner.success({ text: "Cloud key rotated" });

  console.log("");
  console.log(colors.bold("New Key:"));
  console.log(`  ${newKey.substring(0, 20)}... (first 20 chars)`);
  console.log("");
  log.warn("Update this key in your Ensemble Cloud dashboard now!");
  log.dim("The old key no longer works.");
}

// ─────────────────────────────────────────────────────────────────────────────
// Cloud Disable
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Disable cloud connection
 */
export async function cloudDisable(args: string[]): Promise<void> {
  banners.cloud();
  console.log("");

  const env = parseEnv(args);
  const skipConfirm = hasYesFlag(args);

  // Check for wrangler.toml
  if (!hasWranglerConfig()) {
    log.error("No wrangler.toml found.");
    return;
  }

  // Warning
  if (!skipConfirm) {
    console.log(
      colors.warning("⚠️  Warning: This will disable the cloud connection."),
    );
    console.log(colors.dim("   The /cloud endpoint will return 404."));
    console.log("");
    console.log(colors.dim("Run with --yes to skip this confirmation."));
    return;
  }

  // Disable
  const spinner = createSpinner("Disabling cloud connection...").start();

  const disabled = await disableCloudConfig();
  if (!disabled) {
    spinner.error({ text: "Failed to update wrangler.toml" });
    return;
  }

  spinner.success({ text: "Cloud connection disabled" });

  console.log("");
  log.info(`Environment ${env} is now disconnected from Ensemble Cloud.`);
  log.dim("The secret key remains stored but the endpoint is disabled.");
  log.dim("Run `ensemble cloud init` to re-enable.");
}

// ─────────────────────────────────────────────────────────────────────────────
// Cloud Help
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Show cloud help
 */
export function showCloudHelp(): void {
  banners.cloud();
  console.log(colors.bold("Commands:"));
  console.log("  init            Initialize cloud connection");
  console.log("  status          Show connection status");
  console.log("  rotate          Rotate cloud key");
  console.log("  disable         Disable cloud connection");
  console.log("");
  console.log(colors.bold("Options:"));
  console.log("  --env <env>     Target environment (default: production)");
  console.log("  --yes           Skip confirmation prompts");
  console.log("  --json          Output as JSON (status only)");
  console.log("");
  console.log(colors.bold("Examples:"));
  console.log(colors.accent("  ensemble cloud init"));
  console.log(colors.accent("  ensemble cloud status"));
  console.log(colors.accent("  ensemble cloud init --env staging"));
  console.log(colors.accent("  ensemble cloud rotate --yes"));
  console.log("");
  console.log(
    colors.dim("Docs:"),
    colors.underline("https://docs.ensemble.ai/cloud"),
  );
}

/**
 * Route cloud subcommands
 */
export async function routeCloudCommand(args: string[]): Promise<void> {
  const [subCmd, ...subArgs] = args;

  if (!subCmd || subCmd === "--help" || subCmd === "-h") {
    showCloudHelp();
    return;
  }

  switch (subCmd) {
    case "init":
      await cloudInit(subArgs);
      break;
    case "status":
      await cloudStatus(subArgs);
      break;
    case "rotate":
      await cloudRotate(subArgs);
      break;
    case "disable":
      await cloudDisable(subArgs);
      break;
    default:
      log.error(`Unknown cloud command: ${subCmd}`);
      log.dim("Run `ensemble cloud --help` for available commands.");
  }
}

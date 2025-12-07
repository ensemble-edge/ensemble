/**
 * Command router for Ensemble CLI
 *
 * Routes commands to:
 * 1. Unified init wizard (no args)
 * 2. Ensemble products (conductor, edgit, chamber, cloud)
 * 3. Wrangler passthrough (everything else)
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import {
  colors,
  log,
  banners,
  promptSelect,
  isInteractive,
} from "./ui/index.js";
import { routeCloudCommand } from "./commands/cloud.js";
import {
  initWizard,
  conductorInit,
  edgitInit,
  chamberInit,
  cloudInit,
} from "./commands/init.js";
import { configure, showConfigureHelp } from "./commands/configure.js";
import {
  conductorStatus,
  showConductorHelp as conductorHelp,
} from "./commands/conductor.js";
import { edgitStatus, showEdgitHelp as edgitHelp } from "./commands/edgit.js";
import { runUpgrade, showUpgradeHelp } from "./commands/upgrade.js";

/**
 * Ensemble products - handled internally or via subprocess
 */
const ENSEMBLE_PRODUCTS = ["conductor", "chamber", "cloud", "edgit"] as const;
type EnsembleProduct = (typeof ENSEMBLE_PRODUCTS)[number];

/**
 * Check if a command is an Ensemble product
 */
function isEnsembleProduct(cmd: string): cmd is EnsembleProduct {
  return ENSEMBLE_PRODUCTS.includes(cmd as EnsembleProduct);
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI Resolution Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get the conductor CLI command to use
 *
 * Priority:
 * 1. Local binary (node_modules/.bin/conductor) - fastest, uses project's version
 * 2. npx with package name - fallback if local not available
 */
function getConductorCommand(): { cmd: string; args: string[] } {
  if (existsSync("node_modules/.bin/conductor")) {
    return { cmd: "node_modules/.bin/conductor", args: [] };
  }
  return { cmd: "npx", args: ["@ensemble-edge/conductor"] };
}

/**
 * Get the edgit CLI command to use
 *
 * Priority:
 * 1. Local binary (node_modules/.bin/edgit) - fastest, uses project's version
 * 2. npx with package name - fallback if local not available
 */
function getEdgitCommand(): { cmd: string; args: string[] } {
  if (existsSync("node_modules/.bin/edgit")) {
    return { cmd: "node_modules/.bin/edgit", args: [] };
  }
  return { cmd: "npx", args: ["edgit"] };
}

/**
 * Parse init options from args
 *
 * Supports:
 *   ensemble conductor init my-project
 *   ensemble conductor init my-project -y
 *   ensemble conductor init -y
 *   ensemble conductor init --setup full
 *   ensemble conductor init --no-examples
 */
function parseInitOptions(args: string[]): {
  yes: boolean;
  skipInstall: boolean;
  force: boolean;
  packageManager?: "npm" | "pnpm" | "yarn" | "bun";
  projectName?: string;
  setup?: "full" | "starter" | "basic";
  examples?: boolean;
} {
  // Find the first arg that isn't a flag (doesn't start with -)
  const projectName = args.find((arg) => !arg.startsWith("-"));

  // Parse --setup flag
  let setup: "full" | "starter" | "basic" | undefined;
  const setupIndex = args.findIndex((a) => a === "--setup");
  if (setupIndex !== -1 && args[setupIndex + 1]) {
    const value = args[setupIndex + 1];
    if (value === "full" || value === "starter" || value === "basic") {
      setup = value;
    }
  }

  // Parse --examples / --no-examples flags
  let examples: boolean | undefined;
  if (args.includes("--examples")) {
    examples = true;
  } else if (args.includes("--no-examples")) {
    examples = false;
  }

  // Parse --package-manager flag
  let packageManager: "npm" | "pnpm" | "yarn" | "bun" | undefined;
  const pmIndex = args.findIndex(
    (a) => a === "--package-manager" || a === "--pm",
  );
  if (pmIndex !== -1 && args[pmIndex + 1]) {
    const value = args[pmIndex + 1];
    if (
      value === "npm" ||
      value === "pnpm" ||
      value === "yarn" ||
      value === "bun"
    ) {
      packageManager = value;
    }
  }

  return {
    yes: args.includes("-y") || args.includes("--yes"),
    skipInstall: args.includes("--skip-install"),
    force: args.includes("--force") || args.includes("-f"),
    packageManager,
    projectName,
    setup,
    examples,
  };
}

/**
 * Route commands to the appropriate handler
 */
export async function route(argv: string[]): Promise<void> {
  const [cmd, ...args] = argv;

  // No command = launch the unified wizard!
  // This enables: npx @ensemble-edge/ensemble
  if (!cmd) {
    await initWizard();
    return;
  }

  // Handle configure command
  if (cmd === "configure") {
    await routeConfigure(args);
    return;
  }

  // Handle upgrade command
  if (cmd === "upgrade") {
    await routeUpgrade(args);
    return;
  }

  // Handle info/status commands - show interactive menu to select product
  // 'info' is the official command, 'status' is an alias
  if (cmd === "info" || cmd === "status") {
    await showInfoMenu(args);
    return;
  }

  // Route to appropriate handler
  if (isEnsembleProduct(cmd)) {
    await routeProduct(cmd, args);
  } else {
    // Wrangler passthrough
    await runWrangler(cmd, args);
  }
}

/**
 * Route to product-specific handler
 */
async function routeProduct(
  product: EnsembleProduct,
  args: string[],
): Promise<void> {
  const [subCmd, ...restArgs] = args;

  // Handle "init" subcommand for each product
  if (subCmd === "init") {
    const options = parseInitOptions(restArgs);

    switch (product) {
      case "conductor":
        await conductorInit(options);
        return;
      case "edgit":
        await edgitInit(options);
        return;
      case "chamber":
        await chamberInit(options);
        return;
      case "cloud":
        await cloudInit(options);
        return;
    }
  }

  // Handle other subcommands
  switch (product) {
    case "conductor":
      await runConductor(args);
      break;
    case "edgit":
      await runEdgit(args);
      break;
    case "chamber":
      await runChamber(args);
      break;
    case "cloud":
      await runCloud(args);
      break;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Product Handlers (for non-init commands)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run conductor commands (non-init)
 * Handles info/status/start/stop/restart internally, delegates others to local conductor CLI or npx
 *
 * Command Naming:
 * - `info` is the official command (matches Conductor CLI)
 * - `status` is an alias for user convenience
 * - `start`/`stop`/`restart` for dev server management
 * - `dev` is an alias for `start`
 */
async function runConductor(args: string[]): Promise<void> {
  const [subCmd, ...subArgs] = args;

  // Show help if no subcommand
  if (!subCmd || subCmd === "--help" || subCmd === "-h") {
    conductorHelp();
    return;
  }

  // Handle info/status command internally
  // Both 'info' and 'status' call the same function
  if (subCmd === "info" || subCmd === "status") {
    await conductorStatus(subArgs);
    return;
  }

  // Handle start/dev command internally (smart dev server start)
  if (subCmd === "start" || subCmd === "dev") {
    const { conductorStart } = await import("./commands/start.js");
    await conductorStart(subArgs);
    return;
  }

  // Handle stop command internally
  if (subCmd === "stop") {
    const { conductorStop } = await import("./commands/stop.js");
    await conductorStop(subArgs);
    return;
  }

  // Handle restart command internally
  if (subCmd === "restart") {
    const { conductorRestart } = await import("./commands/stop.js");
    await conductorRestart(subArgs);
    return;
  }

  // Delegate other commands to conductor CLI (use local binary if available)
  const conductorCmd = getConductorCommand();
  await spawnCommand(conductorCmd.cmd, [...conductorCmd.args, ...args], {
    notFoundMessage:
      "Conductor not found. Run 'ensemble conductor init' to create a project.",
  });
}

/**
 * Run edgit commands (non-init)
 * Handles info internally, passes status through to git, delegates others to edgit CLI
 *
 * Command Naming:
 * - `info` shows Edgit project info (official command, matches Edgit CLI)
 * - `status` passes through to git (since edgit is git-native, status = git status)
 */
async function runEdgit(args: string[]): Promise<void> {
  const [subCmd, ...subArgs] = args;

  // Show help if no subcommand
  if (!subCmd || subCmd === "--help" || subCmd === "-h") {
    edgitHelp();
    return;
  }

  // Handle info command internally (shows Edgit project info)
  if (subCmd === "info") {
    await edgitStatus(subArgs);
    return;
  }

  // Handle status command - passthrough to git
  // Since edgit is git-native, `ensemble edgit status` should show git status
  if (subCmd === "status") {
    await spawnCommand("git", ["status", ...subArgs], {
      notFoundMessage: "Git not found. Make sure Git is installed.",
    });
    return;
  }

  // Delegate other commands to edgit CLI (use local binary if available)
  const edgitCmd = getEdgitCommand();
  await spawnCommand(edgitCmd.cmd, [...edgitCmd.args, ...args], {
    notFoundMessage:
      "Edgit not found. Run 'ensemble edgit init' to create a project.",
  });
}

/**
 * Run chamber commands
 */
async function runChamber(_args: string[]): Promise<void> {
  banners.chamber();
  console.log(`${colors.bold("Edge Data Lake")} ${colors.dim("(coming soon)")}

Chamber is a KV-first distributed database that uses edge cache as
an accelerator. It provides durability by default while delivering
sub-millisecond read performance globally.

${colors.dim("┌─────────────────────────────────────────────────────────────┐")}
${colors.dim("│")} Edge cache as PRIMARY storage, not just a cache layer.       ${colors.dim("│")}
${colors.dim("│")} A memory-first distributed database that happens to have    ${colors.dim("│")}
${colors.dim("│")} persistence, not a persistent database with caching.        ${colors.dim("│")}
${colors.dim("└─────────────────────────────────────────────────────────────┘")}

Built as a specialized configuration of Conductor, Chamber treats data
as a living organism that spreads naturally across Cloudflare's 300+
edge locations based on access patterns.

${colors.bold("Planned Features:")}
  • Sub-millisecond reads at 300+ global locations
  • Automatic data replication based on access patterns
  • KV-first with optional SQL semantics
  • Built on Cloudflare KV, D1, and Durable Objects

${colors.dim("Docs:")} ${colors.underline("https://docs.ensemble.ai/chamber")}
`);
}

/**
 * Run cloud commands - delegates to cloud module
 */
async function runCloud(args: string[]): Promise<void> {
  await routeCloudCommand(args);
}

// ─────────────────────────────────────────────────────────────────────────────
// Info/Status Menu
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Show interactive menu for `ensemble info` / `ensemble status`
 *
 * Both commands work identically - shows a menu to select which product
 * to show info for (Conductor, Edgit, or Cloud).
 *
 * Command Naming:
 * - `ensemble info` is the official command
 * - `ensemble status` is an alias for user convenience
 */
async function showInfoMenu(args: string[]): Promise<void> {
  const isJson = args.includes("--json");
  const isCompact = args.includes("--compact");

  // Non-interactive mode: show help
  if (!isInteractive()) {
    console.log(`
${colors.bold("Ensemble Info")}

Show project info for an Ensemble product.

${colors.bold("Usage:")}
  ensemble info                    Interactive product selection
  ensemble conductor info          Show Conductor project info
  ensemble edgit info              Show Edgit project info
  ensemble cloud info              Show Cloud account info

${colors.bold("Options:")}
  --json            Output as JSON
  --compact         Compact single-line format

${colors.bold("Aliases:")}
  ensemble status                  Alias for 'ensemble info'
  ensemble conductor status        Alias for 'ensemble conductor info'
`);
    return;
  }

  // Show banner
  banners.ensemble();
  console.log("");

  // Interactive menu
  const product = await promptSelect<"conductor" | "edgit" | "cloud">(
    "Which product would you like to see info for?",
    [
      {
        value: "conductor",
        title: "Conductor",
        description: "AI agent orchestration",
      },
      {
        value: "edgit",
        title: "Edgit",
        description: "Git-native component versioning",
      },
      {
        value: "cloud",
        title: "Cloud",
        description: "Ensemble Cloud account",
      },
    ],
  );

  console.log("");

  // Build args for the info command
  const infoArgs: string[] = [];
  if (isJson) infoArgs.push("--json");
  if (isCompact) infoArgs.push("--compact");

  // Route to the appropriate info command
  switch (product) {
    case "conductor":
      await conductorStatus(infoArgs);
      break;
    case "edgit":
      await edgitStatus(infoArgs);
      break;
    case "cloud":
      await routeCloudCommand(["info", ...infoArgs]);
      break;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Upgrade Command
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Route upgrade command
 */
async function routeUpgrade(args: string[]): Promise<void> {
  // Show help
  if (args.includes("--help") || args.includes("-h")) {
    showUpgradeHelp();
    return;
  }

  // Parse options
  const options = {
    all: args.includes("--all") || args.includes("-a"),
    yes: args.includes("--yes") || args.includes("-y"),
    dryRun: args.includes("--dry-run"),
    global: args.includes("--global") || args.includes("-g"),
  };

  await runUpgrade(options);
}

// ─────────────────────────────────────────────────────────────────────────────
// Configure Command
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Route configure subcommands
 */
async function routeConfigure(args: string[]): Promise<void> {
  const [subCmd, ...restArgs] = args;

  // Show help
  if (subCmd === "--help" || subCmd === "-h") {
    showConfigureHelp();
    return;
  }

  // Parse options
  const options = {
    yes: restArgs.includes("-y") || restArgs.includes("--yes"),
    provider: parseProvider(restArgs),
  };

  // Route to configure handler
  await configure(subCmd, options);
}

/**
 * Parse --provider flag
 */
function parseProvider(
  args: string[],
): "anthropic" | "openai" | "cloudflare" | undefined {
  const providerIndex = args.findIndex((a) => a === "--provider");
  if (providerIndex !== -1 && args[providerIndex + 1]) {
    const provider = args[providerIndex + 1];
    if (
      provider === "anthropic" ||
      provider === "openai" ||
      provider === "cloudflare"
    ) {
      return provider;
    }
  }
  return undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// Passthrough Handlers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run wrangler command (passthrough)
 */
async function runWrangler(cmd: string, args: string[]): Promise<void> {
  await spawnCommand("wrangler", [cmd, ...args], {
    notFoundMessage:
      "Wrangler not found.\nInstall: npm install -g wrangler\nOr: npm install wrangler",
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

interface SpawnOptions {
  notFoundMessage?: string;
}

/**
 * Spawn a command with proper error handling
 */
async function spawnCommand(
  command: string,
  args: string[],
  options: SpawnOptions = {},
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: true,
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        // Don't reject on non-zero - let the child's error messages show
        resolve();
      }
    });

    child.on("error", (err) => {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        console.log("");
        log.error(options.notFoundMessage ?? `Command not found: ${command}`);
        console.log("");
      }
      reject(err);
    });
  });
}

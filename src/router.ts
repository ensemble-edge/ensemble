/**
 * Command router for Ensemble CLI
 *
 * Routes commands to:
 * 1. Ensemble products (conductor, edgit, chamber, cloud)
 * 2. Global commands (login, config)
 * 3. Wrangler passthrough (everything else)
 */

import { spawn } from "node:child_process";
import { colors, log, banners } from "./ui/index.js";

/**
 * Ensemble products - handled internally or via subprocess
 */
const ENSEMBLE_PRODUCTS = ["conductor", "chamber", "cloud", "edgit"] as const;
type EnsembleProduct = (typeof ENSEMBLE_PRODUCTS)[number];

/**
 * Global ensemble commands
 */
const ENSEMBLE_GLOBAL = ["login", "config"] as const;
type EnsembleGlobal = (typeof ENSEMBLE_GLOBAL)[number];

/**
 * Check if a command is an Ensemble product
 */
function isEnsembleProduct(cmd: string): cmd is EnsembleProduct {
  return ENSEMBLE_PRODUCTS.includes(cmd as EnsembleProduct);
}

/**
 * Check if a command is a global Ensemble command
 */
function isEnsembleGlobal(cmd: string): cmd is EnsembleGlobal {
  return ENSEMBLE_GLOBAL.includes(cmd as EnsembleGlobal);
}

/**
 * Route commands to the appropriate handler
 */
export async function route(argv: string[]): Promise<void> {
  const [cmd, ...args] = argv;

  if (!cmd) {
    log.dim("No command provided. Run `ensemble --help` for usage.");
    return;
  }

  // Route to appropriate handler
  if (isEnsembleProduct(cmd)) {
    await routeProduct(cmd, args);
  } else if (isEnsembleGlobal(cmd)) {
    await routeGlobal(cmd, args);
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

/**
 * Route to global command handler
 */
async function routeGlobal(cmd: EnsembleGlobal, args: string[]): Promise<void> {
  switch (cmd) {
    case "login":
      await runLogin(args);
      break;
    case "config":
      await runConfig(args);
      break;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Product Handlers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run conductor commands
 */
async function runConductor(args: string[]): Promise<void> {
  // Show help if no subcommand
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    banners.conductor();
    console.log(colors.bold("Commands:"));
    console.log("  init [name]     Initialize a new Conductor project");
    console.log("  dev             Start development server (wrangler dev)");
    console.log("  deploy          Deploy to production (wrangler deploy)");
    console.log("  validate        Validate project configuration");
    console.log("  keys            Manage API keys");
    console.log("");
    console.log(colors.bold("Examples:"));
    console.log(colors.accent("  ensemble conductor init my-project"));
    console.log(colors.accent("  ensemble conductor dev"));
    console.log("");
    console.log(
      colors.dim("Docs:"),
      colors.underline("https://docs.ensemble.ai/conductor"),
    );
    return;
  }

  const [subCmd, ...subArgs] = args;

  switch (subCmd) {
    case "init":
      // TODO: Implement conductor init
      log.warn("conductor init coming soon...");
      log.dim("For now, use: npx @ensemble-edge/conductor init");
      break;
    case "dev":
      // Passthrough to wrangler dev
      await runWrangler("dev", subArgs);
      break;
    case "deploy":
      // Passthrough to wrangler deploy
      await runWrangler("deploy", subArgs);
      break;
    case "validate":
      log.warn("conductor validate coming soon...");
      break;
    case "keys":
      log.warn("conductor keys coming soon...");
      break;
    default:
      // Try to passthrough to conductor CLI
      await spawnCommand("conductor", args, {
        notFoundMessage:
          "Conductor CLI not found.\nInstall: npm install -g @ensemble-edge/conductor",
      });
  }
}

/**
 * Run edgit commands
 */
async function runEdgit(args: string[]): Promise<void> {
  // Show help if no subcommand
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    banners.edgit();
    console.log(colors.bold("Commands:"));
    console.log("  init            Initialize edgit in current repo");
    console.log("  tag             Create and manage version tags");
    console.log("  components      Manage tracked components");
    console.log("  deploy          Manage deployments");
    console.log("  history         View version history");
    console.log("");
    console.log(colors.bold("Git Passthrough:"));
    console.log("  All git commands work directly (commit, push, pull, etc.)");
    console.log("");
    console.log(colors.bold("Examples:"));
    console.log(colors.accent("  ensemble edgit init"));
    console.log(colors.accent("  ensemble edgit tag create prompt v1.0.0"));
    console.log(colors.accent("  ensemble edgit deploy set prompt prod"));
    console.log("");
    console.log(
      colors.dim("Docs:"),
      colors.underline("https://docs.ensemble.ai/edgit"),
    );
    return;
  }

  // Passthrough to edgit CLI
  await spawnCommand("edgit", args, {
    notFoundMessage: "Edgit CLI not found.\nInstall: npm install -g edgit",
  });
}

/**
 * Run chamber commands
 */
async function runChamber(args: string[]): Promise<void> {
  // Show help if no subcommand
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    banners.chamber();
    console.log(colors.bold("Commands:"));
    console.log("  init            Initialize Chamber in project");
    console.log("  status          Show cache status");
    console.log("");
    console.log(colors.warning("Chamber is coming soon!"));
    console.log("");
    console.log(
      colors.dim("Docs:"),
      colors.underline("https://docs.ensemble.ai/chamber"),
    );
    return;
  }

  log.warn("Chamber commands coming soon...");
}

/**
 * Run cloud commands
 */
async function runCloud(args: string[]): Promise<void> {
  // Show help if no subcommand
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    banners.cloud();
    console.log(colors.bold("Commands:"));
    console.log("  init            Initialize cloud connection");
    console.log("  status          Show connection status");
    console.log("  rotate          Rotate cloud key");
    console.log("  disable         Disable cloud connection");
    console.log("");
    console.log(colors.bold("Examples:"));
    console.log(colors.accent("  ensemble cloud init"));
    console.log(colors.accent("  ensemble cloud status"));
    console.log(colors.accent("  ensemble cloud init --env staging"));
    console.log("");
    console.log(
      colors.dim("Docs:"),
      colors.underline("https://docs.ensemble.ai/cloud"),
    );
    return;
  }

  const [subCmd, ...subArgs] = args;

  switch (subCmd) {
    case "init":
      // TODO: Implement cloud init
      log.warn("cloud init coming soon...");
      break;
    case "status":
      log.warn("cloud status coming soon...");
      break;
    case "rotate":
      log.warn("cloud rotate coming soon...");
      break;
    case "disable":
      log.warn("cloud disable coming soon...");
      break;
    default:
      log.error(`Unknown cloud command: ${subCmd}`);
      log.dim("Run `ensemble cloud --help` for available commands.");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Global Command Handlers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run login command
 */
async function runLogin(_args: string[]): Promise<void> {
  log.warn("Login command coming soon...");
  log.dim("For Cloudflare auth, run: wrangler login");
}

/**
 * Run config command
 */
async function runConfig(_args: string[]): Promise<void> {
  log.warn("Config command coming soon...");
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

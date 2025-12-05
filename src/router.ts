/**
 * Command router for Ensemble CLI
 *
 * Routes commands to:
 * 1. Unified init wizard (no args)
 * 2. Ensemble products (conductor, edgit, chamber, cloud)
 * 3. Wrangler passthrough (everything else)
 */

import { spawn } from "node:child_process";
import { colors, log, banners } from "./ui/index.js";
import { routeCloudCommand } from "./commands/cloud.js";
import {
  initWizard,
  conductorInit,
  edgitInit,
  chamberInit,
  cloudInit,
} from "./commands/init.js";

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

/**
 * Parse init options from args
 */
function parseInitOptions(args: string[]): {
  yes: boolean;
  skipInstall: boolean;
  packageManager?: "npm" | "pnpm" | "yarn" | "bun";
} {
  return {
    yes: args.includes("-y") || args.includes("--yes"),
    skipInstall: args.includes("--skip-install"),
    packageManager: undefined, // Could parse --package-manager
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
 * Delegates to local conductor CLI if installed, or npx
 */
async function runConductor(args: string[]): Promise<void> {
  // Show help if no subcommand
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    showConductorHelp();
    return;
  }

  // Delegate to conductor CLI
  await spawnCommand("npx", ["@ensemble-edge/conductor", ...args], {
    notFoundMessage:
      "Conductor not found. Run 'ensemble conductor init' to create a project.",
  });
}

/**
 * Show conductor help
 */
function showConductorHelp(): void {
  banners.conductor();
  console.log(`${colors.bold("Commands:")}
  init            Create a new Conductor project
  dev             Start development server
  deploy          Deploy to production
  validate        Validate configuration
  exec            Execute agents
  docs            Generate API documentation
  test            Run tests

${colors.bold("Examples:")}
  ${colors.accent("npx @ensemble-edge/ensemble")}
  ${colors.accent("ensemble conductor init my-project")}
  ${colors.accent("npm run dev")}

${colors.dim("Docs:")} ${colors.underline("https://docs.ensemble.ai/conductor")}
`);
}

/**
 * Run edgit commands
 */
async function runEdgit(args: string[]): Promise<void> {
  // Show help if no subcommand
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    banners.edgit();
    console.log(`${colors.bold("Commands:")}
  init            Create a new Edgit project
  tag             Manage component versions
  deploy          Deploy components

${colors.bold("Examples:")}
  ${colors.accent("npx @ensemble-edge/ensemble")}
  ${colors.accent("ensemble edgit tag create prompt v1.0.0")}

${colors.dim("Docs:")} ${colors.underline("https://docs.ensemble.ai/edgit")}
`);
    return;
  }

  // Delegate to edgit CLI
  await spawnCommand("npx", ["edgit", ...args], {
    notFoundMessage:
      "Edgit not found. Run 'ensemble edgit init' to create a project.",
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
 * Run cloud commands - delegates to cloud module
 */
async function runCloud(args: string[]): Promise<void> {
  await routeCloudCommand(args);
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

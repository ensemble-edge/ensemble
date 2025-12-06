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
import { configure, showConfigureHelp } from "./commands/configure.js";

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
  init [name]     Create a new Conductor project
  dev             Start development server
  deploy          Deploy to production
  validate        Validate configuration
  exec            Execute agents
  docs            Generate API documentation
  test            Run tests

${colors.bold("Init Options:")}
  --setup <type>  Project setup: full, starter, basic (default: full)
  --examples      Include example agents & ensembles (same as --setup full)
  --no-examples   Template only, no examples (same as --setup starter)
  --skip-install  Skip npm install
  --pm <manager>  Package manager: npm, pnpm, yarn, bun
  -f, --force     Overwrite existing directory
  -y, --yes       Use defaults, skip prompts

${colors.bold("Setup Types:")}
  full     Template + example agents & ensembles (recommended)
  starter  Ready to code, no examples
  basic    Minimal stub for manual setup

${colors.bold("Examples:")}
  ${colors.accent("npx @ensemble-edge/ensemble")}
  ${colors.accent("ensemble conductor init my-project")}
  ${colors.accent("ensemble conductor init --setup starter")}
  ${colors.accent("ensemble conductor init --no-examples")}
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
  init [name]     Create a new Edgit project
  tag             Manage component versions
  deploy          Deploy components

${colors.bold("Examples:")}
  ${colors.accent("npx @ensemble-edge/ensemble")}
  ${colors.accent("ensemble edgit init my-project")}
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

/**
 * Unified Init Wizard
 *
 * Entry point for: npx @ensemble-edge/ensemble
 *
 * Flow:
 * 1. Product selection (Conductor/Edgit/Chamber/Cloud)
 * 2. Project name
 * 3. Create directory + package.json with product as dependency
 * 4. npm install
 * 5. Run product's init (now local, fast)
 * 6. Product-specific optional wizards
 */

import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import {
  colors,
  log,
  banners,
  createSpinner,
  promptConfirm,
  promptText,
  promptSelect,
  isInteractive,
  isCI,
} from "../ui/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type Product = "conductor" | "edgit" | "chamber" | "cloud";
type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

interface InitOptions {
  yes?: boolean;
  skipInstall?: boolean;
  packageManager?: PackageManager;
}

// ─────────────────────────────────────────────────────────────────────────────
// Product Configuration
// ─────────────────────────────────────────────────────────────────────────────

const PRODUCTS: Record<
  Product,
  {
    name: string;
    description: string;
    package: string;
    available: boolean;
  }
> = {
  conductor: {
    name: "Conductor",
    description: "AI workflow orchestration",
    package: "@ensemble-edge/conductor",
    available: true,
  },
  edgit: {
    name: "Edgit",
    description: "Component versioning",
    package: "@ensemble-edge/edgit",
    available: true,
  },
  chamber: {
    name: "Chamber",
    description: "Edge data lake",
    package: "@ensemble-edge/chamber",
    available: false,
  },
  cloud: {
    name: "Ensemble Cloud",
    description: "Managed platform",
    package: "@ensemble-edge/cloud",
    available: true,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Package Manager Detection
// ─────────────────────────────────────────────────────────────────────────────

function detectPackageManager(): PackageManager {
  // Check for lockfiles in current directory
  if (existsSync("pnpm-lock.yaml")) return "pnpm";
  if (existsSync("yarn.lock")) return "yarn";
  if (existsSync("bun.lockb")) return "bun";
  if (existsSync("package-lock.json")) return "npm";

  // Check npm_config_user_agent for how the command was invoked
  const userAgent = process.env.npm_config_user_agent || "";
  if (userAgent.includes("yarn")) return "yarn";
  if (userAgent.includes("bun")) return "bun";
  if (userAgent.includes("npm")) return "npm";

  // Default to pnpm (recommended for Ensemble projects)
  return "pnpm";
}

// ─────────────────────────────────────────────────────────────────────────────
// Spawn Helper
// ─────────────────────────────────────────────────────────────────────────────

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
// Create Project
// ─────────────────────────────────────────────────────────────────────────────

async function createProject(
  projectName: string,
  product: Product,
  pm: PackageManager,
): Promise<string> {
  const targetDir = resolve(process.cwd(), projectName);

  // Create directory
  if (!existsSync(targetDir)) {
    await mkdir(targetDir, { recursive: true });
  }

  // Create package.json with product as dependency
  const productConfig = PRODUCTS[product];
  const packageJson = {
    name: projectName,
    version: "0.0.1",
    type: "module",
    scripts: {
      dev: "wrangler dev",
      deploy: "wrangler deploy",
      test: "vitest run",
    },
    dependencies: {
      [productConfig.package]: "latest",
    },
    devDependencies: {
      wrangler: "^4.0.0",
      vitest: "^3.0.0",
      typescript: "^5.0.0",
    },
  };

  await writeFile(
    resolve(targetDir, "package.json"),
    JSON.stringify(packageJson, null, 2),
  );

  return targetDir;
}

// ─────────────────────────────────────────────────────────────────────────────
// Install Dependencies
// ─────────────────────────────────────────────────────────────────────────────

async function installDependencies(
  targetDir: string,
  pm: PackageManager,
): Promise<boolean> {
  const spinner = createSpinner(
    `Installing dependencies with ${pm}...`,
  ).start();

  const success = await runCommand(pm, ["install"], targetDir);

  if (success) {
    spinner.success({ text: "Dependencies installed" });
  } else {
    spinner.error({ text: `Install failed - run '${pm} install' manually` });
  }

  return success;
}

// ─────────────────────────────────────────────────────────────────────────────
// Run Product Init
// ─────────────────────────────────────────────────────────────────────────────

async function runProductInit(
  targetDir: string,
  product: Product,
  options: InitOptions,
): Promise<boolean> {
  const args = ["init", "."];

  if (options.yes) {
    args.push("--yes");
  }

  // Run the product's local init command via npx (now it's installed locally)
  const spinner = createSpinner(`Running ${product} init...`).start();

  const success = await runCommand("npx", [product, ...args], targetDir);

  if (success) {
    spinner.success({ text: `${PRODUCTS[product].name} initialized` });
  } else {
    spinner.error({ text: `${product} init failed` });
  }

  return success;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Wizard
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run the unified init wizard
 *
 * @param preselectedProduct - Skip product selection if already known
 * @param options - CLI options
 */
export async function initWizard(
  preselectedProduct?: Product,
  options: InitOptions = {},
): Promise<void> {
  const interactive = !options.yes && isInteractive() && !isCI();

  // ─────────────────────────────────────────────────────────────────────────
  // Step 1: Show banner
  // ─────────────────────────────────────────────────────────────────────────

  banners.ensemble();

  // ─────────────────────────────────────────────────────────────────────────
  // Step 2: Product selection (if not preselected)
  // ─────────────────────────────────────────────────────────────────────────

  let product: Product = preselectedProduct || "conductor";

  if (!preselectedProduct && interactive) {
    const availableProducts = Object.entries(PRODUCTS)
      .filter(([_, config]) => config.available)
      .map(([key, config]) => ({
        title: `${config.name} - ${config.description}`,
        value: key as Product,
      }));

    // Add coming soon items (keep their actual value for specific messaging)
    const comingSoon = Object.entries(PRODUCTS)
      .filter(([_, config]) => !config.available)
      .map(([key, config]) => ({
        title: colors.dim(
          `${config.name} - ${config.description} (coming soon)`,
        ),
        value: key as Product,
        disabled: true,
      }));

    product = await promptSelect<Product>("What would you like to create?", [
      ...availableProducts,
      ...comingSoon,
    ]);

    // Handle coming soon products with specific messaging
    if (!PRODUCTS[product].available) {
      if (product === "chamber") {
        showChamberComingSoon();
      } else {
        log.warn("That product is coming soon!");
      }
      return;
    }

    // Show product-specific banner after selection
    log.newline();
    showProductBanner(product);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Step 3: Project name
  // ─────────────────────────────────────────────────────────────────────────

  let projectName = "my-project";

  if (interactive) {
    projectName = await promptText("Project name:", `my-${product}-project`, {
      validate: (value) => {
        if (!value.trim()) return "Project name is required";
        if (!/^[a-z0-9-_]+$/i.test(value)) {
          return "Use only letters, numbers, dashes, and underscores";
        }
        if (existsSync(resolve(process.cwd(), value))) {
          return `Directory '${value}' already exists`;
        }
        return true;
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Step 4: Detect package manager
  // ─────────────────────────────────────────────────────────────────────────

  const pm = options.packageManager || detectPackageManager();

  log.newline();
  log.info(
    `Creating ${colors.bold(projectName)} with ${PRODUCTS[product].name}...`,
  );
  log.newline();

  // ─────────────────────────────────────────────────────────────────────────
  // Step 5: Create project directory + package.json
  // ─────────────────────────────────────────────────────────────────────────

  const spinner = createSpinner("Creating project...").start();

  let targetDir: string;
  try {
    targetDir = await createProject(projectName, product, pm);
    spinner.success({ text: "Project created" });
  } catch (error) {
    spinner.error({ text: "Failed to create project" });
    log.error((error as Error).message);
    return;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Step 6: Install dependencies
  // ─────────────────────────────────────────────────────────────────────────

  if (!options.skipInstall) {
    const installed = await installDependencies(targetDir, pm);
    if (!installed) {
      log.warn(`Run '${pm} install' in ${projectName} to complete setup`);
    }
  } else {
    log.dim("Skipping install (--skip-install)");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Step 7: Run product's init command
  // ─────────────────────────────────────────────────────────────────────────

  if (!options.skipInstall) {
    await runProductInit(targetDir, product, options);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Step 8: Product-specific optional wizards
  // ─────────────────────────────────────────────────────────────────────────

  if (interactive && product === "conductor") {
    await conductorOptionalSetup(targetDir, pm);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Step 9: Success!
  // ─────────────────────────────────────────────────────────────────────────

  log.newline();
  log.success(`${colors.bold(projectName)} is ready!`);
  log.newline();

  log.plain(colors.bold("Next steps:"));
  log.newline();
  console.log(`  ${colors.dim("1.")} cd ${projectName}`);
  if (options.skipInstall) {
    console.log(`  ${colors.dim("2.")} ${pm} install`);
    console.log(`  ${colors.dim("3.")} ${pm} run dev`);
  } else {
    console.log(`  ${colors.dim("2.")} ${pm} run dev`);
  }
  log.newline();

  log.dim(`Docs: https://docs.ensemble.ai/${product}`);
  log.newline();
}

// ─────────────────────────────────────────────────────────────────────────────
// Conductor Optional Setup
// ─────────────────────────────────────────────────────────────────────────────

async function conductorOptionalSetup(
  targetDir: string,
  pm: PackageManager,
): Promise<void> {
  log.newline();

  // Cloudflare auth
  const setupCloudflare = await promptConfirm(
    "Configure Cloudflare authentication?",
    true,
  );

  if (setupCloudflare) {
    log.newline();
    const spinner = createSpinner("Checking Cloudflare auth...").start();

    const isLoggedIn = await checkWranglerAuth();

    if (isLoggedIn) {
      spinner.success({ text: "Already logged in to Cloudflare" });
    } else {
      spinner.stop();
      log.info("Opening browser for Cloudflare login...");
      await runCommand("wrangler", ["login"], targetDir);
    }
  }

  // AI Provider
  const setupAI = await promptConfirm("Configure AI provider?", true);

  if (setupAI) {
    const provider = await promptSelect("Select AI provider:", [
      { title: "Cloudflare Workers AI (free tier)", value: "cloudflare" },
      { title: "OpenAI", value: "openai" },
      { title: "Anthropic", value: "anthropic" },
      { title: "Groq", value: "groq" },
      { title: "Skip for now", value: "skip" },
    ]);

    if (provider !== "skip" && provider !== "cloudflare") {
      // TODO: prompt for API key and store via wrangler secret
      log.dim(`Configure ${provider} API key in .dev.vars or wrangler secret`);
    }
  }

  // Cloud connection
  const setupCloud = await promptConfirm(
    "Connect to Ensemble Cloud?",
    false, // Default no
  );

  if (setupCloud) {
    log.dim("Cloud connection coming soon...");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function checkWranglerAuth(): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn("wrangler", ["whoami"], {
      stdio: "pipe",
      shell: true,
    });

    let output = "";
    child.stdout?.on("data", (data) => {
      output += data.toString();
    });

    child.on("close", (code) => {
      resolve(code === 0 && !output.includes("Not logged in"));
    });

    child.on("error", () => {
      resolve(false);
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Product Banner Display
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Show the product-specific ASCII art banner after selection
 */
function showProductBanner(product: Product): void {
  switch (product) {
    case "conductor":
      banners.conductor();
      break;
    case "edgit":
      banners.edgit();
      break;
    case "cloud":
      banners.cloud();
      break;
    case "chamber":
      banners.chamber();
      break;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Coming Soon Product Displays
// ─────────────────────────────────────────────────────────────────────────────

function showChamberComingSoon(): void {
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

// ─────────────────────────────────────────────────────────────────────────────
// Exports for direct product init
// ─────────────────────────────────────────────────────────────────────────────

export async function conductorInit(options: InitOptions = {}): Promise<void> {
  await initWizard("conductor", options);
}

export async function edgitInit(options: InitOptions = {}): Promise<void> {
  await initWizard("edgit", options);
}

export async function chamberInit(_options: InitOptions = {}): Promise<void> {
  showChamberComingSoon();
}

export async function cloudInit(options: InitOptions = {}): Promise<void> {
  await initWizard("cloud", options);
}

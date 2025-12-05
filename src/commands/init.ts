/**
 * Unified Init Wizard
 *
 * Entry point for: npx @ensemble-edge/ensemble
 *
 * Fixed Flow:
 * 1. Show Ensemble banner (ONCE)
 * 2. Product selection → show confirmation line (no second banner)
 * 3. Project name
 * 4. Create project structure (via product init)
 * 5. Install dependencies (silent, with clean output)
 * 6. Configuration prompts (only if init succeeded)
 * 7. Success box (only if everything succeeded)
 */

import { existsSync, readdirSync } from "node:fs";
import { mkdir, writeFile, readFile } from "node:fs/promises";
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
  successBox,
  showNestedSuccess,
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

interface InitResult {
  success: boolean;
  files?: string[];
  error?: string;
}

interface InstallResult {
  success: boolean;
  packages?: Array<{ name: string; version: string }>;
  error?: string;
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

// Key packages to highlight in install output
const HIGHLIGHT_PACKAGES = [
  "@ensemble-edge/conductor",
  "@ensemble-edge/edgit",
  "@ensemble-edge/cloud",
  "wrangler",
  "typescript",
  "vitest",
];

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
  if (userAgent.includes("pnpm")) return "pnpm";
  if (userAgent.includes("yarn")) return "yarn";
  if (userAgent.includes("bun")) return "bun";

  // Default to npm (most universally available)
  return "npm";
}

// ─────────────────────────────────────────────────────────────────────────────
// Spawn Helpers
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// Directory Validation
// ─────────────────────────────────────────────────────────────────────────────

function isDirectoryEmpty(dir: string): boolean {
  if (!existsSync(dir)) return true;
  const files = readdirSync(dir);
  return files.length === 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Create Project Structure
// ─────────────────────────────────────────────────────────────────────────────

async function createProjectStructure(
  projectName: string,
  product: Product,
): Promise<InitResult> {
  const targetDir = resolve(process.cwd(), projectName);

  try {
    // Create directory if it doesn't exist
    if (!existsSync(targetDir)) {
      await mkdir(targetDir, { recursive: true });
    }

    // Check if directory is empty
    if (!isDirectoryEmpty(targetDir)) {
      return {
        success: false,
        error: `Directory '${projectName}' is not empty`,
      };
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

    const files: string[] = [];

    // Write package.json
    await writeFile(
      resolve(targetDir, "package.json"),
      JSON.stringify(packageJson, null, 2),
    );
    files.push("package.json");

    // Create basic project structure based on product
    if (product === "conductor") {
      // Create conductor-specific structure
      await mkdir(resolve(targetDir, "src"), { recursive: true });
      await mkdir(resolve(targetDir, "agents"), { recursive: true });
      await mkdir(resolve(targetDir, "ensembles"), { recursive: true });
      await mkdir(resolve(targetDir, "prompts"), { recursive: true });
      await mkdir(resolve(targetDir, "queries"), { recursive: true });
      await mkdir(resolve(targetDir, "configs"), { recursive: true });

      // Create wrangler.toml
      await writeFile(
        resolve(targetDir, "wrangler.toml"),
        `name = "${projectName}"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[ai]
binding = "AI"
`,
      );
      files.push("wrangler.toml");

      // Create tsconfig.json
      await writeFile(
        resolve(targetDir, "tsconfig.json"),
        JSON.stringify(
          {
            compilerOptions: {
              target: "ES2022",
              module: "ESNext",
              moduleResolution: "bundler",
              strict: true,
              esModuleInterop: true,
              skipLibCheck: true,
              types: ["@cloudflare/workers-types"],
            },
            include: ["src/**/*", "agents/**/*"],
          },
          null,
          2,
        ),
      );
      files.push("tsconfig.json");

      // Create basic index.ts
      await writeFile(
        resolve(targetDir, "src/index.ts"),
        `export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return new Response("Hello from Conductor!", {
      headers: { "content-type": "text/plain" },
    });
  },
};

interface Env {
  AI: Ai;
}
`,
      );
      files.push("src/index.ts");

      files.push("agents/");
      files.push("ensembles/");
      files.push("prompts/");
      files.push("queries/");
      files.push("configs/");
    } else if (product === "edgit") {
      // Create edgit-specific structure
      await mkdir(resolve(targetDir, ".edgit"), { recursive: true });

      await writeFile(
        resolve(targetDir, ".edgit/components.json"),
        JSON.stringify({ components: [] }, null, 2),
      );
      files.push(".edgit/components.json");
    } else if (product === "cloud") {
      // Create cloud-specific structure
      await mkdir(resolve(targetDir, "src"), { recursive: true });

      await writeFile(
        resolve(targetDir, "wrangler.toml"),
        `name = "${projectName}"
main = "src/index.ts"
compatibility_date = "2024-01-01"
`,
      );
      files.push("wrangler.toml");
    }

    return { success: true, files };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Install Dependencies
// ─────────────────────────────────────────────────────────────────────────────

async function installDependencies(
  targetDir: string,
  pm: PackageManager,
): Promise<InstallResult> {
  // Run install silently
  const result = await runCommandSilent(pm, ["install"], targetDir);

  if (!result.success) {
    return {
      success: false,
      error: result.stderr || "Install failed",
    };
  }

  // Read package.json to get installed packages
  try {
    const pkgPath = resolve(targetDir, "package.json");
    const pkgContent = await readFile(pkgPath, "utf-8");
    const pkg = JSON.parse(pkgContent);

    const packages: Array<{ name: string; version: string }> = [];

    // Get actual installed versions from node_modules or lockfile
    // For simplicity, we use the specified versions from package.json
    for (const [name, version] of Object.entries(pkg.dependencies || {})) {
      if (HIGHLIGHT_PACKAGES.some((h) => name.includes(h))) {
        packages.push({ name, version: String(version) });
      }
    }
    for (const [name, version] of Object.entries(pkg.devDependencies || {})) {
      if (HIGHLIGHT_PACKAGES.some((h) => name.includes(h))) {
        packages.push({ name, version: String(version) });
      }
    }

    return { success: true, packages };
  } catch {
    // Even if we can't read packages, install succeeded
    return { success: true, packages: [] };
  }
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

  // Track if everything succeeded for final message
  let allSucceeded = true;

  // ─────────────────────────────────────────────────────────────────────────
  // Step 1: Show banner (ONCE - the Ensemble banner)
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

    // Add coming soon items
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

    // Show confirmation line (NOT a second banner)
    console.log(
      `${colors.success("✔")} ${PRODUCTS[product].name} - ${PRODUCTS[product].description}`,
    );
    log.newline();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Step 3: Project name
  // ─────────────────────────────────────────────────────────────────────────

  let projectName = `my-${product}-project`;

  if (interactive) {
    projectName = await promptText("Project name:", projectName, {
      validate: (value) => {
        if (!value.trim()) return "Project name is required";
        if (!/^[a-z0-9-_]+$/i.test(value)) {
          return "Use only letters, numbers, dashes, and underscores";
        }
        const targetDir = resolve(process.cwd(), value);
        if (existsSync(targetDir) && !isDirectoryEmpty(targetDir)) {
          return `Directory '${value}' already exists and is not empty`;
        }
        return true;
      },
    });
  }

  log.newline();

  // ─────────────────────────────────────────────────────────────────────────
  // Step 4: Detect package manager
  // ─────────────────────────────────────────────────────────────────────────

  const pm = options.packageManager || detectPackageManager();

  // ─────────────────────────────────────────────────────────────────────────
  // Step 5: Create project structure
  // ─────────────────────────────────────────────────────────────────────────

  log.info(`Creating ${PRODUCTS[product].name} project...`);

  const initResult = await createProjectStructure(projectName, product);

  if (!initResult.success) {
    log.error(`Failed to create project structure`);
    log.newline();
    log.plain(initResult.error || "Unknown error");
    log.newline();
    log.plain("To fix:");
    console.log(`  ${colors.accent(`rm -rf ${projectName}`)}`);
    console.log(`  ${colors.accent(`ensemble ${product} init ${projectName}`)}`);
    return; // FAIL FAST - don't continue
  }

  log.success("Created project structure");

  // Show files created
  if (initResult.files) {
    for (const file of initResult.files) {
      showNestedSuccess(file);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Step 6: Install dependencies (silent with clean output)
  // ─────────────────────────────────────────────────────────────────────────

  const targetDir = resolve(process.cwd(), projectName);

  if (!options.skipInstall) {
    log.newline();
    const spinner = createSpinner("Installing dependencies...").start();

    const installResult = await installDependencies(targetDir, pm);

    if (!installResult.success) {
      spinner.error({ text: "Failed to install dependencies" });
      log.newline();
      log.plain(installResult.error || "Unknown error");
      log.newline();
      log.plain("To retry:");
      console.log(`  ${colors.accent(`cd ${projectName}`)}`);
      console.log(`  ${colors.accent(`${pm} install`)}`);
      allSucceeded = false;
      // Continue to show next steps, but don't show success box
    } else {
      spinner.success({ text: "Installed dependencies" });

      // Show key packages
      if (installResult.packages && installResult.packages.length > 0) {
        for (const pkg of installResult.packages) {
          showNestedSuccess(`${pkg.name}@${pkg.version}`);
        }
      }
    }
  } else {
    log.newline();
    log.dim("Skipping install (--skip-install)");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Step 7: Configuration prompts (only if install succeeded)
  // ─────────────────────────────────────────────────────────────────────────

  if (interactive && allSucceeded && product === "conductor") {
    log.newline();
    await conductorOptionalSetup(targetDir, pm);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Step 8: Success! (only if everything succeeded)
  // ─────────────────────────────────────────────────────────────────────────

  log.newline();

  if (allSucceeded) {
    // Show success box
    console.log(successBox(`${projectName} created successfully!`));
  } else {
    // Show partial success
    log.warn(`${projectName} created with warnings`);
  }

  log.newline();
  log.plain(colors.bold("Next steps:"));
  log.newline();
  console.log(`  ${colors.accent(`cd ${projectName}`)}`);
  if (options.skipInstall || !allSucceeded) {
    console.log(`  ${colors.accent(`${pm} install`)}`);
  }
  console.log(`  ${colors.accent(`${pm} run dev`)}`);
  log.newline();

  if (product === "conductor") {
    console.log(`Then visit: ${colors.accent("http://localhost:8787/")}`);
    log.newline();
  }

  log.dim(`📚 Docs: https://docs.ensemble.ai/${product}`);
  log.newline();
}

// ─────────────────────────────────────────────────────────────────────────────
// Conductor Optional Setup
// ─────────────────────────────────────────────────────────────────────────────

async function conductorOptionalSetup(
  targetDir: string,
  _pm: PackageManager,
): Promise<void> {
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

  log.newline();

  // AI Provider
  const setupAI = await promptConfirm("Configure AI provider?", true);

  if (setupAI) {
    const provider = await promptSelect("Select AI provider:", [
      { title: "Cloudflare Workers AI (no API key needed)", value: "cloudflare" },
      { title: "OpenAI", value: "openai" },
      { title: "Anthropic", value: "anthropic" },
      { title: "Groq", value: "groq" },
      { title: "Skip for now", value: "skip" },
    ]);

    if (provider === "cloudflare") {
      log.success("Using Cloudflare Workers AI");
    } else if (provider !== "skip") {
      log.dim(`Configure ${provider} API key in .dev.vars or wrangler secret`);
    }
  }

  log.newline();

  // Cloud connection
  const setupCloud = await promptConfirm("Connect to Ensemble Cloud?", false);

  if (setupCloud) {
    log.dim("Run 'ensemble cloud init' to configure cloud connection");
  } else {
    log.info("No problem! Connect anytime: ensemble cloud init");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function checkWranglerAuth(): Promise<boolean> {
  const result = await runCommandSilent("wrangler", ["whoami"]);
  return result.success && !result.stdout.includes("Not logged in");
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

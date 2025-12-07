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
import {
  mkdir,
  writeFile,
  readFile,
  copyFile,
  readdir,
} from "node:fs/promises";
import { resolve, basename, join, relative } from "node:path";
import { spawn } from "node:child_process";
import {
  colors,
  log,
  banners,
  createSpinner,
  promptText,
  promptSelect,
  promptConfirm,
  isInteractive,
  isCI,
  isDevContainer,
  successBox,
  showNestedSuccess,
} from "../ui/index.js";
import { authWizard, aiWizard, cloudWizard } from "../wizards/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type Product = "conductor" | "edgit" | "chamber" | "cloud";
type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

/**
 * Project setup type determines how much starter code to include
 *
 * - full: Template + example agents & ensembles (recommended)
 * - starter: Template only, ready to code, no examples
 * - basic: Minimal stub for manual setup (advanced users)
 */
type SetupType = "full" | "starter" | "basic";

interface InitOptions {
  yes?: boolean;
  skipInstall?: boolean;
  packageManager?: PackageManager;
  projectName?: string;
  /** Project setup type (full/starter/basic) */
  setup?: SetupType;
  /** Include examples (alias for setup=full vs setup=starter) */
  examples?: boolean;
  /** Force overwrite existing directory */
  force?: boolean;
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
// Directory Validation & Project Detection
// ─────────────────────────────────────────────────────────────────────────────

function isDirectoryEmpty(dir: string): boolean {
  if (!existsSync(dir)) return true;
  const files = readdirSync(dir);
  return files.length === 0;
}

/**
 * Project marker files that indicate we're inside a Conductor project
 */
const PROJECT_MARKERS = [
  "wrangler.toml",
  "wrangler.json",
  "conductor.config.ts",
  "conductor.config.js",
];

/**
 * Find the root of an existing Conductor project by walking up the directory tree
 *
 * @param startDir - Directory to start searching from
 * @returns Project root path if found, null otherwise
 */
function findProjectRoot(startDir: string): string | null {
  let currentDir = resolve(startDir);
  const root = resolve("/");

  while (currentDir !== root) {
    // Check for project marker files
    for (const marker of PROJECT_MARKERS) {
      if (existsSync(join(currentDir, marker))) {
        return currentDir;
      }
    }

    // Move up one directory
    const parentDir = resolve(currentDir, "..");
    if (parentDir === currentDir) break; // Reached filesystem root
    currentDir = parentDir;
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Template Directory Copy
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Files/directories to skip when copying templates
 */
const TEMPLATE_SKIP_PATTERNS = [
  "node_modules",
  ".git",
  ".wrangler",
  ".mf",
  "dist",
  ".cache",
  "coverage",
  ".nyc_output",
  "tmp",
  "temp",
  ".DS_Store",
  "Thumbs.db",
  "pnpm-lock.yaml",
  "package-lock.json",
  "yarn.lock",
  "bun.lockb",
  ".dev.vars", // secrets - only copy .dev.vars.example
  ".env",
  "*.tgz", // local package tarballs
  "*.log",
  "package.json.bak",
  "CLAUDE.md", // internal dev docs
  "DEVELOPMENT.md", // internal dev docs
];

/**
 * Check if a file/directory should be skipped
 */
function shouldSkipPath(name: string): boolean {
  for (const pattern of TEMPLATE_SKIP_PATTERNS) {
    if (pattern.startsWith("*")) {
      // Wildcard pattern like "*.tgz"
      const ext = pattern.slice(1);
      if (name.endsWith(ext)) return true;
    } else if (name === pattern) {
      return true;
    }
  }
  return false;
}

interface CopyTemplateOptions {
  /** Include examples directories */
  includeExamples: boolean;
  /** Project name for package.json substitution */
  projectName: string;
  /** Dev container mode - adjust dev script */
  inDevContainer: boolean;
}

/**
 * Recursively copy template directory
 *
 * Based on conductor CLI's copyDirectory() but with ensemble-specific handling:
 * - Skips examples/ directories when includeExamples is false
 * - Substitutes package.json name and conductor dependency
 * - Adjusts dev script for dev container networking
 */
async function copyTemplateDirectory(
  src: string,
  dest: string,
  options: CopyTemplateOptions,
  files: string[] = [],
  baseDest: string = dest,
): Promise<string[]> {
  await mkdir(dest, { recursive: true });

  const entries = await readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    const relativePath = relative(baseDest, destPath);

    // Skip patterns (node_modules, .git, etc.)
    if (shouldSkipPath(entry.name)) {
      continue;
    }

    // Skip examples directories if --no-examples / starter mode
    if (
      !options.includeExamples &&
      entry.name === "examples" &&
      entry.isDirectory()
    ) {
      continue;
    }

    if (entry.isDirectory()) {
      // Recurse into directory
      await copyTemplateDirectory(srcPath, destPath, options, files, baseDest);
      // Only add directory to list if it's not empty after recursion
      const dirContents = await readdir(destPath).catch(() => []);
      if (dirContents.length > 0) {
        files.push(relativePath + "/");
      }
    } else {
      // Handle special files
      if (entry.name === "package.json") {
        // Transform package.json
        await copyAndTransformPackageJson(srcPath, destPath, options);
        files.push(relativePath);
      } else {
        // Regular file copy
        await copyFile(srcPath, destPath);
        files.push(relativePath);
      }
    }
  }

  return files;
}

/**
 * Copy and transform package.json
 *
 * - Sets project name
 * - Replaces local tgz dependency with "latest"
 * - Adjusts dev script for dev containers
 */
async function copyAndTransformPackageJson(
  srcPath: string,
  destPath: string,
  options: CopyTemplateOptions,
): Promise<void> {
  const content = await readFile(srcPath, "utf-8");
  const pkg = JSON.parse(content);

  // Set project name
  pkg.name = options.projectName;

  // Replace local tgz with latest version
  if (pkg.dependencies?.["@ensemble-edge/conductor"]) {
    pkg.dependencies["@ensemble-edge/conductor"] = "latest";
  }

  // Adjust dev script for dev container networking
  if (options.inDevContainer && pkg.scripts?.dev) {
    // Add --ip 0.0.0.0 if not already present
    if (!pkg.scripts.dev.includes("--ip")) {
      pkg.scripts.dev = pkg.scripts.dev.replace(
        "wrangler dev",
        "wrangler dev --ip 0.0.0.0",
      );
    }
  }

  await writeFile(destPath, JSON.stringify(pkg, null, 2) + "\n");
}

/**
 * Get the template directory path from installed conductor package
 */
function getTemplatePath(targetDir: string): string | null {
  const conductorPath = resolve(
    targetDir,
    "node_modules/@ensemble-edge/conductor/catalog/cloud/cloudflare/templates",
  );

  if (existsSync(conductorPath)) {
    return conductorPath;
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Create Project Structure
// ─────────────────────────────────────────────────────────────────────────────

interface CreateProjectOptions {
  /** Whether running in a dev container (adjusts scripts for networking) */
  inDevContainer?: boolean;
  /** Force overwrite existing directory */
  force?: boolean;
}

/**
 * Create minimal package.json to bootstrap npm install
 *
 * This creates just enough structure to run npm install and get the
 * conductor package, which contains the templates we'll copy after.
 */
async function createMinimalPackageJson(
  targetDir: string,
  packageName: string,
  product: Product,
): Promise<void> {
  const productConfig = PRODUCTS[product];

  const packageJson = {
    name: packageName,
    version: "0.0.1",
    private: true,
    dependencies: {
      [productConfig.package]: "latest",
    },
  };

  await writeFile(
    resolve(targetDir, "package.json"),
    JSON.stringify(packageJson, null, 2),
  );
}

/**
 * Create basic project structure (minimal stub for advanced users)
 *
 * This is the "basic" setup mode - creates a minimal placeholder project
 * without using templates. For users who want to set up everything manually.
 */
async function createBasicProjectStructure(
  projectName: string,
  product: Product,
  options: CreateProjectOptions = {},
): Promise<InitResult> {
  const cwd = process.cwd();
  const { inDevContainer = false, force = false } = options;

  // Handle "." meaning current directory
  const isCurrentDir = projectName === ".";
  const targetDir = isCurrentDir ? cwd : resolve(cwd, projectName);
  const packageName = isCurrentDir ? basename(cwd) : projectName;

  try {
    // Create directory if it doesn't exist (skip for current dir)
    if (!isCurrentDir && !existsSync(targetDir)) {
      await mkdir(targetDir, { recursive: true });
    }

    // Check if directory is empty (skip if --force)
    if (!isDirectoryEmpty(targetDir) && !force) {
      return {
        success: false,
        error: `Directory '${targetDir}' is not empty. Use --force to overwrite.`,
      };
    }

    // Create package.json with product as dependency
    const productConfig = PRODUCTS[product];

    // Dev container networking: use --ip 0.0.0.0 for proper port forwarding
    const devCommand = inDevContainer
      ? "wrangler dev --ip 0.0.0.0"
      : "wrangler dev";

    const packageJson = {
      name: packageName,
      version: "0.0.1",
      type: "module",
      scripts: {
        dev: devCommand,
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

      // Create wrangler.toml (AI binding commented out by default so local dev works)
      await writeFile(
        resolve(targetDir, "wrangler.toml"),
        `name = "${packageName}"
main = "src/index.ts"
compatibility_date = "2024-01-01"

# Uncomment to enable Cloudflare Workers AI
# Run: ensemble conductor init --configure-ai
# Or manually uncomment after running: wrangler login
# [ai]
# binding = "AI"
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
  // Uncomment when AI binding is enabled in wrangler.toml
  // AI: Ai;
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
        `name = "${packageName}"
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

  // Show current working directory for clarity
  // Handle case where cwd doesn't exist (e.g., user deleted the directory they were in)
  let cwd: string;
  try {
    cwd = process.cwd();
  } catch (error) {
    log.error("Current directory no longer exists.");
    log.newline();
    log.plain(
      "Your current directory was deleted. Please cd to a valid directory first:",
    );
    log.newline();
    console.log(`  ${colors.accent("cd /tmp")}`);
    console.log(`  ${colors.accent("ensemble conductor init my-project")}`);
    log.newline();
    return;
  }
  log.dim(`📂 ${cwd}`);

  // ─────────────────────────────────────────────────────────────────────────
  // Step 2: Detect existing project (block nested project creation)
  // ─────────────────────────────────────────────────────────────────────────

  // Find project root by walking up directory tree
  const projectRoot = findProjectRoot(cwd);
  const isExistingProject = projectRoot !== null;

  // If inside an existing project, offer options
  if (isExistingProject) {
    const projectName = basename(projectRoot!);

    if (options.force) {
      // --force: automatically reinstall at project root
      log.info(`Reinstalling at project root: ${colors.accent(projectName)}`);
      log.dim(`📁 ${projectRoot}`);
      process.chdir(projectRoot!);
      options.projectName = ".";
      log.newline();
      // Fall through to continue with init
    } else if (interactive) {
      // Interactive: show options
      log.newline();
      log.info(`Found existing project: ${colors.accent(projectName)}`);
      log.dim(`📁 ${projectRoot}`);
      log.newline();

      type ProjectAction = "reinstall" | "delete" | "new" | "exit";
      const actionChoices: Array<{ title: string; value: ProjectAction }> = [
        {
          title: `Reinstall templates for "${projectName}"`,
          value: "reinstall",
        },
        {
          title: colors.warning(`Delete "${projectName}" and start fresh`),
          value: "delete",
        },
        {
          title: "Create a new project (different name)",
          value: "new",
        },
        {
          title: colors.dim("Exit"),
          value: "exit",
        },
      ];

      const action = await promptSelect<ProjectAction>(
        "What would you like to do?",
        actionChoices,
      );

      if (action === "exit") {
        return;
      }

      if (action === "reinstall") {
        // Confirm reinstall
        log.newline();
        log.warn("This will overwrite existing files in the project.");
        const confirmText = await promptText(
          `Type "reinstall" to confirm:`,
          "",
          {
            validate: (v) => v === "reinstall" || `Type "reinstall" to confirm`,
          },
        );

        if (confirmText !== "reinstall") {
          log.dim("Cancelled.");
          return;
        }

        process.chdir(projectRoot!);
        options.force = true;
        options.projectName = ".";
        log.newline();
        // Fall through to continue with init
      } else if (action === "delete") {
        // Confirm delete
        log.newline();
        log.warn(
          `This will permanently delete "${projectRoot}" and cannot be undone!`,
        );
        const confirmText = await promptText(`Type "delete" to confirm:`, "", {
          validate: (v) => v === "delete" || `Type "delete" to confirm`,
        });

        if (confirmText !== "delete") {
          log.dim("Cancelled.");
          return;
        }

        // Delete the project directory
        const { rm } = await import("node:fs/promises");
        const parentDir = resolve(projectRoot!, "..");
        log.newline();
        const deleteSpinner = createSpinner(
          `Deleting ${projectName}...`,
        ).start();
        try {
          await rm(projectRoot!, { recursive: true, force: true });
          deleteSpinner.success({ text: `Deleted ${projectName}` });
        } catch (error) {
          deleteSpinner.error({ text: `Failed to delete ${projectName}` });
          log.plain((error as Error).message);
          return;
        }

        // After delete, the user's shell may be in a directory that no longer exists
        // We can't fix that from Node.js, so we tell them to cd and run init again
        log.newline();
        log.success("Project deleted. To create a new project:");
        log.newline();
        console.log(`  ${colors.accent(`cd ${parentDir}`)}`);
        console.log(`  ${colors.accent(`ensemble conductor init my-project`)}`);
        log.newline();
        return; // Don't continue - user needs to cd first
      } else if (action === "new") {
        // Create new project as sibling (in parent directory of existing project)
        const parentDir = resolve(projectRoot!, "..");
        process.chdir(parentDir);
        log.dim(`📂 ${parentDir}`);
        // Fall through - the project name prompt will handle it
      }
    } else {
      // Non-interactive without --force: block
      log.newline();
      log.warn(
        `You're inside an existing project: ${colors.accent(projectName)}`,
      );
      log.dim("Use --force to reinstall templates at project root.");
      log.newline();
      return;
    }
  }

  let product: Product = preselectedProduct || "conductor";

  if (!preselectedProduct && interactive) {
    // Build available products list
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

    // Build choices
    type WizardChoice = Product | "exit";
    const choices: Array<{
      title: string;
      value: WizardChoice;
      disabled?: boolean;
    }> = [
      ...availableProducts.map((p) => ({
        ...p,
        value: p.value as WizardChoice,
      })),
      ...comingSoon.map((p) => ({ ...p, value: p.value as WizardChoice })),
      { title: colors.dim("Exit"), value: "exit" as WizardChoice },
    ];

    const choice = await promptSelect<WizardChoice>(
      "What would you like to create?",
      choices,
    );

    if (choice === "exit") {
      return;
    }

    product = choice as Product;

    // Handle coming soon products
    if (!PRODUCTS[product].available) {
      if (product === "chamber") {
        showChamberComingSoon();
      } else {
        log.warn("That product is coming soon!");
      }
      return;
    }

    // Show confirmation line
    console.log(
      `${colors.success("✔")} ${PRODUCTS[product].name} - ${PRODUCTS[product].description}`,
    );
    log.newline();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Step 3: Project name
  // ─────────────────────────────────────────────────────────────────────────

  // Re-capture cwd in case it changed (e.g., reinit changed to project root)
  const currentCwd = process.cwd();

  // Check if current directory is empty (for "." support)
  const cwdIsEmpty = isDirectoryEmpty(currentCwd);
  const cwdName = basename(currentCwd);

  // Use provided project name, or default to my-{product}-project
  // "." is supported but not the default - users should explicitly choose it
  let projectName = options.projectName || `my-${product}-project`;

  // Only prompt if no project name was provided via CLI and we're interactive
  if (!options.projectName && interactive) {
    const defaultName = `my-${product}-project`;

    // Loop until we get a valid name or user confirms overwrite
    let confirmed = false;
    while (!confirmed) {
      projectName = await promptText(
        `Project name ${colors.dim('(use "." for current directory)')}:`,
        defaultName,
        {
          validate: (value) => {
            if (!value.trim()) return "Project name is required";

            // Special case: "." means use current directory (always valid syntactically)
            if (value === ".") {
              return true;
            }

            if (!/^[a-z0-9-_]+$/i.test(value)) {
              return "Use only letters, numbers, dashes, and underscores";
            }
            // Allow any valid name - we'll check for existing directory after
            return true;
          },
        },
      );

      // Check if selected directory needs overwrite confirmation
      const selectedTargetDir =
        projectName === "." ? currentCwd : resolve(currentCwd, projectName);
      if (!isDirectoryEmpty(selectedTargetDir)) {
        // Directory exists - ask for confirmation
        log.warn(
          `Directory '${selectedTargetDir}' already exists and is not empty`,
        );
        const shouldOverwrite = await promptConfirm(
          "Overwrite existing files?",
          false, // default to No for safety
        );

        if (shouldOverwrite) {
          confirmed = true;
          // Set force flag so downstream checks don't block
          options.force = true;
        } else {
          // User said no - loop back to ask for project name again
          log.newline();
          continue;
        }
      } else {
        confirmed = true;
      }
    }
  } else if (options.projectName) {
    // Validate provided project name
    if (options.projectName === ".") {
      if (!cwdIsEmpty && !options.force) {
        log.error(`Current directory '${currentCwd}' is not empty`);
        log.dim("Use --force to overwrite existing files");
        return;
      }
    } else {
      if (!/^[a-z0-9-_]+$/i.test(options.projectName)) {
        log.error(
          "Project name must use only letters, numbers, dashes, and underscores",
        );
        return;
      }
      const targetDir = resolve(currentCwd, options.projectName);
      if (
        existsSync(targetDir) &&
        !isDirectoryEmpty(targetDir) &&
        !options.force
      ) {
        log.error(`Directory '${targetDir}' already exists and is not empty`);
        log.dim("Use --force to overwrite existing files");
        return;
      }
    }
  }

  log.newline();

  // ─────────────────────────────────────────────────────────────────────────
  // Step 4: Project setup type (Full/Starter/Basic) - Conductor only
  // ─────────────────────────────────────────────────────────────────────────

  // Determine setup type
  // - CLI flags take precedence
  // - --examples / --no-examples maps to full/starter
  // - Default to "full" (recommended)
  let setupType: SetupType = options.setup || "full";

  // Handle --examples / --no-examples flags
  if (options.examples === true) {
    setupType = "full";
  } else if (options.examples === false) {
    setupType = "starter";
  }

  // Only prompt for Conductor (templates only exist for Conductor currently)
  if (
    product === "conductor" &&
    !options.setup &&
    options.examples === undefined &&
    interactive
  ) {
    const setupChoices: Array<{
      title: string;
      value: SetupType;
      description?: string;
    }> = [
      {
        title: "Full",
        value: "full",
        description: "Template + example agents & ensembles (recommended)",
      },
      {
        title: "Starter",
        value: "starter",
        description: "Ready to code, no examples",
      },
      {
        title: "Basic",
        value: "basic",
        description: "Minimal stub (manual setup)",
      },
    ];

    setupType = await promptSelect<SetupType>("Project setup:", setupChoices);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Step 5: Detect package manager
  // ─────────────────────────────────────────────────────────────────────────

  const pm = options.packageManager || detectPackageManager();

  // ─────────────────────────────────────────────────────────────────────────
  // Step 6: Create project and install dependencies
  // ─────────────────────────────────────────────────────────────────────────

  // Detect dev container early so we can configure scripts appropriately
  const inDevContainer = isDevContainer();

  // Handle "." meaning current directory
  const isCurrentDir = projectName === ".";
  const targetDir = isCurrentDir
    ? currentCwd
    : resolve(currentCwd, projectName);
  const displayName = isCurrentDir ? cwdName : projectName;
  const packageName = isCurrentDir ? cwdName : projectName;

  // Different flows for different setup types
  if (setupType === "basic" || product !== "conductor") {
    // ─────────────────────────────────────────────────────────────────────
    // BASIC MODE: Create minimal structure, then install
    // ─────────────────────────────────────────────────────────────────────

    log.info(`Creating ${PRODUCTS[product].name} project...`);

    const initResult = await createBasicProjectStructure(projectName, product, {
      inDevContainer,
      force: options.force,
    });

    if (!initResult.success) {
      log.error(`Failed to create project structure`);
      log.newline();
      log.plain(initResult.error || "Unknown error");
      log.newline();
      log.plain("To fix:");
      console.log(`  ${colors.accent(`rm -rf ${projectName}`)}`);
      console.log(
        `  ${colors.accent(`ensemble ${product} init ${projectName}`)}`,
      );
      return; // FAIL FAST - don't continue
    }

    log.success("Created project structure");

    // Show files created
    if (initResult.files) {
      for (const file of initResult.files) {
        showNestedSuccess(file);
      }
    }
  } else {
    // ─────────────────────────────────────────────────────────────────────
    // FULL/STARTER MODE: Install first, then copy templates
    // ─────────────────────────────────────────────────────────────────────

    log.info(`Creating ${PRODUCTS[product].name} project...`);

    // Create target directory
    if (!isCurrentDir && !existsSync(targetDir)) {
      await mkdir(targetDir, { recursive: true });
    }

    // Check if directory is empty (skip if --force)
    if (!isDirectoryEmpty(targetDir) && !options.force) {
      log.error(`Directory '${targetDir}' is not empty`);
      log.dim("Use --force to overwrite existing files");
      return;
    }

    // Create minimal package.json for initial install
    await createMinimalPackageJson(targetDir, packageName, product);
    log.success("Created package.json");
  }

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
      if (!isCurrentDir) {
        console.log(`  ${colors.accent(`cd ${projectName}`)}`);
      }
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

      // ─────────────────────────────────────────────────────────────────────
      // FULL/STARTER MODE: Copy templates from installed conductor package
      // ─────────────────────────────────────────────────────────────────────

      if (
        (setupType === "full" || setupType === "starter") &&
        product === "conductor"
      ) {
        log.newline();
        const templateSpinner = createSpinner(
          "Copying project templates...",
        ).start();

        const templatePath = getTemplatePath(targetDir);

        if (!templatePath) {
          templateSpinner.error({
            text: "Template not found in installed package",
          });
          log.newline();
          log.warn(
            "Could not find templates in @ensemble-edge/conductor package.",
          );
          log.dim(
            "The project will work but you may need to set up files manually.",
          );
          allSucceeded = false;
        } else {
          try {
            const copiedFiles = await copyTemplateDirectory(
              templatePath,
              targetDir,
              {
                includeExamples: setupType === "full",
                projectName: packageName,
                inDevContainer,
              },
            );

            templateSpinner.success({ text: "Copied project templates" });

            // Show summary of what was copied
            const fileCount = copiedFiles.filter(
              (f) => !f.endsWith("/"),
            ).length;
            const dirCount = copiedFiles.filter((f) => f.endsWith("/")).length;
            showNestedSuccess(`${fileCount} files, ${dirCount} directories`);

            if (setupType === "full") {
              showNestedSuccess("Includes example agents & ensembles");
            }

            if (inDevContainer) {
              showNestedSuccess("Dev container networking configured");
            }

            // Run a second install to pick up template's devDependencies (vite, etc.)
            // The initial install only had the minimal package.json with conductor
            // Now that we've copied the template's full package.json, we need to install again
            log.newline();
            const devDepsSpinner = createSpinner(
              "Installing dev dependencies...",
            ).start();
            const devDepsResult = await installDependencies(targetDir, pm);

            if (!devDepsResult.success) {
              devDepsSpinner.error({
                text: "Failed to install dev dependencies",
              });
              log.newline();
              log.plain(devDepsResult.error || "Unknown error");
              log.dim("Run install manually to complete setup");
              allSucceeded = false;
            } else {
              devDepsSpinner.success({ text: "Installed dev dependencies" });
            }
          } catch (error) {
            templateSpinner.error({ text: "Failed to copy templates" });
            log.newline();
            log.plain((error as Error).message);
            allSucceeded = false;
          }
        }
      }
    }
  } else {
    log.newline();
    log.dim("Skipping install (--skip-install)");

    // Warn if full/starter mode without install
    if (
      (setupType === "full" || setupType === "starter") &&
      product === "conductor"
    ) {
      log.warn("Templates will not be copied when using --skip-install");
      log.dim(
        "Run install manually, then copy templates from node_modules/@ensemble-edge/conductor/catalog/cloud/cloudflare/templates/",
      );
    }
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
    console.log(successBox(`${displayName} created successfully!`));
  } else {
    // Show partial success
    log.warn(`${displayName} created with warnings`);
  }

  log.newline();
  log.plain(colors.bold("Next steps:"));
  log.newline();

  // Only show "cd" if we created a subdirectory
  if (!isCurrentDir) {
    console.log(`  ${colors.accent(`cd ${projectName}`)}`);
  }
  if (options.skipInstall || !allSucceeded) {
    console.log(`  ${colors.accent(`${pm} install`)}`);
  }

  // Show dev command (scripts are already configured with --ip 0.0.0.0 if in dev container)
  console.log(`  ${colors.accent(`${pm} run dev`)}`);

  // Show helpful tip if in dev container
  if (inDevContainer && product === "conductor") {
    log.dim(
      "  💡 Dev container detected — scripts configured for port forwarding",
    );
  }
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

/**
 * Run optional setup wizards for Conductor projects
 *
 * Uses shared wizards from ../wizards/ to stay in sync with configure command.
 */
async function conductorOptionalSetup(
  targetDir: string,
  _pm: PackageManager,
): Promise<void> {
  // 1. Cloudflare auth
  await authWizard({
    cwd: targetDir,
    skipPrompt: false, // Show "Configure Cloudflare authentication?" prompt
  });

  log.newline();

  // 2. AI Provider
  await aiWizard({
    cwd: targetDir,
    showInitialPrompt: true, // Show "Configure AI provider?" prompt
    showSuccessBox: false, // Don't show big success box during init flow
  });

  log.newline();

  // 3. Cloud connection
  await cloudWizard({
    cwd: targetDir,
  });
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

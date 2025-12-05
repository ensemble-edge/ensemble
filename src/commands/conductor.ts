/**
 * Ensemble Conductor Commands
 *
 * Conductor is the AI workflow orchestration system.
 * This module provides the `ensemble conductor` commands.
 */

import { spawn } from "node:child_process";
import {
  mkdir,
  readdir,
  readFile,
  writeFile,
  copyFile,
  stat,
} from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import {
  colors,
  log,
  banners,
  createSpinner,
  successBox,
} from "../ui/index.js";
import { showInitHints } from "../discovery.js";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface InitOptions {
  template: string;
  force: boolean;
  examples: boolean;
  skipAuth: boolean;
  skipSecrets: boolean;
  provider: string | null;
  yes: boolean; // Non-interactive mode
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get the path to bundled conductor templates
 * Templates are now bundled with the ensemble CLI
 */
function getTemplatesDir(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  // Templates are at: ensemble/templates/conductor/
  // This file is at: ensemble/dist/commands/conductor.js (after build)
  // So we need to go up 2 levels from dist/commands to get to project root
  return join(__dirname, "..", "..", "templates", "conductor");
}

/**
 * Check if a directory is a Conductor project
 */
function isConductorProject(dir: string): boolean {
  return (
    existsSync(join(dir, "conductor.config.ts")) ||
    existsSync(join(dir, "conductor.config.js")) ||
    (existsSync(join(dir, "ensembles")) && existsSync(join(dir, "agents")))
  );
}

/**
 * Check if wrangler is authenticated
 * Returns: { authenticated: boolean, account?: string }
 */
async function checkWranglerAuth(): Promise<{
  authenticated: boolean;
  account?: string;
}> {
  return new Promise((resolve) => {
    const child = spawn("wrangler", ["whoami"], {
      shell: true,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";

    child.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    child.on("close", (code) => {
      if (code === 0 && !stdout.includes("Not logged in")) {
        // Extract account name from output like "You are logged in with an OAuth Token, associated with the email 'user@example.com'"
        const match = stdout.match(/email '([^']+)'|account '([^']+)'/);
        const account = match?.[1] || match?.[2];
        resolve({ authenticated: true, account });
      } else {
        resolve({ authenticated: false });
      }
    });

    child.on("error", () => {
      resolve({ authenticated: false });
    });
  });
}

/**
 * Prompt user to login to wrangler
 */
async function promptWranglerLogin(): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn("wrangler", ["login"], {
      shell: true,
      stdio: "inherit",
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
 * Store a secret via wrangler
 */
async function storeSecret(name: string, value: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn("wrangler", ["secret", "put", name], {
      shell: true,
      stdio: ["pipe", "inherit", "inherit"],
    });

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
 * AI Provider configurations
 */
const AI_PROVIDERS = {
  anthropic: {
    name: "Anthropic (Claude)",
    secretName: "ANTHROPIC_API_KEY",
    docsUrl: "https://console.anthropic.com/",
    keyFormat: "sk-ant-",
  },
  openai: {
    name: "OpenAI",
    secretName: "OPENAI_API_KEY",
    docsUrl: "https://platform.openai.com/api-keys",
    keyFormat: "sk-",
  },
  cloudflare: {
    name: "Cloudflare Workers AI",
    secretName: null, // Uses AI binding, no key needed
    docsUrl: "https://developers.cloudflare.com/workers-ai/",
    keyFormat: null,
  },
} as const;

type AIProviderKey = keyof typeof AI_PROVIDERS;

/**
 * Read a line from stdin (simple prompt)
 */
async function readLine(prompt: string): Promise<string> {
  process.stdout.write(prompt);
  return new Promise((resolve) => {
    let input = "";
    process.stdin.setEncoding("utf8");
    process.stdin.resume();

    const onData = (chunk: string) => {
      if (chunk.includes("\n")) {
        process.stdin.removeListener("data", onData);
        process.stdin.pause();
        input += chunk.split("\n")[0];
        resolve(input.trim());
      } else {
        input += chunk;
      }
    };

    process.stdin.on("data", onData);
  });
}

/**
 * Check if directory has any files
 */
async function hasFiles(dir: string): Promise<boolean> {
  try {
    const entries = await readdir(dir);
    // Filter out hidden files like .git
    return entries.filter((e) => !e.startsWith(".")).length > 0;
  } catch {
    return false;
  }
}

/**
 * Recursively copy a directory
 */
async function copyDirectory(
  src: string,
  dest: string,
  options: {
    force?: boolean;
    skipExamples?: boolean;
    conductorVersion?: string;
    onFile?: (
      relativePath: string,
      status: "created" | "skipped" | "overwritten",
    ) => void;
  } = {},
): Promise<void> {
  await mkdir(dest, { recursive: true });

  const entries = await readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);

    // Skip examples directory if requested
    if (options.skipExamples && entry.name === "examples") {
      continue;
    }

    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath, options);
    } else {
      // Check if file exists
      const fileExists = existsSync(destPath);

      if (fileExists && !options.force) {
        options.onFile?.(destPath, "skipped");
        continue;
      }

      // Read source file
      let content = await readFile(srcPath, "utf-8");

      // Template substitution for package.json
      if (entry.name === "package.json" && options.conductorVersion) {
        content = content.replace(
          /__CONDUCTOR_VERSION__/g,
          options.conductorVersion,
        );
      }

      await writeFile(destPath, content);
      options.onFile?.(destPath, fileExists ? "overwritten" : "created");
    }
  }
}

/**
 * Parse init command arguments
 */
function parseInitArgs(args: string[]): {
  directory: string;
  options: InitOptions;
} {
  const options: InitOptions = {
    template: "cloudflare",
    force: false,
    examples: true,
    skipAuth: false,
    skipSecrets: false,
    provider: null,
    yes: false,
  };

  let directory = ".";
  const remaining: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--template" && args[i + 1]) {
      options.template = args[++i];
    } else if (arg === "--force" || arg === "-f") {
      options.force = true;
    } else if (arg === "--no-examples") {
      options.examples = false;
    } else if (arg === "--skip-auth") {
      options.skipAuth = true;
    } else if (arg === "--skip-secrets") {
      options.skipSecrets = true;
    } else if (arg === "--yes" || arg === "-y") {
      // --yes enables non-interactive mode (skips auth and secrets prompts)
      options.yes = true;
      options.skipAuth = true;
      options.skipSecrets = true;
    } else if (arg === "--provider" && args[i + 1]) {
      options.provider = args[++i];
    } else if (!arg.startsWith("-")) {
      remaining.push(arg);
    }
  }

  if (remaining.length > 0) {
    directory = remaining[0];
  }

  return { directory, options };
}

// ─────────────────────────────────────────────────────────────────────────────
// Conductor Init
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Initialize a new Conductor project
 */
export async function conductorInit(args: string[]): Promise<void> {
  banners.conductor();
  console.log("");

  const { directory, options } = parseInitArgs(args);
  const targetDir = join(process.cwd(), directory);
  const targetName = directory === "." ? basename(process.cwd()) : directory;

  // Calculate total steps
  const needsAuth = !options.skipAuth;
  const needsSecrets = !options.skipSecrets;
  const totalSteps = 3 + (needsAuth ? 1 : 0) + (needsSecrets ? 1 : 0);
  let currentStep = 0;

  // Step: Check Wrangler Authentication (if not skipped)
  if (needsAuth) {
    currentStep++;
    console.log(
      colors.dim(
        `Step ${currentStep} of ${totalSteps}: Cloudflare Authentication`,
      ),
    );
    const authSpinner = createSpinner(
      "Checking wrangler authentication...",
    ).start();

    const authStatus = await checkWranglerAuth();

    if (authStatus.authenticated) {
      authSpinner.success({
        text: `Authenticated${authStatus.account ? ` as ${authStatus.account}` : ""}`,
      });
    } else {
      authSpinner.warn({ text: "Not authenticated with Cloudflare" });
      console.log("");
      log.info(
        "Conductor deploys to Cloudflare Workers. Would you like to login?",
      );
      console.log("");

      const answer = await readLine(colors.accent("  Login now? [Y/n]: "));
      const shouldLogin =
        !answer ||
        answer.toLowerCase() === "y" ||
        answer.toLowerCase() === "yes";

      if (shouldLogin) {
        console.log("");
        log.dim("Opening browser for Cloudflare login...");
        const loginSuccess = await promptWranglerLogin();
        if (loginSuccess) {
          console.log("");
          log.success("Successfully authenticated with Cloudflare!");
        } else {
          console.log("");
          log.warn("Login skipped. You can run 'wrangler login' later.");
        }
      } else {
        log.dim(
          "Skipping authentication. Run 'wrangler login' before deploying.",
        );
      }
    }
    console.log("");
  }

  // Step: Validate target directory
  currentStep++;
  console.log(
    colors.dim(`Step ${currentStep} of ${totalSteps}: Validate Target`),
  );
  const spinner1 = createSpinner("Checking target directory...").start();

  // Check if it's already a Conductor project
  if (existsSync(targetDir) && isConductorProject(targetDir)) {
    if (!options.force) {
      spinner1.error({ text: "Directory is already a Conductor project" });
      log.dim("Use --force to overwrite existing files.");
      return;
    }
    spinner1.success({ text: "Existing Conductor project (will update)" });
  } else if (existsSync(targetDir) && (await hasFiles(targetDir))) {
    if (!options.force) {
      spinner1.error({ text: "Directory is not empty" });
      log.dim("Use --force to initialize in a non-empty directory.");
      return;
    }
    spinner1.success({ text: "Directory exists (will add files)" });
  } else {
    spinner1.success({ text: `Target: ${targetName}` });
  }

  // Step: Find template
  currentStep++;
  console.log("");
  console.log(
    colors.dim(`Step ${currentStep} of ${totalSteps}: Locate Template`),
  );
  const spinner2 = createSpinner("Finding Conductor templates...").start();

  // Templates are bundled with the ensemble CLI
  const templateDir = getTemplatesDir();
  if (!existsSync(templateDir)) {
    spinner2.error({ text: "Templates not found" });
    console.log("");
    log.error("Conductor templates are missing from the ensemble CLI package.");
    log.dim("This is a bug - please report it at:");
    console.log(
      colors.accent("  https://github.com/ensemble-edge/ensemble/issues"),
    );
    return;
  }

  // Get conductor version from the template's package.json
  let conductorVersion = "^0.4.11";
  try {
    const templatePkg = JSON.parse(
      await readFile(join(templateDir, "package.json"), "utf-8"),
    );
    const depVersion = templatePkg.dependencies?.["@ensemble-edge/conductor"];
    if (depVersion) {
      conductorVersion = depVersion;
    }
  } catch {
    // Use default
  }

  spinner2.success({
    text: `Template: ${options.template} (conductor ${conductorVersion})`,
  });

  // Step: Copy files
  currentStep++;
  console.log("");
  console.log(
    colors.dim(`Step ${currentStep} of ${totalSteps}: Create Project`),
  );
  const spinner3 = createSpinner("Copying template files...").start();

  let filesCreated = 0;
  let filesSkipped = 0;

  try {
    await copyDirectory(templateDir, targetDir, {
      force: options.force,
      skipExamples: !options.examples,
      conductorVersion,
      onFile: (_path, status) => {
        if (status === "created" || status === "overwritten") {
          filesCreated++;
        } else {
          filesSkipped++;
        }
      },
    });

    let statusText = `Created ${filesCreated} files`;
    if (filesSkipped > 0) {
      statusText += ` (${filesSkipped} skipped)`;
    }
    spinner3.success({ text: statusText });
  } catch (err) {
    spinner3.error({ text: "Failed to copy template files" });
    log.error(String(err));
    return;
  }

  // Step: AI Provider Setup (if not skipped)
  if (needsSecrets) {
    currentStep++;
    console.log("");
    console.log(
      colors.dim(`Step ${currentStep} of ${totalSteps}: AI Provider Setup`),
    );
    console.log("");
    log.info("Configure an AI provider for your agents.");
    console.log("");

    // Show provider options
    console.log(colors.bold("  Available providers:"));
    console.log(
      "    1. Anthropic (Claude) - Recommended for complex reasoning",
    );
    console.log("    2. OpenAI (GPT-4) - Broad capability model");
    console.log("    3. Cloudflare Workers AI - Zero configuration, built-in");
    console.log("    4. Skip for now");
    console.log("");

    // Get provider selection (or use --provider flag)
    let selectedProvider: AIProviderKey | null = null;

    if (options.provider && options.provider in AI_PROVIDERS) {
      selectedProvider = options.provider as AIProviderKey;
      log.dim(
        `Using provider from --provider flag: ${AI_PROVIDERS[selectedProvider].name}`,
      );
    } else {
      const providerChoice = await readLine(
        colors.accent("  Select provider [1-4]: "),
      );

      switch (providerChoice) {
        case "1":
          selectedProvider = "anthropic";
          break;
        case "2":
          selectedProvider = "openai";
          break;
        case "3":
          selectedProvider = "cloudflare";
          break;
        default:
          selectedProvider = null;
      }
    }

    if (selectedProvider) {
      const provider = AI_PROVIDERS[selectedProvider];
      console.log("");

      if (provider.secretName) {
        // Provider needs an API key
        log.info(`Get your ${provider.name} API key at: ${provider.docsUrl}`);
        console.log("");

        const apiKey = await readLine(
          colors.accent(`  ${provider.secretName}: `),
        );

        if (apiKey && apiKey.trim()) {
          // Validate key format (basic check)
          const keyValid =
            !provider.keyFormat || apiKey.startsWith(provider.keyFormat);

          if (!keyValid) {
            log.warn(
              `Key doesn't start with expected prefix (${provider.keyFormat})`,
            );
          }

          // Store the secret
          const secretSpinner = createSpinner(
            `Storing ${provider.secretName}...`,
          ).start();

          // Note: wrangler secret requires being in a project directory with wrangler.toml
          // For new projects, we'll need to store it after npm install
          // For now, show instructions instead
          secretSpinner.warn({
            text: `Run this after npm install: wrangler secret put ${provider.secretName}`,
          });

          log.dim("  The secret will be stored securely in Cloudflare.");
        } else {
          log.dim(
            `Skipped. Set up later with: wrangler secret put ${provider.secretName}`,
          );
        }
      } else {
        // Cloudflare Workers AI - no key needed
        log.success("Cloudflare Workers AI is ready to use!");
        log.dim("  No API key required - uses Workers AI binding.");
        log.dim("  Make sure your wrangler.toml includes: [ai]");
        log.dim('  binding = "AI"');
      }
    } else {
      log.dim("Skipped AI setup. Configure later with 'wrangler secret put'.");
    }
  }

  // Success summary
  console.log("");
  const cdCmd = directory === "." ? "" : `cd ${directory}`;
  const nextSteps = [
    cdCmd ? `${cdCmd}` : null,
    "npm install",
    "npx wrangler dev",
  ]
    .filter(Boolean)
    .map((step, i) => `${i + 1}. ${step}`)
    .join("\n");

  console.log(
    successBox(
      "Conductor project created!",
      `Project: ${targetName}
Template: ${options.template}

Next steps:
${nextSteps}

Key directories:
  ensembles/   Your AI workflows
  agents/      AI agents and functions
  prompts/     Prompt templates`,
    ),
  );

  console.log("");
  log.dim("Docs: https://docs.ensemble.ai/conductor");

  // Show hints about related products
  showInitHints("conductor");
}

// ─────────────────────────────────────────────────────────────────────────────
// Conductor Validate
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate Conductor project configuration
 */
export async function conductorValidate(_args: string[]): Promise<void> {
  banners.conductor();
  console.log("");

  // Check if we're in a Conductor project
  if (!isConductorProject(process.cwd())) {
    log.error("Not a Conductor project.");
    log.dim("Run this command from a Conductor project directory.");
    return;
  }

  // For now, validation is not yet implemented
  log.warn("Validation via ensemble CLI coming soon...");
  log.dim("Validation will be available in a future release.");
}

// ─────────────────────────────────────────────────────────────────────────────
// Conductor Keys
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Manage Conductor API keys
 */
export async function conductorKeys(_args: string[]): Promise<void> {
  banners.conductor();
  console.log("");

  log.warn("Key management via ensemble CLI coming soon...");
  log.dim("For now, manage keys via wrangler secrets:");
  console.log(colors.accent("  wrangler secret put ANTHROPIC_API_KEY"));
  console.log(colors.accent("  wrangler secret put OPENAI_API_KEY"));
}

// ─────────────────────────────────────────────────────────────────────────────
// Conductor Help
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Show conductor help
 */
export function showConductorHelp(): void {
  banners.conductor();
  console.log(colors.bold("Commands:"));
  console.log("  init [dir]      Initialize a new Conductor project");
  console.log("  dev             Start development server (wrangler dev)");
  console.log("  deploy          Deploy to production (wrangler deploy)");
  console.log("  validate        Validate project configuration");
  console.log("  keys            Manage API keys");
  console.log("");
  console.log(colors.bold("Init Options:"));
  console.log("  -y, --yes           Non-interactive mode (skip all prompts)");
  console.log("  --template <name>   Template to use (default: cloudflare)");
  console.log("  --force             Overwrite existing files");
  console.log("  --no-examples       Skip example files");
  console.log("  --skip-auth         Skip Cloudflare authentication check");
  console.log("  --skip-secrets      Skip AI provider setup");
  console.log(
    "  --provider <name>   AI provider (anthropic, openai, cloudflare)",
  );
  console.log("");
  console.log(colors.bold("Examples:"));
  console.log(colors.accent("  ensemble conductor init my-project"));
  console.log(colors.accent("  ensemble conductor init my-project --yes"));
  console.log(colors.accent("  ensemble conductor init ."));
  console.log(
    colors.accent("  ensemble conductor init my-project --no-examples"),
  );
  console.log(colors.accent("  ensemble conductor dev"));
  console.log("");
  console.log(
    colors.dim("Docs:"),
    colors.underline("https://docs.ensemble.ai/conductor"),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Wrangler Passthrough
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run a wrangler command
 */
async function runWrangler(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("wrangler", [cmd, ...args], {
      stdio: "inherit",
      shell: true,
    });

    child.on("close", () => resolve());
    child.on("error", (err) => {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        log.error("Wrangler not found.");
        log.dim("Install: npm install -g wrangler");
      }
      reject(err);
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Route Command
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Route conductor subcommands
 */
export async function routeConductorCommand(args: string[]): Promise<void> {
  const [subCmd, ...subArgs] = args;

  if (!subCmd || subCmd === "--help" || subCmd === "-h") {
    showConductorHelp();
    return;
  }

  switch (subCmd) {
    case "init":
      await conductorInit(subArgs);
      break;
    case "dev":
      await runWrangler("dev", subArgs);
      break;
    case "deploy":
      await runWrangler("deploy", subArgs);
      break;
    case "validate":
      await conductorValidate(subArgs);
      break;
    case "keys":
      await conductorKeys(subArgs);
      break;
    default:
      log.error(`Unknown conductor command: ${subCmd}`);
      log.dim("Run `ensemble conductor --help` for available commands.");
  }
}

/**
 * AI Provider Wizard
 *
 * Handles AI provider configuration:
 * - Provider selection (Anthropic, OpenAI, Cloudflare AI, Groq)
 * - API key storage via wrangler secrets
 * - wrangler.toml AI binding updates
 * - index.ts AI type updates
 */

import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import {
  colors,
  log,
  createSpinner,
  promptSelect,
  promptPassword,
  isInteractive,
  successBox,
} from "../ui/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type AIProvider = "anthropic" | "openai" | "cloudflare" | "groq";

export interface AIWizardOptions {
  /** Skip confirmation prompts */
  yes?: boolean;
  /** Pre-select a provider */
  provider?: AIProvider;
  /** Working directory for project files */
  cwd?: string;
  /** Whether to show the initial confirmation prompt (for init flow) */
  showInitialPrompt?: boolean;
  /** Whether to show success box at the end */
  showSuccessBox?: boolean;
}

export interface AIWizardResult {
  /** Whether configuration was successful */
  success: boolean;
  /** The provider that was configured */
  provider?: AIProvider;
  /** Whether user skipped configuration */
  skipped: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider Configuration
// ─────────────────────────────────────────────────────────────────────────────

export const AI_PROVIDERS: Record<
  AIProvider,
  {
    name: string;
    description: string;
    secretName: string;
    envVar: string;
    docsUrl: string;
    needsApiKey: boolean;
  }
> = {
  anthropic: {
    name: "Anthropic",
    description: "Claude models (recommended)",
    secretName: "ANTHROPIC_API_KEY",
    envVar: "ANTHROPIC_API_KEY",
    docsUrl: "https://console.anthropic.com/settings/keys",
    needsApiKey: true,
  },
  openai: {
    name: "OpenAI",
    description: "GPT-4 and GPT-3.5 models",
    secretName: "OPENAI_API_KEY",
    envVar: "OPENAI_API_KEY",
    docsUrl: "https://platform.openai.com/api-keys",
    needsApiKey: true,
  },
  cloudflare: {
    name: "Cloudflare Workers AI",
    description: "Built-in, no API key needed",
    secretName: "",
    envVar: "",
    docsUrl: "https://developers.cloudflare.com/workers-ai/",
    needsApiKey: false,
  },
  groq: {
    name: "Groq",
    description: "Fast inference with Llama and Mixtral",
    secretName: "GROQ_API_KEY",
    envVar: "GROQ_API_KEY",
    docsUrl: "https://console.groq.com/keys",
    needsApiKey: true,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get the wrangler.toml path if it exists
 */
function getWranglerPath(cwd: string): string | null {
  const tomlPath = resolve(cwd, "wrangler.toml");
  const jsonPath = resolve(cwd, "wrangler.json");

  if (existsSync(tomlPath)) return tomlPath;
  if (existsSync(jsonPath)) return jsonPath;
  return null;
}

/**
 * Store a secret using wrangler
 */
export async function storeSecret(
  name: string,
  value: string,
  cwd?: string,
): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn("wrangler", ["secret", "put", name], {
      cwd,
      stdio: ["pipe", "inherit", "inherit"],
      shell: true,
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
 * Enable AI binding in wrangler.toml
 */
export async function enableAIBinding(cwd: string): Promise<boolean> {
  const wranglerPath = getWranglerPath(cwd);
  if (!wranglerPath || !wranglerPath.endsWith(".toml")) {
    return false;
  }

  try {
    let content = await readFile(wranglerPath, "utf-8");

    // Check if AI binding is already enabled (uncommented)
    if (/^\[ai\]/m.test(content)) {
      // Already enabled
      return true;
    }

    // Check if AI binding is commented out (various formats)
    // Format 1: Standard commented section
    if (/^#\s*\[ai\]/m.test(content)) {
      content = content.replace(
        /^#\s*\[ai\]\s*\n#\s*binding\s*=\s*"AI"/m,
        '[ai]\nbinding = "AI"',
      );
      await writeFile(wranglerPath, content);
      return true;
    }

    // Format 2: Multi-line comment block (from init template)
    if (content.includes("# Uncomment to enable Cloudflare Workers AI")) {
      content = content.replace(
        /# Uncomment to enable Cloudflare Workers AI\n# Run:.*\n# Or manually uncomment.*\n# \[ai\]\n# binding = "AI"/,
        '[ai]\nbinding = "AI"',
      );
      await writeFile(wranglerPath, content);
      return true;
    }

    // AI section doesn't exist, add it
    content += `\n[ai]\nbinding = "AI"\n`;
    await writeFile(wranglerPath, content);
    return true;
  } catch {
    return false;
  }
}

/**
 * Update index.ts to uncomment AI type (for newly initialized projects)
 */
async function enableAITypeInIndex(cwd: string): Promise<boolean> {
  const indexPath = resolve(cwd, "src/index.ts");

  if (!existsSync(indexPath)) {
    return false;
  }

  try {
    let content = await readFile(indexPath, "utf-8");

    // Check if it has the commented AI type from our template
    if (content.includes("// Uncomment when AI binding is enabled")) {
      content = content.replace(
        "// Uncomment when AI binding is enabled in wrangler.toml\n  // AI: Ai;",
        "AI: Ai;",
      );
      await writeFile(indexPath, content);
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Wizard
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run the AI provider wizard
 *
 * Used by both init (during setup) and configure ai (post-init).
 *
 * @param options - Wizard options
 * @returns Result indicating success/skip status
 */
export async function aiWizard(
  options: AIWizardOptions = {},
): Promise<AIWizardResult> {
  const interactive = isInteractive() && !options.yes;
  const cwd = options.cwd || process.cwd();
  const showSuccessBox = options.showSuccessBox ?? true;

  // Check if we're in a valid project (has wrangler.toml)
  const wranglerPath = getWranglerPath(cwd);
  if (!wranglerPath) {
    log.error("No wrangler.toml found.");
    log.newline();
    log.plain("Run this command from an Ensemble project directory.");
    log.plain(
      `Or create a new project: ${colors.accent("ensemble conductor init")}`,
    );
    return { success: false, skipped: false };
  }

  // Initial prompt (for init flow)
  if (options.showInitialPrompt && interactive) {
    const { promptConfirm } = await import("../ui/index.js");
    const shouldConfigure = await promptConfirm("Configure AI provider?", true);

    if (!shouldConfigure) {
      log.info("Skipped. Run 'ensemble configure ai' anytime to set up.");
      return { success: true, skipped: true };
    }
  }

  // Select provider
  let provider: AIProvider | "skip" = options.provider || "anthropic";

  if (!options.provider && interactive) {
    provider = await promptSelect<AIProvider | "skip">("Select AI provider:", [
      {
        title: `${AI_PROVIDERS.cloudflare.name} ${colors.dim(`— ${AI_PROVIDERS.cloudflare.description}`)}`,
        value: "cloudflare",
      },
      {
        title: `${AI_PROVIDERS.anthropic.name} ${colors.dim(`— ${AI_PROVIDERS.anthropic.description}`)}`,
        value: "anthropic",
      },
      {
        title: `${AI_PROVIDERS.openai.name} ${colors.dim(`— ${AI_PROVIDERS.openai.description}`)}`,
        value: "openai",
      },
      {
        title: `${AI_PROVIDERS.groq.name} ${colors.dim(`— ${AI_PROVIDERS.groq.description}`)}`,
        value: "groq",
      },
      {
        title: colors.dim("Skip for now"),
        value: "skip",
      },
    ]);
  }

  // Handle skip
  if (provider === "skip") {
    log.info("Skipped. Run 'ensemble configure ai' anytime to set up.");
    return { success: true, skipped: true };
  }

  const providerConfig = AI_PROVIDERS[provider];
  log.newline();

  // ─────────────────────────────────────────────────────────────────────────
  // Cloudflare AI - No API key needed
  // ─────────────────────────────────────────────────────────────────────────

  if (provider === "cloudflare") {
    log.info(
      `Using ${colors.bold("Cloudflare Workers AI")} — no API key needed!`,
    );
    log.newline();

    // Enable AI binding
    const spinner = createSpinner("Enabling AI binding...").start();
    const bindingEnabled = await enableAIBinding(cwd);
    const typeEnabled = await enableAITypeInIndex(cwd);

    if (bindingEnabled) {
      spinner.success({ text: "AI binding enabled in wrangler.toml" });
      if (typeEnabled) {
        log.dim("  Updated src/index.ts with AI type");
      }
    } else {
      spinner.warn({
        text: "Could not update wrangler.toml — add [ai] binding manually",
      });
    }

    if (showSuccessBox) {
      log.newline();
      console.log(successBox("Cloudflare AI configured!"));
      log.newline();
      log.plain(colors.bold("Next steps:"));
      log.newline();
      console.log(`  ${colors.accent("pnpm run dev")}`);
      log.newline();
      log.dim(`Docs: ${providerConfig.docsUrl}`);
    } else {
      log.success("Enabled Cloudflare Workers AI");
    }

    return { success: true, provider: "cloudflare", skipped: false };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Other providers - Need API key
  // ─────────────────────────────────────────────────────────────────────────

  log.plain(`Get your API key: ${colors.underline(providerConfig.docsUrl)}`);
  log.newline();

  let apiKey = "";

  if (interactive) {
    apiKey = await promptPassword(`${providerConfig.name} API key:`);

    if (!apiKey.trim()) {
      log.warn("No API key provided. Skipping secret storage.");
      log.newline();
      log.plain("You can set it later with:");
      console.log(
        `  ${colors.accent(`wrangler secret put ${providerConfig.secretName}`)}`,
      );
      return { success: true, provider, skipped: true };
    }
  } else {
    log.error("API key required. Use interactive mode or set via wrangler:");
    console.log(
      `  ${colors.accent(`wrangler secret put ${providerConfig.secretName}`)}`,
    );
    return { success: false, skipped: false };
  }

  log.newline();

  // Store the secret
  const secretSpinner = createSpinner(
    `Storing ${providerConfig.secretName}...`,
  ).start();
  const secretStored = await storeSecret(
    providerConfig.secretName,
    apiKey,
    cwd,
  );

  if (secretStored) {
    secretSpinner.success({
      text: `Secret stored: ${providerConfig.secretName}`,
    });
  } else {
    secretSpinner.error({ text: "Failed to store secret" });
    log.newline();
    log.plain("Try manually:");
    console.log(
      `  ${colors.accent(`wrangler secret put ${providerConfig.secretName}`)}`,
    );
    return { success: false, provider, skipped: false };
  }

  // Enable AI binding (for providers that use it)
  const bindingSpinner = createSpinner("Enabling AI binding...").start();
  const bindingEnabled = await enableAIBinding(cwd);

  if (bindingEnabled) {
    bindingSpinner.success({ text: "AI binding enabled in wrangler.toml" });
  } else {
    bindingSpinner.warn({
      text: "Could not update wrangler.toml — add [ai] binding manually",
    });
  }

  if (showSuccessBox) {
    log.newline();
    console.log(successBox(`${providerConfig.name} configured!`));
    log.newline();
    log.plain(colors.bold("Next steps:"));
    log.newline();
    console.log(`  ${colors.accent("pnpm run dev")}`);
    log.newline();
  }

  return { success: true, provider, skipped: false };
}

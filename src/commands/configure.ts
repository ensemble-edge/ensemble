/**
 * Configuration wizards for Ensemble projects
 *
 * Provides interactive configuration for:
 * - AI providers (Anthropic, OpenAI, Cloudflare AI, Groq)
 * - Cloudflare authentication
 * - Ensemble Cloud connection
 *
 * Can be run anytime after project creation to add/modify configuration.
 *
 * Uses shared wizards from ../wizards/ to stay in sync with init flow.
 */

import { existsSync } from "node:fs";
import {
  colors,
  log,
  banners,
  promptSelect,
  isInteractive,
} from "../ui/index.js";
import { aiWizard, type AIProvider } from "../wizards/index.js";
import { authWizard } from "../wizards/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ConfigureOptions {
  yes?: boolean;
  provider?: AIProvider;
}

// ─────────────────────────────────────────────────────────────────────────────
// Project Detection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if we're in a valid Ensemble project
 */
function isEnsembleProject(): boolean {
  return existsSync("wrangler.toml") || existsSync("wrangler.json");
}

// ─────────────────────────────────────────────────────────────────────────────
// Configure AI Command
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Configure AI provider for the project
 */
export async function configureAI(
  options: ConfigureOptions = {},
): Promise<void> {
  const cwd = process.cwd();

  // Check if we're in a project
  if (!isEnsembleProject()) {
    log.error("No wrangler.toml found.");
    log.newline();
    log.plain("Run this command from an Ensemble project directory.");
    log.plain(
      `Or create a new project: ${colors.accent("ensemble conductor init")}`,
    );
    return;
  }

  // Show banner and current directory
  banners.ensemble();
  log.dim(`📂 ${cwd}`);
  log.newline();

  log.plain(colors.bold("Configure AI Provider"));
  log.newline();

  // Run the shared AI wizard
  await aiWizard({
    yes: options.yes,
    provider: options.provider,
    cwd,
    showInitialPrompt: false, // Don't show "Configure AI?" prompt - they already ran the command
    showSuccessBox: true,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Configure Auth Command
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Configure Cloudflare authentication
 */
export async function configureAuth(
  options: ConfigureOptions = {},
): Promise<void> {
  const cwd = process.cwd();

  // Show banner and current directory
  banners.ensemble();
  log.dim(`📂 ${cwd}`);
  log.newline();

  log.plain(colors.bold("Configure Cloudflare Authentication"));
  log.newline();

  // Run the shared auth wizard
  await authWizard({
    yes: options.yes,
    cwd,
    skipPrompt: true, // Don't show "Configure auth?" prompt - they already ran the command
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Configure Command
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Show configuration menu or route to specific config
 */
export async function configure(
  subcommand?: string,
  options: ConfigureOptions = {},
): Promise<void> {
  const interactive = isInteractive() && !options.yes;
  const cwd = process.cwd();

  // Route to specific subcommand
  if (subcommand === "ai") {
    await configureAI(options);
    return;
  }

  if (subcommand === "auth") {
    await configureAuth(options);
    return;
  }

  // Check if we're in a project for menu mode
  if (!isEnsembleProject()) {
    log.error("No wrangler.toml found.");
    log.newline();
    log.plain("Run this command from an Ensemble project directory.");
    log.plain(
      `Or create a new project: ${colors.accent("ensemble conductor init")}`,
    );
    return;
  }

  // Show banner
  banners.ensemble();
  log.dim(`📂 ${cwd}`);
  log.newline();

  // If no subcommand, show menu
  if (!subcommand && interactive) {
    const choice = await promptSelect<string>(
      "What would you like to configure?",
      [
        {
          title: `AI Provider ${colors.dim("— Anthropic, OpenAI, Cloudflare AI, Groq")}`,
          value: "ai",
        },
        {
          title: `Cloudflare Auth ${colors.dim("— Login to Cloudflare")}`,
          value: "auth",
        },
        {
          title: `Ensemble Cloud ${colors.dim("— Connect to managed platform")}`,
          value: "cloud",
        },
        {
          title: "Exit",
          value: "exit",
        },
      ],
    );

    if (choice === "exit") {
      return;
    }

    if (choice === "cloud") {
      log.newline();
      log.info("Use 'ensemble cloud init' to connect to Ensemble Cloud.");
      return;
    }

    log.newline();
    await configure(choice, options);
    return;
  }

  // Show help if no subcommand and not interactive
  showConfigureHelp();
}

/**
 * Show configure help
 */
export function showConfigureHelp(): void {
  console.log(`${colors.bold("Configure:")}
  ai              Configure AI provider (Anthropic, OpenAI, Cloudflare AI, Groq)
  auth            Configure Cloudflare authentication

${colors.bold("Options:")}
  --provider <p>  Pre-select AI provider (anthropic, openai, cloudflare, groq)
  -y, --yes       Skip confirmation prompts

${colors.bold("Examples:")}
  ${colors.accent("ensemble configure")}              ${colors.dim("(interactive menu)")}
  ${colors.accent("ensemble configure ai")}           ${colors.dim("(AI provider wizard)")}
  ${colors.accent("ensemble configure ai --provider anthropic")}
  ${colors.accent("ensemble configure auth")}         ${colors.dim("(Cloudflare login)")}

${colors.dim("Docs:")} ${colors.underline("https://docs.ensemble.ai/conductor/configure")}
`);
}

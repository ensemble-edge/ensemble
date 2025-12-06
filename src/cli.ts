/**
 * Ensemble CLI - Main entry point
 *
 * Unified CLI for the Ensemble ecosystem:
 * - ensemble conductor  → AI workflow orchestration
 * - ensemble edgit      → Component versioning
 * - ensemble chamber    → Edge data layer
 * - ensemble cloud      → Managed platform connection
 * - ensemble <wrangler> → Passthrough to wrangler
 */

import { colors, banners, log } from "./ui/index.js";
import { route } from "./router.js";
import { showEcosystemStatus } from "./discovery.js";
import { showVersion } from "./commands/version.js";

/**
 * Print the main help message
 */
function printHelp(): void {
  banners.ensemble();
  console.log(`Usage: ensemble <command> [options]

${colors.bold("Products:")}
  conductor     Orchestrate AI workflows
  edgit         Version components
  chamber       Edge data lake ${colors.dim("(coming soon)")}
  cloud         Managed platform

${colors.bold("Commands:")}
  configure     Configure AI providers, secrets, and more

${colors.bold("Options:")}
  -v, --version  Show version and check for updates
  -h, --help     Show help

${colors.bold("Wrangler (passthrough):")}
  dev, deploy, tail, secret, kv, d1, r2...
  All wrangler commands work directly.

${colors.bold("Getting Started:")}
  ${colors.accent("npx @ensemble-edge/ensemble")}

${colors.bold("Examples:")}
  ${colors.accent("ensemble conductor init my-project")}
  ${colors.accent("ensemble conductor init --setup starter")}
  ${colors.accent("ensemble edgit tag create prompt v1.0.0")}
  ${colors.accent("pnpm run dev")}
  ${colors.accent("pnpm run deploy")}

${colors.dim("Docs:")} ${colors.underline("https://docs.ensemble.ai")}
`);
}

/**
 * Main CLI entry point
 */
export async function run(argv: string[] = process.argv): Promise<void> {
  // Remove 'node' and script path from argv
  const args = argv.slice(2);

  // Handle global flags
  if (args[0] === "--help" || args[0] === "-h") {
    printHelp();
    showEcosystemStatus();
    return;
  }

  if (args[0] === "--version" || args[0] === "-v") {
    await showVersion();
    return;
  }

  // Route the command (empty args launches wizard!)
  try {
    await route(args);
  } catch (error) {
    if (error instanceof Error) {
      log.error(error.message);
    }
    process.exit(1);
  }
}

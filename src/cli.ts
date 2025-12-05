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

import { version } from "./version.js";
import { colors, banners, log } from "./ui/index.js";
import { route } from "./router.js";
import { showEcosystemStatus } from "./discovery.js";

/**
 * Print the main help message
 */
function printHelp(): void {
  banners.ensemble();
  console.log(`Usage: ensemble <command> [options]

${colors.bold("Products:")}
  conductor     Orchestrate AI workflows
  edgit         Version components
  chamber       Edge data layer
  cloud         Managed platform

${colors.bold("Options:")}
  -v, --version  Show version
  -h, --help     Show help

${colors.bold("Wrangler (passthrough):")}
  dev, deploy, tail, secret, kv, d1, r2...
  All wrangler commands work directly.

${colors.bold("Getting Started:")}
  ${colors.accent("npx @ensemble-edge/ensemble")}

${colors.bold("Examples:")}
  ${colors.accent("ensemble conductor init my-project")}
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
    console.log(`ensemble v${version}`);
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

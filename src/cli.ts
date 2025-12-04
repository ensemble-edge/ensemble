import { Command } from "commander";
import pc from "picocolors";
import { version } from "./version.js";
import { route } from "./router.js";

const BANNER = `
  ${pc.magenta("🎼")} ${pc.bold("Ensemble")}
  ${pc.dim("AI orchestration for Cloudflare Workers")}
`;

export async function run(argv: string[] = process.argv): Promise<void> {
  const program = new Command();

  program
    .name("ensemble")
    .description("Unified CLI for the Ensemble ecosystem")
    .version(version, "-v, --version", "Show version")
    .addHelpText("beforeAll", BANNER)
    .allowUnknownOption(true)
    .allowExcessArguments(true);

  // Parse to get the command
  program.parse(argv);

  const args = program.args;

  if (args.length === 0) {
    program.outputHelp();
    return;
  }

  // Route the command
  await route(args);
}

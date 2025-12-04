import { spawn } from "node:child_process";
import pc from "picocolors";

/**
 * Ensemble products handled internally
 */
const ENSEMBLE_PRODUCTS = ["conductor", "chamber", "cloud", "edgit"];

/**
 * Global ensemble commands
 */
const ENSEMBLE_GLOBAL = ["login", "config", "help", "version"];

/**
 * Route commands to the appropriate handler
 */
export async function route(argv: string[]): Promise<void> {
  const [cmd, ...args] = argv;

  if (!cmd) {
    console.log(
      pc.dim("No command provided. Run `ensemble --help` for usage."),
    );
    return;
  }

  // Check if this is an Ensemble product or global command
  if (ENSEMBLE_PRODUCTS.includes(cmd) || ENSEMBLE_GLOBAL.includes(cmd)) {
    await runEnsembleCommand(cmd, args);
  } else {
    // Wrangler passthrough
    await runWranglerCommand(cmd, args);
  }
}

/**
 * Run an internal Ensemble command
 */
async function runEnsembleCommand(cmd: string, args: string[]): Promise<void> {
  switch (cmd) {
    case "conductor":
      await runConductorCommand(args);
      break;
    case "edgit":
      await runEdgitCommand(args);
      break;
    case "chamber":
      console.log(pc.yellow("Chamber commands coming soon..."));
      break;
    case "cloud":
      console.log(pc.yellow("Cloud commands coming soon..."));
      break;
    case "login":
      console.log(pc.yellow("Login command coming soon..."));
      break;
    case "config":
      console.log(pc.yellow("Config command coming soon..."));
      break;
    default:
      console.log(pc.red(`Unknown command: ${cmd}`));
  }
}

/**
 * Run a Conductor command
 */
async function runConductorCommand(args: string[]): Promise<void> {
  // For now, pass through to the conductor CLI
  // In the future, we'll import conductor commands directly
  return new Promise((resolve, reject) => {
    const child = spawn("conductor", args, {
      stdio: "inherit",
      shell: true,
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Conductor exited with code ${code}`));
      }
    });

    child.on("error", (err) => {
      // If conductor isn't installed, show helpful message
      console.log(pc.yellow("\n  Conductor CLI not found."));
      console.log(
        pc.dim("  Install it with: npm install -g @ensemble-edge/conductor\n"),
      );
      reject(err);
    });
  });
}

/**
 * Run an Edgit command
 */
async function runEdgitCommand(args: string[]): Promise<void> {
  // For now, pass through to the edgit CLI
  // In the future, we'll import edgit commands directly
  return new Promise((resolve, reject) => {
    const child = spawn("edgit", args, {
      stdio: "inherit",
      shell: true,
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Edgit exited with code ${code}`));
      }
    });

    child.on("error", (err) => {
      console.log(pc.yellow("\n  Edgit CLI not found."));
      console.log(pc.dim("  Install it with: npm install -g edgit\n"));
      reject(err);
    });
  });
}

/**
 * Pass through to wrangler
 */
async function runWranglerCommand(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("wrangler", [cmd, ...args], {
      stdio: "inherit",
      shell: true,
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        // Don't reject on non-zero exit - let wrangler's error messages show
        resolve();
      }
    });

    child.on("error", (err) => {
      console.log(pc.yellow("\n  Wrangler not found."));
      console.log(pc.dim("  Install it with: npm install -g wrangler\n"));
      reject(err);
    });
  });
}

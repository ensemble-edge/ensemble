/**
 * Upgrade Command
 *
 * Scans for all Ensemble projects and upgrades them interactively.
 *
 * Features:
 * - Scans for all Ensemble projects in subdirectories by default
 * - Interactive selection of projects to upgrade
 * - Supports --all flag to upgrade everything
 * - Detects package manager per project
 * - Shows what will be upgraded before proceeding
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import {
  colors,
  log,
  createSpinner,
  promptConfirm,
  promptSelect,
  isInteractive,
} from "../ui/index.js";
import { version as cliVersion } from "../version.js";
import {
  getLandscape,
  displayLandscape,
  type ProjectInfo,
  type PackageInfo,
  type LandscapeInfo,
} from "./landscape.js";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface UpgradeOptions {
  /** Upgrade all packages without prompting */
  all?: boolean;
  /** Skip confirmation prompts */
  yes?: boolean;
  /** Show what would be upgraded without actually upgrading */
  dryRun?: boolean;
  /** Upgrade globally installed CLI */
  global?: boolean;
}

type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

// ─────────────────────────────────────────────────────────────────────────────
// Package Manager Detection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detect the package manager for a directory
 */
function detectPackageManager(dir: string): PackageManager {
  if (existsSync(resolve(dir, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(resolve(dir, "yarn.lock"))) return "yarn";
  if (existsSync(resolve(dir, "bun.lockb"))) return "bun";
  if (existsSync(resolve(dir, "package-lock.json"))) return "npm";

  // Default to npm
  return "npm";
}

/**
 * Get the upgrade command for a package manager
 */
function getUpgradeCommand(
  pm: PackageManager,
  packages: PackageInfo[],
  options: { global?: boolean } = {},
): { cmd: string; args: string[] } {
  const pkgNames = packages.map((p) => `${p.name}@latest`);
  const globalFlag = options.global;

  switch (pm) {
    case "pnpm":
      if (globalFlag) {
        return { cmd: "pnpm", args: ["add", "-g", ...pkgNames] };
      }
      return { cmd: "pnpm", args: ["add", ...pkgNames] };

    case "yarn":
      if (globalFlag) {
        return { cmd: "yarn", args: ["global", "add", ...pkgNames] };
      }
      return { cmd: "yarn", args: ["add", ...pkgNames] };

    case "bun":
      if (globalFlag) {
        return { cmd: "bun", args: ["add", "-g", ...pkgNames] };
      }
      return { cmd: "bun", args: ["add", ...pkgNames] };

    case "npm":
    default:
      if (globalFlag) {
        return { cmd: "npm", args: ["install", "-g", ...pkgNames] };
      }
      return { cmd: "npm", args: ["install", ...pkgNames] };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// NPM Registry
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch latest version from npm registry
 */
async function fetchLatestVersion(packageName: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://registry.npmjs.org/${packageName}/latest`,
      {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(5000),
      },
    );

    if (!response.ok) return null;

    const data = (await response.json()) as { version?: string };
    return data.version ?? null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Upgrade Execution
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Execute upgrade command in a directory
 */
async function executeUpgrade(
  dir: string,
  pm: PackageManager,
  packages: PackageInfo[],
  options: { dryRun?: boolean },
): Promise<boolean> {
  const { cmd, args } = getUpgradeCommand(pm, packages);

  if (options.dryRun) {
    console.log(colors.dim(`  Would run in ${dir}:`));
    console.log(`    ${colors.accent(`${cmd} ${args.join(" ")}`)}`);
    return true;
  }

  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd: dir,
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
 * Execute global CLI upgrade
 */
async function executeGlobalUpgrade(
  pm: PackageManager,
  options: { dryRun?: boolean },
): Promise<boolean> {
  const cliPackage: PackageInfo = {
    name: "@ensemble-edge/ensemble",
    shortName: "ensemble",
    installed: cliVersion,
    hasUpdate: true,
  };

  const { cmd, args } = getUpgradeCommand(pm, [cliPackage], { global: true });

  if (options.dryRun) {
    console.log(colors.dim("Would run:"));
    console.log(`  ${colors.accent(`${cmd} ${args.join(" ")}`)}`);
    return true;
  }

  console.log(colors.dim(`Running: ${cmd} ${args.join(" ")}`));
  console.log("");

  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
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
// Help
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Show upgrade help
 */
export function showUpgradeHelp(): void {
  console.log(`
${colors.bold("Ensemble Upgrade")}

Scan and upgrade Ensemble packages across all projects.

${colors.bold("Usage:")}
  ensemble upgrade              Interactive upgrade (scans subdirectories)
  ensemble upgrade --all        Upgrade all projects without prompting
  ensemble upgrade --global     Upgrade globally installed CLI only

${colors.bold("Options:")}
  --all, -a       Upgrade all projects without prompting
  --yes, -y       Skip confirmation prompts
  --dry-run       Show what would be upgraded without upgrading
  --global, -g    Upgrade globally installed ensemble CLI only

${colors.bold("Examples:")}
  ${colors.accent("ensemble upgrade")}                # Scan and interactive upgrade
  ${colors.accent("ensemble upgrade --all")}          # Upgrade all found projects
  ${colors.accent("ensemble upgrade --all --yes")}    # Upgrade all without confirmation
  ${colors.accent("ensemble upgrade --global")}       # Upgrade global CLI only
  ${colors.accent("ensemble upgrade --dry-run")}      # Preview what would be upgraded
`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Command
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Main upgrade command
 */
export async function runUpgrade(options: UpgradeOptions = {}): Promise<void> {
  // Handle explicit global upgrade
  if (options.global) {
    await upgradeGlobal(options);
    return;
  }

  // Scan for projects
  const spinner = createSpinner("Scanning for Ensemble projects...");
  spinner.start();

  const landscape = await getLandscape(process.cwd(), 3);
  spinner.stop();

  // Display what we found
  console.log("");
  displayLandscape(landscape);
  console.log("");

  // Check if there's anything to upgrade
  const projectsToUpgrade = landscape.projects.filter((p) => p.hasUpdates);
  const hasCliUpdate = landscape.cliHasUpdate;
  const totalUpdates = landscape.totalPackageUpdates + (hasCliUpdate ? 1 : 0);

  if (totalUpdates === 0) {
    console.log(colors.success("✓ Everything is up to date!"));
    return;
  }

  // Build upgrade plan
  interface UpgradePlan {
    cli: boolean;
    projects: ProjectInfo[];
  }

  let plan: UpgradePlan;

  if (options.all) {
    // Upgrade everything
    plan = {
      cli: hasCliUpdate,
      projects: projectsToUpgrade,
    };
  } else if (!isInteractive()) {
    // Non-interactive without --all: just show info
    console.log(colors.dim("Use --all to upgrade all packages:"));
    console.log(`  ${colors.accent("ensemble upgrade --all")}`);
    return;
  } else {
    // Interactive selection
    const choices: Array<{
      value: string;
      title: string;
      description?: string;
    }> = [];

    if (hasCliUpdate && landscape.cliLatest) {
      choices.push({
        value: "cli",
        title: `Global CLI (${cliVersion} → ${landscape.cliLatest})`,
        description: "Upgrade the globally installed ensemble CLI",
      });
    }

    if (projectsToUpgrade.length > 0) {
      choices.push({
        value: "all-projects",
        title: `All projects (${landscape.totalPackageUpdates} packages across ${projectsToUpgrade.length} projects)`,
        description: "Upgrade all Ensemble projects found",
      });

      choices.push({
        value: "select-projects",
        title: "Select projects...",
        description: "Choose which projects to upgrade",
      });
    }

    if (hasCliUpdate && projectsToUpgrade.length > 0) {
      choices.unshift({
        value: "everything",
        title: `Everything (${totalUpdates} updates total)`,
        description: "Upgrade CLI and all projects",
      });
    }

    choices.push({
      value: "cancel",
      title: "Cancel",
      description: "Don't upgrade anything",
    });

    const choice = await promptSelect<string>(
      "What would you like to upgrade?",
      choices,
    );

    if (choice === "cancel") {
      console.log("");
      log.dim("Upgrade cancelled.");
      return;
    }

    if (choice === "everything") {
      plan = { cli: true, projects: projectsToUpgrade };
    } else if (choice === "cli") {
      plan = { cli: true, projects: [] };
    } else if (choice === "all-projects") {
      plan = { cli: false, projects: projectsToUpgrade };
    } else {
      // Select projects individually
      const selectedProjects: ProjectInfo[] = [];
      for (const project of projectsToUpgrade) {
        const pkgSummary = project.packages
          .filter((p) => p.hasUpdate)
          .map((p) => `${p.shortName} ${p.installed} → ${p.latest}`)
          .join(", ");

        const shouldUpgrade = await promptConfirm(
          `Upgrade ${colors.accent(project.relativePath)}? ${colors.dim(`(${pkgSummary})`)}`,
          true,
        );

        if (shouldUpgrade) {
          selectedProjects.push(project);
        }
      }

      plan = { cli: false, projects: selectedProjects };
    }
  }

  // Nothing selected
  if (!plan.cli && plan.projects.length === 0) {
    console.log("");
    log.dim("No packages selected for upgrade.");
    return;
  }

  // Show upgrade summary
  console.log("");
  console.log(colors.bold("Upgrade Plan:"));

  if (plan.cli && landscape.cliLatest) {
    console.log(
      `  ${colors.dim("•")} Global CLI: ${cliVersion} → ${colors.success(landscape.cliLatest)}`,
    );
  }

  for (const project of plan.projects) {
    const updates = project.packages.filter((p) => p.hasUpdate);
    const summary = updates.map((p) => `${p.shortName}`).join(", ");
    console.log(`  ${colors.dim("•")} ${project.relativePath}: ${summary}`);
  }

  // Confirm unless --yes
  if (!options.yes && !options.dryRun) {
    console.log("");
    const confirmed = await promptConfirm("Proceed with upgrade?", true);
    if (!confirmed) {
      console.log("");
      log.dim("Upgrade cancelled.");
      return;
    }
  }

  console.log("");

  // Execute upgrades
  let allSuccess = true;

  // Upgrade CLI first
  if (plan.cli) {
    const pm = detectPackageManager(process.cwd());
    console.log(colors.bold("Upgrading global CLI..."));

    const success = await executeGlobalUpgrade(pm, { dryRun: options.dryRun });
    if (success) {
      console.log(colors.success("✓ Global CLI upgraded"));
    } else {
      console.log(colors.error("✗ Global CLI upgrade failed"));
      allSuccess = false;
    }
    console.log("");
  }

  // Upgrade projects
  for (const project of plan.projects) {
    const pm = detectPackageManager(project.path);
    const packagesToUpgrade = project.packages.filter((p) => p.hasUpdate);

    console.log(colors.bold(`Upgrading ${project.relativePath}...`));

    const success = await executeUpgrade(project.path, pm, packagesToUpgrade, {
      dryRun: options.dryRun,
    });

    if (success) {
      console.log(colors.success(`✓ ${project.relativePath} upgraded`));
    } else {
      console.log(colors.error(`✗ ${project.relativePath} upgrade failed`));
      allSuccess = false;
    }
    console.log("");
  }

  // Summary
  if (options.dryRun) {
    console.log(colors.dim("Dry run complete. No changes were made."));
  } else if (allSuccess) {
    console.log(colors.success("✓ All upgrades complete!"));
  } else {
    log.warn("Some upgrades failed. Check the output above for errors.");
  }
}

/**
 * Upgrade globally installed CLI only
 */
async function upgradeGlobal(options: UpgradeOptions): Promise<void> {
  console.log("");
  console.log(colors.bold("Global CLI Upgrade"));
  console.log("");

  console.log(`Current version: ${colors.dim(cliVersion)}`);

  const spinner = createSpinner("Checking for updates...");
  spinner.start();

  const latest = await fetchLatestVersion("@ensemble-edge/ensemble");
  spinner.stop();

  if (!latest) {
    log.error("Could not fetch latest version from npm registry.");
    return;
  }

  console.log(`Latest version:  ${colors.accent(latest)}`);
  console.log("");

  if (latest === cliVersion) {
    console.log(colors.success("✓ Already on the latest version!"));
    return;
  }

  // Confirm unless --yes
  if (!options.yes && !options.dryRun) {
    const confirmed = await promptConfirm(
      `Upgrade from ${colors.dim(cliVersion)} to ${colors.success(latest)}?`,
      true,
    );
    if (!confirmed) {
      console.log("");
      log.dim("Upgrade cancelled.");
      return;
    }
  }

  console.log("");

  const pm = detectPackageManager(process.cwd());
  const success = await executeGlobalUpgrade(pm, { dryRun: options.dryRun });

  if (success && !options.dryRun) {
    console.log("");
    console.log(colors.success("✓ Global CLI upgraded!"));
    console.log(colors.dim("Run 'ensemble --version' to verify."));
  } else if (!success) {
    console.log("");
    log.error("Upgrade failed. You may need to run with sudo:");
    console.log(
      `  ${colors.accent(`sudo ${pm} install -g @ensemble-edge/ensemble@latest`)}`,
    );
  }
}

/**
 * Enhanced version command
 *
 * Shows current CLI version plus project context:
 * - Detects Ensemble packages in current project
 * - Checks npm registry for latest versions
 * - Shows upgrade instructions
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { colors, log, banners } from "../ui/index.js";
import { version as cliVersion } from "../version.js";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface PackageJson {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface PackageInfo {
  name: string;
  installed: string;
  latest?: string;
  hasUpdate?: boolean;
}

interface ProjectContext {
  name?: string;
  type?: "conductor" | "edgit" | "cloud" | "unknown";
  packages: PackageInfo[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const ENSEMBLE_PACKAGES = [
  "@ensemble-edge/ensemble",
  "@ensemble-edge/conductor",
  "@ensemble-edge/edgit",
  "@ensemble-edge/cloud",
  "@ensemble-edge/chamber",
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Project Detection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detect the project type from installed packages
 */
function detectProjectType(
  deps: Record<string, string>,
): ProjectContext["type"] {
  if (deps["@ensemble-edge/conductor"]) return "conductor";
  if (deps["@ensemble-edge/edgit"]) return "edgit";
  if (deps["@ensemble-edge/cloud"]) return "cloud";
  return "unknown";
}

/**
 * Read and parse package.json from a directory
 */
async function readPackageJson(dir: string): Promise<PackageJson | null> {
  const pkgPath = resolve(dir, "package.json");
  if (!existsSync(pkgPath)) return null;

  try {
    const content = await readFile(pkgPath, "utf-8");
    return JSON.parse(content) as PackageJson;
  } catch {
    return null;
  }
}

/**
 * Check if a version string is a tag (like "latest", "next", "beta")
 * rather than a semver version
 */
function isVersionTag(version: string): boolean {
  // Tags don't contain numbers at the start and don't have dots
  // e.g., "latest", "next", "beta" vs "1.0.0", "^1.0.0"
  return !/^\d|^[\^~]\d/.test(version);
}

/**
 * Get the installed version from a semver range
 *
 * Strips ^ or ~ prefix to get the base version
 */
function cleanVersion(version: string): string {
  return version.replace(/^[\^~]/, "");
}

/**
 * Detect project context from current directory
 */
async function detectProjectContext(): Promise<ProjectContext | null> {
  const pkg = await readPackageJson(process.cwd());
  if (!pkg) return null;

  const allDeps = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
  };

  // Find installed Ensemble packages
  const packages: PackageInfo[] = [];

  // Always include the CLI itself first
  packages.push({
    name: "@ensemble-edge/ensemble",
    installed: cliVersion,
  });

  // Add other installed packages
  for (const name of ENSEMBLE_PACKAGES) {
    // Skip ensemble since we already added it
    if (name === "@ensemble-edge/ensemble") continue;

    const version = allDeps[name];
    if (version) {
      packages.push({
        name,
        installed: cleanVersion(version),
      });
    }
  }

  // Need at least the CLI + one project package to show the table
  if (packages.length === 1) return null;

  return {
    name: pkg.name,
    type: detectProjectType(allDeps),
    packages,
  };
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
        signal: AbortSignal.timeout(5000), // 5 second timeout
      },
    );

    if (!response.ok) return null;

    const data = (await response.json()) as { version?: string };
    return data.version ?? null;
  } catch {
    // Network error or timeout - fail silently
    return null;
  }
}

/**
 * Fetch latest versions for all packages in parallel
 */
async function fetchLatestVersions(
  packages: PackageInfo[],
): Promise<PackageInfo[]> {
  const results = await Promise.all(
    packages.map(async (pkg) => {
      const latest = await fetchLatestVersion(pkg.name);

      // If installed version is a tag like "latest", resolve it to the actual version
      const installedIsTag = isVersionTag(pkg.installed);
      let displayInstalled = pkg.installed;
      let hasUpdate = false;

      if (installedIsTag && latest) {
        // "latest" tag means they're always on latest - show actual version
        displayInstalled = latest;
        hasUpdate = false; // They're on "latest", so always up to date
      } else if (latest) {
        hasUpdate = latest !== pkg.installed;
      }

      return {
        ...pkg,
        installed: displayInstalled,
        latest: latest ?? undefined,
        hasUpdate,
      };
    }),
  );
  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Display
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get the display name for a package
 */
function shortName(name: string): string {
  return name.replace("@ensemble-edge/", "");
}

/**
 * Show version information
 */
export async function showVersion(): Promise<void> {
  // Always show CLI version
  console.log(`${colors.bold("ensemble")} v${cliVersion}`);
  console.log("");

  // Try to detect project context
  const context = await detectProjectContext();

  if (!context) {
    console.log(
      colors.dim("Run from a project directory to check for package updates."),
    );
    return;
  }

  // Show project info
  const projectType = context.type !== "unknown" ? ` (${context.type})` : "";
  console.log(
    `${colors.bold("Project:")} ${context.name ?? "unnamed"}${colors.dim(projectType)}`,
  );
  console.log("");

  // Fetch latest versions
  const packages = await fetchLatestVersions(context.packages);

  // Calculate column widths
  const nameWidth = Math.max(
    ...packages.map((p) => shortName(p.name).length),
    7, // "Package" header
  );
  const versionWidth = Math.max(
    ...packages.map((p) => p.installed.length),
    9, // "Installed" header
  );
  const latestWidth = Math.max(
    ...packages.map((p) => (p.latest ?? "...").length),
    6, // "Latest" header
  );

  // Table header
  const header = `${colors.dim("│")} ${"Package".padEnd(nameWidth)} ${colors.dim("│")} ${"Installed".padEnd(versionWidth)} ${colors.dim("│")} ${"Latest".padEnd(latestWidth)} ${colors.dim("│")}`;
  const separator = colors.dim(
    `├${"─".repeat(nameWidth + 2)}┼${"─".repeat(versionWidth + 2)}┼${"─".repeat(latestWidth + 4)}┤`,
  );
  const topBorder = colors.dim(
    `┌${"─".repeat(nameWidth + 2)}┬${"─".repeat(versionWidth + 2)}┬${"─".repeat(latestWidth + 4)}┐`,
  );
  const bottomBorder = colors.dim(
    `└${"─".repeat(nameWidth + 2)}┴${"─".repeat(versionWidth + 2)}┴${"─".repeat(latestWidth + 4)}┘`,
  );

  console.log(topBorder);
  console.log(header);
  console.log(separator);

  // Table rows
  const hasUpdates: PackageInfo[] = [];

  for (const pkg of packages) {
    const name = shortName(pkg.name).padEnd(nameWidth);
    const installed = pkg.installed.padEnd(versionWidth);
    const latest = (pkg.latest ?? colors.dim("...")).padEnd(latestWidth);

    let indicator = " ";
    if (pkg.hasUpdate) {
      indicator = colors.warning("⬆");
      hasUpdates.push(pkg);
    } else if (pkg.latest && !pkg.hasUpdate) {
      indicator = colors.success("✓");
    }

    console.log(
      `${colors.dim("│")} ${name} ${colors.dim("│")} ${installed} ${colors.dim("│")} ${latest} ${indicator} ${colors.dim("│")}`,
    );
  }

  console.log(bottomBorder);

  // Show upgrade instructions if updates available
  if (hasUpdates.length > 0) {
    console.log("");

    // Detect package manager
    const pm = detectPackageManager();

    if (hasUpdates.length === 1) {
      console.log(
        `${colors.dim("To upgrade:")} ${colors.accent(`${pm} update ${hasUpdates[0]!.name}`)}`,
      );
    } else {
      console.log(colors.dim("To upgrade:"));
      for (const pkg of hasUpdates) {
        console.log(`  ${colors.accent(`${pm} update ${pkg.name}`)}`);
      }
    }
  }
}

/**
 * Detect the package manager being used
 */
function detectPackageManager(): "npm" | "pnpm" | "yarn" | "bun" {
  const cwd = process.cwd();

  if (existsSync(resolve(cwd, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(resolve(cwd, "yarn.lock"))) return "yarn";
  if (existsSync(resolve(cwd, "bun.lockb"))) return "bun";
  if (existsSync(resolve(cwd, "package-lock.json"))) return "npm";

  // Check user agent (if run via npx, npm, etc.)
  const userAgent = process.env.npm_config_user_agent ?? "";
  if (userAgent.includes("pnpm")) return "pnpm";
  if (userAgent.includes("yarn")) return "yarn";
  if (userAgent.includes("bun")) return "bun";

  return "npm";
}

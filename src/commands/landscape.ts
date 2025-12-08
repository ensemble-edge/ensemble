/**
 * Landscape Scanner
 *
 * Scans for all Ensemble projects in the current directory tree.
 * Used by both `ensemble --version` and `ensemble upgrade` to show
 * a unified view of all projects and their update status.
 */

import { existsSync, readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve, basename, relative } from "node:path";
import { colors, log, createSpinner } from "../ui/index.js";
import { version as cliVersion } from "../version.js";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface PackageJson {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export interface PackageInfo {
  name: string;
  shortName: string;
  installed: string;
  latest?: string;
  hasUpdate: boolean;
}

export interface ProjectInfo {
  path: string;
  relativePath: string;
  name: string;
  type: "conductor" | "edgit" | "cloud" | "mixed" | "unknown";
  packages: PackageInfo[];
  hasUpdates: boolean;
  updateCount: number;
}

export interface LandscapeInfo {
  scanRoot: string;
  cliVersion: string;
  cliLatest?: string;
  cliHasUpdate: boolean;
  projects: ProjectInfo[];
  totalProjects: number;
  projectsWithUpdates: number;
  totalPackageUpdates: number;
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

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  ".cache",
  "coverage",
  ".turbo",
  ".vercel",
  ".wrangler",
  "out",
  ".output",
]);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

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
 * Clean version string (remove ^ or ~ prefix)
 */
function cleanVersion(version: string): string {
  return version.replace(/^[\^~]/, "");
}

/**
 * Resolve actual installed version from node_modules
 * Handles cases where package.json specifies "latest" or other tags
 */
async function resolveInstalledVersion(
  dir: string,
  packageName: string,
  declaredVersion: string,
): Promise<string> {
  // If it's a proper semver, just clean and return it
  if (/^\d+\.\d+\.\d+/.test(cleanVersion(declaredVersion))) {
    return cleanVersion(declaredVersion);
  }

  // For "latest", "*", or other tags, check node_modules for actual version
  try {
    const pkgPath = resolve(dir, "node_modules", packageName, "package.json");
    const content = await readFile(pkgPath, "utf-8");
    const pkg = JSON.parse(content) as { version?: string };
    if (pkg.version) {
      return pkg.version;
    }
  } catch {
    // Fall back to declared version if we can't read node_modules
  }

  return cleanVersion(declaredVersion);
}

/**
 * Check if a version is a workspace reference (internal monorepo package)
 */
function isWorkspaceVersion(version: string): boolean {
  return version.startsWith("workspace:");
}

/**
 * Get short package name
 */
function shortName(name: string): string {
  return name.replace("@ensemble-edge/", "");
}

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

/**
 * Detect project type from packages
 */
function detectProjectType(
  packages: PackageInfo[],
): "conductor" | "edgit" | "cloud" | "mixed" | "unknown" {
  const names = packages.map((p) => p.name);
  const hasConductor = names.includes("@ensemble-edge/conductor");
  const hasEdgit = names.includes("@ensemble-edge/edgit");
  const hasCloud = names.includes("@ensemble-edge/cloud");

  const count = [hasConductor, hasEdgit, hasCloud].filter(Boolean).length;
  if (count > 1) return "mixed";
  if (hasConductor) return "conductor";
  if (hasEdgit) return "edgit";
  if (hasCloud) return "cloud";
  return "unknown";
}

/**
 * Detect packages in a directory
 * Returns empty array if this looks like an internal monorepo package
 */
async function detectPackagesInDir(dir: string): Promise<PackageInfo[]> {
  const pkg = await readPackageJson(dir);
  if (!pkg) return [];

  const packages: PackageInfo[] = [];
  let hasWorkspaceRef = false;

  for (const name of ENSEMBLE_PACKAGES) {
    // Skip the CLI itself in project detection
    if (name === "@ensemble-edge/ensemble") continue;

    const depVersion = pkg.dependencies?.[name];
    const devDepVersion = pkg.devDependencies?.[name];
    const version = depVersion || devDepVersion;

    if (version) {
      // Skip workspace references - these are internal monorepo packages
      if (isWorkspaceVersion(version)) {
        hasWorkspaceRef = true;
        continue;
      }

      // Resolve actual installed version (handles "latest", "*", etc.)
      const installedVersion = await resolveInstalledVersion(dir, name, version);

      packages.push({
        name,
        shortName: shortName(name),
        installed: installedVersion,
        hasUpdate: false,
      });
    }
  }

  // If any ensemble package uses workspace:*, this is likely an internal package
  // Return empty to skip this directory entirely
  if (hasWorkspaceRef && packages.length === 0) {
    return [];
  }

  return packages;
}

// ─────────────────────────────────────────────────────────────────────────────
// Scanner
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Scan for all Ensemble projects
 */
export async function scanForProjects(
  rootDir: string,
  maxDepth: number = 3,
): Promise<ProjectInfo[]> {
  const projects: ProjectInfo[] = [];

  async function scan(dir: string, depth: number): Promise<void> {
    if (depth > maxDepth) return;

    const packages = await detectPackagesInDir(dir);
    if (packages.length > 0) {
      const pkg = await readPackageJson(dir);
      projects.push({
        path: dir,
        relativePath: relative(rootDir, dir) || ".",
        name: pkg?.name ?? basename(dir),
        type: detectProjectType(packages),
        packages,
        hasUpdates: false,
        updateCount: 0,
      });
      // Don't recurse into projects
      return;
    }

    // Scan subdirectories
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (SKIP_DIRS.has(entry.name)) continue;
        if (entry.name.startsWith(".")) continue;

        await scan(resolve(dir, entry.name), depth + 1);
      }
    } catch {
      // Skip on error
    }
  }

  await scan(rootDir, 0);
  return projects;
}

/**
 * Check for updates across all projects
 */
export async function checkAllUpdates(
  projects: ProjectInfo[],
): Promise<ProjectInfo[]> {
  // Collect unique packages to check
  const uniquePackages = new Set<string>();
  for (const project of projects) {
    for (const pkg of project.packages) {
      uniquePackages.add(pkg.name);
    }
  }

  // Fetch all latest versions in parallel
  const latestVersions = new Map<string, string>();
  await Promise.all(
    Array.from(uniquePackages).map(async (name) => {
      const latest = await fetchLatestVersion(name);
      if (latest) {
        latestVersions.set(name, latest);
      }
    }),
  );

  // Update projects with latest info
  return projects.map((project) => {
    let updateCount = 0;
    const updatedPackages = project.packages.map((pkg) => {
      const latest = latestVersions.get(pkg.name);
      const hasUpdate = latest ? latest !== pkg.installed : false;
      if (hasUpdate) updateCount++;

      return {
        ...pkg,
        latest,
        hasUpdate,
      };
    });

    return {
      ...project,
      packages: updatedPackages,
      hasUpdates: updateCount > 0,
      updateCount,
    };
  });
}

/**
 * Get full landscape info including CLI version
 */
export async function getLandscape(
  rootDir: string = process.cwd(),
  maxDepth: number = 3,
): Promise<LandscapeInfo> {
  // Scan for projects
  let projects = await scanForProjects(rootDir, maxDepth);

  // Check CLI version
  const cliLatest = await fetchLatestVersion("@ensemble-edge/ensemble");
  const cliHasUpdate = cliLatest ? cliLatest !== cliVersion : false;

  // Check all project updates
  projects = await checkAllUpdates(projects);

  // Calculate totals
  const projectsWithUpdates = projects.filter((p) => p.hasUpdates).length;
  const totalPackageUpdates = projects.reduce(
    (sum, p) => sum + p.updateCount,
    0,
  );

  return {
    scanRoot: rootDir,
    cliVersion,
    cliLatest: cliLatest ?? undefined,
    cliHasUpdate,
    projects,
    totalProjects: projects.length,
    projectsWithUpdates,
    totalPackageUpdates,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Display
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Display landscape in tree view format
 */
export function displayLandscape(landscape: LandscapeInfo): void {
  // CLI header
  console.log(`${colors.bold("ensemble")} v${landscape.cliVersion}`);
  if (landscape.cliHasUpdate && landscape.cliLatest) {
    console.log(
      `${colors.dim("  └─")} ${colors.warning("update available:")} ${landscape.cliLatest}`,
    );
  }
  console.log("");

  // Show scan location
  console.log(colors.dim(`Scanning ${landscape.scanRoot}`));
  console.log("");

  if (landscape.projects.length === 0) {
    console.log(colors.dim("No Ensemble projects found in this directory."));
    console.log("");
    console.log(colors.dim("To create a new project:"));
    console.log(`  ${colors.accent("ensemble conductor init my-project")}`);
    console.log(`  ${colors.accent("ensemble edgit init")}`);
    return;
  }

  // Projects header
  console.log(colors.bold("Ensemble Projects"));
  console.log(colors.dim("─".repeat(60)));
  console.log("");

  // Project tree
  for (const project of landscape.projects) {
    // Project line
    const typeLabel = colors.dim(`[${project.type}]`);
    const statusIcon = project.hasUpdates
      ? colors.warning(`⬆ ${project.updateCount}`)
      : colors.success("✓");

    console.log(`  ${colors.accent(project.relativePath + "/")}  ${typeLabel}`);

    // Package lines
    for (let i = 0; i < project.packages.length; i++) {
      const pkg = project.packages[i];
      const isLast = i === project.packages.length - 1;
      const prefix = isLast ? "└─" : "├─";

      if (pkg.hasUpdate && pkg.latest) {
        console.log(
          `  ${colors.dim(prefix)} ${pkg.shortName} ${colors.dim(pkg.installed)} → ${colors.success(pkg.latest)}  ${colors.warning("⬆")}`,
        );
      } else {
        console.log(
          `  ${colors.dim(prefix)} ${pkg.shortName} ${colors.dim(pkg.installed)}  ${colors.success("✓")}`,
        );
      }
    }
    console.log("");
  }

  // Summary
  console.log(colors.dim("─".repeat(60)));

  const projectsText = `${landscape.totalProjects} project${landscape.totalProjects !== 1 ? "s" : ""}`;

  if (landscape.projectsWithUpdates > 0 || landscape.cliHasUpdate) {
    const parts: string[] = [];
    if (landscape.projectsWithUpdates > 0) {
      parts.push(
        `${landscape.projectsWithUpdates} ${landscape.projectsWithUpdates === 1 ? "has" : "have"} updates`,
      );
    }
    if (landscape.cliHasUpdate) {
      parts.push("CLI update available");
    }
    console.log(`${projectsText} · ${colors.warning(parts.join(" · "))}`);
    console.log("");
    console.log(`Run ${colors.accent("ensemble upgrade")} to update`);
  } else {
    console.log(`${projectsText} · ${colors.success("all up to date")}`);
  }
}

/**
 * Display landscape in compact format (for non-interactive)
 */
export function displayLandscapeCompact(landscape: LandscapeInfo): void {
  console.log(`ensemble v${landscape.cliVersion}`);

  if (landscape.projects.length === 0) {
    console.log("No Ensemble projects found.");
    return;
  }

  for (const project of landscape.projects) {
    const packages = project.packages
      .map((p) => `${p.shortName}@${p.installed}`)
      .join(", ");
    const status = project.hasUpdates
      ? `[${project.updateCount} updates]`
      : "[ok]";
    console.log(`  ${project.relativePath}: ${packages} ${status}`);
  }

  if (landscape.projectsWithUpdates > 0) {
    console.log(
      `\n${landscape.projectsWithUpdates} projects have updates available`,
    );
  }
}

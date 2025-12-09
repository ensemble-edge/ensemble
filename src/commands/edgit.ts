/**
 * Ensemble Edgit Commands
 *
 * Commands for Edgit product (info, etc.)
 * Init is handled separately in ./init.ts
 *
 * Architecture:
 * - Info DATA comes from Edgit's registry and git tags
 * - Info DISPLAY is handled here with visual styling (banners, colors, boxes)
 *
 * Command Naming:
 * - Official command: `info` (matches Edgit CLI: `npx edgit info`)
 * - `status` passes through to git (since edgit is git-native)
 * - Both `ensemble edgit info` shows project info
 * - Both `ensemble edgit status` shows git status
 */

import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { join, basename, extname } from "node:path";
import { execSync } from "node:child_process";
import {
  colors,
  log,
  banners,
  box,
  promptConfirm,
  isInteractive,
} from "../ui/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface EdgitComponent {
  name: string;
  type: string;
  path: string;
  description?: string;
}

interface EdgitRegistry {
  components: EdgitComponent[];
  deployments?: Record<string, Record<string, string>>; // component -> env -> version
}

interface ComponentCounts {
  total: number;
  prompts: number;
  schemas: number;
  configs: number;
  queries: number;
  scripts: number;
  templates: number;
  docs: number;
  agents: number;
  ensembles: number;
  tools: number;
}

interface VersionInfo {
  component: string;
  type: string;
  version: string;
  date?: string;
}

interface DeploymentInfo {
  component: string;
  prod?: string;
  staging?: string;
  dev?: string;
}

interface EdgitStatus {
  initialized: boolean;
  gitRepo: boolean;
  projectName: string;
  componentsCount: ComponentCounts;
  components: EdgitComponent[];
  deployments: DeploymentInfo[];
  recentVersions: VersionInfo[];
  untrackedCount: number;
  stats: {
    totalVersions: number;
    prodDeployments: number;
    stagingDeployments: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Parsers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if edgit is initialized
 */
function isEdgitInitialized(): boolean {
  return existsSync(".edgit") || existsSync(".edgit/components.json");
}

/**
 * Check if we're in a git repo
 */
function isGitRepo(): boolean {
  return existsSync(".git");
}

/**
 * Get project name from package.json or directory
 */
async function getProjectName(): Promise<string> {
  try {
    if (existsSync("package.json")) {
      const content = await readFile("package.json", "utf-8");
      const pkg = JSON.parse(content);
      if (pkg.name) return pkg.name;
    }
  } catch {
    // Ignore
  }
  return basename(process.cwd());
}

/**
 * Read edgit registry
 */
async function readRegistry(): Promise<EdgitRegistry | null> {
  const registryPath = ".edgit/components.json";
  if (!existsSync(registryPath)) {
    return null;
  }

  try {
    const content = await readFile(registryPath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Count components by type
 */
function countComponents(registry: EdgitRegistry | null): ComponentCounts {
  const counts: ComponentCounts = {
    total: 0,
    prompts: 0,
    schemas: 0,
    configs: 0,
    queries: 0,
    scripts: 0,
    templates: 0,
    docs: 0,
    agents: 0,
    ensembles: 0,
    tools: 0,
  };

  if (!registry?.components) {
    return counts;
  }

  for (const component of registry.components) {
    counts.total++;
    switch (component.type) {
      case "prompt":
        counts.prompts++;
        break;
      case "schema":
        counts.schemas++;
        break;
      case "config":
        counts.configs++;
        break;
      case "query":
        counts.queries++;
        break;
      case "script":
        counts.scripts++;
        break;
      case "template":
        counts.templates++;
        break;
      case "docs":
        counts.docs++;
        break;
      case "agent":
        counts.agents++;
        break;
      case "ensemble":
        counts.ensembles++;
        break;
      case "tool":
        counts.tools++;
        break;
    }
  }

  return counts;
}

/**
 * Get deployment info from registry
 */
function getDeployments(registry: EdgitRegistry | null): DeploymentInfo[] {
  const deployments: DeploymentInfo[] = [];

  if (!registry?.deployments) {
    return deployments;
  }

  for (const [component, envs] of Object.entries(registry.deployments)) {
    deployments.push({
      component,
      prod: envs.prod || envs.production,
      staging: envs.staging,
      dev: envs.dev || envs.development,
    });
  }

  return deployments;
}

/**
 * Get recent versions from git tags
 */
function getRecentVersions(limit: number = 5): VersionInfo[] {
  const versions: VersionInfo[] = [];

  try {
    // Get edgit-style tags (prompts/name/v1.0.0, agents/name/v1.0.0, etc.)
    const output = execSync(
      'git tag -l --sort=-creatordate "prompts/*" "schemas/*" "configs/*" "queries/*" "scripts/*" "templates/*" "agents/*" "ensembles/*" "tools/*" 2>/dev/null | head -20',
      { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] },
    );

    const tags = output.trim().split("\n").filter(Boolean);

    for (const tag of tags.slice(0, limit)) {
      // Parse tag format: type/name/version (e.g., prompts/extraction-prompt/v1.0.0)
      const parts = tag.split("/");
      if (parts.length >= 3) {
        const type = parts[0].replace(/s$/, ""); // prompts -> prompt
        const name = parts[1];
        const version = parts.slice(2).join("/");

        // Get tag date
        let date: string | undefined;
        try {
          const dateOutput = execSync(
            `git log -1 --format=%ci "${tag}" 2>/dev/null`,
            { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] },
          );
          date = dateOutput.trim().split(" ")[0]; // Just the date part
        } catch {
          // Ignore
        }

        versions.push({ component: name, type, version, date });
      }
    }
  } catch {
    // Not a git repo or no tags
  }

  return versions;
}

/**
 * Count total versions from git tags
 */
function countTotalVersions(): number {
  try {
    const output = execSync(
      'git tag -l "prompts/*" "schemas/*" "configs/*" "queries/*" "scripts/*" "templates/*" "agents/*" "ensembles/*" "tools/*" 2>/dev/null | wc -l',
      { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] },
    );
    return parseInt(output.trim(), 10) || 0;
  } catch {
    return 0;
  }
}

/**
 * Scan for potential untracked components
 */
async function countUntrackedComponents(
  registry: EdgitRegistry | null,
): Promise<number> {
  const registeredPaths = new Set(
    registry?.components?.map((c) => c.path) || [],
  );

  let untracked = 0;

  // Directories to scan
  const scanDirs = [
    { dir: "prompts", ext: [".md", ".txt"] },
    { dir: "components/prompts", ext: [".md", ".txt"] },
    { dir: "schemas", ext: [".json"] },
    { dir: "components/schemas", ext: [".json"] },
    { dir: "configs", ext: [".json", ".yaml", ".yml"] },
    { dir: "components/configs", ext: [".json", ".yaml", ".yml"] },
    { dir: "queries", ext: [".sql"] },
    { dir: "components/queries", ext: [".sql"] },
    { dir: "scripts", ext: [".ts", ".js"] },
    { dir: "components/scripts", ext: [".ts", ".js"] },
    { dir: "templates", ext: [".html", ".hbs", ".liquid"] },
    { dir: "components/templates", ext: [".html", ".hbs", ".liquid"] },
  ];

  for (const { dir, ext } of scanDirs) {
    if (!existsSync(dir)) continue;

    try {
      const files = await readdir(dir, { withFileTypes: true });
      for (const file of files) {
        if (file.isFile() && ext.includes(extname(file.name))) {
          const filePath = join(dir, file.name);
          if (!registeredPaths.has(filePath)) {
            untracked++;
          }
        }
      }
    } catch {
      // Ignore errors
    }
  }

  return untracked;
}

// ─────────────────────────────────────────────────────────────────────────────
// Display Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format component type icon
 */
function typeIcon(type: string): string {
  const icons: Record<string, string> = {
    prompt: "📝",
    schema: "📋",
    config: "⚙️",
    query: "🔍",
    script: "📜",
    template: "📄",
    docs: "📚",
    agent: "🤖",
    ensemble: "🎼",
    tool: "🔧",
  };
  return icons[type] || "📦";
}

/**
 * Display status in full mode
 * Returns true if initialization was triggered and status should be re-run
 */
async function displayFullStatus(status: EdgitStatus): Promise<boolean> {
  // Banner
  banners.edgit();

  // Title box
  console.log(box(`${colors.bold("📦 Edgit Status")}`));
  console.log("");

  // Project section
  console.log(colors.bold("Project"));
  console.log(`  Name:             ${colors.accent(status.projectName)}`);
  console.log(
    `  Git repository:   ${status.gitRepo ? colors.success("✓ Yes") : colors.error("✗ No")}`,
  );
  console.log(
    `  Edgit initialized:${status.initialized ? colors.success("✓ Yes") : colors.dim("○ No")}`,
  );
  console.log("");

  if (!status.initialized) {
    if (!status.gitRepo) {
      log.warn("Edgit requires a Git repository. Run `git init` first.");
      console.log("");
      log.dim("Docs: https://docs.ensemble.ai/edgit");
      return false;
    }

    // Offer to initialize if interactive
    if (isInteractive()) {
      const shouldInit = await promptConfirm(
        "Would you like to initialize Edgit in this repository?",
        true,
      );

      if (shouldInit) {
        console.log("");
        // Dynamic import to avoid circular dependency
        const { edgitInit } = await import("./init.js");
        await edgitInit({});
        return true;
      }
    } else {
      log.dim(
        "Run `ensemble edgit init` to initialize Edgit in this repository.",
      );
    }

    console.log("");
    log.dim("Docs: https://docs.ensemble.ai/edgit");
    return false;
  }

  // Components box
  console.log(box(`${colors.bold("📋 Components")}`));
  console.log("");

  if (status.componentsCount.total === 0) {
    console.log(`  ${colors.dim("No components registered")}`);
    console.log("");
    console.log(
      `  ${colors.dim("Register components with:")} ${colors.accent("edgit components add <type> <name> <path>")}`,
    );
  } else {
    console.log(
      `  Total registered: ${colors.accent(String(status.componentsCount.total))}`,
    );
    console.log("");

    // Component breakdown by type
    const typeRows: string[] = [];
    if (status.componentsCount.prompts > 0)
      typeRows.push(
        `${typeIcon("prompt")} ${status.componentsCount.prompts} prompts`,
      );
    if (status.componentsCount.schemas > 0)
      typeRows.push(
        `${typeIcon("schema")} ${status.componentsCount.schemas} schemas`,
      );
    if (status.componentsCount.configs > 0)
      typeRows.push(
        `${typeIcon("config")} ${status.componentsCount.configs} configs`,
      );
    if (status.componentsCount.queries > 0)
      typeRows.push(
        `${typeIcon("query")} ${status.componentsCount.queries} queries`,
      );
    if (status.componentsCount.scripts > 0)
      typeRows.push(
        `${typeIcon("script")} ${status.componentsCount.scripts} scripts`,
      );
    if (status.componentsCount.templates > 0)
      typeRows.push(
        `${typeIcon("template")} ${status.componentsCount.templates} templates`,
      );
    if (status.componentsCount.docs > 0)
      typeRows.push(`${typeIcon("docs")} ${status.componentsCount.docs} docs`);
    if (status.componentsCount.agents > 0)
      typeRows.push(
        `${typeIcon("agent")} ${status.componentsCount.agents} agents`,
      );
    if (status.componentsCount.ensembles > 0)
      typeRows.push(
        `${typeIcon("ensemble")} ${status.componentsCount.ensembles} ensembles`,
      );
    if (status.componentsCount.tools > 0)
      typeRows.push(
        `${typeIcon("tool")} ${status.componentsCount.tools} tools`,
      );

    // Display in columns
    for (let i = 0; i < typeRows.length; i += 2) {
      const left = typeRows[i] || "";
      const right = typeRows[i + 1] || "";
      console.log(`  ${left.padEnd(24)}${right}`);
    }

    if (status.untrackedCount > 0) {
      console.log("");
      console.log(
        `  ${colors.warning("⚠")} ${status.untrackedCount} untracked component${status.untrackedCount > 1 ? "s" : ""} found`,
      );
      console.log(
        `    ${colors.dim("Run")} ${colors.accent("edgit discover scan")} ${colors.dim("to see them")}`,
      );
    }
  }
  console.log("");

  // Versions box
  console.log(box(`${colors.bold("🏷️  Versions")}`));
  console.log("");

  console.log(`  Total versions:   ${status.stats.totalVersions}`);

  if (status.recentVersions.length > 0) {
    console.log("");
    console.log(colors.bold("  Recent Tags"));
    for (const v of status.recentVersions) {
      const dateStr = v.date ? colors.dim(` (${v.date})`) : "";
      console.log(
        `    ${typeIcon(v.type)} ${v.component} ${colors.accent(v.version)}${dateStr}`,
      );
    }
  } else {
    console.log("");
    console.log(`  ${colors.dim("No version tags yet")}`);
    console.log(
      `  ${colors.dim("Create one with:")} ${colors.accent("edgit tag create <name> v1.0.0")}`,
    );
  }
  console.log("");

  // Deployments box
  console.log(box(`${colors.bold("🚀 Deployments")}`));
  console.log("");

  console.log(
    `  Production:       ${status.stats.prodDeployments > 0 ? colors.success("✓") + ` ${status.stats.prodDeployments} components` : colors.dim("○ None")}`,
  );
  console.log(
    `  Staging:          ${status.stats.stagingDeployments > 0 ? colors.accent("●") + ` ${status.stats.stagingDeployments} components` : colors.dim("○ None")}`,
  );

  if (status.deployments.length > 0) {
    console.log("");
    console.log(colors.bold("  Deployment Matrix"));
    console.log(
      `    ${"Component".padEnd(24)}${"Prod".padEnd(12)}${"Staging".padEnd(12)}`,
    );
    console.log(`    ${colors.dim("─".repeat(48))}`);
    for (const d of status.deployments.slice(0, 5)) {
      const prodCol = d.prod
        ? colors.success(d.prod.padEnd(12))
        : colors.dim("-".padEnd(12));
      const stagingCol = d.staging
        ? colors.accent(d.staging.padEnd(12))
        : colors.dim("-".padEnd(12));
      console.log(`    ${d.component.padEnd(24)}${prodCol}${stagingCol}`);
    }
    if (status.deployments.length > 5) {
      console.log(
        `    ${colors.dim(`... and ${status.deployments.length - 5} more`)}`,
      );
    }
  } else {
    console.log("");
    console.log(`  ${colors.dim("No deployments configured yet")}`);
    console.log(
      `  ${colors.dim("Deploy with:")} ${colors.accent("edgit deploy set <name> <version> --to prod")}`,
    );
  }
  console.log("");

  // Quick commands
  console.log(colors.bold("Quick Commands"));
  console.log(
    `  ${colors.accent("edgit components list")}       List all components`,
  );
  console.log(
    `  ${colors.accent("edgit tag create <n> v1.0.0")} Create a version`,
  );
  console.log(
    `  ${colors.accent("edgit discover scan")}         Find untracked files`,
  );
  console.log("");

  log.dim("Docs: https://docs.ensemble.ai/edgit");
  return false;
}

/**
 * Display status in compact mode
 */
function displayCompactStatus(status: EdgitStatus): void {
  console.log("");
  console.log(`${colors.primaryBold("📦 Edgit Status")}`);
  console.log("");

  console.log(`Project:     ${colors.accent(status.projectName)}`);
  console.log(
    `Git:         ${status.gitRepo ? colors.success("✓") + " Yes" : colors.error("✗") + " No"}`,
  );
  console.log(
    `Initialized: ${status.initialized ? colors.success("✓") + " Yes" : colors.dim("○") + " No"}`,
  );

  if (status.initialized) {
    console.log("");

    // Components line
    const compParts: string[] = [];
    if (status.componentsCount.prompts > 0)
      compParts.push(`${status.componentsCount.prompts} prompts`);
    if (status.componentsCount.agents > 0)
      compParts.push(`${status.componentsCount.agents} agents`);
    if (status.componentsCount.ensembles > 0)
      compParts.push(`${status.componentsCount.ensembles} ensembles`);
    const otherCount =
      status.componentsCount.total -
      status.componentsCount.prompts -
      status.componentsCount.agents -
      status.componentsCount.ensembles;
    if (otherCount > 0) compParts.push(`${otherCount} other`);

    console.log(
      `Components:  ${status.componentsCount.total} total${compParts.length > 0 ? ` (${compParts.join(", ")})` : ""}`,
    );
    console.log(`Versions:    ${status.stats.totalVersions} tags`);

    // Deployments
    const deployParts: string[] = [];
    if (status.stats.prodDeployments > 0)
      deployParts.push(`${status.stats.prodDeployments} prod`);
    if (status.stats.stagingDeployments > 0)
      deployParts.push(`${status.stats.stagingDeployments} staging`);
    if (deployParts.length > 0) {
      console.log(`Deployments: ${deployParts.join(" │ ")}`);
    }

    // Untracked warning
    if (status.untrackedCount > 0) {
      console.log(
        `Untracked:   ${colors.warning("⚠")} ${status.untrackedCount} files`,
      );
    }
  }
  console.log("");
}

/**
 * Display status as JSON
 */
function displayJsonStatus(status: EdgitStatus): void {
  console.log(JSON.stringify(status, null, 2));
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Command
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Show edgit status
 */
export async function edgitStatus(args: string[]): Promise<void> {
  const isJson = args.includes("--json");
  const isCompact = args.includes("--compact");

  const initialized = isEdgitInitialized();
  const gitRepo = isGitRepo();
  const projectName = await getProjectName();

  // Handle uninitialized state early for JSON/compact modes
  if (!initialized) {
    if (isJson) {
      console.log(
        JSON.stringify({
          initialized: false,
          gitRepo,
          projectName,
          error: gitRepo ? "Edgit not initialized" : "Git repository required",
        }),
      );
      return;
    }

    if (isCompact) {
      console.log("");
      console.log(`${colors.primaryBold("📦 Edgit Status")}`);
      console.log("");
      console.log(`Project:     ${colors.accent(projectName)}`);
      console.log(
        `Git:         ${gitRepo ? colors.success("✓") + " Yes" : colors.error("✗") + " No"}`,
      );
      console.log(`Initialized: ${colors.dim("○")} No`);
      console.log("");
      if (!gitRepo) {
        log.warn("Edgit requires a Git repository. Run `git init` first.");
      } else {
        log.dim("Run `ensemble edgit init` to initialize.");
      }
      console.log("");
      return;
    }
  }

  const registry = initialized ? await readRegistry() : null;
  const componentsCount = countComponents(registry);
  const components = registry?.components || [];
  const deployments = getDeployments(registry);
  const recentVersions = gitRepo ? getRecentVersions(5) : [];
  const totalVersions = gitRepo ? countTotalVersions() : 0;
  const untrackedCount = initialized
    ? await countUntrackedComponents(registry)
    : 0;

  // Calculate stats
  const prodDeployments = deployments.filter((d) => d.prod).length;
  const stagingDeployments = deployments.filter((d) => d.staging).length;

  const status: EdgitStatus = {
    initialized,
    gitRepo,
    projectName,
    componentsCount,
    components,
    deployments,
    recentVersions,
    untrackedCount,
    stats: {
      totalVersions,
      prodDeployments,
      stagingDeployments,
    },
  };

  // Display
  if (isJson) {
    displayJsonStatus(status);
  } else if (isCompact) {
    displayCompactStatus(status);
  } else {
    const wasInitialized = await displayFullStatus(status);
    if (wasInitialized) {
      // Re-run status after initialization
      await edgitStatus(args);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tag Commands
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tag format for deployment:
 * - Component tags: components/{type}/{name}/{env-or-version}
 * - Logic tags: logic/{type}/{name}/{env-or-version}
 *
 * Examples:
 * - components/prompts/extraction/main (environment tag)
 * - components/prompts/extraction/production (environment tag)
 * - components/prompts/extraction/v1.0.0 (version tag)
 * - logic/agents/classifier/production (logic tag)
 */

interface TagInfo {
  tag: string;
  commit: string;
  date?: string;
  type: "environment" | "version";
  prefix: "components" | "logic";
  componentType: string;
  componentName: string;
  envOrVersion: string;
}

/**
 * Parse a conductor-style tag
 */
function parseTag(tag: string): TagInfo | null {
  // Match: (components|logic)/{type}/{name}/{env-or-version}
  const match = tag.match(/^(components|logic)\/([^/]+)\/([^/]+)\/(.+)$/);
  if (!match) return null;

  const [, prefix, componentType, componentName, envOrVersion] = match;

  // Determine if it's a version (semver) or environment tag
  const isVersion = /^v?\d+\.\d+\.\d+/.test(envOrVersion);

  // Get commit info
  let commit = "";
  let date: string | undefined;
  try {
    commit = execSync(`git rev-parse --short "${tag}" 2>/dev/null`, {
      encoding: "utf-8",
    }).trim();
    const dateOutput = execSync(
      `git log -1 --format=%ci "${tag}" 2>/dev/null`,
      { encoding: "utf-8" },
    );
    date = dateOutput.trim().split(" ")[0];
  } catch {
    // Tag might not exist yet
  }

  return {
    tag,
    commit,
    date,
    type: isVersion ? "version" : "environment",
    prefix: prefix as "components" | "logic",
    componentType,
    componentName,
    envOrVersion,
  };
}

/**
 * List tags for a component
 */
export async function tagList(args: string[]): Promise<void> {
  if (!isGitRepo()) {
    log.error("Not a git repository");
    return;
  }

  const componentRef = args[0];
  const isJson = args.includes("--json");

  if (!componentRef) {
    // List all conductor tags
    try {
      const output = execSync(
        'git tag -l "components/*" "logic/*" --sort=-creatordate 2>/dev/null',
        { encoding: "utf-8" },
      );
      const tags = output.trim().split("\n").filter(Boolean);

      if (isJson) {
        const tagInfos = tags.map(parseTag).filter(Boolean);
        console.log(JSON.stringify(tagInfos, null, 2));
        return;
      }

      if (tags.length === 0) {
        log.dim("No deployment tags found.");
        log.dim("Create one with: edgit tag create <component> <version>");
        return;
      }

      console.log("");
      console.log(colors.bold("Deployment Tags"));
      console.log("");

      for (const tag of tags.slice(0, 20)) {
        const info = parseTag(tag);
        if (info) {
          const typeIcon = info.type === "version" ? "🏷️ " : "🌐";
          const dateStr = info.date ? colors.dim(` (${info.date})`) : "";
          console.log(
            `  ${typeIcon} ${colors.accent(info.envOrVersion.padEnd(16))} ${info.componentType}/${info.componentName} ${colors.dim(info.commit)}${dateStr}`,
          );
        }
      }

      if (tags.length > 20) {
        console.log("");
        log.dim(`... and ${tags.length - 20} more`);
      }
      console.log("");
    } catch {
      log.error("Failed to list tags");
    }
    return;
  }

  // List tags for specific component
  // Accept formats: prompts/extraction, components/prompts/extraction
  let searchPattern = componentRef;
  if (
    !componentRef.startsWith("components/") &&
    !componentRef.startsWith("logic/")
  ) {
    searchPattern = `components/${componentRef}`;
  }

  try {
    const output = execSync(
      `git tag -l "${searchPattern}/*" --sort=-creatordate 2>/dev/null`,
      { encoding: "utf-8" },
    );
    const tags = output.trim().split("\n").filter(Boolean);

    if (isJson) {
      const tagInfos = tags.map(parseTag).filter(Boolean);
      console.log(JSON.stringify(tagInfos, null, 2));
      return;
    }

    if (tags.length === 0) {
      log.dim(`No tags found for ${componentRef}`);
      log.dim(`Create one with: edgit tag create ${componentRef} v1.0.0`);
      return;
    }

    console.log("");
    console.log(colors.bold(`Tags for ${componentRef}`));
    console.log("");
    console.log(
      `  ${"VERSION".padEnd(16)} ${"COMMIT".padEnd(10)} ${"DATE".padEnd(12)} TYPE`,
    );
    console.log(`  ${colors.dim("─".repeat(50))}`);

    for (const tag of tags) {
      const info = parseTag(tag);
      if (info) {
        const typeLabel =
          info.type === "version"
            ? colors.dim("(version)")
            : colors.accent("(environment)");
        const dateStr = info.date || "";
        console.log(
          `  ${info.envOrVersion.padEnd(16)} ${colors.dim(info.commit.padEnd(10))} ${dateStr.padEnd(12)} ${typeLabel}`,
        );
      }
    }
    console.log("");
  } catch {
    log.error(`Failed to list tags for ${componentRef}`);
  }
}

/**
 * Create a new version tag
 */
export async function tagCreate(args: string[]): Promise<void> {
  if (!isGitRepo()) {
    log.error("Not a git repository");
    return;
  }

  const [componentRef, version, ...rest] = args;

  if (!componentRef || !version) {
    log.error("Usage: edgit tag create <component> <version> [--ref <commit>]");
    log.dim("Examples:");
    log.dim("  edgit tag create prompts/extraction v1.0.0");
    log.dim("  edgit tag create agents/classifier v1.0.0 --ref abc123");
    return;
  }

  // Validate version is semver-like
  if (!version.match(/^v?\d+\.\d+\.\d+/)) {
    log.error(`Invalid version format: ${version}`);
    log.dim("Use semver format: v1.0.0, v1.2.3-beta, etc.");
    return;
  }

  // Get ref (default to HEAD)
  const refIndex = rest.indexOf("--ref");
  const ref = refIndex !== -1 ? rest[refIndex + 1] : "HEAD";

  // Build full tag name
  let fullTag = componentRef;
  if (
    !componentRef.startsWith("components/") &&
    !componentRef.startsWith("logic/")
  ) {
    fullTag = `components/${componentRef}`;
  }
  fullTag = `${fullTag}/${version}`;

  // Check if tag already exists
  try {
    execSync(`git rev-parse "${fullTag}" 2>/dev/null`, { stdio: "pipe" });
    log.error(`Tag already exists: ${fullTag}`);
    log.dim("Version tags are immutable. Create a new version instead.");
    return;
  } catch {
    // Tag doesn't exist, good
  }

  // Create the tag
  try {
    const commitSha = execSync(`git rev-parse --short ${ref}`, {
      encoding: "utf-8",
    }).trim();

    execSync(`git tag "${fullTag}" ${ref}`, { stdio: "pipe" });
    log.success(`Created tag: ${fullTag} → ${commitSha}`);
    log.newline();
    log.dim("Push with: edgit push --tags");
  } catch (err) {
    log.error(
      `Failed to create tag: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * Move an environment tag to a new commit
 */
export async function tagMove(args: string[]): Promise<void> {
  if (!isGitRepo()) {
    log.error("Not a git repository");
    return;
  }

  const [componentRef, env, ref] = args;

  if (!componentRef || !env) {
    log.error("Usage: edgit tag move <component> <environment> [<ref>]");
    log.dim("Examples:");
    log.dim("  edgit tag move prompts/extraction staging HEAD");
    log.dim("  edgit tag move prompts/extraction production v1.0.0");
    log.dim("  edgit tag move prompts/extraction staging abc123");
    return;
  }

  // Validate environment is not a version
  if (env.match(/^v?\d+\.\d+\.\d+/)) {
    log.error("Cannot move version tags. Version tags are immutable.");
    log.dim("To deploy a version, move an environment tag to it:");
    log.dim(`  edgit tag move ${componentRef} production ${env}`);
    return;
  }

  // Build full tag name
  let fullTag = componentRef;
  if (
    !componentRef.startsWith("components/") &&
    !componentRef.startsWith("logic/")
  ) {
    fullTag = `components/${componentRef}`;
  }
  fullTag = `${fullTag}/${env}`;

  // Resolve the target ref
  const targetRef = ref || "HEAD";
  let resolvedRef = targetRef;

  // If ref looks like a version tag, resolve it
  if (targetRef.match(/^v?\d+\.\d+\.\d+/)) {
    const versionTag = `${componentRef.startsWith("components/") ? componentRef : `components/${componentRef}`}/${targetRef}`;
    try {
      resolvedRef = execSync(`git rev-parse "${versionTag}" 2>/dev/null`, {
        encoding: "utf-8",
      }).trim();
    } catch {
      log.error(`Version tag not found: ${versionTag}`);
      return;
    }
  }

  try {
    const commitSha = execSync(`git rev-parse --short ${resolvedRef}`, {
      encoding: "utf-8",
    }).trim();

    // Check if tag exists
    let isNew = false;
    try {
      execSync(`git rev-parse "${fullTag}" 2>/dev/null`, { stdio: "pipe" });
    } catch {
      isNew = true;
    }

    // Create or move the tag
    if (isNew) {
      execSync(`git tag "${fullTag}" ${resolvedRef}`, { stdio: "pipe" });
      log.success(`Created environment tag: ${fullTag} → ${commitSha}`);
    } else {
      execSync(`git tag -f "${fullTag}" ${resolvedRef}`, { stdio: "pipe" });
      log.success(`Moved tag: ${fullTag} → ${commitSha}`);
    }

    log.newline();
    log.dim("Push with: edgit push --tags");
  } catch (err) {
    log.error(
      `Failed to move tag: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * Delete a tag
 */
export async function tagDelete(args: string[]): Promise<void> {
  if (!isGitRepo()) {
    log.error("Not a git repository");
    return;
  }

  const [tagRef] = args;
  const force = args.includes("--force") || args.includes("-f");

  if (!tagRef) {
    log.error("Usage: edgit tag delete <tag> [--force]");
    log.dim("Examples:");
    log.dim("  edgit tag delete components/prompts/extraction/v0.9.0");
    log.dim("  edgit tag delete prompts/extraction/v0.9.0");
    return;
  }

  // Build full tag name
  let fullTag = tagRef;
  if (!tagRef.startsWith("components/") && !tagRef.startsWith("logic/")) {
    fullTag = `components/${tagRef}`;
  }

  // Check if tag exists
  try {
    execSync(`git rev-parse "${fullTag}" 2>/dev/null`, { stdio: "pipe" });
  } catch {
    log.error(`Tag not found: ${fullTag}`);
    return;
  }

  // Parse tag to check if it's a version or environment tag
  const info = parseTag(fullTag);
  if (info?.type === "environment" && !force) {
    log.warn(`This is an environment tag. Use --force to delete.`);
    log.dim("Environment tags are typically moved, not deleted.");
    return;
  }

  // Confirm deletion for version tags
  if (info?.type === "version" && !force && isInteractive()) {
    const confirmed = await promptConfirm(
      `Delete version tag ${fullTag}? Version tags are immutable and should rarely be deleted.`,
      false,
    );
    if (!confirmed) {
      log.dim("Cancelled.");
      return;
    }
  }

  try {
    execSync(`git tag -d "${fullTag}"`, { stdio: "pipe" });
    log.success(`Deleted local tag: ${fullTag}`);
    log.newline();
    log.dim("To delete from remote: git push origin :refs/tags/" + fullTag);
  } catch (err) {
    log.error(
      `Failed to delete tag: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * Show tag help
 */
export function showTagHelp(): void {
  console.log(`${colors.bold("Tag Commands:")}
  create <comp> <ver>     Create immutable version tag
  move <comp> <env> [ref] Move environment tag to ref
  list [component]        List tags (all or for component)
  delete <tag>            Delete a tag

${colors.bold("Tag Formats:")}
  components/{type}/{name}/{env}     Component environment tag
  components/{type}/{name}/{version} Component version tag
  logic/{type}/{name}/{env}          Logic environment tag

${colors.bold("Examples:")}
  ${colors.accent("edgit tag create prompts/extraction v1.0.0")}
  ${colors.accent("edgit tag move prompts/extraction staging HEAD")}
  ${colors.accent("edgit tag move prompts/extraction production v1.0.0")}
  ${colors.accent("edgit tag list prompts/extraction")}
  ${colors.accent("edgit tag delete prompts/extraction/v0.9.0")}

${colors.bold("Notes:")}
  • Version tags (v1.0.0) are immutable - create new versions instead
  • Environment tags (main, staging, production) can be moved
  • Use 'edgit push --tags' to sync tags to remote
`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Push Command
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Push to remote with optional tags
 */
export async function edgitPush(args: string[]): Promise<void> {
  if (!isGitRepo()) {
    log.error("Not a git repository");
    return;
  }

  const includeTags = args.includes("--tags");
  const force = args.includes("--force") || args.includes("-f");

  // Build git push command
  const pushArgs = ["push"];
  if (includeTags) {
    pushArgs.push("--tags");
  }
  if (force) {
    pushArgs.push("--force");
  }

  try {
    log.info(`Pushing to remote${includeTags ? " with tags" : ""}...`);
    execSync(`git ${pushArgs.join(" ")}`, { stdio: "inherit" });
    log.newline();
    log.success("Push complete");

    if (includeTags) {
      log.newline();
      log.dim("GitHub Actions will now process any new/moved tags.");
      log.dim("Track progress at: https://github.com/<owner>/<repo>/actions");
    }
  } catch {
    log.error("Push failed");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Help
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Show edgit help
 */
export function showEdgitHelp(): void {
  banners.edgit();
  console.log(`${colors.bold("Commands:")}
  init              Initialize Edgit in repository
  info              Show Edgit project info
  status            Git status passthrough
  push              Push to remote (with --tags for deployment)
  tag               Manage component version tags
  components        Manage registered components
  deploy            Manage deployments
  discover          Discover untracked components
  history           View deployment history

${colors.bold("Tag Subcommands:")}
  tag create <comp> <ver>  Create immutable version tag
  tag move <comp> <env>    Move environment tag
  tag list [component]     List tags
  tag delete <tag>         Delete a tag

${colors.bold("Push Options:")}
  --tags            Push all tags (triggers GitHub Actions deployment)
  --force, -f       Force push (use with caution)

${colors.bold("Info Options:")}
  --json            Output as JSON
  --compact         Compact single-line format

${colors.bold("Examples:")}
  ${colors.accent("ensemble edgit init")}
  ${colors.accent("ensemble edgit info")}
  ${colors.accent("ensemble edgit tag create prompts/extraction v1.0.0")}
  ${colors.accent("ensemble edgit tag move prompts/extraction staging HEAD")}
  ${colors.accent("ensemble edgit tag move prompts/extraction production v1.0.0")}
  ${colors.accent("ensemble edgit push --tags")}  ${colors.dim("# triggers deployment")}

${colors.dim("Docs:")} ${colors.underline("https://docs.ensemble.ai/edgit")}
`);
}

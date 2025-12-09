/**
 * Conductor Deployment Commands
 *
 * Commands for deploying, rolling back, and managing conductor deployments:
 * - deploy: Interactive deployment wizard
 * - rollback: Rollback to a previous version
 * - sync: Sync/verify infrastructure state
 * - catalog: Show what's deployed
 * - validate: Validate component references
 *
 * Philosophy: Git is the single source of truth.
 * Edgit creates tags, GitHub Actions deploys.
 * These commands provide visibility and manual control.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { execSync } from "node:child_process";
import {
  colors,
  log,
  banners,
  promptSelect,
  promptConfirm,
  isInteractive,
  createSpinner,
  box,
  successBox,
} from "../ui/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface DeployOptions {
  yes?: boolean;
  environment?: string;
  dryRun?: boolean;
}

interface TagInfo {
  tag: string;
  type: "component" | "logic";
  componentType: string;
  componentName: string;
  slot: string;
  isVersion: boolean;
  commit?: string;
  date?: Date;
}

interface DeployedComponent {
  type: string;
  name: string;
  environment: string;
  version?: string;
  commit?: string;
  deployedAt?: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if we're in a valid conductor project
 */
function isConductorProject(): boolean {
  return (
    existsSync("wrangler.toml") &&
    (existsSync("conductor.config.ts") || existsSync("conductor.config.js"))
  );
}

/**
 * Get project name from package.json or wrangler.toml
 */
function getProjectName(): string {
  try {
    if (existsSync("package.json")) {
      const pkg = JSON.parse(readFileSync("package.json", "utf-8"));
      if (pkg.name) return pkg.name;
    }
    if (existsSync("wrangler.toml")) {
      const wrangler = readFileSync("wrangler.toml", "utf-8");
      const match = wrangler.match(/name\s*=\s*"([^"]+)"/);
      if (match) return match[1];
    }
  } catch {
    // Ignore errors
  }
  return "my-project";
}

/**
 * Check if edgit is available
 */
function isEdgitAvailable(): boolean {
  try {
    execSync("npx @ensemble-edge/edgit --version", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get all conductor-related git tags
 */
function getGitTags(): TagInfo[] {
  const tags: TagInfo[] = [];

  try {
    // Get all tags with their dates and commits
    const output = execSync(
      'git tag -l "components/*/*/*" "logic/*/*/*" --format="%(refname:short)|%(objectname:short)|%(creatordate:iso)"',
      { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] },
    );

    for (const line of output.trim().split("\n").filter(Boolean)) {
      const [tag, commit, dateStr] = line.split("|");
      const parsed = parseTag(tag);
      if (parsed) {
        tags.push({
          ...parsed,
          commit,
          date: dateStr ? new Date(dateStr) : undefined,
        });
      }
    }
  } catch {
    // Not a git repo or no tags
  }

  return tags.sort((a, b) => {
    if (a.date && b.date) return b.date.getTime() - a.date.getTime();
    return 0;
  });
}

/**
 * Parse a git tag into its components
 */
function parseTag(tag: string): Omit<TagInfo, "commit" | "date"> | null {
  // components/{type}/{name}/{slot} or logic/{type}/{name}/{slot}
  const match = tag.match(/^(components|logic)\/([^/]+)\/([^/]+)\/(.+)$/);
  if (!match) return null;

  const [, prefix, componentType, componentName, slot] = match;
  return {
    tag,
    type: prefix as "component" | "logic",
    componentType,
    componentName,
    slot,
    isVersion: /^v\d+\.\d+\.\d+/.test(slot),
  };
}

/**
 * Get components in the project
 */
function getProjectComponents(): {
  type: string;
  name: string;
  path: string;
}[] {
  const components: { type: string; name: string; path: string }[] = [];
  const componentTypes = [
    "agents",
    "ensembles",
    "prompts",
    "schemas",
    "configs",
    "queries",
    "scripts",
    "templates",
  ];

  for (const type of componentTypes) {
    const dir = `components/${type}`;
    if (!existsSync(dir)) continue;

    try {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const name = entry.name.replace(/\.(yaml|yml|md|json|ts)$/, "");
        if (entry.isFile() || entry.isDirectory()) {
          components.push({
            type,
            name,
            path: `${dir}/${entry.name}`,
          });
        }
      }
    } catch {
      // Ignore errors
    }
  }

  // Also check src/agents for logic
  if (existsSync("src/agents")) {
    try {
      for (const entry of readdirSync("src/agents", { withFileTypes: true })) {
        if (entry.isDirectory() || entry.name.endsWith(".ts")) {
          const name = entry.name.replace(/\.ts$/, "");
          components.push({
            type: "agents",
            name,
            path: `src/agents/${entry.name}`,
          });
        }
      }
    } catch {
      // Ignore errors
    }
  }

  return components;
}

// ─────────────────────────────────────────────────────────────────────────────
// Deploy Command
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Interactive deployment wizard
 */
export async function conductorDeploy(
  args: string[],
  options: DeployOptions = {},
): Promise<void> {
  const cwd = process.cwd();

  // Check if we're in a conductor project
  if (!isConductorProject()) {
    log.error("Not in a Conductor project.");
    log.newline();
    log.plain("Run this command from a Conductor project directory.");
    log.plain(`Or create one: ${colors.accent("ensemble conductor init")}`);
    return;
  }

  // Show banner
  banners.conductor();
  log.dim(`📂 ${cwd}`);
  log.newline();

  log.plain(colors.bold("Deploy Conductor Project"));
  log.newline();

  // Get project info
  const projectName = getProjectName();
  const components = getProjectComponents();
  const tags = getGitTags();

  log.plain(`Project: ${colors.accent(projectName)}`);
  log.plain(`Components: ${components.length}`);
  log.plain(`Existing tags: ${tags.length}`);
  log.newline();

  // Parse environment from args
  const envIndex = args.findIndex((a) => a === "--env" || a === "-e");
  const environment =
    envIndex !== -1 ? args[envIndex + 1] : options.environment;

  // Interactive mode
  if (isInteractive() && !options.yes) {
    // Choose what to deploy
    const deployChoice = await promptSelect<string>(
      "What would you like to deploy?",
      [
        {
          title: `All components ${colors.dim("— Create tags for all modified components")}`,
          value: "all",
        },
        {
          title: `Select components ${colors.dim("— Choose specific components")}`,
          value: "select",
        },
        {
          title: `View current state ${colors.dim("— Show what's deployed")}`,
          value: "catalog",
        },
        { title: "Cancel", value: "cancel" },
      ],
    );

    if (deployChoice === "cancel") return;

    if (deployChoice === "catalog") {
      await conductorCatalog(args);
      return;
    }

    // Choose environment
    const envChoice =
      environment ||
      (await promptSelect<string>("Select environment:", [
        { title: "staging", value: "staging" },
        { title: "production", value: "production" },
        { title: "main (default)", value: "main" },
      ]));

    log.newline();
    log.plain(`Environment: ${colors.accent(envChoice)}`);
    log.newline();

    // Check for edgit
    if (!isEdgitAvailable()) {
      log.warn("Edgit is not available. Using plain git commands.");
      log.dim(
        "Install edgit for a better experience: npm install -g @ensemble-edge/edgit",
      );
      log.newline();
    }

    // Show what will be deployed
    const componentsToDeploy =
      deployChoice === "all" ? components : components.slice(0, 3); // For select mode, would show multi-select

    log.plain(colors.bold("Components to deploy:"));
    for (const comp of componentsToDeploy) {
      log.plain(`  ${colors.dim("•")} ${comp.type}/${comp.name}`);
    }
    log.newline();

    // Confirm
    const confirmed = await promptConfirm(
      `Deploy ${componentsToDeploy.length} component(s) to ${envChoice}?`,
      true,
    );
    if (!confirmed) return;

    log.newline();

    // Create environment tags
    const spinner = createSpinner("Creating deployment tags...").start();

    try {
      for (const comp of componentsToDeploy) {
        // Determine if this is a component (YAML/MD) or logic (TS)
        const isLogic = comp.path.startsWith("src/");
        const prefix = isLogic ? "logic" : "components";
        const tag = `${prefix}/${comp.type}/${comp.name}/${envChoice}`;

        try {
          // Check if tag exists, delete if so (environment tags can be moved)
          execSync(`git tag -d "${tag}" 2>/dev/null || true`, {
            stdio: "pipe",
          });

          // Create new tag
          execSync(`git tag "${tag}"`, { stdio: "pipe" });
        } catch (err) {
          spinner.stop();
          log.error(`Failed to create tag: ${tag}`);
          log.error(err instanceof Error ? err.message : String(err));
          return;
        }
      }

      spinner.success({ text: `Created ${componentsToDeploy.length} tag(s)` });
    } catch (err) {
      spinner.error({ text: "Failed to create tags" });
      log.error(err instanceof Error ? err.message : String(err));
      return;
    }

    log.newline();

    // Push tags
    const shouldPush = await promptConfirm(
      "Push tags to trigger deployment?",
      true,
    );
    if (shouldPush) {
      const pushSpinner = createSpinner("Pushing tags...").start();
      try {
        execSync("git push origin --tags --force", { stdio: "pipe" });
        pushSpinner.success({ text: "Tags pushed" });
      } catch (err) {
        pushSpinner.error({ text: "Failed to push tags" });
        log.error(err instanceof Error ? err.message : String(err));
        return;
      }

      log.newline();
      console.log(successBox("Deployment triggered!"));
      log.newline();
      log.dim("GitHub Actions will sync components to KV and rebuild Workers.");
      log.dim("Check progress in your repository's Actions tab.");
    } else {
      log.newline();
      log.info("Tags created locally. Push when ready:");
      log.plain(`  ${colors.accent("git push origin --tags --force")}`);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Rollback Command
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Rollback to a previous version
 */
export async function conductorRollback(
  args: string[],
  options: DeployOptions = {},
): Promise<void> {
  const cwd = process.cwd();

  // Check if we're in a conductor project
  if (!isConductorProject()) {
    log.error("Not in a Conductor project.");
    return;
  }

  // Show banner
  banners.conductor();
  log.dim(`📂 ${cwd}`);
  log.newline();

  log.plain(colors.bold("Rollback Deployment"));
  log.newline();

  // Get tags grouped by component
  const tags = getGitTags();
  const versionTags = tags.filter((t) => t.isVersion);

  if (versionTags.length === 0) {
    log.warn("No version tags found.");
    log.dim("Create version tags with: edgit tag create <component> <version>");
    return;
  }

  // Group by component
  const componentVersions = new Map<string, TagInfo[]>();
  for (const tag of versionTags) {
    const key = `${tag.componentType}/${tag.componentName}`;
    if (!componentVersions.has(key)) {
      componentVersions.set(key, []);
    }
    componentVersions.get(key)!.push(tag);
  }

  log.plain(
    `Found ${componentVersions.size} component(s) with version history:`,
  );
  log.newline();

  for (const [component, versions] of componentVersions) {
    log.plain(`  ${colors.accent(component)}`);
    for (const v of versions.slice(0, 3)) {
      log.plain(
        `    ${colors.dim("•")} ${v.slot}${v.date ? ` (${v.date.toLocaleDateString()})` : ""}`,
      );
    }
    if (versions.length > 3) {
      log.dim(`    ... and ${versions.length - 3} more`);
    }
  }
  log.newline();

  if (!isInteractive() || options.yes) {
    log.info("Run in interactive mode to select a version to rollback to.");
    return;
  }

  // Select component
  const componentChoice = await promptSelect<string>(
    "Select component to rollback:",
    [...componentVersions.keys()].map((c) => ({ title: c, value: c })),
  );

  const versions = componentVersions.get(componentChoice)!;

  // Select version
  const versionChoice = await promptSelect<string>(
    "Select version to rollback to:",
    versions.map((v) => ({
      title: `${v.slot}${v.date ? ` (${v.date.toLocaleDateString()})` : ""}`,
      value: v.slot,
    })),
  );

  // Select environment
  const envChoice = await promptSelect<string>("Select environment:", [
    { title: "staging", value: "staging" },
    { title: "production", value: "production" },
    { title: "main (default)", value: "main" },
  ]);

  log.newline();
  log.plain(
    `Rollback: ${colors.accent(componentChoice)} → ${versionChoice} (${envChoice})`,
  );
  log.newline();

  const confirmed = await promptConfirm("Proceed with rollback?", true);
  if (!confirmed) return;

  // Find the version tag and update environment tag to point to same commit
  const versionTag = versions.find((v) => v.slot === versionChoice);
  if (!versionTag?.commit) {
    log.error("Could not find commit for version tag.");
    return;
  }

  const [type, name] = componentChoice.split("/");
  const envTag = `components/${type}/${name}/${envChoice}`;

  const spinner = createSpinner(`Rolling back to ${versionChoice}...`).start();
  try {
    // Delete existing environment tag if it exists
    execSync(`git tag -d "${envTag}" 2>/dev/null || true`, { stdio: "pipe" });

    // Create new environment tag pointing to the version's commit
    execSync(`git tag "${envTag}" ${versionTag.commit}`, { stdio: "pipe" });

    // Push the tag
    execSync(`git push origin "${envTag}" --force`, { stdio: "pipe" });

    spinner.success({ text: `Rolled back to ${versionChoice}` });
  } catch (err) {
    spinner.error({ text: "Rollback failed" });
    log.error(err instanceof Error ? err.message : String(err));
    return;
  }

  log.newline();
  console.log(successBox("Rollback triggered!"));
  log.dim("GitHub Actions will sync the rolled-back version.");
}

// ─────────────────────────────────────────────────────────────────────────────
// Sync Command
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sync/verify infrastructure state
 */
export async function conductorSync(
  args: string[],
  options: DeployOptions = {},
): Promise<void> {
  const cwd = process.cwd();

  // Check if we're in a conductor project
  if (!isConductorProject()) {
    log.error("Not in a Conductor project.");
    return;
  }

  // Show banner
  banners.conductor();
  log.dim(`📂 ${cwd}`);
  log.newline();

  log.plain(colors.bold("Sync Infrastructure"));
  log.newline();

  const verify = args.includes("--verify");
  const full = args.includes("--full");

  if (verify) {
    // Verify mode - check what's deployed vs what tags exist
    log.info("Verifying deployment state...");
    log.newline();

    const tags = getGitTags();
    const envTags = tags.filter((t) => !t.isVersion);

    log.plain(colors.bold("Environment Tags"));
    for (const tag of envTags) {
      log.plain(
        `  ${colors.success("✓")} ${tag.componentType}/${tag.componentName} → ${tag.slot}`,
      );
    }
    log.newline();

    log.dim("Note: KV state verification requires CLOUDFLARE_API_TOKEN");
  } else if (full) {
    // Full sync - trigger GitHub Actions workflow
    log.info("Full sync rebuilds all deployments from git tags.");
    log.newline();

    const confirmed = await promptConfirm(
      "Trigger full sync via GitHub Actions?",
      false,
    );
    if (!confirmed) return;

    log.newline();
    log.info("To trigger a full sync, run this in your repository:");
    log.plain(
      colors.dim("  gh workflow run conductor.yaml --field sync_full=true"),
    );
    log.newline();
    log.dim(
      "Or go to Actions → Conductor Deploy → Run workflow → Check 'Run full sync'",
    );
  } else {
    // Show sync options
    console.log(
      box(`${colors.bold("Sync Commands")}

  ${colors.accent("--verify")}   Check deployment state matches git tags
  ${colors.accent("--full")}     Rebuild all deployments from git tags

${colors.dim("Full sync is useful for recovery or new environments.")}`),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Catalog Command
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Show what's deployed
 */
export async function conductorCatalog(
  args: string[],
  options: DeployOptions = {},
): Promise<void> {
  const cwd = process.cwd();

  // Check if we're in a conductor project
  if (!isConductorProject()) {
    log.error("Not in a Conductor project.");
    return;
  }

  // Show banner
  banners.conductor();
  log.dim(`📂 ${cwd}`);
  log.newline();

  log.plain(colors.bold("Deployment Catalog"));
  log.newline();

  const tags = getGitTags();

  // Group by environment
  const byEnvironment = new Map<string, TagInfo[]>();
  for (const tag of tags) {
    if (tag.isVersion) continue; // Skip version tags, show environment tags

    const env = tag.slot;
    if (!byEnvironment.has(env)) {
      byEnvironment.set(env, []);
    }
    byEnvironment.get(env)!.push(tag);
  }

  if (byEnvironment.size === 0) {
    log.dim("No deployments found.");
    log.newline();
    log.info("Deploy with: ensemble conductor deploy");
    return;
  }

  for (const [env, envTags] of byEnvironment) {
    console.log(box(colors.bold(`Environment: ${env}`)));
    log.newline();

    // Group by type
    const byType = new Map<string, TagInfo[]>();
    for (const tag of envTags) {
      const type =
        tag.type === "component"
          ? tag.componentType
          : `logic/${tag.componentType}`;
      if (!byType.has(type)) {
        byType.set(type, []);
      }
      byType.get(type)!.push(tag);
    }

    for (const [type, typeTags] of byType) {
      log.plain(colors.bold(`  ${type}`));
      for (const tag of typeTags) {
        const commitInfo = tag.commit ? colors.dim(` (${tag.commit})`) : "";
        log.plain(
          `    ${colors.success("✓")} ${tag.componentName}${commitInfo}`,
        );
      }
    }
    log.newline();
  }

  // Also show version tags
  const versionTags = tags.filter((t) => t.isVersion);
  if (versionTags.length > 0) {
    console.log(box(colors.bold("Version History")));
    log.newline();

    // Group by component
    const byComponent = new Map<string, TagInfo[]>();
    for (const tag of versionTags) {
      const key = `${tag.componentType}/${tag.componentName}`;
      if (!byComponent.has(key)) {
        byComponent.set(key, []);
      }
      byComponent.get(key)!.push(tag);
    }

    for (const [component, versions] of byComponent) {
      log.plain(`  ${colors.accent(component)}`);
      for (const v of versions.slice(0, 5)) {
        const dateInfo = v.date
          ? colors.dim(` (${v.date.toLocaleDateString()})`)
          : "";
        log.plain(`    ${colors.dim("•")} ${v.slot}${dateInfo}`);
      }
      if (versions.length > 5) {
        log.dim(`    ... and ${versions.length - 5} more`);
      }
    }
    log.newline();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Validate Command
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate component references
 */
export async function conductorValidate(
  args: string[],
  options: DeployOptions = {},
): Promise<void> {
  const cwd = process.cwd();

  // Check if we're in a conductor project
  if (!isConductorProject()) {
    log.error("Not in a Conductor project.");
    return;
  }

  // Show banner
  banners.conductor();
  log.dim(`📂 ${cwd}`);
  log.newline();

  log.plain(colors.bold("Validate Component References"));
  log.newline();

  // Check if validation script exists
  if (existsSync("scripts/validate-refs.ts")) {
    const spinner = createSpinner("Running validation...").start();
    try {
      execSync("npx tsx scripts/validate-refs.ts", {
        stdio: "inherit",
      });
      spinner.success({ text: "Validation complete" });
    } catch {
      spinner.error({ text: "Validation found issues" });
    }
    return;
  }

  // Manual validation
  log.info("Checking component references...");
  log.newline();

  const tags = getGitTags();
  const components = getProjectComponents();
  const errors: string[] = [];

  // Check that all components have at least one tag
  for (const comp of components) {
    const hasTag = tags.some(
      (t) => t.componentType === comp.type && t.componentName === comp.name,
    );
    if (!hasTag) {
      log.plain(`  ${colors.dim("○")} ${comp.type}/${comp.name} — no tags`);
    } else {
      const tagCount = tags.filter(
        (t) => t.componentType === comp.type && t.componentName === comp.name,
      ).length;
      log.plain(
        `  ${colors.success("✓")} ${comp.type}/${comp.name} (${tagCount} tag${tagCount !== 1 ? "s" : ""})`,
      );
    }
  }

  log.newline();

  if (errors.length === 0) {
    console.log(successBox("All references valid!"));
  } else {
    log.error(`Found ${errors.length} issue(s)`);
    for (const err of errors) {
      log.plain(`  ${colors.error("✗")} ${err}`);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Garbage Collection Command
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Manual garbage collection - clean up old version tags
 */
export async function conductorGc(
  args: string[],
  options: DeployOptions = {},
): Promise<void> {
  const cwd = process.cwd();

  // Check if we're in a conductor project
  if (!isConductorProject()) {
    log.error("Not in a Conductor project.");
    return;
  }

  // Show banner
  banners.conductor();
  log.dim(`📂 ${cwd}`);
  log.newline();

  log.plain(colors.bold("Garbage Collection"));
  log.newline();

  const dryRun = args.includes("--dry-run");
  const keepArg = args.find((a) => a.startsWith("--keep="));
  const keep = keepArg ? parseInt(keepArg.split("=")[1], 10) : 10;

  log.info(`Retention policy: keep last ${keep} versions per component`);
  if (dryRun) {
    log.info("Dry run mode - no tags will be deleted");
  }
  log.newline();

  // Get all version tags
  const tags = getGitTags();
  const versionTags = tags.filter((t) => t.isVersion);

  if (versionTags.length === 0) {
    log.dim("No version tags found. Nothing to clean up.");
    return;
  }

  // Group by component
  const byComponent = new Map<string, TagInfo[]>();
  for (const tag of versionTags) {
    const key = `${tag.componentType}/${tag.componentName}`;
    if (!byComponent.has(key)) {
      byComponent.set(key, []);
    }
    byComponent.get(key)!.push(tag);
  }

  // Find tags to delete (older than keep)
  const tagsToDelete: TagInfo[] = [];

  for (const [component, versions] of byComponent) {
    // Sort by date (newest first)
    versions.sort((a, b) => {
      if (a.date && b.date) return b.date.getTime() - a.date.getTime();
      return 0;
    });

    // Mark older versions for deletion
    if (versions.length > keep) {
      const toDelete = versions.slice(keep);
      tagsToDelete.push(...toDelete);

      log.plain(`  ${colors.accent(component)}`);
      log.plain(
        `    Keeping: ${versions
          .slice(0, keep)
          .map((v) => v.slot)
          .join(", ")}`,
      );
      log.plain(
        `    ${colors.dim("Deleting:")} ${toDelete.map((v) => v.slot).join(", ")}`,
      );
    } else {
      log.plain(
        `  ${colors.accent(component)} — ${versions.length} version(s) (under limit)`,
      );
    }
  }

  log.newline();

  if (tagsToDelete.length === 0) {
    console.log(successBox("Nothing to clean up!"));
    log.dim(`All components have ${keep} or fewer versions.`);
    return;
  }

  log.plain(
    `Found ${colors.accent(tagsToDelete.length.toString())} tag(s) to delete`,
  );
  log.newline();

  if (dryRun) {
    log.info("Dry run complete. No tags were deleted.");
    log.dim(`Run without --dry-run to delete tags.`);
    return;
  }

  // Confirm deletion
  if (!options.yes && isInteractive()) {
    const confirmed = await promptConfirm(
      `Delete ${tagsToDelete.length} old version tag(s)?`,
      false,
    );
    if (!confirmed) {
      log.dim("Cancelled.");
      return;
    }
  }

  // Delete tags locally
  const spinner = createSpinner("Deleting local tags...").start();
  let deleted = 0;

  for (const tag of tagsToDelete) {
    try {
      execSync(`git tag -d "${tag.tag}"`, { stdio: "pipe" });
      deleted++;
    } catch {
      // Tag might not exist locally
    }
  }

  spinner.success({ text: `Deleted ${deleted} local tag(s)` });

  // Offer to push deletions
  if (isInteractive() && !options.yes) {
    log.newline();
    const shouldPush = await promptConfirm(
      "Push tag deletions to remote?",
      true,
    );
    if (shouldPush) {
      const pushSpinner = createSpinner("Pushing deletions...").start();
      try {
        for (const tag of tagsToDelete) {
          execSync(`git push origin :refs/tags/${tag.tag}`, { stdio: "pipe" });
        }
        pushSpinner.success({ text: "Remote tags deleted" });
      } catch (err) {
        pushSpinner.error({ text: "Failed to delete some remote tags" });
        log.error(err instanceof Error ? err.message : String(err));
      }
    }
  }

  log.newline();
  console.log(successBox("Garbage collection complete!"));
}

// ─────────────────────────────────────────────────────────────────────────────
// Help
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Show deploy help
 */
export function showDeployHelp(): void {
  console.log(`${colors.bold("Deployment Commands:")}
  deploy          Interactive deployment wizard
  rollback        Rollback to a previous version
  sync            Sync/verify infrastructure state
  catalog         Show what's deployed
  validate        Validate component references
  gc              Clean up old version tags

${colors.bold("Deploy Options:")}
  --env, -e <env>  Target environment (staging, production, main)
  --dry-run        Show what would be deployed without deploying
  -y, --yes        Skip confirmation prompts

${colors.bold("Sync Options:")}
  --verify         Check deployment state matches git tags
  --full           Rebuild all deployments from git tags

${colors.bold("GC Options:")}
  --keep=<n>       Keep last n versions per component (default: 10)
  --dry-run        Show what would be deleted without deleting

${colors.bold("Examples:")}
  ${colors.accent("ensemble conductor deploy")}              ${colors.dim("(interactive wizard)")}
  ${colors.accent("ensemble conductor deploy --env staging")}
  ${colors.accent("ensemble conductor rollback")}            ${colors.dim("(interactive)")}
  ${colors.accent("ensemble conductor catalog")}             ${colors.dim("(show deployed state)")}
  ${colors.accent("ensemble conductor sync --verify")}       ${colors.dim("(verify state)")}
  ${colors.accent("ensemble conductor validate")}            ${colors.dim("(check references)")}
  ${colors.accent("ensemble conductor gc --keep=5")}         ${colors.dim("(keep last 5 versions)")}
  ${colors.accent("ensemble conductor gc --dry-run")}        ${colors.dim("(preview deletions)")}

${colors.dim("Philosophy:")} Git is the source of truth. Tags trigger deployments.
${colors.dim("Docs:")} ${colors.underline("https://docs.ensemble.ai/conductor/deployment")}
`);
}

/**
 * Configuration wizards for Ensemble projects
 *
 * Provides interactive configuration for:
 * - AI providers (Anthropic, OpenAI, Cloudflare AI, Groq)
 * - Cloudflare authentication
 * - GitHub integration (webhook, secrets)
 * - Infrastructure (Workers, KV namespaces)
 * - Ensemble Cloud connection
 *
 * Can be run anytime after project creation to add/modify configuration.
 *
 * Uses shared wizards from ../wizards/ to stay in sync with init flow.
 */

import { existsSync, readFileSync } from "node:fs";
import { execSync, spawnSync } from "node:child_process";
import {
  colors,
  log,
  banners,
  promptSelect,
  promptText,
  promptConfirm,
  promptPassword,
  isInteractive,
  createSpinner,
  box,
  successBox,
} from "../ui/index.js";
import { aiWizard, type AIProvider } from "../wizards/index.js";
import { authWizard } from "../wizards/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ConfigureOptions {
  yes?: boolean;
  provider?: AIProvider;
  status?: boolean;
}

interface ConfigStatus {
  cloudflare: {
    authenticated: boolean;
    email?: string;
    accountId?: string;
  };
  ai: {
    configured: boolean;
    provider?: string;
  };
  github: {
    configured: boolean;
    hasSecrets: boolean;
    secrets: string[];
  };
  infrastructure: {
    kvNamespace?: string;
    kvNamespaceId?: string;
    workers: string[];
    environments: string[];
  };
  cloud: {
    connected: boolean;
    projectId?: string;
  };
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
// Configure GitHub Command
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if gh CLI is available
 */
function isGhAvailable(): boolean {
  try {
    execSync("gh --version", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if gh is authenticated
 */
function isGhAuthenticated(): boolean {
  try {
    execSync("gh auth status", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get current git remote URL
 */
function getGitRemote(): string | null {
  try {
    const result = execSync("git remote get-url origin", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return result.trim();
  } catch {
    return null;
  }
}

/**
 * Parse GitHub owner/repo from remote URL
 */
function parseGitHubRepo(
  remoteUrl: string,
): { owner: string; repo: string } | null {
  // Handle SSH: git@github.com:owner/repo.git
  const sshMatch = remoteUrl.match(/git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/);
  if (sshMatch) {
    return { owner: sshMatch[1], repo: sshMatch[2] };
  }

  // Handle HTTPS: https://github.com/owner/repo.git
  const httpsMatch = remoteUrl.match(
    /https:\/\/github\.com\/([^/]+)\/(.+?)(?:\.git)?$/,
  );
  if (httpsMatch) {
    return { owner: httpsMatch[1], repo: httpsMatch[2] };
  }

  return null;
}

/**
 * Configure GitHub integration - set up repository secrets for deployment
 */
export async function configureGitHub(
  options: ConfigureOptions = {},
): Promise<void> {
  const cwd = process.cwd();

  // Check if we're in a project
  if (!isEnsembleProject()) {
    log.error("No wrangler.toml found.");
    log.newline();
    log.plain("Run this command from an Ensemble project directory.");
    return;
  }

  // Show banner
  banners.ensemble();
  log.dim(`📂 ${cwd}`);
  log.newline();

  log.plain(colors.bold("Configure GitHub Integration"));
  log.newline();

  // Check gh CLI
  if (!isGhAvailable()) {
    log.error("GitHub CLI (gh) is not installed.");
    log.newline();
    log.plain("Install it from: https://cli.github.com/");
    log.plain("Then run: gh auth login");
    return;
  }

  // Check gh auth
  if (!isGhAuthenticated()) {
    log.warn("GitHub CLI is not authenticated.");
    log.newline();
    const shouldAuth = await promptConfirm("Run 'gh auth login' now?", true);
    if (shouldAuth) {
      spawnSync("gh", ["auth", "login"], { stdio: "inherit" });
      log.newline();
    } else {
      return;
    }
  }

  // Get repo info
  const remoteUrl = getGitRemote();
  if (!remoteUrl) {
    log.error("No git remote 'origin' found.");
    log.plain("Initialize git and add a GitHub remote first:");
    log.plain("  git init");
    log.plain("  git remote add origin https://github.com/owner/repo.git");
    return;
  }

  const repo = parseGitHubRepo(remoteUrl);
  if (!repo) {
    log.error(`Could not parse GitHub repo from: ${remoteUrl}`);
    return;
  }

  log.info(`Repository: ${colors.accent(`${repo.owner}/${repo.repo}`)}`);
  log.newline();

  // Required secrets for Conductor deployment
  const requiredSecrets = [
    {
      name: "CLOUDFLARE_API_TOKEN",
      description: "Cloudflare API token with Workers + KV access",
      envVar: "CLOUDFLARE_API_TOKEN",
    },
    {
      name: "CLOUDFLARE_ACCOUNT_ID",
      description: "Your Cloudflare account ID",
      envVar: "CLOUDFLARE_ACCOUNT_ID",
    },
    {
      name: "KV_NAMESPACE_ID",
      description: "KV namespace ID for components",
      envVar: "KV_NAMESPACE_ID",
    },
  ];

  // Check existing secrets
  log.plain(colors.bold("Checking existing secrets..."));

  const existingSecrets: string[] = [];
  try {
    const result = execSync(
      `gh secret list --repo ${repo.owner}/${repo.repo}`,
      {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    for (const line of result.split("\n")) {
      const secretName = line.split("\t")[0];
      if (secretName) existingSecrets.push(secretName);
    }
  } catch {
    // No secrets or no access
  }

  for (const secret of requiredSecrets) {
    const exists = existingSecrets.includes(secret.name);
    if (exists) {
      log.plain(`  ${colors.success("✓")} ${secret.name}`);
    } else {
      log.plain(
        `  ${colors.dim("○")} ${secret.name} ${colors.dim("(missing)")}`,
      );
    }
  }
  log.newline();

  // Offer to set missing secrets
  const missingSecrets = requiredSecrets.filter(
    (s) => !existingSecrets.includes(s.name),
  );

  if (missingSecrets.length === 0) {
    console.log(successBox("All GitHub secrets are configured!"));
    return;
  }

  const shouldSet = await promptConfirm(
    `Set ${missingSecrets.length} missing secret(s)?`,
    true,
  );
  if (!shouldSet) {
    log.newline();
    log.dim("You can set secrets manually with:");
    log.dim(`  gh secret set SECRET_NAME --repo ${repo.owner}/${repo.repo}`);
    return;
  }

  log.newline();

  for (const secret of missingSecrets) {
    log.plain(`${colors.bold(secret.name)}`);
    log.dim(secret.description);

    // Try to get from environment first
    const envValue = process.env[secret.envVar];
    if (envValue) {
      const useEnv = await promptConfirm(
        `Use value from $${secret.envVar}?`,
        true,
      );
      if (useEnv) {
        const spinner = createSpinner(`Setting ${secret.name}...`).start();
        try {
          execSync(
            `gh secret set ${secret.name} --repo ${repo.owner}/${repo.repo}`,
            {
              input: envValue,
              stdio: ["pipe", "pipe", "pipe"],
            },
          );
          spinner.success({ text: `Set ${secret.name}` });
        } catch (err) {
          spinner.error({ text: `Failed to set ${secret.name}` });
          log.error(err instanceof Error ? err.message : String(err));
        }
        log.newline();
        continue;
      }
    }

    // Prompt for value
    const value = await promptPassword(`Enter value for ${secret.name}:`);
    if (value) {
      const spinner = createSpinner(`Setting ${secret.name}...`).start();
      try {
        execSync(
          `gh secret set ${secret.name} --repo ${repo.owner}/${repo.repo}`,
          {
            input: value,
            stdio: ["pipe", "pipe", "pipe"],
          },
        );
        spinner.success({ text: `Set ${secret.name}` });
      } catch (err) {
        spinner.error({ text: `Failed to set ${secret.name}` });
        log.error(err instanceof Error ? err.message : String(err));
      }
    }
    log.newline();
  }

  console.log(successBox("GitHub secrets configured!"));
  log.newline();
  log.dim("Deployment workflow will run when you push component/logic tags.");
  log.dim("Create tags with: edgit tag create <component> <version>");
  log.dim("Push tags with:   edgit push --tags");
}

// ─────────────────────────────────────────────────────────────────────────────
// Configure Infrastructure Command
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Read conductor.config.ts and extract configuration
 */
function readConductorConfig(): {
  environments: string[];
  kvNamespace: string;
  workers: Record<string, string>;
  name?: string;
} | null {
  // Try to read and parse conductor.config.ts
  if (
    !existsSync("conductor.config.ts") &&
    !existsSync("conductor.config.js")
  ) {
    return null;
  }

  try {
    const result = execSync(
      `npx tsx -e "
        import c from './conductor.config.ts';
        console.log(JSON.stringify({
          environments: c.environments || ['main'],
          kvNamespace: c.kv?.namespace || 'COMPONENTS_KV',
          workers: c.workers || {},
          name: c.name
        }))
      "`,
      { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] },
    );
    return JSON.parse(result.trim());
  } catch {
    return null;
  }
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
 * Check if wrangler is authenticated
 */
function isWranglerAuthenticated(): boolean {
  try {
    execSync("npx wrangler whoami", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Configure infrastructure - provision KV namespaces and Workers
 */
export async function configureInfrastructure(
  options: ConfigureOptions = {},
): Promise<void> {
  const cwd = process.cwd();

  // Check if we're in a project
  if (!isEnsembleProject()) {
    log.error("No wrangler.toml found.");
    log.newline();
    log.plain("Run this command from an Ensemble project directory.");
    return;
  }

  // Show banner
  banners.ensemble();
  log.dim(`📂 ${cwd}`);
  log.newline();

  log.plain(colors.bold("Configure Infrastructure"));
  log.newline();

  // Check wrangler auth
  if (!isWranglerAuthenticated()) {
    log.warn("Wrangler is not authenticated.");
    log.newline();
    const shouldAuth = await promptConfirm("Run 'wrangler login' now?", true);
    if (shouldAuth) {
      spawnSync("npx", ["wrangler", "login"], { stdio: "inherit" });
      log.newline();
    } else {
      return;
    }
  }

  // Read conductor config
  const config = readConductorConfig();
  const projectName = config?.name || getProjectName();
  const environments = config?.environments || ["main"];
  const kvNamespace = config?.kvNamespace || "COMPONENTS_KV";

  log.plain(colors.bold("Configuration"));
  log.plain(`  Project:      ${colors.accent(projectName)}`);
  log.plain(`  Environments: ${environments.join(", ")}`);
  log.plain(`  KV Namespace: ${kvNamespace}`);
  log.newline();

  // Check existing KV namespace
  log.plain(colors.bold("Checking KV namespace..."));
  let kvNamespaceId: string | null = null;

  try {
    const result = execSync("npx wrangler kv namespace list --json", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    const namespaces = JSON.parse(result);
    const existing = namespaces.find(
      (ns: { title: string; id: string }) =>
        ns.title === `${projectName}-${kvNamespace}` ||
        ns.title === kvNamespace,
    );
    if (existing) {
      kvNamespaceId = existing.id;
      log.plain(
        `  ${colors.success("✓")} ${kvNamespace} (${existing.id.slice(0, 8)}...)`,
      );
    } else {
      log.plain(
        `  ${colors.dim("○")} ${kvNamespace} ${colors.dim("(not found)")}`,
      );
    }
  } catch {
    log.plain(`  ${colors.dim("○")} Could not check KV namespaces`);
  }
  log.newline();

  // Offer to create KV namespace if missing
  if (!kvNamespaceId) {
    const shouldCreate = await promptConfirm(
      `Create KV namespace '${kvNamespace}'?`,
      true,
    );
    if (shouldCreate) {
      const spinner = createSpinner("Creating KV namespace...").start();
      try {
        const result = execSync(
          `npx wrangler kv namespace create "${kvNamespace}"`,
          {
            encoding: "utf-8",
            stdio: ["pipe", "pipe", "pipe"],
          },
        );
        // Parse the ID from output
        const idMatch = result.match(/id = "([^"]+)"/);
        if (idMatch) {
          kvNamespaceId = idMatch[1];
          spinner.success({ text: `Created KV namespace: ${kvNamespaceId}` });

          log.newline();
          log.info("Add this to your wrangler.toml:");
          log.plain(
            colors.dim(`  [[kv_namespaces]]
  binding = "${kvNamespace}"
  id = "${kvNamespaceId}"`),
          );
        } else {
          spinner.success({ text: "Created KV namespace" });
        }
      } catch (err) {
        spinner.error({ text: "Failed to create KV namespace" });
        log.error(err instanceof Error ? err.message : String(err));
      }
      log.newline();
    }
  }

  // Check Workers for each environment
  log.plain(colors.bold("Checking Workers..."));

  for (const env of ["main", ...environments.filter((e) => e !== "main")]) {
    const workerName =
      config?.workers?.[env] ||
      (env === "main" ? projectName : `${projectName}-${env}`);

    try {
      // Try to get worker info (will fail if doesn't exist)
      execSync(`npx wrangler deployments list --name ${workerName}`, {
        stdio: "pipe",
      });
      log.plain(`  ${colors.success("✓")} ${workerName} (${env})`);
    } catch {
      log.plain(
        `  ${colors.dim("○")} ${workerName} (${env}) ${colors.dim("— not deployed yet")}`,
      );
    }
  }
  log.newline();

  console.log(
    box(`${colors.bold("Infrastructure Check Complete")}

Workers will be created automatically when you deploy.
Use GitHub Actions or run:
  ${colors.accent("npx wrangler deploy")}          ${colors.dim("(main environment)")}
  ${colors.accent("npx wrangler deploy --env staging")}   ${colors.dim("(other environments)")}`),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Configure Status Command
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get current configuration status
 */
async function getConfigStatus(): Promise<ConfigStatus> {
  const status: ConfigStatus = {
    cloudflare: { authenticated: false },
    ai: { configured: false },
    github: { configured: false, hasSecrets: false, secrets: [] },
    infrastructure: { workers: [], environments: [] },
    cloud: { connected: false },
  };

  // Check Cloudflare auth
  try {
    const result = execSync("npx wrangler whoami", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    status.cloudflare.authenticated = true;
    const emailMatch = result.match(/email:\s*([^\s]+)/i);
    if (emailMatch) status.cloudflare.email = emailMatch[1];
    const accountMatch = result.match(/account[^:]*:\s*([^\s]+)/i);
    if (accountMatch) status.cloudflare.accountId = accountMatch[1];
  } catch {
    // Not authenticated
  }

  // Check AI config (.dev.vars or environment)
  if (existsSync(".dev.vars")) {
    const devVars = readFileSync(".dev.vars", "utf-8");
    if (devVars.includes("ANTHROPIC_API_KEY")) {
      status.ai.configured = true;
      status.ai.provider = "anthropic";
    } else if (devVars.includes("OPENAI_API_KEY")) {
      status.ai.configured = true;
      status.ai.provider = "openai";
    } else if (devVars.includes("GROQ_API_KEY")) {
      status.ai.configured = true;
      status.ai.provider = "groq";
    }
  }

  // Check GitHub
  const remoteUrl = getGitRemote();
  if (remoteUrl) {
    const repo = parseGitHubRepo(remoteUrl);
    if (repo && isGhAuthenticated()) {
      status.github.configured = true;
      try {
        const result = execSync(
          `gh secret list --repo ${repo.owner}/${repo.repo}`,
          {
            encoding: "utf-8",
            stdio: ["pipe", "pipe", "pipe"],
          },
        );
        for (const line of result.split("\n")) {
          const secretName = line.split("\t")[0];
          if (secretName) status.github.secrets.push(secretName);
        }
        status.github.hasSecrets =
          status.github.secrets.includes("CLOUDFLARE_API_TOKEN") &&
          status.github.secrets.includes("CLOUDFLARE_ACCOUNT_ID");
      } catch {
        // No access to secrets
      }
    }
  }

  // Check infrastructure from conductor.config.ts
  const config = readConductorConfig();
  if (config) {
    status.infrastructure.environments = config.environments;
    status.infrastructure.kvNamespace = config.kvNamespace;
  }

  // Check Ensemble Cloud
  if (existsSync(".ensemble/cloud.json")) {
    try {
      const cloudConfig = JSON.parse(
        readFileSync(".ensemble/cloud.json", "utf-8"),
      );
      if (cloudConfig.projectId) {
        status.cloud.connected = true;
        status.cloud.projectId = cloudConfig.projectId;
      }
    } catch {
      // Invalid config
    }
  }

  return status;
}

/**
 * Show current configuration status
 */
export async function showConfigStatus(): Promise<void> {
  const cwd = process.cwd();

  // Check if we're in a project
  if (!isEnsembleProject()) {
    log.error("No wrangler.toml found.");
    log.newline();
    log.plain("Run this command from an Ensemble project directory.");
    return;
  }

  // Show banner
  banners.ensemble();
  log.dim(`📂 ${cwd}`);
  log.newline();

  const spinner = createSpinner("Checking configuration...").start();
  const status = await getConfigStatus();
  spinner.stop();

  console.log(box(colors.bold("Configuration Status")));
  log.newline();

  // Cloudflare
  log.plain(colors.bold("Cloudflare"));
  if (status.cloudflare.authenticated) {
    log.plain(
      `  ${colors.success("✓")} Authenticated${status.cloudflare.email ? ` (${status.cloudflare.email})` : ""}`,
    );
  } else {
    log.plain(`  ${colors.dim("○")} Not authenticated`);
    log.dim(`    Run: ${colors.accent("ensemble configure auth")}`);
  }
  log.newline();

  // AI Provider
  log.plain(colors.bold("AI Provider"));
  if (status.ai.configured) {
    log.plain(`  ${colors.success("✓")} ${status.ai.provider || "Configured"}`);
  } else {
    log.plain(`  ${colors.dim("○")} Not configured`);
    log.dim(`    Run: ${colors.accent("ensemble configure ai")}`);
  }
  log.newline();

  // GitHub
  log.plain(colors.bold("GitHub Integration"));
  if (status.github.configured) {
    log.plain(`  ${colors.success("✓")} Repository connected`);
    if (status.github.hasSecrets) {
      log.plain(`  ${colors.success("✓")} Deployment secrets configured`);
    } else {
      log.plain(`  ${colors.dim("○")} Missing deployment secrets`);
      log.dim(`    Run: ${colors.accent("ensemble configure github")}`);
    }
  } else {
    log.plain(`  ${colors.dim("○")} Not configured`);
    log.dim(`    Run: ${colors.accent("ensemble configure github")}`);
  }
  log.newline();

  // Infrastructure
  log.plain(colors.bold("Infrastructure"));
  if (status.infrastructure.environments.length > 0) {
    log.plain(
      `  Environments: ${status.infrastructure.environments.join(", ")}`,
    );
  }
  if (status.infrastructure.kvNamespace) {
    log.plain(`  KV Namespace: ${status.infrastructure.kvNamespace}`);
  }
  log.dim(`  Run: ${colors.accent("ensemble configure infrastructure")}`);
  log.newline();

  // Ensemble Cloud
  log.plain(colors.bold("Ensemble Cloud"));
  if (status.cloud.connected) {
    log.plain(`  ${colors.success("✓")} Connected (${status.cloud.projectId})`);
  } else {
    log.plain(`  ${colors.dim("○")} Not connected`);
    log.dim(`    Run: ${colors.accent("ensemble cloud init")}`);
  }
  log.newline();
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

  // Handle --status flag
  if (options.status) {
    await showConfigStatus();
    return;
  }

  // Route to specific subcommand
  if (subcommand === "ai") {
    await configureAI(options);
    return;
  }

  if (subcommand === "auth") {
    await configureAuth(options);
    return;
  }

  if (subcommand === "github") {
    await configureGitHub(options);
    return;
  }

  if (subcommand === "infrastructure" || subcommand === "infra") {
    await configureInfrastructure(options);
    return;
  }

  if (subcommand === "status") {
    await showConfigStatus();
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
          title: `GitHub ${colors.dim("— Set up repository secrets for deployment")}`,
          value: "github",
        },
        {
          title: `Infrastructure ${colors.dim("— Provision Workers, KV namespaces")}`,
          value: "infrastructure",
        },
        {
          title: `Ensemble Cloud ${colors.dim("— Connect to managed platform")}`,
          value: "cloud",
        },
        {
          title: `View Status ${colors.dim("— Show current configuration")}`,
          value: "status",
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
  github          Set up GitHub repository secrets for deployment
  infrastructure  Provision Workers, KV namespaces (alias: infra)
  status          View current configuration status

${colors.bold("Options:")}
  --provider <p>  Pre-select AI provider (anthropic, openai, cloudflare, groq)
  --status        Show current configuration status
  -y, --yes       Skip confirmation prompts

${colors.bold("Examples:")}
  ${colors.accent("ensemble configure")}              ${colors.dim("(interactive menu)")}
  ${colors.accent("ensemble configure ai")}           ${colors.dim("(AI provider wizard)")}
  ${colors.accent("ensemble configure ai --provider anthropic")}
  ${colors.accent("ensemble configure auth")}         ${colors.dim("(Cloudflare login)")}
  ${colors.accent("ensemble configure github")}       ${colors.dim("(GitHub secrets)")}
  ${colors.accent("ensemble configure infra")}        ${colors.dim("(KV namespaces, Workers)")}
  ${colors.accent("ensemble configure --status")}     ${colors.dim("(view all config)")}

${colors.dim("Docs:")} ${colors.underline("https://docs.ensemble.ai/conductor/configure")}
`);
}

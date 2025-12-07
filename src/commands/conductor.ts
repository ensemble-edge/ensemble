/**
 * Ensemble Conductor Commands
 *
 * Commands for Conductor product (info, etc.)
 * Init is handled separately in ./init.ts
 *
 * Architecture:
 * - Info DATA comes from `npx @ensemble-edge/conductor info --json`
 *   This is the single source of truth, maintained in Conductor
 * - Info DISPLAY is handled here with visual styling (banners, colors, boxes)
 *   This provides a nice human experience via ensemble CLI
 * - Automation users can call Conductor directly for JSON output
 *
 * Command Naming:
 * - Official command: `info` (matches Conductor CLI: `npx @ensemble-edge/conductor info`)
 * - Alias: `status` (convenience alias for users expecting git-like status command)
 * - Both `ensemble conductor info` and `ensemble conductor status` work identically
 */

import { existsSync } from "node:fs";
import { execSync } from "node:child_process";
import {
  colors,
  log,
  banners,
  createSpinner,
  box,
  promptConfirm,
  isInteractive,
} from "../ui/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// Types (mirrors Conductor's ConductorStatusOutput)
// ─────────────────────────────────────────────────────────────────────────────

interface ProjectInfo {
  name: string;
  version: string;
  conductorVersion?: string;
  projectId?: string;
}

interface ConfigStatus {
  conductorConfig: boolean;
  wranglerConfig: boolean;
}

interface ComponentCounts {
  agents: { total: number; custom: number; builtIn: number };
  ensembles: number;
  prompts: number;
  schemas: number;
  configs: number;
  queries: number;
  scripts: number;
  templates: number;
  docs: number;
}

interface TriggerCounts {
  http: number;
  webhook: number;
  mcp: number;
  cron: number;
  email: number;
  queue: number;
  startup: number;
  cli: number;
  build: number;
}

interface SecuritySettings {
  requireAuth: boolean;
  requireAuthExplicit: boolean;
  stealthMode: boolean;
  stealthModeExplicit: boolean;
  allowDirectAgentExecution: boolean;
  allowDirectAgentExecutionExplicit: boolean;
}

interface CloudflareService {
  configured: boolean;
  name?: string;
  bindings?: string[];
  count?: number;
}

interface CloudflareServices {
  workersAI: CloudflareService;
  aiGateway: CloudflareService;
  vectorize: CloudflareService;
  kv: CloudflareService;
  d1: CloudflareService;
  r2: CloudflareService;
  durableObjects: CloudflareService;
  queues: CloudflareService;
  hyperdrive: CloudflareService;
  analyticsEngine: CloudflareService;
}

interface DeploymentStatus {
  workerUrl?: string;
  cloudEnabled: boolean;
  health?: { ok: boolean; version?: string; error?: string };
  pulse: boolean;
}

interface ConductorStatus {
  initialized?: boolean;
  error?: string;
  project: ProjectInfo;
  config: ConfigStatus;
  environment: string;
  components: ComponentCounts;
  triggers: TriggerCounts;
  security: SecuritySettings;
  plugins: string[];
  cloudflare: CloudflareServices;
  deployment: DeploymentStatus;
}

// ─────────────────────────────────────────────────────────────────────────────
// Data Fetching (calls Conductor CLI as single source of truth)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get the conductor command to use
 *
 * Priority:
 * 1. Local binary (node_modules/.bin/conductor) - fastest, uses project's version
 * 2. npx with package name - fallback if local not available
 */
function getConductorCommand(): string {
  // Check for local binary first (installed in project)
  if (existsSync("node_modules/.bin/conductor")) {
    return "node_modules/.bin/conductor";
  }
  // Fallback to npx
  return "npx @ensemble-edge/conductor";
}

/**
 * Get info from Conductor CLI
 *
 * This calls `conductor info --json` which is the authoritative source for all
 * project info data. This ensures:
 * 1. Single source of truth - Conductor owns the data structure
 * 2. Consistency - same logic whether called via ensemble or directly
 * 3. Maintainability - changes to info only need to happen in Conductor
 *
 * Note: The Conductor CLI command is `info`, not `status`. This avoids
 * potential conflicts with git-like status semantics in other tools.
 */
async function getConductorInfo(): Promise<ConductorStatus | null> {
  try {
    const cmd = getConductorCommand();
    const result = execSync(`${cmd} info --json`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 30000,
    });

    return JSON.parse(result) as ConductorStatus;
  } catch {
    // Conductor CLI not available or failed
    return null;
  }
}

/**
 * Check if Conductor CLI is available
 */
function isConductorAvailable(): boolean {
  try {
    const cmd = getConductorCommand();
    execSync(`${cmd} --version`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 10000,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Ping worker health endpoint
 */
async function pingWorkerHealth(
  workerUrl: string,
): Promise<{ ok: boolean; version?: string; error?: string }> {
  try {
    const healthUrl = `${workerUrl.replace(/\/$/, "")}/cloud/health`;
    const response = await fetch(healthUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      const data = (await response.json()) as { version?: string };
      return { ok: true, version: data.version };
    } else {
      return { ok: false, error: `HTTP ${response.status}` };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Display Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format a security setting value with explicit/default indicator
 *
 * Shows the actual value (true/false) with a visual indicator:
 * - If explicitly set in config: just shows the value
 * - If using default: shows value with "(default)" suffix
 *
 * This helps users understand what settings are active vs inherited.
 *
 * @param value - The actual boolean value of the setting
 * @param explicit - Whether this was explicitly set in conductor.config.ts
 * @returns Formatted string with icon and optional "(default)" indicator
 *
 * @example
 * formatSecurityValue(true, true)   // "✓ true"
 * formatSecurityValue(true, false)  // "✓ true (default)"
 * formatSecurityValue(false, true)  // "○ false"
 * formatSecurityValue(false, false) // "○ false (default)"
 */
function formatSecurityValue(value: boolean, explicit: boolean): string {
  const icon = value ? colors.success("✓") : colors.dim("○");
  const valueStr = value ? "true" : "false";

  if (explicit) {
    return `${icon} ${valueStr}`;
  }
  return `${icon} ${valueStr} ${colors.dim("(default)")}`;
}

/**
 * Format service status line for Cloudflare services display
 *
 * Creates a consistently formatted line showing:
 * - Status icon (✓ configured, ○ not configured)
 * - Service name (padded for alignment)
 * - Detail (name, count, or "Configured"/"Not configured")
 * - Bindings list (if any)
 *
 * @param name - Service display name (e.g., "Workers AI:")
 * @param service - CloudflareService object with configuration status
 * @param nameWidth - Padding width for name column (default: 18)
 * @returns Formatted string for console output
 */
function formatServiceLine(
  name: string,
  service: CloudflareService,
  nameWidth: number = 18,
): string {
  const icon = service.configured ? colors.success("✓") : colors.dim("○");
  const paddedName = name.padEnd(nameWidth);

  if (!service.configured) {
    return `  ${icon} ${paddedName}${colors.dim("Not configured")}`;
  }

  let detail = "";
  if (service.name) {
    detail = service.name;
  } else if (service.count && service.count > 1) {
    detail = `${service.count} configured`;
  } else {
    detail = "Configured";
  }

  const bindings = service.bindings?.length
    ? colors.dim(`[${service.bindings.join(", ")}]`)
    : "";

  return `  ${icon} ${paddedName}${detail.padEnd(22)}${bindings}`;
}

/**
 * Display status in full mode
 */
async function displayFullStatus(status: ConductorStatus): Promise<void> {
  // Banner
  banners.conductor();

  // Title box
  console.log(box(`${colors.bold("🎼 Conductor Status")}`));
  console.log("");

  // Project section
  console.log(colors.bold("Project"));
  console.log(`  Name:             ${colors.accent(status.project.name)}`);
  console.log(`  Version:          ${status.project.version}`);
  if (status.project.conductorVersion) {
    console.log(
      `  Conductor:        @ensemble-edge/conductor@${status.project.conductorVersion}`,
    );
  }
  if (status.project.projectId) {
    console.log(`  Project ID:       ${colors.dim(status.project.projectId)}`);
  }
  console.log(
    `  Environment:      ${colors.accent(status.environment)}${status.environment === "development" ? colors.dim(" (local)") : ""}`,
  );
  console.log("");

  // Configuration section
  console.log(colors.bold("Configuration"));
  console.log(
    `  conductor.config: ${status.config.conductorConfig ? colors.success("✓ Found") : colors.dim("○ Not found")}`,
  );
  console.log(
    `  wrangler.toml:    ${status.config.wranglerConfig ? colors.success("✓ Found") : colors.dim("○ Not found")}`,
  );
  console.log("");

  // Components section
  console.log(colors.bold("Components"));
  const otherCount =
    status.components.prompts +
    status.components.schemas +
    status.components.configs +
    status.components.queries +
    status.components.scripts +
    status.components.templates +
    status.components.docs;

  console.log(
    `  Agents:           ${status.components.agents.total}${status.components.agents.total > 0 ? colors.dim(` (${status.components.agents.custom} custom)`) : ""}`,
  );
  console.log(`  Ensembles:        ${status.components.ensembles}`);
  if (otherCount > 0) {
    const parts: string[] = [];
    if (status.components.prompts > 0)
      parts.push(`${status.components.prompts} prompts`);
    if (status.components.schemas > 0)
      parts.push(`${status.components.schemas} schemas`);
    if (status.components.configs > 0)
      parts.push(`${status.components.configs} configs`);
    if (status.components.queries > 0)
      parts.push(`${status.components.queries} queries`);
    if (status.components.scripts > 0)
      parts.push(`${status.components.scripts} scripts`);
    if (status.components.templates > 0)
      parts.push(`${status.components.templates} templates`);
    if (status.components.docs > 0)
      parts.push(`${status.components.docs} docs`);
    console.log(
      `  Other:            ${otherCount} ${colors.dim(`(${parts.join(", ")})`)}`,
    );
  }
  console.log("");

  // Triggers section
  const totalTriggers = Object.values(status.triggers).reduce(
    (a, b) => a + b,
    0,
  );
  if (totalTriggers > 0) {
    console.log(colors.bold("Triggers"));
    if (status.triggers.http > 0)
      console.log(`  HTTP routes:      ${status.triggers.http}`);
    if (status.triggers.webhook > 0)
      console.log(`  Webhooks:         ${status.triggers.webhook}`);
    if (status.triggers.mcp > 0)
      console.log(`  MCP tools:        ${status.triggers.mcp}`);
    if (status.triggers.cron > 0)
      console.log(`  Cron jobs:        ${status.triggers.cron}`);
    if (status.triggers.startup > 0)
      console.log(`  Startup:          ${status.triggers.startup}`);
    if (status.triggers.email > 0)
      console.log(`  Email:            ${status.triggers.email}`);
    if (status.triggers.queue > 0)
      console.log(`  Queue:            ${status.triggers.queue}`);
    if (status.triggers.cli > 0)
      console.log(`  CLI:              ${status.triggers.cli}`);
    if (status.triggers.build > 0)
      console.log(`  Build:            ${status.triggers.build}`);
    console.log("");
  }

  // Security section
  console.log(colors.bold("Security"));
  console.log(
    `  requireAuth:      ${formatSecurityValue(status.security.requireAuth, status.security.requireAuthExplicit)}`,
  );
  console.log(
    `  stealthMode:      ${formatSecurityValue(status.security.stealthMode, status.security.stealthModeExplicit)}`,
  );
  console.log(
    `  allowDirectAgentExecution: ${formatSecurityValue(status.security.allowDirectAgentExecution, status.security.allowDirectAgentExecutionExplicit)}`,
  );
  console.log("");

  // Plugins section (if any)
  if (status.plugins.length > 0) {
    console.log(colors.bold("Plugins"));
    for (const plugin of status.plugins) {
      console.log(`  ${colors.success("✓")} ${plugin}`);
    }
    console.log("");
  }

  // Cloudflare Services box
  console.log(box(`${colors.bold("☁️  Cloudflare Services")}`));
  console.log("");

  console.log(colors.bold("AI & Intelligence"));
  console.log(formatServiceLine("Workers AI:", status.cloudflare.workersAI));
  console.log(formatServiceLine("AI Gateway:", status.cloudflare.aiGateway));
  console.log(formatServiceLine("Vectorize:", status.cloudflare.vectorize));
  console.log("");

  console.log(colors.bold("Storage"));
  console.log(formatServiceLine("KV:", status.cloudflare.kv));
  console.log(formatServiceLine("D1:", status.cloudflare.d1));
  console.log(formatServiceLine("R2:", status.cloudflare.r2));
  console.log("");

  console.log(colors.bold("Compute & State"));
  console.log(
    formatServiceLine("Durable Objects:", status.cloudflare.durableObjects),
  );
  console.log(formatServiceLine("Queues:", status.cloudflare.queues));
  console.log(formatServiceLine("Hyperdrive:", status.cloudflare.hyperdrive));
  console.log("");

  console.log(colors.bold("Observability"));
  console.log(
    formatServiceLine("Analytics Engine:", status.cloudflare.analyticsEngine),
  );
  console.log("");

  // Deployment box
  console.log(box(`${colors.bold("🌐 Deployment")}`));
  console.log("");

  if (status.deployment.workerUrl) {
    console.log(
      `  Worker URL:       ${colors.accent(status.deployment.workerUrl)}`,
    );

    // Show health check result
    if (status.deployment.health) {
      if (status.deployment.health.ok) {
        console.log(
          `  Status:           ${colors.success("✓")} Reachable${status.deployment.health.version ? colors.dim(` (v${status.deployment.health.version})`) : ""}`,
        );
      } else {
        console.log(
          `  Status:           ${colors.error("✗")} Not reachable ${colors.dim(`(${status.deployment.health.error})`)}`,
        );

        // Show stealth mode tip if applicable
        if (
          status.security.stealthMode &&
          status.deployment.health.error?.includes("404")
        ) {
          log.dim(
            "  Tip: stealthMode is enabled, which hides the health endpoint.",
          );
        }
      }
    }
  } else {
    console.log(`  Worker URL:       ${colors.dim("Not configured")}`);
  }

  console.log("");
  console.log(
    `  Ensemble Cloud:   ${status.deployment.cloudEnabled ? colors.success("✓ Connected") : colors.dim("○ Not connected")}`,
  );
  console.log(
    `  Pulse:            ${status.deployment.pulse ? colors.success("✓ Enabled") : colors.dim("○ Disabled")}`,
  );
  console.log("");

  // Footer
  log.dim("Docs: https://docs.ensemble.ai/conductor");
}

/**
 * Display status in compact mode
 */
function displayCompactStatus(status: ConductorStatus): void {
  console.log("");
  console.log(`${colors.primaryBold("🎼 Conductor Status")}`);
  console.log("");

  // Project line
  const conductorVer = status.project.conductorVersion
    ? `(@ensemble-edge/conductor@${status.project.conductorVersion})`
    : "";
  console.log(
    `Project:     ${colors.accent(status.project.name)} v${status.project.version} ${colors.dim(conductorVer)}`,
  );
  if (status.project.projectId) {
    console.log(`Project ID:  ${colors.dim(status.project.projectId)}`);
  }
  console.log(`Environment: ${status.environment}`);
  console.log("");

  // Components line
  const totalComponents =
    status.components.agents.total +
    status.components.ensembles +
    status.components.prompts +
    status.components.schemas +
    status.components.configs +
    status.components.queries +
    status.components.scripts +
    status.components.templates +
    status.components.docs;
  const otherCount =
    totalComponents -
    status.components.agents.total -
    status.components.ensembles;
  console.log(
    `Components:  ${totalComponents} total (${status.components.agents.total} agents, ${status.components.ensembles} ensembles, ${otherCount} other)`,
  );

  // Triggers line
  const triggerParts: string[] = [];
  if (status.triggers.http > 0)
    triggerParts.push(`${status.triggers.http} http`);
  if (status.triggers.webhook > 0)
    triggerParts.push(`${status.triggers.webhook} webhook`);
  if (status.triggers.mcp > 0) triggerParts.push(`${status.triggers.mcp} mcp`);
  if (status.triggers.cron > 0)
    triggerParts.push(`${status.triggers.cron} cron`);
  if (status.triggers.startup > 0)
    triggerParts.push(`${status.triggers.startup} startup`);
  if (triggerParts.length > 0) {
    console.log(`Triggers:    ${triggerParts.join(" │ ")}`);
  }
  console.log("");

  // Cloudflare services grid
  console.log(colors.bold("Cloudflare"));
  const row1 = [
    status.cloudflare.workersAI.configured
      ? colors.success("✓") + " Workers AI"
      : colors.dim("○") + " Workers AI",
    status.cloudflare.kv.configured
      ? colors.success("✓") + ` KV (${status.cloudflare.kv.count || 1})`
      : colors.dim("○") + " KV",
    status.cloudflare.d1.configured
      ? colors.success("✓") + " D1"
      : colors.dim("○") + " D1",
    status.cloudflare.analyticsEngine.configured
      ? colors.success("✓") + " Analytics"
      : colors.dim("○") + " Analytics",
  ];
  const row2 = [
    status.cloudflare.aiGateway.configured
      ? colors.success("✓") + " AI Gateway"
      : colors.dim("○") + " AI Gateway",
    status.cloudflare.r2.configured
      ? colors.success("✓") + ` R2 (${status.cloudflare.r2.count || 1})`
      : colors.dim("○") + " R2",
    status.cloudflare.durableObjects.configured
      ? colors.success("✓") +
        ` DO (${status.cloudflare.durableObjects.count || 1})`
      : colors.dim("○") + " DO",
    status.cloudflare.queues.configured
      ? colors.success("✓") + " Queues"
      : colors.dim("○") + " Queues",
  ];
  const row3 = [
    status.cloudflare.vectorize.configured
      ? colors.success("✓") + " Vectorize"
      : colors.dim("○") + " Vectorize",
    status.cloudflare.hyperdrive.configured
      ? colors.success("✓") + " Hyperdrive"
      : colors.dim("○") + " Hyperdrive",
  ];

  console.log(`  ${row1.map((s) => s.padEnd(16)).join("")}`);
  console.log(`  ${row2.map((s) => s.padEnd(16)).join("")}`);
  console.log(`  ${row3.map((s) => s.padEnd(16)).join("")}`);
  console.log("");

  // Worker status
  if (status.deployment.workerUrl) {
    const healthStatus = status.deployment.health?.ok
      ? colors.success("✓") +
        (status.deployment.health.version
          ? ` (v${status.deployment.health.version})`
          : "")
      : colors.error("✗") +
        (status.deployment.health?.error
          ? ` (${status.deployment.health.error})`
          : "");
    console.log(
      `Worker:      ${healthStatus} ${colors.accent(status.deployment.workerUrl)}`,
    );
  } else {
    console.log(`Worker:      ${colors.dim("Not configured")}`);
  }
  console.log(
    `Cloud:       ${status.deployment.cloudEnabled ? colors.success("✓") + " Connected" : colors.dim("○") + " Not connected"}`,
  );
  console.log(
    `Pulse:       ${status.deployment.pulse ? colors.success("✓") + " Enabled" : colors.dim("○") + " Disabled"}`,
  );
  console.log("");
}

/**
 * Display status as JSON
 */
function displayJsonStatus(status: ConductorStatus): void {
  console.log(JSON.stringify(status, null, 2));
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Command
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if Conductor is initialized in the current directory
 */
function isConductorInitialized(): boolean {
  // Check for conductor.config.ts/js AND wrangler.toml
  const hasConductorConfig =
    existsSync("conductor.config.ts") || existsSync("conductor.config.js");
  const hasWranglerConfig =
    existsSync("wrangler.toml") || existsSync("wrangler.json");

  return hasConductorConfig && hasWranglerConfig;
}

/**
 * Display uninitialized status and offer to initialize
 */
async function displayUninitializedStatus(
  isJson: boolean,
  isCompact: boolean,
): Promise<boolean> {
  const hasConductorConfig =
    existsSync("conductor.config.ts") || existsSync("conductor.config.js");
  const hasWranglerConfig =
    existsSync("wrangler.toml") || existsSync("wrangler.json");

  if (isJson) {
    console.log(
      JSON.stringify({
        initialized: false,
        conductorConfig: hasConductorConfig,
        wranglerConfig: hasWranglerConfig,
        error: "Conductor not initialized",
      }),
    );
    return false;
  }

  // Compact mode - return early with minimal output
  if (isCompact) {
    console.log("");
    console.log(`${colors.primaryBold("🎼 Conductor Status")}`);
    console.log("");
    console.log(`Initialized: ${colors.dim("○")} No`);
    console.log(
      `Config:      ${hasConductorConfig ? colors.success("✓") : colors.dim("○")} conductor.config ${hasWranglerConfig ? colors.success("✓") : colors.dim("○")} wrangler.toml`,
    );
    console.log("");
    log.dim("Run `ensemble conductor init` to create a new project.");
    console.log("");
    return false;
  }

  // Full mode
  banners.conductor();
  console.log(box(`${colors.bold("🎼 Conductor Status")}`));
  console.log("");
  console.log(colors.bold("Project"));
  console.log(`  Initialized:      ${colors.dim("○ No")}`);
  console.log(
    `  conductor.config: ${hasConductorConfig ? colors.success("✓ Found") : colors.dim("○ Not found")}`,
  );
  console.log(
    `  wrangler.toml:    ${hasWranglerConfig ? colors.success("✓ Found") : colors.dim("○ Not found")}`,
  );
  console.log("");

  // Offer to initialize if interactive
  if (isInteractive()) {
    const shouldInit = await promptConfirm(
      "Would you like to initialize a Conductor project here?",
      true,
    );

    if (shouldInit) {
      console.log("");
      // Dynamic import to avoid circular dependency
      const { conductorInit } = await import("./init.js");
      await conductorInit({});
      return true;
    }
  } else {
    log.dim("Run `ensemble conductor init` to create a new project.");
  }

  console.log("");
  log.dim("Docs: https://docs.ensemble.ai/conductor");
  return false;
}

/**
 * Show conductor status
 *
 * Architecture:
 * ─────────────────────────────────────────────────────────────────────────────
 * This function delegates to Conductor CLI for data, then displays it prettily.
 *
 * Data Flow:
 *   1. Call `npx @ensemble-edge/conductor status --json`
 *   2. Parse the JSON response (ConductorStatus type)
 *   3. Display using our pretty UI (banners, colors, boxes)
 *
 * Why this approach?
 *   - Single Source of Truth: Conductor CLI owns the status data structure
 *   - Maintainability: Changes to status fields only need to happen in Conductor
 *   - Consistency: Same data whether called via ensemble CLI or directly
 *   - Automation: Users can call Conductor directly for CI/CD pipelines
 *
 * The ensemble CLI adds value through:
 *   - Beautiful visual presentation (banners, colors, boxes)
 *   - Interactive prompts (e.g., "Would you like to initialize?")
 *   - Health check integration with spinners
 *   - Unified CLI experience across all Ensemble products
 * ─────────────────────────────────────────────────────────────────────────────
 */
export async function conductorStatus(args: string[]): Promise<void> {
  const isJson = args.includes("--json");
  const isCompact = args.includes("--compact");
  const skipHealth = args.includes("--no-health-check");

  // Check if conductor is initialized (quick file check before calling CLI)
  if (!isConductorInitialized()) {
    const initialized = await displayUninitializedStatus(isJson, isCompact);
    if (initialized) {
      // Re-run status after initialization
      await conductorStatus(args);
    }
    return;
  }

  // Get status data from Conductor CLI (single source of truth)
  const spinner =
    !isJson && !isCompact ? createSpinner("Loading status...").start() : null;

  const status = await getConductorInfo();

  if (!status) {
    spinner?.stop();
    // Conductor CLI not available - show helpful error
    log.error("Could not get info from Conductor CLI");
    log.dim("Make sure @ensemble-edge/conductor is installed:");
    log.dim("  npm install @ensemble-edge/conductor");
    log.dim("");
    log.dim("Or run directly:");
    log.dim("  npx @ensemble-edge/conductor info");
    return;
  }

  // Handle error responses from Conductor
  if (status.initialized === false || status.error) {
    spinner?.stop();
    if (isJson) {
      console.log(JSON.stringify(status, null, 2));
    } else {
      log.error(status.error || "Conductor project not initialized");
      log.dim("Run `ensemble conductor init` to create a new project.");
    }
    return;
  }

  spinner?.stop();

  // Health check (unless skipped or JSON mode)
  // Note: We do health check here in ensemble CLI for the nice spinner UX
  if (status.deployment.workerUrl && !skipHealth) {
    if (!isJson && !isCompact) {
      const healthSpinner = createSpinner("Checking worker health...").start();
      status.deployment.health = await pingWorkerHealth(
        status.deployment.workerUrl,
      );
      healthSpinner.stop();
    } else {
      status.deployment.health = await pingWorkerHealth(
        status.deployment.workerUrl,
      );
    }
  }

  // Display with pretty formatting
  // This is where ensemble CLI adds value - beautiful visual presentation
  if (isJson) {
    displayJsonStatus(status);
  } else if (isCompact) {
    displayCompactStatus(status);
  } else {
    await displayFullStatus(status);
  }
}

/**
 * Show conductor help
 */
export function showConductorHelp(): void {
  banners.conductor();
  console.log(`${colors.bold("Commands:")}
  init [name]     Create a new Conductor project
  start           Start development server (smart defaults)
  stop            Stop development server
  restart         Restart development server
  info            Show project info and component counts
  status          Alias for info
  deploy          Deploy to production
  validate        Validate configuration
  exec            Execute agents
  docs            Generate API documentation
  test            Run tests

${colors.bold("Start Options:")}
  --port, -p <n>  Server port (default: 8787, auto-finds if busy)
  --foreground    Run in foreground (don't detach)
  --no-auto-host  Disable auto --host in containers
  --persist-to    Persist D1/KV data to directory

${colors.bold("Stop Options:")}
  --force, -f     Force stop with SIGKILL

${colors.bold("Info Options:")}
  --json          Output as JSON
  --compact       Compact single-line format
  --no-health-check  Skip worker health ping

${colors.bold("Init Options:")}
  --setup <type>  Project setup: full, starter, basic (default: full)
  --examples      Include example agents & ensembles (same as --setup full)
  --no-examples   Template only, no examples (same as --setup starter)
  --skip-install  Skip npm install
  --pm <manager>  Package manager: npm, pnpm, yarn, bun
  -f, --force     Overwrite existing directory
  -y, --yes       Use defaults, skip prompts

${colors.bold("Examples:")}
  ${colors.accent("ensemble conductor init my-project")}
  ${colors.accent("ensemble conductor start")}
  ${colors.accent("ensemble conductor start --port 3000")}
  ${colors.accent("ensemble conductor stop")}
  ${colors.accent("ensemble conductor info")}
  ${colors.accent("ensemble conductor info --compact")}

${colors.dim("Docs:")} ${colors.underline("https://docs.ensemble.ai/conductor")}
`);
}

/**
 * Route conductor subcommands
 */
export async function routeConductorCommand(args: string[]): Promise<void> {
  const [subCmd, ...subArgs] = args;

  // Show help if no subcommand or help requested
  if (!subCmd || subCmd === "--help" || subCmd === "-h") {
    showConductorHelp();
    return;
  }

  switch (subCmd) {
    case "start":
    case "dev": {
      // Start development server with smart defaults
      const { conductorStart } = await import("./start.js");
      await conductorStart(subArgs);
      break;
    }
    case "stop": {
      // Stop development server
      const { conductorStop } = await import("./stop.js");
      await conductorStop(subArgs);
      break;
    }
    case "restart": {
      // Restart development server
      const { conductorRestart } = await import("./stop.js");
      await conductorRestart(subArgs);
      break;
    }
    case "info":
    case "status":
      // Both 'info' and 'status' call the same function
      // 'info' is the official command, 'status' is an alias for user convenience
      await conductorStatus(subArgs);
      break;
    default:
      // For other commands, delegate to the conductor CLI
      // This will be handled by the existing runConductor in router.ts
      log.error(`Unknown conductor command: ${subCmd}`);
      log.dim("Run `ensemble conductor --help` for available commands.");
  }
}

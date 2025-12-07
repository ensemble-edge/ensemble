/**
 * Ensemble Conductor Commands
 *
 * Commands for Conductor product (status, etc.)
 * Init is handled separately in ./init.ts
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, basename } from "node:path";
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
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ProjectInfo {
  name: string;
  version: string;
  conductorVersion?: string;
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
  requireAuth?: boolean;
  stealthMode?: boolean;
  allowDirectAgentExecution?: boolean;
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
// Parsers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Read package.json for project info
 */
async function readProjectInfo(): Promise<ProjectInfo> {
  const info: ProjectInfo = {
    name: basename(process.cwd()),
    version: "0.0.0",
  };

  try {
    if (existsSync("package.json")) {
      const content = await readFile("package.json", "utf-8");
      const pkg = JSON.parse(content);
      info.name = pkg.name || info.name;
      info.version = pkg.version || info.version;

      // Find conductor version in dependencies
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (deps["@ensemble-edge/conductor"]) {
        info.conductorVersion = deps["@ensemble-edge/conductor"].replace(
          /^[\^~]/,
          "",
        );
      }
    }
  } catch {
    // Ignore errors
  }

  return info;
}

/**
 * Check config files exist
 */
function checkConfigFiles(): ConfigStatus {
  return {
    conductorConfig:
      existsSync("conductor.config.ts") || existsSync("conductor.config.js"),
    wranglerConfig: existsSync("wrangler.toml") || existsSync("wrangler.json"),
  };
}

/**
 * Detect environment from wrangler.toml or env vars
 */
async function detectEnvironment(): Promise<string> {
  // Check env var first
  if (process.env.ENVIRONMENT) {
    return process.env.ENVIRONMENT;
  }

  // Check wrangler.toml [vars]
  try {
    if (existsSync("wrangler.toml")) {
      const content = await readFile("wrangler.toml", "utf-8");
      const match = content.match(/ENVIRONMENT\s*=\s*["']([^"']+)["']/);
      if (match) {
        return match[1];
      }
    }
  } catch {
    // Ignore
  }

  return "development";
}

/**
 * Parse conductor.config.ts for security settings
 */
async function parseSecuritySettings(): Promise<SecuritySettings> {
  const settings: SecuritySettings = {};
  const configFiles = ["conductor.config.ts", "conductor.config.js"];

  for (const configFile of configFiles) {
    if (!existsSync(configFile)) continue;

    try {
      const content = await readFile(configFile, "utf-8");

      // Parse requireAuth
      if (content.match(/requireAuth\s*:\s*true/)) {
        settings.requireAuth = true;
      } else if (content.match(/requireAuth\s*:\s*false/)) {
        settings.requireAuth = false;
      }

      // Parse stealthMode
      if (content.match(/stealthMode\s*:\s*true/)) {
        settings.stealthMode = true;
      } else if (content.match(/stealthMode\s*:\s*false/)) {
        settings.stealthMode = false;
      }

      // Parse allowDirectAgentExecution
      if (content.match(/allowDirectAgentExecution\s*:\s*true/)) {
        settings.allowDirectAgentExecution = true;
      } else if (content.match(/allowDirectAgentExecution\s*:\s*false/)) {
        settings.allowDirectAgentExecution = false;
      }

      break;
    } catch {
      // Continue to next file
    }
  }

  return settings;
}

/**
 * Parse wrangler.toml for Cloudflare services
 */
async function parseCloudflareServices(): Promise<CloudflareServices> {
  const services: CloudflareServices = {
    workersAI: { configured: false },
    aiGateway: { configured: false },
    vectorize: { configured: false },
    kv: { configured: false },
    d1: { configured: false },
    r2: { configured: false },
    durableObjects: { configured: false },
    queues: { configured: false },
    hyperdrive: { configured: false },
    analyticsEngine: { configured: false },
  };

  if (!existsSync("wrangler.toml")) {
    return services;
  }

  try {
    const content = await readFile("wrangler.toml", "utf-8");

    // Workers AI - [ai] section (not commented)
    // Match [ai] that is NOT preceded by # on the same line
    if (content.match(/^(?!#)\s*\[ai\]/m)) {
      services.workersAI.configured = true;
      const bindingMatch = content.match(
        /\[ai\][\s\S]*?binding\s*=\s*["']([^"']+)["']/,
      );
      if (bindingMatch) {
        services.workersAI.bindings = [bindingMatch[1]];
      }
    }

    // KV Namespaces - [[kv_namespaces]]
    const kvMatches = content.matchAll(
      /^\[\[kv_namespaces\]\][\s\S]*?binding\s*=\s*["']([^"']+)["']/gm,
    );
    const kvBindings: string[] = [];
    for (const match of kvMatches) {
      kvBindings.push(match[1]);
    }
    if (kvBindings.length > 0) {
      services.kv.configured = true;
      services.kv.bindings = kvBindings;
      services.kv.count = kvBindings.length;
    }

    // D1 Databases - [[d1_databases]]
    const d1Matches = content.matchAll(
      /^\[\[d1_databases\]\][\s\S]*?binding\s*=\s*["']([^"']+)["'][\s\S]*?database_name\s*=\s*["']([^"']+)["']/gm,
    );
    const d1Bindings: string[] = [];
    let d1Name: string | undefined;
    for (const match of d1Matches) {
      d1Bindings.push(match[1]);
      d1Name = d1Name || match[2];
    }
    if (d1Bindings.length > 0) {
      services.d1.configured = true;
      services.d1.bindings = d1Bindings;
      services.d1.name = d1Name;
    }

    // R2 Buckets - [[r2_buckets]]
    const r2Matches = content.matchAll(
      /^\[\[r2_buckets\]\][\s\S]*?binding\s*=\s*["']([^"']+)["']/gm,
    );
    const r2Bindings: string[] = [];
    for (const match of r2Matches) {
      r2Bindings.push(match[1]);
    }
    if (r2Bindings.length > 0) {
      services.r2.configured = true;
      services.r2.bindings = r2Bindings;
      services.r2.count = r2Bindings.length;
    }

    // Vectorize - [[vectorize]]
    const vectorizeMatch = content.match(
      /^\[\[vectorize\]\][\s\S]*?binding\s*=\s*["']([^"']+)["'][\s\S]*?index_name\s*=\s*["']([^"']+)["']/m,
    );
    if (vectorizeMatch) {
      services.vectorize.configured = true;
      services.vectorize.bindings = [vectorizeMatch[1]];
      services.vectorize.name = vectorizeMatch[2];
    }

    // Durable Objects - [[durable_objects.bindings]]
    const doMatches = content.matchAll(
      /^\[\[durable_objects\.bindings\]\][\s\S]*?name\s*=\s*["']([^"']+)["']/gm,
    );
    const doBindings: string[] = [];
    for (const match of doMatches) {
      doBindings.push(match[1]);
    }
    if (doBindings.length > 0) {
      services.durableObjects.configured = true;
      services.durableObjects.bindings = doBindings;
      services.durableObjects.count = doBindings.length;
    }

    // Queues - [[queues.producers]] or [[queues.consumers]]
    const queueMatches = content.matchAll(
      /^\[\[queues\.(producers|consumers)\]\][\s\S]*?binding\s*=\s*["']([^"']+)["']/gm,
    );
    const queueBindings: string[] = [];
    for (const match of queueMatches) {
      if (!queueBindings.includes(match[2])) {
        queueBindings.push(match[2]);
      }
    }
    if (queueBindings.length > 0) {
      services.queues.configured = true;
      services.queues.bindings = queueBindings;
      services.queues.count = queueBindings.length;
    }

    // Hyperdrive - [[hyperdrive]]
    const hyperdriveMatches = content.matchAll(
      /^\[\[hyperdrive\]\][\s\S]*?binding\s*=\s*["']([^"']+)["']/gm,
    );
    const hyperdriveBindings: string[] = [];
    for (const match of hyperdriveMatches) {
      hyperdriveBindings.push(match[1]);
    }
    if (hyperdriveBindings.length > 0) {
      services.hyperdrive.configured = true;
      services.hyperdrive.bindings = hyperdriveBindings;
      services.hyperdrive.count = hyperdriveBindings.length;
    }

    // Analytics Engine - [[analytics_engine_datasets]]
    const analyticsMatch = content.match(
      /^\[\[analytics_engine_datasets\]\][\s\S]*?binding\s*=\s*["']([^"']+)["'][\s\S]*?dataset\s*=\s*["']([^"']+)["']/m,
    );
    if (analyticsMatch) {
      services.analyticsEngine.configured = true;
      services.analyticsEngine.bindings = [analyticsMatch[1]];
      services.analyticsEngine.name = analyticsMatch[2];
    }
  } catch {
    // Ignore parsing errors
  }

  return services;
}

/**
 * Count components by scanning directories
 */
async function countComponents(): Promise<ComponentCounts> {
  const counts: ComponentCounts = {
    agents: { total: 0, custom: 0, builtIn: 0 },
    ensembles: 0,
    prompts: 0,
    schemas: 0,
    configs: 0,
    queries: 0,
    scripts: 0,
    templates: 0,
    docs: 0,
  };

  // Count agents
  const agentDirs = ["agents", "src/agents"];
  for (const dir of agentDirs) {
    if (existsSync(dir)) {
      counts.agents.total += await countYamlFilesRecursive(dir, "agent.yaml");
    }
  }
  counts.agents.custom = counts.agents.total;

  // Count ensembles
  const ensembleDirs = ["ensembles", "src/ensembles"];
  for (const dir of ensembleDirs) {
    if (existsSync(dir)) {
      counts.ensembles += await countYamlFiles(dir);
    }
  }

  // Count other components
  const componentDirs: [keyof ComponentCounts, string[]][] = [
    ["prompts", ["prompts", "src/prompts"]],
    ["schemas", ["schemas", "src/schemas"]],
    ["configs", ["configs", "src/configs"]],
    ["queries", ["queries", "src/queries"]],
    ["scripts", ["scripts", "src/scripts"]],
    ["templates", ["templates", "src/templates"]],
    ["docs", ["docs", "src/docs"]],
  ];

  for (const [key, dirs] of componentDirs) {
    if (key === "agents" || key === "ensembles") continue;
    for (const dir of dirs) {
      if (existsSync(dir)) {
        (counts[key] as number) += await countFiles(dir);
      }
    }
  }

  return counts;
}

/**
 * Count YAML files in directory (non-recursive)
 */
async function countYamlFiles(dir: string): Promise<number> {
  try {
    const { readdir } = await import("node:fs/promises");
    const entries = await readdir(dir, { withFileTypes: true });
    return entries.filter(
      (e) =>
        e.isFile() && (e.name.endsWith(".yaml") || e.name.endsWith(".yml")),
    ).length;
  } catch {
    return 0;
  }
}

/**
 * Count specific YAML files recursively (e.g., agent.yaml)
 */
async function countYamlFilesRecursive(
  dir: string,
  filename: string,
): Promise<number> {
  try {
    const { readdir } = await import("node:fs/promises");
    let count = 0;
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        // Check for the specific file in this directory
        if (existsSync(join(fullPath, filename))) {
          count++;
        }
        // Recursively check subdirectories
        count += await countYamlFilesRecursive(fullPath, filename);
      }
    }

    return count;
  } catch {
    return 0;
  }
}

/**
 * Count files in directory
 */
async function countFiles(dir: string): Promise<number> {
  try {
    const { readdir } = await import("node:fs/promises");
    const entries = await readdir(dir, { withFileTypes: true });
    return entries.filter((e) => e.isFile()).length;
  } catch {
    return 0;
  }
}

/**
 * Count triggers by parsing ensemble YAML files
 */
async function countTriggers(): Promise<TriggerCounts> {
  const counts: TriggerCounts = {
    http: 0,
    webhook: 0,
    mcp: 0,
    cron: 0,
    email: 0,
    queue: 0,
    startup: 0,
    cli: 0,
    build: 0,
  };

  const ensembleDirs = ["ensembles", "src/ensembles"];

  for (const dir of ensembleDirs) {
    if (!existsSync(dir)) continue;

    try {
      const { readdir } = await import("node:fs/promises");
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isFile()) continue;
        if (!entry.name.endsWith(".yaml") && !entry.name.endsWith(".yml"))
          continue;

        try {
          const content = await readFile(join(dir, entry.name), "utf-8");

          // Count trigger types
          const triggerTypes = [
            "http",
            "webhook",
            "mcp",
            "cron",
            "email",
            "queue",
            "startup",
            "cli",
            "build",
          ] as const;
          for (const type of triggerTypes) {
            // Match type: <triggerType> in trigger array
            const regex = new RegExp(`type:\\s*${type}`, "gi");
            const matches = content.match(regex);
            if (matches) {
              counts[type] += matches.length;
            }
          }
        } catch {
          // Skip files that can't be read
        }
      }
    } catch {
      // Skip directories that can't be read
    }
  }

  return counts;
}

/**
 * Parse conductor.config.ts for cloud settings
 */
async function parseDeploymentSettings(): Promise<DeploymentStatus> {
  const deployment: DeploymentStatus = {
    cloudEnabled: false,
    pulse: true, // Default to true
  };

  // Check wrangler.toml for [ensemble.cloud]
  if (existsSync("wrangler.toml")) {
    try {
      const content = await readFile("wrangler.toml", "utf-8");
      if (content.match(/\[ensemble\.cloud\][\s\S]*?enabled\s*=\s*true/)) {
        deployment.cloudEnabled = true;
      }
    } catch {
      // Ignore
    }
  }

  // Check conductor.config.ts for cloud settings
  const configFiles = ["conductor.config.ts", "conductor.config.js"];
  for (const configFile of configFiles) {
    if (!existsSync(configFile)) continue;

    try {
      const content = await readFile(configFile, "utf-8");

      // Extract workerUrl
      const workerUrlMatch = content.match(/workerUrl\s*:\s*['"]([^'"]+)['"]/);
      if (workerUrlMatch) {
        deployment.workerUrl = workerUrlMatch[1];
      }

      // Check pulse setting
      if (content.match(/pulse\s*:\s*false/)) {
        deployment.pulse = false;
      }

      break;
    } catch {
      // Continue
    }
  }

  return deployment;
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

/**
 * Parse plugins from conductor.config.ts
 */
async function parsePlugins(): Promise<string[]> {
  const plugins: string[] = [];
  const configFiles = ["conductor.config.ts", "conductor.config.js"];

  for (const configFile of configFiles) {
    if (!existsSync(configFile)) continue;

    try {
      const content = await readFile(configFile, "utf-8");

      // Look for common plugin patterns
      const pluginPatterns = [
        /cloudflarePlugin/,
        /unkeyPlugin/,
        /payloadPlugin/,
        /plasmicPlugin/,
        /resendPlugin/,
        /twilioPlugin/,
        /stripePlugin/,
      ];

      for (const pattern of pluginPatterns) {
        if (pattern.test(content)) {
          const name = pattern.source.replace("Plugin", "");
          plugins.push(name);
        }
      }

      break;
    } catch {
      // Continue
    }
  }

  return plugins;
}

// ─────────────────────────────────────────────────────────────────────────────
// Display Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format service status line
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
    `  requireAuth:      ${status.security.requireAuth === true ? colors.success("✓ true") : status.security.requireAuth === false ? colors.dim("○ false") : colors.dim("○ default")}`,
  );
  console.log(
    `  stealthMode:      ${status.security.stealthMode === true ? colors.success("✓ true") : colors.dim("○ false")}`,
  );
  console.log(
    `  allowDirectAgentExecution: ${status.security.allowDirectAgentExecution === true || status.security.allowDirectAgentExecution === undefined ? colors.success("✓ true") : colors.dim("○ false")}`,
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
 */
export async function conductorStatus(args: string[]): Promise<void> {
  const isJson = args.includes("--json");
  const isCompact = args.includes("--compact");
  const skipHealth = args.includes("--no-health-check");

  // Check if conductor is initialized
  if (!isConductorInitialized()) {
    const initialized = await displayUninitializedStatus(isJson, isCompact);
    if (initialized) {
      // Re-run status after initialization
      await conductorStatus(args);
    }
    return;
  }

  // Gather all status info in parallel
  const [
    project,
    config,
    environment,
    security,
    cloudflare,
    components,
    triggers,
    deployment,
    plugins,
  ] = await Promise.all([
    readProjectInfo(),
    Promise.resolve(checkConfigFiles()),
    detectEnvironment(),
    parseSecuritySettings(),
    parseCloudflareServices(),
    countComponents(),
    countTriggers(),
    parseDeploymentSettings(),
    parsePlugins(),
  ]);

  const status: ConductorStatus = {
    project,
    config,
    environment,
    components,
    triggers,
    security,
    plugins,
    cloudflare,
    deployment,
  };

  // Health check (unless skipped or JSON mode)
  if (status.deployment.workerUrl && !skipHealth) {
    if (!isJson && !isCompact) {
      const spinner = createSpinner("Checking worker health...").start();
      status.deployment.health = await pingWorkerHealth(
        status.deployment.workerUrl,
      );
      spinner.stop();
    } else {
      status.deployment.health = await pingWorkerHealth(
        status.deployment.workerUrl,
      );
    }
  }

  // Display
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
  status          Show project status
  dev             Start development server
  deploy          Deploy to production
  validate        Validate configuration
  exec            Execute agents
  docs            Generate API documentation
  test            Run tests

${colors.bold("Status Options:")}
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
  ${colors.accent("ensemble conductor status")}
  ${colors.accent("ensemble conductor status --compact")}
  ${colors.accent("ensemble conductor status --json")}

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
    case "status":
      await conductorStatus(subArgs);
      break;
    default:
      // For other commands, delegate to the conductor CLI
      // This will be handled by the existing runConductor in router.ts
      log.error(`Unknown conductor command: ${subCmd}`);
      log.dim("Run `ensemble conductor --help` for available commands.");
  }
}

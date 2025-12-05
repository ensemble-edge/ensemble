/**
 * Build-Time Configuration Loader
 *
 * Loads conductor.config.json from the project root at build time.
 * Used by Vite plugins to read discovery configuration.
 *
 * This is a Node.js module (build-time only, not bundled for Workers).
 */

import * as fs from 'fs';
import * as path from 'path';
import type {
  DiscoveryConfig,
  AgentDiscoveryConfig,
  EnsembleDiscoveryConfig,
  DocsDiscoveryConfig,
  ScriptsDiscoveryConfig,
} from '@ensemble-edge/conductor';
import {
  DEFAULT_AGENT_DISCOVERY,
  DEFAULT_ENSEMBLE_DISCOVERY,
  DEFAULT_DOCS_DISCOVERY,
  DEFAULT_SCRIPTS_DISCOVERY,
  mergeDiscoveryConfig,
} from '@ensemble-edge/conductor';

/**
 * Config file names to look for (in order of preference)
 */
const CONFIG_FILE_NAMES = ['conductor.config.json', 'conductor.json', '.conductorrc.json'];

/**
 * Cached config by root directory
 */
const configCache = new Map<string, DiscoveryConfig>();

/**
 * Load conductor.config.json from a directory
 *
 * @param root - Project root directory
 * @returns Discovery configuration (merged with defaults)
 */
export function loadDiscoveryConfig(root: string): DiscoveryConfig {
  // Check cache first
  const cached = configCache.get(root);
  if (cached) {
    return cached;
  }

  // Try to find and load config file
  let rawConfig: { discovery?: Partial<DiscoveryConfig> } | null = null;

  for (const configFileName of CONFIG_FILE_NAMES) {
    const configPath = path.resolve(root, configFileName);
    if (fs.existsSync(configPath)) {
      try {
        const content = fs.readFileSync(configPath, 'utf-8');
        rawConfig = JSON.parse(content);
        console.log(`[conductor] Loaded config from ${configFileName}`);
        break;
      } catch (error) {
        console.warn(`[conductor] Failed to parse ${configFileName}:`, error);
      }
    }
  }

  // Merge with defaults
  const config = mergeDiscoveryConfig(rawConfig?.discovery);

  // Cache the result
  configCache.set(root, config);

  return config;
}

/**
 * Get agent discovery config from project root
 */
export function getAgentDiscoveryConfig(root: string): AgentDiscoveryConfig {
  const config = loadDiscoveryConfig(root);
  return config.agents || DEFAULT_AGENT_DISCOVERY;
}

/**
 * Get ensemble discovery config from project root
 */
export function getEnsembleDiscoveryConfig(root: string): EnsembleDiscoveryConfig {
  const config = loadDiscoveryConfig(root);
  return config.ensembles || DEFAULT_ENSEMBLE_DISCOVERY;
}

/**
 * Get docs discovery config from project root
 */
export function getDocsDiscoveryConfig(root: string): DocsDiscoveryConfig {
  const config = loadDiscoveryConfig(root);
  return config.docs || DEFAULT_DOCS_DISCOVERY;
}

/**
 * Get scripts discovery config from project root
 */
export function getScriptsDiscoveryConfig(root: string): ScriptsDiscoveryConfig {
  const config = loadDiscoveryConfig(root);
  return config.scripts || DEFAULT_SCRIPTS_DISCOVERY;
}

/**
 * Clear the config cache (useful for testing)
 */
export function clearConfigCache(): void {
  configCache.clear();
}

/**
 * Convert patterns array to glob pattern string
 */
export function patternsToGlob(patterns: string[]): string {
  if (patterns.length === 1) {
    return patterns[0];
  }
  // For file extension patterns like ["**/*.yaml", "**/*.yml"],
  // we need to handle them differently
  // Extract just the extensions and create a combined pattern
  return `{${patterns.join(',')}}`;
}

/**
 * Convert exclude dirs to glob ignore patterns
 */
export function excludeDirsToIgnore(excludeDirs: string[]): string[] {
  return excludeDirs.map((dir) => `${dir}/**`);
}

/**
 * Collision detection result
 */
export interface CollisionInfo {
  name: string;
  files: string[];
}

/**
 * Detect name collisions between files
 *
 * This is a generic utility that can be used by any discovery plugin to detect
 * when multiple files would resolve to the same name (e.g., ai-pipeline.yaml
 * and ai-pipeline.ts both resolve to "ai-pipeline").
 *
 * @param files - Array of file paths
 * @param extractName - Function to extract the name from a file path
 * @returns Array of collisions (names with multiple files)
 */
export function detectCollisions(
  files: string[],
  extractName: (file: string) => string
): CollisionInfo[] {
  const nameToFiles = new Map<string, string[]>();

  for (const file of files) {
    const name = extractName(file);
    const existing = nameToFiles.get(name) || [];
    existing.push(file);
    nameToFiles.set(name, existing);
  }

  // Return only names with multiple files
  const collisions: CollisionInfo[] = [];
  for (const [name, fileList] of nameToFiles) {
    if (fileList.length > 1) {
      collisions.push({ name, files: fileList });
    }
  }

  return collisions;
}

/**
 * Log collision warnings in a standardized format
 *
 * @param pluginName - Name of the discovery plugin (e.g., "ensemble-discovery")
 * @param collisions - Array of detected collisions
 * @param resourceType - Type of resource being discovered (e.g., "ensembles", "agents")
 * @param directory - Directory being scanned
 */
export function logCollisionWarnings(
  pluginName: string,
  collisions: CollisionInfo[],
  resourceType: string,
  directory: string
): void {
  if (collisions.length === 0) return;

  console.warn(`\n⚠️  [conductor:${pluginName}] NAME COLLISIONS DETECTED:`);
  for (const collision of collisions) {
    console.warn(`   "${collision.name}" is defined by multiple files:`);
    for (const file of collision.files) {
      console.warn(`      - ${directory}/${file}`);
    }
    console.warn(
      `   → The last loaded ${resourceType.slice(0, -1)} will take precedence. ` +
        `Consider renaming to avoid confusion.\n`
    );
  }
}

// Re-export defaults for convenience
export {
  DEFAULT_AGENT_DISCOVERY,
  DEFAULT_ENSEMBLE_DISCOVERY,
  DEFAULT_DOCS_DISCOVERY,
  DEFAULT_SCRIPTS_DISCOVERY,
};

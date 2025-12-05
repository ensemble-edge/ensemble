/**
 * Vite Plugin: Agent Discovery
 *
 * Discovers agents from the agents/ directory and generates a virtual module
 * with all agent configurations and handlers.
 *
 * Supports centralized configuration via conductor.config.json:
 * ```json
 * {
 *   "discovery": {
 *     "agents": {
 *       "enabled": true,
 *       "directory": "agents",
 *       "patterns": ["**\/*.yaml", "**\/*.yml"],
 *       "excludeDirs": ["generate-docs"]
 *     }
 *   }
 * }
 * ```
 */

import type { Plugin } from 'vite';
import { globSync } from 'glob';
import path from 'path';
import fs from 'fs';
import * as YAML from 'yaml';
import {
  getAgentDiscoveryConfig,
  patternsToGlob,
  excludeDirsToIgnore,
  DEFAULT_AGENT_DISCOVERY,
  detectCollisions,
  logCollisionWarnings,
} from './config-loader.js';
import type { AgentDiscoveryConfig } from '@ensemble-edge/conductor';

const VIRTUAL_MODULE_ID = 'virtual:conductor-agents';
const RESOLVED_VIRTUAL_MODULE_ID = '\0' + VIRTUAL_MODULE_ID;

/**
 * Agent discovery plugin options
 *
 * Options can be provided directly OR loaded from conductor.config.json.
 * Direct options take precedence over config file settings.
 */
export interface AgentDiscoveryOptions {
  /**
   * Directory to search for agent files (YAML and TypeScript)
   * @default 'agents' (or from conductor.config.json)
   */
  agentsDir?: string;

  /**
   * File extensions for agent config files
   * @default ['.yaml', '.yml'] (or from conductor.config.json)
   */
  fileExtensions?: string[];

  /**
   * @deprecated Use fileExtensions instead
   * File extension for agent config files
   * @default '.yaml'
   */
  fileExtension?: string;

  /**
   * Directories to exclude from discovery
   * @default ['generate-docs'] (or from conductor.config.json)
   */
  excludeDirs?: string[];

  /**
   * Include agents in examples/ subdirectories
   * Set to false to exclude example agents from discovery
   * @default true (or from conductor.config.json)
   */
  includeExamples?: boolean;

  /**
   * Load configuration from conductor.config.json
   * When true, options from config file are used as defaults
   * @default true
   */
  useConfigFile?: boolean;
}

export function agentDiscoveryPlugin(options: AgentDiscoveryOptions = {}): Plugin {
  const useConfigFile = options.useConfigFile !== false;

  let root: string;
  let resolvedConfig: {
    agentsDir: string;
    fileExtensions: string[];
    excludeDirs: string[];
  };

  return {
    name: 'conductor:agent-discovery',

    configResolved(config) {
      root = config.root;

      // Load config from file or use defaults
      const configFromFile = useConfigFile
        ? getAgentDiscoveryConfig(root)
        : DEFAULT_AGENT_DISCOVERY;

      // Merge with explicit options (explicit options take precedence)
      const agentsDir = options.agentsDir || configFromFile.directory;

      // Handle file extensions
      let fileExtensions: string[];
      if (options.fileExtensions) {
        fileExtensions = options.fileExtensions;
      } else if (options.fileExtension) {
        // Deprecated single extension
        fileExtensions = [options.fileExtension];
      } else {
        // Convert patterns like ["**/*.yaml", "**/*.yml"] to extensions [".yaml", ".yml"]
        fileExtensions = configFromFile.patterns.map((p) => {
          const match = p.match(/\*\.(\w+)$/);
          return match ? `.${match[1]}` : '.yaml';
        });
      }

      // Build exclude list
      const baseExcludes = options.excludeDirs || configFromFile.excludeDirs || ['generate-docs'];
      const includeExamples = options.includeExamples ?? configFromFile.includeExamples ?? true;
      const excludeDirs = includeExamples ? baseExcludes : [...baseExcludes, 'examples'];

      resolvedConfig = {
        agentsDir,
        fileExtensions,
        excludeDirs,
      };
    },

    resolveId(id) {
      if (id === VIRTUAL_MODULE_ID) {
        return RESOLVED_VIRTUAL_MODULE_ID;
      }
    },

    load(id) {
      if (id === RESOLVED_VIRTUAL_MODULE_ID) {
        const code = generateAgentsModule(
          root,
          resolvedConfig.agentsDir,
          resolvedConfig.fileExtensions,
          resolvedConfig.excludeDirs
        );
        return code;
      }
    },

    // Hot reload support for development
    handleHotUpdate({ file, server }) {
      const matchesExtension =
        resolvedConfig.fileExtensions.some((ext) => file.endsWith(ext)) || file.endsWith('.ts');
      if (file.includes(resolvedConfig.agentsDir) && matchesExtension) {
        const module = server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_MODULE_ID);
        if (module) {
          server.moduleGraph.invalidateModule(module);
          return [module];
        }
      }
    },
  };
}

function generateAgentsModule(
  root: string,
  agentsDir: string,
  fileExtensions: string[],
  excludeDirs: string[]
): string {
  const agentsDirPath = path.resolve(root, agentsDir);

  // Check if agents directory exists
  if (!fs.existsSync(agentsDirPath)) {
    console.warn(`[conductor:agent-discovery] Directory not found: ${agentsDirPath}`);
    return `
export const agents = [];
export const agentsMap = new Map();
`;
  }

  // Build glob pattern for all extensions
  const extPattern =
    fileExtensions.length === 1
      ? `**/*${fileExtensions[0]}`
      : `**/*{${fileExtensions.join(',')}}`;

  // Find all agent config files
  const agentFiles = globSync(extPattern, {
    cwd: agentsDirPath,
    ignore: excludeDirs.map((dir) => `${dir}/**`),
  });

  console.log(`[conductor:agent-discovery] Found ${agentFiles.length} agent files in ${agentsDir}/`);

  // Detect and warn about name collisions at build time
  // For agents, the name is derived from the directory structure
  const collisions = detectCollisions(agentFiles, (file) => {
    const agentDir = path.dirname(file);
    // Agent name is the directory name, or filename if at root
    return agentDir === '.' ? path.basename(file, path.extname(file)) : agentDir;
  });
  logCollisionWarnings('agent-discovery', collisions, 'agents', agentsDir);

  const imports: string[] = [];
  const agentEntries: string[] = [];
  const mapEntries: string[] = [];

  for (const agentFile of agentFiles) {
    const agentFilePath = path.resolve(agentsDirPath, agentFile);
    const agentDir = path.dirname(agentFilePath);
    const ext = path.extname(agentFile);

    // Get agent name from the parent directory, not the filename
    // For "text-processor/agent.yaml" we want "text-processor"
    // For "examples/hello/agent.yaml" we want "examples/hello"
    const relativeDir = path.relative(agentsDirPath, agentDir);
    const agentName = relativeDir || path.basename(agentFile, ext);

    // Read YAML content
    const yamlContent = fs.readFileSync(agentFilePath, 'utf-8');

    // Parse YAML to extract handler field
    let parsedYaml: { handler?: string; operation?: string } = {};
    try {
      parsedYaml = YAML.parse(yamlContent) || {};
    } catch {
      // If YAML parsing fails, continue with default behavior
    }

    // Determine handler path:
    // 1. If YAML has explicit `handler` field, use that (e.g., "./validate.ts")
    // 2. Otherwise, fall back to convention-based `index.ts`
    let handlerPath: string;
    let handlerExists: boolean;

    if (parsedYaml.handler) {
      // Resolve handler path relative to the agent directory
      // Handler field is like "./validate.ts" or "./tools.ts"
      handlerPath = path.resolve(agentDir, parsedYaml.handler);
      handlerExists = fs.existsSync(handlerPath);
    } else {
      // Fall back to convention: index.ts in agent directory
      handlerPath = path.join(agentDir, 'index.ts');
      handlerExists = fs.existsSync(handlerPath);
    }

    // Use the full relative path for unique variable names
    const handlerVarName = `handler_${agentName.replace(/[^a-zA-Z0-9]/g, '_')}`;

    // Import handler if exists
    if (handlerExists) {
      const relativePath = path.relative(root, handlerPath);
      // Normalize to forward slashes for ESM (path.relative uses OS separators)
      const normalizedPath = relativePath.replace(/\\/g, '/');
      // Ensure path starts with ./ for proper module resolution
      const importPath = normalizedPath.startsWith('.') ? normalizedPath : `./${normalizedPath}`;
      imports.push(`import * as ${handlerVarName} from '${importPath}';`);
    }

    // Base64 encode YAML content to handle emojis and special characters
    const yamlBase64 = Buffer.from(yamlContent, 'utf-8').toString('base64');

    // Generate agent entry
    const agentEntry = `
  {
    name: ${JSON.stringify(agentName)},
    config: atob(${JSON.stringify(yamlBase64)}),
    ${handlerExists ? `handler: () => Promise.resolve(${handlerVarName}.default || ${handlerVarName}),` : ''}
  }`;

    agentEntries.push(agentEntry);

    // Generate map entry
    const mapEntry = `
  [${JSON.stringify(agentName)}, {
    name: ${JSON.stringify(agentName)},
    config: atob(${JSON.stringify(yamlBase64)}),
    ${handlerExists ? `handler: () => Promise.resolve(${handlerVarName}.default || ${handlerVarName}),` : ''}
  }]`;

    mapEntries.push(mapEntry);
  }

  // Generate the module code
  const code = `
${imports.join('\n')}

/**
 * Array of all discovered agents
 * Each agent includes:
 * - name: Agent identifier (from filename)
 * - config: Raw YAML content as string
 * - handler: Optional function that returns the handler module
 */
export const agents = [${agentEntries.join(',')}
];

/**
 * Map of agent name to agent definition
 * Useful for O(1) lookups by name
 */
export const agentsMap = new Map([${mapEntries.join(',')}
]);
`;

  return code;
}

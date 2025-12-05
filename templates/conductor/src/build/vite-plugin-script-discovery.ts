/**
 * Vite Plugin: Auto-Discovery of Scripts
 *
 * Scans scripts/ directory for TypeScript files and automatically generates
 * imports and registration code via virtual module.
 *
 * Supports centralized configuration via conductor.config.json:
 * ```json
 * {
 *   "discovery": {
 *     "scripts": {
 *       "enabled": true,
 *       "directory": "scripts",
 *       "patterns": ["**\/*.ts"],
 *       "excludeDirs": []
 *     }
 *   }
 * }
 * ```
 *
 * This enables the `script://` URI pattern for referencing reusable code
 * in ensembles without using `new Function()` (which is blocked in Workers).
 *
 * Example:
 *   scripts/transforms/csv.ts → script://transforms/csv
 *   scripts/validators/email.ts → script://validators/email
 *   scripts/health-check.ts → script://health-check
 */

import type { Plugin } from 'vite';
import { globSync } from 'glob';
import path from 'path';
import fs from 'fs';
import {
  getScriptsDiscoveryConfig,
  DEFAULT_SCRIPTS_DISCOVERY,
  detectCollisions,
  logCollisionWarnings,
} from './config-loader.js';

const VIRTUAL_MODULE_ID = 'virtual:conductor-scripts';
const RESOLVED_VIRTUAL_MODULE_ID = '\0' + VIRTUAL_MODULE_ID;

/**
 * Script discovery plugin options
 *
 * Options can be provided directly OR loaded from conductor.config.json.
 * Direct options take precedence over config file settings.
 */
export interface ScriptDiscoveryOptions {
  /**
   * Directory to search for script files
   * @default 'scripts' (or from conductor.config.json)
   */
  scriptsDir?: string;

  /**
   * File extension for script files
   * @default '.ts' (or from conductor.config.json)
   */
  fileExtension?: string;

  /**
   * Directories to exclude from discovery
   * @default [] (or from conductor.config.json)
   */
  excludeDirs?: string[];

  /**
   * Load configuration from conductor.config.json
   * When true, options from config file are used as defaults
   * @default true
   */
  useConfigFile?: boolean;
}

export function scriptDiscoveryPlugin(options: ScriptDiscoveryOptions = {}): Plugin {
  const useConfigFile = options.useConfigFile !== false;

  let root: string;
  let resolvedConfig: {
    scriptsDir: string;
    fileExtension: string;
    excludeDirs: string[];
    enabled: boolean;
  };

  return {
    name: 'conductor:script-discovery',

    configResolved(config) {
      root = config.root;

      // Load config from file or use defaults
      const configFromFile = useConfigFile
        ? getScriptsDiscoveryConfig(root)
        : DEFAULT_SCRIPTS_DISCOVERY;

      // Merge with explicit options (explicit options take precedence)
      const scriptsDir = options.scriptsDir || configFromFile.directory;

      // Get file extension from patterns
      let fileExtension: string;
      if (options.fileExtension) {
        fileExtension = options.fileExtension;
      } else {
        // Extract extension from first pattern like "**/*.ts"
        const firstPattern = configFromFile.patterns[0];
        const match = firstPattern.match(/\*\.(\w+)$/);
        fileExtension = match ? `.${match[1]}` : '.ts';
      }

      const excludeDirs = options.excludeDirs || configFromFile.excludeDirs || [];

      resolvedConfig = {
        scriptsDir,
        fileExtension,
        excludeDirs,
        enabled: configFromFile.enabled !== false,
      };
    },

    resolveId(id) {
      if (id === VIRTUAL_MODULE_ID) {
        return RESOLVED_VIRTUAL_MODULE_ID;
      }
    },

    load(id) {
      if (id === RESOLVED_VIRTUAL_MODULE_ID) {
        // If scripts discovery is disabled, return empty module
        if (!resolvedConfig.enabled) {
          return `
/**
 * Script discovery is disabled in conductor.config.json.
 * Set "discovery.scripts.enabled": true to enable.
 */
export const scripts = [];
export const scriptsMap = new Map();
`;
        }

        const code = generateScriptsModule(
          root,
          resolvedConfig.scriptsDir,
          resolvedConfig.fileExtension,
          resolvedConfig.excludeDirs
        );
        return code;
      }
    },

    // Hot reload support for development
    handleHotUpdate({ file, server }) {
      if (!resolvedConfig.enabled) return;

      const scriptsDirPath = path.resolve(root, resolvedConfig.scriptsDir);
      if (file.startsWith(scriptsDirPath) && file.endsWith(resolvedConfig.fileExtension)) {
        const module = server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_MODULE_ID);
        if (module) {
          server.moduleGraph.invalidateModule(module);
          return [module];
        }
      }
    },
  };
}

function generateScriptsModule(
  root: string,
  scriptsDir: string,
  fileExtension: string,
  excludeDirs: string[]
): string {
  const scriptsDirPath = path.resolve(root, scriptsDir);

  // Check if scripts directory exists
  if (!fs.existsSync(scriptsDirPath)) {
    // Scripts directory is optional - don't warn, just return empty module
    return `
/**
 * No scripts directory found.
 * Create a scripts/ directory with .ts files to use script:// URIs in ensembles.
 */
export const scripts = [];
export const scriptsMap = new Map();
`;
  }

  // Find all TypeScript files in scripts directory
  const scriptFiles = globSync(`**/*${fileExtension}`, {
    cwd: scriptsDirPath,
    ignore: [
      ...excludeDirs.map((dir) => `${dir}/**`),
      '**/*.test.ts',
      '**/*.spec.ts',
      '**/__tests__/**',
    ],
  });

  if (scriptFiles.length === 0) {
    return `
/**
 * No script files found in ${scriptsDir}/.
 * Add .ts files with default exports to use script:// URIs in ensembles.
 */
export const scripts = [];
export const scriptsMap = new Map();
`;
  }

  console.log(`[conductor:script-discovery] Found ${scriptFiles.length} script files in ${scriptsDir}/`);

  // Detect and warn about name collisions at build time
  // For scripts, the name is the file path without extension
  const collisions = detectCollisions(scriptFiles, (file) =>
    file.replace(new RegExp(`${fileExtension}$`), '')
  );
  logCollisionWarnings('script-discovery', collisions, 'scripts', scriptsDir);

  const imports: string[] = [];
  const scriptEntries: string[] = [];
  const mapEntries: string[] = [];

  for (const scriptFile of scriptFiles) {
    const scriptFilePath = path.resolve(scriptsDirPath, scriptFile);

    // Generate script name from file path (without extension)
    // For "transforms/csv.ts" we want "transforms/csv"
    // For "health-check.ts" we want "health-check"
    const scriptName = scriptFile.replace(new RegExp(`${fileExtension}$`), '');

    // Generate safe variable name for import
    const varName = `script_${scriptName.replace(/[^a-zA-Z0-9]/g, '_')}`;

    // Generate import path
    const relativePath = path.relative(root, scriptFilePath);
    // Normalize to forward slashes for ESM (path.relative uses OS separators)
    const normalizedPath = relativePath.replace(/\\/g, '/');
    // Ensure path starts with ./ for proper module resolution
    const importPath = normalizedPath.startsWith('.') ? normalizedPath : `./${normalizedPath}`;

    imports.push(`import ${varName} from '${importPath}';`);

    // Generate script entry
    const scriptEntry = `
  {
    name: ${JSON.stringify(scriptName)},
    handler: ${varName},
  }`;

    scriptEntries.push(scriptEntry);

    // Generate map entry
    const mapEntry = `[${JSON.stringify(scriptName)}, ${varName}]`;
    mapEntries.push(mapEntry);
  }

  // Generate the module code
  const code = `
${imports.join('\n')}

/**
 * Array of all discovered scripts
 * Each script includes:
 * - name: Script identifier (from file path, e.g., "transforms/csv")
 * - handler: The default export function from the script file
 */
export const scripts = [${scriptEntries.join(',')}
];

/**
 * Map of script name to handler function
 * Used for O(1) lookups by script:// URI
 *
 * Usage in ensembles:
 *   config:
 *     script: "script://transforms/csv"
 *
 * At runtime, resolves to scriptsMap.get("transforms/csv")
 */
export const scriptsMap = new Map([
  ${mapEntries.join(',\n  ')}
]);
`;

  return code;
}

/**
 * Vite Plugin: Ensemble Discovery
 *
 * Discovers ensembles from the ensembles/ directory and generates a virtual module
 * with all ensemble configurations.
 *
 * Supports centralized configuration via conductor.config.json:
 * ```json
 * {
 *   "discovery": {
 *     "ensembles": {
 *       "enabled": true,
 *       "directory": "ensembles",
 *       "patterns": ["**\/*.yaml", "**\/*.yml", "**\/*.ts"]
 *     }
 *   }
 * }
 * ```
 */

import type { Plugin } from 'vite';
import { globSync } from 'glob';
import path from 'path';
import fs from 'fs';
import {
  getEnsembleDiscoveryConfig,
  DEFAULT_ENSEMBLE_DISCOVERY,
  detectCollisions,
  logCollisionWarnings,
} from './config-loader.js';

const VIRTUAL_MODULE_ID = 'virtual:conductor-ensembles';
const RESOLVED_VIRTUAL_MODULE_ID = '\0' + VIRTUAL_MODULE_ID;

/**
 * Ensemble discovery plugin options
 *
 * Options can be provided directly OR loaded from conductor.config.json.
 * Direct options take precedence over config file settings.
 */
export interface EnsembleDiscoveryOptions {
  /**
   * Directory to search for ensemble files (YAML and TypeScript)
   * @default 'ensembles' (or from conductor.config.json)
   */
  ensemblesDir?: string;

  /**
   * File extensions for ensemble config files
   * @default ['.yaml', '.yml', '.ts'] (or from conductor.config.json)
   */
  fileExtensions?: string[];

  /**
   * @deprecated Use fileExtensions instead
   * File extension for ensemble config files
   * @default '.yaml'
   */
  fileExtension?: string;

  /**
   * Load configuration from conductor.config.json
   * When true, options from config file are used as defaults
   * @default true
   */
  useConfigFile?: boolean;
}

export function ensembleDiscoveryPlugin(options: EnsembleDiscoveryOptions = {}): Plugin {
  const useConfigFile = options.useConfigFile !== false;

  let root: string;
  let resolvedConfig: {
    ensemblesDir: string;
    fileExtensions: string[];
  };

  return {
    name: 'conductor:ensemble-discovery',

    configResolved(config) {
      root = config.root;

      // Load config from file or use defaults
      const configFromFile = useConfigFile
        ? getEnsembleDiscoveryConfig(root)
        : DEFAULT_ENSEMBLE_DISCOVERY;

      // Merge with explicit options (explicit options take precedence)
      const ensemblesDir = options.ensemblesDir || configFromFile.directory;

      // Handle file extensions
      let fileExtensions: string[];
      if (options.fileExtensions) {
        fileExtensions = options.fileExtensions;
      } else if (options.fileExtension) {
        // Deprecated single extension
        fileExtensions = [options.fileExtension];
      } else {
        // Convert patterns like ["**/*.yaml", "**/*.yml", "**/*.ts"] to extensions
        fileExtensions = configFromFile.patterns.map((p) => {
          const match = p.match(/\*\.(\w+)$/);
          return match ? `.${match[1]}` : '.yaml';
        });
      }

      resolvedConfig = {
        ensemblesDir,
        fileExtensions,
      };
    },

    resolveId(id) {
      if (id === VIRTUAL_MODULE_ID) {
        return RESOLVED_VIRTUAL_MODULE_ID;
      }
    },

    load(id) {
      if (id === RESOLVED_VIRTUAL_MODULE_ID) {
        const code = generateEnsemblesModule(
          root,
          resolvedConfig.ensemblesDir,
          resolvedConfig.fileExtensions
        );
        return code;
      }
    },

    // Hot reload support for development
    handleHotUpdate({ file, server }) {
      const matchesExtension = resolvedConfig.fileExtensions.some((ext) => file.endsWith(ext));
      if (file.includes(resolvedConfig.ensemblesDir) && matchesExtension) {
        const module = server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_MODULE_ID);
        if (module) {
          server.moduleGraph.invalidateModule(module);
          return [module];
        }
      }
    },
  };
}

/**
 * Check if a file is a TypeScript ensemble
 */
function isTypeScriptFile(filePath: string): boolean {
  return filePath.endsWith('.ts') || filePath.endsWith('.tsx');
}

/**
 * Get the extension of a file
 */
function getFileExtension(filePath: string): string {
  const ext = path.extname(filePath);
  return ext;
}


function generateEnsemblesModule(
  root: string,
  ensemblesDir: string,
  fileExtensions: string[]
): string {
  const ensemblesDirPath = path.resolve(root, ensemblesDir);

  // Check if ensembles directory exists
  if (!fs.existsSync(ensemblesDirPath)) {
    console.warn(`[conductor:ensemble-discovery] Directory not found: ${ensemblesDirPath}`);
    return `
export const ensembles = [];
export const ensemblesMap = new Map();
export const tsEnsembleImports = {};
`;
  }

  // Build glob pattern for all extensions
  const extPattern =
    fileExtensions.length === 1
      ? `**/*${fileExtensions[0]}`
      : `**/*{${fileExtensions.join(',')}}`;

  // Find all ensemble files
  const ensembleFiles = globSync(extPattern, {
    cwd: ensemblesDirPath,
    ignore: ['**/*.test.ts', '**/*.spec.ts', '**/node_modules/**'],
  });

  // Detect and warn about name collisions at build time
  const collisions = detectCollisions(ensembleFiles, (file) => {
    const ext = getFileExtension(file);
    return path.basename(file, ext);
  });
  logCollisionWarnings('ensemble-discovery', collisions, 'ensembles', ensemblesDir);

  // Separate YAML and TypeScript files
  const yamlFiles = ensembleFiles.filter((f) => !isTypeScriptFile(f));
  const tsFiles = ensembleFiles.filter((f) => isTypeScriptFile(f));

  console.log(
    `[conductor:ensemble-discovery] Found ${ensembleFiles.length} ensemble files ` +
      `(${yamlFiles.length} YAML, ${tsFiles.length} TypeScript) in ${ensemblesDir}/`
  );

  const ensembleEntries: string[] = [];
  const mapEntries: string[] = [];
  const tsImports: string[] = [];
  const tsExportEntries: string[] = [];

  // Process YAML files (embedded as config strings)
  for (const ensembleFile of yamlFiles) {
    const ensembleFilePath = path.resolve(ensemblesDirPath, ensembleFile);
    const ext = getFileExtension(ensembleFile);
    const ensembleName = path.basename(ensembleFile, ext);

    // Read YAML content
    const yamlContent = fs.readFileSync(ensembleFilePath, 'utf-8');

    // Base64 encode YAML content to handle emojis and special characters
    const yamlBase64 = Buffer.from(yamlContent, 'utf-8').toString('base64');

    // Generate ensemble entry
    const ensembleEntry = `
  {
    name: ${JSON.stringify(ensembleName)},
    config: atob(${JSON.stringify(yamlBase64)}),
    type: 'yaml',
  }`;

    ensembleEntries.push(ensembleEntry);

    // Generate map entry
    const mapEntry = `
  [${JSON.stringify(ensembleName)}, {
    name: ${JSON.stringify(ensembleName)},
    config: atob(${JSON.stringify(yamlBase64)}),
    type: 'yaml',
  }]`;

    mapEntries.push(mapEntry);
  }

  // Process TypeScript files (generate imports)
  for (let i = 0; i < tsFiles.length; i++) {
    const ensembleFile = tsFiles[i];
    const ensembleFilePath = path.resolve(ensemblesDirPath, ensembleFile);
    const ext = getFileExtension(ensembleFile);
    const ensembleName = path.basename(ensembleFile, ext);
    const importName = `tsEnsemble_${i}`;

    // Generate relative import path from virtual module perspective
    const relativePath = path.relative(root, ensembleFilePath).replace(/\\/g, '/');

    // Generate import statement
    tsImports.push(`import ${importName} from '/${relativePath}';`);

    // Generate ensemble entry for TypeScript
    // Uses 'instance' to provide the Ensemble object directly to EnsembleLoader
    const ensembleEntry = `
  {
    name: ${JSON.stringify(ensembleName)},
    instance: ${importName},
    type: 'typescript',
  }`;

    ensembleEntries.push(ensembleEntry);

    // Generate map entry
    const mapEntry = `
  [${JSON.stringify(ensembleName)}, {
    name: ${JSON.stringify(ensembleName)},
    instance: ${importName},
    type: 'typescript',
  }]`;

    mapEntries.push(mapEntry);

    // Generate export entry for tsEnsembleImports
    tsExportEntries.push(`  ${JSON.stringify(ensembleName)}: ${importName}`);
  }

  // Generate the module code
  const code = `
${tsImports.join('\n')}

/**
 * Array of all discovered ensembles
 * Each ensemble includes:
 * - name: Ensemble identifier (from filename)
 * - config: Raw YAML content as string (for YAML files)
 * - instance: Ensemble object created by createEnsemble() (for TypeScript files)
 * - type: 'yaml' | 'typescript'
 */
export const ensembles = [${ensembleEntries.join(',')}
];

/**
 * Map of ensemble name to ensemble definition
 * Useful for O(1) lookups by name
 */
export const ensemblesMap = new Map([${mapEntries.join(',')}
]);

/**
 * Direct access to TypeScript ensemble imports
 * These are the actual Ensemble instances created by createEnsemble()
 */
export const tsEnsembleImports = {
${tsExportEntries.join(',\n')}
};
`;

  return code;
}

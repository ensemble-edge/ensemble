/**
 * Vite Plugin: Auto-Discovery of Docs
 *
 * Scans docs/ directory for .md files and automatically generates
 * imports and registration code via virtual module.
 *
 * Supports centralized configuration via conductor.config.json:
 * ```json
 * {
 *   "discovery": {
 *     "docs": {
 *       "enabled": true,
 *       "directory": "docs",
 *       "patterns": ["**\/*.md"],
 *       "excludeReadme": true
 *     }
 *   }
 * }
 * ```
 */

import { Plugin } from 'vite'
import fg from 'fast-glob'
import * as path from 'node:path'
import * as fs from 'node:fs'
import { getDocsDiscoveryConfig, DEFAULT_DOCS_DISCOVERY } from './config-loader.js'

const { globSync } = fg

const VIRTUAL_MODULE_ID = 'virtual:conductor-docs'
const RESOLVED_VIRTUAL_MODULE_ID = '\0' + VIRTUAL_MODULE_ID

/**
 * Docs discovery plugin options
 *
 * Options can be provided directly OR loaded from conductor.config.json.
 * Direct options take precedence over config file settings.
 */
export interface DocsDiscoveryOptions {
	/**
	 * Directory to scan for docs
	 * @default 'docs' (or from conductor.config.json)
	 */
	docsDir?: string

	/**
	 * File extension to match
	 * @default '.md' (or from conductor.config.json)
	 */
	fileExtension?: string

	/**
	 * Exclude README files
	 * @default true (or from conductor.config.json)
	 */
	excludeReadme?: boolean

	/**
	 * Load configuration from conductor.config.json
	 * When true, options from config file are used as defaults
	 * @default true
	 */
	useConfigFile?: boolean
}

export function docsDiscoveryPlugin(options: DocsDiscoveryOptions = {}): Plugin {
	const useConfigFile = options.useConfigFile !== false

	let root: string
	let resolvedConfig: {
		docsDir: string
		fileExtension: string
		excludeReadme: boolean
	}

	return {
		name: 'conductor:docs-discovery',

		configResolved(config) {
			root = config.root

			// Load config from file or use defaults
			const configFromFile = useConfigFile ? getDocsDiscoveryConfig(root) : DEFAULT_DOCS_DISCOVERY

			// Merge with explicit options (explicit options take precedence)
			const docsDir = options.docsDir || configFromFile.directory

			// Get file extension from patterns
			let fileExtension: string
			if (options.fileExtension) {
				fileExtension = options.fileExtension
			} else {
				// Extract extension from first pattern like "**/*.md"
				const firstPattern = configFromFile.patterns[0]
				const match = firstPattern.match(/\*\.(\w+)$/)
				fileExtension = match ? `.${match[1]}` : '.md'
			}

			const excludeReadme = options.excludeReadme ?? configFromFile.excludeReadme ?? true

			resolvedConfig = {
				docsDir,
				fileExtension,
				excludeReadme,
			}
		},

		resolveId(id) {
			if (id === VIRTUAL_MODULE_ID) {
				return RESOLVED_VIRTUAL_MODULE_ID
			}
		},

		load(id) {
			if (id === RESOLVED_VIRTUAL_MODULE_ID) {
				const code = generateDocsModule(
					root,
					resolvedConfig.docsDir,
					resolvedConfig.fileExtension,
					resolvedConfig.excludeReadme
				)
				return code
			}
		},

		handleHotUpdate({ file, server }) {
			// Watch for changes in docs directory
			const docsDirPath = path.resolve(root, resolvedConfig.docsDir)

			if (file.startsWith(docsDirPath)) {
				// Invalidate virtual module on any change in docs/
				const module = server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_MODULE_ID)
				if (module) {
					server.moduleGraph.invalidateModule(module)
				}

				// Trigger HMR
				server.ws.send({
					type: 'full-reload',
					path: '*',
				})
			}
		},
	}
}

/**
 * Generate the virtual module code with docs imports and docsMap
 */
function generateDocsModule(
	root: string,
	docsDir: string,
	fileExtension: string,
	excludeReadme: boolean
): string {
	const docsDirPath = path.resolve(root, docsDir)

	// Check if docs directory exists
	if (!fs.existsSync(docsDirPath)) {
		return `
// Docs directory not found: ${docsDir}/
export const docsMap = new Map();
export const docs = [];
`
	}

	// Find all .md files
	const docFiles = globSync(`**/*${fileExtension}`, {
		cwd: docsDirPath,
		absolute: false,
	})

	// Filter out README.md if configured
	const filteredFiles = excludeReadme
		? docFiles.filter((file) => !file.toLowerCase().includes('readme'))
		: docFiles

	if (filteredFiles.length === 0) {
		// No docs found - return empty module
		return `
// No markdown files found in ${docsDir}/
export const docsMap = new Map();
export const docs = [];
`
	}

	console.log(`[conductor:docs-discovery] Found ${filteredFiles.length} doc files in ${docsDir}/`)

	// Generate imports and map entries
	const imports: string[] = []
	const mapEntries: string[] = []
	const docsList: string[] = []

	filteredFiles.forEach((docFile, index) => {
		// Extract doc name (file name without extension)
		const docName = path.basename(docFile, fileExtension)

		// Generate safe variable name
		const varName = `doc_${docName.replace(/[^a-zA-Z0-9_]/g, '_')}_${index}`

		// Import path (relative to project root)
		const docPath = path.join(docsDirPath, docFile)

		// Read content directly
		const content = fs.readFileSync(docPath, 'utf-8')

		// Generate map entry (embed content as string literal)
		mapEntries.push(`
  ['${docName}', {
    name: '${docName}',
    content: ${JSON.stringify(content)},
  }]`)

		// Generate docs array entry
		docsList.push(`{
    name: '${docName}',
    content: ${JSON.stringify(content)},
  }`)
	})

	// Generate final module code
	return `
// Auto-generated by vite-plugin-docs-discovery
// This module is generated at build time by scanning ${docsDir}/

export const docsMap = new Map([
${mapEntries.join(',\n')}
]);

export const docs = [
${docsList.join(',\n')}
];

// Re-export for convenience
export default docsMap;
`
}

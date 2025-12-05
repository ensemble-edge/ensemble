/**
 * Docs Loader - First-class component support for markdown documentation
 *
 * Loads markdown files from docs/ directory with Handlebars rendering,
 * exactly like prompts/ works with ComponentLoader.
 *
 * Features:
 * - Auto-discovers .md files in docs/ directory
 * - Handlebars template rendering
 * - YAML frontmatter parsing
 * - In-memory caching
 * - Component references: docs/getting-started.md
 */

import { DocsManager, type DocsTemplate } from '@ensemble-edge/conductor'

export interface DocsLoaderConfig {
	/** Base directory for docs (default: 'docs') */
	docsDir?: string
	/** Enable caching (default: true) */
	cacheEnabled?: boolean
	/** Enable Handlebars rendering (default: true) */
	handlebarsEnabled?: boolean
}

/**
 * DocsLoader - Manages markdown documentation as first-class components
 *
 * Usage:
 * ```typescript
 * const loader = new DocsLoader()
 * await loader.init(docsMap)
 *
 * // Get and render a doc
 * const doc = await loader.get('getting-started', { projectName: 'My API' })
 * ```
 */
export class DocsLoader {
	private manager: DocsManager
	private config: Required<DocsLoaderConfig>
	private initialized = false

	constructor(config?: DocsLoaderConfig) {
		this.config = {
			docsDir: config?.docsDir || 'docs',
			cacheEnabled: config?.cacheEnabled ?? true,
			handlebarsEnabled: config?.handlebarsEnabled ?? true,
		}

		this.manager = new DocsManager({
			cacheEnabled: this.config.cacheEnabled,
			handlebarsEnabled: this.config.handlebarsEnabled,
		})
	}

	/**
	 * Initialize loader with auto-discovered docs
	 */
	async init(docsMap: Map<string, { name: string; content: string }>): Promise<void> {
		if (this.initialized) return

		for (const [name, { content }] of docsMap.entries()) {
			// Load and register template
			this.manager.loadFromMarkdown(content, name)
		}

		this.initialized = true
		console.log(`[DocsLoader] Initialized with ${docsMap.size} docs`)
	}

	/**
	 * Get and render a doc by name
	 *
	 * @param name - Doc name (without .md extension)
	 * @param variables - Variables to inject into Handlebars template
	 * @returns Rendered markdown content
	 */
	async get(name: string, variables?: Record<string, any>): Promise<string> {
		const rendered = await this.manager.renderByName(name, {
			variables: variables || {},
		})

		return rendered.content
	}

	/**
	 * Get raw doc template without rendering
	 */
	getRaw(name: string): DocsTemplate | null {
		return this.manager.get(name)
	}

	/**
	 * Check if a doc exists
	 */
	has(name: string): boolean {
		return this.manager.has(name)
	}

	/**
	 * List all available docs
	 */
	list(): Array<{ name: string; title?: string }> {
		return this.manager.list()
	}

	/**
	 * Register a custom Handlebars helper
	 *
	 * @example
	 * loader.registerHelper('upper', (str) => str.toUpperCase())
	 */
	registerHelper(name: string, fn: (...args: any[]) => any): void {
		this.manager.registerHelper(name, fn)
	}

	/**
	 * Register a Handlebars partial
	 *
	 * @example
	 * loader.registerPartial('header', '# {{title}}\n\n')
	 */
	registerPartial(name: string, template: string): void {
		this.manager.registerPartial(name, template)
	}

	/**
	 * Clear all cached docs
	 */
	clearCache(): void {
		this.manager.clearCache()
		this.initialized = false
	}
}

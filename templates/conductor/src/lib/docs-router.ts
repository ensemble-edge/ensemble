/**
 * DocsRouter - Handles documentation endpoints
 *
 * Temporary workaround that loads DocsMember via runtime import.
 * Once Conductor exports DocsMember, this can import it directly.
 */

import type { AgentConfig } from '@ensemble-edge/conductor';

// DocsMember class - loaded at runtime to bypass package exports
let DocsMemberClass: any = null;

async function getDocsMemberClass() {
	if (!DocsMemberClass) {
		try {
			// Runtime import bypasses build-time package export restriction
			const docsModule = await import('../../node_modules/@ensemble-edge/conductor/dist/agents/docs/docs-member.js');
			DocsMemberClass = docsModule.DocsMember;
		} catch (error) {
			console.error('Failed to load DocsMember:', error);
			throw new Error(
				'Could not load DocsMember. This feature requires Conductor to export DocsMember.\n' +
					'Expected in Conductor 1.10.1+'
			);
		}
	}
	return DocsMemberClass;
}

export interface DocsRoute {
	path: string;
	methods: string[];
	config: AgentConfig;
}

export interface DocsRouterConfig {
	docsDir?: string;
	autoRoute?: boolean;
	basePath?: string;
}

export class DocsRouter {
	private routes: DocsRoute[] = [];
	private config: DocsRouterConfig;

	constructor(config?: DocsRouterConfig) {
		this.config = {
			docsDir: 'agents/docs',
			autoRoute: true,
			basePath: '',
			...config,
		};
	}

	/**
	 * Register a docs endpoint with explicit configuration
	 */
	registerDocs(docsConfig: AgentConfig): void {
		// Extract route configuration from agent config
		const route = (docsConfig as any).route || {};
		const path = route.path === 'default' ? `/${docsConfig.name}` : route.path || `/${docsConfig.name}`;

		const methods = route.methods || ['GET'];

		this.routes.push({
			path: this.normalizePath(path),
			methods,
			config: docsConfig,
		});

		console.log(`[DocsRouter] Registered docs: ${path} (${methods.join(', ')})`);
	}

	/**
	 * Auto-discover docs agents from a map
	 */
	async discoverDocs(docsMap: Map<string, { config: AgentConfig }>): Promise<void> {
		if (!this.config.autoRoute) return;

		for (const [name, { config }] of docsMap.entries()) {
			this.registerDocs(config);
		}

		console.log(`[DocsRouter] Discovered ${this.routes.length} docs endpoints`);
	}

	/**
	 * Handle incoming request
	 */
	async handle(request: Request, env: any, ctx: ExecutionContext): Promise<Response | null> {
		const url = new URL(request.url);
		const path = this.normalizePath(url.pathname);
		const method = request.method;

		// Find matching route
		const route = this.findRoute(path, method);
		if (!route) {
			return null; // Not a docs route
		}

		try {
			// Get DocsMember class
			const DocsMember = await getDocsMemberClass();

			// Create DocsMember instance
			const docsMember = new DocsMember(route.config);

			// Execute with request context
			const result = await docsMember['run']({
				input: {
					request: {
						url: request.url,
						method: request.method,
						headers: Object.fromEntries(request.headers.entries()),
					},
				},
				env,
				ctx,
			});

			// Return response
			return new Response(result.content, {
				status: result.status,
				headers: {
					'Content-Type': result.contentType,
					...result.headers,
				},
			});
		} catch (error) {
			console.error('[DocsRouter] Error handling docs request:', error);
			return Response.json(
				{
					error: 'Documentation generation failed',
					message: error instanceof Error ? error.message : 'Unknown error',
				},
				{ status: 500 }
			);
		}
	}

	/**
	 * Find matching route for path and method
	 */
	private findRoute(path: string, method: string): DocsRoute | null {
		for (const route of this.routes) {
			if (this.matchPath(path, route.path) && route.methods.includes(method)) {
				return route;
			}
		}
		return null;
	}

	/**
	 * Match pathname against route pattern
	 * Supports exact match and prefix match for sub-paths (e.g., /docs/openapi.yaml)
	 */
	private matchPath(pathname: string, pattern: string): boolean {
		// Exact match
		if (pathname === pattern) {
			return true;
		}

		// Prefix match for sub-paths (e.g., /docs matches /docs/openapi.yaml)
		// This allows DocsMember to handle all its sub-paths
		if (pathname.startsWith(pattern + '/')) {
			return true;
		}

		return false;
	}

	/**
	 * Normalize path (ensure leading slash, remove trailing slash)
	 */
	private normalizePath(path: string): string {
		if (!path.startsWith('/')) {
			path = '/' + path;
		}
		if (path.length > 1 && path.endsWith('/')) {
			path = path.slice(0, -1);
		}
		return path;
	}

	/**
	 * Get all registered routes (for debugging/inspection)
	 */
	getRoutes(): DocsRoute[] {
		return [...this.routes];
	}
}

/**
 * Conductor Configuration
 *
 * Configure your Conductor project settings here.
 */

import type { ConductorConfig } from '@ensemble-edge/conductor';

const config: ConductorConfig = {
	/**
	 * Project information
	 */
	name: 'my-conductor-project',
	version: '1.0.0',

	/**
	 * Routing and authentication configuration
	 */
	routing: {
		// Auto-discover pages from directory structure
		autoDiscover: true,

		// Base path for all routes
		basePath: '',

		// Authentication configuration
		auth: {
			// Type-specific defaults
			defaults: {
				// Pages: Cookie auth with login redirect
				pages: {
					requirement: 'required',
					methods: ['cookie'],
					onFailure: {
						action: 'redirect',
						redirectTo: '/login',
						preserveReturn: true
					},
					rateLimit: {
						requests: 100,
						window: 60,
						keyBy: 'user'
					}
				},

				// APIs: Bearer/API key auth
				api: {
					requirement: 'required',
					methods: ['bearer', 'apiKey'],
					rateLimit: {
						requests: 1000,
						window: 60,
						keyBy: 'apiKey'
					}
				},

				// Webhooks: Custom signature validation
				webhooks: {
					requirement: 'required',
					methods: ['custom'],
					rateLimit: {
						requests: 100,
						window: 60,
						keyBy: 'ip'
					}
				},

				// Forms: Optional auth with rate limiting
				forms: {
					requirement: 'optional',
					methods: ['cookie'],
					rateLimit: {
						requests: 10,
						window: 300,
						keyBy: 'ip'
					}
				},

				// Docs: Optional auth (shows Try It button when authenticated)
				docs: {
					requirement: 'optional',
					methods: ['bearer', 'apiKey']
				}
			},

			// Path-based rules (override defaults)
			rules: [
				// Public pages
				{ pattern: '/', auth: { requirement: 'public' } },
				{ pattern: '/login', auth: { requirement: 'public' } },
				{ pattern: '/signup', auth: { requirement: 'public' } },
				{ pattern: '/pricing', auth: { requirement: 'public' } },

				// Public API endpoints
				{
					pattern: '/api/v1/public/*',
					auth: {
						requirement: 'public',
						rateLimit: { requests: 100, window: 60, keyBy: 'ip' }
					}
				},

				// Admin pages
				{
					pattern: '/admin/*',
					auth: {
						requirement: 'required',
						methods: ['cookie'],
						roles: ['admin'],
						onFailure: { action: 'page', page: 'error-403' }
					},
					priority: 10
				},

				// Admin API
				{
					pattern: '/api/v1/admin/*',
					auth: {
						requirement: 'required',
						methods: ['bearer'],
						roles: ['admin']
					},
					priority: 10
				},

				// Stripe webhooks
				{
					pattern: '/webhooks/stripe*',
					auth: {
						requirement: 'required',
						methods: ['custom'],
						customValidator: 'stripe-signature'
					}
				},

				// GitHub webhooks
				{
					pattern: '/webhooks/github*',
					auth: {
						requirement: 'required',
						methods: ['custom'],
						customValidator: 'github-signature'
					}
				}
			]
		}
	},

	/**
	 * API execution controls
	 *
	 * Controls which agents and ensembles can be executed via the Execute API
	 * (/api/v1/execute/agent/* and /api/v1/execute/ensemble/*).
	 *
	 * By default (requireExplicit: false), all agents/ensembles are executable
	 * unless they explicitly set apiExecutable: false.
	 *
	 * When requireExplicit: true, agents/ensembles must explicitly set
	 * apiExecutable: true to be executable via the API.
	 */
	api: {
		execution: {
			agents: {
				// When true, agents must have apiExecutable: true to be API executable
				requireExplicit: false
			},
			ensembles: {
				// When true, ensembles must have apiExecutable: true to be API executable
				requireExplicit: false
			}
		}
	},

	/**
	 * Documentation generation settings
	 */
	docs: {
		// UI framework for API docs
		ui: 'stoplight',

		// AI-powered documentation enhancement
		ai: {
			enabled: false,
			model: '@cf/meta/llama-3.1-8b-instruct',
			provider: 'cloudflare'
		},

		// Output format for CLI-generated docs
		format: 'yaml',

		// Include examples and security in generated docs
		includeExamples: true,
		includeSecurity: true,

		// Cache settings
		cache: {
			enabled: true,
			ttl: 3600 // 1 hour
		}
	},

	/**
	 * Testing configuration
	 */
	testing: {
		// Coverage thresholds
		coverage: {
			lines: 70,
			functions: 70,
			branches: 65,
			statements: 70
		},

		// Test timeout in milliseconds
		timeout: 30000
	},

	/**
	 * Observability configuration
	 */
	observability: {
		// Logging configuration
		logging: {
			enabled: true,
			level: 'info',
			format: 'json'
		},

		// Metrics configuration (Cloudflare Analytics Engine)
		metrics: {
			enabled: true,
			binding: 'ANALYTICS'
		},

		// Track AI token usage
		trackTokenUsage: true
	}
};

export default config;

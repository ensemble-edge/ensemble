/**
 * Type declarations for Conductor project
 *
 * This file provides global type declarations for:
 * - YAML/YML file imports
 * - Cloudflare Workers environment bindings
 */

// YAML module declarations
// YAML files are imported as parsed objects via @rollup/plugin-yaml in tests
// In production (Cloudflare Workers), they're imported as text via wrangler rules
declare module '*.yaml' {
	const content: Record<string, unknown>;
	export default content;
}

declare module '*.yml' {
	const content: Record<string, unknown>;
	export default content;
}

// Cloudflare Workers Environment Bindings
// Define all your environment variables and bindings here
interface Env {
	// Cloudflare AI binding (required by Conductor for Think agents)
	AI: Ai;

	// R2 Buckets for static assets
	ASSETS?: R2Bucket;

	// API Keys for authentication (comma-separated)
	API_KEYS?: string;

	// Add your other environment bindings below:
	// KV Namespaces
	// MY_KV?: KVNamespace;

	// D1 Databases
	// MY_DB?: D1Database;

	// R2 Buckets
	// MY_BUCKET?: R2Bucket;

	// Environment Variables
	// API_KEY?: string;
	// ENVIRONMENT?: 'development' | 'staging' | 'production';

	// Durable Objects
	// MY_DURABLE_OBJECT?: DurableObjectNamespace;

	// Vectorize Indexes
	// MY_VECTORIZE?: VectorizeIndex;
}

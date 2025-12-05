/**
 * Vitest Configuration for Conductor Project
 *
 * Standard Vitest configuration for testing Conductor ensembles and agents.
 * Tests run in Node.js environment for maximum compatibility.
 *
 * Note: If you need to test Cloudflare Workers-specific bindings (AI, KV, D1, etc.),
 * you can switch to @cloudflare/vitest-pool-workers by using defineWorkersConfig instead.
 */

import { defineConfig } from 'vitest/config';
import yaml from '@rollup/plugin-yaml';

export default defineConfig({
	plugins: [yaml()],
	test: {
		globals: true,
		environment: 'node',
		include: ['tests/**/*.test.ts'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html', 'lcov'],
			include: [
				'agents/**/*.ts',
				'src/**/*.ts'
			],
			exclude: [
				'tests/**',
				'**/*.test.ts',
				'**/*.spec.ts',
				'node_modules/**',
				'dist/**'
			],
			thresholds: {
				lines: 70,
				functions: 70,
				branches: 65,
				statements: 70
			}
		}
	}
});

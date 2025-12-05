/**
 * Smoke Test
 *
 * Validates that Conductor is installed correctly.
 * This test runs for all projects regardless of examples.
 */

import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import { resolve } from 'path';

describe('Conductor Installation', () => {
	it('should have Conductor package in node_modules', () => {
		const conductorPath = resolve(process.cwd(), 'node_modules/@ensemble-edge/conductor');
		expect(existsSync(conductorPath)).toBe(true);
	});

	it('should have package.json with correct dependencies', () => {
		const packageJsonPath = resolve(process.cwd(), 'package.json');
		expect(existsSync(packageJsonPath)).toBe(true);

		const packageJson = JSON.parse(
			require('fs').readFileSync(packageJsonPath, 'utf-8')
		);

		expect(packageJson.dependencies).toBeDefined();
		expect(packageJson.dependencies['@ensemble-edge/conductor']).toBeDefined();
	});

	it('should have wrangler.toml configuration', () => {
		const wranglerPath = resolve(process.cwd(), 'wrangler.toml');
		expect(existsSync(wranglerPath)).toBe(true);
	});

	it('should have agents directory structure', () => {
		const membersPath = resolve(process.cwd(), 'agents');
		expect(existsSync(membersPath)).toBe(true);
	});

	it('should have ensembles directory structure', () => {
		const ensemblesPath = resolve(process.cwd(), 'ensembles');
		expect(existsSync(ensemblesPath)).toBe(true);
	});
});

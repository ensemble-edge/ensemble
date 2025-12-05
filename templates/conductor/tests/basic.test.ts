/**
 * Basic Integration Test
 *
 * Tests the hello-world ensemble to verify basic functionality works.
 * This test should always pass without any configuration.
 */

import { describe, it, expect } from 'vitest';
import { Executor, MemberLoader } from '@ensemble-edge/conductor';
import type { AgentConfig } from '@ensemble-edge/conductor';
import { stringify as stringifyYAML } from 'yaml';
import helloWorldYAML from '../ensembles/hello-world.yaml';
import greetConfig from '../agents/examples/hello/agent.yaml';
import greetFunction from '../agents/examples/hello';

describe('Basic Hello World Test', () => {
	it('should execute hello-world ensemble successfully', async () => {
		const env = {} as Env;
		const ctx = {
			waitUntil: (promise: Promise<any>) => promise,
			passThroughOnException: () => {}
		} as ExecutionContext;

		const executor = new Executor({ env, ctx });
		const loader = new MemberLoader({ env, ctx });

		// Register the hello agent
		const greetMember = loader.registerAgent(greetConfig as AgentConfig, greetFunction);
		executor.registerAgent(greetMember);

		// Execute the ensemble
		// Note: @rollup/plugin-yaml imports YAML as objects, so we stringify it back
		const result = await executor.executeFromYAML(stringifyYAML(helloWorldYAML), {
			name: 'World'
		});

		// Verify result
		if (!result.success) {
			console.error('Execution failed:', result.error);
			throw new Error(`Execution failed: ${JSON.stringify(result.error)}`);
		}
		expect(result.success).toBe(true);

		// Check that the greeting was generated
		expect(result.value.output).toBeDefined();
		const output = result.value.output as any;
		expect(output.greeting).toContain('Hello');

		// Check that the hello agent executed successfully
		expect(result.value.metrics.agents).toHaveLength(1);
		expect(result.value.metrics.agents[0].name).toBe('hello');
		expect(result.value.metrics.agents[0].success).toBe(true);
	});

	it('should handle different input names', async () => {
		const env = {} as Env;
		const ctx = {
			waitUntil: (promise: Promise<any>) => promise,
			passThroughOnException: () => {}
		} as ExecutionContext;

		const executor = new Executor({ env, ctx });
		const loader = new MemberLoader({ env, ctx });

		const greetMember = loader.registerAgent(greetConfig as AgentConfig, greetFunction);
		executor.registerAgent(greetMember);

		const result = await executor.executeFromYAML(stringifyYAML(helloWorldYAML), {
			name: 'Alice',
			style: 'friendly'
		});

		expect(result.success).toBe(true);
		if (!result.success) return;

		expect((result.value.output as any).greeting).toContain('Hello');
		expect(result.value.metrics.agents[0].name).toBe('hello');
	});

	it('should complete within reasonable time', async () => {
		const env = {} as Env;
		const ctx = {
			waitUntil: (promise: Promise<any>) => promise,
			passThroughOnException: () => {}
		} as ExecutionContext;

		const executor = new Executor({ env, ctx });
		const loader = new MemberLoader({ env, ctx });

		const greetMember = loader.registerAgent(greetConfig as AgentConfig, greetFunction);
		executor.registerAgent(greetMember);

		const startTime = Date.now();
		const result = await executor.executeFromYAML(stringifyYAML(helloWorldYAML), {
			name: 'Test'
		});
		const duration = Date.now() - startTime;

		expect(result.success).toBe(true);
		expect(duration).toBeLessThan(1000); // Should complete in less than 1 second
	});
});

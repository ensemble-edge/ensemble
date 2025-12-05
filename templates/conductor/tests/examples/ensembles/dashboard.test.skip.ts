/**
 * Dashboard Ensemble Integration Test
 *
 * Tests the dashboard HTML rendering ensemble.
 */

import { describe, it, expect } from 'vitest';
import { Executor } from '@ensemble-edge/conductor';
import dashboardYAML from '../../ensembles/dashboard.yaml';

describe('Dashboard Ensemble', () => {
	it('should render dashboard with metrics', async () => {
		const env = {} as Env;
		const ctx = {} as ExecutionContext;

		const executor = new Executor({ env, ctx });

		const input = {
			companyName: 'Acme Corp',
			userName: 'John Doe',
			metrics: [
				{
					label: 'Active Users',
					value: '1,234',
					change: '+12% from last week',
					changeClass: 'positive'
				},
				{
					label: 'Revenue',
					value: '$45,678',
					change: '+8% from last month',
					changeClass: 'positive'
				},
				{
					label: 'Conversion Rate',
					value: '3.2%',
					change: '-0.3% from last week',
					changeClass: 'negative'
				}
			]
		};

		const result = await executor.executeFromYAML(dashboardYAML, input);

		expect(result.success).toBe(true);
		if (!result.success) {
			console.error('Execution failed:', result.error);
			return;
		}

		const output = result.data.output as { html: string };
		expect(output.html).toBeDefined();
		expect(output.html).toContain('Acme Corp');
		expect(output.html).toContain('John Doe');
		expect(output.html).toContain('Active Users');
		expect(output.html).toContain('1,234');
		expect(output.html).toContain('Revenue');
		expect(output.html).toContain('$45,678');
		expect(output.html).toContain('Conversion Rate');
		expect(output.html).toContain('3.2%');
	});

	it('should include static asset references', async () => {
		const env = {} as Env;
		const ctx = {} as ExecutionContext;

		const executor = new Executor({ env, ctx });

		const input = {
			companyName: 'Test Co',
			userName: 'Jane',
			metrics: []
		};

		const result = await executor.executeFromYAML(dashboardYAML, input);

		expect(result.success).toBe(true);
		if (!result.success) return;

		const output = result.data.output as { html: string };
		expect(output.html).toContain('/assets/styles/reset.css');
		expect(output.html).toContain('/assets/styles/utilities.css');
	});

	it('should include inline dashboard styles', async () => {
		const env = {} as Env;
		const ctx = {} as ExecutionContext;

		const executor = new Executor({ env, ctx });

		const input = {
			companyName: 'Test Co',
			userName: 'Jane',
			metrics: []
		};

		const result = await executor.executeFromYAML(dashboardYAML, input);

		expect(result.success).toBe(true);
		if (!result.success) return;

		const output = result.data.output as { html: string };
		// Dashboard-specific styles should be inline
		expect(output.html).toContain('.dashboard');
		expect(output.html).toContain('.metric-card');
		expect(output.html).toContain('grid-template-columns');
	});

	it('should include auto-refresh script', async () => {
		const env = {} as Env;
		const ctx = {} as ExecutionContext;

		const executor = new Executor({ env, ctx });

		const input = {
			companyName: 'Test Co',
			userName: 'Jane',
			metrics: []
		};

		const result = await executor.executeFromYAML(dashboardYAML, input);

		expect(result.success).toBe(true);
		if (!result.success) return;

		const output = result.data.output as { html: string };
		// Dashboard JavaScript should be inline
		expect(output.html).toContain('refreshMetrics');
		expect(output.html).toContain('setInterval');
		expect(output.html).toContain('/api/metrics');
	});
});

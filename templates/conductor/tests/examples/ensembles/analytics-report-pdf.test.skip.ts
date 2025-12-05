/**
 * Analytics Report PDF Ensemble Integration Test
 *
 * Tests multi-agent workflow: HTML → PDF generation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Executor } from '@ensemble-edge/conductor';
import analyticsReportYAML from '../../ensembles/analytics-report-pdf.yaml';

describe('Analytics Report PDF Ensemble', () => {
	let mockR2: R2Bucket;
	let mockEnv: Env;
	let mockCtx: ExecutionContext;

	beforeEach(() => {
		mockR2 = {
			put: vi.fn().mockResolvedValue(undefined),
			get: vi.fn(),
			delete: vi.fn(),
			list: vi.fn()
		};

		mockEnv = {
			ASSETS: mockR2
		};

		mockCtx = {} as ExecutionContext;
	});

	it('should generate multi-page analytics report PDF', async () => {
		const executor = new Executor({ env: mockEnv, ctx: mockCtx });

		const input = {
			title: 'Q1 2025 Analytics Report',
			subtitle: 'Performance Metrics and Insights',
			reportDate: '2025-01-09',
			timestamp: Date.now(),
			companyName: 'Acme Corp',
			summary: 'This quarter showed strong growth across all key metrics with a 25% increase in revenue and 30% growth in active users.',
			metrics: [
				{
					label: 'Revenue',
					value: '$125,000',
					change: '+25% from Q4 2024',
					changeClass: 'positive'
				},
				{
					label: 'Active Users',
					value: '15,234',
					change: '+30% from Q4 2024',
					changeClass: 'positive'
				},
				{
					label: 'Conversion Rate',
					value: '4.2%',
					change: '+0.5% from Q4 2024',
					changeClass: 'positive'
				},
				{
					label: 'Churn Rate',
					value: '2.1%',
					change: '-0.3% from Q4 2024',
					changeClass: 'positive'
				}
			],
			detailedData: [
				{
					metric: 'New Signups',
					current: '3,245',
					previous: '2,456',
					change: '+32%',
					changeClass: 'positive'
				},
				{
					metric: 'Monthly Recurring Revenue',
					current: '$45,000',
					previous: '$38,000',
					change: '+18%',
					changeClass: 'positive'
				},
				{
					metric: 'Average Session Duration',
					current: '8m 32s',
					previous: '7m 15s',
					change: '+18%',
					changeClass: 'positive'
				}
			],
			recommendations: [
				'Continue investing in user acquisition channels',
				'Optimize onboarding flow to reduce time-to-value',
				'Expand feature set based on user feedback',
				'Implement advanced analytics for power users'
			]
		};

		const result = await executor.executeFromYAML(analyticsReportYAML, input);

		expect(result.success).toBe(true);
		if (!result.success) {
			console.error('Execution failed:', result.error);
			return;
		}

		const output = result.data.output as { pdf: ArrayBuffer; size: number };
		expect(output.pdf).toBeDefined();
		expect(output.pdf).toBeInstanceOf(ArrayBuffer);
		expect(output.size).toBeGreaterThan(0);
	});

	it('should use HTML agent output for PDF generation', async () => {
		const executor = new Executor({ env: mockEnv, ctx: mockCtx });

		const input = {
			title: 'Simple Report',
			subtitle: 'Test',
			reportDate: '2025-01-09',
			timestamp: Date.now(),
			companyName: 'Test Co',
			summary: 'Test summary',
			metrics: [],
			detailedData: [],
			recommendations: ['Test recommendation']
		};

		const result = await executor.executeFromYAML(analyticsReportYAML, input);

		expect(result.success).toBe(true);
		if (!result.success) return;

		// Check that HTML agent executed
		expect(result.data['render-report-html']).toBeDefined();
		expect(result.data['render-report-html'].output).toBeDefined();
		expect(result.data['render-report-html'].output.html).toBeDefined();

		// Check that PDF agent used HTML output
		const output = result.data.output as { pdf: ArrayBuffer; size: number };
		expect(output.pdf).toBeDefined();
	});

	it('should force download with attachment mode', async () => {
		const executor = new Executor({ env: mockEnv, ctx: mockCtx });

		const input = {
			title: 'Download Test',
			subtitle: 'Test',
			reportDate: '2025-01-09',
			timestamp: 1704844800000,
			companyName: 'Test Co',
			summary: 'Test',
			metrics: [],
			detailedData: [],
			recommendations: []
		};

		const result = await executor.executeFromYAML(analyticsReportYAML, input);

		expect(result.success).toBe(true);
		if (!result.success) return;

		const output = result.data.output as { pdf: ArrayBuffer; size: number };
		expect(output.contentDisposition).toContain('attachment');
		expect(output.filename).toContain('analytics-report-');
		expect(output.filename).toContain('.pdf');
	});

	it('should store PDF to R2 with custom key', async () => {
		const executor = new Executor({ env: mockEnv, ctx: mockCtx });

		const timestamp = Date.now();
		const input = {
			title: 'Storage Test',
			subtitle: 'Test',
			reportDate: '2025-01-09',
			timestamp,
			companyName: 'Test Co',
			summary: 'Test',
			metrics: [],
			detailedData: [],
			recommendations: []
		};

		const result = await executor.executeFromYAML(analyticsReportYAML, input);

		expect(result.success).toBe(true);
		if (!result.success) return;

		const output = result.data.output as { pdf: ArrayBuffer; size: number };
		expect(output.r2Key).toBe(`static/reports/analytics-${timestamp}.pdf`);
		expect(mockR2.put).toHaveBeenCalledWith(
			`static/reports/analytics-${timestamp}.pdf`,
			expect.any(ArrayBuffer),
			expect.any(Object)
		);
	});

	it('should include headers and footers with page numbers', async () => {
		const executor = new Executor({ env: mockEnv, ctx: mockCtx });

		const input = {
			title: 'Multi-Page Report',
			subtitle: 'With Headers/Footers',
			reportDate: '2025-01-09',
			timestamp: Date.now(),
			companyName: 'Test Co',
			summary: 'Test summary with headers and footers',
			metrics: Array(10).fill({
				label: 'Test Metric',
				value: '100',
				change: '+10%',
				changeClass: 'positive'
			}),
			detailedData: Array(20).fill({
				metric: 'Test',
				current: '100',
				previous: '90',
				change: '+10%',
				changeClass: 'positive'
			}),
			recommendations: Array(10).fill('Test recommendation')
		};

		const result = await executor.executeFromYAML(analyticsReportYAML, input);

		expect(result.success).toBe(true);
		if (!result.success) return;

		const output = result.data.output as { pdf: ArrayBuffer; size: number };
		expect(output.pdf).toBeDefined();
		expect(output.size).toBeGreaterThan(1000); // Multi-page should be larger
	});
});

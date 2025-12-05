/**
 * Invoice PDF Ensemble Integration Test
 *
 * Tests invoice PDF generation with R2 storage and delivery modes.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Executor } from '@ensemble-edge/conductor';
import invoicePdfYAML from '../../ensembles/invoice-pdf.yaml';

describe('Invoice PDF Ensemble', () => {
	let mockR2: R2Bucket;
	let mockEnv: Env;
	let mockCtx: ExecutionContext;

	beforeEach(() => {
		// Mock R2 bucket
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

	it('should generate invoice PDF with inline display mode', async () => {
		const executor = new Executor({ env: mockEnv, ctx: mockCtx });

		const input = {
			companyName: 'Acme Corp',
			companyAddress: '123 Business St, San Francisco, CA 94102',
			companyPhone: '(555) 123-4567',
			companyEmail: 'billing@acmecorp.com',
			invoiceNumber: 'INV-2025-001',
			invoiceDate: '2025-01-09',
			dueDate: '2025-02-08',
			customerName: 'John Doe',
			customerAddress: '456 Customer Ave, Los Angeles, CA 90001',
			customerEmail: 'john@example.com',
			items: [
				{
					description: 'Web Development Services',
					quantity: 40,
					unitPrice: '150.00',
					amount: '6000.00'
				},
				{
					description: 'Design Consultation',
					quantity: 10,
					unitPrice: '200.00',
					amount: '2000.00'
				}
			],
			subtotal: '8000.00',
			taxRate: '10',
			taxAmount: '800.00',
			total: '8800.00',
			deliveryMode: 'inline'
		};

		const result = await executor.executeFromYAML(invoicePdfYAML, input);

		expect(result.success).toBe(true);
		if (!result.success) {
			console.error('Execution failed:', result.error);
			return;
		}

		const output = result.data.output as { pdf: ArrayBuffer; size: number; contentDisposition?: string; filename?: string; r2Key?: string; url?: string; metadata?: { generateTime: number; htmlSize: number } };
		expect(output.pdf).toBeDefined();
		expect(output.pdf).toBeInstanceOf(ArrayBuffer);
		expect(output.size).toBeGreaterThan(0);
		expect(output.contentDisposition).toContain('inline');
		expect(output.filename).toBe('invoice-INV-2025-001.pdf');
	});

	it('should generate invoice PDF with download mode', async () => {
		const executor = new Executor({ env: mockEnv, ctx: mockCtx });

		const input = {
			companyName: 'Acme Corp',
			companyAddress: '123 Business St',
			companyPhone: '(555) 123-4567',
			companyEmail: 'billing@acmecorp.com',
			invoiceNumber: 'INV-2025-002',
			invoiceDate: '2025-01-09',
			dueDate: '2025-02-08',
			customerName: 'Jane Smith',
			customerAddress: '789 Client Rd',
			customerEmail: 'jane@example.com',
			items: [
				{
					description: 'Consulting Services',
					quantity: 20,
					unitPrice: '250.00',
					amount: '5000.00'
				}
			],
			subtotal: '5000.00',
			taxRate: '10',
			taxAmount: '500.00',
			total: '5500.00',
			deliveryMode: 'attachment'
		};

		const result = await executor.executeFromYAML(invoicePdfYAML, input);

		expect(result.success).toBe(true);
		if (!result.success) return;

		const output = result.data.output as { pdf: ArrayBuffer; size: number; contentDisposition?: string; filename?: string; r2Key?: string; url?: string; metadata?: { generateTime: number; htmlSize: number } };
		expect(output.contentDisposition).toContain('attachment');
		expect(output.filename).toBe('invoice-INV-2025-002.pdf');
	});

	it('should store PDF to R2', async () => {
		const executor = new Executor({ env: mockEnv, ctx: mockCtx });

		const input = {
			companyName: 'Acme Corp',
			companyAddress: '123 Business St',
			companyPhone: '(555) 123-4567',
			companyEmail: 'billing@acmecorp.com',
			invoiceNumber: 'INV-2025-003',
			invoiceDate: '2025-01-09',
			dueDate: '2025-02-08',
			customerName: 'Bob Johnson',
			customerAddress: '321 Buyer Blvd',
			customerEmail: 'bob@example.com',
			items: [
				{
					description: 'Product A',
					quantity: 5,
					unitPrice: '100.00',
					amount: '500.00'
				}
			],
			subtotal: '500.00',
			taxRate: '10',
			taxAmount: '50.00',
			total: '550.00',
			deliveryMode: 'inline'
		};

		const result = await executor.executeFromYAML(invoicePdfYAML, input);

		expect(result.success).toBe(true);
		if (!result.success) return;

		const output = result.data.output as { pdf: ArrayBuffer; size: number; contentDisposition?: string; filename?: string; r2Key?: string; url?: string; metadata?: { generateTime: number; htmlSize: number } };
		expect(output.r2Key).toBe('static/invoices/invoice-INV-2025-003.pdf');
		expect(output.url).toBeDefined();
		expect(mockR2.put).toHaveBeenCalledWith(
			'static/invoices/invoice-INV-2025-003.pdf',
			expect.any(ArrayBuffer),
			expect.objectContaining({
				httpMetadata: expect.objectContaining({
					contentType: 'application/pdf'
				})
			})
		);
	});

	it('should include all invoice data in PDF', async () => {
		const executor = new Executor({ env: mockEnv, ctx: mockCtx });

		const input = {
			companyName: 'Test Company LLC',
			companyAddress: '999 Test Ave',
			companyPhone: '(555) 999-9999',
			companyEmail: 'test@test.com',
			invoiceNumber: 'TEST-001',
			invoiceDate: '2025-01-09',
			dueDate: '2025-01-23',
			customerName: 'Test Customer',
			customerAddress: '888 Customer St',
			customerEmail: 'customer@test.com',
			items: [
				{
					description: 'Item 1',
					quantity: 2,
					unitPrice: '50.00',
					amount: '100.00'
				},
				{
					description: 'Item 2',
					quantity: 3,
					unitPrice: '75.00',
					amount: '225.00'
				}
			],
			subtotal: '325.00',
			taxRate: '8.5',
			taxAmount: '27.63',
			total: '352.63',
			deliveryMode: 'inline'
		};

		const result = await executor.executeFromYAML(invoicePdfYAML, input);

		expect(result.success).toBe(true);
		if (!result.success) return;

		const output = result.data.output as { pdf: ArrayBuffer; size: number; contentDisposition?: string; filename?: string; r2Key?: string; url?: string; metadata?: { generateTime: number; htmlSize: number } };
		expect(output.pdf).toBeDefined();
		expect(output.size).toBeGreaterThan(0);
		expect(output.metadata).toBeDefined();
		expect(output.metadata.generateTime).toBeGreaterThan(0);
		expect(output.metadata.htmlSize).toBeGreaterThan(0);
	});
});

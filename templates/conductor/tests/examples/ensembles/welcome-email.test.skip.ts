/**
 * Welcome Email Ensemble Test
 *
 * Tests the email agent with template rendering.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestConductor, registerMatchers } from '@ensemble-edge/conductor/testing';

// Register custom matchers
registerMatchers();

describe('Welcome Email Ensemble', () => {
	let conductor: TestConductor;

	beforeEach(async () => {
		conductor = await TestConductor.create({
			projectPath: '.'
		});

		// Mock email provider
		conductor.mockEmail('send-welcome', {
			messageId: 'test-msg-123',
			status: 'sent',
			provider: 'cloudflare',
			timestamp: new Date().toISOString()
		});
	});

	afterEach(async () => {
		await conductor.cleanup();
	});

	it('should send welcome email successfully', async () => {
		const result = await conductor.executeEnsemble('welcome-email', {
			email: 'user@example.com',
			name: 'Alice',
			appName: 'TestApp',
			activationUrl: 'https://example.com/activate/123'
		});

		expect(result).toBeSuccessful();
		expect(result).toHaveExecutedMember('send-welcome');
		expect(result.output).toHaveProperty('messageId');
		expect(result.output.status).toBe('sent');
	});

	it('should render template with user data', async () => {
		const result = await conductor.executeEnsemble('welcome-email', {
			email: 'bob@example.com',
			name: 'Bob',
			appName: 'My Application',
			activationUrl: 'https://example.com/activate/456'
		});

		expect(result).toBeSuccessful();

		// Check that email agent was called with correct input
		const emailCalls = conductor.getEmailCalls();
		expect(emailCalls.length).toBe(1);
		expect(emailCalls[0].input.to).toBe('bob@example.com');
		expect(emailCalls[0].input.data).toMatchObject({
			name: 'Bob',
			appName: 'My Application',
			activationUrl: 'https://example.com/activate/456'
		});
	});

	it('should handle email delivery failures', async () => {
		conductor.mockEmail('send-welcome', {
			messageId: '',
			status: 'failed',
			provider: 'cloudflare',
			timestamp: new Date().toISOString()
		});

		const result = await conductor.executeEnsemble('welcome-email', {
			email: 'invalid@example.com',
			name: 'Invalid',
			appName: 'TestApp',
			activationUrl: 'https://example.com/activate/789'
		});

		expect(result).toHaveFailed();
	});

	it('should use template from KV storage', async () => {
		const result = await conductor.executeEnsemble('welcome-email', {
			email: 'user@example.com',
			name: 'Test User',
			appName: 'TestApp',
			activationUrl: 'https://example.com/activate/test'
		});

		expect(result).toBeSuccessful();

		// Verify template path was used
		const emailCalls = conductor.getEmailCalls();
		expect(emailCalls[0].input.template).toContain('kv://templates/email/welcome');
	});

	it('should include metadata in output', async () => {
		const result = await conductor.executeEnsemble('welcome-email', {
			email: 'user@example.com',
			name: 'Alice',
			appName: 'TestApp',
			activationUrl: 'https://example.com/activate/123'
		});

		expect(result).toBeSuccessful();
		expect(result.output).toHaveProperty('messageId');
		expect(result.output).toHaveProperty('status');
		expect(result.output).toHaveProperty('timestamp');
	});

	it('should complete within reasonable time', async () => {
		const result = await conductor.executeEnsemble('welcome-email', {
			email: 'user@example.com',
			name: 'Alice',
			appName: 'TestApp',
			activationUrl: 'https://example.com/activate/123'
		});

		expect(result).toBeSuccessful();
		expect(result).toHaveCompletedIn(2000); // 2 seconds
	});
});

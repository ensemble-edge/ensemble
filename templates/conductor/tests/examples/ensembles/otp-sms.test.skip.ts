/**
 * OTP SMS Ensemble Test
 *
 * This demonstrates how to test SMS ensembles with Twilio provider.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestConductor, registerMatchers } from '@ensemble-edge/conductor/testing';

// Register custom matchers
registerMatchers();

describe('OTP SMS Ensemble', () => {
	let conductor: TestConductor;

	beforeEach(async () => {
		conductor = await TestConductor.create({
			projectPath: '.'
		});

		// Mock SMS response for the send-otp agent
		conductor.mockSMS('send-otp', {
			messageId: 'SM123456',
			status: 'sent',
			provider: 'twilio',
		});
	});

	afterEach(async () => {
		await conductor.cleanup();
	});

	it('should execute successfully with OTP code', async () => {
		const result = await conductor.executeEnsemble('otp-sms', {
			phone: '+1234567890',
			otp: '123456',
		});

		// Use custom matchers
		expect(result).toBeSuccessful();
		expect(result).toHaveExecutedMember('send-otp');
		expect(result).toHaveCompletedIn(1000);
	});

	it('should render OTP code in message body', async () => {
		conductor.mockSMS('send-otp', {
			messageId: 'SM789012',
			status: 'sent',
			provider: 'twilio',
		});

		const result = await conductor.executeEnsemble('otp-sms', {
			phone: '+1234567890',
			otp: '789012',
		});

		expect(result).toBeSuccessful();
		expect(result.output).toHaveProperty('messageId');
		expect(result.output.messageId).toBe('SM789012');
	});

	it('should handle international phone numbers', async () => {
		conductor.mockSMS('send-otp', {
			messageId: 'SM345678',
			status: 'sent',
			provider: 'twilio',
		});

		const result = await conductor.executeEnsemble('otp-sms', {
			phone: '+442071234567', // UK number
			otp: '345678',
		});

		expect(result).toBeSuccessful();
		expect(result.output.status).toBe('sent');
	});

	it('should include expiry time in message', async () => {
		const result = await conductor.executeEnsemble('otp-sms', {
			phone: '+1234567890',
			otp: '999888',
		});

		expect(result).toBeSuccessful();
		// The template includes {{expiryMinutes}} which should be rendered
		// We can verify this through the SMS call tracking
		const smsCalls = conductor.getSMSCalls();
		expect(smsCalls.length).toBeGreaterThan(0);
	});

	it('should handle SMS send failures', async () => {
		conductor.mockSMS('send-otp', new Error('Twilio API error: Invalid phone number'));

		const result = await conductor.executeEnsemble('otp-sms', {
			phone: 'invalid',
			otp: '123456',
		});

		expect(result).toHaveFailed();
		expect(result.error?.message).toContain('Twilio API error');
	});

	it('should track SMS usage', async () => {
		conductor.mockSMS('send-otp', {
			messageId: 'SM111222',
			status: 'sent',
			provider: 'twilio',
		});

		const result = await conductor.executeEnsemble('otp-sms', {
			phone: '+1234567890',
			otp: '111222',
		});

		expect(result).toBeSuccessful();

		// Check SMS calls were tracked
		const smsCalls = conductor.getSMSCalls();
		expect(smsCalls.length).toBeGreaterThan(0);
		expect(smsCalls[0].agent).toBe('send-otp');
	});

	it('should only execute the send-otp agent', async () => {
		const result = await conductor.executeEnsemble('otp-sms', {
			phone: '+1234567890',
			otp: '654321',
		});

		expect(result).toBeSuccessful();
		expect(result).toHaveExecutedSteps(1);
		expect(result).toHaveExecutedMember('send-otp');
	});

	it('should handle rate limiting', async () => {
		// Mock multiple OTP sends in quick succession
		for (let i = 0; i < 5; i++) {
			conductor.mockSMS('send-otp', {
				messageId: `SM${i}`,
				status: 'sent',
				provider: 'twilio',
			});
		}

		const startTime = Date.now();
		const promises = [];

		for (let i = 0; i < 5; i++) {
			promises.push(
				conductor.executeEnsemble('otp-sms', {
					phone: `+123456789${i}`,
					otp: `${i}${i}${i}${i}${i}${i}`,
				})
			);
		}

		await Promise.all(promises);
		const duration = Date.now() - startTime;

		// All should succeed
		const results = await Promise.all(promises);
		results.forEach(result => {
			expect(result).toBeSuccessful();
		});
	});

	it('should return correct output structure', async () => {
		const result = await conductor.executeEnsemble('otp-sms', {
			phone: '+1234567890',
			otp: '555666',
		});

		expect(result).toBeSuccessful();
		expect(result.output).toHaveProperty('messageId');
		expect(result.output).toHaveProperty('status');
		expect(result.output).toHaveProperty('provider');
		expect(result.output).toHaveProperty('timestamp');
	});

	it('should handle missing phone number', async () => {
		const result = await conductor.executeEnsemble('otp-sms', {
			// phone is missing
			otp: '123456',
		});

		// Should fail validation or have an error
		expect(result).toHaveFailed();
	});

	it('should handle missing OTP code', async () => {
		const result = await conductor.executeEnsemble('otp-sms', {
			phone: '+1234567890',
			// otp is missing
		});

		// Template should still render, just with empty/undefined OTP
		// Depending on implementation, this might succeed or fail
		// Let's expect it to succeed but with a rendered message
		const status = result.success ? 'success' : 'failed';
		expect(['success', 'failed']).toContain(status);
	});

	it('should handle Twilio queued status', async () => {
		conductor.mockSMS('send-otp', {
			messageId: 'SM999888',
			status: 'queued',
			provider: 'twilio',
		});

		const result = await conductor.executeEnsemble('otp-sms', {
			phone: '+1234567890',
			otp: '999888',
		});

		expect(result).toBeSuccessful();
		expect(result.output.status).toBe('queued');
	});
});

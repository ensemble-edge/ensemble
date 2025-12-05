/**
 * Login Page Ensemble Integration Test
 *
 * Tests login page rendering with cookie management.
 */

import { describe, it, expect } from 'vitest';
import { Executor } from '@ensemble-edge/conductor';
import loginPageYAML from '../../ensembles/login-page.yaml';

describe('Login Page Ensemble', () => {
	it('should render login page', async () => {
		const env = {
			COOKIE_SECRET: 'test-secret-12345'
		} as Env;
		const ctx = {} as ExecutionContext;

		const executor = new Executor({ env, ctx });

		const input = {
			appName: 'My App',
			message: null,
			messageType: null,
			email: ''
		};

		const result = await executor.executeFromYAML(loginPageYAML, input);

		expect(result.success).toBe(true);
		if (!result.success) {
			console.error('Execution failed:', result.error);
			return;
		}

		const output = result.data.output as { html: string; cookies?: string[]; readCookies?: Record<string, string> };
		expect(output.html).toBeDefined();
		expect(output.html).toContain('My App');
		expect(output.html).toContain('Sign in to your account');
		expect(output.html).toContain('type="email"');
		expect(output.html).toContain('type="password"');
	});

	it('should display error message', async () => {
		const env = {
			COOKIE_SECRET: 'test-secret-12345'
		} as Env;
		const ctx = {} as ExecutionContext;

		const executor = new Executor({ env, ctx });

		const input = {
			appName: 'My App',
			message: 'Invalid email or password',
			messageType: 'error',
			email: 'user@example.com'
		};

		const result = await executor.executeFromYAML(loginPageYAML, input);

		expect(result.success).toBe(true);
		if (!result.success) return;

		const output = result.data.output as { html: string; cookies?: string[]; readCookies?: Record<string, string> };
		expect(output.html).toContain('Invalid email or password');
		expect(output.html).toContain('message error');
		expect(output.html).toContain('value="user@example.com"');
	});

	it('should display success message', async () => {
		const env = {
			COOKIE_SECRET: 'test-secret-12345'
		} as Env;
		const ctx = {} as ExecutionContext;

		const executor = new Executor({ env, ctx });

		const input = {
			appName: 'My App',
			message: 'Login successful!',
			messageType: 'success',
			email: ''
		};

		const result = await executor.executeFromYAML(loginPageYAML, input);

		expect(result.success).toBe(true);
		if (!result.success) return;

		const output = result.data.output as { html: string; cookies?: string[]; readCookies?: Record<string, string> };
		expect(output.html).toContain('Login successful!');
		expect(output.html).toContain('message success');
	});

	it('should show already logged in state when session cookie exists', async () => {
		const env = {
			COOKIE_SECRET: 'test-secret-12345'
		} as Env;
		const ctx = {} as ExecutionContext;

		const executor = new Executor({ env, ctx });

		const input = {
			appName: 'My App',
			message: null,
			messageType: null,
			email: '',
			cookies: {
				session: 'abc123',
				username: 'johndoe'
			}
		};

		const result = await executor.executeFromYAML(loginPageYAML, input);

		expect(result.success).toBe(true);
		if (!result.success) return;

		const output = result.data.output as { html: string; cookies?: string[]; readCookies?: Record<string, string> };
		expect(output.html).toContain('already logged in');
		expect(output.html).toContain('johndoe');
		expect(output.readCookies).toEqual({
			session: 'abc123',
			username: 'johndoe'
		});
	});

	it('should set session cookie on login', async () => {
		const env = {
			COOKIE_SECRET: 'test-secret-12345'
		} as Env;
		const ctx = {} as ExecutionContext;

		const executor = new Executor({ env, ctx });

		const input = {
			appName: 'My App',
			message: 'Login successful!',
			messageType: 'success',
			email: 'user@example.com',
			setCookies: [
				{
					name: 'session',
					value: 'xyz789',
					options: {
						httpOnly: true,
						secure: true,
						maxAge: 604800 // 7 days
					}
				},
				{
					name: 'username',
					value: 'user@example.com'
				}
			]
		};

		const result = await executor.executeFromYAML(loginPageYAML, input);

		expect(result.success).toBe(true);
		if (!result.success) return;

		const output = result.data.output as { html: string; cookies?: string[]; readCookies?: Record<string, string> };
		expect(output.cookies).toBeDefined();
		expect(output.cookies.length).toBe(2);

		// Check session cookie
		const sessionCookie = output.cookies.find((c: string) => c.startsWith('session='));
		expect(sessionCookie).toBeDefined();
		expect(sessionCookie).toContain('HttpOnly');
		expect(sessionCookie).toContain('Secure');
		expect(sessionCookie).toContain('Max-Age=604800');
		expect(sessionCookie).toContain('SameSite=Lax');

		// Check username cookie
		const usernameCookie = output.cookies.find((c: string) => c.startsWith('username='));
		expect(usernameCookie).toBeDefined();
		expect(usernameCookie).toContain('user%40example.com'); // URL encoded
	});

	it('should delete session cookie on logout', async () => {
		const env = {
			COOKIE_SECRET: 'test-secret-12345'
		} as Env;
		const ctx = {} as ExecutionContext;

		const executor = new Executor({ env, ctx });

		const input = {
			appName: 'My App',
			message: 'You have been logged out',
			messageType: 'success',
			email: '',
			deleteCookies: ['session', 'username']
		};

		const result = await executor.executeFromYAML(loginPageYAML, input);

		expect(result.success).toBe(true);
		if (!result.success) return;

		const output = result.data.output as { html: string; cookies?: string[]; readCookies?: Record<string, string> };
		expect(output.cookies).toBeDefined();
		expect(output.cookies.length).toBe(2);

		// Both cookies should be expired
		expect(output.cookies[0]).toContain('Max-Age=0');
		expect(output.cookies[1]).toContain('Max-Age=0');
	});
});

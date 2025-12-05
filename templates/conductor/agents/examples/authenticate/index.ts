import type { AgentExecutionContext } from '@ensemble-edge/conductor';

interface AuthInput {
	email?: string;
	password?: string;
}

interface AuthResult {
	success: boolean;
	token?: string;
	redirectTo?: string;
	error?: string;
}

export default async function authenticate(context: AgentExecutionContext): Promise<AuthResult> {
	const { env } = context;
	const input = context.input as AuthInput;
	const { email, password } = input;

	if (!email || !password) {
		return { success: false, error: 'Email and password are required' };
	}

	// Demo: Simple check (in production, verify against database)
	if (email === 'demo@example.com' && password === 'demo123') {
		const token = 'demo-token-' + Date.now();
		if ((env as any).KV) {
			await (env as any).KV.put(
				`session:${token}`,
				JSON.stringify({
					email,
					userId: 'demo-user',
					createdAt: new Date().toISOString(),
				}),
				{ expirationTtl: 86400 }
			);
		}
		return { success: true, token, redirectTo: '/dashboard' };
	}

	return { success: false, error: 'Invalid email or password' };
}

/**
 * Authenticate Script
 *
 * Handles user login authentication with session management.
 */

import type { AgentExecutionContext } from '@ensemble-edge/conductor'

interface AuthInput {
  email?: string
  password?: string
}

interface AuthResult {
  success: boolean
  token?: string
  redirectTo?: string
  error?: string
}

export default async function authenticate(context: AgentExecutionContext): Promise<AuthResult> {
  const { env } = context
  const input = context.input as AuthInput
  const { email, password } = input

  // Validate input
  if (!email || !password) {
    return {
      success: false,
      error: 'Email and password are required',
    }
  }

  // In production, verify against database:
  // const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
  // const passwordValid = await verifyPassword(password, user.password_hash);

  // Demo: Simple check
  if (email === 'demo@example.com' && password === 'demo123') {
    // Generate session token
    const token = 'demo-token-' + Date.now()

    // Store session in KV
    if ((env as any).KV) {
      await (env as any).KV.put(
        `session:${token}`,
        JSON.stringify({
          email,
          userId: 'demo-user',
          createdAt: new Date().toISOString(),
        }),
        { expirationTtl: 86400 } // 24 hours
      )
    }

    return {
      success: true,
      token,
      redirectTo: '/dashboard',
    }
  }

  return {
    success: false,
    error: 'Invalid email or password',
  }
}

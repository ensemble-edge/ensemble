/**
 * Fetch User Script
 *
 * Retrieves user data from database or returns demo data.
 */

import type { AgentExecutionContext } from '@ensemble-edge/conductor'

interface FetchUserInput {
  userId?: string
}

interface UserData {
  id: string
  name: string
  email: string
  plan: string
}

export default async function fetchUser(context: AgentExecutionContext): Promise<UserData> {
  const { env } = context
  const input = context.input as FetchUserInput
  const userId = input.userId || 'demo-user'

  // In production, fetch from database:
  // const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();

  // Demo data
  return {
    id: userId,
    name: 'Demo User',
    email: 'demo@example.com',
    plan: 'Pro',
  }
}

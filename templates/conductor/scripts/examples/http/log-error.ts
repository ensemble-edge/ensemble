/**
 * Log Error Script
 *
 * Logs 500 errors to KV and D1 for investigation and analytics.
 */

import type { AgentExecutionContext } from '@ensemble-edge/conductor'

interface LogErrorInput {
  error?: string
  stack?: string
  requestPath?: string
  requestId?: string
}

interface LogErrorResult {
  errorId: string
}

export default async function logError(context: AgentExecutionContext): Promise<LogErrorResult> {
  const { env } = context
  const input = context.input as LogErrorInput
  const { error, stack, requestPath, requestId } = input

  // Generate unique error ID
  const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  // Store error in KV for investigation
  if ((env as any).KV) {
    await (env as any).KV.put(
      `error:${errorId}`,
      JSON.stringify({
        errorId,
        message: error,
        stack,
        requestPath,
        requestId,
        timestamp: new Date().toISOString(),
        env: (env as any).ENVIRONMENT || 'production',
      }),
      { expirationTtl: 86400 * 7 } // 7 days
    )
  }

  // Store in D1 for analytics if available
  if ((env as any).DB) {
    try {
      await (env as any).DB.prepare(
        'INSERT INTO error_logs (error_id, message, stack, path, timestamp) VALUES (?, ?, ?, ?, ?)'
      )
        .bind(errorId, error, stack, requestPath, new Date().toISOString())
        .run()
    } catch (dbError) {
      console.error('Failed to log to DB:', dbError)
    }
  }

  return { errorId }
}

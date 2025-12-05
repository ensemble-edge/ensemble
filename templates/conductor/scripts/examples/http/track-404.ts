/**
 * Track 404 Script
 *
 * Logs 404 errors to KV for analytics.
 */

import type { AgentExecutionContext } from '@ensemble-edge/conductor'

interface Track404Input {
  requestedPath: string
  referrer?: string
  userAgent?: string
}

interface Track404Result {
  tracked: boolean
}

export default async function track404(context: AgentExecutionContext): Promise<Track404Result> {
  const { env } = context
  const input = context.input as Track404Input
  const { requestedPath, referrer, userAgent } = input

  // Store in KV for analytics
  if ((env as any).KV) {
    const key = `404:${requestedPath}:${Date.now()}`
    await (env as any).KV.put(
      key,
      JSON.stringify({
        path: requestedPath,
        referrer,
        userAgent,
        timestamp: new Date().toISOString(),
      }),
      { expirationTtl: 86400 * 30 } // 30 days
    )
  }

  return { tracked: true }
}

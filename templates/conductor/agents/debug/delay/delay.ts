/**
 * Delay Agent
 *
 * Adds artificial delay before returning. Useful for testing
 * timeout handling, loading states, and concurrent behavior.
 */

import type { AgentExecutionContext } from '@ensemble-edge/conductor'

interface DelayInput {
  ms?: number
  passthrough?: unknown
}

interface DelayOutput {
  delayed: boolean
  actualDelayMs: number
  passthrough?: unknown
}

const MAX_DELAY_MS = 10000 // 10 seconds max

export default async function delay(
  input: DelayInput,
  ctx: AgentExecutionContext
): Promise<DelayOutput> {
  const requestedMs = input.ms ?? 1000
  const delayMs = Math.min(Math.max(0, requestedMs), MAX_DELAY_MS)

  const start = Date.now()

  // Use scheduler.wait() if available (Cloudflare Workers paid tier)
  // Falls back to setTimeout-style delay
  if (typeof scheduler !== 'undefined' && scheduler.wait) {
    await scheduler.wait(delayMs)
  } else {
    await new Promise((resolve) => setTimeout(resolve, delayMs))
  }

  const actualDelayMs = Date.now() - start

  return {
    delayed: true,
    actualDelayMs,
    passthrough: input.passthrough,
  }
}

/**
 * Process Middleware Request Script
 *
 * Demonstrates middleware functionality by returning request metadata
 * and information about applied middleware.
 */

import type { AgentExecutionContext } from '@ensemble-edge/conductor'

interface MiddlewareRequestResult {
  message: string
  method: string
  path: string
  timestamp: string
  middlewareApplied: string[]
}

export default function processMiddlewareRequest(context: AgentExecutionContext): MiddlewareRequestResult {
  const { metadata } = context as any

  return {
    message: 'Middleware demo successful!',
    method: metadata?.method || 'GET',
    path: metadata?.path || '/api/demo',
    timestamp: new Date().toISOString(),
    middlewareApplied: [
      'logger - request logged',
      'compress - response will be compressed',
      'timing - Server-Timing header added',
      'secure-headers - security headers added',
      'etag - ETag header added',
    ],
  }
}

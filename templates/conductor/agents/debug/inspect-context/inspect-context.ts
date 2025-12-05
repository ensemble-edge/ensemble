/**
 * Inspect Context Agent
 *
 * Returns detailed information about the current execution context.
 * Useful for debugging auth propagation, headers, and environment.
 *
 * ⚠️ WARNING: Security-sensitive - do not expose in production without auth.
 */

import type { AgentExecutionContext } from '@ensemble-edge/conductor'

interface InspectInput {
  includeEnv?: boolean
  includeAuth?: boolean
  includeHeaders?: boolean
  includeBindings?: boolean
}

interface InspectOutput {
  context: {
    timestamp: string
    executionId?: string
    requestId?: string
    auth?: Record<string, unknown>
    headers?: Record<string, string>
    bindings?: string[]
    env?: Record<string, string>
  }
}

// Headers that should be redacted for security
const REDACTED_HEADERS = [
  'authorization',
  'x-api-key',
  'cookie',
  'set-cookie',
  'x-auth-token',
]

// Env vars that might contain secrets
const SECRET_PATTERNS = [
  /secret/i,
  /key/i,
  /token/i,
  /password/i,
  /credential/i,
  /auth/i,
]

export default async function inspectContext(
  input: InspectInput,
  ctx: AgentExecutionContext
): Promise<InspectOutput> {
  const result: InspectOutput = {
    context: {
      timestamp: new Date().toISOString(),
    },
  }

  // Add execution IDs if available
  if (ctx.executionId) {
    result.context.executionId = ctx.executionId
  }
  if (ctx.requestId) {
    result.context.requestId = ctx.requestId
  }

  // Auth context
  if (input.includeAuth !== false && ctx.auth) {
    result.context.auth = {
      authenticated: !!ctx.auth.userId,
      userId: ctx.auth.userId,
      scopes: ctx.auth.scopes,
      provider: ctx.auth.provider,
    }
  }

  // Headers (with redaction)
  if (input.includeHeaders !== false && ctx.input?.headers) {
    const headers: Record<string, string> = {}
    const rawHeaders = ctx.input.headers as Record<string, string>

    for (const [key, value] of Object.entries(rawHeaders)) {
      const lowerKey = key.toLowerCase()
      if (REDACTED_HEADERS.some((h) => lowerKey.includes(h))) {
        headers[key] = '[REDACTED]'
      } else {
        headers[key] = value
      }
    }

    result.context.headers = headers
  }

  // Cloudflare bindings
  if (input.includeBindings && ctx.env) {
    const bindings: string[] = []
    for (const key of Object.keys(ctx.env)) {
      const value = ctx.env[key]
      if (value && typeof value === 'object') {
        // Detect binding types
        if ('get' in value && 'put' in value) bindings.push(`${key} (KV)`)
        else if ('prepare' in value) bindings.push(`${key} (D1)`)
        else if ('put' in value && 'head' in value) bindings.push(`${key} (R2)`)
        else if ('idFromName' in value) bindings.push(`${key} (DO)`)
        else bindings.push(`${key} (object)`)
      }
    }
    result.context.bindings = bindings
  }

  // Environment variables (keys only, values redacted for secrets)
  if (input.includeEnv && ctx.env) {
    const env: Record<string, string> = {}
    for (const [key, value] of Object.entries(ctx.env)) {
      if (typeof value === 'string') {
        const isSecret = SECRET_PATTERNS.some((p) => p.test(key))
        env[key] = isSecret ? '[REDACTED]' : `${value.substring(0, 20)}...`
      }
    }
    result.context.env = env
  }

  return result
}

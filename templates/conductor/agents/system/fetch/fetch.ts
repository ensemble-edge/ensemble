/**
 * Fetch Agent
 *
 * HTTP client with configurable retry logic and exponential backoff.
 */

import type { AgentExecutionContext } from '@ensemble-edge/conductor'

// ============================================================================
// Types
// ============================================================================

interface FetchInput {
  url: string
  body?: unknown
  headers?: Record<string, string>
}

interface FetchConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  headers: Record<string, string>
  retry: number
  timeout: number
  retryDelay: number
}

interface FetchOutput {
  success: boolean
  status: number
  statusText: string
  headers: Record<string, string>
  body: unknown
  duration: number
  attempt: number
}

// ============================================================================
// Agent Implementation
// ============================================================================

export default async function fetch_(
  input: FetchInput,
  ctx: AgentExecutionContext
): Promise<FetchOutput> {
  const config: FetchConfig = {
    method: 'GET',
    headers: {},
    retry: 3,
    timeout: 30000,
    retryDelay: 1000,
    ...(ctx.config as Partial<FetchConfig>),
  }

  if (!input.url) {
    throw new Error('Fetch agent requires "url" in input')
  }

  const startTime = Date.now()
  const maxRetries = config.retry

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await executeRequest(input, config, attempt)
      return {
        success: true,
        ...result,
        duration: Date.now() - startTime,
        attempt: attempt + 1,
      }
    } catch (error) {
      // If this is the last attempt, throw the error
      if (attempt === maxRetries) {
        throw new Error(
          `Fetch failed after ${attempt + 1} attempts: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        )
      }

      // Otherwise, wait and retry with exponential backoff
      const delay = config.retryDelay * Math.pow(2, attempt)
      await sleep(delay)
    }
  }

  throw new Error('Fetch failed: Maximum retries exceeded')
}

// ============================================================================
// Helpers
// ============================================================================

async function executeRequest(
  input: FetchInput,
  config: FetchConfig,
  attempt: number
): Promise<Omit<FetchOutput, 'success' | 'duration' | 'attempt'>> {
  const url = input.url
  const method = config.method
  const headers: Record<string, string> = {
    ...config.headers,
    ...input.headers,
  }

  // Build request options
  const options: RequestInit = {
    method,
    headers,
    signal: AbortSignal.timeout(config.timeout),
  }

  // Add body for POST/PUT/PATCH
  if (input.body && ['POST', 'PUT', 'PATCH'].includes(method)) {
    if (typeof input.body === 'object') {
      options.body = JSON.stringify(input.body)
      if (!headers['Content-Type']) {
        headers['Content-Type'] = 'application/json'
      }
    } else {
      options.body = input.body as string
    }
  }

  // Execute request
  const response = await fetch(url, options)

  // Parse response body
  const contentType = response.headers.get('content-type') || ''
  let body: unknown

  if (contentType.includes('application/json')) {
    body = await response.json()
  } else if (contentType.includes('text/')) {
    body = await response.text()
  } else {
    body = await response.text() // Default to text
  }

  // Check for HTTP errors
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }

  return {
    status: response.status,
    statusText: response.statusText,
    headers: Object.fromEntries(response.headers.entries()),
    body,
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Health Check Script
 *
 * Returns system health status for monitoring and load balancers.
 * Checks database and KV connectivity when available.
 */

import type { AgentExecutionContext } from '@ensemble-edge/conductor'

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  uptime: number
  version: string
  database?: 'connected' | 'disconnected'
  kv?: 'connected' | 'disconnected'
}

export default async function checkHealth(context: AgentExecutionContext): Promise<HealthStatus> {
  const { env } = context

  // Basic health check
  const health: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: Date.now(), // In production, track actual uptime
    version: (env as any).APP_VERSION || '1.0.0',
  }

  // Optional: Check database connectivity
  if ((env as any).DB) {
    try {
      await (env as any).DB.prepare('SELECT 1').first()
      health.database = 'connected'
    } catch {
      health.database = 'disconnected'
      health.status = 'degraded'
    }
  }

  // Optional: Check KV store
  if ((env as any).KV) {
    try {
      await (env as any).KV.get('health-check')
      health.kv = 'connected'
    } catch {
      health.kv = 'disconnected'
      health.status = 'degraded'
    }
  }

  return health
}

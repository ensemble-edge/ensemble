/**
 * Tools Agent
 *
 * Invoke external MCP (Model Context Protocol) tools over HTTP.
 */

import type { AgentExecutionContext } from '@ensemble-edge/conductor'
import { MCPClient } from './mcp-client.js'

// ============================================================================
// Types
// ============================================================================

interface ToolsConfig {
  mcp: string
  tool: string
  timeout?: number
  cacheDiscovery: boolean
  cacheTTL: number
}

interface MCPServerConfig {
  url: string
  auth?: {
    type: 'bearer' | 'oauth'
    token?: string
    accessToken?: string
  }
  timeout?: number
}

interface ToolsInput {
  [key: string]: unknown
}

interface ToolsOutput {
  tool: string
  server: string
  content: Array<{
    type: 'text' | 'image' | 'resource'
    text?: string
    data?: string
    mimeType?: string
  }>
  duration: number
  cached?: boolean
  isError?: boolean
}

// ============================================================================
// Agent Implementation
// ============================================================================

export default async function tools(
  input: ToolsInput,
  ctx: AgentExecutionContext
): Promise<ToolsOutput> {
  const config: ToolsConfig = {
    mcp: '',
    tool: '',
    cacheDiscovery: true,
    cacheTTL: 3600,
    ...(ctx.config as Partial<ToolsConfig>),
  }

  if (!config.mcp || !config.tool) {
    throw new Error('Tools agent requires "mcp" (server name) and "tool" (tool name) in config')
  }

  const startTime = Date.now()

  try {
    // Load MCP server configuration
    const serverConfig = await loadMCPServerConfig(config, ctx)

    // Create MCP client
    const client = new MCPClient(serverConfig)

    // Invoke tool
    const response = await client.invokeTool(config.tool, input)

    return {
      tool: config.tool,
      server: config.mcp,
      content: response.content,
      duration: Date.now() - startTime,
      isError: response.isError,
    }
  } catch (error) {
    throw new Error(
      `Failed to invoke tool "${config.tool}" on MCP server "${config.mcp}": ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    )
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Load MCP server configuration from env bindings
 */
async function loadMCPServerConfig(
  config: ToolsConfig,
  ctx: AgentExecutionContext
): Promise<MCPServerConfig> {
  // Check if MCP servers are configured in env bindings
  const mcpServers = ctx.env?.MCP_SERVERS as Record<string, MCPServerConfig> | undefined

  if (!mcpServers) {
    throw new Error(
      'MCP servers not configured. Add MCP_SERVERS binding or configure in conductor.config.ts'
    )
  }

  const serverConfig = mcpServers[config.mcp]
  if (!serverConfig) {
    throw new Error(
      `MCP server "${config.mcp}" not found in configuration. Available servers: ${Object.keys(mcpServers).join(', ')}`
    )
  }

  // Override timeout if specified in agent config
  if (config.timeout) {
    serverConfig.timeout = config.timeout
  }

  return serverConfig
}

/**
 * Discover available tools from MCP server (for AI agent tool access)
 */
export async function discoverTools(
  config: ToolsConfig,
  ctx: AgentExecutionContext
): Promise<unknown[]> {
  const serverConfig = await loadMCPServerConfig(config, ctx)
  const client = new MCPClient(serverConfig)

  // Check cache if enabled
  if (config.cacheDiscovery) {
    const cached = await getCachedTools(config.mcp, ctx)
    if (cached) {
      return cached
    }
  }

  // Fetch tools
  const response = await client.listTools()

  // Cache if enabled
  if (config.cacheDiscovery) {
    await cacheTools(config.mcp, response.tools, config.cacheTTL, ctx)
  }

  return response.tools
}

/**
 * Get cached tools from KV
 */
async function getCachedTools(
  serverName: string,
  ctx: AgentExecutionContext
): Promise<unknown[] | null> {
  try {
    const kv = ctx.env?.MCP_CACHE as KVNamespace | undefined
    if (!kv) return null

    const cacheKey = `mcp:tools:${serverName}`
    const cached = await kv.get(cacheKey, 'json')
    return cached as unknown[] | null
  } catch {
    // Cache miss or error, return null
    return null
  }
}

/**
 * Cache tools in KV
 */
async function cacheTools(
  serverName: string,
  tools: unknown[],
  cacheTTL: number,
  ctx: AgentExecutionContext
): Promise<void> {
  try {
    const kv = ctx.env?.MCP_CACHE as KVNamespace | undefined
    if (!kv) return

    const cacheKey = `mcp:tools:${serverName}`
    await kv.put(cacheKey, JSON.stringify(tools), {
      expirationTtl: cacheTTL,
    })
  } catch {
    // Ignore cache errors
  }
}

/**
 * MCP Client - HTTP Transport
 *
 * Client for communicating with MCP servers over HTTP.
 */

// ============================================================================
// Types
// ============================================================================

interface MCPServerConfig {
  url: string
  auth?: {
    type: 'bearer' | 'oauth'
    token?: string
    accessToken?: string
  }
  timeout?: number
}

interface MCPTool {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
}

interface MCPToolListResponse {
  tools: MCPTool[]
}

interface MCPToolInvocationRequest {
  name: string
  arguments: Record<string, unknown>
}

interface MCPToolInvocationResponse {
  content: Array<{
    type: 'text' | 'image' | 'resource'
    text?: string
    data?: string
    mimeType?: string
  }>
  isError?: boolean
}

// ============================================================================
// MCP Client
// ============================================================================

export class MCPClient {
  constructor(private readonly config: MCPServerConfig) {}

  /**
   * Discover available tools from MCP server
   */
  async listTools(): Promise<MCPToolListResponse> {
    const url = `${this.config.url}/tools`
    const response = await this.request<MCPToolListResponse>(url, {
      method: 'GET',
    })
    return response
  }

  /**
   * Invoke a tool on the MCP server
   */
  async invokeTool(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<MCPToolInvocationResponse> {
    const url = `${this.config.url}/tools/${encodeURIComponent(toolName)}`
    const body: MCPToolInvocationRequest = {
      name: toolName,
      arguments: args,
    }

    const response = await this.request<MCPToolInvocationResponse>(url, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
      },
    })

    return response
  }

  /**
   * Make an authenticated HTTP request to MCP server
   */
  private async request<T>(url: string, options: RequestInit): Promise<T> {
    // Add authentication headers
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    }

    if (this.config.auth) {
      if (this.config.auth.type === 'bearer' && this.config.auth.token) {
        headers['Authorization'] = `Bearer ${this.config.auth.token}`
      } else if (this.config.auth.type === 'oauth' && this.config.auth.accessToken) {
        headers['Authorization'] = `Bearer ${this.config.auth.accessToken}`
      }
    }

    // Set timeout
    const timeout = this.config.timeout || 30000
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error')
        throw new Error(
          `MCP server error: ${response.status} ${response.statusText} - ${errorText}`
        )
      }

      const data = await response.json()
      return data as T
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`MCP request timeout after ${timeout}ms`)
        }
        throw error
      }
      throw new Error('Unknown MCP client error')
    } finally {
      clearTimeout(timeoutId)
    }
  }
}

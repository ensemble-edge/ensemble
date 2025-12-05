import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { agentDiscoveryPlugin } from '../../src/build/vite-plugin-agent-discovery'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import type { Plugin } from 'vite'

// Helper to call plugin hooks that might be functions or objects with handler
function callHook<T extends (...args: any[]) => any>(
  hook: T | { handler: T } | undefined,
  ...args: Parameters<T>
): ReturnType<T> | undefined {
  if (!hook) return undefined
  if (typeof hook === 'function') return hook(...args)
  return (hook as { handler: T }).handler(...args)
}

describe('agentDiscoveryPlugin', () => {
  let tempDir: string

  beforeEach(() => {
    // Create temporary directory for testing
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-discovery-test-'))
  })

  afterEach(() => {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('should create plugin with correct name', () => {
    const plugin = agentDiscoveryPlugin()
    expect(plugin.name).toBe('conductor:agent-discovery')
  })

  it('should resolve virtual module ID', () => {
    const plugin = agentDiscoveryPlugin()
    const resolved = callHook(plugin.resolveId as any, 'virtual:conductor-agents')
    expect(resolved).toBe('\0virtual:conductor-agents')
  })

  it('should not resolve other module IDs', () => {
    const plugin = agentDiscoveryPlugin()
    const resolved = callHook(plugin.resolveId as any, 'some-other-module')
    expect(resolved).toBeUndefined()
  })

  it('should generate empty module when agents directory does not exist', () => {
    const plugin = agentDiscoveryPlugin({ agentsDir: 'nonexistent' })

    // Mock config
    const config = { root: tempDir }
    callHook(plugin.configResolved as any, config)

    const code = callHook(plugin.load as any, '\0virtual:conductor-agents')
    expect(code).toContain('export const agents = []')
    expect(code).toContain('export const agentsMap = new Map()')
  })

  it('should discover agents with YAML files', () => {
    // Create agents directory structure
    const agentsDir = path.join(tempDir, 'agents')
    const helloDir = path.join(agentsDir, 'hello')
    fs.mkdirSync(helloDir, { recursive: true })

    // Create agent YAML
    const yamlContent = `name: hello
operation: code
description: A hello agent`
    fs.writeFileSync(path.join(helloDir, 'agent.yaml'), yamlContent)

    // Create plugin and configure
    const plugin = agentDiscoveryPlugin()
    const config = { root: tempDir }
    callHook(plugin.configResolved as any, config)

    // Load virtual module
    const code = callHook(plugin.load as any, '\0virtual:conductor-agents') as string
    expect(code).toBeDefined()
    expect(code).toContain(`name: "hello"`)
    expect(code).toContain('config: atob(')
    // Verify the base64-encoded config can be decoded back
    expect(code).toContain('export const agents = [')
  })

  it('should discover agents with handlers', () => {
    // Create agents directory structure
    const agentsDir = path.join(tempDir, 'agents')
    const helloDir = path.join(agentsDir, 'hello')
    fs.mkdirSync(helloDir, { recursive: true })

    // Create agent YAML and handler
    fs.writeFileSync(
      path.join(helloDir, 'agent.yaml'),
      `name: hello
operation: code`
    )
    fs.writeFileSync(path.join(helloDir, 'index.ts'), `export default function() {}`)

    // Create plugin and configure
    const plugin = agentDiscoveryPlugin()
    const config = { root: tempDir }
    callHook(plugin.configResolved as any, config)

    // Load virtual module
    const code = callHook(plugin.load as any, '\0virtual:conductor-agents') as string
    expect(code).toContain(`import * as handler_hello from`)
    expect(code).toContain(`handler: () => Promise.resolve(handler_hello.default || handler_hello)`)
  })

  it('should include examples directory by default', () => {
    // Create agents directory with examples
    const agentsDir = path.join(tempDir, 'agents')
    const examplesDir = path.join(agentsDir, 'examples')
    const helloDir = path.join(agentsDir, 'hello')

    fs.mkdirSync(examplesDir, { recursive: true })
    fs.mkdirSync(helloDir, { recursive: true })

    fs.writeFileSync(path.join(examplesDir, 'agent.yaml'), 'name: example-agent\noperation: code')
    fs.writeFileSync(path.join(helloDir, 'agent.yaml'), 'name: hello\noperation: code')

    // Create plugin and configure (includeExamples defaults to true)
    const plugin = agentDiscoveryPlugin()
    const config = { root: tempDir }
    callHook(plugin.configResolved as any, config)

    // Load virtual module
    const code = callHook(plugin.load as any, '\0virtual:conductor-agents') as string
    // By default, examples ARE included (includeExamples: true is the default)
    expect(code).toContain('examples')
    expect(code).toContain('name: "hello"')
    expect(code).toContain('config: atob(')
  })

  it('should exclude examples directory when includeExamples is false', () => {
    // Create agents directory with examples
    const agentsDir = path.join(tempDir, 'agents')
    const examplesDir = path.join(agentsDir, 'examples')
    const helloDir = path.join(agentsDir, 'hello')

    fs.mkdirSync(examplesDir, { recursive: true })
    fs.mkdirSync(helloDir, { recursive: true })

    fs.writeFileSync(path.join(examplesDir, 'agent.yaml'), 'name: example-agent\noperation: code')
    fs.writeFileSync(path.join(helloDir, 'agent.yaml'), 'name: hello\noperation: code')

    // Create plugin with includeExamples: false
    const plugin = agentDiscoveryPlugin({ includeExamples: false })
    const config = { root: tempDir }
    callHook(plugin.configResolved as any, config)

    // Load virtual module
    const code = callHook(plugin.load as any, '\0virtual:conductor-agents') as string
    // Examples should be excluded
    expect(code).not.toContain('example-agent')
    expect(code).toContain('name: "hello"')
    expect(code).toContain('config: atob(')
  })

  it('should support custom file extensions', () => {
    const agentsDir = path.join(tempDir, 'agents')
    const helloDir = path.join(agentsDir, 'hello')
    fs.mkdirSync(helloDir, { recursive: true })

    fs.writeFileSync(path.join(helloDir, 'agent.yml'), 'name: hello')

    // Create plugin with custom extension
    const plugin = agentDiscoveryPlugin({ fileExtension: '.yml' })
    const config = { root: tempDir }
    callHook(plugin.configResolved as any, config)

    const code = callHook(plugin.load as any, '\0virtual:conductor-agents') as string
    expect(code).toContain('name: "hello"')
    expect(code).toContain('config: atob(')
  })

  it('should handle multiple agents', () => {
    const agentsDir = path.join(tempDir, 'agents')
    fs.mkdirSync(agentsDir, { recursive: true })

    // Create multiple agents
    const agents = ['agent1', 'agent2', 'agent3']
    for (const agentName of agents) {
      const agentDir = path.join(agentsDir, agentName)
      fs.mkdirSync(agentDir)
      fs.writeFileSync(path.join(agentDir, 'agent.yaml'), `name: ${agentName}`)
    }

    const plugin = agentDiscoveryPlugin()
    const config = { root: tempDir }
    callHook(plugin.configResolved as any, config)

    const code = callHook(plugin.load as any, '\0virtual:conductor-agents') as string
    expect(code).toContain('agent1')
    expect(code).toContain('agent2')
    expect(code).toContain('agent3')
  })

  it('should normalize Windows paths to forward slashes', () => {
    const agentsDir = path.join(tempDir, 'agents')
    const helloDir = path.join(agentsDir, 'hello')
    fs.mkdirSync(helloDir, { recursive: true })

    fs.writeFileSync(path.join(helloDir, 'agent.yaml'), 'name: hello')
    fs.writeFileSync(path.join(helloDir, 'index.ts'), 'export default function() {}')

    const plugin = agentDiscoveryPlugin()
    const config = { root: tempDir }
    callHook(plugin.configResolved as any, config)

    const code = callHook(plugin.load as any, '\0virtual:conductor-agents') as string
    // Ensure no backslashes in import paths
    expect(code).not.toMatch(/import.*\\/)
  })

  it('should discover agents in system folder', () => {
    // Create system folder structure (e.g., agents/system/docs)
    const agentsDir = path.join(tempDir, 'agents')
    const systemDir = path.join(agentsDir, 'system', 'docs')
    fs.mkdirSync(systemDir, { recursive: true })

    fs.writeFileSync(
      path.join(systemDir, 'agent.yaml'),
      `name: docs
operation: code
description: Documentation agent`
    )
    fs.writeFileSync(path.join(systemDir, 'index.ts'), 'export default function() {}')

    const plugin = agentDiscoveryPlugin()
    const config = { root: tempDir }
    callHook(plugin.configResolved as any, config)

    const code = callHook(plugin.load as any, '\0virtual:conductor-agents') as string
    // Agent name includes the full relative path: system/docs
    expect(code).toContain('name: "system/docs"')
    expect(code).toContain('config: atob(')
    expect(code).toContain('import * as handler_')
  })

  it('should discover agents in debug folder', () => {
    // Create debug folder structure
    const agentsDir = path.join(tempDir, 'agents')
    const debugDir = path.join(agentsDir, 'debug', 'echo')
    fs.mkdirSync(debugDir, { recursive: true })

    fs.writeFileSync(
      path.join(debugDir, 'agent.yaml'),
      `name: echo
operation: code
description: Echo agent for debugging`
    )

    const plugin = agentDiscoveryPlugin()
    const config = { root: tempDir }
    callHook(plugin.configResolved as any, config)

    const code = callHook(plugin.load as any, '\0virtual:conductor-agents') as string
    // Agent name includes the full relative path: debug/echo
    expect(code).toContain('name: "debug/echo"')
  })

  it('should discover agents across all folder categories', () => {
    // Create folder structure matching the template: examples, system, debug, user
    const agentsDir = path.join(tempDir, 'agents')

    const folders = [
      { path: 'examples/hello', name: 'hello' },
      { path: 'system/docs', name: 'docs' },
      { path: 'debug/echo', name: 'echo' },
      { path: 'user/custom', name: 'custom' },
    ]

    for (const folder of folders) {
      const dir = path.join(agentsDir, folder.path)
      fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(
        path.join(dir, 'agent.yaml'),
        `name: ${folder.name}\noperation: code`
      )
    }

    const plugin = agentDiscoveryPlugin()
    const config = { root: tempDir }
    callHook(plugin.configResolved as any, config)

    const code = callHook(plugin.load as any, '\0virtual:conductor-agents') as string

    // All agents should be discovered (names include full relative paths)
    expect(code).toContain('name: "examples/hello"')
    expect(code).toContain('name: "system/docs"')
    expect(code).toContain('name: "debug/echo"')
    expect(code).toContain('name: "user/custom"')
  })

  it('should discover handlers from YAML handler field', () => {
    // Create agent with explicit handler field (like system agents)
    const agentsDir = path.join(tempDir, 'agents')
    const validateDir = path.join(agentsDir, 'system', 'validate')
    fs.mkdirSync(validateDir, { recursive: true })

    // Create agent YAML with explicit handler field
    fs.writeFileSync(
      path.join(validateDir, 'validate.yaml'),
      `name: validate
operation: code
handler: ./validate.ts
description: Validation agent`
    )
    // Create handler file with custom name (not index.ts)
    fs.writeFileSync(path.join(validateDir, 'validate.ts'), 'export default function() {}')

    const plugin = agentDiscoveryPlugin()
    const config = { root: tempDir }
    callHook(plugin.configResolved as any, config)

    const code = callHook(plugin.load as any, '\0virtual:conductor-agents') as string

    // Agent should be discovered with its handler
    expect(code).toContain('name: "system/validate"')
    expect(code).toContain('import * as handler_system_validate from')
    expect(code).toContain('validate.ts')
    expect(code).toContain('handler: () => Promise.resolve(handler_system_validate.default || handler_system_validate)')
  })

  it('should prefer handler field over index.ts convention', () => {
    // Create agent with both handler field AND index.ts
    const agentsDir = path.join(tempDir, 'agents')
    const agentDir = path.join(agentsDir, 'custom')
    fs.mkdirSync(agentDir, { recursive: true })

    // Create agent YAML with explicit handler field
    fs.writeFileSync(
      path.join(agentDir, 'agent.yaml'),
      `name: custom
operation: code
handler: ./custom-handler.ts`
    )
    // Create both files
    fs.writeFileSync(path.join(agentDir, 'index.ts'), 'export default function indexHandler() {}')
    fs.writeFileSync(path.join(agentDir, 'custom-handler.ts'), 'export default function customHandler() {}')

    const plugin = agentDiscoveryPlugin()
    const config = { root: tempDir }
    callHook(plugin.configResolved as any, config)

    const code = callHook(plugin.load as any, '\0virtual:conductor-agents') as string

    // Should import custom-handler.ts, NOT index.ts
    expect(code).toContain('custom-handler.ts')
    expect(code).not.toMatch(/from.*index\.ts/)
  })

  it('should fall back to index.ts when handler field is missing', () => {
    // Create agent without handler field
    const agentsDir = path.join(tempDir, 'agents')
    const agentDir = path.join(agentsDir, 'fallback')
    fs.mkdirSync(agentDir, { recursive: true })

    // Create agent YAML without handler field
    fs.writeFileSync(
      path.join(agentDir, 'agent.yaml'),
      `name: fallback
operation: code`
    )
    // Create index.ts
    fs.writeFileSync(path.join(agentDir, 'index.ts'), 'export default function() {}')

    const plugin = agentDiscoveryPlugin()
    const config = { root: tempDir }
    callHook(plugin.configResolved as any, config)

    const code = callHook(plugin.load as any, '\0virtual:conductor-agents') as string

    // Should import index.ts via convention
    expect(code).toContain('index.ts')
    expect(code).toContain('handler: () => Promise.resolve(handler_fallback.default || handler_fallback)')
  })
})

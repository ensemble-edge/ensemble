import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ensembleDiscoveryPlugin } from '../../src/build/vite-plugin-ensemble-discovery'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

// Helper to call plugin hooks that might be functions or objects with handler
function callHook<T extends (...args: any[]) => any>(
  hook: T | { handler: T } | undefined,
  ...args: Parameters<T>
): ReturnType<T> | undefined {
  if (!hook) return undefined
  if (typeof hook === 'function') return hook(...args)
  return (hook as { handler: T }).handler(...args)
}

describe('ensembleDiscoveryPlugin', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ensemble-discovery-test-'))
  })

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('should create plugin with correct name', () => {
    const plugin = ensembleDiscoveryPlugin()
    expect(plugin.name).toBe('conductor:ensemble-discovery')
  })

  it('should resolve virtual module ID', () => {
    const plugin = ensembleDiscoveryPlugin()
    const resolved = callHook(plugin.resolveId as any, 'virtual:conductor-ensembles')
    expect(resolved).toBe('\0virtual:conductor-ensembles')
  })

  it('should generate empty module when ensembles directory does not exist', () => {
    const plugin = ensembleDiscoveryPlugin({ ensemblesDir: 'nonexistent' })
    const config = { root: tempDir }
    callHook(plugin.configResolved as any, config)

    const code = callHook(plugin.load as any, '\0virtual:conductor-ensembles')
    expect(code).toContain('export const ensembles = []')
    expect(code).toContain('export const ensemblesMap = new Map()')
  })

  it('should discover ensembles with YAML files', () => {
    const ensemblesDir = path.join(tempDir, 'ensembles')
    fs.mkdirSync(ensemblesDir, { recursive: true })

    const yamlContent = `name: workflow
description: A test workflow
flow:
  - step: greet`
    fs.writeFileSync(path.join(ensemblesDir, 'workflow.yaml'), yamlContent)

    const plugin = ensembleDiscoveryPlugin()
    const config = { root: tempDir }
    callHook(plugin.configResolved as any, config)

    const code = callHook(plugin.load as any, '\0virtual:conductor-ensembles') as string
    expect(code).toContain(`name: "workflow"`)
    expect(code).toContain('config: atob(')
    expect(code).toContain('export const ensembles = [')
  })

  it('should support nested ensemble directories', () => {
    const ensemblesDir = path.join(tempDir, 'ensembles')
    const nestedDir = path.join(ensemblesDir, 'workflows', 'user')
    fs.mkdirSync(nestedDir, { recursive: true })

    fs.writeFileSync(path.join(nestedDir, 'onboarding.yaml'), 'name: onboarding')

    const plugin = ensembleDiscoveryPlugin()
    const config = { root: tempDir }
    callHook(plugin.configResolved as any, config)

    const code = callHook(plugin.load as any, '\0virtual:conductor-ensembles') as string
    expect(code).toContain('onboarding')
  })

  it('should handle multiple ensembles', () => {
    const ensemblesDir = path.join(tempDir, 'ensembles')
    fs.mkdirSync(ensemblesDir, { recursive: true })

    const ensembles = ['workflow1', 'workflow2', 'workflow3']
    for (const name of ensembles) {
      fs.writeFileSync(path.join(ensemblesDir, `${name}.yaml`), `name: ${name}`)
    }

    const plugin = ensembleDiscoveryPlugin()
    const config = { root: tempDir }
    callHook(plugin.configResolved as any, config)

    const code = callHook(plugin.load as any, '\0virtual:conductor-ensembles') as string
    expect(code).toContain('workflow1')
    expect(code).toContain('workflow2')
    expect(code).toContain('workflow3')
  })

  it('should support custom file extensions', () => {
    const ensemblesDir = path.join(tempDir, 'ensembles')
    fs.mkdirSync(ensemblesDir, { recursive: true })

    fs.writeFileSync(path.join(ensemblesDir, 'workflow.yml'), 'name: workflow')

    const plugin = ensembleDiscoveryPlugin({ fileExtension: '.yml' })
    const config = { root: tempDir }
    callHook(plugin.configResolved as any, config)

    const code = callHook(plugin.load as any, '\0virtual:conductor-ensembles') as string
    expect(code).toContain('name: "workflow"')
    expect(code).toContain('config: atob(')
  })

  it('should discover ensembles in system folder', () => {
    // Create system folder structure (e.g., ensembles/system/docs)
    const ensemblesDir = path.join(tempDir, 'ensembles')
    const systemDir = path.join(ensemblesDir, 'system', 'docs')
    fs.mkdirSync(systemDir, { recursive: true })

    fs.writeFileSync(
      path.join(systemDir, 'docs-serve.yaml'),
      `name: docs-serve
trigger:
  - type: http
    path: /docs
    methods: [GET]
    public: true
flow:
  - agent: docs
    input: {}`
    )

    const plugin = ensembleDiscoveryPlugin()
    const config = { root: tempDir }
    callHook(plugin.configResolved as any, config)

    const code = callHook(plugin.load as any, '\0virtual:conductor-ensembles') as string
    // Name comes from filename (docs-serve.yaml -> docs-serve)
    expect(code).toContain('name: "docs-serve"')
    expect(code).toContain('config: atob(')
  })

  it('should discover ensembles in debug folder', () => {
    const ensemblesDir = path.join(tempDir, 'ensembles')
    const debugDir = path.join(ensemblesDir, 'debug')
    fs.mkdirSync(debugDir, { recursive: true })

    fs.writeFileSync(
      path.join(debugDir, 'debug-echo.yaml'),
      `name: debug-echo
flow:
  - agent: echo
    input: {}`
    )

    const plugin = ensembleDiscoveryPlugin()
    const config = { root: tempDir }
    callHook(plugin.configResolved as any, config)

    const code = callHook(plugin.load as any, '\0virtual:conductor-ensembles') as string
    // Name comes from filename (debug-echo.yaml -> debug-echo)
    expect(code).toContain('name: "debug-echo"')
  })

  it('should discover ensembles across all folder categories', () => {
    // Create folder structure matching the template: examples, system, debug, user
    const ensemblesDir = path.join(tempDir, 'ensembles')

    // Note: The plugin derives the ensemble name from the FILENAME, not the YAML content
    const ensembles = [
      { path: 'examples/hello-world.yaml', content: 'name: hello-world\nflow:\n  - agent: hello\n    input: {}' },
      { path: 'system/docs/docs-serve.yaml', content: 'name: docs-serve\nflow:\n  - agent: docs\n    input: {}' },
      { path: 'debug/debug-echo.yaml', content: 'name: debug-echo\nflow:\n  - agent: echo\n    input: {}' },
      { path: 'user/user-custom.yaml', content: 'name: user-custom\nflow:\n  - agent: custom\n    input: {}' },
    ]

    for (const ensemble of ensembles) {
      const fullPath = path.join(ensemblesDir, ensemble.path)
      fs.mkdirSync(path.dirname(fullPath), { recursive: true })
      fs.writeFileSync(fullPath, ensemble.content)
    }

    const plugin = ensembleDiscoveryPlugin()
    const config = { root: tempDir }
    callHook(plugin.configResolved as any, config)

    const code = callHook(plugin.load as any, '\0virtual:conductor-ensembles') as string

    // All ensembles should be discovered (name comes from filename, not YAML content)
    expect(code).toContain('name: "hello-world"')
    expect(code).toContain('name: "docs-serve"')
    expect(code).toContain('name: "debug-echo"')
    expect(code).toContain('name: "user-custom"')
  })

  it('should discover ensembles with HTTP triggers', () => {
    const ensemblesDir = path.join(tempDir, 'ensembles')
    fs.mkdirSync(ensemblesDir, { recursive: true })

    fs.writeFileSync(
      path.join(ensemblesDir, 'api-endpoint.yaml'),
      `name: api-endpoint
trigger:
  - type: http
    path: /api/test
    methods: [GET, POST]
    public: true
flow:
  - agent: handler
    input: {}`
    )

    const plugin = ensembleDiscoveryPlugin()
    const config = { root: tempDir }
    callHook(plugin.configResolved as any, config)

    const code = callHook(plugin.load as any, '\0virtual:conductor-ensembles') as string
    // Name comes from filename (api-endpoint.yaml -> api-endpoint)
    expect(code).toContain('name: "api-endpoint"')
  })

  it('should discover ensembles with multi-path triggers', () => {
    const ensemblesDir = path.join(tempDir, 'ensembles')
    fs.mkdirSync(ensemblesDir, { recursive: true })

    fs.writeFileSync(
      path.join(ensemblesDir, 'multi-path-api.yaml'),
      `name: multi-path-api
trigger:
  - type: http
    paths:
      - path: /docs
        methods: [GET]
      - path: /docs/api
        methods: [GET]
    public: true
flow:
  - agent: docs
    input: {}`
    )

    const plugin = ensembleDiscoveryPlugin()
    const config = { root: tempDir }
    callHook(plugin.configResolved as any, config)

    const code = callHook(plugin.load as any, '\0virtual:conductor-ensembles') as string
    // Name comes from filename (multi-path-api.yaml -> multi-path-api)
    expect(code).toContain('name: "multi-path-api"')
  })
})

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { scriptDiscoveryPlugin } from '../../src/build/vite-plugin-script-discovery'
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

describe('scriptDiscoveryPlugin', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'script-discovery-test-'))
  })

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('should create plugin with correct name', () => {
    const plugin = scriptDiscoveryPlugin()
    expect(plugin.name).toBe('conductor:script-discovery')
  })

  it('should resolve virtual module ID', () => {
    const plugin = scriptDiscoveryPlugin()
    const resolved = callHook(plugin.resolveId as any, 'virtual:conductor-scripts')
    expect(resolved).toBe('\0virtual:conductor-scripts')
  })

  it('should not resolve other module IDs', () => {
    const plugin = scriptDiscoveryPlugin()
    const resolved = callHook(plugin.resolveId as any, 'some-other-module')
    expect(resolved).toBeUndefined()
  })

  it('should generate empty module when scripts directory does not exist', () => {
    const plugin = scriptDiscoveryPlugin({ scriptsDir: 'nonexistent' })
    const config = { root: tempDir }
    callHook(plugin.configResolved as any, config)

    const code = callHook(plugin.load as any, '\0virtual:conductor-scripts')
    expect(code).toContain('export const scripts = []')
    expect(code).toContain('export const scriptsMap = new Map()')
  })

  it('should discover scripts with TypeScript files', () => {
    const scriptsDir = path.join(tempDir, 'scripts')
    fs.mkdirSync(scriptsDir, { recursive: true })

    // Create a simple script file
    fs.writeFileSync(
      path.join(scriptsDir, 'hello.ts'),
      `export default function hello() { return 'hello' }`
    )

    const plugin = scriptDiscoveryPlugin()
    const config = { root: tempDir }
    callHook(plugin.configResolved as any, config)

    const code = callHook(plugin.load as any, '\0virtual:conductor-scripts') as string
    expect(code).toBeDefined()
    expect(code).toContain(`import script_hello from`)
    expect(code).toContain(`name: "hello"`)
    expect(code).toContain('export const scripts = [')
    expect(code).toContain('export const scriptsMap = new Map')
  })

  it('should discover scripts in nested directories', () => {
    const scriptsDir = path.join(tempDir, 'scripts')
    const transformsDir = path.join(scriptsDir, 'transforms')
    fs.mkdirSync(transformsDir, { recursive: true })

    fs.writeFileSync(
      path.join(transformsDir, 'csv.ts'),
      `export default function csv() { return 'csv' }`
    )

    const plugin = scriptDiscoveryPlugin()
    const config = { root: tempDir }
    callHook(plugin.configResolved as any, config)

    const code = callHook(plugin.load as any, '\0virtual:conductor-scripts') as string
    expect(code).toContain(`name: "transforms/csv"`)
    expect(code).toContain(`["transforms/csv", script_transforms_csv]`)
  })

  it('should handle multiple scripts', () => {
    const scriptsDir = path.join(tempDir, 'scripts')
    fs.mkdirSync(scriptsDir, { recursive: true })

    const scripts = ['script1', 'script2', 'script3']
    for (const name of scripts) {
      fs.writeFileSync(
        path.join(scriptsDir, `${name}.ts`),
        `export default function ${name}() { return '${name}' }`
      )
    }

    const plugin = scriptDiscoveryPlugin()
    const config = { root: tempDir }
    callHook(plugin.configResolved as any, config)

    const code = callHook(plugin.load as any, '\0virtual:conductor-scripts') as string
    expect(code).toContain('script1')
    expect(code).toContain('script2')
    expect(code).toContain('script3')
  })

  it('should exclude test files by default', () => {
    const scriptsDir = path.join(tempDir, 'scripts')
    fs.mkdirSync(scriptsDir, { recursive: true })

    // Create regular script and test files
    fs.writeFileSync(
      path.join(scriptsDir, 'hello.ts'),
      `export default function hello() { return 'hello' }`
    )
    fs.writeFileSync(
      path.join(scriptsDir, 'hello.test.ts'),
      `import hello from './hello'; test('hello', () => {})`
    )
    fs.writeFileSync(
      path.join(scriptsDir, 'hello.spec.ts'),
      `import hello from './hello'; describe('hello', () => {})`
    )

    const plugin = scriptDiscoveryPlugin()
    const config = { root: tempDir }
    callHook(plugin.configResolved as any, config)

    const code = callHook(plugin.load as any, '\0virtual:conductor-scripts') as string
    expect(code).toContain('name: "hello"')
    expect(code).not.toContain('hello.test')
    expect(code).not.toContain('hello.spec')
  })

  it('should exclude __tests__ directory by default', () => {
    const scriptsDir = path.join(tempDir, 'scripts')
    const testsDir = path.join(scriptsDir, '__tests__')
    fs.mkdirSync(testsDir, { recursive: true })

    fs.writeFileSync(
      path.join(scriptsDir, 'hello.ts'),
      `export default function hello() { return 'hello' }`
    )
    fs.writeFileSync(
      path.join(testsDir, 'hello.test.ts'),
      `import hello from '../hello'; test('hello', () => {})`
    )

    const plugin = scriptDiscoveryPlugin()
    const config = { root: tempDir }
    callHook(plugin.configResolved as any, config)

    const code = callHook(plugin.load as any, '\0virtual:conductor-scripts') as string
    expect(code).toContain('name: "hello"')
    expect(code).not.toContain('__tests__')
  })

  it('should support custom file extensions', () => {
    const scriptsDir = path.join(tempDir, 'scripts')
    fs.mkdirSync(scriptsDir, { recursive: true })

    fs.writeFileSync(
      path.join(scriptsDir, 'hello.js'),
      `export default function hello() { return 'hello' }`
    )

    const plugin = scriptDiscoveryPlugin({ fileExtension: '.js' })
    const config = { root: tempDir }
    callHook(plugin.configResolved as any, config)

    const code = callHook(plugin.load as any, '\0virtual:conductor-scripts') as string
    expect(code).toContain('name: "hello"')
  })

  it('should normalize Windows paths to forward slashes', () => {
    const scriptsDir = path.join(tempDir, 'scripts')
    const nestedDir = path.join(scriptsDir, 'utils', 'helpers')
    fs.mkdirSync(nestedDir, { recursive: true })

    fs.writeFileSync(
      path.join(nestedDir, 'format.ts'),
      `export default function format() { return 'format' }`
    )

    const plugin = scriptDiscoveryPlugin()
    const config = { root: tempDir }
    callHook(plugin.configResolved as any, config)

    const code = callHook(plugin.load as any, '\0virtual:conductor-scripts') as string
    // Ensure no backslashes in import paths or script names
    expect(code).not.toMatch(/import.*\\/)
    expect(code).toContain('utils/helpers/format')
  })

  it('should generate correct map entries for script:// resolution', () => {
    const scriptsDir = path.join(tempDir, 'scripts')
    const transformsDir = path.join(scriptsDir, 'transforms')
    fs.mkdirSync(transformsDir, { recursive: true })

    fs.writeFileSync(
      path.join(scriptsDir, 'health-check.ts'),
      `export default function healthCheck() { return { status: 'ok' } }`
    )
    fs.writeFileSync(
      path.join(transformsDir, 'csv.ts'),
      `export default function csv() { return 'csv' }`
    )

    const plugin = scriptDiscoveryPlugin()
    const config = { root: tempDir }
    callHook(plugin.configResolved as any, config)

    const code = callHook(plugin.load as any, '\0virtual:conductor-scripts') as string

    // Check that map entries are correctly generated for script:// resolution
    expect(code).toContain('["health-check", script_health_check]')
    expect(code).toContain('["transforms/csv", script_transforms_csv]')
  })
})

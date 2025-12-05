import { defineConfig, Plugin } from 'vite'
import { docsDiscoveryPlugin } from './src/build/vite-plugin-docs-discovery.js'
import { agentDiscoveryPlugin } from './src/build/vite-plugin-agent-discovery.js'
import { ensembleDiscoveryPlugin } from './src/build/vite-plugin-ensemble-discovery.js'
import { scriptDiscoveryPlugin } from './src/build/vite-plugin-script-discovery.js'
import * as fs from 'node:fs'

// Plugin to load YAML files as raw text
function yamlRawPlugin(): Plugin {
  return {
    name: 'yaml-raw',
    transform(code, id) {
      if (id.endsWith('.yaml') || id.endsWith('.yml')) {
        // Load as raw string
        const content = fs.readFileSync(id, 'utf-8')
        return {
          code: `export default ${JSON.stringify(content)}`,
          map: null,
        }
      }
    },
  }
}

export default defineConfig({
  plugins: [
    yamlRawPlugin(),
    docsDiscoveryPlugin(), // Auto-discover docs/ markdown files
    agentDiscoveryPlugin(), // Auto-discover agents/**/*.yaml files
    ensembleDiscoveryPlugin(), // Auto-discover ensembles/**/*.yaml files
    scriptDiscoveryPlugin(), // Auto-discover scripts/**/*.ts files for script:// URIs
  ],
  build: {
    outDir: 'dist',
    lib: {
      entry: 'src/index-auto-discovery.ts',
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external: [
        // External dependencies that shouldn't be bundled
        /^node:.*/,
        'cloudflare:workers',
      ],
      output: {
        preserveModules: false,
        exports: 'auto',
      },
      // Silence browser compatibility warnings (expected for Cloudflare Workers)
      onwarn(warning, warn) {
        if (warning.message?.includes('externalized for browser')) return;
        warn(warning);
      },
    },
    minify: false,
    sourcemap: true,
    target: 'esnext',
  },
  assetsInclude: ['**/*.yaml', '**/*.yml'],
  resolve: {
    conditions: ['workerd', 'worker', 'browser'],
  },
  optimizeDeps: {
    include: [],
    exclude: ['cloudflare:workers'],
  },
  esbuild: {
    charset: 'utf8', // Support Unicode characters in source files
  },
})

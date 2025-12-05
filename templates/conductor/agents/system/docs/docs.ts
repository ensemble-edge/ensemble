/**
 * Docs Agent
 *
 * Documentation generation and serving agent.
 * Handles rendering of markdown pages, agent/ensemble documentation,
 * and OpenAPI specification generation.
 */

import type { AgentExecutionContext } from '@ensemble-edge/conductor'

// ============================================================================
// Types
// ============================================================================

type DocsAction =
  | 'render-landing'
  | 'render-page'
  | 'render-agents'
  | 'render-agent-detail'
  | 'render-ensembles'
  | 'render-ensemble-detail'
  | 'render-api'
  | 'generate-openapi'
  | 'list-pages'

interface DocsPage {
  slug: string
  title: string
  content: string
  order: number
  frontmatter?: Record<string, unknown>
}

interface DocsInput {
  action: DocsAction
  slug?: string
  name?: string
  format?: 'json' | 'yaml'
  pages?: DocsPage[]
}

interface DocsConfig {
  title: string
  description?: string
  logo?: string
  favicon?: string
  ui: 'stoplight' | 'redoc' | 'swagger' | 'scalar' | 'rapidoc'
  theme: {
    primaryColor: string
    darkMode: boolean
    customCss?: string
  }
  nav: {
    order?: string[]
    hide?: string[]
    showReserved?: {
      agents?: boolean
      ensembles?: boolean
      api?: boolean
    }
  }
  basePath: string
  cache: {
    enabled: boolean
    ttl: number
  }
}

interface DocsOutput {
  success: boolean
  html?: string
  contentType?: string
  spec?: Record<string, unknown>
  specYaml?: string
  specJson?: string
  pages?: Array<{ slug: string; title: string; order: number }>
  error?: string
  errorMessage?: string
}

interface AgentMetadata {
  name: string
  operation: string
  description: string
  builtIn: boolean
  configSchema?: Record<string, unknown>
  inputSchema?: Record<string, unknown>
  outputSchema?: Record<string, unknown>
  examples?: unknown[]
  config?: Record<string, unknown>
}

interface EnsembleMetadata {
  name: string
  description: string
  source: 'yaml' | 'typescript'
  triggers: Array<{
    type: string
    path?: string
    methods?: string[]
    cron?: string
  }>
  steps: Array<{
    index: number
    type: string
    agent?: string
    condition?: string
  }>
  inlineAgents: Array<{ name: string; operation: string }>
  inputSchema?: Record<string, unknown>
  outputSchema?: Record<string, unknown>
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: DocsConfig = {
  title: 'API Documentation',
  ui: 'stoplight',
  theme: {
    primaryColor: '#3b82f6',
    darkMode: false,
  },
  nav: {
    showReserved: {
      agents: true,
      ensembles: true,
      api: true,
    },
  },
  basePath: '/docs',
  cache: {
    enabled: true,
    ttl: 300,
  },
}

// ============================================================================
// Agent Implementation
// ============================================================================

export default async function docs(
  input: DocsInput,
  ctx: AgentExecutionContext
): Promise<DocsOutput> {
  const config: DocsConfig = {
    ...DEFAULT_CONFIG,
    ...(ctx.config as Partial<DocsConfig>),
    theme: {
      ...DEFAULT_CONFIG.theme,
      ...((ctx.config as Partial<DocsConfig>)?.theme || {}),
    },
    nav: {
      ...DEFAULT_CONFIG.nav,
      ...((ctx.config as Partial<DocsConfig>)?.nav || {}),
    },
    cache: {
      ...DEFAULT_CONFIG.cache,
      ...((ctx.config as Partial<DocsConfig>)?.cache || {}),
    },
  }

  switch (input.action) {
    case 'render-landing':
      return renderLanding(ctx, config)

    case 'render-page':
      return renderPage(input.slug, input.pages, config, ctx)

    case 'render-agents':
      return renderAgentsList(ctx, config)

    case 'render-agent-detail':
      return renderAgentDetail(input.name, ctx, config)

    case 'render-ensembles':
      return renderEnsemblesList(ctx, config)

    case 'render-ensemble-detail':
      return renderEnsembleDetail(input.name, ctx, config)

    case 'render-api':
      return renderApiDocs(config)

    case 'generate-openapi':
      return generateOpenAPI(input.format || 'json', ctx, config)

    case 'list-pages':
      return listPages(input.pages, ctx)

    default:
      return {
        success: false,
        error: 'invalid_action',
        errorMessage: `Unknown action: ${input.action}`,
      }
  }
}

// ============================================================================
// Rendering Functions
// ============================================================================

function renderLanding(ctx: AgentExecutionContext, config: DocsConfig): DocsOutput {
  // Get counts from registry if available
  const agentRegistry = ctx.agentRegistry
  const ensembleRegistry = ctx.ensembleRegistry

  const builtInCount = agentRegistry?.listBuiltIn?.()?.length || 0
  const customCount = agentRegistry?.listCustom?.()?.length || 0
  const totalAgents = builtInCount + customCount
  const totalEnsembles = ensembleRegistry?.list?.()?.length || 0

  const html = generateLandingHtml({
    title: config.title,
    description: config.description || 'Auto-generated documentation for your Conductor project',
    agentCount: totalAgents,
    ensembleCount: totalEnsembles,
    builtInAgentCount: builtInCount,
    customAgentCount: customCount,
    theme: config.theme,
    basePath: config.basePath,
    nav: config.nav,
  })

  return { success: true, html, contentType: 'text/html' }
}

function renderPage(
  slug: string | undefined,
  inputPages: DocsPage[] | undefined,
  config: DocsConfig,
  ctx: AgentExecutionContext
): DocsOutput {
  if (!slug) {
    return {
      success: false,
      error: 'not_found',
      errorMessage: 'No page slug provided',
    }
  }

  // Try to get pages from input first, then fall back to docsRegistry
  let pages: DocsPage[] | undefined = inputPages
  if (!pages || pages.length === 0) {
    // Use docsRegistry from context if available
    const docsRegistry = ctx.docsRegistry
    if (docsRegistry) {
      const registryPages = docsRegistry.list()
      if (registryPages.length > 0) {
        pages = registryPages.map((p) => ({
          slug: p.slug,
          title: p.title,
          content: p.content,
          order: p.order ?? 999,
        }))
      }
    }
  }

  if (!pages || pages.length === 0) {
    return {
      success: false,
      error: 'no_pages',
      errorMessage: 'No pages loaded',
    }
  }

  const page = pages.find((p) => p.slug === slug)
  if (!page) {
    return {
      success: false,
      error: 'not_found',
      errorMessage: `Page not found: ${slug}`,
    }
  }

  const html = generatePageHtml({
    page,
    pages,
    theme: config.theme,
    basePath: config.basePath,
    title: config.title,
    nav: config.nav,
  })

  return { success: true, html, contentType: 'text/html' }
}

function renderAgentsList(ctx: AgentExecutionContext, config: DocsConfig): DocsOutput {
  const agentRegistry = ctx.agentRegistry

  const builtInAgents: AgentMetadata[] = []
  const customAgents: AgentMetadata[] = []

  // Get built-in agents
  const builtIn = agentRegistry?.listBuiltIn?.() || []
  for (const metadata of builtIn) {
    builtInAgents.push({
      name: metadata.name,
      operation: metadata.operation,
      description: metadata.description || '',
      builtIn: true,
      configSchema: metadata.configSchema,
      inputSchema: metadata.inputSchema,
      outputSchema: metadata.outputSchema,
      examples: metadata.examples,
    })
  }

  // Get custom agents
  const custom = agentRegistry?.listCustom?.() || []
  for (const metadata of custom) {
    customAgents.push({
      name: metadata.name,
      operation: metadata.operation,
      description: metadata.description || '',
      builtIn: false,
      config: metadata.config,
      inputSchema: metadata.inputSchema,
      outputSchema: metadata.outputSchema,
    })
  }

  const html = generateAgentsListHtml({
    builtInAgents,
    customAgents,
    theme: config.theme,
    basePath: config.basePath,
    title: config.title,
    nav: config.nav,
  })

  return { success: true, html, contentType: 'text/html' }
}

function renderAgentDetail(
  name: string | undefined,
  ctx: AgentExecutionContext,
  config: DocsConfig
): DocsOutput {
  if (!name) {
    return {
      success: false,
      error: 'not_found',
      errorMessage: 'No agent name provided',
    }
  }

  const agentRegistry = ctx.agentRegistry
  const metadata = agentRegistry?.get?.(name)

  if (!metadata) {
    return {
      success: false,
      error: 'not_found',
      errorMessage: `Agent not found: ${name}`,
    }
  }

  const html = generateAgentDetailHtml({
    agent: {
      name: metadata.name,
      operation: metadata.operation,
      description: metadata.description || '',
      builtIn: metadata.builtIn ?? false,
      configSchema: metadata.configSchema,
      inputSchema: metadata.inputSchema,
      outputSchema: metadata.outputSchema,
      examples: metadata.examples,
      config: metadata.config,
    },
    theme: config.theme,
    basePath: config.basePath,
    title: config.title,
    nav: config.nav,
  })

  return { success: true, html, contentType: 'text/html' }
}

function renderEnsemblesList(ctx: AgentExecutionContext, config: DocsConfig): DocsOutput {
  const ensembleRegistry = ctx.ensembleRegistry
  const ensembles: EnsembleMetadata[] = []

  const list = ensembleRegistry?.list?.() || []
  for (const ensemble of list) {
    ensembles.push({
      name: ensemble.name,
      description: ensemble.description || '',
      source: ensemble.source || 'yaml',
      triggers:
        ensemble.trigger?.map((t: any) => ({
          type: t.type,
          path: t.path,
          methods: t.methods,
          cron: t.cron,
        })) || [],
      steps: Array.isArray(ensemble.flow)
        ? ensemble.flow.map((step: any, index: number) => ({
            index,
            type: step.type || 'agent',
            agent: step.agent,
            condition: step.when || step.condition,
          }))
        : [],
      inlineAgents:
        ensemble.agents?.map((a: any) => ({
          name: a.name,
          operation: a.operation,
        })) || [],
    })
  }

  const html = generateEnsemblesListHtml({
    ensembles,
    theme: config.theme,
    basePath: config.basePath,
    title: config.title,
    nav: config.nav,
  })

  return { success: true, html, contentType: 'text/html' }
}

function renderEnsembleDetail(
  name: string | undefined,
  ctx: AgentExecutionContext,
  config: DocsConfig
): DocsOutput {
  if (!name) {
    return {
      success: false,
      error: 'not_found',
      errorMessage: 'No ensemble name provided',
    }
  }

  const ensembleRegistry = ctx.ensembleRegistry
  const ensemble = ensembleRegistry?.get?.(name)

  if (!ensemble) {
    return {
      success: false,
      error: 'not_found',
      errorMessage: `Ensemble not found: ${name}`,
    }
  }

  const metadata: EnsembleMetadata = {
    name: ensemble.name,
    description: ensemble.description || '',
    source: ensemble.source || 'yaml',
    triggers:
      ensemble.trigger?.map((t: any) => ({
        type: t.type,
        path: t.path,
        methods: t.methods,
        cron: t.cron,
      })) || [],
    steps: Array.isArray(ensemble.flow)
      ? ensemble.flow.map((step: any, index: number) => ({
          index,
          type: step.type || 'agent',
          agent: step.agent,
          condition: step.when || step.condition,
        }))
      : [],
    inlineAgents:
      ensemble.agents?.map((a: any) => ({
        name: a.name,
        operation: a.operation,
      })) || [],
    inputSchema: ensemble.inputs,
    outputSchema: ensemble.output,
  }

  const html = generateEnsembleDetailHtml({
    ensemble: metadata,
    theme: config.theme,
    basePath: config.basePath,
    title: config.title,
    nav: config.nav,
  })

  return { success: true, html, contentType: 'text/html' }
}

function renderApiDocs(config: DocsConfig): DocsOutput {
  const html = generateOpenAPIUIHtml({
    title: 'API Reference',
    specUrl: `${config.basePath}/openapi.json`,
    ui: config.ui,
    theme: config.theme,
    siteTitle: config.title,
  })

  return { success: true, html, contentType: 'text/html' }
}

function generateOpenAPI(
  format: 'json' | 'yaml',
  ctx: AgentExecutionContext,
  config: DocsConfig
): DocsOutput {
  const agentRegistry = ctx.agentRegistry
  const ensembleRegistry = ctx.ensembleRegistry

  const agents = [
    ...(agentRegistry?.listBuiltIn?.() || []),
    ...(agentRegistry?.listCustom?.() || []),
  ]
  const ensembles = ensembleRegistry?.list?.() || []

  const spec = buildOpenAPISpec({
    title: config.title,
    description: config.description,
    agents,
    ensembles,
  })

  if (format === 'yaml') {
    // Simple YAML serialization (basic implementation)
    const yamlStr = jsonToYaml(spec)
    return {
      success: true,
      spec,
      specYaml: yamlStr,
    }
  }

  return {
    success: true,
    spec,
    specJson: JSON.stringify(spec, null, 2),
  }
}

function listPages(inputPages: DocsPage[] | undefined, ctx: AgentExecutionContext): DocsOutput {
  // Try to get pages from input first, then fall back to docsRegistry
  let pages: DocsPage[] | undefined = inputPages
  if (!pages || pages.length === 0) {
    const docsRegistry = ctx.docsRegistry
    if (docsRegistry) {
      const registryPages = docsRegistry.list()
      if (registryPages.length > 0) {
        pages = registryPages.map((p) => ({
          slug: p.slug,
          title: p.title,
          content: p.content,
          order: p.order ?? 999,
        }))
      }
    }
  }

  if (!pages || pages.length === 0) {
    return {
      success: true,
      pages: [],
    }
  }

  return {
    success: true,
    pages: pages
      .map((p) => ({
        slug: p.slug,
        title: p.title,
        order: p.order,
      }))
      .sort((a, b) => a.order - b.order),
  }
}

// ============================================================================
// HTML Generation Helpers
// ============================================================================

function getCommonStyles(theme: DocsConfig['theme']): string {
  const primaryColor = theme.primaryColor || '#3b82f6'
  const primaryHover = adjustColor(primaryColor, -20)

  return `
    :root {
      --primary-color: ${primaryColor};
      --primary-hover: ${primaryHover};
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      line-height: 1.6;
      color: ${theme.darkMode ? '#e2e8f0' : '#1a1a2e'};
      background: ${theme.darkMode ? '#0f172a' : '#f8fafc'};
    }
    a { color: var(--primary-color); text-decoration: none; }
    a:hover { text-decoration: underline; }
    code {
      font-family: 'SF Mono', Monaco, 'Courier New', monospace;
      background: ${theme.darkMode ? '#1e293b' : '#e2e8f0'};
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.9em;
    }
    pre {
      background: #1e293b;
      color: #e2e8f0;
      padding: 16px;
      border-radius: 8px;
      overflow-x: auto;
      font-size: 14px;
    }
    pre code { background: none; padding: 0; }
    .container { max-width: 1200px; margin: 0 auto; padding: 0 24px; }
    .header {
      background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
      color: white;
      padding: 32px 0;
    }
    .header h1 { font-size: 2rem; margin-bottom: 8px; }
    .header p { opacity: 0.9; }
    .nav {
      background: ${theme.darkMode ? '#1e293b' : 'white'};
      border-bottom: 1px solid ${theme.darkMode ? '#334155' : '#e2e8f0'};
      padding: 12px 0;
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .nav ul { display: flex; gap: 24px; list-style: none; }
    .nav a { color: ${theme.darkMode ? '#94a3b8' : '#64748b'}; font-weight: 500; }
    .nav a:hover, .nav a.active { color: var(--primary-color); text-decoration: none; }
    .content { padding: 32px 0; }
    .card {
      background: ${theme.darkMode ? '#1e293b' : 'white'};
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 16px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .card h3 { margin-bottom: 8px; }
    .card p { color: ${theme.darkMode ? '#94a3b8' : '#64748b'}; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
    }
    .badge-blue { background: #dbeafe; color: #1d4ed8; }
    .badge-green { background: #dcfce7; color: #15803d; }
    .badge-purple { background: #f3e8ff; color: #7c3aed; }
    .badge-gray { background: ${theme.darkMode ? '#334155' : '#f1f5f9'}; color: ${theme.darkMode ? '#94a3b8' : '#475569'}; }
    .stat { text-align: center; padding: 24px; }
    .stat-value { font-size: 2.5rem; font-weight: 700; color: var(--primary-color); }
    .stat-label { color: ${theme.darkMode ? '#94a3b8' : '#64748b'}; margin-top: 4px; }
    .table { width: 100%; border-collapse: collapse; }
    .table th, .table td { padding: 12px; text-align: left; border-bottom: 1px solid ${theme.darkMode ? '#334155' : '#e2e8f0'}; }
    .table th { background: ${theme.darkMode ? '#0f172a' : '#f8fafc'}; font-weight: 600; }
    .section { margin-bottom: 32px; }
    .section-title { font-size: 1.25rem; font-weight: 600; margin-bottom: 16px; color: ${theme.darkMode ? '#f1f5f9' : '#1e293b'}; }
    .breadcrumb { margin-bottom: 16px; color: ${theme.darkMode ? '#94a3b8' : '#64748b'}; }
    .breadcrumb a { color: ${theme.darkMode ? '#94a3b8' : '#64748b'}; }
    .empty { text-align: center; padding: 48px; color: ${theme.darkMode ? '#94a3b8' : '#64748b'}; }
    ${theme.customCss || ''}
  `
}

function adjustColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = Math.min(255, Math.max(0, (num >> 16) + amount))
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amount))
  const b = Math.min(255, Math.max(0, (num & 0x0000ff) + amount))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

function baseTemplate(
  title: string,
  content: string,
  activeNav: string,
  config: {
    theme: DocsConfig['theme']
    basePath: string
    siteTitle: string
    nav?: DocsConfig['nav']
  }
): string {
  const styles = getCommonStyles(config.theme)
  const showReserved = config.nav?.showReserved ?? { agents: true, ensembles: true, api: true }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | ${config.siteTitle}</title>
  <style>${styles}</style>
</head>
<body>
  <div class="header">
    <div class="container">
      <h1>${title}</h1>
      <p>Auto-generated documentation for your Conductor project</p>
    </div>
  </div>
  <nav class="nav">
    <div class="container">
      <ul>
        <li><a href="${config.basePath}" class="${activeNav === 'home' ? 'active' : ''}">Overview</a></li>
        ${showReserved.agents !== false ? `<li><a href="${config.basePath}/agents" class="${activeNav === 'agents' ? 'active' : ''}">Agents</a></li>` : ''}
        ${showReserved.ensembles !== false ? `<li><a href="${config.basePath}/ensembles" class="${activeNav === 'ensembles' ? 'active' : ''}">Ensembles</a></li>` : ''}
        ${showReserved.api !== false ? `<li><a href="${config.basePath}/api" class="${activeNav === 'api' ? 'active' : ''}">API Reference</a></li>` : ''}
      </ul>
    </div>
  </nav>
  <main class="content">
    <div class="container">
      ${content}
    </div>
  </main>
  <footer style="text-align: center; padding: 32px; color: #64748b; font-size: 0.875rem;">
    <p>Built with <a href="https://github.com/ensemble-edge">Ensemble Edge</a></p>
  </footer>
</body>
</html>`
}

// ============================================================================
// Page Generators
// ============================================================================

interface LandingProps {
  title: string
  description: string
  agentCount: number
  ensembleCount: number
  builtInAgentCount: number
  customAgentCount: number
  theme: DocsConfig['theme']
  basePath: string
  nav?: DocsConfig['nav']
}

function generateLandingHtml(props: LandingProps): string {
  const content = `
    <div class="grid" style="margin-bottom: 32px;">
      <div class="card stat">
        <div class="stat-value">${props.agentCount}</div>
        <div class="stat-label">Total Agents</div>
        <div style="margin-top: 8px; font-size: 0.875rem; color: #64748b;">
          ${props.builtInAgentCount} built-in &middot; ${props.customAgentCount} custom
        </div>
      </div>
      <div class="card stat">
        <div class="stat-value">${props.ensembleCount}</div>
        <div class="stat-label">Ensembles</div>
      </div>
      <div class="card stat">
        <div class="stat-value">14</div>
        <div class="stat-label">Operation Types</div>
      </div>
    </div>

    <div class="section">
      <h2 class="section-title">Quick Links</h2>
      <div class="grid">
        <a href="${props.basePath}/agents" class="card" style="text-decoration: none; color: inherit;">
          <h3>Agents</h3>
          <p>Browse all available agents and their configurations</p>
        </a>
        <a href="${props.basePath}/ensembles" class="card" style="text-decoration: none; color: inherit;">
          <h3>Ensembles</h3>
          <p>Explore workflow orchestrations and their triggers</p>
        </a>
        <a href="${props.basePath}/api" class="card" style="text-decoration: none; color: inherit;">
          <h3>API Reference</h3>
          <p>Interactive OpenAPI documentation</p>
        </a>
        <a href="/api/v1/agents" class="card" style="text-decoration: none; color: inherit;">
          <h3>JSON API</h3>
          <p>Programmatic access to agent metadata</p>
        </a>
      </div>
    </div>

    <div class="section">
      <h2 class="section-title">About Conductor</h2>
      <div class="card">
        <p style="margin-bottom: 16px;">
          <strong>Conductor</strong> is an agentic workflow orchestration framework for Cloudflare Workers.
          It enables you to build complex AI-powered workflows using declarative YAML or TypeScript.
        </p>
        <p style="margin-bottom: 16px;">
          <strong>Core concepts:</strong>
        </p>
        <ul style="margin-left: 24px; color: #475569;">
          <li><strong>Agents</strong> - Reusable units of work with specific operations</li>
          <li><strong>Ensembles</strong> - Orchestrations that combine agents into workflows</li>
          <li><strong>Operations</strong> - Atomic execution primitives (think, code, http, storage, etc.)</li>
          <li><strong>Triggers</strong> - HTTP, webhook, cron, email, queue, and MCP invocation methods</li>
        </ul>
      </div>
    </div>
  `

  return baseTemplate(props.title, content, 'home', {
    theme: props.theme,
    basePath: props.basePath,
    siteTitle: props.title,
    nav: props.nav,
  })
}

interface PageProps {
  page: DocsPage
  pages: DocsPage[]
  theme: DocsConfig['theme']
  basePath: string
  title: string
  nav?: DocsConfig['nav']
}

function generatePageHtml(props: PageProps): string {
  // Simple markdown to HTML conversion (basic implementation)
  const htmlContent = simpleMarkdownToHtml(props.page.content)

  const content = `
    <div class="breadcrumb">
      <a href="${props.basePath}">Docs</a> / ${props.page.title}
    </div>
    <div class="card">
      <h2 style="margin-bottom: 16px;">${props.page.title}</h2>
      <div class="markdown-content">
        ${htmlContent}
      </div>
    </div>
  `

  return baseTemplate(props.page.title, content, 'page', {
    theme: props.theme,
    basePath: props.basePath,
    siteTitle: props.title,
    nav: props.nav,
  })
}

interface AgentsListProps {
  builtInAgents: AgentMetadata[]
  customAgents: AgentMetadata[]
  theme: DocsConfig['theme']
  basePath: string
  title: string
  nav?: DocsConfig['nav']
}

function generateAgentsListHtml(props: AgentsListProps): string {
  const renderAgentCard = (agent: AgentMetadata) => `
    <a href="${props.basePath}/agents/${agent.name}" class="card" style="text-decoration: none; color: inherit;">
      <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
        <h3>${agent.name}</h3>
        <span class="badge ${agent.builtIn ? 'badge-blue' : 'badge-green'}">${agent.builtIn ? 'built-in' : 'custom'}</span>
      </div>
      <p style="margin-bottom: 8px;">${agent.description || 'No description'}</p>
      <code>${agent.operation}</code>
    </a>
  `

  const content = `
    ${
      props.builtInAgents.length > 0
        ? `
    <div class="section">
      <h2 class="section-title">Built-in Agents (${props.builtInAgents.length})</h2>
      <div class="grid">
        ${props.builtInAgents.map(renderAgentCard).join('')}
      </div>
    </div>
    `
        : ''
    }

    ${
      props.customAgents.length > 0
        ? `
    <div class="section">
      <h2 class="section-title">Custom Agents (${props.customAgents.length})</h2>
      <div class="grid">
        ${props.customAgents.map(renderAgentCard).join('')}
      </div>
    </div>
    `
        : ''
    }

    ${
      props.builtInAgents.length === 0 && props.customAgents.length === 0
        ? `
    <div class="empty">
      <p>No agents found. Create agents in the <code>agents/</code> directory.</p>
    </div>
    `
        : ''
    }
  `

  return baseTemplate('Agents', content, 'agents', {
    theme: props.theme,
    basePath: props.basePath,
    siteTitle: props.title,
    nav: props.nav,
  })
}

interface AgentDetailProps {
  agent: AgentMetadata
  theme: DocsConfig['theme']
  basePath: string
  title: string
  nav?: DocsConfig['nav']
}

function generateAgentDetailHtml(props: AgentDetailProps): string {
  const { agent } = props

  const renderSchema = (schema: Record<string, unknown> | undefined, title: string) => {
    if (!schema || Object.keys(schema).length === 0) return ''
    return `
      <div class="section">
        <h3 class="section-title">${title}</h3>
        <pre><code>${JSON.stringify(schema, null, 2)}</code></pre>
      </div>
    `
  }

  const content = `
    <div class="breadcrumb">
      <a href="${props.basePath}">Docs</a> / <a href="${props.basePath}/agents">Agents</a> / ${agent.name}
    </div>

    <div class="card" style="margin-bottom: 24px;">
      <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 16px;">
        <h2 style="font-size: 1.75rem;">${agent.name}</h2>
        <span class="badge ${agent.builtIn ? 'badge-blue' : 'badge-green'}">${agent.builtIn ? 'built-in' : 'custom'}</span>
      </div>
      <p style="font-size: 1.1rem; color: #475569; margin-bottom: 16px;">${agent.description || 'No description'}</p>
      <div>
        <span class="badge badge-purple">${agent.operation}</span>
      </div>
    </div>

    ${renderSchema(agent.inputSchema, 'Input Schema')}
    ${renderSchema(agent.outputSchema, 'Output Schema')}
    ${renderSchema(agent.configSchema, 'Configuration Schema')}
    ${agent.config ? renderSchema(agent.config, 'Default Configuration') : ''}

    ${
      agent.examples && agent.examples.length > 0
        ? `
    <div class="section">
      <h3 class="section-title">Examples</h3>
      <pre><code>${JSON.stringify(agent.examples, null, 2)}</code></pre>
    </div>
    `
        : ''
    }

    <div class="section">
      <h3 class="section-title">Usage in Ensemble</h3>
      <pre><code># In an ensemble YAML file
flow:
  - agent: ${agent.name}
    input:
      # Your input here</code></pre>
    </div>

    <div class="section">
      <h3 class="section-title">Execute via API</h3>
      <pre><code>curl -X POST http://localhost:8787/api/v1/execute/agent/${agent.name} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -d '{"input": {}}'</code></pre>
    </div>
  `

  return baseTemplate(agent.name, content, 'agents', {
    theme: props.theme,
    basePath: props.basePath,
    siteTitle: props.title,
    nav: props.nav,
  })
}

interface EnsemblesListProps {
  ensembles: EnsembleMetadata[]
  theme: DocsConfig['theme']
  basePath: string
  title: string
  nav?: DocsConfig['nav']
}

function generateEnsemblesListHtml(props: EnsemblesListProps): string {
  const renderEnsembleCard = (ensemble: EnsembleMetadata) => `
    <a href="${props.basePath}/ensembles/${ensemble.name}" class="card" style="text-decoration: none; color: inherit;">
      <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
        <h3>${ensemble.name}</h3>
        <span class="badge badge-gray">${ensemble.source}</span>
      </div>
      <p style="margin-bottom: 12px;">${ensemble.description || 'No description'}</p>
      <div style="display: flex; gap: 16px; font-size: 0.875rem; color: #64748b;">
        <span>${ensemble.steps.length} steps</span>
        <span>${ensemble.triggers.length} triggers</span>
      </div>
    </a>
  `

  const content = `
    <div class="section">
      <h2 class="section-title">All Ensembles (${props.ensembles.length})</h2>
      ${
        props.ensembles.length > 0
          ? `
      <div class="grid">
        ${props.ensembles.map(renderEnsembleCard).join('')}
      </div>
      `
          : `
      <div class="empty">
        <p>No ensembles found. Create ensembles in the <code>ensembles/</code> directory.</p>
      </div>
      `
      }
    </div>
  `

  return baseTemplate('Ensembles', content, 'ensembles', {
    theme: props.theme,
    basePath: props.basePath,
    siteTitle: props.title,
    nav: props.nav,
  })
}

interface EnsembleDetailProps {
  ensemble: EnsembleMetadata
  theme: DocsConfig['theme']
  basePath: string
  title: string
  nav?: DocsConfig['nav']
}

function generateEnsembleDetailHtml(props: EnsembleDetailProps): string {
  const { ensemble } = props

  const content = `
    <div class="breadcrumb">
      <a href="${props.basePath}">Docs</a> / <a href="${props.basePath}/ensembles">Ensembles</a> / ${ensemble.name}
    </div>

    <div class="card" style="margin-bottom: 24px;">
      <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 16px;">
        <h2 style="font-size: 1.75rem;">${ensemble.name}</h2>
        <span class="badge badge-gray">${ensemble.source}</span>
      </div>
      <p style="font-size: 1.1rem; color: #475569;">${ensemble.description || 'No description'}</p>
    </div>

    ${
      ensemble.triggers.length > 0
        ? `
    <div class="section">
      <h3 class="section-title">Triggers (${ensemble.triggers.length})</h3>
      <div class="card">
        <table class="table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Path / Schedule</th>
              <th>Methods</th>
            </tr>
          </thead>
          <tbody>
            ${ensemble.triggers
              .map(
                (t) => `
              <tr>
                <td><span class="badge badge-purple">${t.type}</span></td>
                <td><code>${t.path || t.cron || '-'}</code></td>
                <td>${t.methods?.join(', ') || '-'}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      </div>
    </div>
    `
        : ''
    }

    ${
      ensemble.steps.length > 0
        ? `
    <div class="section">
      <h3 class="section-title">Flow Steps (${ensemble.steps.length})</h3>
      <div class="card">
        <table class="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Type</th>
              <th>Agent</th>
              <th>Condition</th>
            </tr>
          </thead>
          <tbody>
            ${ensemble.steps
              .map(
                (s) => `
              <tr>
                <td>${s.index + 1}</td>
                <td><code>${s.type}</code></td>
                <td>${s.agent ? `<a href="${props.basePath}/agents/${s.agent}">${s.agent}</a>` : '-'}</td>
                <td>${s.condition ? `<code>${s.condition}</code>` : '-'}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      </div>
    </div>
    `
        : ''
    }

    <div class="section">
      <h3 class="section-title">Execute via API</h3>
      <pre><code>curl -X POST http://localhost:8787/api/v1/execute/ensemble/${ensemble.name} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -d '{"input": {}}'</code></pre>
    </div>
  `

  return baseTemplate(ensemble.name, content, 'ensembles', {
    theme: props.theme,
    basePath: props.basePath,
    siteTitle: props.title,
    nav: props.nav,
  })
}

interface OpenAPIUIProps {
  title: string
  specUrl: string
  ui: DocsConfig['ui']
  theme: DocsConfig['theme']
  siteTitle: string
}

function generateOpenAPIUIHtml(props: OpenAPIUIProps): string {
  const { ui, theme, specUrl, title, siteTitle } = props
  const primaryColor = theme.primaryColor || '#3b82f6'

  const baseStyles = `
    body { margin: 0; }
    .back-link {
      position: fixed;
      top: 16px;
      left: 16px;
      z-index: 1000;
      background: white;
      padding: 8px 16px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      color: ${primaryColor};
      text-decoration: none;
    }
    .back-link:hover { background: #f1f5f9; }
    ${theme.customCss || ''}
  `

  const backLink = '<a href="/docs" class="back-link">&larr; Back to Docs</a>'

  switch (ui) {
    case 'redoc':
      return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | ${siteTitle}</title>
  <style>${baseStyles}</style>
</head>
<body>
  ${backLink}
  <redoc spec-url="${specUrl}"></redoc>
  <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
</body>
</html>`

    case 'swagger':
      return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | ${siteTitle}</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@latest/swagger-ui.css">
  <style>${baseStyles}</style>
</head>
<body>
  ${backLink}
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@latest/swagger-ui-bundle.js"></script>
  <script>
    window.onload = () => {
      SwaggerUIBundle({
        url: '${specUrl}',
        dom_id: '#swagger-ui',
      });
    };
  </script>
</body>
</html>`

    case 'scalar':
      return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | ${siteTitle}</title>
  <style>${baseStyles}</style>
</head>
<body>
  ${backLink}
  <script
    id="api-reference"
    data-url="${specUrl}"
    ${theme.darkMode ? 'data-theme="dark"' : ''}
  ></script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>`

    case 'rapidoc':
      return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | ${siteTitle}</title>
  <script type="module" src="https://unpkg.com/rapidoc/dist/rapidoc-min.js"></script>
  <style>${baseStyles}</style>
</head>
<body>
  ${backLink}
  <rapi-doc
    spec-url="${specUrl}"
    render-style="read"
    ${theme.darkMode ? 'theme="dark"' : ''}
    primary-color="${primaryColor}"
  ></rapi-doc>
</body>
</html>`

    case 'stoplight':
    default:
      return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | ${siteTitle}</title>
  <script src="https://unpkg.com/@stoplight/elements/web-components.min.js"></script>
  <link rel="stylesheet" href="https://unpkg.com/@stoplight/elements/styles.min.css">
  <style>${baseStyles}</style>
</head>
<body>
  ${backLink}
  <elements-api
    apiDescriptionUrl="${specUrl}"
    router="hash"
    layout="sidebar"
  />
</body>
</html>`
  }
}

// ============================================================================
// OpenAPI Generation
// ============================================================================

interface OpenAPIBuildProps {
  title: string
  description?: string
  agents: any[]
  ensembles: any[]
}

function buildOpenAPISpec(props: OpenAPIBuildProps): Record<string, unknown> {
  const paths: Record<string, unknown> = {}

  // Track unique folders for tag generation
  const agentFolders = new Set<string>()
  const ensembleFolders = new Set<string>()

  // Helper to extract folder from name (e.g., "system/docs" -> "system")
  const getFolder = (name: string): string | null => {
    const parts = name.split('/')
    return parts.length > 1 ? parts[0] : null
  }

  // Helper to get tag for an item based on folder structure
  const getTag = (name: string, type: 'agent' | 'ensemble'): string => {
    const folder = getFolder(name)
    if (folder) {
      return `${type === 'agent' ? 'Agents' : 'Ensembles'}/${folder}`
    }
    return type === 'agent' ? 'Agents' : 'Ensembles'
  }

  // Add execute endpoints for ensembles
  for (const ensemble of props.ensembles) {
    const folder = getFolder(ensemble.name)
    if (folder) ensembleFolders.add(folder)

    const tag = getTag(ensemble.name, 'ensemble')

    paths[`/api/v1/execute/ensemble/${ensemble.name}`] = {
      post: {
        summary: `Execute ${ensemble.name}`,
        description: ensemble.description || `Execute the ${ensemble.name} ensemble`,
        operationId: `execute_ensemble_${ensemble.name.replace(/[/-]/g, '_')}`,
        tags: [tag],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  input: { type: 'object', description: 'Input data for the ensemble' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Successful execution' },
          '400': { description: 'Invalid input' },
          '401': { description: 'Unauthorized' },
          '500': { description: 'Execution error' },
        },
      },
    }
  }

  // Add execute endpoints for agents
  for (const agent of props.agents) {
    const folder = getFolder(agent.name)
    if (folder) agentFolders.add(folder)

    const tag = getTag(agent.name, 'agent')

    paths[`/api/v1/execute/agent/${agent.name}`] = {
      post: {
        summary: `Execute ${agent.name} agent`,
        description: agent.description || `Execute the ${agent.name} agent`,
        operationId: `execute_agent_${agent.name.replace(/[/-]/g, '_')}`,
        tags: [tag],
        security: [{ bearerAuth: [] }, { apiKey: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['input'],
                properties: {
                  input: { type: 'object', description: 'Input data for the agent' },
                  config: { type: 'object', description: 'Optional configuration overrides' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Successful execution' },
          '400': { description: 'Invalid input' },
          '401': { description: 'Unauthorized' },
          '500': { description: 'Execution error' },
        },
      },
    }
  }

  // Add metadata endpoints
  paths['/api/v1/agents'] = {
    get: {
      summary: 'List all agents',
      operationId: 'listAgents',
      tags: ['Discovery'],
      responses: { '200': { description: 'List of agents' } },
    },
  }

  paths['/api/v1/ensembles'] = {
    get: {
      summary: 'List all ensembles',
      operationId: 'listEnsembles',
      tags: ['Discovery'],
      responses: { '200': { description: 'List of ensembles' } },
    },
  }

  // Build tags with folder-based organization
  const tags: Array<{ name: string; description: string }> = [
    { name: 'Discovery', description: 'Agent and ensemble discovery endpoints' },
  ]

  // Add agent folder tags
  if (agentFolders.size > 0) {
    for (const folder of Array.from(agentFolders).sort()) {
      tags.push({ name: `Agents/${folder}`, description: `Agents in ${folder}/` })
    }
  }
  // Add base Agents tag for agents without folders
  const hasRootAgents = props.agents.some(a => !getFolder(a.name))
  if (hasRootAgents) {
    tags.push({ name: 'Agents', description: 'Execute agents' })
  }

  // Add ensemble folder tags
  if (ensembleFolders.size > 0) {
    for (const folder of Array.from(ensembleFolders).sort()) {
      tags.push({ name: `Ensembles/${folder}`, description: `Ensembles in ${folder}/` })
    }
  }
  // Add base Ensembles tag for ensembles without folders
  const hasRootEnsembles = props.ensembles.some(e => !getFolder(e.name))
  if (hasRootEnsembles) {
    tags.push({ name: 'Ensembles', description: 'Execute ensembles' })
  }

  // Build x-tagGroups for Stoplight/Redoc sidebar organization
  const tagGroups: Array<{ name: string; tags: string[] }> = [
    { name: 'Discovery', tags: ['Discovery'] },
  ]

  // Group agent tags
  const agentTags = tags.filter(t => t.name.startsWith('Agents')).map(t => t.name)
  if (agentTags.length > 0) {
    tagGroups.push({ name: 'Agents', tags: agentTags })
  }

  // Group ensemble tags
  const ensembleTags = tags.filter(t => t.name.startsWith('Ensembles')).map(t => t.name)
  if (ensembleTags.length > 0) {
    tagGroups.push({ name: 'Ensembles', tags: ensembleTags })
  }

  return {
    openapi: '3.1.0',
    info: {
      title: props.title,
      version: '1.0.0',
      description: props.description || 'Auto-generated API documentation for your Conductor project.',
    },
    servers: [{ url: '/', description: 'Current server' }],
    tags,
    'x-tagGroups': tagGroups,
    paths,
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        apiKey: { type: 'apiKey', in: 'header', name: 'X-API-Key' },
      },
    },
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

function simpleMarkdownToHtml(markdown: string): string {
  // Very basic markdown to HTML conversion
  return markdown
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
}

function jsonToYaml(obj: unknown, indent = 0): string {
  // Very basic JSON to YAML conversion
  const spaces = '  '.repeat(indent)

  if (obj === null || obj === undefined) return 'null'
  if (typeof obj === 'string') return obj.includes('\n') ? `|\n${spaces}  ${obj.replace(/\n/g, `\n${spaces}  `)}` : obj
  if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj)
  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]'
    return obj.map((item) => `${spaces}- ${jsonToYaml(item, indent + 1).trimStart()}`).join('\n')
  }
  if (typeof obj === 'object') {
    const entries = Object.entries(obj as Record<string, unknown>)
    if (entries.length === 0) return '{}'
    return entries.map(([key, value]) => {
      const yamlValue = jsonToYaml(value, indent + 1)
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        return `${spaces}${key}:\n${yamlValue}`
      }
      if (Array.isArray(value) && value.length > 0) {
        return `${spaces}${key}:\n${yamlValue}`
      }
      return `${spaces}${key}: ${yamlValue}`
    }).join('\n')
  }
  return String(obj)
}

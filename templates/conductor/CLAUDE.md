# Conductor Project Context

This document provides context for AI assistants (Claude, Copilot, etc.) working on this Conductor project.

---

# 🎯 IMPORTANT: Building Agents or Ensembles

**When building, creating, or modifying an agent or ensemble, read the Machine Context section below.**

---

## Project Overview

This is a Conductor orchestration system built on Cloudflare Workers. Conductor enables you to build AI-powered workflows by composing reusable "agents" (AI agents, functions, APIs) into "ensembles" (workflows).

## Project Structure

```
.
├── src/
│   ├── index.ts              # Worker entry point (fetch/scheduled handlers)
│   └── lib/                  # Shared utilities
├── agents/                   # Reusable workflow components
│   ├── examples/             # Example agents (hello)
│   ├── system/               # Built-in agents (redirect, docs)
│   ├── debug/                # Debug agents (delay, echo)
│   └── user/                 # User-created agents
├── ensembles/                # Workflow definitions
│   ├── examples/             # Example ensembles (hello-world)
│   ├── system/               # Built-in ensembles (docs)
│   ├── debug/                # Debug ensembles
│   └── user/                 # User-created ensembles
├── prompts/                  # AI prompt templates
├── configs/                  # Agent configurations
├── schemas/                  # JSON schemas for validation
├── queries/                  # SQL templates for D1
├── scripts/                  # Standalone TypeScript scripts
├── tests/                    # Test files
├── wrangler.toml             # Cloudflare Workers config
└── types.d.ts                # Global TypeScript declarations
```

## Key Concepts

### Agents
Individual components that do one thing well:
- **Think**: AI-powered reasoning (uses prompts from `prompts/`)
- **Code**: Custom JavaScript/TypeScript logic (handler: ./file.ts)
- **HTTP**: HTTP requests to external services
- **Storage**: KV/R2 operations
- **Data**: D1/Vectorize operations
- **Built-in**: Scraping, RAG, validation, HITL, etc.

### Ensembles
Workflows that compose agents together:
- Define execution flow in YAML
- Support sequential and parallel execution
- Handle state management
- Enable conditional logic
- Triggered by HTTP, webhooks, cron, CLI, or build

## Common Tasks

### Adding a New Agent

1. Create directory: `agents/user/my-agent/`
2. Create config: `agents/user/my-agent/agent.yaml`
   ```yaml
   name: my-agent
   operation: code
   handler: ./my-handler.ts
   description: What this agent does

   schema:
     input:
       query: string
     output:
       result: string
   ```
3. Add handler: `agents/user/my-agent/my-handler.ts`
   ```typescript
   import type { AgentExecutionContext } from '@ensemble-edge/conductor'

   export default async function handler(ctx: AgentExecutionContext) {
     const { query } = ctx.input
     return { result: `Processed: ${query}` }
   }
   ```

### Creating an Ensemble

1. Create YAML: `ensembles/user/my-workflow.yaml`
   ```yaml
   name: my-workflow
   description: What this workflow does

   trigger:
     - type: http
       path: /api/my-workflow
       methods: [POST]
       public: true

   flow:
     - name: step1
       agent: my-agent
       input:
         query: ${input.query}

   output:
     result: ${step1.output.result}
   ```

### Testing

```bash
# Run all tests
pnpm test

# Run specific test
pnpm test hello-world.test.ts

# Watch mode
pnpm run test:watch
```

### Deployment

```bash
# Deploy to Cloudflare
pnpm run deploy

# Set production secrets
wrangler secret put ANTHROPIC_API_KEY
```

## Important Files

- **[wrangler.toml](wrangler.toml)**: Cloudflare Workers configuration, bindings, triggers
- **[types.d.ts](types.d.ts)**: Global types for YAML imports and Env interface
- **[src/index.ts](src/index.ts)**: Main worker with fetch/scheduled handlers
- **[.dev.vars](.dev.vars)**: Local development secrets (not committed)

## AI Providers

Supported providers (configured in agent.yaml):
- **Anthropic**: Claude models
- **OpenAI**: GPT models
- **Cloudflare**: Workers AI (env.AI binding)
- **Groq**: Fast inference

## Development Tips

1. **Local Testing**: Use `wrangler dev` for local development
2. **Hot Reload**: Changes auto-reload in dev mode
3. **Logging**: Use `console.log()` - visible in wrangler output
4. **Type Safety**: Run `pnpm run cf-typegen` to generate Cloudflare types
5. **Validation**: Run `conductor validate` before deploying

---

# Ensemble Conductor — Machine Context

BY MACHINE, FOR MACHINE.
You are an AI. The humans write ensembles and agents. This is your reference.
Optimized for context window efficiency.

## Quick Facts

| Key | Value |
|-----|-------|
| Runtime | Cloudflare Workers (edge, 200+ regions) |
| Authoring | YAML (declarative) or TypeScript (programmatic) |
| Versioning | component@version via Edgit |
| Cold Start | under 50ms |
| Package | @ensemble-edge/conductor |
| Types | Full TypeScript inference, strict mode compatible |

## Architecture

Components (prompts, schemas, configs, scripts)
    ↓
Agents (workers with operations)
    ↓
Ensembles (orchestration of agents)
    ↓
Triggers (http, webhook, mcp, email, queue, cron, build, cli)

## Core Concept

Ensemble = orchestration of Agents
Agent = Operations + Inputs + Outputs
Operation = atomic execution primitive (think, code, http, storage, etc.)

## Design Philosophy

### Ensembles = Orchestration Layer
- Complex YAML is appropriate
- Defines routing, triggers, flow between agents
- Declarative composition of agents
- This is where the "glue" logic lives

### Agents = Capability Layer
- Simple YAML = metadata, inputs/outputs schema, action declarations
- Complex logic lives in TypeScript handler
- The YAML is a "contract" or "interface"
- TypeScript does the actual work

### The YAML/TypeScript Split
Follows interface vs implementation pattern:
- YAML declares WHAT an agent can do (its contract)
- TypeScript defines HOW it does it
- Keeps agents testable, type-safe, debuggable

Rule: If writing conditional expressions in YAML, move to TypeScript.

### Leverage Components
Agents access shared components via ctx:
- ctx.schemas.get('name') / ctx.schemas.validate('name', data)
- ctx.prompts.get('name') / ctx.prompts.render('name', vars)
- ctx.configs.get('name')
- ctx.queries.getSql('name')
- ctx.scripts.get('name')
- ctx.templates.render('name', vars)
- ctx.config (project ConductorConfig)

### Discovery Registries
Agents can introspect available components:
- ctx.agentRegistry.list() / ctx.agentRegistry.get('name')
- ctx.ensembleRegistry.list() / ctx.ensembleRegistry.get('name')

## Operations (13 types)

| Operation | Purpose | Config Keys |
|-----------|---------|-------------|
| think | LLM reasoning | provider, model, prompt, schema, temperature |
| code | JS/TS execution | handler: ./file.ts OR script: scripts/path |
| storage | KV/R2 access | type: kv|r2, action: get|put|delete, key |
| data | D1/Hyperdrive/Vectorize | backend: d1|hyperdrive|vectorize, binding, query|operation |
| http | HTTP requests | url, method, headers, body |
| tools | MCP tools | tool, params |
| email | Send email | to, from, subject, body |
| sms | Send SMS | to, from, body |
| html | Render HTML | template, data |
| pdf | Generate PDF | html, filename, format |
| form | Generate forms | fields, csrf |
| queue | Queue messages | action: send|consume, queue, body |
| docs | API docs | OpenAPI generation |

## Triggers (8 types)

| Trigger | Config | Use Case |
|---------|--------|----------|
| http | path, paths[], methods, auth, rateLimit, cors, public | Web apps, APIs with path params |
| webhook | path, methods, auth, async, public | External integrations |
| mcp | auth, public | AI tool exposure |
| email | addresses, reply_with_output | Email routing |
| queue | queue, batch_size, max_retries | Message processing |
| cron | cron, timezone, enabled | Scheduled execution |
| build | output, enabled, input, metadata | Static generation at build time |
| cli | command, description, options[] | Developer commands |

### Build Trigger
```yaml
trigger:
  - type: build
    enabled: true
    output: ./dist/docs
flow:
  - agent: docs
    input: { action: generate-openapi }
```

### CLI Trigger
```yaml
trigger:
  - type: cli
    command: generate-docs
    description: Generate documentation
    options:
      - name: format
        type: string
        default: yaml
flow:
  - agent: docs
    input: { format: ${trigger.options.format} }
```

### Multi-Path HTTP Trigger
```yaml
trigger:
  - type: http
    paths:
      - path: /api/v1/users
        methods: [GET, POST]
      - path: /api/v1/users/:id
        methods: [GET, PUT, DELETE]
    public: true
```

## Components (7 types)

| Type | Extension | Reference Syntax | ctx Method |
|------|-----------|------------------|------------|
| schemas | .json | schemas/name@v1.0.0 | ctx.schemas.validate() |
| prompts | .md | prompts/name@latest | ctx.prompts.render() |
| configs | .json, .yaml | configs/name@production | ctx.configs.get() |
| queries | .sql | queries/name@v2 | ctx.queries.getSql() |
| scripts | .ts, .js | scripts/name@v1 | ctx.scripts.get() |
| templates | .html | templates/name@v1 | ctx.templates.render() |
| docs | .md | docs/name@v1 | - |

## Expression Syntax

### Variable Access
```yaml
${input.field}                    # Ensemble/agent input
${agent-name.output}              # Agent output
${agent-name.output.nested.field} # Nested access
${state.field}                    # State variable
${env.VARIABLE}                   # Environment variable
${trigger.options.format}         # CLI trigger options
```

### Execution Status
```yaml
${agent.executed}                 # Boolean: ran
${agent.failed}                   # Boolean: errored
${agent.success}                  # Boolean: succeeded
${agent.cached}                   # Boolean: from cache
${agent.duration}                 # Number: ms
```

### Conditions
```yaml
condition: ${input.value > 10}
condition: ${agent.failed}
condition: ${!agent.executed}
condition: ${input.type === 'premium'}
condition: ${input.age >= 18 && input.verified}
```

## YAML Agent Schema

```yaml
name: my-agent
operation: code
handler: ./my-handler.ts          # TypeScript implementation
description: What this agent does

schema:
  input:
    field: type
  output:
    field: type
```

## YAML Ensemble Schema

```yaml
name: string                       # Required (filename-derived)
description: string                # Optional
trigger:                           # Optional
  - type: http|webhook|mcp|email|queue|cron|build|cli
state:                             # Optional
  schema:
    field: type
flow:                              # Required
  - name: string
    agent: string                  # OR operation
    operation: string              # OR agent
    input: { key: value }
    config: { key: value }
    condition: string
    cache: { ttl: number, key: string }
    retry: { maxAttempts: number, backoff: exponential|linear }
    timeout: number
output:                            # Optional - supports conditional blocks
  key: value
```

## Conditional Output Blocks

```yaml
output:
  # Success case
  - when: ${agent.output.found}
    status: 200
    body: { data: ${agent.output.data} }

  # Not found
  - when: ${agent.output.error === 'not_found'}
    status: 404
    body: { error: 'not_found' }

  # Redirect
  - when: ${shouldRedirect}
    redirect:
      url: ${targetUrl}
      status: 302

  # Custom headers + raw body
  - when: ${format === 'yaml'}
    status: 200
    headers:
      Content-Type: text/yaml
    rawBody: ${yamlContent}

  # Default fallback (no when = always matches)
  - status: 500
    body: { error: 'unknown' }
```

## Common Patterns

### Linear Pipeline
```yaml
flow:
  - name: fetch
    operation: http
    config: { url: "${input.url}" }
  - name: process
    operation: code
    config: { script: scripts/process }
    input: { data: ${fetch.output} }
```

### Cache-or-Generate
```yaml
flow:
  - name: check-cache
    operation: storage
    config: { type: kv, action: get, key: "result-${input.query}" }
  - name: generate
    condition: ${check-cache.output.value === null}
    operation: think
    config: { provider: openai, model: gpt-4o, prompt: "${input.query}" }
```

### Fallback Chain
```yaml
flow:
  - name: try-primary
    operation: http
    config: { url: "https://primary-api.com" }
    retry: { maxAttempts: 2 }
  - name: try-backup
    condition: ${try-primary.failed}
    operation: http
    config: { url: "https://backup-api.com" }
```

## CLI Quick Reference

```bash
ensemble conductor init [name]    # Create project (use --yes for CI)
ensemble conductor validate       # Validate YAML/TS

# Project commands (pnpm/npm)
pnpm run dev                      # Local dev server
pnpm run build                    # Build project
pnpm test                         # Run tests
npx wrangler deploy               # Deploy to CF Workers
```

## Common Mistakes

| Don't | Do |
|-------|-----|
| Inline JS in YAML | Use handler: ./file.ts or script: scripts/path |
| Hardcode secrets | Use ${env.SECRET} |
| Skip error handling | Use condition: ${x.failed} for fallbacks |
| Create mega-ensembles | Compose via agents |
| Forget cache | Add cache: { ttl: 3600 } to expensive ops |
| HTTP trigger without auth | Add public: true or auth config |

## Provider Models (think operation)

| Provider | Models |
|----------|--------|
| openai | gpt-4o, gpt-4o-mini, text-embedding-3-small |
| anthropic | claude-3-5-sonnet-20241022, claude-sonnet-4 |
| cloudflare | @cf/meta/llama-3-8b-instruct |
| groq | llama3-70b-8192, mixtral-8x7b-32768 |

---

*Machine context ends. The humans thank you for building their ensembles.*

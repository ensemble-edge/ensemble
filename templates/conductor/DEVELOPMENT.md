# Development Guide

This guide covers local development workflows, troubleshooting, and best practices for working with Conductor.

## Production Builds (CI/CD)

For automated deployments:

```bash
# CI/CD pipeline - just build and deploy
pnpm run build   # Vite plugins scan directories and generate everything
pnpm run deploy  # Deploys to Cloudflare Workers
```

**The Vite plugins automatically:**
- Scan `agents/` directory for agent YAML files
- Scan `ensembles/` directory for ensemble YAML files
- Scan `docs/` directory for markdown documentation
- Generate virtual modules with all discovered content
- Work perfectly in automated builds

**No manual intervention needed** - the plugins are designed for zero-config CI/CD deployment.

## Local Development

### Starting the Development Server

```bash
pnpm run dev
```

This starts the Vite development server with hot module replacement (HMR).

### How Auto-Discovery Works

Conductor uses Vite plugins for build-time auto-discovery:

1. **Agent Discovery** (`vite-plugin-agent-discovery.ts`): Scans `agents/` for `agent.yaml` files
2. **Ensemble Discovery** (`vite-plugin-ensemble-discovery.ts`): Scans `ensembles/` for `ensemble.yaml` files
3. **Docs Discovery** (`vite-plugin-docs-discovery.ts`): Scans `docs/` for markdown files

Each plugin:
- Creates virtual modules (`virtual:conductor-agents`, etc.)
- Generates import statements for handlers
- Supports HMR for instant feedback during development

### Adding New Agents

Create a new agent in `agents/your-agent/`:

```yaml
# agents/your-agent/agent.yaml
name: your-agent
operation: code
handler: ./index.ts
description: What your agent does

schema:
  input:
    param: string
  output:
    result: string
```

```typescript
// agents/your-agent/index.ts
import type { AgentExecutionContext } from '@ensemble-edge/conductor'

export default async function handler(ctx: AgentExecutionContext) {
  const { param } = ctx.input
  return {
    result: `Processed: ${param}`
  }
}
```

### Adding New Ensembles

Create a new ensemble in `ensembles/your-ensemble/`:

```yaml
# ensembles/your-ensemble/ensemble.yaml
name: your-ensemble
description: What your ensemble does

trigger:
  - type: http
    path: /your-endpoint
    methods: [GET, POST]

agents:
  - name: processor
    operation: code
    handler: ./handler.ts

flow:
  - agent: processor
    input:
      data: ${input.data}

output:
  result: ${processor.output.result}
```

## Troubleshooting

### Browser Compatibility Warnings During Build

**Symptom:** You see many warnings like `"Module X externalized for browser compatibility"` during `pnpm run build`.

**This is expected behavior!** These warnings appear because:
- Cloudflare Workers runtime handles Node.js modules differently than browsers
- Vite externalizes these modules to prevent bundling issues
- The warnings don't indicate any problems with your code

### New Agent/Ensemble Not Appearing

**Symptom:** You created a new agent or ensemble but it's not showing up.

**Solutions:**
1. Ensure the YAML file is named correctly (`agent.yaml` or `ensemble.yaml`)
2. Check for syntax errors in the YAML
3. Restart the dev server if HMR doesn't pick up new directories
4. Look for errors in the console output

### Handler Import Errors

**Symptom:** Build fails with "failed to resolve import" error for handler files.

**Solutions:**
1. Ensure handler file exists at the path specified in YAML
2. Verify the handler exports a default function
3. Check for TypeScript errors in the handler file

## References

- [Vite Plugin API - handleHotUpdate](https://vitejs.dev/guide/api-plugin.html#handlehotupdate)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)

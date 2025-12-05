# Scripts

This folder contains **reusable TypeScript scripts** that can be referenced in ensembles using the `script://` or `scripts/` URI format.

## Why Scripts?

Cloudflare Workers block `new Function()` and `eval()` for security. Scripts solve this by:
- **Build-time bundling**: Scripts are discovered and bundled during `npm run build`
- **Static imports**: No dynamic code evaluation at runtime
- **Type safety**: Full TypeScript support with `AgentExecutionContext`

## Usage

### 1. Create a Script File

```typescript
// scripts/my-script.ts
import type { AgentExecutionContext } from '@ensemble-edge/conductor'

export default async function myScript(context: AgentExecutionContext) {
  const { input, env, logger } = context

  // Your logic here
  return { result: 'success' }
}
```

### 2. Reference in Ensemble YAML

```yaml
agents:
  - name: my-agent
    operation: code
    config:
      script: scripts/my-script  # Shorthand format
      # or: script://my-script   # Full URI format
```

### 3. Build & Deploy

```bash
npm run build    # Scripts are bundled automatically
npm run deploy   # Deploy to Cloudflare
```

## URI Formats

Both formats are supported (consistent with other components like prompts, queries):

| Format | Example |
|--------|---------|
| Shorthand | `scripts/transforms/csv` |
| Full URI | `script://transforms/csv` |
| With version | `scripts/transforms/csv@v1.0.0` |

## Directory Structure

```
scripts/
├── README.md           # This file
├── examples/           # Example scripts (excluded with --no-examples)
│   ├── http/           # HTTP request handlers
│   ├── auth/           # Authentication scripts
│   └── data/           # Data processing scripts
└── your-scripts/       # Your custom scripts
```

## Script Context

Scripts receive the full `AgentExecutionContext`:

```typescript
interface AgentExecutionContext {
  input: unknown           // Input from the flow
  env: ConductorEnv       // Environment bindings (KV, DB, etc.)
  logger?: Logger         // Structured logging
  request?: Request       // HTTP request (if triggered via HTTP)
  cache?: Cache           // Caching utilities
  // ... and more
}
```

## Examples

See the `examples/` folder for complete working scripts:
- `examples/health-check.ts` - System health monitoring
- `examples/http/greet-user.ts` - Simple HTTP handler
- `examples/auth/authenticate.ts` - Login with sessions
- `examples/data/export-data.ts` - Data export utilities

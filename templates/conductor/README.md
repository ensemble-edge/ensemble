# Conductor Starter Project

This is an example project showing how to use `@ensemble-edge/conductor` to build AI orchestration workflows on Cloudflare Workers.

## Project Structure

```
my-conductor-project/
├── src/
│   └── index.ts           # Worker entry point
├── agents/                # AI agents
│   ├── examples/          # Example agents (shipped with template)
│   ├── system/            # Built-in system agents
│   ├── debug/             # Debug agents
│   └── user/              # Your custom agents
├── ensembles/             # Workflow definitions
│   ├── examples/
│   ├── system/
│   ├── debug/
│   └── user/
├── templates/             # HTML/Email/PDF templates
├── wrangler.toml
├── package.json
└── tsconfig.json
```

## Getting Started

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Set up local secrets (optional):**
   ```bash
   cp .dev.vars.example .dev.vars
   ```
   Edit `.dev.vars` to add your API keys (Anthropic, OpenAI, etc.)

   **Note:** This step is only needed if your agents require external API keys.

3. **Run tests:**
   ```bash
   pnpm test
   ```
   Verify all tests pass to ensure your environment is correctly configured.

4. **Authenticate with Cloudflare:**
   ```bash
   npx wrangler login
   ```
   This opens your browser for OAuth login. Required for:
   - Cloudflare Workers AI (powers Think agents)
   - Local development with AI bindings
   - Deploying to production

   The free tier includes generous Workers AI access.

4. **Run locally:**
   ```bash
   pnpm run dev
   ```
   Starts local development server at `http://localhost:8787`

   **Note:** Always use `pnpm run dev` instead of `wrangler dev` directly for the best development experience with hot reload support.

5. **Test the hello-world ensemble:**
   ```bash
   curl -X POST http://localhost:8787/ensemble/hello-world \
     -H "Content-Type: application/json" \
     -d '{"name": "World", "style": "enthusiastic"}'
   ```

   Or test the health endpoint:
   ```bash
   curl http://localhost:8787/health
   ```

6. **Deploy to Cloudflare:**
   ```bash
   pnpm run deploy
   ```

## Advanced Configuration (Optional)

The generated `wrangler.toml` includes placeholder bindings for additional Cloudflare services:
- **KV Namespaces** - Fast key-value storage
- **D1 Databases** - Serverless SQL databases
- **Vectorize** - Vector database for RAG workflows
- **Hyperdrive** - Connection pooling for external databases

These are **NOT required** for the basic hello-world example. You only need to configure them when your agents or ensembles require:
- Persistent storage (KV, D1)
- Semantic search and RAG workflows (Vectorize)
- Connections to external PostgreSQL/MySQL databases (Hyperdrive)

To create these resources:
```bash
# Create KV namespace
npx wrangler kv namespace create CACHE

# Create D1 database
npx wrangler d1 create conductor-db

# Create Vectorize index
npx wrangler vectorize create conductor-embeddings --dimensions=768 --metric=cosine
```

Then update the IDs in `wrangler.toml` with the values returned by these commands.

## Creating New Agents

Create a new agent in `agents/user/your-agent/`:

```yaml
# agents/user/your-agent/agent.yaml
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
// agents/user/your-agent/index.ts
import type { AgentExecutionContext } from '@ensemble-edge/conductor'

export default async function handler(ctx: AgentExecutionContext) {
  const { param } = ctx.input
  return {
    result: `Processed: ${param}`
  }
}
```

## Creating New Ensembles

Create a new ensemble in `ensembles/your-ensemble.yaml`:

```yaml
name: your-ensemble
description: What your ensemble does

flow:
  - agent: your-agent
    input:
      param: ${input.value}

output:
  result: ${your-agent.output.result}
```

## Triggers

Conductor supports multiple trigger types for different use cases:

- **HTTP Triggers**: Web APIs with path parameters and multi-path support
- **Build Triggers**: Static generation at build time (e.g., generating OpenAPI docs)
- **CLI Triggers**: Developer commands for local workflows
- **Webhook, Email, Queue, Cron**: Additional trigger types for advanced use cases

See the [Conductor documentation](https://github.com/ensemble-edge/conductor) for details on configuring triggers.

## Learn More

- [Conductor Documentation](https://github.com/ensemble-edge/conductor)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
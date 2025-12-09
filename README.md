# @ensemble-edge/ensemble

> Unified CLI for the Ensemble ecosystem — edge-native AI orchestration built exclusively for Cloudflare

The `ensemble` CLI provides a single entry point to the entire Ensemble ecosystem: **Conductor** for AI workflow orchestration, **Edgit** for component versioning, **Chamber** for edge data, and **Cloud** for managed platform connectivity.

Built on Cloudflare's infrastructure: Workers, Workers AI, KV, D1, R2, Durable Objects, Queues, and Vectorize.

## Quick Start

```bash
# Launch the interactive wizard (no installation needed)
npx @ensemble-edge/ensemble

# Or create a project directly
npx @ensemble-edge/ensemble conductor init my-project
cd my-project

# Start development server
npm run dev

# Deploy to production
npx wrangler deploy

# Version components with Edgit
npx @ensemble-edge/edgit init
npx @ensemble-edge/edgit tag create prompt v1.0.0
```

For CI/CD pipelines, use the `-y` flag to skip interactive prompts:

```bash
npx @ensemble-edge/conductor init my-project -y
```

## Commands

### Products

| Command | Description |
|---------|-------------|
| `ensemble conductor` | AI workflow orchestration for Cloudflare Workers |
| `ensemble edgit` | Component versioning (prompts, tools, workflows) |
| `ensemble chamber` | Edge data layer (coming soon) |
| `ensemble cloud` | Managed platform connection |

### Options

| Flag | Description |
|------|-------------|
| `-v, --version` | Show version |
| `-h, --help` | Show help |

## Conductor Commands

Conductor orchestrates AI workflows on Cloudflare Workers.

```bash
# Show conductor help
ensemble conductor --help

# Initialize a new project
ensemble conductor init [name]

# Check project status
ensemble conductor status
ensemble conductor status --compact
ensemble conductor status --json

# Initialize with AI provider pre-selected
ensemble conductor init my-project --provider anthropic

# CI/CD mode (skip interactive prompts)
ensemble conductor init my-project --skip-auth --skip-secrets

# Start development server (wrangler passthrough)
ensemble conductor dev

# Deploy to production (wrangler passthrough)
ensemble conductor deploy

# Validate project configuration
ensemble conductor validate

# Manage API keys
ensemble conductor keys
```

### Status Options

| Flag | Description |
|------|-------------|
| `--json` | Output as JSON (for CI/scripting) |
| `--compact` | Compact single-line format |
| `--no-health-check` | Skip worker health ping |

### Init Options

| Flag | Description |
|------|-------------|
| `--skip-auth` | Skip Wrangler authentication check |
| `--skip-secrets` | Skip AI provider setup |
| `--provider <name>` | Pre-select AI provider (anthropic, openai, cloudflare) |
| `--template <name>` | Use a starter template |

## Edgit Commands

Edgit provides semantic versioning for AI components.

```bash
# Show edgit help
ensemble edgit --help

# Initialize edgit in current repo
ensemble edgit init

# Check edgit status
ensemble edgit status
ensemble edgit status --compact
ensemble edgit status --json

# Create version tags
ensemble edgit tag create prompt v1.0.0
ensemble edgit tag list

# Manage tracked components
ensemble edgit components list
ensemble edgit components add prompts/greeting.md

# Set environment tags and push
ensemble edgit tag set prompt prod v1.0.0
ensemble edgit push --tags --force

# View tags and versions
ensemble edgit tag list prompt
```

### Status Options

| Flag | Description |
|------|-------------|
| `--json` | Output as JSON (for CI/scripting) |
| `--compact` | Compact single-line format |

## Cloud Commands

Cloud connects your project to the Ensemble managed platform.

```bash
# Show cloud help
ensemble cloud --help

# Initialize cloud connection
ensemble cloud init
ensemble cloud init --env staging

# Check connection status
ensemble cloud status
ensemble cloud status --compact
ensemble cloud status --json

# Rotate cloud key
ensemble cloud rotate

# Disable cloud connection
ensemble cloud disable
```

### Status Options

| Flag | Description |
|------|-------------|
| `--env <env>` | Target environment (default: production) |
| `--json` | Output as JSON (for CI/scripting) |
| `--compact` | Compact single-line format |

## Chamber Commands

Chamber provides an intelligent edge data layer (coming soon).

```bash
# Show chamber help
ensemble chamber --help

# Initialize Chamber in project
ensemble chamber init

# Check cache status
ensemble chamber status
```

## Wrangler Passthrough

All Wrangler commands work directly through the `ensemble` CLI:

```bash
ensemble dev          # → wrangler dev
ensemble deploy       # → wrangler deploy
ensemble tail         # → wrangler tail
ensemble secret       # → wrangler secret
ensemble kv           # → wrangler kv
ensemble d1           # → wrangler d1
ensemble r2           # → wrangler r2
ensemble queues       # → wrangler queues
```

This means you can use `ensemble` as a drop-in replacement for `wrangler` while gaining access to the full Ensemble ecosystem.

## Architecture

```
ensemble <command> [args]
    │
    ├── conductor  → AI workflow orchestration
    │   ├── init, dev, deploy, validate, keys
    │   └── (dev/deploy passthrough to wrangler)
    │
    ├── edgit      → Component versioning (passthrough to edgit CLI)
    │   └── init, tag, components, deploy, history
    │
    ├── chamber    → Edge data layer (coming soon)
    │
    ├── cloud      → Managed platform
    │   └── init, status, rotate, disable
    │
    ├── wrangler   → Cloudflare Workers CLI (explicit passthrough)
    │
    └── *          → Wrangler passthrough (dev, deploy, tail, etc.)
```

## Documentation

- [Ensemble Docs](https://docs.ensemble.ai)
- [Conductor Docs](https://docs.ensemble.ai/conductor)
- [Edgit Docs](https://docs.ensemble.ai/edgit)
- [Chamber Docs](https://docs.ensemble.ai/chamber)
- [Cloud Docs](https://docs.ensemble.ai/cloud)

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup and guidelines.

## License

Apache-2.0 - see [LICENSE](./LICENSE)

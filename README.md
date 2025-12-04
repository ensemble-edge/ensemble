# @ensemble-edge/ensemble

> Unified CLI for the Ensemble ecosystem - AI orchestration for Cloudflare Workers

## Installation

```bash
npm install -g @ensemble-edge/ensemble
```

## Usage

```bash
# Initialize a new Conductor project
ensemble conductor init my-project

# Start development (wrangler passthrough)
ensemble dev

# Deploy to production (wrangler passthrough)
ensemble deploy

# Version components with Edgit
ensemble edgit init
ensemble edgit tag create prompt v1.0.0
```

## Products

| Command | Description |
|---------|-------------|
| `ensemble conductor` | AI workflow orchestration |
| `ensemble edgit` | Component versioning |
| `ensemble chamber` | Edge data layer |
| `ensemble cloud` | Managed platform connection |

## Wrangler Passthrough

All Wrangler commands work directly:

```bash
ensemble dev          # → wrangler dev
ensemble deploy       # → wrangler deploy
ensemble tail         # → wrangler tail
ensemble kv           # → wrangler kv
ensemble d1           # → wrangler d1
```

## Documentation

- [Ensemble Docs](https://docs.ensemble.ai)
- [Conductor Docs](https://docs.ensemble.ai/conductor)
- [Edgit Docs](https://docs.ensemble.ai/edgit)

## License

Apache-2.0

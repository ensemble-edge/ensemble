# Agents Directory

## Three-Tier Organization

This template uses a three-tier structure to separate production code, infrastructure tools, and learning resources:

```
agents/
├── (your production agents)  # Business logic
├── docs/                     # Documentation infrastructure
└── examples/                 # Learning resources
```

---

## Production Agents (Root Level)

**What**: Your application's business logic agents

**Examples**:
- `calculator/` - Mathematical operations
- `data-validator/` - Input validation
- `text-processor/` - Text manipulation
- `email-sender/` - Email notifications

**When to add**: Your custom business logic

**Keep in production**: ✅ Yes - these ARE your application

---

## Documentation Tools (`docs/`)

**What**: Production-ready infrastructure for auto-generating documentation

Conductor includes powerful documentation agents that can:
- 📖 Auto-generate API documentation from your code
- 🔍 Create searchable documentation with vector search
- ✍️ Use AI to write clear, helpful docs
- 🔐 Support public, authenticated, and admin-only docs

**Available Tools**:
- `docs-simple.yaml` - Basic API documentation
- `docs-public.yaml` - Public-facing API docs
- `docs-authenticated.yaml` - Authenticated endpoint docs
- `docs-admin.yaml` - Admin-only API docs
- `docs-search/` - Vector-powered documentation search
- `docs-writer/` - AI-powered docs generation

**See [docs/README.md](./docs/README.md) for complete usage guide.**

**Keep in production**: ✅ Yes - these are infrastructure, not examples!

---

## Learning Examples (`examples/`)

**What**: Simple examples to learn Conductor patterns

**Available Examples**:
- `hello/` - Basic code operation agent
- `vectorize-search/` - Vector database integration
- `api-docs/` - Documentation configuration patterns

**See [examples/README.md](./examples/README.md) for learning guide.**

**Keep in production**: ❌ Delete when comfortable with Conductor

---

## Quick Start

### Create a New Agent

```bash
# Create agent directory
mkdir agents/my-agent

# Create configuration
cat > agents/my-agent/agent.yaml << 'EOF'
name: my-agent
operation: code
description: My custom agent
schema:
  input:
    data: string
  output:
    result: string
EOF

# Create implementation
cat > agents/my-agent/index.ts << 'EOF'
import type { AgentExecutionContext } from '@ensemble-edge/conductor';

export default function myAgent({ input }: AgentExecutionContext) {
  const { data } = input as { data: string };
  return { result: data.toUpperCase() };
}
EOF

# Rebuild to auto-discover
pnpm run build
```

### Use Documentation Tools

```bash
# Documentation endpoints are already configured!
# Access at:
# - /docs-simple    (basic docs)
# - /docs-public    (public API docs)
# - /docs-admin     (admin-only docs)

# Customize by editing agents/docs/*.yaml
```

### Learn from Examples

```bash
# Explore the hello agent
cat agents/examples/hello/index.ts

# Copy example to production
cp -r agents/examples/hello agents/my-new-agent
cd agents/my-new-agent
# Modify for your needs
```

---

## Agent Signature (Critical!)

**All agents MUST use `AgentExecutionContext` signature to work in ensembles!**

```typescript
import type { AgentExecutionContext } from '@ensemble-edge/conductor';

export default function myAgent({ input, env, ctx }: AgentExecutionContext) {
  // Destructure your parameters from input
  const { param1, param2 } = input as MyInput;

  // Your logic here
  return { result: 'success' };
}
```

**Why?** Ensembles pass `{ input, env, ctx }` to agents. This signature:
- ✅ Works in ensembles (orchestrated workflows)
- ✅ Works with direct calls
- ✅ Works in tests
- ✅ Provides access to Cloudflare bindings (env)
- ✅ Provides access to ExecutionContext (ctx)

See [documentation](/conductor/getting-started/your-first-agent#critical-agent-signatures-for-ensembles) for details.

---

## Organization Tips

### Naming Conventions

**Good**:
- `auth-login/` - Clear purpose
- `auth-refresh/` - Related prefix
- `payment-process/` - Descriptive

**Avoid**:
- `helper/` - Too generic
- `utils/` - Unclear purpose
- `temp/` - Indicates code smell

### Grouping Related Agents

Use prefixes for related functionality:

```
agents/
├── auth-login/
├── auth-refresh/
├── auth-validate/
├── payment-process/
├── payment-refund/
├── email-send/
└── email-verify/
```

### When to Create New Agents

**Create separate agents when**:
- Different input/output schemas
- Reusable across ensembles
- Clear single responsibility
- Needs independent testing

**Combine into one agent when**:
- Tightly coupled logic
- Same input/output schema
- Only used together
- Hard to test separately

---

## Testing Your Agents

All agents should have tests:

```typescript
import { describe, it, expect } from 'vitest';
import myAgent from '../agents/my-agent';

describe('My Agent', () => {
  it('should process input correctly', () => {
    const result = myAgent({
      input: { data: 'test' },
      env: {} as Env,
      ctx: {
        waitUntil: (promise: Promise<any>) => promise,
        passThroughOnException: () => {}
      } as ExecutionContext
    });

    expect(result.result).toBe('TEST');
  });
});
```

Run tests: `pnpm test`

---

## Auto-Discovery

Agents are automatically discovered from the `agents/` directory at build time:

1. **Create agent** in `agents/my-agent/`
2. **Add files** (`agent.yaml` and optionally `index.ts`)
3. **Rebuild** with `pnpm run build`
4. **Agent available** in ensembles and runtime

**No manual registration needed!**

---

## Next Steps

### For New Projects

1. **Explore examples** - See `examples/hello/` for a working agent
2. **Configure docs** - Edit `docs/*.yaml` for your API
3. **Create first agent** - Follow Quick Start above
4. **Write tests** - Ensure quality from the start
5. **Delete examples** - When comfortable with Conductor

### For Production

1. **Keep docs infrastructure** - Auto-generate documentation
2. **Organize by feature** - Use prefixes for related agents
3. **Test everything** - Comprehensive test coverage
4. **Document schemas** - Clear input/output types
5. **Monitor performance** - Track agent execution times

---

## Need Help?

- **Documentation**: https://docs.ensemble.ai/conductor
- **Agent Guide**: [Your First Agent](/conductor/getting-started/your-first-agent)
- **Ensemble Guide**: [Your First Ensemble](/conductor/getting-started/your-first-ensemble)
- **Issues**: https://github.com/ensemble-edge/conductor/issues

**Happy building!** 🚀

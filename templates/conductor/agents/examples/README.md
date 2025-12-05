# Learning Examples

**These are simple examples to help you learn Conductor patterns.**

Safe to delete once you're comfortable with the framework!

---

## Available Examples

### hello/

**What**: Basic code operation agent

**Demonstrates**:
- Simple function agent
- Input validation with shared utilities
- Output formatting
- Style-based message selection
- `AgentExecutionContext` signature

**Key Concepts**:
- Using `operation: code` for custom logic
- Accessing input parameters correctly
- Using shared utilities from `src/lib/`
- Returning structured output

**Use for learning**:
- Your first custom agent
- Basic agent structure
- Testing patterns
- Proper agent signatures for ensembles

**Files**:
- `agent.yaml` - Agent configuration
- `index.ts` - Implementation with `AgentExecutionContext`

---

### vectorize-search/

**What**: Vector database integration example

**Demonstrates**:
- Data operation type
- Vectorize binding usage
- Semantic search implementation
- Embedding generation

**Key Concepts**:
- Using `operation: data` with Vectorize
- Vector embeddings for search
- Semantic vs keyword search
- Cloudflare binding integration

**Use for learning**:
- Vector database patterns
- Search functionality
- AI-powered features
- External service integration

**Requirements**: Vectorize binding in `wrangler.toml`

---

## Using Examples

### Copy to Production

```bash
# 1. Copy example
cp -r agents/examples/hello agents/my-agent

# 2. Rename and modify
cd agents/my-agent
vim agent.yaml  # Change name, description
vim index.ts    # Implement your logic

# 3. Test
pnpm test

# 4. Use in ensemble or API
pnpm run build
```

### Reference While Building

Keep examples around as reference:
- Check syntax patterns
- See configuration options
- Compare implementation approaches
- Understand `AgentExecutionContext` usage

### Delete When Ready

```bash
# Once you understand Conductor
rm -rf agents/examples
```

**Note**: This won't break anything! Examples are for learning only.

---

## Learning Path

### 1. Start with hello/

**Goal**: Understand basic agent structure

```bash
# Read the configuration
cat agents/examples/hello/agent.yaml

# Read the implementation
cat agents/examples/hello/index.ts

# Notice the AgentExecutionContext signature!
```

**Key Takeaways**:
- Agents have two files: `agent.yaml` + `index.ts`
- Use `operation: code` for custom TypeScript/JavaScript
- Must use `AgentExecutionContext` signature for ensembles
- Input validation is important
- Return structured output matching schema

### 2. Run Tests

**Goal**: See how to test agents

```bash
# Run all tests
pnpm test

# Check tests/basic.test.ts for examples
```

**Key Takeaways**:
- Tests need proper `ExecutionContext` mock
- Can test agents in isolation
- Can test via ensembles
- Always validate output structure

### 3. Modify an Example

**Goal**: Make it your own

```bash
# Copy hello agent
cp -r agents/examples/hello agents/greeter

# Edit to add new greeting styles
vim agents/greeter/index.ts

# Update schema
vim agents/greeter/agent.yaml

# Test your changes
pnpm test
```

**Key Takeaways**:
- Easy to customize existing agents
- Schema should match implementation
- Tests catch breaking changes
- Rebuild after modifications

### 4. Create from Scratch

**Goal**: Build without a template

```bash
# Create new agent
mkdir agents/calculator

# Write configuration
cat > agents/calculator/agent.yaml << 'EOF'
name: calculator
operation: code
description: Performs mathematical calculations

schema:
  input:
    operation: string
    a: number
    b: number
  output:
    result: number
EOF

# Write implementation
cat > agents/calculator/index.ts << 'EOF'
import type { AgentExecutionContext } from '@ensemble-edge/conductor';

export default function calculator({ input }: AgentExecutionContext) {
  const { operation, a, b } = input as {
    operation: string;
    a: number;
    b: number;
  };

  const ops: Record<string, number> = {
    add: a + b,
    subtract: a - b,
    multiply: a * b,
    divide: b !== 0 ? a / b : 0
  };

  return { result: ops[operation] || 0 };
}
EOF

# Build and test
pnpm run build
pnpm test
```

**Key Takeaways**:
- Agent creation is simple
- Configuration drives discovery
- Implementation is standard TypeScript
- Always use `AgentExecutionContext` signature

### 5. Use in Ensemble

**Goal**: Orchestrate agents together

```bash
# Create ensemble that uses your agent
cat > ensembles/calc-workflow.yaml << 'EOF'
ensemble: calc-workflow
description: Perform calculations

agents:
  - name: calc
    operation: code

output:
  result: ${calc.output.result}
EOF

# Build and run
pnpm run build
pnpm test
```

**Key Takeaways**:
- Ensembles orchestrate agents
- Variable interpolation with `${}`
- Agents must use `AgentExecutionContext` for ensembles
- Test ensembles end-to-end

### 6. Delete Examples

**Goal**: Clean up learning materials

```bash
# You're ready!
rm -rf agents/examples
```

---

## Common Patterns from Examples

### Pattern 1: Input Validation

From `hello/index.ts`:

```typescript
import { sanitizeInput } from '../../src/lib/formatting';

export default function myAgent({ input }: AgentExecutionContext) {
  // Always validate/sanitize input
  const name = sanitizeInput(input.name || 'World');
  const style = input.style || 'friendly';

  // Process...
}
```

**Why**: Prevents injection attacks, handles missing data

### Pattern 2: Shared Utilities

From `hello/index.ts`:

```typescript
import { formatMessage } from '../../src/lib/formatting';

export default function myAgent({ input }: AgentExecutionContext) {
  // Use shared utilities for consistency
  const message = generateMessage(input);
  const formatted = formatMessage(message, false);

  return { message: formatted };
}
```

**Why**: DRY principle, consistent behavior, easier testing

### Pattern 3: AgentExecutionContext Signature

From all examples:

```typescript
import type { AgentExecutionContext } from '@ensemble-edge/conductor';

export default function myAgent({ input, env, ctx }: AgentExecutionContext) {
  // Destructure params from input
  const { param1, param2 } = input as MyInput;

  // Now you can use env and ctx too!
  // env.KV, env.D1, env.AI, etc.
  // ctx.waitUntil(), etc.

  return { result: 'success' };
}
```

**Why**: Required for ensembles, provides access to Cloudflare bindings

### Pattern 4: Structured Output

From all examples:

```typescript
export default function myAgent({ input }: AgentExecutionContext) {
  // Process input...

  // Return object matching schema
  return {
    result: processedData,
    metadata: {
      timestamp: Date.now(),
      version: '1.0'
    }
  };
}
```

**Why**: Type safety, clear contracts, easier debugging

---

## Troubleshooting Examples

### Example Agent Not Working

**Problem**: Copied example but it fails in ensemble

**Fix**: Check you're using `AgentExecutionContext` signature:

```typescript
// ❌ Wrong (won't work in ensembles)
export default function myAgent({ param }: MyInput) {

// ✅ Correct (works everywhere)
import type { AgentExecutionContext } from '@ensemble-edge/conductor';
export default function myAgent({ input }: AgentExecutionContext) {
  const { param } = input as MyInput;
```

### Tests Failing

**Problem**: Tests throw `waitUntil is not a function`

**Fix**: Add proper ExecutionContext mock:

```typescript
const ctx = {
  waitUntil: (promise: Promise<any>) => promise,
  passThroughOnException: () => {}
} as ExecutionContext;
```

### Agent Not Discovered

**Problem**: Created agent but it's not found

**Fix**: Rebuild to trigger auto-discovery:

```bash
pnpm run build
```

---

## Next Steps

After learning from examples:

1. **Delete examples** - Keep your codebase clean
2. **Create production agents** - Build your business logic
3. **Configure docs** - Use the `docs/` directory for documentation
4. **Write tests** - Comprehensive coverage
5. **Deploy** - Share your work!

---

## Need More Examples?

- **Conductor Docs**: https://docs.ensemble.ai/conductor
- **Agent Guide**: [Your First Agent](/conductor/getting-started/your-first-agent)
- **Ensemble Guide**: [Your First Ensemble](/conductor/getting-started/your-first-ensemble)
- **GitHub**: https://github.com/ensemble-edge/conductor

**Happy learning!** 🎓

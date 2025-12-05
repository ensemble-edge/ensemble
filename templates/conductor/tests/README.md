# Testing Your Conductor Project

This directory contains tests for your Conductor ensembles and agents.

## Test Structure

- **smoke.test.ts** - Basic sanity checks (always included)
- **basic.test.ts** - Hello world ensemble test (always included)
- **examples/** - Example tests (skipped with `--no-examples` flag)
  - **ensembles/** - Tests for example ensembles
  - **agents/** - Tests for example agents
  - **debug.test.ts** - Debug utilities

When you run `conductor init --no-examples`, the examples/ directory is not copied, so your project starts with only the essential tests.

## Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm run test:watch

# Generate coverage report
pnpm run test:coverage
```

## Writing Tests

### Testing Members (Basic Approach)

See `basic.test.ts` for an example of testing without TestConductor:

```typescript
import { Executor, MemberLoader } from '@ensemble-edge/conductor';
import type { AgentConfig } from '@ensemble-edge/conductor';

const executor = new Executor({ env, ctx });
const loader = new MemberLoader({ env, ctx });

const agent = loader.registerAgent(agentConfig as AgentConfig, memberFunction);
executor.registerAgent(agent);

const result = await executor.executeFromYAML(ensembleYAML as unknown as string, input);
expect(result.success).toBe(true);
```

### Testing Members (TestConductor)

See `examples/agents/hello.test.ts` for an example using TestConductor:

```typescript
import { TestConductor, registerMatchers } from '@ensemble-edge/conductor/testing';

registerMatchers();

describe('My Agent', () => {
  let conductor: TestConductor;

  beforeEach(async () => {
    conductor = await TestConductor.create({ projectPath: '.' });
  });

  afterEach(async () => {
    await conductor.cleanup();
  });

  it('should execute successfully', async () => {
    const result = await conductor.executeAgent('my-agent', { input: 'data' });
    expect(result.output).toBeDefined();
  });
});
```

### Testing Ensembles

See `ensembles/hello-world.test.ts` for an example of testing an ensemble:

```typescript
it('should execute successfully', async () => {
  const result = await conductor.executeEnsemble('my-ensemble', { input: 'data' });

  expect(result).toBeSuccessful();
  expect(result).toHaveExecutedMember('my-agent');
  expect(result).toHaveCompletedIn(1000);
});
```

## Custom Matchers

Conductor provides custom Vitest matchers for testing:

- `toBeSuccessful()` - Check if execution succeeded
- `toHaveFailed()` - Check if execution failed
- `toHaveExecutedMember(name)` - Check if a agent was executed
- `toHaveExecutedSteps(count)` - Check number of steps executed
- `toHaveCompletedIn(ms)` - Check execution time
- `toHaveCalledAI(agentName?)` - Check if AI was called
- `toHaveUsedTokens(count)` - Check token usage
- `toHaveCostLessThan(dollars)` - Check estimated cost

## Mocking

### Mock AI Responses

```typescript
conductor.mockAI('my-agent', {
  message: 'Mocked AI response'
});
```

### Mock Database

```typescript
conductor.mockDatabase('users', [
  { id: '1', name: 'Alice' },
  { id: '2', name: 'Bob' }
]);
```

### Mock HTTP APIs

```typescript
conductor.mockAPI('https://api.example.com/data', {
  result: 'mocked response'
});
```

## CI/CD Integration

Tests run automatically in CI. See `.github/workflows/test.yml` for configuration.

## Coverage

Coverage reports are generated in `./coverage/` directory. Open `coverage/index.html` to view detailed coverage.

## Learn More

- [Conductor Testing Documentation](https://docs.conductor.dev/testing)
- [Vitest Documentation](https://vitest.dev)

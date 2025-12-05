# Shared Configs

This folder contains **shared, versioned configuration files** that can be used across multiple agents and ensembles.

## 🚧 Status: Coming Soon

**File-based component loading is not yet implemented.** This folder structure demonstrates the intended architecture.

For now, define configs inline in your agent.yaml:
```yaml
config:
  model: "@cf/meta/llama-3.1-8b-instruct"
  temperature: 0.7
  # ... other settings
```

Once Edgit integration is complete, you'll be able to reference configs like:
```yaml
config:
  component: configs/model-settings.yaml@v1.0.0
```

## Why Shared Configs?

Configs are Edgit components, which means:
- **Reusable**: Multiple agents can reference the same config
- **Versioned**: Each config has independent version history
- **Flexible**: Change settings without changing agent code
- **Environment-specific**: Different configs for dev/staging/prod

## Adding a Config

1. Create a YAML file in this folder:
   ```bash
   touch configs/model-settings.yaml
   ```

2. Define your configuration:
   ```yaml
   model: claude-3-5-sonnet-20241022
   temperature: 0.7
   max_tokens: 4000

   retry:
     attempts: 3
     backoff: exponential

   cache:
     enabled: true
     ttl: 3600
   ```

3. Reference it in a agent's `agent.yaml`:
   ```yaml
   type: think
   name: analyzer
   config:
     component: configs/model-settings.yaml
   ```

4. Version it with Edgit:
   ```bash
   edgit commit -m "Add model settings config"
   edgit tag configs/model-settings.yaml v1.0.0
   ```

## Accessing Config Values

In your agent code:
```typescript
export default async function(input: any, context: MemberContext) {
  const config = context.config;

  // Access config values
  const model = config.model;
  const temperature = config.temperature;
  const retryAttempts = config.retry.attempts;

  // Use in API calls
  const response = await context.env.AI.run(model, {
    messages: [...],
    temperature,
    max_tokens: config.max_tokens
  });

  return response;
}
```

## Using Different Versions

```yaml
# Different agents use different config versions
agents:
  - name: analyzer-prod
    type: think
    config:
      component: configs/model-settings.yaml@v2.0.0  # Latest settings

  - name: analyzer-stable
    type: think
    config:
      component: configs/model-settings.yaml@v1.0.0  # Stable settings
```

## Co-located Alternative

For rapid development, you can put configs directly in agent folders:
```
agents/
  my-agent/
    agent.yaml
    config.yaml      # Co-located config
    index.ts
```

**When to use shared vs co-located:**
- **Co-located**: Early development, agent-specific settings
- **Shared**: Production use, configs used by multiple agents, version control needed

## Environment-Specific Configs

Create different configs for each environment:
```
configs/
  model-settings-dev.yaml
  model-settings-staging.yaml
  model-settings-prod.yaml
```

Then reference based on environment:
```yaml
config:
  component: configs/model-settings-{{env.ENVIRONMENT}}.yaml
```

## Common Config Types

### Model Settings
```yaml
model: claude-3-5-sonnet-20241022
temperature: 0.7
max_tokens: 4000
top_p: 0.9
```

### API Settings
```yaml
api:
  base_url: https://api.example.com
  timeout: 30000
  retry:
    attempts: 3
    delay: 1000
```

### Feature Flags
```yaml
features:
  enableCaching: true
  enableLogging: true
  enableMetrics: false
  experimentalFeatures: false
```

### Business Rules
```yaml
scoring:
  threshold: 0.75
  weights:
    accuracy: 0.4
    completeness: 0.3
    timeliness: 0.3

validation:
  minLength: 10
  maxLength: 5000
  requiredFields: ["name", "email"]
```

## Examples

See how the `greet` agent uses shared configs in the hello-world ensemble.

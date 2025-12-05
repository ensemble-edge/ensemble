# Shared Prompts

This folder contains **shared, versioned prompts** that can be used across multiple agents and ensembles.

## 🚧 Status: Coming Soon

**File-based component loading is not yet implemented.** This folder structure demonstrates the intended architecture.

For now, use inline prompts in your agent.yaml:
```yaml
config:
  systemPrompt: |
    Your prompt content here
```

Once Edgit integration is complete, you'll be able to reference prompts like:
```yaml
prompt:
  component: prompts/my-prompt.md@v1.0.0
```

## Why Shared Prompts?

Prompts are Edgit components, which means:
- **Reusable**: Multiple agents can reference the same prompt
- **Versioned**: Each prompt has independent version history
- **Optimizable**: Use different versions across agents (e.g., `greeting@v1.0.0`, `greeting@v2.1.0`)
- **Trackable**: See which ensembles use which prompt versions

## Adding a Prompt

1. Create a markdown file in this folder:
   ```bash
   touch prompts/my-prompt.md
   ```

2. Write your prompt content:
   ```markdown
   You are a helpful assistant that analyzes company data.

   Given the following information:
   - Company name: {{companyName}}
   - Industry: {{industry}}

   Provide a detailed analysis of market position and competitive advantages.
   ```

3. Reference it in a agent's `agent.yaml`:
   ```yaml
   type: think
   name: company-analyzer
   prompt:
     component: prompts/my-prompt.md
   ```

4. Version it with Edgit:
   ```bash
   edgit commit -m "Add company analysis prompt"
   edgit tag prompts/my-prompt.md v1.0.0
   ```

## Using Different Versions

```yaml
# Agent A uses latest version
agents:
  - name: analyzer-v2
    prompt:
      component: prompts/analysis.md@v2.0.0

# Agent B uses stable version
  - name: analyzer-stable
    prompt:
      component: prompts/analysis.md@v1.0.0
```

## Co-located Alternative

For rapid development, you can also put prompts directly in agent folders:
```
agents/
  my-agent/
    agent.yaml
    prompt.md        # Co-located prompt
    index.ts
```

**When to use shared vs co-located:**
- **Co-located**: Early development, rapid iteration, agent-specific prompts
- **Shared**: Production use, prompts used by multiple agents, version control needed

## Template Variables

Prompts support Handlebars-style variables:
```markdown
Hello {{name}}!

Your settings:
- Mode: {{settings.mode}}
- Level: {{settings.level}}
```

## Examples

See how the built-in `greet` agent uses shared prompts in the hello-world ensemble.

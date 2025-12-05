# Ensemble CLI Visual Standards & Implementation Guide

**Purpose:** This document provides complete visual specifications for implementing the Ensemble CLI (`ensemble`) and Edgit CLI (`edgit`). Follow these patterns exactly to ensure brand consistency across all commands.

---

## Brand Colors

### Terminal ANSI Mapping

```typescript
// Use picocolors or similar lightweight library
import pc from 'picocolors';

export const colors = {
  // Primary - Magenta/Purple (Ensemble brand)
  primary: pc.magenta,
  primaryBold: pc.bold(pc.magenta),
  
  // Accent - Cyan (highlights, interactive elements)
  accent: pc.cyan,
  accentBold: pc.bold(pc.cyan),
  
  // Status colors
  success: pc.green,
  warning: pc.yellow,
  error: pc.red,
  
  // Text hierarchy
  bold: pc.bold(pc.white),
  normal: pc.white,
  dim: pc.dim,
  muted: pc.gray,
};
```

### Color Usage Rules

| Element | Color | Example |
|---------|-------|---------|
| Product name in banner | `primaryBold` | "🎼 Conductor" |
| Step headers | `bold` | "Step 3 of 11: Project Name" |
| Progress bar filled | `accent` | `████████████` |
| Progress bar empty | `dim` | `░░░░░░░░░░░░` |
| Success checkmark | `success` | `✓ Created package.json` |
| Error X | `error` | `✗ Failed to authenticate` |
| Warning | `warning` | `⚠️ No AI Gateways found` |
| Hints/secondary text | `dim` | `(lowercase with hyphens)` |
| User input | `accent` | The text user types |
| Links/URLs | `accent` | `https://docs.ensemble.ai` |
| Commands to run | `accent` | `cd my-project` |

---

## Banners

Each product has a distinct ASCII art banner shown at command start.

### Conductor Banner

```
   ______                __           __            
  / ____/___  ____  ____/ /_  _______/ /_____  _____
 / /   / __ \/ __ \/ __  / / / / ___/ __/ __ \/ ___/
/ /___/ /_/ / / / / /_/ / /_/ / /__/ /_/ /_/ / /    
\____/\____/_/ /_/\__,_/\__,_/\___/\__/\____/_/     
by Ensemble
```

### Edgit Banner

```
   ______    __      _ __ 
  / ____/___/ /___ _(_) /_
 / __/ / __  / __ `/ / __/
/ /___/ /_/ / /_/ / / /_  
\____/\__,_/\__, /_/\__/  
           /____/         
by Ensemble
```

### Cloud Banner

```
   ________                __
  / ____/ /___  __  ______/ /
 / /   / / __ \/ / / / __  / 
/ /___/ / /_/ / /_/ / /_/ /  
\____/_/\____/\__,_/\__,_/   
by Ensemble
```

### Implementation

```typescript
const BANNERS = {
  conductor: `
   ______                __           __            
  / ____/___  ____  ____/ /_  _______/ /_____  _____
 / /   / __ \\/ __ \\/ __  / / / / ___/ __/ __ \\/ ___/
/ /___/ /_/ / / / / /_/ / /_/ / /__/ /_/ /_/ / /    
\\____/\\____/_/ /_/\\__,_/\\__,_/\\___/\\__/\\____/_/     
${colors.dim('by Ensemble')}
`,

  edgit: `
   ______    __      _ __ 
  / ____/___/ /___ _(_) /_
 / __/ / __  / __ \`/ / __/
/ /___/ /_/ / /_/ / / /_  
\\____/\\__,_/\\__, /_/\\__/  
           /____/         
${colors.dim('by Ensemble')}
`,

  cloud: `
   ________                __
  / ____/ /___  __  ______/ /
 / /   / / __ \\/ / / / __  / 
/ /___/ / /_/ / /_/ / /_/ /  
\\____/_/\\____/\\__,_/\\__,_/   
${colors.dim('by Ensemble')}
`,
};

function showBanner(product: 'conductor' | 'edgit' | 'cloud') {
  console.log(colors.primaryBold(BANNERS[product]));
}
```

### Fallback: Simple Banners (Narrow Terminals)

For terminals narrower than 60 columns, fall back to simple banners:

```typescript
const SIMPLE_BANNERS = {
  conductor: `
  🎼 Conductor
  ${colors.dim('Edge-native AI workflow orchestration')}
`,
  edgit: `
  🔀 Edgit
  ${colors.dim('Git-native versioning for AI components')}
`,
  cloud: `
  ☁️  Ensemble Cloud
  ${colors.dim('Connect your project to the managed platform')}
`,
};

function showBanner(product: 'conductor' | 'edgit' | 'cloud') {
  const termWidth = process.stdout.columns || 80;
  
  if (termWidth < 60) {
    console.log(SIMPLE_BANNERS[product]);
  } else {
    console.log(colors.primaryBold(BANNERS[product]));
  }
}
```

---

## Progress Indicators

### Info Messages

Use `ℹ` for informational status:

```typescript
function showInfo(message: string) {
  console.log(`${colors.accent('ℹ')} ${message}`);
}
```

Display:
```
ℹ Detected: Empty directory
```

### Success Messages

```typescript
function showSuccess(message: string) {
  console.log(`${colors.success('✓')} ${message}`);
}
```

Display:
```
✓ Authenticated as user@example.com
```

### Error Messages

```typescript
function showError(message: string) {
  console.log(`${colors.error('✗')} ${message}`);
}
```

Display:
```
✗ Not authenticated with Cloudflare
```

### Nested Success (File Creation)

Indent nested items with 3 spaces:

```typescript
function showNestedSuccess(message: string) {
  console.log(`   ${colors.success('✓')} ${message}`);
}

function showNestedAction(message: string) {
  console.log(`   ${colors.dim(message)}`);
}
```

Display:
```
✓ Created project structure
   ✓ package.json
   ✓ wrangler.toml
   ✓ conductor.config.ts
   Creating agents/
   ✓ agents/examples/hello/
   ✓ agents/examples/greet/
```

---

## Spinner Animation

For async operations. Use a consistent 4-frame spinner.

```typescript
const SPINNER_FRAMES = ['◐', '◓', '◑', '◒'];
const SPINNER_INTERVAL = 80; // milliseconds

interface SpinnerInstance {
  stop: () => void;
  success: (text: string) => void;
  error: (text: string) => void;
}

function createSpinner(message: string): SpinnerInstance {
  let frameIndex = 0;
  let currentMessage = message;
  
  const interval = setInterval(() => {
    const frame = colors.accent(SPINNER_FRAMES[frameIndex]);
    process.stdout.write(`\r  ${frame} ${currentMessage}`);
    frameIndex = (frameIndex + 1) % SPINNER_FRAMES.length;
  }, SPINNER_INTERVAL);
  
  return {
    stop: () => {
      clearInterval(interval);
      process.stdout.write('\r' + ' '.repeat(currentMessage.length + 10) + '\r');
    },
    success: (text: string) => {
      clearInterval(interval);
      console.log(`\r  ${colors.success('✓')} ${text}`);
    },
    error: (text: string) => {
      clearInterval(interval);
      console.log(`\r  ${colors.error('✗')} ${text}`);
    },
  };
}
```

Display (animated):
```
  ◐ Installing dependencies...
```

On success:
```
  ✓ Installed dependencies
```

On error:
```
  ✗ Failed to install dependencies
```

---

## Keyboard Hints

Show contextual hints below prompts.

```typescript
export const hints = {
  confirm: '⏎ Enter to accept default',
  text: 'Type value, ⏎ Enter to submit',
  select: '↑↓ to navigate, ⏎ Enter to select',
  multiselect: '↑↓ navigate, Space to toggle, ⏎ Enter to confirm',
  password: 'Input hidden, ⏎ Enter to submit',
};

function showHint(type: keyof typeof hints) {
  console.log(`  ${colors.dim(hints[type])}`);
}
```

---

## Interactive Prompts

### Confirm Prompt

Format: `? Question? Yes/No` (answer appears on same line after user responds)

```
? Is this correct? Yes
```

Default hints:
- `(Y/n)` — Yes is default (capital Y)
- `(y/N)` — No is default (capital N)

```typescript
async function confirm(message: string, defaultYes = true): Promise<boolean> {
  const hint = defaultYes ? '(Y/n)' : '(y/N)';
  
  // Show prompt with hint
  process.stdout.write(`${colors.accent('?')} ${message} ${colors.dim(hint)} `);
  
  const answer = await readline();
  
  // Clear line and rewrite with answer
  clearLine();
  const result = answer === '' ? defaultYes : answer.toLowerCase().startsWith('y');
  console.log(`${colors.accent('?')} ${message} ${colors.bold(result ? 'Yes' : 'No')}`);
  
  return result;
}
```

### Text Input Prompt

Format: `? Label: value` (value appears after colon)

```
? Project name: acme-backend
```

```typescript
async function textInput(
  message: string, 
  defaultValue?: string
): Promise<string> {
  process.stdout.write(`${colors.accent('?')} ${message}: `);
  
  const answer = await readline();
  const result = answer || defaultValue || '';
  
  // Clear and rewrite with final value
  clearLine();
  console.log(`${colors.accent('?')} ${message}: ${colors.accent(result)}`);
  
  return result;
}
```

### Select Prompt

Shows options with arrow indicator, then rewrites with selected value.

During selection:
```
? Select Cloudflare account:
> Personal (user@example.com)
  Work (user@company.com)
```

After selection (options disappear, answer on same line):
```
? Select Cloudflare account: Work (user@company.com)
```

```typescript
async function select<T>(
  message: string,
  choices: Array<{ label: string; value: T }>
): Promise<T> {
  console.log(`${colors.accent('?')} ${message}`);
  
  let selectedIndex = 0;
  
  function render() {
    choices.forEach((choice, i) => {
      const marker = i === selectedIndex ? colors.accent('>') : ' ';
      const label = i === selectedIndex 
        ? colors.accent(choice.label) 
        : choice.label;
      console.log(`${marker} ${label}`);
    });
  }
  
  // Handle arrow keys, render, get selection...
  
  // After selection, clear options and show result on one line
  cursorUp(choices.length + 1);
  for (let i = 0; i <= choices.length; i++) {
    clearLine();
    if (i < choices.length) cursorDown(1);
  }
  cursorUp(choices.length);
  
  const selected = choices[selectedIndex];
  console.log(`${colors.accent('?')} ${message}: ${colors.accent(selected.label)}`);
  
  return selected.value;
}
```

### Password Input

Shows masked input with asterisks:

```
? OpenAI API key: ****************************
```

---

## Spinner Animation

For async operations. Use a consistent 4-frame spinner.

```typescript
const SPINNER_FRAMES = ['|', '/', '-', '\\'];
const SPINNER_INTERVAL = 80; // milliseconds

function createSpinner(message: string) {
  let frameIndex = 0;
  
  const interval = setInterval(() => {
    const frame = colors.accent(SPINNER_FRAMES[frameIndex]);
    process.stdout.write(`\r${frame} ${message}`);
    frameIndex = (frameIndex + 1) % SPINNER_FRAMES.length;
  }, SPINNER_INTERVAL);
  
  return {
    stop: () => clearInterval(interval),
    success: (text: string) => {
      clearInterval(interval);
      console.log(`\r${colors.success('✓')} ${text}`);
    },
    error: (text: string) => {
      clearInterval(interval);
      console.log(`\r${colors.error('✗')} ${text}`);
    },
  };
}
```

---

## Success Boxes

Use box drawing characters for major success messages.

```typescript
function showSuccessBox(message: string) {
  const width = 57;
  const padding = width - stripAnsi(message).length - 6;
  
  console.log('');
  console.log(`${colors.accent('┌' + '─'.repeat(width) + '┐')}`);
  console.log(`${colors.accent('│')}${' '.repeat(Math.floor(padding/2))}   ${colors.success('✓')} ${colors.bold(message)}${' '.repeat(Math.ceil(padding/2))}${colors.accent('│')}`);
  console.log(`${colors.accent('└' + '─'.repeat(width) + '┘')}`);
  console.log('');
}
```

Display:
```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   ✓ Project acme-backend created successfully!          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Recommendation Box

```typescript
function showRecommendationBox(title: string, lines: string[]) {
  const width = 54;
  
  console.log(`${colors.accent('┌' + '─'.repeat(width) + '┐')}`);
  console.log(`${colors.accent('│')}  ${title}${' '.repeat(width - stripAnsi(title).length - 3)}${colors.accent('│')}`);
  console.log(`${colors.accent('│')}${' '.repeat(width)}${colors.accent('│')}`);
  
  for (const line of lines) {
    const padding = width - stripAnsi(line).length - 3;
    console.log(`${colors.accent('│')}  ${line}${' '.repeat(padding)}${colors.accent('│')}`);
  }
  
  console.log(`${colors.accent('└' + '─'.repeat(width) + '┘')}`);
}
```

---

## Full Init Flows

### Conductor Init (`ensemble conductor init`)

No numbered steps - just a linear flow of prompts and status messages.

#### Full Interactive Output

```
   ______                __           __            
  / ____/___  ____  ____/ /_  _______/ /_____  _____
 / /   / __ \/ __ \/ __  / / / / ___/ __/ __ \/ ___/
/ /___/ /_/ / / / / /_/ / /_/ / /__/ /_/ /_/ / /    
\____/\____/_/ /_/\__,_/\__,_/\___/\__/\____/_/     
by Ensemble

i Detected: Empty directory
? Is this correct? Yes
? Project name: acme-backend
? Install example agents and ensembles? Yes
? Configure Cloudflare credentials now? Yes
✗ Not authenticated with Cloudflare
? Run 'wrangler login' now? Yes
✓ Authenticated as user@example.com
? Select Cloudflare account:
? Select Cloudflare account: Work (user@company.com)
? How do you want to use AI?
? How do you want to use AI? Cloudflare Workers AI
✓ Created project structure
   ✓ package.json
   ✓ wrangler.toml
   ✓ conductor.config.ts
   ✓ tsconfig.json
   ✓ vitest.config.mts
   ✓ src/index.ts
   ✓ src/lib/helpers.ts
   Creating agents/
   ✓ agents/examples/hello/
   ✓ agents/examples/greet/
   ✓ agents/examples/analyze/
   Creating ensembles/
   ✓ ensembles/hello-world.yaml
   ✓ ensembles/greeting-flow.yaml
   Creating shared folders/
   ✓ prompts/
   ✓ queries/
   ✓ configs/
   Creating tests/
   ✓ tests/unit/agents/
   ✓ tests/integration/
✓ Installed dependencies
   ✓ @ensemble-edge/conductor@1.2.3
   ✓ @ensemble-edge/edgit@0.9.0
   ✓ @cloudflare/vitest-pool-workers@0.8.0
   ✓ typescript@5.6.3
   ✓ vitest@2.1.8
✓ Updated wrangler.toml

┌─────────────────────────────────────────────────────────┐
│                                                         │
│   ✓ Project acme-backend created successfully!          │
│                                                         │
└─────────────────────────────────────────────────────────┘

What was created:
   📁  7 core files
       package.json, wrangler.toml, tsconfig.json...
   🤖  3 example agents
       hello, greet, analyze
   🎼  2 example ensembles
       hello-world, greeting-flow
   📝  Shared folders
       prompts/, queries/, configs/ — version with edgit
   🧪  Test suite
       unit + integration tests with vitest
   📖  Documentation
       README.md with getting started guide

Next steps:
  cd acme-backend
  npm run build
  npx wrangler dev --local-protocol http

Then visit: http://localhost:8787/

📚 Docs: https://docs.ensemble.ai/conductor
```

#### With External AI Provider (OpenAI Example)

```
? How do you want to use AI?
  Cloudflare Workers AI (no API key needed)
> External provider (OpenAI, Anthropic, Groq)
  Skip for now
? How do you want to use AI? External provider
? Select provider:
> OpenAI
  Anthropic
  Groq
? Select provider: OpenAI
? OpenAI API key: ****************************
✓ Validated API key
? Route through AI Gateway for caching/observability? (y/N) Yes
i No AI Gateways found in your account
i Create one at: https://dash.cloudflare.com/abc123/ai/ai-gateway
? Gateway created? Press Enter when ready...
? Select AI Gateway:
> my-gateway
  production-gateway
? Select AI Gateway: my-gateway
✓ AI configured: OpenAI via AI Gateway (my-gateway)
```

---

### Edgit Init (`edgit init`)

#### Full Interactive Output

```
   ______    __      _ __ 
  / ____/___/ /___ _(_) /_
 / __/ / __  / __ `/ / __/
/ /___/ /_/ / /_/ / / /_  
\____/\__,_/\__, /_/\__/  
           /____/         
by Ensemble

i Detected: Git repository
i No existing edgit configuration
? Scan for existing components? Yes
✓ Found 4 components
   extraction-prompt (prompt)
       prompts/extraction.md
   analysis-prompt (prompt)
       prompts/analysis.md
   user-lookup (query)
       queries/user-lookup.sql
   api-config (config)
       configs/api.yaml
? Register all 4 discovered components? Yes
✓ Registered 4 components
? Add edgit patterns to .gitignore? Yes
✓ Updated .gitignore

┌─────────────────────────────────────────────────────────┐
│                                                         │
│   ✓ Edgit initialized successfully!                     │
│                                                         │
└─────────────────────────────────────────────────────────┘

What was set up:
   🗂️  Registry
       .edgit/components.json
   📄  4 components discovered
       2 prompts, 1 query, 1 config
   📝  .gitignore
       Updated with edgit patterns

Quick start:
  edgit components list           # View all components
  edgit tag create <n> v1.0.0     # Version a component
  edgit deploy set <n> prod       # Deploy to production

📚 Docs: https://docs.ensemble.ai/edgit
```

#### Conductor Recommendation (When Not Already Installed)

After successful init, if Conductor is not detected:

```
┌──────────────────────────────────────────────────────┐
│  Works great with:                                   │
│                                                      │
│  🎼 Ensemble CLI    Orchestrate AI workflows on      │
│                     Cloudflare Workers               │
│                                                      │
│  Conductor uses edgit components for AI agents,      │
│  prompts, and workflows.                             │
└──────────────────────────────────────────────────────┘

? Install @ensemble-edge/ensemble? (y/N) No
i No problem! Install anytime:
  npm install -g @ensemble-edge/ensemble
  ensemble conductor init

  Learn more: https://docs.ensemble.ai/conductor
```

---

### Cloud Init (`ensemble cloud init`)

#### Full Interactive Output

```
   ________                __
  / ____/ /___  __  ______/ /
 / /   / / __ \/ / / / __  / 
/ /___/ / /_/ / /_/ / /_/ /  
\____/_/\____/\__,_/\__,_/   
by Ensemble

i Detected: Conductor project (my-project)
? Initialize cloud connection for production? Yes
✓ Generated cloud key
✓ Stored ENSEMBLE_CLOUD_KEY as wrangler secret
✓ Updated wrangler.toml with [ensemble.cloud]
✓ Enabled /cloud endpoint

┌─────────────────────────────────────────────────────────┐
│                                                         │
│   ✓ Cloud connection ready!                             │
│                                                         │
└─────────────────────────────────────────────────────────┘

Connection details:
   Endpoint:  https://my-project.workers.dev/cloud
   Key:       eck_live_abc123...xyz789

To connect Ensemble Cloud:
  1. Go to cloud.ensemble.ai
  2. Add Project → Paste endpoint URL
  3. Enter the cloud key when prompted

📋 Full key (copy now, shown once):
   eck_live_abc123def456ghi789jkl012mno345pqr678stu901vwx234

📚 Docs: https://docs.ensemble.ai/cloud
```

---

## Non-Interactive Mode (--yes / CI)

When `--yes` flag is passed OR CI environment is detected:

1. **Skip all prompts** - use defaults
2. **Minimal output** - just status lines
3. **No recommendation boxes** - reduce noise

### CI Detection

```typescript
function isCI(): boolean {
  return !!(
    process.env.CI ||
    process.env.GITHUB_ACTIONS ||
    process.env.GITLAB_CI ||
    process.env.CIRCLECI ||
    process.env.TRAVIS ||
    process.env.JENKINS_URL ||
    process.env.BUILDKITE ||
    !process.stdout.isTTY
  );
}

const isInteractive = !options.yes && !isCI();
```

### Non-Interactive Conductor Init

```
   ______                __           __            
  / ____/___  ____  ____/ /_  _______/ /_____  _____
 / /   / __ \/ __ \/ __  / / / / ___/ __/ __ \/ ___/
/ /___/ /_/ / / / / /_/ / /_/ / /__/ /_/ /_/ / /    
\____/\____/_/ /_/\__,_/\__,_/\___/\__/\____/_/     
by Ensemble

✓ Empty directory detected
✓ Project name: my-project
✓ Including examples
✓ Authenticated as user@example.com
✓ Using account: Personal
✓ AI provider: Cloudflare Workers AI
✓ Created project structure
✓ Installed dependencies
✓ Updated wrangler.toml

✓ Project my-project created successfully!

Next steps:
  cd my-project
  npm run build
  npx wrangler dev --local-protocol http
```

### Non-Interactive Edgit Init

```
   ______    __      _ __ 
  / ____/___/ /___ _(_) /_
 / __/ / __  / __ `/ / __/
/ /___/ /_/ / /_/ / / /_  
\____/\__,_/\__, /_/\__/  
           /____/         
by Ensemble

✓ Git repository detected
✓ No existing configuration
✓ Found 4 components
✓ Registered 4 components
✓ Updated .gitignore

✓ Edgit initialized successfully!
```

### Non-Interactive Cloud Init

```
   ________                __
  / ____/ /___  __  ______/ /
 / /   / / __ \/ / / / __  / 
/ /___/ / /_/ / /_/ / /_/ /  
\____/_/\____/\__,_/\__,_/   
by Ensemble

✓ Generated cloud key
✓ Stored ENSEMBLE_CLOUD_KEY
✓ Enabled /cloud endpoint

✓ Cloud connection ready!

Endpoint: https://my-project.workers.dev/cloud
Key: eck_live_abc123def456ghi789jkl012mno345pqr678stu901vwx234
```

---

## Error Handling

### Recoverable Errors (Retry Available)

```
✗ Not authenticated with Cloudflare
? Run 'wrangler login' now? (Y/n)
```

### Fatal Errors (Cannot Continue)

```
✗ Not a git repository

This directory is not a git repository.

To fix, run:
  git init

Then try again:
  edgit init
```

### Validation Errors

```
? Project name: My Project!!
✗ Invalid name: must be lowercase with hyphens (e.g., my-project)
? Project name: my-project
```

---

## Implementation Helpers

### Console Output Utilities

```typescript
// Clear current line (for spinner updates, prompt rewrites)
function clearLine() {
  process.stdout.write('\r\x1b[K');
}

// Move cursor up N lines
function cursorUp(n: number) {
  process.stdout.write(`\x1b[${n}A`);
}

// Move cursor down N lines  
function cursorDown(n: number) {
  process.stdout.write(`\x1b[${n}B`);
}

// Strip ANSI codes (for width calculations)
function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}
```

### Timing

- Spinner frame interval: **80ms**
- Artificial delay for "feel": **none** (don't fake slowness)
- Minimum spinner display: **200ms** (so users see it)

### Terminal Width

- Assume minimum **80 columns**
- Box widths: **54-57 characters** (fits 80 with padding)
- Truncate long paths with `...` if needed

---

## File Structure

When implementing, create these modules:

```
src/ui/
├── colors.ts        # Color definitions
├── banner.ts        # ASCII art banners
├── spinner.ts       # Spinner animation
├── status.ts        # Info, success, error messages
├── prompt.ts        # confirm, text, select, password
├── box.ts           # Success boxes, recommendation boxes
└── index.ts         # Export all
```

---

## Checklist for Implementation

- [ ] ASCII art banners render correctly
- [ ] Colors match specification exactly
- [ ] `i` info icon uses accent color
- [ ] `✓` uses green, `✗` uses red
- [ ] Prompts rewrite with answer on same line after input
- [ ] Select prompts clear options after selection
- [ ] Nested items indented 3 spaces
- [ ] Success boxes use box-drawing characters (`┌─┐│└─┘`)
- [ ] Non-interactive mode skips prompts and uses defaults
- [ ] CI environments auto-detected
- [ ] Error messages are actionable (show fix commands)
- [ ] "by Ensemble" appears dim under ASCII art
- [ ] Links/commands use accent color

---

*Visual consistency builds trust. Every init should feel like the same product family.* {
  const defaultHint = defaultValue ? ` ${colors.dim(`(${defaultValue})`)}` : '';
  
  process.stdout.write(`${colors.accent('?')} ${message}:${defaultHint} `);
  
  const answer = await readline();
  const result = answer || defaultValue || '';
  
  // Clear and rewrite with final value
  clearLine();
  console.log(`${colors.accent('?')} ${message}: ${colors.accent(result)}`);
  
  return result;
}
```

### Select Prompt

Shows options, then rewrites with selected value:

```
? Select Cloudflare account:
❯ Personal (user@example.com)
  Work (user@company.com)
```

After selection, shows:
```
? Select Cloudflare account: Work (user@company.com)
```

```typescript
async function select<T>(
  message: string,
  choices: Array<{ label: string; value: T }>
): Promise<T> {
  console.log(`${colors.accent('?')} ${message}`);
  
  let selectedIndex = 0;
  
  function render() {
    choices.forEach((choice, i) => {
      const marker = i === selectedIndex ? colors.accent('❯') : ' ';
      const label = i === selectedIndex 
        ? colors.accent(choice.label) 
        : choice.label;
      console.log(`${marker} ${label}`);
    });
  }
  
  // Handle arrow keys, render, get selection
  // ... implementation depends on readline library
  
  // After selection, clear options and show result on one line
  // Clear the option lines
  cursorUp(choices.length + 1);
  for (let i = 0; i <= choices.length; i++) {
    clearLine();
    cursorDown(1);
  }
  cursorUp(choices.length + 1);
  
  const selected = choices[selectedIndex];
  console.log(`${colors.accent('?')} ${message}: ${colors.accent(selected.label)}`);
  
  return selected.value;
}
```

### Password Input

Shows masked input:

```
? OpenAI API key: ****************************
```

```typescript
async function password(message: string): Promise<string> {
  process.stdout.write(`${colors.accent('?')} ${message}: `);
  
  // Read with masking
  const value = await readlineHidden();
  
  // Clear and show masked result
  clearLine();
  console.log(`${colors.accent('?')} ${message}: ${'*'.repeat(Math.min(value.length, 30))}`);
  
  return value;
}
```

---

## Success Boxes

Use box drawing for major success messages.

```typescript
function showSuccessBox(message: string) {
  const width = 57;
  const padding = width - message.length - 4;
  
  console.log('');
  console.log(`  ${colors.accent('┌' + '─'.repeat(width) + '┐')}`);
  console.log(`  ${colors.accent('│')}${' '.repeat(Math.floor(padding/2))}${colors.success('✓')} ${colors.bold(message)}${' '.repeat(Math.ceil(padding/2))}${colors.accent('│')}`);
  console.log(`  ${colors.accent('└' + '─'.repeat(width) + '┘')}`);
  console.log('');
}
```

Display:
```
  ┌─────────────────────────────────────────────────────────┐
  │   ✓ Project my-project created successfully!            │
  └─────────────────────────────────────────────────────────┘
```

### Recommendation Box (Cross-Product Discovery)

```typescript
function showRecommendationBox(lines: string[]) {
  const width = 54;
  
  console.log(`  ${colors.accent('┌' + '─'.repeat(width) + '┐')}`);
  for (const line of lines) {
    const padding = width - stripAnsi(line).length - 2;
    console.log(`  ${colors.accent('│')} ${line}${' '.repeat(padding)}${colors.accent('│')}`);
  }
  console.log(`  ${colors.accent('└' + '─'.repeat(width) + '┘')}`);
}
```

---

## Full Init Flows

### Conductor Init Flow

No numbered steps — just a linear flow of prompts and status messages.

#### Full Interactive Output

```
   ______                __           __            
  / ____/___  ____  ____/ /_  _______/ /_____  _____
 / /   / __ \/ __ \/ __  / / / / ___/ __/ __ \/ ___/
/ /___/ /_/ / / / / /_/ / /_/ / /__/ /_/ /_/ / /    
\____/\____/_/ /_/\__,_/\__,_/\___/\__/\____/_/     
by Ensemble

ℹ Detected: Empty directory
? Is this correct? Yes
? Project name: acme-backend
? Install example agents and ensembles? Yes
? Configure Cloudflare credentials now? Yes
✗ Not authenticated with Cloudflare
? Run 'wrangler login' now? Yes
✓ Authenticated as user@example.com
? Select Cloudflare account:
? Select Cloudflare account: Work (user@company.com)
? How do you want to use AI?
? How do you want to use AI? Cloudflare Workers AI
✓ Created project structure
   ✓ package.json
   ✓ wrangler.toml
   ✓ conductor.config.ts
   ✓ tsconfig.json
   ✓ vitest.config.mts
   ✓ src/index.ts
   ✓ src/lib/helpers.ts
   Creating agents/
   ✓ agents/examples/hello/
   ✓ agents/examples/greet/
   ✓ agents/examples/analyze/
   Creating ensembles/
   ✓ ensembles/hello-world.yaml
   ✓ ensembles/greeting-flow.yaml
   Creating shared folders/
   ✓ prompts/
   ✓ queries/
   ✓ configs/
   Creating tests/
   ✓ tests/unit/agents/
   ✓ tests/integration/
✓ Installed dependencies
   ✓ @ensemble-edge/conductor@1.2.3
   ✓ @ensemble-edge/edgit@0.9.0
   ✓ @cloudflare/vitest-pool-workers@0.8.0
   ✓ typescript@5.6.3
   ✓ vitest@2.1.8
✓ Updated wrangler.toml

┌─────────────────────────────────────────────────────────┐
│                                                         │
│   ✓ Project acme-backend created successfully!          │
│                                                         │
└─────────────────────────────────────────────────────────┘

What was created:
   📁  7 core files
       package.json, wrangler.toml, tsconfig.json...
   🤖  3 example agents
       hello, greet, analyze
   🎼  2 example ensembles
       hello-world, greeting-flow
   📝  Shared folders
       prompts/, queries/, configs/ — version with edgit
   🧪  Test suite
       unit + integration tests with vitest
   📖  Documentation
       README.md with getting started guide

Next steps:
  cd acme-backend
  npm run build
  npx wrangler dev --local-protocol http

Then visit: http://localhost:8787/

📚 Docs: https://docs.ensemble.ai/conductor
```

#### With External AI Provider (OpenAI Example)

```
? How do you want to use AI?
  Cloudflare Workers AI (no API key needed)
❯ External provider (OpenAI, Anthropic, Groq)
  Skip for now
? How do you want to use AI? External provider
? Select provider:
❯ OpenAI
  Anthropic
  Groq
? Select provider: OpenAI
? OpenAI API key: ****************************
✓ Validated API key
? Route through AI Gateway for caching/observability? (y/N)
? Route through AI Gateway for caching/observability? Yes
ℹ No AI Gateways found in your account
ℹ Create one at: https://dash.cloudflare.com/abc123/ai/ai-gateway
? Gateway created? Press Enter when ready...
? Select AI Gateway:
❯ my-gateway
  production-gateway
? Select AI Gateway: my-gateway
✓ AI configured: OpenAI via AI Gateway (my-gateway)
```

---

### Edgit Init Flow (8 Steps)

```typescript
const EDGIT_STEPS = [
  { id: 'validate', name: 'Validate Git' },
  { id: 'detect', name: 'Detect Existing Setup' },
  { id: 'configure', name: 'Configuration' },
  { id: 'scan', name: 'Scan Components' },
  { id: 'register', name: 'Register Components' },
  { id: 'gitignore', name: 'Update .gitignore' },
  { id: 'conductor', name: 'Conductor Integration' },
  { id: 'complete', name: 'Complete' },
];
```

#### Full Interactive Output

```
  🔀 Edgit
  Git-native versioning for AI components

  Step 1 of 8: Validate Git
  ████░░░░░░░░░░░░░░░░░░░░░░░░░░ 1/8
  ◐ Checking git repository...
  ✓ Git repository detected

  Step 2 of 8: Detect Existing Setup
  ████████░░░░░░░░░░░░░░░░░░░░░░ 2/8
  ◐ Checking for existing edgit setup...
  ✓ No existing configuration found

  Step 3 of 8: Configuration
  ████████████░░░░░░░░░░░░░░░░░░ 3/8
  ? Scan for existing components? (Y/n)
  ⏎ Enter to accept default

  ✓ Will scan for components

  Step 4 of 8: Scan Components
  ████████████████░░░░░░░░░░░░░░ 4/8
  ◐ Scanning for components...
     extraction-prompt (prompt)
         prompts/extraction.md
     analysis-prompt (prompt)
         prompts/analysis.md
     user-lookup (query)
         queries/user-lookup.sql
     api-config (config)
         configs/api.yaml

  ✓ Found 4 components

  Step 5 of 8: Register Components
  ████████████████████░░░░░░░░░░ 5/8
  ? Register all 4 discovered components? (Y/n)
  ⏎ Enter to accept default

  ✓ Registered 4 components

  Step 6 of 8: Update .gitignore
  ████████████████████████░░░░░░ 6/8
  ? Add edgit patterns to .gitignore? (Y/n)
  ⏎ Enter to accept default

  ✓ Updated .gitignore

  Step 7 of 8: Conductor Integration
  ████████████████████████████░░ 7/8

  ┌──────────────────────────────────────────────────────┐
  │  Works great with:                                   │
  │                                                      │
  │  🎼 Ensemble CLI    Orchestrate AI workflows on      │
  │                     Cloudflare Workers               │
  │                                                      │
  │  Conductor uses edgit components for AI agents,      │
  │  prompts, and workflows.                             │
  └──────────────────────────────────────────────────────┘

  ? Install @ensemble-edge/conductor? (y/N)
  ⏎ Enter to accept default

  ℹ No problem! Install anytime:
    npm install -g @ensemble-edge/ensemble
    ensemble conductor init

    Learn more: https://docs.ensemble.ai/conductor

  Step 8 of 8: Complete
  ██████████████████████████████ 8/8

  ┌─────────────────────────────────────────────────────────┐
  │   ✓ Edgit initialized successfully!                    │
  └─────────────────────────────────────────────────────────┘

  What was set up:

     🗂️  Registry
         .edgit/components.json
     📄  4 components discovered
         2 prompts, 1 query, 1 config
     📝  .gitignore
         Updated with edgit patterns

  Quick start:

    edgit components list            # View all components
    edgit tag create <name> v1.0.0   # Version a component
    edgit deploy set <name> prod     # Deploy to production

  📚 Docs: https://docs.ensemble.ai/edgit
```

---

### Cloud Init Flow (3 Steps)

```typescript
const CLOUD_STEPS = [
  { id: 'generate', name: 'Generate Key' },
  { id: 'store', name: 'Store Secret' },
  { id: 'enable', name: 'Enable Endpoint' },
];
```

#### Full Interactive Output

```
  ☁️  Ensemble Cloud
  Connect your project to the managed platform

  Step 1 of 3: Generate Key
  ██████████░░░░░░░░░░░░░░░░░░░░ 1/3
  ◐ Generating cloud key...
  ✓ Generated cloud key

  Step 2 of 3: Store Secret
  ████████████████████░░░░░░░░░░ 2/3
  ◐ Storing via wrangler secret...
  ✓ Stored ENSEMBLE_CLOUD_KEY

  Step 3 of 3: Enable Endpoint
  ██████████████████████████████ 3/3
  ✓ Enabled /cloud endpoint

  ┌─────────────────────────────────────────────────────────┐
  │   ✓ Cloud connection ready!                             │
  └─────────────────────────────────────────────────────────┘

  Connection details:

     Endpoint:  https://my-project.workers.dev/cloud
     Key:       eck_live_abc123...xyz789 (masked)

  To connect Ensemble Cloud:

    1. Go to cloud.ensemble.ai
    2. Add Project → Paste endpoint URL
    3. Enter the cloud key when prompted

  📋 Full key (copy now, shown once):

     eck_live_abc123def456ghi789jkl012mno345pqr678stu901vwx234

  📚 Docs: https://docs.ensemble.ai/cloud
```

---

## Non-Interactive Mode (--yes)

When `--yes` flag is passed OR CI environment is detected:

1. **Skip all prompts** — use defaults
2. **No progress bars** — just status lines
3. **No keyboard hints** — not needed
4. **Minimal output** — success/error only
5. **No recommendation boxes** — reduce noise

### CI Detection

```typescript
function isCI(): boolean {
  return !!(
    process.env.CI ||
    process.env.GITHUB_ACTIONS ||
    process.env.GITLAB_CI ||
    process.env.CIRCLECI ||
    process.env.TRAVIS ||
    process.env.JENKINS_URL ||
    process.env.BUILDKITE ||
    !process.stdout.isTTY
  );
}

const isInteractive = !options.yes && !isCI();
```

### Non-Interactive Conductor Init Output

```
  🎼 Conductor

  ✓ Empty directory detected
  ✓ Project name: my-project
  ✓ Including examples
  ✓ Authenticated as user@example.com
  ✓ Using account: Personal
  ✓ AI provider: Cloudflare Workers AI
  ✓ Created project structure
  ✓ Installed dependencies
  ✓ Configured wrangler.toml

  ✓ Project my-project created successfully!

  Next steps:
    cd my-project
    ensemble dev
```

### Non-Interactive Edgit Init Output

```
  🔀 Edgit

  ✓ Git repository detected
  ✓ No existing configuration
  ✓ Found 4 components
  ✓ Registered 4 components
  ✓ Updated .gitignore

  ✓ Edgit initialized successfully!
```

### Non-Interactive Cloud Init Output

```
  ☁️  Ensemble Cloud

  ✓ Generated cloud key
  ✓ Stored ENSEMBLE_CLOUD_KEY
  ✓ Enabled /cloud endpoint

  ✓ Cloud connection ready!

  Endpoint: https://my-project.workers.dev/cloud
  Key: eck_live_abc123...xyz789
```

---

## Error Handling

### Recoverable Errors (Retry Available)

```
  Step 5 of 11: Cloudflare Auth
  ██████████████████████████████ 5/11
  ◐ Checking wrangler authentication...
  ✗ Not authenticated with Cloudflare

  ? Run 'wrangler login' now? (Y/n)
  ⏎ Enter to accept default
```

### Fatal Errors (Cannot Continue)

```
  Step 1 of 8: Validate Git
  ████░░░░░░░░░░░░░░░░░░░░░░░░░░ 1/8
  ◐ Checking git repository...
  ✗ Not a git repository

  This directory is not a git repository.
  
  To fix, run:
    git init

  Then try again:
    edgit init
```

### Validation Errors

```
  Step 3 of 11: Project Name
  ██████████████████░░░░░░░░░░░░ 3/11
  ? Project name: My Project!!
  (lowercase with hyphens)
  Type value, ⏎ Enter to submit

  ✗ Invalid name: must be lowercase with hyphens (e.g., my-project)

  ? Project name: my-project
```

---

## Implementation Notes

### Console Output Helpers

```typescript
// Indentation (2 spaces standard)
const INDENT = '  ';

// Clear current line (for spinner updates)
function clearLine() {
  process.stdout.write('\r' + ' '.repeat(80) + '\r');
}

// Move cursor up N lines
function cursorUp(n: number) {
  process.stdout.write(`\x1b[${n}A`);
}

// Strip ANSI codes (for width calculations)
function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}
```

### Timing

- Spinner frame interval: **80ms**
- Artificial delay for "feel": **none** (don't fake slowness)
- Minimum spinner display: **200ms** (so users see it)

### Terminal Width

- Assume minimum **80 columns**
- Box widths: **54-57 characters** (fits 80 with indent)
- Truncate long paths with `...` if needed

---

## File Summary

When implementing, create these modules:

```
src/ui/
├── colors.ts        # Color definitions
├── banner.ts        # Product banners
├── spinner.ts       # Spinner animation
├── progress.ts      # Step headers, progress bars
├── prompt.ts        # confirm, text, select, password
├── box.ts           # Success boxes, recommendation boxes
├── hints.ts         # Keyboard hints
└── index.ts         # Export all
```

Each init command imports from `ui/` and follows the step patterns exactly.

---

## Checklist for Implementation

- [ ] Colors match specification exactly
- [ ] Banners show correct emoji and tagline
- [ ] Progress bars are 30 chars wide
- [ ] Spinners use ◐◓◑◒ frames at 80ms
- [ ] Keyboard hints appear below prompts
- [ ] Success boxes use proper box-drawing characters
- [ ] Non-interactive mode skips prompts and boxes
- [ ] CI environments auto-detected
- [ ] Error messages are actionable (show fix commands)
- [ ] All steps numbered consistently
- [ ] Cross-product recommendations appear at end

---

*Visual consistency builds trust. Every init should feel like the same product family.*
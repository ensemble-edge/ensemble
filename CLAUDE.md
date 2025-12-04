# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) and other AI assistants when working with code in this repository.

---

## Overview

**Ensemble CLI** (`@ensemble-edge/ensemble`) is the unified command-line interface for the Ensemble ecosystem. It provides a single entry point for:

- **Conductor** — AI workflow orchestration
- **Edgit** — Component versioning
- **Chamber** — Edge data layer
- **Cloud** — Managed platform connection

All Wrangler commands pass through directly, making this CLI a superset of Wrangler functionality.

---

## Architecture

```
ensemble <command>
    │
    ├── Ensemble Products (handled internally)
    │   ├── conductor *    → orchestration commands
    │   ├── chamber *      → data layer commands
    │   ├── cloud *        → platform commands
    │   ├── edgit *        → versioning commands
    │   ├── login          → authentication
    │   └── config         → CLI configuration
    │
    └── Wrangler Passthrough
        ├── dev            → wrangler dev
        ├── deploy         → wrangler deploy
        ├── tail           → wrangler tail
        └── *              → wrangler *
```

---

## Project Structure

```
ensemble/
├── src/
│   ├── index.ts          # Main exports
│   ├── cli.ts            # CLI entry point
│   ├── router.ts         # Command routing logic
│   └── version.ts        # Version constant
├── bin/
│   └── ensemble.js       # CLI executable
├── dist/                 # Build output
├── package.json
├── tsconfig.json
└── README.md
```

---

## Development Commands

```bash
npm install        # Install dependencies
npm run build      # Build TypeScript
npm run dev        # Watch mode
npm test           # Run tests
npm run typecheck  # Type check without emit
```

---

## Git Commit Standards

All commits must follow Conventional Commits format:

```
<type>(<scope>): <subject>

[optional body]
[optional footer]
```

### Commit Types:
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes
- `refactor:` Code refactoring
- `test:` Test additions or changes
- `chore:` Maintenance tasks

### Important:
- **NEVER** append AI attribution to commit messages
- **NEVER** add signatures or "written by" suffixes
- Use clean, professional messages focusing on the changes

---

## Release Workflow

This project uses [Changesets](https://github.com/changesets/changesets) for automated releases.

### Creating a Release

1. **Format code first:**
   ```bash
   npm run format
   ```

2. **Sync with remote:**
   ```bash
   git pull origin main
   ```

3. **Create changeset:**
   ```bash
   npx changeset
   ```

4. **Commit and push:**
   ```bash
   git add .changeset/
   git commit -m "chore: add changeset for X"
   git push origin main
   ```

5. **GitHub Actions** will create a "Version Packages" PR
6. **Merge** that PR when ready to publish to npm

---

## Adding New Commands

### 1. Add to Router

Edit `src/router.ts`:

```typescript
const ENSEMBLE_PRODUCTS = ['conductor', 'chamber', 'cloud', 'edgit', 'new-product'];
```

### 2. Add Handler Function

```typescript
async function runNewProductCommand(args: string[]): Promise<void> {
  // Implementation
}
```

### 3. Add to Switch Statement

```typescript
case 'new-product':
  await runNewProductCommand(args);
  break;
```

---

## Key Design Decisions

1. **Passthrough by Default** — Unknown commands go to Wrangler
2. **Spawn Subprocesses** — Product commands currently spawn their CLIs (will be imported directly later)
3. **Consistent UI** — Uses picocolors for terminal styling
4. **ES Modules** — Uses `.js` extensions in imports

---

## Dependencies

### Runtime
- `commander` — CLI argument parsing
- `picocolors` — Terminal colors (lightweight)

### Development
- `typescript` — Type safety
- `vitest` — Testing
- `prettier` — Code formatting

---

## Resources

- [Repository](https://github.com/ensemble-edge/ensemble)
- [Conductor Docs](https://docs.ensemble.ai/conductor)
- [Edgit Docs](https://docs.ensemble.ai/edgit)
- [Ensemble Docs](https://docs.ensemble.ai)

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
│   ├── version.ts        # Version constant
│   ├── ui/               # Shared UI components
│   │   ├── index.ts      # UI exports
│   │   ├── colors.ts     # Brand colors & ANSI mapping
│   │   ├── spinner.ts    # Animated spinners
│   │   ├── progress.ts   # Progress bars & step headers
│   │   ├── hints.ts      # Keyboard input hints
│   │   ├── box.ts        # Box drawing utilities
│   │   └── logger.ts     # Logging & banners
│   └── __tests__/        # Test files
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

## 🚨 CRITICAL: RELEASE WORKFLOW - READ THIS FIRST 🚨

This project uses [Changesets](https://github.com/changesets/changesets) for automated releases.

## 🤖 CLAUDE CODE: Release Workflow (MANDATORY STEPS)

**When user asks to create a release, ALWAYS follow this exact sequence:**

### Step 0: Run Prettier (CRITICAL - DO THIS FIRST!)
```bash
cd /workspace/ensemble/ensemble
npm run format
```

**Why**:
- CI/CD tests will fail if code is not properly formatted
- Prettier auto-fixes formatting issues before committing
- **NEVER skip this step** - always format before creating changeset

### Step 0b: Run Tests (CRITICAL - DO THIS BEFORE PUSHING!)
```bash
cd /workspace/ensemble/ensemble
npm test
```

**Why**:
- CI/CD will fail if tests don't pass
- Catches bugs locally BEFORE pushing to remote
- Saves time by avoiding failed GitHub Actions runs
- **NEVER skip this step** - always run tests before creating changeset

**If tests fail**: Fix the failing tests before proceeding. Do NOT push code with failing tests.

### Step 1: Sync with Remote (CRITICAL - DO THIS AFTER TESTS PASS!)
```bash
cd /workspace/ensemble/ensemble
git pull origin main
```

**If pull fails with "divergent branches":**
```bash
git pull --no-rebase origin main  # Use merge strategy
```

**Why**:
- Prevents merge conflicts later
- Ensures you're working on latest version
- Remote may have been updated (Version Packages PR merged, etc.)
- **NEVER skip this step** - always pull before creating changeset

### Step 2: Check Current Version
```bash
grep '"version"' package.json
```
**Output the current version to user**

### Step 3: Ask User for Version Bump
**ALWAYS ASK - NEVER ASSUME**

Show user this table and ask which bump type:
```
Current version: X.Y.Z

Bump Options:
- patch (X.Y.Z+1) - Bug fixes only, no new features
- minor (X.Y+1.0) - New features, backwards compatible
- major (X+1.0.0) - Breaking changes

What type of bump do you want?
```

**Wait for user response. Do not proceed without confirmation.**

### Step 4: Create Changeset
Only after user confirms, create changeset file manually:

```bash
# Create .changeset/descriptive-name.md
```

**Format:**
```markdown
---
"@ensemble-edge/ensemble": patch|minor|major
---

Brief description of changes
```

### Step 5: Commit Changeset
```bash
git add .changeset/
git commit -m "chore: add changeset for X"
```

### Step 6: Push to Remote
```bash
git push origin main
```

### Step 7: Inform User
Tell user:
- ✅ Changeset pushed
- ✅ GitHub Actions will create "Version Packages" PR
- ✅ Merge that PR when ready to publish to npm
- ✅ After merge completes and npm publish succeeds, run Step 8

### Step 8: Sync After Release (CRITICAL - DO THIS AFTER MERGE!)
```bash
cd /workspace/ensemble/ensemble
git pull origin main
```

**Why**:
- The "Version Packages" PR updates package.json, CHANGELOG.md, and deletes changesets
- Your local branch is now behind remote after the PR merge
- Pulling ensures you're working with the latest released version
- Prevents "diverged branches" errors on next release
- **ALWAYS do this after confirming npm publish succeeded**

## 🚨 Common Problems and Solutions

### Problem: "Remote has diverged" or "fetch first"
**Solution:**
```bash
git fetch origin
git log --oneline origin/main -5  # See what changed
git merge origin/main  # Merge remote changes
# Then continue with release
```

### Problem: Merge conflict in package.json
**Cause:** Working on old version while remote moved forward

**Solution:**
```bash
# Accept remote version
git checkout --theirs package.json
git add package.json
git commit -m "chore: resolve version conflict"
# Then create changeset on TOP of new version
```

### Problem: User says "version X.Y.Z" but semver doesn't match change type
**Solution:** ASK USER to confirm:
```
⚠️ Semver Check:
- You requested: X.Y.Z (patch)
- Changes include: New features (should be minor)

Do you still want patch, or should I use minor?
```

## Never Do These:
- ❌ **DO NOT push without running tests first** - always `npm test` before push
- ❌ **DO NOT manually edit package.json version or CHANGELOG.md**
- ❌ **DO NOT manually create or delete tags**
- ❌ **DO NOT merge Version Packages PR if tests are failing**
- ❌ **DO NOT create changeset without git pull first**
- ❌ **DO NOT assume version bump type - ALWAYS ask user**

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

# @ensemble-edge/ensemble

## 0.1.5

### Patch Changes

- 65128e5: CLI improvements and documentation updates:
  - Add integrated init wizard with project type selection (Conductor/Edgit)
  - Add interactive prompts for package manager selection
  - Auto-detect package manager from lockfiles
  - Auto-install dependencies after project initialization
  - Update README with Cloudflare-native positioning
  - Standardize CLI patterns to use npx @ensemble-edge/ensemble
  - Remove deprecated conductor command (now uses @ensemble-edge/conductor)
  - Remove bundled templates (now pulled from @ensemble-edge/conductor)

## 0.1.4

### Patch Changes

- dd1d37d: Add bundled conductor templates and simplify init command
  - Bundle conductor project templates in ensemble CLI package
  - Simplify conductor init to use bundled templates instead of npm pack
  - Add conductor templates directory with project scaffolding
  - Fix cloud command handler path

## 0.1.3

### Patch Changes

- c10f1e3: Add Spinner.warn method and decouple edgit via subprocess spawning

  **Spinner Enhancement:**
  - Added `warn()` method to Spinner interface in `src/ui/spinner.ts`
  - Displays warning icon (⚠) with optional custom text
  - Maintains consistent API with existing `success()` and `error()` methods

  **Edgit Version Decoupling:**
  - Changed edgit integration from direct import to subprocess spawning via npx
  - Removed `@ensemble-edge/edgit` from dependencies
  - Updated `runEdgit()` in router.ts to use `spawnCommand("npx", ["edgit", ...args])`
  - Provides helpful install message if edgit is not found

  **Router Improvements:**
  - Edgit commands now pass through to npx subprocess
  - Allows ensemble and edgit to version independently
  - Uses edgit's own help formatting and command routing

  **Test Updates:**
  - Updated router tests to verify subprocess spawning behavior
  - Added comprehensive test coverage for edgit npx spawning
  - Tests verify all edgit subcommands route correctly through npx

  This patch resolves the CI failure caused by importing `runCLI` from an
  unpublished version of edgit, and establishes a sustainable pattern for
  version-independent CLI tool integration.

## 0.1.2

### Patch Changes

- 3154e4d: Add shared UI module with colors, spinners, progress bars, and box utilities. Add comprehensive command routing with help for all products. Add 62 tests for router, CLI, and UI modules. Update documentation.

## 0.1.1

### Patch Changes

- 890aa19: Add package-lock.json for reproducible builds

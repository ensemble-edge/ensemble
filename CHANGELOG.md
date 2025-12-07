# @ensemble-edge/ensemble

## 0.1.11

### Patch Changes

- 5ef3f5b: Fix version command to show scan location and skip internal monorepo packages
  - Display "Scanning <path>" to clarify where projects are being discovered
  - Skip packages using workspace:\* versions (internal monorepo packages)
  - Improved messaging when no projects are found

## 0.1.10

### Patch Changes

- 7d4c008: Add upgrade command and landscape scanning for --version
  - New `ensemble upgrade` command to manage updates across multiple Ensemble projects
  - Enhanced `--version` to show tree view of all discovered projects with update status
  - Landscape scanning recursively finds Conductor and Edgit projects (up to 3 levels deep)
  - Interactive upgrade selection with `--all`, `--yes`, `--dry-run`, and `--global` options
  - Added hint for using "." in init wizard for current directory

## 0.1.9

### Patch Changes

- 1681fa9: Add `ensemble info` command with interactive product selection
  - Interactive menu to select Conductor, Edgit, or Cloud
  - `status` is an alias for `info`
  - Calls product CLIs for data (single source of truth architecture)
  - `ensemble edgit status` passes through to git status

## 0.1.8

### Patch Changes

- a9013fe: ### Bug Fix
  - **Version display** - Fixed `--version` showing "v0.1.0" instead of the actual published version. Now reads dynamically from package.json, so future releases will automatically display the correct version.

## 0.1.7

### Patch Changes

- 4398787: ### New Features
  - **Interactive status commands** - All status commands (conductor, edgit, cloud) now detect uninitialized state and offer Y/n prompts to initialize interactively.
  - **Multiple output modes** - Status commands support `--json` for CI/scripting and `--compact` for minimal output. All modes properly handle uninitialized state with appropriate error fields.
  - **CI-safe behavior** - JSON and compact modes return immediately without interactive prompts. Non-interactive environments (CI) show hints instead of prompts.

## 0.1.6

### Patch Changes

- 9da7073: ### Bug Fixes
  - **Zero-config local development** - The AI binding in `wrangler.toml` is now commented out by default, allowing `pnpm run dev` to work immediately without Cloudflare authentication. Users can enable Workers AI via `ensemble configure` when ready.
  - **Init wizard reliability** - Fixed the wizard flow with proper operation order (create structure → install deps), fail-fast behavior on errors, and better directory handling with clear error messages.

  ### Improvements
  - **ASCII art banners** - Added product-specific ASCII art banners (Conductor, Edgit, Cloud, Ensemble) with automatic fallback to emoji banners on narrow terminals (<60 cols).
  - **Cleaner wizard output** - Single banner on startup, silent dependency installation with clean summary, conditional success messages based on actual outcome.
  - **Removed placeholder commands** - Cleaned up unused login and config command stubs.

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

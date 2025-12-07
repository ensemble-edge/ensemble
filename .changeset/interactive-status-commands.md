---
"@ensemble-edge/ensemble": patch
---

### New Features

- **Interactive status commands** - All status commands (conductor, edgit, cloud) now detect uninitialized state and offer Y/n prompts to initialize interactively.

- **Multiple output modes** - Status commands support `--json` for CI/scripting and `--compact` for minimal output. All modes properly handle uninitialized state with appropriate error fields.

- **CI-safe behavior** - JSON and compact modes return immediately without interactive prompts. Non-interactive environments (CI) show hints instead of prompts.

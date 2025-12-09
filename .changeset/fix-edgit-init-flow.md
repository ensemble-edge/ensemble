---
"@ensemble-edge/ensemble": patch
---

Fix edgit init to work as a global tool instead of project scaffolder

- `ensemble edgit init` no longer asks for a project name
- Checks if edgit is installed globally and offers to install if missing
- Checks if inside a git repo and shows helpful instructions if not
- Delegates to native `edgit init` for component versioning setup
- Edgit is a global CLI tool that operates on existing repos, not a scaffolder

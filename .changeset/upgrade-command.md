---
"@ensemble-edge/ensemble": patch
---

Add upgrade command and landscape scanning for --version

- New `ensemble upgrade` command to manage updates across multiple Ensemble projects
- Enhanced `--version` to show tree view of all discovered projects with update status
- Landscape scanning recursively finds Conductor and Edgit projects (up to 3 levels deep)
- Interactive upgrade selection with `--all`, `--yes`, `--dry-run`, and `--global` options
- Added hint for using "." in init wizard for current directory

---
"@ensemble-edge/ensemble": patch
---

Add setup alias and internal tag command handling

- Add `ensemble setup` as an alias for `ensemble configure`
- Handle `edgit tag` subcommands (create, move, list, delete) internally
- Handle `edgit push` command internally with --tags support
- Fix test for internal tag command routing

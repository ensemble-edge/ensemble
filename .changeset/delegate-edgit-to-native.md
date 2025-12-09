---
"@ensemble-edge/ensemble": patch
---

Refactor edgit command routing to delegate to native edgit CLI

- `ensemble edgit` commands (except `info` and `status`) now delegate to native edgit CLI
- Fixes tag operations that require component registry integration
- Native edgit handles proper 4-level tag format and prefix inference
- `ensemble edgit info` still provides rich UI with banners
- `ensemble edgit status` passes through to git

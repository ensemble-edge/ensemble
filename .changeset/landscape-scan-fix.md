---
"@ensemble-edge/ensemble": patch
---

Fix version command to show scan location and skip internal monorepo packages

- Display "Scanning <path>" to clarify where projects are being discovered
- Skip packages using workspace:* versions (internal monorepo packages)
- Improved messaging when no projects are found

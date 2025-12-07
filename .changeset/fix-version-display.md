---
"@ensemble-edge/ensemble": patch
---

### Bug Fix

- **Version display** - Fixed `--version` showing "v0.1.0" instead of the actual published version. Now reads dynamically from package.json, so future releases will automatically display the correct version.

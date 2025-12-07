---
"@ensemble-edge/ensemble": patch
---

Add conductor start/stop/restart commands with smart dev server management

- Auto-detects dev containers and binds to 0.0.0.0
- Auto-finds available port if default is in use
- Tracks PID for clean stop command
- Graceful shutdown with SIGTERM, fallback to SIGKILL

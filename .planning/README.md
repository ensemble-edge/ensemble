# .planning Directory

This directory contains planning documents, development standards, and strategic planning materials organized into three areas.

## Structure

```
.planning/
├── README.md                    # This file
│
├── todos/                      # Tactical: Day-to-day tasks
│   └── .gitkeep
│
├── strategy/                   # Strategic: Long-term planning
│   └── .gitkeep
│
└── standards/                  # Reference: Guidelines & checklists
    └── .gitkeep
```

## Purpose

Store working documents organized by type:

### Strategy (`strategy/`)
Long-term planning and project direction:
- Phase summaries and plans
- Project checkpoints and milestones
- Roadmaps and vision documents
- Architecture decision records

### Todos (`todos/`)
Day-to-day task management:
- Current work items
- Backlog and future tasks
- Bug tracking
- Quick action items

### Standards (`standards/`)
Reusable reference materials:
- Code review checklists
- Development guidelines
- Testing standards
- Security requirements

## Usage

### For Developers
- Use `strategy/` and `standards/` for team-wide planning and guidelines (committed to Git)
- Use `todos/` for personal notes and task lists (can be local-only if preferred)

### For AI Assistants
**IMPORTANT**: When creating planning documents, summaries, or phase reports, ALWAYS place them in the appropriate `.planning/` subdirectory:

**Strategic planning** → `.planning/strategy/`
```bash
# ✅ Good - Committed to Git for team
.planning/strategy/PHASE0_SUMMARY.md
.planning/strategy/CHECKPOINT.md
.planning/strategy/roadmap-2024.md
```

**Development standards** → `.planning/standards/`
```bash
# ✅ Good - Committed to Git for team
.planning/standards/code-review-standard.md
.planning/standards/architecture-decisions/adr-001.md
```

**Personal tasks** → `.planning/todos/`
```bash
# ✅ Good
.planning/todos/current-tasks.md
.planning/todos/backlog.md
```

**Never in project root:**
```bash
# ❌ Bad (don't put these in root or src/)
PHASE0_SUMMARY.md
TODO.md
NOTES.md
```

## Excluded from npm

The entire `.planning/` directory is in `.npmignore` - users installing the package don't need internal planning documents.

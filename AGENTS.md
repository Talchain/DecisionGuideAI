# Repository Agent Notes

## UI Update Validation
- When asked to validate UI updates from Claude Code (or any agent), use `docs/testing/canvas-interaction-codex-handoff.md` as the default runbook.
- Treat the runbook as generic first, then apply module-specific checks (canvas appendix) when relevant.
- Prefer a stable local preview (`build + preview`) over dev server if Vite serves `504 Outdated Optimize Dep`.

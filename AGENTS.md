# Repository Agent Notes

## UI Update Validation
- When asked to validate UI updates from Claude Code (or any agent), use `docs/testing/canvas-interaction-codex-handoff.md` as the default runbook.
- Treat the runbook as generic first, then apply module-specific checks (canvas appendix) when relevant.
- Prefer a stable local preview (`build + preview`) over dev server if Vite serves `504 Outdated Optimize Dep`.

## Brief close-out conventions

Established in Brief 5.2 close-out (2026-04-20) to prevent "complete but partial" ambiguity in subsequent hotfix briefs.

1. **One runtime artefact per acceptance check.** Code-level verification + green tests are necessary but not sufficient. Every acceptance-criterion row in the brief's close-out doc must record one concrete artefact from the deployed bundle: a screenshot, DOM selection excerpt, interaction-log line, or console assertion output. Artefacts live alongside the brief as `docs/brief-<N>-staging-walkthrough.md` (see `docs/brief-5_2-staging-walkthrough-template.md` for the template structure).

2. **Every deferral has a trigger or a closed-not-planned disposition.** No vague "future opportunity" parking. Registered follow-ups state the specific change or discovery that unblocks them; closed items state the re-open condition. Owner or surface area named.

3. **Final-review docs pass the consistency check before close-out ships.** Run `bash scripts/check-closeout-doc-consistency.sh docs/brief-<N>-final-review.md` (added in Brief 5.2 close-out round 2). It flags stale status tokens (`(pending)`, `(this commit)`, `non-interactive` where the final contract is interactive, `awaiting push` when the branch has landed). Doc must be green before handing off.

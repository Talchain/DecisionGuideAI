# Snapshot Manager — Accessible Popover (flag OFF)

## Scope
- Add `VITE_FEATURE_SNAPSHOT_MANAGER=false` (default OFF) in `.env.example` and plumb `snapshotManager` via `src/lib/flags.tsx`.
- `CombinedSandboxRoute.tsx` header: add `HeaderSnapshotManagerControl` gated by `flags.snapshotManager`.
  - Accessible popover `role="dialog"` with labelled heading, focus trap, Esc closes, focus returns to trigger.
  - `Create`, `Rename`, `Restore`, `Delete` wired to `GraphProvider` snapshot API.
  - On `Restore`, create backup and show Undo banner (`RestoreUndoButton`) consistent with other flows.
  - Local polite announcer: `<div aria-live="polite" data-dg-snapshots-status>`.
  - Stable selectors: `data-dg-snapshots`, `data-dg-snapshot-item`, `data-dg-snapshot-rename`.
- Ensure `GraphProvider` is mounted when `snapshotManager` flag is ON.

## Telemetry
- Emitted by `GraphProvider` snapshot API (name-only with `{ decisionId, route:'combined', sessionId }`):
  - `sandbox_snapshot_create`
  - `sandbox_snapshot_rename`
  - `sandbox_snapshot_restore`
  - `sandbox_snapshot_delete`

## A11y
- Dialog has labelled heading, focus trap on open, Esc closes, and focus restoration to the trigger.
- Only local polite live region is used for snapshot status. The score’s single global live region remains in `ScorePill`.
- Overlays remain non-blocking.

## Tests (telemetry-first)
- `src/whiteboard/__tests__/snapshots.panel.rtl.test.tsx`
  - Open popover → Create → Rename → Restore → Delete.
  - Assert telemetry via `useTelemetry` mock spy.
  - Optionally assert Undo banner on restore.

## QA
- With `VITE_FEATURE_SNAPSHOT_MANAGER=true`, open the Snapshots popover:
  - Create a snapshot → see item appear and local announcer update.
  - Rename → label updates; telemetry fired.
  - Restore → Undo banner appears; telemetry fired.
  - Delete → Undo delete banner appears; telemetry fired.

## Rollback
- Revert this PR; feature is flag-gated OFF by default.

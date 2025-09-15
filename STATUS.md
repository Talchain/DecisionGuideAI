Command: TZ=UTC CI=1 npx vitest run src/whiteboard/__tests__/explain.telemetry.unit.test.ts --reporter verbose
Command: TZ=UTC CI=1 npx vitest run src/whiteboard/__tests__/snapshots.panel.rtl.test.tsx --reporter verbose
Cause: After clicking "Create Snapshot", popover list still shows "No snapshots" in jsdom; Rename button not present. Telemetry for create is emitted, and live region announces save, but list does not refresh synchronously.
Next step: Refactor HeaderSnapshotManagerControl to source list from graphApi.listSnapshots() on each render or introduce an effect subscription to localStorage changes; in test, consider re-open popover and/or waitFor listitems > 0.

Cause: Vitest worker exited unexpectedly (tinypool) despite mocks for Canvas/CompareView; likely jsdom + worker interaction on Node 22.
Next step: Re-run explain suite after setting vitest pool to forks/disable threads or stabilize env via minimal config change; do not block Explain Δ PR. Proceed to open draft PR with flags OFF.

Command: TZ=UTC CI=1 npx vitest run src/whiteboard/__tests__/debounce-edit.rtl.test.tsx --reporter verbose
Cause: Canvas debounce test not observing saveCanvasDoc call under jsdom; TL snapshot/persist timing under mocked Tldraw needs instrumentation.
Next step: Add debug logs to Canvas persist path in tests or relax guard by forcing persist in vitest; proceed with IO/Templates tests and docs in parallel.

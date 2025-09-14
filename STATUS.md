Command: TZ=UTC CI=1 npx vitest run src/whiteboard/__tests__/explain.telemetry.unit.test.ts --reporter verbose
Cause: Vitest worker exited unexpectedly (tinypool) despite mocks for Canvas/CompareView; likely jsdom + worker interaction on Node 22.
Next step: Re-run explain suite after setting vitest pool to forks/disable threads or stabilize env via minimal config change; do not block Explain Δ PR. Proceed to open draft PR with flags OFF.

Command: TZ=UTC CI=1 npx vitest run src/whiteboard/__tests__/debounce-edit.rtl.test.tsx --reporter verbose
Cause: Canvas debounce test not observing saveCanvasDoc call under jsdom; TL snapshot/persist timing under mocked Tldraw needs instrumentation.
Next step: Add debug logs to Canvas persist path in tests or relax guard by forcing persist in vitest; proceed with IO/Templates tests and docs in parallel.

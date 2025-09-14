Command: TZ=UTC CI=1 npx vitest run src/whiteboard/__tests__/explain.telemetry.unit.test.ts --reporter verbose
Cause: Vitest worker exited unexpectedly (tinypool) despite mocks for Canvas/CompareView; likely jsdom + worker interaction on Node 22.
Next step: Re-run explain suite after setting vitest pool to forks/disable threads or stabilize env via minimal config change; do not block Explain Δ PR. Proceed to open draft PR with flags OFF.

Command: TZ=UTC CI=1 npx vitest run --pool=forks --maxWorkers=1 src/whiteboard/__tests__/explain.telemetry.unit.test.ts --reporter verbose
Cause: tinypool RangeError (minThreads/maxThreads conflict) with the CLI flags in current Vitest version.
Next step: If needed, configure single-process at config level (vitest.config.ts test.pool='forks' + poolOptions.threads { min:1, max:1 }) for this one suite; skip for now and keep PR unblocked.

Command: TZ=UTC CI=1 npx vitest run src/whiteboard/__tests__/debounce-edit.rtl.test.tsx --reporter verbose
Cause: Canvas debounce test not observing saveCanvasDoc call under jsdom; TL snapshot/persist timing under mocked Tldraw needs instrumentation.
Next step: Add debug logs to Canvas persist path in tests or relax guard by forcing persist in vitest; proceed with IO/Templates tests and docs in parallel.

Command: TZ=UTC CI=1 npx vitest run src/sandbox/__tests__/io.import.rtl.test.tsx --reporter verbose
Cause: Polite announce text not observed (sr-only remains empty) after async file import; likely due to jsdom event pooling/async IIFE timing. Import path otherwise executes without unhandled errors after file-read and input reset fixes.
Next step: In a follow-up, set announce before reload and/or await a microtask flush; consider asserting telemetry/name-only instead of live text. Do not block PRs; proceed to Templates unit/RTL and Compare legend.

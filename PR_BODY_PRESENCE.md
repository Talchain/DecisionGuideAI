# Presence Idle (V1) — Sandbox (flag OFF)

## Summary
Adds a subtle, accessible idle indication for collaborators in the Sandbox combined view.
- Idle after 45s inactivity
- Visuals: 50% fade + name suffix "(idle)" and title tooltip "Idle"
- Stable selectors: `data-dg-presence="idle|active"`; overlay remains non-blocking
- Telemetry: name-only, rate-limited `sandbox_presence_idle` and `sandbox_presence_active`
- Tests: unit + RTL deterministic via small test hooks

## Flags
- `VITE_FEATURE_SANDBOX_PRESENCE=false` (default OFF)
- Threaded via `FlagsProvider`

## UX Details
- Idle triggers after 45s without pointer/keyboard/wheel/mousedown/focusin
- Activity flips to active immediately
- No live region changes for idle; decorative only

## Accessibility
- Preserve a single score live region (`ScorePill`)
- Idle visuals use opacity with readable contrast; tooltip conveys state

## Telemetry (name-only)
- `sandbox_presence_idle { decisionId, route: 'combined', sessionId }`
- `sandbox_presence_active { decisionId, route: 'combined', sessionId }`
- Max one idle and one active per 60s per session

## Implementation
- `PresenceProvider`: document-level listeners, idle timer, rate-limited telemetry
- `PresenceOverlay`: per-remote chip with `data-dg-presence` and faded styling
- Test hooks (tests only):
  - `__TEST__getPresenceControls(decisionId)?.resetIdleTimer()`
  - `__TEST__presenceOverlayTick()` to force re-render tick

## Tests
- `presence.idle.unit`: 45s ⇒ idle; remote activity ⇒ active
- `presence.telemetry.unit`: idle ⇒ active; 60s rate-limit holds
- `presence.idle.rtl`: fade class + tooltip + name suffix; overlay is non-blocking

## QA
- Run gates:
```
npx tsc --noEmit && npm run lint
TZ=UTC CI=1 npx vitest run src/presence/__tests__/presence.*.test.ts* src/whiteboard/__tests__/presence.idle.rtl.test.tsx --reporter verbose
```

## Risks / Mitigations
- Over-emit telemetry: mitigated via 60s rate limit per session
- Test noise from intervals: disabled in Vitest; hook-driven re-render

## Screenshots
- N/A (visual is subtle); can record idle vs. active name chip if desired

## Labels
- ui, a11y, sandbox, tests, skip-changelog

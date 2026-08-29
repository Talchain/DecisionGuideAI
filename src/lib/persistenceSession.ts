/**
 * Whether THIS SESSION has a server identity — readable without React context.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * `useConversation` must refuse to mint a scenario UUID for a signed-in user
 * (it would hand them a phantom decision — see that hook's mint guard). It
 * cannot answer the question itself:
 *
 *   - `useAuth()` throws without an AuthProvider, and ~150 specs render
 *     `useConversation` without one.
 *   - Putting the flag on the canvas store works, but it is NOT canvas state:
 *     it survives `reset()` and `resetCanvas` by exception, which is a smell.
 *     It also widens `CanvasState`, and that object's property COUNT is
 *     embedded verbatim in a pre-existing TS2345 diagnostic's message
 *     ("...265 more..."). Adding a field renumbered it, changing that
 *     diagnostic's IDENTITY and tripping the typecheck gate's identity
 *     ratchet — a real alarm, firing correctly, for a type error this work
 *     never touched. Measured, not assumed.
 *
 * So it lives here: one module-scoped boolean, one writer, no React, no store.
 *
 * ── THIS IS A MIRROR, AND MIRRORS DRIFT (CLAUDE.md trap 12) ──────────────────
 * The VALUE is derived in exactly one place — `CanvasMVP`'s sync effect, from
 * the canonical `lib/persistenceActive` predicate that `useScenario` already
 * computed. Nothing else may call `setPersistenceSessionActive`. If a second
 * writer ever appears, that is the drift.
 *
 * Defaults FALSE — "guest", the posture under which the lazy mint is correct —
 * so any context that never syncs it behaves exactly as it did before.
 */
let persistenceSessionActive = false

/** ⚠ ONE CALLER ONLY: `CanvasMVP`'s sync effect. */
export function setPersistenceSessionActive(active: boolean): void {
  persistenceSessionActive = active
}

/** Does this session persist to the server? */
export function isPersistenceSessionActive(): boolean {
  return persistenceSessionActive
}

/**
 * Test-only reset. Module state outlives a component tree, so a spec that sets
 * it must put it back or it leaks into every later test in the same file.
 */
export function __resetPersistenceSessionForTests(): void {
  persistenceSessionActive = false
}

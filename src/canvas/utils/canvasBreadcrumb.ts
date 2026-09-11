/**
 * canvasBreadcrumb — the canvas's PRODUCTION-SAFE diagnostic channel.
 *
 * ⭐⭐ WHY THIS IS A MODULE RATHER THAN A PRIVATE FUNCTION IN `ReactFlowGraph`.
 *
 * It lived there, unexported, and that is a large part of why one incident has
 * stayed open. `layoutFailureIsSurvivable.spec.ts` records it: a user's canvas
 * shows "Layout failed. Try again.", and *"IT DOES NOT PIN WHY ELK THREW. That
 * cause is open and may stay open"* — bad graph input was REFUTED by execution,
 * and the timing theory was refuted too.
 *
 * The reason it stayed open is mundane. `handleLayoutWithRecovery`'s catch held
 * the rejection and logged it **under `import.meta.env.DEV` only**. The incident
 * happens on STAGING, which is a production build, so the one artefact that
 * could name the cause was discarded every single time it occurred.
 *
 * ⚠ AND `console.warn` WOULD NOT HAVE BEEN ENOUGH EITHER. A user hitting this
 * is not holding devtools open, and by the time anyone asks, the console is
 * gone. `window.__SAFE_DEBUG__.logs` is a RING the page keeps, so the evidence
 * is still there to be read when someone thinks to look — which is the whole
 * difference between a diagnosable incident and an open one.
 *
 * ⚠⚠ THERE IS A SECOND COPY, AND IT IS DISCLOSED RATHER THAN SILENTLY LEFT.
 * `ReactFlowGraph.tsx` keeps a private `logCanvasBreadcrumb` with one extra
 * behaviour this one does not have: it ALSO mirrors to `console.warn` when the
 * canvas debug mode is not 'normal'. Two copies of one idea is the mirror this
 * estate keeps paying for (CLAUDE.md trap 12), so it is named here rather than
 * left for someone to find.
 *
 * It is NOT merged in this change, deliberately: folding them means either
 * importing the debug-mode reader into a module every failure path touches, or
 * quietly dropping that console mirror from a hot file — and this change's job
 * is to make ONE open incident diagnosable, not to refactor the canvas's
 * diagnostics. The ring format is identical, so both write to one place and a
 * reader needs no knowledge of which produced an entry.
 *
 * ⛔ IT MUST NEVER THROW. A diagnostic that breaks the surface it is diagnosing
 * is worse than none, so every path is inside a `try`, and a full ring is a
 * silent no-op rather than an error.
 */

/** The cap the canvas has always used. A full ring stops recording, silently. */
const MAX_BREADCRUMBS = 2000

export function logCanvasBreadcrumb(message: string, data?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return
  try {
    const win = window as unknown as { __SAFE_DEBUG__?: { logs?: unknown[] } }
    win.__SAFE_DEBUG__ ||= { logs: [] }
    const debug = win.__SAFE_DEBUG__
    const logs = Array.isArray(debug.logs) ? debug.logs : null
    if (!logs || logs.length >= MAX_BREADCRUMBS) return
    logs.push({ t: Date.now(), m: `canvas:trace:${message}`, data })
  } catch {
    /* a diagnostic may not break the thing it diagnoses */
  }
}

/**
 * Reduce an unknown rejection to something worth keeping.
 *
 * ⚠ THE STACK IS THE POINT, and it is why this is not just `String(err)`. The
 * open question is which elkjs call path rejects; a bare message ("undefined is
 * not an object") names nothing. Truncated, because a ring entry competing with
 * the rest of the session's breadcrumbs helps nobody.
 */
export function describeError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: (err.stack ?? '').slice(0, 1200) }
  }
  if (err && typeof err === 'object') {
    try {
      return { name: 'non_error_object', message: JSON.stringify(err).slice(0, 600) }
    } catch {
      return { name: 'non_error_object', message: '[unserialisable]' }
    }
  }
  return { name: typeof err, message: String(err).slice(0, 600) }
}

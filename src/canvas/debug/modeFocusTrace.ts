/**
 * modeFocusTrace — WHICH ELEMENT HELD FOCUS WHEN THE MODE GESTURE WAS
 * SWALLOWED.
 *
 * ─── The incident this exists to close ─────────────────────────────────────
 * Reported repeatedly, always the same shape: select/grab "doesn't work until
 * I press Escape", on FIRST use, and "not every time". Three rounds of probes
 * failed to reproduce it, and the reason is the interesting part.
 *
 * ⭐⭐ OBSERVING IT FIXES IT. Every workaround the reporter found — pressing
 * Escape, clicking elsewhere, and OPENING THE CONSOLE to paste a probe —
 * RELEASES FOCUS FROM A TEXT FIELD, which is the fix. In Chrome, window blur
 * also blurs the focused element, so the act of opening devtools to look at
 * `document.activeElement` destroys the state being looked at. A console
 * one-liner cannot work here, and three captures taken that way all came back
 * `BODY` — i.e. already repaired, every time.
 *
 * So the recording has to happen BEFORE anyone looks. That is this module: the
 * page records at the decisive moment, the reporter reproduces, and only THEN
 * opens the console to read `window.__SAFE_DEBUG__.logs`.
 *
 * ─── Why it is not DEV-gated ───────────────────────────────────────────────
 * `canvasBreadcrumb`'s own header records the lesson: a layout incident stayed
 * open for months because its only artefact was logged under
 * `import.meta.env.DEV`, while the incident happened on STAGING — a production
 * build — so the evidence was discarded every single time it occurred. This
 * writes to the same ring, unconditionally, for exactly that reason.
 *
 * ─── What it is, and what it must never become ─────────────────────────────
 * ⛔ IT IS A DIAGNOSTIC, NOT A FIX, and nothing may branch on it. It changes no
 * behaviour, gates nothing, and is deleted once the focus-holder is named.
 *
 * ⛔ IT NEVER RECORDS WHAT THE USER TYPED. Elements are described by tag, test
 * id, id and first class only — never `value`, never `textContent`. The whole
 * point is a composer holding focus; logging a composer's CONTENTS to a ring
 * a support conversation may quote would be a privacy defect shipped to find
 * a usability one.
 *
 * ⛔ IT MUST NEVER THROW, for the same reason the breadcrumb channel must not:
 * a diagnostic that breaks the surface it is diagnosing is worse than none.
 *
 * Bounded to the opening gestures of a session, because the defect is
 * first-use and an unbounded trace would bury it in its own noise.
 */
import { logCanvasBreadcrumb } from '../utils/canvasBreadcrumb'

/**
 * How many gestures are recorded per page load.
 *
 * The report is "first use", so the opening handful is where the answer is. A
 * larger window would push the first entries out of a shared ring behind
 * ordinary session traffic and make the artefact harder to read, not richer.
 */
const MAX_TRACED_GESTURES = 16

let traced = 0

/** Reset between tests. Not called by production code. */
export function __resetModeFocusTraceForTests(): void {
  traced = 0
}

/**
 * Describe an element for the trace: enough to NAME it, never enough to leak
 * what is in it. `value`/`textContent` are deliberately absent — see header.
 */
export function describeFocusTarget(el: Element | null | undefined): Record<string, unknown> {
  if (!el) return { present: false }
  const node = el as HTMLElement
  return {
    present: true,
    tag: node.tagName,
    testId: node.getAttribute?.('data-testid') ?? null,
    id: node.id || null,
    cls:
      node.className && typeof node.className === 'string'
        ? node.className.split(/\s+/)[0]
        : null,
    // The predicate that actually decides whether a canvas shortcut is
    // swallowed. Recorded as the ANSWER, so reading the trace needs no
    // knowledge of the guard's internals.
    isTextEntry:
      node.tagName === 'INPUT' || node.tagName === 'TEXTAREA' || node.isContentEditable === true,
  }
}

/**
 * Record one mode-relevant gesture.
 *
 * `kind` names the site, `swallowed` says whether the guard stopped it, and
 * the two element descriptions let a reader see whether `event.target` and
 * `document.activeElement` AGREE — if they ever diverge, that divergence is
 * itself the finding.
 */
export function traceModeGesture(
  kind: string,
  detail: { key?: string; swallowed?: boolean; target?: Element | null },
): void {
  if (typeof window === 'undefined') return
  if (traced >= MAX_TRACED_GESTURES) return
  try {
    traced += 1
    const active = typeof document !== 'undefined' ? document.activeElement : null
    logCanvasBreadcrumb('mode-focus', {
      n: traced,
      kind,
      key: detail.key ?? null,
      swallowed: detail.swallowed ?? null,
      activeElement: describeFocusTarget(active),
      eventTarget: describeFocusTarget(detail.target ?? null),
      containerClass:
        typeof document !== 'undefined'
          ? (document.querySelector('.canvas-mode-hand, .canvas-mode-select') as HTMLElement | null)
              ?.className ?? null
          : null,
    })
  } catch {
    /* a diagnostic may not break the thing it diagnoses */
  }
}

/** The keys whose fate this trace is about. */
export function isModeRelevantKey(key: string): boolean {
  return key === 'v' || key === 'V' || key === 'h' || key === 'H' || key === 'Escape'
}

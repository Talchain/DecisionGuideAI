/**
 * ROADMAP 2.1132 — PR3 (living workspace): the honest, non-blocking
 * attribution for a dock activation the ASSISTANT performed.
 *
 * ── WHY IT SAYS SO LITTLE ─────────────────────────────────────────────────────
 * `ui_directive` is the block that moves this surface, and its ONLY free-text
 * field is `note`. CEE never sets it — derived at CEE staging tip
 * `dbd012ebb24ffd7c3a4fd121664595111deb98e9`: zero `note:` assignments in
 * `src/orchestrator-v5/compose/ui-directive.ts`, against a contrast control of
 * four `source:` assignments in the same file (so the sweep could see a
 * presence). **No rationale is reachable on the wire**, so this component
 * states only the fact of the gesture. Inventing a plausible reason on the one
 * channel whose entire purpose is truthfulness would be worse than showing
 * nothing at all.
 *
 * It also does not NAME the surface. That is correctness, not brevity: the E1
 * sync effect in `OutputsDock.tsx` REDIRECTS a directive at a flag-disabled tab
 * to `results` (`resolvedTab`), so a notice naming the requested tab would name
 * a tab the user is not looking at. The unnamed sentence stays true under the
 * redirect.
 *
 * ── WHY IT CANNOT BECOME A LIE ────────────────────────────────────────────────
 * The claim "Olumi opened this" is only true while the assistant's activation
 * is still what the user is looking at. `outputSurfaceOrigin` is therefore
 * cleared by `setActiveOutputTab` (every dock tab click), by any `'user'`-origin
 * force-activate, by this component's dismiss control, and by its transient
 * timeout. See `uiStore.ts` — the clearing rules live with the state, not here.
 *
 * ── WHY IT CANNOT GET IN THE WAY ──────────────────────────────────────────────
 * `role="status"` + `aria-live="polite"` announces to a screen-reader user —
 * the person most disoriented by a panel that moves unprompted — WITHOUT
 * interrupting them. Nothing here autofocuses, nothing traps focus, nothing is
 * modal, and there is no animation. A user who did not notice the dock move is
 * not startled by the explanation of it.
 */
import { useEffect, useRef, useState } from 'react'
import { Sparkles, X } from 'lucide-react'

import { useUIStore } from '../../stores/uiStore'
import { typography } from '../../styles/typography'

/**
 * How long the notice stays up before clearing itself.
 *
 * Transient by design: the notice answers a question the user asks in the
 * moment ("why did that just move?"). Left up, it becomes furniture, and
 * furniture explaining a gesture that has scrolled out of memory is noise.
 */
export const ASSISTANT_OPENED_NOTICE_MS = 8000

/**
 * The one sentence this notice is allowed to say.
 *
 * ⚠ Deliberately NOT imported by the spec. A shared constant would let a rename
 * drift the component and its test together and keep the suite green — the
 * hand-maintained-mirror defect one level up (trap 12). The spec pins the
 * literal independently, so a copy change must be made twice, on purpose.
 */
const NOTICE_TEXT = 'Opened by Olumi'

export function AssistantOpenedNotice() {
  const origin = useUIStore((s) => s.outputSurfaceOrigin)
  const seq = useUIStore((s) => s.outputSurfaceOriginSeq)
  // Dismissal is keyed to the GESTURE, not to the component: a later gesture is
  // a new fact and re-raises the notice (spec CLEAR-4).
  const [dismissedSeq, setDismissedSeq] = useState<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showing = origin === 'assistant' && dismissedSeq !== seq

  useEffect(() => {
    if (!showing) return
    timerRef.current = setTimeout(() => {
      useUIStore.getState().clearOutputSurfaceOrigin()
    }, ASSISTANT_OPENED_NOTICE_MS)
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current)
      timerRef.current = null
    }
    // Re-armed per gesture: a second directive restarts the window rather than
    // inheriting the remainder of the first one's.
  }, [showing, seq])

  if (!showing) return null

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="assistant-opened-notice"
      className="flex items-center gap-1.5 px-2 pb-1.5 -mt-0.5"
    >
      <span
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border border-info/30 bg-transparent ${typography.panelMeta} text-text-body`}
      >
        <Sparkles className="w-3 h-3 shrink-0" aria-hidden="true" />
        {NOTICE_TEXT}
      </span>
      <button
        type="button"
        // Named, not iconographic-only: the accessible name is what a screen
        // reader announces and what the spec binds to by identity.
        aria-label="Dismiss"
        onClick={() => {
          setDismissedSeq(seq)
          useUIStore.getState().clearOutputSurfaceOrigin()
        }}
        className="inline-flex items-center justify-center w-4 h-4 rounded text-text-light hover:text-text-body focus:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-1"
      >
        <X className="w-3 h-3" aria-hidden="true" />
      </button>
    </div>
  )
}

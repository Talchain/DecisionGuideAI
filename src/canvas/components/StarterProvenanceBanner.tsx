import { useCallback, useState } from 'react'
import { createPortal } from 'react-dom'
import { BookmarkCheck, X } from 'lucide-react'
import { useCanvasStore } from '../store'
import { useConversationContext } from '../conversation/ConversationContext'
import { getStarter, resolveStarterId } from '../starters/loadStarter'
import { typography } from '../../styles/typography'

/**
 * StarterProvenanceBanner — the "this is a saved example" disclosure.
 *
 * NON-NEGOTIABLE HONESTY REQUIREMENT (P1-2). A starter graph is a saved
 * example, not a live computation. Without this banner the canvas is
 * indistinguishable from one Olumi just drafted for you: same nodes, same
 * coaching, same panels. A design partner would reasonably conclude the model
 * was generated from their click. It was not — it was drafted on 2026-07-24
 * against CEE build `1b9d596` and shipped with the app.
 *
 * The banner states three things and claims nothing else:
 *   1. this is a saved example, not a fresh generation;
 *   2. when it was drafted, and that it was drafted by Olumi;
 *   3. that it is fully editable, and that a live re-draft is one click away.
 *
 * It also names the analysis consequence, because the Analyse button IS
 * disabled for a starter and a user who does not know why will read it as the
 * product being broken. `computeCeeCannotSeeModel` refuses the run for any
 * client-injected graph on the V5 canonical path: the V5 turn body carries no
 * graph, so CEE would otherwise answer about a model it never received. The
 * re-draft is the honest route to an analysable model, which is exactly why it
 * is offered here rather than buried.
 */
export function StarterProvenanceBanner() {
  const [dismissed, setDismissed] = useState(false)
  const { sendMessage } = useConversationContext()

  // `resolveStarterId` is the single shape for this question, shared with the
  // run gate — see its docstring for why reading nodes[0] alone was wrong.
  const starterId = useCanvasStore((s) => resolveStarterId(s.nodes))

  const handleRedraft = useCallback(() => {
    if (!starterId) return
    const starter = getStarter(starterId)
    if (!starter) return

    // Naming the trade-off before doing it. A live draft REPLACES the example,
    // and on the shapes these starters use it succeeds roughly 36–57% of the
    // time (STARTER-BRIEF-VALIDATION-2026-07-24.md) — so "you may not get a
    // model back" is a real outcome the user is entitled to know about first,
    // not a surprise.
    const confirmed = window.confirm(
      'Re-draft this example live?\n\n' +
        'Olumi will send the original brief to the model and build a fresh graph. ' +
        'This clears the saved example and replaces it with whatever the live draft returns. ' +
        'Live drafting can fail or time out; if it does, your brief comes back in the composer so you can retry.',
    )
    if (!confirmed) return

    // NOTE: no re-entrancy guard here, deliberately. There was one; it set a
    // ref true and cleared it in a `finally` within the SAME synchronous span
    // (`sendMessage` is async and was never awaited), so the read could never
    // observe `true`. The double-send it appeared to prevent is prevented
    // structurally instead: `resetCanvas` empties the graph, `starterId` goes
    // null, and the early return below unmounts the banner and its button.
    {
      // Reset FIRST so the canvas is genuinely empty: the composer treats an
      // empty canvas as "draft a model" rather than "chat about this one", and
      // the first-use hero re-engages to show thinking state and — on failure —
      // the existing transport-honest failure copy with the brief restored.
      useCanvasStore.getState().resetCanvas()

      // The verbatim brief that produced this example, from the same generated
      // manifest as the graph. It cannot drift into a different brief than the
      // one the user was just looking at.
      sendMessage(starter.brief, {
        turnType: 'explicit_generate',
        debugSource: 'generate_model',
        debugSourceSurface: 'starter_redraft',
      })
    }
  }, [starterId, sendMessage])

  if (!starterId || dismissed) return null
  const starter = getStarter(starterId)
  if (!starter) return null
  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      data-testid="starter-provenance-banner"
      role="status"
      className="fixed left-1/2 top-[72px] z-[250] flex -translate-x-1/2 items-start gap-3 rounded-lg bg-panel px-4 py-3 shadow-2"
      style={{ maxWidth: 'min(720px, calc(100vw - 32px))' }}
    >
      <BookmarkCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-info" />
      <div className="min-w-0 flex-1">
        <p className={`${typography.bodySmall} text-text-header`}>
          Saved example — Olumi drafted this model on {starter.provenance.capturedAt}. It wasn’t generated just now.
        </p>
        {/* Says ONLY what the gate actually does. An earlier draft of this copy
            read "…drafted or saved into your own decision", which was a promise
            the product does not keep: the starter stamp rides a save, so
            saving does NOT re-enable analysis. Re-drafting is the one route
            that does, because the resulting graph comes from a CEE turn. */}
        <p className={`mt-1 ${typography.caption} text-text-light`}>
          Edit anything on the canvas. Analysis is held on a saved example — re-draft it live to
          run one.
        </p>
        <button
          type="button"
          data-testid="starter-redraft"
          onClick={handleRedraft}
          className={`${typography.label} mt-2 rounded-pill bg-primary px-3 py-1.5 text-text-on-color transition-colors duration-fast hover:bg-primary-hover`}
        >
          Re-draft this live
        </button>
      </div>
      <button
        type="button"
        aria-label="Dismiss saved-example notice"
        data-testid="starter-provenance-dismiss"
        onClick={() => setDismissed(true)}
        className="shrink-0 rounded-md p-1 text-text-light transition-colors duration-fast hover:text-text-body"
      >
        <X aria-hidden="true" className="h-4 w-4" />
      </button>
    </div>,
    document.body,
  )
}

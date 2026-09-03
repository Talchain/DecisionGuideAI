import { useCallback, useState } from 'react'
import { createPortal } from 'react-dom'
import { BookmarkCheck, X } from 'lucide-react'
import { useCanvasStore } from '../store'
import { useShowToastSafe } from '../ToastContext'
import { useConversationContext } from '../conversation/ConversationContext'
import { getStarter, resolveStarterId } from '../starters/loadStarter'
import { analysisHeldNotice } from '../utils/analysisHeldOnInjectedModel'
import { typography } from '../../styles/typography'
import { useOverlayCell } from './CanvasOverlayBand'

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
 * product being broken. `analysisHeldOn` refuses the run for any
 * client-injected graph on the V5 canonical path: the V5 turn body carries no
 * graph, so CEE would otherwise answer about a model it never received. The
 * re-draft is the honest route to an analysable model, which is exactly why it
 * is offered here rather than buried.
 */
export function StarterProvenanceBanner() {
  const [dismissed, setDismissed] = useState(false)
  // `draft`/`setDraft` are the SHARED composer buffer — `AIInputBar` reads it
  // from this same context precisely so the text survives a surface switch
  // (`AIInputBar.tsx:110`, `:140`), and `FirstUseComposer` reads it too
  // (`:97`). So this is the one write that lands the brief in whichever
  // composer the user is actually looking at, which is what the confirm
  // dialog below promises. Destructuring `draft` costs nothing extra: the
  // context value is `useMemo`'d on `[conversation, draft, …]`, so this
  // component already re-rendered on every keystroke.
  const { sendMessage, draft, setDraft } = useConversationContext()
  const showToast = useShowToastSafe()

  // `resolveStarterId` is the single shape for this question, shared with the
  // run gate — see its docstring for why reading nodes[0] alone was wrong.
  const starterId = useCanvasStore((s) => resolveStarterId(s.nodes))
  /**
   * ⭐ THE ANALYSIS CLAIM NOW TRACKS THE RUN GATE, rather than the banner's own
   * mount condition. The 18 Aug affordance sweep found this notice still saying
   * "Analysis is held on a saved example" while a toast said "Analysis
   * complete." — because the banner mounted on `starterId` while the gate
   * refused on a DIFFERENT condition. `analysisHeldNotice` is the gate's own
   * condition and the gate's own sentence, so the two cannot disagree; `null`
   * means analysis is not held and the claim is simply not made.
   */
  const heldNotice = useCanvasStore((s) => analysisHeldNotice(s.nodes))

  const handleRedraft = useCallback(async () => {
    if (!starterId) return
    const starter = getStarter(starterId)
    if (!starter) return

    // Naming the trade-off before doing it. A live draft REPLACES the example,
    // and on the shapes these starters use it succeeds roughly 36–57% of the
    // time (STARTER-BRIEF-VALIDATION-2026-07-24.md) — so "you may not get a
    // model back" is a real outcome the user is entitled to know about first,
    // not a surprise. The last line states the RECOVERY the code below now
    // actually performs; it previously promised only the brief back.
    // ⚠ THE UNDISCLOSED HALF, ADDED AFTER THE 18 Aug SWEEP SCORED THIS CONTROL
    // MISLEADING: `resetCanvas()` below does not only clear the graph — for a
    // decision that is NOT a saved record it also calls
    // `clearTranscript(scenarioIdBeingReset)` (`store.ts`, resetCanvas), so the
    // conversation so far is destroyed. The sweep's driver lost its chat here
    // and this dialog had said nothing about it. The clause is conditional
    // because the code is: a SAVED record's transcript belongs to the record and
    // is deliberately left alone, so an unconditional warning would be its own
    // false claim.
    const confirmed = window.confirm(
      'Re-draft this example live?\n\n' +
        'Olumi will send the original brief to the model and build a fresh graph. ' +
        'This clears the saved example and replaces it with whatever the live draft returns. ' +
        'If this decision isn’t saved, it also clears the conversation so far. ' +
        'Live drafting can fail or time out; if it does, the saved example is put back and ' +
        'your brief comes back in the composer so you can retry.',
    )
    if (!confirmed) return

    // NOTE: no re-entrancy guard here, deliberately. There was one; it set a
    // ref true and cleared it in a `finally` within the SAME synchronous span
    // (`sendMessage` is async and was never awaited), so the read could never
    // observe `true`. The double-send it appeared to prevent is prevented
    // structurally instead: `resetCanvas` empties the graph, `starterId` goes
    // null, and the early return below unmounts the banner and its button.
    {
      // The example as it stands, captured BEFORE the reset destroys it.
      const { nodes, edges } = useCanvasStore.getState()

      // Reset FIRST so the canvas is genuinely empty: the composer treats an
      // empty canvas as "draft a model" rather than "chat about this one", and
      // the first-use hero re-engages to show thinking state and — on failure —
      // the existing transport-honest failure copy with the brief restored.
      useCanvasStore.getState().resetCanvas()

      // Arm the restore AFTER the reset, not before: `resetCanvas` itself sets
      // `draftChatPreDraftSnapshot: null` (store.ts, "A.5+: Clear draft
      // snapshot"), so a snapshot taken earlier would be wiped by the very
      // call it exists to survive. Reusing the existing snapshot + `undoDraft`
      // pair rather than a second restore mechanism also means the "Undo
      // draft" chip reverts a SUCCESSFUL re-draft back to the example, which
      // is the behaviour DraftChat already gives every other draft.
      useCanvasStore.getState().setDraftChatPreDraftSnapshot({ nodes, edges })

      // The verbatim brief that produced this example, from the same generated
      // manifest as the graph. It cannot drift into a different brief than the
      // one the user was just looking at.
      await sendMessage(starter.brief, {
        turnType: 'explicit_generate',
        debugSource: 'generate_model',
        debugSourceSurface: 'starter_redraft',
      })

      // ⚠ WHY THIS TESTS THE CANVAS AND NOT AN ERROR.
      //
      // A failed user turn does NOT reject. `sendTurn` catches the dispatch
      // error, renders the transport-honest failure bubble, and returns
      // normally — `systemSendFailure` is set for `mode === 'system'` ONLY
      // ("User turns never set it", useConversation.ts). So there is no error
      // channel here to catch, and a `.catch()` on this await would be exactly
      // the guarantee-theatre this programme hunts: machinery that reads as a
      // safety net and can never fire.
      //
      // So the check is the OBSERVABLE OUTCOME: the reset emptied the canvas,
      // and if the turn produced no graph it is still empty. That also makes
      // the restore fail-SAFE — if anything DID land (a drafted graph, or a
      // node the user added while the draft was in flight) we leave it alone
      // rather than clobbering it with the old example.
      if (useCanvasStore.getState().nodes.length === 0) {
        useCanvasStore.getState().undoDraft()

        // ⭐ AFFORDANCE SWEEP A13 — THE PROMISE THIS BRANCH DID NOT KEEP.
        //
        // The confirm dialog says, of the failure case, *"the saved example is
        // put back AND YOUR BRIEF COMES BACK IN THE COMPOSER so you can
        // retry"*, and the toast below repeated the claim. The code above put
        // the example back and **never touched the composer** — so on the
        // deployed build (`9ff14c19`) the user was left with the identical
        // blocked model and an EMPTY composer, told twice that their brief was
        // in it. Measured, fresh guest, 91 s after the click: canvas restored
        // to its 20 nodes, banner back, `textarea.value === ""`.
        //
        // ⚠ AND THE TWO CLAIMS THE SAME MEASUREMENT REFUTED, recorded because
        // this branch is the one a later session will read: the brief IS sent
        // (wire-witnessed, `POST /proxy/v5/turn/stream`, `message` = the
        // verbatim 385-char brief, 200) and the user's turn IS rendered (it is
        // in the Olumi tab). The re-draft's only broken promise was this one —
        // do not "fix" the other two.
        //
        // FAIL-SAFE, for the same reason the canvas check above is: if the user
        // typed into the composer while the draft was in flight, that text is
        // theirs and outranks the brief. So the restore is conditional — and
        // the toast then may not claim it happened, which is why the sentence
        // is chosen from the SAME boolean that performed the write rather than
        // being asserted alongside it.
        const composerWasEmpty = draft.trim().length === 0
        if (composerWasEmpty) setDraft(starter.brief)

        showToast(
          composerWasEmpty
            ? 'The live re-draft didn’t return a model, so your saved example has been put back. Your brief is in the composer if you want to try again.'
            : 'The live re-draft didn’t return a model, so your saved example has been put back. What you had typed is still in the composer, so your brief was left out of it.',
          'warning',
        )
      }
    }
  }, [starterId, sendMessage, showToast, draft, setDraft])

  const starter = starterId ? getStarter(starterId) : null
  const wants = Boolean(starter) && !dismissed
  // ⚠ THIS BANNER COVERED THE DECISION NODE'S TITLE BY CONSTRUCTION, and no
  // amount of reserving space at the top could have fixed it: it was
  // `fixed; top: 72px`, and the product fit's top inset is 73px
  // (`topBarFitInset.spec.ts`), so the fitted model's top row began at exactly
  // this banner's top edge. The only fix is to stop being there.
  const { granted, target } = useOverlayCell('bottom-centre', 'starter-provenance-banner', wants)

  if (!wants || !starter || !granted) return null

  // ⭐ REFLOWED TO ONE BAND-HEIGHT ROW — icon, two lines, inline action,
  // dismiss. The copy is BYTE-IDENTICAL to the stacked version it replaces and
  // is pinned that way by `StarterProvenanceBanner.spec.tsx`: this is a change
  // of shape, never of what the product says about a saved example.
  const body = (
    <div
      data-testid="starter-provenance-banner"
      role="status"
      // ⚠ `py-1`, NOT `py-2`, AND THE 8px IS MEASURED RATHER THAN TASTE. At
      // `py-2` this banner renders 71px against a 64px band, and the cells are
      // `align-items: flex-end`, so the surplus grows UPWARD out of the reserved
      // strip and back over the canvas — reintroducing the very defect the band
      // exists to remove, at a new address. Measured 71px in 10/10 readings of
      // `overlayNodeOverlap.measure.ts` once the harness was fixed to mount this
      // component at all.
      //
      // Shrinking the OCCUPANT rather than growing the BAND is deliberate: the
      // band's height is charged to every user as bottom fit inset (+63px
      // today), and it is charged whether or not this banner is on screen,
      // whereas this padding is paid only by the banner.
      className="pointer-events-auto flex items-center gap-3 rounded-lg bg-panel px-4 py-1 shadow-2"
      style={{ maxWidth: 'min(720px, 100%)' }}
    >
      <BookmarkCheck aria-hidden="true" className="h-4 w-4 shrink-0 text-info" />
      <div className="min-w-0 flex-1">
        <p className={`${typography.bodySmall} leading-snug text-text-header`}>
          Saved example — Olumi drafted this model on {starter.provenance.capturedAt}. It wasn’t generated just now.
        </p>
        {/* Says ONLY what the gate actually does. An earlier draft of this copy
            read "…drafted or saved into your own decision", which was a promise
            the product does not keep: the starter stamp rides a save, so
            saving does NOT re-enable analysis. Re-drafting is the one route
            that does, because the resulting graph comes from a CEE turn. */}
        <p className={`${typography.caption} leading-snug text-text-light`}>
          Edit anything on the canvas.{heldNotice === null ? '' : ` ${heldNotice}`}
        </p>
      </div>
      <button
        type="button"
        data-testid="starter-redraft"
        onClick={handleRedraft}
        className={`${typography.label} shrink-0 whitespace-nowrap rounded-pill bg-primary px-3 py-1.5 text-text-on-color transition-colors duration-fast hover:bg-primary-hover`}
      >
        Re-draft this live
      </button>
      <button
        type="button"
        aria-label="Dismiss saved-example notice"
        data-testid="starter-provenance-dismiss"
        onClick={() => setDismissed(true)}
        className="shrink-0 rounded-md p-1 text-text-light transition-colors duration-fast hover:text-text-body"
      >
        <X aria-hidden="true" className="h-4 w-4" />
      </button>
    </div>
  )

  return target ? createPortal(body, target) : body
}

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { useCanvasStore } from '../store'
import { useShowToastSafe } from '../ToastContext'
import { useConversationContext } from '../conversation/ConversationContext'
import { getStarter, resolveStarterId } from '../starters/loadStarter'
import { useAnalysisHoldReason } from '../hooks/useAnalysisHold'
import { isUserEditHold } from '../utils/analysisHeldOnInjectedModel'
import { useDockInset } from './CanvasOverlayBand'
import styles from './StarterProvenanceBanner.module.css'

/**
 * contract v3.1 `.context-banner{right:17px;top:13px}` — measured from the
 * canvas area, whose top is the app bar's bottom and whose right edge is the
 * dock's left edge.
 *
 * ⚠ THE TOP IS NOT 13px, AND THAT IS MEASURED RATHER THAN TASTE. This product's
 * canvas runs UNDER the bar and its fit leaves a 16px band between the bar's
 * bottom (51) and the fitted board (`computeFitPadding`'s GAP), so every
 * starter's Question card lands with its top edge at y=67. At 13px the line
 * (y 64–80) sat across that card's top edge; at 2px with a 13px line box it
 * spans y 53–66 and stays inside the band at landing on all five starters at
 * both acceptance sizes. (The banner this replaces was once `fixed; top: 72px`
 * and covered the decision node's title for the same reason — the fitted top
 * row begins exactly at the fit inset.)
 */
export const CONTEXT_LINE_RIGHT_PX = 17
export const CONTEXT_LINE_TOP_PX = 2

/**
 * The line's words: v3.1's "Olumi-drafted starting model · Olumi values marked
 * est.", restated with the fact this disclosure exists for — it is a SAVED
 * example, drafted by Olumi (not a model drafted from the user's click just
 * now). The draft DATE and "It wasn't generated just now" are in the detail,
 * one click away, verbatim. "Olumi values marked est." is true by construction:
 * every value the card surfaces classify as Olumi's carries the `est.` mark
 * (`valueSourceMark`, both views).
 */
export const CONTEXT_LINE_TEXT = 'Saved example drafted by Olumi · Olumi values marked est.'

/**
 * StarterProvenanceBanner — the "this is a saved example" disclosure.
 *
 * ⭐ CONTRACT v3.1 SHAPE (DESIGN-GAP #3, 26 Sep 2026): A QUIET LINE, NOT A
 * BANNER. v3.1 draws this as one 10px context note at the canvas's top-right —
 * "Olumi-drafted starting model · Olumi values marked est." The served build
 * drew a 644x76 bottom-centre banner with a filled primary "Re-draft this live"
 * pill, and it overlapped 3–6 outcome/risk cards on EVERY starter at 1280x800
 * (measured at base `6256a41f`, up to 38,304px² per board), because the landing
 * fit does not fit and the board runs under the bottom band. So:
 *   · at rest, one line: "Saved example drafted by Olumi · Olumi values
 *     marked est." — the contract's words, restated with the fact the banner
 *     existed to state (a SAVED example, drafted by Olumi). It is the
 *     contract's size: 10px, about 290px wide;
 *   · one click on the line opens the detail — the banner's full sentences,
 *     byte-identical (WHEN Olumi drafted it; "It wasn't generated just now"),
 *     the analysis consequence, "Re-draft this live" and the dismiss. Nothing
 *     the banner said or did is gone; it is one click away.
 * It no longer claims a cell of the canvas overlay band.
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
 *
 * ⚠ EXCEPT WHILE THE USER'S OWN EDIT IS THE CAUSE (decision, 23 Sep 2026). When
 * the hold is an unconfirmed or in-flight edit, re-drafting would REPLACE the
 * model and discard that change without warning (the confirm dialog below
 * speaks of the example and the conversation, not of the edit). So the button
 * is withdrawn for as long as the edit is the operative cause; the line beside
 * it names the edit and its remedy instead (`heldReason`).
 */
/** CC-4: the chip identity a starter re-draft's brief carries on the wire. */
export const STARTER_REDRAFT_CHIP_ID = 'starter_redraft'

export function StarterProvenanceBanner() {
  const [dismissed, setDismissed] = useState(false)
  // The detail (the banner's full sentences and its actions) — closed at rest.
  const [detailOpen, setDetailOpen] = useState(false)
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
   * refused on a DIFFERENT condition. `useAnalysisHeldNotice` is the gate's own
   * condition and the gate's own sentence, so the two cannot disagree; `null`
   * means analysis is not held and the claim is simply not made. While the
   * user's own edit is unconfirmed it names that edit instead of the example.
   */
  const holdReason = useAnalysisHoldReason()
  const heldNotice = holdReason?.sentence ?? null
  // No re-draft over the user's own unconfirmed edit (see the header).
  const offerRedraft = !isUserEditHold(holdReason)

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
      // CC-4 (UI N2): the brief is the EXAMPLE's, Olumi's text, not words the user
      // typed — so it carries a chip identity and CEE never grounds its figures as
      // the user's own. Measured on served 42114c6 (#70 5845475727): a chip-sourced
      // starter brief builds the model exactly as a composer one does.
      await sendMessage(starter.brief, {
        turnType: 'explicit_generate',
        debugSource: 'generate_model',
        debugSourceSurface: 'starter_redraft',
        chipMeta: { id: STARTER_REDRAFT_CHIP_ID },
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
  const dockInset = useDockInset()
  const detailId = useId()
  const rootRef = useRef<HTMLDivElement | null>(null)

  // The detail closes the way every canvas disclosure does: Escape, or a press
  // outside it. Registered only while open.
  useEffect(() => {
    if (!detailOpen) return
    const onPointer = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setDetailOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDetailOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [detailOpen])

  if (!wants || !starter) return null

  return (
    <div
      ref={rootRef}
      data-testid="starter-provenance-banner"
      role="status"
      className={styles.root}
      style={{
        top: `calc(var(--topbar-h, 0px) + ${CONTEXT_LINE_TOP_PX}px)`,
        right: dockInset + CONTEXT_LINE_RIGHT_PX,
      }}
    >
      <button
        type="button"
        data-testid="starter-provenance-line"
        className={styles.line}
        aria-expanded={detailOpen}
        aria-controls={detailOpen ? detailId : undefined}
        onClick={() => setDetailOpen((o) => !o)}
      >
        <Sparkles aria-hidden="true" className={styles.icon} strokeWidth={1.8} />
        <span>{CONTEXT_LINE_TEXT}</span>
      </button>

      {detailOpen && (
        <div id={detailId} data-testid="starter-provenance-detail" className={styles.detail}>
          {/* The banner's copy, BYTE-IDENTICAL — pinned by
              `StarterProvenanceBanner.spec.tsx`. Only its place changed. */}
          <p className={styles.detailHead}>
            Saved example — Olumi drafted this model on {starter.provenance.capturedAt}. It wasn’t generated just now.
          </p>
          {/* Says ONLY what the gate actually does. An earlier draft of this copy
              read "…drafted or saved into your own decision", which was a promise
              the product does not keep: the starter stamp rides a save, so
              saving does NOT re-enable analysis. Re-drafting is the one route
              that does, because the resulting graph comes from a CEE turn. */}
          <p className={styles.detailBody}>
            Edit anything on the canvas.{heldNotice === null ? '' : ` ${heldNotice}`}
          </p>
          <div className={styles.actions}>
            {offerRedraft && (
              <button
                type="button"
                data-testid="starter-redraft"
                onClick={handleRedraft}
                className={styles.button}
              >
                Re-draft this live
              </button>
            )}
            <button
              type="button"
              aria-label="Dismiss saved-example notice"
              data-testid="starter-provenance-dismiss"
              onClick={() => setDismissed(true)}
              className={styles.textButton}
            >
              Hide this note
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

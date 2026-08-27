/**
 * ServerGraphRetryNotice — the honest interim state for the boot re-ask.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY A NOTICE EXISTS HERE AT ALL, given `serverGraphHydration`'s header
 * ═══════════════════════════════════════════════════════════════════════════
 * That header says a non-graph answer leaves the canvas alone "with no error
 * surfaced", because a user who is offline or whose guest scenario the server
 * has never seen "is in a normal state and has nothing to act on". THAT RULING
 * IS UNCHANGED AND THIS COMPONENT KEEPS IT: `notReadable`, `unavailable`,
 * `refused` and `unusable` surface NOTHING, exactly as today.
 *
 * This notice covers a case that ruling did not contemplate — the one measured
 * on 2026-08-25: a scenario that answers `absent` while the server write-back is
 * still in flight, on a canvas that is EMPTY. There the user is NOT in a normal
 * state and DOES have something to act on; they are looking at a blank canvas
 * believing their work is gone, when the server holds it. Silence is what made
 * that defect invisible.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠⚠ THE COPY — WHAT IT MAY NOT SAY, AND WHY
 * ═══════════════════════════════════════════════════════════════════════════
 * A sibling probe settled the storage mechanism on 2026-08-25. ALL THREE of
 * "saved locally", "only in this browser" and "sign in to save your work" are
 * FALSE — a guest's graph exists server-side too, and `ScenarioListPage.tsx`
 * (lines 369-380) carries the full derivation of why the second is the worst of
 * them (it reads as a PRIVACY claim, and nothing about it is true).
 *
 * So this copy makes NO claim about where the user's work lives. It is confined
 * to what THIS CLIENT OBSERVED:
 *
 *  · while retrying — "Looking for your model…". True at exactly the moment it
 *    shows, because a re-ask is scheduled. It does not promise a model exists,
 *    does not say the work is gone, and cannot read as "loading forever":
 *    the schedule is bounded and this string is replaced when it expires.
 *
 *  · on exhaustion, WITH NO MODEL EVER DELIVERED — "Olumi did not return a
 *    model for this decision." Still the literal truth of that case: we asked
 *    eight times over 100 seconds and got no model. It deliberately does NOT
 *    say "your model could not be loaded", which presupposes one exists, nor
 *    anything about saving.
 *
 *  · on exhaustion, AFTER A MODEL WAS DELIVERED ON THE DRAFT STREAM — "Olumi
 *    returned a model for this decision, but this page could not display it."
 *
 * ⚠⚠ THE SECOND STRING EXISTS BECAUSE THE FIRST WAS MEASURED FALSE (2026-08-26).
 * The re-ask's evidence is the SCENARIO-GRAPH READ ONLY. It is blind to the
 * DRAFT STREAM, which is a different transport carrying the same model — so a
 * client could watch 15 chunks / 110,343 bytes arrive, see DRAFTING,
 * GRAPH_READY, COACHING_READY and COMPLETE, render ZERO nodes, and then assert
 * that OLUMI had not returned a model. Direct HTTP to the same server completed
 * 14/14. The server was not at fault and the sentence blamed it.
 *
 * A product that blames the server for its own bug is worse than one that says
 * nothing, so the notice is now given the ONE distinction that makes an honest
 * sentence possible: did a model ARRIVE (`draftStreamGraphDeliveredFor`), as
 * opposed to did we manage to DRAW it. Note what the fix is NOT: the copy was
 * not made vaguer. Both sentences are specific, and each is true of exactly the
 * case that selects it.
 *
 * ⚠ THE DELIVERY PREDICATE IS NODE-KEYED, NOT BYTE-KEYED. A malformed or empty
 * GRAPH_READY graph yields no node identities, counts as NO delivery, and gets
 * the "did not return a model" sentence — because a claim that Olumi returned a
 * model on the strength of rubbish on the wire would be this same fabrication
 * pointing the other way.
 *
 * In BOTH cases the action offered is the one MEASURED to work every time: a
 * plain reload. No retry and no timeout change — in the delivered case the model
 * demonstrably reached the browser already.
 *
 * Neither string forecasts, gives a completion proximity, or compares — so it
 * would pass the narration-honesty invariants if it were ever moved under them.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠ THE THREE GATES, AND WHY EACH IS LOAD-BEARING
 * ═══════════════════════════════════════════════════════════════════════════
 * 1. STAGE is not `idle`. Nothing to say otherwise.
 * 2. The stage's scenario MATCHES the live one. `contextIntegrityStore`'s header
 *    records a P0 from omitting exactly this: an unkeyed value rendered a
 *    PREVIOUS decision's content and survived every transition. Keying at the
 *    point of use fails safe without a clear to remember (trap 12).
 * 3. THE CANVAS IS EMPTY. This is what keeps the notice honest rather than
 *    alarming. If the autosave restored the user's work, it is ON SCREEN — a
 *    strip saying "looking for your model", let alone "did not return a model",
 *    would be frightening and false-to-experience. It also makes the notice
 *    SELF-CLEARING: the moment a late graph merges, `nodes.length` is non-zero
 *    and this unmounts, with no store write needed to retract it.
 */
import { useCanvasStore } from '../store'
import { useDraftStore, draftStreamGraphDeliveredFor } from '../stores/draftStore'
import { useServerGraphRetryStore } from '../stores/serverGraphRetryStore'
import { typography } from '../../styles/typography'

export const SERVER_GRAPH_RETRY_NOTICE_TESTID = 'server-graph-retry-notice'

/** Present tense, about this client's own behaviour. No storage claim. */
export const SERVER_GRAPH_RETRY_LOOKING_COPY = 'Looking for your model…'

/**
 * What actually happened when NOTHING was delivered. Presupposes nothing.
 *
 * ⚠ Only honest when this client saw no model arrive on ANY transport. The
 * re-ask alone cannot establish that — see `draftStreamGraphDeliveredFor`.
 */
export const SERVER_GRAPH_RETRY_EXHAUSTED_COPY =
  'Olumi did not return a model for this decision.'

/**
 * What actually happened when a model WAS delivered and this client could not
 * put it on screen (M3, measured 2026-08-26).
 *
 * States a CLIENT failure, because that is what it was. It does not assert a
 * server failure, and it does not imply success — the user still has no model
 * on screen, which is why the reload is still offered.
 */
export const SERVER_GRAPH_RETRY_UNDISPLAYABLE_COPY =
  'Olumi returned a model for this decision, but this page could not display it.'

/** The action measured to recover it every time. */
export const SERVER_GRAPH_RETRY_ACTION_COPY = 'Reload the page'

export function ServerGraphRetryNotice(): JSX.Element | null {
  const stage = useServerGraphRetryStore((s) => s.stage)
  const noticeScenarioId = useServerGraphRetryStore((s) => s.scenarioId)
  const currentScenarioId = useCanvasStore((s) => s.currentScenarioId)
  const nodeCount = useCanvasStore((s) => s.nodes.length)
  // Scenario-keyed at the point of use, exactly like GATE 2 below: an
  // observation about another decision must never pick this decision's words.
  const modelWasDelivered = useDraftStore((s) =>
    draftStreamGraphDeliveredFor(s, currentScenarioId ?? null),
  )

  // GATE 1 — nothing to say.
  if (stage === 'idle') return null

  // GATE 2 — never another decision's notice. Both ids must be present AND
  // equal; a null on either side is "cannot attribute", which renders nothing.
  if (
    noticeScenarioId === null ||
    currentScenarioId === null ||
    currentScenarioId === undefined ||
    noticeScenarioId !== currentScenarioId
  ) {
    return null
  }

  // GATE 3 — the user's work is on screen; there is nothing to reassure about.
  if (nodeCount > 0) return null

  const exhausted = stage === 'exhausted'

  return (
    <div
      data-testid={SERVER_GRAPH_RETRY_NOTICE_TESTID}
      data-stage={stage}
      // Which of the two exhaustion facts is being stated. Exposed so the
      // deployed-build re-drive can assert the CLAIM, not just the presence of
      // a strip — the acceptance condition is about which sentence is true.
      data-model-delivered={modelWasDelivered ? 'true' : 'false'}
      role="status"
      aria-live="polite"
      className="pointer-events-auto absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border border-panel-border bg-panel px-3 py-1.5 shadow-sm"
    >
      {!exhausted && (
        <div
          className="h-3.5 w-3.5 flex-none animate-spin rounded-full border-2 border-text-light border-t-transparent motion-reduce:animate-none"
          aria-hidden="true"
        />
      )}
      <span className={`${typography.panelMeta} text-text-body`}>
        {exhausted
          ? modelWasDelivered
            ? SERVER_GRAPH_RETRY_UNDISPLAYABLE_COPY
            : SERVER_GRAPH_RETRY_EXHAUSTED_COPY
          : SERVER_GRAPH_RETRY_LOOKING_COPY}
      </span>
      {exhausted && (
        <button
          type="button"
          data-testid={`${SERVER_GRAPH_RETRY_NOTICE_TESTID}-action`}
          onClick={() => {
            window.location.reload()
          }}
          className={`${typography.panelMeta} rounded text-info underline hover:text-text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info`}
        >
          {SERVER_GRAPH_RETRY_ACTION_COPY}
        </button>
      )}
    </div>
  )
}

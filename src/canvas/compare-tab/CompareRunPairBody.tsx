/**
 * The Compare tab — previous Run vs this Run (SC-24 v3, ChatGPT #75 5917800777; lease DL #75 5917856638).
 *
 * ⭐ THIS BODY DECIDES NOTHING. It renders the comparison CEE produced for the analysis on screen, read by the
 * ONE reader both surfaces share (`displayedRunDeltaView.ts`) and shown by the SAME section the Reasoning tab
 * used (`WhatsChanged`). The old Compare body computed its own comparison in the browser from snapshots it
 * captured (`deriveRunPairComparison`, `leaderClaim`, `deriveTransitions`, `graphChangeDiff`) — a second
 * authority that contradicted the rest of the product once already (5 Aug). It is no longer on this path.
 *
 * Empty state (Design System v5 §18): no comparison exists until a second Run of this model completes.
 *
 * ⛔ …unless a Run IS on record and its result simply isn't held here (DL #75 5922778531, PANEL's sweep 5922761384):
 * the cold open of a `complete_stale` read (an approved edit, not yet re-run) ships no result and no `run_delta`, so
 * the reader returns null, and "No comparison yet" was false beside a Run control saying "Re-run analysis". The body
 * reads the SAME fact Reasoning reads (`selectRunOnRecordWithoutResult`, from the Run control's own facts), passed
 * down by the dock; it decides nothing of its own.
 */
import { Shuffle } from 'lucide-react'
import { typography } from '../../styles/typography'
import { WhatsChanged } from '../../components/results/analysisNew/sections/WhatsChanged'
import { useDisplayedRunDeltaView } from '../../components/results/analysisNew/displayedRunDeltaView'
import { useRunChangesProjection } from '../graphChanges/useRunChangesProjection'
import { canvasLinkOfTarget, useCanvasLight } from '../graphChanges/rowCanvasLink'
import { FOOTER_COPY } from '../components/pre-analysis-v3/constants'
import type { RunOnRecordWithoutResult } from '../stores/declinedSavedRunStore'

export const COMPARE_RUN_PAIR_TESTID = 'compare-run-pair'

/** What the empty Compare body says when a Run is on record but its result is not held here. */
export const COMPARE_RUN_ON_RECORD_COPY = {
  stale: {
    title: 'The model has changed since the last Run',
    body: 'Re-run to compare the model as it stands with the last Run.',
  },
  // The Run control's own sentence, verbatim — the same words Reasoning shows for this state.
  unconfirmed: { title: 'Comparison not shown', body: FOOTER_COPY.savedRunUnconfirmedSub },
} as const

export function CompareRunPairBody({
  responseHash,
  runOnRecordWithoutResult = null,
}: {
  responseHash: string | null | undefined
  /** `selectRunOnRecordWithoutResult` from the dock; absent = no Run on record, so "No comparison yet" stands. */
  runOnRecordWithoutResult?: RunOnRecordWithoutResult
}): JSX.Element {
  const view = useDisplayedRunDeltaView(responseHash)
  // CANVAS (lease DL #75 5920620752, UNDO grant 5920635710): the same view marks the canvas while this tab shows it,
  // and each row focuses the element its producer ids name — or says it is not on the canvas now.
  const changes = useRunChangesProjection(view)
  const light = useCanvasLight()
  if (view === null && runOnRecordWithoutResult !== null) {
    const copy = COMPARE_RUN_ON_RECORD_COPY[runOnRecordWithoutResult]
    return (
      <div
        className="flex flex-col items-center px-6 py-10 text-center"
        data-testid={`${COMPARE_RUN_PAIR_TESTID}-run-on-record`}
        data-run-on-record={runOnRecordWithoutResult}
      >
        <Shuffle size={36} className="text-panel-border" aria-hidden="true" />
        <p className={`${typography.panelHeader} text-text-body mt-3 mb-1.5`}>{copy.title}</p>
        <p className={`${typography.panelBody} text-text-light max-w-[260px] m-0`}>{copy.body}</p>
      </div>
    )
  }
  if (view === null) {
    return (
      <div className="flex flex-col items-center px-6 py-10 text-center" data-testid={`${COMPARE_RUN_PAIR_TESTID}-empty`}>
        <Shuffle size={36} className="text-panel-border" aria-hidden="true" />
        <p className={`${typography.panelHeader} text-text-body mt-3 mb-1.5`}>No comparison yet</p>
        <p className={`${typography.panelBody} text-text-light max-w-[260px] m-0`}>
          The two most recent runs of this model are compared here.
        </p>
      </div>
    )
  }
  return (
    <div data-testid={COMPARE_RUN_PAIR_TESTID}>
      <WhatsChanged
        view={view}
        rowFocus={(row) => {
          const target = changes.focusByRowKey.get(row.key)
          if (target === undefined) return undefined
          return canvasLinkOfTarget(target)?.focus ?? null
        }}
        // ⭐ Hover / keyboard focus lights the row's element on the canvas, by the same identity (DL 5939855664).
        rowLight={(row) => {
          const link = canvasLinkOfTarget(changes.focusByRowKey.get(row.key))
          return link ? { on: () => light.on(link), off: light.off } : null
        }}
      />
    </div>
  )
}

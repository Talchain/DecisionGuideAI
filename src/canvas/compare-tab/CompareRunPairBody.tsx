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
 */
import { Shuffle } from 'lucide-react'
import { typography } from '../../styles/typography'
import { WhatsChanged } from '../../components/results/analysisNew/sections/WhatsChanged'
import { useDisplayedRunDeltaView } from '../../components/results/analysisNew/displayedRunDeltaView'
import { useRunChangesProjection } from '../graphChanges/useRunChangesProjection'
import { focusEdgeById, focusNodeById } from '../utils/focusHelpers'

export const COMPARE_RUN_PAIR_TESTID = 'compare-run-pair'

export function CompareRunPairBody({ responseHash }: { responseHash: string | null | undefined }): JSX.Element {
  const view = useDisplayedRunDeltaView(responseHash)
  // CANVAS (lease DL #75 5920620752, UNDO grant 5920635710): the same view marks the canvas while this tab shows it,
  // and each row focuses the element its producer ids name — or says it is not on the canvas now.
  const changes = useRunChangesProjection(view)
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
          if (target === null) return null
          return () => (target.kind === 'node' ? focusNodeById(target.id) : focusEdgeById(target.id))
        }}
      />
    </div>
  )
}

/**
 * "Since your last run" on the Reasoning tab: the comparison at one glance, in at most two rows (Paul, 20 Oct 2026), with
 * the full comparison on the Compare tab.
 *
 *   Row 1: what this is, and the way to the full comparison.
 *   Row 2: the highest-level difference, as CEE states it:
 *     · CEE names the option most likely to meet the goal → that option, its two marks on a mini track (hollow = earlier
 *       run, filled = this run, the Compare chart's own `PairChanceTrack`) and this run's figure;
 *     · CEE's highest claim with no figure for that option this run → the ruled claim sentence (`goalChanceHeadline`);
 *     · no goal-chance claim → which earlier run it is compared with (the receipt's original line).
 *
 * Figures come only through the chance gate (`usePairChanceFigures`), the same reader the Compare tab uses, so the two
 * surfaces cannot disagree. It renders from the SAME view (`vm.whatsChanged`), so it exists exactly when Compare has a pair.
 */
import { typography } from '../../../../styles/typography'
import { useUIStore } from '../../../../stores/uiStore'
import { action, surface } from '../panelSurfaces'
import type { RunDeltaView } from '../runDeltaView'
import { usePairChanceFigures } from '../../../../canvas/compare-tab/usePairChanceFigures'
import { PairChanceTrack } from '../../../../canvas/compare-tab/PairChanceSlope'
import { goalChanceHeadline } from '../../../../canvas/compare-tab/goalChanceHeadline'

export const WHATS_CHANGED_RECEIPT_TESTID = 'analysis-new-whats-changed-receipt'

export function WhatsChangedReceipt({ view, responseHash }: {
  view: RunDeltaView | null
  responseHash?: string | null
}): JSX.Element | null {
  const figures = usePairChanceFigures(view, responseHash)
  if (view === null) return null
  const claim = figures?.claim ?? null
  // The glance's sentence says "most likely to meet your goal": only the plain highest form (all-likely-to-miss keeps its
  // own ruled sentence below, `goalChanceHeadline`).
  const leaderId = claim?.kind === 'highest' ? claim.optionId : null
  const leader = leaderId === null ? undefined : figures?.rows.find(r => r.optionId === leaderId && r.now !== null)
  const labels = new Map((figures?.rows ?? []).map(r => [r.optionId, r.label] as const))
  // The claim is said only for an option this pair names (its label is on a row); never "An option" (21 Oct 2026).
  const named = claim !== null && labels.get(claim.optionId) != null
  const claimWords = figures && leader === undefined && named ? goalChanceHeadline(figures, id => labels.get(id) ?? null) : null
  return (
    <section className={surface('neutral')} data-testid={WHATS_CHANGED_RECEIPT_TESTID} aria-labelledby={`${WHATS_CHANGED_RECEIPT_TESTID}-title`}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 id={`${WHATS_CHANGED_RECEIPT_TESTID}-title`} className={`${typography.panelMeta} text-text-light m-0`}>Since your last run</h3>
        <button
          type="button"
          className={`${typography.panelMeta} ${action('inline')} flex-shrink-0`}
          data-testid={`${WHATS_CHANGED_RECEIPT_TESTID}-open`}
          onClick={() => { useUIStore.getState().setActiveOutputTab('compare') }}
        >
          View comparison
        </button>
      </div>
      {leader !== undefined ? (
        <div className="mt-1 flex items-center gap-3" data-testid={`${WHATS_CHANGED_RECEIPT_TESTID}-glance`} data-option-id={leader.optionId}>
          <span className="sr-only" data-goal-chance-claim={claim!.kind} data-option-id={leader.optionId}>{`${leader.label ?? 'An option'} is the most likely to meet your goal in this model: earlier run ${leader.earlier?.words ?? 'not shown'}, this run ${leader.now!.words}`}</span>
          <span className={`${typography.panelBody} text-text-header min-w-0 flex-1 truncate`} title={leader.label ?? undefined} aria-hidden="true">{leader.label ?? 'An option'}</span>
          <span className="w-16 flex-shrink-0"><PairChanceTrack earlier={leader.earlier} now={leader.now} /></span>
          <span className={`${typography.panelTabular} text-text-header flex-shrink-0 whitespace-nowrap`} aria-hidden="true">{leader.now!.words}</span>
        </div>
      ) : claimWords !== null ? (
        <p className={`${typography.panelBody} text-text-body mt-1 mb-0 truncate`} title={claimWords} data-testid={`${WHATS_CHANGED_RECEIPT_TESTID}-claim`}
          data-goal-chance-claim={claim?.kind} data-option-id={claim?.optionId}>{claimWords}</p>
      ) : (
        <p className={`${typography.panelBody} text-text-light mt-1 mb-0`} data-testid={`${WHATS_CHANGED_RECEIPT_TESTID}-compared-with`}>
          {view.comparedWith ?? 'Compared with the earlier run.'}
        </p>
      )}
    </section>
  )
}

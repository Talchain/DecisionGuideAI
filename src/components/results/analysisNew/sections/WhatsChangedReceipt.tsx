/**
 * "What's changed" on the Reasoning tab — a RECEIPT, not the comparison (SC-24 v3, ChatGPT #75 5917800777).
 *
 * The full comparison (outcome movement, the exact input changes, the limit) lives on the Compare tab. Here the
 * Reasoning tab keeps one line saying a comparison exists, and which earlier Run it is against, plus a way to
 * open it. It makes no claim about the result, so it needs none of the full block's qualifiers.
 *
 * It renders from the SAME view (`vm.whatsChanged`, from `displayedRunDeltaView.ts`) the Compare tab reads, so
 * the two surfaces cannot disagree about whether a comparison exists.
 */
import { typography } from '../../../../styles/typography'
import { useUIStore } from '../../../../stores/uiStore'
import { action, surface } from '../panelSurfaces'
import type { RunDeltaView } from '../runDeltaView'

export const WHATS_CHANGED_RECEIPT_TESTID = 'analysis-new-whats-changed-receipt'

export function WhatsChangedReceipt({ view }: { view: RunDeltaView | null }): JSX.Element | null {
  if (view === null) return null
  return (
    <section className={surface('neutral')} data-testid={WHATS_CHANGED_RECEIPT_TESTID} aria-labelledby={`${WHATS_CHANGED_RECEIPT_TESTID}-title`}>
      <h3 id={`${WHATS_CHANGED_RECEIPT_TESTID}-title`} className={`${typography.panelHeader} text-text m-0`}>
        What&rsquo;s changed
      </h3>
      <p className={`${typography.panelMeta} text-text-light mt-1 mb-0`} data-testid={`${WHATS_CHANGED_RECEIPT_TESTID}-compared-with`}>
        {view.comparedWith ?? 'Compared with the earlier run.'}
      </p>
      <button
        type="button"
        className={`${typography.panelMeta} ${action('inline')} mt-1`}
        data-testid={`${WHATS_CHANGED_RECEIPT_TESTID}-open`}
        onClick={() => { useUIStore.getState().setActiveOutputTab('compare') }}
      >
        View comparison
      </button>
    </section>
  )
}

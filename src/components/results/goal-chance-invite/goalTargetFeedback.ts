import { useShowToastSafe } from '../../../canvas/ToastContext'
import { goalTargetSettlementNotice } from '../../../canvas/conversation/goalTargetEdit'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNew/analysisNewCopy'
import type { SuccessTargetLineProps } from '../analysisNew/sections/SuccessTargetLine'

/** Canvas and Reasoning report the same target-door outcomes and send settlements. */
export function useGoalTargetFeedback() {
  const showToast = useShowToastSafe()
  const onCommitOutcome: SuccessTargetLineProps['onCommitOutcome'] = (outcome) =>
    showToast(
      outcome === 'dispatched' ? COPY.successTarget.dispatched
        : outcome === 'local_only' ? COPY.successTarget.changedLocally
          : outcome === 'no_unit' ? COPY.successTarget.noUnit
            : outcome === 'not_a_number' ? COPY.successTarget.notANumber
              : COPY.successTarget.notEncodable,
    )
  const onSendSettled: NonNullable<SuccessTargetLineProps['onSendSettled']> = (settlement, detail) => {
    const notice = goalTargetSettlementNotice(settlement, detail)
    if (notice !== null) showToast(notice, settlement === 'refused' ? 'error' : 'warning')
  }
  return { onCommitOutcome, onSendSettled }
}

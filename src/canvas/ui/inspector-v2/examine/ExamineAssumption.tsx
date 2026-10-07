/** Examine sends a chip about its typed target. Any proposed change returns for approval. */
import { useCallback, useMemo } from 'react'

import { useGuidanceStore } from '../../../stores/guidanceStore'
import { factorDisplayText } from '../../../../utils/formatFactorDisplayValue'
import type { AttentionReason } from '../../../nodes/shared/nodeAttention'
import { typography } from '../../../../styles/typography'
import { canReceiveAsk, requestAsk } from '../askSemantic'
import { inspectorButton, inspectorButtonRow, inspectorDetailRow, inspectorHeading } from '../inspectorStyle'
import { buildExamineAssumptionView, EXAMINE_ACTION, EXAMINE_HEADING, EXAMINE_LIMIT } from './examineAssumptionView'

export function ExamineAssumption({
  nodeId,
  label,
  data,
  reasons,
}: {
  nodeId: string
  label: string
  /** The factor node's data (the card's own reading of its figure and its `observedState`). */
  data: Record<string, unknown> | undefined
  reasons: readonly AttentionReason[]
}) {
  const canAsk = useGuidanceStore(canReceiveAsk)
  const view = useMemo(
    () => buildExamineAssumptionView({ label, valueText: factorDisplayText(data), observed: data?.observedState, reasons }),
    [label, data, reasons],
  )
  const prepare = useCallback(() => {
    if (!view) return
    requestAsk({ text: view.prepare.text, label: view.prepare.label, targetId: nodeId, intent: 'challenge' })
  }, [view, nodeId])

  if (!view || !canAsk) return null

  return (
    <section data-testid="inspector-examine" data-basis={view.basis} aria-label={EXAMINE_HEADING}>
      <h4 className={inspectorHeading}>{EXAMINE_HEADING}</h4>
      <div className={inspectorDetailRow}>
        <span className="text-text-light">We assume</span>
        <span data-testid="inspector-examine-value" className="text-text-body text-right">{view.value}</span>
      </div>
      {view.origin && (
        <div className={inspectorDetailRow}>
          <span className="text-text-light">From</span>
          <span data-testid="inspector-examine-origin" className="text-text-body text-right">{view.origin}</span>
        </div>
      )}
      <p data-testid="inspector-examine-why" className={`mt-2 ${typography.panelBody} text-text-body`}>{view.why}</p>
      <div className={`${inspectorButtonRow} pt-2`}>
        <button type="button" data-testid="inspector-examine-prepare" onClick={prepare} className={inspectorButton}>
          {EXAMINE_ACTION}
        </button>
      </div>
      <p className={`mt-1.5 ${typography.panelMeta} text-text-light`}>{EXAMINE_LIMIT}</p>
    </section>
  )
}

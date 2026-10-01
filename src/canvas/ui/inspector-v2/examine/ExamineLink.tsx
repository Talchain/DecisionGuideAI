/**
 * ⭐ EXAMINE THIS LINK — the edge inspector section (slice 1, 52f8cd). The view is `examineLinkView.ts`.
 *
 * ⛔ READ-ONLY AND PREFILL-ONLY, exactly as `ExamineAssumption`: its one action goes through `requestAsk`, which never
 * dispatches. No `targetId`: the ask binds to the selection, which holds this edge while its inspector is open.
 * Fragility is read the way `EdgePanel` reads it (`isEdgeFragile` with the parallel-edge context), so the section and
 * the panel's own fragile cue cannot disagree. Hidden, not disabled, when nothing can receive an ask.
 */
import { useCallback, useMemo } from 'react'

import { useCanvasStore } from '../../../store'
import { useGuidanceStore } from '../../../stores/guidanceStore'
import { isEdgeFragile, parallelEdgeIdsFor, type FragileEdgeCandidate } from '../../../utils/fragileEdgeMatch'
import { typography } from '../../../../styles/typography'
import { canReceiveAsk, requestAsk } from '../askSemantic'
import { inspectorButton, inspectorButtonRow, inspectorDetailRow, inspectorHeading } from '../inspectorStyle'
import { useRobustness } from '../useAnalysisResults'
import { buildExamineLinkView, EXAMINE_LINK_ACTION, EXAMINE_LINK_HEADING, EXAMINE_LINK_LIMIT } from './examineLinkView'

export function ExamineLink({
  edgeId,
  source,
  target,
  sourceLabel,
  targetLabel,
  data,
  structural,
}: {
  edgeId: string
  source: string
  target: string
  sourceLabel: string
  targetLabel: string
  data: Record<string, unknown> | undefined
  structural: boolean
}) {
  const canAsk = useGuidanceStore(canReceiveAsk)
  const edges = useCanvasStore((s) => s.edges)
  const robustness = useRobustness()
  const fragile = useMemo(() => {
    if (!robustness?.fragile_edges) return false
    return isEdgeFragile(edgeId, source, target, robustness.fragile_edges as FragileEdgeCandidate[], {
      parallelEdgeIds: parallelEdgeIdsFor(edges, source, target),
    })
  }, [robustness, edgeId, source, target, edges])
  const view = useMemo(
    () => buildExamineLinkView({ sourceLabel, targetLabel, data, structural, fragile }),
    [sourceLabel, targetLabel, data, structural, fragile],
  )
  const prepare = useCallback(() => {
    if (!view) return
    requestAsk({ text: view.prepare.text, label: view.prepare.label })
  }, [view])

  if (!view || !canAsk) return null

  return (
    <section data-testid="inspector-examine-link" data-basis={view.basis} aria-label={EXAMINE_LINK_HEADING}>
      <h4 className={inspectorHeading}>{EXAMINE_LINK_HEADING}</h4>
      <div className={inspectorDetailRow}>
        <span className="text-text-light">We assume</span>
        <span data-testid="inspector-examine-link-value" className="text-text-body text-right">{view.value}</span>
      </div>
      <p data-testid="inspector-examine-link-why" className={`mt-2 ${typography.panelBody} text-text-body`}>{view.why}</p>
      <div className={`${inspectorButtonRow} pt-2`}>
        <button type="button" data-testid="inspector-examine-link-prepare" onClick={prepare} className={inspectorButton}>
          {EXAMINE_LINK_ACTION}
        </button>
      </div>
      <p className={`mt-1.5 ${typography.panelMeta} text-text-light`}>{EXAMINE_LINK_LIMIT}</p>
    </section>
  )
}

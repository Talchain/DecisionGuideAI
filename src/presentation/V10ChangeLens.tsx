/**
 * v10 (#/canvas2): the "What would change" lens on the option cards. One mark, read from what CEE already served:
 * a small driver badge, resting as an icon only. Hovering or focusing it says CEE's own sentence for what that option's
 * chance rests on most (`RunView.mainDriverDetailOf`, the gated canonical `main_driver.detail`), verbatim, through the
 * tooltip. An option CEE served no sentence for draws no badge: its figure is never worded here.
 *
 * Deliberately NOT drawn (Codex review of #3093):
 *   - nothing on figure cards. Fragility belongs to the link, not the figure's value, and the lens already widens and
 *     marks fragile links; the host does not pick which figure to look into from sensitivity alone ("worth finding out"
 *     was a second answer, not served guidance);
 *   - the board's driver chart and "works above about 6%": CEE serves only the side where the chance falls, and no
 *     switch point.
 * The badge hangs on the card's corner, out of flow, so no card changes height. Nothing dims. It drops at the line rung,
 * as the card's own marks do.
 */
import { useMemo } from 'react'
import { Activity } from 'lucide-react'
import Tooltip from '../components/Tooltip'
import { isGraphLensEnabled } from '../flags'
import { runViewOf } from '../canvas/runView/runView'
import { useCanonicalAnalysisViewStore } from '../canvas/stores/canonicalAnalysisViewStore'
import { NODE_TOOLTIP_DELAY_MS } from '../canvas/nodes/shared/nodeTooltip'
import { useCanvasStore } from '../canvas/store'
import { selectLodBodyHidden } from '../canvas/utils/zoomLegibility'
import { usePresentation } from './v10'

export const V10_CHANGE_COPY = { driverAria: 'Its main driver' } as const

function OptionDriverBadge({ nodeId }: { nodeId: string }) {
  const report = useCanvasStore((s) => (s.results.status === 'complete' ? s.results.report : null))
  const scenarioId = useCanvasStore((s) => s.currentScenarioId)
  const heldView = useCanonicalAnalysisViewStore((s) => s.view)
  const heldScenarioId = useCanonicalAnalysisViewStore((s) => s.scenarioId)
  const detail = useMemo(
    () => runViewOf(report, heldScenarioId === scenarioId ? heldView : null).mainDriverDetailOf(nodeId),
    [report, heldView, heldScenarioId, scenarioId, nodeId],
  )
  if (detail === null) return null
  return (
    <Tooltip asChild content={detail} delay={NODE_TOOLTIP_DELAY_MS}>
      <span
        data-testid={`v10-change-driver-${nodeId}`}
        data-node-tooltip="true"
        role="img"
        tabIndex={0}
        aria-label={V10_CHANGE_COPY.driverAria}
        className="pointer-events-auto absolute -right-2 -top-2 z-10 inline-grid h-5 w-5 place-items-center rounded-full border border-panel-border bg-panel text-text-light shadow-1"
      >
        <Activity aria-hidden="true" className="h-3 w-3" />
      </span>
    </Tooltip>
  )
}

/** Mount once inside a card (`BaseNode`). Draws nothing outside #/canvas2, outside the lens, at the line rung, or on other card kinds. */
export function V10ChangeMarks({ nodeId, nodeType }: { nodeId: string; nodeType: string | undefined }) {
  const isV10 = usePresentation() === 'v10'
  const lensOn = useCanvasStore((s) => isV10 && isGraphLensEnabled() && s.lens.active === 'what_changes' && s.results.status === 'complete' && !selectLodBodyHidden(s))
  if (!lensOn || nodeType !== 'option') return null
  return <OptionDriverBadge nodeId={nodeId} />
}

import type { JourneyStage } from '../../hooks/useGuideStore'
import { EmptyState } from './states/EmptyState'
import { BuildingState } from './states/BuildingState'
import { PreRunBlockedState } from './states/PreRunBlockedState'
import { PreRunReadyState } from './states/PreRunReadyState'
import { PostRunState } from './states/PostRunState'
import { InspectorState } from './states/InspectorState'

/**
 * Comparison re-compute is RETIRED, not broken.
 *
 * `CompareState` drove `useCompareData` → a direct browser→PLoT `/v1/diff` call.
 * That is a legacy direct-analysis caller: canonical analysis is UI→CEE→PLoT→ISL,
 * and the browser holds no PLoT credential. Rather than secure the direct call we
 * retired it, so this surface now SAYS SO instead of silently rendering an empty
 * comparison — the honest-failure rule: a surface that cannot compute must not
 * look like one that computed and found nothing.
 *
 * Re-routing comparison compute through CEE is the rowed successor.
 */
function ComparisonUnavailableState() {
  return (
    <div className="p-4 text-sm text-gray-700" data-testid="compare-unavailable">
      <p className="font-medium">Comparison re-compute is unavailable</p>
      <p className="mt-1 text-gray-600">
        Scenario comparison used to compute directly against the analysis engine. That
        path has been retired. Comparison will return once it runs through the assistant,
        alongside the rest of analysis.
      </p>
    </div>
  )
}

interface GuidePanelProps {
  stage: JourneyStage
}

/**
 * Guide Panel - Adaptive panel container
 *
 * Renders different content based on the current journey stage.
 * Each state component is responsible for showing relevant
 * information and actions for that stage of the user's journey.
 */
export function GuidePanel({ stage }: GuidePanelProps) {
  // Render different content based on journey stage
  switch (stage) {
    case 'empty':
      return <EmptyState />
    case 'building':
      return <BuildingState />
    case 'inspector':
      return <InspectorState />
    case 'pre-run-blocked':
      return <PreRunBlockedState />
    case 'pre-run-ready':
      return <PreRunReadyState />
    case 'post-run':
      return <PostRunState />
    case 'compare':
      return <ComparisonUnavailableState />
    default:
      return <BuildingState />
  }
}

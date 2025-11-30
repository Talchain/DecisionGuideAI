import type { JourneyStage } from '../../hooks/useGuideStore'
import { EmptyState } from './states/EmptyState'
import { BuildingState } from './states/BuildingState'
import { PreRunBlockedState } from './states/PreRunBlockedState'
import { PreRunReadyState } from './states/PreRunReadyState'
import { PostRunState } from './states/PostRunState'
import { InspectorState } from './states/InspectorState'
import { CompareState } from './states/CompareState'

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
      return <CompareState />
    default:
      return <BuildingState />
  }
}

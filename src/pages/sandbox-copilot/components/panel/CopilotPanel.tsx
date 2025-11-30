import type { JourneyStage } from '../../hooks/useCopilotStore'
import { EmptyState } from './states/EmptyState'
import { BuildingState } from './states/BuildingState'
import { PreRunBlockedState } from './states/PreRunBlockedState'
import { PreRunReadyState } from './states/PreRunReadyState'
import { PostRunState } from './states/PostRunState'
import { InspectorState } from './states/InspectorState'
import { CompareState } from './states/CompareState'

interface CopilotPanelProps {
  stage: JourneyStage
}

/**
 * Copilot Panel - Adaptive panel container
 *
 * Renders different content based on the current journey stage.
 * Each state component is responsible for showing relevant
 * information and actions for that stage of the user's journey.
 */
export function CopilotPanel({ stage }: CopilotPanelProps) {
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

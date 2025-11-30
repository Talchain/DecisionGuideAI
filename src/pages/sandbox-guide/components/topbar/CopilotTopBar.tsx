/**
 * Copilot Top Bar
 *
 * Displays critical alerts and status information:
 * - Journey stage indicator
 * - Critical blockers/warnings
 * - Run status
 * - Quick actions
 */

import { useCopilotStore } from '../../hooks/useCopilotStore'
import { useResultsStore } from '@/canvas/stores/resultsStore'
import { useCanvasStore } from '@/canvas/store'
import { findBlockers } from '../../utils/journeyDetection'
import { Badge } from '../shared/Badge'
import { Button } from '../shared/Button'

export function CopilotTopBar(): JSX.Element {
  const journeyStage = useCopilotStore((state) => state.journeyStage)
  const nodes = useCanvasStore((state) => state.nodes)
  const edges = useCanvasStore((state) => state.edges)
  const resultsStatus = useResultsStore((state) => state.status)
  const report = useResultsStore((state) => state.report)

  // Check for blockers
  const blockers = findBlockers({ nodes, edges })
  const hasBlockers = blockers.length > 0

  // Get stage display info
  const getStageInfo = (): { label: string; variant: 'success' | 'warning' | 'error' | 'info' | 'neutral' } => {
    switch (journeyStage) {
      case 'empty':
        return { label: 'Getting Started', variant: 'neutral' }
      case 'building':
        return { label: 'Building Model', variant: 'info' }
      case 'pre-run-blocked':
        return { label: 'Blocked', variant: 'error' }
      case 'pre-run-ready':
        return { label: 'Ready to Run', variant: 'success' }
      case 'post-run':
        return { label: 'Analysis Complete', variant: 'success' }
      case 'inspector':
        return { label: 'Inspecting', variant: 'info' }
      case 'compare':
        return { label: 'Comparing', variant: 'info' }
      default:
        return { label: 'Unknown', variant: 'neutral' }
    }
  }

  const stageInfo = getStageInfo()

  // Critical alert to show
  const getCriticalAlert = (): { message: string; type: 'error' | 'warning' | null } | null => {
    if (journeyStage === 'pre-run-blocked' && hasBlockers) {
      return {
        message: `${blockers.length} issue${blockers.length > 1 ? 's' : ''} preventing analysis`,
        type: 'error',
      }
    }

    if (resultsStatus === 'error') {
      return {
        message: 'Analysis failed - please try again',
        type: 'error',
      }
    }

    if (resultsStatus === 'loading') {
      return {
        message: 'Running analysis...',
        type: 'warning',
      }
    }

    return null
  }

  const criticalAlert = getCriticalAlert()

  return (
    <div className="h-12 border-b border-storm-200 bg-white flex items-center px-4 gap-4">
      {/* Left: Branding + Stage */}
      <div className="flex items-center gap-3">
        <div className="text-sm font-semibold text-charcoal-900">Decision Coach</div>
        <div className="w-px h-6 bg-storm-200" />
        <Badge variant={stageInfo.variant}>{stageInfo.label}</Badge>
      </div>

      {/* Center: Critical Alert */}
      {criticalAlert && (
        <div className="flex-1 flex items-center justify-center">
          <div
            className={`flex items-center gap-2 px-3 py-1 rounded text-xs ${
              criticalAlert.type === 'error'
                ? 'bg-critical-50 text-critical-800 border border-critical-200'
                : 'bg-creative-50 text-creative-800 border border-creative-200'
            }`}
          >
            <span>{criticalAlert.type === 'error' ? '⚠️' : '⏳'}</span>
            <span>{criticalAlert.message}</span>
          </div>
        </div>
      )}

      {/* Right: Stats */}
      {!criticalAlert && (
        <div className="flex-1 flex items-center justify-end gap-4 text-xs text-storm-600">
          <div className="flex items-center gap-1">
            <span className="font-medium">{nodes.length}</span>
            <span>nodes</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="font-medium">{edges.length}</span>
            <span>connections</span>
          </div>
          {report && report.drivers && (
            <div className="flex items-center gap-1">
              <span className="font-medium">{report.drivers.length}</span>
              <span>drivers</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

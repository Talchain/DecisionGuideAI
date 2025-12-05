/**
 * Guide Canvas Overlay
 *
 * Provides visual enhancements to the canvas for the guide variant:
 * - Top driver highlighting (border glow on important nodes)
 * - Visual legend showing what colors/highlights mean
 * - Subtle importance indicators
 *
 * Uses ReactFlow Panel component for proper positioning.
 */

import { Panel } from '@xyflow/react'
import { useResultsStore } from '@/canvas/stores/resultsStore'
import { useGuideStore } from '../../hooks/useGuideStore'
import { Badge } from '../shared/Badge'

export interface GuideCanvasOverlayProps {
  enabled?: boolean
}

/**
 * Canvas overlay that adds guide-specific visual enhancements
 * Displayed as a legend in the bottom-left corner
 */
export function GuideCanvasOverlay({ enabled = true }: GuideCanvasOverlayProps): JSX.Element | null {
  const report = useResultsStore((state) => state.report)
  const selectElement = useGuideStore((state) => state.selectElement)

  // Don't render if disabled or no results
  if (!enabled || !report) {
    return null
  }

  const drivers = report.drivers || []
  const topDrivers = drivers.slice(0, 3)

  if (topDrivers.length === 0) {
    return null
  }

  const handleDriverClick = (nodeId: string) => {
    selectElement(nodeId)
  }

  return (
    <Panel position="bottom-left" className="m-4">
      <div className="bg-white/95 backdrop-blur rounded-lg shadow-lg border border-storm-200 p-3 w-64">
        <div className="text-xs font-semibold text-charcoal-900 mb-2">Top Impact Drivers</div>
        <div className="space-y-1.5">
          {topDrivers.map((driver, idx) => (
            <button
              key={driver.node_id}
              onClick={() => handleDriverClick(driver.node_id)}
              className="w-full flex items-center gap-2 text-xs hover:bg-storm-50 p-1.5 rounded transition-colors cursor-pointer"
            >
              <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                <div
                  className={`w-3 h-3 rounded-full ${
                    idx === 0
                      ? 'bg-analytical-600'
                      : idx === 1
                        ? 'bg-analytical-400'
                        : 'bg-analytical-300'
                  }`}
                />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <div className="text-charcoal-900 truncate">{driver.label}</div>
              </div>
              <div className="flex-shrink-0">
                <Badge variant="info" className="text-xs">
                  {Math.round(driver.contribution * 100)}%
                </Badge>
              </div>
            </button>
          ))}
        </div>

        {drivers.length > 3 && (
          <div className="mt-2 pt-2 border-t border-storm-100 text-xs text-storm-600">
            +{drivers.length - 3} more drivers
          </div>
        )}

        <div className="mt-3 pt-2 border-t border-storm-100 text-xs text-storm-600">
          💡 Click a driver to inspect it
        </div>
      </div>
    </Panel>
  )
}

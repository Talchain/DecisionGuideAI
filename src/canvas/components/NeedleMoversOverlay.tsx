/**
 * M4: Needle-Movers Overlay
 * Highlights nodes with highest impact on decision
 */

import { TrendingUp, Target } from 'lucide-react'
import type { NeedleMover } from '../validation/types'

interface NeedleMoversOverlayProps {
  movers: NeedleMover[]
  onFocusNode: (nodeId: string) => void
}

const impactColors = {
  high: 'bg-red-500',
  medium: 'bg-orange-500',
  low: 'bg-yellow-500',
}

const impactTextColors = {
  high: 'text-red-700 bg-red-50 border-red-200',
  medium: 'text-orange-700 bg-orange-50 border-orange-200',
  low: 'text-yellow-700 bg-yellow-50 border-yellow-200',
}

export function NeedleMoversOverlay({ movers, onFocusNode }: NeedleMoversOverlayProps) {
  if (movers.length === 0) {
    return null
  }

  // Sort by impact (descending)
  const sortedMovers = [...movers].sort((a, b) => b.impact - a.impact)

  return (
    <div className="absolute top-4 right-4 bg-white rounded-lg border border-gray-200 shadow-lg p-3 w-72 z-10">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Target className="w-5 h-5 text-purple-600" />
        <h3 className="font-semibold text-gray-900">Key Factors</h3>
      </div>

      {/* Movers list */}
      <div className="space-y-2">
        {sortedMovers.slice(0, 5).map((mover) => (
          <button
            key={mover.nodeId}
            onClick={() => onFocusNode(mover.nodeId)}
            className={`w-full text-left p-2 rounded border ${impactTextColors[mover.type]} hover:bg-opacity-80 transition-colors`}
          >
            <div className="flex items-center gap-2 mb-1">
              {/* Impact indicator */}
              <div className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full ${impactColors[mover.type]}`} />
                <TrendingUp className="w-3 h-3" />
              </div>

              {/* Node label */}
              <span className="font-medium text-sm flex-1 truncate">
                {mover.nodeId}
              </span>

              {/* Impact percentage */}
              <span className="text-xs font-semibold">
                {Math.round(mover.impact * 100)}%
              </span>
            </div>

            {/* Reason */}
            <p className="text-xs opacity-80 truncate">{mover.reason}</p>
          </button>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-3 pt-3 border-t border-gray-200 flex gap-3 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span className="text-gray-600">High</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-orange-500" />
          <span className="text-gray-600">Medium</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-yellow-500" />
          <span className="text-gray-600">Low</span>
        </div>
      </div>
    </div>
  )
}

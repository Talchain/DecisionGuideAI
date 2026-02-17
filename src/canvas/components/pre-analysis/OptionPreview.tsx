/**
 * OptionPreview — Collapsible section showing what each option does.
 *
 * Highest-value pre-analysis check: "Did the AI understand my options?"
 * Shows direction arrows by comparing intervention values to current observed_state.
 *
 * Data source: ceeAnalysisReady.options[] via usePreAnalysisData().optionPreviews
 */

import { useState } from 'react'
import { ChevronDown, ChevronRight, ClipboardList, ArrowUp, ArrowDown, Minus } from 'lucide-react'
import { Pill } from './primitives'
import type { OptionPreviewData } from './hooks/usePreAnalysisData'

interface OptionPreviewProps {
  options: OptionPreviewData[]
  onFocusNode?: (nodeId: string) => void
  onHoverEnter?: (type: 'node' | 'edge', id: string) => void
  onHoverLeave?: () => void
}

function InterventionArrow({ direction }: { direction: 'up' | 'down' | 'same' }) {
  if (direction === 'up') return <ArrowUp className="w-3 h-3 text-success" />
  if (direction === 'down') return <ArrowDown className="w-3 h-3 text-danger" />
  return <Minus className="w-3 h-3 text-text-light" />
}

export function OptionPreview({
  options,
  onFocusNode,
  onHoverEnter,
  onHoverLeave,
}: OptionPreviewProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  if (options.length === 0) return null

  return (
    <div className="rounded-lg border border-panel-border" data-testid="option-preview">
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-black/[0.02]"
      >
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-text-light" />
          <span className="text-sm font-semibold text-text-body">Your options</span>
        </div>
        <div className="flex items-center gap-2">
          <Pill size="small" variant="success">{options.length}</Pill>
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-text-light" />
          ) : (
            <ChevronRight className="w-4 h-4 text-text-light" />
          )}
        </div>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="px-3 pb-3">
          {options.map((opt, idx) => (
            <div
              key={opt.id}
              className={`py-2 ${idx > 0 ? 'border-t border-panel-border' : ''}`}
              onMouseEnter={() => onHoverEnter?.('node', opt.id)}
              onMouseLeave={() => onHoverLeave?.()}
            >
              {/* Option label + status badge */}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => onFocusNode?.(opt.id)}
                  className="text-sm font-semibold text-text-header hover:underline cursor-pointer text-left"
                >
                  {opt.label}
                </button>
                <Pill
                  size="small"
                  variant={opt.status === 'ready' ? 'success' : 'danger'}
                >
                  {opt.status === 'ready' ? 'Ready' : 'Needs mapping'}
                </Pill>
              </div>

              {/* Interventions */}
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                {opt.isBaseline && opt.interventions.length > 0 ? (
                  <span className="text-xs text-text-light">
                    {opt.interventions.length} factors at current values
                  </span>
                ) : (
                  opt.interventions.map(iv => (
                    <span key={iv.factorId} className="inline-flex items-center gap-1 text-xs text-text-body">
                      <InterventionArrow direction={iv.direction} />
                      <span>{iv.factorLabel}</span>
                      <span className="text-text-light">{iv.interventionValue.toFixed(2)}</span>
                    </span>
                  ))
                )}
                {opt.interventions.length === 0 && !opt.isBaseline && (
                  <span className="text-xs text-text-light">No interventions mapped</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default OptionPreview

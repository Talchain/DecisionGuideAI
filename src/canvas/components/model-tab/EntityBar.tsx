/**
 * EntityBar — stacked entity composition bar with legend.
 *
 * 6px segmented bar proportional to node kinds, with a legend row below.
 * Extracted from ModelSummaryBar (health cards removed).
 */

import type { Node } from '@xyflow/react'
import { typography } from '../../../styles/typography'

const SEGMENT_COLOURS: Record<string, string> = {
  goal:     'var(--color-goal, #f59e0b)',
  decision: 'var(--color-info, #3b82f6)',
  option:   'var(--color-option, #8b5cf6)',
  factor:   'var(--color-factor, #6b7280)',
  risk:     'var(--color-danger, #ef4444)',
  outcome:  'var(--color-success, #10b981)',
}

const DOT_CLASSES: Record<string, string> = {
  goal:     'bg-goal',
  decision: 'bg-info',
  option:   'bg-option',
  factor:   'bg-factor',
  risk:     'bg-danger',
  outcome:  'bg-success',
}

const KIND_ORDER = ['goal', 'decision', 'option', 'factor', 'risk', 'outcome'] as const
type KindKey = typeof KIND_ORDER[number]

const KIND_LABELS: Record<KindKey, string> = {
  goal:     'goal',
  decision: 'decision',
  option:   'option',
  factor:   'factor',
  risk:     'risk',
  outcome:  'outcome',
}

interface EntityBarProps {
  grouped: Record<KindKey, Node[]>
  totalCount: number
}

export function EntityBar({ grouped, totalCount }: EntityBarProps) {
  if (totalCount === 0) return null

  return (
    <div className="mb-3" data-testid="model-entity-bar">
      {/* Segmented bar */}
      <div className="flex h-[6px] rounded-full overflow-hidden" style={{ gap: '1px' }}>
        {KIND_ORDER.map(kind => {
          const count = grouped[kind].length
          if (count === 0) return null
          const pct = (count / totalCount) * 100
          return (
            <div
              key={kind}
              style={{ width: `${pct}%`, backgroundColor: SEGMENT_COLOURS[kind] }}
              className="shrink-0"
            />
          )
        })}
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
        {KIND_ORDER.map(kind => {
          const count = grouped[kind].length
          if (count === 0) return null
          return (
            <div key={kind} className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${DOT_CLASSES[kind]}`} aria-hidden="true" />
              <span className={`${typography.panelMeta} text-text-light`}>
                {count} {KIND_LABELS[kind]}{count !== 1 ? 's' : ''}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export type { KindKey }

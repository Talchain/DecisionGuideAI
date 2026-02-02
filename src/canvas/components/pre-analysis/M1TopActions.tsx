/**
 * M1TopActions - Coach section placeholder
 *
 * Blue-tinted background card with static coaching sentence.
 * Max 3 items from topActions with numbered index, label, detail, optional BiasIcon.
 * Category background/border treatment matching the item's source category.
 *
 * This section always renders in M1 — M2 Coach replaces it later.
 */

import { BiasIcon } from './primitives'
import type { ImprovementItem, ImprovementCategory } from './hooks/usePreAnalysisData'

interface M1TopActionsProps {
  /** Top 3 priority items */
  topActions: ImprovementItem[]
}

/** Category styling per brief spec */
const categoryStyles: Record<ImprovementCategory, { bg: string; border: string }> = {
  fix: {
    bg: 'bg-[rgba(234,123,75,0.07)]',
    border: 'border-l-danger',
  },
  verify: {
    bg: 'bg-[rgba(255,166,86,0.07)]',
    border: 'border-l-warning',
  },
  add_evidence: {
    bg: 'bg-[rgba(176,168,153,0.04)]',
    border: 'border-l-panel-border',
  },
  strengthen: {
    bg: 'bg-[rgba(176,168,153,0.04)]',
    border: 'border-l-panel-border',
  },
}

export function M1TopActions({ topActions }: M1TopActionsProps) {
  if (topActions.length === 0) {
    return null
  }

  return (
    <div
      className="rounded-xl border-l-[3px] border-l-info p-4"
      style={{ backgroundColor: 'rgba(99, 173, 207, 0.08)' }}
    >
      {/* Static coaching sentence */}
      <p className="text-sm text-text-body mb-3">
        Review these items to improve your model's accuracy
      </p>

      {/* Top actions list */}
      <div className="space-y-2">
        {topActions.map((item, index) => {
          const styles = categoryStyles[item.category]

          return (
            <div
              key={item.key}
              className={`
                flex items-start gap-3 p-3 rounded-lg border-l-[3px]
                ${styles.bg} ${styles.border}
              `}
            >
              {/* Numbered index */}
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-info text-white text-xs font-semibold flex items-center justify-center">
                {index + 1}
              </span>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-header">
                  {item.label}
                </p>
                <p className="text-xs text-text-light mt-0.5">
                  {item.detail}
                </p>
              </div>

              {/* Optional BiasIcon */}
              {item.bias && (
                <BiasIcon
                  bias={item.bias}
                  why={item.detail}
                  className="flex-shrink-0"
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default M1TopActions

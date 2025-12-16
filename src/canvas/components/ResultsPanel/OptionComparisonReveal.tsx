/**
 * OptionComparisonReveal - Progressive disclosure of option comparison
 *
 * Brief H Task 3: Shows comparison between options with reveal animation
 *
 * Features:
 * - Shows winner with margin percentage
 * - Progressive reveal of comparison details
 * - Click to start full comparison flow
 * - Handles tie/close-call scenarios
 */

import { useState, useCallback } from 'react'
import { ChevronDown, ChevronRight, Trophy, GitCompare, AlertTriangle } from 'lucide-react'
import { typography } from '../../../styles/typography'
import type { RankingData } from '../DecisionSummary'

interface OptionComparisonRevealProps {
  /** Ranking data from comparison */
  ranking: RankingData
  /** Callback to start full comparison */
  onCompareClick?: () => void
  /** Loading state for comparison */
  loading?: boolean
}

export function OptionComparisonReveal({
  ranking,
  onCompareClick,
  loading = false,
}: OptionComparisonRevealProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const handleToggle = useCallback(() => {
    setIsExpanded(prev => !prev)
  }, [])

  const isWinner = ranking.rank === 1
  const isCloseCall = ranking.confidence === 'low'

  return (
    <div
      className="border border-sand-200 rounded-lg overflow-hidden"
      data-testid="option-comparison-reveal"
    >
      {/* Header - always visible */}
      <button
        type="button"
        onClick={handleToggle}
        className="w-full px-3 py-2.5 flex items-center justify-between bg-paper-50 hover:bg-sand-50 transition-colors"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-ink-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-ink-500" />
          )}
          <span className={`${typography.bodySmall} font-medium text-ink-800`}>
            Option Ranking
          </span>
        </div>

        {/* Ranking badge */}
        <div className="flex items-center gap-2">
          {isWinner ? (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-mint-100">
              <Trophy className="h-3.5 w-3.5 text-mint-600" aria-hidden="true" />
              <span className={`${typography.caption} font-medium text-mint-700`}>
                Best option
              </span>
              {ranking.marginPct !== undefined && ranking.marginPct > 0 && (
                <span className={`${typography.caption} text-mint-600`}>
                  (+{ranking.marginPct.toFixed(0)}%)
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-sand-100">
              <span className={`${typography.caption} font-medium text-ink-600`}>
                #{ranking.rank} of {ranking.totalOptions}
              </span>
            </div>
          )}

          {isCloseCall && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-banana-100">
              <AlertTriangle className="h-3 w-3 text-banana-600" aria-hidden="true" />
              <span className={`${typography.caption} text-banana-700`}>
                Close call
              </span>
            </div>
          )}
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-3 py-3 border-t border-sand-200 space-y-3">
          {/* Comparison summary */}
          <div className="text-center">
            <p className={`${typography.bodySmall} text-ink-700`}>
              {isWinner ? (
                <>
                  <span className="font-semibold">{ranking.currentOptionName || 'This option'}</span>
                  {' '}performs best
                  {ranking.marginPct !== undefined && ranking.marginPct > 0 && (
                    <> with a <span className="font-semibold text-mint-700">{ranking.marginPct.toFixed(0)}%</span> margin</>
                  )}
                </>
              ) : (
                <>
                  <span className="font-semibold">{ranking.winnerName || 'Another option'}</span>
                  {' '}currently performs best
                </>
              )}
            </p>

            {isCloseCall && (
              <p className={`${typography.caption} text-banana-700 mt-1`}>
                Results are close - consider reviewing key assumptions before deciding
              </p>
            )}
          </div>

          {/* Compare button */}
          <button
            type="button"
            onClick={onCompareClick}
            disabled={loading}
            className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors ${
              loading
                ? 'bg-sand-200 text-ink-500 cursor-not-allowed'
                : 'bg-sky-600 text-white hover:bg-sky-700'
            }`}
          >
            <GitCompare className="h-4 w-4" aria-hidden="true" />
            {loading ? 'Comparing...' : `Compare ${ranking.totalOptions} Options`}
          </button>
        </div>
      )}
    </div>
  )
}

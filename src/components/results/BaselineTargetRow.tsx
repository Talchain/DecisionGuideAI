/**
 * BaselineTargetRow — V14 compact single-line row showing baseline + success target.
 *
 * Layout: "No baseline set · Add  |  No target set · Add  ⓘ"
 * Reuses BaselineToggleCard internally for baseline selection UI.
 */

import { useState } from 'react'
import { Info } from 'lucide-react'
import { typography } from '../../styles/typography'
import { BaselineToggleCard, type BaselineOption } from './BaselineToggleCard'

export interface BaselineTargetRowProps {
  /** Available options for baseline selection */
  baselineOptions?: BaselineOption[]
  /** Currently selected baseline label */
  baselineLabel?: string
  /** Whether analysis is running */
  isRunning?: boolean
  /** Callback to add baseline to draft */
  onAddBaseline?: () => void
  /** Callback to set baseline by option ID */
  onSetBaseline?: (optionId: string) => void
  /** Current goal threshold (target value) */
  goalThreshold?: number | null
  /** Unit metadata for formatting target value */
  outcomeUnit?: 'currency' | 'percent' | 'count'
  /** Currency symbol */
  outcomeUnitSymbol?: string
  /** Callback to navigate to target input (SuccessTargetRow in Options Compare) */
  onEditTarget?: () => void
}

function formatTargetValue(
  value: number,
  unit?: 'currency' | 'percent' | 'count',
  symbol?: string,
): string {
  if (unit === 'currency' && symbol) return `${symbol}${value.toLocaleString()}`
  if (unit === 'percent') return `${value}%`
  return String(value)
}

export function BaselineTargetRow({
  baselineOptions,
  baselineLabel,
  isRunning,
  onAddBaseline,
  onSetBaseline,
  goalThreshold,
  outcomeUnit,
  outcomeUnitSymbol,
  onEditTarget,
}: BaselineTargetRowProps) {
  const [showTooltip, setShowTooltip] = useState(false)

  const hasBaseline = Boolean(baselineLabel)
  const hasTarget = goalThreshold != null
  const hasBaselineOptions = baselineOptions && baselineOptions.length > 0

  return (
    <div className="flex items-start gap-4 flex-wrap" data-testid="baseline-target-row">
      {/* Baseline section — reuses BaselineToggleCard */}
      {hasBaselineOptions && (
        <BaselineToggleCard
          show={true}
          isRunning={isRunning}
          onAddBaseline={onAddBaseline}
          onSetBaseline={onSetBaseline}
          options={baselineOptions}
          baselineLabel={baselineLabel}
        />
      )}

      {/* Separator */}
      {hasBaselineOptions && (
        <div className="border-l border-panel-border self-stretch my-0.5" aria-hidden="true" />
      )}

      {/* Target section */}
      <div className="flex items-center gap-1.5 py-1">
        {hasTarget ? (
          <>
            <span className={`${typography.panelMeta} text-text-light`}>
              Target: <span className="text-text-body">≥ {formatTargetValue(goalThreshold!, outcomeUnit, outcomeUnitSymbol)}</span>
            </span>
            {onEditTarget && (
              <>
                <span className={`${typography.panelMeta} text-text-light`} aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={onEditTarget}
                  className={`${typography.panelMeta} text-info hover:underline`}
                >
                  Edit
                </button>
              </>
            )}
          </>
        ) : (
          <>
            <span className={`${typography.panelMeta} text-text-light`}>
              No target set
            </span>
            {onEditTarget && (
              <>
                <span className={`${typography.panelMeta} text-text-light`} aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={onEditTarget}
                  className={`${typography.panelMeta} text-info hover:underline`}
                >
                  Add
                </button>
              </>
            )}
          </>
        )}

        {/* Info tooltip */}
        <div
          className="relative inline-flex"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <button
            type="button"
            className="text-text-light hover:text-text-body"
            aria-label="About baseline and target"
          >
            <Info className="w-3.5 h-3.5" />
          </button>
          {showTooltip && (
            <div
              className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50 px-3 py-2 bg-text-header text-white rounded-lg shadow-3"
              style={{ maxWidth: 220 }}
              role="tooltip"
            >
              <p className={typography.panelMeta}>
                A baseline shows where you are now. A success target shows what
                you're aiming for, each option's chance of reaching it.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

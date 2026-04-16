/**
 * BaselineTargetRow — V14 compact single-line row showing baseline + success target.
 *
 * Layout: "No baseline set · Add  |  No target set · Add  ⓘ"
 * Reuses BaselineToggleCard internally for baseline selection UI.
 */

import { Info } from 'lucide-react'
import { typography } from '../../styles/typography'
import { BaselineToggleCard, type BaselineOption } from './BaselineToggleCard'
import Tooltip from '../Tooltip'
import { formatTargetValue } from './utils/formatTargetValue'

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
  const hasBaseline = Boolean(baselineLabel)
  const hasTarget = goalThreshold != null
  const hasBaselineOptions = baselineOptions && baselineOptions.length > 0

  return (
    <div className="flex items-start gap-4 flex-wrap" data-testid="baseline-target-row">
      {/* Baseline section — always visible with appropriate state */}
      {hasBaselineOptions ? (
        <BaselineToggleCard
          show={true}
          isRunning={isRunning}
          onAddBaseline={onAddBaseline}
          onSetBaseline={onSetBaseline}
          options={baselineOptions}
          baselineLabel={baselineLabel}
        />
      ) : (
        <div className="flex items-center gap-1.5 py-1">
          <span className={`${typography.panelMeta} text-text-light`}>
            Baseline: <span className="text-text-body">not set</span>
          </span>
          {onAddBaseline && (
            <>
              <span className={`${typography.panelMeta} text-text-light`} aria-hidden="true">&middot;</span>
              <button
                type="button"
                onClick={onAddBaseline}
                className={`${typography.panelMeta} text-info hover:underline`}
              >
                Set
              </button>
            </>
          )}
        </div>
      )}

      {/* Separator — always shown */}
      <div className="w-px bg-panel-border self-stretch my-0.5" aria-hidden="true" />

      {/* Target section */}
      <div className="flex items-center gap-1.5 py-1">
        {hasTarget ? (
          <>
            <span className={`${typography.panelMeta} text-text-light`}>
              Target: <span className="text-text-body">{formatTargetValue(goalThreshold!, outcomeUnit, outcomeUnitSymbol)}</span>
            </span>
            {onEditTarget && (
              <>
                <span className={`${typography.panelMeta} text-text-light`} aria-hidden="true">&middot;</span>
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
              Target: <span className="text-text-body">not set</span>
            </span>
            {onEditTarget && (
              <>
                <span className={`${typography.panelMeta} text-text-light`} aria-hidden="true">&middot;</span>
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

        {/* Info tooltip — uses floating-ui Tooltip for auto flip/shift at panel edges */}
        <Tooltip
          content={
            <p className={typography.panelMeta}>
              A baseline shows where you are now. A success target shows what
              you're aiming for, each option's chance of reaching it.
            </p>
          }
        >
          <button
            type="button"
            className="text-text-light hover:text-text-body"
            aria-label="About baseline and target"
          >
            <Info className="w-3.5 h-3.5" />
          </button>
        </Tooltip>
      </div>
    </div>
  )
}

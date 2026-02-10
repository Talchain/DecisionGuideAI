/**
 * BaselineToggleCard Component (v7.8 redesign — inline dropdown)
 *
 * When no baseline: dropdown to select which option is the baseline + "Set as baseline" button
 * When baseline exists: "Baseline: {name} · Change" row
 *
 * C1: Baseline does NOT trigger rerun. Setting baseline mutates the
 * decision draft only. User must manually rerun.
 */

import { useState } from 'react'
import { typography } from '../../styles/typography'

export interface BaselineOption {
  id: string
  label: string
}

export interface BaselineToggleCardProps {
  /** Whether to show this card (typically: !hasBaseline && !isSingleOption) */
  show: boolean
  /** Whether an analysis is currently running */
  isRunning?: boolean
  /** Callback to add baseline to decision draft (does NOT trigger rerun) */
  onAddBaseline?: () => void
  /** Callback to set a specific option as baseline by ID */
  onSetBaseline?: (optionId: string) => void
  /** Available options the user can choose from */
  options?: BaselineOption[]
  /** Currently selected baseline option label */
  baselineLabel?: string
}

export function BaselineToggleCard({
  show,
  isRunning = false,
  onAddBaseline,
  onSetBaseline,
  options = [],
  baselineLabel,
}: BaselineToggleCardProps) {
  if (!show) return null

  // When switching from compact → change mode, preselect the current baseline
  const currentBaselineId = options.find(o => o.label === baselineLabel)?.id ?? ''
  const [selectedOptionId, setSelectedOptionId] = useState('')
  const [isChanging, setIsChanging] = useState(false)

  const handleSetBaseline = () => {
    if (selectedOptionId && onSetBaseline) {
      onSetBaseline(selectedOptionId)
      setSelectedOptionId('')
      setIsChanging(false)
    } else if (onAddBaseline) {
      onAddBaseline()
    }
  }

  // When baseline exists, show compact display
  if (baselineLabel && !isChanging) {
    return (
      <div
        className="flex items-center gap-3 px-4 py-2.5 bg-success-light border border-success/20 rounded-lg"
        data-testid="baseline-toggle-card"
      >
        <div className="w-1.5 h-1.5 rounded-full bg-success flex-shrink-0" aria-hidden="true" />
        <span className={`${typography.panelBody} text-text-body flex-1`}>
          Baseline: {baselineLabel}
        </span>
        <button
          onClick={() => { setIsChanging(true); setSelectedOptionId(currentBaselineId) }}
          className={`${typography.panelBody} text-info hover:underline flex-shrink-0`}
          disabled={isRunning}
          type="button"
        >
          Change
        </button>
      </div>
    )
  }

  return (
    <div
      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg ${
        isChanging ? 'bg-panel border border-panel-border' : 'bg-warning-light border border-warning/20'
      }`}
      data-testid="baseline-toggle-card"
    >
      <span className={`${typography.panelBody} text-text-body flex-shrink-0`}>
        {isChanging ? 'Change baseline:' : 'No baseline included:'}
      </span>
      {options.length > 0 ? (
        <>
          <select
            value={selectedOptionId}
            onChange={(e) => setSelectedOptionId(e.target.value)}
            className={`${typography.panelBody} w-[200px] bg-panel border border-panel-border rounded-xl px-3 py-1.5 text-text-body focus:outline-none focus:border-info`}
            disabled={isRunning}
          >
            <option value="">Select an option…</option>
            {options.map(opt => (
              <option key={opt.id} value={opt.id}>{opt.label}</option>
            ))}
          </select>
          <button
            onClick={handleSetBaseline}
            disabled={!selectedOptionId || isRunning}
            className={`${typography.panelBody} px-3 py-1.5 border border-panel-border text-text-body rounded-full hover:bg-panel-hover disabled:opacity-40 transition-colors flex-shrink-0`}
            type="button"
          >
            Set as baseline
          </button>
        </>
      ) : (
        <button
          onClick={() => onAddBaseline?.()}
          disabled={isRunning}
          className={`${typography.panelBody} text-info hover:underline flex-shrink-0`}
          type="button"
        >
          {isRunning ? 'Adding…' : 'Add baseline'}
        </button>
      )}
    </div>
  )
}

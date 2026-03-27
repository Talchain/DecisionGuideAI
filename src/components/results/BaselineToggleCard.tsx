/**
 * BaselineToggleCard Component (v7.10 — single-line inline row)
 *
 * No baseline: ● No baseline included · Set baseline
 * Baseline set: ● Baseline: {name} · Change
 * Selecting: dropdown rendered inline below the row
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
  /** Whether to show this card (typically: !isSingleOption) */
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

  const currentBaselineId = options.find(o => o.label === baselineLabel)?.id ?? ''
  const [selectedOptionId, setSelectedOptionId] = useState('')
  const [isSelecting, setIsSelecting] = useState(false)

  const handleSetBaseline = () => {
    if (selectedOptionId && onSetBaseline) {
      onSetBaseline(selectedOptionId)
      setSelectedOptionId('')
      setIsSelecting(false)
    } else if (onAddBaseline) {
      onAddBaseline()
    }
  }

  const handleStartSelect = () => {
    setIsSelecting(true)
    setSelectedOptionId(currentBaselineId)
  }

  return (
    <div data-testid="baseline-toggle-card">
      {/* Single-line row — no background, no card wrapper */}
      <div className="flex items-center gap-1.5 py-1">
        <div
          className={`w-2 h-2 rounded-full flex-shrink-0 ${baselineLabel ? 'bg-success' : 'bg-panel-border'}`}
          aria-hidden="true"
        />
        {baselineLabel ? (
          <span
            className={`${typography.panelMeta} text-text-light truncate`}
            style={{ maxWidth: '70%' }}
            title={`Baseline: ${baselineLabel}`}
          >
            Baseline: {baselineLabel}
          </span>
        ) : (
          <span className={`${typography.panelMeta} text-text-light`}>
            No baseline set
          </span>
        )}
        <span className={`${typography.panelMeta} text-text-light`} aria-hidden="true">·</span>
        <button
          onClick={handleStartSelect}
          disabled={isRunning}
          className={`${typography.panelMeta} text-info hover:underline flex-shrink-0`}
          type="button"
        >
          {baselineLabel ? 'Change' : 'Set'}
        </button>
      </div>

      {/* V12.5: Explanatory paragraph removed — "Set" link is self-explanatory */}

      {/* Inline dropdown — visible only while selecting */}
      {isSelecting && options.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 py-1.5 pl-3.5">
          <select
            value={selectedOptionId}
            onChange={(e) => setSelectedOptionId(e.target.value)}
            className={`${typography.panelMeta} w-[min(180px,45vw)] bg-panel border border-panel-border rounded-lg px-2 py-1 text-text-body focus-visible:outline-none focus-visible:border-info`}
            disabled={isRunning}
            autoFocus
          >
            <option value="">Select an option…</option>
            {options.map(opt => (
              <option key={opt.id} value={opt.id}>{opt.label}</option>
            ))}
          </select>
          <button
            onClick={handleSetBaseline}
            disabled={!selectedOptionId || isRunning}
            className={`${typography.panelMeta} px-3 py-1 bg-primary text-text-on-color rounded-full hover:bg-primary-hover disabled:opacity-40 transition-colors flex-shrink-0`}
            type="button"
          >
            Set
          </button>
          <button
            onClick={() => { setIsSelecting(false); setSelectedOptionId('') }}
            className={`${typography.panelMeta} text-text-light hover:underline flex-shrink-0`}
            type="button"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}

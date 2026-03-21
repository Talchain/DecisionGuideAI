/**
 * DecisionQualityChecks — Collapsible section showing client-side decision quality heuristics.
 *
 * Renders checks: no_risks, no_baseline, goal_baseline_missing, all_positive_edges,
 * same_levers, zero_external_factors, many_ai_estimates, no_target.
 * Each has a one-sentence nudge, a pill tag
 * (Framing or Verify), and a CTA button.
 *
 * Hidden when 0 checks triggered. Max 3 visible; remainder under "N more" toggle.
 *
 * Data source: usePreAnalysisData().qualityChecks
 */

import { useState, useCallback, type ReactNode } from 'react'
import { ChevronDown, ChevronRight, Shield, Check, Info } from 'lucide-react'
import { Pill } from './primitives'
import Tooltip from '../../../components/Tooltip'
import type { QualityCheck } from './hooks/usePreAnalysisData'
import { typography } from '@/styles/typography'

/** Map of check IDs to their direct-action config (secondary CTA) */
const DIRECT_ACTIONS: Record<string, { label: string; action: string; placeholder: string }> = {
  no_risks: { label: 'Add a risk', action: 'add_risk_inline', placeholder: 'e.g. Increased churn risk' },
  zero_external_factors: { label: 'Add a factor', action: 'add_factor_inline', placeholder: 'e.g. Customer acquisition cost' },
}

interface DecisionQualityChecksProps {
  checks: QualityCheck[]
  /** CTA action handler — routes action string to parent */
  onAction?: (action: string) => void
  /** Direct add handler — creates a node with the given label */
  onDirectAdd?: (kind: 'risk' | 'factor', label: string) => void
  /** Optional slot replacing the goal_baseline_missing check with custom inline UI */
  goalBaselineSlot?: ReactNode
  /** Total count including replaced checks (for header pill) */
  totalCheckCount?: number
}

function CheckRow({
  check,
  onAction,
  onDirectAdd,
}: {
  check: QualityCheck
  onAction?: (action: string) => void
  onDirectAdd?: (kind: 'risk' | 'factor', label: string) => void
}) {
  const directAction = DIRECT_ACTIONS[check.id]
  const [showInput, setShowInput] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [showSuccess, setShowSuccess] = useState(false)
  const [validationError, setValidationError] = useState(false)

  const handleDirectSubmit = useCallback(() => {
    const trimmed = inputValue.trim()
    if (!trimmed) { setValidationError(true); return }
    const kind = check.id === 'no_risks' ? 'risk' as const : 'factor' as const
    onDirectAdd?.(kind, trimmed)
    setInputValue('')
    setShowInput(false)
    setShowSuccess(true)
    setTimeout(() => setShowSuccess(false), 2000)
  }, [inputValue, check.id, onDirectAdd])

  return (
    <div className="flex items-start gap-2 py-1.5">
      <div className="flex-1 min-w-0 space-y-1">
        <p className={`${typography.panelBody} text-text-body`}>{check.message}</p>
        {check.detail && (
          <p className={`${typography.panelMeta} text-text-light`}>{check.detail}</p>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          {check.pill === 'framing' ? (
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 ${typography.panelMeta} border border-option/30 text-text-body bg-transparent`}>
              Framing
            </span>
          ) : check.pill === 'bias' ? (
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 ${typography.panelMeta} border border-warning/30 text-text-body bg-transparent`}>
              Bias
            </span>
          ) : (
            <Pill size="small" variant="info">Verify</Pill>
          )}
          <button
            type="button"
            onClick={() => onAction?.(check.ctaAction)}
            className={`${typography.panelMeta} text-info border border-info/40 rounded-full px-2.5 py-0.5 bg-transparent hover:border-success/40 hover:text-success cursor-pointer`}
          >
            {check.cta}
          </button>
          {directAction && onDirectAdd && !showSuccess && (
            <button
              type="button"
              onClick={() => setShowInput(!showInput)}
              className={`${typography.panelMeta} text-text-body border border-panel-border rounded-full px-2.5 py-0.5 bg-transparent hover:border-info/30 cursor-pointer`}
            >
              {directAction.label}
            </button>
          )}
          {showSuccess && (
            <span className={`${typography.panelMeta} text-success inline-flex items-center gap-1`}>
              <Check size={12} /> Added
            </span>
          )}
        </div>

        {/* Inline input for direct add */}
        {showInput && (
          <>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => { setInputValue(e.target.value); setValidationError(false) }}
                placeholder={directAction?.placeholder}
                className={`flex-1 px-2 py-1 ${typography.panelBody} border ${validationError ? 'border-danger' : 'border-panel-border'} rounded-lg bg-panel text-text-body focus:outline-none focus:ring-1 focus:ring-info`}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleDirectSubmit()
                  if (e.key === 'Escape') { setShowInput(false); setInputValue(''); setValidationError(false) }
                }}
              />
              <button
                type="button"
                onClick={handleDirectSubmit}
                className={`px-3 py-1 ${typography.panelMeta} bg-primary text-text-on-color rounded-full hover:opacity-90 disabled:opacity-40`}
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => { setShowInput(false); setInputValue(''); setValidationError(false) }}
                className={`${typography.panelMeta} text-text-light hover:text-text-body`}
              >
                Cancel
              </button>
            </div>
            {validationError && (
              <p className={`${typography.panelMeta} text-danger mt-0.5`}>Enter a name</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export function DecisionQualityChecks({ checks, onAction, onDirectAdd, goalBaselineSlot, totalCheckCount }: DecisionQualityChecksProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [showAll, setShowAll] = useState(false)

  // Filter out goal_baseline_missing when slot replaces it
  const filteredChecks = goalBaselineSlot
    ? checks.filter(c => c.id !== 'goal_baseline_missing')
    : checks

  // Use totalCheckCount for the header pill when provided (accounts for replaced checks)
  const displayCount = totalCheckCount ?? filteredChecks.length

  // Hide section only when no checks AND no baseline slot
  if (filteredChecks.length === 0 && !goalBaselineSlot) return null

  const maxVisible = 3
  const visibleChecks = showAll ? filteredChecks : filteredChecks.slice(0, maxVisible)
  const hiddenCount = filteredChecks.length - maxVisible

  return (
    <div className="rounded-lg border border-panel-border" data-testid="decision-quality-checks">
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-black/[0.02]"
      >
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-option" />
          <span className={`${typography.panelHeader} text-text-body`}>Decision quality</span>
          <Tooltip delay={300} content="Structural checks that improve the reliability of your analysis. Addressing these leads to more trustworthy results.">
            <Info size={14} className="text-text-light" />
          </Tooltip>
        </div>
        <div className="flex items-center gap-2">
          {displayCount > 0 && (
            <Pill size="small" variant="warning">{displayCount}</Pill>
          )}
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
          {/* Goal baseline slot — always first when present */}
          {goalBaselineSlot && (
            <div data-testid="goal-baseline-slot">
              {goalBaselineSlot}
            </div>
          )}

          {visibleChecks.map((check, idx) => (
            <div
              key={check.id}
              className={(idx > 0 || goalBaselineSlot) ? 'border-t border-panel-border' : ''}
            >
              <CheckRow check={check} onAction={onAction} onDirectAdd={onDirectAdd} />
            </div>
          ))}

          {/* Show more / show less toggle */}
          {hiddenCount > 0 && !showAll && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className={`${typography.panelMeta} text-info hover:underline cursor-pointer mt-1`}
            >
              {hiddenCount} more
            </button>
          )}
          {showAll && hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setShowAll(false)}
              className={`${typography.panelMeta} text-info hover:underline cursor-pointer mt-1`}
            >
              Show less
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default DecisionQualityChecks

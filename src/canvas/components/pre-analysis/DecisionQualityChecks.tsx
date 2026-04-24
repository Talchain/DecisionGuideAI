/**
 * DecisionQualityChecks — "Sharpen your thinking" collapsed section.
 *
 * Shows cognitive/methodological quality checks (bias, option concentration, evidence gaps).
 * Structural/binary checks (no_risks, no_baseline, all_positive_edges, no_target,
 * goal_baseline_missing) are filtered out — they surface as triage footer flags instead.
 *
 * Max 3 visible; remainder under "N more" toggle.
 *
 * Data source: usePreAnalysisData().qualityChecks
 */

import { useState, useCallback, type ReactNode } from 'react'
import { ChevronDown, ChevronRight, Check, Info } from 'lucide-react'
import { Pill } from './primitives'
import Tooltip from '../../../components/Tooltip'
import type { QualityCheck } from './hooks/usePreAnalysisData'
import { typography } from '@/styles/typography'

/** "Why this matters" expandable detail toggle */
function WhyThisMattersToggle({ detail }: { detail: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1 ${typography.panelMeta} text-text-light hover:text-text-body cursor-pointer`}
      >
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        Why this matters
      </button>
      {open && (
        <div className="bg-panel-hover rounded-md px-2.5 py-2.5 leading-relaxed mt-1">
          <p className={`${typography.panelMeta} text-text-light`}>{detail}</p>
        </div>
      )}
    </div>
  )
}

/** Map of check IDs to their direct-action config (secondary CTA) */
const DIRECT_ACTIONS: Record<string, { label: string; action: string; placeholder: string; tooltip?: string }> = {
  no_risks: { label: 'Add a risk', action: 'add_risk_inline', placeholder: 'e.g. Increased churn risk' },
  zero_external_factors: { label: 'Add a factor', action: 'add_factor_inline', placeholder: 'e.g. Customer acquisition cost' },
  all_positive_edges: { label: 'Add a negative relationship', action: 'review_structure', placeholder: '', tooltip: 'Add a relationship where increasing one factor hurts another' },
  anchoring: { label: 'Expand other options', action: 'review_options', placeholder: '', tooltip: 'Scroll to the options section to diversify your strategies' },
}

/** Action-oriented title overrides (v6 wireframe) */
const ACTION_TITLES: Record<string, string> = {
  no_risks: 'Add risks to capture what could go wrong',
  all_positive_edges: 'Add trade-offs to capture real-world costs',
  no_baseline: 'Set a current baseline to measure improvement from today',
  same_levers: 'Consider whether your options represent genuinely different strategies',
  anchoring: 'Consider whether other options are equally explored',
  confounders: 'Some factors may share hidden causes',
}

/** Assumption from M1 coaching ledger */
interface AssumptionLedgerItem {
  severity: 'low' | 'medium' | 'high'
  message: string
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
  /** Assumptions ledger from M1 coaching (gated on presence) */
  assumptionsLedger?: AssumptionLedgerItem[] | null
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

  // Category pill element (right-aligned in title row)
  const categoryPill = check.pill === 'framing' ? (
    <Tooltip delay={300} content="How the decision is structured could affect results">
      <span className={`inline-flex items-center rounded-full px-2 py-0.5 ${typography.panelMeta} border border-option/30 text-text-body bg-transparent shrink-0`}>
        Framing
      </span>
    </Tooltip>
  ) : check.pill === 'bias' ? (
    <Tooltip delay={300} content="Cognitive pattern that may skew your thinking">
      <span className={`inline-flex items-center rounded-full px-2 py-0.5 ${typography.panelMeta} border border-warning/30 text-text-body bg-transparent shrink-0`}>
        Bias
      </span>
    </Tooltip>
  ) : check.pill === 'validity' ? (
    <Tooltip delay={300} content="Scientific concern about the analysis method">
      <Pill size="small" variant="danger">Validity</Pill>
    </Tooltip>
  ) : (
    <Tooltip delay={300} content="Missing elements that would strengthen the model">
      <Pill size="small" variant="info">Coverage</Pill>
    </Tooltip>
  )

  return (
    <div className="py-1.5 space-y-1">
      {/* Title row with right-aligned category pill */}
      <div className="flex items-center gap-2">
        <p className={`${typography.panelBody} text-text-body flex-1 min-w-0`}>{ACTION_TITLES[check.id] ?? check.message}</p>
        {categoryPill}
      </div>
      {check.detail && (
        <WhyThisMattersToggle detail={check.detail} />
      )}
      <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => onAction?.(check.ctaAction)}
            className={`${typography.panelMeta} text-info border border-info/40 rounded-full px-2.5 py-0.5 bg-transparent hover:border-success/40 hover:text-success cursor-pointer`}
          >
            {check.cta}
          </button>
          {directAction && !showSuccess && (
            directAction.placeholder ? (
              // Inline input pattern (e.g. "Add a risk")
              onDirectAdd && (
                <button
                  type="button"
                  onClick={() => setShowInput(!showInput)}
                  className={`${typography.panelMeta} text-text-body border border-panel-border rounded-full px-2.5 py-0.5 bg-transparent hover:border-info/30 cursor-pointer`}
                >
                  {directAction.label}
                </button>
              )
            ) : (
              // Action-only pattern (e.g. "Expand other options" → scroll)
              <Tooltip delay={300} content={directAction.tooltip ?? ''}>
                <button
                  type="button"
                  onClick={() => onAction?.(directAction.action)}
                  className={`${typography.panelMeta} text-text-body border border-panel-border rounded-full px-2.5 py-0.5 bg-transparent hover:border-info/30 cursor-pointer`}
                >
                  {directAction.label}
                </button>
              </Tooltip>
            )
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
                className={`flex-1 px-2 py-1 ${typography.panelBody} border ${validationError ? 'border-danger' : 'border-panel-border'} rounded-lg bg-panel text-text-body focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-info`}
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
  )
}

/** Checks excluded from "Sharpen your thinking" — they surface elsewhere:
 *  - Structural flags: triage footer flags (no_risks, no_baseline, etc.)
 *  - Nudge checks: triage panel science nudges (same_levers, zero_external_factors, many_ai_estimates)
 */
export const STRUCTURAL_CHECK_IDS = new Set([
  'no_risks',
  'no_baseline',
  'all_positive_edges',
  'no_target',
  'goal_baseline_missing',
  // Nudge checks — shown as triage panel science nudges, not here
  'same_levers',
  'zero_external_factors',
  'many_ai_estimates',
])

export function DecisionQualityChecks({ checks, onAction, onDirectAdd, goalBaselineSlot, totalCheckCount, assumptionsLedger }: DecisionQualityChecksProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [showAll, setShowAll] = useState(false)

  // Filter out structural/binary checks (surfaced as triage footer flags)
  // and goal_baseline_missing when slot replaces it
  const filteredChecks = checks.filter(c =>
    !STRUCTURAL_CHECK_IDS.has(c.id) && !(goalBaselineSlot && c.id === 'goal_baseline_missing'),
  )

  // Use totalCheckCount for the header pill when provided (accounts for replaced checks)
  const displayCount = totalCheckCount ?? filteredChecks.length

  const maxVisible = 3
  const visibleChecks = showAll ? filteredChecks : filteredChecks.slice(0, maxVisible)
  const hiddenCount = filteredChecks.length - maxVisible

  // Nothing to show — no cognitive/methodological checks and no goal baseline slot
  if (filteredChecks.length === 0 && !goalBaselineSlot) return null

  return (
    <div className="rounded-lg border border-panel-border" data-testid="model-quality-checks">
      {/* Header — no decorative icon per v6 wireframe */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-panel-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-info"
      >
        <div className="flex items-center gap-2">
          <span className={`${typography.panelHeader} text-text-body`}>Sharpen your thinking</span>
          <Tooltip delay={300} content="Cognitive checks and exercises that help you avoid common decision-making biases.">
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

          {/* Empty state when no checks fire */}
          {filteredChecks.length === 0 && !goalBaselineSlot && (
            <p className={`${typography.panelBody} text-text-light py-2`}>
              No issues detected. Your model structure looks good.
            </p>
          )}

          {(() => {
            // Precompute per-category counts for divider labels
            const categoryCounts: Record<string, number> = {}
            filteredChecks.forEach(c => {
              if (c.category) categoryCounts[c.category] = (categoryCounts[c.category] ?? 0) + 1
            })
            const CATEGORY_LABELS: Record<string, string> = {
              structure: 'Model structure',
              bias: 'Thinking patterns',
              validity: 'Scientific notes',
            }
            return visibleChecks.map((check, idx) => {
              const prevCheck = idx > 0 ? visibleChecks[idx - 1] : undefined
              const categoryChanged = check.category != null && check.category !== prevCheck?.category
              const categoryLabel = CATEGORY_LABELS[check.category] ?? check.category
              const categoryCount = categoryCounts[check.category] ?? 0
              return (
                <div
                  key={check.id}
                  className={(idx > 0 || goalBaselineSlot) ? 'border-t border-panel-border' : ''}
                >
                  {categoryChanged && (
                    <div className="flex items-center gap-2 pt-2 pb-1">
                      <span className={`${typography.panelMeta} text-text-light whitespace-nowrap`}>
                        {categoryLabel} ({categoryCount})
                      </span>
                      <div className="flex-1 h-px bg-panel-border" />
                    </div>
                  )}
                  <CheckRow check={check} onAction={onAction} onDirectAdd={onDirectAdd} />
                </div>
              )
            })
          })()}

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

          {/* Assumptions ledger from M1 coaching (gated on presence) */}
          {assumptionsLedger && assumptionsLedger.length > 0 && (
            <AssumptionsLedgerRow assumptions={assumptionsLedger} />
          )}
        </div>
      )}
    </div>
  )
}

/**
 * AssumptionsLedgerRow — expandable summary of M1 coaching assumptions.
 * Shows total count + high-impact count, with expandable list.
 */
function AssumptionsLedgerRow({ assumptions }: { assumptions: AssumptionLedgerItem[] }) {
  const [expanded, setExpanded] = useState(false)
  const highCount = assumptions.filter(a => a.severity === 'high').length

  const SEVERITY_BADGE: Record<string, { cls: string; label: string }> = {
    high: { cls: 'border-danger/30 text-text-body', label: 'High' },
    medium: { cls: 'border-warning/30 text-text-body', label: 'Medium' },
    low: { cls: 'border-panel-border text-text-body', label: 'Low' },
  }

  return (
    <div className="border-t border-panel-border pt-2 mt-1" data-testid="assumptions-ledger">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 py-1 cursor-pointer hover:bg-panel-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-info rounded"
      >
        <Pill size="small" variant="default">Verify</Pill>
        <span className={`${typography.panelBody} text-text-body flex-1 text-left`}>
          {assumptions.length} assumption{assumptions.length !== 1 ? 's' : ''}
          {highCount > 0 && <span className="text-danger ml-1">{'\u00B7'} {highCount} high-impact</span>}
        </span>
        {expanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-text-light" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-text-light" />
        )}
      </button>
      {expanded && (
        <div className="space-y-1.5 mt-1.5">
          {assumptions.map((a, i) => {
            const badge = SEVERITY_BADGE[a.severity] ?? SEVERITY_BADGE.low
            return (
              <div key={i} className="flex items-start gap-2 px-1">
                <span className={`${typography.panelMeta} inline-flex items-center px-2 py-0.5 rounded-full bg-transparent border ${badge.cls} flex-shrink-0`}>
                  {badge.label}
                </span>
                <p className={`${typography.panelBody} text-text-body`}>{a.message}</p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default DecisionQualityChecks

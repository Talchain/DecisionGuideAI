/**
 * DriversSection Component - Redesigned
 *
 * "What's Influencing This" panel with column-based layout.
 *
 * Features:
 * - Panel title at top, separate from grid
 * - Column headers: "Sensitivity" and "Confidence" (right-aligned above bars)
 * - Direction arrows with matching bar colors (↘ orange, ↗ green)
 * - Two bars per row (Sensitivity + Confidence)
 * - Factor names can wrap, bars stay aligned
 * - Expanded view with contextual insights
 * - ISL unavailable error state with retry
 */

import { useState, useCallback, useEffect, useRef, type ChangeEvent } from 'react'
import { AlertTriangle as TriangleAlert, Check, HelpCircle, Minus } from 'lucide-react'
import type { DriversSectionData, DriverItem } from './types'
import { focusNodeById } from '../../canvas/utils/focusHelpers'
import { highlightNode, clearHighlight } from '../../canvas/utils/highlightHelpers'
import { EMPTY_STATES } from './emptyStates'
import { formatFlipRiskMessage } from './utils/formatScenarioRatio'
import { FactorInsights, hasEnrichmentContent } from './FactorInsights'
import { cleanFactorLabel } from './utils/cleanFactorLabel'
import { typography } from '../../styles/typography'
import { DataBar } from '../../canvas/ui/shared/DataBar'
import Tooltip from '../../components/Tooltip'
import { DiscussWithAiButton } from '../../canvas/components/pre-analysis/DiscussWithAiButton'
import { ExpertBlock } from './ExpertBlock'
import { ExpandableCoachingText } from '../../components/shared/ExpandableCoachingText'
import { isExpertField } from './utils/isExpertField'

interface DriversSectionProps {
  data: DriversSectionData
  onFocusNode?: (nodeId: string) => void
  onRetry?: () => void
  /** Goal label for direction-based interpretation fallback (Task 3.5) */
  goalLabel?: string
  /** Graph Interaction P1: ID of currently highlighted driver (from canvas selection sync) */
  highlightedDriverId?: string | null
  /** Graph Interaction P1: Ref callback to register driver row elements for scroll sync */
  registerDriverRef?: (factorKey: string, element: HTMLDivElement | null) => void
  /** Outcome unit type (used for driver display formatting) */
  outcomeUnit?: 'currency' | 'percent' | 'count'
  /** Outcome unit symbol */
  outcomeUnitSymbol?: string
  /** v7: When true, values are normalised model scores */
  isNormalised?: boolean
  /** Handler for sending a message to the conversation panel */
  onSendMessage?: (text: string) => void
  /** Whether expert mode is active (shows technical details) */
  expertMode?: boolean
}

// Bar colors — use design system tokens, no hex literals
const BAR_COLORS = {
  green: 'var(--success)',    // Positive direction
  orange: 'var(--danger)',    // Negative direction
  blue: 'var(--info)',        // Confidence (always)
  neutral: 'var(--text-light)', // Unknown direction
}

// Grid columns constant - shared between header and rows to avoid alignment drift
// Two data columns: Sensitivity + Confidence (same width), plus icon column for glyphs
const GRID_COLS = 'grid-cols-[minmax(120px,1fr)_85px_85px_28px]'

// Zero reason display messages - explains why sensitivity is zero
const ZERO_REASON_MESSAGES: Record<string, string> = {
  intervention_override: 'Directly controlled by your options',
  disconnected: 'No causal path to goal',
  zero_outcome_diff: "Changes don't affect outcome",
}

/**
 * P1 Results Brief Item 7: Detect binary (0/1) factors from label pattern.
 * Binary factors need different sensitivity copy since "10% change" is incoherent.
 * Patterns detected: "(0/1)", "(0 or 1)", "yes/no", "(binary)"
 */
function isBinaryFactor(label: string): boolean {
  const binaryPatterns = [
    /\(0\/1\)/i,           // (0/1)
    /\(0 or 1\)/i,         // (0 or 1)
    /\(yes\/no\)/i,        // (yes/no)
    /\(binary\)/i,         // (binary)
    /\(on\/off\)/i,        // (on/off)
    /\(true\/false\)/i,    // (true/false)
  ]
  return binaryPatterns.some(pattern => pattern.test(label))
}

// Note: cleanFactorLabel imported from ./utils/cleanFactorLabel

// Tooltip component for secondary information
function FactorTooltip({
  content,
  isOpen,
  onClose,
  triggerRef,
  id,
}: {
  content: React.ReactNode
  isOpen: boolean
  onClose: () => void
  triggerRef: React.RefObject<HTMLButtonElement>
  id: string
}) {
  const tooltipRef = useRef<HTMLDivElement>(null)

  // Close on click outside and Escape key
  useEffect(() => {
    if (!isOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (
        tooltipRef.current &&
        !tooltipRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        onClose()
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
        // Return focus to trigger button
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose, triggerRef])

  if (!isOpen) return null

  return (
    <div
      ref={tooltipRef}
      id={id}
      className={`absolute z-50 left-0 right-0 mt-1 p-3 bg-panel border border-panel-border rounded-lg shadow-3 ${typography.panelBody} text-text-body space-y-1.5`}
      role="tooltip"
    >
      {content}
    </div>
  )
}

// Preset options for contested driver quick-select
const CONTESTED_PRESETS = [
  { label: 'Weakly', value: 0.3 },
  { label: 'Moderately', value: 0.5 },
  { label: 'Strongly', value: 0.8 },
] as const

/** Quick-select pill row for contested (isolated/correlated) drivers. */
function ContestedDriverQuickSelect({ driver }: { driver: DriverItem }) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [customValue, setCustomValue] = useState(() => {
    const conf = typeof driver.confidence === 'number' ? driver.confidence : 0.5
    return String(Math.round(Math.max(0, Math.min(1, conf)) * 100))
  })

  const handlePresetClick = useCallback((index: number) => {
    setSelectedIndex(index)
    setCustomValue(String(Math.round(CONTESTED_PRESETS[index].value * 100)))
    // TODO: wire to edge update in future
  }, [])

  const handleInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setSelectedIndex(null)
    setCustomValue(e.target.value)
    // TODO: wire to edge update in future
  }, [])

  return (
    <div className="flex items-center gap-1.5 px-3 pb-2">
      {CONTESTED_PRESETS.map((preset, i) => (
        <button
          key={preset.label}
          type="button"
          onClick={() => handlePresetClick(i)}
          style={{
            fontFamily: 'inherit',
            fontSize: '11px',
            fontWeight: selectedIndex === i ? 600 : 500,
            padding: '4px 10px',
            borderRadius: '999px',
            border: `1px solid ${selectedIndex === i ? 'var(--info)' : 'var(--border-default)'}`,
            background: selectedIndex === i ? 'rgba(82,163,200,0.1)' : 'transparent',
            cursor: 'pointer',
          }}
        >
          {preset.label}
        </button>
      ))}
      <input
        type="text"
        value={customValue}
        onChange={handleInputChange}
        aria-label="Custom confidence value"
        style={{
          fontSize: '11px',
          fontWeight: 600,
          width: '44px',
          padding: '3px 6px',
          border: '1px solid var(--border-default)',
          borderRadius: '8px',
          textAlign: 'center',
          fontFamily: 'inherit',
          background: 'transparent',
        }}
      />
    </div>
  )
}

// Individual driver row - Compact 2-line structure
function DriverRow({
  driver,
  onFocus,
  goalLabel: _goalLabel,
  isHighlighted,
  registerRef,
  microlineLabel,
  onSendMessage,
  expertMode,
  isTopDriver,
}: {
  driver: DriverItem
  onFocus?: (nodeId: string) => void
  /** Goal label for direction-based interpretation fallback (Task 3.5) */
  goalLabel?: string
  /** Graph Interaction P1: Whether this row is highlighted from canvas selection */
  isHighlighted?: boolean
  /** Graph Interaction P1: Ref callback to register this row for scroll sync */
  registerRef?: (element: HTMLDivElement | null) => void
  /** V12.2: Microline overtake warning label (only for first driver) */
  microlineLabel?: string
  onSendMessage?: (text: string) => void
  expertMode?: boolean
  /** Brief 5.4 Phase 3 (Path A): technique hint chip only shown on top-ranked driver */
  isTopDriver?: boolean
}) {
  const [isTooltipOpen, setIsTooltipOpen] = useState(false)
  const infoButtonRef = useRef<HTMLButtonElement>(null)

  // P1 Results Brief Item 6: Clean factor label encoding
  const { label: cleanedLabel } = cleanFactorLabel(driver.factorLabel)

  // Direction styling - arrow color matches bar color
  const directionIcon = driver.direction === 'positive' ? '↗' : driver.direction === 'negative' ? '↘' : '•'
  const directionColor = driver.direction === 'positive'
    ? BAR_COLORS.green
    : driver.direction === 'negative'
      ? BAR_COLORS.orange
      : BAR_COLORS.neutral
  const barColor: 'green' | 'orange' | 'neutral' = driver.direction === 'positive'
    ? 'green'
    : driver.direction === 'negative'
      ? 'orange'
      : 'neutral'

  // Use ISL influence_score (0-1) directly for Sensitivity column
  const sensitivityValue = driver.influenceScore ?? driver.normalisedInfluence
  const hasSensitivityData = sensitivityValue != null && sensitivityValue >= 0

  // Confidence value (0-1)
  const confidenceValue = typeof driver.confidence === 'number'
    // UI-SEM-047: Confidence clamped to [0, 1]. Keep — normalisation.
    ? Math.max(0, Math.min(1, driver.confidence))
    : null

  // Determine if we have secondary content for tooltip
  const alternativeWinnerLabel = driver.fragileEdgeInfo?.alternativeWinnerLabel
  const decisionChangeRisk = driver.flipRiskCategory === 'isolated'
    ? formatFlipRiskMessage(driver.fragileEdgeInfo?.switchProbability, alternativeWinnerLabel)
    : driver.flipRiskCategory === 'correlated'
      ? 'In some simulations, this factor can change which option is best'
      : driver.flipRiskCategory !== 'negligible'
        ? formatFlipRiskMessage(driver.fragileEdgeInfo?.switchProbability, alternativeWinnerLabel)
        : null
  const showQualityHint = typeof driver.valueOfInformation === 'number' && driver.valueOfInformation > 0.05
  const hasEnrichment = driver.enrichment && hasEnrichmentContent(driver.enrichment)
  const hasZeroReason = driver.zeroReason && ZERO_REASON_MESSAGES[driver.zeroReason]
  // Task 7c: ranking shift + technique added to tooltip — must be computed before this line
  // (rankingShiftWarn and techniqueSuggestion are computed after this block, so use inline checks)
  const hasTooltipContent = decisionChangeRisk || showQualityHint || hasEnrichment || hasZeroReason
    || (driver.attributionStability === 'low' || driver.attributionStability === 'negligible'
        || (typeof driver.confidence === 'number' && driver.confidence < 0.9))
    || ((driver.influenceScore ?? driver.normalisedInfluence ?? 0) > 0.6
        && typeof driver.confidence === 'number' && driver.confidence < 0.5)

  const handleFocusClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (driver.canFocus) {
      const nodeId = driver.matchedNodeId ?? driver.factorKey
      if (onFocus) {
        onFocus(nodeId)
      } else {
        focusNodeById(nodeId)
      }
    }
  }, [driver.canFocus, driver.matchedNodeId, driver.factorKey, onFocus])

  const toggleTooltip = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setIsTooltipOpen(prev => !prev)
  }, [])

  // v7.5 T7: Softened tooltip copy
  const tooltipElasticityCopy = driver.rawElasticity > 0.001
    ? (() => {
        const shiftPercent = Math.max(1, Math.round(driver.rawElasticity * 10))
        const sign = driver.direction === 'negative' ? '-' : ''
        if (isBinaryFactor(driver.factorLabel)) {
          return `When true, outcome tends to shift by ${sign}${shiftPercent}%`
        }
        return `Higher values tend to shift outcome by ${sign}${shiftPercent}%`
      })()
    : null

  // Task 7c: ranking shift and technique suggestion for tooltip
  const rankingShiftWarn = (() => {
    const stabilityWarn = driver.attributionStability === 'low' || driver.attributionStability === 'negligible'
    const confidenceWarn = typeof driver.confidence === 'number' && driver.confidence < 0.9
    if (!stabilityWarn && !confidenceWarn) return null
    const confidencePct = typeof driver.confidence === 'number'
      ? Math.round(Math.max(0, Math.min(1, driver.confidence)) * 100)
      : null
    return confidencePct !== null
      ? `Ranking may shift · ${confidencePct}% likely`
      : 'Ranking may shift'
  })()

  const techniqueSuggestion = (() => {
    const influence = driver.influenceScore ?? driver.normalisedInfluence
    const conf = typeof driver.confidence === 'number' ? driver.confidence : null
    if (typeof influence !== 'number' || conf === null) return null
    return influence > 0.6 && conf < 0.5 ? 'Try: reference class forecasting' : null
  })()

  // Tooltip content
  const tooltipContent = (
    <>
      {/* Full elasticity insight - P1: binary-aware copy */}
      {tooltipElasticityCopy && (
        <p>{tooltipElasticityCopy}</p>
      )}
      {/* Decision change risk */}
      {decisionChangeRisk && <p>{decisionChangeRisk}</p>}
      {/* Quality hint */}
      {showQualityHint && (
        <p className="flex items-center gap-1">
          <TriangleAlert className="w-3.5 h-3.5 text-warning flex-shrink-0" aria-hidden="true" />
          Could benefit from more evidence
        </p>
      )}
      {/* Zero reason */}
      {hasZeroReason && (
        <p className="flex items-center gap-1">
          <span aria-hidden="true">ℹ️</span>
          {ZERO_REASON_MESSAGES[driver.zeroReason!]}
        </p>
      )}
      {/* Task 7c: Ranking shift warning — in tooltip only */}
      {rankingShiftWarn && (
        <p className="flex items-center gap-1 text-warning">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-warning flex-shrink-0" aria-hidden="true" />
          {rankingShiftWarn}
        </p>
      )}
      {/* Brief 5.1 Task 7.5: technique suggestion promoted out of the
          tooltip into a visible, clickable chip on the card body. Tooltip
          no longer carries this line to avoid duplication. */}
      {/* CEE-generated insights */}
      {hasEnrichment && <FactorInsights enrichment={driver.enrichment!} />}
    </>
  )

  return (
    <div
      ref={registerRef}
      className={`rounded-lg border overflow-hidden bg-panel relative transition-all duration-200 results-card-hover ${
        isHighlighted
          ? 'border-warning ring-2 ring-warning/30 shadow-lg'
          : 'border-panel-border'
      }`}
      onMouseEnter={() => highlightNode(driver.matchedNodeId ?? driver.factorKey)}
      onMouseLeave={clearHighlight}
    >
      {/* Single row: Factor name + info icon + bars */}
      <div className={`grid ${GRID_COLS} gap-2 items-center px-3 py-1.5`}>
        {/* Factor name: direction arrow (row 1 only) + title + info icon (row 1 only).
            D13: rows 2+ drop the arrow (bar colour conveys direction) and the
            tooltip (i) icon (reduces clutter; inspector gives full detail). */}
        <div className="flex items-center gap-1.5 min-w-0">
          {isTopDriver && (
            <span
              className={`${typography.panelBody} flex-shrink-0`}
              style={{ color: directionColor }}
              aria-hidden="true"
            >
              {directionIcon}
            </span>
          )}
          {driver.canFocus ? (
            <button
              type="button"
              onClick={handleFocusClick}
              className={`${typography.panelBody} text-info hover:text-info-hover hover:underline break-words leading-snug cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-1 rounded text-left line-clamp-2`}
              aria-label={`Focus on ${cleanedLabel} in model`}
              title={cleanedLabel}
            >
              {cleanedLabel}
            </button>
          ) : isTopDriver ? (
            <span className={`${typography.panelBody} text-text-body break-words leading-snug line-clamp-2`} title={cleanedLabel}>
              {cleanedLabel}
            </span>
          ) : (
            <ExpandableCoachingText
              text={cleanedLabel}
              maxLinesCollapsed={2}
              className="text-text-body"
              titleAttr={cleanedLabel}
            />
          )}
          {hasTooltipContent && isTopDriver && (
            <button
              ref={infoButtonRef}
              onClick={toggleTooltip}
              onMouseEnter={() => setIsTooltipOpen(true)}
              onMouseLeave={() => setIsTooltipOpen(false)}
              className="p-0.5 text-text-light hover:text-text-body hover:bg-panel rounded transition-colors flex-shrink-0"
              aria-label="More information"
              title="More information"
              aria-expanded={isTooltipOpen}
              aria-describedby={isTooltipOpen ? `tooltip-${driver.factorKey}` : undefined}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 16v-4" /><path d="M12 8h.01" />
              </svg>
            </button>
          )}
        </div>

        {/* Sensitivity bar */}
        {hasSensitivityData ? (
          <DataBar
            value={sensitivityValue}
            colourVar={BAR_COLORS[barColor]}
            label={`${cleanedLabel} sensitivity: ${Math.round(sensitivityValue * 100)}%`}
            size="standard"
            showPercent
          />
        ) : (
          <div className={`${typography.panelBody} font-mono text-text-light w-9 text-right`}>-</div>
        )}

        {/* Confidence indicator — 4-dot scale per Brief 5.5 §2.2 Pattern C.
            Visually distinct from the magnitude/sensitivity bars so the three
            bar-graph vocabularies don't collide. Neutral palette; the glyph
            column beside it conveys High/Moderate/Low verbally. */}
        {confidenceValue !== null ? (
          <button
            type="button"
            className="cursor-pointer bg-transparent p-0 border-0 w-full text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-info rounded"
            onClick={(e) => {
              e.stopPropagation()
              if (onFocus) {
                onFocus(driver.matchedNodeId ?? driver.factorKey)
              }
            }}
            aria-label={`${cleanedLabel} confidence: ${Math.round(confidenceValue * 100)}%. Click to update.`}
          >
            {(() => {
              const filledSteps = Math.max(0, Math.min(4, Math.round(confidenceValue * 4)))
              return (
                <div
                  role="progressbar"
                  aria-valuenow={Math.round(confidenceValue * 100)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${cleanedLabel} confidence: ${Math.round(confidenceValue * 100)}%`}
                  className="inline-flex items-center gap-1"
                >
                  {[0, 1, 2, 3].map(i => (
                    <span
                      key={i}
                      aria-hidden="true"
                      className={`w-2 h-2 rounded-full ${
                        i < filledSteps
                          ? 'bg-text-body'
                          : 'bg-panel-hover border border-panel-border'
                      }`}
                    />
                  ))}
                </div>
              )
            })()}
          </button>
        ) : (
          <div className={`${typography.panelBody} font-mono text-text-light w-9 text-right`}>-</div>
        )}

        {/* Icons column: confidence icon + default-estimate indicator */}
        <div className="flex items-center gap-1 justify-start">
          {confidenceValue !== null && (() => {
            const IconComponent = confidenceValue >= 0.7 ? Check : confidenceValue >= 0.4 ? Minus : HelpCircle
            const cls = confidenceValue >= 0.7 ? 'text-success' : confidenceValue >= 0.4 ? 'text-info' : 'text-factor'
            const label = confidenceValue >= 0.7 ? 'High confidence' : confidenceValue >= 0.4 ? 'Moderate confidence' : 'Low confidence'
            return (
              <span
                className={`flex-shrink-0 w-3 flex items-center justify-center ${cls}`}
                title={label}
                data-testid={`confidence-glyph-${driver.factorKey}`}
              >
                <IconComponent className="w-3 h-3" aria-hidden="true" />
              </span>
            )
          })()}
          {driver.isDefaultedConfidence && (
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeDasharray="2 2"
              className="flex-shrink-0 text-text-light"
              role="img"
              aria-label="Default estimate — not yet validated with evidence"
              data-testid="default-estimate-icon"
            >
              <title>Default estimate — not yet validated with evidence</title>
              <circle cx="6" cy="6" r="4.5" />
            </svg>
          )}
        </div>
      </div>

      {/* Composite label + action link */}
      {(() => {
        const influence = driver.influenceScore ?? driver.normalisedInfluence ?? 0
        const conf = typeof driver.confidence === 'number' ? driver.confidence : 0.5
        const isHighImpactLowEvidence = influence >= 0.7 && conf < 0.4
        const isImportantStable = influence >= 0.7 && conf >= 0.4
        return (
          <div className="flex items-center gap-1.5 px-3 pb-1">
            {isHighImpactLowEvidence && (
              <span className={`${typography.panelMeta} px-1.5 py-0.5 rounded-full border border-danger/30 text-danger bg-transparent`}>
                High impact, low evidence
              </span>
            )}
            {isImportantStable && (
              <span className={`${typography.panelMeta} px-1.5 py-0.5 rounded-full border border-success/30 text-success bg-transparent`}>
                Important and stable
              </span>
            )}
            {!isHighImpactLowEvidence && !isImportantStable && (
              <span className={`${typography.panelMeta} px-1.5 py-0.5 rounded-full border border-panel-border text-text-light bg-transparent`}>
                Moderate
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                if (onSendMessage) {
                  onSendMessage(
                    isHighImpactLowEvidence
                      ? `How can I improve the evidence for "${driver.factorLabel}"? It has high impact but low confidence.`
                      : `Tell me more about how "${driver.factorLabel}" affects the outcome.`,
                  )
                } else if (onFocus && driver.matchedNodeId) {
                  onFocus(driver.matchedNodeId)
                }
              }}
              className={`${typography.panelMeta} text-info hover:underline cursor-pointer ml-auto`}
            >
              {isHighImpactLowEvidence ? 'Improve' : 'Edit'}
            </button>
          </div>
        )
      })()}

      {/* Expert mode: raw ISL values — gated on both expertMode AND the
          canonical expert-field allowlist (Brief 5.1 Task 1 belt-and-braces).
          If 'elasticity' is ever removed from the allowlist, this block
          disappears without a separate render-site audit. */}
      {expertMode && isExpertField('elasticity') && (
        <ExpertBlock>
          <div className={`${typography.panelMeta} text-text-light flex gap-3`}>
            <span>elasticity: {typeof driver.rawElasticity === 'number' ? driver.rawElasticity.toFixed(3) : '-'}</span>
            <span>stability: {driver.attributionStability ?? '-'}</span>
            <span>influence: {typeof (driver.influenceScore ?? driver.normalisedInfluence) === 'number' ? ((driver.influenceScore ?? driver.normalisedInfluence)! * 100).toFixed(1) + '%' : '-'}</span>
          </div>
        </ExpertBlock>
      )}

      {/* V12.2: Microline overtake warning inside card */}
      {microlineLabel && (
        <p
          className={`${typography.panelMeta} text-danger px-3 pb-1.5 -mt-0.5`}
          data-testid="driver-microline"
        >
          If wrong, {microlineLabel} overtakes
        </p>
      )}

      {/* Brief 5.1 Task 7.5: visible, clickable technique suggestion. When
          the driver has high influence AND low confidence, the suggestion
          renders as a chip button that, on click, sends a scoped prompt
          into the chat so the user can continue the thread in context. */}
      {isTopDriver && techniqueSuggestion && onSendMessage && (
        <div className="px-3 pb-1.5 -mt-0.5">
          <button
            type="button"
            data-testid={`driver-technique-chip-${driver.factorKey}`}
            onClick={() => {
              onSendMessage(
                `${techniqueSuggestion} could help with "${cleanedLabel}". How would you apply it here?`,
              )
            }}
            className={`${typography.panelMeta} text-info border border-info/30 rounded-full px-2 py-0.5 bg-transparent hover:bg-panel-hover cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-1`}
            aria-label={`Discuss ${techniqueSuggestion.replace(/^Try:\s*/i, '')} for ${cleanedLabel}`}
          >
            {techniqueSuggestion}
          </button>
        </div>
      )}

      {/* Quick-select for contested drivers — only when inbound edge has validation.status === 'contested' */}
      {driver.hasContestedEdge && (
        <ContestedDriverQuickSelect driver={driver} />
      )}

      {/* Tooltip */}
      <FactorTooltip
        content={tooltipContent}
        isOpen={isTooltipOpen}
        onClose={() => setIsTooltipOpen(false)}
        triggerRef={infoButtonRef}
        id={`tooltip-${driver.factorKey}`}
      />

      {/* P1-2: Discuss-with-AI sparkle, bottom-right of the driver card */}
      <div className="absolute bottom-1 right-1">
        <DiscussWithAiButton variant="secondary" element={{ kind: 'factor', label: cleanedLabel }} />
      </div>
    </div>
  )
}

// Error state component
function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="p-3 bg-panel border border-warning/30 rounded-lg text-center">
      <p className={`${typography.panelHeader} text-warning mb-2`}>
        Unable to calculate factor sensitivity — service unavailable
      </p>
      <p className={`${typography.panelBody} text-warning mb-3`}>{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className={`px-4 py-2 ${typography.panelHeader} text-warning bg-white border border-warning/30 rounded-lg hover:bg-panel-hover transition-colors`}
        >
          Retry
        </button>
      )}
    </div>
  )
}

export function DriversSection({
  data,
  onFocusNode,
  onRetry,
  goalLabel,
  highlightedDriverId,
  registerDriverRef,
  outcomeUnit: _outcomeUnit,
  outcomeUnitSymbol: _outcomeUnitSymbol,
  isNormalised: _isNormalised,
  onSendMessage,
  expertMode,
}: DriversSectionProps) {
  const [showAll, setShowAll] = useState(false)
  const { drivers, driversStatus, hasMagnitudeData, islError, hiddenZeroImpactCount } = data


  // Diagnostic logging for data issues (debug mode only)
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).__OLUMI_DEBUG && drivers.length > 0) {
      console.warn('[DriversSection] Data diagnostic:', {
        driverCount: drivers.length,
        driversStatus,
        hasMagnitudeData,
        islError,
      })
    }
  }, [drivers, driversStatus, hasMagnitudeData, islError])

  // ISL error state - no mock data, clear error message
  if (islError) {
    return <ErrorState message={islError} onRetry={onRetry} />
  }

  // Unavailable state
  if (driversStatus !== 'computed') {
    return (
      <div className="p-3 bg-panel border border-panel-border rounded-lg">
        <p className={`${typography.panelBody} text-text-body flex items-start gap-2`}>
          <span aria-hidden="true">ℹ️</span>
          {EMPTY_STATES.drivers}
        </p>
      </div>
    )
  }

  // No drivers
  if (drivers.length === 0) {
    return (
      <div className="p-3 bg-panel border border-panel-border rounded-lg">
        <p className={`${typography.panelBody} text-text-body flex items-start gap-2`}>
          <span aria-hidden="true">ℹ️</span>
          {EMPTY_STATES.drivers}
        </p>
      </div>
    )
  }

  // v7.5 T3: Single visibleDrivers array filtering on influenceScore >= 0.01
  // This ensures badge count, card rendering, "Show more/fewer", and tornado all use the same filtered set
  const INFLUENCE_THRESHOLD = 0.01
  const visibleDrivers = drivers.filter(d => {
    const influence = d.influenceScore ?? d.normalisedInfluence
    return typeof influence === 'number' && influence >= INFLUENCE_THRESHOLD
  })

  // v7.5 T3 Fix: Use visibleDrivers consistently (not topDrivers from data layer)
  const TOP_DRIVERS_COUNT = 3
  const displayDrivers = showAll ? visibleDrivers : visibleDrivers.slice(0, TOP_DRIVERS_COUNT)

  // Dominant factor warning: fire when top driver has ≥80% influence
  const topDriver = visibleDrivers[0]
  const topInfluence = topDriver ? (topDriver.influenceScore ?? topDriver.normalisedInfluence ?? 0) : 0
  const showDominantWarning = topInfluence >= 0.8
  const rawDominantLabel = data.dominantFactorLabel ?? topDriver?.factorLabel ?? ''
  const dominantLabel = cleanFactorLabel(rawDominantLabel).label
  const dominantPct = Math.round(Math.min(1, topInfluence) * 100)

  return (
    <div className="space-y-4">
      {/* Ranking explainer */}
      <p className={`${typography.panelMeta} text-text-light`}>Ranked by how much each factor affects the outcome</p>

      {/* Dominant factor warning — persistent, not dismissible.
          Carries Validate/Research actions (D9a) so the standalone
          AttentionBanner card between DCP and Your options is no
          longer needed for this signal. */}
      {showDominantWarning && dominantLabel && (
        <div
          className="p-3 bg-panel border border-warning/30 rounded-lg"
          role="status"
          aria-label="Dominant factor warning"
          data-testid="dominant-factor-warning"
        >
          <p className={`${typography.panelHeader} text-warning flex items-center gap-1.5 mb-1`}>
            <TriangleAlert className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
            Your result depends heavily on one factor
          </p>
          <p className={`${typography.panelBody} text-text-body`}>
            {dominantLabel} drives {dominantPct}% of the outcome. If your assumptions about this factor are wrong, the recommendation could change. Consider gathering more evidence before committing.
          </p>
          {(data.dominantFactorId && onFocusNode || onSendMessage) && (
            <div className="flex items-center gap-1.5 mt-2">
              {data.dominantFactorId && onFocusNode && (
                <button
                  type="button"
                  onClick={() => onFocusNode!(data.dominantFactorId!)}
                  className={`px-2 py-0.5 rounded-full ${typography.panelMeta} text-warning border border-warning/30 bg-transparent hover:bg-panel-hover cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-warning`}
                  aria-label={`Validate ${dominantLabel} on canvas`}
                >
                  Validate
                </button>
              )}
              {onSendMessage && (
                <button
                  type="button"
                  onClick={() => onSendMessage!(`Can you research ${dominantLabel} and suggest a reasonable estimate with sources?`)}
                  className={`px-2 py-0.5 rounded-full ${typography.panelMeta} text-warning border border-warning/30 bg-transparent hover:bg-panel-hover cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-warning`}
                  aria-label={`Research ${dominantLabel}`}
                >
                  Research
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Brief 5 Task 2: headers + rows share one wrapper so column positions
          are structural, not visual-approximation. Headers mirror the row grid
          exactly (gap-2 items-center px-3), and pb-3 gives the brief-required
          12px below headers. Row spacing tightened to space-y-2 (8px) per brief. */}
      <div data-testid="drivers-list">
        {/* Column headers — identical grid to DriverRow's inner grid */}
        <div className={`grid ${GRID_COLS} gap-2 items-center px-3 pb-3`}>
          {/* Empty cell for factor name column */}
          <div aria-hidden="true" />
          {/* v7.10 T9: Renamed "Relative influence" → "Influence" for brevity */}
          <Tooltip content="Influence: how much this factor affects the outcome">
            <div
              className={`${typography.panelBody} text-text-light text-right cursor-help`}
            >
              Influence
            </div>
          </Tooltip>
          <Tooltip content="Confidence: how stable this factor's ranking is under model variations. Click the value to update. Some confidence scores reflect default estimates — gathering evidence will make them more meaningful.">
            <div
              className={`${typography.panelBody} text-text-light text-right cursor-help`}
            >
              Confidence
            </div>
          </Tooltip>
          {/* Empty cell for icon column */}
          <div aria-hidden="true" />
        </div>

        {/* v7.10 T9: Equal-influence note when all visible drivers are within ±0.01 */}
        {visibleDrivers.length >= 2 && (() => {
          const scores = visibleDrivers.map(d => d.influenceScore ?? d.normalisedInfluence ?? 0)
          const max = Math.max(...scores)
          const min = Math.min(...scores)
          return (max - min) <= 0.01 ? (
            <p className={`${typography.panelMeta} text-text-light italic px-3 pb-2`}>
              Both factors have similar influence on the outcome.
            </p>
          ) : null
        })()}

        {/* Driver rows */}
        <div className="space-y-2">
          {displayDrivers.map((driver, index) => {
          // V11: Driver #1 microline — show overtake warning below first driver
          const showMicroline = index === 0
            && driver.fragileEdgeInfo?.switchProbability != null
            && driver.fragileEdgeInfo.switchProbability > 0
            && driver.fragileEdgeInfo.alternativeWinnerLabel

          return (
            <DriverRow
              key={driver.factorKey}
              driver={driver}
              onFocus={onFocusNode}
              goalLabel={goalLabel}
              isHighlighted={highlightedDriverId === driver.factorKey}
              registerRef={registerDriverRef
                ? (el) => registerDriverRef(driver.factorKey, el)
                : undefined
              }
              microlineLabel={showMicroline ? driver.fragileEdgeInfo!.alternativeWinnerLabel : undefined}
              onSendMessage={onSendMessage}
              expertMode={expertMode}
              isTopDriver={index === 0}
            />
          )
        })}
        </div>
      </div>

      {/* Expand/collapse — always show when there are more drivers than the default count */}
      {visibleDrivers.length > TOP_DRIVERS_COUNT && (
        <button
          onClick={() => setShowAll(!showAll)}
          className={`${typography.panelBody} text-info hover:text-info`}
        >
          {showAll ? 'Show fewer factors' : `See all factors (+${visibleDrivers.length - TOP_DRIVERS_COUNT} more)`}
        </button>
      )}

      {/* Zero-impact disclosure - only show when collapsed and there are hidden zero-impact factors */}
      {!showAll && hiddenZeroImpactCount !== undefined && hiddenZeroImpactCount > 0 && (
        <p className={`${typography.panelMeta} text-text-light italic mt-1`}>
          Some factors with minimal impact are not shown
        </p>
      )}

      {/* Tornado chart moved to standalone "What could change the result" accordion in ResultsBody */}
    </div>
  )
}

export default DriversSection

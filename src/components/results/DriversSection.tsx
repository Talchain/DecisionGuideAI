/**
 * DriversSection Component
 *
 * "What's Influencing This" panel — INFLUENCE ONLY (single-source rule; see
 * ROBUSTNESS-VERDICT-CONTRACT). The driver section communicates how much each
 * factor influences the current result; it does NOT render confidence / evidence
 * / stability / fragility claims derived from raw fields (those are gated on
 * DISPLAY_SAFE_DRIVER_CONFIDENCE / SHOW_FRAGILITY_IN_DRIVER_SECTION, both off
 * today). Per-factor discussion is the bottom-right DiscussWithAiButton sparkle.
 *
 * Features:
 * - Panel title at top, separate from grid
 * - One data column: "Influence" (sensitivity bar). The Confidence column +
 *   glyph are hidden until a display-safe driver-confidence source exists.
 * - Direction arrows with matching bar colors (↘ orange, ↗ green)
 * - Influence-only pill per row (Top / High-impact / Moderate / Lower influence)
 * - Factor names can wrap, bars stay aligned
 * - Expanded view with contextual (influence / enrichment) insights
 * - ISL unavailable error state with retry
 */

import { useState, useCallback, useEffect, useRef, type ChangeEvent } from 'react'
import { AlertTriangle as TriangleAlert, Check, HelpCircle, Info, Minus } from 'lucide-react'
import type { DriversSectionData, DriverItem, DriverSemanticLabel } from './types'
import { focusExistingTarget } from '../../canvas/utils/focusHelpers'
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
import { SensitivityReferenceCaption } from './SensitivityReferenceCaption'
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
  /**
   * Lane UI-W5 (reference-option disclosure): resolved label of the option
   * the sensitivities were computed against. Null/absent → no caption.
   */
  sensitivityReferenceLabel?: string | null
}

// Bar colors — use design system tokens, no hex literals
const BAR_COLORS = {
  green: 'var(--success)',    // Positive direction
  orange: 'var(--danger)',    // Negative direction
  blue: 'var(--info)',        // Confidence (always)
  neutral: 'var(--text-light)', // Unknown direction
}

// Single-source rule (see ROBUSTNESS-VERDICT-CONTRACT): there is no display-safe
// source for driver confidence/evidence/stability today, so those signals stay
// HIDDEN — the driver section communicates INFLUENCE only, and we NEVER show raw
// or defaulted confidence (no raw %, no dashes). Flip this true ONLY when a
// certified display-safe driver-confidence source exists; the gated Confidence
// column + glyph + tooltip signals below then light up, and the grid widens to
// match via gridCols().
const DISPLAY_SAFE_DRIVER_CONFIDENCE = false

// Fragility ("could change the result") belongs in the fragile-factors section,
// NOT the driver section. Acceptance: driver section = "this matters most";
// fragile section = "what to check because it could change the result". So the
// driver-row fragility cross-refs — the "If wrong, X overtakes" microline and the
// "Ranking may shift N%" rows/tooltip — stay hidden here. This is a placement
// rule (not a display-safe-source gate): keep it false; fragility surfaces in the
// fragile-factors section.
const SHOW_FRAGILITY_IN_DRIVER_SECTION = false

// Grid columns - shared between rows to avoid alignment drift. Influence-only by
// default (factor name + Sensitivity/influence). The Confidence + glyph columns
// return only when DISPLAY_SAFE_DRIVER_CONFIDENCE is true. (A function, not a
// module-const ternary, so the grid stays coupled to the gate without tripping
// no-constant-condition.)
function gridCols(showConfidence: boolean): string {
  return showConfidence
    ? 'grid-cols-[minmax(120px,1fr)_85px_85px_28px]'
    : 'grid-cols-[minmax(120px,1fr)_85px]'
}
const GRID_COLS = gridCols(DISPLAY_SAFE_DRIVER_CONFIDENCE)

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
    // Local UI selection only — contested-driver presets do not yet propagate
    // to the edge store. Tracked separately as a future feature.
  }, [])

  const handleInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setSelectedIndex(null)
    setCustomValue(e.target.value)
    // Local UI value only — contested-driver custom value does not yet
    // propagate to the edge store. Tracked separately as a future feature.
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
  // The (i) info icon must appear only when the tooltip has VISIBLE content.
  // Confidence/evidence/fragility lines (decisionChangeRisk, rankingShiftWarn,
  // qualityHint) are gated off today, so they contribute to the icon only when
  // their gate is on. Enrichment + zero-reason (an influence explanation) are
  // always-visible. The technique chip moved out of the tooltip to a body chip.
  const hasTooltipContent = hasEnrichment || hasZeroReason
    || (DISPLAY_SAFE_DRIVER_CONFIDENCE && showQualityHint)
    || (SHOW_FRAGILITY_IN_DRIVER_SECTION && (
          !!decisionChangeRisk
          || driver.attributionStability === 'low'
          || driver.attributionStability === 'negligible'
          || (typeof driver.confidence === 'number' && driver.confidence < 0.9)
        ))

  const handleFocusClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (driver.canFocus) {
      const nodeId = driver.matchedNodeId ?? driver.factorKey
      if (onFocus) {
        onFocus(nodeId)
      } else {
        // Fail closed: driver factorKey may not be a canvas node id
        // (recovered sessions / deleted nodes) — do nothing rather than
        // pan to nowhere.
        focusExistingTarget(nodeId, 'node')
      }
    }
  }, [driver.canFocus, driver.matchedNodeId, driver.factorKey, onFocus])

  const toggleTooltip = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setIsTooltipOpen(prev => !prev)
  }, [])

  // Close the tooltip if its content disappears (e.g. a data refresh removes the
  // (i) trigger), so no orphaned tooltip stays open without a trigger to close it.
  useEffect(() => {
    if (!hasTooltipContent && isTooltipOpen) setIsTooltipOpen(false)
  }, [hasTooltipContent, isTooltipOpen])

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
      {/* Decision change risk — HIDDEN: a decision-flip / fragility claim
          ("X becomes the better choice" / "can change which option is best").
          Fragility belongs in the fragile-factors section, not the influence-only
          driver section (SHOW_FRAGILITY_IN_DRIVER_SECTION). */}
      {SHOW_FRAGILITY_IN_DRIVER_SECTION && decisionChangeRisk && <p>{decisionChangeRisk}</p>}
      {/* Quality hint — HIDDEN: an evidence claim derived from raw fields
          (single-source rule). Returns when DISPLAY_SAFE_DRIVER_CONFIDENCE is true. */}
      {DISPLAY_SAFE_DRIVER_CONFIDENCE && showQualityHint && (
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
      {/* Ranking shift warning (tooltip variant) — HIDDEN: a ranking-shift /
          fragility claim. Fragility ("could change the result") belongs in the
          fragile-factors section, not the driver section
          (SHOW_FRAGILITY_IN_DRIVER_SECTION). */}
      {SHOW_FRAGILITY_IN_DRIVER_SECTION && rankingShiftWarn && (
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
            label={`${cleanedLabel} influence: ${Math.round(sensitivityValue * 100)}%`}
            size="standard"
            showPercent
          />
        ) : (
          <div className={`${typography.panelBody} font-mono text-text-light w-9 text-right`}>-</div>
        )}

        {/* Confidence — HIDDEN under the single-source rule: no display-safe
            driver-confidence source exists today, so we never render raw/defaulted
            confidence (no bar, no %, no dash). Gated on DISPLAY_SAFE_DRIVER_CONFIDENCE
            so it returns intact when a certified source lands. */}
        {DISPLAY_SAFE_DRIVER_CONFIDENCE && confidenceValue !== null && (
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
            <div className="inline-flex items-center gap-1.5">
              <div
                role="progressbar"
                aria-valuenow={Math.round(confidenceValue * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${cleanedLabel} confidence: ${Math.round(confidenceValue * 100)}%`}
                className="w-12 h-1 bg-panel-hover rounded-full overflow-hidden"
              >
                <div
                  className="h-full bg-info rounded-full"
                  style={{ width: `${Math.round(confidenceValue * 100)}%` }}
                />
              </div>
              <span className={`${typography.panelBody} font-mono text-text-light`}>
                {Math.round(confidenceValue * 100)}%
              </span>
            </div>
          </button>
        )}

        {/* Icons column (confidence glyph + default-estimate) — HIDDEN under the
            single-source rule, gated like the Confidence bar above. */}
        {DISPLAY_SAFE_DRIVER_CONFIDENCE && (
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
        )}
      </div>

      {/* Composite label + action link.
          INFLUENCE-ONLY pill (single-source rule — see ROBUSTNESS-VERDICT-CONTRACT).
          Driver pills state influence ONLY; they must NEVER claim
          stable / robust / confident / ready / evidence from raw fields. The
          label maps from the upstream influence-derived `semanticLabel`
          (UI-SEM-039: rank-1 'biggest', else elasticity threshold), NOT from raw
          influence×confidence. Confidence/evidence belong in the
          display-safe-gated Confidence column; fragility ("could change the
          result") belongs in the fragile-factors section, not here. */}
      {(() => {
        const INFLUENCE_PILL: Record<DriverSemanticLabel, string> = {
          biggest: 'Top driver',
          strong: 'High-impact driver',
          moderate: 'Moderate influence',
          minor: 'Lower influence',
        }
        const pillText = INFLUENCE_PILL[driver.semanticLabel] ?? 'Lower influence'
        // Subtle emphasis for the strongest influence — colour conveys
        // prominence, NOT confidence/quality (outlined, text-text-body per DS).
        const emphasised = driver.semanticLabel === 'biggest' || driver.semanticLabel === 'strong'
        return (
          <div className="flex items-center gap-1.5 px-3 pb-1">
            <span
              className={`${typography.panelMeta} px-1.5 py-0.5 rounded-full bg-transparent text-text-body border ${emphasised ? 'border-info/30' : 'border-panel-border'}`}
              data-testid={`driver-influence-pill-${driver.factorKey}`}
            >
              {pillText}
            </span>
            {/* No inline action here: the pill is an influence LABEL only. Per-factor
                discussion is the bottom-right DiscussWithAiButton sparkle (kept as the
                single, app-consistent "discuss this factor" affordance); node focus is
                the factor-name button above. (Removed the duplicate inline "Discuss".) */}
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

      {/* Microline overtake warning — HIDDEN: "If wrong, X overtakes" is a
          fragility/flip claim. Fragility ("could change the result") belongs in
          the fragile-factors section, not the driver section
          (SHOW_FRAGILITY_IN_DRIVER_SECTION). */}
      {SHOW_FRAGILITY_IN_DRIVER_SECTION && microlineLabel && (
        <p
          className={`${typography.panelMeta} text-danger px-3 pb-1.5 -mt-0.5`}
          data-testid="driver-microline"
        >
          If wrong, {microlineLabel} overtakes
        </p>
      )}

      {/* Technique suggestion chip — HIDDEN: it is gated on LOW confidence
          (techniqueSuggestion = influence > 0.6 && conf < 0.5), so it is a
          confidence-derived signal. Hidden under the single-source rule until a
          display-safe driver-confidence source exists. */}
      {DISPLAY_SAFE_DRIVER_CONFIDENCE && isTopDriver && techniqueSuggestion && onSendMessage && (
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

      {/* "Ranking may shift N%" — HIDDEN: a ranking-shift / fragility claim.
          Fragility ("could change the result") belongs in the fragile-factors
          section, not the driver section (SHOW_FRAGILITY_IN_DRIVER_SECTION). */}
      {SHOW_FRAGILITY_IN_DRIVER_SECTION && typeof driver.rankFlipRate === 'number' && driver.rankFlipRate >= 0.15 && (
        <p
          className={`${typography.panelMeta} text-warning px-3 pb-1.5 -mt-0.5`}
          data-testid={`driver-ranking-shift-${driver.factorKey}`}
        >
          Ranking may shift {Math.round(driver.rankFlipRate * 100)}%
        </p>
      )}

      {/* Brief 5.8B D5 step 6: per-driver elasticity + attribution_stability
          are already surfaced by the existing ExpertBlock at line 591 above
          (gated by `expertMode && isExpertField('elasticity')`). D7 wires
          the new user-facing toggle directly to the `expertMode` prop, so
          a parallel `.expert-only` CSS-class block here would duplicate
          the same content under a second gating mechanism. Single source
          of truth preserved. */}


      {/* Contested-driver quick-select — HIDDEN under the single-source rule: it
          exposes confidence semantics (Weakly/Moderately/Strongly + a "Custom
          confidence value" input, seeded from driver.confidence) in the
          influence-only driver section, and it is orphaned today — its presets do
          NOT propagate to the edge store (see the component). Gated on
          DISPLAY_SAFE_DRIVER_CONFIDENCE so it returns (with propagation) when a
          display-safe confidence source exists. */}
      {DISPLAY_SAFE_DRIVER_CONFIDENCE && driver.hasContestedEdge && (
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
  sensitivityReferenceLabel,
}: DriversSectionProps) {
  const [showAll, setShowAll] = useState(false)
  const { drivers, driversStatus, hasMagnitudeData, islError, hiddenZeroImpactCount } = data


  // Diagnostic logging for data issues. Gated on the runtime debug flag
  // (`window.__OLUMI_DEBUG = true` from the browser console) so the warning
  // never reaches a production user. The Window augmentation that declares
  // this flag lives in `src/components/DebugPanel.tsx` (`declare global`),
  // so no cast is needed here.
  useEffect(() => {
    if (typeof window !== 'undefined' && window.__OLUMI_DEBUG && drivers.length > 0) {
      console.warn('[DriversSection] Data diagnostic:', {
        driverCount: drivers.length,
        driversStatus,
        hasMagnitudeData,
        islError,
        // Track S: factor value provenance — verification-only. Gated behind
        // window.__OLUMI_DEBUG; never rendered to the DOM or shown to users.
        provenance: drivers.map(d => ({
          factorKey: d.factorKey,
          valueSource: d.valueSource,
          valueExtractionType: d.valueExtractionType,
          valueDefaulted: d.valueDefaulted,
        })),
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

  // Audit A1-PRIMARY: column-header disclosure marker. Render only when at
  // least one row carries `confidence_provenance.is_provisional === true`.
  // Cached/old PLoT payloads (no provenance) yield false → marker hidden,
  // tooltip retains its current copy. Belt-and-braces: derive from the FULL
  // drivers list (not the filtered visibleDrivers) so the marker reflects
  // payload-wide provenance even when a filter has hidden the provisional row.
  const anyConfidenceProvisional = drivers.some(d => d.confidenceProvenance?.isProvisional === true)
  const confidenceTooltipContent = anyConfidenceProvisional
    ? 'Confidence is an operational estimate pending pilot calibration.'
    : "Confidence: how stable this factor's ranking is under model variations. Click the value to update. Some confidence scores reflect default estimates. Gathering evidence will make them more meaningful."
  const confidenceAriaLabel = anyConfidenceProvisional
    ? 'Confidence column info — operational estimate pending pilot calibration'
    : 'Confidence column info'

  // Brief 5.8B D2c: dominant-factor warning relocated to the T1 card as an
  // inline `T1DominantNudge` in DecisionConfidencePanel. The legacy block
  // here is intentionally removed so the signal renders in exactly one
  // place. DriversSection still surfaces per-row sensitivity / confidence;
  // the cross-driver dominance signal is owned by T1.

  return (
    <div className="space-y-4">
      {/* Ranking explainer */}
      <p className={`${typography.panelMeta} text-text-light`}>Ranked by how much each factor affects the outcome</p>

      {/* Lane UI-W5: reference-option disclosure — renders nothing when the
          producer did not disclose a reference option (fail-closed). */}
      <SensitivityReferenceCaption optionLabel={sensitivityReferenceLabel} />

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
          {/* Confidence header — HIDDEN under the single-source rule (no
              display-safe driver-confidence source today). Dropping it keeps the
              header's grid-child count matched to gridCols() so the 2-column
              influence-only layout stays aligned. Returns with the column. */}
          {DISPLAY_SAFE_DRIVER_CONFIDENCE && (
            <Tooltip content={confidenceTooltipContent}>
              <button
                type="button"
                // DS v5 a11y: minimum 44×44 touch target for the header info
                // control. Achieved via a `before:` pseudo-element overlay that
                // extends the hit area vertically (~16px above + 16px below the
                // ~16px text = 48px effective, ≥ 44px requirement) WITHOUT
                // shifting the grid layout — the pseudo-element is absolutely
                // positioned and contributes no flow height. The button keeps
                // its `p-0` content box so column alignment is unaffected.
                className={`${typography.panelBody} text-text-light text-right cursor-help w-full bg-transparent border-0 p-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-info rounded inline-flex items-center justify-end gap-1 relative before:absolute before:content-[''] before:left-0 before:right-0 before:-inset-y-4`}
                aria-label={confidenceAriaLabel}
                data-testid="drivers-confidence-header"
              >
                <span>Confidence</span>
                {anyConfidenceProvisional && (
                  <Info
                    className="w-3.5 h-3.5 text-text-light flex-shrink-0"
                    aria-hidden="true"
                    data-testid="drivers-confidence-provisional-marker"
                  />
                )}
              </button>
            </Tooltip>
          )}
          {/* Empty cell for the icon column — only when the confidence/glyph column shows. */}
          {DISPLAY_SAFE_DRIVER_CONFIDENCE && <div aria-hidden="true" />}
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

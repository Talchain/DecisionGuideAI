/**
 * OptionsSection — option cards with before→after intervention rows and deltas.
 *
 * Each option card shows its name and one row per intervention:
 *   Factor label  |  baseline (from factor observedState.raw_value)  →  target value (editable)  +Δ
 *
 * "Show full detail" expansion: normalised before/after values, ready status.
 */

import { useCallback, useContext, useMemo } from 'react'
import type { Node } from '@xyflow/react'
import { ArrowRight, MessageCircle } from 'lucide-react'
import { typography } from '../../../styles/typography'
import { useNodeMutations } from '../../ui/inspector-v2/useInspectorMutations'
import { SectionErrorBoundary } from '../GraphTextView'
import { Accordion } from '../../../components/results/Accordion'
import { focusNodeById } from '../../utils/focusHelpers'
import { formatValueWithUnit, formatSmartNumber } from './utils'
import { InlineEdit } from './InlineEdit'
import { DetailToggleContext } from './DetailToggleContext'
import { unwrapInterventionValue, formatRawValueWithUnit } from '../../utils/labelUtils'

/** Conditional winner entry from ISL */
export interface ConditionalWinner {
  factorLabel: string
  factorId: string
  splitValue: number
  splitUnit?: string
  highBucket: { winnerId: string; winnerLabel: string; winProbability?: number }
  lowBucket: { winnerId: string; winnerLabel: string; winProbability?: number }
}

interface OptionsSectionProps {
  optionNodes: Node[]
  allNodes: Node[]
  /** Conditional winners from ISL analysis */
  conditionalWinners?: ConditionalWinner[]
  /** Whether post-analysis data is available */
  hasAnalysisData?: boolean
  onSendMessage?: (message: string) => void
  /** Controlled expansion state */
  isExpanded?: boolean
  /** Callback when expansion state changes */
  onExpandChange?: (expanded: boolean) => void
}

interface InterventionItem {
  factorId: string
  factorLabel: string
  /** Normalised baseline (0-1) */
  baseline: number | undefined
  /** Raw baseline in user units (e.g. 10000 for £10,000) */
  rawBaseline: number | undefined
  unit: string | undefined
  /** Intervention target — always normalised (0-1) */
  currentValue: number
  /** True when the factor has a raw_value with a real unit — target is in a different unit space */
  hasRawUnit: boolean
  /** CEE-authored display_value for the intervention target — rendered
   * verbatim in preference to numeric/unit formatting (F.6 passthrough). */
  displayValue?: string
}

/**
 * Extract a numeric intervention value, accepting any of these shapes:
 * - plain number (legacy / analysis_ready format)
 * - numeric string (back-compat with hand-edited fixtures)
 * - object with `raw_target` (legacy model-tab response shape)
 * - object with `target_value` (legacy model-tab response shape)
 * - UIInterventionValue / CEEInterventionV3 object with `.value`
 *   (post-`normaliseOptionFromCEE` shape used by inspector panels)
 *
 * Returns undefined when no finite numeric value can be extracted, so
 * callers can `flatMap` to drop unrenderable rows.
 *
 * Note: this helper is intentionally more permissive than `unwrapInterventionValue`
 * in `labelUtils.ts`. The model-tab Options section receives intervention
 * payloads from older CEE response paths that use `raw_target` / `target_value`
 * field names; those paths still need to render correctly.
 */
function extractInterventionNumeric(value: unknown): number | undefined {
  // Primary: V3-shape unwrap (handles plain numbers, {value} objects).
  const unwrapped = unwrapInterventionValue(value).value
  if (unwrapped != null) return unwrapped
  // Fallback: numeric string
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value)
    if (Number.isFinite(n)) return n
  }
  // Fallback: legacy model-tab object shapes (raw_target / target_value)
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    if (typeof obj.raw_target === 'number' && Number.isFinite(obj.raw_target)) return obj.raw_target
    if (typeof obj.target_value === 'number' && Number.isFinite(obj.target_value)) return obj.target_value
  }
  return undefined
}

function buildInterventions(optionNode: Node, allNodes: Node[]): InterventionItem[] {
  const raw = (optionNode.data as Record<string, unknown>)?.interventions as Record<string, unknown> | undefined
  if (!raw) return []
  return Object.entries(raw).flatMap(([factorId, rawValue]) => {
    const numericValue = extractInterventionNumeric(rawValue)
    if (numericValue === undefined) return []
    // displayValue flows separately: extractInterventionNumeric has legacy
    // fallbacks (raw_target, target_value) that unwrapInterventionValue does
    // not, so we pull the numeric through that; we extract displayValue via
    // the canonical helper on the same raw input.
    const { displayValue } = unwrapInterventionValue(rawValue)
    const factorNode = allNodes.find(n => n.id === factorId)
    const obs = (factorNode?.data as Record<string, unknown>)?.observedState as Record<string, unknown> | undefined
    const rawBaseline = obs?.raw_value as number | undefined
    const unit = obs?.unit as string | undefined
    // Detect cross-unit-space: the factor has raw units (e.g. £10,000) and
    // the intervention target looks normalised (0-1 range while baseline is large).
    // When the intervention value is in the same ballpark as raw_value, they're
    // in the same unit space (e.g. both £). When the intervention is 0-1 and
    // the baseline is much larger, the target is normalised model-space.
    const hasRawUnit = rawBaseline !== undefined && !!unit && unit !== 'scale'
    const looksNormalised = hasRawUnit
      && numericValue >= 0 && numericValue <= 1
      && Math.abs(rawBaseline!) > 10
    return [{
      factorId,
      factorLabel: String(factorNode?.data?.label ?? factorId),
      baseline: obs?.value as number | undefined,
      rawBaseline,
      unit,
      currentValue: numericValue,
      hasRawUnit: looksNormalised,
      displayValue: displayValue ?? undefined,
    }]
  })
}

// Polish 4 follow-up Item C: the local formatInterventionValue shadow has
// been replaced with the shared formatRawValueWithUnit from labelUtils.ts.
// See the value-formatting surface inventory at the top of labelUtils.ts.
//
// formatValueWithUnit + formatSmartNumber are still imported because the
// DeltaChip helper uses them directly (deltas are pre-computed numbers
// passed without involving the broader formatRawValueWithUnit branch logic).

function DeltaChip({ baseline, current, unit, crossUnitSpace }: {
  baseline: number | undefined; current: number; unit: string | undefined
  /** When true, baseline is raw and current is normalised — delta is meaningless */
  crossUnitSpace?: boolean
}) {
  // Never show delta when comparing raw baseline to normalised target
  if (crossUnitSpace) return null
  if (baseline === undefined || typeof baseline !== 'number' || !isFinite(baseline) || typeof current !== 'number' || !isFinite(current)) return null
  const delta = current - baseline
  if (Math.abs(delta) < 0.001) {
    return <span className={`${typography.panelMeta} text-text-light`}>unchanged</span>
  }
  const positive = delta > 0
  const label = unit ? formatValueWithUnit(Math.abs(delta), unit) : formatSmartNumber(Math.abs(delta))
  return (
    <span className={`${typography.panelMeta} font-medium ${positive ? 'text-success' : 'text-danger'}`}>
      {positive ? '+' : '-'}{label}
    </span>
  )
}

function OptionCard({ option, allNodes, conditionalWinners, hasAnalysisData }: {
  option: Node
  allNodes: Node[]
  conditionalWinners?: ConditionalWinner[]
  hasAnalysisData?: boolean
}) {
  const { showDetail } = useContext(DetailToggleContext)
  // ROADMAP 2.121 slice 1 — sanctioned setter (`NODE_SETTER_FIELDS.setIntervention`),
  // not a hand-rolled updateNode that spread a render-time `option.data`.
  const mutations = useNodeMutations(option.id)

  const label = String(option.data?.label ?? option.id)
  const interventions = buildInterventions(option, allNodes)

  // Status-quo collapse: when every intervention leaves its factor unchanged
  // (delta within an epsilon of zero), replace the verbose row list with a
  // single "No changes to any factors" line. The threshold matches DeltaChip's
  // own "unchanged" cutoff so display stays consistent.
  // Status-quo only applies when all interventions are in the same unit space as their baseline.
  // Cross-unit-space interventions (raw baseline vs normalised target) are never status-quo.
  const isStatusQuo = interventions.length > 0 && interventions.every(iv => {
    if (iv.hasRawUnit) return false // can't compare raw to normalised
    const baseline = iv.rawBaseline ?? iv.baseline
    if (baseline === undefined || typeof baseline !== 'number' || !isFinite(baseline)) return false
    if (typeof iv.currentValue !== 'number' || !isFinite(iv.currentValue)) return false
    return Math.abs(iv.currentValue - baseline) < 0.001
  })

  // An intervention target is not a factor value, so there is no
  // value-carrying wire event for it: `factor_value_edit.field` is the literal
  // `'value'` and it is the only value-bearing edit the contract supports. This
  // edit therefore reaches CEE only as the debounced `direct_graph_edit` ping —
  // stated here rather than implied, and rowed as open question 1 in the design
  // doc. What slice 1 fixes is the WRITE: it goes through the manifest setter.
  const handleInterventionSave = useCallback((factorId: string, val: string) => {
    const num = parseFloat(val)
    if (isNaN(num)) return
    mutations.setIntervention(factorId, num)
  }, [mutations])

  return (
    <div className="bg-panel-hover rounded-lg p-2.5 mb-2 last:mb-0" data-testid={`option-card-${option.id}`}>
      {/*
        Option name.

        ⛔ ROADMAP 2.263 — DO NOT PUT A PROBABILITY BACK IN THIS SLOT.

        This used to render `· {N}% win` from
        `conditionalWinners[0].lowBucket.winProbability`. Three defects in one
        line, and the removal is the fix for all three:

        1. THE NUMBER WAS CONDITIONAL, THE SLOT IS NOT. `lowBucket.winProbability`
           is conditional on the splitting factor sitting BELOW `split_value`. It
           sat next to the option's name with no condition attached, so it read as
           the option's probability. The condition appears only in the separate
           takeover card below, which states a different fact. Relabelling could
           not fix it: an unconditional slot cannot honestly host a conditional
           number, so the number leaves rather than gets a caption.
        2. `[0]` WAS ARBITRARY. An option with several conditional-winner entries
           silently showed whichever the producer happened to serialise first.
        3. ABSENCE WAS ASYMMETRIC. Only an option that won SOME low bucket got a
           number; its rival showed nothing, reading as "this one is 63%, the
           other is unknown" when the other is the complement in the same bucket.

        It was also a 2.214 vocabulary survivor — a bare "win" anchored to
        neither of the two sanctioned questions. The conditional structure is
        still rendered below, WITH its condition, in the takeover card.
      */}
      <div className="flex items-baseline gap-1 mb-1.5">
        <button
          type="button"
          onClick={() => focusNodeById(option.id)}
          className={`${typography.panelHeader} text-text-header hover:text-info hover:underline text-left leading-snug transition-colors`}
        >
          {label}
        </button>
      </div>

      {/* Conditional winner card (post-analysis only).
          Cards are attached to the lowBucket winner (overall winner).
          The highBucket winner is who takes over when the factor exceeds splitValue. */}
      {hasAnalysisData && conditionalWinners && conditionalWinners.map((cw, i) => {
        // Determine which option takes over: it's the one NOT on this card
        const takesOverLabel = cw.lowBucket.winnerId === option.id
          ? cw.highBucket.winnerLabel
          : cw.lowBucket.winnerLabel
        if (!takesOverLabel) return null
        return (
          <div
            key={`cw-${i}`}
            className="p-2 rounded-lg mb-1.5 bg-warning/[0.06] border border-warning/20"
            data-testid={`conditional-winner-${option.id}`}
          >
            <span className={`${typography.panelMeta} text-warning leading-relaxed`}>
              Leads overall, but when {cw.factorLabel} exceeds {cw.splitUnit ? formatValueWithUnit(cw.splitValue, cw.splitUnit) : formatSmartNumber(cw.splitValue)}, {takesOverLabel} takes over
            </span>
          </div>
        )
      })}

      {/* Pre-analysis coaching */}
      {!hasAnalysisData && (
        <p className={`${typography.panelMeta} text-text-light italic`}>
          Run analysis to see when each option leads and lags
        </p>
      )}

      {interventions.length === 0 && (
        <p className={`${typography.panelMeta} text-text-light italic`}>
          The AI hasn't mapped how this option changes your factors yet. Continue the conversation to refine.
        </p>
      )}

      {isStatusQuo && (
        <p
          className={`${typography.panelMeta} text-text-light`}
          data-testid={`option-status-quo-${option.id}`}
        >
          No changes to any factors
        </p>
      )}

      {interventions.length > 0 && !isStatusQuo && (
        <div className="space-y-1" data-testid={`option-interventions-${option.id}`}>
          {interventions.map(iv => {
            // Baseline display: prefer raw value + unit when available
            const baselineDisplay = iv.rawBaseline !== undefined
              ? formatRawValueWithUnit(iv.rawBaseline, iv.unit)
              : iv.baseline !== undefined
                ? formatSmartNumber(iv.baseline)
                : undefined
            // Target display precedence (F.6 passthrough):
            // 1. CEE-authored display_value — render verbatim
            // 2. Cross-unit-space normalised indicator
            // 3. formatRawValueWithUnit numeric formatter
            const targetDisplay = iv.displayValue
              ? iv.displayValue
              : iv.hasRawUnit
                ? `${iv.currentValue.toFixed(2)} (normalised)`
                : formatRawValueWithUnit(iv.currentValue, iv.unit)

            return (
              <div key={iv.factorId} className="flex items-center gap-1.5 flex-wrap">
                {/* Factor name */}
                <button
                  type="button"
                  onClick={() => focusNodeById(iv.factorId)}
                  className={`${typography.panelBody} text-text-body hover:text-info transition-colors min-w-[80px]`}
                >
                  {iv.factorLabel}
                </button>
                {/* Baseline */}
                {baselineDisplay !== undefined && (
                  <span className={`${typography.panelMeta} text-text-light`}>
                    {baselineDisplay}
                  </span>
                )}
                <ArrowRight className="w-3 h-3 text-text-light shrink-0" aria-hidden="true" />
                {/* Editable target */}
                <InlineEdit
                  value={String(iv.currentValue)}
                  displayValue={targetDisplay}
                  onSave={(val) => handleInterventionSave(iv.factorId, val)}
                  validate={(s) => !isNaN(parseFloat(s))}
                  maxWidth="max-w-[80px]"
                  numeric
                  tooltip="Click to edit intervention value"
                  testId={`intervention-${option.id}-${iv.factorId}`}
                />
                {/* Delta — hidden when comparing raw baseline to normalised target */}
                <DeltaChip
                  baseline={iv.hasRawUnit ? undefined : (iv.rawBaseline ?? iv.baseline)}
                  current={iv.currentValue}
                  unit={iv.hasRawUnit ? undefined : iv.unit}
                  crossUnitSpace={iv.hasRawUnit}
                />
              </div>
            )
          })}
        </div>
      )}

      {/* Full detail expansion — only data not visible in compact view */}
      {showDetail && (
        <div className="mt-2 pt-2 border-t border-panel-border">
          {interventions.length > 0 && (
            <>
              <div className={`${typography.panelMeta} text-text-light font-medium mb-1`}>Normalised targets (model space)</div>
              <div className={`${typography.panelBody} text-text-body mb-1.5`}>
                Internal simulation values, overriding each factor's baseline
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                {interventions.map(iv => (
                  [
                    <span key={`l-${iv.factorId}`} className={`${typography.panelMeta} text-text-light truncate`}>{iv.factorLabel}</span>,
                    <span key={`v-${iv.factorId}`} className={`${typography.panelBody} text-text-body font-mono text-right`}>
                      {typeof iv.baseline === 'number' ? iv.baseline.toFixed(2) : '—'} {'\u2192'} {typeof iv.currentValue === 'number' ? iv.currentValue.toFixed(2) : '—'}
                    </span>,
                  ]
                ))}
              </div>
            </>
          )}
          <div className={`grid grid-cols-2 gap-x-3 gap-y-0.5 ${interventions.length > 0 ? 'mt-2 pt-2 border-t border-panel-border' : ''}`}>
            <span className={`${typography.panelMeta} text-text-light`}>Node ID</span>
            <span className={`${typography.panelBody} text-text-body font-mono text-right truncate`}>{option.id}</span>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * ROADMAP 2.263 — the empty guard is NOT in this component any more.
 *
 * `if (optionNodes.length === 0) return null` sat above the two `useMemo`s
 * below, so the hook count went 0 → 2 the moment options arrived from the draft.
 * It is now in the wrapper, which has no hooks, so the transition mounts this
 * component instead of bailing out mid-render. Do not reintroduce an early
 * return above a hook here.
 *
 * ⚠ THIS ONE WAS COMPLETELY SILENT, AND THAT IS THE ARGUMENT FOR THE LINT RULE.
 * The 2.263 audit predicted a `Rendered more hooks than during the previous
 * render.` throw. Measured by mutation on React 18.3.1: the defect produced NO
 * throw, NO console warning, and a correct render, in BOTH directions. The
 * reason is that ZERO hooks ran before the guard, so the earlier render
 * recorded an empty hook list and React silently accepts hooks being added to
 * it. (`GoalSection`, which called two hooks before its guard, at least warned.)
 *
 * So nothing at runtime could have told us this was here — no crash, no log, no
 * failing test. `react-hooks/rules-of-hooks`, enabled as an error by this same
 * row, is what makes this class of defect visible at all; it is a
 * code-integrity guard, not crash prevention.
 */
function OptionsSectionInner({ optionNodes, allNodes, conditionalWinners, hasAnalysisData, onSendMessage, isExpanded, onExpandChange }: OptionsSectionProps) {
  // Build per-option conditional winner lookup (match on option ID, not label)
  const optionWinnerMap = useMemo(() => {
    if (!conditionalWinners) return new Map<string, ConditionalWinner[]>()
    const map = new Map<string, ConditionalWinner[]>()
    for (const cw of conditionalWinners) {
      // Attach to the option that wins in the low bucket (the "default" winner)
      const winnerOptionId = cw.lowBucket.winnerId
      if (winnerOptionId) {
        const existing = map.get(winnerOptionId) ?? []
        existing.push(cw)
        map.set(winnerOptionId, existing)
      }
    }
    return map
  }, [conditionalWinners])

  // Check if ALL options are unmapped (no interventions)
  const allUnmapped = useMemo(() => {
    return optionNodes.every(opt => {
      const interventions = (opt.data as Record<string, unknown>)?.interventions as Record<string, unknown> | undefined
      return !interventions || Object.keys(interventions).length === 0
    })
  }, [optionNodes])

  return (
    <Accordion
      title="Options"
      badgeCount={optionNodes.length}
      defaultExpanded={false}
      isExpanded={isExpanded}
      onExpandChange={onExpandChange}
      testId="model-options-section"
    >
      {allUnmapped ? (
        /* Single coaching card when ALL options lack interventions */
        <div className="bg-panel-hover rounded-lg p-3" data-testid="options-unmapped-coaching">
          <p className={`${typography.panelMeta} text-text-light mb-2`}>
            None of these options have mapped interventions yet. Tell the AI how each option changes your factors.
          </p>
          <ul className="space-y-1.5">
            {optionNodes.map(opt => {
              const label = String(opt.data?.label ?? opt.id)
              return (
                <li key={opt.id} className="flex items-center gap-2">
                  <span className={`${typography.panelBody} text-text-header`}>{label}</span>
                  {onSendMessage && (
                    <button
                      type="button"
                      onClick={() => onSendMessage(`Map interventions for the option "${label}"`)}
                      className={`${typography.panelMeta} text-info hover:underline cursor-pointer`}
                      data-testid={`option-${opt.id}-map-cta`}
                    >
                      Map interventions
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
          {onSendMessage && (
            <button
              type="button"
              onClick={() => onSendMessage('I want to explore other strategies and options')}
              className={`${typography.panelMeta} text-info hover:underline cursor-pointer mt-2`}
              data-testid="options-explore-cta"
            >
              + Explore other strategies
            </button>
          )}
        </div>
      ) : (
        <>
          {optionNodes.map(option => (
            <OptionCard
              key={option.id}
              option={option}
              allNodes={allNodes}
              conditionalWinners={optionWinnerMap.get(option.id)}
              hasAnalysisData={hasAnalysisData}
            />
          ))}
          {onSendMessage && (
            <button
              type="button"
              onClick={() => onSendMessage('I want to explore other strategies and options')}
              className={`${typography.panelMeta} text-info hover:underline cursor-pointer mt-2`}
              data-testid="options-explore-cta"
            >
              + Explore other strategies
            </button>
          )}
        </>
      )}
      {onSendMessage && (
        <div className="flex justify-end mt-2">
          <button
            type="button"
            onClick={() => onSendMessage('Help me review my options and how they compare')}
            className="text-text-light hover:text-info cursor-pointer transition-colors"
            title="Discuss this with the AI"
            data-testid="options-discuss"
          >
            <MessageCircle className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </Accordion>
  )
}

export function OptionsSection(props: OptionsSectionProps) {
  // Absence guard in the hook-free wrapper — see `OptionsSectionInner`'s header.
  if (props.optionNodes.length === 0) return null
  return (
    <SectionErrorBoundary section="options">
      <OptionsSectionInner {...props} />
    </SectionErrorBoundary>
  )
}

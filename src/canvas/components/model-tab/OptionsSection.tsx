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
import { ArrowRight } from 'lucide-react'
import { typography } from '../../../styles/typography'
import { useCanvasStore } from '../../store'
import { SectionErrorBoundary } from '../GraphTextView'
import { Accordion } from '../../../components/results/Accordion'
import { focusNodeById } from '../../utils/focusHelpers'
import { formatValueWithUnit, formatSmartNumber } from './utils'
import { InlineEdit } from './InlineEdit'
import { DetailToggleContext } from './DetailToggleContext'

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
}

interface InterventionItem {
  factorId: string
  factorLabel: string
  baseline: number | undefined
  rawBaseline: number | undefined
  unit: string | undefined
  currentValue: number
}

function buildInterventions(optionNode: Node, allNodes: Node[]): InterventionItem[] {
  const raw = (optionNode.data as Record<string, unknown>)?.interventions as Record<string, number> | undefined
  if (!raw) return []
  return Object.entries(raw).map(([factorId, value]) => {
    const factorNode = allNodes.find(n => n.id === factorId)
    const obs = (factorNode?.data as Record<string, unknown>)?.observedState as Record<string, unknown> | undefined
    return {
      factorId,
      factorLabel: String(factorNode?.data?.label ?? factorId),
      baseline: obs?.value as number | undefined,
      rawBaseline: obs?.raw_value as number | undefined,
      unit: obs?.unit as string | undefined,
      currentValue: value,
    }
  })
}

function formatInterventionValue(value: number, unit: string | undefined): string {
  if (unit) return formatValueWithUnit(value, unit)
  return formatSmartNumber(value)
}

function DeltaChip({ baseline, current, unit }: { baseline: number | undefined; current: number; unit: string | undefined }) {
  if (baseline === undefined) return null
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
  const updateNode = useCanvasStore(s => s.updateNode)

  const label = String(option.data?.label ?? option.id)
  const interventions = buildInterventions(option, allNodes)

  const handleInterventionSave = useCallback((factorId: string, val: string) => {
    const num = parseFloat(val)
    if (isNaN(num)) return
    const existing = (option.data as Record<string, unknown>)?.interventions as Record<string, number> | undefined
    updateNode(option.id, {
      data: {
        ...option.data,
        interventions: { ...existing, [factorId]: num },
      },
    })
  }, [option, updateNode])

  return (
    <div className="bg-panel-hover rounded-lg p-2.5 mb-2 last:mb-0" data-testid={`option-card-${option.id}`}>
      {/* Option name + win probability */}
      <div className="flex items-baseline gap-1 mb-1.5">
        <button
          type="button"
          onClick={() => focusNodeById(option.id)}
          className={`${typography.panelHeader} text-text-header hover:text-info hover:underline text-left leading-snug transition-colors`}
        >
          {label}
        </button>
        {hasAnalysisData && conditionalWinners?.[0]?.lowBucket.winProbability != null && (
          <span className={`${typography.panelMeta} text-text-light ml-1`}>
            · {Math.round(conditionalWinners[0].lowBucket.winProbability * 100)}% win
          </span>
        )}
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
              Wins overall, but when {cw.factorLabel} exceeds {cw.splitUnit ? formatValueWithUnit(cw.splitValue, cw.splitUnit) : formatSmartNumber(cw.splitValue)}, {takesOverLabel} takes over
            </span>
          </div>
        )
      })}

      {/* Pre-analysis coaching */}
      {!hasAnalysisData && (
        <p className={`${typography.panelMeta} text-text-light italic`}>
          Run analysis to see when each option wins and loses
        </p>
      )}

      {interventions.length === 0 && (
        <p className={`${typography.panelMeta} text-text-light italic`}>
          The AI hasn't mapped how this option changes your factors yet. Continue the conversation to refine.
        </p>
      )}

      {interventions.length > 0 && (
        <div className="space-y-1" data-testid={`option-interventions-${option.id}`}>
          {interventions.map(iv => (
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
              {iv.rawBaseline !== undefined && (
                <span className={`${typography.panelMeta} text-text-light`}>
                  {formatInterventionValue(iv.rawBaseline, iv.unit)}
                </span>
              )}
              <ArrowRight className="w-3 h-3 text-text-light shrink-0" aria-hidden="true" />
              {/* Editable target */}
              <InlineEdit
                value={String(iv.currentValue)}
                displayValue={formatInterventionValue(iv.currentValue, iv.unit)}
                onSave={(val) => handleInterventionSave(iv.factorId, val)}
                validate={(s) => !isNaN(parseFloat(s))}
                maxWidth="max-w-[80px]"
                numeric
                tooltip="Click to edit intervention value"
                testId={`intervention-${option.id}-${iv.factorId}`}
              />
              {/* Delta */}
              <DeltaChip
                baseline={iv.rawBaseline ?? iv.baseline}
                current={iv.currentValue}
                unit={iv.unit}
              />
            </div>
          ))}
        </div>
      )}

      {/* Full detail expansion */}
      {showDetail && interventions.length > 0 && (
        <div className="mt-2 pt-2 border-t border-panel-border">
          <div className={`${typography.panelMeta} text-text-light font-mono mb-1`}>Interventions (do-operator)</div>
          <div className={`${typography.panelMeta} text-text-body mb-1.5`}>
            What this option sets each factor to, overriding the baseline
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
            {interventions.map(iv => (
              [
                <span key={`l-${iv.factorId}`} className={`${typography.panelMeta} text-text-light truncate`}>{iv.factorLabel}</span>,
                <span key={`v-${iv.factorId}`} className={`${typography.panelMeta} text-text-body font-mono text-right`}>
                  {iv.baseline?.toFixed(2) ?? '—'} {'\u2192'} {iv.currentValue.toFixed(2)}
                </span>,
              ]
            ))}
            <span className={`${typography.panelMeta} text-text-light`}>Node ID</span>
            <span className={`${typography.panelMeta} text-text-body font-mono text-right truncate`}>{option.id}</span>
          </div>
        </div>
      )}
    </div>
  )
}

function OptionsSectionInner({ optionNodes, allNodes, conditionalWinners, hasAnalysisData, onSendMessage }: OptionsSectionProps) {
  if (optionNodes.length === 0) return null

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
      const interventions = (opt.data as Record<string, unknown>)?.interventions as Record<string, number> | undefined
      return !interventions || Object.keys(interventions).length === 0
    })
  }, [optionNodes])

  return (
    <Accordion
      title="Options"
      badgeCount={optionNodes.length}
      defaultExpanded={false}
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
    </Accordion>
  )
}

export function OptionsSection(props: OptionsSectionProps) {
  return (
    <SectionErrorBoundary section="options">
      <OptionsSectionInner {...props} />
    </SectionErrorBoundary>
  )
}

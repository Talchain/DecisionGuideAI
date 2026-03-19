/**
 * OptionsSection — option cards with before→after intervention rows and deltas.
 *
 * Each option card shows its name and one row per intervention:
 *   Factor label  |  baseline (from factor observedState.raw_value)  →  target value (editable)  +Δ
 *
 * "Show full detail" expansion: normalised before/after values, ready status.
 */

import { useCallback, useContext } from 'react'
import type { Node } from '@xyflow/react'
import { ArrowRight } from 'lucide-react'
import { typography } from '../../../styles/typography'
import { useCanvasStore } from '../../store'
import { SectionErrorBoundary } from '../GraphTextView'
import { focusNodeById } from '../../utils/focusHelpers'
import { formatValueWithUnit, formatSmartNumber } from './utils'
import { InlineEdit } from './InlineEdit'
import { DetailToggleContext } from './DetailToggleContext'

interface OptionsSectionProps {
  optionNodes: Node[]
  allNodes: Node[]
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

function OptionCard({ option, allNodes }: { option: Node; allNodes: Node[] }) {
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
      {/* Option name */}
      <button
        type="button"
        onClick={() => focusNodeById(option.id)}
        className={`${typography.panelHeader} text-text-header hover:text-info hover:underline text-left w-full mb-1.5 leading-snug transition-colors`}
      >
        {label}
      </button>

      {interventions.length === 0 && (
        <p className={`${typography.panelMeta} text-text-light`}>No interventions set</p>
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
            <span className={`${typography.panelMeta} text-[10px] text-text-body font-mono text-right truncate`}>{option.id}</span>
          </div>
        </div>
      )}
    </div>
  )
}

function OptionsSectionInner({ optionNodes, allNodes }: OptionsSectionProps) {
  if (optionNodes.length === 0) return null
  return (
    <div className="bg-panel border border-panel-border rounded-xl p-3" data-testid="model-options-section">
      {/* Section header */}
      <div className="flex items-center gap-2 mb-2">
        <div className="w-3 h-3 bg-option rounded-sm shrink-0" aria-hidden="true" />
        <span className={`${typography.panelHeader} text-text-header`}>Options</span>
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full bg-transparent border border-panel-border text-text-body ${typography.panelMeta} font-medium`}>
          {optionNodes.length}
        </span>
      </div>

      {optionNodes.map(option => (
        <OptionCard key={option.id} option={option} allNodes={allNodes} />
      ))}
    </div>
  )
}

export function OptionsSection({ optionNodes, allNodes }: OptionsSectionProps) {
  return (
    <SectionErrorBoundary section="options">
      <OptionsSectionInner optionNodes={optionNodes} allNodes={allNodes} />
    </SectionErrorBoundary>
  )
}

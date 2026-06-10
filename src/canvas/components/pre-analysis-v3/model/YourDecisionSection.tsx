/**
 * YourDecisionSection — the model in words, grouped by entity with correct
 * shapes, each group led by a one-line what-good-looks-like prompt. The
 * estimates group is the causal coaching surface: ranked by influence,
 * provenance-flagged, calibrate affordances inline. Effect-strength values
 * stay gated (value-scale fix pending); the gate line says so.
 *
 * Renaming options/risks stays in the canvas and inspector (their canonical
 * editing home); the panel annotates and offers add flows only.
 */

import { memo, useEffect, useState } from 'react'
import { Plus, ArrowUp, Sparkles } from 'lucide-react'
import { Accordion } from '../../../../components/results/Accordion'
import Tooltip from '../../../../components/Tooltip'
import { typography } from '../../../../styles/typography'
import { useCanvasStore } from '../../../store'
import { NodeShapeIndicator } from '../../../nodes/NodeShapeIndicator'
import { Pill } from '../../pre-analysis/primitives/Pill'
import { ATTRIBUTION_COPY, MODEL_VIEW_COPY, PANEL_COPY, SPARK_PROMPTS } from '../constants'
import { kindOf } from '../selectors/graphFacts'
import { PanelIconButton } from '../ui/PanelIconButton'
import { CalibrateDrillIn } from './CalibrateDrillIn'
import { EstimateRow } from './EstimateRow'
import { SUCCESS_INPUT_ID } from '../hero/HeroSection'
import type { NodeType } from '../../../domain/nodes'
import type { PreAnalysisModel } from '../hooks/usePreAnalysisModel'

interface YourDecisionSectionProps {
  model: PreAnalysisModel
  onSendPrompt: (label: string, prompt: string) => void
  /** Bumped by the ladder to open and reveal a specific estimate row. */
  estimateFocus: { nodeId: string; seq: number } | null
}

function addNamedNode(kind: 'option' | 'risk', label: string): void {
  const trimmed = label.trim()
  if (trimmed === '') return
  const store = useCanvasStore.getState()
  const limit = store.addNode(undefined, kind)
  if (limit) return
  const created = useCanvasStore
    .getState()
    .nodes.filter(n => kindOf(n) === kind)
    .at(-1)
  if (created) useCanvasStore.getState().updateNodeLabel(created.id, trimmed)
}

const GroupHeader = memo(function GroupHeader({
  kind,
  name,
  meta,
  coach,
}: {
  kind: NodeType
  name: string
  meta: string
  coach: string
}) {
  return (
    <>
      <div className="flex items-center gap-2 pt-2">
        <NodeShapeIndicator nodeKind={kind} size={12} />
        <span className={`${typography.panelBody} font-semibold text-text-header`}>{name}</span>
        <span className={`${typography.panelMeta} ml-auto text-text-light`}>{meta}</span>
      </div>
      <p className={`${typography.panelMeta} mb-1 ml-5 mt-0.5 text-text-light`}>{coach}</p>
    </>
  )
})

const AddRow = memo(function AddRow({
  placeholder,
  spark,
  onAdd,
  onSendPrompt,
  testId,
}: {
  placeholder: string
  spark: { label: string; prompt: string }
  onAdd: (label: string) => void
  onSendPrompt: (label: string, prompt: string) => void
  testId: string
}) {
  const [draft, setDraft] = useState('')
  const submit = () => {
    if (draft.trim() === '') return
    onAdd(draft)
    setDraft('')
  }
  return (
    <div className="mb-1 ml-5 mt-1 flex items-center gap-1.5" data-testid={testId}>
      <input
        aria-label={placeholder}
        className={`${typography.panelMeta} h-7 w-full rounded-lg border border-panel-border bg-panel px-2 text-text-header outline-none placeholder:text-text-light focus:border-info focus:ring-2 focus:ring-info/20`}
        placeholder={placeholder}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') submit()
        }}
      />
      <Tooltip content="Add" delay={300}>
        <PanelIconButton variant="ghost" aria-label={placeholder} onClick={submit}>
          <Plus className="h-3.5 w-3.5" aria-hidden />
        </PanelIconButton>
      </Tooltip>
      <Tooltip content={spark.label} delay={300}>
        <PanelIconButton
          variant="ai"
          aria-label={spark.label}
          onClick={() => onSendPrompt(spark.label, spark.prompt)}
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
        </PanelIconButton>
      </Tooltip>
    </div>
  )
})

export const YourDecisionSection = memo(function YourDecisionSection({
  model,
  onSendPrompt,
  estimateFocus,
}: YourDecisionSectionProps) {
  const [expandedEstimate, setExpandedEstimate] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  // Ladder "calibrate" action: open the section, expand and reveal the row.
  useEffect(() => {
    if (!estimateFocus) return
    setOpen(true)
    setExpandedEstimate(estimateFocus.nodeId)
    // Reveal after the accordion expands.
    requestAnimationFrame(() => {
      document
        .getElementById(`pre-analysis-v3-estimate-${estimateFocus.nodeId}`)
        ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    })
  }, [estimateFocus])

  const meta = [
    `${model.options.length} ${model.options.length === 1 ? 'option' : 'options'}`,
    `${model.risks.length} ${model.risks.length === 1 ? 'risk' : 'risks'}`,
    `${model.estimates.rows.length} ${model.estimates.rows.length === 1 ? 'estimate' : 'estimates'}`,
  ].join(' · ')

  return (
    <div className="border-t border-panel-border" data-testid="pre-analysis-v3-your-decision">
      <Accordion
        title={PANEL_COPY.yourDecisionTitle}
        subtitle={meta}
        isExpanded={open}
        onExpandChange={setOpen}
      >
        <div className="px-1">
          {/* Frame */}
          <GroupHeader
            kind="goal"
            name={MODEL_VIEW_COPY.frameGroup}
            meta={model.hero.success.isSet ? '' : 'success needs setting'}
            coach={MODEL_VIEW_COPY.frameCoach}
          />
          {model.hero.goal && (
            <div className="ml-5 grid min-h-[28px] grid-cols-[1fr_auto] items-center gap-2">
              <span className="flex min-w-0 items-center gap-1.5">
                <span className={`${typography.panelBody} truncate text-text-body`}>
                  {MODEL_VIEW_COPY.goalRow(model.hero.goal.label)}
                </span>
                <Pill variant="success" size="small">{ATTRIBUTION_COPY.set}</Pill>
              </span>
            </div>
          )}
          <div className="ml-5 grid min-h-[28px] grid-cols-[1fr_auto] items-center gap-2">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className={`${typography.panelBody} truncate text-text-body`}>
                {MODEL_VIEW_COPY.successRow}
              </span>
              {model.hero.success.isSet ? (
                <Pill variant="success" size="small">{ATTRIBUTION_COPY.set}</Pill>
              ) : (
                <Pill variant="warning" size="small">{ATTRIBUTION_COPY.needsSetting}</Pill>
              )}
            </span>
            {!model.hero.success.isSet && (
              <Tooltip content="Set it in the field above" delay={300}>
                <PanelIconButton
                  variant="ghost"
                  aria-label="Go to the success field"
                  onClick={() => document.getElementById(SUCCESS_INPUT_ID)?.focus()}
                >
                  <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                </PanelIconButton>
              </Tooltip>
            )}
          </div>

          {/* Options */}
          <GroupHeader
            kind="option"
            name={MODEL_VIEW_COPY.optionsGroup}
            meta={`${model.options.length} included`}
            coach={MODEL_VIEW_COPY.optionsCoach}
          />
          {model.options.map(option => (
            <div
              key={option.nodeId}
              className="ml-5 grid min-h-[28px] grid-cols-[1fr_auto] items-center gap-2"
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <NodeShapeIndicator nodeKind="option" size={10} className="flex-none" />
                <span className={`${typography.panelBody} truncate text-text-body`}>{option.label}</span>
              </span>
            </div>
          ))}
          <AddRow
            placeholder={MODEL_VIEW_COPY.optionsAddPlaceholder}
            spark={SPARK_PROMPTS.widenOptions}
            onAdd={label => addNamedNode('option', label)}
            onSendPrompt={onSendPrompt}
            testId="pre-analysis-v3-add-option"
          />

          {/* Risks and upside */}
          <GroupHeader
            kind="risk"
            name={MODEL_VIEW_COPY.risksGroup}
            meta={`${model.risks.length} ${model.risks.length === 1 ? 'risk' : 'risks'}`}
            coach={MODEL_VIEW_COPY.risksCoach}
          />
          {model.risks.map(risk => (
            <div
              key={risk.nodeId}
              className="ml-5 grid min-h-[28px] grid-cols-[1fr_auto] items-center gap-2"
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <NodeShapeIndicator nodeKind="risk" size={10} className="flex-none" />
                <span className={`${typography.panelBody} truncate text-text-body`}>{risk.label}</span>
                {risk.attribution.kind === 'olumi' && (
                  <Pill variant="default" size="small">Olumi</Pill>
                )}
              </span>
            </div>
          ))}
          <AddRow
            placeholder={MODEL_VIEW_COPY.risksAddPlaceholder}
            spark={SPARK_PROMPTS.findRisks}
            onAdd={label => addNamedNode('risk', label)}
            onSendPrompt={onSendPrompt}
            testId="pre-analysis-v3-add-risk"
          />

          {/* What this depends on */}
          <GroupHeader
            kind="factor"
            name={MODEL_VIEW_COPY.estimatesGroup}
            meta={MODEL_VIEW_COPY.estimatesMeta(
              model.estimates.reviewedCount,
              model.estimates.estimableCount,
            )}
            coach={
              model.estimates.rankingSource === 'sensitivity'
                ? MODEL_VIEW_COPY.estimatesCoach
                : MODEL_VIEW_COPY.estimatesCoachFallback
            }
          />
          <div className="ml-5">
            {model.estimates.rows.map(row => (
              <div key={row.nodeId}>
                <EstimateRow
                  row={row}
                  expanded={expandedEstimate === row.nodeId}
                  onToggle={nodeId =>
                    setExpandedEstimate(current => (current === nodeId ? null : nodeId))
                  }
                />
                {expandedEstimate === row.nodeId && !row.reviewed && (
                  <CalibrateDrillIn row={row} onDone={() => setExpandedEstimate(null)} />
                )}
              </div>
            ))}
            {model.estimates.rows.length > 0 && (
              <p className={`${typography.panelMeta} mb-2 mt-1 italic text-text-light`}>
                {MODEL_VIEW_COPY.effectStrengthGate}
              </p>
            )}
          </div>
        </div>
      </Accordion>
    </div>
  )
})

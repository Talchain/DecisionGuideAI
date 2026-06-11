/**
 * YourDecisionSection — the model in words, grouped by entity with correct
 * shapes. Each group (Frame, Options, Risks, Estimates) collapses
 * independently behind its header (counts stay visible while collapsed),
 * with Expand all / Collapse all at the top — calm by default, intentionally
 * reviewable when opened. The estimates group is the causal coaching
 * surface: ranked by influence, provenance-flagged, check affordances
 * inline. Effect-strength values stay gated (value-scale fix pending).
 *
 * Edit affordances are limited to verified write paths: add option, add
 * risk, add value, check estimate. Renaming options/risks stays in the
 * canvas and inspector (their canonical editing home).
 */

import { memo, useEffect, useState, type ReactNode } from 'react'
import { Plus, ArrowUp, ChevronRight, Sparkles } from 'lucide-react'
import Tooltip from '../../../../components/Tooltip'
import { typography, typo } from '../../../../styles/typography'
import { useCanvasStore } from '../../../store'
import { NodeShapeIndicator } from '../../../nodes/NodeShapeIndicator'
import { Pill } from '../../pre-analysis/primitives/Pill'
import { ATTRIBUTION_COPY, FIELD_FEEDBACK_COPY, MODEL_VIEW_COPY, PANEL_COPY, SPARK_PROMPTS } from '../constants'
import { kindOf } from '../selectors/graphFacts'
import { PanelIconButton } from '../ui/PanelIconButton'
import { PanelDisclosure } from '../ui/PanelDisclosure'
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

type GroupKey = 'frame' | 'options' | 'risks' | 'estimates'

const CLOSED_GROUPS: Record<GroupKey, boolean> = {
  frame: false,
  options: false,
  risks: false,
  estimates: false,
}

function addNamedNode(kind: 'option' | 'risk', label: string): boolean {
  const trimmed = label.trim()
  if (trimmed === '') return false
  const store = useCanvasStore.getState()
  const limit = store.addNode(undefined, kind)
  if (limit) return false
  const created = useCanvasStore
    .getState()
    .nodes.filter(n => kindOf(n) === kind)
    .at(-1)
  if (!created) return false
  useCanvasStore.getState().updateNodeLabel(created.id, trimmed)
  return true
}

/** Collapsible group: header (shape, name, meta) toggles the body + coach line. */
const Group = memo(function Group({
  groupKey,
  kind,
  name,
  meta,
  coach,
  open,
  onToggle,
  children,
}: {
  groupKey: GroupKey
  kind: NodeType
  name: string
  meta: string
  coach: string
  open: boolean
  onToggle: (key: GroupKey) => void
  children: ReactNode
}) {
  return (
    <div data-testid={`pre-analysis-v3-group-${groupKey}`}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => onToggle(groupKey)}
        className="flex w-full items-center gap-2 rounded py-2 text-left outline-none transition-colors hover:bg-panel-hover focus-visible:ring-2 focus-visible:ring-info/40"
      >
        <span className="flex w-4 justify-center">
          <NodeShapeIndicator nodeKind={kind} size={12} />
        </span>
        <span className={`${typography.panelBody} font-semibold text-text-header`}>{name}</span>
        <span className={`${typography.panelMeta} ml-auto truncate text-text-light`}>{meta}</span>
        <ChevronRight
          className={`h-3.5 w-3.5 flex-none text-text-light transition-transform ${open ? 'rotate-90' : ''}`}
          aria-hidden
        />
      </button>
      {open && (
        <>
          <p className={`${typography.panelMeta} mb-1 ml-6 text-text-light`}>{coach}</p>
          {children}
        </>
      )}
    </div>
  )
})

const AddRow = memo(function AddRow({
  placeholder,
  addLabel,
  spark,
  onAdd,
  onSendPrompt,
  testId,
}: {
  placeholder: string
  /** Distinct accessible name for the + button (the input owns the placeholder name). */
  addLabel: string
  spark: { label: string; prompt: string }
  onAdd: (label: string) => boolean
  onSendPrompt: (label: string, prompt: string) => void
  testId: string
}) {
  const [draft, setDraft] = useState('')
  const [hint, setHint] = useState<string | null>(null)
  const submit = () => {
    if (draft.trim() === '') return
    if (onAdd(draft)) {
      setDraft('')
      setHint(null)
    } else {
      // The only rejection path with text present is the node limit —
      // explain, never silently keep the text.
      setHint(FIELD_FEEDBACK_COPY.modelSizeLimit)
    }
  }
  return (
    <div className="mb-2 ml-6 mt-1 flex flex-wrap items-center gap-2" data-testid={testId}>
      <input
        aria-label={placeholder}
        className={`${typography.panelBody} h-7 w-full rounded-lg border border-panel-border bg-panel px-2 text-text-header outline-none placeholder:text-text-light focus:border-info focus:ring-2 focus:ring-info/20`}
        placeholder={placeholder}
        value={draft}
        aria-invalid={hint ? true : undefined}
        onChange={e => {
          setDraft(e.target.value)
          if (hint) setHint(null)
        }}
        onKeyDown={e => {
          if (e.key === 'Enter') submit()
        }}
      />
      <Tooltip content={addLabel} delay={300}>
        <PanelIconButton variant="ghost" aria-label={addLabel} onClick={submit}>
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
      {hint && (
        <span className={`${typography.panelMeta} w-full text-warning`} role="status">
          {hint}
        </span>
      )}
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
  const [openGroups, setOpenGroups] = useState<Record<GroupKey, boolean>>(CLOSED_GROUPS)

  const allOpen = Object.values(openGroups).every(Boolean)
  const toggleGroup = (key: GroupKey) => setOpenGroups(g => ({ ...g, [key]: !g[key] }))
  const setAll = (value: boolean) =>
    setOpenGroups({ frame: value, options: value, risks: value, estimates: value })

  // Ladder "check estimate" action: open the section + the estimates group,
  // expand and reveal the row.
  useEffect(() => {
    if (!estimateFocus) return
    setOpen(true)
    setOpenGroups(g => ({ ...g, estimates: true }))
    setExpandedEstimate(estimateFocus.nodeId)
    // Reveal after the disclosure expands.
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
    <PanelDisclosure
      title={PANEL_COPY.yourDecisionTitle}
      meta={meta}
      open={open}
      onOpenChange={setOpen}
      testId="pre-analysis-v3-your-decision"
    >
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setAll(!allOpen)}
          className={typo(
            'panelMeta',
            'rounded text-text-light outline-none transition-colors hover:text-text-header focus-visible:text-text-header focus-visible:ring-2 focus-visible:ring-info/40',
          )}
          data-testid="pre-analysis-v3-groups-toggle-all"
        >
          {allOpen ? PANEL_COPY.collapseAll : PANEL_COPY.expandAll}
        </button>
      </div>

      <Group
        groupKey="frame"
        kind="goal"
        name={MODEL_VIEW_COPY.frameGroup}
        meta={model.hero.success.isSet ? '' : 'success needs setting'}
        coach={MODEL_VIEW_COPY.frameCoach}
        open={openGroups.frame}
        onToggle={toggleGroup}
      >
        {model.hero.goal && (
          <div className="ml-6 grid min-h-7 grid-cols-[1fr_auto] items-center gap-2">
            <span className="flex min-w-0 items-center gap-2">
              <span className={`${typography.panelBody} truncate text-text-body`}>
                {MODEL_VIEW_COPY.goalRow(model.hero.goal.label)}
              </span>
              <Pill variant="success" size="small">{ATTRIBUTION_COPY.set}</Pill>
            </span>
          </div>
        )}
        <div className="ml-6 grid min-h-7 grid-cols-[1fr_auto] items-center gap-2">
          <span className="flex min-w-0 items-center gap-2">
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
      </Group>

      <Group
        groupKey="options"
        kind="option"
        name={MODEL_VIEW_COPY.optionsGroup}
        meta={`${model.options.length} included`}
        coach={MODEL_VIEW_COPY.optionsCoach}
        open={openGroups.options}
        onToggle={toggleGroup}
      >
        {model.options.map(option => (
          <div key={option.nodeId} className="ml-6 grid min-h-7 grid-cols-[1fr_auto] items-center gap-2">
            <span className="flex min-w-0 items-center gap-2">
              <span className={`${typography.panelBody} truncate text-text-body`}>{option.label}</span>
            </span>
          </div>
        ))}
        <AddRow
          placeholder={MODEL_VIEW_COPY.optionsAddPlaceholder}
          addLabel="Add option"
          spark={SPARK_PROMPTS.widenOptions}
          onAdd={label => addNamedNode('option', label)}
          onSendPrompt={onSendPrompt}
          testId="pre-analysis-v3-add-option"
        />
      </Group>

      <Group
        groupKey="risks"
        kind="risk"
        name={MODEL_VIEW_COPY.risksGroup}
        meta={`${model.risks.length} ${model.risks.length === 1 ? 'risk' : 'risks'}`}
        coach={MODEL_VIEW_COPY.risksCoach}
        open={openGroups.risks}
        onToggle={toggleGroup}
      >
        {model.risks.map(risk => (
          <div key={risk.nodeId} className="ml-6 grid min-h-7 grid-cols-[1fr_auto] items-center gap-2">
            <span className="flex min-w-0 items-center gap-2">
              <span className={`${typography.panelBody} truncate text-text-body`}>{risk.label}</span>
              {risk.attribution.kind === 'olumi' && (
                <Pill variant="default" size="small">Olumi</Pill>
              )}
            </span>
          </div>
        ))}
        <AddRow
          placeholder={MODEL_VIEW_COPY.risksAddPlaceholder}
          addLabel="Add risk"
          spark={SPARK_PROMPTS.findRisks}
          onAdd={label => addNamedNode('risk', label)}
          onSendPrompt={onSendPrompt}
          testId="pre-analysis-v3-add-risk"
        />
      </Group>

      <Group
        groupKey="estimates"
        kind="factor"
        name={MODEL_VIEW_COPY.estimatesGroup}
        meta={MODEL_VIEW_COPY.estimatesMeta(
          model.estimates.checkedCount,
          model.estimates.checkableCount,
          model.estimates.needsValueCount,
        )}
        coach={
          model.estimates.rankingSource === 'sensitivity'
            ? MODEL_VIEW_COPY.estimatesCoach
            : MODEL_VIEW_COPY.estimatesCoachFallback
        }
        open={openGroups.estimates}
        onToggle={toggleGroup}
      >
        <div className="ml-6">
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
            <p className={`${typography.panelMeta} mb-1 mt-2 italic text-text-light`}>
              {MODEL_VIEW_COPY.effectStrengthGate}
            </p>
          )}
        </div>
      </Group>
    </PanelDisclosure>
  )
})

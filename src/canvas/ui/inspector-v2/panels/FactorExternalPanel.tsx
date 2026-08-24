/**
 * FactorExternalPanel — Inspector for external factors (spec §9)
 * v6.2 three-group layout: Context → Your input → Influences
 * QuickSetButtons ABOVE range display as primary input affordance.
 */

import { memo, useState, useMemo, useCallback } from 'react'
import { useCanvasStore } from '../../../store'
import { useRobustness } from '../useAnalysisResults'
import type { NodeType } from '../../../domain/nodes'
import { InspectorCoaching } from '../shared/InspectorCoaching'
import { useNodeDisplayMetadata } from '../../../hooks/useNodeDisplayMetadata'
import { typography } from '../../../../styles/typography'
import { useNodeMutations } from '../useInspectorMutations'
import {
  GROUP_LABELS,
  INLINE_LABELS,
  DESCRIPTION_PLACEHOLDERS,
  getExtractionLabel,
} from '../inspectorStrings'
import { PanelGroup } from '../shared/PanelGroup'
import { PrimaryControlCard } from '../shared/PrimaryControlCard'
import { InlineSectionLabel } from '../shared/InlineSectionLabel'
import { ImportanceBar } from '../shared/ImportanceBar'
import { EmptyDescriptionPrompt } from '../shared/EmptyDescriptionPrompt'
import { ConnectionRow } from '../shared/ConnectionRow'
import { StaleGuardBanner } from '../shared/StaleGuardBanner'
import { TechnicalDisclosure } from '../shared/TechnicalDisclosure'
import { DataBar } from '../../shared/DataBar'
import type { InspectorPanelProps } from '../types'
import { resolveCoaching } from '../coachingConfig'
import { FactorExternalEditor } from '../editors/FactorExternalEditor'
import { factorDisplayText } from '../../../../utils/formatFactorDisplayValue'
import { resolveEdgeSignedStrengthDisplay } from '../../../domain/edgeValueProvenance'
import { useParticipantName } from '../../../../collab/useParticipantName'
import { useCitedEvidence } from '../../../../collab/citedEvidenceCache'
import { CitedEvidenceNote } from '../../../../collab/CitedEvidenceNote'
import { resolveElementLabel } from '../../../domain/elementLabel'

// Quick-set presets
const QUICK_SET = {
  low:       { label: 'Low',       min: 0,   max: 0.4, description: 'Low level expected' },
  moderate:  { label: 'Moderate',  min: 0.3, max: 0.7, description: 'Moderate level expected' },
  high:      { label: 'High',      min: 0.6, max: 1.0, description: 'High level expected' },
  uncertain: { label: 'Uncertain', min: 0,   max: 1.0, description: 'Level unknown' },
} as const

type QuickSetKey = keyof typeof QUICK_SET

export const FactorExternalPanel = memo(function FactorExternalPanel({
  nodeId,
  techMode,
  onClose,
  onNavigate,
}: InspectorPanelProps) {
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)
  const resultsStatus = useCanvasStore(s => s.results?.status)
  const isResultsMode = resultsStatus === 'complete'

  const node = nodeId ? nodes.find(n => n.id === nodeId) : undefined
  const mutations = useNodeMutations(nodeId ?? '')
  const displayMetadata = useNodeDisplayMetadata(nodeId ?? '', 'factor')

  // Description — conditional edit state for EmptyDescriptionPrompt pattern
  const [description, setDescription] = useState(String(node?.data?.description ?? ''))
  const [isEditingDescription, setIsEditingDescription] = useState(false)

  // Shared display text with FactorNode and the debug bundle — see the
  // priority order on FactorDisplayInput.display_value: fresh raw_value +
  // meaningful unit (£26,000) outranks display_value; otherwise display_value
  // wins over the unitless-raw and value-only fallbacks.
  const canonicalDisplayText = factorDisplayText(node?.data as Record<string, unknown> | undefined)

  // Source for extraction label (from observedState if present)
  const obs = (node?.data as Record<string, unknown>)?.observedState as Record<string, unknown> | undefined
  const source = obs?.source as string | undefined
  /**
   * D1 — resolve a `panel_elicited` value's AUTHOR to a name, at render.
   *
   * Called unconditionally and before this component's `!nodeId || !node` early
   * return, because it is a hook. For every non-panel value it is a no-op: no
   * `elicited_from` means `no_attribution`, which fetches nothing and leaves
   * both labels below byte-identical to what they rendered before.
   */
  const attributedTo = useParticipantName(obs?.elicited_from as unknown)
  /**
   * The CITATION the owner recorded when they applied this value. A no-op for
   * every value carrying no citation: `no_citation` fetches nothing and renders
   * nothing, leaving this panel byte-identical to what it rendered before.
   */
  const citedEvidence = useCitedEvidence(obs?.elicited_from as unknown)

  // Prior range
  const prior = (node?.data as Record<string, unknown>)?.prior as Record<string, unknown> | number | undefined
  const rangeMin = typeof prior === 'object' ? (prior as Record<string, unknown>)?.range_min as number | undefined : undefined
  const rangeMax = typeof prior === 'object' ? (prior as Record<string, unknown>)?.range_max as number | undefined : undefined

  // Local drafts for tech mode editable inputs
  const [localMin, setLocalMin] = useState<string>(rangeMin != null ? rangeMin.toFixed(2) : '')
  const [localMax, setLocalMax] = useState<string>(rangeMax != null ? rangeMax.toFixed(2) : '')

  const handleMinBlur = useCallback(() => {
    const parsed = parseFloat(localMin)
    if (!isNaN(parsed)) {
      setSelected(null)
      mutations.setPriorRange(parsed, rangeMax ?? parsed)
    }
  }, [localMin, rangeMax, mutations])

  const handleMaxBlur = useCallback(() => {
    const parsed = parseFloat(localMax)
    if (!isNaN(parsed)) {
      setSelected(null)
      mutations.setPriorRange(rangeMin ?? 0, parsed)
    }
  }, [localMax, rangeMin, mutations])

  const [selected, setSelected] = useState<QuickSetKey | null>(() => {
    if (rangeMin == null || rangeMax == null) return null
    for (const [key, preset] of Object.entries(QUICK_SET)) {
      if (Math.abs(rangeMin - preset.min) < 0.05 && Math.abs(rangeMax - preset.max) < 0.05) {
        return key as QuickSetKey
      }
    }
    return null
  })

  const handleQuickSet = useCallback((key: QuickSetKey) => {
    setSelected(key)
    setLocalMin(QUICK_SET[key].min.toFixed(2))
    setLocalMax(QUICK_SET[key].max.toFixed(2))
    mutations.setPriorRange(QUICK_SET[key].min, QUICK_SET[key].max)
  }, [mutations])

  // Outbound connections
  const influences = useMemo(() => {
    return edges
      .filter(e => e.source === nodeId)
      .map(e => {
        const tgt = nodes.find(n => n.id === e.target)
        const kind = (tgt?.type || tgt?.data?.kind || 'factor') as NodeType
        return {
          edgeId: e.id,
          nodeId: e.target,
          nodeKind: kind,
          label: resolveElementLabel(tgt?.data),
          strength: resolveEdgeSignedStrengthDisplay(e.data as Record<string, unknown> | undefined),
        }
      })
  }, [edges, nodes, nodeId])

  if (!nodeId || !node) return null

  // Contextual guidance for external factor — three tiers
  const robustness = useRobustness()
  const flipEntry = (robustness?.flip_thresholds as Array<{ node_id: string; alternative_winner_label?: string }> | undefined)
    ?.find(ft => ft.node_id === nodeId)
  /**
   * Contextual guidance — the factor's ANALYTICAL STATUS only.
   *
   * ⚠ THIS USED TO END IN A PROMISE THE COMPUTE DOES NOT KEEP. Tier 2 said
   * *"Narrowing the range would sharpen the analysis."* and tier 3 said
   * *"Providing an estimate helps the simulation account for this
   * uncertainty."* Both were false, and the range control sits directly below
   * them, so the panel read as an instruction to do something consequential.
   * The range reaches no compute by any of its three carriers: the local write
   * is autosaved to localStorage, the V1 mapper takes `data.prior` only when it
   * is a NUMBER (`adapters/plot/v1/mapper.ts:175`) and this control writes the
   * object form, and `prior_range_edit` is ratified carry-only — CEE persists a
   * typed turn fact and writes no graph.
   *
   * What the range IS is now stated beside the control itself (the
   * `factor-external-range-role` note below), which is where a user deciding
   * whether to touch it is actually looking. This slot keeps only claims the
   * panel can support: tier 1 reports a real robustness flip threshold, tier 2
   * a real sensitivity rank, and tier 3 follows from the factor's declared TYPE
   * (`category === 'external'`) — the entitlement standard coachingConfig's own
   * header sets.
   *
   * ⚠ AND NONE OF THEM MAY BE AN INSTRUCTION. `InspectorRouter` wraps every
   * panel in `<fieldset disabled>` beneath INSPECTOR_READ_ONLY_REASON
   * (`InspectorRouter.tsx:326-340`), so on the deployed build this control is
   * mounted and INERT. Copy telling the user to go and set something would
   * layer a second false promise on the first. These tiers state what is true
   * of the FACTOR; the role note states what the RANGE is; neither tells
   * anyone to act.
   */
  const externalGuidance = flipEntry?.alternative_winner_label
    ? `If ${String(node.data?.label ?? 'this factor')} is high, the result changes to ${flipEntry.alternative_winner_label}.`
    : isResultsMode && displayMetadata.sensitivityRank != null
    ? 'This factor contributes significant uncertainty to your results.'
    : 'This factor is outside your control, so its level is uncertain.'

  return (
    <div>
      {/* ── Context group ─────────────────────────────────────── */}
      <PanelGroup kind="context" label={GROUP_LABELS.context}>
        {/* Description — textarea when editing or content exists, EmptyDescriptionPrompt when empty */}
        {description || isEditingDescription ? (
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            onBlur={() => {
              mutations.setDescription(description)
              if (!description.trim()) setIsEditingDescription(false)
            }}
            autoFocus={isEditingDescription && !description}
            placeholder="Describe this external factor..."
            rows={2}
            maxLength={500}
            className={`${typography.panelBody} w-full border border-panel-border rounded-lg px-2.5 py-1.5 bg-panel resize-none`}
          />
        ) : (
          <EmptyDescriptionPrompt
            placeholder={DESCRIPTION_PLACEHOLDERS.factor}
            onStartEditing={() => setIsEditingDescription(true)}
          />
        )}

        {/* Provenance pills: category identity + data source */}
        <div className="mt-2 flex gap-1.5 flex-wrap">
          <span className={`${typography.panelMeta} inline-flex items-center px-2.5 py-0.5 rounded-full bg-transparent text-text-body border border-factor/30`}>
            Outside your control
          </span>
          <span className={`${typography.panelMeta} inline-flex items-center px-2.5 py-0.5 rounded-full bg-transparent text-text-body border border-success/30`}>
            {getExtractionLabel(source, attributedTo)}
          </span>
        </div>

        {/* What the owner cited when they applied it. Renders only when a
            citation resolved; never gated on `source`, because the citation is a
            fact about the apply and not about the extraction kind. */}
        <CitedEvidenceNote resolution={citedEvidence} />

        {/* Post-analysis: ImportanceBar + VoI folded in (no separate bordered card) */}
        <StaleGuardBanner hasResults={isResultsMode}>
          <div className="mt-2 space-y-2">
            <ImportanceBar
              importanceScore={displayMetadata.influence}
              sensitivityRank={displayMetadata.sensitivityRank}
            />
            {displayMetadata.valueOfInformation !== null && (
              <div>
                <DataBar
                  value={displayMetadata.valueOfInformation}
                  label="Investigation value"
                  colour="info"
                  trailingLabel={
                    displayMetadata.valueOfInformation >= 0.7 ? 'High'
                    : displayMetadata.valueOfInformation >= 0.4 ? 'Medium'
                    : 'Low'
                  }
                />
                <p className={`${typography.panelMeta} text-text-light mt-1`}>
                  {displayMetadata.valueOfInformation >= 0.7
                    ? 'Gathering more evidence here could significantly improve confidence.'
                    : displayMetadata.valueOfInformation >= 0.4
                    ? 'Additional evidence here would moderately sharpen the analysis.'
                    : 'Further investigation here is unlikely to change the outcome.'}
                </p>
              </div>
            )}
          </div>
        </StaleGuardBanner>

        {/* Contextual guidance */}
        <p
          className={`${typography.panelBody} text-text-body mt-2`}
          data-testid="factor-external-guidance"
        >
          {externalGuidance}
        </p>
      </PanelGroup>

      {/* ── Your input group ──────────────────────────────────── */}
      <PanelGroup kind="input" label={GROUP_LABELS.input}>
        <PrimaryControlCard>
          {canonicalDisplayText && (
            <div className={`${typography.panelBody} text-text-body mb-1.5`} data-testid="factor-display-text">
              {canonicalDisplayText}
            </div>
          )}
          <div className={`${typography.panelBody} mb-2`}>How would you describe the level?</div>

          {/* Quick-set buttons */}
          <div className="flex gap-1.5 flex-wrap mb-2.5">
            {(Object.keys(QUICK_SET) as QuickSetKey[]).map(key => (
              <button
                key={key}
                onClick={() => handleQuickSet(key)}
                className={`${typography.panelMeta} px-2.5 py-1 rounded-full cursor-pointer capitalize transition-colors ${
                  selected === key
                    ? 'border border-primary text-primary bg-panel'
                    : 'border border-panel-border text-text-light bg-panel hover:bg-panel-hover'
                }`}
              >
                {QUICK_SET[key].label}
              </button>
            ))}
          </div>

          {/* Qualitative summary */}
          {selected && (
            <p className={`${typography.panelBody} text-text-body italic mb-2`}>
              {QUICK_SET[selected].description}
            </p>
          )}

          {/* Range bar visualisation */}
          <div className="relative h-5">
            <div className="absolute top-2 left-0 right-0 h-1 bg-panel-border rounded-full" />
            {rangeMin != null && rangeMax != null && (
              <div
                className="absolute top-2 h-1 rounded-full transition-all duration-300"
                style={{
                  left: `${rangeMin * 100}%`,
                  width: `${(rangeMax - rangeMin) * 100}%`,
                  background: 'linear-gradient(to right, var(--success) 40%, var(--factor), var(--danger) 80%)',
                  opacity: 0.6,
                }}
              />
            )}
          </div>

          {/* Tech mode: editable numerical inputs */}
          {techMode && (
            <div className="flex gap-2 mt-2">
              <label className="flex-1">
                <span className={`${typography.panelMeta} text-text-light`}>Min</span>
                <input
                  type="number"
                  step="0.01"
                  value={localMin}
                  onChange={e => setLocalMin(e.target.value)}
                  onBlur={handleMinBlur}
                  onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
                  className={`${typography.panelMeta} w-full mt-0.5 bg-transparent border-b border-panel-border focus:border-primary outline-none py-0.5 tabular-nums transition-colors`}
                />
              </label>
              <label className="flex-1">
                <span className={`${typography.panelMeta} text-text-light`}>Max</span>
                <input
                  type="number"
                  step="0.01"
                  value={localMax}
                  onChange={e => setLocalMax(e.target.value)}
                  onBlur={handleMaxBlur}
                  onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
                  className={`${typography.panelMeta} w-full mt-0.5 bg-transparent border-b border-panel-border focus:border-primary outline-none py-0.5 tabular-nums transition-colors`}
                />
              </label>
            </div>
          )}

          {/*
            What this control actually does, stated where the control is.

            It states what the range IS, not what pressing something would do.
            The inspector is read-only on the deployed build (`<fieldset
            disabled>` in InspectorRouter), so an instruction here could not be
            carried out; and "your judgement" would claim an authorship the
            panel cannot establish, because a drafted prior arrives from CEE
            already populated.

            The range is a JUDGEMENT the model records, not an analysis input —
            see the note on `externalGuidance` above for the three carriers and
            why none of them reaches the compute. The affordance stays because
            the user's uncertainty is real information and `setPriorRange`
            genuinely carries it (locally, and to CEE as a `prior_range_edit`
            turn fact); what was wrong was the panel claiming it moved the maths.

            The sentence form is NOT minted here. It is this surface's existing
            vocabulary for exactly this distinction — `inspectorStrings.ts`
            EDGE_LINK_NOTICES pairs "It does not affect analysis." with "It
            affects analysis." — under the rule its own header sets for the
            neighbouring provenance pill: a control that states a status "does
            not change the analysis today ... and the copy must not imply it
            does".
          */}
          <p
            className={`${typography.panelMeta} text-text-light mt-2`}
            data-testid="factor-external-range-role"
          >
            This range is a recorded judgement about the level. It does not affect analysis.
          </p>
        </PrimaryControlCard>

        {/* Coaching — within Your input group, below the card */}
        <InspectorCoaching
          elementId={nodeId}
          panelType="factor-external"
          fallbackText={resolveCoaching('factorExternalUncertainty', { factorName: String(node.data?.label ?? '') })}
          labelContext={{ label: String(node.data?.label ?? '') }}
          /*
           * NO `actionLabel` OVERRIDE, DELIBERATELY — the default is
           * 'Ask about this'.
           *
           * This prop used to read `actionLabel="Narrow the range"`, on the
           * button whose onClick is InspectorCoaching's `handleAsk` →
           * `requestAsk` → prefill a chat question. It narrows nothing. That is
           * the same defect InspectorCoaching's own header records (ledger
           * L-18): "a control labelled as one semantic doing the other", and
           * the rule it set is to label a control for what it does using the
           * estate's existing word for the action class rather than minting a
           * third vocabulary. The existing word is the component default.
           */
        />
      </PanelGroup>

      {/* ── Influences group ──────────────────────────────────── */}
      <PanelGroup kind="connections" label={GROUP_LABELS.connections}>
        <InlineSectionLabel>{INLINE_LABELS.influences}</InlineSectionLabel>
        {influences.map(conn => (
          <ConnectionRow
            key={conn.edgeId}
            nodeKind={conn.nodeKind}
            label={conn.label}
            strength={conn.strength}
            fullLabel
            techMode={techMode}
            onClick={() => onNavigate(conn.nodeId)}
          />
        ))}
        {influences.length === 0 && (
          <p className={`${typography.panelMeta} text-text-light`}>No outbound influences</p>
        )}
      </PanelGroup>

      {/* ── Expert-only model detail ──────────────────────────── */}
      <TechnicalDisclosure visible={techMode}>
        <FactorExternalEditor nodeId={nodeId} />
      </TechnicalDisclosure>
    </div>
  )
})

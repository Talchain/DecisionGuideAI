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
   * ⚠⚠ THIS SLOT HAS NOW CARRIED TWO DIFFERENT FALSE SENTENCES, FAILING IN
   * OPPOSITE DIRECTIONS. Read both before editing it a third time.
   *
   * 1. It OVERPROMISED. Tier 2 said *"Narrowing the range would sharpen the
   *    analysis."* and tier 3 said *"Providing an estimate helps the simulation
   *    account for this uncertainty."* — an instruction to do something
   *    consequential, sitting directly above a control that cannot be operated.
   * 2. The first fix then UNDERPROMISED, and put the denial beside the control
   *    where it did the most damage: *"It does not affect analysis."* That is
   *    false about the FIELD. `prior.{range_min,range_max}` is a declared
   *    analysis input — absent from `V2_NODE_BLOCKLIST` so it passes through
   *    `transformNodeToV2` verbatim (adapter.ts:968-1017, which names `prior` in
   *    its own comment), and declared on CEE's graph contract at
   *    `schemas/cee-v3.ts:184-185` with the reason written beside it: "ISL needs
   *    prior ranges to run Monte Carlo sampling on external factors." ISL draws
   *    `rng.uniform(range_min, range_max)` on every Monte Carlo sample
   *    (`robustness_analyzer_v2.py:1275`). The same panel already asserted as
   *    much under "Show model detail", where `FactorExternalEditor` names the
   *    distribution ISL samples from these very numbers — so the denial
   *    contradicted a sibling line in its own component tree, invisibly,
   *    because `TechnicalDisclosure` is closed by default.
   *
   * The two sentences answered DIFFERENT QUESTIONS under one form of words
   * (trap 21): *"does this range affect the analysis?"* (yes) and *"will my
   * edit here reach it?"* (no). Naming them apart is the whole fix — the role
   * note below answers both, in that order, and neither this slot nor that one
   * may collapse them again.
   *
   * What THIS slot keeps is only what the panel can derive: tier 1 a real
   * robustness flip threshold, tier 2 a real sensitivity rank, tier 3 the
   * factor's declared TYPE (`category === 'external'`) — the entitlement
   * standard coachingConfig's own header sets.
   *
   * ⚠ AND NONE OF THEM MAY BE AN INSTRUCTION. `InspectorRouter` wraps every
   * panel in an unconditional `<fieldset disabled>` beneath
   * INSPECTOR_READ_ONLY_REASON (`InspectorRouter.tsx:334-340`, pinned by
   * `InspectorRouter.spec.tsx` "semantic controls fail closed without GraphV3
   * authority"), and `NODE_SETTER_AUTHORITY.setPriorRange` is `'disabled'`. On
   * the deployed build this control is mounted and INERT. These tiers state
   * what is true of the FACTOR; the role note states what the RANGE is and
   * that it cannot be set here; neither tells anyone to act.
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
            ── TWO FACTS, IN THIS ORDER, AND NEITHER MAY BE DROPPED ───────────

            A user looking at four quick-set buttons, a range bar and a pair of
            min/max inputs is asking two questions, and they have DIFFERENT
            answers. Every previous version of this copy answered one of them
            and let the wording imply the other (trap 21), which is how the
            same slot shipped a false promise and then its false denial:

              Q1  "Does this range matter to the analysis?"   → YES.
              Q2  "Will changing it HERE change my results?"  → NO.

            Q1 is a fact about the FIELD, and it was derived end to end at the
            bytes (PLoT `7e5d8a7`, ISL `28fe0c9`, fresh clones, contrast
            controls firing):
              · absent from `V2_NODE_BLOCKLIST`, so `transformNodeToV2` passes
                it to PLoT verbatim (adapter.ts:968-1017, whose own comment
                names `prior` as a field the blocklist exists to let through);
              · declared on CEE's graph contract, `schemas/cee-v3.ts:184-185`,
                under the line "ISL needs prior ranges to run Monte Carlo
                sampling on external factors";
              · declared on PLoT's node types (`engine-v3.ts:130-135, 254-259`),
                validated in `graph-normaliser.ts:380-413`, and emitted into
                `parameter_uncertainties` by `translator-v3.ts:842-847`;
              · drawn by ISL on every Monte Carlo sample —
                `robustness_analyzer_v2.py:1275`, `rng.uniform(range_min,
                range_max)` — becoming the node's `base` in the structural
                equation (`:1437-1466`), hence propagating into the goal
                outcome, the option comparison and the sensitivity ranking.
            None of that is inert, and "It does not affect analysis." was simply
            false about it.

            ⚠ WHY THE SENTENCE SAYS "the model's prior" AND NOT "your results
            will change". PLoT's pass is GATED, and one gate is silent: a node
            carrying `observed_state.value` skips the prior entirely
            (`translator-v3.ts:744` — observed state wins, no warning), and the
            entry is also dropped for a non-`external` category (`:746`), a
            non-`uniform` distribution (`:748`) or a degenerate range (`:793`).
            Asserting a guaranteed per-run effect would be the THIRD absolute
            claim this slot has made, and it would be false on exactly those
            branches. Stating the field's ROLE is true across the whole domain,
            and it does not mirror a gate that lives in another service (trap
            12 — a mirror of PLoT's precedence would invert the day PLoT
            changes it).

            Q2 is a fact about this SURFACE, and it is why the sentence is not
            simply "It affects analysis." The inspector is read-only:
            `InspectorRouter` wraps every panel in an unconditional `<fieldset
            disabled>` (InspectorRouter.tsx:334-340), and this repo's own
            authority manifest records the verdict directly —
            `NODE_SETTER_AUTHORITY.setPriorRange: 'disabled'`. No affordance on
            this panel can write the field. Even the local write would not
            settle it: `setPriorRange` updates the store and emits
            `prior_range_edit`, which CEE persists as a typed turn FACT and
            which writes no graph.

            ⚠ DO NOT COMPRESS THIS TO ONE ABSOLUTE CLAIM. Two have been tried —
            "narrowing the range would sharpen the analysis" and "it does not
            affect analysis" — and both were false, in opposite directions,
            because each collapsed Q1 and Q2 into a single verdict. If a future
            edit can only fit one sentence, keep Q2: it is the one that governs
            what the reader is about to do.

            "your judgement" is deliberately avoided: a drafted prior arrives
            from CEE already populated, so the panel cannot establish who
            authored the range. And nothing here is in the imperative — an
            instruction on a surface that cannot carry it would be another
            false promise. The vocabulary is borrowed, not minted: "read-only"
            from INSPECTOR_READ_ONLY_REASON, which the reader has already met at
            the top of this panel.
          */}
          <p
            className={`${typography.panelMeta} text-text-light mt-2`}
            data-testid="factor-external-range-role"
          >
            This range is what the model treats as the factor&rsquo;s plausible level &mdash; an analysis input, not a label. You cannot change it here yet: this inspector is read-only.
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

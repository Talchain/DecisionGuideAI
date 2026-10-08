import { useSwitchFactorNodes } from '../../../hooks/useSwitchFactorNodes'
/**
 * FactorExternalPanel — Inspector for external factors (spec §9)
 * Anatomy: summary → primary control → influence → connections; detail stays in More.
 * QuickSetButtons ABOVE range display as primary input affordance.
 */

import { memo, useState, useMemo, useCallback } from 'react'
import { useCanvasStore } from '../../../store'
import { useRobustness } from '../useAnalysisResults'
import type { NodeType } from '../../../domain/nodes'
import { InspectorCoaching } from '../shared/InspectorCoaching'
import { useNodeDisplayMetadata } from '../../../hooks/useNodeDisplayMetadata'
import { typography } from '../../../../styles/typography'
import { controls } from '../../../../styles/controls'
import { useNodeMutations } from '../useInspectorMutations'
import {
  GROUP_LABELS,
  getInputGroupLabel,
  INLINE_LABELS,
  factorValueSourceLabel,
} from '../inspectorStrings'
import { PanelGroup } from '../shared/PanelGroup'
import { PrimaryControlCard } from '../shared/PrimaryControlCard'
import { InlineSectionLabel } from '../shared/InlineSectionLabel'
import { ImportanceBar } from '../shared/ImportanceBar'
import { ConnectionRow } from '../shared/ConnectionRow'
import { StaleGuardBanner } from '../shared/StaleGuardBanner'
import { FactorTurningPointInspectorLine } from '../shared/FactorTurningPointInspectorLine'
import { TechnicalDisclosure } from '../shared/TechnicalDisclosure'
import { DataBar } from '../../shared/DataBar'
import type { InspectorPanelProps } from '../types'
import {
  investigationValueTier,
  INVESTIGATION_VALUE_LABEL,
  INVESTIGATION_VALUE_INVITATION,
} from '../../../domain/investigationValue'
import { resolveCoaching } from '../coachingConfig'
import { FactorExternalEditor } from '../editors/FactorExternalEditor'
import { factorDisplayText } from '../../../../utils/formatFactorDisplayValue'
import { unwrapInterventionValue } from '../../../utils/labelUtils'
import { resolveEdgeSignedStrengthDisplay } from '../../../domain/edgeValueProvenance'
import { useParticipantName } from '../../../../collab/useParticipantName'
import { useCitedEvidence } from '../../../../collab/citedEvidenceCache'
import { CitedEvidenceNote } from '../../../../collab/CitedEvidenceNote'
import { resolveElementLabel } from '../../../domain/elementLabel'
import { InspectorMoreItems } from '../shared/InspectorMore'
import { FactorAnatomySummary } from './FactorAnatomy'
import { isAcceptedOlumiFigure } from '../../../domain/valueProvenance'
import {
  userValueReplacesPrior,
  USER_VALUE_REPLACES_THIS_RANGE,
} from '../../../nodes/shared/factorPriorRange'

// Quick-set presets
const QUICK_SET = {
  low:       { label: 'Low',       min: 0,   max: 0.4, description: 'Low level expected' },
  moderate:  { label: 'Moderate',  min: 0.3, max: 0.7, description: 'Moderate level expected' },
  high:      { label: 'High',      min: 0.6, max: 1.0, description: 'High level expected' },
  uncertain: { label: 'Uncertain', min: 0,   max: 1.0, description: 'Level unknown' },
} as const

type QuickSetKey = keyof typeof QUICK_SET

/** The other end of a range: the card's, else what the user typed in its box; never a default. */
function storedOrTypedEnd(stored: number | undefined, typed: string): number | null {
  if (stored != null) return stored
  const parsed = parseFloat(typed)
  return Number.isFinite(parsed) ? parsed : null
}

export const FactorExternalPanel = memo(function FactorExternalPanel({
  nodeId,
  techMode,
  summaryContext,
  onNavigate,
  /**
   * ⛔ A DUTY, NOT A PERMISSION — the same contract `FactorControllablePanel`
   * takes on. The Router no longer wraps this pane, so every control reaching a
   * mutation WITHOUT a durable carrier must sit behind this panel's own fence.
   *
   * What the opt-in buys is the prior-range editor, which DOES have one and
   * which no user could operate until now: `setPriorRange` writes
   * `data.prior` through `updateNode` (the autosave round-trip is pinned in
   * `useAutosave.analysisFieldPersist.spec.ts` — hash flips, save fires, load
   * rehydrates) AND emits `prior_range_edit` to CEE. It was mounted, wired and
   * tested, and inert, because the blanket `<fieldset disabled>` could not tell
   * a control that saves from one that does not.
   *
   * ⛔ `setDescription` is the one writer here with NO carrier, so it stays
   * fenced below. The test of a control is whether it reaches a carrier that
   * survives the next server rehydrate — never whether it sits beside one.
   */
  readOnly = false,
}: InspectorPanelProps) {
  const nodes = useSwitchFactorNodes()
  const edges = useCanvasStore(s => s.edges)
  const resultsStatus = useCanvasStore(s => s.results?.status)
  const isResultsMode = resultsStatus === 'complete'

  const node = nodeId ? nodes.find(n => n.id === nodeId) : undefined
  const mutations = useNodeMutations(nodeId ?? '')
  const displayMetadata = useNodeDisplayMetadata(nodeId ?? '', 'factor')

  /**
   * ⭐ ONE LADDER, SHARED. The tier decision used to be typed out twice in this
   * file and four more times in the two sibling factor panels — six copies of
   * `>= 0.7` / `>= 0.4` over one field. The WORDS below stay here, because they
   * differ by factor category on purpose; only the boundary moved.
   */
  const voiTier =
    displayMetadata.valueOfInformation === null
      ? null
      : investigationValueTier(displayMetadata.valueOfInformation)

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
  const hasStoredValue = unwrapInterventionValue(obs?.value).value !== null
    || unwrapInterventionValue(obs?.raw_value).value !== null
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
  /**
   * ⭐ A USER-OWNED VALUE REPLACES THIS RANGE IN THE ANALYSIS — read from the
   * card's owner, never re-derived. PLoT skips the prior for any factor carrying
   * `observed_state.value`, so while the user's value stands the role note
   * below would be false ("it is what the model treats as the factor's
   * plausible level"). The range and its controls stay visible: only the claim
   * about what the analysis DOES with it changes.
   */
  const valueReplacesRange = userValueReplacesPrior(node?.data)
  const rangeMin = typeof prior === 'object' ? (prior as Record<string, unknown>)?.range_min as number | undefined : undefined
  const rangeMax = typeof prior === 'object' ? (prior as Record<string, unknown>)?.range_max as number | undefined : undefined

  // Local drafts for tech mode editable inputs
  const [localMin, setLocalMin] = useState<string>(rangeMin != null ? rangeMin.toFixed(2) : '')
  const [localMax, setLocalMax] = useState<string>(rangeMax != null ? rangeMax.toFixed(2) : '')

  /**
   * ⭐ ONE END TYPED IS NOT A RANGE. The other end comes from the card, else
   * from the sibling box the user typed into; with neither, the typed end is
   * HELD in its box and nothing is written or sent. These handlers used to
   * complete the pair with `rangeMax ?? parsed` and `rangeMin ?? 0`, numbers
   * nobody entered, which `setPriorRange` wrote to the card and sent to Olumi
   * as the user's judgement (`priorRangeNeverInventsAnEnd.spec.tsx`).
   */
  const handleMinBlur = useCallback(() => {
    const parsed = parseFloat(localMin)
    if (isNaN(parsed)) return
    const max = storedOrTypedEnd(rangeMax, localMax)
    if (max === null) return
    setSelected(null)
    mutations.setPriorRange(parsed, max)
  }, [localMin, localMax, rangeMax, mutations])

  const handleMaxBlur = useCallback(() => {
    const parsed = parseFloat(localMax)
    if (isNaN(parsed)) return
    const min = storedOrTypedEnd(rangeMin, localMin)
    if (min === null) return
    setSelected(null)
    mutations.setPriorRange(min, parsed)
  }, [localMax, localMin, rangeMin, mutations])

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
   * ⛔ CORRECTED — THE PREMISE UNDER THIS PARAGRAPH HAS CHANGED. It read: "AND
   * NONE OF THEM MAY BE AN INSTRUCTION … On the deployed build this control is
   * mounted and INERT." That was true while `InspectorRouter` wrapped this pane
   * in its blanket `<fieldset disabled>`. It no longer does: `factor-external`
   * is an authority-owning panel and the quick-set range affordance is
   * operable, so the reason an instruction was banned here is gone.
   *
   * ⚠ THE COPY IS NOT RE-WIDENED HERE, DELIBERATELY. It was narrowed for cause
   * and re-widening it is a copy decision with its own review, not a side
   * effect of making the control reachable. What is corrected is the FACT this
   * paragraph asserts, because a later lane reading "this control is INERT"
   * would reason from something the product no longer does.
   *
   * ⚠ THIS ALSO CITED `NODE_SETTER_AUTHORITY.setPriorRange` AS A SECOND
   * AUTHORITY. That manifest was DELETED on 27 Aug 2026 (PR #886) because it
   * had zero code consumers — it RECORDED the verdict, it never MADE it. The
   * fieldset above is the whole enforcement and always was, so nothing about
   * this control's inertness changed with the deletion. These tiers state
   * what is true of the FACTOR; the role note states what the RANGE is and
   * that it cannot be set here; neither tells anyone to act.
   */
  const externalGuidance = flipEntry?.alternative_winner_label
    ? `If ${String(node.data?.label ?? 'this factor')} is high, the result changes to ${flipEntry.alternative_winner_label}.`
    : isResultsMode && displayMetadata.sensitivityRank != null
    ? 'This factor contributes significant uncertainty to your results.'
    : 'This factor is outside your control, so its level is uncertain.'

  const sourceLabel = factorValueSourceLabel(node.data, attributedTo)
  const inputLabel = getInputGroupLabel(source, (obs?.raw_value ?? obs?.value) != null, isAcceptedOlumiFigure(node.data))

  return (
    <div>
      <FactorAnatomySummary
        label={resolveElementLabel(node.data)}
        displayText={canonicalDisplayText}
        hasStoredValue={hasStoredValue}
        sourceLabel={sourceLabel}
        summaryContext={summaryContext}
      />
      {description.trim() && (
        <p className={`${typography.panelBody} text-text-body mt-2`}>{description}</p>
      )}

      <PanelGroup kind="input" label={inputLabel === GROUP_LABELS.input ? 'What you believe' : inputLabel}>
        <PrimaryControlCard>
          <div className={`${typography.panelBody} mb-2`}>How would you describe the level?</div>
          <p className={`${typography.panelMeta} text-text-light mb-2`}>
            Equally likely anywhere between the minimum and maximum.
          </p>

          {/* Quick-set buttons */}
          <div className="flex gap-1.5 flex-wrap mb-2.5">
            {(Object.keys(QUICK_SET) as QuickSetKey[]).map(key => (
              <button
                key={key}
                onClick={() => handleQuickSet(key)}
                className={`${typography.panelMeta} ${controls.selectableChip.base} ${
                  selected === key
                    ? controls.selectableChip.selected
                    : controls.selectableChip.unselected
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
                  className={`${typography.panelMeta} mt-0.5 tabular-nums ${controls.editableField}`}
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
                  className={`${typography.panelMeta} mt-0.5 tabular-nums ${controls.editableField}`}
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

            Q2 is a fact about this SURFACE. ⛔ CORRECTED: it used to read "The
            inspector is read-only … No affordance on this panel can write the
            field." Both halves are now false HERE — this panel owns its own
            fence and the quick-set range affordance writes through
            `setPriorRange`.

            Q2's honest answer is no longer "you cannot", it is "not
            necessarily": PLoT's prior pass is gated four ways and the first
            gate is silent (an `observed_state.value` present skips the prior
            with no warning), so the sentence still refuses to promise a per-run
            effect. The two questions stay named apart; only Q2's answer moved.

            ⚠ A second clause here cited "this repo's own authority manifest"
            (`NODE_SETTER_AUTHORITY.setPriorRange: 'disabled'`). It was deleted
            on 27 Aug 2026 (PR #886) as an unenforced mirror — zero code
            consumers — so the fieldset is now the only citation, which is what
            it always was in fact. Q2's claim is unchanged. Even the local write would not
            settle it: `setPriorRange` updates the store and emits
            `prior_range_edit`, which CEE persists as a typed turn FACT and
            which writes no graph.

            ⚠ DO NOT COMPRESS THIS TO ONE ABSOLUTE CLAIM. Two have been tried —
            "narrowing the range would sharpen the analysis" and "it does not
            affect analysis" — and both were false, in opposite directions,
            because each collapsed Q1 and Q2 into a single verdict. If a future
            edit can only fit one sentence, keep Q2: it is the one that governs
            what the reader is about to do.

            ⚠ NO EM-DASH. `Brief3Panels.spec.tsx` ("Em-dash enforcement")
            forbids U+2014 in rendered panel output, and it caught the first
            draft of this sentence. Note its blind spot, which is the same one
            that hid the contradiction this change fixes: it scans the
            COLLAPSED panel, so nothing inside `TechnicalDisclosure` is subject
            to it. The expanded-surface scan in this panel's own spec asserts
            it there too.

            ⭐ ONE STATE NOW HAS ITS OWN SENTENCE (22 Sep 2026). The silent
            gate above is no longer hypothetical on this panel: the Model tab
            lets a user state a point value for an external factor, CEE stamps
            it `user_override`, and from then on PLoT skips this range. In that
            state Q1's answer is "no, your value replaces it", and the role
            sentence would be false, so `valueReplacesRange` swaps it for
            `USER_VALUE_REPLACES_THIS_RANGE`. Scoped to a USER-OWNED value
            (`userValueReplacesPrior`); a model-authored value keeps the role
            sentence, which is the reported open question, not a decision here.

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
            {valueReplacesRange
              ? USER_VALUE_REPLACES_THIS_RANGE
              : <>This range is an analysis input, not a label: it is what the model treats as the factor&rsquo;s plausible level. You can set it here.</>}
          </p>
          <CitedEvidenceNote resolution={citedEvidence} />
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

      {isResultsMode && (displayMetadata.influence != null || displayMetadata.sensitivityRank != null) && (
        <StaleGuardBanner hasResults={isResultsMode}>
          <ImportanceBar
            importanceScore={displayMetadata.influence}
            sensitivityRank={displayMetadata.sensitivityRank}
            influenceProvenance={displayMetadata.influenceProvenance}
          />
        </StaleGuardBanner>
      )}

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

      <InspectorMoreItems>
        <PanelGroup kind="context">
          {canonicalDisplayText && (
            <div className={`${typography.panelMeta} text-text-light`} data-testid="factor-display-text">
              Stored as: {canonicalDisplayText}
            </div>
          )}
          <div className="mt-2 flex gap-1.5 flex-wrap">
            <span className={`${typography.panelMeta} inline-flex items-center px-2.5 py-0.5 rounded-full bg-transparent text-text-body border border-factor/30`}>
              Outside your control
            </span>
            {Boolean(node.data?.factorType) && (
              <span className={`${typography.panelMeta} inline-flex items-center px-2.5 py-0.5 rounded-full bg-transparent text-text-body border border-factor/30`}>
                {String(node.data.factorType)}
              </span>
            )}
            <span className={`${typography.panelMeta} inline-flex items-center px-2.5 py-0.5 rounded-full bg-transparent text-text-body border border-success/30`}>
              {sourceLabel}
            </span>
          </div>
          {/* This writer stays behind the same fence after moving into More. */}
          <fieldset disabled={readOnly} className="contents" data-writer-fence="description">
            {description.trim() || isEditingDescription ? (
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
                className={`${typography.panelBody} ${controls.editableTextarea}`}
              />
            ) : !readOnly ? (
              <button type="button" className={`${typography.panelMeta} text-text-light hover:text-info`} onClick={() => setIsEditingDescription(true)}>
                Add a description
              </button>
            ) : null}
          </fieldset>
          {isResultsMode && displayMetadata.valueOfInformation !== null && voiTier !== null && (
            <div className="mt-2">
              <DataBar
                value={displayMetadata.valueOfInformation}
                label={INLINE_LABELS.investigationValue}
                colour="info"
                trailingLabel={INVESTIGATION_VALUE_LABEL[voiTier]}
              />
              <div className={`${typography.panelMeta} text-text-light mt-1`}>{INLINE_LABELS.investigationValue}</div>
              <p className={`${typography.panelMeta} text-text-light mt-1`}>{INVESTIGATION_VALUE_INVITATION.evidence}</p>
            </div>
          )}
          <FactorTurningPointInspectorLine nodeId={nodeId} />
          <p className={`${typography.panelBody} text-text-body mt-3`} data-testid="factor-external-guidance">
            {externalGuidance}
          </p>
        </PanelGroup>

      {/* ── Expert-only model detail ──────────────────────────── */}
      <TechnicalDisclosure visible={techMode}>
        <FactorExternalEditor nodeId={nodeId} />
      </TechnicalDisclosure>
      </InspectorMoreItems>
    </div>
  )
})

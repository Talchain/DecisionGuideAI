import { useSwitchFactorNodes } from '../../../hooks/useSwitchFactorNodes'
import { InlineRerunPrompt } from '../shared/InlineRerunPrompt'
/**
 * OptionPanel — Inspector panel for option nodes (spec §6, v6.2 three-group layout)
 * Groups: Context → Input (what this option changes) → Impact (post-analysis) → Connections
 * Primary editing surface: intervention inputs MUST remain editable.
 */

import { memo, useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { Sparkles } from 'lucide-react'
import { useCanvasStore } from '../../../store'
import { parseDraftingNotes, composeDescription } from '../draftingNote'
import type { NodeType, OptionNodeData } from '../../../domain/nodes'
import { resolveNodeTypeLiteral } from '../../../domain/nodes'
import { InspectorCoaching } from '../shared/InspectorCoaching'
import { OptionStatusControl } from '../shared/OptionStatusControl'
import { typography } from '../../../../styles/typography'
import { controls } from '../../../../styles/controls'
import { useNodeMutations } from '../useInspectorMutations'
import { useOptionInterventionCommit } from '../shared/useOptionInterventionCommit'
import { resolveOptionTargetDisplayFrame, resolveOptionTargetEntryFrame } from '../shared/optionTargetEntry'
import {
  GROUP_LABELS,
  DESCRIPTION_PLACEHOLDERS,
  EMPTY_STATES,
  OPTION_STRINGS,
} from '../inspectorStrings'
import { interventionIsUserMaterialUnverified, unwrapInterventionValue } from '../../../utils/labelUtils'
import { factorDisplayText } from '../../../../utils/formatFactorDisplayValue'
import { resolveOptionIsBaseline, baselineGuessBarred, baselineOptionsOf } from '../../../utils/baselineDetection'
import { PanelGroup } from '../shared/PanelGroup'
import { PrimaryControlCard } from '../shared/PrimaryControlCard'
import { EmptyDescriptionPrompt } from '../shared/EmptyDescriptionPrompt'
import { ConnectionRow } from '../shared/ConnectionRow'
import { InterventionRow } from '../shared/InterventionRow'
import { InspectorConnectPicker } from '../shared/InspectorConnectPicker'
import { InspectorSummary } from '../shared/InspectorSummary'
import { InspectorMoreItems } from '../shared/InspectorMore'
import { classifyInterventionProvenance } from '../../../domain/valueProvenance'
import { StaleGuardBanner } from '../shared/StaleGuardBanner'
import { TechnicalDisclosure } from '../shared/TechnicalDisclosure'
import type { InspectorPanelProps } from '../types'
import { COACHING } from '../coachingConfig'
import { OptionAdvancedEditor } from '../editors/OptionAdvancedEditor'
import { ResultsLink } from '../shared/ResultsLink'
import { resolveEdgeSignedStrengthDisplay } from '../../../domain/edgeValueProvenance'
import type { EdgeValueDisplay } from '../../../domain/edgeValueProvenance'
import { resolveElementLabel, resolveFirstStatedLabel } from '../../../domain/elementLabel'
import {
  buildOptionTargetRow,
  optionTargetReading,
  readingShowsModelValue,
  resolveBaselineOptionReference,
  resolveOptionTargets,
  analysisViewIsStale,
  type CeeOptionTargetsLike,
  type TargetNodeLike,
} from '../../../nodes/shared/optionTargetDisplay'

/**
 * ⭐ THE ROUTE TO A TARGET WHOSE BOX IS NOT IN THE DEFAULT VIEW (DEFECT 5 (b)).
 *
 * A target that reads "£60k" or "59 GBP/month" keeps its box under technical
 * detail, because the box edits the MODEL's 0–1 value and "0.295 model value"
 * beside "59 GBP/month" was the witnessed defect (served `a4434670`). The
 * notice above says the factor targets are changeable "below"; for these rows
 * this sentence is what makes that true — it names the control that opens the
 * box, by the accessible name `InspectorShell` gives it.
 *
 * ⚠ ONCE, ABOVE THE LIST, never per row — the factor inventory's ruling on
 * this same panel: a sentence repeated against every factor turns the
 * inventory into a wall of the same message.
 *
 * ⭐ THE INPUT-PARSING PATH NOW ACCEPTS A TARGET IN ITS READING'S UNIT
 * (`optionTargetEntry`: `80000`, `80,000`, `£80,000`, `80k`), so a row whose
 * factor supports that frame has its box in the default view, and
 * `inputMatchesReading` is flipped for it below. This sentence remains ONLY for
 * the rows that frame cannot convert — a unit with no usable cap, an anchor that
 * disagrees with the cap, a direction-only reading — whose box is still the
 * model-scale one.
 */
export const OPTION_TARGET_EDIT_ROUTE_NOTE =
  "Targets shown without a box are changed under Show technical detail (</>), where they are entered on the model's internal 0–1 scale."

export const OptionPanel = memo(function OptionPanel({
  nodeId,
  techMode,
  onNavigate,
  /**
   * ⛔ A DUTY, NOT A PERMISSION — see `types.ts`. The Router has stopped
   * wrapping this panel so navigation, disclosure and coaching can work; in
   * exchange this panel fences EVERY control that reaches `mutations.*` behind
   * its own disabled fieldset. It never enables a write.
   *
   * ⚠ THE FENCE IS WRITTEN AGAINST THE COMPONENT TREE, NOT THIS FILE. Two of
   * the five writers live in `OptionAdvancedEditor`, mounted through
   * `TechnicalDisclosure` at the bottom of this component — a review caught
   * them after I enumerated only the `mutations.*` calls spelled here and
   * called that "every control in OptionPanel". It was not.
   */
  readOnly = false,
  summaryContext,
}: InspectorPanelProps) {
  const nodes = useSwitchFactorNodes()
  const edges = useCanvasStore(s => s.edges)
  /** The card's first source for an option's targets — read here for the SAME reason (DEFECT 5). */
  const ceeAnalysisReady = useCanvasStore(s => s.ceeAnalysisReady)
  /** CEE's baseline flags: the live `analysis_ready`, else the cold read's. */
  const baselineOptionsForPanel = useCanvasStore(s => baselineOptionsOf(s))
  /** The card's rule (`analysisViewIsStale`): on a stale analysis view the saved numbers stand. */
  const analysisViewStale = useCanvasStore(s => analysisViewIsStale(s.ceeAnalysisReady, s.lastServerGraphHash))
  const resultsStatus = useCanvasStore(s => s.results?.status)
  const isResultsMode = resultsStatus === 'complete'
  const optionComparison = useCanvasStore(s => s.results?.report?.option_comparison)
  const storyHeadlines = useCanvasStore(s => s.results?.report?.story_headlines)
  const node = nodeId ? nodes.find(n => n.id === nodeId) : undefined
  const mutations = useNodeMutations(nodeId ?? '')

  /**
   * ⭐⭐ AN EFFECT YOU SET HERE NOW REACHES THE MODEL.
   *
   * Measured on the founder's board (bundle `95b92672`, 21 Sep): **3 of his 5
   * options carried ZERO interventions**, and the analysis could not tell them
   * apart. This control was the reason. It called
   * `mutations.setIntervention` — a pure `updateNode`, **0 dispatch symbols** —
   * so an effect the reader set landed in their browser and nowhere else, while
   * the SAME edit made in the Model tab reached CEE through
   * `useModelEditAuthority.proposeOptionIntervention`.
   *
   * ⚠⚠ A CLAIM OF MINE THAT WAS HERE AND IS WITHDRAWN. It read: *"AND THE
   * CONTROL IS LIVE, WHICH IS WHAT MAKES IT A DEFECT RATHER THAN A FENCE …
   * `InspectorRouter:542` passes `readOnly` only on the NON-authority branch …
   * so `readOnly` defaults false here."* **That is false.** `:542` is
   * `<PanelComponent key={nodeId} {...panelProps} readOnly />` — a BARE
   * attribute, i.e. `readOnly={true}`, on the AUTHORITY branch. The panel opted
   * out of the Router's blanket in order to fence its OWN writers, which is the
   * opposite of what I read it as (CLAUDE.md trap 21: opting in to fencing
   * yourself is not opting in to writing). `InterventionRow` receives
   * `disabled={readOnly}` at :532 and, when disabled, renders the value as TEXT
   * rather than an input — so today a reader cannot edit an option effect from
   * this panel at all, and `OptionPanel.readOnlyFence.spec.tsx` pins exactly
   * that.
   *
   * ⭐ AND THE FENCE IS NOW LIFTED FOR THIS ONE WRITER — see the `disabled`
   * prop below, which carries the argument in full. In short:
   * `FactorControllablePanel` is in the same `AUTHORITY_OWNING_PANELS` set and
   * fences only its description and its advanced editor, both local-only
   * writers, while its VALUE control stays live because `proposeFactorValue`
   * reaches the server. Fence the writers with no carrier; leave live the ones
   * that reach the model. This row had no carrier; it has one now.
   *
   * ⛔ PER WRITER, NEVER PER PANEL. The other three fences are untouched, and
   * `OptionPanel.readOnlyFence.spec.tsx` asserts every one of them is still
   * disabled — so unfencing the panel wholesale, which is what the Router's
   * blanket did, REDs rather than passing as a generalisation of this.
   *
   * ⛔ Compare `factor-observable`, which is absent from the set entirely and
   * is inert for a different reason — no carrier at all. That one is not a
   * defect and must not be "fixed" by this pattern.
   *
   * ⚠ THE CARRIER WAS ALREADY BUILT AND THIS PANEL WAS NOT ASKING FOR IT.
   * `option_intervention_edit` (schemas 0.54.0) ships end to end —
   * `conversation/optionInterventionEdit.ts`, `v5/buildPayload.ts:1143`, and the
   * authority's own guards. Nothing new is invented here; one surface is
   * pointed at the owner the other already used.
   *
   * ⛔ NO LOCAL STORE WRITE, and that is the authority's ruling, not a choice
   * made here: *"the goal draft never changes the store before a real applied
   * response"*. The applied `graph_patch` owns the write.
   *
   * ⭐ SO THE ROW NEEDS A PENDING VALUE OF ITS OWN — the same shape `EdgePanel`
   * uses for `localStrength`. Without it the number would visibly snap back to
   * its old value on every edit, which reads as the control being broken and is
   * a worse lie than the one this fixes.
   */
  const {
    commit: commitIntervention,
    pending: pendingIntervention,
    notice: interventionNotice,
    unapplied: unappliedIntervention,
    dismiss: dismissIntervention,
  } = useOptionInterventionCommit(nodeId ?? null)
  // ROADMAP 2.1204 — the drafter's rephrase-absorption notes are separated
  // from the user's description. CEE APPENDS `\n\n<note>` per absorbed twin
  // (option-rephrase-merge.ts:459-462), so before this split they rendered
  // inside the editable textarea: unattributed (indistinguishable from the
  // user's own prose) and destroyed the moment the user typed over them.
  // `notes` render as attributed lines below; only `body` is editable, and
  // every commit recomposes the two in the producer's format.
  const rawDescription = node?.data?.description as string | undefined
  const { notes: draftingNotes, body: descriptionBody } = useMemo(
    () => parseDraftingNotes(rawDescription),
    [rawDescription],
  )

  // Description — EmptyDescriptionPrompt pattern
  const descriptionRef = useRef<HTMLTextAreaElement>(null)
  const [description, setDescription] = useState(descriptionBody)

  /**
   * ⭐⭐ THE SAME WRONG-OPTION-VALUE FAMILY AS #1343, ONE LEVEL UP — AND I FIXED
   * THE ROW WITHOUT LOOKING AT THE PANEL AROUND IT.
   *
   * `description` is seeded ONCE at mount and never synced, so any change to
   * `descriptionBody` that does not come from this textarea left the buffer
   * showing text the model no longer holds. `draftingNotes` beside it IS derived
   * and updates, so the two came apart: one option's description under another's
   * notes.
   *
   * TWO CAUSES, and they need different instruments — exactly as they did for the
   * intervention row:
   *  1. SWITCHING OPTIONS. An identity problem, fixed at the CALLER: the Router
   *     now keys the panel by `nodeId`, so a different node is a different
   *     instance rather than the same one wearing new props.
   *  2. THE SAME option's description changing underneath us — a chat edit, an
   *     undo, a CEE absorption note. No key change can catch that; this effect
   *     does.
   *
   * GUARDED ON FOCUS, so a re-seed cannot eat what the user is mid-way through
   * typing. `document.activeElement` is the check because it is the same question
   * the browser is already answering.
   */
  useEffect(() => {
    if (descriptionRef.current && document.activeElement === descriptionRef.current) return
    setDescription(descriptionBody)
  }, [descriptionBody])
  const [isEditingDescription, setIsEditingDescription] = useState(false)

  const commitDescription = useCallback(
    (next: string) => mutations.setDescription(composeDescription(draftingNotes, next)),
    [mutations, draftingNotes],
  )

  const panelRef = useRef<HTMLDivElement>(null)
  const [focusTarget, setFocusTarget] = useState<string | null>(null)

  // Interventions
  // Map values may be plain numbers (legacy/analysis_ready) or
  // UIInterventionValue/CEEInterventionV3 objects ({ value, source, ... });
  // unwrapInterventionValue normalises both. Malformed recorded entries are
  // dropped. A linked factor with no entry gets the same row with no value;
  // absence stays distinct from a saved zero.
  const interventionRows = useMemo(() => {
    const raw = ((node?.data as Record<string, unknown>)?.interventions as Record<string, unknown> | undefined) ?? {}
    const linkedWithoutValues = [...new Set(edges
      .filter(e => e.source === nodeId)
      .map(e => e.target))]
      .filter(factorId => !Object.prototype.hasOwnProperty.call(raw, factorId) && nodes.some(n =>
        n.id === factorId && resolveNodeTypeLiteral(n) === 'factor',
      ))
    const entries = [
      ...Object.entries(raw),
      ...linkedWithoutValues.map(factorId => [factorId, undefined] as const),
    ]
    return entries.flatMap(([factorId, rawValue]) => {
      /*
       * ⭐⭐ `source` IS THE THIRD NAME HERE, AND ITS ABSENCE WAS THE WHOLE
       * DEFECT (B1-b). #827 made `unwrapInterventionValue` carry the producer's
       * stamp; this surface did not take it, so `InterventionRow` had no
       * provenance to show and rendered an invented target identically to a
       * number the user wrote — on the Inspector, which is where the defect was
       * witnessed. One destructure is the entire carry: the classification and
       * the copy live at the row, per surface, as `valueProvenance`'s own header
       * prescribes.
       */
      const { value, displayValue, source } = unwrapInterventionValue(rawValue)
      if (value == null && !linkedWithoutValues.includes(factorId)) return []
      const factorNode = nodes.find(n => n.id === factorId)
      const obs = (factorNode?.data as Record<string, unknown>)?.observedState as Record<string, unknown> | undefined
      const displayFrame = resolveOptionTargetDisplayFrame(factorNode?.data, rawValue)
      // Defensive unwrap: observedState.value / .raw_value should be plain
      // numbers, but legacy/wrapped shapes ({ value: 0.5, unit: 'scale' })
      // would otherwise flow into InterventionRow as the baseline prop and
      // render as "[object Object]" via .toLocaleString(). Same helper as
      // the intervention value above — generic numeric defense.
      return [{
        factorId,
        factorLabel: resolveElementLabel(factorNode?.data),
        baseline: displayFrame.observedValue,
        rawBaseline: displayFrame.observedRawValue,
        /*
         * ⚠ CARRIED SO THE ROW CAN DECLINE TO CLAIM, NEVER SO IT CAN DISPLAY.
         * `observed_state.baseline` is a real contract field whose ROLE AND
         * SCALE ARE UNDECLARED (`ObservedStateSchema` gives it no doc comment
         * while its neighbours each carry paragraphs of producer/consumer/
         * absence rules). The row uses it only to detect that its comparison
         * reference is contested and to stop showing a percentage against one.
         * It is never rendered — see `recordedBaseline` in InterventionRow.
         */
        recordedBaseline: unwrapInterventionValue(obs?.baseline).value ?? undefined,
        unit: displayFrame.unit,
        cap: displayFrame.cap,
        value: value ?? undefined,
        displayValue: displayValue ?? undefined,
        /*
         * ⚠ THE INTERVENTION'S OWN STAMP, NOT THE OPTION NODE'S, and the two
         * genuinely disagree: on the witnessed draw option `682a7e2d` is
         * `provenance: 'from_brief'` and carries an INVENTED target beside a
         * brief-extracted one. Reading it off the option would be right on two
         * of that draw's three options and wrong on the third, while looking
         * correct in every screenshot anyone happened to take (trap 19).
         *
         * ⚠ `undefined`, NEVER a placeholder string. "unknown" or "" would be a
         * value the row then has to special-case, and the row that forgets to is
         * the one that renders a guess. Absent is the fact.
         */
        provenanceSource: source ?? undefined,
        userMaterialUnverified: interventionIsUserMaterialUnverified(rawValue),
      }]
    })
  }, [node?.data, nodes, edges, nodeId])

  // Readings and summaries describe recorded targets only, never empty boxes.
  const interventions = useMemo(() => interventionRows.filter(
    (iv): iv is typeof iv & { value: number } => iv.value !== undefined,
  ), [interventionRows])
  const linkedWithoutValueCount = interventionRows.length - interventions.length
  /**
   * EDIT-UX 3b-i (Codex head review P1): an EMPTY linked target takes the SAME guard as a set one. Its box is shown in the
   * default view only when the entry frame is the factor's own units; a model-scale (0–1) entry stays under technical
   * detail, labelled, with the route note — otherwise "0.5" meant as £0.50 would be recorded as the model value 0.5.
   */
  const emptyTargetTakesUserUnits = useCallback((iv: { unit?: string; cap?: number; baseline?: number; rawBaseline?: number }) =>
    resolveOptionTargetEntryFrame({
      unit: iv.unit,
      cap: iv.cap,
      observedValue: iv.baseline,
      observedRawValue: iv.rawBaseline,
    }).kind === 'user_units', [])

  // After linking, focus only a target entered in the factor's own units.
  // Model-scale targets keep their technical-detail route note and receive no focus.
  useEffect(() => {
    if (focusTarget === null) return
    const target = interventionRows.find(iv => iv.factorId === focusTarget)
    if (!target) return
    if (emptyTargetTakesUserUnits(target)) {
      const row = [...(panelRef.current?.querySelectorAll<HTMLElement>('[data-testid]') ?? [])]
        .find(element => element.dataset.testid === `inspector-intervention-${focusTarget}`)
      row?.querySelector<HTMLInputElement>('input')?.focus()
    }
    setFocusTarget(null)
  }, [focusTarget, interventionRows, emptyTargetTakesUserUnits])

  // Set of already-intervened factor IDs for the picker and connection filter
  const interventionIds = useMemo(() => {
    const raw = (node?.data as Record<string, unknown>)?.interventions as Record<string, unknown> | undefined
    return new Set(raw ? Object.keys(raw) : [])
  }, [node?.data])

  // Non-intervention outbound connections. Excludes edges to the decision
  // parent (implicit organisational link) and to factors already shown in
  // Input group as InterventionRows (avoids redundant display).
  const outboundConnections = useMemo(() => {
    return edges
      .filter(e => e.source === nodeId)
      .map(e => {
        const tgt = nodes.find(n => n.id === e.target)
        if (!tgt) return null
        const kind = (tgt.type || tgt.data?.kind || 'factor') as NodeType
        if (kind === 'decision') return null
        if (interventionIds.has(e.target) || interventionRows.some(iv => iv.factorId === e.target)) return null
        return {
          edgeId: e.id,
          nodeId: e.target,
          nodeKind: kind,
          label: resolveElementLabel(tgt.data),
          strength: resolveEdgeSignedStrengthDisplay(e.data as Record<string, unknown> | undefined),
        }
      })
      .filter(Boolean) as Array<{
        edgeId: string
        nodeId: string
        nodeKind: NodeType
        label: string
        strength: EdgeValueDisplay
      }>
  }, [edges, nodes, nodeId, interventionIds, interventionRows])

  /**
   * ⛔⛔ DOES THIS OPTION HAVE ANY CONNECTION AT ALL — a DIFFERENT question from
   * "does it have one this group has not already shown", and conflating them is
   * the L-40 contradiction.
   *
   * `outboundConnections` above is CORRECTLY narrow: it deliberately drops the
   * decision parent (organisational) and every factor already rendered as an
   * InterventionRow (redundant). So it is empty for a perfectly ordinary,
   * fully-connected option — and the group then printed the FLAT DENIAL,
   * "No connections yet.", a few centimetres under six connections it had just
   * listed itself.
   *
   * WITNESSED on deployed `b31517a1`, guest, saved example: `opt_rudderstack`
   * holds **5 edges and 6 interventions** in the persisted graph, the panel
   * listed all six under "What this option changes", and then said it had none.
   *
   * ⭐ `EMPTY_STATES.noConnectionsFlat` CARRIES THE RULING THAT FORBIDS THIS,
   * in its own docblock: *"rendered by panels that were simultaneously showing
   * connections the user could see on the canvas. Now one constant, and every
   * panel that shows it must first prove there is genuinely nothing to show."*
   * This panel proved only that there is nothing MORE to show. `DecisionPanel`
   * was repaired for the same class (review D3, "it was outbound-only"); this is
   * the sibling that repair did not reach.
   */
  const hasAnyConnection = useMemo(
    () => edges.some(e => e.source === nodeId || e.target === nodeId),
    [edges, nodeId],
  )

  // Controllable factors available to add
  const controllableFactors = useMemo(() => {
    return nodes
      .filter(n => resolveNodeTypeLiteral(n) === 'factor'
        && n.data?.category === 'controllable' && n.id !== nodeId
        && !interventionIds.has(n.id) && !interventionRows.some(iv => iv.factorId === n.id))
      .map(n => {
        // The card's own reader (`factorDisplayText`), so the add list says what the
        // factor card says: "£0", "$10,000 / year". It read the deprecated
        // `formatFactorValue`, which printed "GBP 0" (Paul's test, 28 Sep).
        const valueDisplay = factorDisplayText(n.data as Record<string, unknown>, resolveElementLabel(n.data))
        return {
          id: n.id,
          label: resolveElementLabel(n.data),
          valueDisplay,
        }
      })
  }, [nodes, nodeId, interventionIds, interventionRows])
  const candidateFactorIds = useMemo(() => controllableFactors.map(f => f.id), [controllableFactors])
  const candidateValueDisplays = useMemo(
    () => new Map(controllableFactors.map(f => [f.id, f.valueDisplay])),
    [controllableFactors],
  )

  // All option results for comparison bars
  const allOptions = useMemo(() => {
    if (!optionComparison || !Array.isArray(optionComparison)) return []
    return (optionComparison as Array<{ option_id: string; label?: string }>).map(o => ({
      id: o.option_id,
      // Two legitimate name sources, then honest absence — never the id. The
      // graph node's own label wins; the analysis payload's `label` is the
      // fallback for an option the graph no longer holds; `o.option_id` is NOT
      // a third source, it is a database key and has been dropped.
      label: resolveFirstStatedLabel(nodes.find(n => n.id === o.option_id)?.data, { label: o.label }),
      isCurrent: o.option_id === nodeId,
    }))
  }, [optionComparison, nodes, nodeId])

  const headline = storyHeadlines && typeof storyHeadlines === 'object' && nodeId
    ? (storyHeadlines as Record<string, string>)[nodeId]
    : undefined

  // Baseline indication — mirrors OptionNode.tsx. Explicit `is_baseline` wins;
  // regex fallback only fires when the flag is absent (null/undefined).
  const optionData = node?.data as OptionNodeData | undefined
  const arOptionsForBaseline = baselineOptionsForPanel
  const isBaselineOption = resolveOptionIsBaseline(
    optionData,
    arOptionsForBaseline?.find(o => o.id === nodeId),
    // POM-3: the keyword guess may not mint a second baseline on a board that declares one.
    baselineGuessBarred(nodes, arOptionsForBaseline),
  )

  /**
   * ⭐⭐ EACH ROW'S READING IS THE CARD'S, BUILT BY THE CARD'S OWN CODE (DEFECT 5
   * + ED #63 §9).
   *
   * Served `a4434670`: the card said "59 GBP/month" / "£60k" and this panel
   * said "0.295 model value" / showed the input "0.5". The card resolves a
   * target from `ceeAnalysisReady` (joined with `intervention_details`, a bare
   * producer number never erasing the node's receipt-stamped `source`) and
   * formats it through `formatInterventionTargetText`; this panel read
   * `node.data.interventions` alone and had only `display_value` for words —
   * which a target the user has set never carries.
   *
   * So the rows now ask the card's functions, moved to `optionTargetDisplay`
   * for exactly this, rather than a third copy of the rule (trap 12):
   *  · the TARGET — the card's resolution, falling back to this node's own
   *    entry only for a factor the CEE map does not list;
   *  · the READING — the card's row builder, with the card's baseline
   *    reference, so a direction-only row says what the card says;
   *  · the SOURCE — the same resolved stamp the card marks, classified here in
   *    this surface's own register (`INSPECTOR_INTERVENTION_PROVENANCE_LABEL`).
   *
   * ⚠ THE INPUT'S NUMBER IS STILL `iv.value` — this node's own record, the
   * value the commit path compares against — and the default view shows the
   * box only when the reading visibly prints that number
   * (`readingShowsModelValue`), OR when the field takes amounts in the
   * factor's own unit (`resolveOptionTargetEntryFrame` → `user_units`, the
   * same frame, from the same props, the row resolves) and the reading is a
   * figure for that same record. A stale CEE value that disagrees with the
   * node therefore still moves the box behind technical detail rather than
   * putting two different numbers side by side.
   */
  const targetReadings = useMemo(() => {
    const out = new Map<string, {
      reading: string
      readingIsTarget: boolean
      inputMatchesReading: boolean
      provenanceSource: string | undefined
      userMaterialUnverified: boolean
    }>()
    if (!nodeId || !node) return out
    const ceeOptions = (ceeAnalysisReady as { options?: CeeOptionTargetsLike[] } | null | undefined)?.options
    const ceeOpt = ceeOptions?.find(o => o.id === nodeId)
    const resolved = resolveOptionTargets(node.data as Record<string, unknown> | undefined, ceeOpt, { viewStale: analysisViewStale })
    const baselineReference = isBaselineOption
      ? null
      : resolveBaselineOptionReference(nodes as ReadonlyArray<TargetNodeLike>, ceeOptions, nodeId)
    for (const iv of interventions) {
      const target = resolved.get(iv.factorId) ?? {
        value: iv.value,
        displayValue: iv.displayValue ?? null,
        source: iv.provenanceSource ?? null,
        userMaterialUnverified: iv.userMaterialUnverified,
      }
      const factorNode = nodes.find(n => n.id === iv.factorId) as TargetNodeLike | undefined
      const row = buildOptionTargetRow({
        factorId: iv.factorId,
        target,
        factorNode,
        baselineReference,
      })
      // DIFF N7 (28 Sep): never a bare 0–1 figure where the factor card shows a
      // word — the card's band word, in the tier-reading form (`optionTargetReading`).
      const reading = optionTargetReading(row, factorNode?.data)
      const fieldTakesTheReadingsUnit =
        row.target !== '' &&
        target.value === iv.value &&
        resolveOptionTargetEntryFrame({
          ...resolveOptionTargetDisplayFrame(factorNode?.data, target),
        }).kind === 'user_units'
      out.set(iv.factorId, {
        reading,
        readingIsTarget: row.target !== '',
        inputMatchesReading: fieldTakesTheReadingsUnit || readingShowsModelValue(reading, iv.value),
        provenanceSource: target.source ?? undefined,
        userMaterialUnverified: target.userMaterialUnverified === true,
      })
    }
    return out
  }, [nodeId, node, nodes, ceeAnalysisReady, interventions, isBaselineOption, analysisViewStale])

  /** The option's own name, for each target box's accessible name. */
  const optionAccessibleLabel = resolveElementLabel(node?.data)
  const firstTarget = interventions[0]
  const firstReading = firstTarget ? targetReadings.get(firstTarget.factorId) : undefined
  const firstTargetProvenance = classifyInterventionProvenance(
    firstReading ? firstReading.provenanceSource : firstTarget?.provenanceSource,
    { userMaterialUnverified: firstReading ? firstReading.userMaterialUnverified : firstTarget?.userMaterialUnverified },
  )
  const summaryChip = firstTargetProvenance?.kind === 'brief'
    ? 'brief'
    : firstTargetProvenance?.kind === 'ai' || firstTargetProvenance?.kind === 'accepted'
      ? 'olumi'
      : firstTargetProvenance?.userOwned ? 'user' : null
  const summarySentence = firstTarget
    // EDIT-UX: name WHAT it changes; each target's value is the row directly below.
    // Restating the reading here repeated the factor's name ("Sets X to X active").
    ? interventions.length === 1
      ? `Changes ${firstTarget.factorLabel}.`
      : interventions.length === 2
        ? `Changes 2 factors: ${firstTarget.factorLabel} and ${interventions[1].factorLabel}.`
        : `Changes ${interventions.length} factors: ${firstTarget.factorLabel}, ${interventions[1].factorLabel} and ${interventions.length - 2} more.`
    : linkedWithoutValueCount > 0
      ? OPTION_STRINGS.linksWithoutValues
        .replace('{count}', String(linkedWithoutValueCount))
        .replace('{s}', linkedWithoutValueCount === 1 ? '' : 's')
      : EMPTY_STATES.noInterventions

  if (!nodeId || !node) return null

  return (
    <div ref={panelRef}>
      <div data-testid={!firstTarget && linkedWithoutValueCount > 0 ? 'option-links-without-values' : undefined}>
        <InspectorSummary sentence={summarySentence} chip={summaryChip} />
      </div>
      {summaryContext}
      <OptionStatusControl optionId={nodeId} data={node.data} />
      {/* ── Context group ─────────────────────────────────────── */}
      {(isBaselineOption || draftingNotes.length > 0 || descriptionBody) && (
      <PanelGroup kind="context" label={GROUP_LABELS.context}>
        {isBaselineOption && (
          <div className="mb-2" data-testid="option-baseline-badge">
            <span className={`${typography.panelMeta} inline-flex items-center px-2.5 py-0.5 rounded-full bg-transparent text-text-body border border-panel-border`}>
              Baseline option
            </span>
          </div>
        )}

        {/* ROADMAP 2.1204 — the absorption disclosure, attributed. The sentence
            is the wire's, verbatim; the attribution is what tells the reader a
            drafter wrote it rather than them. Option panel only: no other node
            type carries a drafter absorption note. */}
        {draftingNotes.length > 0 && (
          <div
            className="mb-2 flex items-start gap-1.5"
            data-testid="option-drafting-note"
          >
            <Sparkles size={12} className="text-info mt-0.5 shrink-0" aria-hidden="true" />
            <p className={`${typography.panelMeta} text-text-light`}>
              <span className="text-text-body">
                {OPTION_STRINGS.draftingNoteAttribution}
              </span>
              {' — '}
              {draftingNotes.join('; ')}
            </p>
          </div>
        )}

        {descriptionBody && (
          <p
            className={`${typography.panelBody} text-text-body whitespace-pre-wrap m-0`}
            data-testid="option-description-readonly"
          >
            {descriptionBody}
          </p>
        )}
      </PanelGroup>
      )}

      <InspectorMoreItems>
        {/* The description writer keeps its own authority fence after moving. */}
        <fieldset disabled={readOnly} className="contents" data-writer-fence="description">
          {!readOnly && (description || isEditingDescription ? (
            <textarea
              ref={descriptionRef}
              value={description}
              onChange={e => setDescription(e.target.value)}
              onBlur={() => {
                commitDescription(description)
                if (!description.trim()) setIsEditingDescription(false)
              }}
              autoFocus={isEditingDescription && !description}
              placeholder={DESCRIPTION_PLACEHOLDERS.option}
              rows={2}
              maxLength={500}
              className={`${typography.panelBody} ${controls.editableTextarea}`}
            />
          ) : (
            <EmptyDescriptionPrompt
              placeholder={DESCRIPTION_PLACEHOLDERS.option}
              onStartEditing={() => setIsEditingDescription(true)}
            />
          ))}
        </fieldset>
      </InspectorMoreItems>

      {/* ── Input group (what this option changes) ─────────────── */}
      <PanelGroup kind="input" label={GROUP_LABELS.whatThisChanges}>
        <PrimaryControlCard>
          {!techMode && interventionRows.some(iv => (iv.value === undefined
            ? !emptyTargetTakesUserUnits(iv)
            : targetReadings.get(iv.factorId)?.inputMatchesReading === false)) && (
            <p
              className={`${typography.panelMeta} text-text-light mt-0 mb-1.5`}
              data-testid="option-target-edit-route"
            >
              {OPTION_TARGET_EDIT_ROUTE_NOTE}
            </p>
          )}
          {interventionRows.length > 0 && (
            interventionRows.map(iv => (
              <InterventionRow
                /*
                 * ⭐⭐ THE KEY IS THE ENTITY'S IDENTITY, AND THE ENTITY IS
                 * OPTION + FACTOR.
                 *
                 * Keyed by `factorId` alone, React reconciled the row for
                 * Option A onto Option B whenever both intervened on the same
                 * factor — same key, same instance, and `InterventionRow` seeds
                 * its editable draft ONCE at mount. So switching options left
                 * the input showing the previous option's number, and a blur
                 * would have written it to the new one.
                 *
                 * The contract says this in terms: an intervention "is a
                 * different entity living at `/nodes/<option>/data/interventions/
                 * <factor>`", minted precisely because collapsing it with the
                 * factor "puts two questions under one name" and produces a
                 * wrong-entity write. The key now carries both halves.
                 */
                key={`${nodeId}:${iv.factorId}`}
                factorId={iv.factorId}
                factorLabel={iv.factorLabel}
                baseline={iv.baseline}
                rawBaseline={iv.rawBaseline}
                /* ⚠ BUILT AT :172 AND, UNTIL THIS LINE, NEVER FORWARDED. The
                   memo carried `recordedBaseline` and the call site did not pass
                   it, so `referenceContested` was permanently false through the
                   real chain and the row went on showing a percentage against a
                   contested reference — the exact defect this PR exists to
                   close, alive behind a green unit suite. Every direct-render
                   test passed because they hand the prop in themselves; only the
                   mounted InspectorModal test could see it, and it did. */
                recordedBaseline={iv.recordedBaseline}
                currentValue={
                  pendingIntervention?.factorId === iv.factorId
                    ? pendingIntervention.value
                    : iv.value
                }
                displayValue={iv.displayValue}
                unit={iv.unit}
                cap={iv.cap}
                /* The card's resolved stamp — `undefined` INCLUDED, so a target
                   the card marks "no source" is never given this node's stamp
                   instead. The node's own stamp is the fallback only when no
                   reading was built at all. */
                provenanceSource={
                  targetReadings.has(iv.factorId)
                    ? targetReadings.get(iv.factorId)!.provenanceSource
                    : iv.provenanceSource
                }
                userMaterialUnverified={
                  targetReadings.has(iv.factorId)
                    ? targetReadings.get(iv.factorId)!.userMaterialUnverified
                    : iv.userMaterialUnverified
                }
                reading={iv.value === undefined
                  ? `${iv.factorLabel} to …`
                  : targetReadings.get(iv.factorId)?.reading ?? iv.displayValue ?? ''}
                readingIsTarget={targetReadings.get(iv.factorId)?.readingIsTarget ?? true}
                inputMatchesReading={iv.value === undefined
                  ? emptyTargetTakesUserUnits(iv)
                  : (targetReadings.get(iv.factorId)?.inputMatchesReading ?? false)}
                optionLabel={optionAccessibleLabel}
                /* ⭐ A value that did not land stays on ITS row, marked, until
                   dismissed — bound by factor identity, never by position. */
                unapplied={
                  unappliedIntervention?.factorId === iv.factorId ? unappliedIntervention : null
                }
                onDismissUnapplied={dismissIntervention}
                onChange={v => commitIntervention(iv.factorId, v)}
                onNavigate={() => onNavigate(iv.factorId)}
                /**
                 * ⭐⭐ THE ONE WRITER ON THIS PANEL WITH A SERVER CARRIER, AND
                 * THEREFORE THE ONE THAT IS NOT FENCED.
                 *
                 * This is the estate's own rule, stated by its own code rather
                 * than invented here. `FactorControllablePanel` is in the same
                 * `AUTHORITY_OWNING_PANELS` set and receives the same
                 * `readOnly`; it fences exactly two things — its description
                 * and its advanced editor, both local-only writers — and
                 * leaves its VALUE control live, because `proposeFactorValue`
                 * reaches the server. Fence the writers with no carrier; leave
                 * live the ones that reach the model.
                 *
                 * Until the commit above, this row had no carrier: it called
                 * `mutations.setIntervention`, a pure local write, and the
                 * fence was correct. `option_intervention_edit` gives it one,
                 * so the fence now withholds a connected write — which is the
                 * state that produced the founder's board, where 3 of 5
                 * options carried no effect at all.
                 *
                 * ⚠ `false`, NOT `readOnly`, AND NOT SIMPLY OMITTED. Written
                 * out so the next reader sees a DECISION rather than a missing
                 * prop, and so the diff that ever restores `readOnly` has to
                 * delete this paragraph to do it.
                 *
                 * ⛔ THE LOCAL-ONLY FENCES STAY. `description` and
                 * `advanced-editor` remain. The factor picker uses the canvas
                 * gesture's structural carrier; the editor's own rows route
                 * through this same owner while its remaining fields do not.
                 * Unfencing per PANEL rather than per WRITER is what the
                 * Router's blanket did, and this panel exists to be finer than
                 * that.
                 */
                disabled={false}
                techMode={techMode}
                /* normalisedValue intentionally omitted — raw system values
                   live in TechnicalDisclosure via OptionAdvancedEditor. */
              />
            ))
          )}

          {/* ⛔ THE REFUSAL, SAID OUT LOUD. The authority returns two of them and
              its header instructs the caller to disclose rather than swallow;
              a control that silently does nothing is the defect this change
              exists to close, wearing a different face. Rendered here, below
              the rows it is about, so it cannot be mistaken for a notice about
              the option as a whole.

              ⭐ AND ITS HOME IS NOW THE ROW, NOT HERE (Experience Design, #63
              5806266691, S2): `<state> · <specific reason>` directly under the
              field it is about, with the typed value kept in the field. This
              list-level line is the FALLBACK for a refusal whose row is no
              longer on screen, so it can never be silent — and it never repeats
              a sentence the row is already saying. */}
          {interventionNotice !== null &&
            !(unappliedIntervention !== null &&
              interventionRows.some(iv => iv.factorId === unappliedIntervention.factorId)) && (
            <p
              className={`${typography.panelMeta} text-text-light mt-1.5`}
              data-testid="option-intervention-notice"
              role="status"
            >
              {interventionNotice}
            </p>
          )}

          <InspectorConnectPicker
            nodeId={nodeId}
            label="Choose a factor it changes"
            candidateIds={candidateFactorIds}
            candidateValueDisplays={candidateValueDisplays}
            onConnected={setFocusTarget}
          />
        </PrimaryControlCard>

        <InlineRerunPrompt visible={false} elementId={nodeId} />
        {interventions.length > 0 && (
          <InspectorCoaching
            elementId={nodeId}
            panelType="option"
            fallbackText={COACHING.optionCoverage}
            labelContext={{ label: String(node.data?.label ?? '') }}
          />
        )}
      </PanelGroup>

      {/* ── Impact group — post-analysis only, absent from DOM otherwise ──
          #2747 re-scope 2 (DL ruling (A)): no win share in C — no share hero, no "N% of runs supported this option", no
          gap to the leader, no share bars. CEE serves no wording or Run authority for the share. The group keeps CEE's
          story headline and the way to the Analysis tab, where each option's chance is said in CEE's words. Restore
          trigger: a CEE-served share string with its own Run licence (post-C). Each branch stays per node (L-24): an
          option added since the run and one the run covered read differently. */}
      {isResultsMode && (() => {
        const nodeWasInRun = allOptions.some(o => o.isCurrent)
        const addedSinceRun = allOptions.length > 0 && !nodeWasInRun
        return (
        <PanelGroup kind="impact" label={GROUP_LABELS.impact}>
          <StaleGuardBanner hasResults={isResultsMode}>
            {nodeWasInRun || headline ? (
            <div>
              {headline && (
                <div className="bg-panel border rounded-lg p-2.5" style={{ borderColor: 'var(--option)4D' }}>
                  <p className={`${typography.panelBody} italic text-text-body`}>&ldquo;{headline}&rdquo;</p>
                </div>
              )}
              {nodeWasInRun && <div className="mt-1"><ResultsLink label="Compare all options" tab="results" /></div>}
            </div>
            ) : addedSinceRun ? (
              <p
                data-testid="option-impact-not-in-run"
                className={`${typography.panelMeta} text-text-light`}
              >
                {OPTION_STRINGS.impactNotInLastRun}
              </p>
            ) : (
              <p className={`${typography.panelMeta} text-text-light`}>{OPTION_STRINGS.impactUnavailable}</p>
            )}
          </StaleGuardBanner>
        </PanelGroup>
        )
      })()}

      {/* ── Connections group ─────────────────────────────────── */}
      {/*
        ⚠ THE GROUP IS OMITTED, NOT EMPTIED, and that is deliberate. `PanelGroup`
        renders its label unconditionally, so suppressing only the sentence would
        leave a bare "Connections" heading with nothing beneath it — which reads
        as a rendering fault rather than as honesty. When every connection this
        option has is already on screen above, the group has no job; when the
        option genuinely has none, the group and its flat denial are both TRUE
        and both render.
      */}
      {(outboundConnections.length > 0 || !hasAnyConnection) && (
      <PanelGroup kind="connections" label={GROUP_LABELS.connections}>
        {outboundConnections.map(conn => (
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
        {outboundConnections.length === 0 && (
          <p className={`${typography.panelMeta} text-text-light`}>{EMPTY_STATES.noConnectionsFlat}</p>
        )}
      </PanelGroup>
      )}

      {/* ── Expert-only model detail ──────────────────────────── */}
      {/* ⚠⚠ WRITERS 4 AND 5 OF 5, AND THE TWO A FILE-SCOPED SWEEP MISSES.
          `OptionAdvancedEditor` calls `mutations.setIntervention` (:66) and
          `mutations.setDescription` (:90). Neither is spelled in this file, and
          my first audit of "every control in OptionPanel" reported them absent
          — while the comment at the intervention call site above literally
          names this component. Audit the tree, not the file. */}
      <InspectorMoreItems>
      <TechnicalDisclosure visible={techMode}>
        <fieldset disabled={readOnly} className="contents" data-writer-fence="advanced-editor">
          <OptionAdvancedEditor nodeId={nodeId} />
        </fieldset>
      </TechnicalDisclosure>
      </InspectorMoreItems>
    </div>
  )
})

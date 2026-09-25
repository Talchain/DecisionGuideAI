import { memo, useMemo, useCallback, useState } from 'react'
import type { NodeProps } from '@xyflow/react'
import { BarChartHorizontal } from 'lucide-react'
import { BaseNode } from './BaseNode'
import { EvidenceGapBadge } from './EvidenceGapBadge'
import type { EvidenceGapEscalation } from './EvidenceGapBadge'
import { ConstraintBadge } from './ConstraintBadge'
import { goalConstraintText } from '../utils/goalConstraintText'
import { useNodeConstraints } from './shared/useNodeConstraints'
import { NODE_REGISTRY, isUnquantifiedPrior, type ObservedState } from '../domain/nodes'
import { useCanvasStore } from '../store'
import { deriveControllability } from '../utils/graphDisplayCalculations'
import { useNodeDisplayMetadata } from '../hooks/useNodeDisplayMetadata'
import { hasAnyStatedValue, hasObservedData, isFactorNeedsInput, meaningfulUncertaintyDrivers } from '../utils/observedStateHelpers'
import { NodeValueEditor } from './shared/NodeValueEditor'
import { usePendingFactorEditValue } from '../hooks/usePendingFactorEdit'
import { useModelEditAuthority } from '../hooks/useModelEditAuthority'
import { resolveValueInputSeed } from '../conversation/factorValueEdit'
import { typography } from '../../styles/typography'
import { composeCounterfactualQuestion } from './shared/counterfactualQuestion'
import { cleanFactorLabel, isSuppressedUnit, unwrapInterventionValue } from '../utils/labelUtils'
import { factorDisplayText } from '../../utils/formatFactorDisplayValue'
import { factorOptionSetting, getFactorOptionRows, resolveOptionInterventionsForDisplay } from '../utils/factorOptionSetting'
import { isGraphBadgesEnabled } from '../../flags'
import { DataBar } from '../ui/shared/DataBar'
import { driverRankFor, useInfluenceRank } from '../hooks/useInfluenceRank'
import { useRunCurrency } from './shared/runCurrency'
import { useHasCompletedFirstRun } from '../selectors/results'
import { FACTOR_NO_ANALYSIS_YET } from './shared/metricVocabulary'
import { FactorDriverLine, FactorDriverNotRanked, driverLineCaption } from './shared/FactorDriverLine'
import { LAST_RUN_PREFIX } from './shared/metricVocabulary'
import { selectRestingGlyphsShown } from './shared/restingGlyphRung'
import { CANVAS_GLYPH_SIZE_CLASSES } from './shared/canvasGlyphScale'
import { FactorTurningPointSlot } from './shared/FactorTurningPointTrack'
import { selectFactorTurningPointState } from './shared/factorTurningPoint'
import { CoachingCard } from '../components/CoachingCard'
import { useNodeConnections } from '../hooks/useNodeConnections'
import { usePopoverHover } from '../hooks/usePopoverHover'
import { useScienceIcons } from '../hooks/useScienceIcons'
import { ConnRow, ConnRowsOverflow, Sep, NodePopover, ScienceIcon, EdgePills, EstimateMarker, collapseEstimateDisplay } from './shared'
import { StatusPill } from './shared/StatusPill'
import { resolveNodeCoaching } from './coaching/resolveNodeCoaching'
import { openNodeInspector } from './shared/openNodeInspector'
import { resolveFactorPriorRange } from './shared/factorPriorRange'
import { useGuidanceStore } from '../stores/guidanceStore'
import { aggregateEdgeSignedStrength, compareEdgeValueAggregates } from '../domain/edgeValueProvenance'
import { classifyValueProvenance, VALUE_PROVENANCE_LABEL, factorValueIsUnconfirmedEstimate } from '../domain/valueProvenance'
import { VALUE_PROVENANCE_ICON, PROVENANCE_ICON_SIZE_CLASSES } from '../domain/valueProvenanceIcon'
import { factorConfidenceDisclosure } from '../../components/results/driverConfidenceDisplayPolicy'
import Tooltip from '../../components/Tooltip'
import { NODE_TOOLTIP_DELAY_MS } from './shared/nodeTooltip'
import { factorValueSourceMark, PRIOR_RANGE_SOURCE_MARK, ValueSourceMark } from './shared/valueSourceMark'

export const FactorNode = memo((props: NodeProps) => {
  const metadata = NODE_REGISTRY.factor
  const observedState = props.data?.observedState as ObservedState | undefined
  const currentValueOrigin = classifyValueProvenance(observedState?.source)
  // Derived once: the drivers that are actually evidence. See
  // `meaningfulUncertaintyDrivers` for why a placeholder is not one.
  const meaningfulDrivers = meaningfulUncertaintyDrivers(observedState?.uncertainty_drivers)
  const CurrentValueOriginIcon = currentValueOrigin ? VALUE_PROVENANCE_ICON[currentValueOrigin.kind] : null

  const cleanedLabel = cleanFactorLabel((props.data?.label as string | undefined) ?? '')

  // The counterfactual affordance's ONE sentence — rendered AND sent. Null when
  // the label is blank: no affordance rather than a degenerate question.
  const counterfactualQuestion = composeCounterfactualQuestion(cleanedLabel)
  const cleanedData = cleanedLabel ? { ...props.data, label: cleanedLabel } : props.data

  const hoveredOptionId = useCanvasStore(state => state.hoveredOptionId)
  const nodes = useCanvasStore(state => state.nodes)
  const edges = useCanvasStore(state => state.edges)
  const ceeAnalysisReady = useCanvasStore(state => state.ceeAnalysisReady)
  const resultsStatus = useCanvasStore(state => state.results.status)
  const viewMode = useCanvasStore(state => state.viewMode)
  const isPostAnalysis = resultsStatus === 'complete'
  const isDetailed = viewMode === 'expert'

  const nodeCategory = props.data?.category as string | undefined

  /**
   * ⭐ THE SAME AUTHORITY THE MODEL TAB WRITES THROUGH, not a second one.
   * `proposeFactorValue` carries `factor_value_edit` with an optimistic revert
   * and fails CLOSED on a value the wire cannot encode. Using it here means the
   * card and the Model tab cannot disagree about whether an edit reached the
   * model — which is the trap-21 shape this estate keeps paying for.
   */
  const editAuthority = useModelEditAuthority(props.id)
  /**
   * ⭐⭐ THE NUMBER THIS CARD WOULD OTHERWISE BE HIDING.
   *
   * Witnessed on this PR before the fix: typing `0.77` into a `unit: "scale"`
   * factor moved the canonical store 0.5 -> 0.77 and the card then rendered
   * NOTHING, unmounting its own editor with it. Two correct rules composing
   * wrongly — the projection suppresses an unanchored bare number so it cannot
   * read as measured, and the edit authority rightly withholds `source: 'user'`
   * until CEE returns a receipt, so the projection's rescue could never fire.
   *
   * ⛔ Delivery state, not provenance: it paints no pill, moves no "to verify"
   * count, and is never persisted. See `conversation/pendingFactorEdit`.
   */
  const pendingEditValue = usePendingFactorEditValue(props.id)
  const controllability = useMemo(() => {
    if (!isPostAnalysis) return undefined
    return deriveControllability(props.id, ceeAnalysisReady?.options, edges, nodeCategory)
  }, [props.id, ceeAnalysisReady?.options, edges, isPostAnalysis, nodeCategory])

  const displayMetadata = useNodeDisplayMetadata(props.id, 'factor')
  const scienceIcons = useScienceIcons(props.id, 'factor')

  // Graph v1.1 Task 2: priority ranking — top 3 stay full-fat, others get
  // visually quieted in Standard view. Post-analysis uses sensitivityRank
  // (already top-3 from displayMetadata); pre-analysis ranks by structural
  // centrality, mirroring EdgePills (sum of |signed mean| of outbound edges
  // whose target is an outcome or risk — those are the surfaces users care
  // about pre-analysis). Tiny graphs (≤3 factors) treat every factor as
  // high-priority since there's nothing to quieten.
  const preAnalysisFactorRank = useMemo<number | null>(() => {
    if (isPostAnalysis) return null
    const factorNodes = nodes.filter(n => n.type === 'factor' || n.data?.type === 'factor')
    if (factorNodes.length <= 3) return 1
    // ⛔ Provenance gate. This ranking decides which factors stay full-fat and
    // which are visually quieted, and it used `computeSignedMean`, which falls
    // back to `weight` — a constant `USER_EDGE_DEFAULTS`/`DEFAULT_EDGE_DATA`
    // always supply. So the "structural centrality" score was out-degree × 0.3
    // for every factor on an unset graph, and the quieting was arbitrary.
    // Only SOURCED strengths are counted now.
    const contributions = new Map<string, Array<Record<string, unknown> | undefined>>()
    for (const f of factorNodes) contributions.set(f.id, [])
    for (const e of edges) {
      const bucket = contributions.get(e.source)
      if (!bucket) continue
      const target = nodes.find(n => n.id === e.target)
      if (!target) continue
      const targetKind = target.type ?? target.data?.type
      if (targetKind !== 'outcome' && targetKind !== 'risk') continue
      bucket.push(e.data as Record<string, unknown> | undefined)
    }
    const scored = Array.from(contributions.entries()).map(([id, datas]) => ({
      id,
      leverage: aggregateEdgeSignedStrength(datas, { magnitude: true }),
    }))
    // No factor has a single sourced strength ⇒ there is no ranking to be had.
    // Same escape hatch the `<= 3` case above already uses: when we cannot
    // rank, we quieten NOBODY rather than quietening everybody on no evidence.
    if (!scored.some(s => s.leverage.show)) return 1
    scored.sort((a, b) => compareEdgeValueAggregates(a.leverage, b.leverage))
    const idx = scored.findIndex(s => s.id === props.id)
    if (idx < 0) return null
    const mine = scored[idx].leverage
    if (mine.show) return idx + 1
    // Unranked — but the two unranked states are NOT the same claim.
    //
    // `absent`: this factor has NO outbound edge to an outcome or risk at all.
    // That is a STRUCTURAL fact read straight off the graph, not a number
    // anybody had to supply, so ranking it below the measured factors invents
    // nothing. It keeps its place at the bottom of the sort.
    //
    // `not_set`: the edges exist and nobody set their strengths. Here we
    // genuinely do not know, and quieting the factor would be the same
    // fabrication in the visual channel that this gate removes from the
    // numeric one. Treat it as high-priority (i.e. quieten nobody) rather than
    // demote it on evidence we do not have.
    return mine.reason === 'absent' ? idx + 1 : 1
  }, [isPostAnalysis, nodes, edges, props.id])

  const priorityRank: number | null = isPostAnalysis
    ? displayMetadata.sensitivityRank
    : preAnalysisFactorRank
  const isHighPriority = priorityRank != null && priorityRank <= 3

  const interventionDisplayValue = useMemo(() => {
    if (!hoveredOptionId) return null
    const option = nodes.find(n => n.id === hoveredOptionId)
    const ceeOption = ceeAnalysisReady?.options?.find(o => o.id === hoveredOptionId)
    /*
     * ⭐ THE SHARED READER, AND WITHOUT IT THIS LINE CONTRADICTED THE OPTION
     * CARD. `ceeAnalysisReady` carries the numbers flat and the authored
     * strings in a sibling `intervention_details` map; taking the numbers alone
     * sent `0.2` into the UI's own band table and printed "Very low" where CEE
     * had written "Low (0.2)". See `resolveOptionInterventionsForDisplay`.
     */
    const interventions = resolveOptionInterventionsForDisplay(option, ceeOption)
    return factorOptionSetting(interventions?.[props.id], observedState)
  }, [hoveredOptionId, nodes, ceeAnalysisReady, props.id, observedState])
  const isAffectedByHover = interventionDisplayValue !== null

  const [showAllOptionValues, setShowAllOptionValues] = useState(false)

  // A setting is not a ranking or a baseline claim. Preserve canvas order
  // and show the supplied setting even when this is the reference option.
  const optionComparisonRows = useMemo(() => {
    if (nodeCategory === 'external') return null
    const rows = getFactorOptionRows(props.id, nodes, ceeAnalysisReady?.options, observedState)
    if (rows.length === 0) return null
    return { rows: showAllOptionValues ? rows : rows.slice(0, 4), overflow: showAllOptionValues ? 0 : Math.max(0, rows.length - 4) }
  }, [nodes, props.id, nodeCategory, observedState, ceeAnalysisReady, showAllOptionValues])

  // Retain the shared value reader and the card's existing display-only guard
  // against internal descriptors such as "other" being shown as units.
  const valueDisplay = useMemo(
    () => factorDisplayText({
      ...props.data,
      label: cleanedLabel,
      // Top level, never inside observedState: the observed state is the
      // persisted model and an unacknowledged keystroke must not reach it.
      pending_user_value: pendingEditValue,
      observedState: observedState && {
        ...observedState,
        unit: isSuppressedUnit(observedState.unit ?? undefined) ? undefined : observedState.unit,
      },
    }),
    [props.data, cleanedLabel, observedState, pendingEditValue],
  )

  // Prior range for external factors (only the range values, no "Variable"
  // prefix). Lane C3: prior.range_min/max are NORMALISED 0–1 values. Only a
  // real-world unit (currency, %, months, …) justifies cap-denormalising and
  // suffixing a unit; generic placeholder units ("scale", "index", …) must
  // never render as if measured — "0.5 scale" looks measured but isn't (see
  // GENERIC_PLACEHOLDER_UNITS doctrine in labelUtils). Classification goes
  // through the shared classifyUnit, and real-unit formatting through the
  // shared formatRawValueWithUnit, so this path can no longer drift from the
  // other formatters (it previously had a local fmt() with its own hardcoded
  // ['£','$','€','¥'] list that leaked "Range: 20 scale to 80 scale").
  // ⭐ THE DERIVATION MOVED OUT, VERBATIM, AND THE MOVE IS THE FIX.
  // It used to live here as forty lines of arithmetic, which meant the ONE
  // line a node still says below the legibility floor could not read it — so a
  // factor whose only figure is its prior range rendered a BLANK BOX the
  // moment a user zoomed out to see the whole model. The rules, the reachable
  // ignorance-prior arm and the two dedupes all live in
  // `shared/factorPriorRange.ts` now; this card and the reduced line ask the
  // same owner, so they cannot state different ranges for one factor.
  const priorRangeDisplay = useMemo(
    () => resolveFactorPriorRange({
      data: props.data as Record<string, unknown> | undefined,
      nodeCategory,
      observedState,
      valueDisplay,
    }),
    [nodeCategory, observedState, props.data, valueDisplay],
  )

  /**
   * ⭐ THE MARKER'S GATE, NOW READ FROM ITS OWNER. The spelling used to live
   * here, and the two other surfaces that ask the same question copied it —
   * one of them (`CanvasLegendPopover:929`) with a comment naming this line as
   * the source. The third, the reduced line, had no copy at all and printed
   * the number without the mark. One owner, three readers.
   */
  const isInferred = factorValueIsUnconfirmedEstimate(props.data)

  // ⭐ ONE readout, two affordances. The on-graph editor and the read-only span
  // render the SAME recorded readout, so the card cannot show two different
  // numbers depending on whether the value happens to have a durable carrier.
  //
  // ⚠ Hoisted because duplicating the expression at both branches broke the
  // recorded-value guard's UNIQUENESS binding: its anchor matched twice, so its
  // +/-240 window was no longer bound to either render site. An anchor that
  // matches twice is not a binding (trap 19) - the guard was right to refuse.
  const recordedValueReadout =
    isInferred && !isDetailed ? collapseEstimateDisplay(valueDisplay) : valueDisplay

  // ⭐ WHOSE NUMBER THIS IS, ON THE FACE — Paul 23 Sep contract feedback point 1:
  // "Mark Olumi estimates explicitly … User-set/evidence-backed values get their
  // own provenance. Do not rely on 'unmarked = Olumi'." One mark per figure
  // (`est.` / `you` / `brief` / `panel`), in BOTH the standard and Detailed
  // views, on the value line. (A range that is the only figure gets its own
  // neutral "no source" mark, never this one — see the range line below.) This supersedes R6's rest-only `est.` (the collapse above stays
  // rest-only; only the MARK now also shows in Detailed, where the full
  // "Moderate (0.5)" string otherwise read as unattributed).
  const valueSourceMark = factorValueSourceMark(props.data)
  const renderValueSourceMark = () =>
    valueSourceMark === null ? null
      : valueSourceMark.kind === 'olumi' ? <EstimateMarker />
        : <ValueSourceMark mark={valueSourceMark} testId={`factor-value-source-${props.id}`} />

  // ⭐ WHO PUT THIS NUMBER HERE — read from the EXISTING owners, never re-derived.
  //
  // `extractionType` alone cannot answer it. `inferred` is the state CEE
  // CREATES to mean "NOT from the brief" (`cee/transforms/schema-v3.ts` demotes
  // `explicit`/`observed` → `inferred` exactly when a brief claim is not
  // earned), and it covers two populations that must not share a sentence:
  // a value CEE invented, and a value a PERSON supplied that still carries the
  // inferred label. Splitting them needs the `source` stamp, not the label —
  // and not the magnitude, since a genuinely user-stated 0.5 is identical by
  // value to CEE's placeholder (CLAUDE.md trap 19).
  //
  // `hasObservedData` is already this component's authority for "is there
  // evidence behind this number" — it drives `showEvidenceGapBadge` six lines
  // below, whose tooltip reads "No observed data for X". Using it here is what
  // stops that badge and this sentence describing one number two ways. It
  // delegates the stamp reading to `classifyValueProvenance`, the estate's
  // single owner of "who authored it", and is positive-evidence-only: an
  // absent or unrecognised stamp asserts nothing in either direction.
  const factorValueHasEvidence = hasObservedData(props.data)
  // Single source of truth shared with BaseNode's StatusPill (wireframe v4
  // FactorNeedsPre): all of value/raw_value/display_value null AND non-external.
  const needsInput = isFactorNeedsInput(props.data)

  // ⭐⭐ WHAT DOES THIS NODE SAY ABOUT ITS OWN NUMBER? ONE decision, ordered.
  //
  // Two populations that must NOT share a sentence (CLAUDE.md trap 21):
  //   'unquantified' — no number exists at all. CEE PR #1223 stops
  //                    substituting a placeholder `0.5` and sends an ignorance
  //                    prior instead, so the honest claim is that there is no
  //                    estimate yet.
  //   'placeholder'  — a number exists and Olumi invented it.
  //
  // ⚠ ORDER IS LOAD-BEARING, AND SO IS THE SECOND CONJUNCT ON EACH ARM.
  // CEE's sweep deletes `data.value` but explicitly PRESERVES `extractionType`
  // (`deterministic-sweep.ts`: `extractionType: existingType ?? 'inferred'`).
  // So `isInferred` can be TRUE on a factor carrying no number — under which
  // the placeholder sentence does not merely go dark, it becomes FALSE: it
  // asserts a placeholder that no longer exists. Measured at pristine, this
  // exact render produced "Olumi's placeholder — no evidence yet." over a
  // factor with no value. The specific fact wins.
  //
  // ⚠ AND THE OPPOSITE-DIRECTION HARM, WHICH IS THE WORSE ONE. `hasAnyStatedValue`
  // guards the 'unquantified' arm so an ignorance prior can never talk over a
  // number a PERSON supplied afterwards — telling a user the value they set is
  // not there is the harm `observedStateHelpers` already records as worse than
  // a gap wrongly hidden. Both arms are pinned, both directions, in
  // `__tests__/FactorNode.unquantifiedPrior.spec.tsx`.
  //
  // Written against the SPEC — *"a factor carrying an ignorance prior has no
  // estimate; say that, and do not describe a placeholder"* — so it is correct
  // whether or not `observed_state` survives CEE's V3 transform, a CEE-side
  // fact this lane could not settle.
  const valueVoice: 'unquantified' | 'placeholder' | null = useMemo(() => {
    if (isUnquantifiedPrior(props.data?.prior) && !hasAnyStatedValue(props.data)) return 'unquantified'
    if (isInferred && !factorValueHasEvidence) return 'placeholder'
    return null
  }, [props.data, isInferred, factorValueHasEvidence])

  // An external factor's prior is its evidence, so it earns the badge's silence
  // — UNLESS the prior is an explicit statement of ignorance, which is the
  // absence of evidence rather than a quiet form of it. Same owner, same
  // discrimination, as `isFactorNeedsInput`'s exemption: the flag, never the
  // range. `unreachable-factors.ts` reclassifies a factor to `external` and
  // writes the flagged prior in one pass, so this arm is genuinely reached.
  const externalWithPrior =
    nodeCategory === 'external'
    && props.data?.prior != null
    && !isUnquantifiedPrior(props.data.prior)
  /**
   * ⛔ THE SAME FACT WAS BEING STATED TWICE, IN TWO CORNERS, WITH TWO GLYPHS.
   *
   * `useScienceIcons` already mints an `evidence-gap` FileQuestion into the
   * card HEADER — a "?" in `text-warning`, tooltipped *"No observed data for
   * this factor."* — on a near-identical condition, and `KEEP_LOW_PRIORITY`
   * below keeps it even on a low-priority factor. The bottom-right badge then
   * says it again, in a circle that straddles the card corner and so reads as
   * unattached to anything. That is the "chucked on willy-nilly" Paul named on
   * 15 Sep, and it is the same class this file already closed once when
   * `olumi-estimate` was the THIRD statement of "Olumi estimated this".
   *
   * ⭐ THE ESCALATION CHANNEL IS KEPT. The badge is suppressed only where the
   * header is ALREADY carrying the icon; when the header is not, the badge is
   * the only statement and still renders, with its VoI tiers intact
   * (`gapEscalation` below). So this removes a duplicate, never a signal.
   */
  const headerCarriesEvidenceGap = scienceIcons.some(si => si.id === 'evidence-gap')
  /*
   * ⛔ NOT ON THE STANDARD FACE (NODE-ANATOMY v3.2: "no pills on the border";
   * acceptance "no pill crosses a border"; audit F8 / FRAME-13). The badge is a
   * "?" disc hanging off the bottom-right corner — the "hanging ?" in Paul's
   * screenshot — and on the Standard face its fact is already said: the value's
   * `est.` mark states "no observed data", and a TARGETED gap reaches the rail's
   * evidence icon (`NodeSignalRailIcons`). Detailed keeps it: "Detailed adds
   * information, not a bigger card".
   */
  const showEvidenceGapBadge =
    isDetailed && isGraphBadgesEnabled() && !hasObservedData(props.data) && !externalWithPrior
    && !headerCarriesEvidenceGap

  const gapEscalation: EvidenceGapEscalation = useMemo(() => {
    if (!displayMetadata.isResultsMode) return 'none'
    const voi = displayMetadata.valueOfInformation
    if (voi == null) return 'none'
    if (voi > 0.20 && displayMetadata.voiRank !== null && displayMetadata.voiRank <= 3) return 'critical'
    if (voi > 0.05) return 'warning'
    return 'none'
  }, [displayMetadata.isResultsMode, displayMetadata.valueOfInformation, displayMetadata.voiRank])

  /**
   * ⚠ THE MATCHING MOVED TO `useNodeConstraints`, AND THAT IS THE FIX, NOT A
   * TIDY-UP. The identity-binding rules below used to live here, so only this
   * one card could use them — while the constraints in the shipped starters
   * target a GOAL and an OUTCOME. One predicate, every kind.
   */
  // Only the badge tooltip is built here; BaseNode renders the visible lines.
  const { matching: matchingConstraints } = useNodeConstraints(props.id, cleanedLabel)
  const allNodes = useCanvasStore(state => state.nodes)

  const constraintTooltip = useMemo(() => {
    if (!isGraphBadgesEnabled() || matchingConstraints.length === 0) return null
    return matchingConstraints
      .map(c => {
        const name = (typeof c.label === 'string' && c.label.trim()) || cleanedLabel
        return `${name} ${goalConstraintText(c, allNodes, { omitLabel: true })}`
      })
      .join('; ')
  }, [matchingConstraints, allNodes, cleanedLabel])

  // A wider-range invitation needs a stated reference, never a placeholder.
  const anchoringMessage = useMemo(() => {
    if (!isDetailed || isPostAnalysis) return null
    const referenceOrigin = classifyValueProvenance(typeof observedState?.source === 'string' ? observedState.source : null)
    if (!referenceOrigin || referenceOrigin.kind === 'ai') return null
    const options = ceeAnalysisReady?.options
    if (!options || options.length < 3) return null
    const vals: number[] = []
    for (const opt of options) {
      // unwrapInterventionValue handles plain numbers, V3 objects, and
      // returns null for malformed/missing entries (no Number() coercion).
      const { value: v } = unwrapInterventionValue((opt.interventions as Record<string, unknown> | undefined)?.[props.id])
      if (v != null) vals.push(v)
    }
    if (vals.length !== options.length) return null
    const baseline = observedState?.value
    if (typeof baseline !== 'number' || !Number.isFinite(baseline)) return null
    if (vals.every(value => Math.abs(value - baseline) <= Math.max(Math.abs(baseline), 0.01) * 0.2)) {
      return valueDisplay ?? String(baseline)
    }
    return null
  }, [isDetailed, isPostAnalysis, ceeAnalysisReady, props.id, observedState, valueDisplay])

  const outboundConnections = useNodeConnections(props.id, 'outbound')

  const influencePct = displayMetadata.influence != null ? Math.round(displayMetadata.influence * 100) : null

  /**
   * ⭐ THE RANKED READING OF THE SAME NUMBER — derived ONCE and consumed by
   * every driver render on this card. (Historical: it fed the Standard-view
   * `NodeMetricRow` and the Detailed-view `DataBar`; since the locked design of
   * 23 Sep 2026 both are ONE `FactorDriverLine`, "Driver N of M analysed".) They show the same figure, so they carry the
   * same misread, and fixing one would have left `Relative influence … 100%`
   * reachable one view away — four presentations of one idea, which is the
   * inconsistency this card's rows were unified to remove.
   *
   * `null` whenever the claim is not licensed (see `influenceRankReadout`):
   * both call sites then render EXACTLY what they render today.
   *
   * ## ⭐⭐ AND THE COUNTABLE HALF IS WITHHELD UNLESS THE RESULT IS CONFIRMABLY
   * ABOUT THIS GRAPH — HERE, NOT AT THE PRODUCER.
   *
   * `of 5` is a COUNTABLE claim. Every other readout on this card carries
   * staleness softly — once the graph moves, `80%` is wrong but unfalsifiable
   * from the screen. A denominator is not: run over five factors, add three, and
   * the canvas shows EIGHT factor cards beside a row still claiming `of 5`. The
   * reader refutes the product by counting, which is a different and much more
   * expensive kind of wrong.
   *
   * ⛔ IT WAS GATED IN `useNodeDisplayMetadata` ON `graphEditedSinceLastRun`,
   * AND BOTH HALVES OF THAT WERE WRONG.
   *
   * THE FLAG: `resultsLoadHistorical` (`store.ts:6026`) and
   * `resultsHydrateFromSupabase` (`:6097`) reset it to `false` in the SAME
   * `set()` that writes `results.status: 'complete'`, so restoring a historical
   * run re-published the denominator against a graph it was never computed on —
   * exactly the harm the gate was written to prevent. It also over-fires the
   * other way: `historyHash` (`:2025`) includes `position`, so a node DRAG — which
   * changes no factor the run saw — dropped the caption. The gate is now
   * {@link useAnalysisResultsAreCurrent}, whose header carries the measurement
   * and the reason `analysisFreshnessDirty` is not the remedy either.
   *
   * THE PLACE: gating inside the producer made the assignment CONDITIONAL, which
   * falsified the invariant that makes `influenceSetSize?` safe to leave optional
   * — "rank present, denominator absent is unreachable from this producer". The
   * commit that introduced the gate asserted that invariant in a docblock and
   * DISPROVED it four tests later in the same spec file, where a gated fixture
   * returns `sensitivityRank: 1` with `influenceSetSize: null`. Reading the gate
   * HERE restores the implication at the producer — the assignment is once more
   * unconditional inside the factor branch and runs before the rank gate — so the
   * optionality is safe for the reason its docblock states, with no mock churn
   * and no required-field change. The claim and the licence to make it are two
   * questions, and they now live in two places (CLAUDE.md trap 21).
   *
   * ⚠ ONE GATE, ONE LOCAL, NO DIVERGENCE. Both influence renders read this
   * `influenceRank`, and both `influenceRankExplanation` calls read it too, so
   * the two views cannot disagree about whether the denominator is licensed.
   *
   * ⚠ THE RANK ITSELF IS UNTOUCHED, deliberately and narrowly. `sensitivityRank`
   * is read by the `#N` badge, the inspector and the edge label; withdrawing it
   * would change three surfaces this lane never argued for. What is withheld is
   * only the half a reader can refute by counting.
   */
  /**
   * ⭐ THE PAIR MOVED TO ITS OWN OWNER, unchanged. The reduced line needs the
   * identical answer and had neither half of it; a second spelling here would
   * be the mirror that always reads green while it drifts.
   */
  const influenceRank = useInfluenceRank(
    displayMetadata.sensitivityRank,
    displayMetadata.influenceSetSize,
  )

  /**
   * ⭐ THE FACTOR FACE — NODE-ANATOMY v3.2 (24 Sep; supersedes the locked face
   * below where they differ). Paul, 24 Sep: "The content on the nodes is an
   * absolute mess … make these nodes look like the design."
   *   1  title
   *   2  `<value> <mark>` as plain text (no chip), OR "Needs input · Value not
   *      set yet" in the body (no border pill). Pre-run with a value: nothing more.
   *   3+ ONLY for a factor the run RANKED: "Driver N of M analysed" + a thin
   *      neutral bar, M = the eligible ANALYSED factors (ED #63 5806207128:
   *      "not 'number of ranks we happen to render'"). Then a FOUND turning
   *      point, on any factor (it is the run's finding for THIS factor).
   *   NEVER "Structural influence"; any "No turning point …" line at rest (ED
   *      5806207128: "Absence of a turning point = no mini-visual"); a limit
   *      line (the Goal's); a badge on the border (Standard).
   *   STALE `Last run ·` only on the rank and a found turning point (ED #63
   *      5805528520 §6): `Last run · Driver 1 of 6 analysed`.
   * Pinned state by state in `__tests__/FactorNode.anatomyV32.spec.tsx`.
   *
   * ⭐ THE LOCKED FACTOR FACE (spec §3 Normal; ED 02:31Z D1a; ED 11:52Z point 3):
   *   title → value + unit → tiny relative DRIVER line → at most ONE mini-visual
   *   (turning point, else a genuine range, else nothing) → the rail.
   *
   * ⭐ BOTH ANALYSIS-DERIVED CUES SPEAK ONLY ABOUT A RUN THE STATE CAN NAME
   * (design integration, 23 Sep 2026 — #1891's rule applied to this face):
   *   · CURRENT run → shown, unlabelled;
   *   · model KNOWN to have changed since the run → shown and LABELLED
   *     `Last run · ` (Paul's Ruling 3, ROADMAP 2.651: "out-of-date results are
   *     labelled, not withheld"; visual contract v3: "retain valid historical
   *     figures with Last run · when a model change is known");
   *   · never-run / cannot-confirm → hidden (ED 02:31Z Q2: must not manufacture
   *     a "last run" claim; spec §8 for the unknown case).
   *
   * ⚠ TWO QUESTIONS, TWO OWNERS, deliberately not merged: `resultsAreCurrent`
   * (the derived "is this about the graph on screen?") and
   * `resultsFromLastRun` (#1891's `useModelChangedSinceRun`, the composed
   * verdict's `'changed'`). Where both answer yes the label wins — a label is
   * never a false claim; its absence could be.
   *
   * ⚠ ONE LOCAL, EVERY RUNG: `resultsFromLastRun` is passed to `BaseNode` for
   * the reduced line, and `driverRankFor` is the one rank rule both read, so
   * the card cannot label the rank on one rung and assert it on another.
   */
  //
  // ⛔ SUPERSEDED IN PART (Codex EARLY_REVIEW, #63 5801431996; spec
  // `runCuesFollowOneComposedCurrency.spec.tsx`): visibility and label now come
  // from ONE composed verdict, `useRunCurrency()`. The local-only
  // `useAnalysisResultsAreCurrent()` let a wire `refused` / `unknown_degraded`
  // (cannot-confirm) still show an UNQUALIFIED cue over locally fresh fields.
  const runCurrency = useRunCurrency()
  const resultsFromLastRun = runCurrency === 'changed'
  /**
   * ⭐ DESIGN-GAP ROW 10 (contract v3 §02 draft): "Working assumption · no
   * analysis yet" — said only where NO analysis exists at all, never after a
   * run: no completed result on screen, no run EVER completed for this model
   * (`hasCompletedFirstRun`, monotonic across reruns), and a composed verdict
   * that speaks of no run (`'none'`) — so a wire stating a completed run that
   * has not hydrated never gets "no analysis yet" over it. Only on a factor
   * that SHOWS a value (the contract's branch); a missing value states its gap.
   */
  const hasCompletedFirstRun = useHasCompletedFirstRun()
  const noAnalysisYet = !isPostAnalysis && !hasCompletedFirstRun && runCurrency === 'none' && valueDisplay !== null
  const runCuesShown = runCurrency === 'current' || resultsFromLastRun
  const resultsReport = useCanvasStore(state => state.results.report)
  // ED #63 5806207128: "Driver N of M analysed" (M = the eligible analysed
  // factors, `driverRankFor`) on a RANKED factor only. A factor the run did not
  // rank shows no line, no bar and no substitute; it says "Not ranked in this
  // run" to AT (`FactorDriverNotRanked`).
  const driverRank =
    isPostAnalysis && runCuesShown
      ? driverRankFor(
          influenceRank,
          displayMetadata.sensitivityRank,
          displayMetadata.influenceSetSize,
          resultsFromLastRun,
          displayMetadata.influenceRankedCount,
        )
      : null
  const driverLine =
    driverRank !== null && influencePct != null && displayMetadata.influenceProvenance != null
      ? {
          rank: driverRank,
          value: influencePct / 100,
          provenance: displayMetadata.influenceProvenance,
          importanceBasis: displayMetadata.influenceImportanceBasis,
        }
      : null
  const driverNotRanked = isPostAnalysis && runCuesShown && driverRank === null
  // The run's turning-point state for this factor: a PLoT `found` row, or the
  // "none" fallback. Never-run / cannot-confirm stay null (the same
  // `isPostAnalysis && runCuesShown` gate), so no past run is invented. What
  // the CARD shows of it is `turningPointShown` below (ED 5806207128: only a
  // found threshold at rest).
  //
  // ⛔ Paul 23 Sep point 3(d) ("make 'no turning point available' the normal
  // fallback") is superseded at rest by ED #63 5806207128.
  const turningPointState = useMemo(
    () => (isPostAnalysis && runCuesShown ? selectFactorTurningPointState(resultsReport, props.id) : null),
    [isPostAnalysis, runCuesShown, resultsReport, props.id],
  )
  const turningPoint = turningPointState?.kind === 'found' ? turningPointState.turningPoint : null
  /*
   * ⭐ ED #63 5806207128 ("Factor anatomy"): "No `No turning point
   * available/in this run` line at rest. Absence of a turning point = no
   * mini-visual." So the RESTING card (Standard) shows the turning-point slot
   * ONLY for a FOUND threshold — the run's finding for THIS factor, ranked or
   * not. The "no turning point" fallback said that nothing exists, which
   * principle 1 forbids ("Nothing is shown just to say that nothing exists").
   *
   * Detailed is not the resting card ("Detailed adds information"): there the
   * fallback still completes a RANKED factor's driver line, as before, so the
   * attested search ("No turning point in this run") stays one view away.
   * `driverLine` is its gate, in that view only.
   */
  const turningPointShown =
    turningPointState !== null &&
    (turningPointState.kind === 'found' || (isDetailed && driverLine !== null))

  /**
   * ⭐⭐ BOUNDED ANATOMY — the Standard card is TITLE + ONE PRIMARY LINE.
   *
   * Experience Design, #63 5809278282 (24 Sep 2026), quoted:
   *   "Proceed with (2), modified; do not build rung-triggered re-layout … Keep
   *   one stable layout geometry.
   *   - Landing / quiet: repeated cards may reduce to title + one primary line
   *     inside the fixed fit-safe box. … Factor = value + provenance mark …
   *   - Do not turn the Canvas into an inventory-only surface. At Normal/Focused,
   *     keep a quiet reasoning signal visible at rest where one exists (attention
   *     mark and neutral driver cue). The fuller S3 reasoning detail — change
   *     rows, driver wording, turning-point explanation/findings — can move to
   *     the existing hover/focus popover and inspector rather than expanding
   *     layout geometry.
   *   - Truth does not become progressive-disclosure debt: `Needs input` and
   *     value provenance remain explicit; any stale run-derived figure shown
   *     on-card or in disclosure keeps `Last run ·`, with the whole-graph stale
   *     cue still present. Never hide provenance or staleness in tooltip-only
   *     copy.
   *   - This is a fit implementation of the locked anatomy, not a new design gate."
   *
   * WHY: at 1280×800 with the dock open the landing zoom is the 0.5 floor, where
   * `--canvas-label-scale` = 2 (~19 characters per line) and the layout reserves
   * each card's height AT that bound (`measureNodeHeightsAtLabelBound`). Every
   * body line costs 28 flow units of whole-graph height; the allowance is title
   * + EXACTLY ONE line.
   *
   * So, in the STANDARD view only (Detailed keeps its inline detail):
   *   · card body = the value line (value + mark) OR the `Needs input` row —
   *     one row, whose mark can never wrap or be cut (`factor-value-mark-slot`);
   *   · the S3 findings — `Driver N of M analysed` + bar, a FOUND turning point,
   *     the external prior-range line — MOVE, verbatim and with their
   *     `Last run ·` labels, into this factor's `NodePopover` (`standardFindings`
   *     below), which now mounts for them whatever the factor's priority; the
   *     inspector is untouched and still carries them;
   *   · a RANKED factor keeps a quiet reasoning signal at the Normal rung only:
   *     `FactorDriverCue`, INLINE at the end of the primary line (never a row), so
   *     a `full` card can never be taller than the same card at `quiet` — the
   *     height-safety invariant. It follows the one resting-glyph rung gate
   *     (`selectRestingGlyphsShown`), like the rail's coaching icon.
   * Pinned in `__tests__/FactorNode.boundedAnatomy.spec.tsx`.
   */
  const restingGlyphsShown = useCanvasStore(selectRestingGlyphsShown)
  const driverCue =
    !isDetailed && restingGlyphsShown && driverLine !== null ? (
      <FactorDriverCue nodeId={props.id} rank={driverLine.rank} fromLastRun={resultsFromLastRun} />
    ) : null
  // Already gated by the shared display policy — see useNodeDisplayMetadata.
  // Null whenever the ruled policy says the figure is not display-safe, which
  // is why every confidence surface on this node (the Detailed bar and the
  // popover) goes quiet together.
  const confidencePct = displayMetadata.confidence != null ? Math.round(displayMetadata.confidence * 100) : null
  // Converged (F9): this array used to live here and NOWHERE ELSE, so
  // `NodeInspector` — which renders the same signal — had no disclosure at all.
  // One derivation, every surface.
  const confidenceDisclosure = factorConfidenceDisclosure({
    isDefaulted: displayMetadata.confidenceIsDefaulted,
    isProvisional: displayMetadata.confidenceIsProvisional,
  })

  // ⛔ The synthesised "Gather evidence" coaching line is deleted (locked design,
  // 23 Sep 2026): its verdict half was already gone (15 Sep), and the resting
  // face now asks its one question through the rail's coaching icon.

  const { showPopover, nodeHandlers, popoverHandlers, nodeElRef } = usePopoverHover()

  const handleViewParams = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    openNodeInspector(props.id)
  }, [props.id])

  // Connected outcomes count for external popover text
  const outcomesAffected = useMemo(() => {
    const outcomeIds = new Set(nodes.filter(node => (node.type ?? node.data?.kind) === 'outcome').map(node => node.id))
    return new Set(edges.filter(edge => edge.source === props.id && outcomeIds.has(edge.target)).map(edge => edge.target)).size
  }, [nodes, edges, props.id])

  // ----- Coaching chip cluster -----
  // Computed once, then injected into preAnalysisLayer2 (so it appears in
  // both the high-priority Standard popover and the Detailed inline render),
  // and into a dedicated needsInput popover branch for low-priority cases.
  //
  // ⚠ NARROWED, 9 Sep 2026 (Core ruling). This read "The body never renders
  // chips directly", and elsewhere in this file that sentence is cited as a
  // written brief — "AI chips live in popovers, never in the body". As an
  // estate-wide or even file-wide rule it is FALSE, and was already false when
  // written: **this same body renders coaching directly** at the
  // `synthesisedCoaching` paragraph and at the `counterfactualQuestion`
  // affordance below, the latter a `<button>` in the body.
  //
  // What is true is narrow: **THIS pre-analysis chip cluster** is not rendered
  // by the body. It binds nothing else — not the other node kinds, not this
  // file's own post-analysis coaching.
  //
  // It is narrowed rather than deleted because the next lane reads a sentence
  // like the old one, believes it, and reverts work that was deliberate:
  // `DecisionNode` broke it on purpose and said why ("THE INVITATIONS BELONG ON
  // THE CARD, NOT BEHIND A HOVER"), and this change puts one question on the
  // face of the Risk, Outcome, Action and Goal cards for the same reason —
  // measured on deployed `9748b336`, where every coaching chip on the canvas
  // read ZERO in the resting state because a closed `NodePopover` returns null.
  // A rule two nodes obey and four break is the hand-maintained mirror (trap
  // 12), and the mirror is what does the damage, not the rule.
  /**
   * ⭐⭐⭐ ONE QUESTION ON THE FACE OF THE FACTOR CARD — the kind that was left
   * behind when every other kind got one.
   *
   * `DecisionNode` broke the "AI chips live in popovers" rule on purpose and
   * said why: **THE INVITATIONS BELONG ON THE CARD, NOT BEHIND A HOVER**. A
   * later change put one question on the face of the Risk, Outcome, Action and
   * Goal cards for the same reason, measured on deployed `9748b336`, where
   * every coaching chip on the canvas read ZERO in the resting state because a
   * closed `NodePopover` returns null. FACTOR was the one kind not done, and
   * its chips have been in that zero state ever since — reachable only by
   * hovering, which has no touch equivalent.
   *
   * ⛔ AND IT WAS DELETED AFTER A RUN (`factorChips` returns null when
   * `isPostAnalysis`), which is exactly backwards. The moment the model tells
   * you a factor drives the result is the moment "what evidence supports this?"
   * is worth asking. Risk and Outcome render theirs in BOTH phases; this now
   * matches them.
   *
   * ⚠ THE CONDITIONS ARE PRODUCER FIELDS COMPARED BY IDENTITY — `needsInput`,
   * `category === 'external'`, `extractionType === 'inferred'`. No threshold is
   * chosen and no number is interpreted: the card asks a different question
   * depending on WHAT KIND OF THING the producer says this value is, which is
   * the permitted form.
   *
   * A factor with an observed, owned value gets no question, deliberately —
   * there is no assumption to interrogate, and a chip on every card is wallpaper.
   */
  // ⚠ The three conditions and the deliberate `null` now live in
  // `resolveNodeCoaching` — unchanged, including their precedence order and
  // the short `factor_evidence_supports` label. The docblock above is the
  // ruling that governs them and is repeated in the resolver's own docblock so
  // it cannot be lost by whoever reads only one of the two files.
  const cardQuestion = useMemo(
    () =>
      resolveNodeCoaching({
        kind: 'factor',
        surface: 'card',
        state: {
          needsInput,
          isExternalCategory: nodeCategory === 'external',
          isInferred,
          /*
           * ⭐⭐ THE LICENCE AND THE RANK, READ FROM THEIR EXISTING OWNERS.
           *
           * `influenceRank` is already this component's licensed readout — it
           * is `null` whenever the claim is not permitted (withheld on ties,
           * capped at `MAX_BADGED_RANK`, and gated on the results being
           * CURRENT). Requiring it to be non-null means this chip inherits
           * every one of those rules for free and cannot outlive a stale run.
           * `sensitivityRank === 1` then supplies the value. Nothing new is
           * decided here, which is what `influenceScaleCopy.ts:347-361`
           * requires.
           */
          leadsInfluence: influenceRank !== null && displayMetadata.sensitivityRank === 1,
        },
        context: {
          label: cleanedLabel,
          // The readout's own sentence, never a re-wording of it.
          influencePhrase: influenceRank?.phrase,
        },
      }),
    [needsInput, nodeCategory, isInferred, cleanedLabel, influenceRank, displayMetadata.sensitivityRank],
  )


  // ----- Layer 2 content (popover in Standard, inline in Detailed) -----

  // Graph v2 Task 3: per-option comparison table block. Rendered ONLY inside
  // the Standard popover (never the inline Detailed body, never the node
  // body), gated by `nodeCategory !== 'external'` and `optionComparisonRows`.
  // The `withSep` flag controls whether a leading separator renders — true
  // when stacked beneath other layer-2 content, false when the table is the
  // popover's only content (low-priority controllable case).
  const renderOptionValuesBlock = (withSep: boolean) =>
    optionComparisonRows && optionComparisonRows.rows.length > 0 ? (
      <>
        {withSep && <Sep />}
        <p className={`${typography.edgeLabel} text-text-light m-0 mb-1`}>
          Current value: <span className="text-text-body">{valueDisplay ?? 'Not recorded'}</span>
          {valueDisplay !== null && (
            <span data-testid="factor-current-value-origin" className="inline-flex items-center gap-1 ml-1">
              {CurrentValueOriginIcon && <CurrentValueOriginIcon aria-hidden="true" className={PROVENANCE_ICON_SIZE_CLASSES} />}
              {currentValueOrigin ? VALUE_PROVENANCE_LABEL[currentValueOrigin.kind] : 'Source not recorded'}
            </span>
          )}
        </p>
        <p className={`${typography.edgeLabel} font-medium text-text-body m-0 mb-0.5`}>Option values:</p>
        <div className="space-y-0.5">
          {optionComparisonRows.rows.map(row => (
            <div key={row.id} className="flex items-start gap-1">
              <div className="w-[10px] h-[10px] rounded-sm bg-option flex-shrink-0" />
              <button type="button" className={`${typography.edgeLabel} text-text-body flex-1 min-w-0 text-left break-words nodrag nopan hover:underline focus-visible:outline focus-visible:outline-info`}
                data-node-selection-target={row.id}
                onClick={e => { e.stopPropagation(); openNodeInspector(row.id) }}
                onPointerDown={e => e.stopPropagation()}
              >
                {row.label}
              </button>
              <span className={`${typography.edgeLabel} font-semibold text-right max-w-[48%] break-words text-text-body`}>
                {row.displayValue}
              </span>
            </div>
          ))}
          {optionComparisonRows.overflow > 0 && (
            <button type="button" className={`${typography.edgeLabel} text-info underline nodrag nopan`}
              onClick={e => { e.stopPropagation(); setShowAllOptionValues(true) }}
              onPointerDown={e => e.stopPropagation()}
            >Show {optionComparisonRows.overflow} more</button>
          )}
        </div>
      </>
    ) : null

  const hasOptionValues = optionComparisonRows != null && optionComparisonRows.rows.length > 0

  const preAnalysisLayer2 = !isPostAnalysis ? (
    <>
      {/* Pre-analysis coaching line — Polish 4 Task 3: only on top-3 factors.
          Detailed view shows more evidence (ConnRows, bars, parameters), not
          coaching on every node. Standard view already gates the popover via
          isHighPriority. */}
      {/* ⭐ THIS LINE USED TO CLAIM THE BRIEF OVER A NUMBER CEE INVENTED.
          Measured on deployed staging (UI `e38b8e96`, 30 Aug 2026): four
          factors each carrying `{ value: 0.5, source: 'cee_inference',
          extractionType: 'inferred' }` — distinct value set literally [0.5] —
          rendered "Olumi estimated this from your brief." The number is a
          hardcoded constant (`adapters/llm/normalisation.ts`,
          `repair/deterministic-sweep.ts`, which stamp
          `value_tier: "fallback_default"` as they write it); nothing about the
          brief produced it. The gate was `isInferred`, which is the state
          meaning "NOT from the brief" — so the branch and its sentence were
          exact opposites, and the same defect fired over `user_override`
          values too, re-attributing a user's own number to Olumi.
          Three populations, three honest outcomes, none asserting the brief. */}
      {/* ⭐ KEPT SHORT ON PURPOSE — height is the scarcest resource on this canvas.
          Measured across all five shipped starters at 1280x800: every one clamps
          at the 0.50 legibility floor and every one is HEIGHT-bound, not
          width-bound (build-vs-buy ~41% of its height off-screen, market-entry
          ~30%, vendor-selection ~27%). A long sentence on top-3 factor nodes
          pushes directly against that.
          The claim that has to survive is "this number is Olumi's placeholder
          and there is no evidence behind it" — that is the false attribution we
          came to kill. The ACTION half ("setting it would strengthen the
          analysis") is deliberately NOT repeated here because THIS EXACT
          POPULATION already carries it: `showEvidenceGapBadge` above fires on
          `!hasObservedData`, the same predicate as this line, and its tooltip
          carries it. ⚠ The sentence quoted here used to be "No observed data
          for X. Setting a value would strengthen the analysis." — the second
          half is now "Setting a value here would give the analysis something
          stated to work from", because "would strengthen" asserted a
          consequence from an uncalibrated score (see `ESCALATION_TOOLTIP`).
          The ARGUMENT is unchanged and is why this quote is corrected rather
          than deleted: the badge still carries the action half on this exact
          population, so saying it twice costs a line and adds nothing.
          Shortened by REWRITING, never by truncating or eliding — an ellipsis
          with nowhere to go would be hiding, and going silent would be worse. */}
      {valueVoice === 'placeholder' && isHighPriority && (
        <p className={`${typography.edgeLabel} text-text-body m-0 mb-1`}>
          Olumi&rsquo;s placeholder &mdash; no evidence yet.
        </p>
      )}
      {/* ⭐ THE STATE #1223 CREATES, AND IT MUST NOT BE SILENT.
          Before #1223 a factor with no stated number was handed `0.5` and the
          line above described it. #1223 sends no number at all — strictly more
          honest upstream, and it would have made the node say LESS about a
          factor that is MORE openly unknown. A capability closing, not a
          regression fixed: this state could not previously arise.
          WORDING. Short, because height is the scarcest resource on this canvas
          (every shipped starter clamps at the 0.50 legibility floor and every
          one is HEIGHT-bound). It carries the same substance as CEE's own
          sentence — "its value was left fully open rather than narrowed to a
          figure we cannot support" — so the product says ONE thing about this
          state across chat and canvas. It obeys the same C1 ruling as CEE's:
          no bracket notation, not the word "unquantified", and no disowned
          figure. The ACTION half is not repeated for the same reason the line
          above omits it — the evidence-gap badge already carries it. */}
      {valueVoice === 'unquantified' && isHighPriority && (
        <p className={`${typography.edgeLabel} text-text-body m-0 mb-1`}>
          No estimate yet &mdash; left open, not guessed.
        </p>
      )}
      {/* The other two `inferred` populations — a value a PERSON owns, and one
          with no stamp at all — reach NEITHER arm and show no coaching line.
          That is a refusal to claim, not a hidden surface: the value, the
          evidence badge and the chips all still render. For the source-less
          case there is genuinely nothing true to say (claiming the user
          authored it would invent authorship).
          ⚠ THE USER-OWNED ARM AND THE PRE-ANALYSIS CONNECTION LIST THAT USED
          TO SIT HERE ARE DELETED, not merely quiet. Both gated on
          `outboundConnections.length > 0`, and `useNodeConnections` returns
          `[]` unless `results.status === 'complete'`
          (hooks/useNodeConnections.ts:35) while this whole block renders only
          when `!isPostAnalysis` — a contradiction, so neither could ever
          render. The previous author found this, wrote it down here, and left
          it as "a separate dead-code call". This is that call. The
          post-analysis ConnRows list is the live one and is untouched. */}
      {nodeCategory === 'external' && outcomesAffected > 0 && (
        <p className={`${typography.edgeLabel} text-text-body m-0 mb-1`}>
          Linked to {outcomesAffected} outcome{outcomesAffected !== 1 ? 's' : ''}.
        </p>
      )}
      {/* Coaching chips — moved out of body. They appear here in the
          high-priority Standard popover and in the Detailed inline render
          (which uses preAnalysisLayer2 too). For low-priority needsInput
          standalone, see the dedicated needsInput popover branch below. */}
      {/* Detailed pre-analysis: uncertainty drivers */}
      {/* ⭐ REAL EVIDENCE ONLY. CEE sends `['Not provided']` on factors it has
          nothing for — 16 of the 24 driver strings across the four starter
          captures. Rendered raw, that printed the producer's placeholder under
          a heading promising evidence. `meaningfulUncertaintyDrivers` is the
          SAME predicate the overconfidence check counts with, so this card and
          that coaching cannot disagree about what a driver is. */}
      {isDetailed && meaningfulDrivers.length > 0 && (
        <>
          <Sep />
          <p className={`${typography.edgeLabel} font-medium text-text-body m-0 mb-0.5`}>Uncertainty drivers:</p>
          {meaningfulDrivers.map((d, i) => (
            <p key={i} className={`${typography.edgeLabel} text-text-light m-0`}>{d}</p>
          ))}
        </>
      )}
    </>
  ) : null

  const confidenceRow = confidencePct != null && confidencePct > 0 ? (
    <div
      className="flex items-center gap-1.5"
      role="group"
      aria-label="Confidence"
      tabIndex={confidenceDisclosure ? 0 : undefined}
      data-node-tooltip={confidenceDisclosure ? true : undefined}
    >
      <span className={`${typography.edgeLabel} text-text-light w-14 shrink-0`}>Confidence</span>
      <div className="flex-1 min-w-0">
        <DataBar
          value={confidencePct / 100}
          label={confidenceDisclosure ? `Confidence. ${confidenceDisclosure}` : 'Confidence'}
          colour="info"
        />
      </div>
      <span className={`${typography.edgeLabel} text-text-light w-7 text-right shrink-0`}>{confidencePct}%</span>
      {displayMetadata.confidenceIsDefaulted && (
        <span
          className={`${typography.edgeLabel} text-text-light shrink-0`}
          aria-hidden="true"
          data-testid="factor-node-confidence-default-estimate"
        >
          *
        </span>
      )}
    </div>
  ) : null

  const postAnalysisLayer2 = isPostAnalysis ? (
    <>
      {/* Influence & Confidence bars */}
      {((isDetailed && driverLine !== null) || confidencePct != null && confidencePct > 0) && (
        <div className="space-y-1.5 mb-1">
          {/* Review fix 4: the detailed view renders the SAME display-model
              number as the Standard-view pill one level up, so it carries the
              same misread risk — on the fallback basis the top driver shows
              100% BY CONSTRUCTION. Disclose the basis through the shared
              hover/focus tooltip and the DataBar's accessible name (its
              role="progressbar" announces the value via aria-valuenow, so the
              name carries the basis only). Copy from the ONE shared module, so
              this row cannot drift from the pill or the panel. Fail-closed: no
              provenance means no influence number is rendered. */}
          {/* ⭐ ONE DRIVER VOCABULARY IN EVERY VIEW. Detailed and the popover
              render the SAME `FactorDriverLine` the resting face does ("Driver N
              of M analysed" + relative bar, the % in its tooltip), and it
              is withheld on a stale run exactly as it is there. The old
              "Most influential ▬ of 5" row here was the fourth wording of one
              rank (purpose audit, #1899 finding 3). */}
          {isDetailed && driverLine && (
            <FactorDriverLine
              nodeId={props.id}
              testId="factor-driver-line-detail"
              rank={driverLine.rank}
              value={driverLine.value}
              provenance={driverLine.provenance}
              importanceBasis={driverLine.importanceBasis}
              fromLastRun={resultsFromLastRun}
            />
          )}
          {/* Confidence — gated upstream by the shared display policy
              (components/results/driverConfidenceDisplayPolicy): `confidencePct`
              is null whenever the ruled policy says the figure is not fit to
              show, so this bar simply does not render. When the policy is
              flipped, any default/provisional disclosure travels WITH the
              number. No explanation means no tooltip or additional tab stop. */}
          {confidenceRow && (confidenceDisclosure ? (
            <Tooltip asChild delay={NODE_TOOLTIP_DELAY_MS} content={confidenceDisclosure}>
              {confidenceRow}
            </Tooltip>
          ) : confidenceRow)}
        </div>
      )}
      {/* ConnRows — max 3 whole rows in both PHASE views, remainder disclosed
          via "+N more in inspector" (audit §8 P0-5 containment).

              ⚠ "BOTH VIEWS" MEANS THE TWO PHASE VIEWS (pre- and post-analysis), NOT
              standard/detailed.

              ⛔⛔ AND THIS COMMENT HAS NOW BEEN WRONG IN BOTH DIRECTIONS ABOUT ONE
              BLOCK. It read: "This block only renders in DETAILED view." FALSE at
              this tip — `layer2Content` has TWO mounts:

                  :992   {isDetailed && layer2Content}                ← Detailed inline
                  :1031  {!isDetailed && isHighPriority && ( … )}     ← Standard hover popover

              so a factor ranked in the top three shows these rows in the DEFAULT
              view, on hover, with no view switch at all. On 12 Sep 2026 the
              OPPOSITE mis-reading ("not view-gated") cost a wrong derivation and a
              ROADMAP row withdrawn the same night — and the correction written to
              close that over-corrected past the second mount.

              ⭐ The lesson worth keeping: *a correction that flattens a two-mount
              distinction becomes the next session's confusion.* Name every mount or
              name none. The Detailed limb is reachable via the left sidebar's eye
              button, so it is P5 progressive disclosure; the popover limb is
              default-view and is not disclosure at all. */}
      {outboundConnections.length > 0 && (
        <>
          <Sep />
          <p className={`${typography.edgeLabel} font-medium text-text-body m-0 mb-0.5`}>Influences:</p>
          {outboundConnections.slice(0, 3).map(conn => (
            <ConnRow
              key={conn.edgeId}
              edgeId={conn.edgeId}
              nodeKind={conn.connectedNodeKind}
              label={conn.connectedNodeLabel}
              confidencePct={conn.confidencePct}
            />
          ))}
          <ConnRowsOverflow total={outboundConnections.length} shown={3} />
        </>
      )}
      {/* ⭐⭐ THE "KEY ASSUMPTION UNVALIDATED" NOTE IS DELETED, AND IT WAS THE
          WORST CLAIM LEFT ON A CARD.

          It read *"Key assumption unvalidated. Your result depends on this."*
          and fired on `sensitivityRank <= 2 && isInferred` — so the UI picked
          the cutoff for *key*, and then asserted a DEPENDENCY the producer
          never stated. Rank #2 of three factors and rank #2 of forty are not
          the same fact, and neither licenses "your result depends on this".

          ⛔ Its two true ingredients are both already rendered, so nothing is
          lost: provenance rides the evidence badge, and the rank is stated
          plainly by the inspector panels ("Ranked #N by sensitivity in this
          run"). What is gone is the verdict the card composed out of them —
          and one element off a factor body that carried ten. */}
    </>
  ) : null

  const layer2Content = isPostAnalysis ? postAnalysisLayer2 : preAnalysisLayer2

  /* The range is a TEXT line on the locked face (#1915 deviation 3). Once the
     user has stated a value the owner restates it as REPLACED ("Your value
     replaces the range a to b"), because the analysis no longer samples it —
     see `userValueReplacesPrior` (#1889). The turning-point precedence is
     unchanged (visual contract v3: a displaced range stays "disclosed as
     superseded, not plotted as active uncertainty"). The test id carries the
     node id (#1889) so a reader binds to THIS factor's line by identity.
     ONE renderer, two homes: the Detailed card body, and (ED 5809278282) the
     Standard popover — never both at once, since each is gated on the view. */
  const priorRangeShown =
    nodeCategory === 'external' && priorRangeDisplay !== null && (!turningPoint || isDetailed)
  const priorRangeLine = priorRangeShown ? (
    <div
      className={`${typography.edgeLabel} mt-1 text-text-light`}
      data-testid={`factor-prior-range-${props.id}`}
    >
      {priorRangeDisplay}
      {/* Point 1: a range that is the card's ONLY figure is never left
          unmarked — but it does NOT borrow the VALUE's mark. Who set a
          range is unknowable from the node: the inspector's quick-set
          (`setPriorRange`) writes `prior` with no stamp, so `est.` / "filled
          in for you" would label a person's judgement as Olumi's
          (`factorPriorRange.ts`: "drafted" is an attribution the node
          cannot support). It says so instead: "no source" / "Source not
          recorded". When a value line exists it carries the mark, and a
          user value restates this line as replaced — so never twice. */}
      {valueDisplay === null && (
        <> <ValueSourceMark mark={PRIOR_RANGE_SOURCE_MARK} testId={`factor-range-source-${props.id}`} /></>
      )}
    </div>
  ) : null

  /**
   * ⭐ WHERE THE S3 FINDINGS LIVE IN THE STANDARD VIEW NOW (ED 5809278282: "can
   * move to the existing hover/focus popover and inspector rather than
   * expanding layout geometry"). Exactly the lines the resting card used to
   * carry, in the same order and under the same gates — moved, not re-worded:
   *   · the `Needs input · Value not set yet` sentence (the card keeps the
   *     ruled word `Needs input`; this is the longer sentence);
   *   · `Driver N of M analysed` + its neutral bar, `Last run · ` when stale;
   *   · a FOUND turning point (Standard never shows the "none" fallback —
   *     ED 5806207128), `Last run · ` when stale;
   *   · the external prior-range line, with its `no source` mark when it is
   *     the only figure.
   * `null` in Detailed, where these stay inline on the card.
   */
  const needsInputSentenceMoved = !isDetailed && needsInput && valueDisplay === null
  // Row 10: Standard carries the pre-run line here (the card body is ONE row, ED 5809278282).
  const noAnalysisYetMoved = !isDetailed && noAnalysisYet
  const hasStandardFindings =
    !isDetailed &&
    (needsInputSentenceMoved || noAnalysisYetMoved || driverLine !== null || (turningPointShown && turningPointState !== null) || priorRangeLine !== null)
  const standardFindings = hasStandardFindings ? (
    <div data-testid={`factor-popover-findings-${props.id}`} className="mb-1">
      {noAnalysisYetMoved && (
        <p
          data-testid={`factor-popover-no-analysis-${props.id}`}
          className={`${typography.edgeLabel} text-text-light m-0`}
        >
          {FACTOR_NO_ANALYSIS_YET}
        </p>
      )}
      {needsInputSentenceMoved && (
        <p
          data-testid={`factor-popover-needs-input-${props.id}`}
          className={`${typography.edgeLabel} text-text-body m-0`}
        >
          Needs input &middot; Value not set yet
        </p>
      )}
      {driverLine && (
        <FactorDriverLine
          nodeId={props.id}
          rank={driverLine.rank}
          value={driverLine.value}
          provenance={driverLine.provenance}
          importanceBasis={driverLine.importanceBasis}
          fromLastRun={resultsFromLastRun}
        />
      )}
      {turningPointShown && turningPointState ? (
        <FactorTurningPointSlot
          nodeId={props.id}
          factorLabel={cleanedLabel}
          state={turningPointState}
          fromLastRun={resultsFromLastRun}
          factorUnit={typeof observedState?.value === 'number' ? (observedState.unit ?? null) : undefined}
        />
      ) : null}
      {priorRangeLine}
    </div>
  ) : null

  return (
    <div
      ref={nodeElRef as React.Ref<HTMLDivElement>}
      style={{ position: 'relative' }}
      onMouseEnter={nodeHandlers.onMouseEnter}
      onMouseLeave={nodeHandlers.onMouseLeave}
      /* The TAP path. A no-op on a pointer device (`usePopoverHover` gates it
         on `hover: none`); on touch it is the only way this node preview can
         be opened at all. It does not stopPropagation, so the tap still
         selects the node. */
      onClick={nodeHandlers.onClick}
    >
      {showEvidenceGapBadge && <EvidenceGapBadge label={cleanedLabel} escalation={gapEscalation} />}
      {/* The limit is the GOAL's (NODE-ANATOMY v3.2, Factor "Never on the card:
          a limit line (the boundary lives on the Goal)"); its corner badge is the
          same fact on the border, so the Standard face drops it too. Detailed
          keeps it. The constraint DATA is untouched. */}
      {isDetailed && constraintTooltip && <ConstraintBadge tooltip={constraintTooltip} />}
      {isAffectedByHover && (
        <div
          className="absolute -inset-1 rounded-md border-2 border-info pointer-events-none -z-10"
          style={{ boxShadow: '0 0 12px var(--info)' }}
        />
      )}
      {/* Keep the transient option setting outside the measured card body:
          hovering an option must not resize factors and relayout the model.
          The annotation remains readable without covering card controls. */}
      {isAffectedByHover && (
        <div
          data-testid="factor-hover-intervention"
          className={`${typography.nodeTitle} absolute bottom-full left-0 right-0 z-30 pointer-events-none text-info mb-1 bg-panel px-1.5 py-0.5 rounded border border-info/30`}
        >
          → {interventionDisplayValue}
        </div>
      )}
      <BaseNode
        {...props}
        data={{ ...cleanedData, controllability }}
        nodeType="factor"
        icon={metadata.icon}
        coaching={cardQuestion}
        resultsFromLastRun={resultsFromLastRun}
        // The body states the gap ("Needs input · Value not set yet"), so the
        // corner pill would say it twice, on the border (v3.2; gap U4's prop).
        incompleteStatedOnCard={needsInput}
        headerSlot={(() => {
          // Graph v1.1 Task 2: low-priority factors keep their identity cue
          // (fileQuestion for needs-input) but lose extra science icons in
          // Standard view. Detailed view always shows the full set. The
          // needs-input fileQuestion icon is preserved regardless of priority
          // because the truth table mandates it.
          //
          // The set held 'olumi-estimate' too until that icon was deleted: it
          // was the THIRD statement of "Olumi estimated this" on one factor
          // card, 99px from `node-provenance-mark`, drawn with the SAME lucide
          // Sparkles glyph. `node-provenance-mark` is the surviving one.
          //
          // ⭐ LOCKED DESIGN (23 Sep 2026): NO HEADER ICONS AT REST. The rail is
          // the ONE place for data icons (spec §2), and the icons it carries
          // are GROUNDED — a targeted VoI evidence gap, a producer bias finding
          // (`NodeSignalRailIcons`). These header icons are UI-computed hints
          // ("options clustered", "no observed data"), which the spec forbids
          // as resting behavioural cues (§7: "never add a UI-only behavioural
          // inference"); `Not set` already states the needs-input one (§2: do
          // not duplicate an explicit state). Detailed keeps the full set —
          // "Detailed adds information, not a bigger card".
          if (!isDetailed) return undefined
          const visibleIcons = scienceIcons
          if (visibleIcons.length === 0) return undefined
          return (
            <span className="inline-flex items-center gap-1">
              {visibleIcons.map(si => (
                <ScienceIcon key={si.id} icon={si.icon} tooltip={si.tooltip} action={si.action} colour={si.colour} />
              ))}
            </span>
          )
        })()}
      >
        {/* Intervention highlight when option hovered. Audit §8 P0-4: this
            annotation routes through the SINGLE intervention formatter so it
            can never contradict the option card's pills/popover for the same
            input. Formattable values render "→ 60%" / "→ £70,000"; factors
            with no real-world anchor fall back to directional language, and
            "Does not change …" fires ONLY on exact baseline equality (the old
            ±0.1 epsilon produced the live 0.5→0.6 contradiction). Never
            renders a bare arrow with no trailing text. */}
        {/* ===== LAYER 1: Standard body ===== */}

        {/* Value display (contextual) — null for needs-input and empty externals.
            R6: at REST an INFERRED value sheds its parenthesised raw number
            ("Moderate (0.5)" -> "Moderate") and carries ONE quiet `est.`
            marker instead of the stack of stamps S17 showed. Detailed view,
            the popover and the inspector keep the full string. A value the
            user stated is never collapsed — and, since Paul 23 Sep contract
            feedback point 1, it carries its OWN mark (`you`) rather than none,
            so "unmarked" never has to be read as "Olumi's". */}
        {/* ⭐ NODE-ANATOMY v3.2 line 2: `<value> <mark>` as plain text. No top
            margin — title → value is the header's 4px on every family (audit
            F6; RiskNode's value row is `m-0`).
            ⭐ ED 5809278282 (bounded anatomy): in STANDARD this is the card's
            ONE primary line. The row does not wrap (`flex-nowrap`): the mark
            sits in a `shrink-0 whitespace-nowrap` slot, so it can never drop
            to a second line or be cut, and nothing on the line is ellipsised —
            values are never cut. Only a value longer than the whole line would
            wrap, and then inside its own `min-w-0` span, with the mark still
            beside it. A ranked factor's neutral driver cue ends the line at the
            Normal rung (`driverCue`) — inline, never a row. Detailed keeps the
            wrapping row it had. */}
        {valueDisplay !== null && (
          <div
            className={isDetailed
              ? `${typography.nodeValue} text-text-body flex max-w-full flex-wrap items-baseline gap-x-1.5`
              : `${typography.nodeValue} text-text-body flex max-w-full min-w-0 flex-nowrap items-baseline gap-x-1.5`}
            data-testid="factor-recorded-value"
          >
            {/* ⭐⭐ EDITABLE ON THE GRAPH — and ONLY where an edit reaches the
                model. A controllable factor's value has a durable carrier
                (`factor_value_edit`); an observable factor's and a risk's do
                NOT, and the inspector fences them for exactly that reason. An
                editable-looking control on a value that cannot be sent would be
                the more convincing lie: the user would act on it. So the
                affordance follows the CARRIER, per writer, never per surface.

                ⚠⚠ AND THE SENTENCE ABOVE IS A BELIEF ABOUT CEE, NOT A
                DERIVATION — recorded 22 Sep 2026 so the next reader does not
                take it for one. Swept at this tip: `conversation/factorValueEdit.ts`
                contains **zero** references to `category`, `controllable` or
                `observable`, so the carrier this gate defers to does NOT
                distinguish them; `useResultsSectionData.ts` says the same in
                its own words — `proposeFactorValue` *"performs no kind check of
                its own"*. The restriction lives HERE and in
                `AUTHORITY_OWNING_PANELS`, and nothing in this repo derives it.

                ⛔ THE GATE IS DELIBERATELY LEFT CLOSED ANYWAY, and that is the
                point of writing this rather than opening it. "The carrier has
                no category check" is a fact about the CLIENT; whether CEE
                WRITES an observable factor's `observed_state.value` on a
                `factor_value_edit` is a fact about the SERVER, and it is
                unmeasured. Opening the gate on the client-side fact alone would
                ship exactly the control this comment warns about — one whose
                write may be silently dropped.

                What would settle it, asked on `olumi-programme-docs#63`: does
                CEE persist `observed_state.value` for a factor whose category
                is `observable` or `external`? If it does, this gate and
                `AUTHORITY_OWNING_PANELS`' omission of `factor-observable` can
                both open, and two of five factors on the canonical pricing
                board stop being read-only. If it does not, this sentence stops
                being a belief and becomes a derivation with a citation.

                ⚠ Seeded with an EXACT number — never from `valueDisplay`, which
                is a formatted readout. Seeding from a rounded string once
                committed 0.38 for a 0.376 and destroyed the producer's precision.

                ⛔ AND IN THE SCALE THE COMMIT READS IT IN (P0, #63 5810356214,
                wire-witnessed on `25314672`). This seeded `observedState.value`
                — MODEL scale — while `proposeFactorValue` reads the typed number
                through `resolveValueInputSeed`, which treats it as USER units
                whenever a `raw_value` exists. The card said "49 £/month", the
                field opened at 0.245, a nudge to 0.25 went out as £0.25 and was
                stamped the user's own value. The seed now comes from the SAME
                rule as the commit and every sibling editor
                (`WhatIWasGivenSection`, `CalibrateDrillIn`,
                `FactorControllablePanel`), so the no-op compare in
                `NodeValueEditor` is in that scale too. */}
            {nodeCategory === 'controllable' && typeof observedState?.value === 'number' ? (
              <span className="min-w-0">
                <NodeValueEditor
                  value={resolveValueInputSeed(props.data).seed ?? observedState.value}
                  readout={recordedValueReadout}
                  onCommit={(v, opts) => editAuthority.proposeFactorValue(v, opts)}
                  readCommittedValue={() =>
                    resolveValueInputSeed(useCanvasStore.getState().nodes.find(n => n.id === props.id)?.data).seed ?? null}
                  ariaLabel={`Value for ${props.data?.label ?? 'this factor'}`}
                  testId={`node-value-editor-${props.id}`}
                />
              </span>
            ) : (
              <span className="min-w-0 break-words">{recordedValueReadout}</span>
            )}
            {valueSourceMark !== null && (
              <span data-testid={`factor-value-mark-slot-${props.id}`} className="shrink-0 whitespace-nowrap">
                {renderValueSourceMark()}
              </span>
            )}
            {driverCue}
            {/* Row 10, Standard: the pre-run state in the line's accessible
                text; visible in the popover (`factor-popover-no-analysis-*`),
                never as a second body row (ED 5809278282). */}
            {noAnalysisYetMoved && (
              <span className={typography.screenReaderOnly} data-testid={`factor-no-analysis-sr-${props.id}`}>
                {FACTOR_NO_ANALYSIS_YET}
              </span>
            )}
          </div>
        )}
        {/* Row 10, Detailed ("adds information"): the pre-run state inline. */}
        {isDetailed && noAnalysisYet && (
          <p
            className={`${typography.edgeLabel} text-text-light m-0 mt-0.5`}
            data-testid={`factor-no-analysis-${props.id}`}
          >
            {FACTOR_NO_ANALYSIS_YET}
          </p>
        )}

        {/* ⭐ NODE-ANATOMY v3.2, Factor, missing: "`Needs input · Value not set
            yet` in the BODY, not a border pill" (contract `nodeHTML`:
            `.own-value` → `.state-word` Needs input + `Value not set yet`). The
            state takes line 2 — where a value would be — and BaseNode's corner
            pill is withheld through `incompleteStatedOnCard`, so the card says
            it ONCE (audit PILL-02: the corner pill straddled the top border and
            reached the connector glyph at landing zoom). Same `StatusPill`, same
            test id and accessible name the corner used, so "the card says Needs
            input" is still bound by identity.
            ⭐ ED 5809278282 (bounded anatomy): in STANDARD the row is ONE line
            — "Needs input · Value not set yet" is ~31 characters and the landing
            rung holds ~19 — so the card keeps the ruled word `Needs input`
            (explicit, never tooltip-only) and the sentence is the row's sr-only
            description and hover `title`, and is in the popover
            (`factor-popover-needs-input-{id}`). Detailed keeps both inline. */}
        {needsInput && valueDisplay === null && (isDetailed ? (
          <div
            className="flex max-w-full flex-wrap items-center gap-x-1.5 gap-y-0.5"
            data-testid={`factor-needs-input-row-${props.id}`}
          >
            <StatusPill label="Needs input" title="Missing required input" />
            <span className={`${typography.edgeLabel} text-text-light`}>Value not set yet</span>
          </div>
        ) : (
          <div
            className="flex max-w-full min-w-0 flex-nowrap items-center gap-x-1.5"
            data-testid={`factor-needs-input-row-${props.id}`}
            title="Needs input · Value not set yet"
          >
            <StatusPill label="Needs input" title="Missing required input" />
            <span className={typography.screenReaderOnly}>Value not set yet</span>
            {driverCue}
          </div>
        ))}

        {/* ⭐ THE TINY RELATIVE DRIVER VISUAL — a current run, or a known-changed
            model's last run LABELLED `Last run · ` (never-run / cannot-confirm
            hide it). ⭐ ED 5809278282: OFF THE STANDARD CARD BODY — it is in
            the popover (`standardFindings`), and the card keeps the inline
            `driverCue` on its primary line. Detailed renders the line once,
            inside its Layer 2 block (with the confidence row), so the rank is
            never stated twice on one card. */}
        {/* Contract v3.1 pt 5: no rank, no line, no bar — said once to AT, in
            both views. */}
        {driverNotRanked && <FactorDriverNotRanked fromLastRun={resultsFromLastRun} />}

        {/* ⭐ AT MOST ONE MINI-VISUAL (spec §3 precedence): a real turning point
            (PLoT `found`; current run, or the last run labelled), else a GENUINE range (the external
            factor's producer prior — never a fabricated fallback), else nothing.
            Detailed shows the range beside the turning point: it adds
            information, not a different card.
            ⭐ ED 5809278282: both lines are off the STANDARD card body — they
            are in the popover (`standardFindings`) under the same gates and
            precedence. Detailed keeps them here. */}
        {isDetailed && turningPointShown && turningPointState ? (
          <FactorTurningPointSlot
            nodeId={props.id}
            factorLabel={cleanedLabel}
            state={turningPointState}
            fromLastRun={resultsFromLastRun}
            // Contract "compatible units": checked only when the card shows a
            // value — an unvalued factor has no unit to disagree with.
            factorUnit={typeof observedState?.value === 'number' ? (observedState.unit ?? null) : undefined}
          />
        ) : null}
        {/* The range line — see `priorRangeLine` for its rules. */}
        {isDetailed && priorRangeLine}

        {/* ⭐⭐ EDGE PILLS — DIRECTION + STRENGTH + TARGET, AND THEY NO LONGER
            VANISH WHEN THE RESULT ARRIVES.
            This was `!isPostAnalysis && !needsInput`. So the moment an analysis
            completed, the card stopped saying that Pro Plan Price LOWERS churn
            and RAISES revenue — the only place the causal direction of an edge
            is visible on the card face. Layer 2 swaps to influence/confidence
            bars, and its `ConnRow` list is post-analysis, capped at 3, and
            reached only in the detailed view. So the standard-view card lost
            direction entirely.
            ⚠ THE TWO ARE NOT SUBSTITUTES AND THAT IS THE WHOLE POINT. A pill
            says what this factor DOES to a named target; an influence bar says
            how much it MATTERS. Trading one for the other at exactly the moment
            the user has most reason to read the model as a causal story is the
            same phase-swap defect as the option cards (#1413), one node kind
            over.
            ⚠ AND `!isDetailed` POST-ANALYSIS: the expert view's "Influences:"
            ConnRow list already carries these targets with more detail, so
            un-gating naively duplicated them — measured, it broke the
            containment case in `FactorNode.spec.tsx`. The repair is scoped to
            the STANDARD view, the one that had no substitute.
            ⚠ `!needsInput` IS DELIBERATELY KEPT. A factor with no value has no
            honest strength to announce — `EdgePills` already refuses to render
            a pill whose edge carries only `USER_EDGE_DEFAULTS`, and this gate is
            the same refusal one level up. Removing it would invent numbers. */}
        {/* ⭐⭐ MT-19 + LOCKED FACE: the pills are NOT on the resting face. Spec
            §3's Normal order has no relationship row; "key relationship(s)"
            are Detailed information, and the connectors themselves carry
            direction (colour/sign) on the board. In Detailed they say what they
            are — a visible verb, neutral ink, "Link strength" and `est.` for
            Olumi's estimate (see `EdgePills`). Post-analysis Detailed already
            lists these targets as "Influences:" rows, so the pills stay
            pre-analysis there, as before. */}
        {isDetailed && !needsInput && !isPostAnalysis && (
          <EdgePills nodeId={props.id} />
        )}

        {/* ⛔ THE POPOVER COPY OF THIS CHIP IS DELETED, NOT MOVED.
            `factorChips` was an if / else-if / else-if that could only ever
            push ONE chip, with the same three conditions and the same copy as
            `cardQuestion`. Once the card carries the question in both phases,
            the popover copy renders the SAME chip on the SAME card — and
            `FactorNode.spec` caught it immediately, with
            `getMultipleElementsFoundError` on "Help me estimate this".
            One question, one place. The popover keeps its other content. */}

        {/* ⛔ THE "Gather evidence" PROSE LINE IS OFF THE FACE (ED 11:52Z point 3:
            "repeated 'What's the evidence?' prose moves behind coaching"). The
            rail's coaching icon asks this card's question; a targeted evidence
            gap is the rail's evidence icon. */}

        {/* Post-analysis external: scenario link — high-priority only in
            Standard. Detailed always. */}
        {/* ⛔ ONE STRING. `counterfactualQuestion` is read by BOTH the label and
            the message — see that module for why. This block previously rendered
            `cleanedLabel.toLowerCase()` while sending the label un-lowercased,
            plus a trailing "How should I plan for that scenario?" that appeared
            nowhere on screen. The user read one question and asked another. */}
        {isPostAnalysis && nodeCategory === 'external' && isDetailed && counterfactualQuestion && (
          <p className={`${typography.edgeLabel} text-text-body mt-1 m-0`}>
            <button
              type="button"
              className={`${typography.edgeLabel} text-info underline cursor-pointer nodrag nopan`}
              onClick={(e) => {
                e.stopPropagation()
                if (counterfactualQuestion) useGuidanceStore.getState()._sendMessage?.(counterfactualQuestion)
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {counterfactualQuestion}
            </button>
          </p>
        )}

        {/* ⛔ NO `% influence` ROW AND NO METRIC PILLS AT REST (ED 11:52Z point 3:
            "staging still shows `Relative influence — 100%`, `74%` … no
            pseudo-precise `% influence` on the face"). The driver line above
            replaces the row; confidence is Detailed information (Layer 2 below)
            and in the popover. The % is moved into the driver line's tooltip,
            not deleted.

            ⛔ NO COACHING CHIP ROW. The card's one question is the rail's
            coaching icon (`coaching={cardQuestion}` on BaseNode) — the same
            chip, the same resolver, no extra row of height. */}

        {/* ===== LAYER 2: Detailed inline ===== */}
        {isDetailed && layer2Content}

        {/* Anchoring coaching (Detailed, pre-analysis) */}
        {anchoringMessage && (
          <CoachingCard
            severity="warning"
            message={`Option settings are close to ${anchoringMessage}. Explore a wider range?`}
            linkLabel="Explore a wider range"
            linkMessage={`What wider range of settings for ${cleanedLabel} would be worth exploring, and what constraints would rule it out?`}
          />
        )}

        {/* "View parameters" link (Detailed, post-analysis) */}
        {isDetailed && isPostAnalysis && (
          <button
            type="button"
            className={`${typography.edgeLabel} text-info underline cursor-pointer mt-1.5 nodrag nopan`}
            onClick={handleViewParams}
            onPointerDown={(e) => e.stopPropagation()}
          >
            View parameters
          </button>
        )}

      </BaseNode>

      {/* ===== LAYER 2: Popover (Standard view) =====
          Graph v1.1 Task 2: low-priority factors are visually quieted in
          Standard, so their full layer 2 (ConnRows, confidence, coaching lines)
          is suppressed in the popover; the user can promote the node by
          switching to Detailed view or selecting it in the inspector.

          Graph v2 Task 3: a low-priority controllable factor still gets the
          option-comparison table — a low-leverage cost factor that all options
          change differently is exactly where comparison helps. External
          factors stay suppressed (renderOptionValuesBlock's category check).

          ⭐ ED 5809278282 (bounded anatomy): the S3 findings that left the
          Standard card body (`standardFindings`) are what this popover opens
          with, and it mounts for them WHATEVER the factor's priority and in
          either phase — a moved line must stay reachable, and "quieted" was
          never a licence to drop a finding the run made about this factor. */}
      {!isDetailed && (isHighPriority || hasOptionValues || hasStandardFindings) && (
        <NodePopover
          visible={showPopover}
          width={240}
          onMouseEnter={popoverHandlers.onMouseEnter}
          onMouseLeave={popoverHandlers.onMouseLeave}
          anchorRef={nodeElRef}
        >
          {standardFindings}
          {isHighPriority && layer2Content}
          {renderOptionValuesBlock(isHighPriority || hasStandardFindings)}
        </NodePopover>
      )}

      {/* Coaching-chip popover for low-priority factors that have NO option
          comparison table to host the chip (external factors, needs-input,
          and inferred-controllable with no recorded option interventions).
          Without this branch the body would be the only home for the chip
          on these low-priority cases — but the brief is explicit that AI
          chips live in popovers, never in the body. */}
    </div>
  )
})

FactorNode.displayName = 'FactorNode'

/**
 * ⭐ THE NEUTRAL DRIVER CUE — the quiet reasoning signal a RANKED factor keeps at
 * rest once its driver wording moved to the popover (ED #63 5809278282: "At
 * Normal/Focused, keep a quiet reasoning signal visible at rest where one exists
 * (attention mark and neutral driver cue)").
 *
 *   · NO WORDS AND NO FIGURE. A fixed glyph, not the bar: the bar's length is a
 *     run-derived figure (% of the strongest factor), and a figure on the card
 *     would need a visible `Last run ·` it has no room for. The cue says only
 *     "the run ranked this factor"; the rank, its denominator and the bar are
 *     the popover's `FactorDriverLine` and the inspector's.
 *   · ITS NAME IS THE CAPTION, from the same `driverLineCaption` the popover's
 *     line prints, prefixed `Last run · ` when the model changed since the run —
 *     so AT and hover read exactly what the popover shows, never a second
 *     wording. The visible stale statement stays the popover's caption and the
 *     whole-graph stale cue; the name is not the only place it is said.
 *   · NEUTRAL INK (`text-text-light`): Info blue is the attention marker's
 *     channel (Paul 23 Sep contract feedback point 9 — the driver cue must not
 *     compete with attention). Counter-scaled like every canvas glyph.
 *   · INLINE, `shrink-0`, at the END of the primary line: it can never become a
 *     row, which is what keeps a `full`-rung card no taller than the same card
 *     at `quiet` (where the caller does not render it).
 */
function FactorDriverCue({
  nodeId,
  rank,
  fromLastRun,
}: {
  nodeId: string
  rank: { rank: number; setSize: number }
  fromLastRun: boolean
}) {
  const name = `${fromLastRun ? LAST_RUN_PREFIX : ''}${driverLineCaption(rank)}`
  return (
    <span
      role="img"
      aria-label={name}
      title={name}
      data-testid={`factor-driver-cue-${nodeId}`}
      data-from-last-run={fromLastRun ? 'true' : undefined}
      className="shrink-0 inline-flex items-center self-center text-text-light"
    >
      <BarChartHorizontal size={11} aria-hidden="true" className={CANVAS_GLYPH_SIZE_CLASSES[11]} />
    </span>
  )
}

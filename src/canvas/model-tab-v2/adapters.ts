/**
 * Model tab v2 — THE READ-ONLY STORE → PROJECTION ADAPTER.
 *
 * Maps LIVE canvas state onto the typed read projections in `types.ts`, so that
 * mounting this surface later is a wiring job rather than a design job.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT MAKES THIS SAFE TO EXIST WHILE UNMOUNTED
 *
 * ⚠ IT TAKES STATE AS AN ARGUMENT. It does NOT call `useCanvasStore()`, or any
 * other hook, anywhere. Every function here is a pure function of the slices it
 * is handed, so nothing subscribes, nothing fires, and nothing can run at all
 * until a caller chooses to call it. The eventual mount reads the store at the
 * component boundary and passes the slices in. `modelTabV2Boundary.sourceScan`
 * enforces this: hook INVOCATION is banned in this directory, while `import
 * type` and pure imports are allowed.
 *
 * ⚠ THE DIRECTION OF THE DEPENDENCY IS THE INVARIANT. namespace → live reads
 * are fine and are what this file is for. live → namespace imports are what
 * would constitute a mount, and there are none.
 *
 * ⚠ NO WRITES. No store mutator, no dispatch, no system event. Reading is the
 * whole job.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHERE THE CLASSIFICATION COMES FROM — and why almost none of it is written here
 *
 * A second hand-written "is this factor unconfirmed / is this edge contested"
 * would be a mirror of the live Model tab's answer, and a mirror drifts silently
 * green. So the rule for this file is: IMPORT the live resolver wherever one is
 * pure and exported, and where the live logic exists only INSIDE a component,
 * port it with attribution AND pin it against the live function in the specs.
 *
 * IMPORTED FROM THE LIVE TREE (no copy exists here):
 *   · `getCausalEdges`               — domain/edgeUtils
 *   · `classifyValueProvenance`      — domain/valueProvenance
 *   · `resolveEdgeValueDisplay`,
 *     `resolveEdgeDirectionDisplay`  — domain/edgeValueProvenance (the read-side
 *                                      gates: an unstamped value renders nothing
 *                                      and a direction is never inferred from a
 *                                      sign)
 *   · `getDirectionalStrengthLabel`  — model-tab/strengthBands
 *   · `getPrimaryValue`              — model-tab/utils
 *   · `getDisplayEdgeId`             — utils/edgeIdentity
 *
 * PORTED, because the live logic is not exported per-item:
 *   · `factorNeedsVerification` ← the filter body inside `countFactorsToVerify`
 *     (`model-tab/utils.ts:118-125`). Only the COUNT is exported, and a queue
 *     needs to know WHICH factors. ⚠ The port is pinned in
 *     `adapters.spec.ts` by asserting my per-factor predicate and the live
 *     COUNT agree over a corpus — so the copy cannot drift without a red.
 *   · `edgeIsContested` ← `RelationshipsSection.tsx:610`.
 *   · `optionHasNoInterventions` ← the `allUnmapped` body in
 *     `OptionsSection.tsx:441-446`.
 *
 * ⚠ NOT DERIVED FROM THE STORE, DELIBERATELY: the detail TIER. `plain` vs
 * `advanced` is a user preference, not model state; inventing it here would be
 * fabricating a fact the store does not hold.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THREE NAMED DIVERGENCES FROM THE LIVE TAB — stated, not smuggled
 *
 * Each of these is a place where "reuse the live source" has no single answer.
 * Naming them is the point: an unnamed divergence is how two surfaces end up
 * quietly disagreeing about the same model.
 *
 * D1 — TWO LIVE "NEEDS VERIFICATION" PREDICATES EXIST, AND THEY DISAGREE.
 *      `countFactorsToVerify` (utils.ts:118) is `!source || source ===
 *      'cee_inference'`. The factor SORT KEY in `ModelTabBody.tsx:492-493` is
 *      wider — it also flags an `external` factor carrying a full 0–1 prior
 *      range. Nothing reconciles them. This adapter follows the FIRST, because
 *      that is the one the "N to verify" badge and Queue B are counted from, and
 *      a queue that disagreed with its own chip is the defect being closed.
 *
 * D2 — `'no-value'` IS AUTHORED FRESH, NOT PORTED. There is no per-factor
 *      "has no value" predicate anywhere in the live tree. The Model card's
 *      "N factors have no value set" is a count of the PRODUCER's
 *      `ROOT_NODE_DEFAULT_VALUE` inference warnings
 *      (`ModelHealthSection.tsx:93-98`) — a different question, answerable only
 *      after an analysis has run. This adapter's `no-value` means "the client
 *      can display no value for this factor", derived from the live
 *      `getPrimaryValue` returning null. ⚠ The two will not always agree, and
 *      neither is wrong; they are answers to different questions (trap 21).
 *
 * D3 — FRAGILITY IS THE CALLER'S TO SUPPLY, AND THE THRESHOLD IS A TRAP.
 *      `buildFragileEdgeLookup` APPLIES the `switch_probability > 0.15` filter
 *      (`THRESHOLDS.FRAGILE_EDGE_FILTER`); the similarly-named
 *      `buildFragileEdgeIdSet` DOES NOT. A caller reaching for the Set builder
 *      by name-similarity would mark every listed edge fragile. Build
 *      `fragileEdgeIds` from the LOOKUP's keys, as `ModelTabBody.tsx:457-462`
 *      does.
 *
 * D4 — THE GOAL THRESHOLD HAS TWO LIVE CARRIERS AND THIS ADAPTER READS THE
 *      STORE ONE. `store.goalThreshold` (raw user units, with
 *      `goalThresholdRepresentation` tagging the exception) is what the run path
 *      uses; `GoalSection.tsx:81-98` instead reads a priority chain off the goal
 *      NODE's data (`threshold_source`, `success_threshold`,
 *      `goal_threshold_raw`, `goal_threshold`, `goal_threshold_unit`) — none of
 *      which is declared by `GoalNodeDataSchema` at all; they ride passthrough.
 *      The store scalar is the narrower, typed, single-writer carrier
 *      (`setGoalThresholdAndUpdateNode`), so it is what this projection reads —
 *      but a v2 goal row and today's goal card CAN disagree on a graph where the
 *      node keys and the scalar have drifted. Reconciling them is a question for
 *      whoever mounts this, not something to paper over here.
 */

import type { Edge, Node } from '@xyflow/react'
import type { EdgeData } from '../domain/edges'
import type { ObservedState } from '../domain/nodes'
// ⚠ The model-tab's NARROWER twin — see `narrowObservedState`. Both are imported
// deliberately and named apart, because conflating same-named twins is this
// estate's most expensive recurring defect.
import type { ObservedState as ModelTabObservedState } from '../components/model-tab/types'
import type { ValidationMetadata } from '../domain/validation'
import { getCausalEdges } from '../domain/edgeUtils'
import { resolveEdgeDirectionDisplay, resolveEdgeValueDisplay } from '../domain/edgeValueProvenance'
import { getDirectionalStrengthLabel } from '../components/model-tab/strengthBands'
import { getPrimaryValue, formatSmartNumber } from '../components/model-tab/utils'
import { getDisplayEdgeId } from '../utils/edgeIdentity'
import type {
  AttentionReason,
  ModelElementKind,
  ModelGroupId,
  ModelRow,
  ModelRowDetail,
  RepairQueue,
  RepairQueueItem,
} from './types'

/**
 * The slices this adapter reads. Deliberately NARROW rather than the whole
 * store: `CanvasState` is not exported from `src/canvas/store.ts` (it is a bare
 * `interface CanvasState` at :373), and naming only what is read means a reader
 * can see the adapter's entire blast radius in one type.
 */
export interface ModelProjectionInput {
  nodes: readonly Node[]
  edges: readonly Edge<EdgeData>[]
  /**
   * ⚠ RAW USER UNITS. The store's own contract: "every writer stores raw values
   * and every display reader treats it as raw" (`store.ts:383-388`). This
   * adapter is a display reader, so it never converts.
   */
  goalThreshold: number | null
  /**
   * Edge ids the robustness report marked fragile. Absent when no analysis has
   * run — which is a fact, not an empty result: with no analysis nothing is
   * KNOWN to be fragile, and no row should claim otherwise.
   *
   * ⚠ BUILD THIS FROM `buildFragileEdgeLookup(...).keys()`, NOT from
   * `buildFragileEdgeIdSet`. See divergence D3 in the file header: only the
   * lookup applies the `switch_probability > 0.15` threshold, and the two are a
   * name-similarity trap.
   */
  fragileEdgeIds?: ReadonlySet<string>
}

// ─────────────────────────────────────────────────────────────────────────────
// Kind + group
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The node kind, read the way the live tree reads it — `getCausalEdges`
 * (`domain/edgeUtils.ts:83-85`) resolves `n.type ?? data.kind ?? data.type`, and
 * disagreeing with that would put a node in a different group here than the
 * canvas puts it in.
 */
export function nodeKind(node: { type?: string; data?: unknown }): ModelElementKind | null {
  const data = node.data as { kind?: unknown; type?: unknown } | undefined
  const raw = (node.type ?? data?.kind ?? data?.type) as string | undefined
  switch (raw) {
    case 'goal':
    case 'decision':
    case 'option':
    case 'factor':
    case 'risk':
    case 'outcome':
      return raw
    default:
      // `action` and `constraint` are real `NodeTypeEnum` members with no v2
      // group. Returning null drops them EXPLICITLY rather than filing them
      // under a group they do not belong to.
      return null
  }
}

/** Total over the kinds this surface renders — a new kind is a type error. */
const KIND_GROUP: Record<ModelElementKind, ModelGroupId> = {
  goal: 'goal',
  decision: 'goal',
  option: 'options',
  factor: 'factors',
  risk: 'outcomes-risks',
  outcome: 'outcomes-risks',
  relationship: 'relationships',
}

// ─────────────────────────────────────────────────────────────────────────────
// Ported predicates — each pinned against its live original in the specs
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PORTED from the filter body of `countFactorsToVerify`
 * (`src/canvas/components/model-tab/utils.ts:118-125`), verbatim in behaviour:
 *
 *     const obs = data?.observedState ?? data?.observed_state
 *     return !obs?.source || obs?.source === 'cee_inference'
 *
 * ⚠ WHY A PORT AND NOT AN IMPORT: only the COUNT is exported, and a queue must
 * know WHICH factors, not how many. The copy is pinned in `adapters.spec.ts`
 * against the live `countFactorsToVerify` over a corpus, so a drift in either
 * direction turns that spec red rather than silently disagreeing with the badge.
 *
 * ⚠⚠ IF YOU MUTATION-TEST THIS FUNCTION, ANCHOR ON THE FUNCTION BODY, NOT ON THE
 * PREDICATE LINE. The comment above quotes the live source VERBATIM, so the
 * predicate text appears twice in this file and a first-occurrence replace edits
 * the COMMENT. That produced a FALSE SURVIVOR here once already: the file's hash
 * changed, the applied-check passed, and the mutant was inert — an unapplied
 * mutation is indistinguishable from an equivalent one unless the check proves
 * the CODE moved. Anchoring on the enclosing `export function …` block cannot
 * match a comment, and the mutant then bites six tests.
 *
 * ⚠ IT READS BOTH SPELLINGS. Canvas stores `observedState`; the CEE/PLoT wire
 * uses `observed_state`, and graphs carry both. Reading one would under-count.
 */
export function factorNeedsVerification(data: unknown): boolean {
  const d = data as Record<string, unknown> | undefined
  const obs = (d?.observedState ?? d?.observed_state) as Record<string, unknown> | undefined
  return !obs?.source || obs?.source === 'cee_inference'
}

/**
 * PORTED from `RelationshipsSection.tsx:610`:
 *     vm?.status === 'contested' && vm.user_action === 'pending'
 *
 * ⚠ BOTH CONJUNCTS MATTER. An edge whose disagreement has already been resolved
 * still carries `status: 'contested'`; it is `user_action === 'pending'` that
 * makes it OPEN. Dropping the second conjunct would refill Queue C with
 * decisions the user has already made — the same harm as the batch overruling a
 * deferral.
 */
export function edgeIsContested(data: unknown): boolean {
  const vm = (data as Record<string, unknown> | undefined)?.validation as
    | ValidationMetadata
    | undefined
  const v = vm as { status?: unknown; user_action?: unknown } | undefined
  return v?.status === 'contested' && v?.user_action === 'pending'
}

/**
 * PORTED from the `allUnmapped` body in `OptionsSection.tsx:441-446`, applied
 * per option rather than across all of them.
 */
export function optionHasNoInterventions(data: unknown): boolean {
  const interventions = (data as Record<string, unknown> | undefined)?.interventions as
    | Record<string, unknown>
    | undefined
  return !interventions || Object.keys(interventions).length === 0
}

// ─────────────────────────────────────────────────────────────────────────────
// Value display
// ─────────────────────────────────────────────────────────────────────────────

function observedStateOf(data: unknown): ObservedState | undefined {
  const d = data as Record<string, unknown> | undefined
  return (d?.observedState ?? d?.observed_state) as ObservedState | undefined
}

/**
 * Narrow the STORE's observed state to the shape the live `getPrimaryValue`
 * declares it accepts.
 *
 * ⚠ D5 — TWO `ObservedState` TYPES EXIST AND THEY ARE NOT THE SAME SHAPE. The
 * domain type (`domain/nodes.ts:146`, what the store actually holds) allows
 * `raw_value: string | number | null`; the model-tab type
 * (`model-tab/types.ts:10`, what `getPrimaryValue` is typed against) allows only
 * `raw_value?: number`. `FactorsSection.tsx:182` bridges the two with a CAST,
 * which is why nothing has caught it — but a cast is a declared assumption, not
 * a narrowing, and `getPrimaryValue` would hand a STRING to
 * `formatValueWithUnit(rawValue: number, …)` and print nonsense.
 *
 * This adapter narrows instead of casting: a non-numeric `raw_value` yields NO
 * displayable value rather than a fabricated one. That is a deliberate
 * divergence from the live surface and it fails in the honest direction — the
 * row says "not set" and the factor turns up in Queue D, instead of showing the
 * user a mangled number.
 */
function narrowObservedState(obs: ObservedState): ModelTabObservedState {
  const num = (v: unknown): number | undefined =>
    typeof v === 'number' && Number.isFinite(v) ? v : undefined
  const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)
  return {
    value: num(obs.value),
    raw_value: num(obs.raw_value),
    baseline: num(obs.baseline),
    unit: str(obs.unit),
    source: str(obs.source),
    cap: num(obs.cap),
  }
}

/**
 * A factor's displayed value, via the live `getPrimaryValue`. `null` means
 * nothing is stated — a fact to render, never a zero to invent.
 */
function factorValue(data: unknown): string | null {
  const obs = observedStateOf(data)
  if (!obs) return null
  return getPrimaryValue(narrowObservedState(obs))
}

/**
 * An edge's displayed value, through BOTH read-side gates.
 *
 * ⚠ THE GATES ARE THE POINT, AND THEY ARE NOT MINE. An unstamped weight renders
 * NOTHING rather than the UI default (`resolveEdgeValueDisplay`), and a
 * direction is never inferred from a sign (`resolveEdgeDirectionDisplay`). This
 * surface must not be the one place in the estate that re-fabricates what those
 * two resolvers exist to suppress — the Model tab printed "Strong positive
 * effect" over exactly that fabrication before they were written.
 */
function edgeValue(data: unknown): string | null {
  const bag = (data ?? undefined) as Record<string, unknown> | undefined
  const weight = resolveEdgeValueDisplay(bag, 'weight')
  if (!weight.show) return null

  const direction = resolveEdgeDirectionDisplay(bag)
  if (!direction.show) {
    // A magnitude with no stated direction is a magnitude, not an effect.
    return getDirectionalStrengthLabel(weight.value, direction)
  }
  const signed = direction.direction === 'negative' ? -weight.value : weight.value
  return getDirectionalStrengthLabel(signed, direction)
}

// ─────────────────────────────────────────────────────────────────────────────
// Rows
// ─────────────────────────────────────────────────────────────────────────────

function attentionForFactor(data: unknown, value: string | null): AttentionReason[] {
  const out: AttentionReason[] = []
  if (value === null) out.push('no-value')
  if (factorNeedsVerification(data)) out.push('unconfirmed-estimate')
  return out
}

/**
 * Build the outline's rows from live state.
 *
 * ⚠ ORDER IS THE CALLER'S NODE ORDER, then edges. The outline renders what it is
 * given without sorting (`ModelOutline`), so ordering decisions live in exactly
 * one place — here — and can be compared against what the canvas shows.
 */
export function toModelRows(input: ModelProjectionInput): ModelRow[] {
  const rows: ModelRow[] = []

  for (const node of input.nodes) {
    const kind = nodeKind(node)
    if (kind === null) continue
    const data = node.data as Record<string, unknown> | undefined
    const label = typeof data?.label === 'string' ? data.label : node.id

    if (kind === 'factor') {
      const value = factorValue(data)
      const obs = observedStateOf(data)
      rows.push({
        id: node.id,
        kind,
        group: KIND_GROUP[kind],
        label,
        primaryValue: value,
        provenanceSource: typeof obs?.source === 'string' ? obs.source : undefined,
        attention: attentionForFactor(data, value),
        editable: true,
      })
      continue
    }

    if (kind === 'goal') {
      rows.push({
        id: node.id,
        kind,
        group: KIND_GROUP[kind],
        label,
        // Raw user units — see `ModelProjectionInput.goalThreshold`.
        primaryValue: input.goalThreshold === null ? null : formatSmartNumber(input.goalThreshold),
        attention: input.goalThreshold === null ? ['no-value'] : [],
        editable: true,
      })
      continue
    }

    if (kind === 'option') {
      const unmapped = optionHasNoInterventions(data)
      const interventions = (data?.interventions ?? {}) as Record<string, unknown>
      const count = Object.keys(interventions).length
      rows.push({
        id: node.id,
        kind,
        group: KIND_GROUP[kind],
        label,
        primaryValue: unmapped ? null : `${count} ${count === 1 ? 'change' : 'changes'}`,
        attention: unmapped ? ['missing-intervention'] : [],
        editable: true,
      })
      continue
    }

    rows.push({
      id: node.id,
      kind,
      group: KIND_GROUP[kind],
      label,
      primaryValue: null,
      attention: [],
      // Risks and outcomes are read-only on today's Model tab: `setProbability`
      // and `setImpact` exist and nothing on the tab calls them (design §7.3).
      // The projection reports what is true now, not what the design proposes.
      editable: false,
    })
  }

  // Only causal edges are model relationships — the same filter the live tab
  // applies, imported rather than re-derived.
  for (const edge of getCausalEdges(
    input.nodes.map(n => ({ id: n.id, type: n.type, data: n.data })),
    input.edges as Edge<EdgeData>[],
  )) {
    const data = edge.data as Record<string, unknown> | undefined
    const attention: AttentionReason[] = []
    if (edgeIsContested(data)) attention.push('contested')
    if (input.fragileEdgeIds?.has(getDisplayEdgeId(edge))) attention.push('fragile')

    rows.push({
      id: edge.id,
      kind: 'relationship',
      group: 'relationships',
      label: typeof data?.label === 'string' ? data.label : `${edge.source} → ${edge.target}`,
      primaryValue: edgeValue(data),
      provenanceSource: typeof data?.weightSource === 'string' ? data.weightSource : undefined,
      attention,
      editable: true,
    })
  }

  return rows
}

// ─────────────────────────────────────────────────────────────────────────────
// Repair queues
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build one queue's items from live state.
 *
 * ⚠ EVERY QUEUE IS DERIVED FROM THE SAME PREDICATE AS ITS CHIP. That is the
 * whole reason the predicates above are shared rather than re-expressed per
 * queue: a badge and its queue that disagree is the defect the current tab
 * already ships, where "N to verify" counts factors the user cannot reach.
 */
export function toRepairQueueItems(
  input: ModelProjectionInput,
  queueId: RepairQueue['id'],
): RepairQueueItem[] {
  const factorNodes = input.nodes.filter(n => nodeKind(n) === 'factor')

  if (queueId === 'confirm-estimates') {
    return factorNodes
      .filter(n => factorNeedsVerification(n.data))
      .map(n => {
        const data = n.data as Record<string, unknown> | undefined
        return {
          rowId: n.id,
          label: typeof data?.label === 'string' ? data.label : n.id,
          currentValue: factorValue(data),
          // Confirming ratifies the value that is already there; it does not
          // propose a different one.
          suggestedValue: null,
          basis: typeof observedStateOf(data)?.source === 'string'
            ? `Source: ${observedStateOf(data)!.source}`
            : null,
        }
      })
  }

  if (queueId === 'no-value') {
    return factorNodes
      .filter(n => factorValue(n.data) === null)
      .map(n => {
        const data = n.data as Record<string, unknown> | undefined
        return {
          rowId: n.id,
          label: typeof data?.label === 'string' ? data.label : n.id,
          currentValue: null,
          suggestedValue: null,
          basis: null,
        }
      })
  }

  if (queueId === 'contested') {
    return getCausalEdges(
      input.nodes.map(n => ({ id: n.id, type: n.type, data: n.data })),
      input.edges as Edge<EdgeData>[],
    )
      .filter(e => edgeIsContested(e.data))
      .map(e => {
        const data = e.data as Record<string, unknown> | undefined
        return {
          rowId: e.id,
          label: typeof data?.label === 'string' ? data.label : `${e.source} → ${e.target}`,
          currentValue: edgeValue(data),
          suggestedValue: null,
          basis: 'Two validation passes disagree',
        }
      })
  }

  // 'set-option-values' — one item per OPTION lacking any intervention.
  // ⚠ Deliberately per-option, not per (option × factor): the design's Queue A
  // is per-pair, but the pair-level "which factors should this option change?"
  // is a judgement the store does not hold, and inventing one here would put
  // fabricated rows in front of the user. Per-option is what the data supports.
  return input.nodes
    .filter(n => nodeKind(n) === 'option' && optionHasNoInterventions(n.data))
    .map(n => {
      const data = n.data as Record<string, unknown> | undefined
      return {
        rowId: n.id,
        label: typeof data?.label === 'string' ? data.label : n.id,
        currentValue: null,
        suggestedValue: null,
        basis: 'This option does not change any factor yet',
      }
    })
}

// ─────────────────────────────────────────────────────────────────────────────
// Detail region
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the detail projection for one row, or `null` when the id is not in the
 * model.
 *
 * ⚠ `rowId` IS ECHOED FROM THE REQUEST AND THE LOOKUP IS BY ID. The detail
 * region asserts this against the row it was asked to describe and refuses on a
 * mismatch, so a lookup that quietly returned a neighbour would surface as a
 * visible refusal rather than a confident, wrong pane.
 */
export function toRowDetail(input: ModelProjectionInput, rowId: string): ModelRowDetail | null {
  const node = input.nodes.find(n => n.id === rowId)
  if (node) {
    const data = node.data as Record<string, unknown> | undefined
    const obs = observedStateOf(data)
    const secondary =
      obs?.baseline !== undefined && obs?.baseline !== null
        ? [{ label: 'Baseline', value: formatSmartNumber(obs.baseline) }]
        : []
    return {
      rowId,
      description: typeof data?.description === 'string' ? data.description : null,
      secondaryValues: secondary,
      basis: typeof obs?.source === 'string' ? `Source: ${obs.source}` : null,
      adjustments: [],
      affects: input.edges
        .filter(e => e.source === rowId)
        .map(e => ({ id: e.id, label: e.target })),
      advancedParameters: buildAdvancedForNode(node.id, obs),
    }
  }

  const edge = input.edges.find(e => e.id === rowId)
  if (!edge) return null
  const data = edge.data as Record<string, unknown> | undefined
  return {
    rowId,
    description: typeof data?.label === 'string' ? data.label : null,
    secondaryValues: [],
    basis: typeof data?.provenance === 'string' ? `Source: ${data.provenance}` : null,
    adjustments: [],
    affects: [{ id: edge.target, label: edge.target }],
    advancedParameters: buildAdvancedForEdge(edge.id, data),
  }
}

/** Advanced-tier parameters. Absent values render as absence, never as zero. */
function buildAdvancedForNode(id: string, obs: ObservedState | undefined) {
  return [
    { label: 'Node ID', value: id },
    {
      label: 'Normalised value',
      value: obs?.value !== undefined && obs?.value !== null ? String(obs.value) : null,
    },
    { label: 'Cap', value: obs?.cap !== undefined && obs?.cap !== null ? String(obs.cap) : null },
  ]
}

function buildAdvancedForEdge(id: string, data: Record<string, unknown> | undefined) {
  const std = data?.strengthStd
  const ep = data?.exists_probability
  return [
    { label: 'Edge ID', value: id },
    { label: 'Std', value: typeof std === 'number' ? String(std) : null },
    { label: 'Exists probability', value: typeof ep === 'number' ? String(ep) : null },
  ]
}

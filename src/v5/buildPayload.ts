/**
 * V5 outbound payload builder.
 *
 * Single source of truth for converting a `sendTurn` invocation into an
 * `OrchestratorTurnPayload` v0.7.0 discriminated union.
 *
 * Hard rules (see docs/v5/ui-outbound-payload-coverage.md):
 *   1. `kind: 'system_event'` payloads MUST NOT render a user bubble. The
 *      dispatcher in useConversation enforces this at the bubble-render site;
 *      this module's only job is to shape the wire payload.
 *   2. `chip` sub-object is present ONLY when `source` is 'chip' | 'chip_click'.
 *   3. `retry_of` is present ONLY when `source === 'retry'`.
 *   4. `direct_analysis_run` SystemEvent from the UI (not in V5 SystemEventKind)
 *      is mapped to a `kind: 'message'` payload with `chip.action_type: 'run_analysis'`.
 *      UI system events with no wire member still return null so callers can
 *      pre-filter (unsupported_system_event).
 *
 * CEE contract: @talchain/schemas. The authoritative UI pin is the
 * `@talchain/schemas` dependency in package.json; CEE pins its own copy and
 * the two can drift. Deliberately not naming a version here — version-naming
 * comments rot (this one already had, twice).
 */

import type {
  OrchestratorTurnPayload,
  MessageTurnPayload,
  SystemEventTurnPayload,
  StageType,
  TurnClassType,
  TurnSourceLiteral,
  ActionTypeLiteral,
  IntentLiteral,
} from '@talchain/schemas/boundary'
import { ActionType, Intent } from '@talchain/schemas/boundary'

import type { SystemEvent } from '../canvas/conversation/types'
// The endpoint-id rules are the CONTRACT's, defined once beside the capture
// that produces them — restating them here would be a mirror, and a drifted
// copy would put a 422-shaped id on the wire.
import { isCanonicalEndpointId } from '../canvas/mutations/structuralDelete'
import {
  isWireUsableLabel,
  isWireUsableNodeId,
  type StructuralRenameWireEvent,
} from '../canvas/mutations/structuralRename'
// ⚠ `isWireUsableNewNodeId` IS NOT `isWireUsableNodeId`. The add member mints an
// id and validates it against the NARROW `NodeV3Schema.shape.id` pattern; the
// rename member addresses an existing id and uses the OPEN endpoint schema. Two
// predicates, named apart on purpose — see `adaptStructuralAdd` below.
import {
  isWireUsableNewNodeId,
  WIRE_ADDABLE_NODE_KINDS,
  type StructuralAddWireEvent,
} from '../canvas/mutations/structuralAdd'
// VALUE import, and deliberately so: the selection this module puts on the wire
// must be the one the canvas holds AT SEND TIME, read at the moment the payload
// is built. Passing it in from useConversation would be purer, but the store is
// the single authority for what the user has selected and re-plumbing it through
// the call site adds a second place for the two to disagree. There is no import
// cycle: `canvas/store.ts` reaches this module only through a TYPE-only import
// of `v5/decisionReviewAdapter` (erased at compile time), and no value-import
// path from `canvas/store.ts` reaches `v5/buildPayload.ts` or
// `canvas/conversation/useConversation.ts` — derived by transitive closure over
// the 66 value-imported modules reachable from the store, not assumed.
import { useCanvasStore } from '../canvas/store'

export interface BuildV5PayloadInput {
  turnId: string
  scenarioId: string
  stage: StageType
  turnClass: TurnClassType
  /** 'user' for chat text / chip clicks / retries; 'system' for UI-initiated events */
  mode: 'user' | 'system'
  /** Required when mode === 'user'. Ignored for system events. */
  message?: string
  /** sendTurn source string. Maps to TurnSource. */
  source?: string | undefined
  /** Chip metadata forwarded by chip click handlers. */
  chipMeta?:
    | { id?: string; action_type?: string; intent?: string; parameters?: Record<string, unknown> }
    | undefined
  /**
   * Prior client_turn_id being retried. Today's UI reuses the prior
   * client_turn_id as the new turn's `turn_id`
   * (see useConversation.retryLast → sendTurn({retryClientTurnId})).
   * That path does NOT populate `retryOf` because `retry_of` would
   * equal `turn_id` and be redundant. The field is kept here for
   * future use if the retry flow ever switches to allocating a new
   * turn_id while referencing the prior one.
   *
   * ⚠ THIS DOES NOT BUY IDEMPOTENCY, AND THIS COMMENT USED TO SAY IT DID
   * ("for idempotent replay"). Corrected at CEE's bytes, ROADMAP 2.665,
   * staging `0ecf5c67`: CEE's commit idempotency key IS `(scenario_id,
   * turn_id)`, but the `turn_id` it writes is CEE's OWN per-HTTP-request id
   * — `turn-executor.ts` passes `turn_id: requestId` / `turn_id:
   * context.request_id`, and `getOrGenerateRequestId` mints a fresh UUID
   * whenever the request carries no `x-request-id` / `x-cee-request-id` /
   * `x-correlation-id` header. This client sends none of them
   * (`v5/turnAuthHeaders.ts` emits only `X-User-Id` + `Authorization`), and
   * CEE never reads `payload.turn_id` as a dedupe key at all. Two sends of
   * the same ask therefore commit TWO rows. Reusing the id is still useful
   * for correlation and for the client's own bookkeeping — it is simply not
   * a duplicate-write defence, and must not be relied on as one.
   */
  retryOf?: string | undefined
  /** Required when mode === 'system'. Internal SystemEvent shape. */
  systemEvent?: SystemEvent | undefined
}

export type BuildV5PayloadResult =
  | { ok: true; payload: OrchestratorTurnPayload }
  | {
      ok: false
      /**
       * `unencodable_graph_edit` (F6): a batch `direct_graph_edit` event whose
       * ids yield no encodable representative target. Distinct from
       * `unsupported_system_event` because it is RETRYABLE — the caller should
       * route it through the failed-event path, never drop it silently.
       */
      reason: 'missing_message' | 'unsupported_system_event' | 'unencodable_graph_edit'
      /** True when re-issuing the same action could succeed (F6 retryable path). */
      retryable?: boolean
      detail?: string
    }

/**
 * Convert a sendTurn invocation into the v0.7.0 wire payload.
 *
 * Returns `{ ok: false }` when the input cannot be safely serialised (e.g.
 * an unsupported system event that CEE would 422). Callers should surface
 * a typed error to the user rather than send a malformed request.
 */
export function buildV5Payload(input: BuildV5PayloadInput): BuildV5PayloadResult {
  const { turnId, scenarioId, stage, turnClass, mode } = input

  if (mode === 'system') {
    return buildSystemEventPayload(input)
  }

  const message = input.message ?? ''
  if (message.trim().length === 0) {
    return { ok: false, reason: 'missing_message' }
  }

  // Send gate (two independent signals, applied BEFORE source derivation):
  // CEE ingress validates action_type FAIL-CLOSED, so a value CEE does not
  // accept would 422 the whole turn. sanitiseActionType requires BOTH that the
  // value is published in OUR vendored enum (KNOWN_ACTION_TYPES) AND that CEE's
  // deployed service accepts it (CEE_ACCEPTED_ACTION_TYPES) — never our own
  // publication alone, which says nothing about whether CEE accepts it. A value
  // failing either signal is withheld entirely — no action_type key AND no
  // chip_click promotion — so the turn behaves exactly like today's
  // identity-only chip until the value is BOTH re-vendored and accepted.
  const wireActionType = sanitiseActionType(input.chipMeta?.action_type)
  // The typed authored intent (0.22 `chip.intent`) rides the SAME two-signal
  // gate discipline as action_type: published in OUR vendored enum AND accepted
  // by CEE's deployed service. `add_option` is the only value CEE currently
  // routes (see CEE_ACCEPTED_INTENTS); every other intent is withheld and the
  // chip behaves exactly like today's identity-only chip until CEE confirms it.
  const wireIntent = sanitiseIntent(input.chipMeta?.intent)

  // Derive source: chipMeta presence with a PUBLISHED action_type signals a
  // bound chip click regardless of what the caller labelled it. Keeps
  // downstream CEE routing accurate when the UI's sendChip path currently
  // passes source='chip' uniformly (see useConversation.dispatchAction).
  // Retry is always honoured over chip-derivation so retryLast() still hits
  // the retry branch on the CEE side.
  const rawSource = input.source
  const hasBoundAction = Boolean(wireActionType) || rawSource === 'chip_click'
  const effectiveSource =
    rawSource === 'retry'
      ? 'retry'
      : hasBoundAction
        ? 'chip_click'
        : input.chipMeta
          ? 'chip'
          : rawSource
  const source = normaliseMessageSource(effectiveSource)

  const base: MessageTurnPayload = {
    kind: 'message',
    turn_id: turnId,
    scenario_id: scenarioId,
    stage,
    turn_class: turnClass,
    message,
    source,
  }

  // Chip sub-object — only on chip / chip_click sources. Carries the first-class
  // chip `id`, the gate-passed (published AND CEE-accepted) `action_type` and
  // `intent`, and the identity `parameters` (which always travel). Key order
  // mirrors the 0.22 schema (id, action_type, intent, parameters).
  if ((source === 'chip' || source === 'chip_click') && input.chipMeta) {
    const parameters = input.chipMeta.parameters
    const id = input.chipMeta.id
    base.chip = {
      ...(id ? { id } : {}),
      ...(wireActionType ? { action_type: wireActionType } : {}),
      ...(wireIntent ? { intent: wireIntent } : {}),
      ...(parameters ? { parameters } : {}),
    }
  }

  // retry_of — only on retry source and only when an explicit prior id is
  // provided. Current UI retry reuses the same client_turn_id and relies on
  // CEE idempotency, so retry_of is typically unset; wired defensively here
  // for future use without changing today's retry semantics.
  if (source === 'retry' && input.retryOf) {
    base.retry_of = input.retryOf
  }

  // selected_elements — what the user had selected on the canvas at send time.
  // Omitted (absent, never `[]`) when there is nothing to say. See
  // `deriveSelectedElements` for every reason a selection can be withheld.
  const selectedElements = deriveSelectedElements()
  if (selectedElements !== undefined) {
    base.selected_elements = selectedElements
  }

  return { ok: true, payload: base }
}

/**
 * The contract's cap on `selected_elements` (`MAX_SELECTED_ELEMENTS` in
 * @talchain/schemas `turn-payload.ts`).
 *
 * ⚠ A HAND-MAINTAINED MIRROR OF A CONTRACT CONSTANT — the exact defect class
 * that shipped `applied_from` dark. It is a literal here rather than read out of
 * the Zod schema at runtime because unwrapping `_def.innerType._def.maxLength`
 * in PRODUCTION code binds the send path to zod's private internals, which move
 * between minor versions; a wrong read there would drop selection on every turn.
 * The drift is closed on the TEST side instead: `selectionCarriage.spec.ts`
 * derives the cap from the published schema and REDs if this number stops
 * matching it. Exported solely so that guard can see it.
 *
 * Direction of the failure if it ever does drift: a cap that is too HIGH sends
 * an over-long array and 422s the turn; too LOW silently withholds selection on
 * large selections. Both are visible to the guard before they are visible to a
 * user.
 */
export const MAX_SELECTED_ELEMENTS = 20

/**
 * Read the live canvas selection and shape it as the contract's typed refs.
 *
 * WHY THIS EXISTS: the selection lived in the store and stopped there. The only
 * UI code that ever emitted `selected_elements` was the V4 request builder,
 * which posts to the 410'd v1 route and cannot execute under the deployed
 * `VITE_ENABLE_V5_ORCHESTRATOR="true"` bake — so a user pointing at a node and
 * asking "why does this matter?" sent a turn that never named the node.
 *
 * ⚠ TWO DIFFERENTLY-SHAPED FIELDS SHARE THIS NAME, and picking the wrong one
 * is silent. The V4/extension shape is `{node_ids?, edge_ids?}`; the V5
 * message-turn shape published at our pin is `Array<{id, kind, label?}>`, capped
 * at 20. This builds the V5 shape, because that is what
 * `MessageTurnPayloadSchema` — the `.strict()` schema this payload is validated
 * against — declares.
 *
 * ⚠ THE PARAGRAPH THAT USED TO CLOSE THIS BLOCK IS STALE AND IS REPLACED. It
 * read: *"CEE's ingress still mirrors the V4 shape and drops an array-of-refs
 * best-effort; that is a CEE-side widening, tracked as hop 3 of this slice.
 * Until it lands, this field is carried and not consumed."* HOP 3 HAS LANDED.
 * Verified at CEE staging `d5455355` (1 Sep 2026): `SelectedElementsIngressSchema`
 * (`src/orchestrator-v5/boundary/request-extensions.ts:172`) is a union whose
 * FIRST branch is `z.array(SelectedElementRefSchema)` — the published V5 ref
 * array this builder emits, imported from the contract rather than restated —
 * so the array-of-refs is now PARSED AND CONSUMED, not dropped. `buildTurnContext`
 * resolves those ids against the persisted graph into groundable answering
 * context (`EnrichedTurnContext.selection`), which is the same selection
 * `_grounded_selection` is later projected from.
 *
 * Read the consequence, not just the correction: this field is USER-REACHABLE
 * now. A change to what it carries changes what CEE grounds an answer in and
 * what the answer footer names — it is no longer inert on the wire.
 *
 * Returns `undefined` — i.e. the key is ABSENT — rather than an empty array
 * whenever the client has nothing truthful to say:
 *
 *   · nothing selected;
 *   · an edge whose opaque React Flow id no longer resolves to an exact live
 *     edge. The wire identity for a relationship is its existing canonical
 *     endpoint composite (`from→to`), never the UI-local edge id and never a
 *     neighbouring/fuzzy substitute;
 *   · a selected id with no matching node — a stale selection over a deleted
 *     node. `kind` is REQUIRED by the contract and there is nothing truthful to
 *     put in it, so the ref is dropped rather than invented;
 *   · a node carrying no `type` — same reason, no fabricated kind;
 *   · a selection LARGER than the contract cap. Sending 20 of 34 would be a
 *     false statement about what the user selected, and CEE would ground an
 *     answer in a selection that never existed. Absence says nothing; a silent
 *     truncation says something wrong.
 *
 * Order is the STORE'S NODE ORDER followed by STORE EDGE ORDER, not either
 * selection Set's iteration order, so the payload is a pure function of the
 * selected SETS.
 */
function deriveSelectedElements(): MessageTurnPayload['selected_elements'] | undefined {
  // Defensive read: this is the one place the wire builder depends on store
  // shape, and a selection-less store (an early boot, a test that stubbed the
  // store) must degrade to "no selection", never throw on the send path.
  const state = useCanvasStore.getState()
  const selectedNodeIds = state?.selection?.nodeIds
  const selectedEdgeIds = state?.selection?.edgeIds
  const selectedNodeCount = selectedNodeIds?.size ?? 0
  const selectedEdgeCount = selectedEdgeIds?.size ?? 0
  if (selectedNodeCount + selectedEdgeCount === 0) return undefined
  if (selectedNodeCount + selectedEdgeCount > MAX_SELECTED_ELEMENTS) return undefined

  const refs: NonNullable<MessageTurnPayload['selected_elements']> = []
  for (const node of state.nodes ?? []) {
    if (!selectedNodeIds?.has(node.id)) continue
    const kind = typeof node.type === 'string' ? node.type.trim() : ''
    if (kind.length === 0) continue
    const rawLabel = (node.data as { label?: unknown } | undefined)?.label
    const label = typeof rawLabel === 'string' ? rawLabel.trim() : ''
    // `label` is optional on the contract and `.min(1)` when present — omit it
    // rather than send an empty string, which would 422 the whole turn.
    refs.push(label.length > 0 ? { id: node.id, kind, label } : { id: node.id, kind })
  }

  // UI-SEM-094: React Flow edge ids are producer-local UI identity, while the
  // existing CEE relationship-address grammar is the exact endpoint composite.
  // Resolve ONLY the selected id against the live edge collection, then convert
  // that same edge's endpoints. A stale id or unencodable endpoint fails closed
  // by omission; no array-head, neighbouring-edge, label, or fuzzy fallback.
  for (const edge of state.edges ?? []) {
    if (!selectedEdgeIds?.has(edge.id)) continue
    const source = typeof edge.source === 'string' ? edge.source.trim() : ''
    const target = typeof edge.target === 'string' ? edge.target.trim() : ''
    if (
      source.length === 0 ||
      target.length === 0 ||
      source.includes('→') ||
      source.includes('->') ||
      target.includes('→') ||
      target.includes('->')
    ) {
      continue
    }
    refs.push({ id: `${source}→${target}`, kind: 'edge' })
  }

  return refs.length > 0 ? refs : undefined
}

function buildSystemEventPayload(input: BuildV5PayloadInput): BuildV5PayloadResult {
  const { turnId, scenarioId, stage, systemEvent } = input
  if (!systemEvent) {
    return { ok: false, reason: 'unsupported_system_event', detail: 'no systemEvent provided' }
  }

  const payload: SystemEventTurnPayload | null = systemEventToPayload({
    turnId,
    scenarioId,
    stage,
    systemEvent,
  })

  if (payload === null) {
    // Some UI SystemEvent types map to kind='message' (direct_analysis_run)
    // rather than a system_event, or have no wire member at all. Handle the
    // analysis case here; return unsupported for anything else.
    if (systemEvent.type === 'direct_analysis_run') {
      return buildDirectAnalysisRunMessage(input)
    }
    if (systemEvent.type === 'direct_graph_edit') {
      // F6: the direct_graph_edit adapter (systemEventToPayload, below) returns
      // null ONLY when a batch has no encodable representative target (e.g. all
      // changed-id lists empty). That is NOT "unsupported" — it is a RETRYABLE
      // failure. Surface it so the send leg routes it through the failed-event
      // path rather than dropping it silently or fabricating a target.
      return {
        ok: false,
        reason: 'unencodable_graph_edit',
        retryable: true,
        detail: 'direct_graph_edit batch had no encodable representative target (empty changed ids)',
      }
    }
    return {
      ok: false,
      reason: 'unsupported_system_event',
      detail: `type=${String(systemEvent.type)}`,
    }
  }

  return { ok: true, payload }
}

function systemEventToPayload(args: {
  turnId: string
  scenarioId: string
  stage: StageType
  systemEvent: SystemEvent
}): SystemEventTurnPayload | null {
  const { turnId, scenarioId, stage, systemEvent } = args
  const { type, payload: eventPayload } = systemEvent
  const base = { kind: 'system_event' as const, turn_id: turnId, scenario_id: scenarioId, stage }

  switch (type) {
    case 'patch_accepted': {
      const patch_id = stringField(eventPayload, 'patch_id')
      if (!patch_id) return null
      return { ...base, event: { kind: 'patch_accepted', patch_id } }
    }
    case 'patch_dismissed': {
      const patch_id = stringField(eventPayload, 'patch_id')
      if (!patch_id) return null
      return { ...base, event: { kind: 'patch_dismissed', patch_id } }
    }
    case 'direct_graph_edit': {
      const event = adaptDirectGraphEdit(eventPayload)
      if (event === null) return null
      return { ...base, event }
    }
    case 'factor_value_edit': {
      const event = adaptFactorValueEdit(eventPayload)
      if (event === null) return null
      return { ...base, event }
    }
    case 'edge_adjudication': {
      const event = adaptEdgeAdjudication(eventPayload)
      if (event === null) return null
      return { ...base, event }
    }
    case 'prior_range_edit': {
      const event = adaptPriorRangeEdit(eventPayload)
      if (event === null) return null
      return { ...base, event }
    }
    case 'structural_delete': {
      const event = adaptStructuralDelete(eventPayload)
      if (event === null) return null
      return { ...base, event }
    }
    case 'structural_rename': {
      const event = adaptStructuralRename(eventPayload)
      if (event === null) return null
      return { ...base, event }
    }
    case 'structural_add': {
      const event = adaptStructuralAdd(eventPayload)
      if (event === null) return null
      return { ...base, event }
    }
    case 'feedback_submitted': {
      // F7 (feedback thumbs = wire): map the UI's optimistic thumbs event onto
      // the typed 0.22 `feedback` system event. The emitter
      // (ConversationPanel.handleFeedback) sends { turn_id, rating } for a
      // whole-turn rating, so target.kind is 'turn' and target.id is the turn
      // id. rating is fail-closed to the schema enum: anything but 'up'/'down',
      // or a missing turn id, returns null -> unsupported, never a wire 422.
      const rating = stringField(eventPayload, 'rating')
      const target_id = stringField(eventPayload, 'turn_id')
      if ((rating !== 'up' && rating !== 'down') || !target_id) return null
      return {
        ...base,
        event: { kind: 'feedback', rating, target: { id: target_id, kind: 'turn' } },
      }
    }
    // V5 schema includes chip_click, undo, redo — not currently emitted by
    // the UI as SystemEvent.type (no WireSystemEventType entries). Kept
    // here for forward compatibility: when the UI adds those event types,
    // their payload shape will slot in.
    default:
      return null
  }
}

function buildDirectAnalysisRunMessage(input: BuildV5PayloadInput): BuildV5PayloadResult {
  // UI's `direct_analysis_run` system event corresponds to V5's
  // `run_analysis` handler, which ingests a kind='message' turn with
  // chip.action_type='run_analysis'. See docs/v5/ui-outbound-payload-coverage.md
  // row "Explicit run-analysis button".
  const payload: MessageTurnPayload = {
    kind: 'message',
    turn_id: input.turnId,
    scenario_id: input.scenarioId,
    stage: input.stage,
    turn_class: input.turnClass,
    message: input.message && input.message.trim().length > 0 ? input.message : 'Run analysis',
    source: 'chip_click',
    chip: { action_type: 'run_analysis' },
  }
  return { ok: true, payload }
}

function normaliseMessageSource(source: string | undefined): TurnSourceLiteral {
  switch (source) {
    case 'chip':
      return 'chip'
    case 'chip_click':
      return 'chip_click'
    case 'retry':
      return 'retry'
    default:
      return 'composer'
  }
}

// Narrow an optional unknown field to a string, returning '' if absent/empty.
// Keep the branch explicit so nullish vs empty-string errors surface clearly.
function stringField(src: Record<string, unknown> | undefined, key: string): string {
  if (!src) return ''
  const val = src[key]
  return typeof val === 'string' && val.length > 0 ? val : ''
}

// Narrow an optional unknown field to an array of non-empty strings.
function stringArrayField(src: Record<string, unknown> | undefined, key: string): string[] {
  if (!src) return []
  const val = src[key]
  if (!Array.isArray(val)) return []
  return val.filter((v): v is string => typeof v === 'string' && v.length > 0)
}

// The wire `direct_graph_edit` event (0.22), derived from the vendored schema
// so the shape here can never drift from what `OrchestratorTurnPayloadSchema`
// will accept.
type DirectGraphEditWireEvent = Extract<
  SystemEventTurnPayload['event'],
  { kind: 'direct_graph_edit' }
>

// The wire `factor_value_edit` event (0.29), derived from the vendored schema
// for the same reason — NEVER hand-rolled. The union is a discriminated union of
// `.strict()` members, so a hand-typed shape that drifted by one field name
// would be rejected wholesale at CEE's ingress rather than partially accepted.
type FactorValueEditWireEvent = Extract<
  SystemEventTurnPayload['event'],
  { kind: 'factor_value_edit' }
>

// The wire judgement events (0.34, P4 transport) — derived, never hand-rolled,
// same reason as above.
type EdgeAdjudicationWireEvent = Extract<
  SystemEventTurnPayload['event'],
  { kind: 'edge_adjudication' }
>
type PriorRangeEditWireEvent = Extract<
  SystemEventTurnPayload['event'],
  { kind: 'prior_range_edit' }
>
/** The durable removal (0.48.0) — derived, never hand-rolled, same reason. */
type StructuralDeleteWireEvent = Extract<
  SystemEventTurnPayload['event'],
  { kind: 'structural_delete' }
>

// Narrow an optional unknown field to a FINITE number, or undefined.
// Deliberately NOT `Number(x) || 0`: a 0 fallback is indistinguishable from a
// genuine 0 on the wire, and for this event absence and zero mean different
// things (see adaptFactorValueEdit). NaN/Infinity are treated as absent, never
// serialised — `JSON.stringify(NaN)` is `null`, which would reach CEE as a type
// error rather than as the omission it actually is.
function finiteNumberField(
  src: Record<string, unknown> | undefined,
  key: string,
): number | undefined {
  if (!src) return undefined
  const val = src[key]
  return typeof val === 'number' && Number.isFinite(val) ? val : undefined
}

// `fields_changed` arrives from the real emitter (useGraphEditEvents.ts) as a
// MAP (element id → touched field names). The 0.22 wire types `fields_changed`
// as a flat string[] that "names the touched fields" — no id association.
// Flatten DETERMINISTICALLY: the sorted, de-duplicated UNION of every element's
// field names. Non-map / malformed input yields [].
function flattenFieldsChangedToNames(src: Record<string, unknown> | undefined): string[] {
  if (!src) return []
  const raw = src['fields_changed']
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return []
  const names = new Set<string>()
  for (const value of Object.values(raw as Record<string, unknown>)) {
    if (!Array.isArray(value)) continue
    for (const field of value) {
      if (typeof field === 'string' && field.length > 0) names.add(field)
    }
  }
  return [...names].sort()
}

/**
 * F6 — batch `direct_graph_edit` → 0.22 wire adapter.
 *
 * The UI's REAL debounced emitter (src/canvas/conversation/useGraphEditEvents.ts,
 * the `sendSystemEvent({ type: 'direct_graph_edit', payload })` call) emits a
 * BATCH payload — `{ changed_node_ids, changed_edge_ids, operations,
 * fields_changed (a MAP), summary }` — and NO singular `target_id` / `operation`.
 * The vendored 0.22 `DirectGraphEditEvent` STILL REQUIRES the singular
 * `{ target_id, operation }` pair (back-compat for consumers on an older pin)
 * and accepts the batch fields ADDITIVELY, typing `fields_changed` as string[]
 * (not a map). Before this adapter the singular-only read returned null, the
 * turn was never built, and real batch edits were silently discarded.
 *
 * This adapter (a) derives a DETERMINISTIC representative singular pair and
 * (b) carries the additive batch fields, converting `fields_changed` map →
 * string[]. It returns null ONLY when no representative target is encodable
 * (empty ids); the caller turns that into a RETRYABLE failure. It NEVER
 * fabricates a target.
 *
 * Representative-choice rule (documented here because it cannot be read off the
 * wire shape alone, and MUST be deterministic):
 *   • target_id = an explicit `target_id` if the caller supplied one (a direct
 *     singular caller / back-compat), else the FIRST changed id in stable
 *     order — `changed_node_ids` (sorted ascending) take precedence over
 *     `changed_edge_ids` (sorted ascending). In words: "first changed node,
 *     else first changed edge".
 *   • operation = an explicit `operation` if supplied, else `operations[0]`
 *     (sorted ascending) — the batch's first operation verb. The wire batch
 *     carries only the SET of operations (no per-id map), so this describes the
 *     batch, not necessarily `target_id`'s own op. It is a stable representative.
 *
 * Ids and the `operations` array are sorted defensively so the wire output is a
 * pure function of the input SET, independent of the caller's array order.
 */
function adaptDirectGraphEdit(
  eventPayload: Record<string, unknown> | undefined,
): DirectGraphEditWireEvent | null {
  const changedNodeIds = [...stringArrayField(eventPayload, 'changed_node_ids')].sort()
  const changedEdgeIds = [...stringArrayField(eventPayload, 'changed_edge_ids')].sort()
  const operations = [...stringArrayField(eventPayload, 'operations')].sort()
  const fieldsChanged = flattenFieldsChangedToNames(eventPayload)
  const summary = stringField(eventPayload, 'summary')

  const explicitTarget = stringField(eventPayload, 'target_id')
  const explicitOperation = stringField(eventPayload, 'operation')

  const target_id = explicitTarget || changedNodeIds[0] || changedEdgeIds[0] || ''
  const operation = explicitOperation || operations[0] || ''

  // Unencodable: no representative target/operation (e.g. empty ids). Signal
  // null so the caller raises a RETRYABLE failure. NEVER fabricate a target.
  if (!target_id || !operation) return null

  const event: DirectGraphEditWireEvent = { kind: 'direct_graph_edit', target_id, operation }
  if (changedNodeIds.length > 0) event.changed_node_ids = changedNodeIds
  if (changedEdgeIds.length > 0) event.changed_edge_ids = changedEdgeIds
  if (operations.length > 0) event.operations = operations
  if (fieldsChanged.length > 0) event.fields_changed = fieldsChanged
  if (summary) event.summary = summary
  return event
}

/**
 * `factor_value_edit` (ROADMAP 1.346) — the value-CARRYING inspector edit.
 *
 * Unlike `adaptDirectGraphEdit` above, there is NO representative-singular
 * inference here and there must never be one: this event MUTATES the node it
 * names, so a fabricated or inferred `target_id` would write someone's number
 * onto the wrong factor. Every field is taken verbatim from the emitter or
 * omitted.
 *
 * Fail CLOSED to `null` whenever the identity or the value is missing or
 * non-finite. A fabricated value would be a silent wrong mutation, so refusing
 * to encode is the right call at this hop.
 *
 * ⚠ THIS COMMENT USED TO SAY `null` WAS "a RETRYABLE unencodable, surfaced by
 * the caller". FALSE FOR THIS EVENT — corrected at the bytes after the #962
 * review. Nothing surfaces it: for `factor_value_edit` a refusal here means the
 * turn is never built and the caller sees a resolved promise, which is the same
 * silence this PR's sibling defect was about.
 *
 * It is currently UNREACHABLE rather than guarded, and the distinction matters
 * because only one of those survives a refactor: `buildFactorValueEditEvent`
 * guarantees a `target_id` and a finite `value`, and returns `null` BEFORE any
 * optimistic write happens, so no edit can reach this function malformed today.
 * That is a property of the four call sites, not of this function — if a fifth
 * emitter ever builds the payload by hand, this returns `null` and the user's
 * value disappears with nothing said. Rowed rather than fixed blind: a guard
 * added here now could not be pinned by any driver that exists.
 *
 * ABSENCE IS MEANINGFUL for `raw_value` and `unit` — the contract states that a
 * missing `raw_value` means "the client did not state a user-unit magnitude"
 * (the server then derives one from `value` and its own stored cap), and a
 * missing `unit` means "the client did not say", NOT "no unit". So neither is
 * defaulted here: a `raw_value: 0` fallback would assert a magnitude the user
 * never typed, and CEE would persist it.
 */
function adaptFactorValueEdit(
  eventPayload: Record<string, unknown> | undefined,
): FactorValueEditWireEvent | null {
  const target_id = stringField(eventPayload, 'target_id')
  const value = finiteNumberField(eventPayload, 'value')
  if (!target_id || value === undefined) return null

  const event: FactorValueEditWireEvent = { kind: 'factor_value_edit', target_id, value }

  const raw_value = finiteNumberField(eventPayload, 'raw_value')
  if (raw_value !== undefined) event.raw_value = raw_value

  const unit = stringField(eventPayload, 'unit')
  if (unit) event.unit = unit

  // `field` is a LITERAL in the contract ('value' is the only member) and
  // absence means the same thing as presence. Forward it only when it is
  // exactly that literal: anything else is a producer the wire should refuse,
  // and dropping it here would launder a wrong field into a silently-accepted
  // value edit. Refusing the whole event on a bad `field` keeps the contract's
  // loud-widening property intact at this hop too.
  const field = stringField(eventPayload, 'field')
  if (field) {
    if (field !== 'value') return null
    event.field = 'value'
  }

  // ── `applied_from` — the attribution claim (0.40.0) ──────────────────────
  //
  // ⚠ THIS WAS MISSING, AND ITS ABSENCE MADE A WHOLE FEATURE DARK. The panel
  // apply path builds `applied_from` in `buildFactorValueEditEvent`, and this
  // adapter — the SOLE construction site of the wire event — did not copy it.
  // No type error (the field is optional), no 422, no failing test: just an
  // owner clicking "Use Grace's 0.85", CEE stamping `source: 'user_override'`
  // with no `elicited_from` because no claim ever arrived, and the pill reading
  // "Set by you" over a colleague's number. Two merged PRs of attribution work
  // were unreachable through the product's own click path.
  //
  // The generator was that this function is a HAND-MAINTAINED MIRROR of the
  // wire shape (trap 12): the contract grew a member and the mirror did not.
  // `__tests__/factorValueEditWireCarriage.spec.ts` now derives the expected
  // field set from the published Zod schema and REDs on the next omission, so
  // the mirror can no longer drift silently. Do not add a field here without
  // letting that guard see it.
  //
  // FAIL CLOSED on a malformed claim, exactly as `field` above does, and for a
  // sharper reason. The two failure directions are not symmetric:
  //   · refuse the event  → nothing happens, the owner can click again;
  //   · drop the claim    → the value IS applied and stamped as the owner's own
  //                         edit, which is precisely the attribution untruth
  //                         this seam exists to end — silent, and permanent in
  //                         the model.
  // A visible nothing beats a confident wrong stamp.
  const appliedFrom = eventPayload?.applied_from
  if (appliedFrom !== undefined && appliedFrom !== null) {
    if (typeof appliedFrom !== 'object') return null
    const round_id = stringField(appliedFrom as Record<string, unknown>, 'round_id')
    const participant_id = stringField(
      appliedFrom as Record<string, unknown>,
      'participant_id',
    )
    // BOTH or NEITHER. A claim naming a participant with no round cannot be
    // verified against a round's roster, and CEE would refuse it — but more to
    // the point, a half-claim is not a claim, and forwarding one would ask the
    // server to guess which round a person answered in.
    //
    // ⚠ TRIMMED FOR THE TEST, NOT FOR THE VALUE. `stringField` accepts any
    // string of `length > 0`, so a whitespace-only id passes it; the contract
    // requires uuids, so such a claim would 422 the whole turn at CEE. The ids
    // are checked trimmed and then forwarded VERBATIM — a trimmed id is not
    // "repaired", because silently rewriting an identifier is guessing at which
    // round or which person was meant.
    if (round_id.trim() === '' || participant_id.trim() === '') return null
    // PICKED, never spread: the caller's object is a client-side record, and a
    // spread would put whatever else it carries onto a `.strict()` wire member,
    // turning an extra local field into a 422 for the whole turn.
    event.applied_from = { round_id, participant_id }

    // ── `evidence_event_id` — the CITATION (0.41.0) ────────────────────────
    //
    // OPTIONAL, so absence here is the ordinary case and must stay absent on
    // the wire: CEE reads an absent member as "this apply cited no evidence",
    // and every pre-0.41.0 apply is exactly that.
    //
    // ⚠ FAIL CLOSED ON A MALFORMED CITATION — refuse the event rather than drop
    // the member, and the reason is NOT the same as the one above it. Dropping
    // an id there produces a LIE (a colleague's number stamped "Set by you").
    // Dropping this one would produce something subtler and worse for the
    // system: it would make ABSENCE AMBIGUOUS. CEE's stamp, its logs and the
    // contract all rest on "absent ⇔ the owner cited nothing"; a client that
    // may silently drop a citation makes that biconditional false everywhere
    // downstream, and no reader could ever tell the two states apart again.
    // Refusing is visible and retryable; a lost citation is neither.
    //
    // ⚠ The member is FORWARDED, never checked for meaning. Whether the cited
    // event exists, is evidence, is on that round and is about that target is
    // decided by CEE's binding (f) against its own store — the wire never
    // carries a provenance claim the server could not verify for itself, so a
    // client-side plausibility check here would be duplicated authority that
    // could only ever disagree with the real one.
    const rawCitation = (appliedFrom as Record<string, unknown>).evidence_event_id
    if (rawCitation !== undefined && rawCitation !== null) {
      if (typeof rawCitation !== 'string' || rawCitation.trim() === '') return null
      event.applied_from = { round_id, participant_id, evidence_event_id: rawCitation }
    }
  }

  return event
}

// The four adjudication verdicts (0.34) — the UI's UserAction union minus the
// unresolved `pending`. Checked here so a drifted producer refuses CLIENT-side
// (null → unsupported) rather than as a wire 422.
const ADJUDICATION_VERDICTS = new Set(['accepted_pass1', 'accepted_pass2', 'overridden', 'dismissed'])

/**
 * `edge_adjudication` (0.34, P4 transport) — the contested-edge verdict.
 * Fail-closed against the wire's OWN cross-field rules so an event the root
 * superRefine would 422 is never built: `overridden` requires a finite
 * `resolved_strength_mean`; `dismissed` forbids one. Identity is from+to node
 * ids (the canonical edge key); `edge_id` is informative only.
 */
function adaptEdgeAdjudication(
  eventPayload: Record<string, unknown> | undefined,
): EdgeAdjudicationWireEvent | null {
  const from = stringField(eventPayload, 'from')
  const to = stringField(eventPayload, 'to')
  const verdict = stringField(eventPayload, 'verdict')
  if (!from || !to || !ADJUDICATION_VERDICTS.has(verdict)) return null

  const mean = finiteNumberField(eventPayload, 'resolved_strength_mean')
  // Present-but-non-finite is a producer bug, not an omission — refuse rather
  // than launder it into a value-less verdict the wire would accept.
  if (
    eventPayload !== undefined &&
    'resolved_strength_mean' in eventPayload &&
    mean === undefined
  ) {
    return null
  }
  if (verdict === 'overridden' && mean === undefined) return null
  if (verdict === 'dismissed' && mean !== undefined) return null

  const event: EdgeAdjudicationWireEvent = {
    kind: 'edge_adjudication',
    from,
    to,
    verdict: verdict as EdgeAdjudicationWireEvent['verdict'],
  }
  const edge_id = stringField(eventPayload, 'edge_id')
  if (edge_id) event.edge_id = edge_id
  if (mean !== undefined) event.resolved_strength_mean = mean
  return event
}

/**
 * `prior_range_edit` (0.34, P4 transport) — the user-set prior range.
 * Fail-closed on the wire's own rule (min ≤ max) and on missing/non-finite
 * bounds. `distribution` is forwarded only when stated — absence means "the
 * client did not say", never "uniform".
 */
function adaptPriorRangeEdit(
  eventPayload: Record<string, unknown> | undefined,
): PriorRangeEditWireEvent | null {
  const target_id = stringField(eventPayload, 'target_id')
  const range_min = finiteNumberField(eventPayload, 'range_min')
  const range_max = finiteNumberField(eventPayload, 'range_max')
  if (!target_id || range_min === undefined || range_max === undefined) return null
  if (range_min > range_max) return null

  const event: PriorRangeEditWireEvent = {
    kind: 'prior_range_edit',
    target_id,
    range_min,
    range_max,
  }
  const distribution = stringField(eventPayload, 'distribution')
  if (distribution) event.distribution = distribution
  return event
}

/**
 * `structural_delete` (0.48.0) — the durable, atomic removal.
 *
 * FAIL-CLOSED ON THE CONTRACT'S OWN RULES, checked here rather than trusted
 * from the caller, because every member of this union is `.strict()` and the
 * union is discriminated: one malformed field does not lose the field, it loses
 * the WHOLE TURN at CEE's ingress (422). The rules re-applied here are the
 * schema's, not invented ones:
 *   · `CanonicalEdgeEndpointIdSchema` — non-blank, no surrounding whitespace,
 *     never a `→`/`->` composite (that delimiter belongs to the composite
 *     adapter and would silently retarget);
 *   · `base_graph_hash` is `z.string().min(1)` — "absent, null and empty are
 *     all forbidden: the stale gate is non-optional";
 *   · `refineStructuralDelete` — both arrays empty is refused, so a gesture
 *     that resolved to nothing must never reach the wire.
 *
 * A `null` return routes to `unsupported_system_event`, i.e. no turn at all —
 * which is the right outcome: an unsendable delete must not become a turn that
 * claims something happened.
 */
function adaptStructuralDelete(
  eventPayload: Record<string, unknown> | undefined,
): StructuralDeleteWireEvent | null {
  const base_graph_hash = stringField(eventPayload, 'base_graph_hash')
  if (!base_graph_hash) return null

  const rawNodeIds = eventPayload?.removed_node_ids
  const rawEdges = eventPayload?.removed_edges
  if (!Array.isArray(rawNodeIds) || !Array.isArray(rawEdges)) return null

  const removed_node_ids: string[] = []
  for (const id of rawNodeIds) {
    if (!isCanonicalEndpointId(id)) return null
    removed_node_ids.push(id)
  }

  const removed_edges: { from: string; to: string }[] = []
  for (const edge of rawEdges) {
    const from = (edge as { from?: unknown } | null)?.from
    const to = (edge as { to?: unknown } | null)?.to
    if (!isCanonicalEndpointId(from) || !isCanonicalEndpointId(to)) return null
    removed_edges.push({ from, to })
  }

  if (removed_node_ids.length === 0 && removed_edges.length === 0) return null

  return { kind: 'structural_delete', removed_node_ids, removed_edges, base_graph_hash }
}

/**
 * `structural_rename` (0.50.0) — the durable label write.
 *
 * FAIL-CLOSED ON THE CONTRACT'S OWN RULES, checked here rather than trusted from
 * the caller, for the reason `adaptStructuralDelete` states: every member of
 * this union is `.strict()` and the union is discriminated, so one malformed
 * field does not lose the field, it loses the WHOLE TURN at CEE's ingress (422).
 * The rules re-applied here are the schema's, not invented ones:
 *
 *   · `node_id` is `CanonicalEdgeEndpointIdSchema` — non-blank, no surrounding
 *     whitespace, never a `→`/`->` composite. ⚠ AND DELIBERATELY NOT the
 *     lowercase `NodeV3Schema.shape.id` regex: the contract's own note says
 *     narrowing an EXISTING-id field that way "would refuse live nodes", because
 *     "CEE's persisted GraphV3 is the authority and its deployed node ids are
 *     open strings". Narrowing here is a silent capability loss, not safety.
 *   · `label` and `expected_label` are both `NodeV3Schema.shape.label`, i.e.
 *     `min(1).max(200)`. The UI's own input cap is 100 — strictly inside it — so
 *     a value can clear the input and still be refused here only if it arrived
 *     from somewhere other than the input, which is exactly when we want a
 *     stand-down rather than a 422.
 *   · `base_graph_hash` is `z.string().min(1)` — absent, null and empty are all
 *     forbidden; the stale gate is non-optional.
 *   · `refineStructuralRename` — `label === expected_label` is refused, because
 *     "a structural_rename to the label it already has is a no-op".
 *
 * ⚠ `expected_label` IS NOT OPTIONAL AND IS NOT REDUNDANT WITH THE HASH. `label`
 * is absent from CEE's analysis-affecting hash projection, so two users renaming
 * one node concurrently move NO hash: without this field the second rename
 * silently clobbers the first, on the one field the stale gate is blind to.
 *
 * A `null` return routes to `unsupported_system_event`, i.e. no turn at all —
 * the right outcome: an unsendable rename must not become a turn that claims
 * something happened.
 */
function adaptStructuralRename(
  eventPayload: Record<string, unknown> | undefined,
): StructuralRenameWireEvent | null {
  const base_graph_hash = stringField(eventPayload, 'base_graph_hash')
  if (!base_graph_hash) return null

  const node_id = eventPayload?.node_id
  if (!isWireUsableNodeId(node_id)) return null

  const label = eventPayload?.label
  const expected_label = eventPayload?.expected_label
  if (!isWireUsableLabel(label) || !isWireUsableLabel(expected_label)) return null

  // The contract's cross-field refinement, applied before the wire so a no-op
  // never costs a turn, a commit and two comparisons to change nothing.
  if (label === expected_label) return null

  return { kind: 'structural_rename', node_id, label, expected_label, base_graph_hash }
}

// ActionType is a strict enum on the wire. If the UI passes an unknown
// action_type, we'd fail ingress; drop it to let CEE's classifier dispatch
// from message text alone.
//
// V-P0-2 fold, completed 2026-07-20: DERIVED from the vendored
// @talchain/schemas ActionType enum — the hand-copied list this replaced
// went 2 generations stale (7 members vs the enum's 9, silently stripping
// explain_results + explain_from_structure at the wire). The parity spec in
// explainChips.vocabulary.spec.ts stays as the guard against anyone
// reverting to a hand list.
//
// KNOWN_ACTION_TYPES answers ONE question: "is this value published in the
// enum WE vendored?" That is necessary but NOT sufficient to send — the send
// gate also requires CEE_ACCEPTED_ACTION_TYPES (below).
export const KNOWN_ACTION_TYPES: ReadonlySet<ActionTypeLiteral> = new Set<ActionTypeLiteral>(
  ActionType.options,
)

/**
 * CEE-acceptance registry — the SECOND, independent signal the send gate
 * requires. It answers a DIFFERENT question from KNOWN_ACTION_TYPES: not "did
 * WE publish this value?" but "does CEE's DEPLOYED service accept it at
 * ingress?"
 *
 * Why it exists (the whole point of the send gate): CEE ingress validates
 * action_type FAIL-CLOSED, so a value CEE does not accept 422s the whole turn.
 * The gate used to key on publication ALONE — but OUR publishing a value says
 * nothing about whether CEE accepts it, so a publication-only gate can only
 * ever be right by luck. The two facts are now DECOUPLED: a value is sent only
 * when BOTH hold (see isSendableToken). A newly re-vendored value is
 * WITHHELD until it is added here with provenance — publication can never again
 * open the gate on its own.
 *
 * This is a DELIBERATE hand-maintained allowlist that CANNOT be derived from
 * our vendored enum (deriving it would re-couple the two facts and re-create
 * the defect). It is safe as a hand list because it fails CLOSED: a value
 * absent here is withheld (behaves like today's identity-only chip — never a
 * 422), never sent. Drift therefore over-blocks (a chip visibly fails to light
 * up), it can never leak a CEE-rejected value onto the wire. The element type
 * is ActionTypeLiteral, so an entry that is not (or no longer) in the vendored
 * enum is a COMPILE error — you cannot list an accepted value you have not
 * vendored (it would be inert), which keeps the registry honest.
 *
 * Provenance per value:
 * - run_analysis, set_factor_value, add_constraint, adjust_edge_strength,
 *   explain_result, explain_results, explain_from_structure, compare_options,
 *   what_would_flip: present in the vendored enum since <= 0.19.0 and permitted
 *   by the publication-only gate that preceded this registry. They have been
 *   live on the wire without an ingress 422 (explain_results + the singular
 *   legacy alias are the V-P0-2 chip vocabulary) — i.e. empirically
 *   CEE-accepted. Grandfathered here on that OBSERVED behaviour; they are the
 *   only values whose acceptance predates the registry.
 * - analysis_readiness: CEE #578 (their 0.20.0 re-vendor) MERGED and in the
 *   serving build lineage + A1 deploy confirmation 2026-07-20 ("CEE accepts
 *   analysis_readiness on the deployed service"). Accepted at INGRESS; sparks
 *   are currently claimed by CEE's process-meta branch (deterministic, safe),
 *   with a dedicated typed routing arm queued as a separate CEE build.
 *   Ingress-acceptance is exactly what the send gate needs — the typed arm is
 *   not required for the turn to be accepted rather than 422'd.
 * - what_changed: F2 CHANGE B (2026-07-22). The typed door for the "What
 *   changed?" pill (WhatChangedChip). Published half comes from the re-vendored
 *   @talchain/schemas 0.21.0 enum (KNOWN_ACTION_TYPES, derived); this accepted
 *   half is the hand-listed mirror. Accepting counterpart is CEE PR #620
 *   (feat/f2b-accept-what-changed) — DO NOT MERGE this UI change before #620 is
 *   merged + deploy-verified, or the send 422s the whole turn (CEE is
 *   fail-closed on the enum). See parallel-briefs/F2B-BYTE-CONFIRM §6 landing
 *   order.
 *
 * ⚠ DRIFT HAZARD (the dominant Olumi defect class): this list is a
 * HAND-MAINTAINED mirror of what CEE's deployed service accepts. It is
 * DELIBERATELY not derived from our vendored enum — there is no shared contract
 * artefact to derive CEE's *deployed acceptance* from today, and deriving it
 * from our own enum would re-couple the two facts and re-create the bug the send
 * gate exists to prevent (publication says nothing about CEE acceptance). It
 * fails CLOSED (a missing entry over-blocks: the chip visibly no-ops, never a
 * 422), so the risk is silent under-send, not a leak. Every new enum value MUST
 * be added here by hand with provenance, in lockstep with CEE deploy.
 */
export const CEE_ACCEPTED_ACTION_TYPES: ReadonlySet<ActionTypeLiteral> =
  new Set<ActionTypeLiteral>([
    'run_analysis',
    'set_factor_value',
    'add_constraint',
    'adjust_edge_strength',
    'explain_result',
    'explain_results',
    'explain_from_structure',
    'compare_options',
    'what_would_flip',
    'analysis_readiness',
    'what_changed',
  ])

/**
 * The send gate, factored out as ONE PURE predicate shared by BOTH the
 * action_type and intent sanitisers, so a test can drive it with SYNTHETIC
 * registries and prove the AND actually bites — that publication alone (or
 * acceptance alone) can never open it. A token is sendable IFF it is BOTH
 * published in the vendored enum AND present in the matching CEE-acceptance
 * registry. The two registries (action_type + intent) remain SEPARATE and
 * hand-maintained per the doctrine above; this predicate is only the generic
 * AND that each of them applies to its own token.
 */
export function isSendableToken(
  raw: string,
  published: ReadonlySet<string>,
  accepted: ReadonlySet<string>,
): boolean {
  return published.has(raw) && accepted.has(raw)
}

function sanitiseActionType(raw: string | undefined): ActionTypeLiteral | undefined {
  if (!raw) return undefined
  return isSendableToken(raw, KNOWN_ACTION_TYPES, CEE_ACCEPTED_ACTION_TYPES)
    ? (raw as ActionTypeLiteral)
    : undefined
}

/**
 * KNOWN_INTENTS — "is this value published in the `Intent` enum WE vendored?"
 * DERIVED from the vendored @talchain/schemas `Intent` enum (never a hand list),
 * the exact derive-don't-mirror discipline KNOWN_ACTION_TYPES uses. `Intent` is
 * the 0.22 authored-intent set (`add_option`, `elicit_options`, coaching
 * intents…). Necessary but NOT sufficient to send — the send gate also requires
 * CEE_ACCEPTED_INTENTS.
 */
export const KNOWN_INTENTS: ReadonlySet<IntentLiteral> = new Set<IntentLiteral>(Intent.options)

/**
 * CEE-acceptance registry for typed intents — the SECOND, independent send-gate
 * signal, answering "does CEE's DEPLOYED service ROUTE this intent?" (not "did
 * WE publish it?"). Same rationale + hazards as CEE_ACCEPTED_ACTION_TYPES: a
 * DELIBERATE hand-maintained allowlist that CANNOT be derived from our vendored
 * enum (deriving it would re-couple publication with CEE acceptance and re-create
 * the silent-drop bug the gate prevents). It fails CLOSED — an intent absent here
 * is WITHHELD (the chip behaves like today's identity-only chip, never a wire
 * 422), so drift over-blocks, never leaks. The element type is IntentLiteral, so
 * an entry not in the vendored enum is a COMPILE error.
 *
 * Provenance per value:
 * - add_option: C3's atomic add-option transaction, live on CEE staging since
 *   `03d03e9`+ and present in build `e7f312d` (the edge-chip-door build).
 *   route-v2.ts fires the add-option pre-route on
 *   `(source ∈ {chip, chip_click}) && chip.intent === 'add_option'`, building ONE
 *   atomic held proposal via add-option-transaction.ts; an incomplete/absent
 *   `chip.parameters` falls through benignly to the coach (never a 422).
 *
 * - challenge_frame, define_success, elicit_options, challenge_assumption:
 *   CEE's TYPED COACHING ARM (`orchestrator-v5/coaching/typed-intent-directive.ts`),
 *   which appends a method directive to the routing turn so the coach authors
 *   the answer with the named method in front of it. These four are listed
 *   together because they are exactly the four MOUNTED affordances that were
 *   degrading to generic free prose — `pressure_test_frame`, `define_success`,
 *   `widen_options` and `reflect_bias`, all of which carry `action_type: null`
 *   because no honest handler exists for a conversation.
 *
 *   ⚠⚠ DEPLOY ORDER IS LOAD-BEARING AND THIS ENTRY IS THE SECOND HALF. CEE's
 *   arm must be MERGED AND DEPLOYED BEFORE this list grows, because listing an
 *   intent here is precisely the claim "the deployed service routes this". On
 *   an OLD CEE, a new UI sending these four is not a 422 — CEE's ingress
 *   accepts any published `Intent` and simply finds no arm, so the turn behaves
 *   exactly as it does today (free prose). The cost of getting the order wrong
 *   is therefore a silent no-op, not a break; but the LIST WOULD BE LYING in
 *   the interval, and this registry's whole value is that it does not.
 *
 * - outside_view, pre_mortem, elicit_risks: the SAME typed coaching arm, widened
 *   by CEE PR #1321 (`feat(coaching): route outside_view, pre_mortem and
 *   elicit_risks to their authored methods`). Their affordances are the three
 *   pre-analysis-v3 sparks `outside_view` ("Take the outside view"),
 *   `pre_mortem` ("Run a pre-mortem") and `risks_upside` ("Find risks and
 *   upside") — mounted, labelled and clickable for weeks while this list
 *   withheld them, so each click reached CEE as anonymous prose. Derived from
 *   `ROUTED_COACHING_INTENTS` at CEE `266b1d4f`, which is exactly
 *   `challenge_frame, define_success, elicit_options, challenge_assumption,
 *   outside_view, pre_mortem, elicit_risks` — this list is that set plus the
 *   independent `add_option` rail, and nothing else.
 *
 * ⚠⚠ THE SENTENCE THAT USED TO SIT HERE WAS FALSE, AND IT COST A LANE A WRONG
 * PREMISE. It read: "each lights up with zero further UI change the moment CEE
 * routes it." That is wrong in the one way that matters — `isSendableToken` is
 * a CONJUNCTION (`published ∧ accepted`), and this list IS the accepted half.
 * A spark's declaration can never open the gate on its own; that is the entire
 * point of the two-signal design documented above. CEE routing an intent is
 * NECESSARY and NOT SUFFICIENT: this list must grow too, in a follow-up UI PR,
 * which is what added the three entries below. Do not re-write that sentence.
 *
 * NOT listed, and each for its own reason — these are NOT one class:
 * - `estimate_help`: ⚠ DELIBERATELY AND INDEFINITELY WITHHELD, not merely
 *   "awaiting CEE". Its spark (`calibrate_estimates`) carries BOTH this intent
 *   AND `action_type: 'analysis_readiness'` — a deterministic pre-route that
 *   CLAIMS the turn and skips the LLM, so the coaching arm (which runs at the
 *   LLM call) would never be reached. CEE #1321 excludes it for exactly this
 *   reason and `turn-executor.ts` pins the invariant that no affordance carries
 *   both. Adding it here would look wired and be dead. Routing it needs a
 *   decision about WHICH authority owns the turn, not a registry edit.
 *   Guarded below by `intentGate.spec.ts` with the reason in the failure
 *   message.
 * - `mitigation_help`, `discuss`: no CEE arm routes them today. Ordinary
 *   "awaiting CEE" withholds — they light up when CEE routes them AND this list
 *   grows in the same lockstep the entries above went through.
 */
export const CEE_ACCEPTED_INTENTS: ReadonlySet<IntentLiteral> = new Set<IntentLiteral>([
  'add_option',
  'challenge_frame',
  'define_success',
  'elicit_options',
  'challenge_assumption',
  'outside_view',
  'pre_mortem',
  'elicit_risks',
])

function sanitiseIntent(raw: string | undefined): IntentLiteral | undefined {
  if (!raw) return undefined
  if (isSendableToken(raw, KNOWN_INTENTS, CEE_ACCEPTED_INTENTS)) return raw as IntentLiteral

  /**
   * ⭐ OBSERVABILITY ONLY — the gate's BEHAVIOUR is unchanged and the `intent`
   * key stays omitted from the payload exactly as before.
   *
   * WHY THIS EXISTS: a declared intent that failed the gate used to disappear
   * with no trace anywhere, and that SILENCE is the mechanism that made the
   * original defect invisible — nothing in a dev session distinguished "this
   * chip declared no intent" from "this chip declared one and the gate dropped
   * it", so four mounted affordances degraded to anonymous prose for weeks with
   * every signal reading healthy. A withheld intent is a legitimate, expected
   * state; it simply must not be a SECRET one.
   *
   * The `!raw` early return above means this can only fire for a NON-EMPTY
   * declared string. The ordinary no-intent turn — the overwhelming majority —
   * returns before reaching here and never logs.
   */
  if (import.meta.env.DEV) {
    console.warn(
      `[v5] chip.intent "${raw}" withheld from the wire — not in CEE_ACCEPTED_INTENTS. ` +
        'The send gate dropped it; the chip still travels with its identity.',
    )
  }
  return undefined
}

/**
 * `structural_add` (0.50.0) — the durable NODE write.
 *
 * FAIL-CLOSED ON THE CONTRACT'S OWN RULES, checked here rather than trusted from
 * the caller, for the reason `adaptStructuralDelete` states: every member of
 * this union is `.strict()` and the union is discriminated, so one malformed
 * field does not lose the field, it loses the WHOLE TURN at CEE's ingress (422).
 * The rules re-applied here are the schema's, not invented ones:
 *
 *   · `node_id` is `NodeV3Schema.shape.id` — `min(1).max(100)` AND the lowercase
 *     `NODE_ID_PATTERN` `/^[a-z0-9_:-]+$/`. ⚠⚠ THIS IS NARROWER THAN ITS
 *     SIBLINGS AND THE ASYMMETRY IS DELIBERATE ON BOTH SIDES. `structural_add`
 *     MINTS a new id, and the contract's note says an id failing that pattern
 *     "is one CEE cannot persist into GraphV3"; `structural_rename` and
 *     `structural_add_edge` address EXISTING nodes and use the OPEN
 *     `CanonicalEdgeEndpointIdSchema`, because narrowing those "would refuse
 *     live nodes". Copying either predicate onto the other event is wrong in
 *     opposite directions — hence `isWireUsableNewNodeId`, named apart from
 *     `isWireUsableNodeId` so they cannot be swapped by symmetry.
 *   · `label` is `NodeV3Schema.shape.label`, i.e. `min(1).max(200)`.
 *   · `node_kind` is `NodeKind`, an 8-member enum — but only SEVEN of those are
 *     persistable by CEE (`NodeKindV3` has no `constraint`), and the eighth
 *     earns a COMMITTED 200 refusal rather than a 422. Standing down here costs
 *     nothing and says something true.
 *   · `base_graph_hash` is `z.string().min(1)` — absent, null and empty are all
 *     forbidden; the stale gate is non-optional.
 *
 * ⚠⚠ THERE IS NO VALUE FIELD, NO PRIOR FIELD AND NO POSITION FIELD, AND NOTHING
 * MAY BE ADDED HERE. The member is `.strict()`, so an extra key does not get
 * dropped — it 422s the turn. More importantly it would be the fabrication this
 * whole lane exists to prevent: CEE stamps a new factor with an explicit
 * ignorance prior and refuses its own commit if a numeric level reaches the
 * persisted bytes. `buildPayload.structuralAdd.spec.ts` pins the exact key set.
 *
 * A `null` return routes to `unsupported_system_event`, i.e. no turn at all —
 * the right outcome: an unsendable add must not become a turn that claims
 * something happened.
 */
function adaptStructuralAdd(
  eventPayload: Record<string, unknown> | undefined,
): StructuralAddWireEvent | null {
  const base_graph_hash = stringField(eventPayload, 'base_graph_hash')
  if (!base_graph_hash) return null

  const node_id = eventPayload?.node_id
  if (!isWireUsableNewNodeId(node_id)) return null

  const label = eventPayload?.label
  if (!isWireUsableLabel(label)) return null

  const node_kind = eventPayload?.node_kind
  if (typeof node_kind !== 'string' || !WIRE_ADDABLE_NODE_KINDS.has(node_kind)) return null

  return {
    kind: 'structural_add',
    node_id,
    node_kind,
    label,
    base_graph_hash,
  } as StructuralAddWireEvent
}

/**
 * Turn request boundary contract for `/bff/orchestrate/v1/turn`
 *
 * ## Task 1 audit (pre-builder)
 *
 * | File | Function | Turn type | Fields attached pre-migration | Field sources pre-migration |
 * |---|---|---|---|---|
 * | `src/canvas/conversation/useConversation.ts` | `buildRequest` | conversation / explicit_generate / run_analysis / explain / clarification_response (all user sends shared one builder) | `scenario_id`, `message`, `conversation_history`, `graph_state`, `analysis_state`, `selected_elements?`, `analysis_inputs?`, `client_turn_id` | `scenario_id` from `useCanvasStore.currentScenarioId` (or fallback), `message` from send input, `conversation_history` from `messages` via `buildHistory`, `graph_state` derived from canvas `nodes/edges`, `analysis_state` from `results` + `resultsStore.analysisSummary`, `selected_elements` from `store.selection`, `analysis_inputs` from `store.ceeAnalysisReady`, `client_turn_id` from retry/pending context or `crypto.randomUUID()` |
 * | `src/canvas/conversation/useConversation.ts` | `sendTurn` post-build mutation | system_event | same as above plus `system_event` added after request construction | `system_event` from `serializeSystemEvent(systemEvent)` |
 * | `src/canvas/conversation/useConversation.ts` | `sendMessage` | conversation (default) | delegated to shared `buildRequest` payload above | `text` and optional debug metadata from caller |
 * | `src/canvas/conversation/ConversationPanel.tsx` | `handleGenerateModel` | explicit_generate | delegated to `sendMessage` shared payload above | brief from composer `consumeBrief()` |
 * | `src/canvas/components/DraftChat.tsx` | `handleDraft` (orchestrator-v2 branch) | explicit_generate (initial brief turn) | delegated to `conversation.sendMessage` shared payload above | draft description textarea |
 * | `src/canvas/conversation/useConversation.ts` | `sendChip` | patch_followup / explain / clarification_response (runtime intent carried by chip text, but payload still shared) | delegated to `sendTurn` + shared `buildRequest` payload above | chip `message` / `label` |
 * | `src/canvas/conversation/useConversation.ts` | `sendSystemEvent` (callers in `ConversationPanel.tsx` + `useGraphEditEvents.ts`) | system_event | delegated to `sendTurn` + shared `buildRequest` payload above + `system_event` mutation | event type/payload from patch actions, feedback, direct graph edits |
 *
 * Root issue: a single broad request shape was reused across all logical turn types,
 * causing forbidden/partial fields (notably `analysis_state`) to leak onto turns where
 * CEE expects structural absence.
 */

import type {
  AnalysisInputOption,
  ConversationTurnPair,
  WireSystemEvent,
} from '../canvas/conversation/types'
import { trackEvent } from '../lib/posthog'

export type TurnType =
  | 'conversation'
  | 'explicit_generate'
  | 'run_analysis'
  | 'system_event'
  | 'patch_followup'
  | 'explain'
  | 'clarification_response'

export type GraphStatePayload = {
  nodes: unknown[]
  edges: unknown[]
}

export type SelectedElementsPayload = {
  node_ids?: string[]
  edge_ids?: string[]
}

export type AnalysisInputsPayload = {
  options: AnalysisInputOption[]
  goal_node_id: string
  constraints?: import('../adapters/cee/types').CEEGoalConstraint[]
}

export type ExplainAnalysisStatePayload = {
  analysis_status: string
  meta: {
    response_hash: string
    [key: string]: unknown
  }
  results: unknown
  [key: string]: unknown
}


type TurnBase = {
  scenario_id: string
  client_turn_id: string
  conversation_history: ConversationTurnPair[]
  _turn_type?: TurnType
}

export type ChipMetadata = {
  action_type: string
  parameters?: Record<string, unknown>
}

export type ConversationTurnRequest = TurnBase & {
  message: string
  graph_state: GraphStatePayload
  selected_elements?: SelectedElementsPayload
  analysis_state?: ExplainAnalysisStatePayload
  chip_metadata?: ChipMetadata
}

export type ExplicitGenerateTurnRequest = TurnBase & {
  message: string
  graph_state: GraphStatePayload
  generate_model: true
  analysis_state?: ExplainAnalysisStatePayload
}

export type RunAnalysisTurnRequest = TurnBase & {
  graph_state: GraphStatePayload
  analysis_inputs: AnalysisInputsPayload
}

export type SystemEventTurnRequest = TurnBase & {
  message: string
  graph_state: GraphStatePayload
  system_event: WireSystemEvent
  analysis_state?: ExplainAnalysisStatePayload
}

export type PatchFollowupTurnRequest = TurnBase & {
  graph_state: GraphStatePayload
  analysis_state?: ExplainAnalysisStatePayload
}

export type ExplainTurnRequest = TurnBase & {
  message: string
  graph_state: GraphStatePayload
  selected_elements?: SelectedElementsPayload
  analysis_state?: ExplainAnalysisStatePayload
}

export type ClarificationResponseTurnRequest = TurnBase & {
  message: string
}

export type TurnRequestPayload =
  | ConversationTurnRequest
  | ExplicitGenerateTurnRequest
  | RunAnalysisTurnRequest
  | SystemEventTurnRequest
  | PatchFollowupTurnRequest
  | ExplainTurnRequest
  | ClarificationResponseTurnRequest

// R11: analysis_state is only allowed on turn types where the user explicitly
// references results (explain, patch_followup). Omitted from conversation,
// explicit_generate, and system_event to avoid CEE boundary warnings.
const TURN_ALLOW_LIST: Record<TurnType, readonly string[]> = {
  conversation: ['scenario_id', 'client_turn_id', 'conversation_history', 'message', 'graph_state', 'selected_elements', 'chip_metadata', '_turn_type'],
  explicit_generate: ['scenario_id', 'client_turn_id', 'conversation_history', 'message', 'graph_state', 'generate_model', '_turn_type'],
  run_analysis: ['scenario_id', 'client_turn_id', 'conversation_history', 'graph_state', 'analysis_inputs', '_turn_type'],
  system_event: ['scenario_id', 'client_turn_id', 'conversation_history', 'message', 'graph_state', 'system_event', '_turn_type'],
  patch_followup: ['scenario_id', 'client_turn_id', 'conversation_history', 'graph_state', 'analysis_state', '_turn_type'],
  explain: ['scenario_id', 'client_turn_id', 'conversation_history', 'message', 'graph_state', 'selected_elements', 'analysis_state', '_turn_type'],
  clarification_response: ['scenario_id', 'client_turn_id', 'conversation_history', 'message', '_turn_type'],
}

const TURN_REQUIRED_FIELDS: Record<TurnType, readonly string[]> = {
  conversation: ['scenario_id', 'client_turn_id', 'conversation_history', 'message', 'graph_state'],
  explicit_generate: ['scenario_id', 'client_turn_id', 'conversation_history', 'message', 'graph_state', 'generate_model'],
  run_analysis: ['scenario_id', 'client_turn_id', 'conversation_history', 'graph_state', 'analysis_inputs'],
  system_event: ['scenario_id', 'client_turn_id', 'conversation_history', 'message', 'graph_state', 'system_event'],
  patch_followup: ['scenario_id', 'client_turn_id', 'conversation_history', 'graph_state'],
  explain: ['scenario_id', 'client_turn_id', 'conversation_history', 'message', 'graph_state'],
  clarification_response: ['scenario_id', 'client_turn_id', 'conversation_history', 'message'],
}

// UUID pattern (hex 8-4-4-4-12, any version, case-insensitive)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Check whether a value is a valid UUID string. Exported for use by callers that
 *  need to normalise scenario_id or client_turn_id before building a request. */
export function isUUID(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}

function createClientTurnId(clientTurnId?: string): string {
  // Only reuse caller-provided IDs that are valid UUIDs — interaction chain keys
  // (e.g. composite stateKeys like "{uuid}:{patch_id}") must not leak onto the wire.
  if (typeof clientTurnId === 'string' && isUUID(clientTurnId)) return clientTurnId
  return crypto.randomUUID()
}

function withTurnType<T extends Omit<TurnBase, '_turn_type'>>(base: T, turnType: TurnType): T & { _turn_type: TurnType } {
  return { ...base, _turn_type: turnType }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}


function hasGraphState(value: unknown): value is GraphStatePayload {
  if (!value || typeof value !== 'object') return false
  const graph = value as Record<string, unknown>
  return Array.isArray(graph.nodes) && Array.isArray(graph.edges)
}

export function isValidExplainAnalysisState(value: unknown): value is ExplainAnalysisStatePayload {
  if (!value || typeof value !== 'object') return false
  const state = value as Record<string, unknown>
  if (!isNonEmptyString(state.analysis_status)) return false
  const meta = state.meta
  if (!meta || typeof meta !== 'object') return false
  const responseHash = (meta as Record<string, unknown>).response_hash
  if (!isNonEmptyString(responseHash)) return false
  return state.results !== undefined && state.results !== null
}

// R11: analysis_state removed from conversation turns — only allowed on
// explain/patch_followup where the user explicitly references results.
export function buildConversationTurnRequest(input: {
  scenario_id: string
  conversation_history: ConversationTurnPair[]
  message: string
  graph_state: GraphStatePayload
  selected_elements?: SelectedElementsPayload
  chip_metadata?: ChipMetadata
  client_turn_id?: string
}): ConversationTurnRequest {
  return withTurnType({
    scenario_id: input.scenario_id,
    client_turn_id: createClientTurnId(input.client_turn_id),
    conversation_history: input.conversation_history,
    message: input.message,
    graph_state: input.graph_state,
    ...(input.selected_elements ? { selected_elements: input.selected_elements } : {}),
    ...(input.chip_metadata ? { chip_metadata: input.chip_metadata } : {}),
  }, 'conversation')
}

// R11: analysis_state removed from explicit_generate turns.
export function buildExplicitGenerateTurnRequest(input: {
  scenario_id: string
  conversation_history: ConversationTurnPair[]
  message: string
  graph_state: GraphStatePayload
  client_turn_id?: string
}): ExplicitGenerateTurnRequest {
  return withTurnType({
    scenario_id: input.scenario_id,
    client_turn_id: createClientTurnId(input.client_turn_id),
    conversation_history: input.conversation_history,
    message: input.message,
    graph_state: input.graph_state,
    generate_model: true,
  }, 'explicit_generate')
}

export function buildRunAnalysisTurnRequest(input: {
  scenario_id: string
  conversation_history: ConversationTurnPair[]
  graph_state: GraphStatePayload
  analysis_inputs: AnalysisInputsPayload
  client_turn_id?: string
}): RunAnalysisTurnRequest {
  return withTurnType({
    scenario_id: input.scenario_id,
    client_turn_id: createClientTurnId(input.client_turn_id),
    conversation_history: input.conversation_history,
    graph_state: input.graph_state,
    analysis_inputs: input.analysis_inputs,
  }, 'run_analysis')
}

// R11: analysis_state removed from system_event turns.
export function buildSystemEventTurnRequest(input: {
  scenario_id: string
  conversation_history: ConversationTurnPair[]
  message: string
  graph_state: GraphStatePayload
  system_event: WireSystemEvent
  client_turn_id?: string
}): SystemEventTurnRequest {
  return withTurnType({
    scenario_id: input.scenario_id,
    client_turn_id: createClientTurnId(input.client_turn_id),
    conversation_history: input.conversation_history,
    message: input.message,
    graph_state: input.graph_state,
    system_event: input.system_event,
  }, 'system_event')
}

export function buildPatchFollowupTurnRequest(input: {
  scenario_id: string
  conversation_history: ConversationTurnPair[]
  graph_state: GraphStatePayload
  analysis_state?: unknown
  client_turn_id?: string
}): PatchFollowupTurnRequest {
  const validAnalysisState = isValidExplainAnalysisState(input.analysis_state) ? input.analysis_state : undefined
  return withTurnType({
    scenario_id: input.scenario_id,
    client_turn_id: createClientTurnId(input.client_turn_id),
    conversation_history: input.conversation_history,
    graph_state: input.graph_state,
    ...(validAnalysisState ? { analysis_state: validAnalysisState } : {}),
  }, 'patch_followup')
}

export function buildExplainTurnRequest(input: {
  scenario_id: string
  conversation_history: ConversationTurnPair[]
  message: string
  graph_state: GraphStatePayload
  selected_elements?: SelectedElementsPayload
  analysis_state?: unknown
  client_turn_id?: string
}): ExplainTurnRequest {
  const analysisState = isValidExplainAnalysisState(input.analysis_state) ? input.analysis_state : undefined
  return withTurnType({
    scenario_id: input.scenario_id,
    client_turn_id: createClientTurnId(input.client_turn_id),
    conversation_history: input.conversation_history,
    message: input.message,
    graph_state: input.graph_state,
    ...(input.selected_elements ? { selected_elements: input.selected_elements } : {}),
    ...(analysisState ? { analysis_state: analysisState } : {}),
  }, 'explain')
}

export function buildClarificationResponseTurnRequest(input: {
  scenario_id: string
  conversation_history: ConversationTurnPair[]
  message: string
  client_turn_id?: string
}): ClarificationResponseTurnRequest {
  return withTurnType({
    scenario_id: input.scenario_id,
    client_turn_id: createClientTurnId(input.client_turn_id),
    conversation_history: input.conversation_history,
    message: input.message,
  }, 'clarification_response')
}

export function validateTurnRequestBoundary(request: TurnRequestPayload): void {
  const turnType = request._turn_type ?? 'conversation'
  const payloadKeys = Object.keys(request)
  const allowed = new Set(TURN_ALLOW_LIST[turnType])
  const required = TURN_REQUIRED_FIELDS[turnType]
  const violations: Array<{ field: string; violation: string }> = []

  for (const key of payloadKeys) {
    if (!allowed.has(key)) {
      violations.push({ field: key, violation: 'forbidden_field' })
    }
  }

  for (const key of required) {
    const value = (request as Record<string, unknown>)[key]
    const missing =
      value === undefined
      || value === null
      || (typeof value === 'string' && value.trim().length === 0)
    if (missing) {
      violations.push({ field: key, violation: 'missing_required_field' })
    }
  }

  if (!isUUID(request.client_turn_id)) {
    violations.push({ field: 'client_turn_id', violation: 'client_turn_id_must_be_uuid' })
  }

  if (!isUUID(request.scenario_id)) {
    violations.push({ field: 'scenario_id', violation: 'scenario_id_must_be_uuid' })
  }

  if ('graph_state' in request && request.graph_state !== undefined && !hasGraphState(request.graph_state)) {
    violations.push({ field: 'graph_state', violation: 'graph_state_requires_nodes_and_edges_arrays' })
  }

  if (
    'analysis_state' in request
    && request.analysis_state !== undefined
    && !isValidExplainAnalysisState(request.analysis_state)
  ) {
    violations.push({ field: 'analysis_state', violation: 'analysis_state_requires_analysis_status_meta_response_hash_results' })
  }

  if (violations.length > 0) {
    if (import.meta.env.DEV) {
      for (const v of violations) {
        console.error('[BOUNDARY]', {
          turn_type: turnType,
          field: v.field,
          violation: v.violation,
          payload_keys: payloadKeys,
        })
      }
    }
    // Emit telemetry in all environments (including production)
    trackEvent('ui.turn_request_validation_failure', {
      turn_type: turnType,
      violations,
      payload_keys: payloadKeys,
    })
  }
}

export function stripTurnType<T extends TurnRequestPayload>(request: T): Omit<T, '_turn_type'> {
  const { _turn_type: _ignored, ...rest } = request
  return rest
}

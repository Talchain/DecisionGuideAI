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

export type ConversationTurnRequest = TurnBase & {
  message: string
  graph_state: GraphStatePayload
  selected_elements?: SelectedElementsPayload
}

export type ExplicitGenerateTurnRequest = TurnBase & {
  message: string
  graph_state: GraphStatePayload
}

export type RunAnalysisTurnRequest = TurnBase & {
  graph_state: GraphStatePayload
  analysis_inputs: AnalysisInputsPayload
}

export type SystemEventTurnRequest = TurnBase & {
  message: string
  graph_state: GraphStatePayload
  system_event: WireSystemEvent
}

export type PatchFollowupTurnRequest = TurnBase & {
  graph_state: GraphStatePayload
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

const TURN_ALLOW_LIST: Record<TurnType, readonly string[]> = {
  conversation: ['scenario_id', 'client_turn_id', 'conversation_history', 'message', 'graph_state', 'selected_elements', '_turn_type'],
  explicit_generate: ['scenario_id', 'client_turn_id', 'conversation_history', 'message', 'graph_state', '_turn_type'],
  run_analysis: ['scenario_id', 'client_turn_id', 'conversation_history', 'graph_state', 'analysis_inputs', '_turn_type'],
  system_event: ['scenario_id', 'client_turn_id', 'conversation_history', 'message', 'graph_state', 'system_event', '_turn_type'],
  patch_followup: ['scenario_id', 'client_turn_id', 'conversation_history', 'graph_state', '_turn_type'],
  explain: ['scenario_id', 'client_turn_id', 'conversation_history', 'message', 'graph_state', 'selected_elements', 'analysis_state', '_turn_type'],
  clarification_response: ['scenario_id', 'client_turn_id', 'conversation_history', 'message', '_turn_type'],
}

const TURN_REQUIRED_FIELDS: Record<TurnType, readonly string[]> = {
  conversation: ['scenario_id', 'client_turn_id', 'conversation_history', 'message', 'graph_state'],
  explicit_generate: ['scenario_id', 'client_turn_id', 'conversation_history', 'message', 'graph_state'],
  run_analysis: ['scenario_id', 'client_turn_id', 'conversation_history', 'graph_state', 'analysis_inputs'],
  system_event: ['scenario_id', 'client_turn_id', 'conversation_history', 'message', 'graph_state', 'system_event'],
  patch_followup: ['scenario_id', 'client_turn_id', 'conversation_history', 'graph_state'],
  explain: ['scenario_id', 'client_turn_id', 'conversation_history', 'message', 'graph_state'],
  clarification_response: ['scenario_id', 'client_turn_id', 'conversation_history', 'message'],
}

function createClientTurnId(clientTurnId?: string): string {
  if (typeof clientTurnId === 'string' && clientTurnId.trim().length > 0) return clientTurnId
  return crypto.randomUUID()
}

function withDevTurnType<T extends Omit<TurnBase, '_turn_type'>>(base: T, turnType: TurnType): T & { _turn_type?: TurnType } {
  return import.meta.env.DEV ? { ...base, _turn_type: turnType } : base
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

export function buildConversationTurnRequest(input: {
  scenario_id: string
  conversation_history: ConversationTurnPair[]
  message: string
  graph_state: GraphStatePayload
  selected_elements?: SelectedElementsPayload
  client_turn_id?: string
}): ConversationTurnRequest {
  return withDevTurnType({
    scenario_id: input.scenario_id,
    client_turn_id: createClientTurnId(input.client_turn_id),
    conversation_history: input.conversation_history,
    message: input.message,
    graph_state: input.graph_state,
    ...(input.selected_elements ? { selected_elements: input.selected_elements } : {}),
  }, 'conversation')
}

export function buildExplicitGenerateTurnRequest(input: {
  scenario_id: string
  conversation_history: ConversationTurnPair[]
  message: string
  graph_state: GraphStatePayload
  client_turn_id?: string
}): ExplicitGenerateTurnRequest {
  return withDevTurnType({
    scenario_id: input.scenario_id,
    client_turn_id: createClientTurnId(input.client_turn_id),
    conversation_history: input.conversation_history,
    message: input.message,
    graph_state: input.graph_state,
  }, 'explicit_generate')
}

export function buildRunAnalysisTurnRequest(input: {
  scenario_id: string
  conversation_history: ConversationTurnPair[]
  graph_state: GraphStatePayload
  analysis_inputs: AnalysisInputsPayload
  client_turn_id?: string
}): RunAnalysisTurnRequest {
  return withDevTurnType({
    scenario_id: input.scenario_id,
    client_turn_id: createClientTurnId(input.client_turn_id),
    conversation_history: input.conversation_history,
    graph_state: input.graph_state,
    analysis_inputs: input.analysis_inputs,
  }, 'run_analysis')
}

export function buildSystemEventTurnRequest(input: {
  scenario_id: string
  conversation_history: ConversationTurnPair[]
  message: string
  graph_state: GraphStatePayload
  system_event: WireSystemEvent
  client_turn_id?: string
}): SystemEventTurnRequest {
  return withDevTurnType({
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
  client_turn_id?: string
}): PatchFollowupTurnRequest {
  return withDevTurnType({
    scenario_id: input.scenario_id,
    client_turn_id: createClientTurnId(input.client_turn_id),
    conversation_history: input.conversation_history,
    graph_state: input.graph_state,
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
  return withDevTurnType({
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
  return withDevTurnType({
    scenario_id: input.scenario_id,
    client_turn_id: createClientTurnId(input.client_turn_id),
    conversation_history: input.conversation_history,
    message: input.message,
  }, 'clarification_response')
}

export function validateTurnRequestBoundary(request: TurnRequestPayload): void {
  if (!import.meta.env.DEV) return

  const turnType = request._turn_type ?? 'conversation'
  const payloadKeys = Object.keys(request)
  const allowed = new Set(TURN_ALLOW_LIST[turnType])
  const required = TURN_REQUIRED_FIELDS[turnType]

  for (const key of payloadKeys) {
    if (!allowed.has(key)) {
      console.error('[BOUNDARY]', {
        turn_type: turnType,
        field: key,
        violation: 'forbidden_field',
        payload_keys: payloadKeys,
      })
    }
  }

  for (const key of required) {
    const value = (request as Record<string, unknown>)[key]
    const missing =
      value === undefined
      || value === null
      || (typeof value === 'string' && value.trim().length === 0)
    if (missing) {
      console.error('[BOUNDARY]', {
        turn_type: turnType,
        field: key,
        violation: 'missing_required_field',
        payload_keys: payloadKeys,
      })
    }
  }

  if (!isNonEmptyString(request.client_turn_id)) {
    console.error('[BOUNDARY]', {
      turn_type: turnType,
      field: 'client_turn_id',
      violation: 'client_turn_id_must_be_non_empty_string',
      payload_keys: payloadKeys,
    })
  }

  if (!isNonEmptyString(request.scenario_id)) {
    console.error('[BOUNDARY]', {
      turn_type: turnType,
      field: 'scenario_id',
      violation: 'scenario_id_must_be_non_empty_string',
      payload_keys: payloadKeys,
    })
  }

  if ('graph_state' in request && request.graph_state !== undefined && !hasGraphState(request.graph_state)) {
    console.error('[BOUNDARY]', {
      turn_type: turnType,
      field: 'graph_state',
      violation: 'graph_state_requires_nodes_and_edges_arrays',
      payload_keys: payloadKeys,
    })
  }

  if (
    request._turn_type === 'conversation'
    && 'analysis_state' in request
    && request.analysis_state !== undefined
  ) {
    console.error('[BOUNDARY]', {
      turn_type: turnType,
      field: 'analysis_state',
      violation: 'analysis_state_forbidden_on_conversation_turn',
      payload_keys: payloadKeys,
    })
  }

  if (
    request._turn_type === 'explain'
    && 'analysis_state' in request
    && request.analysis_state !== undefined
    && !isValidExplainAnalysisState(request.analysis_state)
  ) {
    console.error('[BOUNDARY]', {
      turn_type: turnType,
      field: 'analysis_state',
      violation: 'analysis_state_requires_analysis_status_meta_response_hash_results',
      payload_keys: payloadKeys,
    })
  }
}

export function stripDevTurnType<T extends TurnRequestPayload>(request: T): Omit<T, '_turn_type'> {
  const { _turn_type: _ignored, ...rest } = request
  return rest
}

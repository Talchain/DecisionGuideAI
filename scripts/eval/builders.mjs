// Pure request-builders that mirror src/services/turn-request-builder.ts.
// Script-local copies to keep this tool free of the app's Vite runtime.
// Invariants enforced at the network boundary in client.mjs (UUID guards).

import { newUuid } from './state.mjs'

function base({ scenario_id, client_turn_id, conversation_history, session_state }) {
  const out = {
    scenario_id,
    client_turn_id: client_turn_id ?? newUuid(),
    conversation_history: conversation_history ?? [],
  }
  if (session_state != null) out.session_state = session_state
  return out
}

export function buildConversation({ scenario_id, client_turn_id, conversation_history,
  message, graph_state, selected_elements, analysis_state, chip_metadata, session_state }) {
  const req = {
    ...base({ scenario_id, client_turn_id, conversation_history, session_state }),
    message,
    graph_state,
  }
  if (selected_elements) req.selected_elements = selected_elements
  if (isValidAnalysisState(analysis_state)) req.analysis_state = analysis_state
  if (chip_metadata) req.chip_metadata = chip_metadata
  return req
}

export function buildExplicitGenerate({ scenario_id, client_turn_id, conversation_history,
  message, graph_state, session_state }) {
  return {
    ...base({ scenario_id, client_turn_id, conversation_history, session_state }),
    message,
    graph_state,
    generate_model: true,
  }
}

export function buildRunAnalysis({ scenario_id, client_turn_id, conversation_history,
  graph_state, analysis_inputs, session_state }) {
  return {
    ...base({ scenario_id, client_turn_id, conversation_history, session_state }),
    graph_state,
    analysis_inputs,
  }
}

export function buildExplain({ scenario_id, client_turn_id, conversation_history,
  message, graph_state, selected_elements, analysis_state, session_state }) {
  const req = {
    ...base({ scenario_id, client_turn_id, conversation_history, session_state }),
    message,
    graph_state,
  }
  if (selected_elements) req.selected_elements = selected_elements
  if (isValidAnalysisState(analysis_state)) req.analysis_state = analysis_state
  return req
}

export function isValidAnalysisState(v) {
  if (!v || typeof v !== 'object') return false
  if (typeof v.analysis_status !== 'string' || !v.analysis_status.trim()) return false
  const meta = v.meta
  if (!meta || typeof meta !== 'object') return false
  if (typeof meta.response_hash !== 'string' || !meta.response_hash.trim()) return false
  return true
}

// The UI builders attach `_turn_type` for internal telemetry and strip it
// before send. The script just never attaches it. Same wire shape.

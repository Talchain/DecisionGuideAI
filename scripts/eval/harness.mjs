// Per-turn harness: builds request, calls CEE, applies patch, logs everything.

import { call } from './client.mjs'
import { applyOps, collectPatchOps, pushHistory, normaliseStage, canonicalHash, blockType } from './state.mjs'
import {
  deriveExecutedTools,
  actionLanguageWithoutBlock,
  hasHtmlOrCodeFence,
  orphanedNewNodes,
  graphValidityPass,
} from './assertions.mjs'

export function createContext({ scenarioId, graph = { nodes: [], edges: [] } }) {
  return {
    scenarioId,
    graph,
    sessionState: null,
    analysisState: null,
    history: [],
    turnLogs: [],
  }
}

function firstN(s, n) {
  if (typeof s !== 'string') return ''
  return s.length <= n ? s : s.slice(0, n)
}

function pickModelInfo(envelope, streamEvents) {
  const trace = envelope?._diagnostic_trace ?? null
  const route = envelope?._route_metadata ?? null
  let model = null
  let provider = null
  let prompt_version = null
  let cache_hit = null

  if (route) {
    if (typeof route.resolved_model === 'string') model = route.resolved_model
    if (typeof route.resolved_provider === 'string') provider = route.resolved_provider
  }
  if (trace && Array.isArray(trace.llm_calls) && trace.llm_calls.length > 0) {
    const last = trace.llm_calls[trace.llm_calls.length - 1]
    if (last && typeof last === 'object') {
      if (!model && typeof last.model === 'string') model = last.model
      if (!provider && typeof last.provider === 'string') provider = last.provider
      const pi = last.prompt_identity
      if (pi && typeof pi === 'object' && typeof pi.version === 'string') prompt_version = pi.version
      else if (typeof last.prompt_version === 'string') prompt_version = last.prompt_version
      if (typeof last.cache_hit === 'boolean') cache_hit = last.cache_hit
    }
  }
  if (trace && cache_hit == null && typeof trace.cache_hit === 'boolean') cache_hit = trace.cache_hit
  return { model, provider, prompt_version, cache_hit }
}

function compactStreamEvents(events) {
  if (!Array.isArray(events)) return null
  return events.map((e) => {
    const o = { seq: e.seq, type: e.type, t_ms: e.t_ms }
    if (e.tool_name) o.tool_name = e.tool_name
    if (typeof e.success === 'boolean') o.success = e.success
    if (e.block_type) o.block_type = e.block_type
    if (e.error) o.error = e.error
    return o
  })
}

// Build an analysis_state payload from an envelope's analysis_response.
export function deriveAnalysisState(envelope) {
  const ar = envelope?.analysis_response
  if (!ar) return null
  return {
    analysis_status: 'complete',
    meta: { response_hash: canonicalHash(ar, 16) },
  }
}

// Execute one turn. `spec` shape:
//   { message, turn_type, build: (ctx) => requestBody, assert?: (data) => string[] | null }
//
// `mode` is 'stream' | 'sync'.
export async function runTurn({ ctx, spec, scenarioName, mode }) {
  const turnNumber = ctx.turnLogs.length + 1
  const nodesBefore = ctx.graph.nodes.length
  const edgesBefore = ctx.graph.edges.length
  const nodeIdsBefore = new Set(ctx.graph.nodes.map((n) => n.id))
  const edgeIdsBefore = new Set(ctx.graph.edges.map((e) => e.id))

  const requestBody = spec.build(ctx)

  let envelope = null
  let latency_ms = 0
  let cache_hit = null
  let transport = null
  let stream_events = null
  let transportError = null
  try {
    const res = await call(requestBody, { mode })
    envelope = res.envelope
    latency_ms = res.latency_ms
    cache_hit = res.cache_hit
    transport = res.transport
    stream_events = res.stream_events
  } catch (err) {
    transportError = {
      name: err?.name ?? 'Error',
      message: err?.message ?? String(err),
      status: err?.status ?? 0,
      kind: err?.kind ?? 'unknown',
      body: err?.body ?? null,
    }
  }

  // On transport failure, emit a log entry and bail. Scenario-level code
  // decides whether to continue (it usually shouldn't).
  if (transportError) {
    const log = {
      turn: turnNumber,
      scenario: scenarioName,
      turn_type: spec.turn_type,
      message: spec.message,
      executed_tools: [],
      tool_source: 'unavailable',
      prompt_version: null,
      model: null,
      provider: null,
      latency_ms,
      cache_hit: null,
      transport,
      assistant_text_preview: '',
      blocks: [],
      suggested_actions: [],
      stage_indicator: null,
      graph_delta: {
        nodes_before: nodesBefore,
        nodes_after: nodesBefore,
        edges_before: edgesBefore,
        edges_after: edgesBefore,
        added_node_ids: [],
        removed_node_ids: [],
        added_edge_ids: [],
        removed_edge_ids: [],
      },
      flags: {
        action_language_without_block: false,
        contains_html_or_code: false,
        graph_validity_pass: graphValidityPass(ctx.graph),
        orphaned_new_nodes: [],
      },
      raw_request: requestBody,
      raw_response: { error: transportError },
      raw_stream_events: null,
      pass: false,
      failures: [`transport_error:${transportError.kind}:${transportError.message}`],
    }
    ctx.turnLogs.push(log)
    return { log, envelope: null, ops: [], transportError }
  }

  // Apply graph patches (if any) to local state.
  const ops = collectPatchOps(envelope?.blocks)
  let applyResult = { graph: ctx.graph, newNodeIds: [], newEdgeIds: [], removedNodeIds: [], removedEdgeIds: [], skipped: [] }
  if (ops.length > 0) applyResult = applyOps(ctx.graph, ops)
  ctx.graph = applyResult.graph

  // Round-trip session + analysis state.
  if (envelope && Object.prototype.hasOwnProperty.call(envelope, 'updated_session_state')) {
    ctx.sessionState = envelope.updated_session_state ?? null
  }
  const derivedAnalysisState = deriveAnalysisState(envelope)
  if (derivedAnalysisState) ctx.analysisState = derivedAnalysisState

  // History trim.
  ctx.history = pushHistory(ctx.history, 'user', spec.message)
  ctx.history = pushHistory(ctx.history, 'assistant', envelope?.assistant_text ?? '')

  // Derived signals.
  const { model, provider, prompt_version, cache_hit: traceCache } = pickModelInfo(envelope, stream_events)
  if (cache_hit == null) cache_hit = traceCache
  const { tools: executed_tools, source: tool_source } = deriveExecutedTools(envelope, stream_events, ops)

  const nodeIdsAfter = new Set(ctx.graph.nodes.map((n) => n.id))
  const edgeIdsAfter = new Set(ctx.graph.edges.map((e) => e.id))
  const addedNodeIdsThisTurn = [...nodeIdsAfter].filter((id) => !nodeIdsBefore.has(id))
  const removedNodeIdsThisTurn = [...nodeIdsBefore].filter((id) => !nodeIdsAfter.has(id))
  const addedEdgeIdsThisTurn = [...edgeIdsAfter].filter((id) => !edgeIdsBefore.has(id))
  const removedEdgeIdsThisTurn = [...edgeIdsBefore].filter((id) => !edgeIdsAfter.has(id))

  const orphaned = orphanedNewNodes(addedNodeIdsThisTurn, ctx.graph)
  const validity = graphValidityPass(ctx.graph)
  const action_language_flag = actionLanguageWithoutBlock(envelope?.assistant_text, envelope?.blocks)
  const html_flag = hasHtmlOrCodeFence(envelope?.assistant_text)

  const log = {
    turn: turnNumber,
    scenario: scenarioName,
    turn_type: spec.turn_type,
    message: spec.message,
    executed_tools,
    tool_source,
    prompt_version,
    model,
    provider,
    latency_ms,
    cache_hit,
    transport,
    assistant_text_preview: firstN(envelope?.assistant_text ?? '', 300),
    blocks: (envelope?.blocks ?? []).map((b) => ({ type: blockType(b) ?? 'unknown' })),
    suggested_actions: (envelope?.suggested_actions ?? []).map((c) => ({
      label: c?.label ?? '',
      action_type: c?.action_type ?? '',
    })),
    stage_indicator: normaliseStage(envelope?.stage_indicator),
    graph_delta: {
      nodes_before: nodesBefore,
      nodes_after: ctx.graph.nodes.length,
      edges_before: edgesBefore,
      edges_after: ctx.graph.edges.length,
      added_node_ids: addedNodeIdsThisTurn,
      removed_node_ids: removedNodeIdsThisTurn,
      added_edge_ids: addedEdgeIdsThisTurn,
      removed_edge_ids: removedEdgeIdsThisTurn,
    },
    flags: {
      action_language_without_block: action_language_flag,
      contains_html_or_code: html_flag,
      graph_validity_pass: validity,
      orphaned_new_nodes: orphaned,
    },
    raw_request: requestBody,
    raw_response: envelope,
    raw_stream_events: compactStreamEvents(stream_events),
    pass: true,
    failures: [],
  }
  ctx.turnLogs.push(log)
  return { log, envelope, ops, apply: applyResult }
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

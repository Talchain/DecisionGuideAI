// Pure assertion helpers. All return either `null` (pass) or a string reason (fail)
// unless otherwise noted, so callers can `.filter(Boolean)` into a failures list.

import { blockType } from './state.mjs'

export function hasGraphPatchBlock(blocks) {
  return (blocks ?? []).some((b) => blockType(b) === 'graph_patch')
}

export function patchHasOp(ops, predicate) {
  return (ops ?? []).some(predicate)
}

export function patchAddedNodeKind(ops, kind) {
  return (ops ?? []).some((op) => {
    if (op.op !== 'add_node') return false
    const d = op.data ?? {}
    return (d.kind ?? d.type) === kind
  })
}

// update_edge whose data keys are a subset of calibration-only fields.
const CALIBRATION_FIELDS = new Set([
  'weight', 'strength', 'strength_mean', 'strength_std',
  'belief', 'belief_exists', 'exists_probability',
  'effect_direction', 'confidence',
])
export function patchEdgeCalibrationOnly(op) {
  if (op.op !== 'update_edge') return false
  const keys = Object.keys(op.data ?? {})
  if (keys.length === 0) return false
  return keys.every((k) => CALIBRATION_FIELDS.has(k))
}

// Any add_node, remove_node, add_edge, remove_edge, OR update_edge with endpoint rewire.
export function isStructuralPatch(ops) {
  return (ops ?? []).some((op) => {
    if (op.op === 'add_node' || op.op === 'remove_node') return true
    if (op.op === 'add_edge' || op.op === 'remove_edge') return true
    if (op.op === 'update_edge') {
      const d = op.data ?? {}
      return typeof (d.source ?? d.from) === 'string' || typeof (d.target ?? d.to) === 'string'
    }
    return false
  })
}

export function hasHtmlOrCodeFence(text) {
  if (typeof text !== 'string' || !text) return false
  return /<[a-z][^>]*>|```/i.test(text)
}

// Imperative action language: assistant claims to have mutated the graph.
// `blocks` is the envelope's blocks array — if a graph_patch is present, a claim is backed up.
const ACTION_VERB_RE = /\b(?:i(?:'ll|'ve| will| have| just)?|i)\s+(?:add(?:ed|ing)?|remov(?:e|ed|ing)|delet(?:e|ed|ing)|updat(?:e|ed|ing)|chang(?:e|ed|ing)|connect(?:ed|ing)?|rewir(?:e|ed|ing)|link(?:ed|ing)?|set)\b/i
const PAST_TENSE_ACTION_RE = /\b(?:added|removed|deleted|updated|changed|connected|rewired|linked|set)\s+(?:the|a|an|your)\s+/i

export function actionLanguageWithoutBlock(text, blocks) {
  if (typeof text !== 'string' || !text) return false
  if (hasGraphPatchBlock(blocks)) return false
  return ACTION_VERB_RE.test(text) || PAST_TENSE_ACTION_RE.test(text)
}

// Newly added node IDs (from ops in this turn) that have zero incident edges
// in the post-apply graph. Returns the list — empty means pass.
export function orphanedNewNodes(newNodeIds, graphAfter) {
  if (!newNodeIds || newNodeIds.length === 0) return []
  const edges = graphAfter?.edges ?? []
  return newNodeIds.filter((id) => !edges.some((e) => e.source === id || e.target === id))
}

export function graphValidityPass(graph) {
  const ids = new Set((graph?.nodes ?? []).map((n) => n.id))
  for (const e of graph?.edges ?? []) {
    if (!ids.has(e.source) || !ids.has(e.target)) return false
  }
  return true
}

export function stageEquals(stageIndicator, expected) {
  if (typeof stageIndicator === 'string') return stageIndicator === expected
  if (stageIndicator && typeof stageIndicator === 'object') return stageIndicator.stage === expected
  return false
}

// Detect bare entity/UUID identifiers leaking into user-facing text.
const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i
const ENTITY_ID_RE = /\b(?:node|edge|factor|option|goal|risk|outcome)_[A-Za-z0-9]{4,}\b/
export function containsRawEntityId(text) {
  if (typeof text !== 'string' || !text) return false
  return UUID_RE.test(text) || ENTITY_ID_RE.test(text)
}

export function containsPhrase(text, phrases) {
  if (typeof text !== 'string' || !text) return false
  const lower = text.toLowerCase()
  return phrases.some((p) => lower.includes(p.toLowerCase()))
}

// For S4: detect at least one actionable insight / next step phrase.
const ACTIONABLE_PHRASES = [
  'consider', 'next step', 'next steps', 'you could', 'you might', 'try ', 'recommend',
  'worth ', 'think about', 'ask yourself', 'would help', 'one way', 'another approach',
]
export function hasActionableInsight(text) {
  return containsPhrase(text, ACTIONABLE_PHRASES)
}

// Derive executed_tools. Priority order:
//   1. envelope.turn_plan.executed_tools — CEE's authoritative list on current wire.
//   2. SSE tool_start events from the stream timeline.
//   3. envelope._diagnostic_trace.llm_calls[].tool_name (when trace enabled).
//   4. Synthesized from patch ops + analysis_response + evidence block.
export function deriveExecutedTools(envelope, streamEvents, ops) {
  // 1. turn_plan.executed_tools
  const turnPlan = envelope?.turn_plan
  if (turnPlan && typeof turnPlan === 'object' && Array.isArray(turnPlan.executed_tools)) {
    const names = turnPlan.executed_tools.filter((n) => typeof n === 'string' && n)
    if (names.length > 0) return { tools: [...new Set(names)], source: 'turn_plan' }
  }

  // 2. SSE tool_start events
  if (Array.isArray(streamEvents) && streamEvents.length > 0) {
    const fromStream = []
    for (const ev of streamEvents) {
      if (ev.type === 'tool_start' && typeof ev.tool_name === 'string' && ev.tool_name) {
        fromStream.push(ev.tool_name)
      }
    }
    if (fromStream.length > 0) {
      return { tools: [...new Set(fromStream)], source: 'stream_tool_events' }
    }
  }

  // 3. _diagnostic_trace.llm_calls
  const trace = envelope?._diagnostic_trace
  if (trace && Array.isArray(trace.llm_calls)) {
    const names = []
    for (const call of trace.llm_calls) {
      if (call && typeof call === 'object') {
        const n = call.tool_name ?? call.tool ?? call.name
        if (typeof n === 'string' && n) names.push(n)
      }
    }
    if (names.length > 0) return { tools: [...new Set(names)], source: 'diagnostic_trace' }
  }

  // 4. Synthesize
  const tools = new Set()
  if (ops && ops.length > 0) tools.add('edit_graph')
  if (envelope?.analysis_response) tools.add('run_analysis')
  if ((envelope?.blocks ?? []).some((b) => {
    if (!b) return false
    return b.type === 'evidence' || b.block_type === 'evidence'
  })) tools.add('research_topic')
  return { tools: [...tools], source: 'synthesized' }
}

// Mirrors the CEE universal artefact-truth gate regex. Used by S2/S3 to assert
// that a conversational (non-structural) response does NOT falsely claim a
// mutation happened.
const ACTION_COMPLETION_RE =
  /\b(connecting|connected|adding|added|removing|removed|rewiring|rewired|updating|updated|proposing to|mapping|mapped|setting|set to)\b.{0,30}\b(now|it|them|those|this|the|to)\b/i

export function containsActionCompletionLanguage(text) {
  if (typeof text !== 'string' || !text) return false
  return ACTION_COMPLETION_RE.test(text)
}

// Does `text` reference ≥ n labels of nodes from `graph`? Case-insensitive,
// word-boundary match. Skips very short labels (≤ 2 chars) to avoid
// coincidences. Used by S2 conversational-path assertion.
export function mentionsGraphEntities(text, graph, n) {
  if (typeof text !== 'string' || !text) return false
  const nodes = graph?.nodes ?? []
  const lower = text.toLowerCase()
  let hits = 0
  const seen = new Set()
  for (const node of nodes) {
    const raw = node?.label ?? node?.data?.label
    const label = typeof raw === 'string' ? raw.trim() : ''
    if (!label || label.length < 3) continue
    const key = label.toLowerCase()
    if (seen.has(key)) continue
    if (lower.includes(key)) {
      seen.add(key)
      hits += 1
      if (hits >= n) return true
    }
  }
  return false
}

// For S7: flag chips whose action_type is in a forbidden set (misleading / unavailable).
export function chipsWithForbiddenActionType(chips, forbidden) {
  const set = new Set(forbidden)
  return (chips ?? []).filter((c) => c && typeof c.action_type === 'string' && set.has(c.action_type))
}

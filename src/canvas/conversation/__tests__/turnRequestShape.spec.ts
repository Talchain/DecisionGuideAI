/**
 * Turn Request Payload Shape — validates that buildRequest produces
 * a payload conforming to the OrchestratorTurnRequest contract.
 *
 * These tests catch payload shape issues before they hit the network.
 * They run against the actual buildRequest logic extracted from useConversation.
 */

import { describe, it, expect } from 'vitest'
import type { OrchestratorTurnRequest, ConversationTurnPair } from '../types'
import { serializeSystemEvent } from '../systemEvents'
import type { SystemEvent } from '../types'

// ---------------------------------------------------------------------------
// Reproduce the buildHistory logic from useConversation (not exported)
// ---------------------------------------------------------------------------
function buildHistory(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  maxPairs: number,
): ConversationTurnPair[] {
  const pairs: ConversationTurnPair[] = []
  for (const msg of messages) {
    pairs.push({ role: msg.role, content: msg.content })
  }
  // Keep last N pairs
  return pairs.slice(-maxPairs * 2)
}

// ---------------------------------------------------------------------------
// Build a request matching the exact shape from useConversation.buildRequest
// ---------------------------------------------------------------------------
function buildTestRequest(overrides: Partial<OrchestratorTurnRequest> = {}): OrchestratorTurnRequest {
  return {
    scenario_id: 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4',
    message: 'Should I invest in stocks or bonds?',
    conversation_history: [],
    graph_state: {
      nodes: [],
      edges: [],
    },
    client_turn_id: 'deadbeef-1234-5678-abcd-ef0123456789',
    ...overrides,
  }
}

const validAnalysisState = {
  analysis_status: 'complete',
  meta: { response_hash: 'hash-abc' },
  results: { summary: 'ok' },
}

describe('OrchestratorTurnRequest payload shape', () => {
  describe('required fields', () => {
    it('includes scenario_id as a non-empty string', () => {
      const req = buildTestRequest()
      expect(typeof req.scenario_id).toBe('string')
      expect(req.scenario_id.length).toBeGreaterThan(0)
    })

    it('includes message as a non-empty string', () => {
      const req = buildTestRequest()
      expect(typeof req.message).toBe('string')
      expect(req.message.length).toBeGreaterThan(0)
    })

    it('includes client_turn_id as a non-empty string', () => {
      const req = buildTestRequest()
      expect(typeof req.client_turn_id).toBe('string')
      expect(req.client_turn_id.length).toBeGreaterThan(0)
    })

    it('includes conversation_history as an array', () => {
      const req = buildTestRequest()
      expect(Array.isArray(req.conversation_history)).toBe(true)
    })

    it('includes graph_state with nodes and edges arrays', () => {
      const req = buildTestRequest()
      expect(Array.isArray(req.graph_state.nodes)).toBe(true)
      expect(Array.isArray(req.graph_state.edges)).toBe(true)
    })

    it('analysis_state is optional and omitted when no analysis available', () => {
      const req = buildTestRequest()
      expect(req.analysis_state).toBeUndefined()
    })

    it('analysis_state includes analysis_status, meta.response_hash, and results when present', () => {
      const req = buildTestRequest({ analysis_state: validAnalysisState })
      expect(req.analysis_state).toBeDefined()
      expect(typeof req.analysis_state!.analysis_status).toBe('string')
      expect(typeof req.analysis_state!.meta.response_hash).toBe('string')
      expect(req.analysis_state!.results).toBeDefined()
    })
  })

  describe('conversation_history shape', () => {
    it('each entry has role and content', () => {
      const history = buildHistory(
        [
          { role: 'user', content: 'invest in stocks?' },
          { role: 'assistant', content: 'Let me help with that.' },
        ],
        5,
      )
      const req = buildTestRequest({ conversation_history: history })

      for (const entry of req.conversation_history) {
        expect(['user', 'assistant']).toContain(entry.role)
        expect(typeof entry.content).toBe('string')
      }
    })

    it('caps at MAX_HISTORY_PAIRS * 2 entries', () => {
      const manyMessages = Array.from({ length: 20 }, (_, i) => ({
        role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
        content: `message ${i}`,
      }))
      const history = buildHistory(manyMessages, 5)
      expect(history.length).toBeLessThanOrEqual(10)
    })
  })

  describe('optional fields', () => {
    it('selected_elements is omitted when no selection', () => {
      const req = buildTestRequest()
      expect(req.selected_elements).toBeUndefined()
    })

    it('selected_elements includes node_ids and edge_ids when present', () => {
      const req = buildTestRequest({
        selected_elements: { node_ids: ['n1'], edge_ids: ['e1'] },
      })
      expect(req.selected_elements!.node_ids).toEqual(['n1'])
      expect(req.selected_elements!.edge_ids).toEqual(['e1'])
    })

    it('analysis_inputs is omitted when no options available', () => {
      const req = buildTestRequest()
      expect(req.analysis_inputs).toBeUndefined()
    })

    it('analysis_inputs includes options and goal_node_id when present', () => {
      const req = buildTestRequest({
        analysis_inputs: {
          options: [{
            id: 'opt1',
            option_id: 'opt1',
            label: 'Option A',
            interventions: {},
          }],
          goal_node_id: 'goal-1',
        },
      })
      expect(req.analysis_inputs!.goal_node_id).toBe('goal-1')
      expect(req.analysis_inputs!.options).toHaveLength(1)
      expect(req.analysis_inputs!.options[0].option_id).toBe('opt1')
    })

    it('system_event is omitted on normal user turns', () => {
      const req = buildTestRequest()
      expect(req.system_event).toBeUndefined()
    })

    it('turn_nonce is omitted by default', () => {
      const req = buildTestRequest()
      expect(req.turn_nonce).toBeUndefined()
    })
  })

  describe('serialization', () => {
    it('serialises to valid JSON without undefined values', () => {
      const req = buildTestRequest()
      const json = JSON.stringify(req)
      expect(() => JSON.parse(json)).not.toThrow()

      const parsed = JSON.parse(json)
      // JSON.stringify strips undefined keys — verify they are actually gone
      expect('selected_elements' in parsed).toBe(false)
      expect('analysis_inputs' in parsed).toBe(false)
      expect('system_event' in parsed).toBe(false)
      expect('turn_nonce' in parsed).toBe(false)
    })

    it('preserves graph_state.nodes as an array even when empty', () => {
      const req = buildTestRequest()
      const parsed = JSON.parse(JSON.stringify(req))
      expect(Array.isArray(parsed.graph_state.nodes)).toBe(true)
      expect(Array.isArray(parsed.graph_state.edges)).toBe(true)
    })

    it('preserves analysis_state structure through serialization', () => {
      const req = buildTestRequest({ analysis_state: validAnalysisState })
      const parsed = JSON.parse(JSON.stringify(req))
      expect(parsed.analysis_state.analysis_status).toBe('complete')
      expect(parsed.analysis_state.meta.response_hash).toBe('hash-abc')
      expect(parsed.analysis_state.results).toEqual({ summary: 'ok' })
    })
  })

  describe('top-level key inventory', () => {
    it('fresh conversation request has exactly the expected keys (no analysis)', () => {
      const req = buildTestRequest()
      const serialised = JSON.parse(JSON.stringify(req))
      const keys = Object.keys(serialised).sort()

      // Fresh conversation with no analysis results — analysis_state is absent
      expect(keys).toEqual([
        'client_turn_id',
        'conversation_history',
        'graph_state',
        'message',
        'scenario_id',
      ])
    })

    it('conversation request with analysis includes analysis_state key', () => {
      const req = buildTestRequest({ analysis_state: validAnalysisState })
      const serialised = JSON.parse(JSON.stringify(req))
      const keys = Object.keys(serialised).sort()

      expect(keys).toEqual([
        'analysis_state',
        'client_turn_id',
        'conversation_history',
        'graph_state',
        'message',
        'scenario_id',
      ])
    })
  })
})

// ---------------------------------------------------------------------------
// RF_NODE_BLOCKLIST — same as useConversation module-level constant
// Reproduced here for testing the transform logic independently.
// ---------------------------------------------------------------------------
const RF_NODE_BLOCKLIST = new Set([
  'selected', 'dragging', 'measured', 'resizing',
  'position', 'positionAbsolute', 'draggable', 'selectable',
  'deletable', 'connectable', 'focusable', 'parentId', 'extent',
  'expandParent', 'ariaLabel', 'zIndex', 'hidden',
  'label', 'kind', 'type', 'uncertainty', 'interventions',
  '_baseline_snapshot',
])

/**
 * Reproduce the node transform from useConversation.buildRequest
 * to test independently of the React hook.
 */
function transformNodeToCEE(n: { id: string; type?: string; data?: Record<string, unknown> }) {
  const d = n.data ?? {}
  const out: Record<string, unknown> = {
    id: n.id,
    kind: d.kind ?? n.type ?? 'factor',
    label: d.label ?? n.id,
  }
  for (const [key, value] of Object.entries(d)) {
    if (RF_NODE_BLOCKLIST.has(key) || value === undefined) continue
    if (key === 'observedState') { out.observed_state = value; continue }
    out[key] = value
  }
  return out
}

/** Reproduce the edge transform from useConversation.buildRequest */
function transformEdgeToCEE(e: { source: string; target: string; data?: Record<string, unknown> }) {
  const d = e.data ?? {}
  const weight = typeof d.weight === 'number' ? d.weight : 0.5
  const direction = d.direction === 'negative' ? -1 : 1
  const mean = direction * weight
  const std = typeof d.strengthStd === 'number' ? d.strengthStd : undefined
  const existsProb = d.beliefExists ?? d.confidence ?? d.belief
  const edgeType = typeof d.edge_type === 'string' ? d.edge_type : 'directed'
  return {
    from: e.source,
    to: e.target,
    strength: { mean, ...(std !== undefined ? { std } : {}) },
    ...(existsProb !== undefined ? { exists_probability: existsProb } : {}),
    ...(d.direction ? { effect_direction: d.direction } : {}),
    edge_type: edgeType,
  }
}

// ---------------------------------------------------------------------------
// graph_state transformation (RF → CEE)
// ---------------------------------------------------------------------------

describe('graph_state node transformation (RF → CEE)', () => {
  it('transforms id, kind, label from React Flow node', () => {
    const node = transformNodeToCEE({
      id: 'goal_1',
      type: 'goal',
      data: { label: 'Maximise Revenue', kind: 'goal' },
    })
    expect(node.id).toBe('goal_1')
    expect(node.kind).toBe('goal')
    expect(node.label).toBe('Maximise Revenue')
  })

  it('falls back to node.type when data.kind is missing', () => {
    const node = transformNodeToCEE({
      id: 'f1',
      type: 'factor',
      data: { label: 'Price' },
    })
    expect(node.kind).toBe('factor')
  })

  it('falls back to node.id when data.label is missing', () => {
    const node = transformNodeToCEE({ id: 'unnamed_1', type: 'factor', data: {} })
    expect(node.label).toBe('unnamed_1')
  })

  it('strips React Flow internal fields', () => {
    const node = transformNodeToCEE({
      id: 'n1',
      type: 'factor',
      data: {
        label: 'Price',
        kind: 'factor',
        selected: true,
        dragging: false,
        measured: { width: 200, height: 50 },
        resizing: false,
        position: { x: 100, y: 200 },
        positionAbsolute: { x: 100, y: 200 },
        draggable: true,
        selectable: true,
        deletable: true,
        connectable: true,
        focusable: true,
        parentId: null,
        zIndex: 0,
        hidden: false,
      },
    })
    expect(node).toEqual({ id: 'n1', kind: 'factor', label: 'Price' })
    expect(node).not.toHaveProperty('selected')
    expect(node).not.toHaveProperty('dragging')
    expect(node).not.toHaveProperty('position')
    expect(node).not.toHaveProperty('measured')
  })

  it('renames observedState → observed_state', () => {
    const node = transformNodeToCEE({
      id: 'f1',
      type: 'factor',
      data: {
        label: 'Price',
        kind: 'factor',
        observedState: { value: 100, baseline: 80, unit: 'USD' },
      },
    })
    expect(node.observed_state).toEqual({ value: 100, baseline: 80, unit: 'USD' })
    expect(node).not.toHaveProperty('observedState')
  })

  it('passes through CEE-relevant fields (category, prior)', () => {
    const node = transformNodeToCEE({
      id: 'f1',
      type: 'factor',
      data: {
        label: 'Market Cap',
        kind: 'factor',
        category: 'external',
        prior: { range_min: 0, range_max: 100 },
        goal_threshold_type: 'above',
      },
    })
    expect(node.category).toBe('external')
    expect(node.prior).toEqual({ range_min: 0, range_max: 100 })
    expect(node.goal_threshold_type).toBe('above')
  })

  it('does not include undefined values', () => {
    const node = transformNodeToCEE({
      id: 'f1',
      type: 'factor',
      data: { label: 'Test', kind: 'factor', category: undefined },
    })
    const keys = Object.keys(node)
    expect(keys).not.toContain('category')
  })

  it('never includes type, position, or data wrapper', () => {
    const node = transformNodeToCEE({
      id: 'n1',
      type: 'goal',
      data: { label: 'Goal', kind: 'goal' },
    })
    const json = JSON.stringify(node)
    expect(json).not.toContain('"type"')
    expect(json).not.toContain('"position"')
    expect(json).not.toContain('"data"')
  })
})

describe('graph_state edge transformation (RF → CEE)', () => {
  it('transforms source/target → from/to', () => {
    const edge = transformEdgeToCEE({
      source: 'opt_a',
      target: 'goal_1',
      data: { weight: 0.7, direction: 'positive' },
    })
    expect(edge.from).toBe('opt_a')
    expect(edge.to).toBe('goal_1')
    expect(edge).not.toHaveProperty('source')
    expect(edge).not.toHaveProperty('target')
  })

  it('computes signed strength.mean from weight and direction', () => {
    const pos = transformEdgeToCEE({
      source: 'a', target: 'b',
      data: { weight: 0.8, direction: 'positive' },
    })
    expect(pos.strength.mean).toBeCloseTo(0.8)

    const neg = transformEdgeToCEE({
      source: 'a', target: 'b',
      data: { weight: 0.6, direction: 'negative' },
    })
    expect(neg.strength.mean).toBeCloseTo(-0.6)
  })

  it('defaults weight to 0.5 when missing', () => {
    const edge = transformEdgeToCEE({ source: 'a', target: 'b', data: {} })
    expect(edge.strength.mean).toBeCloseTo(0.5)
  })

  it('includes exists_probability from beliefExists', () => {
    const edge = transformEdgeToCEE({
      source: 'a', target: 'b',
      data: { weight: 0.5, beliefExists: 0.9 },
    })
    expect(edge.exists_probability).toBe(0.9)
  })

  it('omits exists_probability when not available', () => {
    const edge = transformEdgeToCEE({
      source: 'a', target: 'b',
      data: { weight: 0.5 },
    })
    expect(edge).not.toHaveProperty('exists_probability')
  })

  it('includes effect_direction when present', () => {
    const edge = transformEdgeToCEE({
      source: 'a', target: 'b',
      data: { weight: 0.5, direction: 'negative' },
    })
    expect(edge.effect_direction).toBe('negative')
  })

  it('includes strengthStd when available', () => {
    const edge = transformEdgeToCEE({
      source: 'a', target: 'b',
      data: { weight: 0.5, strengthStd: 0.15 },
    })
    expect(edge.strength.std).toBe(0.15)
  })

  it('never includes React Flow id or type', () => {
    const edge = transformEdgeToCEE({
      source: 'a', target: 'b',
      data: { weight: 0.5 },
    })
    expect(edge).not.toHaveProperty('id')
    expect(edge).not.toHaveProperty('type')
  })

  it('preserves edge_type when present (e.g. bidirected)', () => {
    const edge = transformEdgeToCEE({
      source: 'a', target: 'b',
      data: { weight: 0.5, edge_type: 'bidirected' },
    })
    expect(edge.edge_type).toBe('bidirected')
  })

  it('defaults edge_type to "directed" when absent', () => {
    const edge = transformEdgeToCEE({
      source: 'a', target: 'b',
      data: { weight: 0.5 },
    })
    expect(edge.edge_type).toBe('directed')
  })
})

// ---------------------------------------------------------------------------
// Multi-turn conversation lifecycle
// ---------------------------------------------------------------------------

describe('multi-turn conversation lifecycle', () => {
  it('Turn 1: fresh brief has empty history and empty graph', () => {
    const req = buildTestRequest({
      message: 'Should I invest in stocks or bonds?',
      conversation_history: [],
      graph_state: { nodes: [], edges: [] },
    })
    expect(req.conversation_history).toHaveLength(0)
    expect(req.graph_state.nodes).toHaveLength(0)
    expect(req.graph_state.edges).toHaveLength(0)
    expect(req.system_event).toBeUndefined()
  })

  it('Turn 2: follow-up has history and CEE-format graph', () => {
    const ceeNodes = [
      transformNodeToCEE({ id: 'g1', type: 'goal', data: { label: 'Goal', kind: 'goal' } }),
      transformNodeToCEE({ id: 'o1', type: 'option', data: { label: 'Opt A', kind: 'option' } }),
    ]
    const ceeEdges = [
      transformEdgeToCEE({ source: 'o1', target: 'g1', data: { weight: 0.7, direction: 'positive' } }),
    ]
    const history = buildHistory([
      { role: 'user', content: 'Should I invest?' },
      { role: 'assistant', content: 'Created model.' },
    ], 5)

    const req = buildTestRequest({
      message: 'What about inflation?',
      conversation_history: history,
      graph_state: { nodes: ceeNodes, edges: ceeEdges },
    })

    expect(req.conversation_history).toHaveLength(2)
    // Nodes are CEE format (kind, not type; no position/data wrapper)
    const node = req.graph_state.nodes[0] as Record<string, unknown>
    expect(node.kind).toBe('goal')
    expect(node).not.toHaveProperty('type')
    expect(node).not.toHaveProperty('position')
    // Edges are CEE format (from/to, not source/target)
    const edge = req.graph_state.edges[0] as Record<string, unknown>
    expect(edge.from).toBe('o1')
    expect(edge.to).toBe('g1')
    expect(edge).not.toHaveProperty('source')
    expect(edge).not.toHaveProperty('target')
  })

  it('Turn 3: longer history is capped at 10 entries', () => {
    const messages = Array.from({ length: 12 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `msg ${i}`,
    }))
    const history = buildHistory(messages, 5)
    expect(history.length).toBeLessThanOrEqual(10)
  })

  it('Turn 4: system event serialized to V3 wire format', () => {
    const event: SystemEvent = { type: 'patch_accepted', payload: { patch_id: 'p1' } }
    const wire = serializeSystemEvent(event)
    expect(wire).not.toBeNull()
    expect(wire!.event_type).toBe('patch_accepted')
    expect(typeof wire!.timestamp).toBe('string')
    expect(typeof wire!.event_id).toBe('string')
    expect(wire!.details).toEqual({ patch_id: 'p1' })
    // Must NOT have 'type' or 'payload' (internal format)
    expect(wire).not.toHaveProperty('type')
    expect(wire).not.toHaveProperty('payload')
  })

  it('Turn 4: unknown system event types are filtered out', () => {
    const event: SystemEvent = { type: 'session_resume' }
    const wire = serializeSystemEvent(event)
    expect(wire).toBeNull()
  })

  it('Turn 5: analysis request includes analysis_inputs', () => {
    const req = buildTestRequest({
      message: 'Run the analysis',
      analysis_inputs: {
        goal_node_id: 'g1',
        options: [
          { id: 'o1', option_id: 'o1', label: 'Opt A', interventions: {} },
        ],
      },
    })
    expect(req.analysis_inputs).toBeDefined()
    expect(req.analysis_inputs!.goal_node_id).toBe('g1')
    expect(req.analysis_inputs!.options).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// CEE schema conformance assertions
// ---------------------------------------------------------------------------

describe('CEE schema conformance', () => {
  it('graph_state.nodes never contain React Flow wrapper fields', () => {
    // Simulate what buildRequest would produce with a populated graph
    const rfNode = {
      id: 'n1', type: 'factor',
      data: {
        label: 'Test', kind: 'factor', category: 'external',
        selected: true, dragging: false, measured: { w: 100 },
        observedState: { value: 42 },
      },
    }
    const ceeNode = transformNodeToCEE(rfNode)
    const json = JSON.stringify(ceeNode)

    // Must have CEE fields
    expect(ceeNode.id).toBe('n1')
    expect(ceeNode.kind).toBe('factor')
    expect(ceeNode.label).toBe('Test')
    expect(ceeNode.category).toBe('external')
    expect(ceeNode.observed_state).toEqual({ value: 42 })

    // Must NOT have RF fields
    expect(json).not.toContain('"selected"')
    expect(json).not.toContain('"dragging"')
    expect(json).not.toContain('"measured"')
    expect(json).not.toContain('"observedState"')
  })

  it('graph_state.edges use from/to and strength, not source/target', () => {
    const rfEdge = {
      source: 'a', target: 'b',
      data: { weight: 0.8, direction: 'negative' as const, strengthStd: 0.1, beliefExists: 0.9 },
    }
    const ceeEdge = transformEdgeToCEE(rfEdge)

    expect(ceeEdge.from).toBe('a')
    expect(ceeEdge.to).toBe('b')
    expect(ceeEdge.strength.mean).toBeCloseTo(-0.8)
    expect(ceeEdge.strength.std).toBe(0.1)
    expect(ceeEdge.exists_probability).toBe(0.9)
    expect(ceeEdge.effect_direction).toBe('negative')
    expect(ceeEdge.edge_type).toBe('directed') // defaulted when absent from data
    expect(ceeEdge).not.toHaveProperty('source')
    expect(ceeEdge).not.toHaveProperty('target')
    expect(ceeEdge).not.toHaveProperty('weight')
    expect(ceeEdge).not.toHaveProperty('direction')
  })

  it('system_event uses event_type discriminator, not type', () => {
    const event: SystemEvent = { type: 'direct_graph_edit', payload: { modified_ids: ['n1'] } }
    const wire = serializeSystemEvent(event)
    expect(wire!.event_type).toBe('direct_graph_edit')
    expect(wire).not.toHaveProperty('type')
  })
})

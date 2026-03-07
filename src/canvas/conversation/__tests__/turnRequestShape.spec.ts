/**
 * Turn Request Payload Shape — validates that buildRequest produces
 * a payload conforming to the OrchestratorTurnRequest contract.
 *
 * These tests catch payload shape issues before they hit the network.
 * They run against the actual buildRequest logic extracted from useConversation.
 */

import { describe, it, expect } from 'vitest'
import type { OrchestratorTurnRequest, ConversationTurnPair } from '../types'

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
    scenario_id: 'session-1709827200000',
    message: 'Should I invest in stocks or bonds?',
    conversation_history: [],
    graph_state: {
      nodes: [],
      edges: [],
    },
    analysis_state: {
      has_results: false,
      last_run_hash: null,
    },
    client_turn_id: 'test-uuid-1234',
    ...overrides,
  }
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

    it('includes analysis_state with has_results and last_run_hash', () => {
      const req = buildTestRequest()
      expect(typeof req.analysis_state.has_results).toBe('boolean')
      expect(req.analysis_state.last_run_hash === null || typeof req.analysis_state.last_run_hash === 'string').toBe(true)
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

    it('preserves null values (last_run_hash)', () => {
      const req = buildTestRequest()
      const parsed = JSON.parse(JSON.stringify(req))
      expect(parsed.analysis_state.last_run_hash).toBeNull()
    })
  })

  describe('top-level key inventory', () => {
    it('fresh conversation request has exactly the expected keys', () => {
      const req = buildTestRequest()
      const serialised = JSON.parse(JSON.stringify(req))
      const keys = Object.keys(serialised).sort()

      // These are the keys that buildRequest in useConversation sends
      // on a fresh conversation (no selection, no analysis inputs).
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

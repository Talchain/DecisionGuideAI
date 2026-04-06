/**
 * Golden-path integration fixture contract tests.
 *
 * Validates the real wire payloads extracted from
 * olumi-debug-f0045fec-20260405 (mid-market expansion scenario).
 *
 * This is the boundary contract test — every future change that touches
 * CEE ↔ UI ↔ PLoT data flow validates against real production shapes.
 */
import { describe, test, expect } from 'vitest'
import fixture from '../../src/test/fixtures/golden-path-staging-2026-04-05.json'

import { isValidExplainAnalysisState } from '../../src/services/turn-request-builder'

// ─────────────────────────────────────────────────────────────────────
// Fixture metadata
// ─────────────────────────────────────────────────────────────────────

describe('Golden-path fixture metadata', () => {
  test('has fixture metadata', () => {
    expect(fixture._fixture_meta).toBeDefined()
    expect(fixture._fixture_meta.source_bundle).toContain('f0045fec')
  })
})

// ─────────────────────────────────────────────────────────────────────
// CEE Request
// ─────────────────────────────────────────────────────────────────────

describe('Golden-path CEE request', () => {
  const ceeReq = fixture.cee_request

  test('has non-empty graph_state with nodes and edges', () => {
    expect(ceeReq.graph_state).toBeDefined()
    expect(Array.isArray(ceeReq.graph_state.nodes)).toBe(true)
    expect(ceeReq.graph_state.nodes.length).toBeGreaterThan(0)
    expect(Array.isArray(ceeReq.graph_state.edges)).toBe(true)
    expect(ceeReq.graph_state.edges.length).toBeGreaterThan(0)
  })

  test('has non-empty conversation_history', () => {
    expect(Array.isArray(ceeReq.conversation_history)).toBe(true)
    expect(ceeReq.conversation_history.length).toBeGreaterThan(0)
  })

  test('analysis_state passes runtime validator', () => {
    expect(isValidExplainAnalysisState(ceeReq.analysis_state)).toBe(true)
  })

  test('graph_state nodes have required fields', () => {
    for (const node of ceeReq.graph_state.nodes) {
      expect(typeof node.id).toBe('string')
      // Nodes should have either type or kind
      expect(node.type || node.kind).toBeTruthy()
    }
  })
})

// ─────────────────────────────────────────────────────────────────────
// CEE Response
// ─────────────────────────────────────────────────────────────────────

describe('Golden-path CEE response', () => {
  const ceeRes = fixture.cee_response

  test('has stage_indicator: evaluate', () => {
    expect(ceeRes.stage_indicator).toBe('evaluate')
  })

  test('has assistant_text', () => {
    expect(typeof ceeRes.assistant_text).toBe('string')
    expect(ceeRes.assistant_text.length).toBeGreaterThan(0)
  })

  test('has blocks array', () => {
    expect(Array.isArray(ceeRes.blocks)).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────
// PLoT Request
// ─────────────────────────────────────────────────────────────────────

describe('Golden-path PLoT request', () => {
  const plotReq = fixture.plot_request

  test('has graph with nodes and edges', () => {
    expect(plotReq.graph).toBeDefined()
    expect(plotReq.graph.nodes.length).toBeGreaterThan(0)
    expect(plotReq.graph.edges.length).toBeGreaterThan(0)
  })

  test('has goal_node_id', () => {
    expect(typeof plotReq.goal_node_id).toBe('string')
    expect(plotReq.goal_node_id.length).toBeGreaterThan(0)
  })

  test('all options have non-empty interventions', () => {
    expect(plotReq.options.length).toBeGreaterThan(0)
    for (const option of plotReq.options) {
      expect(typeof option.id).toBe('string')
      expect(typeof option.label).toBe('string')
      expect(option.interventions).toBeDefined()
      expect(Object.keys(option.interventions).length).toBeGreaterThan(0)
    }
  })

  test('option count matches graph option node count', () => {
    const graphOptionNodes = plotReq.graph.nodes.filter(
      (n: any) => n.type === 'option' || n.kind === 'option',
    )
    expect(plotReq.options.length).toBe(graphOptionNodes.length)
  })

  test('intervention keys reference existing graph nodes', () => {
    const nodeIds = new Set(plotReq.graph.nodes.map((n: any) => n.id))
    for (const option of plotReq.options) {
      for (const targetId of Object.keys(option.interventions)) {
        expect(nodeIds.has(targetId)).toBe(true)
      }
    }
  })

  test('has seed and detail_level', () => {
    expect(plotReq.seed).toBeDefined()
    expect(plotReq.detail_level).toBe('deep')
  })
})

// ─────────────────────────────────────────────────────────────────────
// PLoT Response
// ─────────────────────────────────────────────────────────────────────

describe('Golden-path PLoT response', () => {
  const plotRes = fixture.plot_response

  test('has analysis_status: computed', () => {
    expect(plotRes.analysis_status).toBe('computed')
  })

  test('has expected status values for all analysis sections', () => {
    expect(plotRes.option_comparison_status).toBe('computed')
    expect(plotRes.robustness_status).toBe('computed')
    expect(plotRes.drivers_status).toBe('computed')
  })

  test('option_comparison count matches request options', () => {
    expect(plotRes.option_comparison.length).toBe(fixture.plot_request.options.length)
  })

  test('option_comparison entries have required fields', () => {
    for (const oc of plotRes.option_comparison) {
      expect(typeof oc.option_id).toBe('string')
      expect(typeof oc.option_label).toBe('string')
      expect(typeof oc.win_probability).toBe('number')
      expect(oc.outcome).toBeDefined()
      expect(typeof oc.outcome.mean).toBe('number')
    }
  })

  test('option_comparison IDs match request option IDs', () => {
    const requestOptionIds = new Set(fixture.plot_request.options.map((o: any) => o.id))
    for (const oc of plotRes.option_comparison) {
      expect(requestOptionIds.has(oc.option_id)).toBe(true)
    }
  })

  test('has robustness with fragile_edges', () => {
    expect(plotRes.robustness).toBeDefined()
    expect(Array.isArray(plotRes.robustness.fragile_edges)).toBe(true)
  })

  test('has factor_sensitivity entries referencing graph nodes', () => {
    const nodeIds = new Set(fixture.plot_request.graph.nodes.map((n: any) => n.id))
    expect(Array.isArray(plotRes.factor_sensitivity)).toBe(true)
    expect(plotRes.factor_sensitivity.length).toBeGreaterThan(0)
    for (const fs of plotRes.factor_sensitivity) {
      expect(typeof fs.factor_id).toBe('string')
      expect(nodeIds.has(fs.factor_id)).toBe(true)
      // Must have at least one of sensitivity_score or importance_score
      const hasScore =
        typeof fs.sensitivity_score === 'number' || typeof fs.importance_score === 'number'
      expect(hasScore).toBe(true)
    }
  })

  test('has request_id for tracing', () => {
    expect(typeof plotRes.request_id).toBe('string')
    expect(plotRes.request_id.length).toBeGreaterThan(0)
  })
})

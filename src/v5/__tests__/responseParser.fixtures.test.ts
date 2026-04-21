/**
 * responseParser fixture tests — exercise realistic wire payloads the UI
 * will encounter against staging CEE once v0.7.0 integrates.
 *
 * Each fixture mirrors the shapes documented in
 * olumi-assistants-service/src/orchestrator-v5/compose.ts and the
 * @talchain/schemas fixture tests. If any of these fail, either the UI
 * parser has drifted or the schema version is wrong.
 */
import { describe, it, expect } from 'vitest'
import { parseV5Response } from '../responseParser'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function rawResponse(status: number, body: string): Response {
  return new Response(body, {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('parseV5Response fixtures — happy-path OlumiResponse variants', () => {
  it('accepts an assistant-text-only response (frame stage)', async () => {
    const body = {
      response_version: 2,
      assistant_text: 'What outcome are you hoping for?',
      blocks: [],
      suggested_actions: [],
      insights: [],
      stage_indicator: 'frame',
    }
    const r = await parseV5Response(jsonResponse(200, body))
    expect(r.kind).toBe('response')
    if (r.kind === 'response') {
      expect(r.response.assistant_text).toContain('outcome')
    }
  })

  it('accepts an analysis_result block with enrichment.decision_review', async () => {
    const body = {
      response_version: 2,
      assistant_text: 'Here is your analysis.',
      blocks: [
        {
          type: 'analysis_result',
          summary: 'Option A leads by 12 points.',
          leading_option_id: 'opt-a',
          win_probabilities: { 'opt-a': 0.62, 'opt-b': 0.38 },
          enrichment: {
            decision_review: {
              readiness: 'ready',
              top_factors: [{ id: 'factor-1', impact: 0.4 }],
            },
            coaching_signal_id: 'FIRST_ANALYSIS_COMPLETE',
          },
        },
      ],
      suggested_actions: [],
      insights: [],
      stage_indicator: 'analyse',
    }
    const r = await parseV5Response(jsonResponse(200, body))
    expect(r.kind).toBe('response')
    if (r.kind === 'response') {
      const block = r.response.blocks[0]
      if (block?.type === 'analysis_result') {
        expect(block.leading_option_id).toBe('opt-a')
        expect(block.enrichment).toBeDefined()
        const enr = block.enrichment as Record<string, unknown>
        expect(enr.decision_review).toBeDefined()
      } else {
        throw new Error('expected analysis_result block')
      }
    }
  })

  it('accepts a graph_patch block (applied status)', async () => {
    const body = {
      response_version: 2,
      assistant_text: 'Patch applied.',
      blocks: [
        {
          type: 'graph_patch',
          status: 'applied',
          operation: 'set_factor_value',
          target_id: 'node-xyz',
          before: { value: 10 },
          after: { value: 42 },
        },
      ],
      suggested_actions: [],
      insights: [],
      stage_indicator: 'frame',
    }
    const r = await parseV5Response(jsonResponse(200, body))
    expect(r.kind).toBe('response')
  })

  it('accepts a response with suggested_actions chips (action_type enum)', async () => {
    const body = {
      response_version: 2,
      assistant_text: 'Try one of these next.',
      blocks: [],
      suggested_actions: [
        {
          id: 'chip-1',
          label: 'Run analysis',
          message: 'Run analysis',
          action_type: 'run_analysis',
        },
        {
          id: 'chip-2',
          label: 'Explain',
          message: 'Explain the result',
        },
      ],
      insights: [],
      stage_indicator: 'analyse',
    }
    const r = await parseV5Response(jsonResponse(200, body))
    expect(r.kind).toBe('response')
    if (r.kind === 'response') {
      expect(r.response.suggested_actions).toHaveLength(2)
    }
  })

  it('accepts an explanation block with referenced_option_ids', async () => {
    const body = {
      response_version: 2,
      assistant_text: 'Option A wins because of factor X.',
      blocks: [
        {
          type: 'explanation',
          narrative: 'Factor X outweighs Y.',
          referenced_option_ids: ['opt-a', 'opt-b'],
        },
      ],
      suggested_actions: [],
      insights: [],
      stage_indicator: 'analyse',
    }
    const r = await parseV5Response(jsonResponse(200, body))
    expect(r.kind).toBe('response')
  })

  it('accepts a comparison block', async () => {
    const body = {
      response_version: 2,
      assistant_text: 'Options compared.',
      blocks: [
        {
          type: 'comparison',
          options: [
            { option_id: 'opt-a', label: 'A', win_probability: 0.6 },
            { option_id: 'opt-b', label: 'B', win_probability: 0.4 },
          ],
        },
      ],
      suggested_actions: [],
      insights: [],
      stage_indicator: 'decide',
    }
    const r = await parseV5Response(jsonResponse(200, body))
    expect(r.kind).toBe('response')
  })

  it('accepts a flip_analysis block', async () => {
    const body = {
      response_version: 2,
      assistant_text: 'Here are the flip scenarios.',
      blocks: [
        {
          type: 'flip_analysis',
          narrative: 'Three factors can flip A → B.',
          flip_scenarios: [
            {
              factor_id: 'f1',
              current_value: 0.5,
              flip_threshold: 0.7,
              from_option_id: 'opt-a',
              to_option_id: 'opt-b',
              fragile: false,
            },
          ],
        },
      ],
      suggested_actions: [],
      insights: [],
      stage_indicator: 'review',
    }
    const r = await parseV5Response(jsonResponse(200, body))
    expect(r.kind).toBe('response')
  })
})

describe('parseV5Response fixtures — BoundaryError variants', () => {
  it('parses a 422 BoundaryError with retryable=false', async () => {
    const body = {
      error: 'INGRESS_CONTRACT_VIOLATION',
      boundary: 'B1',
      direction: 'ingress',
      validator: 'OrchestratorTurnPayload',
      details: { issues: [{ path: 'turn_id', message: 'required' }] },
      request_id: 'req_abc',
      retryable: false,
    }
    const r = await parseV5Response(jsonResponse(422, body))
    expect(r.kind).toBe('boundary_error')
    if (r.kind === 'boundary_error') {
      expect(r.error.error).toBe('INGRESS_CONTRACT_VIOLATION')
      expect(r.error.retryable).toBe(false)
    }
  })

  it('parses a 504 BoundaryError with retryable=true', async () => {
    const body = {
      error: 'UPSTREAM_TIMEOUT',
      boundary: 'B4',
      direction: 'egress',
      validator: 'plot_run_v2',
      details: { timeout_ms: 120000 },
      request_id: 'req_def',
      retryable: true,
    }
    const r = await parseV5Response(jsonResponse(504, body))
    expect(r.kind).toBe('boundary_error')
    if (r.kind === 'boundary_error') {
      expect(r.error.retryable).toBe(true)
    }
  })
})

describe('parseV5Response fixtures — parse_error paths', () => {
  it('non-JSON body → parse_error', async () => {
    const r = await parseV5Response(rawResponse(200, 'not-json'))
    expect(r.kind).toBe('parse_error')
    if (r.kind === 'parse_error') {
      expect(r.reason).toContain('non-json')
    }
  })

  it('2xx body missing response_version → parse_error', async () => {
    const body = { assistant_text: 'hi', blocks: [] }
    const r = await parseV5Response(jsonResponse(200, body))
    expect(r.kind).toBe('parse_error')
    if (r.kind === 'parse_error') {
      expect(r.reason).toContain('OlumiResponse')
    }
  })

  it('non-2xx body that is NOT a BoundaryError → parse_error', async () => {
    const body = { something: 'unexpected' }
    const r = await parseV5Response(jsonResponse(500, body))
    expect(r.kind).toBe('parse_error')
    if (r.kind === 'parse_error') {
      expect(r.http_status).toBe(500)
    }
  })

  it('v0.6.0-shape response (unknown block type) → parse_error (defensive)', async () => {
    // v0.6.0 didn't have this block type, but adding a guard against a
    // hypothetical older CEE emitting a shape the strict schema rejects.
    const body = {
      response_version: 2,
      assistant_text: 'hi',
      blocks: [{ type: 'unknown_new_block' }],
      suggested_actions: [],
      insights: [],
      stage_indicator: 'frame',
    }
    const r = await parseV5Response(jsonResponse(200, body))
    expect(r.kind).toBe('parse_error')
  })
})

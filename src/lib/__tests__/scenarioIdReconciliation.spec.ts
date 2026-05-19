/**
 * Tests for scenarioIdReconciliation — the resolver that replaces the
 * hardcoded `session.scenario_id = null` in exportBundle.ts.
 *
 * Covers the brief's required cases:
 *   - store wins when present
 *   - fact fallback when store null
 *   - payload fallback when store + fact null
 *   - URL fallback when store + fact + payload null
 *   - full_graph fallback when all live sources null
 *   - conflict recorded when sources disagree (selected source still respected)
 *   - selected_scenario_id null only when every source is null
 *
 * Plus extractor helpers (payload trace, URL, full_graph).
 */

import { describe, expect, it } from 'vitest'

import {
  extractScenarioIdFromFullGraph,
  extractScenarioIdFromLatestV5Payload,
  extractScenarioIdFromUrl,
  reconcileScenarioId,
} from '../scenarioIdReconciliation'

describe('reconcileScenarioId — preference order', () => {
  it('store wins when all sources present', () => {
    const out = reconcileScenarioId({
      storeScenarioId: 'sid-store',
      v5FactScenarioId: 'sid-fact',
      payloadScenarioId: 'sid-payload',
      urlScenarioId: 'sid-url',
      fullGraphScenarioId: 'sid-graph',
    })
    expect(out.selected_scenario_id).toBe('sid-store')
    expect(out.selected_source).toBe('store')
  })

  it('v5_fact wins when store is null', () => {
    const out = reconcileScenarioId({
      storeScenarioId: null,
      v5FactScenarioId: 'sid-fact',
      payloadScenarioId: 'sid-payload',
      urlScenarioId: 'sid-url',
      fullGraphScenarioId: 'sid-graph',
    })
    expect(out.selected_scenario_id).toBe('sid-fact')
    expect(out.selected_source).toBe('v5_fact')
  })

  it('payload wins when store + fact null', () => {
    const out = reconcileScenarioId({
      storeScenarioId: null,
      v5FactScenarioId: null,
      payloadScenarioId: 'sid-payload',
      urlScenarioId: 'sid-url',
      fullGraphScenarioId: 'sid-graph',
    })
    expect(out.selected_scenario_id).toBe('sid-payload')
    expect(out.selected_source).toBe('payload')
  })

  it('url wins when store + fact + payload null', () => {
    const out = reconcileScenarioId({
      storeScenarioId: null,
      v5FactScenarioId: null,
      payloadScenarioId: null,
      urlScenarioId: 'sid-url',
      fullGraphScenarioId: 'sid-graph',
    })
    expect(out.selected_scenario_id).toBe('sid-url')
    expect(out.selected_source).toBe('url')
  })

  it('full_graph is the last non-null fallback', () => {
    const out = reconcileScenarioId({
      storeScenarioId: null,
      v5FactScenarioId: null,
      payloadScenarioId: null,
      urlScenarioId: null,
      fullGraphScenarioId: 'sid-graph',
    })
    expect(out.selected_scenario_id).toBe('sid-graph')
    expect(out.selected_source).toBe('full_graph')
  })

  it('selected_scenario_id is null and source is "none" only when every candidate is null', () => {
    const out = reconcileScenarioId({
      storeScenarioId: null,
      v5FactScenarioId: null,
      payloadScenarioId: null,
      urlScenarioId: null,
      fullGraphScenarioId: null,
    })
    expect(out.selected_scenario_id).toBeNull()
    expect(out.selected_source).toBe('none')
    expect(out.conflicts).toEqual([])
  })
})

describe('reconcileScenarioId — candidates and conflicts', () => {
  it('always emits the full candidates map', () => {
    const out = reconcileScenarioId({
      storeScenarioId: 'A',
      v5FactScenarioId: null,
      payloadScenarioId: 'B',
      urlScenarioId: null,
      fullGraphScenarioId: 'C',
    })
    expect(out.candidates).toEqual({
      store: 'A',
      v5_fact: null,
      payload: 'B',
      url: null,
      full_graph: 'C',
    })
  })

  it('records a conflict when two non-null candidates disagree', () => {
    const out = reconcileScenarioId({
      storeScenarioId: 'sid-A',
      v5FactScenarioId: 'sid-B',
      payloadScenarioId: null,
      urlScenarioId: null,
      fullGraphScenarioId: null,
    })
    expect(out.selected_scenario_id).toBe('sid-A')
    expect(out.selected_source).toBe('store')
    expect(out.conflicts).toContain('store=sid-A vs v5_fact=sid-B')
  })

  it('does not emit a conflict when two sources carry the same value', () => {
    const out = reconcileScenarioId({
      storeScenarioId: 'sid-X',
      v5FactScenarioId: 'sid-X',
      payloadScenarioId: 'sid-X',
      urlScenarioId: null,
      fullGraphScenarioId: null,
    })
    expect(out.conflicts).toEqual([])
  })

  it('records multiple pairwise conflicts when three sources disagree', () => {
    const out = reconcileScenarioId({
      storeScenarioId: 'A',
      v5FactScenarioId: 'B',
      payloadScenarioId: 'C',
      urlScenarioId: null,
      fullGraphScenarioId: null,
    })
    expect(out.conflicts).toEqual([
      'store=A vs v5_fact=B',
      'store=A vs payload=C',
      'v5_fact=B vs payload=C',
    ])
  })
})

describe('extractScenarioIdFromLatestV5Payload', () => {
  it('returns scenario_id from the first matching V5 payload', () => {
    const payloads = [
      {
        service: 'CEE',
        endpoint: '/bff/orchestrate/v2/turn',
        request: { body: { scenario_id: 'sid-latest', kind: 'analysis' } },
      },
      {
        service: 'CEE',
        endpoint: '/bff/orchestrate/v2/turn',
        request: { body: { scenario_id: 'sid-older' } },
      },
    ]
    expect(extractScenarioIdFromLatestV5Payload(payloads)).toBe('sid-latest')
  })

  it('skips non-CEE payloads', () => {
    const payloads = [
      {
        service: 'PLoT',
        endpoint: '/orchestrate/v2/turn',
        request: { body: { scenario_id: 'sid-plot' } },
      },
      {
        service: 'CEE',
        endpoint: '/bff/orchestrate/v2/turn',
        request: { body: { scenario_id: 'sid-cee' } },
      },
    ]
    expect(extractScenarioIdFromLatestV5Payload(payloads)).toBe('sid-cee')
  })

  it('skips CEE payloads that target a non-V5 endpoint', () => {
    const payloads = [
      {
        service: 'CEE',
        endpoint: '/bff/orchestrate/v1/turn',
        request: { body: { scenario_id: 'sid-v1' } },
      },
    ]
    expect(extractScenarioIdFromLatestV5Payload(payloads)).toBeNull()
  })

  it('returns null when no V5 payload has a scenario_id', () => {
    expect(extractScenarioIdFromLatestV5Payload([])).toBeNull()
    expect(
      extractScenarioIdFromLatestV5Payload([
        {
          service: 'CEE',
          endpoint: '/bff/orchestrate/v2/turn',
          request: { body: { kind: 'analysis' } },
        },
      ]),
    ).toBeNull()
  })

  it('handles malformed bodies without throwing', () => {
    const payloads = [
      { service: 'CEE', endpoint: '/bff/orchestrate/v2/turn', request: { body: null } },
      { service: 'CEE', endpoint: '/bff/orchestrate/v2/turn', request: { body: 'string-body' } },
      { service: 'CEE', endpoint: '/bff/orchestrate/v2/turn', request: { body: [1, 2, 3] } },
    ]
    expect(extractScenarioIdFromLatestV5Payload(payloads)).toBeNull()
  })
})

describe('extractScenarioIdFromUrl', () => {
  it('reads ?scenarioId= query param', () => {
    expect(
      extractScenarioIdFromUrl('https://app.example.com/decision?scenarioId=abc-123'),
    ).toBe('abc-123')
  })

  it('reads ?scenario_id= query param (snake_case fallback)', () => {
    expect(
      extractScenarioIdFromUrl('https://app.example.com/decision?scenario_id=abc-123'),
    ).toBe('abc-123')
  })

  it('reads /scenarios/<id> path segment', () => {
    expect(
      extractScenarioIdFromUrl('https://app.example.com/scenarios/sid-path/results'),
    ).toBe('sid-path')
  })

  it('returns null for unrelated URLs', () => {
    expect(extractScenarioIdFromUrl('https://app.example.com/dashboard')).toBeNull()
  })

  it('returns null on parse failure', () => {
    expect(extractScenarioIdFromUrl(null)).toBeNull()
    expect(extractScenarioIdFromUrl('not a url')).toBeNull()
  })
})

describe('extractScenarioIdFromFullGraph', () => {
  it('reads scenarioId from _meta', () => {
    expect(
      extractScenarioIdFromFullGraph({ _meta: { scenarioId: 'sid-meta' } }),
    ).toBe('sid-meta')
  })

  it('reads scenario_id from _meta (snake_case)', () => {
    expect(
      extractScenarioIdFromFullGraph({ _meta: { scenario_id: 'sid-meta' } }),
    ).toBe('sid-meta')
  })

  it('falls back to top-level scenarioId', () => {
    expect(extractScenarioIdFromFullGraph({ scenarioId: 'sid-top' })).toBe('sid-top')
  })

  it('returns null when nothing matches', () => {
    expect(extractScenarioIdFromFullGraph(null)).toBeNull()
    expect(extractScenarioIdFromFullGraph({})).toBeNull()
    expect(extractScenarioIdFromFullGraph({ _meta: {} })).toBeNull()
    expect(extractScenarioIdFromFullGraph('string')).toBeNull()
    expect(extractScenarioIdFromFullGraph([1, 2, 3])).toBeNull()
  })
})

/**
 * Unit tests for `findLatestAnalysisProducingCeeTurn` (PR #152).
 *
 * Pure-utility selector. Covers:
 *   - Basic ranking (run_analysis wins over prompt_warm / graph_edit)
 *   - Scenario-id preference
 *   - Fallback semantics (no analysis-producing → undefined)
 *   - The four required hash cases from the brief:
 *       1. hash match wins over a newer non-matching candidate
 *       2. missing hash falls back cleanly to scenario_id + turnType + recency
 *       3. mismatched hash reported in diagnostics (not silently ignored)
 *       4. no candidate discarded solely because hash is absent
 *   - Defensive reads: turnType vs request.body.turn_type vs
 *     body.action_type vs body.chip.action_type
 *   - Where response_hash lives: root, meta, blocks[].analysis_result,
 *     headers (case-insensitive)
 *   - Case-insensitive service filter
 */

import { describe, it, expect } from 'vitest'
import {
  findLatestAnalysisProducingCeeTurn,
  readTurnOrActionType,
  readResponseHash,
  readScenarioId,
  type SelectorTracedPayload,
} from '../analysisProducingCeeTurn'

// Builders -------------------------------------------------------------

function ceeTurn(
  overrides: Partial<SelectorTracedPayload> = {},
): SelectorTracedPayload {
  return {
    id: overrides.id ?? 'tp-1',
    service: 'CEE',
    endpoint: '/v5/turn',
    status: 200,
    completed: true,
    turnType: 'run_analysis',
    request: { headers: {}, body: { scenario_id: 'scn-1' } },
    response: { headers: {}, body: {} },
    ...overrides,
  }
}

// Defensive-read helpers ----------------------------------------------

describe('readTurnOrActionType', () => {
  it('prefers p.turnType', () => {
    expect(
      readTurnOrActionType(ceeTurn({ turnType: 'explain' })),
    ).toBe('explain')
  })

  it('falls back to request.body.turnType', () => {
    expect(
      readTurnOrActionType({
        request: { body: { turnType: 'run_analysis' } },
      }),
    ).toBe('run_analysis')
  })

  it('falls back to request.body.turn_type (snake_case)', () => {
    expect(
      readTurnOrActionType({
        request: { body: { turn_type: 'what_would_flip' } },
      }),
    ).toBe('what_would_flip')
  })

  it('falls back to request.body.action_type', () => {
    expect(
      readTurnOrActionType({
        request: { body: { action_type: 'run_analysis' } },
      }),
    ).toBe('run_analysis')
  })

  it('falls back to request.body.chip.action_type', () => {
    expect(
      readTurnOrActionType({
        request: { body: { chip: { action_type: 'explain' } } },
      }),
    ).toBe('explain')
  })

  it('returns null when nothing is present', () => {
    expect(
      readTurnOrActionType({ request: { body: { other: 'x' } } }),
    ).toBeNull()
  })
})

describe('readResponseHash', () => {
  it('reads root response_hash', () => {
    expect(
      readResponseHash({
        response: { body: { response_hash: 'abc123' } },
      }),
    ).toBe('abc123')
  })

  it('reads meta.response_hash', () => {
    expect(
      readResponseHash({
        response: { body: { meta: { response_hash: 'meta-hash' } } },
      }),
    ).toBe('meta-hash')
  })

  it('reads blocks[].response_hash on analysis_result block', () => {
    expect(
      readResponseHash({
        response: {
          body: {
            blocks: [
              { type: 'commentary', response_hash: 'wrong' },
              { type: 'analysis_result', response_hash: 'right-hash' },
            ],
          },
        },
      }),
    ).toBe('right-hash')
  })

  it('reads x-olumi-response-hash header (lowercase)', () => {
    expect(
      readResponseHash({
        response: {
          headers: { 'x-olumi-response-hash': 'header-hash' },
          body: null,
        },
      }),
    ).toBe('header-hash')
  })

  it('reads X-Olumi-Response-Hash header (mixed case)', () => {
    expect(
      readResponseHash({
        response: {
          headers: { 'X-Olumi-Response-Hash': 'mixed-case-hash' },
          body: null,
        },
      }),
    ).toBe('mixed-case-hash')
  })

  it('returns null when no hash anywhere', () => {
    expect(
      readResponseHash({ response: { body: { foo: 'bar' }, headers: {} } }),
    ).toBeNull()
  })
})

describe('readScenarioId', () => {
  it('reads scenario_id from request body', () => {
    expect(
      readScenarioId({ request: { body: { scenario_id: 'scn-xyz' } } }),
    ).toBe('scn-xyz')
  })

  it('returns null when missing', () => {
    expect(readScenarioId({ request: { body: {} } })).toBeNull()
  })
})

// Main selector tests --------------------------------------------------

describe('findLatestAnalysisProducingCeeTurn — basic ranking', () => {
  it('picks the run_analysis turn over prompt_warm and graph_edit', () => {
    const payloads: SelectorTracedPayload[] = [
      // Most-recent-first ordering, per trace store convention.
      ceeTurn({ id: 'tp-graph', turnType: 'graph_edit' }),
      ceeTurn({ id: 'tp-run', turnType: 'run_analysis' }),
      ceeTurn({ id: 'tp-warm', turnType: 'prompt_warm' }),
    ]
    const result = findLatestAnalysisProducingCeeTurn(payloads, 'scn-1', null)
    expect(result.selected?.id).toBe('tp-run')
    expect(result.hash_mismatch_observed).toBe(false)
  })

  it('prefers candidate with matching scenario_id', () => {
    const payloads: SelectorTracedPayload[] = [
      ceeTurn({
        id: 'tp-other-scn',
        turnType: 'run_analysis',
        request: { body: { scenario_id: 'scn-other' } },
      }),
      ceeTurn({
        id: 'tp-current-scn',
        turnType: 'run_analysis',
        request: { body: { scenario_id: 'scn-current' } },
      }),
    ]
    const result = findLatestAnalysisProducingCeeTurn(
      payloads,
      'scn-current',
      null,
    )
    expect(result.selected?.id).toBe('tp-current-scn')
  })

  it('returns undefined when no candidate is analysis-producing (caller falls back)', () => {
    const payloads: SelectorTracedPayload[] = [
      ceeTurn({ id: 'tp-warm', turnType: 'prompt_warm' }),
      ceeTurn({ id: 'tp-graph', turnType: 'graph_edit' }),
    ]
    const result = findLatestAnalysisProducingCeeTurn(payloads, 'scn-1', null)
    expect(result.selected).toBeUndefined()
    expect(result.hash_mismatch_observed).toBe(false)
  })

  it('case-insensitive CEE service filter', () => {
    const payloads: SelectorTracedPayload[] = [
      ceeTurn({ id: 'tp-lower', service: 'cee', turnType: 'run_analysis' }),
      ceeTurn({
        id: 'tp-mixed',
        service: 'Cee',
        turnType: 'run_analysis',
        request: { body: { scenario_id: 'scn-other' } },
      }),
    ]
    const result = findLatestAnalysisProducingCeeTurn(payloads, 'scn-1', null)
    // The lowercase service should still surface as a candidate.
    expect(result.selected).toBeDefined()
    expect(result.selected?.id).toBe('tp-lower')
  })

  it('excludes non-CEE traces (e.g. PLoT)', () => {
    const payloads: SelectorTracedPayload[] = [
      ceeTurn({ id: 'tp-plot', service: 'PLoT', turnType: 'run_analysis' }),
    ]
    const result = findLatestAnalysisProducingCeeTurn(payloads, 'scn-1', null)
    expect(result.selected).toBeUndefined()
  })
})

// The four required hash cases ----------------------------------------

describe('findLatestAnalysisProducingCeeTurn — hash semantics (brief)', () => {
  // Case 1: hash match wins over a newer non-matching candidate.
  it('case 1: hash match beats a newer turn with a non-matching hash', () => {
    const payloads: SelectorTracedPayload[] = [
      // Newer (lower index) candidate — analysis-producing, scenario
      // match, 2xx, but hash disagrees.
      ceeTurn({
        id: 'tp-newer-wrong-hash',
        turnType: 'run_analysis',
        response: { body: { response_hash: 'wrong-hash' } },
      }),
      // Older candidate — same scenario but hash MATCHES results.hash.
      ceeTurn({
        id: 'tp-older-matching-hash',
        turnType: 'run_analysis',
        response: { body: { response_hash: 'results-hash' } },
      }),
    ]
    const result = findLatestAnalysisProducingCeeTurn(
      payloads,
      'scn-1',
      'results-hash',
    )
    expect(result.selected?.id).toBe('tp-older-matching-hash')
    expect(result.hash_mismatch_observed).toBe(false)
  })

  // Case 2: missing hash falls back cleanly to scenario + turnType + recency.
  it('case 2: missing hash on both sides falls back to scenario + turnType + recency', () => {
    const payloads: SelectorTracedPayload[] = [
      ceeTurn({
        id: 'tp-newer',
        turnType: 'run_analysis',
        response: { body: {} },
      }),
      ceeTurn({
        id: 'tp-older',
        turnType: 'run_analysis',
        response: { body: {} },
      }),
    ]
    // Both candidates analysis-producing + same scenario + no hash.
    // Recency (newer first) decides — selector returns tp-newer.
    const result = findLatestAnalysisProducingCeeTurn(payloads, 'scn-1', null)
    expect(result.selected?.id).toBe('tp-newer')
    expect(result.hash_mismatch_observed).toBe(false)
  })

  // Case 3: mismatched hash IS reported (not silently ignored).
  it('case 3: mismatched hash sets hash_mismatch_observed=true', () => {
    const payloads: SelectorTracedPayload[] = [
      ceeTurn({
        id: 'tp-mismatch',
        turnType: 'run_analysis',
        response: { body: { response_hash: 'different-hash' } },
      }),
    ]
    const result = findLatestAnalysisProducingCeeTurn(
      payloads,
      'scn-1',
      'results-hash',
    )
    // Selector still picks the only available analysis-producing turn.
    expect(result.selected?.id).toBe('tp-mismatch')
    // … but flags the mismatch so the bundle can fire the coherence issue.
    expect(result.hash_mismatch_observed).toBe(true)
  })

  // Case 4: missing hash on a single candidate does NOT discard it.
  it('case 4: candidate with no hash is NOT discarded when otherwise eligible', () => {
    const payloads: SelectorTracedPayload[] = [
      ceeTurn({
        id: 'tp-no-hash',
        turnType: 'run_analysis',
        // No response_hash anywhere.
        response: { body: { blocks: [] } },
      }),
    ]
    const result = findLatestAnalysisProducingCeeTurn(
      payloads,
      'scn-1',
      'results-hash',
    )
    // The candidate survives because hash matching is soft.
    expect(result.selected?.id).toBe('tp-no-hash')
    // Missing-hash → not a mismatch (no evidence to compare).
    expect(result.hash_mismatch_observed).toBe(false)
  })

  it('mismatch ONLY fires when BOTH hashes are present and disagree', () => {
    // Results hash present, capture hash missing → not a mismatch.
    const payloads: SelectorTracedPayload[] = [
      ceeTurn({
        id: 'tp-only-results-hash',
        turnType: 'run_analysis',
        response: { body: {} },
      }),
    ]
    const result = findLatestAnalysisProducingCeeTurn(
      payloads,
      'scn-1',
      'results-hash-only',
    )
    expect(result.hash_mismatch_observed).toBe(false)
  })
})

describe('findLatestAnalysisProducingCeeTurn — completion filter', () => {
  it('prefers completed-2xx candidates via score (failed CEE call still surfaces if it is the only analysis-producing entry)', () => {
    const payloads: SelectorTracedPayload[] = [
      // Failed but newest.
      ceeTurn({
        id: 'tp-fail',
        turnType: 'run_analysis',
        status: 502,
        completed: true,
      }),
      // Success older.
      ceeTurn({
        id: 'tp-ok',
        turnType: 'run_analysis',
        status: 200,
        completed: true,
      }),
    ]
    const result = findLatestAnalysisProducingCeeTurn(payloads, 'scn-1', null)
    // 2xx (+10) outweighs the newer-but-failed candidate's recency edge.
    expect(result.selected?.id).toBe('tp-ok')
  })
})

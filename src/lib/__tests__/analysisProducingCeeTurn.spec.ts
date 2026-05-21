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
  isCeeService,
  isV5TurnEndpoint,
  V5_TURN_ENDPOINT_PATTERN,
  type SelectorTracedPayload,
} from '../analysisProducingCeeTurn'
import {
  matchServiceCaseInsensitive,
  extractPathname,
  isPlotService,
  isV1PlotEngineEndpoint,
  isV1PlotStreamEndpoint,
  isV1PlotEndpoint,
  isV2PlotEndpoint,
} from '../v5TraceMatching'

// Builders -------------------------------------------------------------

function ceeTurn(
  overrides: Partial<SelectorTracedPayload> = {},
): SelectorTracedPayload {
  return {
    id: overrides.id ?? 'tp-1',
    service: 'CEE',
    // Round-2 review (P1): endpoint must match V5_TURN_ENDPOINT_PATTERN
    // (`/orchestrate/v2/turn`) for the candidate to be eligible. Most
    // tests want a valid V5 endpoint by default; legacy/non-turn
    // endpoint tests override this explicitly.
    endpoint: '/bff/orchestrate/v2/turn',
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

  it('round-3 P1: falls back to request.body._turn_type (pre-strip discriminator)', () => {
    // `OrchestratorTurnRequest._turn_type` is the request-builder
    // internal discriminator — stripped before network send but
    // present when the trace recorder captures pre-strip. Pre-fix
    // the selector silently missed such entries.
    expect(
      readTurnOrActionType({
        request: { body: { _turn_type: 'run_analysis' } },
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

// =====================================================================
// Round-2 review additions
// =====================================================================

describe('readResponseHashWithSource — canonical CEE shapes (round-2 P0)', () => {
  it('reads body.lineage.response_hash (highest priority)', () => {
    expect(
      readResponseHash({
        response: {
          body: {
            lineage: { response_hash: 'lineage-resp-hash' },
            // Stale root hash MUST NOT outrank lineage.
            response_hash: 'stale-root',
            meta: { response_hash: 'stale-meta' },
          },
        },
      }),
    ).toBe('lineage-resp-hash')
  })

  it('round-3 P0: context_hash is NOT a response hash — returns null', () => {
    // The canonical CEE fixture carries `lineage.context_hash`. Pre-
    // round-3 the selector returned it as a response hash and
    // compared it against `results.hash`, producing spurious
    // matches/mismatches. context_hash is the input-context
    // fingerprint and operates on different inputs than the response
    // hash. Round-3 P0: skip it entirely; hash evidence is null when
    // no real response_hash is present.
    expect(
      readResponseHash({
        response: {
          body: { lineage: { context_hash: 'ctx-hash-fixture' } },
        },
      }),
    ).toBeNull()
  })

  it('round-3 P0: lineage.response_hash STILL wins when both lineage hashes are present', () => {
    expect(
      readResponseHash({
        response: {
          body: {
            lineage: {
              response_hash: 'rh',
              context_hash: 'ch',
            },
          },
        },
      }),
    ).toBe('rh')
  })

  it('reads body.analysis_state.meta.response_hash on V5 turns', () => {
    expect(
      readResponseHash({
        response: {
          body: {
            analysis_state: { meta: { response_hash: 'as-meta-hash' } },
          },
        },
      }),
    ).toBe('as-meta-hash')
  })

  it('priority (round-3): lineage.response_hash > analysis_state.meta > meta > root > blocks > header (context_hash NOT read)', () => {
    // lineage.response_hash WINS over everything below.
    expect(
      readResponseHash({
        response: {
          headers: { 'x-olumi-response-hash': 'hdr' },
          body: {
            lineage: {
              response_hash: 'L1',
              context_hash: 'L2-context-not-used',
            },
            analysis_state: { meta: { response_hash: 'AS' } },
            meta: { response_hash: 'M' },
            response_hash: 'R',
            blocks: [
              { type: 'analysis_result', response_hash: 'B' },
            ],
          },
        },
      }),
    ).toBe('L1')
  })
})

describe('findLatestAnalysisProducingCeeTurn — round-2 P0 + round-3 P0: hash match against canonical CEE shape', () => {
  // Canonical envelope shape inspired by
  // `src/canvas/conversation/__tests__/fixtures/cee-orchestrator-response.json`.
  // Round-3 P0: real comparison MUST be against `lineage.response_hash`
  // (the response identity). `lineage.context_hash` is the input
  // fingerprint and is NOT comparable to `results.hash`.
  function canonicalCeeBody(responseHash: string, contextHash?: string): unknown {
    return {
      turn_id: '946e4876-0007-4a85-9370-c84621107b29',
      assistant_text: null,
      blocks: [],
      lineage: {
        response_hash: responseHash,
        ...(contextHash !== undefined ? { context_hash: contextHash } : {}),
        dsk_version_hash: null,
      },
      stage_indicator: { stage: 'ideate' },
    }
  }

  it('hash MATCH against canonical CEE lineage.response_hash drives selection (P0)', () => {
    const payloads: SelectorTracedPayload[] = [
      // Newer non-matching candidate.
      ceeTurn({
        id: 'tp-newer',
        response: {
          body: { lineage: { response_hash: 'different-hash' } },
        },
      }),
      // Older but MATCHES the canonical lineage response_hash.
      ceeTurn({
        id: 'tp-canonical-match',
        response: { body: canonicalCeeBody('canonical-hash') },
      }),
    ]
    const result = findLatestAnalysisProducingCeeTurn(
      payloads,
      'scn-1',
      'canonical-hash',
    )
    expect(result.selected?.id).toBe('tp-canonical-match')
    expect(result.hash_mismatch_observed).toBe(false)
    expect(result.selected_response_hash).toBe('canonical-hash')
    expect(result.selected_response_hash_source).toBe(
      'body_lineage_response_hash',
    )
    expect(result.selection_diagnostics.selected_reason).toBe('hash_matched')
    expect(result.selection_diagnostics.hash_match_status).toBe('matched')
  })

  it('hash MISMATCH against canonical CEE lineage.response_hash is reported with detail (P0)', () => {
    const payloads: SelectorTracedPayload[] = [
      ceeTurn({
        id: 'tp-canonical-mismatch',
        response: { body: canonicalCeeBody('observed-hash') },
      }),
    ]
    const result = findLatestAnalysisProducingCeeTurn(
      payloads,
      'scn-1',
      'expected-hash',
    )
    expect(result.selected?.id).toBe('tp-canonical-mismatch')
    expect(result.hash_mismatch_observed).toBe(true)
    expect(result.selected_response_hash).toBe('observed-hash')
    expect(result.selected_response_hash_source).toBe(
      'body_lineage_response_hash',
    )
    expect(result.selected_trace_id).toBe('tp-canonical-mismatch')
    expect(result.selection_diagnostics.hash_match_status).toBe('mismatched')
  })

  // ROUND-3 P0 — the critical regression: context_hash != response_hash.
  it('round-3 P0: only lineage.response_hash drives matching — context_hash that differs MUST NOT match', () => {
    // Fixture: response_hash agrees with results.hash but context_hash
    // disagrees. Pre-fix the selector compared `context_hash` against
    // `results.hash` (false negative) AND/OR returned `context_hash`
    // as the hash (false positive). Round-3 P0: only `response_hash`
    // drives matching.
    const payloads: SelectorTracedPayload[] = [
      ceeTurn({
        id: 'tp-matching-response-mismatch-context',
        response: {
          body: canonicalCeeBody(
            'response-matches-results',
            'context-differs-completely',
          ),
        },
      }),
    ]
    const result = findLatestAnalysisProducingCeeTurn(
      payloads,
      'scn-1',
      'response-matches-results',
    )
    expect(result.selected_response_hash).toBe('response-matches-results')
    expect(result.selected_response_hash_source).toBe(
      'body_lineage_response_hash',
    )
    // Critical: the context_hash difference DOES NOT show up as a
    // mismatch. The bundle correctly reports match because the
    // response_hash agrees.
    expect(result.hash_mismatch_observed).toBe(false)
    expect(result.selection_diagnostics.hash_match_status).toBe('matched')
  })

  it('round-3 P0: when ONLY context_hash is present, hash evidence is unavailable (NOT a spurious match/mismatch)', () => {
    // Pre-fix this scenario would return `context_hash` as the
    // response hash and compare it against `results.hash`, producing
    // either a false positive or false negative. Round-3 P0: no
    // response_hash → hash evidence absent → no match/mismatch claim.
    const payloads: SelectorTracedPayload[] = [
      ceeTurn({
        id: 'tp-only-context-hash',
        response: {
          body: { lineage: { context_hash: 'irrelevant-fingerprint' } },
        },
      }),
    ]
    const result = findLatestAnalysisProducingCeeTurn(
      payloads,
      'scn-1',
      'results-hash',
    )
    expect(result.selected?.id).toBe('tp-only-context-hash')
    expect(result.selected_response_hash).toBeNull()
    expect(result.selected_response_hash_source).toBeNull()
    expect(result.hash_mismatch_observed).toBe(false)
    expect(result.selection_diagnostics.hash_match_status).toBe(
      'only_results_hash_present',
    )
  })
})

describe('findLatestAnalysisProducingCeeTurn — round-2 P1: V5 endpoint scope', () => {
  it('NEGATIVE: a legacy /bff/cee/draft-graph trace cannot be selected', () => {
    const payloads: SelectorTracedPayload[] = [
      ceeTurn({
        id: 'tp-draft-graph',
        endpoint: '/bff/cee/draft-graph',
        // Note: legacy endpoint carries analysis-shaped action metadata.
        turnType: 'run_analysis',
        request: {
          body: {
            scenario_id: 'scn-1',
            chip: { action_type: 'run_analysis' },
          },
        },
      }),
    ]
    const result = findLatestAnalysisProducingCeeTurn(payloads, 'scn-1', null)
    expect(result.selected).toBeUndefined()
    expect(result.selection_diagnostics.cee_candidate_count).toBe(1)
    expect(result.selection_diagnostics.v5_endpoint_candidate_count).toBe(0)
    expect(result.selection_diagnostics.selected_reason).toBe(
      'no_v5_endpoint_candidate',
    )
  })

  it('NEGATIVE: a legacy /bff/cee/turn trace cannot outrank a V5 turn', () => {
    const payloads: SelectorTracedPayload[] = [
      // Newer legacy CEE turn — should NOT be selected even though it
      // is more recent and has the same scenario.
      ceeTurn({
        id: 'tp-legacy-newer',
        endpoint: '/bff/cee/turn',
        turnType: 'run_analysis',
      }),
      // Older V5 turn — SHOULD be selected because it's on the V5
      // endpoint.
      ceeTurn({
        id: 'tp-v5-older',
        endpoint: '/bff/orchestrate/v2/turn',
        turnType: 'run_analysis',
      }),
    ]
    const result = findLatestAnalysisProducingCeeTurn(payloads, 'scn-1', null)
    expect(result.selected?.id).toBe('tp-v5-older')
    expect(result.selection_diagnostics.cee_candidate_count).toBe(2)
    expect(result.selection_diagnostics.v5_endpoint_candidate_count).toBe(1)
  })

  it('NEGATIVE: a CEE entry with no endpoint at all is excluded from V5 candidates', () => {
    const payloads: SelectorTracedPayload[] = [
      ceeTurn({
        id: 'tp-no-endpoint',
        endpoint: undefined,
        turnType: 'run_analysis',
      }),
    ]
    const result = findLatestAnalysisProducingCeeTurn(payloads, 'scn-1', null)
    expect(result.selected).toBeUndefined()
    expect(result.selection_diagnostics.selected_reason).toBe(
      'no_v5_endpoint_candidate',
    )
  })

  it('NEGATIVE: matches direct V5 endpoint (no /bff prefix)', () => {
    // The V5 adapter can target either `/bff/orchestrate/v2/turn` or
    // `${VITE_ORCHESTRATOR_BASE}/orchestrate/v2/turn`. Both must be
    // accepted.
    const payloads: SelectorTracedPayload[] = [
      ceeTurn({
        id: 'tp-direct',
        endpoint: 'https://cee.test/orchestrate/v2/turn',
      }),
    ]
    const result = findLatestAnalysisProducingCeeTurn(payloads, 'scn-1', null)
    expect(result.selected?.id).toBe('tp-direct')
    expect(result.selection_diagnostics.v5_endpoint_candidate_count).toBe(1)
  })

  // =====================================================================
  // V5 proxy variant (PR #156 / PR #159 follow-up). Staging Netlify
  // dashboard inlines VITE_V5_ENDPOINT="https://cee-staging.onrender.com/proxy/v5/turn".
  // `callV5Turn` records traces with that endpoint string. The selector
  // must accept it as a V5 candidate alongside the canonical pathname.
  // =====================================================================

  it('PROXY: bare /proxy/v5/turn is a V5 candidate', () => {
    const payloads: SelectorTracedPayload[] = [
      ceeTurn({ id: 'tp-proxy', endpoint: '/proxy/v5/turn' }),
    ]
    const result = findLatestAnalysisProducingCeeTurn(payloads, 'scn-1', null)
    expect(result.selected?.id).toBe('tp-proxy')
    expect(result.selection_diagnostics.v5_endpoint_candidate_count).toBe(1)
  })

  it('PROXY: absolute staging URL https://cee-staging.onrender.com/proxy/v5/turn is a V5 candidate', () => {
    const payloads: SelectorTracedPayload[] = [
      ceeTurn({
        id: 'tp-proxy-abs',
        endpoint: 'https://cee-staging.onrender.com/proxy/v5/turn',
      }),
    ]
    const result = findLatestAnalysisProducingCeeTurn(payloads, 'scn-1', null)
    expect(result.selected?.id).toBe('tp-proxy-abs')
    expect(result.selection_diagnostics.v5_endpoint_candidate_count).toBe(1)
  })

  it('PROXY: look-alike /proxy/v5/turning is NOT a V5 candidate (path-boundary)', () => {
    const payloads: SelectorTracedPayload[] = [
      ceeTurn({ id: 'tp-turning', endpoint: '/proxy/v5/turning' }),
    ]
    const result = findLatestAnalysisProducingCeeTurn(payloads, 'scn-1', null)
    expect(result.selected).toBeUndefined()
    expect(result.selection_diagnostics.v5_endpoint_candidate_count).toBe(0)
    expect(result.selection_diagnostics.selected_reason).toBe(
      'no_v5_endpoint_candidate',
    )
  })

  it('PROXY: canonical and proxy traces coexist; recency picks most recent', () => {
    const payloads: SelectorTracedPayload[] = [
      // Most-recent-first order. The proxy entry is newer; per
      // round-5 strict-lex precedence (analysisProducing selectors
      // use the same recency-then-tier ranking), the most-recent
      // should win.
      ceeTurn({
        id: 'tp-proxy-newer',
        endpoint: '/proxy/v5/turn',
        turnType: 'run_analysis',
      }),
      ceeTurn({
        id: 'tp-canonical-older',
        endpoint: '/bff/orchestrate/v2/turn',
        turnType: 'run_analysis',
      }),
    ]
    const result = findLatestAnalysisProducingCeeTurn(payloads, 'scn-1', null)
    expect(result.selected?.id).toBe('tp-proxy-newer')
    expect(result.selection_diagnostics.v5_endpoint_candidate_count).toBe(2)
  })
})

describe('findLatestAnalysisProducingCeeTurn — round-2 IMP: selection diagnostics', () => {
  it('emits a complete selection_diagnostics block on the primary path', () => {
    const payloads: SelectorTracedPayload[] = [
      ceeTurn({ id: 'tp-1', turnType: 'run_analysis' }),
      ceeTurn({ id: 'tp-2', turnType: 'prompt_warm' }),
    ]
    const result = findLatestAnalysisProducingCeeTurn(payloads, 'scn-1', null)
    expect(result.selection_diagnostics).toEqual({
      cee_candidate_count: 2,
      v5_endpoint_candidate_count: 2,
      analysis_producing_candidate_count: 1,
      selected_via_primary_path: true,
      selected_reason: 'scenario_matched_recency',
      hash_match_status: 'both_absent',
    })
  })

  it('records "both_absent" when neither hash is provided', () => {
    const result = findLatestAnalysisProducingCeeTurn(
      [ceeTurn({ turnType: 'run_analysis' })],
      'scn-1',
      null,
    )
    expect(result.selection_diagnostics.hash_match_status).toBe('both_absent')
  })

  it('records "only_results_hash_present" when capture hash is missing', () => {
    const result = findLatestAnalysisProducingCeeTurn(
      [ceeTurn({ turnType: 'run_analysis' })],
      'scn-1',
      'results-only-hash',
    )
    expect(result.selection_diagnostics.hash_match_status).toBe(
      'only_results_hash_present',
    )
  })

  it('records "only_capture_hash_present" when results hash is missing', () => {
    const result = findLatestAnalysisProducingCeeTurn(
      [
        ceeTurn({
          turnType: 'run_analysis',
          response: { body: { response_hash: 'capture-only-hash' } },
        }),
      ],
      'scn-1',
      null,
    )
    expect(result.selection_diagnostics.hash_match_status).toBe(
      'only_capture_hash_present',
    )
  })

  it('records selected_via_primary_path=false when no CEE candidate', () => {
    const result = findLatestAnalysisProducingCeeTurn([], 'scn-1', null)
    expect(result.selection_diagnostics.selected_via_primary_path).toBe(false)
    expect(result.selection_diagnostics.selected_reason).toBe(
      'no_cee_candidate',
    )
  })

  it('records fallback reason when no analysis-producing turn exists', () => {
    const result = findLatestAnalysisProducingCeeTurn(
      [ceeTurn({ turnType: 'prompt_warm' })],
      'scn-1',
      null,
    )
    expect(result.selection_diagnostics.selected_reason).toBe(
      'no_analysis_producing_candidate',
    )
    // The endpoint-filter pass still found a V5 candidate, just not
    // analysis-producing — surfaces in the counts.
    expect(result.selection_diagnostics.v5_endpoint_candidate_count).toBe(1)
    expect(
      result.selection_diagnostics.analysis_producing_candidate_count,
    ).toBe(0)
  })
})

// =====================================================================
// Round-3 review additions — shared helpers
// =====================================================================

describe('round-3 P1: shared V5 CEE helpers (isCeeService, isV5TurnEndpoint)', () => {
  it('exports the V5 turn endpoint pattern as a constant', () => {
    expect(V5_TURN_ENDPOINT_PATTERN).toBe('/orchestrate/v2/turn')
  })

  describe('isCeeService — case-insensitive', () => {
    it.each([
      { service: 'CEE', expected: true },
      { service: 'cee', expected: true },
      { service: 'Cee', expected: true },
      { service: 'CeE', expected: true },
      { service: 'PLoT', expected: false },
      { service: 'ISL', expected: false },
      { service: '', expected: false },
      { service: undefined, expected: false },
    ])(
      'isCeeService({ service: $service }) → $expected',
      ({ service, expected }) => {
        expect(isCeeService({ service })).toBe(expected)
      },
    )
  })

  describe('isV5TurnEndpoint', () => {
    it('matches `/bff/orchestrate/v2/turn` (proxy)', () => {
      expect(
        isV5TurnEndpoint({
          service: 'CEE',
          endpoint: '/bff/orchestrate/v2/turn',
        }),
      ).toBe(true)
    })

    it('matches direct `https://*/orchestrate/v2/turn`', () => {
      expect(
        isV5TurnEndpoint({
          service: 'CEE',
          endpoint: 'https://cee.staging.test/orchestrate/v2/turn',
        }),
      ).toBe(true)
    })

    it('matches with case-insensitive service ("cee", "Cee")', () => {
      expect(
        isV5TurnEndpoint({
          service: 'cee',
          endpoint: '/bff/orchestrate/v2/turn',
        }),
      ).toBe(true)
      expect(
        isV5TurnEndpoint({
          service: 'Cee',
          endpoint: '/bff/orchestrate/v2/turn',
        }),
      ).toBe(true)
    })

    it('REJECTS legacy CEE endpoints', () => {
      for (const ep of [
        '/bff/cee/turn',
        '/bff/cee/draft-graph',
        '/bff/cee/prompt-warm',
        '/v5/turn', // wrong path
        '/orchestrate/v1/turn', // wrong version
      ]) {
        expect(
          isV5TurnEndpoint({ service: 'CEE', endpoint: ep }),
        ).toBe(false)
      }
    })

    it('REJECTS non-CEE services even on the V5 path', () => {
      // Defensive — a service-misclassified entry on the V5 endpoint
      // must NOT be promoted.
      expect(
        isV5TurnEndpoint({
          service: 'PLoT',
          endpoint: '/bff/orchestrate/v2/turn',
        }),
      ).toBe(false)
    })

    it('REJECTS missing / undefined endpoint', () => {
      expect(isV5TurnEndpoint({ service: 'CEE' })).toBe(false)
      expect(
        isV5TurnEndpoint({ service: 'CEE', endpoint: '' }),
      ).toBe(false)
    })

  })

  describe('matchServiceCaseInsensitive (round-4 P1)', () => {
    // Powers `findBestPayload`'s fallback CEE matching so case
    // sensitivity matches the analysis-producing selector.
    it.each([
      { p: { service: 'CEE' }, service: 'CEE', expected: true },
      { p: { service: 'cee' }, service: 'CEE', expected: true },
      { p: { service: 'CEE' }, service: 'cee', expected: true },
      { p: { service: 'Cee' }, service: 'CEE', expected: true },
      { p: { service: 'PLoT' }, service: 'CEE', expected: false },
      { p: { service: 'plot' }, service: 'PLoT', expected: true },
      { p: { service: 'PLoT' }, service: 'PLOT', expected: true },
      { p: { service: undefined }, service: 'CEE', expected: false },
      { p: {}, service: 'CEE', expected: false },
    ])(
      'matchServiceCaseInsensitive($p, $service) → $expected',
      ({ p, service, expected }) => {
        expect(matchServiceCaseInsensitive(p, service)).toBe(expected)
      },
    )
  })

  describe('isV5TurnEndpoint — round-4 P1 path-boundary', () => {

    // ROUND-4 P1 — path-boundary regression tests.
    it.each([
      // Look-alike paths that should NOT match (round-4 P1):
      { ep: '/orchestrate/v2/turning', expected: false }, // word-boundary
      { ep: '/orchestrate/v2/turn-suffix', expected: false }, // hyphen-suffix
      { ep: '/orchestrate/v2/turn_extra', expected: false }, // underscore-suffix
      // Canonical V5 paths that should match:
      { ep: '/orchestrate/v2/turn', expected: true },
      { ep: '/bff/orchestrate/v2/turn', expected: true },
      { ep: 'https://cee.test/orchestrate/v2/turn', expected: true },
      { ep: '/orchestrate/v2/turn?nonce=abc', expected: true },
      { ep: '/orchestrate/v2/turn#fragment', expected: true },
      { ep: '/orchestrate/v2/turn/legacy-sub-path', expected: true },
    ])(
      'round-4 P1: path-boundary — endpoint $ep → $expected',
      ({ ep, expected }) => {
        expect(
          isV5TurnEndpoint({ service: 'CEE', endpoint: ep }),
        ).toBe(expected)
      },
    )

    // ROUND-5 P1 — pathname-only matching. Pre-fix the regex ran
    // against the WHOLE endpoint string, so query/fragment content
    // containing `/orchestrate/v2/turn` produced false matches.
    it.each([
      // Query-string false positives (round-5 P1):
      {
        ep: '/legacy/foo?next=/orchestrate/v2/turn',
        expected: false,
      },
      {
        ep: 'https://cee.test/legacy?next=/orchestrate/v2/turn',
        expected: false,
      },
      {
        ep: '/some/other/path?redirect=%2Forchestrate%2Fv2%2Fturn',
        expected: false,
      },
      // Fragment false positives (round-5 P1):
      {
        ep: '/legacy#/orchestrate/v2/turn',
        expected: false,
      },
      // Path that genuinely IS V5, with query containing V5 path
      // (still a true match — the real pathname is V5):
      {
        ep: '/orchestrate/v2/turn?next=/orchestrate/v2/turn',
        expected: true,
      },
    ])(
      'round-5 P1: pathname-only matching — endpoint $ep → $expected',
      ({ ep, expected }) => {
        expect(
          isV5TurnEndpoint({ service: 'CEE', endpoint: ep }),
        ).toBe(expected)
      },
    )
  })
})

// =====================================================================
// Round-6 review additions — extractPathname (malformed URL handling)
// =====================================================================

describe('extractPathname — round-6 review (malformed URLs / protocol-relative)', () => {
  it.each([
    // Absolute URLs:
    {
      input: 'https://cee.test/orchestrate/v2/turn',
      expected: '/orchestrate/v2/turn',
    },
    {
      input: 'https://cee.test/orchestrate/v2/turn?nonce=abc',
      expected: '/orchestrate/v2/turn',
    },
    {
      input: 'https://cee.test:8443/path?q=1',
      expected: '/path',
    },
    // Protocol-relative URL (rare but in the wild):
    {
      input: '//cee.test/orchestrate/v2/turn',
      expected: '/orchestrate/v2/turn',
    },
    // Path-only with query and fragment:
    { input: '/path?q=1', expected: '/path' },
    { input: '/path#frag', expected: '/path' },
    { input: '/path?q=1#frag', expected: '/path' },
    // Plain paths:
    { input: '/path', expected: '/path' },
    { input: '/', expected: '/' },
    // Empty:
    { input: '', expected: null },
    // Malformed absolute URLs — should NOT throw; return null:
    { input: 'https://', expected: null },
    {
      input: 'http://[malformed-host',
      expected: null,
    },
    // String that contains `://` but doesn't start with http/s — NOT
    // parsed as absolute; kept as-is (the leading slash check fails).
    {
      input: 'not-a-url://orchestrate/v2/turn',
      expected: 'not-a-url://orchestrate/v2/turn',
    },
  ])(
    'extractPathname($input) → $expected',
    ({ input, expected }) => {
      expect(extractPathname(input)).toBe(expected)
    },
  )

  it('malformed absolute URL does NOT throw — returns null instead', () => {
    expect(() => extractPathname('http://[broken')).not.toThrow()
    expect(extractPathname('http://[broken')).toBeNull()
  })
})

// =====================================================================
// PR #156 round-2 — PLoT V1/V2 path-boundary matchers
// =====================================================================

describe('PR #156 round-2: PLoT endpoint matchers (path-boundary)', () => {
  it('isPlotService case-insensitive', () => {
    expect(isPlotService({ service: 'PLoT' })).toBe(true)
    expect(isPlotService({ service: 'plot' })).toBe(true)
    expect(isPlotService({ service: 'PLOT' })).toBe(true)
    expect(isPlotService({ service: 'CEE' })).toBe(false)
    expect(isPlotService({})).toBe(false)
  })

  describe('isV1PlotEngineEndpoint — false-positive rejection', () => {
    it.each([
      // Canonical V1 sync paths — ACCEPT
      { ep: '/bff/engine/v1/run', expected: true },
      { ep: '/v1/run', expected: true },
      { ep: 'https://engine.test/v1/run', expected: true },
      { ep: '/v1/run?nonce=abc', expected: true },
      { ep: '/v1/run#frag', expected: true },
      { ep: '/v1/run/sub', expected: true },
      // Round-2 reviewer IMP #3 — REJECT word-boundary false positives
      { ep: '/v1/running', expected: false },
      { ep: '/v1/run-old', expected: false },
      { ep: '/v1/run_legacy', expected: false },
      // Query-string false positives (round-5 pathname-only rule)
      { ep: '/legacy?next=/v1/run', expected: false },
      { ep: 'https://other.test/foo?redirect=/v1/run', expected: false },
      // Fragment false positives
      { ep: '/legacy#/v1/run', expected: false },
      // Non-PLoT services on V1 path
      { ep: '/v1/run', service: 'CEE', expected: false },
      // Missing endpoint
      { ep: '', expected: false },
    ])(
      'endpoint=$ep service=${service ?? PLoT} → $expected',
      ({ ep, expected, service }) => {
        expect(
          isV1PlotEngineEndpoint({ service: service ?? 'PLoT', endpoint: ep }),
        ).toBe(expected)
      },
    )
  })

  describe('isV1PlotStreamEndpoint', () => {
    it.each([
      { ep: '/bff/engine/v1/stream', expected: true },
      { ep: '/v1/stream', expected: true },
      { ep: '/v1/stream?id=1', expected: true },
      // Reject look-alikes
      { ep: '/v1/streaming', expected: false },
      { ep: '/v1/stream-debug', expected: false },
      { ep: '/legacy?next=/v1/stream', expected: false },
    ])('endpoint=$ep → $expected', ({ ep, expected }) => {
      expect(
        isV1PlotStreamEndpoint({ service: 'PLoT', endpoint: ep }),
      ).toBe(expected)
    })
  })

  describe('isV1PlotEndpoint convenience', () => {
    it('matches either sync OR stream V1', () => {
      expect(isV1PlotEndpoint({ service: 'PLoT', endpoint: '/v1/run' })).toBe(true)
      expect(isV1PlotEndpoint({ service: 'PLoT', endpoint: '/v1/stream' })).toBe(true)
      expect(isV1PlotEndpoint({ service: 'PLoT', endpoint: '/v2/run' })).toBe(false)
      expect(isV1PlotEndpoint({ service: 'CEE', endpoint: '/v1/run' })).toBe(false)
    })
  })

  describe('isV2PlotEndpoint', () => {
    it.each([
      { ep: '/v2/run', expected: true },
      { ep: 'https://engine.test/v2/run?q=1', expected: true },
      // Reject look-alikes
      { ep: '/v2/running', expected: false },
      { ep: '/v2/run-old', expected: false },
      { ep: '/legacy?next=/v2/run', expected: false },
    ])('endpoint=$ep → $expected', ({ ep, expected }) => {
      expect(isV2PlotEndpoint({ service: 'PLoT', endpoint: ep })).toBe(expected)
    })
  })
})



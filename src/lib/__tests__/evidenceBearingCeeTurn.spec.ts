/**
 * Unit tests for `findLatestEvidenceBearingCeeTurn`.
 *
 * Workstream: DGAI debug output — preserve latest analysis evidence
 * after follow-up turns (2026-05-23).
 *
 * Selector is a strict subset of `findLatestAnalysisProducingCeeTurn`:
 *   1. CEE service
 *   2. V5 turn endpoint
 *   3. analysis-producing action/turn type
 *   4. response body carries an evidence-bearing analysis_result block
 *
 * Plus a scenario gate: explicit scenario mismatches are REJECTED
 * outright (not just deprioritised).
 *
 * Covers (test IDs follow the plan):
 *   A — hash match
 *   B — scenario match without hash
 *   C — evidence-bearing recency
 *   D — bug repro (run_analysis + follow-up prose only)
 *   E — follow-up with own enrichment
 *   F — refresh (multiple run_analysis + prose follow-up)
 *   G — parse-error wrapper detection
 *   H — _meta.payloads sidecar acceptance
 *   I — enrichment lacking all indicators rejected
 *   J — empty trace store
 *   K — V5 endpoint scope (legacy CEE rejected)
 *   L — explicit scenario mismatch rejected
 *   M — missing scenario fallback
 *   N — hash mismatch honesty
 *   O — indicative-key parity (one fixture per key)
 *
 * Note on test D: parity check that
 * `findLatestAnalysisProducingCeeTurn` picks the newer follow-up on
 * the same fixture, demonstrating the two selectors disagree by
 * design.
 */

import { describe, it, expect } from 'vitest'

import {
  findLatestEvidenceBearingCeeTurn,
  hasEvidenceBearingEnrichment,
} from '../evidenceBearingCeeTurn'
import { findLatestAnalysisProducingCeeTurn } from '../analysisProducingCeeTurn'
import {
  RAW_PAYLOAD_INDICATIVE_KEYS,
  type RawPayloadIndicativeKey,
} from '../v5EvidenceKeys'
import type { SelectorTracedPayload } from '../analysisProducingCeeTurn'

// --- Fixture builders ------------------------------------------------

function enrichmentWith(keys: Record<string, unknown>): Record<string, unknown> {
  return { ...keys }
}

function analysisResultBlock(
  enrichment: Record<string, unknown> = enrichmentWith({
    option_comparison: [{ option_id: 'opt-1' }],
  }),
): Record<string, unknown> {
  return {
    type: 'analysis_result',
    enrichment,
  }
}

interface CeeTurnOpts {
  id?: string
  endpoint?: string
  status?: number
  completed?: boolean
  turnType?: string
  scenarioId?: string | null
  responseHash?: string | null
  responseBody?: unknown
  service?: string
}

function ceeTurn(opts: CeeTurnOpts = {}): SelectorTracedPayload {
  const body: Record<string, unknown> = {}
  if (opts.scenarioId !== null) {
    body.scenario_id = opts.scenarioId ?? 'scn-1'
  }
  const responseBody: Record<string, unknown> = {
    ...(opts.responseBody && typeof opts.responseBody === 'object'
      ? (opts.responseBody as Record<string, unknown>)
      : {}),
  }
  if (opts.responseHash != null) {
    responseBody.response_hash = opts.responseHash
  }
  return {
    id: opts.id ?? 'tp-1',
    service: opts.service ?? 'CEE',
    endpoint: opts.endpoint ?? '/bff/orchestrate/v2/turn',
    status: opts.status ?? 200,
    completed: opts.completed ?? true,
    turnType: opts.turnType ?? 'run_analysis',
    request: { headers: {}, body },
    response: { headers: {}, body: responseBody },
  }
}

// A run_analysis turn whose response carries a real analysis_result
// block with indicative-keys enrichment.
function evidenceBearingRunAnalysis(
  opts: CeeTurnOpts = {},
): SelectorTracedPayload {
  return ceeTurn({
    turnType: 'run_analysis',
    responseBody: { blocks: [analysisResultBlock()] },
    ...opts,
  })
}

// A what_would_flip / explain prose-only turn (the conversational
// follow-up chip case).
function proseFollowUpTurn(
  opts: CeeTurnOpts = {},
): SelectorTracedPayload {
  return ceeTurn({
    turnType: 'explain',
    responseBody: { blocks: [] },
    ...opts,
  })
}

// --- hasEvidenceBearingEnrichment unit coverage ----------------------

describe('hasEvidenceBearingEnrichment', () => {
  it('returns false for empty blocks[]', () => {
    expect(
      hasEvidenceBearingEnrichment(
        ceeTurn({ responseBody: { blocks: [] } }),
      ),
    ).toBe(false)
  })

  it('returns false for missing response body', () => {
    expect(hasEvidenceBearingEnrichment({})).toBe(false)
    expect(
      hasEvidenceBearingEnrichment({ response: { body: null as unknown } }),
    ).toBe(false)
  })

  it('returns true for analysis_result with any indicative key', () => {
    for (const key of RAW_PAYLOAD_INDICATIVE_KEYS) {
      const enrichment: Record<string, unknown> = { [key]: { stub: true } }
      const body = { blocks: [analysisResultBlock(enrichment)] }
      expect(
        hasEvidenceBearingEnrichment(ceeTurn({ responseBody: body })),
      ).toBe(true)
    }
  })

  it('returns true for _meta.payloads.plot_response sidecar', () => {
    const enrichment = {
      _meta: { payloads: { plot_response: { some: 'body' } } },
    }
    const body = { blocks: [analysisResultBlock(enrichment)] }
    expect(
      hasEvidenceBearingEnrichment(ceeTurn({ responseBody: body })),
    ).toBe(true)
  })

  it('returns true for downstream_calls.isl.response', () => {
    const enrichment = {
      downstream_calls: { isl: { response: { isl: 'body' } } },
    }
    const body = { blocks: [analysisResultBlock(enrichment)] }
    expect(
      hasEvidenceBearingEnrichment(ceeTurn({ responseBody: body })),
    ).toBe(true)
  })

  it('returns false for enrichment with no indicative keys / sidecar', () => {
    const enrichment = { unrelated: 'field' }
    const body = { blocks: [analysisResultBlock(enrichment)] }
    expect(
      hasEvidenceBearingEnrichment(ceeTurn({ responseBody: body })),
    ).toBe(false)
  })

  it('detects evidence under the parse-error wrapper (raw.blocks)', () => {
    const wrapped = {
      kind: 'parse_error',
      reason: 'schema mismatch',
      raw: { blocks: [analysisResultBlock()] },
    }
    expect(
      hasEvidenceBearingEnrichment(ceeTurn({ responseBody: wrapped })),
    ).toBe(true)
  })

  it('returns false for non-analysis_result blocks', () => {
    const body = {
      blocks: [
        { type: 'commentary', text: 'some prose' },
        { type: 'graph_patch', patch: {} },
      ],
    }
    expect(
      hasEvidenceBearingEnrichment(ceeTurn({ responseBody: body })),
    ).toBe(false)
  })
})

// --- A. Hash match ---------------------------------------------------

describe('findLatestEvidenceBearingCeeTurn — case A: hash match', () => {
  it('selects an evidence-bearing run_analysis whose response_hash matches resultsHash', () => {
    const target = evidenceBearingRunAnalysis({
      id: 'target',
      responseHash: 'hash-abc',
    })
    const decoy = evidenceBearingRunAnalysis({
      id: 'decoy',
      responseHash: 'hash-other',
    })
    // decoy is newer (idx 0) than target (idx 1)
    const r = findLatestEvidenceBearingCeeTurn(
      [decoy, target],
      'scn-1',
      'hash-abc',
    )
    expect(r.selected_trace_id).toBe('target')
    expect(r.selection_diagnostics.selected_reason).toBe('hash_matched')
    expect(r.selection_diagnostics.hash_match_status).toBe('matched')
    expect(r.hash_mismatch_observed).toBe(false)
  })
})

// --- B. Scenario match without hash ----------------------------------

describe('findLatestEvidenceBearingCeeTurn — case B: scenario match, no hash', () => {
  it('selects an evidence-bearing run_analysis whose scenario matches', () => {
    const r = findLatestEvidenceBearingCeeTurn(
      [evidenceBearingRunAnalysis({ scenarioId: 'scn-1' })],
      'scn-1',
      null,
    )
    expect(r.selected_trace_id).toBe('tp-1')
    expect(r.selection_diagnostics.selected_reason).toBe(
      'scenario_matched_recency',
    )
    expect(r.selection_diagnostics.scenario_status).toBe('scenario_matched')
  })
})

// --- C. Evidence-bearing recency -------------------------------------

describe('findLatestEvidenceBearingCeeTurn — case C: evidence-bearing recency', () => {
  it('selects the single evidence-bearing run_analysis when scenario is unknown', () => {
    const r = findLatestEvidenceBearingCeeTurn(
      [evidenceBearingRunAnalysis()],
      null,
      null,
    )
    expect(r.selected_trace_id).toBe('tp-1')
    expect(r.selection_diagnostics.selected_reason).toBe(
      'evidence_bearing_recency',
    )
    expect(r.selection_diagnostics.scenario_status).toBe('scenario_unknown')
  })
})

// --- D. THE BUG REPRO ------------------------------------------------

describe('findLatestEvidenceBearingCeeTurn — case D: BUG REPRO (run_analysis + prose follow-up)', () => {
  // Trace store order: [newer, older] — idx 0 is most recent.
  const follow = proseFollowUpTurn({ id: 'follow', turnType: 'explain' })
  const run = evidenceBearingRunAnalysis({ id: 'run' })
  const payloads = [follow, run]

  it('evidence selector returns the older run_analysis (the prose follow-up has blocks: [])', () => {
    const r = findLatestEvidenceBearingCeeTurn(payloads, 'scn-1', null)
    expect(r.selected_trace_id).toBe('run')
    expect(r.selection_diagnostics.selected_reason).toBe(
      'scenario_matched_recency',
    )
    expect(r.selection_diagnostics.evidence_bearing_candidate_count).toBe(1)
    expect(r.selection_diagnostics.analysis_producing_candidate_count).toBe(2)
  })

  it('parity check: findLatestAnalysisProducingCeeTurn picks the newer follow-up on the same fixture (the two selectors disagree by design)', () => {
    const r = findLatestAnalysisProducingCeeTurn(payloads, 'scn-1', null)
    expect(r.selected?.id).toBe('follow')
  })
})

// --- E. Follow-up with its own enrichment ----------------------------

describe('findLatestEvidenceBearingCeeTurn — case E: follow-up carries its own enrichment', () => {
  it('selects the newer evidence-bearing follow-up when both turns carry enrichment', () => {
    const older = evidenceBearingRunAnalysis({ id: 'older' })
    const newer = evidenceBearingRunAnalysis({
      id: 'newer',
      turnType: 'explain',
    })
    // newer at idx 0, older at idx 1 — recency tips the scale.
    const r = findLatestEvidenceBearingCeeTurn(
      [newer, older],
      'scn-1',
      null,
    )
    expect(r.selected_trace_id).toBe('newer')
  })
})

// --- F. Refresh ------------------------------------------------------

describe('findLatestEvidenceBearingCeeTurn — case F: refresh (two run_analysis + prose follow-up)', () => {
  it('selects the MOST RECENT run_analysis when a later prose follow-up exists', () => {
    const follow = proseFollowUpTurn({ id: 'follow', turnType: 'explain' })
    const recentRun = evidenceBearingRunAnalysis({ id: 'recent' })
    const olderRun = evidenceBearingRunAnalysis({ id: 'older' })
    // Order: most recent first
    const r = findLatestEvidenceBearingCeeTurn(
      [follow, recentRun, olderRun],
      'scn-1',
      null,
    )
    expect(r.selected_trace_id).toBe('recent')
  })
})

// --- G. Parse-error wrapper ------------------------------------------

describe('findLatestEvidenceBearingCeeTurn — case G: parse-error wrapper', () => {
  it('detects enrichment under response.body.raw.blocks[0]', () => {
    const wrapped = ceeTurn({
      id: 'wrapped',
      responseBody: {
        kind: 'parse_error',
        reason: 'schema mismatch',
        raw: { blocks: [analysisResultBlock()] },
      },
    })
    const r = findLatestEvidenceBearingCeeTurn([wrapped], 'scn-1', null)
    expect(r.selected_trace_id).toBe('wrapped')
  })
})

// --- H. _meta.payloads sidecar only ----------------------------------

describe('findLatestEvidenceBearingCeeTurn — case H: _meta.payloads sidecar', () => {
  it('accepts enrichment whose only signal is `_meta.payloads.plot_response`', () => {
    const sidecarOnly = ceeTurn({
      id: 'sidecar',
      responseBody: {
        blocks: [
          analysisResultBlock({
            _meta: { payloads: { plot_response: { stub: true } } },
          }),
        ],
      },
    })
    const r = findLatestEvidenceBearingCeeTurn(
      [sidecarOnly],
      'scn-1',
      null,
    )
    expect(r.selected_trace_id).toBe('sidecar')
  })
})

// --- I. No evidence-bearing candidate --------------------------------

describe('findLatestEvidenceBearingCeeTurn — case I: no evidence-bearing candidate', () => {
  it('returns no_evidence_bearing_candidate when analysis-producing turns lack evidence', () => {
    const noEvidence = ceeTurn({
      id: 'no-ev',
      turnType: 'run_analysis',
      responseBody: {
        blocks: [analysisResultBlock({ unrelated: 'field' })],
      },
    })
    const r = findLatestEvidenceBearingCeeTurn([noEvidence], 'scn-1', null)
    expect(r.selected).toBeUndefined()
    expect(r.selection_diagnostics.selected_reason).toBe(
      'no_evidence_bearing_candidate',
    )
    expect(r.selection_diagnostics.analysis_producing_candidate_count).toBe(1)
    expect(r.selection_diagnostics.evidence_bearing_candidate_count).toBe(0)
  })
})

// --- J. Empty trace store --------------------------------------------

describe('findLatestEvidenceBearingCeeTurn — case J: empty trace store', () => {
  it('returns no_cee_candidate', () => {
    const r = findLatestEvidenceBearingCeeTurn([], 'scn-1', null)
    expect(r.selected).toBeUndefined()
    expect(r.selection_diagnostics.selected_reason).toBe('no_cee_candidate')
    expect(r.selection_diagnostics.cee_candidate_count).toBe(0)
  })
})

// --- K. V5 endpoint scope --------------------------------------------

describe('findLatestEvidenceBearingCeeTurn — case K: V5 endpoint scope', () => {
  it('rejects a legacy /bff/cee/turn trace even with full enrichment', () => {
    const legacy = ceeTurn({
      id: 'legacy',
      endpoint: '/bff/cee/turn',
      responseBody: { blocks: [analysisResultBlock()] },
    })
    const r = findLatestEvidenceBearingCeeTurn([legacy], 'scn-1', null)
    expect(r.selected).toBeUndefined()
    expect(r.selection_diagnostics.selected_reason).toBe(
      'no_v5_endpoint_candidate',
    )
    expect(r.selection_diagnostics.v5_endpoint_candidate_count).toBe(0)
  })
})

// --- L. Explicit scenario mismatch -----------------------------------

describe('findLatestEvidenceBearingCeeTurn — case L: scenario mismatch rejected', () => {
  it('rejects candidate whose scenario_id differs from currentScenarioId', () => {
    const wrongScenario = evidenceBearingRunAnalysis({
      id: 'wrong',
      scenarioId: 'scn-other',
    })
    const r = findLatestEvidenceBearingCeeTurn(
      [wrongScenario],
      'scn-1',
      null,
    )
    expect(r.selected).toBeUndefined()
    expect(r.selection_diagnostics.selected_reason).toBe(
      'no_evidence_bearing_candidate',
    )
    expect(
      r.selection_diagnostics.rejected_scenario_mismatch_count,
    ).toBe(1)
  })

  it('selects same-scenario candidate when both same-scenario and cross-scenario candidates exist', () => {
    const wrong = evidenceBearingRunAnalysis({
      id: 'wrong',
      scenarioId: 'scn-other',
    })
    const right = evidenceBearingRunAnalysis({
      id: 'right',
      scenarioId: 'scn-1',
    })
    const r = findLatestEvidenceBearingCeeTurn(
      [wrong, right],
      'scn-1',
      null,
    )
    expect(r.selected_trace_id).toBe('right')
    expect(
      r.selection_diagnostics.rejected_scenario_mismatch_count,
    ).toBe(1)
  })
})

// --- M. Missing scenario fallback ------------------------------------

describe('findLatestEvidenceBearingCeeTurn — case M: missing scenario fallback', () => {
  it('selects a candidate with no scenario_id when no scenario_matched candidate exists', () => {
    const missingScenario = evidenceBearingRunAnalysis({
      id: 'missing',
      scenarioId: null,
    })
    const r = findLatestEvidenceBearingCeeTurn(
      [missingScenario],
      'scn-1',
      null,
    )
    expect(r.selected_trace_id).toBe('missing')
    expect(
      r.selection_diagnostics.used_missing_scenario_fallback,
    ).toBe(true)
    expect(r.selection_diagnostics.scenario_status).toBe(
      'scenario_missing_on_candidate',
    )
  })
})

// --- N. Hash mismatch honesty ----------------------------------------

describe('findLatestEvidenceBearingCeeTurn — case N: hash mismatch honesty', () => {
  it('selects the best available candidate; flags hash_mismatch_observed', () => {
    const turn = evidenceBearingRunAnalysis({
      id: 'mismatched',
      responseHash: 'hash-a',
    })
    const r = findLatestEvidenceBearingCeeTurn([turn], 'scn-1', 'hash-b')
    expect(r.selected_trace_id).toBe('mismatched')
    expect(r.hash_mismatch_observed).toBe(true)
    expect(r.selection_diagnostics.hash_match_status).toBe('mismatched')
    expect(r.selected_response_hash).toBe('hash-a')
  })
})

// --- O. Indicative-key parity ----------------------------------------

describe('findLatestEvidenceBearingCeeTurn — case O: indicative-key parity', () => {
  // Demonstrates the selector and resolver agree on what counts as
  // evidence-bearing — both import from v5EvidenceKeys.ts.
  for (const key of RAW_PAYLOAD_INDICATIVE_KEYS) {
    const k: RawPayloadIndicativeKey = key
    it(`accepts a candidate whose enrichment carries only \`${k}\``, () => {
      const turn = ceeTurn({
        id: `key-${k}`,
        responseBody: {
          blocks: [analysisResultBlock({ [k]: { stub: true } })],
        },
      })
      const r = findLatestEvidenceBearingCeeTurn([turn], 'scn-1', null)
      expect(r.selected_trace_id).toBe(`key-${k}`)
    })
  }
})

// --- P. Selector / resolver parity: first analysis_result block wins -

describe('findLatestEvidenceBearingCeeTurn — case P: selector/resolver parity (first analysis_result block wins)', () => {
  // The resolver's `findAnalysisResultBlock` returns the FIRST
  // analysis_result block from `body.blocks` regardless of whether
  // its enrichment is usable, and only falls back to
  // `body.raw.blocks` when `body.blocks` had no analysis_result
  // block at all. The selector mirrors that exactly so reviewers
  // never see `analysis_evidence_trace.source = recovered_earlier_cee_turn`
  // paired with `scientific_validation.source = unavailable`.

  it('REJECTS a candidate whose FIRST analysis_result block lacks enrichment, even if a LATER block carries evidence', () => {
    const turn = ceeTurn({
      id: 'first-empty-second-full',
      responseBody: {
        blocks: [
          { type: 'analysis_result', enrichment: {} }, // first — no evidence
          analysisResultBlock(), // second — full enrichment
        ],
      },
    })
    const r = findLatestEvidenceBearingCeeTurn([turn], 'scn-1', null)
    // Resolver would also pick the first (empty) block and report
    // unavailable. Selector matches.
    expect(r.selected).toBeUndefined()
    expect(r.selection_diagnostics.selected_reason).toBe(
      'no_evidence_bearing_candidate',
    )
  })

  it('REJECTS a candidate whose body.blocks has a non-evidence-bearing analysis_result, even if body.raw.blocks has evidence', () => {
    // body.blocks has an analysis_result block (no enrichment), so
    // the resolver returns THAT block and never inspects raw.blocks.
    // The selector must match.
    const turn = ceeTurn({
      id: 'top-empty-raw-full',
      responseBody: {
        blocks: [{ type: 'analysis_result', enrichment: {} }],
        raw: { blocks: [analysisResultBlock()] },
      },
    })
    const r = findLatestEvidenceBearingCeeTurn([turn], 'scn-1', null)
    expect(r.selected).toBeUndefined()
    expect(r.selection_diagnostics.selected_reason).toBe(
      'no_evidence_bearing_candidate',
    )
  })

  it('ACCEPTS the parse-error wrapper only when body.blocks has NO analysis_result block at all', () => {
    // body.blocks present but no analysis_result block → falls
    // through to raw.blocks. Resolver behaves the same way.
    const turn = ceeTurn({
      id: 'fall-through-to-raw',
      responseBody: {
        blocks: [{ type: 'commentary', text: 'prose' }],
        raw: { blocks: [analysisResultBlock()] },
      },
    })
    const r = findLatestEvidenceBearingCeeTurn([turn], 'scn-1', null)
    expect(r.selected_trace_id).toBe('fall-through-to-raw')
  })

  it('ACCEPTS when the FIRST analysis_result block has evidence (later blocks irrelevant)', () => {
    const turn = ceeTurn({
      id: 'first-full',
      responseBody: {
        blocks: [
          analysisResultBlock(), // first — full enrichment
          { type: 'analysis_result', enrichment: {} }, // second — empty
        ],
      },
    })
    const r = findLatestEvidenceBearingCeeTurn([turn], 'scn-1', null)
    expect(r.selected_trace_id).toBe('first-full')
  })
})

// --- Q. Null-id defensive coverage -----------------------------------

describe('findLatestEvidenceBearingCeeTurn — case Q: candidate with no `id` field', () => {
  it('selects the trace; returns null `selected_trace_id` rather than fabricating one', () => {
    // Defensive: trace-store entries are recorded with `id` set, but
    // the SelectorTracedPayload type permits the field to be absent.
    // The selector should not throw and should expose `selected_trace_id: null`
    // so callers can detect the situation explicitly.
    //
    // Bypass the `ceeTurn` builder's default id assignment by
    // constructing the SelectorTracedPayload literal here.
    const turn: SelectorTracedPayload = {
      service: 'CEE',
      endpoint: '/bff/orchestrate/v2/turn',
      status: 200,
      completed: true,
      turnType: 'run_analysis',
      request: { headers: {}, body: { scenario_id: 'scn-1' } },
      response: {
        headers: {},
        body: { blocks: [analysisResultBlock()] },
      },
    }
    const r = findLatestEvidenceBearingCeeTurn([turn], 'scn-1', null)
    expect(r.selected).toBeDefined()
    expect(r.selected_trace_id).toBeNull()
  })
})

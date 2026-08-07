// @vitest-environment jsdom
/**
 * v5_cee_capture diagnostic — Phase 3 blocks-array tolerance.
 *
 * This is the debug-bundle counterpart to
 *   src/v5/__tests__/parser.phase3-blocks-tolerance.spec.ts
 * The bundle assertions live here (not in v5/__tests__) originally because
 * tsconfig.ci.json's `include` was a small hand-written set plus the src/v5/
 * tree, so pulling buildDebugBundleAsync / DebugData into the v5 graph would
 * surface latent type errors in untouched debug modules and break CI. That
 * gate was replaced on 2026-07-25: everything is typechecked now and the
 * pre-existing errors are frozen in scripts/ci/typecheck-baseline.txt. The
 * split is retained because it keeps each spec on one subject.
 *
 * Acceptance points covered:
 *   - Unknown blocks[] types are TOLERATED (defensive hardening, 2026-06):
 *     v5_cee_capture stays parse_ok:true and surfaces unknown_block_types +
 *     unknown_blocks_tolerated_count from the sidecar. A genuine parse
 *     failure (malformed known block) still reports parse_ok:false.
 *   - End-to-end callV5Turn → recordResponsePayload → redactor → bundle
 *     preserves the Phase 3 sidecar through the trace store's
 *     Object.keys-based redactor.
 *   - Success-path emits honest diagnostics:
 *       - raw_response_present:false (the trace stores a parsed clone,
 *         not the literal wire JSON).
 *       - response_top_level_keys reflects the ORIGINAL CEE root keys
 *         (via the parser's sidecar metadata), not the parsed-clone keys.
 *       - has_additive_extensions:true only when CEE emitted top-level
 *         additive fields. Phase-3-only responses (with the metadata
 *         sidecar carrying ONLY phase3 blocks + original-key list) MUST
 *         report has_additive_extensions:false.
 *       - phase3_blocks_tolerated_count and phase3_block_types name the
 *         Phase 3 blocks the parser tolerated out of `blocks[]`.
 */
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, beforeEach, vi } from 'vitest'

const { mockIsV5CanonicalAnalysisEnabled } = vi.hoisted(() => ({
  mockIsV5CanonicalAnalysisEnabled: vi.fn(() => true),
}))

vi.mock('../../../flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../flags')>()
  return {
    ...actual,
    isV5CanonicalAnalysisEnabled: mockIsV5CanonicalAnalysisEnabled,
  }
})

import { parseV5Response } from '../../../v5/responseParser'
import { useCanvasStore } from '../../../canvas/store'
import type { V5AnalysisFactState } from '../../../canvas/store'
import { callV5Turn } from '../../../v5/v5Adapter'
import { usePayloadTraceStore } from '../../../lib/payload-trace-store'
import { buildDebugBundleAsync } from '../utils/exportBundle'
import type { DebugData } from '../hooks/useDebugData'

// ── Test fixtures ─────────────────────────────────────────────────────

/** Same shape as the v5 spec's ceeFixture — kept here so the two specs
 *  can evolve independently. Includes top-level additive freshness keys
 *  AND Phase 3 blocks inside blocks[]. */
function ceeFixture(): Record<string, unknown> {
  const graphHash = 'graph-h-1'
  const createdAt = '2026-05-18T10:00:00.000+01:00'
  return {
    response_version: 2,
    assistant_text: '',
    blocks: [
      {
        type: 'analysis_result',
        summary: 'Option A leads.',
        leading_option_id: 'opt-a',
        win_probabilities: { 'opt-a': 0.72, 'opt-b': 0.23, 'opt-c': 0.05 },
      },
      {
        type: 'review_card',
        block_id: 'rc-narrative-1',
        signal_id: 'review:narrative:opt-a',
        created_at: createdAt,
        source_handler: 'decision_review',
        graph_hash_at_generation: graphHash,
        freshness: 'fresh',
        card_kind: 'narrative',
        title: 'Decision review',
      },
      {
        type: 'coaching',
        block_id: 'coach-strengthen-1',
        signal_id: 'coaching:strengthen:node-A',
        created_at: createdAt,
        source_handler: 'run_analysis',
        graph_hash_at_generation: graphHash,
        freshness: 'fresh',
        coaching_kind: 'strengthen',
        title: 'Strengthen evidence for Factor A',
        action_intent: 'gather_evidence',
        priority_rank: 1,
      },
    ],
    suggested_actions: [],
    insights: [],
    stage_indicator: 'analyse',
    analysis_freshness: 'fresh',
    has_run_analysis_fact: true,
    freshness_reason: 'just_minted',
  }
}

/** Phase 3 blocks present in blocks[] but NO top-level additive fields. */
function phase3OnlyFixture(): Record<string, unknown> {
  return {
    response_version: 2,
    assistant_text: '',
    blocks: [
      { type: 'analysis_result', summary: 'leads', leading_option_id: 'opt-a' },
      {
        type: 'review_card',
        block_id: 'rc-1',
        signal_id: 'rc:1',
        card_kind: 'narrative',
      },
      {
        type: 'coaching',
        block_id: 'co-1',
        signal_id: 'co:1',
        coaching_kind: 'strengthen',
        title: 'Strengthen',
      },
    ],
    suggested_actions: [],
    insights: [],
    stage_indicator: 'analyse',
  }
}

function makeResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function makeDebugData(overrides: Partial<DebugData> = {}): DebugData {
  return {
    overall: { status: 'success', total_duration_ms: 100, request_id: 'req-test-1' },
    services: { cee: null, plot: null, isl: null },
    error: null,
    builds: { ui: 'test', cee: null, plot: null, isl: null },
    diagnostics: {
      plot_has_downstream_calls: false,
      downstream_calls_path_found: null,
      downstream_calls_paths_checked: [],
      isl_data_source: 'none',
      cee_trace_present: false,
      cee_degraded: false,
      llm_raw_available: false,
      llm_raw_path_found: null,
      e_values_present: false,
      isl_edge_e_values_present: false,
      plot_edge_e_values_exposed: false,
      ui_edge_e_values_available: false,
      evpi_present: false,
      confidence_differentiated: false,
      confidence_unique_values: [],
      factor_confidence_differentiated: false,
      factor_confidence_unique_values: [],
      confidence_source_bootstrap: false,
      intercept_populated: false,
      epsilon_std_present: false,
      response_hash_present: false,
      mca_computed: false,
    },
    ceeTrace: null,
    corrections: [],
    correctionsSummary: null,
    pipeline: {
      status: 'success',
      total_duration_ms: 100,
      stages: [],
      connectivity: { decision_count: 0, option_count: 0, goal_count: 0, factor_count: 0, edge_count: 0 },
    },
    payloads: {
      cee_request: null,
      cee_response: null,
      plot_request: null,
      plot_response: null,
      isl_request: null,
      isl_response: null,
    },
    gates: [],
    validation: { summary: { errors: 0, warnings: 0, info: 0 }, issues: [] },
    winningOption: null,
    robustness: { status: 'unavailable', stability: null, context_label: 'N/A', description: '' },
    hasData: true,
    orchestrator: null,
    v12_4_checks: null,
    request_id_chain: null,
    feature_flags_at_request: null,
    timing: null,
    schema_versions: null,
    cee_observability: null,
    m1_coaching: null,
    m2_review: null,
    cee_downstream: null,
    cee_operations: null,
    diagnostic_trace: null,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockIsV5CanonicalAnalysisEnabled.mockReturnValue(true)
  useCanvasStore.setState({
    results: { status: 'idle' },
    currentScenarioId: 'scenario-A',
    v5AnalysisFact: null,
  } as any)
})

describe('v5_cee_capture — unknown-block tolerance path', () => {
  // Build a success-path DebugData from a parsed OlumiResponse body. Mirrors
  // the proven `success path honest semantics` pattern below: passing
  // `parsed.response` (object reference) keeps the NON-ENUMERABLE
  // `__additive__` sidecar accessible to the capture builder.
  function successData(responseBody: Record<string, unknown>) {
    return makeDebugData({
      services: {
        cee: {
          name: 'CEE',
          status: 200,
          success: true,
          duration_ms: 200,
          endpoint: '/bff/orchestrate/v2/turn',
        },
        plot: null,
        isl: null,
      },
      payloads: {
        cee_request: { kind: 'message', message: 'run' },
        cee_response: responseBody,
        plot_request: null,
        plot_response: null,
        isl_request: null,
        isl_response: null,
      },
    })
  }

  it('(5,6) an unknown block is tolerated: v5_cee_capture is parse_ok=true and surfaces unknown_block_types + unknown_blocks_tolerated_count from the sidecar', async () => {
    const fixture = ceeFixture()
    ;(fixture.blocks as unknown[]).push({
      type: 'totally_unknown_future_type',
      payload: { whatever: 1 },
    })
    const parsed = await parseV5Response(makeResponse(fixture))
    expect(parsed.kind).toBe('response')
    if (parsed.kind !== 'response') throw new Error('unreachable')

    const bundle = await buildDebugBundleAsync(
      successData(parsed.response as unknown as Record<string, unknown>),
    )
    const diag = bundle.v5_canonical_analysis!
    expect(diag.v5_cee_capture).not.toBeNull()
    const capture = diag.v5_cee_capture!

    // Tolerated — NOT a parse failure.
    expect(capture.parse_ok).toBe(true)
    expect(capture.parse_failure_kind).toBeNull()
    expect(diag.debug_capture_status).toBe('complete')

    // (6) Structured, observable diagnostic on the capture object.
    expect(capture.unknown_block_types).toEqual(['totally_unknown_future_type'])
    expect(capture.unknown_blocks_tolerated_count).toBe(1)

    // (7) No raw block payload leaks into the structured capture.
    expect(JSON.stringify(capture)).not.toContain('whatever')
  })

  it('mixed blocks (Phase 3 + unknown) → tolerated: phase3 counts AND unknown counts both surface', async () => {
    const fixture = ceeFixture() // analysis_result + review_card + coaching
    ;(fixture.blocks as unknown[]).push({
      type: 'totally_unknown_future_type',
      payload: { whatever: 1 },
    })
    const parsed = await parseV5Response(makeResponse(fixture))
    expect(parsed.kind).toBe('response')
    if (parsed.kind !== 'response') throw new Error('unreachable')

    const bundle = await buildDebugBundleAsync(
      successData(parsed.response as unknown as Record<string, unknown>),
    )
    const capture = bundle.v5_canonical_analysis!.v5_cee_capture!

    expect(capture.parse_ok).toBe(true)
    // Phase 3 tolerated blocks still enumerated...
    expect(capture.phase3_blocks_tolerated_count).toBe(2)
    expect(capture.phase3_block_types).toEqual(['coaching', 'review_card'])
    // ...alongside the unknown-block diagnostic.
    expect(capture.unknown_block_types).toEqual(['totally_unknown_future_type'])
    expect(capture.unknown_blocks_tolerated_count).toBe(1)
  })

  it('(12) a genuine parse failure (malformed KNOWN block) still flows into v5_cee_capture with parse_ok=false', async () => {
    const fixture = ceeFixture()
    ;(fixture.blocks as unknown[]).push({ type: 'text' /* required content missing */ })
    const parsed = await parseV5Response(makeResponse(fixture))
    expect(parsed.kind).toBe('parse_error')

    const data = makeDebugData({
      payloads: {
        cee_request: { kind: 'message', message: 'run' },
        cee_response: parsed as unknown as Record<string, unknown>,
        plot_request: null,
        plot_response: null,
        isl_request: null,
        isl_response: null,
      },
    })

    const bundle = await buildDebugBundleAsync(data)
    const diag = bundle.v5_canonical_analysis!
    const capture = diag.v5_cee_capture!
    expect(capture.parse_ok).toBe(false)
    expect(capture.parse_failure_kind).toBe('schema_mismatch')
    expect(capture.raw_response_present).toBe(true)
    expect(diag.debug_capture_status).toBe('parse_failed')
  })
})

describe('v5_cee_capture — end-to-end through redactor', () => {
  it('callV5Turn → trace-store redactor → bundle preserves Phase 3 fields', async () => {
    // P1 regression — the parser stashes Phase 3 blocks on a
    // NON-ENUMERABLE sidecar so they don't leak into JSON.stringify. The
    // trace store's redactor uses Object.keys (skips non-enumerable), so
    // a literal "store the parsed response" would lose the sidecar before
    // the bundle reads it. v5Adapter promotes the sidecar to an
    // enumerable property on a shallow clone for the trace body — this
    // test proves the clone survives the redactor and the bundle still
    // populates phase3_blocks_tolerated_count + phase3_block_types.

    usePayloadTraceStore.setState({ payloads: [], selectedId: null } as any)

    const fixture = ceeFixture()
    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify(fixture), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })

    const result = await callV5Turn(
      { kind: 'message', message: 'run analysis' } as never,
      { fetchImpl },
    )
    expect(result.kind).toBe('response')

    const traced = usePayloadTraceStore.getState().payloads
    expect(traced).toHaveLength(1)
    const tracedBody = traced[0].response?.body as Record<string, unknown>

    useCanvasStore.setState({
      results: {
        status: 'complete',
        report: { schema: 'report.v1' } as any,
        hash: 'hash-e2e',
      },
      currentScenarioId: 'scenario-A',
      v5AnalysisFact: {
        scenarioId: 'scenario-A',
        analysisHash: 'hash-e2e',
        hasRunAnalysisFact: true,
        freshness: 'fresh',
        freshnessReason: null,
        rawBlocks: [],
        writtenAt: Date.now(),
      } satisfies V5AnalysisFactState,
    } as any)

    const data = makeDebugData({
      services: {
        cee: {
          name: 'CEE',
          status: 200,
          success: true,
          duration_ms: 312,
          endpoint: '/bff/orchestrate/v2/turn',
        },
        plot: null,
        isl: null,
      },
      payloads: {
        cee_request: traced[0].request?.body as Record<string, unknown> | null,
        cee_response: tracedBody,
        plot_request: null,
        plot_response: null,
        isl_request: null,
        isl_response: null,
      },
    })

    const bundle = await buildDebugBundleAsync(data)
    const capture = bundle.v5_canonical_analysis!.v5_cee_capture!
    expect(capture.parse_ok).toBe(true)
    expect(capture.phase3_blocks_tolerated_count).toBe(2)
    expect(capture.phase3_block_types).toEqual(['coaching', 'review_card'])
    expect(capture.raw_response_present).toBe(false)
    expect(capture.response_top_level_keys).not.toContain('__additive__')
    expect(capture.response_top_level_keys).toEqual(
      expect.arrayContaining([
        'analysis_freshness',
        'has_run_analysis_fact',
        'freshness_reason',
      ]),
    )
    // Fixture emits top-level additive fields, so has_additive_extensions
    // must be true here. The next test pins the OPPOSITE case (Phase 3
    // blocks present, no top-level additives → false).
    expect(capture.has_additive_extensions).toBe(true)
  })

  it('callV5Turn → trace-store redactor → bundle preserves the unknown_blocks diagnostic', async () => {
    // Companion to the Phase 3 test above: the unknown_blocks diagnostic
    // rides the SAME non-enumerable __additive__ sidecar, so it must
    // likewise survive the trace store's Object.keys-based redactor (via
    // v5Adapter's enumerable-clone promotion) end-to-end into the bundle —
    // not just the synthetic object-ref path used by the tolerance tests.
    usePayloadTraceStore.setState({ payloads: [], selectedId: null } as any)

    const fixture = ceeFixture()
    ;(fixture.blocks as unknown[]).push({
      type: 'totally_unknown_future_type',
      payload: { whatever: 1 },
    })
    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify(fixture), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })

    const result = await callV5Turn(
      { kind: 'message', message: 'run analysis' } as never,
      { fetchImpl },
    )
    expect(result.kind).toBe('response')

    const traced = usePayloadTraceStore.getState().payloads
    expect(traced).toHaveLength(1)
    const tracedBody = traced[0].response?.body as Record<string, unknown>

    const data = makeDebugData({
      services: {
        cee: {
          name: 'CEE',
          status: 200,
          success: true,
          duration_ms: 312,
          endpoint: '/bff/orchestrate/v2/turn',
        },
        plot: null,
        isl: null,
      },
      payloads: {
        cee_request: traced[0].request?.body as Record<string, unknown> | null,
        cee_response: tracedBody,
        plot_request: null,
        plot_response: null,
        isl_request: null,
        isl_response: null,
      },
    })

    const bundle = await buildDebugBundleAsync(data)
    const capture = bundle.v5_canonical_analysis!.v5_cee_capture!

    // Survived the REAL redactor (not just the synthetic object-ref path).
    expect(capture.parse_ok).toBe(true)
    expect(capture.unknown_block_types).toEqual(['totally_unknown_future_type'])
    expect(capture.unknown_blocks_tolerated_count).toBe(1)
    // Phase 3 tolerated blocks still present alongside.
    expect(capture.phase3_blocks_tolerated_count).toBe(2)
    // No raw payload leaked through the redactor into the capture.
    expect(JSON.stringify(capture)).not.toContain('whatever')
  })
})

describe('v5_cee_capture — success path honest semantics', () => {
  it('parse-success envelope populates v5_cee_capture with phase3 counts + honest raw flags', async () => {
    const parsed = await parseV5Response(makeResponse(ceeFixture()))
    expect(parsed.kind).toBe('response')
    if (parsed.kind !== 'response') throw new Error('unreachable')

    useCanvasStore.setState({
      results: {
        status: 'complete',
        report: { schema: 'report.v1' } as any,
        hash: 'hash-success',
      },
      currentScenarioId: 'scenario-A',
      v5AnalysisFact: {
        scenarioId: 'scenario-A',
        analysisHash: 'hash-success',
        hasRunAnalysisFact: true,
        freshness: 'fresh',
        freshnessReason: null,
        rawBlocks: [],
        writtenAt: Date.now(),
      } satisfies V5AnalysisFactState,
    } as any)

    const data = makeDebugData({
      services: {
        cee: {
          name: 'CEE',
          status: 200,
          success: true,
          duration_ms: 312,
          endpoint: '/bff/orchestrate/v2/turn',
        },
        plot: null,
        isl: null,
      },
      payloads: {
        cee_request: { kind: 'message', message: 'run' },
        cee_response: parsed.response as unknown as Record<string, unknown>,
        plot_request: null,
        plot_response: null,
        isl_request: null,
        isl_response: null,
      },
    })

    const bundle = await buildDebugBundleAsync(data)
    const diag = bundle.v5_canonical_analysis!
    expect(diag.v5_cee_capture).not.toBeNull()
    const capture = diag.v5_cee_capture!

    expect(capture.parse_ok).toBe(true)
    expect(capture.parse_error).toBeNull()
    expect(capture.parse_failure_kind).toBeNull()
    // Success path stores a parsed clone, not the verbatim wire JSON.
    expect(capture.raw_response_present).toBe(false)
    // response_top_level_keys reflects the ORIGINAL CEE root shape from
    // the parser's sidecar metadata — including the top-level Phase 3
    // freshness extras, NOT the parsed-clone's `__additive__` key.
    expect(capture.response_top_level_keys).toEqual(
      [
        'analysis_freshness',
        'assistant_text',
        'blocks',
        'freshness_reason',
        'has_run_analysis_fact',
        'insights',
        'response_version',
        'stage_indicator',
        'suggested_actions',
      ].sort(),
    )
    expect(capture.response_top_level_keys).not.toContain('__additive__')
    expect(capture.phase3_blocks_tolerated_count).toBe(2)
    expect(capture.phase3_block_types).toEqual(['coaching', 'review_card'])
    expect(diag.debug_capture_status).toBe('complete')
  })

  it('Phase-3-only response: has_additive_extensions:false, phase3 counts > 0', async () => {
    // Pin the documented separation between top-level additive
    // extensions and the metadata sidecar. The parser writes the sidecar
    // whenever Phase 3 blocks land in blocks[] (and stashes the
    // original-top-level-keys list alongside). Those slots are
    // diagnostic-only — they MUST NOT flip has_additive_extensions, which
    // is reserved for genuine top-level additive fields.
    const parsed = await parseV5Response(makeResponse(phase3OnlyFixture()))
    expect(parsed.kind).toBe('response')
    if (parsed.kind !== 'response') throw new Error('unreachable')

    const data = makeDebugData({
      services: {
        cee: { name: 'CEE', status: 200, success: true, duration_ms: 200, endpoint: '/bff/orchestrate/v2/turn' },
        plot: null,
        isl: null,
      },
      payloads: {
        cee_request: { kind: 'message', message: 'run' },
        cee_response: parsed.response as unknown as Record<string, unknown>,
        plot_request: null,
        plot_response: null,
        isl_request: null,
        isl_response: null,
      },
    })

    const bundle = await buildDebugBundleAsync(data)
    const capture = bundle.v5_canonical_analysis!.v5_cee_capture!

    expect(capture.parse_ok).toBe(true)
    expect(capture.phase3_blocks_tolerated_count).toBeGreaterThan(0)
    expect(capture.phase3_block_types.sort()).toEqual(['coaching', 'review_card'])
    // The whole point of this test: top-level additives are absent so
    // has_additive_extensions stays honest at false.
    expect(capture.has_additive_extensions).toBe(false)
  })
})

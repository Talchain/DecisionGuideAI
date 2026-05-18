// @vitest-environment jsdom
/**
 * V5 Phase 3 blocks-array tolerance — end-to-end regression.
 *
 * Acceptance brief (canonical V5 analysis, 2026-05-18):
 *   The vendored @talchain/schemas@0.8.1 does not include the frozen v1.3
 *   Phase 3 block types `review_card | coaching | evidence | exercise` in
 *   its `blocks[]` discriminated union. CEE emits them inside `blocks[]`
 *   per the contract, which caused strict validation to reject the entire
 *   response, short-circuit applyV5State, and leave the debug bundle's
 *   `v5_cee_capture` null.
 *
 * The fix splits `blocks[]` into legacy-known / Phase 3 whitelist /
 * truly-unknown buckets before strict validation. Legacy-known entries
 * go through strict zod; Phase 3 entries are preserved verbatim and
 * stashed in the sidecar under `phase3_blocks_from_blocks_array`;
 * truly-unknown entries still hard-fail and are named in the debug
 * bundle.
 *
 * These tests cover the ten acceptance points from the brief:
 *   1. Realistic CEE response (analysis_result + review_card + coaching)
 *      parses successfully.
 *   2. Phase 3 blocks are preserved in the sidecar with `raw` intact.
 *   3. `response.blocks` after strict validation contains only legacy
 *      schema-known entries.
 *   4. extractPhase3FromV5Response reads the sidecar Phase 3 blocks and
 *      writes them into v5AnalysisFact.rawBlocks.
 *   5. Results report is applied from the analysis_result block (store
 *      slice set).
 *   6. useAnalysisStateSource returns 'cee_v5_run_analysis' for the
 *      attached fact.
 *   7. The typed-error path does not render — routeV5Response returns a
 *      content target, not `typed_error`.
 *   8. Unknown block type inside blocks[] still fails parse and is
 *      enumerated in v5_cee_capture.parse_error / unknown_block_types.
 *   9. Malformed-known nested block (missing required field) still fails
 *      parse — nested product schemas remain strict.
 *  10. The debug bundle's v5_cee_capture is populated on parse failure
 *      rather than being null.
 */
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, beforeEach, vi } from 'vitest'

const { mockIsV5CanonicalAnalysisEnabled } = vi.hoisted(() => ({
  mockIsV5CanonicalAnalysisEnabled: vi.fn(() => true),
}))

vi.mock('../../flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../flags')>()
  return {
    ...actual,
    isV5CanonicalAnalysisEnabled: mockIsV5CanonicalAnalysisEnabled,
  }
})

import { BlockSchema } from '@talchain/schemas/boundary'

import {
  parseV5Response,
  ADDITIVE_EXTENSIONS_KEY,
  PHASE3_SIDECAR_BLOCKS_KEY,
  PHASE3_TOLERATED_BLOCK_TYPES,
  type OlumiResponseWithExtensions,
} from '../responseParser'
import {
  extractPhase3FromV5Response,
  v5ResponseHasRunAnalysisFact,
} from '../extractPhase3FromV5Response'
import { routeV5Response } from '../responseRouter'
import {
  classifyAnalysisStateSource,
  readAnalysisStateSourceFromStore,
} from '../../canvas/hooks/useAnalysisStateSource'
import { useCanvasStore } from '../../canvas/store'
import type { V5AnalysisFactState } from '../../canvas/store'
import { buildDebugBundleAsync } from '../../components/debug/utils/exportBundle'
import type { DebugData } from '../../components/debug/hooks/useDebugData'
import { callV5Turn } from '../v5Adapter'
import { usePayloadTraceStore } from '../../lib/payload-trace-store'

// ── Test fixtures ─────────────────────────────────────────────────────

/**
 * Fixture mirroring a real canonical CEE V5 turn carrying analysis_result
 * + review_card + coaching inside `blocks[]`, plus top-level Phase 3
 * freshness signals. Field shapes follow the frozen v1.3 contract
 * (`v5-analysis-tab-data-contract-v1_3.md` §0 common metadata + §1 block
 * types).
 *
 * Synthetic, not the actual redacted capture for request
 * e07ac755-d392-40fa-90ca-82c4872703ba. Replace with a real redacted
 * golden fixture when one is committed — assertions below address the
 * contract, not specific user content, so the replacement is mechanical.
 */
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
        // v1.3 §1.1 ReviewCardBlock
        type: 'review_card',
        block_id: 'rc-narrative-1',
        signal_id: 'review:narrative:opt-a',
        created_at: createdAt,
        source_handler: 'decision_review',
        graph_hash_at_generation: graphHash,
        freshness: 'fresh',
        card_kind: 'narrative',
        title: 'Decision review',
        summary: 'Robust under the modelled uncertainty.',
        target_refs: [{ type: 'option', id: 'opt-a' }],
      },
      {
        // v1.3 §1.2 CoachingBlock
        type: 'coaching',
        block_id: 'coach-strengthen-1',
        signal_id: 'coaching:strengthen:node-A',
        created_at: createdAt,
        source_handler: 'run_analysis',
        graph_hash_at_generation: graphHash,
        freshness: 'fresh',
        coaching_kind: 'strengthen',
        title: 'Strengthen evidence for Factor A',
        detail: 'Confirm the source before relying on this factor.',
        action_intent: 'gather_evidence',
        priority_rank: 1,
        target_refs: [{ type: 'node', id: 'node-A', label: 'Factor A' }],
      },
    ],
    suggested_actions: [],
    insights: [],
    stage_indicator: 'analyse',
    // Top-level Phase 3 metadata — captured via the additive-extensions
    // sidecar (not the blocks-array sidecar).
    analysis_freshness: 'fresh',
    has_run_analysis_fact: true,
    freshness_reason: 'just_minted',
  }
}

function makeResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
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
  // Reset canvas store to a clean baseline for store-level assertions.
  useCanvasStore.setState({
    results: { status: 'idle' },
    currentScenarioId: 'scenario-A',
    v5AnalysisFact: null,
  } as any)
})

// ── 1–3, 7. Parser success path ───────────────────────────────────────

describe('parser tolerance — happy path (analysis_result + review_card + coaching)', () => {
  it('parses successfully and splits blocks[] into legacy-known and sidecar Phase 3', async () => {
    const result = await parseV5Response(makeResponse(ceeFixture()))
    expect(result.kind).toBe('response')
    if (result.kind !== 'response') throw new Error('unreachable')

    const response = result.response as OlumiResponseWithExtensions

    // (3) `response.blocks` after strict validation contains ONLY legacy
    // schema-known entries. review_card and coaching are NOT in blocks[].
    expect(response.blocks).toHaveLength(1)
    expect(response.blocks[0].type).toBe('analysis_result')

    // (2) Phase 3 blocks land in the sidecar verbatim.
    const sidecar = (response as Record<string | symbol, unknown>)[ADDITIVE_EXTENSIONS_KEY]
    expect(sidecar).toBeDefined()
    const phase3FromArray = (sidecar as Record<string, unknown>)[PHASE3_SIDECAR_BLOCKS_KEY]
    expect(Array.isArray(phase3FromArray)).toBe(true)
    expect(phase3FromArray as unknown[]).toHaveLength(2)
    const types = (phase3FromArray as Array<Record<string, unknown>>)
      .map((b) => b.type)
      .sort()
    expect(types).toEqual(['coaching', 'review_card'])

    // Verbatim preservation — every v1.3 §0/§1 field round-trips
    // unchanged. If the parser starts flattening or stripping fields
    // this assertion fails on the offender.
    const reviewCard = (phase3FromArray as Array<Record<string, unknown>>).find(
      (b) => b.type === 'review_card',
    )!
    expect(reviewCard.block_id).toBe('rc-narrative-1')
    expect(reviewCard.signal_id).toBe('review:narrative:opt-a')
    expect(reviewCard.source_handler).toBe('decision_review')
    expect(reviewCard.card_kind).toBe('narrative')
    expect(reviewCard.graph_hash_at_generation).toBe('graph-h-1')
    expect(reviewCard.freshness).toBe('fresh')
    expect(reviewCard.created_at).toBe('2026-05-18T10:00:00.000+01:00')
    const coaching = (phase3FromArray as Array<Record<string, unknown>>).find(
      (b) => b.type === 'coaching',
    )!
    expect(coaching.action_intent).toBe('gather_evidence')
    expect(coaching.priority_rank).toBe(1)
    expect(coaching.coaching_kind).toBe('strengthen')
    expect(coaching.signal_id).toBe('coaching:strengthen:node-A')
    expect((coaching.target_refs as unknown[])[0]).toEqual({
      type: 'node',
      id: 'node-A',
      label: 'Factor A',
    })

    // Top-level additive freshness fields are also captured.
    expect((sidecar as Record<string, unknown>).analysis_freshness).toBe('fresh')
    expect((sidecar as Record<string, unknown>).has_run_analysis_fact).toBe(true)
  })

  it('(7) routeV5Response returns a content target — typed-error path is NOT taken', async () => {
    const result = await parseV5Response(makeResponse(ceeFixture()))
    const target = routeV5Response(result)
    expect(target.kind).not.toBe('typed_error')
    // assistant_text is '' and there is one analysis_result block, so
    // routing classifies as `blocks`.
    expect(target.kind).toBe('blocks')
  })
})

// ── 4–6. Extractor + store-level state-source classification ──────────

describe('extractor + store-level state source', () => {
  it('(4) extractPhase3FromV5Response surfaces the sidecar Phase 3 blocks with raw intact', async () => {
    const result = await parseV5Response(makeResponse(ceeFixture()))
    if (result.kind !== 'response') throw new Error('parse failed')
    const extraction = extractPhase3FromV5Response(result.response)

    expect(extraction.rawBlocks).toHaveLength(2)
    const sources = extraction.rawBlocks.map((b) => b.source)
    expect(sources.every((s) => s === 'sidecar_blocks_array')).toBe(true)
    const types = extraction.rawBlocks.map((b) => b.type).sort()
    expect(types).toEqual(['coaching', 'review_card'])
    // raw blocks are verbatim — verify a discriminating field on each.
    const coaching = extraction.rawBlocks.find((b) => b.type === 'coaching')!
    expect(coaching.raw.action_intent).toBe('gather_evidence')
    const reviewCard = extraction.rawBlocks.find((b) => b.type === 'review_card')!
    expect(reviewCard.raw.card_kind).toBe('narrative')

    // Top-level CEE freshness signal landed in the sidecar too.
    expect(extraction.analysisFreshness).toBe('fresh')
    expect(extraction.hasRunAnalysisFact).toBe(true)
    expect(v5ResponseHasRunAnalysisFact(result.response, extraction)).toBe(true)
  })

  it('(5–6) populates v5AnalysisFact + results.report and reports cee_v5_run_analysis', async () => {
    const result = await parseV5Response(makeResponse(ceeFixture()))
    if (result.kind !== 'response') throw new Error('parse failed')
    const extraction = extractPhase3FromV5Response(result.response)

    // Mirror the production write path in useConversation.ts:2766 — store
    // the fact and the report so the state-source classifier sees both.
    const analysisHash = 'hash-from-analysis-result'
    useCanvasStore.setState({
      results: {
        status: 'complete',
        report: { schema: 'report.v1' } as any,
        hash: analysisHash,
      },
      currentScenarioId: 'scenario-A',
      v5AnalysisFact: {
        scenarioId: 'scenario-A',
        analysisHash,
        hasRunAnalysisFact: extraction.hasRunAnalysisFact,
        freshness: extraction.analysisFreshness,
        freshnessReason: extraction.freshnessReason,
        rawBlocks: extraction.rawBlocks.map((b) => ({
          type: b.type,
          raw: b.raw,
          id: b.id,
          source: b.source,
        })),
        writtenAt: Date.now(),
      } satisfies V5AnalysisFactState,
    } as any)

    // rawBlocks survives the round-trip and carries Phase 3 fields.
    const stored = useCanvasStore.getState().v5AnalysisFact
    expect(stored).not.toBeNull()
    expect(stored!.rawBlocks).toHaveLength(2)
    const storedTypes = stored!.rawBlocks.map((b) => b.type).sort()
    expect(storedTypes).toEqual(['coaching', 'review_card'])

    // (6) classifier returns cee_v5_run_analysis when the fact attaches to
    // the current scenario AND analysisHash matches results.hash.
    const sourceResult = readAnalysisStateSourceFromStore()
    expect(sourceResult.source).toBe('cee_v5_run_analysis')
    expect(sourceResult.hasResultsReport).toBe(true)
    expect(sourceResult.factPresentForScenario).toBe(true)
    expect(sourceResult.showOrphanBanner).toBe(false)
  })

  it('classifier returns "none" before the fact + report land (baseline)', () => {
    // Sanity: confirm the suite isn't accidentally producing the success
    // state in beforeEach. With no fact + idle results, source is 'none'.
    const sourceResult = classifyAnalysisStateSource({
      canonicalFlagOn: true,
      reportPresent: false,
      reportHash: null,
      currentScenarioId: 'scenario-A',
      fact: null,
    })
    expect(sourceResult.source).toBe('none')
  })
})

// ── 8–10. Negative paths + debug bundle ───────────────────────────────

// ── Drift guard — keep LEGACY_SCHEMA_KNOWN_BLOCK_TYPES in sync ─────────

describe('LEGACY_SCHEMA_KNOWN_BLOCK_TYPES drift guard', () => {
  /**
   * The parser hardcodes the legacy block-type whitelist from
   * @talchain/schemas (currently v0.8.1). If the schema package is
   * upgraded — new block types added, existing renamed/removed — the
   * parser's classifier silently misroutes them: new types end up in the
   * `unknown` bucket and hard-fail parse. This drift guard introspects
   * the strict `BlockSchema` discriminated union and asserts the parser
   * mirror stays in sync. When this fires, update
   * LEGACY_SCHEMA_KNOWN_BLOCK_TYPES in src/v5/responseParser.ts.
   */
  it('mirrors every block type declared by the vendored schema', () => {
    // Reach into zod internals — `discriminatedUnion` carries the
    // discriminator values in `_def.optionsMap` as a Map keyed by the
    // literal value. This is stable across zod 3.x; if zod upgrades and
    // breaks this access, the test fails loudly and surfaces the issue.
    const def = (BlockSchema as unknown as { _def: { optionsMap?: Map<string, unknown> } })._def
    expect(def.optionsMap).toBeDefined()
    const declaredTypes = new Set<string>(def.optionsMap!.keys())

    // Mirror imported from the parser via a runtime check rather than
    // re-exporting the private set — we test the actual behaviour by
    // sending one block of each declared type through parseV5Response.
    // Phase 3 whitelist must NOT overlap with the legacy schema set; if
    // a Phase 3 type lands in the schema, the parser still treats it as
    // a tolerated phase3 entry — surface that conflict here.
    for (const phase3Type of PHASE3_TOLERATED_BLOCK_TYPES) {
      expect(declaredTypes.has(phase3Type)).toBe(false)
    }

    // For each declared legacy type, confirm a payload carrying that
    // block (and nothing exotic) parses successfully. If the schema
    // renames or drops a type, our parser's `known` bucket breaks and
    // this assertion fires with a clear failure point.
    const minimalEachType: Record<string, Record<string, unknown>> = {
      text: { type: 'text', content: 'hi' },
      error: {
        type: 'error',
        error_code: 'INTERNAL_ERROR',
        severity: 'error',
      },
      analysis_result: {
        type: 'analysis_result',
        summary: 'ok',
        leading_option_id: 'opt-1',
      },
      graph_patch: {
        type: 'graph_patch',
        status: 'applied',
        operation: 'set_factor_value',
        target_id: 'f1',
        before: null,
        after: { value: 1 },
      },
      explanation: { type: 'explanation', narrative: 'why', referenced_option_ids: ['opt-1'] },
      comparison: {
        type: 'comparison',
        options: [{ option_id: 'opt-1', label: 'Option 1' }],
      },
      flip_analysis: {
        type: 'flip_analysis',
        narrative: 'flip',
        flip_scenarios: [],
      },
      draft_graph: {
        type: 'draft_graph',
        nodes: [],
        edges: [],
        node_count: 0,
        edge_count: 0,
      },
    }
    const missing: string[] = []
    for (const decl of declaredTypes) {
      const minimal = minimalEachType[decl]
      if (!minimal) {
        // A new declared type that we don't have a sample for — this is
        // exactly the drift case the guard catches. Surface it by name.
        missing.push(decl)
        continue
      }
      const parsed = BlockSchema.safeParse(minimal)
      if (!parsed.success) {
        // If our hand-built sample is wrong for a renamed schema, fail
        // with both the offending type and the zod error so the next
        // editor knows exactly what changed.
        throw new Error(
          `drift: block type "${decl}" no longer accepts the canonical minimal sample. ` +
            `Update LEGACY_SCHEMA_KNOWN_BLOCK_TYPES and minimalEachType. zod error: ${parsed.error.message}`,
        )
      }
    }
    if (missing.length > 0) {
      throw new Error(
        `drift: vendored @talchain/schemas declares block type(s) not in the parser mirror: ` +
          `${missing.join(', ')}. Add them to LEGACY_SCHEMA_KNOWN_BLOCK_TYPES in src/v5/responseParser.ts.`,
      )
    }
  })

  /**
   * Stronger drift guard: every declared block type must round-trip
   * through DGAI's `parseV5Response`, not just through zod's
   * `BlockSchema.safeParse`. The parser's `splitBlocksTolerance` keeps a
   * separate hand-mirrored set (`LEGACY_SCHEMA_KNOWN_BLOCK_TYPES`); a
   * type that the vendored schema accepts but the mirror omits would be
   * misrouted into the `unknown` bucket and hard-fail at runtime even
   * though the BlockSchema check above passes. This test fires
   * `parseV5Response` against an OlumiResponse wrapping the minimal
   * block sample for every declared type, asserting `kind === 'response'`
   * on each. Catches mirror omissions.
   */
  it('round-trips every declared block type through parseV5Response', async () => {
    const def = (BlockSchema as unknown as { _def: { optionsMap?: Map<string, unknown> } })._def
    const declaredTypes = [...(def.optionsMap!.keys())]
    const minimalEachType: Record<string, Record<string, unknown>> = {
      text: { type: 'text', content: 'hi' },
      error: { type: 'error', error_code: 'INTERNAL_ERROR', severity: 'error' },
      analysis_result: {
        type: 'analysis_result',
        summary: 'ok',
        leading_option_id: 'opt-1',
      },
      graph_patch: {
        type: 'graph_patch',
        status: 'applied',
        operation: 'set_factor_value',
        target_id: 'f1',
        before: null,
        after: { value: 1 },
      },
      explanation: { type: 'explanation', narrative: 'why', referenced_option_ids: ['opt-1'] },
      comparison: { type: 'comparison', options: [{ option_id: 'opt-1', label: 'Option 1' }] },
      flip_analysis: { type: 'flip_analysis', narrative: 'flip', flip_scenarios: [] },
      draft_graph: {
        type: 'draft_graph',
        nodes: [],
        edges: [],
        node_count: 0,
        edge_count: 0,
      },
    }
    const baseShell = {
      response_version: 2,
      assistant_text: '',
      suggested_actions: [],
      insights: [],
      stage_indicator: 'analyse',
    } as const

    const misrouted: string[] = []
    for (const decl of declaredTypes) {
      const sample = minimalEachType[decl]
      if (!sample) continue // covered by the previous test's `missing` array

      const payload = { ...baseShell, blocks: [sample] }
      const result = await parseV5Response(
        new Response(JSON.stringify(payload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      if (result.kind !== 'response') {
        misrouted.push(
          `${decl} (kind=${result.kind}` +
            (result.kind === 'parse_error'
              ? `, failure_kind=${result.parse_failure_kind ?? 'n/a'}, reason="${result.reason}"`
              : '') +
            ')',
        )
      }
    }
    if (misrouted.length > 0) {
      throw new Error(
        `drift: parseV5Response did not round-trip declared block type(s) — ` +
          `the parser's LEGACY_SCHEMA_KNOWN_BLOCK_TYPES is likely missing them. ` +
          `Offenders: ${misrouted.join('; ')}.`,
      )
    }
  })
})

describe('parser strictness — unknown and malformed blocks', () => {
  it('(8) unknown block type inside blocks[] still fails parse with enumerated types', async () => {
    const fixture = ceeFixture()
    ;(fixture.blocks as unknown[]).push({
      type: 'totally_unknown_future_type',
      payload: { whatever: 1 },
    })
    const result = await parseV5Response(makeResponse(fixture))
    expect(result.kind).toBe('parse_error')
    if (result.kind !== 'parse_error') throw new Error('unreachable')
    expect(result.parse_failure_kind).toBe('unknown_block_types')
    expect(result.unknown_block_types).toEqual(['totally_unknown_future_type'])
    expect(result.reason).toContain('totally_unknown_future_type')
    // Original raw response preserved for diagnostics.
    expect(result.raw).toBeTruthy()
    expect((result.raw as Record<string, unknown>).blocks).toBeTruthy()
  })

  it('(9) malformed-known block still fails parse — nested product schemas remain strict', async () => {
    const fixture = ceeFixture()
    ;(fixture.blocks as unknown[]).push({ type: 'text' /* required `content` missing */ })
    const result = await parseV5Response(makeResponse(fixture))
    expect(result.kind).toBe('parse_error')
    if (result.kind !== 'parse_error') throw new Error('unreachable')
    expect(result.parse_failure_kind).toBe('schema_mismatch')
  })
})

describe('debug bundle — v5_cee_capture populated on parse failure', () => {
  it('(10) parse-error envelope flows into v5_cee_capture with parse_ok=false + enumerated types', async () => {
    // Construct the parse_error envelope exactly as recordResponsePayload
    // would have stored it under bundle.payloads.cee_response when
    // parseV5Response hard-fails on an unknown block type.
    const fixture = ceeFixture()
    ;(fixture.blocks as unknown[]).push({ type: 'totally_unknown_future_type' })
    const parsed = await parseV5Response(makeResponse(fixture))
    expect(parsed.kind).toBe('parse_error')

    // Seed the store so the canonical-analysis classifier has the bits it
    // needs to read alongside the capture.
    useCanvasStore.setState({
      results: { status: 'idle' },
      currentScenarioId: 'scenario-A',
      v5AnalysisFact: null,
    } as any)

    const data = makeDebugData({
      payloads: {
        cee_request: { kind: 'message', message: 'run' },
        // Mirror what v5Adapter's recordResponsePayload writes when parse fails.
        cee_response: parsed as unknown as Record<string, unknown>,
        plot_request: null,
        plot_response: null,
        isl_request: null,
        isl_response: null,
      },
    })

    const bundle = await buildDebugBundleAsync(data)
    expect(bundle.v5_canonical_analysis).toBeDefined()
    const diag = bundle.v5_canonical_analysis!
    expect(diag.v5_cee_capture).not.toBeNull()
    const capture = diag.v5_cee_capture!

    expect(capture.parse_ok).toBe(false)
    expect(capture.response_present).toBe(true)
    expect(capture.raw_response_present).toBe(true)
    expect(capture.parse_failure_kind).toBe('unknown_block_types')
    expect(capture.unknown_block_types).toEqual(['totally_unknown_future_type'])
    expect(capture.parse_error ?? '').toContain('totally_unknown_future_type')
    // Top-level keys read from the raw envelope, not the parse_error wrapper.
    expect(capture.response_top_level_keys).toEqual(
      expect.arrayContaining(['response_version', 'assistant_text', 'blocks']),
    )
    // Classifier maps parse_ok:false to debug_capture_status:'parse_failed'.
    expect(diag.debug_capture_status).toBe('parse_failed')
  })

  it('end-to-end: callV5Turn → trace-store redactor → bundle preserves Phase 3 fields', async () => {
    // P1 regression — the parser stashes Phase 3 blocks on a
    // NON-ENUMERABLE sidecar so they don't leak into JSON.stringify. The
    // trace store's redactor uses Object.keys (skips non-enumerable), so
    // a literal "store the parsed response" would lose the sidecar before
    // the bundle reads it. v5Adapter promotes the sidecar to an
    // enumerable property on a shallow clone for the trace body — this
    // test proves the clone survives the redactor and the bundle still
    // populates phase3_blocks_tolerated_count + phase3_block_types.

    // Clear any prior trace entries from the shared zustand store.
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
    if (result.kind !== 'response') throw new Error('unreachable')

    // Pin the intended split between runtime contract safety and
    // diagnostic exportability:
    //   - The runtime `result.response` keeps the sidecar NON-ENUMERABLE
    //     so JSON.stringify, Object.keys, and ordinary consumers don't
    //     see `__additive__` leaking onto the OlumiResponse surface.
    //   - The trace clone (what v5Adapter records into the trace store)
    //     promotes the sidecar to an ENUMERABLE property so the redactor
    //     (Object.keys-based) preserves it for the debug bundle.
    const runtimeResponse = result.response as Record<string, unknown>
    expect(Object.keys(runtimeResponse)).not.toContain(ADDITIVE_EXTENSIONS_KEY)
    // Bracket access still reaches the non-enumerable sidecar.
    expect(
      (runtimeResponse as Record<string | symbol, unknown>)[ADDITIVE_EXTENSIONS_KEY],
    ).toBeDefined()

    // Reach into the trace store to pull what the bundle assembler will
    // read from in production (post-redaction).
    const traced = usePayloadTraceStore.getState().payloads
    expect(traced).toHaveLength(1)
    const tracedBody = traced[0].response?.body as Record<string, unknown> | undefined
    expect(tracedBody).toBeDefined()

    // Sidecar must be present and ENUMERABLE on the traced body
    // (post-redaction) — the diagnostic split with the runtime object.
    const tracedKeys = Object.keys(tracedBody!)
    expect(tracedKeys).toContain(ADDITIVE_EXTENSIONS_KEY)
    const tracedSidecar = tracedBody![ADDITIVE_EXTENSIONS_KEY] as Record<string, unknown>
    expect(tracedSidecar).toBeDefined()
    expect(Array.isArray(tracedSidecar[PHASE3_SIDECAR_BLOCKS_KEY])).toBe(true)
    const tracedPhase3 = tracedSidecar[PHASE3_SIDECAR_BLOCKS_KEY] as Array<Record<string, unknown>>
    expect(tracedPhase3).toHaveLength(2)
    expect(tracedPhase3.map((b) => b.type).sort()).toEqual(['coaching', 'review_card'])

    // Now drive buildDebugBundleAsync with this real traced body — proves
    // the diagnostic fields populate end-to-end through redaction.
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
        cee_response: tracedBody as Record<string, unknown>,
        plot_request: null,
        plot_response: null,
        isl_request: null,
        isl_response: null,
      },
    })

    const bundle = await buildDebugBundleAsync(data)
    const capture = bundle.v5_canonical_analysis!.v5_cee_capture!
    expect(capture.parse_ok).toBe(true)
    expect(capture.has_additive_extensions).toBe(true)
    expect(capture.phase3_blocks_tolerated_count).toBe(2)
    expect(capture.phase3_block_types).toEqual(['coaching', 'review_card'])
    // Honest semantics on success: the trace stores a parsed clone, NOT
    // the literal wire JSON. response_top_level_keys must still reflect
    // the original CEE root shape (via the parser's sidecar metadata).
    expect(capture.raw_response_present).toBe(false)
    expect(capture.response_top_level_keys).not.toContain('__additive__')
    expect(capture.response_top_level_keys).toEqual(
      expect.arrayContaining([
        'analysis_freshness',
        'has_run_analysis_fact',
        'freshness_reason',
      ]),
    )
  })

  it('parse-success envelope populates v5_cee_capture with phase3 counts', async () => {
    const parsed = await parseV5Response(makeResponse(ceeFixture()))
    expect(parsed.kind).toBe('response')
    if (parsed.kind !== 'response') throw new Error('unreachable')

    // Seed the store with the matching fact + report so the diagnostic
    // shows the successful canonical state.
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
    // Success path stores a parsed clone, not the verbatim wire JSON, so
    // raw_response_present must be honest about that.
    expect(capture.raw_response_present).toBe(false)
    // But response_top_level_keys must STILL reflect the ORIGINAL CEE
    // root shape, sourced from the parser's sidecar metadata. The fixture
    // emits analysis_freshness / has_run_analysis_fact / freshness_reason
    // at the root; the parsed clone demotes them into __additive__, but
    // the original-keys stash preserves the wire view for diagnostics.
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
    // __additive__ must NOT leak into response_top_level_keys.
    expect(capture.response_top_level_keys).not.toContain('__additive__')
    expect(capture.phase3_blocks_tolerated_count).toBe(2)
    expect(capture.phase3_block_types).toEqual(['coaching', 'review_card'])
    expect(diag.debug_capture_status).toBe('complete')
  })
})

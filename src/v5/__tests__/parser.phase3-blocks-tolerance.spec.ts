// @vitest-environment jsdom
/**
 * V5 Phase 3 blocks-array tolerance — parser/extractor/state regressions.
 *
 * Acceptance brief (canonical V5 analysis, 2026-05-18):
 *   The then-vendored @talchain/schemas@0.8.1 did not include the frozen
 *   v1.3 Phase 3 block types `review_card | coaching | evidence | exercise`
 *   in its `blocks[]` discriminated union. CEE emits them inside `blocks[]`
 *   per the contract, which caused strict validation to reject the entire
 *   response, short-circuit applyV5State, and leave the debug bundle's
 *   `v5_cee_capture` null.
 *
 * 0.13.1 re-vendor (2026-07): the schema now DECLARES the Phase 3 types,
 * but the parser's tolerance split below is deliberately unchanged — Phase 3
 * entries are still intercepted into the sidecar before strict validation.
 * Moving them into the validated blocks[] is a separate, deferred decision.
 *
 * The fix splits `blocks[]` into legacy-known / Phase 3 whitelist /
 * truly-unknown buckets before strict validation. Legacy-known entries
 * go through strict zod; Phase 3 entries are preserved verbatim and
 * stashed in the sidecar under `phase3_blocks_from_blocks_array`;
 * truly-unknown entries are tolerated (defensive hardening, 2026-06):
 * dropped from the validated blocks[] and recorded in the `unknown_blocks`
 * sidecar diagnostic instead of failing the whole turn.
 *
 * NOTE: debug-bundle integration assertions live in
 *   src/components/debug/__tests__/v5-cee-capture.phase3-tolerance.spec.ts
 * Pulling buildDebugBundleAsync / DebugData into the v5 typecheck graph used
 * to surface latent type errors in untouched debug modules and break CI, back
 * when tsconfig.ci.json covered only a hand-listed set plus src/v5/. The gate
 * now compiles the whole tree against a frozen baseline, so this split is kept
 * for focus: the v5 spec stays on parser/extractor and runtime store behaviour.
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
  UNKNOWN_BLOCKS_KEY,
  MAX_UNKNOWN_BLOCK_TYPE_LABEL_LENGTH,
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

// ── All four canonical Phase 3 types — accepting exactly these is the
// central contract; the happy-path fixture only exercises two, so this
// test pins coverage for evidence and exercise as well.

describe('parser tolerance — all four canonical Phase 3 types', () => {
  function fourTypesFixture(): Record<string, unknown> {
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
          title: 'Strengthen evidence',
        },
        {
          type: 'evidence',
          block_id: 'ev-1',
          signal_id: 'ev:1',
          factor_ref: 'node-A',
          target_refs: [{ type: 'node', id: 'node-A' }],
        },
        {
          type: 'exercise',
          block_id: 'ex-1',
          signal_id: 'ex:1',
          exercise_kind: 'pre_mortem',
          title: 'Pre-mortem',
        },
      ],
      suggested_actions: [],
      insights: [],
      stage_indicator: 'analyse',
    }
  }

  it('parses successfully and routes every type to the right bucket', async () => {
    const result = await parseV5Response(makeResponse(fourTypesFixture()))
    expect(result.kind).toBe('response')
    if (result.kind !== 'response') throw new Error('unreachable')

    // Legacy-known set in response.blocks; Phase 3 set in sidecar.
    expect(result.response.blocks.map((b) => b.type)).toEqual(['analysis_result'])

    const sidecar = (result.response as Record<string | symbol, unknown>)[
      ADDITIVE_EXTENSIONS_KEY
    ] as Record<string, unknown>
    const phase3 = sidecar[PHASE3_SIDECAR_BLOCKS_KEY] as Array<Record<string, unknown>>
    expect(phase3).toHaveLength(4)
    const sidecarTypes = phase3.map((b) => b.type).sort()
    expect(sidecarTypes).toEqual(['coaching', 'evidence', 'exercise', 'review_card'])

    // Each block's discriminating field survives verbatim.
    expect(phase3.find((b) => b.type === 'review_card')!.card_kind).toBe('narrative')
    expect(phase3.find((b) => b.type === 'coaching')!.coaching_kind).toBe('strengthen')
    expect(phase3.find((b) => b.type === 'evidence')!.factor_ref).toBe('node-A')
    expect(phase3.find((b) => b.type === 'exercise')!.exercise_kind).toBe('pre_mortem')
  })

  it('extractor surfaces all four types with raw intact', async () => {
    const result = await parseV5Response(makeResponse(fourTypesFixture()))
    if (result.kind !== 'response') throw new Error('parse failed')
    const extraction = extractPhase3FromV5Response(result.response)

    expect(extraction.rawBlocks).toHaveLength(4)
    const extractedTypes = extraction.rawBlocks.map((b) => b.type).sort()
    expect(extractedTypes).toEqual(['coaching', 'evidence', 'exercise', 'review_card'])
    // All four come from the blocks-array sidecar source.
    for (const block of extraction.rawBlocks) {
      expect(block.source).toBe('sidecar_blocks_array')
    }
    // Raw payload verbatim — pick a discriminating field from each type.
    expect(extraction.rawBlocks.find((b) => b.type === 'review_card')!.raw.block_id).toBe('rc-1')
    expect(extraction.rawBlocks.find((b) => b.type === 'coaching')!.raw.block_id).toBe('co-1')
    expect(extraction.rawBlocks.find((b) => b.type === 'evidence')!.raw.block_id).toBe('ev-1')
    expect(extraction.rawBlocks.find((b) => b.type === 'exercise')!.raw.block_id).toBe('ex-1')
  })

  it('callV5Turn carries all four types through to the trace clone sidecar', async () => {
    usePayloadTraceStore.setState({ payloads: [], selectedId: null } as any)
    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify(fourTypesFixture()), {
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
    const tracedSidecar = tracedBody[ADDITIVE_EXTENSIONS_KEY] as Record<string, unknown>
    const tracedPhase3 = tracedSidecar[PHASE3_SIDECAR_BLOCKS_KEY] as Array<Record<string, unknown>>
    expect(tracedPhase3.map((b) => b.type).sort()).toEqual([
      'coaching',
      'evidence',
      'exercise',
      'review_card',
    ])
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

// ── Runtime sidecar non-enumerable contract ────────────────────────────

describe('callV5Turn runtime/traced sidecar split', () => {
  it('runtime response keeps sidecar non-enumerable; traced clone is enumerable', async () => {
    usePayloadTraceStore.setState({ payloads: [], selectedId: null } as any)
    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify(ceeFixture()), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })

    const result = await callV5Turn(
      { kind: 'message', message: 'run analysis' } as never,
      { fetchImpl },
    )
    expect(result.kind).toBe('response')
    if (result.kind !== 'response') throw new Error('unreachable')

    // Runtime contract: JSON.stringify and ordinary Object.keys consumers
    // do NOT see `__additive__` on the OlumiResponse surface.
    const runtimeResponse = result.response as Record<string, unknown>
    expect(Object.keys(runtimeResponse)).not.toContain(ADDITIVE_EXTENSIONS_KEY)
    expect(
      (runtimeResponse as Record<string | symbol, unknown>)[ADDITIVE_EXTENSIONS_KEY],
    ).toBeDefined()
    // JSON.stringify is the canonical wire-serialisation path consumers
    // hit (egress validation logs, prompt-cache fingerprints, network
    // re-emit). The non-enumerable sidecar MUST NOT leak through it.
    const stringified = JSON.stringify(result.response)
    expect(stringified).not.toContain(ADDITIVE_EXTENSIONS_KEY)
    expect(stringified).not.toContain('phase3_blocks_from_blocks_array')
    expect(stringified).not.toContain('__original_top_level_keys__')

    // Trace clone: sidecar is ENUMERABLE so the trace store's
    // Object.keys-based redactor preserves it for the debug bundle.
    const traced = usePayloadTraceStore.getState().payloads
    expect(traced).toHaveLength(1)
    const tracedBody = traced[0].response?.body as Record<string, unknown>
    expect(Object.keys(tracedBody)).toContain(ADDITIVE_EXTENSIONS_KEY)
  })
})

// ── Drift guard — keep LEGACY_SCHEMA_KNOWN_BLOCK_TYPES in sync ─────────

describe('LEGACY_SCHEMA_KNOWN_BLOCK_TYPES drift guard', () => {
  /**
   * The parser hardcodes the legacy block-type whitelist from
   * @talchain/schemas (currently v0.13.1). If the schema package is
   * upgraded — new block types added, existing renamed/removed — the
   * parser's classifier silently misroutes them: new types fall into the
   * `unknown` bucket and (since the 2026-06 tolerance change) are dropped
   * into the `unknown_blocks` sidecar rather than rendered. This drift
   * guard introspects
   * the strict `BlockSchema` discriminated union and asserts the parser
   * mirror stays in sync. When this fires, update
   * LEGACY_SCHEMA_KNOWN_BLOCK_TYPES in src/v5/responseParser.ts.
   *
   * 0.13.1 re-vendor note: BlockSchema is now the discriminated union
   * wrapped in `.superRefine(...)` (evidence §1.3 rule), i.e. a ZodEffects —
   * the union def lives one level down at `_def.schema`. And the Phase 3
   * types (review_card / coaching / evidence / exercise) are now DECLARED
   * by the schema, while the parser deliberately keeps intercepting them
   * into the phase3 sidecar BEFORE strict validation (tolerance layer
   * unchanged — Phase-3 adoption into validated blocks[] is a deferred,
   * separate decision). The guard therefore asserts the tolerated set is a
   * subset of the declared union (rename/removal drift still fires) and
   * exempts those types from the legacy-mirror check.
   */
  it('mirrors every block type declared by the vendored schema', () => {
    const rawDef = (
      BlockSchema as unknown as {
        _def: { optionsMap?: Map<string, unknown>; schema?: { _def: { optionsMap?: Map<string, unknown> } } }
      }
    )._def
    const def = rawDef.schema?._def ?? rawDef
    expect(def.optionsMap).toBeDefined()
    const declaredTypes = new Set<string>(def.optionsMap!.keys())

    // 0.13.0+: every parser-tolerated Phase 3 type must be declared by the
    // vendored schema. If the schema renames or drops one, the parser's
    // sidecar whitelist is stale — surface that drift here.
    for (const phase3Type of PHASE3_TOLERATED_BLOCK_TYPES) {
      expect(declaredTypes.has(phase3Type)).toBe(true)
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
      // 0.15.0 wave: schema-known, renderer-deferred (degrade to
      // v5_unsupported until R8/R4 land).
      held_proposal: {
        type: 'held_proposal',
        proposal_id: 'p1',
        summary: 'Held: structural change awaiting confirmation',
        mutation_class: 'structural',
        reason_code: 'STRUCTURAL_APPLY_HELD',
        confirm_action_id: 'a1',
      },
      ui_directive: {
        type: 'ui_directive',
        verb: 'highlight',
        targets: [{ id: 'n1', label: 'Factor', kind: 'factor' }],
      },
    }
    const missing: string[] = []
    for (const decl of declaredTypes) {
      // Phase 3 types are intercepted into the sidecar BEFORE strict
      // validation, so the legacy mirror deliberately excludes them.
      if ((PHASE3_TOLERATED_BLOCK_TYPES as ReadonlySet<string>).has(decl)) continue
      const minimal = minimalEachType[decl]
      if (!minimal) {
        missing.push(decl)
        continue
      }
      const parsed = BlockSchema.safeParse(minimal)
      if (!parsed.success) {
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
   * through DGAI's `parseV5Response` INTO THE VALIDATED `blocks[]`, not
   * just parse successfully. The parser's `splitBlocksTolerance` keeps a
   * separate hand-mirrored set (`LEGACY_SCHEMA_KNOWN_BLOCK_TYPES`); a type
   * the vendored schema accepts but the mirror omits would — since the
   * defensive-hardening change (2026-06) — be silently DROPPED into the
   * `unknown_blocks` sidecar instead of hard-failing. So `kind ===
   * 'response'` alone is no longer sufficient proof of recognition; we
   * assert the block actually survives into `response.blocks`.
   */
  it('round-trips every declared block type into validated blocks[] (not dropped as unknown)', async () => {
    // 0.13.1: unwrap the union-level `.superRefine` wrapper (see above).
    const rawDef = (
      BlockSchema as unknown as {
        _def: { optionsMap?: Map<string, unknown>; schema?: { _def: { optionsMap?: Map<string, unknown> } } }
      }
    )._def
    const def = rawDef.schema?._def ?? rawDef
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
      // 0.15.0 wave: schema-known, renderer-deferred (degrade to
      // v5_unsupported until R8/R4 land).
      held_proposal: {
        type: 'held_proposal',
        proposal_id: 'p1',
        summary: 'Held: structural change awaiting confirmation',
        mutation_class: 'structural',
        reason_code: 'STRUCTURAL_APPLY_HELD',
        confirm_action_id: 'a1',
      },
      ui_directive: {
        type: 'ui_directive',
        verb: 'highlight',
        targets: [{ id: 'n1', label: 'Factor', kind: 'factor' }],
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
      if (!sample) continue

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
        continue
      }
      // Tolerance-era strengthening: parsing successfully is no longer
      // sufficient. A declared type missing from
      // LEGACY_SCHEMA_KNOWN_BLOCK_TYPES would now be silently DROPPED into
      // the unknown_blocks sidecar rather than hard-failing — so assert the
      // block actually survived into the validated blocks[].
      const survived = result.response.blocks.some(
        (b) => (b as { type?: unknown }).type === decl,
      )
      if (!survived) {
        const sidecar = (result.response as Record<string | symbol, unknown>)[
          ADDITIVE_EXTENSIONS_KEY
        ] as Record<string, unknown> | undefined
        const dropped =
          (sidecar?.[UNKNOWN_BLOCKS_KEY] as { types?: string[] } | undefined)?.types ?? []
        misrouted.push(
          `${decl} (parsed but DROPPED → unknown_blocks: ${JSON.stringify(dropped)})`,
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

// ── Defensive tolerance — unknown blocks (2026-06) + malformed-known ───
//
// Unknown `blocks[]` types are NO LONGER fatal: they are dropped from the
// validated blocks[], the rest of the response still parses, and a
// privacy-safe { types, count, by_type } diagnostic lands in the
// `unknown_blocks` sidecar. A malformed KNOWN block still hard-fails.

describe('parser tolerance — unknown blocks (defensive hardening)', () => {
  type UnknownSidecar = { types: string[]; count: number; by_type: Record<string, number> }
  const readUnknown = (result: Awaited<ReturnType<typeof parseV5Response>>): UnknownSidecar => {
    if (result.kind !== 'response') throw new Error('expected a parsed response')
    const sidecar = (result.response as Record<string | symbol, unknown>)[ADDITIVE_EXTENSIONS_KEY] as
      | Record<string, unknown>
      | undefined
    return sidecar?.[UNKNOWN_BLOCKS_KEY] as UnknownSidecar
  }

  it('(3,4) an unknown block type is tolerated: response parses, known blocks survive, unknown is dropped + recorded in the sidecar', async () => {
    const fixture = ceeFixture()
    ;(fixture.blocks as unknown[]).push({
      type: 'totally_unknown_future_type',
      payload: { whatever: 1 },
    })
    const result = await parseV5Response(makeResponse(fixture))
    expect(result.kind).toBe('response')
    if (result.kind !== 'response') throw new Error('unreachable')

    // Known block survives; unknown is NOT in the validated blocks[].
    expect(result.response.blocks).toHaveLength(1)
    expect(result.response.blocks[0].type).toBe('analysis_result')
    expect(result.response.blocks.map((b) => b.type)).not.toContain(
      'totally_unknown_future_type',
    )

    // (5,6) Observable diagnostic — type + count, deduped.
    const unknown = readUnknown(result)
    expect(unknown).toBeDefined()
    expect(unknown.types).toEqual(['totally_unknown_future_type'])
    expect(unknown.count).toBe(1)
    expect(unknown.by_type).toEqual({ totally_unknown_future_type: 1 })

    // (7) NO raw payload / user content leaks into the diagnostic.
    expect(JSON.stringify(unknown)).not.toContain('whatever')
  })

  it('(8,9) routeV5Response renders the known content — NOT a typed error — when an unknown block is present', async () => {
    const fixture = ceeFixture()
    ;(fixture.blocks as unknown[]).push({ type: 'totally_unknown_future_type', a: 1 })
    const result = await parseV5Response(makeResponse(fixture))
    const target = routeV5Response(result)
    expect(target.kind).not.toBe('typed_error')
    expect(target.kind).toBe('blocks')
  })

  it('(10) multiple unknown blocks: types deduped + sorted; count reflects EVERY dropped entry', async () => {
    const fixture = ceeFixture()
    ;(fixture.blocks as unknown[]).push(
      { type: 'totally_unknown_future_type', a: 1 },
      { type: 'totally_unknown_future_type', a: 2 },
      { type: 'another_unknown_type', b: 3 },
    )
    const result = await parseV5Response(makeResponse(fixture))
    expect(result.kind).toBe('response')
    if (result.kind !== 'response') throw new Error('unreachable')
    const unknown = readUnknown(result)
    expect(unknown.types).toEqual(['another_unknown_type', 'totally_unknown_future_type'])
    expect(unknown.count).toBe(3)
    expect(unknown.by_type).toEqual({
      totally_unknown_future_type: 2,
      another_unknown_type: 1,
    })
    // Known block still survives alongside the dropped unknowns.
    expect(result.response.blocks).toHaveLength(1)
  })

  it('(11) array / missing-type entries are tolerated (classified `array` / `<missing-type>`), not fatal', async () => {
    const fixture = ceeFixture()
    ;(fixture.blocks as unknown[]).push(['not', 'a', 'block'], { no: 'type' })
    const result = await parseV5Response(makeResponse(fixture))
    expect(result.kind).toBe('response')
    if (result.kind !== 'response') throw new Error('unreachable')
    const unknown = readUnknown(result)
    expect(unknown.types).toContain('array')
    expect(unknown.types).toContain('<missing-type>')
    expect(unknown.types).not.toContain('object')
    expect(unknown.count).toBe(2)
  })

  it('a response whose ONLY block is unknown still parses (empty validated blocks[]) and routes to text', async () => {
    const result = await parseV5Response(
      makeResponse({
        response_version: 2,
        assistant_text: 'Here is some prose.',
        blocks: [{ type: 'totally_unknown_future_type', a: 1 }],
        suggested_actions: [],
        insights: [],
        stage_indicator: 'analyse',
      }),
    )
    expect(result.kind).toBe('response')
    if (result.kind !== 'response') throw new Error('unreachable')
    expect(result.response.blocks).toHaveLength(0)
    expect(readUnknown(result).count).toBe(1)
    expect(routeV5Response(result).kind).toBe('text_only')
  })

  it('(13) FactBlock is NOT a supported V5 blocks[] type — a `fact` block is tolerated-and-dropped, never promoted to a known block', async () => {
    const fixture = ceeFixture()
    ;(fixture.blocks as unknown[]).push({ type: 'fact', label: 'ROI', value: '42%' })
    const result = await parseV5Response(makeResponse(fixture))
    expect(result.kind).toBe('response')
    if (result.kind !== 'response') throw new Error('unreachable')
    // fact is dropped from validated blocks[] (not rendered as a known block).
    // (Cast to string: the strict OlumiResponse block union legitimately has
    // no 'fact' member — proving at runtime that the parser dropped it.)
    expect(result.response.blocks.map((b) => b.type as string)).not.toContain('fact')
    const unknown = readUnknown(result)
    expect(unknown.types).toContain('fact')
    // The block value is NOT leaked into the diagnostic.
    expect(JSON.stringify(unknown)).not.toContain('42%')
  })

  it('bounds a pathologically long unknown type label (defensive privacy cap)', async () => {
    const longType = 'x'.repeat(500)
    const fixture = ceeFixture()
    ;(fixture.blocks as unknown[]).push({ type: longType, payload: { whatever: 1 } })
    const result = await parseV5Response(makeResponse(fixture))
    expect(result.kind).toBe('response')
    if (result.kind !== 'response') throw new Error('unreachable')
    const unknown = readUnknown(result)
    expect(unknown.count).toBe(1)
    // The 500-char discriminator is NOT preserved verbatim — it is bounded so
    // a buggy/user-content-like type can't dump unbounded content into the
    // diagnostic (which flows to the debug bundle).
    expect(unknown.types[0]).not.toBe(longType)
    expect(unknown.types[0]).toContain('[truncated]')
    expect(unknown.types[0].length).toBeLessThanOrEqual(
      MAX_UNKNOWN_BLOCK_TYPE_LABEL_LENGTH + '...[truncated]'.length,
    )
    expect(JSON.stringify(unknown)).not.toContain(longType)
  })

  it('(12) a malformed KNOWN block still hard-fails — nested product schemas remain strict', async () => {
    const fixture = ceeFixture()
    ;(fixture.blocks as unknown[]).push({ type: 'text' /* required `content` missing */ })
    const result = await parseV5Response(makeResponse(fixture))
    expect(result.kind).toBe('parse_error')
    if (result.kind !== 'parse_error') throw new Error('unreachable')
    expect(result.parse_failure_kind).toBe('schema_mismatch')
  })
})

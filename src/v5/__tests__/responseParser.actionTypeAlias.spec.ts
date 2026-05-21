/**
 * V5 parser — `suggested_actions[].action_type` alias normalisation.
 *
 * Live CEE staging response (debug bundle b82c89dd, 2026-05-21) carried
 * `suggested_actions[0].action_type = "explain_results"` (plural). The
 * vendored @talchain/schemas@0.8.1 `ActionType` enum only accepts the
 * singular `"explain_result"`, so strict validation rejected the entire
 * response with `parse_failure_kind: 'schema_mismatch'`, even though the
 * backend pipeline (CEE→PLoT→decision_review) completed successfully.
 *
 * The parser now rewrites known runtime aliases (only the
 * explain_results → explain_result entry today) pre-validation, mirroring
 * the existing ACTION_TO_TURN_TYPE alias map in useConversation.ts. The
 * rewrite is lossless: both forms route to the same backend handler.
 *
 * This spec exercises the trimmed live fixture end-to-end and locks down
 * the eleven brief assertions:
 *   1.  Trimmed fixture parses to kind:'response' (no longer parse_error)
 *   2.  analysis_result block preserved with summary / leading_option_id /
 *       win_probabilities intact
 *   3.  analysis_ready.status === 'ready' + passthrough keys preserved
 *   4.  Phase 3 sidecar carries all 10 review_card+coaching blocks
 *   5.  A Phase 3 coaching block does not break parsing (verified by 1+4)
 *   6.  suggested_actions[0].action_type normalised to 'explain_result';
 *       suggested_actions[1].action_type unchanged ('what_would_flip')
 *   7.  Sidecar `action_type_aliases_applied` records the rewrite
 *   8.  An unknown action_type (not in allowlist) still fails strict
 *       validation — strictness preserved
 *   9.  extractPhase3FromV5Response recovers ≥1 review_card rawBlock
 *   10. composePhase3BridgedBlocks (PR #175 bridge) appends review_card
 *       after v5_analysis_result once parse succeeds
 *   11. Diagnostics regression: phase3 raw block count remains 10
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  parseV5Response,
  ADDITIVE_EXTENSIONS_KEY,
  PHASE3_SIDECAR_BLOCKS_KEY,
  ACTION_TYPE_ALIASES_APPLIED_KEY,
  type ActionTypeAliasRewrite,
} from '../responseParser'
import { extractPhase3FromV5Response } from '../extractPhase3FromV5Response'

// NOTE: end-to-end bridge wiring assertions (10a + 10b in the brief) live
// in `src/canvas/conversation/__tests__/phase3ReviewCardBridge.liveFixture.spec.ts`.
// Importing `composePhase3BridgedBlocks` from useConversation.ts here would
// drag the entire conversation/adapter graph into the tsconfig.ci.json
// typecheck scope (which is intentionally scoped to src/v5/**), surfacing
// pre-existing type errors in unrelated files. Keeping this spec parser-
// focused preserves the CI scope.

// ─── Fixture loader ─────────────────────────────────────────────────────

const FIXTURE_PATH = resolve(
  __dirname,
  'fixtures/cee-response-b82c89dd-trimmed.json',
)

function loadFixture(): Record<string, unknown> {
  return JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as Record<string, unknown>
}

function makeResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// ─── (1) The live debug-bundle response now parses ──────────────────────

describe('parseV5Response — action_type alias normalisation', () => {
  it('(1) trimmed live fixture parses to kind:"response" instead of parse_error', async () => {
    const fixture = loadFixture()
    const result = await parseV5Response(makeResponse(fixture))
    expect(result.kind).toBe('response')
  })

  it('(2) analysis_result block is preserved with summary, leading_option_id, win_probabilities', async () => {
    const result = await parseV5Response(makeResponse(loadFixture()))
    if (result.kind !== 'response') throw new Error('expected response')
    const analysisBlock = result.response.blocks.find((b) => b.type === 'analysis_result')
    expect(analysisBlock).toBeDefined()
    expect(analysisBlock?.type).toBe('analysis_result')
    if (analysisBlock?.type !== 'analysis_result') return
    expect(analysisBlock.summary).toBe('Ran analysis on your current scenario.')
    expect(analysisBlock.leading_option_id).toBe('opt_tech_lead')
    expect(analysisBlock.win_probabilities?.['Hire One Tech Lead']).toBeCloseTo(0.94325, 5)
  })

  it('(3) analysis_ready.status === "ready" plus passthrough keys preserved', async () => {
    const result = await parseV5Response(makeResponse(loadFixture()))
    if (result.kind !== 'response') throw new Error('expected response')
    const ar = result.response.analysis_ready
    expect(ar).toBeDefined()
    expect(ar?.status).toBe('ready')
    expect((ar as Record<string, unknown>)?.freshness).toBe('fresh')
    expect((ar as Record<string, unknown>)?.goal_node_id).toBe('goal_productivity')
  })

  it('(4) Phase 3 sidecar carries all 10 review_card + coaching blocks verbatim', async () => {
    const result = await parseV5Response(makeResponse(loadFixture()))
    if (result.kind !== 'response') throw new Error('expected response')
    const sidecar = (result.response as { [ADDITIVE_EXTENSIONS_KEY]?: Record<string, unknown> })[
      ADDITIVE_EXTENSIONS_KEY
    ]
    expect(sidecar).toBeDefined()
    const phase3 = sidecar?.[PHASE3_SIDECAR_BLOCKS_KEY] as unknown[]
    expect(Array.isArray(phase3)).toBe(true)
    expect(phase3.length).toBe(10)
    const types = phase3.map((b) => (b as { type: string }).type)
    expect(types.filter((t) => t === 'review_card')).toHaveLength(4)
    expect(types.filter((t) => t === 'coaching')).toHaveLength(6)
  })

  it('(5) a coaching block does NOT break parsing (covered by 1+4; explicit check on a coaching entry)', async () => {
    const result = await parseV5Response(makeResponse(loadFixture()))
    if (result.kind !== 'response') throw new Error('expected response')
    const sidecar = (result.response as { [ADDITIVE_EXTENSIONS_KEY]?: Record<string, unknown> })[
      ADDITIVE_EXTENSIONS_KEY
    ]
    const phase3 = sidecar?.[PHASE3_SIDECAR_BLOCKS_KEY] as Array<Record<string, unknown>>
    const aCoaching = phase3.find((b) => b.type === 'coaching')
    expect(aCoaching).toBeDefined()
    // Verbatim preservation — fields the bridge / extractor read are intact
    expect(typeof aCoaching?.block_id).toBe('string')
    expect(typeof aCoaching?.coaching_kind).toBe('string')
  })

  it('(6) suggested_actions[0].action_type is normalised to "explain_result"; [1] unchanged', async () => {
    const result = await parseV5Response(makeResponse(loadFixture()))
    if (result.kind !== 'response') throw new Error('expected response')
    const sa = result.response.suggested_actions
    expect(sa.length).toBe(2)
    expect(sa[0].action_type).toBe('explain_result')
    expect(sa[0].id).toBe('chip_action_explain_results') // id preserved unchanged
    expect(sa[1].action_type).toBe('what_would_flip')
  })

  it('(7) sidecar records action_type_aliases_applied with from/to/index', async () => {
    const result = await parseV5Response(makeResponse(loadFixture()))
    if (result.kind !== 'response') throw new Error('expected response')
    const sidecar = (result.response as { [ADDITIVE_EXTENSIONS_KEY]?: Record<string, unknown> })[
      ADDITIVE_EXTENSIONS_KEY
    ]
    expect(sidecar).toBeDefined()
    const rewrites = sidecar?.[ACTION_TYPE_ALIASES_APPLIED_KEY] as ActionTypeAliasRewrite[]
    expect(rewrites).toBeDefined()
    expect(rewrites).toHaveLength(1)
    expect(rewrites[0]).toEqual({
      index: 0,
      from: 'explain_results',
      to: 'explain_result',
    })
  })

  it('(8) strictness preserved: unknown action_type (not in allowlist) still fails schema validation', async () => {
    const fixture = loadFixture()
    // Inject a typo'd value not in either the schema enum or the alias allowlist.
    const broken = {
      ...fixture,
      suggested_actions: [
        {
          id: 'chip_typo',
          label: 'Typo',
          message: 'typo',
          action_type: 'explan_result', // missing 'i' — invented, must fail
        },
      ],
    }
    const result = await parseV5Response(makeResponse(broken))
    expect(result.kind).toBe('parse_error')
    if (result.kind === 'parse_error') {
      expect(result.parse_failure_kind).toBe('schema_mismatch')
    }
  })

  it('(9) extractPhase3FromV5Response recovers all 4 review_card raw blocks with non-empty title and body', async () => {
    const result = await parseV5Response(makeResponse(loadFixture()))
    if (result.kind !== 'response') throw new Error('expected response')
    const phase3 = extractPhase3FromV5Response(result.response)
    const reviewCards = phase3.rawBlocks.filter((b) => b.type === 'review_card')
    expect(reviewCards).toHaveLength(4)
    // Every review_card in the live response carries real body content
    // (the v1.3 emit shape uses `body`, not `summary`/`description`).
    // The bridge adapter resolves body via the `description ?? body ?? summary`
    // precedence, so `body` is selected here.
    for (const rc of reviewCards) {
      expect(typeof rc.raw.title).toBe('string')
      expect((rc.raw.title as string).length).toBeGreaterThan(0)
      expect(typeof rc.raw.body).toBe('string')
      expect((rc.raw.body as string).length).toBeGreaterThan(0)
    }
    // Verbatim preservation spot-check on the highest-priority entry
    // (lowest priority_rank = highest priority).
    const sorted = [...reviewCards].sort(
      (a, b) => (a.raw.priority_rank as number) - (b.raw.priority_rank as number),
    )
    expect(sorted[0].raw.priority_rank).toBe(71)
    expect(sorted[0].raw.body).toBe(
      'The relationship between Technical Leadership Capacity and overall throughput remains stable.',
    )
  })

  // (10a, 10b) bridge wiring assertions are in
  // src/canvas/conversation/__tests__/phase3ReviewCardBridge.liveFixture.spec.ts
  // — see NOTE in the imports block at the top of this file for why.

  it('(11) regression: phase3 raw block count remains 10 (alias fix does not affect Phase 3 tolerance)', async () => {
    const result = await parseV5Response(makeResponse(loadFixture()))
    if (result.kind !== 'response') throw new Error('expected response')
    const phase3 = extractPhase3FromV5Response(result.response)
    expect(phase3.rawBlocks).toHaveLength(10)
  })
})

// ─── Negative: clean response without aliases → no sidecar rewrites ─────

describe('parseV5Response — no rewrites when no aliases present', () => {
  it('does not emit action_type_aliases_applied when all action_types are canonical', async () => {
    const fixture = loadFixture()
    // Replace the plural with the canonical singular and re-parse.
    const canonical = {
      ...fixture,
      suggested_actions: (fixture.suggested_actions as Array<Record<string, unknown>>).map(
        (a, i) => (i === 0 ? { ...a, action_type: 'explain_result' } : a),
      ),
    }
    const result = await parseV5Response(makeResponse(canonical))
    if (result.kind !== 'response') throw new Error('expected response')
    const sidecar = (result.response as { [ADDITIVE_EXTENSIONS_KEY]?: Record<string, unknown> })[
      ADDITIVE_EXTENSIONS_KEY
    ]
    // Sidecar exists because Phase 3 blocks are still tolerated, but the
    // alias-applied key must be absent when no rewrites occurred.
    expect(sidecar?.[ACTION_TYPE_ALIASES_APPLIED_KEY]).toBeUndefined()
  })
})

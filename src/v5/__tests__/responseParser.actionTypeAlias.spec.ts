/**
 * V5 parser — `suggested_actions[].action_type` alias mechanism.
 *
 * HISTORY: under @talchain/schemas@0.8.1 the enum only accepted the singular
 * `explain_result`, so a live CEE response carrying the plural (debug bundle
 * b82c89dd, 2026-05-21) failed strict validation and the parser gained a
 * plural→singular rewrite. Under schemas 0.15 the enum accepts BOTH forms,
 * the plural is the backend's native handler ID, and the rewrite actively
 * HID the "Explain the result" chip from the plural-keyed V5 filter
 * (V-P0-2, wire-verified live 2026-07-13). The alias table is now EMPTY —
 * these tests pin the passthrough plus the retained mechanism contracts
 * (strictness for truly-unknown values; no input mutation). The composed
 * parser→filter seam is pinned in explainChips.vocabulary.spec.ts.
 *
 * Assertions over the trimmed live fixture:
 *   1.  Trimmed fixture parses to kind:'response' (plural is schema-valid)
 *   2.  analysis_result block preserved with summary / leading_option_id /
 *       win_probabilities intact
 *   3.  analysis_ready.status === 'ready' + passthrough keys preserved
 *   4.  Phase 3 sidecar carries all 10 review_card+coaching blocks
 *   5.  A Phase 3 coaching block does not break parsing (verified by 1+4)
 *   6.  suggested_actions[0].action_type PASSES THROUGH as the plural
 *       (pin flip); suggested_actions[1] unchanged ('what_would_flip')
 *   7.  No `action_type_aliases_applied` sidecar entry (pin flip)
 *   8.  An unknown action_type (not in the schema enum) still fails strict
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
} from '../responseParser'
import { extractPhase3FromV5Response } from '../extractPhase3FromV5Response'

// NOTE: end-to-end bridge wiring assertions (10a + 10b in the brief) live
// in `src/canvas/conversation/__tests__/phase3ReviewCardBridge.liveFixture.spec.ts`.
// Importing `composePhase3BridgedBlocks` from useConversation.ts here used to
// drag the conversation/adapter graph into the narrow tsconfig.ci.json scope
// and surface unrelated pre-existing errors. That gate is gone — the whole tree
// is typechecked and those errors are frozen in
// scripts/ci/typecheck-baseline.txt — so this split is now for focus, not CI.

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

  it('(6) DELIBERATE PIN FLIP (V-P0-2): suggested_actions[0] keeps the schema-valid PLURAL; [1] unchanged', async () => {
    // Under schemas 0.8.1 the plural failed validation and had to be
    // rewritten to the singular. The 0.15 enum accepts both forms and the
    // plural is the backend's native handler ID — the rewrite hid the chip
    // from the plural-keyed V5 filter (live evidence 2026-07-13). The alias
    // table is now empty; the plural must pass through untouched.
    const result = await parseV5Response(makeResponse(loadFixture()))
    if (result.kind !== 'response') throw new Error('expected response')
    const sa = result.response.suggested_actions
    expect(sa.length).toBe(2)
    expect(sa[0].action_type).toBe('explain_results')
    expect(sa[0].id).toBe('chip_action_explain_results') // id preserved unchanged
    expect(sa[1].action_type).toBe('what_would_flip')
  })

  it('(7) DELIBERATE PIN FLIP (V-P0-2): no alias rewrites are recorded — the table is empty under schemas 0.15', async () => {
    const result = await parseV5Response(makeResponse(loadFixture()))
    if (result.kind !== 'response') throw new Error('expected response')
    const sidecar = (result.response as { [ADDITIVE_EXTENSIONS_KEY]?: Record<string, unknown> })[
      ADDITIVE_EXTENSIONS_KEY
    ]
    // Sidecar may exist for Phase 3 blocks, but the alias-applied key must
    // be absent when no rewrite occurred.
    expect(sidecar?.[ACTION_TYPE_ALIASES_APPLIED_KEY]).toBeUndefined()
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

// ─── Contract: parser does NOT mutate the raw input ─────────────────────

describe('parseV5Response — raw input is never mutated', () => {
  it('the original input object is untouched by parsing (debug-bundle fidelity contract)', async () => {
    // The alias table is empty under schemas 0.15 so no rewrite occurs, but
    // the no-input-mutation contract still guards the mechanism: if a future
    // genuine-drift entry is added, the parser must clone before rewriting,
    // never reach back into the caller's reference.
    const fixture = loadFixture() as {
      suggested_actions: Array<Record<string, unknown>>
    }
    expect(fixture.suggested_actions[0].action_type).toBe('explain_results')

    const result = await parseV5Response(makeResponse(fixture))
    expect(result.kind).toBe('response')
    if (result.kind !== 'response') return

    // Passthrough: the parsed surface carries the producer's value as-is.
    expect(result.response.suggested_actions[0].action_type).toBe('explain_results')
    expect(fixture.suggested_actions[0].action_type).toBe('explain_results')
  })
})

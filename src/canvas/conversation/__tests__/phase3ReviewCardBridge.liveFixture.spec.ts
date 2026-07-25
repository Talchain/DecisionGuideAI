/**
 * Phase 3 bridge — end-to-end wiring against the live CEE staging fixture
 * (debug bundle b82c89dd).
 *
 * Complements `phase3ReviewCardBridge.spec.ts` (unit tests on the composition
 * function; legacy-shape fallback contract) and
 * `src/v5/__tests__/responseParser.actionTypeAlias.spec.ts` (parser-side
 * assertions). This spec proves the parse→extract→bridge chain works
 * end-to-end on the trimmed live fixture.
 *
 * UPDATED for Track C slice 1 (Lane UI-R3, approved D-5): the fixture's
 * review_card and coaching blocks are REAL 0.13.x-shaped payloads, so they
 * now render through the TYPED path (v5_review_card / v5_coaching — all
 * copy producer-verbatim) instead of the superseded legacy top-1 bridge.
 * The pre-slice-1 expectations ("exactly one legacy review_card"; "coaching
 * never surfaces") are superseded by this approved feature; the legacy
 * fallback contract remains locked by phase3ReviewCardBridge.spec.ts, whose
 * fixtures are genuinely legacy-shaped.
 *
 * Lives in `src/canvas/conversation/__tests__/` rather than in `src/v5/__tests__/`
 * deliberately, though the original reason is now historical: importing
 * `useConversation.ts` (where the bridge composition function lives) from
 * within `src/v5/**` used to drag the conversation graph into the narrow
 * tsconfig.ci.json scope and surface unrelated pre-existing errors. The gate
 * now compiles everything, with those errors frozen in
 * scripts/ci/typecheck-baseline.txt, so placement no longer affects CI.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { parseV5Response } from '../../../v5/responseParser'
import { extractPhase3FromV5Response } from '../../../v5/extractPhase3FromV5Response'
import {
  composePhase3BridgedBlocks,
  adaptPhase3ReviewCard,
} from '../useConversation'
import type { ConversationBlock, V5CoachingBlock, V5ReviewCardBlock } from '../types'

const FIXTURE_PATH = resolve(
  __dirname,
  '../../../v5/__tests__/fixtures/cee-response-b82c89dd-trimmed.json',
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

const V5_ANALYSIS_RESULT_BLOCK: ConversationBlock = {
  type: 'v5_analysis_result',
  summary: 'Ran analysis on your current scenario.',
  leading_option_id: 'opt_tech_lead',
  win_probabilities: { 'Hire One Tech Lead': 0.94325 },
}

describe('Track C slice 1 — live fixture (cee-response-b82c89dd), typed Phase 3 rendering', () => {
  it('parse → extract → bridge renders ALL 0.13.x review_card + coaching blocks as typed blocks, mapped blocks first', async () => {
    // Full live chain. The live response carries 4 review_card top-level
    // blocks (priority_rank 71-74) and 6 coaching blocks (priority_rank
    // 101-202), all 0.13.x-shaped with non-empty producer copy. Slice 1
    // renders every schema-valid block; ordering is producer-owned
    // (priority_rank ascending).
    const result = await parseV5Response(makeResponse(loadFixture()))
    expect(result.kind).toBe('response')
    if (result.kind !== 'response') return

    const phase3 = extractPhase3FromV5Response(result.response)
    expect(phase3.rawBlocks.filter((b) => b.type === 'review_card')).toHaveLength(4)
    expect(phase3.rawBlocks.filter((b) => b.type === 'coaching')).toHaveLength(6)

    const finalBlocks = composePhase3BridgedBlocks(
      true,
      phase3.rawBlocks,
      [V5_ANALYSIS_RESULT_BLOCK],
    )

    // Mapped blocks stay first; every typed Phase 3 block follows.
    expect(finalBlocks[0]?.type).toBe('v5_analysis_result')
    const typedReviewCards = finalBlocks.filter(
      (b): b is V5ReviewCardBlock => b.type === 'v5_review_card',
    )
    const typedCoaching = finalBlocks.filter(
      (b): b is V5CoachingBlock => b.type === 'v5_coaching',
    )
    expect(typedReviewCards).toHaveLength(4)
    expect(typedCoaching).toHaveLength(6)
    // No legacy-adapted review_card is emitted for 0.13.x-shaped cards.
    expect(finalBlocks.filter((b) => b.type === 'review_card')).toHaveLength(0)

    // Producer-owned ordering: priority_rank ascending across the typed run.
    const typedRanks = finalBlocks
      .filter(
        (b): b is V5ReviewCardBlock | V5CoachingBlock =>
          b.type === 'v5_review_card' || b.type === 'v5_coaching',
      )
      // priority_rank is optional on the TYPE (the UI-side bias bridge
      // omits it) but always present on producer-adapted blocks; missing
      // ranks take +Infinity — the composePhase3BridgedBlocks convention.
      .map((b) => b.priority_rank ?? Number.POSITIVE_INFINITY)
    expect(typedRanks).toEqual([...typedRanks].sort((a, b) => a - b))

    // Highest-priority card first, copy verbatim from the live payload.
    const top = typedReviewCards[0]
    expect(top.priority_rank).toBe(71)
    expect(top.title).toBe('A load-bearing assumption')
    expect(top.body).toBe(
      'The relationship between Technical Leadership Capacity and overall throughput remains stable.',
    )
    expect(top.severity).toBe('info')
    expect(top.card_kind).toBe('assumption')
    expect(top.freshness).toBe('fresh')
  })

  it('coaching blocks carry the producer action refs verbatim (action_intent + action_label)', async () => {
    const result = await parseV5Response(makeResponse(loadFixture()))
    if (result.kind !== 'response') throw new Error('expected response')
    const phase3 = extractPhase3FromV5Response(result.response)
    const finalBlocks = composePhase3BridgedBlocks(true, phase3.rawBlocks, [])
    const coaching = finalBlocks.filter(
      (b): b is V5CoachingBlock => b.type === 'v5_coaching',
    )
    expect(coaching).toHaveLength(6)
    const assumptionCheck = coaching.find((c) => c.priority_rank === 101)
    expect(assumptionCheck?.coaching_kind).toBe('assumption_check')
    expect(assumptionCheck?.source).toBe('decision_review')
    expect(assumptionCheck?.action_intent).toBe('confirm_factor')
    expect(assumptionCheck?.action_label).toBe('Confirm this assumption')
  })

  it('typed blocks render on non-analysis turns too (factPresent=false does NOT gate 0.13.x blocks)', async () => {
    // CEE owns when to emit typed Phase 3 content — coaching legitimately
    // arrives on draft turns that carry no run_analysis fact. Only the
    // LEGACY fallback stays fact-gated (locked in the unit spec).
    const result = await parseV5Response(makeResponse(loadFixture()))
    if (result.kind !== 'response') throw new Error('expected response')
    const phase3 = extractPhase3FromV5Response(result.response)
    const finalBlocks = composePhase3BridgedBlocks(false, phase3.rawBlocks, [])
    expect(finalBlocks.filter((b) => b.type === 'v5_review_card')).toHaveLength(4)
    expect(finalBlocks.filter((b) => b.type === 'v5_coaching')).toHaveLength(6)
  })

  it('negative — synthetic null-body card is refused by the LEGACY adapter (no fabricated copy)', () => {
    // Unit assertion of the legacy bridge's empty-body refusal, independent
    // of the live fixture. Kept as a guard so a future regression that
    // started fabricating body content would be caught.
    const adapted = adaptPhase3ReviewCard({
      title: 'A load-bearing assumption',
      body: null,
      summary: null,
      description: null,
    })
    expect(adapted).toBeNull()
  })
})

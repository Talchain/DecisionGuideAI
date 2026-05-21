/**
 * PR #175 bridge — end-to-end wiring against the live CEE staging fixture
 * (debug bundle b82c89dd).
 *
 * Complements `phase3ReviewCardBridge.spec.ts` (unit tests on the composition
 * function) and `src/v5/__tests__/responseParser.actionTypeAlias.spec.ts`
 * (parser-side assertions). This spec proves the parse→extract→bridge chain
 * works end-to-end on the trimmed live fixture.
 *
 * Lives in `src/canvas/conversation/__tests__/` rather than in `src/v5/__tests__/`
 * deliberately. Importing `useConversation.ts` (where the bridge composition
 * function lives) from within `src/v5/**` would drag the entire conversation
 * graph into the tsconfig.ci.json typecheck scope (which is intentionally
 * limited to v5/**), surfacing pre-existing type errors in unrelated files.
 *
 * Brief assertions covered here:
 *   10a. On the real fixture (review_cards with null body), the bridge
 *        refuses to render — returns mappedBlocks unchanged. No fabricated
 *        copy. The empty body is a separate CEE-side issue not in scope.
 *   10b. When CEE emits a usable review_card body (synthetic — the same
 *        shape CEE will emit upstream once the null-body issue is fixed),
 *        the bridge appends review_card after v5_analysis_result.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { parseV5Response } from '../../../v5/responseParser'
import { extractPhase3FromV5Response } from '../../../v5/extractPhase3FromV5Response'
import { composePhase3BridgedBlocks } from '../useConversation'
import type { ConversationBlock } from '../types'

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

describe('PR #175 bridge — live fixture (cee-response-b82c89dd)', () => {
  it('(10a) on the real fixture (review_cards with null body) the bridge refuses to render — returns mappedBlocks unchanged, no fabricated copy', async () => {
    // The live CEE staging response b82c89dd emitted review_cards with
    // null summary/body/description. The bridge's "refuse empty body" rule
    // means no review_card appends — exactly the correct behaviour per the
    // PR #175 brief's "no fabricated copy" requirement. This test locks
    // that down so future regressions don't silently start rendering
    // empty cards.
    const result = await parseV5Response(makeResponse(loadFixture()))
    if (result.kind !== 'response') throw new Error('expected response')
    const phase3 = extractPhase3FromV5Response(result.response)

    const mappedBlocks: ConversationBlock[] = [
      {
        type: 'v5_analysis_result',
        summary: 'Ran analysis on your current scenario.',
        leading_option_id: 'opt_tech_lead',
        win_probabilities: { 'Hire One Tech Lead': 0.94325 },
      },
    ]
    const finalBlocks = composePhase3BridgedBlocks(true, phase3.rawBlocks, mappedBlocks)
    expect(finalBlocks.map((b) => b.type)).toEqual(['v5_analysis_result'])
    expect(finalBlocks.some((b) => b.type === 'review_card')).toBe(false)
  })

  it('(10b) when CEE emits a usable review_card body, the bridge appends after v5_analysis_result', async () => {
    // Substitute a non-null summary on one rawBlock — the same shape CEE
    // will emit upstream once the null-body issue is resolved. All other
    // fields preserved verbatim from the live CEE response.
    const result = await parseV5Response(makeResponse(loadFixture()))
    if (result.kind !== 'response') throw new Error('expected response')
    const phase3 = extractPhase3FromV5Response(result.response)

    const realReviewCard = phase3.rawBlocks.find((b) => b.type === 'review_card')
    expect(realReviewCard).toBeDefined()
    const usableRawBlocks = phase3.rawBlocks.map((b) =>
      b === realReviewCard
        ? {
            ...b,
            raw: { ...b.raw, summary: 'Hiring a Tech Lead remains robust under the modelled uncertainty.' },
          }
        : b,
    )

    const mappedBlocks: ConversationBlock[] = [
      {
        type: 'v5_analysis_result',
        summary: 'Ran analysis on your current scenario.',
        leading_option_id: 'opt_tech_lead',
        win_probabilities: { 'Hire One Tech Lead': 0.94325 },
      },
    ]
    const finalBlocks = composePhase3BridgedBlocks(true, usableRawBlocks, mappedBlocks)
    expect(finalBlocks.map((b) => b.type)).toEqual([
      'v5_analysis_result',
      'review_card',
    ])
    const card = finalBlocks[1] as { type: 'review_card'; title: string; body: string }
    expect(card.title).toBe('A load-bearing assumption')
    expect(card.body).toBe('Hiring a Tech Lead remains robust under the modelled uncertainty.')
  })
})

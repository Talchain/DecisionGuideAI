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

const V5_ANALYSIS_RESULT_BLOCK: ConversationBlock = {
  type: 'v5_analysis_result',
  summary: 'Ran analysis on your current scenario.',
  leading_option_id: 'opt_tech_lead',
  win_probabilities: { 'Hire One Tech Lead': 0.94325 },
}

describe('PR #175 bridge — live fixture (cee-response-b82c89dd)', () => {
  it('parse → extract → bridge appends the highest-priority review_card after v5_analysis_result', async () => {
    // Full live chain. The live response carries 4 review_card top-level
    // blocks (priority_rank 71-74) and 6 coaching blocks (priority_rank
    // 101-202), all with non-empty body content. The bridge picks the
    // lowest-priority_rank (= highest priority) review_card and appends
    // it after the V5 mapped blocks.
    const result = await parseV5Response(makeResponse(loadFixture()))
    expect(result.kind).toBe('response')
    if (result.kind !== 'response') return

    const phase3 = extractPhase3FromV5Response(result.response)
    const reviewCards = phase3.rawBlocks.filter((b) => b.type === 'review_card')
    expect(reviewCards).toHaveLength(4)

    const finalBlocks = composePhase3BridgedBlocks(
      true,
      phase3.rawBlocks,
      [V5_ANALYSIS_RESULT_BLOCK],
    )

    // Order: v5_analysis_result first (preserved), review_card appended.
    expect(finalBlocks.map((b) => b.type)).toEqual([
      'v5_analysis_result',
      'review_card',
    ])

    // The bridge selects priority_rank 71 (lowest = highest priority) and
    // adapts the verbatim CEE shape to the typed ReviewCardBlock.
    const card = finalBlocks[1] as {
      type: 'review_card'
      title: string
      body: string
      variant: 'info' | 'alert'
    }
    expect(card.title).toBe('A load-bearing assumption')
    expect(card.body).toBe(
      'The relationship between Technical Leadership Capacity and overall throughput remains stable.',
    )
    // No tone/variant emitted on this CEE response → defaults to 'info'
    // per the bridge's wrapped-block-parity defaults.
    expect(card.variant).toBe('info')
  })

  it('cap respected end-to-end: only one review_card surfaces even though 4 are available', async () => {
    const result = await parseV5Response(makeResponse(loadFixture()))
    if (result.kind !== 'response') throw new Error('expected response')
    const phase3 = extractPhase3FromV5Response(result.response)
    const finalBlocks = composePhase3BridgedBlocks(
      true,
      phase3.rawBlocks,
      [V5_ANALYSIS_RESULT_BLOCK],
    )
    expect(finalBlocks.filter((b) => b.type === 'review_card')).toHaveLength(1)
  })

  it('negative — synthetic null-body card is refused (no fabricated copy)', () => {
    // Unit assertion of the bridge's empty-body refusal, independent of
    // the live fixture. Kept here as a guard so a future regression that
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

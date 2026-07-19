/**
 * UI-SEM-085 — guidance rank honesty.
 *
 * The defect this pins: on the only LIVE guidance writer (V5,
 * useConversation.ts:3271 <- extractPhase3FromV5Response.deriveGuidance),
 * `priority` defaults to 50 when CEE omits both `priority` and
 * `priority_rank`. StrengthenContainer inverts that to
 * `priorityRank = 100 - 50 = 50`, and buildRecommendations banded it to
 * `phase3Base(10) + 50 = 60` — which sorts ABOVE the producer-backed flip
 * trigger (100). The sort is stable and every default is identical, so the
 * visible order was simply the wire array order, presented as merit.
 *
 * Stage 1 fix = DISCLOSE + DEMOTE, never re-invent: a defaulted row drops
 * below the whole producer-backed ladder and says so in its source line. No
 * replacement priority is derived from `category`.
 *
 * SCOPE, measured not assumed: a probe over the live capture
 * `cee-response-b82c89dd-trimmed.json` showed CEE DOES send `priority_rank` on
 * all 10 of its blocks, so the 50 default does NOT fire there — `category` and
 * `signal_code` are the universally-defaulted pair. The priority default is
 * still real (the two `exercise` blocks in
 * `phase3-evidence-exercise.bundle-shaped.json` carry neither field), which is
 * what these tests pin.
 *
 * NOTE ON LOCATION: this spec deliberately lives OUTSIDE `src/v5/**` (the
 * CI-tsc widening trap) even though it exercises the v5 extractor.
 */
import { describe, expect, it } from 'vitest'
import { buildRecommendations } from '../buildRecommendations'
import type { StrengthenInputs } from '../strengthenTypes'
import type { OlumiResponse } from '@talchain/schemas/boundary'
import {
  ADDITIVE_EXTENSIONS_KEY,
  type OlumiResponseWithExtensions,
} from '../../../../v5/responseParser'
import { extractPhase3FromV5Response } from '../../../../v5/extractPhase3FromV5Response'

const base: StrengthenInputs = {
  goalThreshold: 62,
  analysisComplete: true,
  fragileEdges: [],
  factors: [],
  robustness: { status: null, level: null },
  biasFindingTypes: [],
  phase3Items: [],
}

/** A fragile edge produces the producer-backed flip rec at PRIORITY.flip = 100. */
const withFlip: Pick<StrengthenInputs, 'fragileEdges'> = {
  fragileEdges: [{ edgeId: 'e1', factorLabel: 'Salary cost', switchProbability: 0.62 }],
}

const UNRANKED_LINE = 'Source: Olumi model review (not ranked — shown in the order received).'
const RANKED_LINE = 'Source: Olumi model review.'

// ─── Leg 1: the flag is set at the single defaulting site ──────────────────

describe('UI-SEM-085 — deriveGuidance marks producer-supplied vs UI-defaulted rank', () => {
  /** Feeds one coaching block through the real sidecar path the live V5
   * writer uses, and returns the derived guidance item. */
  const extractOne = (block: Record<string, unknown>) => {
    const response = {
      response_version: 2,
      assistant_text: '',
      blocks: [],
      suggested_actions: [],
      insights: [],
      stage_indicator: 'analyse',
    } as unknown as OlumiResponse
    Object.defineProperty(response, ADDITIVE_EXTENSIONS_KEY, {
      value: Object.freeze({
        phase3_blocks: [{ type: 'coaching', id: 'c-1', ...block }],
      }),
      enumerable: false,
      writable: false,
      configurable: false,
    })
    const res = extractPhase3FromV5Response(response as OlumiResponseWithExtensions)
    expect(res.guidanceItems).toHaveLength(1)
    return res.guidanceItems[0]
  }

  it('flags a block carrying explicit `priority` as producer-supplied', () => {
    const item = extractOne({ title: 'Ranked finding', priority: 90 })
    expect(item.priority).toBe(90)
    expect(item.priorityIsProducerSupplied).toBe(true)
  })

  it('flags a block carrying `priority_rank` as producer-supplied', () => {
    const item = extractOne({ title: 'Rank-ordered finding', priority_rank: 2 })
    expect(item.priority).toBe(98)
    expect(item.priorityIsProducerSupplied).toBe(true)
  })

  it('flags a block carrying NEITHER as UI-defaulted (the live CEE case)', () => {
    const item = extractOne({ title: 'Unranked finding' })
    expect(item.priority).toBe(50)
    expect(item.priorityIsProducerSupplied).toBe(false)
  })

  it('a producer priority that HAPPENS to be 50 is still producer-supplied', () => {
    // The flag must come from the defaulting site, not from `priority === 50`
    // — re-deriving it downstream would misread a legitimate producer 50.
    const item = extractOne({ title: 'Genuinely mid-ranked', priority: 50 })
    expect(item.priority).toBe(50)
    expect(item.priorityIsProducerSupplied).toBe(true)
  })
})

// ─── Leg 2: demotion + disclosure in the Strengthen ladder ─────────────────

describe('UI-SEM-085 — unranked guidance is demoted below the producer ladder', () => {
  it('THE DEFECT: an unranked phase-3 row no longer outranks the flip trigger', () => {
    const input: StrengthenInputs = {
      ...base,
      ...withFlip,
      phase3Items: [
        {
          id: 'g1',
          title: 'Unranked finding',
          targetIds: [],
          priorityRank: 50, // 100 - 50 default
          priorityIsProducerSupplied: false,
        },
      ],
    }
    const recs = buildRecommendations(input)
    const phase3 = recs.find((r) => r.id === 'strengthen:phase3:g1')!
    const flip = recs.find((r) => r.id.startsWith('strengthen:flip:'))!
    expect(phase3.priority).toBeGreaterThan(flip.priority)
  })

  it('a producer-RANKED phase-3 row keeps its place above the flip trigger', () => {
    const input: StrengthenInputs = {
      ...base,
      ...withFlip,
      phase3Items: [
        {
          id: 'g1',
          title: 'Ranked finding',
          targetIds: [],
          priorityRank: 1,
          priorityIsProducerSupplied: true,
        },
      ],
    }
    const recs = buildRecommendations(input)
    const phase3 = recs.find((r) => r.id === 'strengthen:phase3:g1')!
    const flip = recs.find((r) => r.id.startsWith('strengthen:flip:'))!
    expect(phase3.priority).toBeLessThan(flip.priority)
  })

  it('labels an unranked row as arrival-ordered, and leaves a ranked row unlabelled', () => {
    const input: StrengthenInputs = {
      ...base,
      phase3Items: [
        { id: 'ranked', title: 'A', targetIds: [], priorityRank: 1, priorityIsProducerSupplied: true },
        { id: 'unranked', title: 'B', targetIds: [], priorityRank: 50, priorityIsProducerSupplied: false },
      ],
    }
    const recs = buildRecommendations(input)
    expect(recs.find((r) => r.id === 'strengthen:phase3:ranked')!.sourceLine).toBe(RANKED_LINE)
    expect(recs.find((r) => r.id === 'strengthen:phase3:unranked')!.sourceLine).toBe(UNRANKED_LINE)
  })

  it('treats an ABSENT flag as unranked (fail-closed — never claims an unproven rank)', () => {
    const input: StrengthenInputs = {
      ...base,
      phase3Items: [{ id: 'g1', title: 'No flag at all', targetIds: [], priorityRank: 50 }],
    }
    const rec = buildRecommendations(input).find((r) => r.id === 'strengthen:phase3:g1')!
    expect(rec.sourceLine).toBe(UNRANKED_LINE)
    expect(rec.priority).toBeGreaterThan(200) // below `commit`, the ladder's old floor
  })

  it('does NOT derive a replacement rank: every unranked row lands in one band, arrival order kept', () => {
    // All four defaulted identically (priorityRank 50). Their relative order
    // must remain the order received — demotion must not silently reorder
    // them by category, title, or anything else the UI invented.
    const input: StrengthenInputs = {
      ...base,
      phase3Items: ['a', 'b', 'c', 'd'].map((id) => ({
        id,
        title: `Finding ${id}`,
        targetIds: [],
        priorityRank: 50,
        priorityIsProducerSupplied: false,
      })),
    }
    const phase3 = buildRecommendations(input).filter((r) => r.id.startsWith('strengthen:phase3:'))
    expect(phase3.map((r) => r.id)).toEqual([
      'strengthen:phase3:a',
      'strengthen:phase3:b',
      'strengthen:phase3:c',
      'strengthen:phase3:d',
    ])
    expect(new Set(phase3.map((r) => r.priority)).size).toBe(1)
  })

  it('spends the promotion budget on producer-ranked rows before unranked ones', () => {
    // MAX_PHASE3_PROMOTED is 4. Five items: four UNRANKED at the default
    // priorityRank 50, and one genuinely producer-ranked whose rank is WORSE
    // than that default (priorityRank 60 = producer priority 40).
    //
    // The 60 is the whole point: sorting on priorityRank ALONE puts all four
    // defaults (50) ahead of the real rank (60), so the cap silently drops the
    // one item the producer actually ranked — while the four that displaced it
    // get demoted to the bottom of the panel anyway. The demotion has to apply
    // at the budget sort too, or the cap quietly re-privileges unranked rows.
    const input: StrengthenInputs = {
      ...base,
      phase3Items: [
        ...['a', 'b', 'c', 'd'].map((id) => ({
          id,
          title: `Unranked ${id}`,
          targetIds: [],
          priorityRank: 50,
          priorityIsProducerSupplied: false,
        })),
        {
          id: 'ranked',
          title: 'Ranked finding',
          targetIds: [],
          priorityRank: 60,
          priorityIsProducerSupplied: true,
        },
      ],
    }
    const ids = buildRecommendations(input)
      .filter((r) => r.id.startsWith('strengthen:phase3:'))
      .map((r) => r.id)
    expect(ids).toHaveLength(4)
    expect(ids).toContain('strengthen:phase3:ranked')
  })
})

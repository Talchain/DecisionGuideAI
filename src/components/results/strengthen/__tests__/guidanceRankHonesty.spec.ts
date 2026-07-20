/**
 * UI-SEM-085 (narrowed) — guidance rank honesty.
 *
 * The ORIGINAL defect this file pinned: `priority` defaulted to 50 when CEE
 * omitted both wire fields, StrengthenContainer inverted it to
 * `priorityRank = 100 - 50 = 50`, and buildRecommendations banded it ABOVE
 * the producer-backed flip trigger — so wire array order was presented as
 * merit. Stage 1 fixed that by DISCLOSE + DEMOTE.
 *
 * Since then the producer half landed (0.19.0): CEE emits `category` +
 * `priority` on every guidance block, and `priority_rank` is REQUIRED on
 * review_card/coaching/evidence blocks (absent by contract on exercise
 * blocks). The consumer now takes each field on its own contract terms —
 * `priorityRank` verbatim (ascending, unbounded, presence = ranked),
 * `priority` verbatim (0-100 urgency, higher = more urgent, never a display
 * order), no inversions anywhere. See producerGuidancePriority.spec.ts for
 * the coaching-band collapse pins; THIS file keeps the honesty half: the
 * fail-closed defaults still exist for genuine absence, unranked rows stay
 * demoted + labelled, and no replacement rank is ever invented.
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

// ─── Leg 1: the single defaulting site discloses provenance honestly ───────

describe('UI-SEM-085 — deriveGuidance marks producer-supplied vs UI-defaulted priority', () => {
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

  it('consumes explicit `priority` verbatim and flags it producer-supplied', () => {
    const item = extractOne({ title: 'Ranked finding', priority: 90 })
    expect(item.priority).toBe(90)
    expect(item.priorityIsProducerSupplied).toBe(true)
  })

  it('carries `priority_rank` VERBATIM and never derives urgency from it', () => {
    // The historic behaviour (priority = 100 - rank = 98) was the inversion
    // defect: an order is not a score. Rank rides its own field, untouched.
    const item = extractOne({ title: 'Rank-ordered finding', priority_rank: 2 })
    expect(item.priorityRank).toBe(2)
    expect(item.priority).toBe(50)
    expect(item.priorityIsProducerSupplied).toBe(false)
  })

  it('flags a block carrying NEITHER field as UI-defaulted (pre-0.19.0 case)', () => {
    const item = extractOne({ title: 'Unranked finding' })
    expect(item.priority).toBe(50)
    expect(item.priorityRank).toBeUndefined()
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
  it('THE DEFECT: an unranked phase-3 row never outranks the flip trigger', () => {
    const input: StrengthenInputs = {
      ...base,
      ...withFlip,
      phase3Items: [
        // No priorityRank — the producer sent no ordering for this block.
        { id: 'g1', title: 'Unranked finding', targetIds: [] },
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
      phase3Items: [{ id: 'g1', title: 'Ranked finding', targetIds: [], priorityRank: 1 }],
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
        { id: 'ranked', title: 'A', targetIds: [], priorityRank: 1 },
        { id: 'unranked', title: 'B', targetIds: [] },
      ],
    }
    const recs = buildRecommendations(input)
    expect(recs.find((r) => r.id === 'strengthen:phase3:ranked')!.sourceLine).toBe(RANKED_LINE)
    expect(recs.find((r) => r.id === 'strengthen:phase3:unranked')!.sourceLine).toBe(UNRANKED_LINE)
  })

  it('treats rank ABSENCE as unranked (fail-closed — never claims an unproven rank)', () => {
    const input: StrengthenInputs = {
      ...base,
      phase3Items: [{ id: 'g1', title: 'No rank at all', targetIds: [] }],
    }
    const rec = buildRecommendations(input).find((r) => r.id === 'strengthen:phase3:g1')!
    expect(rec.sourceLine).toBe(UNRANKED_LINE)
    expect(rec.priority).toBeGreaterThan(200) // below `commit`, the ladder's old floor
  })

  it('does NOT derive a replacement rank: unranked rows keep arrival order in one band', () => {
    // All four unranked. Their relative order must remain the order received
    // — demotion must not silently reorder them by category, title, or
    // anything else the UI invented. (Band offsets are dense ARRIVAL indices
    // — positional bookkeeping, not a merit ranking.)
    const input: StrengthenInputs = {
      ...base,
      phase3Items: ['a', 'b', 'c', 'd'].map((id) => ({
        id,
        title: `Finding ${id}`,
        targetIds: [],
      })),
    }
    const phase3 = buildRecommendations(input)
      .filter((r) => r.id.startsWith('strengthen:phase3:'))
      .sort((a, b) => a.priority - b.priority)
    expect(phase3.map((r) => r.id)).toEqual([
      'strengthen:phase3:a',
      'strengthen:phase3:b',
      'strengthen:phase3:c',
      'strengthen:phase3:d',
    ])
    expect(phase3.every((r) => r.sourceLine === UNRANKED_LINE)).toBe(true)
  })

  it('spends the promotion budget on producer-ranked rows before unranked ones', () => {
    // MAX_PHASE3_PROMOTED is 4. Five items: four UNRANKED arrivals ahead of
    // one genuinely producer-ranked block whose rank (201, prompt band) is
    // numerically enormous. Rank PRESENCE must win the budget — a sort on
    // rank value alone would let four unranked sentinels displace the one
    // block the producer actually ranked.
    const input: StrengthenInputs = {
      ...base,
      phase3Items: [
        ...['a', 'b', 'c', 'd'].map((id) => ({
          id,
          title: `Unranked ${id}`,
          targetIds: [],
        })),
        { id: 'ranked', title: 'Ranked finding', targetIds: [], priorityRank: 201 },
      ],
    }
    const ids = buildRecommendations(input)
      .filter((r) => r.id.startsWith('strengthen:phase3:'))
      .map((r) => r.id)
    expect(ids).toHaveLength(4)
    expect(ids).toContain('strengthen:phase3:ranked')
  })
})

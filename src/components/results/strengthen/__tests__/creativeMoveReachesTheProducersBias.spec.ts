/**
 * The one CREATIVE move in the product, and why it could never fire.
 *
 * ⭐⭐ THE MEASUREMENT THAT PROMPTED THIS, taken by driving deployed `cffe418d`
 * as a guest through a real completed analysis:
 *
 *   - The panel rendered two producer findings, titled "Narrow framing" and
 *     "Overconfidence" — cognitive biases, with bodies quoting the user's own
 *     brief back at them.
 *   - `window.useCanvasStore.getState().draftCoaching` was **NULL**.
 *   - So `biasFindingTypes` was `[]`, and `strengthen:broaden` — the only one
 *     of the engine's eight builders that asks for a NEW idea rather than a
 *     more complete one — could not fire.
 *
 * The product was told "your options are narrowly framed" and the move it has
 * for exactly that could not see it, because two producer channels carry the
 * same fact and the trigger subscribed to the empty one.
 *
 * ⚠ These tests drive the REAL seam — raw wire block →
 * `extractPhase3FromV5Response` → `toStoreGuidanceItem` →
 * `toStrengthenPhase3Item` → `mergeBiasFindingTypes` → `buildRecommendations`.
 * The bias block below is copied from a genuine capture
 * (`w998-2026-08-16-a1-turn2.json`), field for field, so the shape under test
 * is the producer's rather than this author's (CLAUDE.md trap 16-inverse).
 */
import { describe, expect, it } from 'vitest'
import type { OlumiResponse } from '@talchain/schemas/boundary'
import {
  ADDITIVE_EXTENSIONS_KEY,
  type OlumiResponseWithExtensions,
} from '../../../../v5/responseParser'
import { extractPhase3FromV5Response } from '../../../../v5/extractPhase3FromV5Response'
import { toStoreGuidanceItem } from '../../../../canvas/conversation/useConversation'
import { buildRecommendations, toStrengthenPhase3Item } from '../buildRecommendations'
import { mergeBiasFindingTypes, biasTypesFromPhase3Items } from '../biasTypesFromGuidance'
import type { StrengthenInputs } from '../strengthenTypes'

const extract = (blocks: Array<Record<string, unknown>>) => {
  const response = {
    response_version: 2,
    assistant_text: '',
    blocks: [],
    suggested_actions: [],
    insights: [],
    stage_indicator: 'analyse',
  } as unknown as OlumiResponse
  Object.defineProperty(response, ADDITIVE_EXTENSIONS_KEY, {
    value: Object.freeze({ phase3_blocks: blocks }),
    enumerable: false,
    writable: false,
    configurable: false,
  })
  return extractPhase3FromV5Response(response as OlumiResponseWithExtensions)
}

/** Shape copied from the real capture, only the title/body varied. */
const biasBlock = (title: string): Record<string, unknown> => ({
  block_id: `blk-${title.replace(/\s+/g, '-').toLowerCase()}`,
  type: 'coaching',
  coaching_kind: 'bias_signal',
  title,
  body: 'Producer evidence quoting the brief.',
  source: 'draft_graph',
  freshness: 'fresh',
  priority_rank: 1,
  category: 'should_fix',
  priority: 70,
  signal_code: 'COGNITIVE_BIAS',
})

/** A non-bias coaching card, to prove the gate is on `coaching_kind`. */
const assumptionBlock = (title: string): Record<string, unknown> => ({
  block_id: `blk-${title.replace(/\s+/g, '-').toLowerCase()}`,
  type: 'coaching',
  coaching_kind: 'assumption_check',
  title,
  body: 'Producer copy.',
  source: 'decision_review',
  freshness: 'fresh',
  priority_rank: 2,
  signal_code: 'ASSUMPTION_CHECK',
})

const toItems = (blocks: Array<Record<string, unknown>>) =>
  extract(blocks).guidanceItems.map(toStoreGuidanceItem).map(toStrengthenPhase3Item)

const baseInputs: StrengthenInputs = {
  goalThreshold: 62,
  analysisComplete: true,
  flipThresholds: null,
  fragileEdges: [],
  factors: [],
  robustness: { status: null, level: null },
  biasFindingTypes: [],
  phase3Items: [],
}

describe('the producer’s bias card survives to the engine as a bias', () => {
  it('coaching_kind rides the whole chain — the hop it was dying at', () => {
    const [item] = toItems([biasBlock('Narrow framing')])
    expect(item.coachingKind).toBe('bias_signal')
  })

  it('a narrow-framing card yields the canonical narrow-framing codes', () => {
    const types = biasTypesFromPhase3Items(toItems([biasBlock('Narrow framing')]))
    // Derived by INVERTING BIAS_SIGNAL_REGISTRY, never hand-listed here.
    expect(types).toContain('narrow_framing')
  })

  /**
   * ⭐ THE DISCRIMINATING CASES. Without these the derivation could be "any
   * producer card is a narrow-framing bias" and the test above would pass.
   */
  it('an assumption check is NOT a bias, however it is titled', () => {
    expect(biasTypesFromPhase3Items(toItems([assumptionBlock('Narrow framing')]))).toEqual([])
  })

  it('a bias the registry does not name yields nothing rather than a guess', () => {
    expect(biasTypesFromPhase3Items(toItems([biasBlock('Some Bias We Never Named')]))).toEqual([])
  })

  it('Overconfidence is recognised, and is NOT a narrow-framing code', () => {
    const types = biasTypesFromPhase3Items(toItems([biasBlock('Overconfidence')]))
    expect(types.length).toBeGreaterThan(0)
    expect(types).not.toContain('narrow_framing')
  })
})

describe('both producer channels are read, not just the one that was empty', () => {
  it('UNION, not fallback — a non-empty draft channel does not hide the phase-3 one', () => {
    const merged = mergeBiasFindingTypes(
      [{ type: 'anchoring' }],
      toItems([biasBlock('Narrow framing')]),
    )
    expect(merged).toContain('anchoring')
    expect(merged).toContain('narrow_framing')
  })

  it('deduplicates a bias that arrives on both channels', () => {
    const merged = mergeBiasFindingTypes(
      [{ type: 'narrow_framing' }],
      toItems([biasBlock('Narrow framing')]),
    )
    expect(merged.filter((t) => t === 'narrow_framing')).toHaveLength(1)
  })
})

describe('the creative move actually appears', () => {
  it('THE DEFECT: with draftCoaching NULL, a producer narrow-framing card now fires broaden', () => {
    const phase3Items = toItems([biasBlock('Narrow framing')])
    const recs = buildRecommendations({
      ...baseInputs,
      // NULL — exactly what was measured on the deployed build.
      biasFindingTypes: mergeBiasFindingTypes(null, phase3Items),
      phase3Items,
    })

    const broaden = recs.find((r) => r.id === 'strengthen:broaden')
    expect(broaden, 'the creative move must be present').toBeDefined()
    expect(broaden!.helpType).toBe('broaden')
    // Producer copy, verbatim from the engine — never authored by this test.
    expect(broaden!.title).toBe('Find a route that works differently')
  })

  it('and does NOT fire when the producer named no narrow-framing bias', () => {
    const phase3Items = toItems([biasBlock('Overconfidence')])
    const recs = buildRecommendations({
      ...baseInputs,
      biasFindingTypes: mergeBiasFindingTypes(null, phase3Items),
      phase3Items,
    })
    expect(recs.find((r) => r.id === 'strengthen:broaden')).toBeUndefined()
  })

  it('the run that prompted this now offers BOTH a critical and a creative move', () => {
    // The two findings actually on screen on deployed `cffe418d`.
    const phase3Items = toItems([biasBlock('Narrow framing'), biasBlock('Overconfidence')])
    const recs = buildRecommendations({
      ...baseInputs,
      biasFindingTypes: mergeBiasFindingTypes(null, phase3Items),
      phase3Items,
    })
    const kinds = new Set(recs.map((r) => r.helpType))
    expect(kinds.has('challenge'), 'critical thinking').toBe(true)
    expect(kinds.has('broaden'), 'creative thinking').toBe(true)
  })
})

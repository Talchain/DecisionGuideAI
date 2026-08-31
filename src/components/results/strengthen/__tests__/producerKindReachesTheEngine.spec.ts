/**
 * The producer says what KIND of thinking a finding asks for. The engine never
 * heard it.
 *
 * `deriveGuidance` carries `signal_code` onto `GuidanceItem` — an OPEN,
 * producer-owned SCREAMING_SNAKE vocabulary (PRE_MORTEM, COGNITIVE_BIAS,
 * LOW_OPTION_COUNT, ASSUMPTION_CHECK, …) — and `toStrengthenPhase3Item` did not
 * map it. So `buildRecommendations` minted `helpType: 'clarify'` for EVERY
 * phase-3 row, unconditionally: the producer's own pre-mortem card, its
 * cognitive-bias signal and its fragile-result card all arrived classified as
 * "complete the model".
 *
 * Two things depend on that classification, and the second is why it mattered:
 *   - the row's kind, which is simply wrong for a challenge card; and
 *   - `composePreview`, which fills the last default slot with a finding of a
 *     DIFFERENT kind so the three visible rows are not all one kind of
 *     thinking. Handed a monoculture of `clarify` it has nothing to choose
 *     between — and the producer band sits at ranks 10-13, above every
 *     deterministic trigger, so the critical move stayed below the fold on
 *     exactly the runs that called for it.
 *
 * ⭐ THESE TESTS RUN THE REAL SEAM, not a fixture at the engine: raw wire block
 * → `extractPhase3FromV5Response` → `GuidanceItem` → `toStrengthenPhase3Item`
 * → `buildRecommendations`. A self-authored input at the engine would encode
 * this author's model of the producer rather than the producer (CLAUDE.md trap
 * 16-inverse), and the whole defect lived at a mapping hop between the two.
 *
 * The signal codes asserted below are the ones the repo's own wire captures
 * actually carry — derived, not imagined.
 */
import { describe, expect, it } from 'vitest'
import type { OlumiResponse } from '@talchain/schemas/boundary'
import {
  ADDITIVE_EXTENSIONS_KEY,
  type OlumiResponseWithExtensions,
} from '../../../../v5/responseParser'
import { extractPhase3FromV5Response } from '../../../../v5/extractPhase3FromV5Response'
import { buildRecommendations, toStrengthenPhase3Item } from '../buildRecommendations'
import type { StrengthenInputs } from '../strengthenTypes'
import { methodForRecommendation } from '../../analysisNew/recommendationMethod'

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

const coachingBlock = (over: Record<string, unknown>): Record<string, unknown> => ({
  type: 'coaching',
  coaching_kind: 'strengthen',
  source: 'decision_review',
  freshness: 'fresh',
  ...over,
})

/** A run with NO deterministic trigger firing, so the only recommendations are
 * the producer's own — the state this defect lived in. */
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

/** Wire block → the recommendation the panel actually renders. */
const recFor = (signalCode: string | undefined) => {
  const res = extract([
    coachingBlock({
      block_id: 'b-1',
      title: 'A producer finding',
      detail: 'Producer copy.',
      priority_rank: 11,
      ...(signalCode ? { signal_code: signalCode } : {}),
    }),
  ])
  const phase3Items = res.guidanceItems.map(toStrengthenPhase3Item)
  const recs = buildRecommendations({ ...baseInputs, phase3Items })
  // Bind by IDENTITY, never by a value predicate another rec could satisfy.
  const rec = recs.find((r) => r.id === 'strengthen:phase3:b-1')
  expect(rec, 'the phase-3 rec must exist — otherwise every assertion below is vacuous').toBeDefined()
  return rec!
}

describe('the producer’s signal_code survives to the engine', () => {
  it('reaches the recommendation at all — the hop that was dropping it', () => {
    expect(recFor('PRE_MORTEM').signalCode).toBe('PRE_MORTEM')
  })

  it('is absent, never invented, when the producer sent no code', () => {
    expect(recFor(undefined).signalCode).toBeUndefined()
  })
})

describe('kind of thinking, taken from the producer rather than defaulted', () => {
  it('PRE_MORTEM is a challenge, not a clarification', () => {
    expect(recFor('PRE_MORTEM').helpType).toBe('challenge')
  })

  it('FRAGILE_RESULT is a challenge — the same kind the engine gives its own robustness trigger', () => {
    expect(recFor('FRAGILE_RESULT').helpType).toBe('challenge')
  })

  it('COGNITIVE_BIAS is a challenge', () => {
    expect(recFor('COGNITIVE_BIAS').helpType).toBe('challenge')
  })

  it('LOW_OPTION_COUNT is the creative move', () => {
    expect(recFor('LOW_OPTION_COUNT').helpType).toBe('broaden')
  })

  /**
   * ⭐ THE DISCRIMINATING HALF. Without these three the map could be a blanket
   * "any producer code is a challenge" and every test above would still pass.
   * These prove it moves a row OFF the default only where a code names a move
   * we can independently classify.
   */
  it('ASSUMPTION_CHECK stays clarify — it IS completing the model', () => {
    expect(recFor('ASSUMPTION_CHECK').helpType).toBe('clarify')
  })

  it('an unrecognised code falls through to clarify, never to a guess', () => {
    expect(recFor('SOME_CODE_WE_HAVE_NEVER_SEEN').helpType).toBe('clarify')
  })

  it('no code at all is still clarify — today’s behaviour, unchanged', () => {
    expect(recFor(undefined).helpType).toBe('clarify')
  })
})

describe('a producer finding can now name its technique', () => {
  it('PRE_MORTEM attaches the pre-mortem method', () => {
    const rec = recFor('PRE_MORTEM')
    expect(methodForRecommendation(rec.id, rec.signalCode)?.id).toBe('pre_mortem')
  })

  /**
   * `review_bias` is one of the seven catalogued techniques and had NO trigger
   * anywhere in the product — reachable only from a menu you had to already
   * know you wanted, which is the opposite of science guiding attention. This
   * is its first.
   */
  it('COGNITIVE_BIAS unlocks review_bias, which no finding could reach before', () => {
    const rec = recFor('COGNITIVE_BIAS')
    expect(methodForRecommendation(rec.id, rec.signalCode)?.id).toBe('review_bias')
  })

  it('LOW_OPTION_COUNT attaches the same method as the engine’s own broaden trigger', () => {
    const rec = recFor('LOW_OPTION_COUNT')
    expect(methodForRecommendation(rec.id, rec.signalCode)?.id).toBe('different_option')
  })

  /**
   * Restraint, asserted. A method chip claims decision science prescribes THIS
   * MOVE here; a producer fragility card states a fact about the run and may
   * prescribe something else. Same kind of thinking, different move — so it
   * gets the kind and NOT the chip.
   */
  it('FRAGILE_RESULT is a challenge but names NO technique', () => {
    const rec = recFor('FRAGILE_RESULT')
    expect(rec.helpType).toBe('challenge')
    expect(methodForRecommendation(rec.id, rec.signalCode)).toBeNull()
  })

  it('an unmapped code names no technique rather than a default one', () => {
    const rec = recFor('ASSUMPTION_CHECK')
    expect(methodForRecommendation(rec.id, rec.signalCode)).toBeNull()
  })

  /**
   * The id still wins. This change is strictly additive: nothing that names a
   * technique today can stop naming one, or start naming a different one.
   */
  it('a UI trigger’s own mapping is not displaced by a producer code', () => {
    expect(methodForRecommendation('strengthen:robustness', 'COGNITIVE_BIAS')?.id).toBe(
      'pre_mortem',
    )
  })
})

/**
 * The corrective for the bias the producer actually named — not a label, and
 * not the one generic technique all sixteen of them shared.
 *
 * ⭐⭐ THE GAP THIS CLOSES, derived at the bytes on `06fddf0f`.
 *
 * Both halves already shipped. CEE names cognitive biases on phase-3 coaching
 * cards (`coaching_kind: 'bias_signal'`, the bias in the card's TITLE), and the
 * catalogue holds seven science-grounded techniques. They met at exactly one
 * point: `METHOD_BY_SIGNAL_CODE` maps the producer's `signal_code` —
 * `COGNITIVE_BIAS`, ONE value for every bias — onto `review_bias`, "Review a
 * possible bias", whose own description is "Use only biases grounded in this
 * brief or model".
 *
 * So on a run where the producer had ALREADY reviewed the reasoning and named an
 * anchor, the sharpest thing the product could offer was to go and look for a
 * bias. The identity was on the wire the whole time and nothing read it per
 * card: `biasFindingTypes` inverts the registry to recover bias codes, but it has
 * exactly ONE reader — `buildRecommendations`' narrow-framing gate, whose
 * `NARROW_TYPES` covers three of the registry's sixteen codes. Anchoring,
 * overconfidence, sunk cost, status quo and confirmation bias gated NOTHING.
 *
 * ⚠ THESE TESTS DRIVE THE REAL SEAM, raw wire block →
 * `extractPhase3FromV5Response` → `toStoreGuidanceItem` →
 * `toStrengthenPhase3Item` → `buildRecommendations` → `methodForRecommendation`.
 * The bias block is copied field for field from the same genuine capture
 * (`w998-2026-08-16-a1-turn2.json`) that `creativeMoveReachesTheProducersBias`
 * uses, so the shape under test is the producer's and not this author's
 * (CLAUDE.md trap 16-inverse: a fixture you wrote yourself is not evidence
 * about the wire).
 *
 * ⚠⚠ WHAT MUST NEVER BE TRUE HERE. The bias is never named to the user as a
 * diagnosis — the chip names the METHOD, the observation stays the producer's
 * own card copy, and no string this change puts on screen is new. The gate is
 * the producer's own signal for THIS run: nothing is inferred from the model,
 * the brief, or the option count.
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
import { biasCodeFromPhase3Item } from '../biasTypesFromGuidance'
import type { StrengthenInputs } from '../strengthenTypes'
import {
  methodForRecommendation,
  MAPPED_BIAS_CODES,
} from '../../analysisNew/recommendationMethod'
import { METHOD_CATALOGUE } from '../../decision-overview/actionsCatalogue'
import {
  containsBannedTerm,
  findBannedTerm,
} from '../../utils/glossaryCheck'

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

/**
 * Shape copied from the real capture, only the title varied.
 *
 * ⚠ `signal_code: 'COGNITIVE_BIAS'` IS PART OF THE CAPTURE AND IS LOAD-BEARING
 * IN EVERY TEST BELOW. It is what the generic mapping keys on, so its presence
 * is what makes the precedence question real rather than hypothetical: both maps
 * answer on these cards, and the tests pin which one wins.
 */
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

/** A non-bias coaching card, to prove the gate is `coaching_kind`, not the title. */
const assumptionBlock = (title: string): Record<string, unknown> => ({
  block_id: `blk-assumption-${title.replace(/\s+/g, '-').toLowerCase()}`,
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

/**
 * The phase-3 recommendation for a single producer block, via the real engine.
 *
 * ⚠ BINDS BY IDENTITY (trap 19): the rec is found by the id the builder mints
 * from the producer's own `block_id`, never by position in the array and never
 * by a value predicate another finding could satisfy.
 */
const recFor = (block: Record<string, unknown>) => {
  const items = toItems([block])
  expect(items, 'the producer block did not survive extraction').toHaveLength(1)
  const recs = buildRecommendations({ ...baseInputs, phase3Items: items })
  const expectedId = `strengthen:phase3:${block.block_id as string}`
  const rec = recs.find((r) => r.id === expectedId)
  expect(rec, `no recommendation minted with id ${expectedId}`).toBeDefined()
  return rec!
}

/** The method the panel would render for this producer block, via the real seam. */
const methodFor = (block: Record<string, unknown>) => {
  const rec = recFor(block)
  return methodForRecommendation(rec.id, rec.signalCode, rec.biasCode)
}

const catalogue = (id: string) => {
  const entry = METHOD_CATALOGUE.find((m) => m.id === id)
  expect(entry, `${id} is not in the catalogue`).toBeDefined()
  return entry!
}

describe('the producer’s bias identity survives to the method lookup', () => {
  /**
   * ⭐ THE HOP THAT DID NOT EXIST. `signal_code` already rode the chain; WHICH
   * bias did not, because it lives only in the title and nothing paired the
   * title with the registry per card.
   */
  it('an Anchoring card arrives carrying a canonical bias code', () => {
    expect(recFor(biasBlock('Anchoring')).biasCode).toBe('anchoring')
  })

  /**
   * ⭐⭐ THE ALIAS CASE, AND IT IS THE ONE THAT PROVES THE DESIGN. Several codes
   * share one registry title, and the resolver returns whichever the registry
   * lists FIRST — for 'Overconfidence' that is `confidence`, NOT
   * `overconfidence`. A map that string-compared a hand-picked spelling would
   * therefore have missed the very row it was written for. This pins the exact
   * code that arrives, so the title-equivalence lookup cannot be "simplified"
   * into a code comparison without going red here.
   */
  it('an Overconfidence card arrives as `confidence`, the registry’s first alias', () => {
    expect(recFor(biasBlock('Overconfidence')).biasCode).toBe('confidence')
  })

  it('a non-bias card carries NO bias code, however it is titled', () => {
    expect(recFor(assumptionBlock('Anchoring')).biasCode).toBeUndefined()
    expect(
      biasCodeFromPhase3Item({ coachingKind: 'assumption_check', title: 'Anchoring' }),
    ).toBeNull()
  })

  it('a bias this estate has no code for carries nothing rather than a guess', () => {
    expect(recFor(biasBlock('Some Bias We Never Named')).biasCode).toBeUndefined()
  })
})

describe('a named bias reaches the user as the corrective for THAT bias', () => {
  /**
   * ⚠ ASSERTS THE EXACT SHIPPED STRINGS, not merely that A method resolved. A
   * copy spec that stays green when the sentence is inverted is vacuous; these
   * pin the two strings the chip renders (`method.title` visibly,
   * `method.description` in `title` and an `sr-only` span) against the
   * catalogue, so a catalogue edit cannot silently change what this claims.
   */
  it('Anchoring → apply the outside view, the reference-class move', () => {
    const method = methodFor(biasBlock('Anchoring'))
    expect(method?.id).toBe('outside_view')
    expect(method?.title).toBe('Apply the outside view')
    expect(method?.description).toBe('Compare with a relevant reference class.')
    expect(method?.title).toBe(catalogue('outside_view').title)
    expect(method?.description).toBe(catalogue('outside_view').description)
  })

  it('Overconfidence → run a pre-mortem, the failure-generation move', () => {
    const method = methodFor(biasBlock('Overconfidence'))
    expect(method?.id).toBe('pre_mortem')
    expect(method?.title).toBe('Run a pre-mortem')
    expect(method?.description).toBe('Imagine failure and capture plausible causes.')
    expect(method?.title).toBe(catalogue('pre_mortem').title)
    expect(method?.description).toBe(catalogue('pre_mortem').description)
  })

  /**
   * ⭐⭐ THE CLAIM THIS CHANGE RESTS ON, STATED AS A TEST: the specific corrective
   * must OUTRANK the generic one. Both maps answer on a bias card — it carries a
   * bias code AND `signal_code: 'COGNITIVE_BIAS'` — so put the bias map second
   * in precedence and it is unreachable on every card that could use it, i.e.
   * dark on arrival. These two assertions are the deliberate behaviour CHANGE
   * (previously both cards resolved to `review_bias`) and are pinned by name so
   * the change cannot be reverted silently.
   */
  it('the specific corrective outranks the generic “review a possible bias”', () => {
    expect(methodFor(biasBlock('Anchoring'))?.id).not.toBe('review_bias')
    expect(methodFor(biasBlock('Overconfidence'))?.id).not.toBe('review_bias')
  })
})

describe('restraint: the map answers two biases, and only two', () => {
  /**
   * ⭐⭐ THE DISCRIMINATING CASE THAT IS REACHABLE TODAY, AND IT IS THE ONE THAT
   * MATTERS. Without it the implementation could be "any producer bias gets the
   * outside view" and every test above would still pass.
   *
   * ⚠ WHY THIS ONE IS SINGLED OUT — bounded by what the PRODUCER CAN EMIT, not
   * by what the registry names (CLAUDE.md trap 16-inverse: a branch can be live
   * while the data cannot reach it). Derived at the shared contract,
   * `olumi-schemas` `main` @ `cc5c9e84`: `BiasType` is
   * `z.enum(['anchoring', 'narrow_framing', 'status_quo_bias', 'overconfidence'])`
   * and CEE ENFORCES it by dropping the whole signal rather than asserting a
   * different bias (`coaching-contract-conformance.ts:234-262`, on the
   * always-on unified pipeline). So FOUR bias titles are reachable today:
   *
   *   Narrow framing  → already drives `strengthen:broaden` / `different_option`
   *   Anchoring       → `outside_view`  (this change)
   *   Overconfidence  → `pre_mortem`    (this change)
   *   Status quo bias → the generic `review_bias`, unchanged — THIS TEST
   *
   * That is the complete reachable set, so this row is the whole of "a bias the
   * map deliberately does not answer" as the product stands.
   */
  it('Status quo bias — the one reachable unwired bias — keeps the generic chip', () => {
    const method = methodFor(biasBlock('Status quo bias'))
    expect(method?.id).toBe('review_bias')
    expect(method?.title).toBe('Review a possible bias')
  })

  /**
   * ⚠⚠ THESE SIX ARE REGISTRY-KNOWN AND PRODUCER-UNREACHABLE TODAY, AND THE ROW
   * SAYS SO RATHER THAN LETTING A LATER READER TAKE THEM FOR WIRE EVIDENCE. The
   * `BiasType` enum above cannot emit their codes, so wiring any of them would
   * have shipped dark — which is why the map stops at two.
   *
   * They are still asserted, for one reason: `BIAS_SIGNAL_REGISTRY` is the UI's
   * shared authority across surfaces and `BiasType` can widen without this file
   * being touched. If `sunk_cost` becomes emittable, it must arrive on the
   * generic chip rather than silently inheriting a corrective nobody argued for.
   * Widening past the four is a SCHEMAS change, not a UI one.
   */
  it.each([
    ['Sunk cost'],
    ['Confirmation bias'],
    ['Optimism bias'],
    ['Availability bias'],
    ['Authority bias'],
    ['Blind spots'],
  ])(
    'an unwired, producer-unreachable bias (%s) would still get only the generic chip',
    (title) => {
      expect(methodFor(biasBlock(title))?.id).toBe('review_bias')
    },
  )

  /**
   * ⚠ NARROW FRAMING IS NOT AN UNWIRED BIAS — it is the one bias that ALREADY
   * had a route, and it keeps it. The bias map does not answer it, so its card
   * keeps the generic chip, while the separate `strengthen:broaden` rec its code
   * gates carries `different_option` as before. Two rows, two methods, neither
   * changed by this work.
   */
  it('Narrow framing keeps both of its existing answers, unchanged', () => {
    const items = toItems([biasBlock('Narrow framing')])
    const recs = buildRecommendations({
      ...baseInputs,
      biasFindingTypes: ['narrow_framing'],
      phase3Items: items,
    })
    const card = recs.find((r) => r.id.startsWith('strengthen:phase3:'))!
    expect(methodForRecommendation(card.id, card.signalCode, card.biasCode)?.id).toBe(
      'review_bias',
    )
    const broaden = recs.find((r) => r.id === 'strengthen:broaden')
    expect(broaden, 'the narrow-framing gate no longer fires').toBeDefined()
    expect(methodForRecommendation(broaden!.id, broaden!.signalCode, broaden!.biasCode)?.id).toBe(
      'different_option',
    )
  })

  /**
   * ⚠ A BIAS CARD IS NOT A LICENCE. An `assumption_check` titled 'Anchoring'
   * resolves through NEITHER map: no bias code, and `ASSUMPTION_CHECK` is
   * deliberately absent from the signal-code map. The honest answer is no chip.
   */
  it('a non-bias card titled after a bias gets no method at all', () => {
    expect(methodFor(assumptionBlock('Anchoring'))).toBeNull()
  })

  /**
   * ⚠ PRECEDENCE, UPPER HALF: the id map still wins outright, so no UI trigger
   * can change behaviour. `strengthen:broaden` keeps `different_option` even
   * when handed the anchoring code that would otherwise select `outside_view`.
   */
  it('a UI trigger’s own mapping is untouched by a bias code', () => {
    expect(methodForRecommendation('strengthen:broaden', 'COGNITIVE_BIAS', 'anchoring')?.id).toBe(
      'different_option',
    )
    expect(methodForRecommendation('strengthen:robustness', undefined, 'anchoring')?.id).toBe(
      'pre_mortem',
    )
  })

  it('an unrecognised bias code yields nothing rather than a default technique', () => {
    expect(
      methodForRecommendation('strengthen:phase3:x', undefined, 'not_a_bias_we_know'),
    ).toBeNull()
    expect(methodForRecommendation('strengthen:phase3:x', undefined, '')).toBeNull()
    // Prototype-chain codes must fail closed like any other unknown, not return
    // a truthy object — `resolveBiasSignal`'s own-key guard is what holds here.
    expect(methodForRecommendation('strengthen:phase3:x', undefined, '__proto__')).toBeNull()
    expect(methodForRecommendation('strengthen:phase3:x', undefined, 'constructor')).toBeNull()
  })
})

describe('the map cannot rot into a no-op', () => {
  /**
   * ⭐ THE POSITIVE CONTROL, and the load-bearing one: every assertion about
   * absence above passes trivially if the map is empty. This pins that it is
   * non-trivial and that each row resolves to a real catalogue entry — the
   * "feature quietly disappears, nothing red" failure (CLAUDE.md trap 12).
   */
  it('every mapped bias code resolves to a real method', () => {
    expect(MAPPED_BIAS_CODES.length).toBeGreaterThanOrEqual(2)
    for (const code of MAPPED_BIAS_CODES) {
      const method = methodForRecommendation('strengthen:phase3:any', undefined, code)
      expect(method, `${code} resolved to nothing`).not.toBeNull()
      expect(
        METHOD_CATALOGUE.some((m) => m.id === method!.id),
        `${code} resolved to ${method!.id}, which is not in the catalogue`,
      ).toBe(true)
    }
  })

  /**
   * ⭐⭐ `outside_view` HAD NO TRIGGER OF ANY KIND before this change — it shipped
   * in the catalogue reachable only from a menu the user had to already know they
   * wanted. So the bias map is its ONLY route, and a rename or deletion takes the
   * whole technique with it. Pinned explicitly because the generic drift guard
   * (`MAPPED_METHOD_IDS`) proves the id EXISTS in the catalogue and cannot prove
   * anything still reaches it.
   */
  it('the outside view is reachable, and reachable from a producer bias', () => {
    const viaBias = MAPPED_BIAS_CODES.map(
      (code) => methodForRecommendation('strengthen:phase3:any', undefined, code)?.id,
    )
    expect(viaBias).toContain('outside_view')
  })
})

describe('nothing this puts on screen names a bias at a person', () => {
  /**
   * ⚠⚠ CHECKED MECHANICALLY, WITH A CONTROL THAT FIRES — an absence assertion
   * whose matcher is silently broken passes by testing nothing (CLAUDE.md trap
   * 13). The control runs FIRST and asserts the matcher does catch a §18 phrase;
   * if the matcher were inert this spec would fail there rather than pass below.
   */
  it('the matcher works: a §18 diagnosis phrase is caught', () => {
    expect(containsBannedTerm('bias detected in your framing')).toBe(true)
    expect(findBannedTerm('you are exhibiting anchoring')).toBe('you are exhibiting')
    expect(containsBannedTerm('we recommend the outside view')).toBe(true)
    // ...and a clean sentence is not a false positive, or the check above is
    // just "everything trips".
    expect(containsBannedTerm('Compare with a relevant reference class.')).toBe(false)
  })

  it('every string the two new chips render is glossary-clean', () => {
    for (const id of ['outside_view', 'pre_mortem']) {
      const entry = catalogue(id)
      for (const copy of [entry.title, entry.description]) {
        expect(
          containsBannedTerm(copy),
          `${id} renders "${copy}", which trips ${findBannedTerm(copy)}`,
        ).toBe(false)
      }
    }
  })

  /**
   * ⭐ THE RULING, AS A TEST. "You are anchoring" is an accusation and a claim
   * about a person this estate cannot support. The chip names the METHOD, so the
   * bias name must not appear in it — the observation stays the producer's own
   * card copy, which is rendered elsewhere and is not ours to author.
   */
  it('the chip names the method, never the bias it answers', () => {
    const anchoring = methodFor(biasBlock('Anchoring'))!
    for (const copy of [anchoring.title, anchoring.description]) {
      expect(copy.toLowerCase()).not.toContain('anchor')
      expect(copy.toLowerCase()).not.toContain('bias')
    }
    const overconfidence = methodFor(biasBlock('Overconfidence'))!
    for (const copy of [overconfidence.title, overconfidence.description]) {
      expect(copy.toLowerCase()).not.toContain('overconfiden')
      expect(copy.toLowerCase()).not.toContain('bias')
    }
  })

  /** No outcome is promised: neither chip claims the result or confidence moves. */
  it('neither chip promises an outcome', () => {
    for (const id of ['outside_view', 'pre_mortem']) {
      const entry = catalogue(id)
      const copy = `${entry.title} ${entry.description}`.toLowerCase()
      for (const promise of ['will improve', 'improves', 'more accurate', 'better result']) {
        expect(copy, `${id} promises an outcome: "${promise}"`).not.toContain(promise)
      }
    }
  })
})

describe('the panel’s display budget is untouched', () => {
  /**
   * ⚠ MAX_PHASE3_PROMOTED = 4 EXISTS SO THE PANEL IS NOT A WALL OF CARDS, and
   * this change cannot pressure it: it mints NO recommendation and changes which
   * method chip an already-promoted row displays. Pinned rather than asserted in
   * prose, because "my change cannot affect the cap" is exactly the sort of claim
   * that goes stale.
   */
  it('a bias card adds no recommendation — the count is unchanged', () => {
    const withoutBias = buildRecommendations({ ...baseInputs, phase3Items: [] })
    const items = toItems([biasBlock('Anchoring')])
    const withBias = buildRecommendations({ ...baseInputs, phase3Items: items })
    // One producer card in, one producer row out — the bias code rides the row
    // that already existed rather than minting a second one.
    expect(withBias.length).toBe(withoutBias.length + 1)
    expect(withBias.filter((r) => r.biasCode === 'anchoring')).toHaveLength(1)
  })
})

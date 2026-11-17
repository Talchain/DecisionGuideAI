/**
 * sx-fields (17 Nov 2026): the link, headline and model adapters for core's additive View fields (link.direction + link.confidence, no
 * weight; headline.of; model.first_draft). For each: rows with the field PRESENT (the producer's own output, olumi-core 993eb784, copied
 * into fixtures/producer-993eb784.json, and hand-built rows over the ruled value sets; invented words only), a row with it ABSENT (real
 * legacy links and Views: the bench's saved Views, copied into fixtures/bench-legacy.json, and the repo's served fixtures; bound by from,
 * to and kind or by id, each with an exact value), a cross-check of the fallback against the producer on the producer's own goldens with
 * the new keys stripped, and a row with it NULL, each with a contrast record.
 */
import { describe, expect, it, vi } from 'vitest'
vi.mock('../../../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { View, ViewLink, ViewModel } from '../../../client'
import { linkRole } from '../../contract'
import { CONFIDENCES, DIRECTIONS, firstDraft, headlineOf, linkLook, type FieldLink, type ViewHeadline } from '../fields'

// Paths from the repository root (vitest's working directory).
type Bench = Record<'t08' | 't09', { version: View['version']; model: ViewModel }>
const BENCH = JSON.parse(readFileSync(path.resolve('src/olumiView/v12/fields/__tests__/fixtures/bench-legacy.json'), 'utf8')) as Bench
const served = (f: string) => JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures', f), 'utf8')) as View
const BAKERY = served('core-38eebca9/bakery.view3.json'), STUDIO_FACE = served('cardface/studio.view3.json'), STUDIO = served('core-38eebca9/studio.view3.json')
const REVEAL = served('j1/strategy-reveal-split.core-261df1d4.view3.json')
const linkOf = (m: ViewModel, from: string, to: string, kind: ViewLink['kind']): ViewLink => {
  const l = m.links.find((x) => x.from === from && x.to === to && x.kind === kind)
  if (l === undefined) throw new Error(`fixture has no ${kind} link ${from} -> ${to}`)
  return l
}
const withFields = (link: ViewLink, f: Record<string, unknown>): ViewLink => ({ ...link, ...f }) as ViewLink
const T08 = BENCH.t08.model, T09 = BENCH.t09.model
const LOWERS = linkOf(T08, 'opt_push', 'annual_rent', 'plain')
/** The producer's output (olumi-core 993eb784 goldens): the bakery's links whole and its options' headline words, the studio's model whole. */
type Producer = {
  bakery: { version: View['version']; first_draft: boolean; cards: Record<string, { headline_of?: string }>; links: FieldLink[] }
  studio: { version: View['version']; collab: View['collab']; model: ViewModel & { first_draft: boolean } }
}
const PRODUCER = JSON.parse(readFileSync(path.resolve('src/olumiView/v12/fields/__tests__/fixtures/producer-993eb784.json'), 'utf8')) as Producer
/** A producer line as an older core would send it: the same record with direction and confidence taken off. */
const stripLink = (l: ViewLink): ViewLink => Object.fromEntries(Object.entries(l).filter(([k]) => k !== 'direction' && k !== 'confidence')) as ViewLink

describe('linkLook', () => {
  it('fixtures are the legacy shape: no link carries direction, confidence or weight', () => {
    for (const l of [...T08.links, ...T09.links, ...STUDIO_FACE.model!.links, ...STUDIO.model!.links, ...REVEAL.model!.links]) {
      for (const k of ['direction', 'confidence', 'weight']) expect(k in l, `${l.from}->${l.to}.${k}`).toBe(false)
    }
  })

  it('PRESENT: every ruled direction and confidence is taken as core sends it, over the inference (this link infers lowers)', () => {
    for (const direction of DIRECTIONS) {
      expect(linkLook(withFields(LOWERS, { direction })), direction).toMatchObject({ direction, causal: true, source: 'view', directionState: 'present', basis: null })
    }
    for (const confidence of CONFIDENCES) {
      expect(linkLook(withFields(LOWERS, { direction: 'raises', confidence })), confidence).toMatchObject({ confidence, confidenceState: 'present' })
    }
  })

  it('PRESENT: a value the page does not know is unknown, never a sign; weight is never read', () => {
    expect(linkLook(withFields(LOWERS, { direction: 'up', confidence: 'high' }))).toMatchObject({ direction: 'unknown', causal: true, confidence: 'unknown', directionState: 'unrecognised', confidenceState: 'unrecognised' })
    expect(linkLook(withFields(LOWERS, { direction: 'raises', weight: 0.8 }))).toMatchObject({ weight: null, weightState: 'ignored' })
    expect(linkLook(withFields(LOWERS, { direction: 'raises', weight: null }))).toMatchObject({ weight: null, weightState: 'null' })
    // CONTRAST: a sized legacy strength (strength.share) is never a weight either.
    expect(linkLook(withFields(LOWERS, { causal: { ...LOWERS.causal!, strength: { ...LOWERS.causal!.strength, share: 0.9 } } }))).toMatchObject({ weight: null, weightState: 'absent' })
  })

  it('ABSENT: real legacy links read by today\'s rule, bound by from, to and kind', () => {
    const rows: [ViewModel, string, string, ViewLink['kind'], string | null, string | null, string][] = [
      // model, from, to, kind, linkRole, direction, basis
      [T08, 'opt_push', 'annual_rent', 'plain', 'effect', 'lowers', 'typed-causal'],
      [T08, 'opt_push', 'annual_rent', 'through', 'effect', null, 'calculation'],
      [T08, 'f_rent_ask', 'annual_rent', 'replaces', null, null, 'untyped'],
      [T08, 'risk_landlord_holds', 'opt_push', 'plain', null, null, 'untyped'],
      [T08, 'ev_offer', 'opt_push', 'reason', 'reason', null, 'reason'],
      [T09, 'opt_robots', 'aim_pay', 'plain', 'effect', 'unknown', 'typed-causal'],
      [T09, 'opt_carry_on', 'aim_pay', 'plain', null, null, 'untyped'],
      [STUDIO.model!, 'evening_classes', 'member_mood', 'plain', null, 'raises', 'typed-causal'],
      [STUDIO_FACE.model!, 'evening_classes', 'member_mood', 'plain', null, 'raises', 'legacy-label'],
      [REVEAL.model!, 'speed_to_value', 'pilot_conversion', 'plain', null, 'lowers', 'legacy-label'],
      // causal.disputed is true here and is not read: the producer says `depends` for this very line, which the legacy record cannot tell.
      [STUDIO.model!, 'member_mood', 'members', 'plain', null, 'unknown', 'typed-causal'],
      [BAKERY.model!, 'second_oven', 'sales', 'through', null, null, 'calculation'],
    ]
    for (const [model, from, to, kind, role, direction, basis] of rows) {
      const link = linkOf(model, from, to, kind), id = `${from}->${to}:${kind}`
      expect(linkRole(link), `${id}: today's role`).toBe(role)
      expect(linkLook(link), id).toEqual({ direction, confidence: null, weight: null, causal: direction !== null, source: 'inferred', directionState: 'absent', confidenceState: 'absent', weightState: 'absent', basis })
    }
  })

  it('ABSENT: the legacy record carries what the rule read (typed sign, the label glyph) and what it does not (disputed, doubt)', () => {
    // A calculation's term can carry a typed sign; the producer still says it is no causal belief, and so does the fallback.
    expect(linkOf(BAKERY.model!, 'second_oven', 'sales', 'through').causal?.sign).toBe('increases')
    expect([LOWERS.causal?.sign, LOWERS.causal?.disputed, LOWERS.doubt]).toEqual(['decreases', false, true])
    expect(linkLook(LOWERS).confidence, 'a doubted link has no confidence of its own').toBeNull()
    const disputed = linkOf(STUDIO.model!, 'member_mood', 'members', 'plain')
    expect([disputed.causal?.sign, disputed.causal?.disputed]).toEqual(['unknown', true])
    expect([linkOf(STUDIO_FACE.model!, 'evening_classes', 'member_mood', 'plain').causal, linkOf(STUDIO_FACE.model!, 'evening_classes', 'member_mood', 'plain').label]).toEqual([undefined, '+'])
    expect([linkOf(REVEAL.model!, 'speed_to_value', 'pilot_conversion', 'plain').causal, linkOf(REVEAL.model!, 'speed_to_value', 'pilot_conversion', 'plain').label]).toEqual([undefined, '−'])
    expect([linkOf(STUDIO.model!, 'evening_classes', 'member_mood', 'plain').causal?.sign, linkOf(STUDIO.model!, 'evening_classes', 'member_mood', 'plain').causal?.disputed]).toEqual(['increases', false])
  })

  it('ABSENT: spread onto a real link: core\'s "no effect" sign reads unknown; a role line is never an effect, even with a typed sign', () => {
    expect(linkLook(withFields(LOWERS, { causal: { ...LOWERS.causal!, sign: 'none' } }))).toMatchObject({ direction: 'unknown', basis: 'typed-causal' })
    expect(linkLook(withFields(LOWERS, { causal: { ...LOWERS.causal!, disputed: true } })), 'disputed is not read').toMatchObject({ direction: 'lowers', basis: 'typed-causal' })
    for (const role of ['input', 'size', 'measures', 'target']) expect(linkLook(withFields(LOWERS, { role })), role).toMatchObject({ direction: null, causal: false, basis: 'role-line' })
    expect(linkLook(withFields(LOWERS, { role: 'effect' })).direction, 'CONTRAST: role effect keeps the typed sign').toBe('lowers')
    expect(linkLook(withFields(LOWERS, { kind: 'through' })), 'a typed sign on a calculation line').toMatchObject({ direction: null, causal: false, basis: 'calculation' })
    // An effect role on a line that is not a calculation, with no typed causal: drawn as an effect, direction unknown.
    expect(linkLook(withFields(linkOf(T08, 'opt_push', 'annual_rent', 'through'), { kind: 'plain' }))).toMatchObject({ direction: 'unknown', causal: true, basis: 'effect-role' })
  })

  it('PRESENT (producer 993eb784): every bakery and studio line reads the producer\'s direction and confidence as sent', () => {
    const lines = [...PRODUCER.bakery.links, ...(PRODUCER.studio.model.links as FieldLink[])]
    expect(lines.length).toBe(13 + 17)
    for (const l of lines) {
      expect('direction' in l && 'confidence' in l, `${l.from}->${l.to}:${l.kind}`).toBe(true)
      expect(linkLook(l), `${l.from}->${l.to}:${l.kind}`).toMatchObject({ direction: l.direction, confidence: l.confidence, causal: l.direction !== null, source: 'view', basis: null })
    }
    // CONTRAST: the studio's two causal beliefs, each its own direction and confidence.
    const studio = PRODUCER.studio.model
    expect(linkLook(linkOf(studio, 'evening_classes', 'member_mood', 'plain'))).toMatchObject({ direction: 'raises', confidence: 'likely' })
    expect(linkLook(linkOf(studio, 'member_mood', 'members', 'plain'))).toMatchObject({ direction: 'depends', confidence: 'unsure' })
  })

  it('ABSENT, CROSS-CHECK (producer 993eb784 bakery and studio, direction and confidence stripped): the fallback agrees on every line but the one `depends`', () => {
    const differ: string[] = []
    for (const l of [...PRODUCER.bakery.links, ...(PRODUCER.studio.model.links as FieldLink[])]) {
      const got = linkLook(stripLink(l))
      expect(got.source).toBe('inferred')
      if (got.direction !== l.direction) differ.push(`${l.from}->${l.to}:${l.kind} ${String(l.direction)}/${String(got.direction)}`)
    }
    // Never a wrong sign: the producer's conditional line reads unknown from the legacy record.
    expect(differ).toEqual(['member_mood->members:plain depends/unknown'])
  })

  it('NULL: core\'s null means not a causal belief, over a typed sign; null confidence stays null', () => {
    expect(linkLook(withFields(LOWERS, { direction: null, confidence: null }))).toEqual({ direction: null, confidence: null, weight: null, causal: false, source: 'view', directionState: 'null', confidenceState: 'null', weightState: 'absent', basis: null })
    expect(linkLook(LOWERS).direction, 'CONTRAST: the same link with nothing sent').toBe('lowers')
  })
})

describe('headlineOf', () => {
  const card = BAKERY.model!.cards.find((c) => c.id === 'second_oven')!
  const headline = card.headline as ViewHeadline

  it('PRESENT: core\'s plain words for what the chance is of', () => {
    expect(headlineOf({ ...headline, of: 'selling enough loaves to cover the second oven' } as ViewHeadline)).toEqual({ of: 'selling enough loaves to cover the second oven', state: 'present', source: 'view' })
  })

  it('PRESENT (producer 993eb784): a chance headline carries `of` in run.aim\'s words; a fixed one carries none (the producer\'s own absent)', () => {
    const of = PRODUCER.bakery.cards.second_oven!.headline_of!
    expect(of).toBe('‘Sell at least 360 loaves a week’')
    expect(headlineOf({ ...headline, of } as ViewHeadline)).toEqual({ of, state: 'present', source: 'view' })
    const studio = PRODUCER.studio.model.cards, evening = studio.find((c) => c.id === 'evening_classes')!.headline!, weekend = studio.find((c) => c.id === 'weekend_workshops')!.headline!
    expect(headlineOf(evening)).toEqual({ of: '‘Take £2,640 a month’', state: 'present', source: 'view' })
    // CONTRAST: a fixed headline from the same producer has no `of`, and the face must not write one.
    expect([weekend.state, 'of' in weekend]).toEqual(['fixed', false])
    expect(headlineOf(weekend)).toEqual({ of: null, state: 'absent', source: 'absent' })
  })

  it('ABSENT: a real headline with no `of` gives null, never words of the page\'s own (bakery second_oven)', () => {
    expect(headline.aim_id).toBe('sell_360')
    expect('of' in headline).toBe(false)
    expect(headlineOf(headline)).toEqual({ of: null, state: 'absent', source: 'absent' })
    // CONTRAST: a bench option card holds no headline at all (core's null), which is not the same answer.
    const push = T08.cards.find((c) => c.id === 'opt_push')!
    expect(push.headline).toBeNull()
    expect(headlineOf(push.headline)).toEqual({ of: null, state: 'no-headline', source: 'absent' })
  })

  it('NULL (never sent by the producer, read defensively): kept apart from absent; a blank string is not words', () => {
    expect(headlineOf({ ...headline, of: null } as unknown as ViewHeadline)).toEqual({ of: null, state: 'null', source: 'view' })
    expect(headlineOf({ ...headline, of: ' ' } as unknown as ViewHeadline)).toEqual({ of: null, state: 'unrecognised', source: 'absent' })
  })
})

describe('firstDraft', () => {
  const withModel = (v: View, f: Record<string, unknown>): View => ({ ...v, model: { ...v.model!, ...f } }) as View

  it('PRESENT: core\'s first_draft as sent, over the version rule', () => {
    expect(firstDraft(withModel(BAKERY, { first_draft: true }))).toEqual({ firstDraft: true, source: 'view', state: 'present' })
    // CONTRAST: core's false wins even where the version rule would say true.
    expect(firstDraft({ ...withModel(BAKERY, { first_draft: false }), version: null })).toEqual({ firstDraft: false, source: 'view', state: 'present' })
  })

  it('PRESENT and CROSS-CHECK (producer 993eb784 studio): false on an approved version; the fallback on the stripped model says the same', () => {
    const { version, collab, model } = PRODUCER.studio
    expect([version?.n, model.first_draft, PRODUCER.bakery.first_draft]).toEqual([1, false, false])
    const produced = { version, collab, model } as unknown as View
    expect(firstDraft(produced)).toEqual({ firstDraft: false, source: 'view', state: 'present' })
    const { first_draft: _fd, ...legacy } = model
    expect(firstDraft({ version, collab, model: legacy } as unknown as View)).toEqual({ firstDraft: false, source: 'inferred', state: 'absent' })
  })

  it('ABSENT: today\'s rule: a model with a version number has had an approval (bakery, bench t08), one with none has not', () => {
    expect([BAKERY.version?.n, 'first_draft' in BAKERY.model!]).toEqual([1, false])
    expect(firstDraft(BAKERY)).toEqual({ firstDraft: false, source: 'inferred', state: 'absent' })
    const t08 = { ...BAKERY, version: BENCH.t08.version, model: BENCH.t08.model } as View
    expect([BENCH.t08.version?.n, firstDraft(t08).firstDraft]).toEqual([1, false])
    // CONTRAST: no fixture holds a pending first draft, so the real View has its version taken away (no approval yet).
    expect(firstDraft({ ...BAKERY, version: null })).toEqual({ firstDraft: true, source: 'inferred', state: 'absent' })
  })

  it('NULL (never sent by the producer, read defensively): treated as absent, and the state says null; no model has nothing to draw it on', () => {
    expect(firstDraft(withModel(BAKERY, { first_draft: null }))).toEqual({ firstDraft: false, source: 'inferred', state: 'null' })
    expect(firstDraft({ ...withModel(BAKERY, { first_draft: null }), version: null }).firstDraft, 'CONTRAST').toBe(true)
    expect(firstDraft({ ...BAKERY, model: null })).toEqual({ firstDraft: null, source: null, state: 'no-model' })
  })
})

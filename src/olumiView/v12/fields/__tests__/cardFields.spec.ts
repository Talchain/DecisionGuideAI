/**
 * sx-fields (17 Nov 2026): the card adapters for core's additive View fields (card.kind + card.aim, card.row, card.title_short +
 * card.description, card.needs). For each: rows with the field PRESENT (the producer's own values, olumi-core 993eb784, copied into
 * fixtures/producer-993eb784.json, and hand-built rows over the ruled value sets; invented words only), a row with it ABSENT (a real legacy
 * card: the bench's saved Views, copied into fixtures/bench-legacy.json, or the repo's served bakery fixture; the fallback equals today's
 * rule on that same record, bound by the card's id and an exact value), a cross-check of the fallback against the producer on the
 * producer's own studio golden with the new keys stripped, and a row with it NULL, each with a contrast record that gives a different answer.
 */
import { describe, expect, it, vi } from 'vitest'
vi.mock('../../../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { View, ViewCard, ViewModel } from '../../../client'
import { cardKindOf } from '../../cards/kind'
import { bandOf } from '../../bands/bands'
import { CARD_KINDS, CARD_ROWS, cardKind, cardRow, cardTitle, KIND_OF_SHAPE, needsOf, ROW_OF_BAND, type CardFields, type FieldCard, type NeedWire } from '../fields'

// Paths from the repository root (vitest's working directory).
type Bench = Record<'t08' | 't09' | 't10' | 't11' | 't12', { model: ViewModel }>
const BENCH = JSON.parse(readFileSync(path.resolve('src/olumiView/v12/fields/__tests__/fixtures/bench-legacy.json'), 'utf8')) as Bench
const BAKERY = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/core-38eebca9/bakery.view3.json'), 'utf8')) as View
const T08 = BENCH.t08.model, T09 = BENCH.t09.model, T10 = BENCH.t10.model, T11 = BENCH.t11.model, T12 = BENCH.t12.model, BAKERY_MODEL = BAKERY.model!
/** The producer's output (olumi-core 993eb784 goldens): the bakery's new card fields by id, and the studio's model whole. */
type Producer = {
  bakery: { cards: Record<string, CardFields & { headline_of?: string }> }
  studio: { version: View['version']; collab: View['collab']; model: ViewModel }
}
const PRODUCER = JSON.parse(readFileSync(path.resolve('src/olumiView/v12/fields/__tests__/fixtures/producer-993eb784.json'), 'utf8')) as Producer
const NEW_CARD_KEYS = ['kind', 'aim', 'row', 'title_short', 'description', 'needs'] as const
const strip = (c: ViewCard): ViewCard => Object.fromEntries(Object.entries(c).filter(([k]) => !(NEW_CARD_KEYS as readonly string[]).includes(k))) as ViewCard
/** The producer's studio as an older core would send it: the same records with the new card keys taken off. */
const STUDIO_MODEL = PRODUCER.studio.model
const STUDIO_LEGACY_MODEL = { ...STUDIO_MODEL, cards: STUDIO_MODEL.cards.map(strip) } as ViewModel
const STUDIO_LEGACY_VIEW = { version: PRODUCER.studio.version, collab: PRODUCER.studio.collab, model: STUDIO_LEGACY_MODEL } as unknown as View
/** The producer's own fields for a bakery card, spread onto the repo's served bakery card with the same id (the producer keyed them so). */
const producedBakery = (id: string): ViewCard => {
  const { headline_of: _of, ...fields } = PRODUCER.bakery.cards[id]!
  return withFields(cardOf(BAKERY_MODEL, id), fields)
}
const cardOf = (m: ViewModel, id: string): ViewCard => {
  const c = m.cards.find((x) => x.id === id)
  if (c === undefined) throw new Error(`fixture has no card ${id}`)
  return c
}
/** A served card with core's new fields spread on, as core will send them. */
const withFields = (card: ViewCard, f: CardFields | Record<string, unknown>): ViewCard => ({ ...card, ...f }) as ViewCard

describe('fixtures are the legacy shape (none of the new fields)', () => {
  it('no bench or bakery card carries kind, aim, row, title_short, description or needs; the stripped studio carries none either', () => {
    const cards = [...T08.cards, ...T09.cards, ...T10.cards, ...T11.cards, ...T12.cards, ...BAKERY_MODEL.cards, ...STUDIO_LEGACY_MODEL.cards]
    expect([T08, T09, T10, T11, T12].map((m) => m.cards.length)).toEqual([6, 3, 1, 1, 1])
    for (const c of cards) for (const k of NEW_CARD_KEYS) expect(k in c, `${c.id}.${k}`).toBe(false)
    // CONTRAST: the producer's studio carries every built field on every card, and no row (993eb784: card.row not built).
    for (const c of STUDIO_MODEL.cards) {
      for (const k of ['kind', 'aim', 'title_short', 'description', 'needs']) expect(k in c, `producer ${c.id}.${k}`).toBe(true)
      expect('row' in c, `producer ${c.id}.row`).toBe(false)
    }
  })
})

describe('cardKind', () => {
  it('PRESENT: every ruled kind is taken as core sends it, over the inference (f_rent_ask infers driver)', () => {
    const base = cardOf(T08, 'f_rent_ask')
    for (const kind of CARD_KINDS) {
      expect(cardKind(withFields(base, { kind }), T08), kind).toEqual({ kind, aim: null, aimSource: null, source: 'view', state: 'present', shape: null })
    }
  })

  it('PRESENT (producer 993eb784): the bakery\'s own kinds and aims, read as sent', () => {
    expect(PRODUCER.bakery.cards.spend).toMatchObject({ kind: 'result', aim: null })
    expect(cardKind(producedBakery('spend'), BAKERY_MODEL, BAKERY)).toEqual({ kind: 'result', aim: null, aimSource: null, source: 'view', state: 'present', shape: null })
    expect(cardKind(producedBakery('sell_360'), BAKERY_MODEL)).toEqual({ kind: 'aim', aim: 'goal', aimSource: 'view', source: 'view', state: 'present', shape: null })
    expect(cardKind(producedBakery('within_budget'), BAKERY_MODEL)).toEqual({ kind: 'aim', aim: 'limit', aimSource: 'view', source: 'view', state: 'present', shape: null })
    // CONTRAST: a figure the producer calls a driver, and an option.
    expect(cardKind(producedBakery('base_sales'), BAKERY_MODEL).kind).toBe('driver')
    expect(cardKind(producedBakery('second_oven'), BAKERY_MODEL).kind).toBe('option')
  })

  it('PRESENT: a limit is kind aim with aim limit; core\'s aim wins over the family (a goal card sent as a limit reads limit)', () => {
    expect(cardKind(withFields(cardOf(T10, 'lim_budget'), { kind: 'aim', aim: 'limit' }), T10)).toEqual({ kind: 'aim', aim: 'limit', aimSource: 'view', source: 'view', state: 'present', shape: null })
    expect(cardKind(withFields(cardOf(T09, 'aim_pay'), { kind: 'aim', aim: 'limit' }), T09).aim).toBe('limit')
    // CONTRAST: kind aim with no aim field sent falls to the family (goal), and says it inferred that part.
    expect(cardKind(withFields(cardOf(T09, 'aim_pay'), { kind: 'aim' }), T09)).toMatchObject({ kind: 'aim', aim: 'goal', aimSource: 'inferred', source: 'view' })
  })

  it('ABSENT: real legacy cards map today\'s cardKindOf shape, bound by id, each the same as cardKindOf on that record', () => {
    const rows: [ViewModel, string, string, string, string | null][] = [
      // model, card id, cardKindOf shape, mapped kind, aim
      [T08, 'f_rent_ask', 'input', 'driver', null],
      [T08, 'annual_rent', 'calculated', 'result', null],
      [T08, 'opt_push', 'option', 'option', null],
      [T08, 'risk_landlord_holds', 'risk', 'risk', null],
      [T08, 'ev_offer', 'other', 'note', null],
      [T09, 'aim_pay', 'aim', 'aim', 'goal'],
      [T10, 'lim_budget', 'aim', 'aim', 'limit'],
      [T11, 'assume_payer', 'assumption', 'note', null],
    ]
    for (const [model, id, shape, kind, aim] of rows) {
      const card = cardOf(model, id)
      expect(cardKindOf(card, model).shape, `${id}: today's shape`).toBe(shape)
      expect(cardKind(card, model), id).toEqual({ kind, aim, aimSource: aim === null ? null : 'inferred', source: 'inferred', state: 'absent', shape })
      expect(KIND_OF_SHAPE[cardKindOf(card, model).shape], `${id}: the mapping of today's answer`).toBe(kind)
    }
  })

  it('ABSENT: a dissent is a position (the producer\'s one family rule on an `other` shape); any other `other` stays a note', () => {
    const dissent = cardOf(T12, 'dis_postdoc')
    expect([dissent.family, cardKindOf(dissent, T12).shape]).toEqual(['dissent', 'other'])
    expect(cardKind(dissent, T12)).toEqual({ kind: 'position', aim: null, aimSource: null, source: 'inferred', state: 'absent', shape: 'other' })
    expect(cardKind(cardOf(T08, 'ev_offer'), T08).kind, 'CONTRAST: evidence, also `other`').toBe('note')
  })

  it('ABSENT, CROSS-CHECK (producer 993eb784 studio, new keys stripped): the fallback agrees with the producer on every card but members', () => {
    const differ: [string, string, string][] = []
    for (const produced of STUDIO_MODEL.cards) {
      const legacy = cardOf(STUDIO_LEGACY_MODEL, produced.id), got = cardKind(legacy, STUDIO_LEGACY_MODEL, STUDIO_LEGACY_VIEW)
      const want = produced as FieldCard
      expect(got.source).toBe('inferred')
      if (got.kind !== want.kind || (got.kind === 'aim' && got.aim !== want.aim)) differ.push([produced.id, String(want.kind), got.kind])
    }
    // The one known gap: an aim measures `members` (producer `result`); cardKindOf sees no relation into it, so the fallback says driver.
    expect(differ).toEqual([['members', 'result', 'driver']])
    expect(STUDIO_MODEL.cards.length).toBe(15)
  })

  it('ABSENT: model and view go to cardKindOf as given (the bakery\'s waiting spend is calculated with or without the view)', () => {
    const spend = cardOf(BAKERY_MODEL, 'spend')
    expect(cardKindOf(spend, BAKERY_MODEL, BAKERY)).toEqual({ shape: 'calculated', state: 'pending' })
    expect(cardKind(spend, BAKERY_MODEL, BAKERY)).toMatchObject({ kind: 'result', shape: 'calculated', source: 'inferred' })
    // CONTRAST: the same record read without the model's links loses its outcome tier, as cardKindOf itself does.
    const annual = cardOf(T08, 'annual_rent')
    expect([cardKindOf(annual, null).shape, cardKind(annual, null).kind]).toEqual(['input', 'driver'])
  })

  it('ABSENT: the view decides where only the relation records tell (bakery sales with its working taken off, no model)', () => {
    // No served fixture has a figure whose shape rests on the view alone, so `worked` is taken off a real card: only the relation with a
    // sized term into it (look/WorkedSteps isWorkedOut, read from the View) still says it is worked out.
    const bare = withFields(cardOf(BAKERY_MODEL, 'sales'), { worked: undefined })
    expect([cardKindOf(bare, null, BAKERY).shape, cardKindOf(bare, null).shape]).toEqual(['calculated', 'input'])
    expect(cardKind(bare, null, BAKERY)).toMatchObject({ kind: 'result', shape: 'calculated' })
    expect(cardKind(bare, null)).toMatchObject({ kind: 'driver', shape: 'input' })
  })

  it('NULL and UNRECOGNISED: answered as an older core would, and the state says which', () => {
    const card = cardOf(T08, 'annual_rent')
    expect(cardKind(withFields(card, { kind: null }), T08)).toEqual({ kind: 'result', aim: null, aimSource: null, source: 'inferred', state: 'null', shape: 'calculated' })
    expect(cardKind(withFields(card, { kind: 'factor' }), T08)).toMatchObject({ kind: 'result', source: 'inferred', state: 'unrecognised' })
    expect(cardKind(withFields(cardOf(T08, 'f_rent_ask'), { kind: null }), T08).kind, 'CONTRAST: another record').toBe('driver')
  })
})

describe('cardRow', () => {
  it('PRESENT: every ruled row is taken as core sends it, over the inference (f_rent_ask infers drives)', () => {
    const base = cardOf(T08, 'f_rent_ask')
    for (const row of CARD_ROWS) expect(cardRow(withFields(base, { row }), T08), row).toEqual({ row, source: 'view', state: 'present', band: null })
  })

  it('ABSENT: real legacy cards map today\'s bandOf band, bound by id, each the same as bandOf on that record', () => {
    const rows: [ViewModel, string, string, string][] = [
      [T08, 'opt_push', 'options', 'options'],
      [T08, 'f_rent_ask', 'inputs', 'drives'],
      // DL 21 Nov: notes stand in their own row ("Points raised"), which the contract maps to the row they stood in before.
      [T08, 'ev_offer', 'points', 'drives'],
      [T08, 'annual_rent', 'outcomes', 'happens'],
      [T08, 'risk_landlord_holds', 'outcomes', 'happens'],
      [T09, 'aim_pay', 'aims', 'aims'],
      [T10, 'lim_budget', 'aims', 'aims'],
      [T11, 'assume_payer', 'points', 'drives'],
    ]
    for (const [model, id, band, row] of rows) {
      const card = cardOf(model, id)
      expect(bandOf(card, model), `${id}: today's band`).toBe(band)
      expect(cardRow(card, model), id).toEqual({ row, source: 'inferred', state: 'absent', band })
      expect(ROW_OF_BAND[bandOf(card, model)]).toBe(row)
    }
  })

  it('FALLBACK-ONLY (producer 993eb784 builds no row): every producer studio card answers from bandOf', () => {
    for (const c of STUDIO_MODEL.cards) {
      expect(cardRow(c, STUDIO_MODEL), c.id).toEqual({ row: ROW_OF_BAND[bandOf(c, STUDIO_MODEL)], source: 'inferred', state: 'absent', band: bandOf(c, STUDIO_MODEL) })
    }
    // CONTRAST: an option and a figure the producer calls a result stand in different rows.
    expect([cardRow(cardOf(STUDIO_MODEL, 'evening_classes'), STUDIO_MODEL).row, cardRow(cardOf(STUDIO_MODEL, 'takings'), STUDIO_MODEL).row]).toEqual(['options', 'happens'])
  })

  it('NULL and UNRECOGNISED: answered as an older core would', () => {
    expect(cardRow(withFields(cardOf(T08, 'annual_rent'), { row: null }), T08)).toEqual({ row: 'happens', source: 'inferred', state: 'null', band: 'outcomes' })
    expect(cardRow(withFields(cardOf(T08, 'annual_rent'), { row: 'outcomes' }), T08)).toEqual({ row: 'happens', source: 'inferred', state: 'unrecognised', band: 'outcomes' })
    expect(cardRow(withFields(cardOf(T08, 'opt_push'), { row: null }), T08).row, 'CONTRAST: another record').toBe('options')
  })
})

describe('cardTitle', () => {
  it('PRESENT: core\'s short title and description, never the heading', () => {
    const card = withFields(cardOf(T08, 'f_rent_ask'), { title_short: 'Rent asked', description: 'What the shop would pay a year under the new ask.' })
    expect(cardTitle(card)).toEqual({ title: 'Rent asked', titleIsHeading: false, description: 'What the shop would pay a year under the new ask.', source: 'title_short', titleShortState: 'present', descriptionState: 'present' })
  })

  it('PRESENT (producer 993eb784): the bakery\'s own label and origin sentence; the studio\'s relation card holds only a sentence (null)', () => {
    expect(cardTitle(producedBakery('spend'))).toEqual({ title: 'Spend', titleIsHeading: false, description: "Olumi's estimate", source: 'title_short', titleShortState: 'present', descriptionState: 'present' })
    expect(cardTitle(producedBakery('oven_price'))).toMatchObject({ title: 'Oven price', description: null, descriptionState: 'null' })
    const relation = cardOf(STUDIO_MODEL, 'mood_members') as FieldCard
    expect([relation.family, relation.title_short, relation.description]).toEqual(['relation', null, null])
    expect(cardTitle(relation)).toEqual({ title: relation.heading, titleIsHeading: true, description: null, source: 'heading', titleShortState: 'null', descriptionState: 'null' })
  })

  it('ABSENT: the whole heading stands in, flagged, and no description is made from heading or detail', () => {
    const rent = cardOf(T08, 'f_rent_ask'), offer = cardOf(T08, 'ev_offer')
    expect(cardTitle(rent)).toEqual({ title: "Landlord's proposed rent", titleIsHeading: true, description: null, source: 'heading', titleShortState: 'absent', descriptionState: 'absent' })
    expect(rent.detail).not.toBe('')
    // CONTRAST: another record gives its own heading, and a long sentence comes back whole (clipping is the face's).
    expect(cardTitle(cardOf(T08, 'annual_rent')).title).toBe('Annual rent paid')
    expect(cardTitle(offer).title).toBe(offer.heading)
    expect(cardTitle(offer).title).toBe('Spoke to the agent informally: the landlord would accept £25k on a 5-year term with a break at year 3.')
  })

  it('NULL: core\'s null is kept apart from absent; a blank string is neither a title nor a description', () => {
    const rent = cardOf(T08, 'f_rent_ask')
    expect(cardTitle(withFields(rent, { title_short: null, description: null }))).toEqual({ title: "Landlord's proposed rent", titleIsHeading: true, description: null, source: 'heading', titleShortState: 'null', descriptionState: 'null' })
    expect(cardTitle(withFields(rent, { title_short: '  ', description: '' }))).toMatchObject({ title: "Landlord's proposed rent", titleIsHeading: true, description: null, titleShortState: 'unrecognised', descriptionState: 'unrecognised' })
    // CONTRAST: a short title sent with a null description keeps the title.
    expect(cardTitle(withFields(rent, { title_short: 'Rent asked', description: null }))).toMatchObject({ title: 'Rent asked', titleIsHeading: false, description: null, descriptionState: 'null' })
  })
})

describe('needsOf', () => {
  const spend = cardOf(BAKERY_MODEL, 'spend'), sales = cardOf(BAKERY_MODEL, 'sales')
  const NEED: NeedWire = { id: 'deposit_size', label: 'deposit size', edit: { prompt: 'New figure for “deposit size”', ask: 'For “deposit size”, type one number.' } }

  it('PRESENT: core\'s needs as sent, over the waiting figure\'s operands', () => {
    expect(needsOf(withFields(spend, { needs: [NEED, { id: 'fit_out', label: 'fit-out cost', edit: null }] }))).toEqual({
      needs: [NEED, { id: 'fit_out', label: 'fit-out cost', edit: null }], source: 'view', state: 'present',
    })
  })

  it('PRESENT (producer 993eb784): spend waits on oven_price by record, not on its working\'s operands; a figure that waits on nothing is []', () => {
    const produced = PRODUCER.bakery.cards.spend!.needs!
    expect(produced.map((n) => n.id)).toEqual(['oven_price'])
    expect(needsOf(producedBakery('spend'))).toEqual({ needs: produced, source: 'view', state: 'present' })
    expect(needsOf(producedBakery('sales'))).toEqual({ needs: [], source: 'view', state: 'present' })
    // CONTRAST: the fallback on the same record over-lists (the working's operands), the gap the producer closes.
    expect(needsOf(spend).needs.map((n) => n.id)).toEqual(['oven_cost', 'ovens_added'])
  })

  it('ABSENT: a waiting figure lists its own working\'s operands, in core\'s order, each with core\'s own editor (bakery spend)', () => {
    expect(spend.figure?.state).toBe('waits')
    const got = needsOf(spend)
    expect(got.source).toBe('inferred')
    expect(got.state).toBe('absent')
    expect(got.needs.map((n) => [n.id, n.label])).toEqual([['oven_cost', 'oven cost'], ['ovens_added', 'ovens added']])
    expect(got.needs[0]!.edit).toBeNull()
    expect(got.needs[1]!.edit).toBe(spend.worked!.steps[1]!.edit)
    // CONTRAST: a worked-out figure that does not wait needs nothing; a bench figure with no working needs nothing.
    expect(sales.worked).not.toBeNull()
    expect(needsOf(sales)).toEqual({ needs: [], source: 'inferred', state: 'absent' })
    expect(needsOf(cardOf(T08, 'annual_rent'))).toEqual({ needs: [], source: 'inferred', state: 'absent' })
  })

  it('ABSENT: an effect\'s term lists its coefficient after it, as MadeOf names it beside the step', () => {
    const waiting = withFields(sales, { figure: { ...sales.figure!, state: 'waits' } })
    expect(needsOf(waiting).needs.map((n) => n.id)).toEqual(['base_sales', 'ovens_added', 'extra_sold_per_oven', 'hours_on', 'extra_hours_sold'])
  })

  it('NULL (never sent by the producer, read defensively): no needs, not the inferred operands; a malformed list answers as an older core would', () => {
    expect(needsOf(withFields(spend, { needs: null }))).toEqual({ needs: [], source: 'view', state: 'null' })
    expect(needsOf(withFields(spend, { needs: [{ id: 'oven_cost' }] }))).toMatchObject({ source: 'inferred', state: 'unrecognised' })
    expect(needsOf(withFields(spend, { needs: [{ id: 'oven_cost' }] })).needs.map((n) => n.id)).toEqual(['oven_cost', 'ovens_added'])
  })
})

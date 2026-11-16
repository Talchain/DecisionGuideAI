/**
 * V12 card faces (16 Nov): shapes by kind, the option letter, baseline, a withheld chance's reason at rest, an unsized input, the qualifier
 * line, Olumi's question mark and the authorship marks, on the real card (previous/CoreCard.tsx) at both levels and on the Simple face.
 * Fixtures are the repo's served Views (core-38eebca9, cardface, real); every expected word is core's own field, bound by card id. A field
 * core adds today (baseline, a withheld value) is spread onto a fixture card, each with its contrast.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('../../../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
vi.mock('@xyflow/react', async () => ({ ...(await vi.importActual<object>('@xyflow/react')), Handle: () => null }))
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render } from '@testing-library/react'
import { ReactFlowProvider, type NodeProps } from '@xyflow/react'
import type { View, ViewCard } from '../../../client'
import { useViewStore } from '../../../store'
import { useMe } from '../../../../olumiCore/me'
import { CoreCard } from '../../../previous/CoreCard'
import { setDefaultLevel, useSimpleLevel, type Level } from '../../simpleStore'
import { bandRowsOf, chanceWordsOf, optionLetterOf, SimpleFace } from '../../SimpleFace'
import { cardKindOf, dsKindOf } from '../kind'
import { letterAt, optionLetters } from '../letters'
import { OLUMI_ASKS } from '../marks'
import { chanceParts, headlineChanceRow, unsizedWords } from '../words'

const load = (f: string) => JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures', f), 'utf8')) as View
const ASKED = load('core-38eebca9/bakery-asked.view3.json'), EU = load('core-38eebca9/european.view3.json')
const FACE = load('cardface/bakery.view3.json'), CAPACITY = load('real/capacity.view3.json')
const cardOf = (v: View, id: string): ViewCard => v.model!.cards.find((c) => c.id === id)!
/** The same View with one card replaced: a field core adds today, spread onto a served card. */
const withCard = (v: View, card: ViewCard): View => ({ ...v, model: { ...v.model!, cards: v.model!.cards.map((c) => (c.id === card.id ? card : c)) } })

const Node = CoreCard as unknown as (p: NodeProps) => JSX.Element
/** The real card, at a level, on a View. */
const draw = (view: View, id: string, level: Level = 'working'): HTMLElement => {
  setDefaultLevel(level)
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false, at: null } as never)
  useMe.setState({ me: { id: view.you_id, name: view.you }, status: 'ready' })
  return render(<ReactFlowProvider><Node {...({ id, type: 'viewCard', data: { card: cardOf(view, id) }, selected: false, dragging: false, zIndex: 0, isConnectable: false,
    positionAbsoluteX: 0, positionAbsoluteY: 0, selectable: true, deletable: false, draggable: false } as unknown as NodeProps)} /></ReactFlowProvider>).container
}
const faceOf = (el: HTMLElement, id: string) => el.querySelector<HTMLElement>(`[data-core-card="${id}"]`)!

beforeEach(() => { window.localStorage.clear(); useSimpleLevel.setState({ levels: {} }) })
afterEach(() => { cleanup(); setDefaultLevel('simple'); useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none' } as never); useMe.setState({ me: null, status: 'none' }) })

describe('option letters: one source, core\'s option card order', () => {
  it('T1 A, B, C by card id in core\'s option order, from the View or its model; a card that is not an option has none', () => {
    const options = ASKED.model!.cards.filter((c) => c.family === 'option').map((c) => c.id)
    expect(options).toEqual(['second_oven', 'longer_hours', 'carry_on'])
    expect([...optionLetters(ASKED)]).toEqual([['second_oven', 'A'], ['longer_hours', 'B'], ['carry_on', 'C']])
    expect([...optionLetters(ASKED.model)]).toEqual([...optionLetters(ASKED)])
    expect(optionLetters(ASKED).has('sales'), 'CONTRAST: a figure has no letter').toBe(false)
    expect([optionLetterOf(ASKED.model!, 'longer_hours'), optionLetterOf(ASKED.model!, 'sales')]).toEqual(['B', '·'])
    expect([optionLetters(null).size, optionLetters({ ...ASKED, model: null }).size]).toEqual([0, 0])
  })

  it('T2 the letters follow core\'s order, not the ids: the same options in another order are lettered in that order; past Z no two share one', () => {
    const cards = ASKED.model!.cards, moved = [...cards.filter((c) => c.id === 'carry_on'), ...cards.filter((c) => c.id !== 'carry_on')]
    expect([...optionLetters({ ...ASKED.model!, cards: moved })]).toEqual([['carry_on', 'A'], ['second_oven', 'B'], ['longer_hours', 'C']])
    expect([letterAt(0), letterAt(25), letterAt(26), letterAt(27)]).toEqual(['A', 'Z', 'AA', 'AB'])
  })
})

describe('the card\'s kind, from the View\'s structure (canvas rule 5)', () => {
  const kind = (v: View, id: string) => cardKindOf(cardOf(v, id), v.model, v)

  it('K1 option, input, calculated (done and pending), aim, assumption and risk are told apart by family, working and state, never by words', () => {
    expect(kind(ASKED, 'second_oven')).toEqual({ shape: 'option', state: null })
    expect(kind(ASKED, 'oven_price'), 'a figure nobody has sized is an input').toEqual({ shape: 'input', state: null })
    expect([cardOf(ASKED, 'sales').worked != null, kind(ASKED, 'sales')]).toEqual([true, { shape: 'calculated', state: 'done' }])
    expect([cardOf(ASKED, 'spend').figure?.state, kind(ASKED, 'spend')]).toEqual(['waits', { shape: 'calculated', state: 'pending' }])
    expect([kind(ASKED, 'sell_360').shape, kind(ASKED, 'within_budget').shape, kind(ASKED, 'oven_repair').shape]).toEqual(['aim', 'aim', 'risk'])
    expect(kind(EU, 'customer_flow_assumptions').shape).toBe('assumption')
  })

  it('K2 CONTRAST: a figure the options set carries per-option values but is not worked out from others: an input, not a double outline', () => {
    const churn = cardOf(EU, 'churn_rate'), customers = cardOf(EU, 'customers')
    expect([(churn.values?.length ?? 0) > 1, churn.worked == null], 'precondition: values, no working').toEqual([true, true])
    expect(kind(EU, 'churn_rate')).toEqual({ shape: 'input', state: null })
    expect([(customers.values?.length ?? 0) > 1, customers.worked != null, kind(EU, 'customers').shape]).toEqual([true, true, 'calculated'])
  })

  it('K3 withheld only where core says so (a `values_withheld` entry); an option merely missing from the values is not a withheld state', () => {
    const sales = cardOf(ASKED, 'sales')
    // Core's own field: values[] holds only real bands; the option core could not calculate is in `values_withheld` with its reason.
    const held = { ...sales, values: sales.values!.filter((v) => v.option !== 'longer_hours'), values_withheld: [{ option: 'longer_hours', text: 'core\'s reason' }] } as ViewCard
    expect(cardKindOf(held, ASKED.model, ASKED)).toEqual({ shape: 'calculated', state: 'withheld' })
    const missing = { ...sales, values: sales.values!.filter((v) => v.option !== 'longer_hours') } as ViewCard
    expect(cardKindOf(missing, ASKED.model, ASKED)).toEqual({ shape: 'calculated', state: 'done' })
  })

  it('K4 the real card carries its kind for the look, at both levels, bound by card id', () => {
    for (const level of ['working', 'simple'] as const) {
      const got = (['second_oven', 'oven_price', 'spend', 'sales', 'sell_360', 'oven_repair'] as const).map((id) => {
        const f = faceOf(draw(ASKED, id, level), id); cleanup()
        return [id, f.getAttribute('data-ok-shape'), f.getAttribute('data-ok-state')]
      })
      expect(got, level).toEqual([['second_oven', 'option', null], ['oven_price', 'input', null], ['spend', 'calculated', 'pending'], ['sales', 'calculated', 'done'], ['sell_360', 'aim', null], ['oven_repair', 'risk', null]])
    }
  })

  it('K6 each V12 shape maps to one DS kind (shape says what a thing is); the real card carries it with the assumption mark, bound by card id', () => {
    expect([dsKindOf('option'), dsKindOf('input'), dsKindOf('calculated'), dsKindOf('aim'), dsKindOf('risk'), dsKindOf('assumption')]).toEqual(['option', 'factor', 'outcome', 'goal', 'risk', 'factor'])
    expect([dsKindOf('other', 'decision'), dsKindOf('other', 'action'), dsKindOf('other', 'unknown')]).toEqual(['decision', 'option', 'factor'])
    const got = (['second_oven', 'oven_price', 'sales', 'sell_360', 'oven_repair'] as const).map((id) => { const f = faceOf(draw(ASKED, id, 'working'), id); cleanup(); return [id, f.getAttribute('data-ok-kind'), f.hasAttribute('data-ok-assumption')] })
    expect(got).toEqual([['second_oven', 'option', false], ['oven_price', 'factor', false], ['sales', 'outcome', false], ['sell_360', 'goal', false], ['oven_repair', 'risk', false]])
    const a = faceOf(draw(EU, 'customer_flow_assumptions', 'working'), 'customer_flow_assumptions')
    expect([a.getAttribute('data-ok-kind'), a.hasAttribute('data-ok-assumption')]).toEqual(['factor', true])
  })

  it('K5 the look draws the design system\'s shape for every kind (DS v5 §10), keyed on data-ok-kind only, and reads the option\'s letter (jsdom draws no CSS, so the stylesheet is read)', () => {
    const css = readFileSync(path.resolve('src/olumiView/look/olumiLook.css'), 'utf8')
    for (const kind of ['factor', 'option', 'goal', 'decision', 'risk', 'outcome']) expect(css, kind).toContain(`:has([data-ok-kind='${kind}'])`)
    expect(css).toContain(':has([data-ok-assumption])')
    // The V12 boards' own shape language (pills, double outlines, state dashes) is gone: nothing styles a card from data-ok-shape or data-ok-state.
    expect(css).not.toMatch(/data-ok-(shape|state)/)
    expect(css).toMatch(/:has\(\[data-ok-kind='option'\]\) \[data-testid='node-title'\]::before \{[^}]*content: var\(--ok-letter, ''\);/)
  })
})

describe('an option card: its letter, and "baseline" only where core marks it', () => {
  it('O1 each option card carries its letter in core\'s order (the face attribute and the node\'s --ok-letter); a figure carries none', () => {
    for (const [id, letter] of [['second_oven', 'A'], ['longer_hours', 'B'], ['carry_on', 'C']] as const) {
      const el = draw(ASKED, id), f = faceOf(el, id)
      expect([id, f.getAttribute('data-option-letter'), (el.firstElementChild as HTMLElement).style.getPropertyValue('--ok-letter')]).toEqual([id, letter, `"${letter}"`]); cleanup()
    }
    const el = draw(ASKED, 'sales')
    expect([faceOf(el, 'sales').hasAttribute('data-option-letter'), (el.firstElementChild as HTMLElement).style.getPropertyValue('--ok-letter')]).toEqual([false, ''])
  })

  it('O2 "baseline" is drawn only on the option core marks as the one the person already has, at both levels', () => {
    const marked = withCard(ASKED, { ...cardOf(ASKED, 'carry_on'), baseline: true } as ViewCard)
    for (const level of ['working', 'simple'] as const) {
      expect(draw(marked, 'carry_on', level).querySelector('[data-option-baseline="carry_on"]')?.textContent, level).toBe('baseline'); cleanup()
      expect(draw(marked, 'second_oven', level).querySelector('[data-option-baseline]'), `${level} CONTRAST: another option of the same View`).toBeNull(); cleanup()
      expect(draw(ASKED, 'carry_on', level).querySelector('[data-option-baseline]'), `${level} CONTRAST: core marks none, so none is guessed from the name`).toBeNull(); cleanup()
    }
  })
})

describe('a withheld chance gives its real reason at rest (canvas rule 4)', () => {
  const o = cardOf(ASKED, 'second_oven'), h = o.headline!

  it('W1 Detailed: "?" and a dashed empty track named by core\'s state words, core\'s reason as the caption, "Why not" kept for the long form', () => {
    expect([h.state, (h.why ?? '') !== '', h.why !== h.text], 'precondition: withheld, with a reason').toEqual(['none', true, true])
    const face = draw(ASKED, o.id).querySelector<HTMLElement>(`[data-core-lead="${o.id}"]`)!
    const part = face.querySelector<HTMLElement>(`[data-withheld-chance="${o.id}"]`)!
    expect(part.querySelector('.ok-q')?.textContent).toBe('?')
    expect(part.querySelector(`[data-testid="${o.id}-empty-bar"]`)?.getAttribute('aria-label')).toBe(h.text)
    const caption = part.querySelector<HTMLElement>(`[data-withheld-caption="${o.id}"]`)!
    expect([caption.textContent, caption.getAttribute('title')]).toEqual([h.why, h.why])
    expect(part.querySelector('details.ok-why summary')?.textContent).toBe('Why not')
    expect(face.querySelector('.ok-track'), 'no chance track: nothing is placed').toBeNull()
  })

  it('W2 Simple: the same parts on the compact face, the reason whole on hover with core\'s next step; never the bare state words', () => {
    const face = draw(ASKED, o.id, 'simple').querySelector<HTMLElement>('[data-simple-face="no-chance"]')!
    expect(face.querySelector(`[data-withheld-caption="${o.id}"]`)?.textContent).toBe(h.why)
    expect(face.querySelector(`[data-testid="${o.id}-empty-bar"]`)).not.toBeNull()
    expect(face.getAttribute('title')).toBe(`${h.why}\n${h.add}`)
    expect(face.querySelector('summary')?.textContent).toBe('Why not')
    expect(face.textContent).not.toContain(h.text)
  })

  it('W3 CONTRAST: where core sends no reason, its own state words stand under the track and no caption is made up; a chance draws none of this', () => {
    const bare = { ...o, headline: { ...h, why: null, title: '' } } as ViewCard
    const face = render(<SimpleFace card={bare} model={ASKED.model} noted={false} />).container
    expect([face.querySelector('[data-withheld-caption]'), face.querySelector(`[data-simple-state="${o.id}"]`)?.textContent]).toEqual([null, h.text])
    cleanup()
    const chance = cardOf(FACE, 'second_oven')
    expect(chance.headline!.state).toBe('chance')
    for (const level of ['working', 'simple'] as const) { expect(draw(FACE, chance.id, level).querySelector('[data-withheld-chance]'), level).toBeNull(); cleanup() }
  })
})

describe('a figure with no value yet, and one that waits', () => {
  it('U1 an unsized input is a dashed empty bar with core\'s own words for the gap, at both levels', () => {
    for (const [view, id] of [[ASKED, 'oven_price'], [EU, 'profitability']] as const) {
      const words = cardOf(view, id).figure!.title
      expect([cardOf(view, id).figure!.text, words !== '', unsizedWords(cardOf(view, id))]).toEqual(['', true, words])
      for (const level of ['working', 'simple'] as const) {
        const part = draw(view, id, level).querySelector<HTMLElement>(`[data-unsized="${id}"]`)!
        expect([level, part.querySelector(`[data-testid="${id}-empty-bar"]`) !== null, part.querySelector(`[data-unsized-words="${id}"]`)?.textContent, part.getAttribute('title')]).toEqual([level, true, words, words]); cleanup()
      }
    }
  })

  it('U2 CONTRAST: a sized figure draws no empty bar and no gap words', () => {
    for (const level of ['working', 'simple'] as const) { expect(draw(ASKED, 'base_sales', level).querySelector('[data-unsized], [data-testid="base_sales-empty-bar"]'), level).toBeNull(); cleanup() }
    expect(unsizedWords(cardOf(ASKED, 'base_sales'))).toBeNull()
  })

  it('U3 pending: a calculated figure that waits on an input is a dashed empty track over core\'s own "waits on" words, never a headline figure', () => {
    const spend = cardOf(ASKED, 'spend')
    const detailed = draw(ASKED, 'spend').querySelector<HTMLElement>('[data-core-lead="spend"]')!
    expect([detailed.getAttribute('data-ok-face'), detailed.hasAttribute('data-ok-pending'), detailed.querySelector('[data-testid="spend-empty-bar"]') !== null, detailed.querySelector('.ok-status [data-core-lead-clamp]')?.textContent])
      .toEqual(['worked', true, true, spend.figure!.text])
    expect(detailed.querySelector('.ok-fig')).toBeNull(); cleanup()
    const simple = draw(ASKED, 'spend', 'simple').querySelector<HTMLElement>('[data-simple-face="pending"]')!
    expect([simple.querySelector('[data-testid="spend-empty-bar"]') !== null, simple.querySelector('[data-simple-pending="spend"]')?.textContent, simple.getAttribute('title')]).toEqual([true, spend.figure!.text, spend.figure!.title]); cleanup()
    expect(draw(ASKED, 'base_sales', 'simple').querySelector('[data-simple-face="pending"]'), 'CONTRAST: a stated figure').toBeNull()
  })
})

describe('the qualifier under a chance is its own line, with Olumi\'s mark where the chance rests on Olumi\'s figures', () => {
  const o = cardOf(EU, 'broader_entry'), row = headlineChanceRow(o)!, parts = chanceParts(row.value)

  it('Q1 core\'s chance line splits at core\'s own first clause; a line with no clause is whole; the row is bound by the headline\'s aim', () => {
    expect([parts.qualifier !== null, `${parts.head}, ${parts.qualifier}`], 'precondition: core\'s words carry a clause').toEqual([true, row.value])
    expect(parts.head.endsWith(' chance')).toBe(true)
    const plain = cardOf(FACE, 'second_oven')
    expect(chanceParts(headlineChanceRow(plain)!.value)).toEqual({ head: plain.headline!.text, qualifier: null })
    expect([row.aim_id, headlineChanceRow(cardOf(ASKED, 'second_oven'))]).toEqual([o.headline!.aim_id, null])
  })

  it('Q2 Simple: the number\'s words, then the qualifier line led by Olumi\'s mark (named by core\'s words for it); core\'s value words stay whole and in order', () => {
    const el = draw(EU, o.id, 'simple')
    const words = el.querySelector<HTMLElement>(`[data-simple-chance="${o.id}"]`)!, qual = words.querySelector<HTMLElement>(`[data-simple-qual="${o.id}"]`)!
    expect(words.textContent).toBe(chanceWordsOf(o))
    expect(qual.textContent).toBe(parts.qualifier)
    expect(row.olumi, 'precondition: the chance rests on Olumi\'s figures').not.toBeNull()
    expect(qual.querySelector('[data-olumi-mark]')?.getAttribute('aria-label')).toBe(row.olumi!.title)
  })

  it('Q3 Detailed: Olumi\'s mark leads the qualifier line and core\'s glyph is not drawn a second time beside the number', () => {
    const el = draw(EU, o.id)
    const qual = el.querySelector<HTMLElement>(`[data-view="${o.id}.headline.qualifier"]`)!
    expect([qual.textContent, qual.querySelector('[data-olumi-mark]')?.getAttribute('aria-label')]).toEqual([parts.qualifier, row.olumi!.title])
    expect(el.querySelector(`[data-view="${o.id}.row.olumi.glyph"]`)).toBeNull()
  })

  it('Q4 CONTRAST: a chance with no clause has no qualifier line; its mark stays beside the number (core\'s glyph in Detailed, Olumi\'s mark in Simple)', () => {
    const plain = cardOf(FACE, 'second_oven'), r = headlineChanceRow(plain)!
    expect(r.olumi).not.toBeNull()
    const detailed = draw(FACE, plain.id)
    expect([detailed.querySelector(`[data-view="${plain.id}.headline.qualifier"]`), detailed.querySelector(`[data-view="${plain.id}.row.olumi.glyph"]`)?.getAttribute('title')]).toEqual([null, r.olumi!.title]); cleanup()
    const simple = draw(FACE, plain.id, 'simple').querySelector<HTMLElement>(`[data-simple-chance="${plain.id}"]`)!
    expect([simple.querySelector('[data-simple-qual]'), simple.textContent, simple.querySelector('[data-olumi-mark]')?.getAttribute('aria-label')]).toEqual([null, r.value, r.olumi!.title]); cleanup()
    const own = cardOf(FACE, 'carry_on')
    expect(headlineChanceRow(own)!.olumi, 'precondition: a chance on the person\'s own figures').toBeNull()
    expect(draw(FACE, own.id, 'simple').querySelector(`[data-simple-chance="${own.id}"] [data-olumi-mark]`), 'no mark where core sets none').toBeNull()
  })
})

describe('"Olumi has a question about this" is Olumi\'s mark, named by core\'s own label', () => {
  const next = CAPACITY.chat.find((t) => t.answer?.next.newest === true)!.answer!.next

  it('A1 Simple: the card core puts its step beside wears Olumi\'s mark in a ring, named by core\'s label; never a speech bubble', () => {
    expect([next.at !== null, next.label !== ''], 'precondition: core names a card and a label').toEqual([true, true])
    const mark = draw(CAPACITY, next.at!, 'simple').querySelector<HTMLElement>(`[data-olumi-asks="${next.at}"]`)!
    expect([mark.getAttribute('aria-label'), mark.getAttribute('title'), mark.getAttribute('data-simple-note')]).toEqual([next.label, next.label, next.at])
    expect(mark.querySelector('[data-icon="olumi-ai"]')).not.toBeNull()
    expect(mark.querySelector('.lucide-message-circle')).toBeNull()
  })

  it('A2 CONTRAST: another card of the same View wears none; where core sends no label the mark has its fixed name', () => {
    const other = CAPACITY.model!.cards.find((c) => c.id !== next.at && c.family === 'quantity')!
    expect(draw(CAPACITY, other.id, 'simple').querySelector('[data-olumi-asks]')).toBeNull(); cleanup()
    const el = render(<SimpleFace card={other} model={CAPACITY.model} noted notedWords="" />).container
    expect(el.querySelector(`[data-olumi-asks="${other.id}"]`)?.getAttribute('aria-label')).toBe(OLUMI_ASKS)
  })
})

describe('authorship: Olumi\'s mark and a person\'s are distinct on the card, core\'s author words on hover', () => {
  const olumis = cardOf(EU, 'horizon'), theirs = cardOf(EU, 'starting_customers')
  const said = (c: ViewCard) => `${c.author!.text} · ${c.author!.title}`

  it('M1 Simple: Olumi\'s card wears Olumi\'s mark and no person, a person\'s card the person\'s and no Olumi; each named by core\'s author words', () => {
    expect([olumis.author!.by, theirs.author!.by]).toEqual(['olumi', 'person'])
    const a = draw(EU, olumis.id, 'simple').querySelector<HTMLElement>('[data-simple-author]')!
    expect([a.getAttribute('data-simple-author'), a.querySelector('[data-olumi-mark] [data-icon="olumi-ai"]') !== null, a.querySelector('[data-person-mark]'), a.getAttribute('title')]).toEqual(['olumi', true, null, said(olumis)]); cleanup()
    const b = draw(EU, theirs.id, 'simple').querySelector<HTMLElement>('[data-simple-author]')!
    expect([b.getAttribute('data-simple-author'), b.querySelector('[data-person-mark]') !== null, b.querySelector('[data-olumi-mark]'), b.getAttribute('title')]).toEqual(['person', true, null, said(theirs)])
  })

  it('M2 Detailed: the author line leads with the same mark and still says core\'s author words, nothing added to them', () => {
    const a = draw(EU, olumis.id).querySelector<HTMLElement>(`[data-core-author="${olumis.id}"]`)!
    expect([a.querySelector('[data-author-mark]')?.getAttribute('data-author-mark'), a.querySelector('[data-olumi-mark]') !== null, a.textContent?.includes(olumis.author!.text)]).toEqual(['olumi', true, true]); cleanup()
    const b = draw(EU, theirs.id).querySelector<HTMLElement>(`[data-core-author="${theirs.id}"]`)!
    expect([b.querySelector('[data-author-mark]')?.getAttribute('data-author-mark'), b.querySelector('[data-person-mark]') !== null, b.querySelector('[data-olumi-mark]'), b.textContent]).toEqual(['person', true, null, theirs.author!.text])
  })

  it('M3 a card core says is mixed wears both marks; a card with no author and no Olumi mark wears none', () => {
    const mixed = { ...theirs, author: { ...theirs.author!, by: 'mixed' as const } }
    const m = render(<SimpleFace card={mixed} model={EU.model} noted={false} />).container.querySelector<HTMLElement>('[data-simple-author="mixed"]')!
    expect([m.querySelector('[data-olumi-mark]') !== null, m.querySelector('[data-person-mark]') !== null]).toEqual([true, true]); cleanup()
    const none = { ...theirs, author: null, olumi: null }
    expect(render(<SimpleFace card={none} model={EU.model} noted={false} />).container.querySelector('[data-author-mark]')).toBeNull()
  })
})

describe('an assumption wears its tag', () => {
  it('G1 "assumption" on an assumption card at both levels; CONTRAST: a figure wears none', () => {
    for (const level of ['working', 'simple'] as const) {
      expect(draw(EU, 'customer_flow_assumptions', level).querySelector('[data-kind-tag-of="customer_flow_assumptions"]')?.textContent, level).toBe('assumption'); cleanup()
      expect(draw(EU, 'starting_customers', level).querySelector('[data-kind-tag]'), level).toBeNull(); cleanup()
    }
  })
})

describe('a calculated figure core could not calculate for an option says so, with core\'s reason (canvas rules 4 and 5)', () => {
  const sales = cardOf(ASKED, 'sales')
  // Core's field (contract.ts withheldValues): `values_withheld` [{ option, text }], text being core's reason; values[] holds only the real bands. The text is a stand-in.
  const REASON = 'core\'s own reason for this option'
  const held = withCard(ASKED, { ...sales, values: sales.values!.filter((v) => v.option !== 'longer_hours'), values_withheld: [{ option: 'longer_hours', text: REASON }] } as ViewCard)

  it('H1 Detailed: the outcome strips give the option its own dashed row (its letter, a dashed empty track, core\'s reason) and no value line or range strip; the card\'s state is withheld', () => {
    const el = draw(held, 'sales'), row = el.querySelector<HTMLElement>('[data-testid="strip-withheld-longer_hours"]')!
    expect(row, 'the withheld option has its own row').not.toBeNull()
    expect(faceOf(el, 'sales').getAttribute('data-ok-state')).toBe('withheld')
    expect([row.querySelector('span')?.textContent, row.textContent, row.style.border.includes('dashed')]).toEqual(['B', `Bnot calculated: ${REASON}`, true])
    expect(el.querySelector('[data-testid="strip-range-longer_hours"]'), 'no band for it').toBeNull()
    expect(el.querySelectorAll('[data-core-value="sales.longer_hours"]').length, 'no value line for it').toBe(0)
    expect(el.querySelectorAll('[data-testid="strip-withheld-longer_hours"]').length, 'drawn once').toBe(1)
    expect(el.querySelector('[data-core-value="sales.second_oven"] b')?.textContent, 'CONTRAST: a calculated option keeps its value line').toBe(sales.values!.find((v) => v.option === 'second_oven')!.text)
    expect(el.querySelector('[data-testid="strip-range-second_oven"]'), 'CONTRAST: and its strip').not.toBeNull()
  })

  it('H2 Simple: no band for the withheld option, a dashed row with its letter and core\'s reason; CONTRAST: the served card draws none', () => {
    expect(bandRowsOf(cardOf(held, 'sales'), held.model).map((b) => b.option)).not.toContain('longer_hours')
    const el = draw(held, 'sales', 'simple'), row = el.querySelector<HTMLElement>('[data-simple-withheld="longer_hours"]')!
    expect([row.querySelector('[data-letter-chip]')?.textContent, row.querySelector('[data-simple-withheld-why="longer_hours"]')?.textContent, el.querySelector('[data-simple-band="longer_hours"]')]).toEqual(['B', REASON, null])
    cleanup()
    expect(bandRowsOf(sales, ASKED.model).map((b) => b.option)).toContain('longer_hours')
    for (const level of ['working', 'simple'] as const) { expect(draw(ASKED, 'sales', level).querySelector('[data-testid^="strip-withheld-"], [data-simple-withheld]'), level).toBeNull(); cleanup() }
  })
})

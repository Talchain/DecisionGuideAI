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
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { ReactFlowProvider, type NodeProps } from '@xyflow/react'
import type { View, ViewCard } from '../../../client'
import { useViewStore } from '../../../store'
import { useMe } from '../../../../olumiCore/me'
import { CoreCard } from '../../../previous/CoreCard'
import { setDefaultLevel, useSimpleLevel, type Level } from '../../simpleStore'
import { bandRowsOf, chanceWordsOf, optionLetterOf, QUIET_BASIS, SimpleFace } from '../../SimpleFace'
import { cardKindOf, dsKindOf } from '../kind'
import { letterAt, optionLetters } from '../letters'
import { TIP_DELAY } from '../../../look/Tip'
import { ICONS } from '../../../look/icons'
import { cardMarksOf, LIMIT_MEANS, MARK_CAP, MORE_MARKS, OLUMI_ASKS, WORTH_ICON, worthCheckingOf, worthMarksOf } from '../marks'
import { chanceParts, headlineChanceRow, onceWords, sharedNoChanceOf, unsizedWords } from '../words'
import { needsOf } from '../../fields/fields'

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
/** What the one Tip says for a mark: the pointer comes to rest on it and the delay passes. A mark's hover is this, never a native `title` (system rule 3, 20 Nov). */
const hover = (mark: HTMLElement): string | null => {
  vi.useFakeTimers()
  try {
    fireEvent.pointerEnter(mark)
    act(() => { vi.advanceTimersByTime(TIP_DELAY) })
    return document.querySelector('[data-testid="lane-tip"]')?.textContent ?? null
  } finally { fireEvent.pointerLeave(mark); vi.useRealTimers() }
}
const imgOf = (mark: HTMLElement): HTMLElement => (mark.getAttribute('role') === 'img' ? mark : mark.querySelector<HTMLElement>('[role="img"]'))!
const faceOf = (el: HTMLElement, id: string) => el.querySelector<HTMLElement>(`[data-core-card="${id}"]`)!

beforeEach(() => { window.localStorage.clear(); useSimpleLevel.setState({ levels: {} }) })
afterEach(() => { cleanup(); setDefaultLevel('simple'); useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none' } as never); useMe.setState({ me: null, status: 'none' }) })

describe('a limit is drawn as a limit, never as a goal (DL from Paul\'s test, 17 Nov: three turns asking why a limit looked like a goal)', () => {
  it('L1 at both levels a limit card carries the limit kind (outlined square marker, grey frame) and the key\'s word "limit" with its meaning as the hover; CONTRAST: the goal on the same board keeps the goal kind and no tag', () => {
    for (const level of ['simple', 'working'] as const) {
      const lim = faceOf(draw(ASKED, 'within_budget', level), 'within_budget')
      const tag = lim.querySelector<HTMLElement>('[data-kind-tag="limit"]')!
      // C2 (20 Nov): the limit is a registry icon (no word drawn); the key's word for it and what a limit means are its name and its Tip.
      const words = `${ASKED.model!.key.find((k) => k.id === 'limit')!.text}\n${LIMIT_MEANS}`
      expect([level, lim.getAttribute('data-ok-kind'), tag.textContent, imgOf(tag).getAttribute('aria-label'), imgOf(tag).hasAttribute('title'), hover(imgOf(tag))]).toEqual([level, 'constraint', '', words, false, words])
      cleanup()
      const goal = faceOf(draw(ASKED, 'sell_360', level), 'sell_360')
      expect([level, goal.getAttribute('data-ok-kind'), goal.querySelector('[data-kind-tag="limit"]')]).toEqual([level, 'goal', null])
      cleanup()
    }
  })
  it('L1b core\'s own aim field decides over the family: a goal-family card core marks aim "limit" is a limit; a limit-family card core marks aim "goal" is a goal', () => {
    const asLimit = withCard(ASKED, { ...cardOf(ASKED, 'sell_360'), aim: 'limit' } as ViewCard)
    expect(faceOf(draw(asLimit, 'sell_360', 'simple'), 'sell_360').getAttribute('data-ok-kind')).toBe('constraint')
    cleanup()
    const asGoal = withCard(ASKED, { ...cardOf(ASKED, 'within_budget'), aim: 'goal' } as ViewCard)
    expect(faceOf(draw(asGoal, 'within_budget', 'simple'), 'within_budget').getAttribute('data-ok-kind')).toBe('goal')
  })
})

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
    // R1, R2 (16 Nov): the marker is BaseNode's real shape (CoreCard hands it the same kind, F4 below), so the stylesheet draws none of its own, hides none, and
    // the frame is the kind's full hue, never the 30 % mix.
    expect(css).not.toMatch(/\[role='group'\]\[aria-label\]::before/)
    expect(css).not.toMatch(/node-type-glyph'\] \{ display: none/)
    expect(css).toMatch(/border-color: var\(--ok-kc\) !important/)
    expect(css).not.toMatch(/color-mix\(in srgb, var\(--(ok-kc|option|factor|goal)\) 30%/)
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
      // C2: the baseline is a registry icon, not the word; core sends no words for it, so the registry's name is its name and its Tip.
      const base = draw(marked, 'carry_on', level).querySelector<HTMLElement>('[data-option-baseline="carry_on"]')!
      expect([level, base.textContent, imgOf(base).getAttribute('aria-label'), imgOf(base).hasAttribute('title'), hover(imgOf(base))], level).toEqual([level, '', ICONS['baseline-tag'].hover, false, ICONS['baseline-tag'].hover]); cleanup()
      expect(draw(marked, 'second_oven', level).querySelector('[data-option-baseline]'), `${level} CONTRAST: another option of the same View`).toBeNull(); cleanup()
      expect(draw(ASKED, 'carry_on', level).querySelector('[data-option-baseline]'), `${level} CONTRAST: core marks none, so none is guessed from the name`).toBeNull(); cleanup()
    }
  })
})

describe('an option with no chance says what is missing in one quiet line (R6, 16 Nov; was canvas rule 4)', () => {
  const o = cardOf(ASKED, 'second_oven'), h = o.headline!
  const gone = '.ok-q, summary, details, .ok-empty, .ok-track, [data-testid$="-empty-bar"], [data-withheld-chance]'

  // CHANGED BY DESIGN (Detailed redesign, Paul 17 Nov: each fact said once on the board, whose it is a mark; v12/detailed): every option on this board says the same step, so the aim
  // says it once and the option draws no empty track (detailed.spec DT1); the option's own line is checked where its step is its own.
  it('W1 Detailed: core\'s next step is the one line where it is the option\'s own, its reason and the step the hover; said once where every option says it; no "?", no "Why not"', () => {
    expect([h.state, (h.why ?? '') !== '', h.why !== h.text, (h.add ?? '') !== ''], 'precondition: withheld, with a reason and a next step').toEqual(['none', true, true, true])
    const shared = draw(ASKED, o.id).querySelector<HTMLElement>(`[data-core-lead="${o.id}"]`)!
    expect([shared.hasAttribute('data-said-once'), shared.querySelectorAll('.ok-quiet').length], 'said once on the aim, not here').toEqual([true, 0]); cleanup()
    const STEP = 'An invented next step for this option alone.'
    const face = draw(withCard(ASKED, { ...o, headline: { ...h, add: STEP } }), o.id).querySelector<HTMLElement>(`[data-core-lead="${o.id}"]`)!
    const line = face.querySelector<HTMLElement>('.ok-quiet')!
    expect([line.textContent, line.getAttribute('title')]).toEqual([STEP, `${h.why}\n${STEP}`])
    expect(face.querySelectorAll('.ok-quiet').length, 'one line').toBe(1)
    expect(face.querySelector(gone), 'nothing of the old withheld furniture').toBeNull()
    expect(face.textContent, 'unknown is never drawn as zero').not.toMatch(/\?|0%/)
  })

  it('W2 Simple: the same one line on the compact face; the reason whole on hover with core\'s next step; never the bare state words', () => {
    const face = draw(ASKED, o.id, 'simple').querySelector<HTMLElement>('[data-simple-face="no-chance"]')!
    expect(face.textContent).toBe(h.add)
    expect(face.getAttribute('title')).toBe(`${h.why}\n${h.add}`)
    expect(face.querySelector(gone)).toBeNull()
    expect(face.textContent).not.toContain(h.text)
  })

  it('W3 CONTRAST: where core sends no next step its headline\'s own words are the line, and no reason is made up; a chance draws none of this', () => {
    const bare = { ...o, headline: { ...h, why: null, title: '', add: null } } as ViewCard
    const face = render(<SimpleFace card={bare} model={ASKED.model} noted={false} />).container
    expect([face.querySelector(`[data-simple-state="${o.id}"]`)?.textContent, face.querySelector<HTMLElement>(`[data-simple-state="${o.id}"]`)?.title]).toEqual([h.text, h.text])
    cleanup()
    const chance = cardOf(FACE, 'second_oven')
    expect(chance.headline!.state).toBe('chance')
    // Bound to the headline's line: a limit row it could not work out keeps its own quiet line (Line reviewer F2), marked `data-withheld-row`.
    for (const level of ['working', 'simple'] as const) { expect(draw(FACE, chance.id, level).querySelector('.ok-quiet:not([data-withheld-row])'), level).toBeNull(); cleanup() }
  })
})

describe('a figure with no value yet, and one that waits', () => {
  // CHANGED BY DESIGN (the lead's ruling, 18 Nov: Paul's "no empty track at rest" covers figures too): Detailed draws core's words alone, as Simple does; the dashed bar is gone.
  it('U1 an unsized input says core\'s own words for the gap as ONE quiet line at both levels, with no empty bar and no track (R6, 16 Nov), once, the whole words the hover', () => {
    const GAP = [[ASKED, 'oven_price', 'not given yet · What would the second oven cost?'], [EU, 'profitability', 'not sized yet · Revenue per customer, margins, operating costs and the accounting treatment of expansion investment were not supplied.']] as const
    for (const [view, id, words] of GAP) {
      expect([cardOf(view, id).figure!.text, cardOf(view, id).figure!.title], 'precondition: no value, and core\'s own words for the gap').toEqual(['', words])
      for (const level of ['working', 'simple'] as const) {
        const el = draw(view, id, level), quiet = el.querySelector<HTMLElement>(`[data-unsized="${id}"]`)!
        expect([level, el.querySelectorAll(`[data-unsized="${id}"]`).length, el.querySelector('.ok-empty, .ok-unsized, [data-testid$="-empty-bar"]'), quiet.matches('p.ok-quiet'), quiet.textContent, quiet.getAttribute('title')]).toEqual([level, 1, null, true, words, words]); cleanup()
      }
    }
  })

  it('U1b onceWords: a clause core says twice is drawn once (case and a closing full stop ignored), nothing else changes; CONTRAST: two different clauses stay whole, in order', () => {
    expect(onceWords('not sized yet · Not sized yet.')).toBe('not sized yet')
    expect(onceWords('not sized yet · Not given.')).toBe('not sized yet · Not given.')
    expect(onceWords('a · b · b')).toBe('a · b')
    expect(onceWords('a · b · a')).toBe('a · b · a')
  })

  it('U2 CONTRAST: a sized figure draws no empty bar and no gap words', () => {
    for (const level of ['working', 'simple'] as const) { expect(draw(ASKED, 'base_sales', level).querySelector('[data-unsized], [data-testid="base_sales-empty-bar"]'), level).toBeNull(); cleanup() }
    expect(unsizedWords(cardOf(ASKED, 'base_sales'))).toBeNull()
  })

  // CHANGED BY DESIGN (the lead's ruling, 18 Nov: no empty track at rest covers figures too): Detailed draws core's "waits on" words alone; the dashed track is gone.
  it('U3 pending: a calculated figure that waits on an input is core\'s own "waits on" words, never a headline figure and never over an empty track: Detailed as its status line, Simple as one quiet line, its working closed (R6, D2)', () => {
    const spend = cardOf(ASKED, 'spend')
    expect([spend.figure!.state, spend.figure!.text], 'precondition: core says it waits, in these words').toEqual(['waits', 'waits on: oven price'])
    const card = draw(ASKED, 'spend'), detailed = card.querySelector<HTMLElement>('[data-core-lead="spend"]')!
    expect([detailed.getAttribute('data-ok-face'), detailed.hasAttribute('data-ok-pending'), card.querySelector('.ok-empty, [data-testid$="-empty-bar"]'), [...detailed.querySelectorAll('.ok-status [data-core-lead-clamp]')].map((e) => e.textContent)])
      .toEqual(['worked', true, null, ['waits on: oven price']])
    expect(detailed.querySelector('.ok-fig')).toBeNull(); cleanup()
    // CHANGED BY DESIGN (the lead's D2, 17 Nov: worked steps closed at rest; was R7, drawn open in the card's flow): Simple says core's "waits on" words as the
    // one quiet line, the working is not drawn open, and what it waits on (core's `needs`, fields.ts needsOf) is the line's hover after core's title.
    const el = draw(ASKED, 'spend', 'simple'), simple = el.querySelector<HTMLElement>('[data-simple-face="pending"]')!
    expect([simple.textContent, simple.title.split('\n')[0], simple.classList.contains('ok-two-lines')]).toEqual([spend.figure!.text, spend.figure!.title, true])
    expect(simple.title.split('\n').slice(1), 'what it waits on, by core\'s labels').toEqual(needsOf(spend).needs.map((n) => n.label))
    expect(el.querySelector('.ok-empty, [data-testid$="-empty-bar"]')).toBeNull()
    expect(el.querySelector('details.ok-steps-inline, [data-simple-below="spend"]'), 'the working is closed at rest').toBeNull()
    cleanup()
    expect(draw(ASKED, 'base_sales', 'simple').querySelector('[data-simple-face="pending"]'), 'CONTRAST: a stated figure').toBeNull()
  })

  it('U3b CONTRAST to U3: a figure that waits and has NO working draws core\'s "waits on" words as ONE quiet line (R6): no empty track, the whole words its hover', () => {
    const spend = cardOf(ASKED, 'spend'), view = withCard(ASKED, { ...spend, worked: null } as unknown as ViewCard)
    const line = draw(view, 'spend', 'simple').querySelector<HTMLElement>('[data-simple-face="pending"]')!
    expect([line.matches('p.ok-quiet'), line.textContent, line.getAttribute('title'), line.closest('[data-simple-card]')?.querySelector('.ok-empty, [data-testid$="-empty-bar"]')]).toEqual([true, spend.figure!.text, spend.figure!.title, null])
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

  // CHANGED BY DESIGN (the lead's D2, 17 Nov: one visual, one quiet line): the qualifier is the card's quiet line and Olumi's mark stays beside the number;
  // was: the qualifier line inside the chance's words, led by the mark.
  it('Q2 Simple: the number\'s words with Olumi\'s mark beside them (named by core\'s words for it), then the qualifier as the one quiet line; core\'s value words stay whole and in order', () => {
    const el = draw(EU, o.id, 'simple')
    const words = el.querySelector<HTMLElement>(`[data-simple-chance="${o.id}"]`)!, qual = el.querySelector<HTMLElement>(`[data-simple-qual="${o.id}"]`)!
    expect([words.textContent, qual.textContent, `${words.textContent}, ${qual.textContent}`]).toEqual([parts.head, parts.qualifier, chanceWordsOf(o)])
    expect(row.olumi, 'precondition: the chance rests on Olumi\'s figures').not.toBeNull()
    expect(words.querySelector('[data-olumi-mark]')?.getAttribute('aria-label')).toBe(row.olumi!.title)
  })

  // CHANGED BY DESIGN (Detailed redesign, Paul 17 Nov: each fact said once on the board, whose it is a mark; v12/detailed): every option here carries the same clause, so the
  // question's rail says it once and the option keeps Olumi's mark beside its number; a clause of its own is its line, Olumi's mark leading.
  it('Q3 Detailed: a clause every option carries is said once (no qualifier line; Olumi\'s mark beside the number); a clause of the option\'s own is its line, led by Olumi\'s mark; core\'s text glyph is never drawn', () => {
    const el = draw(EU, o.id)
    expect([el.querySelector(`[data-view="${o.id}.headline.qualifier"]`), el.querySelector(`[data-view="${o.id}.row.olumi"] [data-olumi-mark]`)?.getAttribute('aria-label')]).toEqual([null, row.olumi!.title])
    expect(el.querySelector(`[data-view="${o.id}.row.olumi.glyph"]`)).toBeNull(); cleanup()
    const CLAUSE = 'on an invented condition of this option alone'
    const mine = draw(withCard(EU, { ...o, headline: { ...o.headline!, text: `${parts.head}, ${CLAUSE}` } }), o.id)
    const qual = mine.querySelector<HTMLElement>(`[data-view="${o.id}.headline.qualifier"]`)!
    expect([qual.textContent, qual.querySelector('[data-olumi-mark]')?.getAttribute('aria-label')]).toEqual([CLAUSE, row.olumi!.title])
    expect(mine.querySelector(`[data-view="${o.id}.row.olumi.glyph"]`)).toBeNull()
  })

  it('Q4 CONTRAST: a chance with no clause has no qualifier line; its mark stays beside the number (core\'s glyph in Detailed, Olumi\'s mark in Simple)', () => {
    const plain = cardOf(FACE, 'second_oven'), r = headlineChanceRow(plain)!
    expect(r.olumi).not.toBeNull()
    const detailed = draw(FACE, plain.id)
    // CHANGED BY DESIGN (Detailed redesign, Paul 17 Nov: marks, not text glyphs): Olumi's mark beside the number in Detailed too, core's words its name.
    expect([detailed.querySelector(`[data-view="${plain.id}.headline.qualifier"]`), detailed.querySelector(`[data-view="${plain.id}.row.olumi"] [data-olumi-mark]`)?.getAttribute('aria-label')]).toEqual([null, r.olumi!.title]); cleanup()
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
    expect([mark.getAttribute('aria-label'), mark.hasAttribute('title'), hover(mark), mark.getAttribute('data-simple-note')]).toEqual([next.label, false, next.label, next.at])
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
    expect([a.getAttribute('data-simple-author'), a.querySelector('[data-olumi-mark] [data-icon="olumi-ai"]') !== null, a.querySelector('[data-person-mark]'), a.getAttribute('aria-label'), hover(a)]).toEqual(['olumi', true, null, said(olumis), said(olumis)]); cleanup()
    const b = draw(EU, theirs.id, 'simple').querySelector<HTMLElement>('[data-simple-author]')!
    expect([b.getAttribute('data-simple-author'), b.querySelector('[data-person-mark]') !== null, b.querySelector('[data-olumi-mark]'), b.getAttribute('aria-label'), hover(b)]).toEqual(['person', true, null, said(theirs), said(theirs)])
  })

  // CHANGED BY DESIGN (Detailed redesign, Paul 17 Nov: each fact said once on the board, whose it is a mark; v12/detailed): the author line is the mark alone, core's author
  // words its name and hover, as Simple draws it.
  it('M2 Detailed: whose a card is, is the same mark as Simple, core\'s author words its name; the words are not drawn', () => {
    const a = draw(EU, olumis.id).querySelector<HTMLElement>(`[data-core-author="${olumis.id}"]`)!
    expect([a.querySelector('[data-author-mark]')?.getAttribute('data-author-mark'), a.querySelector('[data-olumi-mark]') !== null, a.textContent, a.querySelector('[data-author-mark]')?.getAttribute('aria-label')?.startsWith(olumis.author!.text)]).toEqual(['olumi', true, '', true]); cleanup()
    const b = draw(EU, theirs.id).querySelector<HTMLElement>(`[data-core-author="${theirs.id}"]`)!
    expect([b.querySelector('[data-author-mark]')?.getAttribute('data-author-mark'), b.querySelector('[data-person-mark]') !== null, b.querySelector('[data-olumi-mark]'), b.textContent]).toEqual(['person', true, null, ''])
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
  it('G1 the assumption icon on an assumption card at both levels (C2: an icon, its words the Tip, no word drawn); CONTRAST: a figure wears none', () => {
    for (const level of ['working', 'simple'] as const) {
      const tag = draw(EU, 'customer_flow_assumptions', level).querySelector<HTMLElement>('[data-kind-tag-of="customer_flow_assumptions"]')!
      expect([level, tag.textContent, imgOf(tag).getAttribute('aria-label'), hover(imgOf(tag))]).toEqual([level, '', ICONS['assumption-tag'].hover, ICONS['assumption-tag'].hover]); cleanup()
      expect(draw(EU, 'starting_customers', level).querySelector('[data-kind-tag]'), level).toBeNull(); cleanup()
    }
  })
})

describe('a calculated figure core could not calculate for an option says so, with core\'s reason (canvas rules 4 and 5)', () => {
  const sales = cardOf(ASKED, 'sales')
  // Core's field (contract.ts withheldValues): `values_withheld` [{ option, text }], text being core's reason; values[] holds only the real bands. The text is a stand-in.
  const REASON = 'core\'s own reason for this option'
  const held = withCard(ASKED, { ...sales, values: sales.values!.filter((v) => v.option !== 'longer_hours'), values_withheld: [{ option: 'longer_hours', text: REASON }] } as ViewCard)

  // CHANGED BY DESIGN (Detailed redesign, Paul 17 Nov: each fact said once on the board, whose it is a mark; v12/detailed): each option's value is one strip row by its letter
  // (band, median, core's words: v12/detailed/charts.tsx Strips); a withheld option is its letter and core's reason, no lane.
  it('H1 Detailed: the strips give the withheld option its own row (its letter and core\'s reason, no lane) and no band or value; the card\'s state is withheld', () => {
    const el = draw(held, 'sales'), row = el.querySelector<HTMLElement>('[data-strip-withheld="longer_hours"]')!
    expect(row, 'the withheld option has its own row').not.toBeNull()
    expect(faceOf(el, 'sales').getAttribute('data-ok-state')).toBe('withheld')
    expect([row.querySelector('.ok-letter')?.textContent, row.querySelector('.ok-dt-strip-val')?.textContent, row.querySelector('.ok-dt-strip-lane, .ok-dt-rail-lane-empty')]).toEqual(['B', REASON, null])
    expect(el.querySelector('[data-strip="second_oven"] .ok-dt-strip-lane'), 'CONTRAST: a calculated option keeps its lane').not.toBeNull()
    expect(el.querySelector('[data-strip="longer_hours"]'), 'no band for it').toBeNull()
    expect(el.querySelectorAll('[data-core-value="sales.longer_hours"]').length, 'no value for it').toBe(0)
    expect(el.querySelectorAll('[data-strip-withheld="longer_hours"]').length, 'drawn once').toBe(1)
    expect(el.querySelector('[data-core-value="sales.second_oven"] .ok-dt-strip-val')?.textContent, 'CONTRAST: a calculated option keeps its value').toBe(sales.values!.find((v) => v.option === 'second_oven')!.text)
    expect(el.querySelector('[data-strip="second_oven"] [data-band-from]'), 'CONTRAST: and its band').not.toBeNull()
  })

  it('H2 Simple (R6, quiet): no band for the withheld option; it is named by its letter, then core\'s reason, with no dashed row and no empty track; CONTRAST: the served card draws none', () => {
    expect(bandRowsOf(cardOf(held, 'sales'), held.model).map((b) => b.option)).not.toContain('longer_hours')
    const el = draw(held, 'sales', 'simple'), row = el.querySelector<HTMLElement>('[data-simple-withheld="longer_hours"]')!
    expect([row.querySelector('[data-letter-chip]')?.textContent, el.querySelector('[data-simple-withheld-why="longer_hours"]')?.textContent, el.querySelector('[data-simple-band="longer_hours"]')]).toEqual(['B', REASON, null])
    expect(el.querySelector('.ok-empty, [data-testid$="-empty-bar"]'), 'no dashed empty track').toBeNull()
    expect(row.getAttribute('title'), 'the option and core\'s reason are the letter\'s hover').toContain(REASON)
    cleanup()
    expect(bandRowsOf(sales, ASKED.model).map((b) => b.option)).toContain('longer_hours')
    for (const level of ['working', 'simple'] as const) { expect(draw(ASKED, 'sales', level).querySelector('[data-testid^="strip-withheld-"], [data-simple-withheld]'), level).toBeNull(); cleanup() }
  })
})

describe('a first draft marks nothing as proposed (R3, 16 Nov); inside an approved model a proposal keeps its dashed blue frame', () => {
  const proposed = { ...cardOf(ASKED, 'second_oven'), change: { kind: 'added', glyph: '+', title: 'Olumi added this' }, author: { by: 'olumi', text: 'Proposed by Olumi', title: '' }, doubt: false, challenged: false } as unknown as ViewCard
  const approved = withCard(ASKED, proposed)
  const draft = { ...approved, version: null, proposal: { id: 'p1' } } as unknown as View
  const frame = (el: HTMLElement) => el.querySelector<HTMLElement>('[role="group"]')!.className
  it('F1 an approved model: the card Olumi proposes is Olumi\'s blue and dashed', () => {
    expect([approved.version != null, approved.proposal]).toEqual([true, null])
    const c = frame(draw(approved, proposed.id))
    expect(c).toContain('border-info'); expect(c).toContain('border-dashed')
  })
  it('F2 a first draft (a proposal and no approved version): the same card is its kind\'s own solid frame, neither blue nor dashed, and no banner is added', () => {
    const el = draw(draft, proposed.id), c = frame(el)
    expect(c).not.toContain('border-info'); expect(c).not.toContain('border-dashed')
    expect(c, 'the kind\'s own frame').toContain('border-option')
    expect(el.querySelector('[role="status"], [data-testid="draft-banner"]')).toBeNull()
  })
  const inDraft = (card: ViewCard): View => ({ ...draft, model: { ...draft.model!, cards: draft.model!.cards.map((x) => (x.id === proposed.id ? card : x)) } } as View)
  it('F3 a doubted card nobody proposed stays dashed on a first draft, in its kind\'s hue (never blue); a challenged one keeps core\'s orange', () => {
    const own = { ...proposed, change: null, author: { by: 'person', text: '', title: '' }, doubt: true } as unknown as ViewCard
    const c = frame(draw(inDraft(own), proposed.id))
    expect(c).toContain('border-dashed'); expect(c).not.toContain('border-info'); expect(c).toContain('border-option')
    cleanup()
    const o = frame(draw(inDraft({ ...proposed, challenged: true } as ViewCard), proposed.id))
    expect(o).toContain('olumi-mark-orange')
  })
  it('F3b R3: on a first draft core\'s `doubt` on a card Olumi proposed is the proposal itself, so it is NOT dashed; a figure that waits stays dashed; inside an approved model the same doubt is dashed', () => {
    const doubted = { ...proposed, doubt: true } as ViewCard
    expect(frame(draw(inDraft(doubted), proposed.id)), 'proposed + doubt on a first draft: solid').not.toContain('border-dashed'); cleanup()
    expect(frame(draw(inDraft({ ...doubted, figure: { text: 'waits on: x', title: '', state: 'waits' } } as unknown as ViewCard), proposed.id)), 'CONTRAST: it waits on an input').toContain('border-dashed'); cleanup()
    expect(frame(draw(withCard(approved, doubted), proposed.id)), 'CONTRAST: an approved model').toContain('border-dashed')
  })
  it('F4 the marker is the real shape of the card\'s kind, one source with its frame hue: an option draws its square, an assumption its dashed outline', () => {
    const el = draw(approved, proposed.id)
    expect(el.querySelector('[data-testid="node-type-glyph"] svg rect'), 'the option\'s square').not.toBeNull()
    expect(el.querySelector('[data-ok-kind="option"]')).not.toBeNull()
    cleanup()
    const a = draw(EU, 'customer_flow_assumptions')
    expect(a.querySelector('[data-testid="node-type-glyph"] svg [stroke-dasharray]'), 'an assumption\'s marker is outlined and dashed').not.toBeNull()
  })
})

describe('where every option waits for one shared reason, it is said once, on the aim card (DL 17 Nov)', () => {
  const golden = (f: string) => JSON.parse(readFileSync(path.resolve('src/olumiView/golden', f), 'utf8')) as View
  const APP = golden('app-launch.view.json'), STUDIO = golden('studio.view.json')
  const AIM = 'boss_discussion', OPTIONS = ['option_scheduled', 'option_delay', 'option_isolate']
  it('N1 the aim card says the options\' shared headline, core\'s own words; each option says nothing', () => {
    const shared = cardOf(APP, OPTIONS[0]!).headline!
    expect([APP.model!.run!.all_withheld, shared.state, shared.shared, shared.aim_id]).toEqual([true, 'none', true, AIM])
    expect(sharedNoChanceOf(APP.model!, AIM)?.text).toBe(shared.text)
    const aim = draw(APP, AIM, 'simple').querySelector(`[data-simple-no-chance-once="${AIM}"]`)
    expect(aim?.textContent, 'the aim card says it').toBe(shared.text)
    for (const id of OPTIONS) { cleanup(); expect(draw(APP, id, 'simple').querySelector(`[data-simple-state="${id}"]`), `${id} does not repeat it`).toBeNull() }
  })
  it('N2 CONTRAST: an option with a step of its own, an aim that is not the headline\'s, and a model where not every option waits keep each option\'s own line', () => {
    const own = withCard(APP, { ...cardOf(APP, OPTIONS[1]!), headline: { ...cardOf(APP, OPTIONS[1]!).headline!, add: 'Add a figure for the delay' } })
    expect(sharedNoChanceOf(own.model!, AIM)).toBeNull()
    expect(draw(own, OPTIONS[0]!, 'simple').querySelector(`[data-simple-state="${OPTIONS[0]}"]`)?.textContent).toBe(cardOf(APP, OPTIONS[0]!).headline!.text)
    cleanup()
    expect(draw(own, AIM, 'simple').querySelector('[data-simple-no-chance-once]')).toBeNull()
    expect(sharedNoChanceOf(APP.model!, 'protect_user_trust')).toBeNull()
    expect([STUDIO.model!.run!.all_withheld, sharedNoChanceOf(STUDIO.model!, 'takings_goal')]).toEqual([false, null])
  })
})

describe('a card\'s own state is the quiet line; core\'s description is the line only where there is no state (Codex root, 1b9)', () => {
  const golden = (f: string) => JSON.parse(readFileSync(path.resolve('src/olumiView/golden', f), 'utf8')) as View
  const APP = golden('app-launch.view.json')
  const DESC = 'A short description from core'
  const described = (v: View, id: string): View => withCard(v, { ...cardOf(v, id), description: DESC } as unknown as ViewCard)
  const lineOf = (el: HTMLElement) => el.querySelector<HTMLElement>('.ok-quiet.ok-two-lines')
  /** v10 review item 3: the two-line basis line, bound by its own class (only P4's card, which has no sized figure). */
  const twoLineOf = (el: HTMLElement) => el.querySelector<HTMLElement>('.ok-quiet.ok-two-lines')
  it('P1 a result that waits keeps core\'s "waits on" words as the line with a description sent; the description joins the hover', () => {
    const spend = cardOf(ASKED, 'spend')
    expect(spend.figure?.state).toBe('waits')
    const line = lineOf(draw(described(ASKED, 'spend'), 'spend', 'simple'))!
    expect([line.textContent, line.hasAttribute('data-simple-pending'), line.hasAttribute('data-simple-description')]).toEqual([spend.figure!.text, true, false])
    expect(line.title.split('\n').at(-1)).toBe(DESC)
  })
  it('P2 a chance keeps its condition (core\'s qualifier) as the line with a description sent', () => {
    // The served chance whose words carry a condition (the Q rows' own card); CONTRAST below: a chance with no condition has no state to keep.
    const o = cardOf(EU, 'broader_entry')
    const { qualifier } = chanceParts(headlineChanceRow(o)!.value)
    expect(qualifier, 'the fixture\'s chance has a condition').not.toBeNull()
    // CHANGED BY DESIGN (18 Nov): an option's condition is never cut to one line, so it is the two-line class here.
    const line = twoLineOf(draw(described(EU, o.id), o.id, 'simple'))!
    expect([line.textContent, line.hasAttribute('data-simple-qual')]).toEqual([qualifier, true])
    expect(line.title).toContain(DESC)
    cleanup()
    const plain = cardOf(FACE, 'second_oven')
    expect(chanceParts(headlineChanceRow(plain)!.value).qualifier, 'CONTRAST: this chance has no condition').toBeNull()
    expect(draw(described(FACE, plain.id), plain.id, 'simple').querySelector('.ok-quiet')?.hasAttribute('data-simple-description'), 'so its description is its line (an option card: two lines, 18 Nov)').toBe(true)
  })
  it('P2b the quiet line keeps a least width on its row (DL BUILD 3: never single letters beside the chips); it takes its line rather than shrink', () => {
    // Bound on the class the browser lays out by: grow from 7rem, never flex-1's zero basis (which let "no" narrow to one letter a line at 1232).
    const line = lineOf(draw(described(ASKED, 'spend'), 'spend', 'simple'))!
    expect([line.classList.contains(QUIET_BASIS), line.classList.contains('flex-1'), QUIET_BASIS]).toEqual([true, false, 'flex-[1_1_7rem]'])
    expect(line.parentElement!.classList.contains('flex-wrap'), 'its row wraps, so the chips drop below').toBe(true)
  })
  it('P3 the shared no-chance line stays on the aim card with a description sent, and the options stay silent', () => {
    const v = described(APP, 'boss_discussion')
    const line = lineOf(draw(v, 'boss_discussion', 'simple'))!
    expect([line.textContent, line.hasAttribute('data-simple-no-chance-once')]).toEqual([cardOf(APP, 'option_scheduled').headline!.text, true])
  })
  it('P5 (audit canvas-goal-said-three-times) a description that is, string for string, the card\'s heading, figure or bound is no line; any other wording is kept (identity, not fuzzy)', () => {
    const id = 'option_scheduled' // no state of its own, so its description would be its line (P4)
    const withDesc = (text: string) => lineOf(draw(withCard(APP, { ...cardOf(APP, id), description: text } as unknown as ViewCard), id, 'simple')) ?? twoLineOf(document.body)
    expect(withDesc(cardOf(APP, id).heading), 'the heading said again').toBeNull()
    cleanup()
    expect(withDesc(`${cardOf(APP, id).heading} `), 'the same string with a trailing space').toBeNull()
    cleanup()
    expect(withDesc(`${cardOf(APP, id).heading} again`)?.textContent, 'CONTRAST: another wording is kept').toBe(`${cardOf(APP, id).heading} again`)
    cleanup()
    const goal = CAPACITY.model!.cards.find((c) => c.bound != null && c.bound.text !== '')!
    const body = (text: string) => { const el = draw(withCard(CAPACITY, { ...goal, description: text } as unknown as ViewCard), goal.id, 'simple'); return [el.querySelector('[data-simple-description]'), el.querySelector('[data-simple-face="target"]')?.textContent] as const }
    expect(body('at least 100 tickets a week')[0]?.textContent, 'CONTRAST: core\'s own quote of the brief, in other words, is kept').toBe('at least 100 tickets a week')
    cleanup()
    const [, shown] = body('x')
    cleanup()
    expect(body(shown!)[0], 'the bound said again').toBeNull()
  })
  it('P6 (Paul 19 Nov, "12 weeks" over "12") a description that is a bare number equal to the card\'s typed figure value is no line; another number, a range\'s other value or words are kept', () => {
    const id = 'option_scheduled'
    const base = cardOf(APP, id)
    const line = (description: string, range: { low: number; likely: number | null; high: number; unit: string } | null) =>
      lineOf(draw(withCard(APP, { ...base, description, figure: { text: '12 weeks', title: '', edit: null, ...(range === null ? {} : { range }) } } as unknown as ViewCard), id, 'simple')) ?? twoLineOf(document.body)
    const point = { low: 12, likely: 12, high: 12, unit: 'weeks' }
    expect(line('12', point), 'the figure\'s own number said again').toBeNull()
    cleanup()
    expect(line('12', { low: 12, likely: null, high: 12, unit: 'weeks' }), 'low equals high').toBeNull()
    cleanup()
    expect(line('about 12 a week', point)?.textContent, 'CONTRAST: words are kept').toBe('about 12 a week')
    cleanup()
    expect(line('13', point)?.textContent, 'CONTRAST: another number is kept').toBe('13')
    cleanup()
    expect(line('12', { low: 10, likely: null, high: 14, unit: 'weeks' })?.textContent, 'CONTRAST: a range with no likely value is not one number').toBe('12')
  })
  it('P5 (S4 details task 4) a card\'s quiet line wraps to two lines, never one cut with an ellipsis: no card draws ok-one-line; CONTRAST: the line is still there, whole in its hover', () => {
    const spend = cardOf(ASKED, 'spend')
    const line = lineOf(draw(ASKED, 'spend', 'simple'))!
    expect([line.classList.contains('ok-one-line'), line.title.split('\n')[0]]).toEqual([false, spend.figure!.title])
  })
  it('P4 CONTRAST: a card with no state to say draws core\'s description as its line; with neither, no line', () => {
    const id = 'option_scheduled' // silent under the shared no-chance rule: no state of its own
    const line = twoLineOf(draw(described(APP, id), id, 'simple'))!
    expect([line.textContent, line.hasAttribute('data-simple-description'), line.title]).toEqual([DESC, true, DESC])
    // CHANGED BY DESIGN (v10 review item 3): a card with no sized figure may take two lines for this basis line, so its last words are not cut.
    expect([line.classList.contains('ok-two-lines'), line.classList.contains('ok-one-line')]).toEqual([true, false])
    cleanup()
    expect([lineOf(draw(APP, id, 'simple')), twoLineOf(document.body)]).toEqual([null, null])
  })
})

describe('an option\'s other results say core\'s whole sentence on hover (DL 17 Nov: a result\'s condition must be reachable, not only its short value)', () => {
  type Other = { aim?: string; aim_id: string; value: string; title: string }
  const o = cardOf(EU, 'broader_entry')
  const others = o.rows.filter((r) => r.aim_id != null && r.aim_id !== o.headline!.aim_id) as unknown as Other[]
  const short = (r: Other) => `${r.aim ?? cardOf(EU, r.aim_id).heading} ${r.value}`
  const hoverOf = (v: View) => draw(v, o.id, 'simple').querySelector<HTMLElement>(`[data-simple-card="${o.id}"]`)!.title.split('\n')
  it('M1 Simple: each other result is its name and short value, then core\'s sentence (`title`), in core\'s row order', () => {
    expect(others.map((r) => r.aim_id), 'the served option has two results besides its headline').toEqual(['investment_limit', 'proposed_churn_guardrail'])
    expect(others.every((r) => r.title !== '' && r.title !== short(r))).toBe(true)
    expect(hoverOf(EU)).toEqual(others.flatMap((r) => [short(r), r.title]))
  })
  it('M2 CONTRAST: a result core sends no sentence for is its short line only; nothing is made up', () => {
    const bare = withCard(EU, { ...o, rows: o.rows.map((r) => (r.aim_id === 'investment_limit' ? { ...r, title: '' } : r)) } as unknown as ViewCard)
    expect(hoverOf(bare)).toEqual([short(others[0]!), short(others[1]!), others[1]!.title])
  })
})

describe('the Simple foot\'s state marks (Paul, 17 Nov: the author mark, at most three more, and a way to show the rest)', () => {
  const UNUSED = "Olumi's analysis doesn't use this figure yet, so changing it won't move any chance."
  const marksIn = (el: ParentNode) => [...el.querySelectorAll<HTMLElement>('[data-card-mark]')]
  const idsIn = (el: ParentNode) => marksIn(el).map((m) => m.getAttribute('data-card-mark'))
  const named = (m: HTMLElement) => m.querySelector<HTMLElement>('[role="img"]')!
  const challenged = cardOf(CAPACITY, 'test_net_contribution'), driven = cardOf(CAPACITY, 'add_specialist')
  /** A served option with a driver, carrying every state core can send at once. */
  const crowded = { ...driven, status: 'ruled out', challenged: true, reason: challenged.reason, unused: UNUSED } as ViewCard

  it('K1 a challenged card draws core\'s reason as the mark\'s name and hover, on the id its readers bind; CONTRAST: an unchallenged card draws none', () => {
    expect([challenged.challenged, challenged.reason !== null && challenged.reason !== '']).toEqual([true, true])
    const marks = marksIn(draw(CAPACITY, challenged.id, 'simple'))
    expect(marks.map((m) => [m.getAttribute('data-card-mark'), m.getAttribute('data-simple-challenged'), named(m).getAttribute('aria-label'), hover(named(m))])).toEqual([['challenged', challenged.id, `Challenged: ${challenged.reason}`, `Challenged: ${challenged.reason}`]])
    cleanup()
    expect(idsIn(draw(withCard(CAPACITY, { ...challenged, challenged: false } as ViewCard), challenged.id, 'simple'))).toEqual([])
  })
  it('K2 a figure the analysis does not use says so in core\'s own sentence, whole; CONTRAST: without the field there is no mark', () => {
    const fig = cardOf(CAPACITY, CAPACITY.model!.cards.find((c) => c.family === 'quantity' && !c.challenged)!.id)
    expect(idsIn(draw(CAPACITY, fig.id, 'simple'))).toEqual([])
    cleanup()
    const mark = marksIn(draw(withCard(CAPACITY, { ...fig, unused: UNUSED } as ViewCard), fig.id, 'simple'))
    expect(mark.map((m) => [m.getAttribute('data-card-mark'), named(m).getAttribute('aria-label'), hover(named(m))])).toEqual([['unused', UNUSED, UNUSED]])
  })
  it('K3 the cap: the corner driver badge takes one of the three places, so three states draw two marks and "+1" naming the third', () => {
    expect([driven.driver != null, cardMarksOf(crowded).map((m) => m.id), MARK_CAP]).toEqual([true, ['set-aside', 'challenged', 'unused'], 3])
    const el = draw(withCard(CAPACITY, crowded), crowded.id, 'simple'), more = el.querySelector<HTMLButtonElement>('[data-card-more]')!
    expect(idsIn(el)).toEqual(['set-aside', 'challenged'])
    expect([more.getAttribute('data-card-more'), more.textContent, more.getAttribute('aria-expanded'), more.hasAttribute('title'), hover(more), more.getAttribute('aria-label')])
      .toEqual(['1', '+1', 'false', false, `${MORE_MARKS.lead}:\n${UNUSED}`, `${MORE_MARKS.lead}: ${UNUSED}`])
  })
  it('K3b CONTRAST: the same three states on a card with no driver badge all draw, and there is no "+N"', () => {
    const el = draw(withCard(CAPACITY, { ...crowded, driver: null } as unknown as ViewCard), crowded.id, 'simple')
    expect([idsIn(el), el.querySelector('[data-card-more]')]).toEqual([['set-aside', 'challenged', 'unused'], null])
  })
  it('K4b once nothing is past the cap the control and its open state go: marks that return later start folded, not as the person left an earlier set', () => {
    const { container, rerender } = render(<SimpleFace card={crowded} model={withCard(CAPACITY, crowded).model} noted={false} />)
    fireEvent.click(container.querySelector<HTMLButtonElement>('[data-card-more]')!)
    expect(idsIn(container)).toEqual(['set-aside', 'challenged', 'unused'])
    const fewer = { ...crowded, unused: null } as ViewCard
    rerender(<SimpleFace card={fewer} model={withCard(CAPACITY, fewer).model} noted={false} />)
    expect([idsIn(container), container.querySelector('[data-card-more]')]).toEqual([['set-aside', 'challenged'], null])
    rerender(<SimpleFace card={crowded} model={withCard(CAPACITY, crowded).model} noted={false} />)
    expect([idsIn(container), container.querySelector('[data-card-more]')!.getAttribute('aria-expanded')]).toEqual([['set-aside', 'challenged'], 'false'])
  })
  it('K5 an option core has ruled out is marked for the look and says so first, in core\'s word; CONTRAST: the same option while live carries neither', () => {
    const live = { ...driven, driver: null } as unknown as ViewCard
    expect(live.status).toBeNull()
    const out = draw(withCard(CAPACITY, { ...live, status: 'ruled out' } as ViewCard), live.id, 'simple')
    const first = marksIn(out)[0]!
    expect([out.querySelector(`[data-simple-card="${live.id}"]`)!.hasAttribute('data-simple-set-aside'), first.getAttribute('data-card-mark'), named(first).getAttribute('aria-label'), hover(named(first))]).toEqual([true, 'set-aside', 'ruled out', 'ruled out'])
    cleanup()
    const on = draw(withCard(CAPACITY, live), live.id, 'simple')
    expect([on.querySelector(`[data-simple-card="${live.id}"]`)!.hasAttribute('data-simple-set-aside'), idsIn(on)]).toEqual([false, []])
  })
  // Core candidate 6 (src/science/findings.ts, src/view/schema.ts): Olumi's own provisional observations on a card, in core's words.
  const WORTH = [
    { code: 'estimate_held_as_one_figure', title: 'A single figure with no range', text: '‘Monthly rider bill’ is an approximate figure held as a single number, and the working of ‘Keep riders’ refers to it. A low and a high for it would let the analysis show how far the result depends on it.', rests_on: ['aim_retain'], olumi: true },
    { code: 'only_supporting_evidence', title: 'No challenging evidence recorded', text: 'One piece of evidence recorded on ‘Monthly rider bill’ supports it, and none challenges it. What would you expect to see if it were wrong, and has anyone looked?', rests_on: ['ev_1'], olumi: true },
  ]
  const figure = cardOf(CAPACITY, CAPACITY.model!.cards.find((c) => c.family === 'quantity' && !c.challenged)!.id)
  it('K6 (C3) Olumi\'s observations are ONE mark per distinct core code, each its own registry icon, named by that observation\'s title and sentence; two different observations are two different marks', () => {
    const card = { ...figure, worth_checking: WORTH } as unknown as ViewCard
    expect(worthCheckingOf(card).map((w) => w.code)).toEqual(['estimate_held_as_one_figure', 'only_supporting_evidence'])
    const marks = marksIn(draw(withCard(CAPACITY, card), figure.id, 'simple'))
    expect(marks.map((m) => [m.getAttribute('data-card-mark'), m.getAttribute('data-worth-code')])).toEqual([['worth-checking', 'estimate_held_as_one_figure'], ['worth-checking', 'only_supporting_evidence']])
    expect(marks.map((m) => named(m).getAttribute('aria-label'))).toEqual(WORTH.map((w) => `${w.title}\n${w.text}`))
    expect(marks.map((m) => hover(named(m)))).toEqual(WORTH.map((w) => `${w.title}\n${w.text}`))
    expect(marks.map((m) => m.querySelector('svg')!.getAttribute('class')).every((c) => c !== null)).toBe(true)
  })
  it('K6a every one of core\'s nine codes has its own neutral registry icon, no two alike and none borrowing a family name; a code this page does not know still draws, as the generic mark', () => {
    const NINE = ['olumi_estimate_under_every_aim', 'result_rests_on_olumi_range', 'estimate_held_as_one_figure', 'only_supporting_evidence', 'one_evidence_for_several_figures', 'narrow_range', 'view_without_evidence', 'assumption_without_test', 'olumi_range_turns']
    expect(Object.keys(WORTH_ICON).sort()).toEqual([...NINE].sort())
    expect(new Set(Object.values(WORTH_ICON)).size, 'one icon per code').toBe(NINE.length)
    for (const code of NINE) {
      const icon = ICONS[WORTH_ICON[code]!]
      expect([code, icon.colour, icon.group]).toEqual([code, '--text-light', 'state'])
      expect(icon.hover, `${code}: the registry names no family; core's words are the mark's name`).toBe('Olumi suggests checking this')
    }
    const newer = { ...figure, worth_checking: [{ ...WORTH[0]!, code: 'a_code_from_a_newer_core' }] } as unknown as ViewCard
    expect(worthMarksOf(newer).map((m) => [m.code, m.icon])).toEqual([['a_code_from_a_newer_core', 'worth-checking']])
  })
  it('K6c two items sharing one code are one mark named by both', () => {
    const twice = { ...figure, worth_checking: [WORTH[0]!, { ...WORTH[0]!, title: 'Another figure', text: 'Another sentence.' }] } as unknown as ViewCard
    const marks = worthMarksOf(twice)
    expect([marks.length, marks[0]!.words]).toEqual([1, `${WORTH[0]!.title}\n${WORTH[0]!.text}\n\nAnother figure\nAnother sentence.`])
  })
  it('K6b CONTRAST: no field, an empty list, an item core does not mark as Olumi\'s, or one with no sentence draws no mark; nothing is made up', () => {
    const none = [undefined, [], [{ ...WORTH[0]!, olumi: false }], [{ ...WORTH[0]!, text: '' }], 'A single figure with no range']
    for (const worth_checking of none) {
      const card = { ...figure, worth_checking } as unknown as ViewCard
      expect([worthCheckingOf(card), cardMarksOf(card)], JSON.stringify(worth_checking ?? null)).toEqual([[], []])
    }
    const mixed = { ...figure, worth_checking: [{ ...WORTH[0]!, olumi: false }, WORTH[1]!] } as unknown as ViewCard
    expect(worthCheckingOf(mixed).map((w) => w.code)).toEqual(['only_supporting_evidence'])
  })
  it('K7 five states on a card with no driver badge: three marks in priority order and "+2" naming the others', () => {
    const four = { ...crowded, driver: null, worth_checking: WORTH } as unknown as ViewCard
    // Two different worth-checking codes are two marks (C3), so this card has five states: three drawn and "+2" naming the other two.
    expect(cardMarksOf(four).map((m) => m.id)).toEqual(['set-aside', 'challenged', 'worth-checking', 'worth-checking', 'unused'])
    const el = draw(withCard(CAPACITY, four), four.id, 'simple'), more = el.querySelector<HTMLButtonElement>('[data-card-more]')!
    expect([idsIn(el), more.textContent, more.getAttribute('aria-label')]).toEqual([['set-aside', 'challenged', 'worth-checking'], '+2', `${MORE_MARKS.lead}: ${WORTH[1]!.title}\n${WORTH[1]!.text}; ${UNUSED}`])
  })
  it('K4 "+N" is a button: a press draws the hidden mark in the row and a second press folds it; the press never reaches the card', () => {
    const onCard = vi.fn()
    const { container } = render(<div onClick={onCard}><SimpleFace card={crowded} model={withCard(CAPACITY, crowded).model} noted={false} /></div>)
    const more = () => container.querySelector<HTMLButtonElement>('[data-card-more]')!
    expect([more().tagName, more().type, more().className.includes('nodrag'), more().className.includes('nopan')]).toEqual(['BUTTON', 'button', true, true])
    fireEvent.click(more())
    expect([idsIn(container), more().getAttribute('aria-expanded'), more().getAttribute('aria-label')]).toEqual([['set-aside', 'challenged', 'unused'], 'true', MORE_MARKS.fewer])
    fireEvent.click(more())
    expect([idsIn(container), more().getAttribute('aria-expanded')]).toEqual([['set-aside', 'challenged'], 'false'])
    expect(onCard).not.toHaveBeenCalled()
  })
})

describe('C1 the card foot has one order on both faces: state marks, then count badges, then whose it is LAST', () => {
  const UNUSED = "Olumi's analysis doesn't use this figure yet, so changing it won't move any chance."
  const WORTH = [{ code: 'estimate_held_as_one_figure', title: 'A single figure', text: 'Held as one number.', rests_on: [], olumi: true }]
  const kindOf = (e: Element): string => (e.hasAttribute('data-option-baseline') ? 'baseline' : e.hasAttribute('data-card-more') ? 'more' : e.hasAttribute('data-card-mark') ? 'state' : e.hasAttribute('data-count') ? 'count' : e.hasAttribute('data-author-mark') ? 'author' : '?')
  const rank = { baseline: 0, state: 1, more: 2, count: 3, author: 4, '?': 9 } as const
  it('F1 Simple: baseline and the state marks (with "+N") come first, the count badge after them, the author mark last; CONTRAST: the author mark is not first', () => {
    const base = { ...cardOf(ASKED, 'carry_on'), baseline: true, driver: null, status: 'ruled out', challenged: true, reason: 'Two sources disagree', unused: UNUSED, worth_checking: WORTH } as unknown as ViewCard
    const count = <p className="ok-count" data-count="">2 folded</p>
    const { container } = render(<SimpleFace card={base} model={withCard(ASKED, base).model} noted={false} extra={count} />)
    const foot = container.querySelector(`[data-simple-foot="${base.id}"]`)!
    const order = [...foot.querySelectorAll('[data-option-baseline], [data-card-mark], [data-card-more], [data-count], [data-author-mark]')].map(kindOf)
    expect(order.every((k) => k !== '?')).toBe(true)
    expect(order, 'a fixed order: nothing of a later kind before an earlier one').toEqual([...order].sort((a, b) => rank[a as keyof typeof rank] - rank[b as keyof typeof rank]))
    expect([order[0], order.at(-1), order.includes('more'), order.includes('count')]).toEqual(['baseline', 'author', true, true])
  })
  it('F2 Detailed: the kind and state marks come first and whose it is is the last thing in the foot', () => {
    const base = { ...cardOf(ASKED, 'carry_on'), baseline: true, unused: UNUSED, worth_checking: WORTH } as unknown as ViewCard
    const foot = draw(withCard(ASKED, base), base.id, 'working').querySelector(`[data-core-card="${base.id}"] .ok-dt-foot`)!
    const kids = [...foot.children]
    expect(kids.at(-1)!.getAttribute('data-core-author')).toBe(base.id)
    const first = kids.findIndex((k) => k.querySelector('[data-option-baseline]') !== null || k.hasAttribute('data-option-baseline'))
    const worth = kids.findIndex((k) => k.querySelector('[data-card-mark="worth-checking"]') !== null || k.getAttribute('data-card-mark') === 'worth-checking')
    expect([first >= 0, worth >= 0, first < worth, worth < kids.length - 1]).toEqual([true, true, true, true])
  })
})

describe('C5 a condition is neutral and has its own icon; orange only from core\'s own challenge field', () => {
  const cond = (extra: Partial<ViewCard> = {}) => ({ ...cardOf(EU, 'starting_customers'), family: 'condition', challenged: false, ...extra }) as unknown as ViewCard
  it('N1 at both levels the condition card wears the condition icon, named by the registry, and the neutral hook; a challenge draws core\'s own mark, never the family', () => {
    for (const level of ['simple', 'working'] as const) {
      const c = cond(), face = faceOf(draw(withCard(EU, c), c.id, level), c.id)
      const tag = face.querySelector<HTMLElement>('[data-kind-tag="condition"]')!
      expect([level, tag.textContent, imgOf(tag).getAttribute('aria-label'), face.hasAttribute('data-ok-condition'), face.querySelector('[data-card-mark="challenged"]')]).toEqual([level, '', ICONS['condition-tag'].hover, true, null]); cleanup()
      const ch = cond({ challenged: true, reason: 'Two sources disagree' } as Partial<ViewCard>)
      // core's `challenged` field (and only it) is what makes the orange mark; the Simple foot draws it as a state mark.
      expect([level, cardMarksOf(ch).some((m) => m.id === 'challenged'), cardMarksOf(c).some((m) => m.id === 'challenged')]).toEqual([level, true, false])
      if (level === 'simple') expect(draw(withCard(EU, ch), ch.id, level).querySelector('[data-card-mark="challenged"]')).not.toBeNull()
      cleanup()
    }
  })
  it('N2 CONTRAST: a figure card and an assumption wear no condition icon', () => {
    for (const id of ['starting_customers', 'customer_flow_assumptions']) { expect(draw(EU, id, 'simple').querySelector('[data-kind-tag="condition"]'), id).toBeNull(); cleanup() }
  })
})

describe('C7 the figure\'s pencil is drawn at rest where the View carries an edit', () => {
  it('E1 a card whose figure carries an edit has the pencil hook; a card whose figure has none draws no pencil hook (an offer to hold one stays a hover action)', () => {
    const editable = EU.model!.cards.find((c) => c.figure?.edit != null)
    expect(editable, 'precondition: the served View carries an edit on a figure').toBeDefined()
    expect(draw(EU, editable!.id, 'simple').querySelector('[data-card-edit-cue]')).not.toBeNull(); cleanup()
    const none = { ...editable!, figure: { ...editable!.figure!, edit: null } } as unknown as ViewCard
    expect(draw(withCard(EU, none), none.id, 'simple').querySelector('[data-card-edit-cue]')).toBeNull()
  })
})

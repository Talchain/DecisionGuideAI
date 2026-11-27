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
import { act, cleanup, fireEvent, render, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReactFlowProvider, type NodeProps } from '@xyflow/react'
import type { View, ViewCard } from '../../../client'
import { useViewStore } from '../../../store'
import { useMe } from '../../../../olumiCore/me'
import * as coreLane from '../../../../olumiCore/lane'
import { useCanvasStore } from '../../../../canvas/store'
import { ViewCardNode } from '../../../../canvas/nodes/ViewCardNode'
import { useUIStore } from '../../../../stores/uiStore'
import { CoreCard } from '../../../previous/CoreCard'
import { useReasoningFocus } from '../../../reasoning/focusRequest'
import { setDefaultLevel, useSimpleLevel, type Level } from '../../simpleStore'
import { bandRowsOf, optionLetterOf, SimpleFace } from '../../SimpleFace'
import { cardKindOf, dsKindOf } from '../kind'
import { letterAt, optionLetters } from '../letters'
import { TIP_DELAY } from '../../../look/Tip'
import { ICONS } from '../../../look/icons'
import { AuthorMark, cardMarksOf, QuestionMark, LIMIT_MEANS, MARK_CAP, MORE_MARKS, OLUMI_ASKS, WORTH_ICON, worthCheckingOf, worthMarksOf } from '../marks'
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
/** Every Tip open once the pointer rests on `mark` (the one-tip rule says there is at most one). */
const hoverAll = (mark: HTMLElement): string[] => {
  vi.useFakeTimers()
  try {
    fireEvent.pointerEnter(mark)
    act(() => { vi.advanceTimersByTime(TIP_DELAY) })
    return [...document.querySelectorAll('[data-testid="lane-tip"]')].map((t) => t.textContent ?? '')
  } finally { fireEvent.pointerLeave(mark); vi.useRealTimers() }
}
const imgOf = (mark: HTMLElement): HTMLElement => (mark.getAttribute('role') === 'img' ? mark : mark.querySelector<HTMLElement>('[role="img"]'))!
const faceOf = (el: HTMLElement, id: string) => el.querySelector<HTMLElement>(`[data-core-card="${id}"]`)!

beforeEach(() => { window.localStorage.clear(); useSimpleLevel.setState({ levels: {} }) })
afterEach(() => { cleanup(); setDefaultLevel('simple'); useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none' } as never); useMe.setState({ me: null, status: 'none' }) })

describe.each(['SimpleFace', 'Detailed ViewCard'] as const)('%s goal measure line', (face) => {
  const goal = cardOf(ASKED, 'sell_360')
  const bound = { text: 'At least 360 loaves a week', title: 'The weekly bakery sales target', olumi: null }
  const unmeasured = { ...bound, measured: false }
  const question = { id: 'goal-measure', role: 'measure' as const, about: goal.id, text: 'What should we count to track bakery sales?', unit: null }
  const label = 'Not counted yet'

  const drawGoal = (servedBound: ViewCard['bound'], doubt: boolean, questions = [question], onCard = vi.fn()) => {
    const card = { ...goal, bound: servedBound, doubt }
    const view = withCard(ASKED, card)
    const model = { ...view.model!, coaching_questions: questions.map((q) => q.text), questions }
    useViewStore.setState({ sid: view.id, view: { ...view, model } })
    const { container } = render(
      <div onPointerDown={onCard} onClick={onCard}>
        {face === 'SimpleFace' ? <SimpleFace card={card} model={model} noted={false} /> : (
          <ReactFlowProvider><ViewCardNode {...({ id: card.id, data: { card }, selected: false, type: 'viewCard' } as unknown as NodeProps)} /></ReactFlowProvider>
        )}
      </div>,
    )
    const renderedFace = container.querySelector<HTMLElement>(face === 'SimpleFace' ? '[data-simple-card]' : '[data-view-card]')
    expect(renderedFace).toBeInTheDocument()
    return within(renderedFace!)
  }

  it('(a) keeps the measured bound text even with a measure question', () => {
    const card = drawGoal({ ...bound, measured: true }, true)
    expect(card.queryByText(label)).toBeNull()
    expect(card.getByText(bound.text)).toBeVisible()
  })

  it('(b) swaps the waiting bound text for a single line with the question Tip and a click or Enter action', async () => {
    const user = userEvent.setup()
    const onCard = vi.fn()
    const previousUI = useUIStore.getState()
    const previousFocus = useReasoningFocus.getState()
    try {
      const card = drawGoal(unmeasured, true, [question], onCard)
      const line = card.getByRole('button', { name: label })
      expect(card.getAllByText(label)).toEqual([line])
      expect(line).toBeVisible()
      expect(line).toHaveClass('ok-quiet')
      expect(line.parentElement).toHaveAttribute(
        face === 'SimpleFace' ? 'data-simple-bound-state' : 'data-view',
        face === 'SimpleFace' ? goal.id : `${goal.id}.bound`,
      )
      expect(card.queryByText(bound.text)).toBeNull()
      expect(hoverAll(line)).toEqual([question.text])
      for (const activate of [() => user.click(line), () => user.keyboard('{Enter}')]) {
        useReasoningFocus.setState({ request: null })
        useUIStore.setState({ activeOutputTab: 'results' })
        await activate()
        expect(line).toHaveFocus()
        expect(useReasoningFocus.getState().request).toEqual({ sid: ASKED.id, key: 'q:goal-measure' })
        expect(useUIStore.getState().activeOutputTab).toBe('analysisNew')
      }
      expect(onCard).not.toHaveBeenCalled()
    } finally {
      useReasoningFocus.setState(previousFocus)
      useUIStore.setState(previousUI)
    }
  })

  it('(c) keeps the unmeasured bound wording available when there is no measure question', () => {
    const card = drawGoal(unmeasured, true, [])
    expect(card.queryByText(label)).toBeNull()
    if (face === 'SimpleFace') {
      const mark = card.getByText('', { selector: '[data-face-mark="bound"]' })
      expect(card.queryByText(bound.text)).toBeNull()
      expect(hover(mark.parentElement!)).toBe([bound.text, bound.title].join('\n'))
    } else {
      expect(card.getByText(bound.text)).toBeVisible()
    }
  })

  it('(d) keeps the in-words bound wording available even with a stale measure question', () => {
    const card = drawGoal(unmeasured, false)
    expect(card.queryByText(label)).toBeNull()
    if (face === 'SimpleFace') {
      const mark = card.getByText('', { selector: '[data-face-mark="bound"]' })
      expect(card.queryByText(bound.text)).toBeNull()
      expect(hover(mark.parentElement!)).toBe([bound.text, bound.title].join('\n'))
    } else {
      expect(card.getByText(bound.text)).toBeVisible()
    }
  })

  it('(e) omits the label when measured is absent or the bound is null', () => {
    const olderBound = bound as NonNullable<ViewCard['bound']>
    const card = drawGoal(olderBound, true)
    expect(card.queryByText(label)).toBeNull()
    expect(card.getByText(bound.text)).toBeVisible()
    expect(drawGoal(null, true).queryByText(label)).toBeNull()
  })
})

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
  it('draws the studio producer result in its DS shape and colour on Simple, Detailed and at far zoom', () => {
    const studio = JSON.parse(readFileSync(path.resolve('src/olumiView/v12/__tests__/fixtures/issue7-e499eff6-studio.view3.json'), 'utf8')) as View
    const lane = vi.spyOn(coreLane, 'isOlumiCoreLane').mockReturnValue(true)
    const previous = useCanvasStore.getState().lodRung
    try {
      for (const [level, rung] of [['simple', 'full'], ['working', 'full'], ['working', 'line']] as const) {
        useCanvasStore.setState({ lodRung: rung })
        const root = draw(studio, 'members', level)
        const mark = root.querySelector('[data-testid="node-type-glyph"] svg')
        expect(mark).toHaveAttribute('data-node-shape', 'outcome')
        expect(mark).toHaveClass('text-success')
        expect(mark?.querySelector('polygon')).toHaveAttribute('fill', 'var(--success)')
        if (rung === 'line') expect(root.querySelector('[data-testid="node-title"]')).toHaveAttribute('data-lod-far-title', 'true')
        else expect(faceOf(root, 'members')).toHaveAttribute('data-ok-kind', 'outcome')
        if (level === 'simple') {
          expect(root.querySelector('[data-simple-card]')).toHaveClass('ok-card-gap-stack')
          expect(root.querySelector('[data-simple-foot]')).toBeNull()
          expect(root.querySelector('.ok-card-chrome [data-person-mark]')).not.toBeNull()
        }
        cleanup()
      }
    } finally {
      lane.mockRestore()
      cleanup()
      useCanvasStore.setState({ lodRung: previous })
    }
  })

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
    expect(css).toMatch(/border-color: var\(--ok-kc\)/)
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
    expect([line.textContent, hover(line)]).toEqual([STEP, `${h.why}\n${STEP}`])
    expect(face.querySelectorAll('.ok-quiet').length, 'one line').toBe(1)
    expect(face.querySelector(gone), 'nothing of the old withheld furniture').toBeNull()
    expect(face.textContent, 'unknown is never drawn as zero').not.toMatch(/\?|0%/)
  })

  it('W2 Simple: an empty outline with the reason and next step in hover', () => {
    const face = draw(ASKED, o.id, 'simple').querySelector<HTMLElement>('[data-simple-face="no-chance"]')!
    expect(face.textContent).toBe('')
    expect(face.querySelector('[data-face-mark="chance"]')).not.toBeNull()
    expect(hover(face)).toContain(`${h.why}\n${h.add}`)
    expect(face.querySelector(gone)).toBeNull()
    expect(face.textContent).not.toContain(h.text)
  })

  it('W3 without a next step, the hover keeps Core’s headline words', () => {
    const bare = { ...o, headline: { ...h, why: null, title: '', add: null } } as ViewCard
    const face = render(<SimpleFace card={bare} model={ASKED.model} noted={false} />).container
    expect([face.querySelector(`[data-simple-state="${o.id}"]`)?.textContent, hover(face.querySelector<HTMLElement>(`[data-simple-state="${o.id}"]`)!)]).toEqual(['', [h.text, h.text].join('\n')])
    cleanup()
    const chance = cardOf(FACE, 'second_oven')
    expect(chance.headline!.state).toBe('chance')
    // Bound to the headline's line: a limit row it could not work out keeps its own quiet line (Line reviewer F2), marked `data-withheld-row`.
    for (const level of ['working', 'simple'] as const) { expect(draw(FACE, chance.id, level).querySelector('.ok-quiet:not([data-withheld-row])'), level).toBeNull(); cleanup() }
  })
})

describe('a figure with no value yet, and one that waits', () => {
  it('U1 the unsized input uses a track on Simple and keeps the gap in hover', () => {
    const GAP = [[ASKED, 'oven_price', 'not given yet · What would the second oven cost?'], [EU, 'profitability', 'not sized yet · Revenue per customer, margins, operating costs and the accounting treatment of expansion investment were not supplied.']] as const
    for (const [view, id, words] of GAP) {
      expect([cardOf(view, id).figure!.text, cardOf(view, id).figure!.title], 'precondition: no value, and core\'s own words for the gap').toEqual(['', words])
      for (const level of ['working', 'simple'] as const) {
        const el = draw(view, id, level), quiet = el.querySelector<HTMLElement>(`[data-unsized="${id}"]`)!
        expect(el.querySelectorAll('[data-unsized]').length).toBe(1)
        expect(quiet.textContent).toBe(level === 'simple' ? '' : words)
        expect(quiet.querySelector('[data-face-mark="track"]') !== null).toBe(level === 'simple')
        expect(hover(quiet)).toContain(words)
        cleanup()
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

  it('U3 pending: a calculated figure that waits on an input is core\'s own "waits on" words, never a headline figure and never over an empty track: Detailed as its status line, Simple as an empty track, its working closed', () => {
    const spend = cardOf(ASKED, 'spend')
    expect([spend.figure!.state, spend.figure!.text], 'precondition: core says it waits, in these words').toEqual(['waits', 'waits on: oven price'])
    const card = draw(ASKED, 'spend'), detailed = card.querySelector<HTMLElement>('[data-core-lead="spend"]')!
    expect([detailed.getAttribute('data-ok-face'), detailed.hasAttribute('data-ok-pending'), card.querySelector('.ok-empty, [data-testid$="-empty-bar"]'), [...detailed.querySelectorAll('.ok-status [data-core-lead-clamp]')].map((e) => e.textContent)])
      .toEqual(['worked', true, null, ['waits on: oven price']])
    expect(detailed.querySelector('.ok-fig')).toBeNull(); cleanup()
    const el = draw(ASKED, 'spend', 'simple'), simple = el.querySelector<HTMLElement>('[data-simple-face="pending"]')!
    expect(simple.textContent).toBe('')
    expect(simple.querySelector('[data-face-mark="track"]')).not.toBeNull()
    expect(hover(simple)).toContain([spend.figure!.text, spend.figure!.title, ...needsOf(spend).needs.map((n) => n.label)].join('\n'))
    expect(el.querySelector('details.ok-steps-inline, [data-simple-below="spend"]'), 'the working is closed at rest').toBeNull()
    cleanup()
    expect(draw(ASKED, 'base_sales', 'simple').querySelector('[data-simple-face="pending"]'), 'CONTRAST: a stated figure').toBeNull()
  })

  it('U3b a figure that waits without working still has the empty track and its hover', () => {
    const spend = cardOf(ASKED, 'spend'), view = withCard(ASKED, { ...spend, worked: null } as unknown as ViewCard)
    const line = draw(view, 'spend', 'simple').querySelector<HTMLElement>('[data-simple-face="pending"]')!
    expect(line.querySelector('[data-face-mark="track"]')).not.toBeNull()
    expect(line.textContent).toBe('')
    expect(hover(line)).toContain([spend.figure!.text, spend.figure!.title].join('\n'))
  })
})

describe('chance qualifiers and Olumi’s mark', () => {
  const o = cardOf(EU, 'broader_entry'), row = headlineChanceRow(o)!, parts = chanceParts(row.value)

  it('Q1 core\'s chance line splits at core\'s own first clause; a line with no clause is whole; the row is bound by the headline\'s aim', () => {
    expect([parts.qualifier !== null, `${parts.head}, ${parts.qualifier}`], 'precondition: core\'s words carry a clause').toEqual([true, row.value])
    expect(parts.head.endsWith(' chance')).toBe(true)
    const plain = cardOf(FACE, 'second_oven')
    expect(chanceParts(headlineChanceRow(plain)!.value)).toEqual({ head: plain.headline!.text, qualifier: null })
    expect([row.aim_id, headlineChanceRow(cardOf(ASKED, 'second_oven'))]).toEqual([o.headline!.aim_id, null])
  })

  it('Q2 Simple keeps Olumi’s mark beside the chance and puts the qualifier in hover', () => {
    const el = draw(EU, o.id, 'simple')
    const words = el.querySelector<HTMLElement>(`[data-simple-chance="${o.id}"]`)!, qual = el.querySelector<HTMLElement>(`[data-simple-qual="${o.id}"]`)!
    expect(words.textContent).toBe(parts.head)
    expect(el.textContent).not.toContain(parts.qualifier)
    expect(hover(qual)?.split('\n').slice(0, 2)).toEqual([parts.head, parts.qualifier])
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
      // Core's own word for it is the key's `assumption` item (core's model.key); the registry's words are only the fallback.
      const words = EU.model!.key.find((k) => k.id === 'assumption')!.text
      expect([level, tag.textContent, imgOf(tag).getAttribute('aria-label'), hover(imgOf(tag))]).toEqual([level, '', words, words]); cleanup()
      expect(draw(EU, 'starting_customers', level).querySelector('[data-kind-tag]'), level).toBeNull(); cleanup()
    }
  })
})

describe('figure values at rest', () => {
  it('Simple CoreCard draws the ranged figure in Core\'s words without axis end labels', () => {
    const base = cardOf(ASKED, 'extra_hours_sold')
    const figure = { ...base.figure!, text: '40 to 80 loaves/week', range: { low: 40, likely: null, high: 80, unit: 'loaf/week' } }
    const el = draw(withCard(ASKED, { ...base, figure }), base.id, 'simple')
    expect(el.querySelector(`[data-simple-figure-text="${base.id}"]`)).toHaveTextContent(figure.text)
    const card = within(el)
    expect(card.getByTestId('range-bar')).toBeVisible()
    expect(card.queryByTestId('range-min')).toBeNull()
    expect(card.queryByTestId('range-max')).toBeNull()
  })

  it('Detailed strips draw Core\'s value words for every option without an axis row', () => {
    const sales = cardOf(ASKED, 'sales')
    const el = draw(ASKED, sales.id)
    const strips = el.querySelector('[data-detailed-strips="sales"]')!
    const rows = [...strips.querySelectorAll('[data-strip]')]
    expect(rows.map((row) => [row.getAttribute('data-strip'), row.querySelector('.ok-dt-strip-val')?.textContent]))
      .toEqual(sales.values!.map((value) => [value.option, value.text]))
    expect(strips.querySelector('.ok-dt-strip-axis')).toBeNull()
  })

  it('SimpleFace keeps both axis end labels on a worked-out figure with bands', () => {
    const { getByTestId } = render(<SimpleFace card={cardOf(EU, 'customers')} model={EU.model} noted={false} />)
    expect(getByTestId('simple-axis-min').textContent).toBe('0')
    expect(getByTestId('simple-axis-max').textContent).toBe('2,000 customer')
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

  it('H2 Simple: the withheld option keeps its letter and the reason stays in hover', () => {
    expect(bandRowsOf(cardOf(held, 'sales'), held.model).map((b) => b.option)).not.toContain('longer_hours')
    const el = draw(held, 'sales', 'simple'), row = el.querySelector<HTMLElement>('[data-simple-withheld="longer_hours"]')!
    expect([row.querySelector('[data-letter-chip]')?.textContent, el.querySelector('[data-simple-withheld-why="longer_hours"]')?.getAttribute('data-simple-withheld-why'), el.querySelector('[data-simple-band="longer_hours"]')]).toEqual(['B', 'longer_hours', null])
    expect(el.querySelector('.ok-empty, [data-testid$="-empty-bar"]'), 'no dashed empty track').toBeNull()
    expect(hover(row), 'the option and core\'s reason are the letter\'s hover').toContain(REASON)
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
  it('N1 the aim’s outline carries the shared headline in hover', () => {
    const shared = cardOf(APP, OPTIONS[0]!).headline!
    expect([APP.model!.run!.all_withheld, shared.state, shared.shared, shared.aim_id]).toEqual([true, 'none', true, AIM])
    expect(sharedNoChanceOf(APP.model!, AIM)?.text).toBe(shared.text)
    const aim = draw(APP, AIM, 'simple').querySelector(`[data-simple-no-chance-once="${AIM}"]`)
    expect(aim?.textContent).toBe('')
    expect(hover(aim as HTMLElement)).toContain(shared.text)
    for (const id of OPTIONS) { cleanup(); expect(draw(APP, id, 'simple').querySelector(`[data-simple-state="${id}"]`), `${id} does not repeat it`).toBeNull() }
  })
  it('N2 CONTRAST: an option with a step of its own, an aim that is not the headline\'s, and a model where not every option waits keep each option\'s own line', () => {
    const own = withCard(APP, { ...cardOf(APP, OPTIONS[1]!), headline: { ...cardOf(APP, OPTIONS[1]!).headline!, add: 'Add a figure for the delay' } })
    expect(sharedNoChanceOf(own.model!, AIM)).toBeNull()
    const mark = draw(own, OPTIONS[0]!, 'simple').querySelector<HTMLElement>('[data-simple-state]')!
    expect(mark.textContent).toBe('')
    expect(hover(mark)).toContain(cardOf(APP, OPTIONS[0]!).headline!.text)
    cleanup()
    expect(draw(own, AIM, 'simple').querySelector('[data-simple-no-chance-once]')).toBeNull()
    expect(sharedNoChanceOf(APP.model!, 'protect_user_trust')).toBeNull()
    expect([STUDIO.model!.run!.all_withheld, sharedNoChanceOf(STUDIO.model!, 'takings_goal')]).toEqual([false, null])
  })
})

describe('descriptions in the Simple hover', () => {
  const APP = JSON.parse(readFileSync(path.resolve('src/olumiView/golden/app-launch.view.json'), 'utf8')) as View
  const DESC = 'A short description from core'
  const described = (v: View, id: string): View => withCard(v, { ...cardOf(v, id), description: DESC } as ViewCard)

  it('adds the description after the waiting explanation', () => {
    const el = draw(described(ASKED, 'spend'), 'spend', 'simple')
    const mark = el.querySelector<HTMLElement>('[data-simple-pending]')!
    expect(mark.textContent).toBe('')
    expect(el.textContent).not.toContain(DESC)
    expect((hover(mark) ?? '').split('\n').at(-1)).toBe(DESC)
  })

  it('keeps the chance qualifier and description together in hover', () => {
    const option = cardOf(EU, 'broader_entry')
    const qualifier = chanceParts(headlineChanceRow(option)!.value).qualifier
    const el = draw(described(EU, option.id), option.id, 'simple')
    const line = el.querySelector<HTMLElement>('[data-simple-qual]')!
    expect(qualifier).not.toBeNull()
    expect(el.textContent).not.toContain(qualifier)
    expect(hover(line)).toContain(qualifier)
    expect(el.textContent).not.toContain(DESC)
    expect(hover(line)).toContain(DESC)
  })

  it('adds the description to the card hover when the option has no state of its own', () => {
    const id = 'option_scheduled'
    const el = draw(described(APP, id), id, 'simple')
    const anchor = el.querySelector<HTMLElement>('[data-simple-description]')!
    expect(el.textContent).not.toContain(DESC)
    expect(hover(anchor)).toContain(DESC)
    expect(el.querySelector('[data-simple-state]')).toBeNull()
  })
})

describe('an option\'s other results say core\'s whole sentence on hover (DL 17 Nov: a result\'s condition must be reachable, not only its short value)', () => {
  type Other = { aim?: string; aim_id: string; value: string; title: string }
  const o = cardOf(EU, 'broader_entry')
  const others = o.rows.filter((r) => r.aim_id != null && r.aim_id !== o.headline!.aim_id) as unknown as Other[]
  const short = (r: Other) => `${r.aim ?? cardOf(EU, r.aim_id).heading} ${r.value}`
  // CHANGED BY DESIGN (panel system round 3): the card's results are the one Tip on the card (150 ms, focus too), not a native `title`.
  const hoverOf = (v: View) => {
    const all = hoverAll(draw(v, o.id, 'simple').querySelector<HTMLElement>(`[data-simple-card="${o.id}"]`)!)
    expect(all, 'one tip on the screen: the card\'s own').toHaveLength(1)
    return all[0]!.split('\n')
  }
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
    expect(cardOf(ASKED, 'carry_on').author?.by, 'precondition: the card has an author, so its mark is drawn').toBe('person')
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

describe('C1 (Codex round 3) the Detailed foot caps and overflows its state marks exactly as the Simple foot does', () => {
  const UNUSED = "Olumi's analysis doesn't use this figure yet, so changing it won't move any chance."
  const TWO = [
    { code: 'estimate_held_as_one_figure', title: 'A single figure', text: 'Held as one number.', rests_on: [], olumi: true },
    { code: 'only_supporting_evidence', title: 'No challenging evidence', text: 'Nothing recorded challenges it.', rests_on: [], olumi: true },
  ]
  const crowdedCard = () => ({ ...cardOf(ASKED, 'carry_on'), driver: null, status: 'ruled out', challenged: true, reason: 'Two sources disagree', unused: UNUSED, worth_checking: TWO }) as unknown as ViewCard
  const kinds = (el: Element) => [...el.querySelectorAll<HTMLElement>('[data-card-mark]')].map((m) => `${m.getAttribute('data-card-mark')}${m.getAttribute('data-worth-code') ?? ''}`)
  it('F3 a crowded card: at rest Detailed draws at most MARK_CAP state marks and a "+N" naming the rest; a press draws them all in core\'s order, the same order Simple has; the author mark stays last', () => {
    const card = crowdedCard()
    // Simple: set-aside, challenged, worth, worth, unused (five). Detailed says "set aside" once, on its status line, so it has four.
    const all = cardMarksOf(card).map((m) => `${m.id}${m.code ?? ''}`)
    expect(all.length, 'precondition: more state marks than the cap').toBeGreaterThan(MARK_CAP)
    const foot = draw(withCard(ASKED, card), card.id, 'working').querySelector<HTMLElement>(`[data-core-card="${card.id}"] .ok-dt-foot`)!
    const detailed = all.filter((k) => k !== 'set-aside')
    expect(kinds(foot), 'at rest: the first three, in order').toEqual(detailed.slice(0, MARK_CAP))
    const more = foot.querySelector<HTMLButtonElement>('[data-card-more]')!
    expect([more.getAttribute('data-card-more'), more.textContent, more.getAttribute('aria-expanded')]).toEqual([String(detailed.length - MARK_CAP), `+${detailed.length - MARK_CAP}`, 'false'])
    expect(foot.lastElementChild!.getAttribute('data-core-author'), 'whose it is is last').toBe(card.id)
    fireEvent.click(more)
    expect([kinds(foot), more.getAttribute('aria-expanded')], 'a press draws every mark, in the same order').toEqual([detailed, 'true'])
    // PARITY with the Simple foot: the same marks in the same order (Simple adds the set-aside mark first).
    cleanup()
    const simple = render(<SimpleFace card={card} model={withCard(ASKED, card).model} noted={false} />).container
    fireEvent.click(simple.querySelector<HTMLButtonElement>('[data-card-more]')!)
    expect(kinds(simple).filter((k) => k !== 'set-aside')).toEqual(detailed)
  })
  it('F4 CONTRAST: a card with no more than MARK_CAP state marks draws no "+N" on Detailed, and no unused or worth mark is lost to the cap', () => {
    const card = { ...crowdedCard(), challenged: false, reason: null, worth_checking: [TWO[0]!] } as unknown as ViewCard
    const foot = draw(withCard(ASKED, card), card.id, 'working').querySelector<HTMLElement>(`[data-core-card="${card.id}"] .ok-dt-foot`)!
    expect([kinds(foot), foot.querySelector('[data-card-more]')]).toEqual([['worth-checkingestimate_held_as_one_figure', 'unused'], null])
  })
})

describe('C5 a condition is neutral and has its own icon; orange only from core\'s own challenge field', () => {
  // A real condition card of the served European View (core's `condition` family); `challenged` is core's own field, set here only to contrast it.
  const cond = (extra: Partial<ViewCard> = {}) => ({ ...cardOf(EU, 'country_readiness'), challenged: false, ...extra }) as unknown as ViewCard
  it('N0 precondition: the served card is of the condition family', () => { expect(cardOf(EU, 'country_readiness').family).toBe('condition') })
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

describe('C7 the figure pencil follows the View edit contract', () => {
  it.each([false, true])('E1 places the editable figure pencil in its Simple slot (Olumi look: %s)', (olumiLook) => {
    const lane = vi.spyOn(coreLane, 'isOlumiCoreLane').mockReturnValue(olumiLook)
    const slot = olumiLook ? '.ok-card-chrome' : '[data-simple-foot]'
    const editable = EU.model!.cards.find((c) => c.figure?.edit != null)
    expect(editable, 'precondition: the served View carries an edit on a figure').toBeDefined()
    try {
      expect(draw(EU, editable!.id, 'simple').querySelector(`${slot} [data-card-edit-cue]`)).not.toBeNull()
      cleanup()
      const none = { ...editable!, figure: { ...editable!.figure!, edit: null } } as unknown as ViewCard
      const root = draw(withCard(EU, none), none.id, 'simple')
      expect(root.querySelector('[data-card-edit-cue]')).toBeNull()
      expect(root.querySelector('.ok-card-chrome [data-figure-edit-wrap]')).toBeNull()
    } finally {
      lane.mockRestore()
    }
  })
})

describe('a mark inside a focusable card (Codex P1: the one labelled-icon machinery, look/icons.tsx LabelledIcon)', () => {
  const olumis = EU.model!.cards.find((c) => c.author?.by === 'olumi')!
  it('real focus on the card opens the mark\'s tip; the card is the one tab stop; the pointer on the mark opens it too', () => {
    vi.useFakeTimers()
    try {
      const { container } = render(<div tabIndex={0} data-testid="host"><AuthorMark card={olumis} /></div>)
      const host = container.querySelector<HTMLElement>('[data-testid="host"]')!, mark = container.querySelector<HTMLElement>('[data-author-mark]')!
      expect([...container.querySelectorAll('[tabindex]')], 'one tab stop: the card').toEqual([host])
      expect(document.querySelector('[data-testid="lane-tip"]')).toBeNull()
      act(() => { host.focus() })
      act(() => { vi.advanceTimersByTime(TIP_DELAY) })
      expect(document.querySelector('[data-testid="lane-tip"]')?.textContent, 'the card\'s focus opens the mark\'s tip').toBe(mark.getAttribute('aria-label'))
      act(() => { host.blur() })
      expect(document.querySelector('[data-testid="lane-tip"]')).toBeNull()
      fireEvent.pointerEnter(mark)
      act(() => { vi.advanceTimersByTime(TIP_DELAY) })
      expect(document.querySelector('[data-testid="lane-tip"]')?.textContent, 'the pointer on the mark').toBe(mark.getAttribute('aria-label'))
    } finally { vi.useRealTimers() }
  })
  it('alone it is its own tab stop', () => {
    const { container } = render(<AuthorMark card={olumis} />)
    expect(container.querySelector('[data-author-mark]')).toHaveAttribute('tabindex', '0')
  })
  // Post-list 14: the numbered-question mark (C4) takes the same path as the author mark; the question's words are its name and its tip.
  it('the numbered-question mark: the card\'s focus opens the question\'s words; alone it is its own tab stop', () => {
    const words = 'Roughly how much does the uplift bring?'
    vi.useFakeTimers()
    try {
      const { container } = render(<div tabIndex={0} data-testid="host"><QuestionMark id={olumis.id} n={2} words={words} /></div>)
      const host = container.querySelector<HTMLElement>('[data-testid="host"]')!, mark = container.querySelector<HTMLElement>('[data-question-n]')!
      expect([[...container.querySelectorAll('[tabindex]')].length, mark.getAttribute('aria-label'), mark.hasAttribute('title')]).toEqual([1, words, false])
      act(() => { host.focus() })
      act(() => { vi.advanceTimersByTime(TIP_DELAY) })
      expect(document.querySelector('[data-testid="lane-tip"]')?.textContent).toBe(words)
      act(() => { host.blur() })
      expect(document.querySelector('[data-testid="lane-tip"]')).toBeNull()
    } finally { vi.useRealTimers() }
    cleanup()
    expect(render(<QuestionMark id={olumis.id} n={2} words={words} />).container.querySelector('[data-question-n]')).toHaveAttribute('tabindex', '0')
  })
})

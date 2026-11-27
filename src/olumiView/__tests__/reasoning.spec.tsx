/**
 * The Reasoning tab on the olumi-core lane (redesign, 18 Nov 2026): how sound the thinking is. Bound by identity on core's own Views: each row
 * by its card or rest id, each word at its View path, each press by the exact core string it fills or the card id it focuses; every new
 * section has a present/absent contrast. The state-strip rows are kept from the tab before the redesign (the strip is unchanged).
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

const chat = vi.hoisted(() => ({ prefill: vi.fn(), method: vi.fn() }))
vi.mock('../ViewChat', async (importOriginal) => ({ ...(await importOriginal<typeof import('../ViewChat')>()), prefillComposer: chat.prefill, runMethod: chat.method }))
const commit = vi.hoisted(() => ({ open: vi.fn() }))
vi.mock('../v12/team/CommitForm', async (importOriginal) => ({ ...(await importOriginal<typeof import('../v12/team/CommitForm')>()), openCommitDraft: commit.open }))
const diff = vi.hoisted(() => ({ data: null as unknown }))
vi.mock('../../olumiCore/team/CardDiffers', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../olumiCore/team/CardDiffers')>()), useRevealedDifferences: () => diff.data }))
const focus = vi.hoisted(() => ({ node: vi.fn() }))
vi.mock('../../canvas/utils/focusHelpers', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../canvas/utils/focusHelpers')>()), focusNodeById: focus.node }))

vi.mock('../v12/showInWorkspace/show', async (importOriginal) => ({ ...(await importOriginal<typeof import('../v12/showInWorkspace/show')>()), recordReach: () => 'card' }))

import type { View } from '../client'
import { useViewStore } from '../store'
import { challengedCards } from '../layout'
import { REASONING_LABELS, RESTS_AT_REST, ViewReasoningBlock } from '../ViewReasoning'
import { clearWhatIf, useWhatIf, type WhatIfVariant } from '../whatif'
import { setTeamFetch } from '../../olumiCore/team/api'
import { resetWrites } from '../../olumiCore/team/writes'
import { useMe } from '../../olumiCore/me'
import { trackPct } from '../port/pick'
import { expectAllBound } from '../port/__tests__/viewAt'

const read = (n: string): View => JSON.parse(readFileSync(path.resolve('src/olumiView/golden', n), 'utf8'))
const real = (n: string): View => JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/real', `${n}.view3.json`), 'utf8'))
const ready = (view: View, more: object = {}) => {
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false, ...more } as never)
  useMe.setState({ me: { id: view.you_id, name: view.you }, status: 'ready' })
}
afterEach(() => { cleanup(); clearWhatIf(); setTeamFetch(null); resetWrites(); chat.prefill.mockReset(); chat.method.mockReset(); commit.open.mockReset(); diff.data = null; focus.node.mockReset(); useViewStore.setState({ uuid: null, sid: null, view: null, error: null, status: 'none' } as never); useMe.setState({ me: null, status: 'none' }) })

describe('what the uncertainty rests on (run.rests): a bar per figure, by whose figure it is', () => {
  it("european: at rest the first three rests in core's order, each with its first figure (core's figure-list label once); the other groups and the further figures behind ONE press, which draws every group; each figure a bar to its share, coloured by whose; core's give ✎ once per figure", () => {
    const view = read('european.view.json'), run = view.model!.run!
    const rests = run.rests.filter((r) => r.line !== '' && (r.figures ?? []).some((f) => f.line !== ''))
    expect(rests.length).toBeGreaterThan(2)
    ready(view)
    render(<ViewReasoningBlock />)
    expect(screen.queryByTestId('reasoning-rests')).toBeNull()
    fireEvent.click(screen.getByTestId('view-reasoning-rests-toggle'))
    const box = screen.getByTestId('reasoning-rests')
    const groups = () => [...box.querySelectorAll<HTMLElement>('[data-rest]')].map((e) => e.dataset['rest'])
    const first3 = rests.slice(0, RESTS_AT_REST)
    expect(rests.length, 'precondition: more groups than fit at rest').toBeGreaterThan(RESTS_AT_REST)
    expect(groups()).toEqual(first3.map((r) => r.id))
    expect([...box.querySelectorAll<HTMLElement>('[data-rest-figure]')].map((e) => e.dataset['restFigure'])).toEqual(first3.map((r) => (r.figures ?? []).filter((f) => f.line !== '')[0]!.id))
    expect(box.querySelector('[data-view="run.rests_figures_heading"]')!.textContent).toBe(run.rests_figures_heading)
    expect(box.querySelectorAll('[data-testid="reasoning-rests-more"]'), 'ONE disclosure holds everything folded').toHaveLength(1)
    const more = screen.getByTestId('reasoning-rests-more')
    expect([more.getAttribute('aria-expanded'), document.getElementById(more.getAttribute('aria-controls')!)?.contains(box.querySelector('[data-rest]'))]).toEqual(['false', true])
    fireEvent.click(more)
    expect(more.getAttribute('aria-expanded')).toBe('true')
    expect(groups()).toEqual(rests.map((r) => r.id))
    for (const r of rests) {
      const g = box.querySelector<HTMLElement>(`[data-rest="${r.id}"]`)!
      expect(g.querySelector('[data-testid="rests-sentence"]')!.textContent, 'core\'s hover is the sentence at rest').toBe(r.hover)
      const figs = (r.figures ?? []).filter((f) => f.line !== '')
      expect([...g.querySelectorAll<HTMLElement>('[data-rest-figure]')].map((e) => e.dataset['restFigure'])).toEqual(figs.map((f) => f.id))
      for (const f of figs) {
        const bar = g.querySelector<SVGElement>(`[data-rest-figure="${f.id}"] [data-testid="reasoning-share-bar"]`)!
        expect([bar.getAttribute('data-share'), bar.getAttribute('data-whose')]).toEqual([String(trackPct(f.share)), f.whose])
      }
    }
    const given = [...new Set(rests.flatMap((r) => (r.figures ?? []).filter((f) => f.line !== '' && f.give !== null).map((f) => f.id)))]
    for (const id of given) expect(box.querySelectorAll(`[data-testid="reasoning-rests-edit-${id}"]`), id).toHaveLength(1)
    expect(expectAllBound(view, box, expect)).toBeGreaterThan(0)
  })
  it('A4 a group with core\'s headline and no figure detail is kept: its sentence is drawn at rest, only the empty figure list is omitted; CONTRAST: a group with figures keeps its list', () => {
    const view = structuredClone(read('european.view.json')), rs = view.model!.run!.rests
    const bare = rs.find((r) => r.line !== '' && (r.figures ?? []).length > 0)!, kept = rs.find((r) => r !== bare && r.line !== '' && (r.figures ?? []).length > 0)!
    ;(bare as { figures?: unknown }).figures = undefined
    ready(view); render(<ViewReasoningBlock />)
    fireEvent.click(screen.getByTestId('view-reasoning-rests-toggle'))
    fireEvent.click(screen.getByTestId('reasoning-rests-more'))   // the later groups are behind the one press; opened so both groups are in view
    const box = screen.getByTestId('reasoning-rests')
    const g = box.querySelector<HTMLElement>(`[data-rest="${bare.id}"]`)!
    expect(g.querySelector('[data-testid="rests-sentence"]')!.textContent).toBe(bare.hover || bare.line)
    expect([g.querySelectorAll('[data-rest-figure]').length, g.querySelector('ul')]).toEqual([0, null])
    expect(box.querySelector(`[data-rest="${kept.id}"] [data-rest-figure]`), 'CONTRAST').not.toBeNull()
  })
  it('CONTRAST: an older View whose figure lacks give draws the bar with no ✎ and does not crash', () => {
    const view = structuredClone(read('european.view.json'))
    const f = view.model!.run!.rests.find((r) => r.line !== '' && (r.figures ?? []).length > 0)!.figures![0]!
    delete (f as { give?: unknown }).give
    ready(view)
    render(<ViewReasoningBlock />)
    fireEvent.click(screen.getByTestId('view-reasoning-rests-toggle'))
    expect(screen.getByTestId('reasoning-rests').querySelector(`[data-rest-figure="${f.id}"] [data-testid="reasoning-share-bar"]`)).not.toBeNull()
    expect(screen.getByTestId('reasoning-rests').querySelectorAll(`[data-testid="reasoning-rests-edit-${f.id}"]`)).toHaveLength(0)
  })
  it('CONTRAST: a model whose Run sends no rests (app-launch, no chance yet) draws no such section and no bar', () => {
    const view = read('app-launch.view.json')
    expect(view.model!.run!.rests ?? []).toHaveLength(0)
    ready(view)
    render(<ViewReasoningBlock />)
    expect(screen.queryByTestId('reasoning-rests')).toBeNull()
    expect(screen.queryAllByTestId('reasoning-share-bar')).toHaveLength(0)
  })
})

const openAll = () => { const more = document.querySelector('[data-check-more="examine"]'); if (more !== null) fireEvent.click(more) }
const checkButton = (key: string) => document.querySelector<HTMLButtonElement>(`[data-check-item="${key}"]`)!
const selectItem = (key: string) => { const row = checkButton(key); fireEvent.click(row); return row.closest('li')! }

describe('worth examining: one list that claims no priority core has not computed', () => {
  it('capacity: no "Start here" lead; challenged cards first, then questions and asks, then sharpen prompts; each Olumi row carries Olumi\'s mark', () => {
    const view = real('capacity')
    ready(view)
    render(<ViewReasoningBlock />)
    expect(screen.queryByTestId('reasoning-focus')).toBeNull()
    expect(screen.getByTestId('view-reasoning').textContent).not.toContain('Start here')
    openAll()
    const rows = [...document.querySelectorAll<HTMLButtonElement>('[data-check-group="examine"] [data-check-item]')]
    const kinds = rows.map((row) => row.dataset.checkItem![0]).map((kind) => kind === 'w' ? 'q' : kind)
    for (const row of rows.filter((r) => !r.dataset.checkItem!.startsWith('c:'))) expect(row.querySelector('[data-icon="olumi-ai"]')).not.toBeNull()
    expect(kinds.join('')).toMatch(/^c*q*s*$/)
  })
  it('CONTRAST: nothing to examine (no challenge, question, offered method or ask) draws no list', () => {
    const view = structuredClone(read('app-launch.view.json'))
    view.model!.coaching_questions = []
    view.model!.sharpen = []
    const w = view.model_words as unknown as Record<string, unknown>
    delete w.askOption; delete w.askRisk
    ready(view)
    render(<ViewReasoningBlock />)
    expect(document.querySelector('[data-check-group="examine"]')).toBeNull()
  })
})

describe('questions worth answering: one press fills the message box with core\'s words, nothing sent', () => {
  it('app-launch: every coaching question once, in core\'s order; each press fills the box with that exact question', () => {
    const view = read('app-launch.view.json'), qs = view.model!.coaching_questions!
    expect(qs.length).toBeGreaterThan(1)
    ready(view)
    render(<ViewReasoningBlock />)
    openAll()
    expect([...document.querySelectorAll('[data-view-words^="coaching_questions."]')].map((e) => e.textContent)).toEqual(qs)
    const rows = document.querySelectorAll('[data-check-item^="q:"]')
    expect(rows).toHaveLength(qs.length)
    fireEvent.click(rows[1]!)
    expect(chat.prefill).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: REASONING_LABELS.fill }))
    expect(chat.prefill.mock.calls).toEqual([[qs[1]]])
    expect(chat.method).not.toHaveBeenCalled()
  })
  it('core\'s widening asks fill the box with core\'s draft for them, not their label', () => {
    const view = read('app-launch.view.json'), w = view.model_words as unknown as Record<string, string>
    ready(view)
    render(<ViewReasoningBlock />)
    openAll()
    const ask = checkButton('w:askRisk')
    if (typeof w.askRisk !== 'string') { expect(ask).toBeNull(); return }
    expect(ask.querySelector('[data-view-words="model_words.askRisk"]')!.textContent).toBe(w.askRisk)
    expect(screen.queryByRole('button', { name: REASONING_LABELS.fill })).toBeNull()
    fireEvent.click(ask)
    const fill = screen.getByRole('button', { name: REASONING_LABELS.fill })
    expect(fill).toHaveClass('border-panel-border')
    fireEvent.click(fill)
    expect(chat.prefill.mock.calls).toEqual([[w.askRiskDraft]])
  })
  it('CONTRAST: a model with no coaching questions draws no question rows', () => {
    const view = structuredClone(read('app-launch.view.json'))
    view.model!.coaching_questions = []
    ready(view)
    render(<ViewReasoningBlock />)
    openAll()
    expect(document.querySelectorAll('[data-check-item^="q:"]')).toHaveLength(0)
  })
})

describe('try a method: core\'s sharpen prompt with ONE press labelled by core\'s method words', () => {
  it('a sharpen row whose move core offers in session.methods: its press runs that method by its id', () => {
    const view = structuredClone(read('app-launch.view.json'))
    const s = view.model!.sharpen.find((x) => x.move !== null)
    expect(s, 'precondition: a sharpen row names a move').toBeDefined()
    view.session!.methods.push({ ...view.session!.methods[0]!, id: s!.move!, text: 'Method words for the move' })
    ready(view)
    render(<ViewReasoningBlock />)
    openAll()
    const press = selectItem(`s:${s!.id}`).querySelector<HTMLElement>('[data-testid="reasoning-method"]')!
    expect(press.textContent).toBe('Method words for the move')
    fireEvent.click(press)
    expect(chat.method.mock.calls).toEqual([[s!.move]])
  })
  it('pricing: core names the move widen_options but offers it as else_do; the option-breadth row runs else_do with core\'s words for it', () => {
    const view = read('pricing.view.json'), methods = view.session!.methods
    const s = view.model!.sharpen.find((x) => x.move === 'widen_options')!
    expect([s, methods.some((m) => m.id === 'widen_options'), methods.some((m) => m.id === 'else_do')]).toEqual([expect.anything(), false, true])
    ready(view)
    render(<ViewReasoningBlock />)
    openAll()
    const press = selectItem(`s:${s.id}`).querySelector<HTMLElement>('[data-testid="reasoning-method"]')!
    expect(press.textContent).toBe(methods.find((m) => m.id === 'else_do')!.text)
    fireEvent.click(press)
    expect(chat.method.mock.calls).toEqual([['else_do']])
  })
  it('a sharpen row whose move Core does not offer keeps the general Ask action', () => {
    const view = structuredClone(read('app-launch.view.json'))
    for (const x of view.model!.sharpen) x.move = 'not_offered'
    ready(view)
    render(<ViewReasoningBlock />)
    openAll()
    const rows = document.querySelectorAll<HTMLButtonElement>('[data-check-item^="s:"]')
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      fireEvent.click(row)
      expect(screen.queryAllByTestId('reasoning-method')).toHaveLength(0)
      expect(screen.getByRole('button', { name: 'Ask Olumi about this' })).toBeInTheDocument()
    }
  })
})

describe('challenge your thinking', () => {
  it('capacity: each challenged card once; expanding test_net_contribution focuses the card and shows Core’s detail once', () => {
    const view = real('capacity'), cs = challengedCards(view.model!)
    expect(cs.length).toBeGreaterThan(0)
    ready(view)
    render(<ViewReasoningBlock />)
    openAll()
    const rows = [...document.querySelectorAll<HTMLButtonElement>('[data-check-item^="c:"]')]
    expect(rows.map((r) => r.dataset.checkItem)).toEqual(cs.map((c) => `c:${c.id}`))
    const card = cs.find((c) => c.id === 'test_net_contribution')!
    expect(card.detail).toBeTruthy()
    expect(card.reason).toBeTruthy()
    const row = checkButton(`c:${card.id}`)
    fireEvent.click(row)
    const panel = document.getElementById(row.getAttribute('aria-controls')!)!
    expect(panel).toBeVisible()
    const paragraphs = panel.querySelectorAll('p')
    expect(paragraphs).toHaveLength(1)
    expect(paragraphs[0]).toHaveAttribute('data-view', `${card.id}.detail`)
    expect(paragraphs[0]!.textContent).toBe(card.detail)
    const reasoning = screen.getByTestId('view-reasoning')
    expect(reasoning.querySelectorAll(`[data-view="${card.id}.detail"], [data-view="${card.id}.reason"]`)).toHaveLength(1)
    expect(expectAllBound(view, reasoning, expect)).toBeGreaterThan(0)
    expect(focus.node.mock.calls).toEqual([[card.id]])
  })
  it('the Reasoning tab draws none of the Analysis tab\'s chances, and none of the deleted strips (glance, rack, people, commitment)', () => {
    const view = read('bakery.view.json')
    ready(view)
    render(<ViewReasoningBlock />)
    const body = screen.getByTestId('view-reasoning')
    expect(body.querySelectorAll('[data-view="run.lead"], [data-view="run.most_likely.text"], [data-testid="analysis-chance-chart"]')).toHaveLength(0)
    for (const t of ['view-reasoning-glance', 'view-reasoning-rack', 'view-reasoning-people', 'view-reasoning-commitment', 'view-reasoning-outcomes']) expect(screen.queryByTestId(t), t).toBeNull()
  })

  it('Check omits finite chance values while allowing a held value at its Core path', () => {
    const view = read('bakery.view.json')
    const chances = view.model!.cards.flatMap((card) => card.rows.flatMap((value, index) =>
      value.kind === 'chance' && Number.isFinite(value.chance) ? [{ card, value, index, at: `${card.id}.rows.${index}.value` }] : []))
    const held = chances.find(({ card, value }) => card.family === 'option' && card.status === null && value.value !== '')!
    const finitePaths = new Set(chances.filter((chance) => chance !== held).map(({ at }) => at))
    expect(finitePaths.size).toBeGreaterThan(0)
    held.value.chance = null
    held.value.value = 'Core held value'
    ready(view)
    render(<ViewReasoningBlock />)
    const check = screen.getByTestId('check-list')
    const assertNoFiniteValues = () => {
      const bound = [...check.querySelectorAll<HTMLElement>('[data-view]')].map((element) => element.dataset.view!)
      expect(bound.filter((at) => finitePaths.has(at))).toEqual([])
    }
    assertNoFiniteValues()
    for (const toggle of check.querySelectorAll('[data-check-more]')) fireEvent.click(toggle)
    for (const row of check.querySelectorAll('[data-check-item]')) {
      fireEvent.click(row)
      assertNoFiniteValues()
      if (row.getAttribute('data-check-item') === `held:${held.card.id}.${held.index}`) {
        expect(check.querySelector(`[data-view="${held.at}"]`)?.textContent).toBe(held.value.value)
      }
    }
    expect(check.querySelector(`[data-check-item="held:${held.card.id}.${held.index}"]`)).toBeInTheDocument()
  })
})

describe('towards commitment: where views differ, what is still disputed, what is recorded in full, and one press into the ONE form', () => {
  type Collab = View['collab']
  const recordsToggle = () => screen.getByTestId('view-reasoning-commitment-records-toggle')
  const withRecords = (): View => {
    const view = structuredClone(read('app-launch.view.json'))
    const c = view.collab as Collab
    c.dissent = [{ id: 'dissent_t1', holder: 'Tobias', position: 'Keep the long version: finishers pay more.', holder_id: null, confirmed: null }]
    c.commitments = [{ ...({} as Collab['commitments'][number]), id: 7, at: '2026-11-18T10:00:00Z', by: 'Ada', by_id: view.you_id, action: 'Run a two-week split test', owner: 'Ada', owner_id: view.you_id,
      expect: 'Conversion holds at 6%', reconsider: 'Paid conversion falls under 5%', keeps: ['dissent_t1'], outcomes: [], option: null, version: null, expect_band: null, review_on: '2026-12-02', trigger: null }]
    return view
  }
  it('each open disagreement in full in its holder\'s words; each recorded action with owner, expectation, reconsider line, the dissent it keeps open and its review date; the press opens the shared draft', () => {
    const view = withRecords()
    ready(view)
    render(<ViewReasoningBlock />)
    const box = screen.getByTestId('reasoning-commitment')
    const door = recordsToggle()
    const action = screen.getByRole('button', { name: 'Record what you will do' })
    expect(door).toHaveAttribute('aria-expanded', 'false')
    expect(door.querySelector('[data-count]')).toHaveTextContent('2')
    expect(box.querySelector('[data-dissent], [data-commitment]')).toBeNull()
    expect(action).toBeVisible()
    fireEvent.click(action)
    expect(commit.open.mock.calls).toEqual([[view.id, view]])
    expect(door).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(door)
    expect(box.querySelector('[data-dissent="dissent_t1"]')!.textContent).toBe('Tobias: Keep the long version: finishers pay more.')
    expect(box.querySelector('[data-commitment="7"]')!.textContent).toContain('Run a two-week split test')
    expect(['owner', 'expect', 'reconsider', 'keep', 'review'].map((f) => screen.getByTestId(f === 'keep' ? 'reasoning-commitment-keep-7-0' : `reasoning-commitment-${f}-7`).textContent)).toEqual([
      'Owner: Ada', 'What we expect: Conversion holds at 6%', 'What would make us reconsider: Paid conversion falls under 5%', 'Keeps open: Tobias: Keep the long version: finishers pay more.', 'Review on: 2026-12-02'])
    expect(chat.prefill).not.toHaveBeenCalled()
  })
  it('a commitment\'s trigger sentence and its latest outcome are drawn by its id; without them, neither line is drawn', () => {
    const view = withRecords()
    const k = (view.collab as Collab).commitments[0]!
    k.trigger = { ...({} as NonNullable<typeof k.trigger>), text: 'If paid conversion with three screens falls below 5%, the lead changes.' }
    // Core's real order (read-view.ts:213 at 339b3286: own rows .reverse()): the NEWEST outcome first.
    k.outcomes = [{ ...({} as (typeof k.outcomes)[number]), id: 2, happened: 'Conversion fell to 5.8%.' }, { ...({} as (typeof k.outcomes)[number]), id: 1, happened: 'Conversion held at 6.2%.' }]
    ready(view)
    render(<ViewReasoningBlock />)
    fireEvent.click(recordsToggle())
    expect([screen.getByTestId('reasoning-commitment-trigger-7').textContent, screen.getByTestId('reasoning-commitment-happened-7').textContent])
      .toEqual(['If paid conversion with three screens falls below 5%, the lead changes.', 'What happened: Conversion fell to 5.8%.'])
    cleanup()
    ready(withRecords())
    render(<ViewReasoningBlock />)
    fireEvent.click(recordsToggle())
    expect([screen.queryByTestId('reasoning-commitment-trigger-7'), screen.queryByTestId('reasoning-commitment-happened-7')]).toEqual([null, null])
  })
  it('a challenged card that is a recorded disagreement is said once: in full under Towards commitment, not in the list above', () => {
    const view = withRecords()
    const card = view.model!.cards[0]!
    ;(view.collab as Collab).dissent[0]!.id = card.id
    card.challenged = true as never
    ready(view)
    render(<ViewReasoningBlock />)
    openAll()
    fireEvent.click(recordsToggle())
    expect(document.querySelectorAll(`[data-check-item="c:${card.id}"]`)).toHaveLength(0)
    const row = screen.getByTestId('reasoning-commitment').querySelector<HTMLElement>(`[data-dissent="${card.id}"]`)!
    expect(row.textContent).toBe('Tobias: Keep the long version: finishers pay more.')
    fireEvent.click(row.querySelector('button')!)
    expect(focus.node.mock.calls).toEqual([[card.id]])
  })
  it('a figure difference between revealed views: its card (one press to it) and the Team tab\'s own WhereYouDiffer under it, with core\'s sentence, each person\'s figure and what would settle it', () => {
    const view = withRecords(), cid = view.model!.cards[0]!.id
    diff.data = { scenario: 's', version: 1, gated: false, heading: 'Where your views differ', empty: '', headings: { sides: '', options: '', model: '', settle: '', steps: '', dissent: '', research: '', commit: '' },
      differences: [{ kind: 'figure', cards: [cid], record: cid, label: 'Paid conversion', goal: 'g1', goal_label: 'Pay back', status: 'changes', status_text: 'Your figures change which option is most likely.',
        sides: [{ view: 1, holder: 'Ada', holder_id: 'p1', figure: cid, title: '', leader: null, text: 'Ada: about 6%' }, { view: 2, holder: 'Tobias', holder_id: 'p2', figure: cid, title: '', leader: null, text: 'Tobias: about 4%' }],
        options: [], settle: [{ kind: 'crossing', text: 'Above 6% the lead flips.', fact: null }], steps: [] }] } as never
    ready(view)
    render(<ViewReasoningBlock />)
    const row = screen.getByTestId('reasoning-commitment-differ').querySelector<HTMLElement>(`[data-difference="${cid}"]`)!
    expect(row.querySelector('[data-differ-status-text]')!.textContent).toBe('Your figures change which option is most likely.')
    expect([...row.querySelectorAll('[data-differ-side]')].map((e) => e.textContent)).toEqual(['Ada: about 6%', 'Tobias: about 4%'])
    expect(row.querySelector('[data-differ-settle]')!.textContent).toBe('Above 6% the lead flips.')
    fireEvent.click(row.querySelector('[data-testid="reasoning-difference-card"]')!)
    expect(focus.node.mock.calls).toEqual([[cid]])
  })
  it('a difference about a factor one member thinks is missing names no card: said without a press', () => {
    diff.data = { scenario: 's', version: 1, gated: false, heading: 'Where your views differ', empty: '', headings: { sides: '', options: '', model: '', settle: '', steps: '', dissent: '', research: '', commit: '' },
      differences: [{ kind: 'factor', cards: [], record: 'factor:r9', label: 'Onboarding cost', goal: 'g1', goal_label: '', status: 'not_run', status_text: 'Not run: a factor one of you thinks is missing.', sides: [], options: [], settle: [], steps: [] }] } as never
    ready(withRecords())
    render(<ViewReasoningBlock />)
    const row = screen.getByTestId('reasoning-commitment-differ').querySelector<HTMLElement>('[data-difference="factor:r9|g1"]')!
    expect([row.querySelector('button'), row.querySelector('[data-testid="reasoning-difference-status"]')!.textContent]).toEqual([null, 'Onboarding cost: Not run: a factor one of you thinks is missing.'])
  })
  it('CONTRAST: before a reveal (no differences read) no differ block is drawn', () => {
    diff.data = null
    ready(withRecords())
    render(<ViewReasoningBlock />)
    expect(screen.queryByTestId('reasoning-commitment-differ')).toBeNull()
  })
  it('a commitment made from an option ("Commit to this") is listed once, by its id, with that option\'s heading', () => {
    const view = withRecords()
    const option = view.model!.cards.find((c) => c.family === 'option') ?? view.model!.cards[0]!
    ;(view.collab as Collab).commitments[0]!.option = { id: option.id, heading: option.heading }
    ready(view)
    render(<ViewReasoningBlock />)
    fireEvent.click(recordsToggle())
    const box = screen.getByTestId('reasoning-commitment')
    expect(box.querySelectorAll('[data-commitment]')).toHaveLength(1)
    expect(box.querySelector('[data-commitment-option="7"]')!.textContent).toBe(option.heading)
    expect(box.textContent!.split('Run a two-week split test')).toHaveLength(2)
  })
  it('CONTRAST: a past version shows what was recorded but offers no form; nothing recorded on a past version draws no section', () => {
    const view = withRecords()
    ready(view, { at: 3 })
    render(<ViewReasoningBlock />)
    fireEvent.click(recordsToggle())
    expect(screen.getByTestId('reasoning-commitment').querySelector('[data-commitment="7"]')).not.toBeNull()
    expect(screen.queryByTestId('reasoning-commit-open')).toBeNull()
    cleanup()
    ready(read('app-launch.view.json'), { at: 3 })
    render(<ViewReasoningBlock />)
    expect(screen.queryByTestId('reasoning-commitment')).toBeNull()
  })
})

describe('pending is never shown as current', () => {
  // R25 (DL 7 Nov after Paul's 6 Nov test, superseding "a held proposal draws nothing"): a held proposal's Run is drawn under core's
  // proposal heading and base, so it never reads as the approved Run; a stale View or a failed read still draws nothing.
  it('a held proposal draws under core\'s heading and base; a stale View or a failed read draws nothing; the approved model draws the Run', () => {
    const held = read('proposal.view.json')
    expect(held.proposal).not.toBeNull()
    ready(held)
    const { rerender } = render(<ViewReasoningBlock />)
    expect(screen.getByTestId('view-reasoning')).not.toBeNull()
    // say3: the proposal's dashed strip is drawn on the Analysis tab only (port/analysisTabs.spec); the Reasoning tab does not say it again.
    expect(screen.queryByTestId('view-tabs-held-proposal')).toBeNull()
    const bakery = read('bakery.view.json')
    for (const bad of [{ stale: true }, { error: 'Olumi could not be reached.' }]) {
      ready(bakery, bad)
      rerender(<ViewReasoningBlock />)
      expect(screen.queryByTestId('view-reasoning'), JSON.stringify(bad)).toBeNull()
    }
    ready(bakery)
    rerender(<ViewReasoningBlock />)
    expect(screen.getByTestId('view-reasoning').querySelector('[data-testid="view-reasoning-rests-toggle"]')).not.toBeNull()
  })
})


describe('the tab says its state once, above it', () => {
  const realLook = useViewStore.getState().look
  afterEach(() => { useViewStore.setState({ at: null, look: realLook } as never) })
  const whatIf = read('whatif.view.json')
  const variant = JSON.parse(readFileSync(path.resolve('src/olumiView/golden/whatif.answer.json'), 'utf8')).variants[0] as WhatIfVariant
  const show = (base: number, sid = whatIf.id) => useWhatIf.setState({ shown: { sid, base, quantity: variant.edits[0]!.quantity, typed: '5', variant } })

  it('a held proposal: the Reasoning tab draws no strip (say3: the proposal is said on Analysis and in the panel\'s foot, not on every tab); the tab itself draws', () => {
    const held = read('proposal.view.json')
    ready(held)
    const { container } = render(<ViewReasoningBlock />)
    expect(screen.getByTestId('view-reasoning')).toBeInTheDocument()
    expect(screen.queryByTestId('view-reasoning-state')).toBeNull()
    expect(container.querySelectorAll('[data-view-proposal="heading"]')).toHaveLength(0)
  })

  it('negative: a past version draws no strip and no sentence of the tab\'s own (core sends none for that state; DL 7 Nov)', () => {
    const bakery = read('bakery.view.json')
    ready(bakery, { at: 3 })
    const { container } = render(<ViewReasoningBlock />)
    expect(screen.getByTestId('view-reasoning')).toBeInTheDocument()
    expect(screen.queryByTestId('view-reasoning-state')).toBeNull()
    expect(container.textContent).not.toMatch(/Version 3|as it was|Back to the latest/)
  })

  it('a what-if on this version: said once, in the strip, and Clear there drops it; one asked on another version or scenario is not said', () => {
    ready(whatIf)
    show(whatIf.model!.edit_base!)
    const { container, rerender } = render(<ViewReasoningBlock />)
    expect(screen.getByTestId('view-reasoning-state').dataset['state']).toBe('whatif')
    expect(screen.getByTestId('view-reasoning-whatif').textContent).toBe('What-if, not saved')
    expect(container.textContent!.split('What-if, not saved')).toHaveLength(2)
    expect(screen.queryByTestId('view-whatif-clear')).toBeNull()
    expect(screen.getByTestId('view-whatif').querySelector('[data-view="whatif.edits.0.words"]')!.textContent).toBe(variant.edits[0]!.words)
    fireEvent.click(screen.getByTestId('view-reasoning-whatif-clear'))
    expect(useWhatIf.getState().shown).toBeNull()
    expect(screen.queryByTestId('view-reasoning-state')).toBeNull()
    show(whatIf.model!.edit_base! + 1)
    rerender(<ViewReasoningBlock />)
    expect(screen.queryByTestId('view-reasoning-state')).toBeNull()
    expect(screen.queryByTestId('view-whatif')).toBeNull()
    // The same version number on another scenario (a what-if still held after the person opened another one): not this tab's.
    show(whatIf.model!.edit_base!, 's_00000000ffff')
    rerender(<ViewReasoningBlock />)
    expect(screen.queryByTestId('view-reasoning-state')).toBeNull()
    expect(screen.queryByTestId('view-whatif')).toBeNull()
  })

  it('a proposal held back while a what-if is shown: the strip says the proposal, and the what-if box keeps its own label and Clear', () => {
    // Core holds a proposal back from a viewer who has not given their own view (view.ts `heldProposal`): it serves `proposal`, but the
    // canvas draws the approved version, whose `edit_base` stays set, so a what-if tried on it stays shown. Never unlabelled under the
    // proposal's strip, where it would read as the proposal's figures.
    const held = read('proposal.view.json'), base = 41, v = { ...held, model: { ...held.model!, edit_base: base } }
    expect(held.proposal).not.toBeNull()
    ready(v)
    show(base, v.id)
    const { container } = render(<ViewReasoningBlock />)
    expect(screen.queryByTestId('view-reasoning-state')).toBeNull() // say3: the proposal strip is Analysis's alone; the what-if box below keeps its own label
    expect(screen.queryByTestId('view-reasoning-whatif')).toBeNull()
    expect(screen.getByTestId('view-whatif-clear')).not.toBeNull()
    expect(screen.getByTestId('view-whatif').querySelector('[data-view="whatif.edits.0.words"]')!.textContent).toBe(variant.edits[0]!.words)
    expect(container.textContent!.split('What-if, not saved')).toHaveLength(2)
    fireEvent.click(screen.getByTestId('view-whatif-clear'))
    expect(useWhatIf.getState().shown).toBeNull()
  })

  it('at rest, the latest approved model with nothing tried: no strip, and the tab starts at its own top', () => {
    ready(read('bakery.view.json'))
    const { container } = render(<ViewReasoningBlock />)
    expect(screen.queryByTestId('view-reasoning-state')).toBeNull()
    expect(container.firstElementChild!.childElementCount).toBe(0)
  })
})

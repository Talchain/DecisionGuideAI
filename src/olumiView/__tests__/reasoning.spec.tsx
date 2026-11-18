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
const focus = vi.hoisted(() => ({ node: vi.fn() }))
vi.mock('../../canvas/utils/focusHelpers', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../canvas/utils/focusHelpers')>()), focusNodeById: focus.node }))

import type { View } from '../client'
import { useViewStore } from '../store'
import { challengedCards } from '../layout'
import { ViewReasoningBlock } from '../ViewReasoning'
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
afterEach(() => { cleanup(); clearWhatIf(); setTeamFetch(null); resetWrites(); chat.prefill.mockReset(); chat.method.mockReset(); commit.open.mockReset(); focus.node.mockReset(); useViewStore.setState({ uuid: null, sid: null, view: null, error: null, status: 'none' } as never); useMe.setState({ me: null, status: 'none' }) })

describe('what the uncertainty rests on (run.rests): a bar per figure, by whose figure it is', () => {
  it('european: each rest by its id in core\'s order (two at rest, the rest behind one press); each figure a bar to its share, coloured by whose; core\'s give ✎ once per figure', () => {
    const view = read('european.view.json'), run = view.model!.run!
    const rests = run.rests.filter((r) => r.line !== '' && (r.figures ?? []).some((f) => f.line !== ''))
    expect(rests.length).toBeGreaterThan(2)
    ready(view)
    render(<ViewReasoningBlock />)
    const box = screen.getByTestId('reasoning-rests')
    const groups = () => [...box.querySelectorAll<HTMLElement>('[data-rest]')].map((e) => e.dataset['rest'])
    expect(groups()).toEqual(rests.slice(0, 2).map((r) => r.id))
    fireEvent.click(screen.getByTestId('reasoning-rests-more'))
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
  it('CONTRAST: a model whose Run sends no rests (app-launch, no chance yet) draws no such section and no bar', () => {
    const view = read('app-launch.view.json')
    expect(view.model!.run!.rests ?? []).toHaveLength(0)
    ready(view)
    render(<ViewReasoningBlock />)
    expect(screen.queryByTestId('reasoning-rests')).toBeNull()
    expect(screen.queryAllByTestId('reasoning-share-bar')).toHaveLength(0)
  })
})

describe('start here: the first actionable item, large, with ONE green action', () => {
  it('capacity: a challenged card leads; its words are core\'s heading, and its action focuses that card by its id', () => {
    const view = real('capacity'), cs = challengedCards(view.model!)
    expect(cs.length).toBeGreaterThan(0)
    ready(view)
    render(<ViewReasoningBlock />)
    const lead = screen.getByTestId('reasoning-focus')
    expect([lead.dataset['focusKind'], lead.dataset['reasoningChallenge']]).toEqual(['challenge', cs[0]!.id])
    expect(lead.querySelector('[data-testid="view-reasoning-challenge-question"]')!.textContent).toBe(cs[0]!.heading)
    expect(screen.getAllByTestId('reasoning-focus')).toHaveLength(1)
    fireEvent.click(lead.querySelector('[data-testid="reasoning-challenge-show"]')!)
    expect(focus.node.mock.calls).toEqual([[cs[0]!.id]])
  })
  it('app-launch (no challenge, no offered method): core\'s first coaching question leads, and its action fills the box with it', () => {
    const view = read('app-launch.view.json'), qs = view.model!.coaching_questions!
    ready(view)
    render(<ViewReasoningBlock />)
    const lead = screen.getByTestId('reasoning-focus')
    expect(lead.dataset['focusKind']).toBe('question')
    expect(lead.querySelector('[data-view-words="coaching_questions.0"]')!.textContent).toBe(qs[0])
    fireEvent.click(lead.querySelector('[data-testid="reasoning-question"]')!)
    expect(chat.prefill.mock.calls).toEqual([[qs[0]]])
  })
  it('CONTRAST: nothing to examine (no challenge, question, offered method or ask) draws no Start here', () => {
    const view = structuredClone(read('app-launch.view.json'))
    view.model!.coaching_questions = []
    for (const x of view.model!.sharpen) x.move = 'not_offered'
    const w = view.model_words as unknown as Record<string, unknown>
    delete w.askOption; delete w.askRisk
    ready(view)
    render(<ViewReasoningBlock />)
    expect(screen.queryByTestId('reasoning-focus')).toBeNull()
  })
})

describe('questions worth answering: one press fills the message box with core\'s words, nothing sent', () => {
  it('app-launch: every coaching question once, in core\'s order (the first leads); each press fills the box with that exact question', () => {
    const view = read('app-launch.view.json'), qs = view.model!.coaching_questions!
    expect(qs.length).toBeGreaterThan(1)
    ready(view)
    render(<ViewReasoningBlock />)
    const more = screen.queryByTestId('reasoning-examine-more')
    if (more !== null) fireEvent.click(more)
    expect([...document.querySelectorAll('[data-view-words^="coaching_questions."]')].map((e) => e.textContent)).toEqual(qs)
    const rows = screen.getAllByTestId('reasoning-question')
    expect(rows).toHaveLength(qs.length)
    fireEvent.click(rows[1]!)
    expect(chat.prefill.mock.calls).toEqual([[qs[1]]])
    expect(chat.method).not.toHaveBeenCalled()
  })
  it('core\'s widening asks fill the box with core\'s draft for them, not their label', () => {
    const view = read('app-launch.view.json'), w = view.model_words as unknown as Record<string, string>
    ready(view)
    render(<ViewReasoningBlock />)
    const more = screen.queryByTestId('reasoning-examine-more')
    if (more !== null) fireEvent.click(more)
    const ask = screen.queryByTestId('reasoning-widen-askRisk')
    if (typeof w.askRisk !== 'string') { expect(ask).toBeNull(); return }
    expect(ask!.textContent).toBe(w.askRisk)
    fireEvent.click(ask!)
    expect(chat.prefill.mock.calls).toEqual([[w.askRiskDraft]])
  })
  it('CONTRAST: a model with no coaching questions draws no question rows', () => {
    const view = structuredClone(read('app-launch.view.json'))
    view.model!.coaching_questions = []
    ready(view)
    render(<ViewReasoningBlock />)
    expect(screen.queryAllByTestId('reasoning-question')).toHaveLength(0)
  })
})

describe('try a method: core\'s sharpen prompt with ONE press labelled by core\'s method words', () => {
  it('a sharpen row whose move core offers in session.methods leads when nothing is challenged; its press runs that method by its id', () => {
    const view = structuredClone(read('app-launch.view.json'))
    const s = view.model!.sharpen.find((x) => x.move !== null)
    expect(s, 'precondition: a sharpen row names a move').toBeDefined()
    view.session!.methods.push({ ...view.session!.methods[0]!, id: s!.move!, text: 'Method words for the move' })
    ready(view)
    render(<ViewReasoningBlock />)
    const lead = screen.getByTestId('reasoning-focus')
    expect([lead.dataset['focusKind'], lead.dataset['sharpen']]).toEqual(['method', s!.id])
    const press = lead.querySelector<HTMLElement>('[data-testid="reasoning-method"]')!
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
    const press = document.querySelector<HTMLElement>(`[data-sharpen="${s.id}"] [data-testid="reasoning-method"]`)!
    expect(press.textContent).toBe(methods.find((m) => m.id === 'else_do')!.text)
    fireEvent.click(press)
    expect(chat.method.mock.calls).toEqual([['else_do']])
  })
  it('CONTRAST: a sharpen row whose move core does not offer has no press, and never leads', () => {
    const view = structuredClone(read('app-launch.view.json'))
    for (const x of view.model!.sharpen) x.move = 'not_offered'
    ready(view)
    render(<ViewReasoningBlock />)
    const more = screen.queryByTestId('reasoning-examine-more')
    if (more !== null) fireEvent.click(more)
    expect(document.querySelectorAll('[data-sharpen]').length).toBeGreaterThan(0)
    expect(screen.queryAllByTestId('reasoning-method')).toHaveLength(0)
    expect(screen.getByTestId('reasoning-focus').dataset['focusKind']).not.toBe('method')
  })
})

describe('challenge your thinking', () => {
  it('capacity: each challenged card once (the first leads), its heading and core\'s reason; each row\'s press focuses that card by its id', () => {
    const view = real('capacity'), cs = challengedCards(view.model!)
    ready(view)
    render(<ViewReasoningBlock />)
    const more = screen.queryByTestId('reasoning-examine-more')
    if (more !== null) fireEvent.click(more)
    const rows = [...document.querySelectorAll<HTMLElement>('[data-reasoning-challenge]')]
    expect(rows.map((r) => r.dataset['reasoningChallenge'])).toEqual(cs.map((c) => c.id))
    expect(expectAllBound(view, screen.getByTestId('view-reasoning'), expect)).toBeGreaterThan(0)
    if (rows.length > 1) {
      fireEvent.click(rows[1]!.querySelector('[data-testid="reasoning-challenge-show"]')!)
      expect(focus.node.mock.calls).toEqual([[cs[1]!.id]])
    }
  })
  it('the Reasoning tab draws none of the Analysis tab\'s chances, and none of the deleted strips (glance, rack, people, commitment)', () => {
    const view = read('bakery.view.json')
    ready(view)
    render(<ViewReasoningBlock />)
    const body = screen.getByTestId('view-reasoning')
    expect(body.querySelectorAll('[data-view$=".value"], [data-view="run.lead"], [data-view="run.most_likely.text"]')).toHaveLength(0)
    for (const t of ['view-reasoning-glance', 'view-reasoning-rack', 'view-reasoning-people', 'view-reasoning-commitment', 'view-reasoning-outcomes']) expect(screen.queryByTestId(t), t).toBeNull()
  })
})

describe('towards commitment: what is still disputed, what is recorded, and one press into the ONE commitment form', () => {
  type Collab = View['collab']
  const withRecords = (): View => {
    const view = structuredClone(read('app-launch.view.json'))
    const c = view.collab as Collab
    c.dissent = [{ id: 'dissent_t1', holder: 'Tobias', position: 'Keep the long version: finishers pay more.', holder_id: null, confirmed: null }]
    c.commitments = [{ ...({} as Collab['commitments'][number]), id: 7, at: '2026-11-18T10:00:00Z', by: 'Ada', by_id: view.you_id, action: 'Run a two-week split test', owner: 'Ada', owner_id: view.you_id,
      expect: 'Conversion holds at 6%', reconsider: 'Paid conversion falls under 5%', keeps: ['dissent_t1'], outcomes: [], option: null, version: null, expect_band: null, review_on: '2026-12-02', trigger: null }]
    return view
  }
  it('each open disagreement by its id in the holder\'s words; each recorded action with its reconsider line; the press opens the shared draft for this scenario', () => {
    const view = withRecords()
    ready(view)
    render(<ViewReasoningBlock />)
    const box = screen.getByTestId('reasoning-commitment')
    expect(box.querySelector('[data-dissent="dissent_t1"]')!.textContent).toBe('Tobias: Keep the long version: finishers pay more.')
    const k = box.querySelector<HTMLElement>('[data-commitment="7"]')!
    expect(k.textContent).toContain('Run a two-week split test')
    expect(k.querySelector('[data-commitment-reconsider="7"]')!.textContent).toBe('Reconsider if: Paid conversion falls under 5%')
    expect(k.querySelector('[data-commitment-review="7"]')!.textContent).toBe('Review on 2026-12-02')
    fireEvent.click(screen.getByTestId('reasoning-commit-open'))
    expect(commit.open.mock.calls).toEqual([[view.id, view]])
    expect(chat.prefill).not.toHaveBeenCalled()
  })
  it('a disagreement whose card the tab already lists as challenged is said once: here only its holder, one press to that card', () => {
    const view = withRecords()
    const card = view.model!.cards[0]!
    ;(view.collab as Collab).dissent[0]!.id = card.id
    card.challenged = true as never
    ready(view)
    render(<ViewReasoningBlock />)
    const row = screen.getByTestId('reasoning-commitment').querySelector<HTMLElement>(`[data-dissent="${card.id}"]`)!
    expect([row.dataset['dissentSaid'], row.textContent]).toEqual(['above', 'Tobias'])
    fireEvent.click(row.querySelector('button')!)
    expect(focus.node.mock.calls).toEqual([[card.id]])
  })
  it('a commitment made from an option ("Commit to this") is listed once, by its id, with that option\'s heading; the option itself is not listed again', () => {
    const view = withRecords()
    const option = view.model!.cards.find((c) => c.family === 'option') ?? view.model!.cards[0]!
    const k = (view.collab as Collab).commitments[0]!
    k.option = { id: option.id, heading: option.heading }
    ready(view)
    render(<ViewReasoningBlock />)
    const box = screen.getByTestId('reasoning-commitment')
    expect(box.querySelectorAll('[data-commitment]')).toHaveLength(1)
    expect(box.querySelector('[data-commitment-option="7"]')!.textContent).toBe(option.heading)
    expect(box.textContent!.split('Run a two-week split test')).toHaveLength(2)
  })
  it('CONTRAST: a past version shows what was recorded but offers no form; nothing recorded on a past version draws no section', () => {
    const view = withRecords()
    ready(view, { at: 3 })
    render(<ViewReasoningBlock />)
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
    const head = screen.getByTestId('view-tabs-held-proposal')
    expect(head.querySelector('[data-view-proposal="heading"]')!.textContent).toBe(held.proposal!.heading)
    expect(head.querySelector('[data-view-proposal="on"]')!.textContent).toBe(held.proposal!.on)
    const bakery = read('bakery.view.json')
    for (const bad of [{ stale: true }, { error: 'Olumi could not be reached.' }]) {
      ready(bakery, bad)
      rerender(<ViewReasoningBlock />)
      expect(screen.queryByTestId('view-reasoning'), JSON.stringify(bad)).toBeNull()
    }
    ready(bakery)
    rerender(<ViewReasoningBlock />)
    expect(screen.getByTestId('view-reasoning').querySelector('[data-testid="reasoning-rests"]')).not.toBeNull()
  })
})


describe('the tab says its state once, above it', () => {
  const realLook = useViewStore.getState().look
  afterEach(() => { useViewStore.setState({ at: null, look: realLook } as never) })
  const whatIf = read('whatif.view.json')
  const variant = JSON.parse(readFileSync(path.resolve('src/olumiView/golden/whatif.answer.json'), 'utf8')).variants[0] as WhatIfVariant
  const show = (base: number, sid = whatIf.id) => useWhatIf.setState({ shown: { sid, base, quantity: variant.edits[0]!.quantity, typed: '5', variant } })

  it('a held proposal: core\'s heading and version, in the strip above the tab, and said nowhere else', () => {
    const held = read('proposal.view.json')
    ready(held)
    const { container } = render(<ViewReasoningBlock />)
    const strip = screen.getByTestId('view-reasoning-state')
    expect(strip.dataset['state']).toBe('proposal')
    expect(strip.querySelector('[data-view-proposal="heading"]')!.textContent).toBe(held.proposal!.heading)
    expect(strip.querySelector('[data-view-proposal="on"]')!.textContent).toBe(held.proposal!.on)
    expect(container.querySelectorAll('[data-view-proposal="heading"]')).toHaveLength(1)
    expect(strip.compareDocumentPosition(screen.getByTestId('view-reasoning')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
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
    expect(screen.getByTestId('view-reasoning-state').dataset['state']).toBe('proposal')
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

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
afterEach(() => { cleanup(); clearWhatIf(); setTeamFetch(null); resetWrites(); chat.prefill.mockReset(); chat.method.mockReset(); focus.node.mockReset(); useViewStore.setState({ uuid: null, sid: null, view: null, error: null, status: 'none' } as never); useMe.setState({ me: null, status: 'none' }) })

describe('whose figures it rests on (run.rests)', () => {
  it('european: one bar per rest core sends, by its id, Olumi\'s and the person\'s shares placing its two fills; each figure once, with core\'s give ✎', () => {
    const view = read('european.view.json'), run = view.model!.run!
    const rests = run.rests.filter((r) => r.line !== '')
    expect(rests.length).toBeGreaterThan(1)
    ready(view)
    render(<ViewReasoningBlock />)
    const box = screen.getByTestId('reasoning-rests')
    expect([...box.querySelectorAll<HTMLElement>('[data-rest]')].map((e) => e.dataset['rest'])).toEqual(rests.map((r) => r.id))
    rests.forEach((r) => {
      const bar = box.querySelector<SVGElement>(`[data-rest="${r.id}"] [data-testid="reasoning-rests-bar"]`)!
      expect([bar.getAttribute('data-rests-olumi'), bar.getAttribute('data-rests-person')]).toEqual([String(trackPct(r.olumi_share)), String(trackPct(r.person_share))])
      expect(box.querySelector(`[data-rest="${r.id}"]`)!.getAttribute('title')).toBe(r.hover)
    })
    const ids = [...new Set(rests.flatMap((r) => (r.figures ?? []).filter((f) => f.line !== '').map((f) => f.id)))]
    expect([...box.querySelectorAll<HTMLElement>('[data-rest-figure]')].map((e) => e.dataset['restFigure'])).toEqual(ids)
    expect(expectAllBound(view, box, expect)).toBeGreaterThan(0)
  })
  it('CONTRAST: a model whose Run sends no rests (app-launch, no chance yet) draws no such section and no bar', () => {
    const view = read('app-launch.view.json')
    expect(view.model!.run!.rests ?? []).toHaveLength(0)
    ready(view)
    render(<ViewReasoningBlock />)
    expect(screen.queryByTestId('reasoning-rests')).toBeNull()
    expect(screen.queryAllByTestId('reasoning-rests-bar')).toHaveLength(0)
  })
})

describe('questions worth answering: one press fills the message box with core\'s words, nothing sent', () => {
  it('app-launch (no chance yet): each coaching question is a press, in core\'s order, that fills the box with that exact question', () => {
    const view = read('app-launch.view.json'), qs = view.model!.coaching_questions!
    expect(qs.length).toBeGreaterThan(1)
    ready(view)
    render(<ViewReasoningBlock />)
    const rows = screen.getAllByTestId('reasoning-question')
    expect(rows.map((r) => r.textContent)).toEqual(qs)
    fireEvent.click(rows[1]!)
    expect(chat.prefill.mock.calls).toEqual([[qs[1]]])
    expect(chat.method).not.toHaveBeenCalled()
  })
  it('core\'s widening asks fill the box with core\'s draft for them, not their label', () => {
    const view = read('app-launch.view.json'), w = view.model_words as unknown as Record<string, string>
    ready(view)
    render(<ViewReasoningBlock />)
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
  it('each sharpen row whose move core offers in session.methods carries that method\'s words, and pressing runs that method by its id', () => {
    // No captured View offers its sharpen move among its methods yet (core adds pre_mortem to session.methods later), so the move is offered
    // here as core's newer Views offer it: one method entry by the move's id. Its words are this row's data, read back by identity.
    const view = structuredClone(read('app-launch.view.json'))
    const s = view.model!.sharpen.find((x) => x.move !== null)
    expect(s, 'precondition: a sharpen row names a move').toBeDefined()
    view.session!.methods.push({ ...view.session!.methods[0]!, id: s!.move!, text: 'Method words for the move' })
    const methods = view.session!.methods
    ready(view)
    render(<ViewReasoningBlock />)
    const row = document.querySelector<HTMLElement>(`[data-sharpen="${s!.id}"]`)!
    const press = row.querySelector<HTMLElement>('[data-testid="reasoning-method"]')!
    expect(press.textContent).toBe(methods.find((m) => m.id === s!.move)!.text)
    fireEvent.click(press)
    expect(chat.method.mock.calls).toEqual([[s!.move]])
  })
  it('CONTRAST: a sharpen row whose move core does not offer has no press', () => {
    const view = structuredClone(read('app-launch.view.json'))
    for (const x of view.model!.sharpen) x.move = 'not_offered'
    ready(view)
    render(<ViewReasoningBlock />)
    expect(document.querySelectorAll('[data-sharpen]').length).toBeGreaterThan(0)
    expect(screen.queryAllByTestId('reasoning-method')).toHaveLength(0)
  })
})

describe('polish 12: a gap is said once, and a method row with no method of its own carries core\'s ask as its press', () => {
  const asks = (v: View) => v.model_words as unknown as Record<string, string>
  it('the risk ask is the press of the sharpen row about risks, not a second row in Questions; pressing it fills core\'s draft', () => {
    const view = read('app-launch.view.json'), w = asks(view)
    expect(view.model!.sharpen.find((x) => x.id === 'risk_count')!.move).toBe('pre_mortem')
    ready(view)
    render(<ViewReasoningBlock />)
    const all = screen.getAllByTestId('reasoning-widen-askRisk')
    expect(all, 'said once').toHaveLength(1)
    expect(all[0]!.closest('[data-sharpen="risk_count"]'), 'inside its own sharpen row').not.toBeNull()
    expect(screen.getByTestId('reasoning-questions').contains(all[0]!)).toBe(false)
    expect(all[0]!.textContent).toBe(w.askRisk)
    fireEvent.click(all[0]!)
    expect(chat.prefill.mock.calls).toEqual([[w.askRiskDraft]])
  })
  it('the option ask is the press of the widen-options row, so that row is no dead end', () => {
    const view = structuredClone(read('app-launch.view.json')), w = asks(view)
    view.model!.sharpen.push({ id: 'option_breadth', lead: 'You are comparing two options.', emphasis: 'A materially different route widens the comparison.', rationale: 'r', move: 'widen_options' } as never)
    ready(view)
    render(<ViewReasoningBlock />)
    const ask = screen.getAllByTestId('reasoning-widen-askOption')
    expect(ask).toHaveLength(1)
    expect(ask[0]!.closest('[data-sharpen="option_breadth"]')).not.toBeNull()
    expect(ask[0]!.textContent).toBe(w.askOption)
  })
  it('CONTRAST: with no sharpen row about it, the ask stays in Questions; and where core offers the row\'s method, the method press stands alone', () => {
    const view = structuredClone(read('app-launch.view.json'))
    view.model!.sharpen = []
    ready(view)
    const { unmount } = render(<ViewReasoningBlock />)
    expect(screen.getByTestId('reasoning-questions').contains(screen.getByTestId('reasoning-widen-askRisk'))).toBe(true)
    unmount()
    const offered = structuredClone(read('app-launch.view.json'))
    offered.session!.methods.push({ ...offered.session!.methods[0]!, id: 'pre_mortem', text: 'Imagine it failed' })
    ready(offered)
    render(<ViewReasoningBlock />)
    expect(screen.queryAllByTestId('reasoning-widen-askRisk')).toHaveLength(0)
    expect(document.querySelector('[data-sharpen="risk_count"] [data-testid="reasoning-method"]')?.textContent).toBe('Imagine it failed')
  })
})

describe('challenge your thinking', () => {
  it('capacity: each challenged card once, its heading and core\'s reason; a press focuses that card by its id', () => {
    const view = real('capacity'), cs = challengedCards(view.model!)
    expect(cs.length).toBeGreaterThan(0)
    ready(view)
    render(<ViewReasoningBlock />)
    const rows = [...document.querySelectorAll<HTMLElement>('[data-reasoning-challenge]')]
    expect(rows.map((r) => r.dataset['reasoningChallenge'])).toEqual(cs.map((c) => c.id))
    expect(expectAllBound(view, screen.getByTestId('view-reasoning-challenge'), expect)).toBeGreaterThan(0)
    fireEvent.click(rows[0]!.querySelector('button')!)
    expect(focus.node.mock.calls).toEqual([[cs[0]!.id]])
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

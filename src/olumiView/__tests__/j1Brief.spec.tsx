/**
 * J1 step 4 (DL 8 Nov, Codex's order: "a focused panel"): on the real bookshop View (fixtures/j1, core 5d8a009b), a first look's dock is
 * the brief's account, every item in core's words; core's own notes (ED-12) are not served, and the panel says so.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import type { View } from '../client'
import { briefAccountOf, isFirstLook } from '../layout'
import { useViewStore } from '../store'
import { BriefPanel, seenBriefPanels, useBriefPanelLeft, useBriefPanelShown } from '../BriefPanel'

const view: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/j1/bookshop-v1-open.core-5d8a009b.view3.json'), 'utf8'))
afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); useBriefPanelLeft.setState({ left: new Set() }); useViewStore.setState({ view: null, sid: null }) })

describe('the brief’s account, from core’s data', () => {
  it('used: the cards the team stated (and the mixed one); inferred: Olumi’s own; left out: core’s left-out record; no aim, no chances', () => {
    const a = briefAccountOf(view)
    const heading = (id: string) => view.model!.cards.find((c) => c.id === id)!.heading
    expect(a.brief).toBe(view.brief)
    expect(a.used).toEqual(['monthly_revenue', 'rival_sales', 'newsletter', 'price_cut'].map(heading))
    expect(a.inferred).toEqual(['visits', 'spend_per_visit'].map(heading))
    expect(a.leftOut).toEqual([{ id: 'emails_left_out', quote: null, label: view.collab.records.find((r) => r.id === 'emails_left_out')!.label, why: null }])
    expect([a.noAim, a.noChances, a.notes]).toEqual([true, true, null])
    expect(a.question?.text).toBe('Is revenue flat because fewer people come in, or because each visit buys less?')
  })
  it('a first look is version 1, only the brief said, nothing revealed; CONTRAST: a second version is not', () => {
    expect(isFirstLook(view)).toBe(true)
    expect(isFirstLook({ ...view, version: { ...view.version!, n: 2 } })).toBe(false)
    expect(isFirstLook({ ...view, chat: [...view.chat, view.chat[0]!] })).toBe(false)
  })
})

describe('the panel', () => {
  it('quotes the brief whole, says core’s notes are not available yet, and "All tabs" leaves it', () => {
    useViewStore.setState({ view, sid: view.id })
    render(<BriefPanel />)
    expect(screen.getByTestId('brief-panel-brief').textContent).toBe(`“${view.brief}”`)
    expect(screen.getByTestId('brief-panel-left-out').textContent).toContain('The emails are annoying')
    expect(screen.getByTestId('brief-panel-notes-missing')).toBeTruthy()
    fireEvent.click(screen.getByTestId('brief-panel-all-tabs'))
    expect(useBriefPanelLeft.getState().left.has(view.id)).toBe(true)
  })
})

describe('the first look is shown once per scenario for this viewer (DL ruling, 18 Nov)', () => {
  // What a reload does: the store starts from what this browser remembers.
  const reload = () => useBriefPanelLeft.setState({ left: seenBriefPanels() })
  const shownNow = () => { const h = renderHook(() => useBriefPanelShown()); const v = h.result.current; h.unmount(); return v }
  it('first visit: the brief panel is shown and the scenario is remembered; RETURN after a reload: not shown, so the dock is its tabs. CONTRAST: another scenario at its first look is still shown', () => {
    useViewStore.setState({ view, sid: view.id })
    expect(shownNow()).toBe(true)
    render(<BriefPanel />)
    expect([screen.getByTestId('brief-panel') !== null, seenBriefPanels().has(view.id), shownNow()], 'this visit keeps the panel').toEqual([true, true, true])
    cleanup(); reload()
    expect(shownNow(), 'a return lands on the tabs').toBe(false)
    useViewStore.setState({ view: { ...view, id: 's_other000000' }, sid: 's_other000000' })
    expect(shownNow(), 'CONTRAST: a scenario never shown').toBe(true)
  })
  it('CONTRAST: storage that cannot be written is today\'s rule: after a reload the first look is shown again, and nothing throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    useViewStore.setState({ view, sid: view.id })
    render(<BriefPanel />)
    cleanup(); reload()
    expect([seenBriefPanels().has(view.id), shownNow()]).toEqual([false, true])
  })
})

describe('a reply sent from the first look (V11 integration, 9 Nov: core candidate 172e23ae, the reply failed at call cap 0)', () => {
  const failed: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/j1/bookshop-v1-turn-failed.core-172e23ae.view3.json'), 'utf8'))
  it('shows here, where it was sent: their words, core’s reason, and Try again', () => {
    expect([isFirstLook(failed), failed.turn?.status]).toEqual([true, 'failed'])
    useViewStore.setState({ view: failed, sid: failed.id })
    render(<BriefPanel />)
    const turn = screen.getByTestId('brief-panel-turn')
    expect(turn.querySelector('[data-view="turn.said"]')!.textContent).toBe(failed.turn!.said)
    expect(turn.querySelector('[data-view="turn.words"]')!.textContent).toBe(failed.turn!.words)
    expect(turn.querySelector('[data-testid="view-chat-turn-again"]')).not.toBeNull()
  })
  it('CONTRAST: with no turn held, the panel draws none', () => {
    useViewStore.setState({ view, sid: view.id })
    render(<BriefPanel />)
    expect(screen.queryByTestId('brief-panel-turn')).toBeNull()
  })
})

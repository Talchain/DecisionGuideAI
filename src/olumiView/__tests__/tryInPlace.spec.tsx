/**
 * TM-27, try a figure in place (the approved J5 TryRange comp; DL 10 Nov, the demo's key moment: a person changes one number and watches
 * the chance move). Bound on core's REAL what-if answer (fixtures/v11/consulting-whatif-priya.json: base 18, "Time to first signed contract
 * for the paid diagnostic" set to 6 to 12 months) over the View it was asked on (consulting-chain, version 18).
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import type { View } from '../client'
import { useViewStore } from '../store'
import { clearWhatIf, useWhatIf, type WhatIfAnswer } from '../whatif'
import { tryOnCardOf } from '../layout'
import { useTryOn } from '../lens'
import { ViewCard } from '../../canvas/nodes/ViewCardNode'
import { WhatIfShown } from '../ViewChances'
import { TRY_MIN_ZOOM, tryInViewTarget } from '../revealCamera'

const DIR = path.resolve('src/olumiView/fixtures/v11')
const view = JSON.parse(readFileSync(path.join(DIR, 'consulting-chain.view3.json'), 'utf8')) as View
const answer = JSON.parse(readFileSync(path.join(DIR, 'consulting-whatif-priya.json'), 'utf8')) as WhatIfAnswer
const variant = answer.variants[0]!
const Q = 'diagnostic_time_to_contract', TYPED = '6 to 12 months'
const card = (id: string) => view.model!.cards.find((c) => c.id === id)!
const show = (base = 18) => useWhatIf.setState({ shown: { sid: view.id, base, quantity: Q, typed: TYPED, variant } })
afterEach(() => { cleanup(); clearWhatIf(); useViewStore.setState(useViewStore.getInitialState(), true) })

describe('what a try draws on a card', () => {
  it('TR1 precondition: core\'s answer is for this View\'s version and names the card tried', () => {
    expect([answer.scenario, answer.version.id, view.id, view.model!.edit_base]).toEqual([view.id, 18, view.id, 18])
    expect(variant.edits.map((e) => e.quantity)).toEqual([Q])
  })
  it('TR2 catch: each option gets the copy\'s own lead chance in core\'s words, with core\'s words for the edit', () => {
    for (const o of variant.rows) {
      const t = tryOnCardOf(variant, Q, TYPED, card(o.option_id))!
      expect(t.kind).toBe('option')
      expect(t.kind === 'option' && t.row).toBe(o.rows.find((r) => r.kind === 'chance'))
      expect(t.words).toBe(variant.edits[0]!.words)
    }
  })
  it('TR3 catch: the card tried says the figure as the person typed it; no other card is the tried one', () => {
    expect(tryOnCardOf(variant, Q, TYPED, card(Q))).toEqual({ kind: 'tried', typed: TYPED, words: variant.edits[0]!.words, said: null })
    const others = view.model!.cards.filter((c) => c.id !== Q && c.family !== 'option')
    expect(others.length).toBeGreaterThan(0)
    for (const c of others) expect(tryOnCardOf(variant, Q, TYPED, c)).toBeNull()
  })
  it('TR4 must not change: a copy core could not run puts core\'s refusal on the tried card and nothing on the options', () => {
    const blocked = { ...variant, blocked: 'Core cannot run this one.' }
    expect(tryOnCardOf(blocked, Q, TYPED, card(Q))).toMatchObject({ kind: 'tried', said: 'Core cannot run this one.' })
    for (const o of variant.rows) expect(tryOnCardOf(blocked, Q, TYPED, card(o.option_id))).toBeNull()
  })
})

describe('the try is on the board only for the version shown', () => {
  it('TR5 catch: on the version it was asked on, an option card reads the try; on another version, nothing', () => {
    useViewStore.setState({ view, sid: view.id }); act(() => { show() })
    const o = variant.rows[0]!.option_id
    expect(renderHook(() => useTryOn(card(o))).result.current?.kind).toBe('option')
    act(() => { show(17) })
    expect(renderHook(() => useTryOn(card(o))).result.current).toBeNull()
  })
})

describe('the card face', () => {
  it('TR6 catch: the option card shows its saved headline and, under it, the try\'s chance in core\'s words', () => {
    const o = card(variant.rows[0]!.option_id)
    const t = tryOnCardOf(variant, Q, TYPED, o)!
    render(<ViewCard card={o} tryOn={t} version={2} />)
    const line = document.querySelector(`[data-option-try="${o.id}"]`)!
    expect(line).not.toBeNull()
    expect(line.textContent).toContain(t.kind === 'option' ? t.row.value : '')
    expect(line.getAttribute('title')).toContain(variant.edits[0]!.words)
  })
  it('TR7 catch: the tried card says "Trying" and the figure as typed; "Back to version 2" drops the try', () => {
    useViewStore.setState({ view, sid: view.id }); act(() => { show() })
    render(<ViewCard card={card(Q)} tryOn={tryOnCardOf(variant, Q, TYPED, card(Q))} version={2} />)
    expect(document.querySelector(`[data-card-try="${Q}"]`)!.textContent).toContain(`Trying ${TYPED}`)
    act(() => { fireEvent.click(screen.getByTestId(`card-try-back-${Q}`)) })
    expect(screen.getByTestId(`card-try-back-${Q}`).textContent).toBe('Back to version 2')
    expect(useWhatIf.getState().shown).toBeNull()
  })
  it('TR8 must not change: with no try, no card draws a try line or block', () => {
    for (const c of view.model!.cards) { const r = render(<ViewCard card={c} />); expect(r.container.querySelector('[data-option-try], [data-card-try]')).toBeNull(); r.unmount() }
  })
})

describe('the board brings the try into one look (the J5 comp: the try and every option\'s chance seen together)', () => {
  const pane = { w: 900, h: 640 }, inset = { left: 0, top: 56, right: 0, bottom: 0 }
  it('TR9 catch: options and the tried card above the screen (the editor scrolled them away) are brought in, centred, at the person\'s zoom', () => {
    const to = tryInViewTarget({ box: { x: 0, y: 0, w: 700, h: 300 }, pane, inset, viewport: { x: 0, y: -400, zoom: 1 } })!
    expect(to.zoom).toBe(1)
    expect([to.x + 350, to.y + 150]).toEqual([450, 56 + 584 / 2])
  })
  it('TR10 must not change: already all in view, the board does not move; too big, it zooms out only as far as needed, never below the floor', () => {
    expect(tryInViewTarget({ box: { x: 0, y: 0, w: 700, h: 300 }, pane, inset, viewport: { x: 100, y: 100, zoom: 1 } })).toBeNull()
    expect(tryInViewTarget({ box: { x: 0, y: 0, w: 1704, h: 300 }, pane, inset, viewport: { x: 0, y: 0, zoom: 1 } })!.zoom).toBeCloseTo(0.5, 5)
    expect(tryInViewTarget({ box: { x: 0, y: 0, w: 9000, h: 300 }, pane, inset, viewport: { x: 0, y: 0, zoom: 1 } })!.zoom).toBe(TRY_MIN_ZOOM)
  })
})

describe('the dock\'s what-if block (outside grade 10 Nov: its chances sat below the fold at 1232, cut by the dock\'s foot)', () => {
  it('TR11 catch: each option\'s chance comes before core\'s longer sentence; the box is ink, never Olumi\'s blue', () => {
    useViewStore.setState({ view, sid: view.id }); act(() => { show() })
    render(<WhatIfShown model={view.model!} />)
    const box = screen.getByTestId('view-whatif')
    const first = box.querySelector('[data-whatif-card]')!, ml = box.querySelector('[data-view="whatif.most_likely.text"]')!
    expect(first.compareDocumentPosition(ml) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(box.className).not.toMatch(/info/)
    expect(screen.getByTestId('view-whatif-clear').className).not.toMatch(/text-info/)
  })
})

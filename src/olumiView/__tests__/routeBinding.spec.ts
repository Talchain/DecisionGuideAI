/**
 * Codex 006 #1: changing the address from scenario A to scenario B without a reload kept A's View on screen, and a press there was saved
 * in A. Real path: the route hook CanvasMVP mounts (`useAddressIsTheScenario`), re-rendered A → B, the View store, and the one write
 * helper (`team/api.ts` `call`). Bound by scenario id.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useCanvasStore } from '../../canvas/store'
import { call, NOT_THIS_SCENARIO, setPagePerson, setTeamFetch, writeTargetsAddress } from '../../olumiCore/team/api'
import { useAddressIsTheScenario } from '../routeBinding'
import { useViewStore } from '../store'
import type { View } from '../client'
import { chooseGoal, resendOf, useViewChat } from '../ViewChat'

const A = '00000000-0000-4000-8000-0000000000aa', B = '00000000-0000-4000-8000-0000000000bb'
const viewOf = (sid: string) => ({ schema: 'olumi.view/3', id: sid, title: sid }) as unknown as View
let fetched: string[] = []

beforeEach(() => {
  fetched = []
  // Reads never settle here: what is on screen between the address change and B's first answer is what is tested.
  setTeamFetch(((url: string) => { fetched.push(String(url)); return new Promise(() => {}) }) as unknown as typeof fetch)
  useCanvasStore.setState({ currentScenarioId: A } as never)
  useViewStore.setState({ uuid: A, sid: 's_0000000000aa', view: viewOf('s_0000000000aa'), status: 'ready', error: null })
  window.location.hash = `#/scenario/${A}`
})
afterEach(() => { setTeamFetch(null); window.location.hash = '' })

describe('the address is the scenario on the core lane', () => {
  it('A → B with no reload: the canvas store and the View move to B at once, A\'s View is no longer drawn, B is read', () => {
    const { rerender } = renderHook(({ route }) => useAddressIsTheScenario(true, route), { initialProps: { route: A } })
    expect(useViewStore.getState().view, 'A stays while the address is A').not.toBeNull()
    window.location.hash = `#/scenario/${B}`
    rerender({ route: B })
    expect(useCanvasStore.getState().currentScenarioId).toBe(B)
    expect(useViewStore.getState().uuid).toBe(B)
    expect(useViewStore.getState().sid).toBe('s_0000000000bb')
    expect(useViewStore.getState().view, 'nothing of A is drawn while B loads').toBeNull()
    expect(fetched.some((u) => u.startsWith('/api/scenarios/s_0000000000bb/view')), 'B is read').toBe(true)
  })

  it('words typed for A are not carried to B: the composer is emptied and A\'s refusal dropped; a refused move stays (keyed by scenario)', () => {
    useViewChat.setState({ text: 'typed for A', said: 'A refused', held: null, gone: 's_0000000000aa:3:pre_mortem' })
    const { rerender } = renderHook(({ route }) => useAddressIsTheScenario(true, route), { initialProps: { route: A } })
    expect(useViewChat.getState().text, 'CONTRAST: staying on A keeps what was typed').toBe('typed for A')
    window.location.hash = `#/scenario/${B}`
    rerender({ route: B })
    expect(useViewChat.getState()).toMatchObject({ text: '', said: null, gone: 's_0000000000aa:3:pre_mortem' })
  })

  it('a brief typed before any scenario was open is not carried into the scenario then opened (delta review #1)', () => {
    useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none' })
    useCanvasStore.setState({ currentScenarioId: null } as never)
    useViewChat.setState({ text: 'a brief for a new scenario', said: null, held: null })
    renderHook(() => useAddressIsTheScenario(true, B))
    expect(useViewChat.getState().text).toBe('')
  })

  it('a challenge held for A survives a visit to B and its words return on A; B never resends it (delta review #2, #3)', () => {
    const held = { text: 'What would make this wrong?', kind: 'assumption', record: 'card_1', sid: 's_0000000000aa', uuid: A }
    useViewChat.setState({ text: held.text, said: 'The connection dropped', held })
    const { rerender } = renderHook(({ route }) => useAddressIsTheScenario(true, route), { initialProps: { route: A } })
    rerender({ route: B })
    expect(useViewChat.getState()).toMatchObject({ text: '', said: null, held })
    expect(resendOf(held, held.text, B), 'the same words typed on B are a message to B, and A\'s held challenge is kept').toEqual({ again: null, drop: false })
    rerender({ route: A })
    expect(useViewChat.getState().text, 'back on A, its words are in the box').toBe(held.text)
    expect(resendOf(held, held.text, A), 'on A, Send resends that challenge with its op').toEqual({ again: held, drop: false })
    expect(resendOf(held, 'something else', A), 'on A, other words drop it').toEqual({ again: null, drop: true })
  })

  it('a write made on A that fails after the page moved to B says nothing in B\'s composer (delta review #2)', async () => {
    let settle: (r: Response) => void = () => {}
    setPagePerson(null)
    setTeamFetch((async (url: string, init?: RequestInit) => {
      if (String(url) === '/api/me') return new Response(JSON.stringify({ me: { id: 'p1' } }), { status: 200 })
      if (init?.method === 'POST') return new Promise<Response>((r) => { settle = r })
      return new Promise(() => {})
    }) as unknown as typeof fetch)
    useViewChat.setState({ text: '', said: null, held: null, busy: false })
    const { rerender } = renderHook(({ route }) => useAddressIsTheScenario(true, route), { initialProps: { route: A } })
    const pending = chooseGoal('better_option')
    await new Promise((r) => setTimeout(r, 0))
    window.location.hash = `#/scenario/${B}`
    rerender({ route: B })
    settle(new Response(JSON.stringify({ error: 'A refused this' }), { status: 400 }))
    expect(await pending).toBe(false)
    expect(useViewChat.getState().said, 'A\'s refusal is not shown on B').toBeNull()
    // CONTRAST: the same refusal while still on A is said.
    window.location.hash = `#/scenario/${A}`
    rerender({ route: A })
    const again = chooseGoal('better_option')
    await new Promise((r) => setTimeout(r, 0))
    settle(new Response(JSON.stringify({ error: 'A refused this' }), { status: 400 }))
    expect(await again).toBe(false)
    expect(useViewChat.getState().said).toBe('A refused this')
    setPagePerson(null)
  })

  it('off the core lane nothing moves', () => {
    renderHook(() => useAddressIsTheScenario(false, B))
    expect(useCanvasStore.getState().currentScenarioId).toBe(A)
    expect(useViewStore.getState().uuid).toBe(A)
  })

  it('a write for A while the address names B is refused before it leaves; a write for B goes', async () => {
    window.location.hash = `#/scenario/${B}`
    await expect(call('POST', '/api/scenarios/s_0000000000aa/skip', { op: 'x' })).rejects.toThrow(NOT_THIS_SCENARIO)
    expect(fetched, 'nothing was sent, not even the person check').toEqual([])
    void call('POST', '/api/scenarios/s_0000000000bb/skip', { op: 'x' })
    await Promise.resolve()
    expect(fetched, 'the write for the addressed scenario starts (the person check first)').toEqual(['/api/me'])
  })

  it('the rule, by identity: an address naming no core scenario checks nothing; other paths check nothing', () => {
    expect(writeTargetsAddress('/api/scenarios/s_0000000000aa/skip', `#/scenario/${B}`)).toBe(false)
    expect(writeTargetsAddress('/api/scenarios/s_0000000000bb/skip', `#/scenario/${B}`)).toBe(true)
    expect(writeTargetsAddress('/api/scenarios/s_0000000000aa/skip', `#/scenario/${B}/compare`)).toBe(false)
    expect(writeTargetsAddress('/api/scenarios/s_0000000000aa/skip', '#/canvas')).toBe(true)
    expect(writeTargetsAddress('/api/scenarios/s_0000000000aa/skip', '#/scenario/11111111-2222-4333-8444-555555555555')).toBe(true)
    expect(writeTargetsAddress('/api/account/scenarios', `#/scenario/${B}`)).toBe(true)
  })
})

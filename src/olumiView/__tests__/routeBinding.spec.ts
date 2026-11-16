/**
 * Codex 006 #1: changing the address from scenario A to scenario B without a reload kept A's View on screen, and a press there was saved
 * in A. Real path: the route hook CanvasMVP mounts (`useAddressIsTheScenario`), re-rendered A → B, the View store, and the one write
 * helper (`team/api.ts` `call`). Bound by scenario id.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useCanvasStore } from '../../canvas/store'
import { call, NOT_THIS_SCENARIO, setTeamFetch, writeTargetsAddress } from '../../olumiCore/team/api'
import { useAddressIsTheScenario } from '../routeBinding'
import { useViewStore } from '../store'
import type { View } from '../client'
import { useViewChat } from '../ViewChat'

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

  it('words typed for A are not carried to B: the composer is cleared when the address moves between two scenarios', () => {
    useViewChat.setState({ text: 'typed for A', said: 'A refused', held: null, gone: 'pre_mortem' })
    const { rerender } = renderHook(({ route }) => useAddressIsTheScenario(true, route), { initialProps: { route: A } })
    expect(useViewChat.getState().text, 'CONTRAST: staying on A keeps what was typed').toBe('typed for A')
    window.location.hash = `#/scenario/${B}`
    rerender({ route: B })
    expect(useViewChat.getState()).toMatchObject({ text: '', said: null, held: null, gone: null })
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

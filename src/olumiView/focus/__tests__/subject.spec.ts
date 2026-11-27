import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useCanvasStore } from '../../../canvas/store'
import { viewOf } from '../../port/__tests__/viewAt'
import { ringFrom } from '../../reasoning/tabRing'
import { useViewStore } from '../../store'
import { installCanvasFocus } from '../canvas'
import { setFocusSubject, useFocusSubject } from '../subject'

vi.mock('../../reasoning/tabRing', async (original) => ({ ...await original<typeof import('../../reasoning/tabRing')>(), ringFrom: vi.fn() }))

let unsubscribe: (() => void) | undefined

function ready() {
  const view = viewOf('golden/bakery')
  useViewStore.setState({ sid: view.id, view, error: null, stale: false })
  return view
}

afterEach(() => {
  cleanup()
  unsubscribe?.()
  unsubscribe = undefined
  setFocusSubject(null)
  useViewStore.setState({ sid: null, view: null })
  useCanvasStore.getState().clearSelection()
  vi.clearAllMocks()
})

describe('the shared focus subject', () => {
  it('takes a single model card from the canvas and ignores empty, multi-card, and unknown selections', () => {
    const view = ready()
    unsubscribe = installCanvasFocus()
    const { result } = renderHook(useFocusSubject)
    const select = (ids: string[]) => act(() => useCanvasStore.getState().selectNodes(ids))
    expect(result.current).toBeNull()

    select(['oven_price'])
    const card = result.current
    expect(card).toEqual({ kind: 'card', id: 'oven_price', cards: ['oven_price'], source: 'canvas', sid: view.id })
    expect(vi.mocked(ringFrom).mock.calls).toEqual([['focus-subject', []]])
    select(['oven_price'])
    select(['oven_price', 'second_oven'])
    select([])
    select(['outside-the-model'])
    expect(result.current).toBe(card)

    select(['second_oven'])
    expect(result.current).toEqual({ kind: 'option', id: 'second_oven', cards: ['second_oven'], source: 'canvas', sid: view.id })
  })

  it('preserves a panel subject when its navigation selects one of its own cards', () => {
    const view = ready()
    unsubscribe = installCanvasFocus()
    const { result } = renderHook(useFocusSubject)
    const gap = { kind: 'gap', id: 'needs-price', cards: ['oven_price'], source: 'panel' } as const
    act(() => setFocusSubject(gap))
    vi.mocked(ringFrom).mockClear()
    act(() => useCanvasStore.getState().selectNodes(['oven_price']))
    expect(result.current).toEqual({ ...gap, sid: view.id })
    expect(ringFrom).not.toHaveBeenCalled()
    act(() => useCanvasStore.getState().selectNodes(['second_oven']))
    expect(result.current?.source).toBe('canvas')
    expect(vi.mocked(ringFrom).mock.calls).toEqual([['focus-subject', []]])
  })

  it('scopes reads to the active sid and releases the ring on panel set and clear', () => {
    const view = ready()
    const { result } = renderHook(useFocusSubject)
    const gap = { kind: 'gap', id: 'needs-price', cards: ['oven_price'], source: 'panel' } as const
    act(() => setFocusSubject(gap))
    expect(result.current).toEqual({ ...gap, sid: view.id })
    expect(vi.mocked(ringFrom).mock.calls).toEqual([['focus-subject', []], ['focus-subject', ['oven_price']]])

    act(() => useViewStore.setState({ sid: 'another-scenario' }))
    expect(result.current).toBeNull()
    act(() => useViewStore.setState({ sid: null }))
    act(() => setFocusSubject(null))
    expect(ringFrom).toHaveBeenCalledTimes(2)
    act(() => useViewStore.setState({ sid: view.id }))
    act(() => setFocusSubject(null))
    expect(result.current).toBeNull()
    expect(ringFrom).toHaveBeenLastCalledWith('focus-subject', [])
  })

  it('clears the subject and ring on a sid change and when the canvas subscription ends', () => {
    const view = ready()
    const stop = installCanvasFocus()
    unsubscribe = stop
    const { result } = renderHook(useFocusSubject)
    const gap = { kind: 'gap', id: 'needs-price', cards: ['oven_price'], source: 'panel' } as const
    act(() => setFocusSubject(gap))
    act(() => useViewStore.setState({ sid: null }))
    expect(ringFrom).toHaveBeenLastCalledWith('focus-subject', [])
    act(() => useViewStore.setState({ sid: view.id }))
    expect(result.current).toBeNull()
    act(() => setFocusSubject(gap))
    act(stop)
    unsubscribe = undefined
    expect(result.current).toBeNull()
    expect(ringFrom).toHaveBeenLastCalledWith('focus-subject', [])
    act(() => useCanvasStore.getState().selectNodes(['oven_price']))
    expect(result.current).toBeNull()
  })
})

/**
 * WHAT IF (slice 1): the held change is drawn on its card, in the user's words ("What if: 60%"), never as "Olumi
 * proposes", and only while the lens is on; the lens puts that card in front.
 */
import { act, cleanup, render, renderHook, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const rfNodes = [
  { id: 'fac_price', type: 'factor', position: { x: 0, y: 0 }, measured: { width: 240, height: 80 }, data: {} },
  { id: 'opt_a', type: 'option', position: { x: 400, y: 0 }, measured: { width: 240, height: 80 }, data: {} },
]
vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual<typeof import('@xyflow/react')>('@xyflow/react')
  return {
    ...actual,
    ViewportPortal: ({ children }: { children: ReactNode }) => children,
    useNodes: () => rfNodes,
    useStore: (select: (s: { transform: [number, number, number] }) => unknown) => select({ transform: [0, 0, 1] }),
  }
})

import { useCanvasStore } from '../../store'
import { useWhatIfStore } from '../../stores/whatIfStore'
import { useLensFilter } from '../../hooks/useLensFilter'
import { WHAT_IF_MARK_TESTID, WhatIfMarkLayer } from '../WhatIfMarkLayer'

const HELD = { scenarioId: 's1', baseGraphHash: 'h1', nodeId: 'fac_price', label: 'Price rise', saved: 40, whatIf: 60, unit: '%' }

beforeEach(() => {
  act(() => {
    useCanvasStore.setState({ nodes: rfNodes as never, edges: [] } as never)
    useCanvasStore.getState().setLens('what_if')
    useWhatIfStore.getState().clear()
  })
})
afterEach(() => { cleanup(); act(() => { useCanvasStore.getState().setLens('full'); useWhatIfStore.getState().clear() }) })

describe('the held change on its card', () => {
  it('⭐ draws "What if: 60%" beside the held factor\'s card, never "Olumi proposes"', () => {
    act(() => useWhatIfStore.getState().hold(HELD))
    render(<WhatIfMarkLayer />)
    const mark = screen.getByTestId(`${WHAT_IF_MARK_TESTID}-fac_price`)
    expect(mark.textContent).toBe('What if: 60%')
    expect(document.body.textContent).not.toContain('Olumi proposes')
  })

  it('⛔ CONTRAST: nothing held, or another lens, draws nothing', () => {
    render(<WhatIfMarkLayer />)
    expect(screen.queryByTestId(`${WHAT_IF_MARK_TESTID}-fac_price`)).toBeNull()
    cleanup()
    act(() => { useWhatIfStore.getState().hold(HELD); useCanvasStore.getState().setLens('rests_on') })
    render(<WhatIfMarkLayer />)
    expect(screen.queryByTestId(`${WHAT_IF_MARK_TESTID}-fac_price`)).toBeNull()
  })

  it('the lens puts the held card in front: every other card dims; before a change is held nothing dims', () => {
    renderHook(() => useLensFilter())
    expect([...useCanvasStore.getState().lens._dimmedNodeIds]).toEqual([])
    act(() => useWhatIfStore.getState().hold(HELD))
    expect([...useCanvasStore.getState().lens._dimmedNodeIds]).toEqual(['opt_a'])
  })
})

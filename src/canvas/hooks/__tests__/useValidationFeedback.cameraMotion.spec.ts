/**
 * F1 (graph-visuals) — useValidationFeedback's "Fix now" focus is a camera
 * move and must honour prefers-reduced-motion like every other camera call
 * site (cameraMotion.cameraDuration guard). #274 guarded the graph's own
 * fit/zoom/focus sites but missed this hook's two setCenter calls.
 *
 * Pins:
 * - default: setCenter animates with the site's base duration (400ms), zoom 1.5
 * - reduced motion: duration 0 (instant jump), both the node and edge paths
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

const { setCenterMock, getNodeMock, getEdgeMock, prefersReducedMotionMock } = vi.hoisted(() => ({
  setCenterMock: vi.fn(),
  getNodeMock: vi.fn(),
  getEdgeMock: vi.fn(),
  prefersReducedMotionMock: vi.fn(() => false),
}))

vi.mock('@xyflow/react', () => ({
  useReactFlow: () => ({
    setCenter: setCenterMock,
    getNode: getNodeMock,
    getEdge: getEdgeMock,
  }),
}))

vi.mock('../usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: prefersReducedMotionMock,
}))

import { useValidationFeedback } from '../useValidationFeedback'

const nodeError = { code: 'X', message: 'm', node_id: 'n1' } as any
const edgeError = { code: 'X', message: 'm', edge_id: 'e1' } as any

beforeEach(() => {
  setCenterMock.mockReset()
  getNodeMock.mockReset()
  getEdgeMock.mockReset()
  prefersReducedMotionMock.mockReset()
  prefersReducedMotionMock.mockReturnValue(false)
  getNodeMock.mockImplementation((id: string) =>
    id === 'n1' || id === 'src' ? { id, position: { x: 10, y: 20 } } : undefined,
  )
  getEdgeMock.mockImplementation((id: string) =>
    id === 'e1' ? { id, source: 'src', target: 'tgt' } : undefined,
  )
})

describe('useValidationFeedback — F1 reduced-motion on focusError camera moves', () => {
  it('default: node focus animates at the pinned 400ms', () => {
    const { result } = renderHook(() => useValidationFeedback())
    result.current.focusError(nodeError)
    expect(setCenterMock).toHaveBeenCalledTimes(1)
    expect(setCenterMock).toHaveBeenCalledWith(10, 20, { zoom: 1.5, duration: 400 })
  })

  it('reduced motion: node focus jumps instantly (duration 0)', () => {
    prefersReducedMotionMock.mockReturnValue(true)
    const { result } = renderHook(() => useValidationFeedback())
    result.current.focusError(nodeError)
    expect(setCenterMock).toHaveBeenCalledWith(10, 20, { zoom: 1.5, duration: 0 })
  })

  it('reduced motion: the edge (source-node proxy) path also jumps instantly', () => {
    prefersReducedMotionMock.mockReturnValue(true)
    const { result } = renderHook(() => useValidationFeedback())
    result.current.focusError(edgeError)
    expect(setCenterMock).toHaveBeenCalledTimes(1)
    expect(setCenterMock.mock.calls[0][2]).toMatchObject({ duration: 0 })
  })
})

import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTornadoDrag } from '../useTornadoDrag'
import type { TornadoRow } from '../../TornadoChart'

const mockRows: TornadoRow[] = [
  {
    factorKey: 'revenue',
    label: 'Revenue Growth',
    lowOutcome: 80,
    highOutcome: 120,
    canFocus: true,
    matchedNodeId: 'node-revenue',
    direction: 'positive',
  },
  {
    factorKey: 'cost',
    label: 'Operating Cost',
    lowOutcome: 85,
    highOutcome: 115,
    canFocus: true,
    matchedNodeId: 'node-cost',
    direction: 'negative',
  },
]

// Helper to create a mock PointerEvent with required methods
function mockPointerEvent(overrides: Partial<React.PointerEvent> = {}): React.PointerEvent {
  return {
    pointerId: 1,
    clientX: 150,
    clientY: 50,
    currentTarget: {
      setPointerCapture: () => {},
      closest: () => ({
        getBoundingClientRect: () => ({
          left: 100,
          right: 300,
          width: 200,
          top: 0,
          bottom: 100,
          height: 100,
          x: 100,
          y: 0,
          toJSON: () => {},
        }),
      }),
    } as unknown as HTMLElement,
    ...overrides,
  } as unknown as React.PointerEvent
}

describe('useTornadoDrag', () => {
  it('initial state: isDragging false, hasUserDragged false, modifiedFactors empty', () => {
    const { result } = renderHook(() => useTornadoDrag(mockRows, 100))

    expect(result.current.isDragging).toBe(false)
    expect(result.current.hasUserDragged).toBe(false)
    expect(result.current.modifiedFactors.size).toBe(0)
    expect(result.current.activeFactorId).toBeNull()
    expect(result.current.interpolatedOutcome).toBe(100)
  })

  it('handlePointerDown sets isDragging true and activeFactorId', () => {
    const { result } = renderHook(() => useTornadoDrag(mockRows, 100))

    act(() => {
      result.current.handlePointerDown('revenue', 'low', mockPointerEvent())
    })

    expect(result.current.isDragging).toBe(true)
    expect(result.current.activeFactorId).toBe('revenue')
  })

  it('handlePointerMove updates interpolatedOutcome', () => {
    const { result } = renderHook(() => useTornadoDrag(mockRows, 100))

    act(() => {
      result.current.handlePointerDown('revenue', 'low', mockPointerEvent())
    })

    // Move to midpoint of bar container (clientX=200 when left=100, width=200)
    act(() => {
      result.current.handlePointerMove(mockPointerEvent({ clientX: 200 }))
    })

    // At midpoint (0.5), interpolated = 80 + 0.5 * (120 - 80) = 100
    expect(result.current.interpolatedOutcome).toBe(100)
  })

  it('handlePointerUp sets isDragging false, hasUserDragged true, populates modifiedFactors', () => {
    const { result } = renderHook(() => useTornadoDrag(mockRows, 100))

    act(() => {
      result.current.handlePointerDown('revenue', 'low', mockPointerEvent())
    })

    act(() => {
      result.current.handlePointerMove(mockPointerEvent({ clientX: 250 }))
    })

    act(() => {
      result.current.handlePointerUp()
    })

    expect(result.current.isDragging).toBe(false)
    expect(result.current.hasUserDragged).toBe(true)
    expect(result.current.modifiedFactors.has('revenue')).toBe(true)
  })

  it('resetDrag clears all state', () => {
    const { result } = renderHook(() => useTornadoDrag(mockRows, 100))

    // Do a full drag cycle
    act(() => {
      result.current.handlePointerDown('revenue', 'low', mockPointerEvent())
    })
    act(() => {
      result.current.handlePointerMove(mockPointerEvent({ clientX: 250 }))
    })
    act(() => {
      result.current.handlePointerUp()
    })

    expect(result.current.hasUserDragged).toBe(true)
    expect(result.current.modifiedFactors.size).toBe(1)

    // Reset
    act(() => {
      result.current.resetDrag()
    })

    expect(result.current.isDragging).toBe(false)
    expect(result.current.hasUserDragged).toBe(false)
    expect(result.current.modifiedFactors.size).toBe(0)
    expect(result.current.activeFactorId).toBeNull()
    expect(result.current.interpolatedOutcome).toBe(100)
  })

  it('multiple factor drags accumulate in modifiedFactors', () => {
    const { result } = renderHook(() => useTornadoDrag(mockRows, 100))

    // Drag first factor
    act(() => {
      result.current.handlePointerDown('revenue', 'low', mockPointerEvent())
    })
    act(() => {
      result.current.handlePointerMove(mockPointerEvent({ clientX: 250 }))
    })
    act(() => {
      result.current.handlePointerUp()
    })

    // Drag second factor
    act(() => {
      result.current.handlePointerDown('cost', 'high', mockPointerEvent())
    })
    act(() => {
      result.current.handlePointerMove(mockPointerEvent({ clientX: 200 }))
    })
    act(() => {
      result.current.handlePointerUp()
    })

    expect(result.current.modifiedFactors.size).toBe(2)
    expect(result.current.modifiedFactors.has('revenue')).toBe(true)
    expect(result.current.modifiedFactors.has('cost')).toBe(true)
  })

  it('pointerDown on unknown factor does nothing', () => {
    const { result } = renderHook(() => useTornadoDrag(mockRows, 100))

    act(() => {
      result.current.handlePointerDown('nonexistent', 'low', mockPointerEvent())
    })

    expect(result.current.isDragging).toBe(false)
    expect(result.current.activeFactorId).toBeNull()
  })

  it('pointerMove without prior pointerDown does nothing', () => {
    const { result } = renderHook(() => useTornadoDrag(mockRows, 100))

    act(() => {
      result.current.handlePointerMove(mockPointerEvent({ clientX: 250 }))
    })

    expect(result.current.interpolatedOutcome).toBe(100)
  })

  it('pointerUp without prior pointerDown does nothing', () => {
    const { result } = renderHook(() => useTornadoDrag(mockRows, 100))

    act(() => {
      result.current.handlePointerUp()
    })

    expect(result.current.isDragging).toBe(false)
    expect(result.current.hasUserDragged).toBe(false)
  })

  it('clamps position to [0, 1] when pointer moves outside bar', () => {
    const { result } = renderHook(() => useTornadoDrag(mockRows, 100))

    act(() => {
      result.current.handlePointerDown('revenue', 'low', mockPointerEvent())
    })

    // Move far to the right (clientX=400, bar right edge at 300)
    act(() => {
      result.current.handlePointerMove(mockPointerEvent({ clientX: 400 }))
    })

    // Clamped to 1.0 → interpolated = 80 + 1 * 40 = 120
    expect(result.current.interpolatedOutcome).toBe(120)

    // Move far to the left (clientX=0, bar left edge at 100)
    act(() => {
      result.current.handlePointerMove(mockPointerEvent({ clientX: 0 }))
    })

    // Clamped to 0.0 → interpolated = 80 + 0 * 40 = 80
    expect(result.current.interpolatedOutcome).toBe(80)
  })
})

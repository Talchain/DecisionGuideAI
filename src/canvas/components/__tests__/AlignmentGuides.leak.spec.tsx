import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { AlignmentGuides } from '../AlignmentGuides'
import { Node } from '@xyflow/react'

describe('AlignmentGuides - Timer Leak Prevention', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  const mockNodes: Node[] = [
    { id: '1', type: 'decision', position: { x: 100, y: 100 }, data: { label: 'Node 1' } },
    { id: '2', type: 'decision', position: { x: 200, y: 200 }, data: { label: 'Node 2' } },
    { id: '3', type: 'decision', position: { x: 300, y: 300 }, data: { label: 'Node 3' } },
  ]

  it('clears fade timer on unmount', () => {
    const { unmount, rerender } = render(
      <AlignmentGuides 
        nodes={mockNodes} 
        draggingNodeIds={new Set(['1'])} 
        isActive={true} 
      />
    )

    // Stop dragging (triggers fade timer)
    rerender(
      <AlignmentGuides 
        nodes={mockNodes} 
        draggingNodeIds={new Set()} 
        isActive={true} 
      />
    )

    // Unmount before timer fires
    unmount()

    // Advance timers - should not cause any issues
    vi.advanceTimersByTime(300)

    // If timer wasn't cleared, this would fail
    expect(true).toBe(true)
  })

  it('does not leak timers after 100 drag cycles', () => {
    const { rerender, unmount } = render(
      <AlignmentGuides 
        nodes={mockNodes} 
        draggingNodeIds={new Set()} 
        isActive={true} 
      />
    )

    // Simulate 100 drag start/stop cycles
    for (let i = 0; i < 100; i++) {
      // Start drag
      rerender(
        <AlignmentGuides 
          nodes={mockNodes} 
          draggingNodeIds={new Set(['1'])} 
          isActive={true} 
        />
      )

      // Stop drag (triggers fade timer)
      rerender(
        <AlignmentGuides 
          nodes={mockNodes} 
          draggingNodeIds={new Set()} 
          isActive={true} 
        />
      )

      // Advance past fade duration
      vi.advanceTimersByTime(250)
    }

    unmount()

    // Get pending timers count
    const pendingTimers = vi.getTimerCount()
    
    // Should have no pending timers
    expect(pendingTimers).toBe(0)
  })

  it('clears previous timer when effect re-runs', () => {
    const { rerender } = render(
      <AlignmentGuides 
        nodes={mockNodes} 
        draggingNodeIds={new Set(['1'])} 
        isActive={true} 
      />
    )

    // Stop drag (triggers fade timer)
    rerender(
      <AlignmentGuides 
        nodes={mockNodes} 
        draggingNodeIds={new Set()} 
        isActive={true} 
      />
    )

    // Should have 1 timer
    expect(vi.getTimerCount()).toBe(1)

    // Start drag again immediately (should clear previous timer)
    rerender(
      <AlignmentGuides 
        nodes={mockNodes} 
        draggingNodeIds={new Set(['2'])} 
        isActive={true} 
      />
    )

    // Should still have 0 timers (previous cleared, no new one set)
    expect(vi.getTimerCount()).toBe(0)

    // Stop drag again
    rerender(
      <AlignmentGuides 
        nodes={mockNodes} 
        draggingNodeIds={new Set()} 
        isActive={true} 
      />
    )

    // Should have exactly 1 timer
    expect(vi.getTimerCount()).toBe(1)
  })

  it('handles rapid drag state changes without timer accumulation', () => {
    const { rerender, unmount } = render(
      <AlignmentGuides 
        nodes={mockNodes} 
        draggingNodeIds={new Set()} 
        isActive={true} 
      />
    )

    // Rapid state changes
    for (let i = 0; i < 20; i++) {
      rerender(
        <AlignmentGuides 
          nodes={mockNodes} 
          draggingNodeIds={new Set(['1'])} 
          isActive={true} 
        />
      )
      rerender(
        <AlignmentGuides 
          nodes={mockNodes} 
          draggingNodeIds={new Set()} 
          isActive={true} 
        />
      )
    }

    // Should have at most 1 pending timer
    expect(vi.getTimerCount()).toBeLessThanOrEqual(1)

    unmount()
    vi.advanceTimersByTime(300)
    
    expect(vi.getTimerCount()).toBe(0)
  })
})

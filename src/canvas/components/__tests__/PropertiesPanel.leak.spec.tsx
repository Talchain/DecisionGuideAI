import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import { PropertiesPanel } from '../PropertiesPanel'
import * as store from '../../store'

vi.mock('../../store')

describe('PropertiesPanel - Timer Leak Prevention', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  const mockNode1 = {
    id: '1',
    type: 'decision',
    position: { x: 100, y: 100 },
    data: { label: 'Node 1' }
  }

  const mockNode2 = {
    id: '2',
    type: 'decision',
    position: { x: 200, y: 200 },
    data: { label: 'Node 2' }
  }

  it('clears timer when switching nodes rapidly', () => {
    const mockUpdateNode = vi.fn()
    
    // Start with node 1 selected
    vi.mocked(store.useCanvasStore).mockReturnValue({
      nodes: [mockNode1, mockNode2],
      selection: { nodeIds: new Set(['1']), edgeIds: new Set() },
      updateNode: mockUpdateNode
    } as any)

    const { rerender } = render(<PropertiesPanel />)

    // Type in input (starts timer)
    const input = document.querySelector('input[type="text"]') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Updated Label' } })

    // Should have 1 pending timer
    expect(vi.getTimerCount()).toBe(1)

    // Switch to node 2 before timer fires
    vi.mocked(store.useCanvasStore).mockReturnValue({
      nodes: [mockNode1, mockNode2],
      selection: { nodeIds: new Set(['2']), edgeIds: new Set() },
      updateNode: mockUpdateNode
    } as any)

    rerender(<PropertiesPanel />)

    // Timer should be cleared
    expect(vi.getTimerCount()).toBe(0)

    // Advance time - should NOT call updateNode
    vi.advanceTimersByTime(300)
    expect(mockUpdateNode).not.toHaveBeenCalled()
  })

  it('does not cause stale updates after rapid node switching', () => {
    const mockUpdateNode = vi.fn()
    
    // Node 1 selected
    vi.mocked(store.useCanvasStore).mockReturnValue({
      nodes: [mockNode1, mockNode2],
      selection: { nodeIds: new Set(['1']), edgeIds: new Set() },
      updateNode: mockUpdateNode
    } as any)

    const { rerender } = render(<PropertiesPanel />)

    const input = document.querySelector('input[type="text"]') as HTMLInputElement

    // Edit node 1
    fireEvent.change(input, { target: { value: 'Node 1 Updated' } })

    // Switch to node 2 immediately
    vi.mocked(store.useCanvasStore).mockReturnValue({
      nodes: [mockNode1, mockNode2],
      selection: { nodeIds: new Set(['2']), edgeIds: new Set() },
      updateNode: mockUpdateNode
    } as any)
    rerender(<PropertiesPanel />)

    // Edit node 2
    fireEvent.change(input, { target: { value: 'Node 2 Updated' } })

    // Advance time past debounce
    vi.advanceTimersByTime(250)

    // Should only update node 2 (not node 1)
    expect(mockUpdateNode).toHaveBeenCalledTimes(1)
    expect(mockUpdateNode).toHaveBeenCalledWith('2', {
      data: expect.objectContaining({ label: 'Node 2 Updated' })
    })
  })

  it('clears timer on unmount', () => {
    const mockUpdateNode = vi.fn()
    
    vi.mocked(store.useCanvasStore).mockReturnValue({
      nodes: [mockNode1],
      selection: { nodeIds: new Set(['1']), edgeIds: new Set() },
      updateNode: mockUpdateNode
    } as any)

    const { unmount } = render(<PropertiesPanel />)

    const input = document.querySelector('input[type="text"]') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Updated' } })

    expect(vi.getTimerCount()).toBe(1)

    // Unmount before timer fires
    unmount()

    // Timer should be cleared
    expect(vi.getTimerCount()).toBe(0)

    // Advance time - should not crash or call updateNode
    vi.advanceTimersByTime(300)
    expect(mockUpdateNode).not.toHaveBeenCalled()
  })

  it('handles 100 rapid node switches without timer accumulation', () => {
    const mockUpdateNode = vi.fn()
    
    vi.mocked(store.useCanvasStore).mockReturnValue({
      nodes: [mockNode1, mockNode2],
      selection: { nodeIds: new Set(['1']), edgeIds: new Set() },
      updateNode: mockUpdateNode
    } as any)

    const { rerender } = render(<PropertiesPanel />)

    // Rapidly switch between nodes 100 times
    for (let i = 0; i < 100; i++) {
      const nodeId = i % 2 === 0 ? '1' : '2'
      vi.mocked(store.useCanvasStore).mockReturnValue({
        nodes: [mockNode1, mockNode2],
        selection: { nodeIds: new Set([nodeId]), edgeIds: new Set() },
        updateNode: mockUpdateNode
      } as any)
      rerender(<PropertiesPanel />)
    }

    // Should have at most 0 pending timers (all cleared)
    expect(vi.getTimerCount()).toBe(0)
  })
})

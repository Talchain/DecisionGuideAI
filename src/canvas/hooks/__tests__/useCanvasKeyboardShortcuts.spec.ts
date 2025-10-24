/**
 * useCanvasKeyboardShortcuts tests
 * Tests Alt+V cycling and Cmd/Ctrl+Enter run
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useCanvasKeyboardShortcuts } from '../useCanvasKeyboardShortcuts'
import { useCanvasStore } from '../../store'
import { DEFAULT_EDGE_DATA } from '../../domain/edges'

function createEdgeWithConfidence(source: string, target: string, confidence: number) {
  return {
    source,
    target,
    data: { ...DEFAULT_EDGE_DATA, confidence, label: `${Math.round(confidence * 100)}%` }
  }
}

describe('useCanvasKeyboardShortcuts', () => {
  beforeEach(() => {
    useCanvasStore.getState().resetCanvas()
  })

  describe('Alt+V: Cycle through validation errors', () => {
    it('calls onFocusNode with first invalid node when Alt+V pressed', () => {
      const { resetCanvas, addNode, addEdge } = useCanvasStore.getState()
      const onFocusNode = vi.fn()

      resetCanvas()
      addNode({ x: 0, y: 0 })
      addNode({ x: 100, y: 0 })
      addNode({ x: 100, y: 100 })

      addEdge(createEdgeWithConfidence('1', '2', 0.4))
      addEdge(createEdgeWithConfidence('1', '3', 0.5))

      renderHook(() => useCanvasKeyboardShortcuts({ onFocusNode }))

      // Simulate Alt+V
      const event = new KeyboardEvent('keydown', { altKey: true, key: 'v' })
      window.dispatchEvent(event)

      expect(onFocusNode).toHaveBeenCalledWith('1')
    })

    it('cycles to next invalid node when Alt+V pressed with current selection', () => {
      const { resetCanvas, addNode, addEdge, onSelectionChange } = useCanvasStore.getState()
      const onFocusNode = vi.fn()

      resetCanvas()

      // Add two invalid nodes
      addNode({ x: 0, y: 0 })    // Node 1
      addNode({ x: 100, y: 0 })  // Node 2
      addNode({ x: 200, y: 0 })  // Node 3
      addNode({ x: 0, y: 100 })  // Node 4
      addNode({ x: 100, y: 100 }) // Node 5

      // Node 1 -> 2, 3 (invalid)
      addEdge(createEdgeWithConfidence('1', '2', 0.4))
      addEdge(createEdgeWithConfidence('1', '3', 0.5))

      // Node 4 -> 2, 5 (invalid)
      addEdge(createEdgeWithConfidence('4', '2', 0.4))
      addEdge(createEdgeWithConfidence('4', '5', 0.5))

      // Select node 1
      const node1 = useCanvasStore.getState().nodes.find(n => n.id === '1')!
      onSelectionChange({ nodes: [node1], edges: [] })

      renderHook(() => useCanvasKeyboardShortcuts({ onFocusNode }))

      // Press Alt+V -> should cycle to node 4
      const event = new KeyboardEvent('keydown', { altKey: true, key: 'v' })
      window.dispatchEvent(event)

      expect(onFocusNode).toHaveBeenCalledWith('4')
    })

    it('does nothing when Alt+V pressed but no validation errors', () => {
      const onFocusNode = vi.fn()

      renderHook(() => useCanvasKeyboardShortcuts({ onFocusNode }))

      // Press Alt+V
      const event = new KeyboardEvent('keydown', { altKey: true, key: 'v' })
      window.dispatchEvent(event)

      expect(onFocusNode).not.toHaveBeenCalled()
    })

    it('does nothing when Alt+V pressed but no onFocusNode callback', () => {
      const { resetCanvas, addNode, addEdge } = useCanvasStore.getState()

      resetCanvas()
      addNode({ x: 0, y: 0 })
      addNode({ x: 100, y: 0 })
      addNode({ x: 100, y: 100 })

      addEdge(createEdgeWithConfidence('1', '2', 0.4))
      addEdge(createEdgeWithConfidence('1', '3', 0.5))

      // No callback provided
      renderHook(() => useCanvasKeyboardShortcuts({}))

      // Press Alt+V - should not throw
      const event = new KeyboardEvent('keydown', { altKey: true, key: 'v' })
      expect(() => window.dispatchEvent(event)).not.toThrow()
    })

    it('prevents default behavior when Alt+V pressed', () => {
      const onFocusNode = vi.fn()

      renderHook(() => useCanvasKeyboardShortcuts({ onFocusNode }))

      const event = new KeyboardEvent('keydown', { altKey: true, key: 'v' })
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault')

      window.dispatchEvent(event)

      expect(preventDefaultSpy).toHaveBeenCalled()
    })
  })

  describe('Cmd/Ctrl+Enter: Run simulation', () => {
    it('calls onRunSimulation when Cmd+Enter pressed (Mac)', () => {
      const onRunSimulation = vi.fn()

      renderHook(() => useCanvasKeyboardShortcuts({ onRunSimulation }))

      // Simulate Cmd+Enter (Mac)
      const event = new KeyboardEvent('keydown', { metaKey: true, key: 'Enter' })
      window.dispatchEvent(event)

      expect(onRunSimulation).toHaveBeenCalled()
    })

    it('calls onRunSimulation when Ctrl+Enter pressed (Windows/Linux)', () => {
      const onRunSimulation = vi.fn()

      renderHook(() => useCanvasKeyboardShortcuts({ onRunSimulation }))

      // Simulate Ctrl+Enter (Windows/Linux)
      const event = new KeyboardEvent('keydown', { ctrlKey: true, key: 'Enter' })
      window.dispatchEvent(event)

      expect(onRunSimulation).toHaveBeenCalled()
    })

    it('does nothing when Cmd/Ctrl+Enter pressed but no onRunSimulation callback', () => {
      // No callback provided
      renderHook(() => useCanvasKeyboardShortcuts({}))

      // Press Cmd+Enter - should not throw
      const event = new KeyboardEvent('keydown', { metaKey: true, key: 'Enter' })
      expect(() => window.dispatchEvent(event)).not.toThrow()
    })

    it('prevents default behavior when Cmd/Ctrl+Enter pressed', () => {
      const onRunSimulation = vi.fn()

      renderHook(() => useCanvasKeyboardShortcuts({ onRunSimulation }))

      const event = new KeyboardEvent('keydown', { metaKey: true, key: 'Enter' })
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault')

      window.dispatchEvent(event)

      expect(preventDefaultSpy).toHaveBeenCalled()
    })
  })

  describe('Cleanup', () => {
    it('removes event listener when unmounted', () => {
      const onFocusNode = vi.fn()

      const { unmount } = renderHook(() => useCanvasKeyboardShortcuts({ onFocusNode }))

      unmount()

      // Press Alt+V after unmount - should not call callback
      const event = new KeyboardEvent('keydown', { altKey: true, key: 'v' })
      window.dispatchEvent(event)

      expect(onFocusNode).not.toHaveBeenCalled()
    })
  })

  describe('Other keys', () => {
    it('does not interfere with other Alt key combinations', () => {
      const onFocusNode = vi.fn()

      renderHook(() => useCanvasKeyboardShortcuts({ onFocusNode }))

      // Press Alt+A (not Alt+V)
      const event = new KeyboardEvent('keydown', { altKey: true, key: 'a' })
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault')

      window.dispatchEvent(event)

      expect(preventDefaultSpy).not.toHaveBeenCalled()
      expect(onFocusNode).not.toHaveBeenCalled()
    })

    it('does not interfere with other Cmd/Ctrl key combinations', () => {
      const onRunSimulation = vi.fn()

      renderHook(() => useCanvasKeyboardShortcuts({ onRunSimulation }))

      // Press Cmd+S (not Cmd+Enter)
      const event = new KeyboardEvent('keydown', { metaKey: true, key: 's' })
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault')

      window.dispatchEvent(event)

      expect(preventDefaultSpy).not.toHaveBeenCalled()
      expect(onRunSimulation).not.toHaveBeenCalled()
    })
  })
})

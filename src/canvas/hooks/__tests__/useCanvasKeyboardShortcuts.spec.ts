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
      const { resetCanvas, addNode, addEdge, updateNode } = useCanvasStore.getState()
      const onFocusNode = vi.fn()

      resetCanvas()
      addNode({ x: 0, y: 0 })    // Node 1 - decision
      addNode({ x: 100, y: 0 })   // Node 2 - option
      addNode({ x: 100, y: 100 }) // Node 3 - option

      // Set node kinds so validation recognises decision→option edges
      const nodes = useCanvasStore.getState().nodes
      updateNode(nodes[0].id, { data: { ...nodes[0].data, kind: 'decision' } })
      updateNode(nodes[1].id, { data: { ...nodes[1].data, kind: 'option' } })
      updateNode(nodes[2].id, { data: { ...nodes[2].data, kind: 'option' } })

      addEdge(createEdgeWithConfidence(nodes[0].id, nodes[1].id, 0.4))
      addEdge(createEdgeWithConfidence(nodes[0].id, nodes[2].id, 0.5))

      renderHook(() => useCanvasKeyboardShortcuts({ onFocusNode }))

      // Simulate Alt+V
      const event = new KeyboardEvent('keydown', { altKey: true, key: 'v' })
      window.dispatchEvent(event)

      expect(onFocusNode).toHaveBeenCalledWith(nodes[0].id)
    })

    it('cycles to next invalid node when Alt+V pressed with current selection', () => {
      const { resetCanvas, addNode, addEdge, onSelectionChange, updateNode } = useCanvasStore.getState()
      const onFocusNode = vi.fn()

      resetCanvas()

      // Add two invalid decision nodes and their option targets
      addNode({ x: 0, y: 0 })    // Node 0 - decision
      addNode({ x: 100, y: 0 })  // Node 1 - option
      addNode({ x: 200, y: 0 })  // Node 2 - option
      addNode({ x: 0, y: 100 })  // Node 3 - decision
      addNode({ x: 100, y: 100 }) // Node 4 - option

      const nodes = useCanvasStore.getState().nodes

      // Set node kinds so validation recognises decision→option edges
      updateNode(nodes[0].id, { data: { ...nodes[0].data, kind: 'decision' } })
      updateNode(nodes[1].id, { data: { ...nodes[1].data, kind: 'option' } })
      updateNode(nodes[2].id, { data: { ...nodes[2].data, kind: 'option' } })
      updateNode(nodes[3].id, { data: { ...nodes[3].data, kind: 'decision' } })
      updateNode(nodes[4].id, { data: { ...nodes[4].data, kind: 'option' } })

      // Decision node[0] -> node[1], node[2] (invalid: 0.4+0.5=0.9 ≠ 1.0)
      addEdge(createEdgeWithConfidence(nodes[0].id, nodes[1].id, 0.4))
      addEdge(createEdgeWithConfidence(nodes[0].id, nodes[2].id, 0.5))

      // Decision node[3] -> node[1], node[4] (invalid: 0.4+0.5=0.9 ≠ 1.0)
      addEdge(createEdgeWithConfidence(nodes[3].id, nodes[1].id, 0.4))
      addEdge(createEdgeWithConfidence(nodes[3].id, nodes[4].id, 0.5))

      // Select first decision node
      const updatedNodes = useCanvasStore.getState().nodes
      const firstDecision = updatedNodes.find(n => n.id === nodes[0].id)!
      onSelectionChange({ nodes: [firstDecision], edges: [] })

      renderHook(() => useCanvasKeyboardShortcuts({ onFocusNode }))

      // Press Alt+V -> should cycle to the other invalid decision node
      const event = new KeyboardEvent('keydown', { altKey: true, key: 'v' })
      window.dispatchEvent(event)

      expect(onFocusNode).toHaveBeenCalledWith(nodes[3].id)
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

  describe('T: Open Templates Panel', () => {
    it('calls openTemplatesPanel when T pressed', () => {
      // Mock store to have panel closed initially
      useCanvasStore.setState({ showTemplatesPanel: false })

      renderHook(() => useCanvasKeyboardShortcuts({}))

      // Simulate T key press
      const event = new KeyboardEvent('keydown', { key: 't' })
      window.dispatchEvent(event)

      // Check that panel is now open
      const state = useCanvasStore.getState()
      expect(state.showTemplatesPanel).toBe(true)
    })

    it('is idempotent - does not call openTemplatesPanel if already open', () => {
      // Set panel as already open
      useCanvasStore.setState({ showTemplatesPanel: true })
      const openTemplatesPanelSpy = vi.spyOn(useCanvasStore.getState(), 'openTemplatesPanel')

      renderHook(() => useCanvasKeyboardShortcuts({}))

      // Simulate T key press
      const event = new KeyboardEvent('keydown', { key: 't' })
      window.dispatchEvent(event)

      // Should not call openTemplatesPanel since already open
      expect(openTemplatesPanelSpy).not.toHaveBeenCalled()

      openTemplatesPanelSpy.mockRestore()
    })

    it('passes document.activeElement as invoker', () => {
      useCanvasStore.setState({ showTemplatesPanel: false })
      const openTemplatesPanelSpy = vi.spyOn(useCanvasStore.getState(), 'openTemplatesPanel')

      // Create and focus a button
      const button = document.createElement('button')
      document.body.appendChild(button)
      button.focus()

      renderHook(() => useCanvasKeyboardShortcuts({}))

      // Simulate T key press
      const event = new KeyboardEvent('keydown', { key: 't' })
      window.dispatchEvent(event)

      // Should call with activeElement
      expect(openTemplatesPanelSpy).toHaveBeenCalledWith(button)

      // Cleanup
      document.body.removeChild(button)
      openTemplatesPanelSpy.mockRestore()
    })

    it('does not trigger when Cmd+T pressed', () => {
      useCanvasStore.setState({ showTemplatesPanel: false })
      const openTemplatesPanelSpy = vi.spyOn(useCanvasStore.getState(), 'openTemplatesPanel')

      renderHook(() => useCanvasKeyboardShortcuts({}))

      // Simulate Cmd+T (browser tab shortcut)
      const event = new KeyboardEvent('keydown', { metaKey: true, key: 't' })
      window.dispatchEvent(event)

      // Should NOT call openTemplatesPanel (Cmd+T is for browser tabs)
      expect(openTemplatesPanelSpy).not.toHaveBeenCalled()
      expect(useCanvasStore.getState().showTemplatesPanel).toBe(false)

      openTemplatesPanelSpy.mockRestore()
    })

    it('does not trigger when Ctrl+T pressed', () => {
      useCanvasStore.setState({ showTemplatesPanel: false })
      const openTemplatesPanelSpy = vi.spyOn(useCanvasStore.getState(), 'openTemplatesPanel')

      renderHook(() => useCanvasKeyboardShortcuts({}))

      // Simulate Ctrl+T (browser tab shortcut)
      const event = new KeyboardEvent('keydown', { ctrlKey: true, key: 't' })
      window.dispatchEvent(event)

      // Should NOT call openTemplatesPanel
      expect(openTemplatesPanelSpy).not.toHaveBeenCalled()
      expect(useCanvasStore.getState().showTemplatesPanel).toBe(false)

      openTemplatesPanelSpy.mockRestore()
    })

    it('does not trigger when Alt+T pressed', () => {
      useCanvasStore.setState({ showTemplatesPanel: false })
      const openTemplatesPanelSpy = vi.spyOn(useCanvasStore.getState(), 'openTemplatesPanel')

      renderHook(() => useCanvasKeyboardShortcuts({}))

      // Simulate Alt+T
      const event = new KeyboardEvent('keydown', { altKey: true, key: 't' })
      window.dispatchEvent(event)

      // Should NOT call openTemplatesPanel
      expect(openTemplatesPanelSpy).not.toHaveBeenCalled()
      expect(useCanvasStore.getState().showTemplatesPanel).toBe(false)

      openTemplatesPanelSpy.mockRestore()
    })

    it('does not trigger when Shift+T pressed', () => {
      useCanvasStore.setState({ showTemplatesPanel: false })
      const openTemplatesPanelSpy = vi.spyOn(useCanvasStore.getState(), 'openTemplatesPanel')

      renderHook(() => useCanvasKeyboardShortcuts({}))

      // Simulate Shift+T
      const event = new KeyboardEvent('keydown', { shiftKey: true, key: 't' })
      window.dispatchEvent(event)

      // Should NOT call openTemplatesPanel
      expect(openTemplatesPanelSpy).not.toHaveBeenCalled()
      expect(useCanvasStore.getState().showTemplatesPanel).toBe(false)

      openTemplatesPanelSpy.mockRestore()
    })

    it('prevents default behavior when T pressed', () => {
      useCanvasStore.setState({ showTemplatesPanel: false })

      renderHook(() => useCanvasKeyboardShortcuts({}))

      const event = new KeyboardEvent('keydown', { key: 't' })
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

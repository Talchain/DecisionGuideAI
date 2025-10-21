/**
 * Layout integration test
 * Ensures applySimpleLayout uses ESM imports and works correctly
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useCanvasStore } from '../store'
import * as layoutModule from '../layout'

describe('Layout Integration', () => {
  beforeEach(() => {
    useCanvasStore.getState().reset()
  })

  it('applySimpleLayout calls applyLayout with correct parameters', () => {
    const applyLayoutSpy = vi.spyOn(layoutModule, 'applyLayout')
    
    const { addNode, applySimpleLayout } = useCanvasStore.getState()
    
    // Add some nodes
    addNode({ x: 0, y: 0 }, 'goal')
    addNode({ x: 100, y: 100 }, 'decision')
    addNode({ x: 200, y: 200 }, 'option')
    
    // Apply layout
    applySimpleLayout('grid', 'medium')
    
    // Should have called applyLayout
    expect(applyLayoutSpy).toHaveBeenCalledOnce()
    
    const call = applyLayoutSpy.mock.calls[0]
    const [nodes, edges, options] = call
    
    // Verify parameters
    expect(nodes).toHaveLength(7) // 4 initial + 3 added
    expect(edges).toBeDefined()
    expect(options.preset).toBe('grid')
    expect(options.spacing).toBe('medium')
    
    applyLayoutSpy.mockRestore()
  })

  it('applySimpleLayout updates node positions', () => {
    const { addNode, applySimpleLayout } = useCanvasStore.getState()
    
    // Add nodes
    addNode({ x: 0, y: 0 }, 'goal')
    addNode({ x: 0, y: 0 }, 'decision')
    
    const beforePositions = useCanvasStore.getState().nodes.map(n => ({ id: n.id, pos: n.position }))
    
    // Apply layout
    applySimpleLayout('grid', 'medium')
    
    const afterPositions = useCanvasStore.getState().nodes.map(n => ({ id: n.id, pos: n.position }))
    
    // At least some positions should have changed
    const changed = afterPositions.some((after, i) => {
      const before = beforePositions[i]
      return after.pos.x !== before.pos.x || after.pos.y !== before.pos.y
    })
    
    expect(changed).toBe(true)
  })

  it('applySimpleLayout is undoable', () => {
    const { addNode, applySimpleLayout, undo } = useCanvasStore.getState()
    
    addNode({ x: 0, y: 0 }, 'goal')
    addNode({ x: 100, y: 100 }, 'decision')
    
    const beforeCount = useCanvasStore.getState().nodes.length
    const beforePositions = useCanvasStore.getState().nodes.map(n => n.position)
    
    // Apply layout
    applySimpleLayout('grid', 'medium')
    
    const afterPositions = useCanvasStore.getState().nodes.map(n => n.position)
    
    // Undo
    undo()
    
    const undonePositions = useCanvasStore.getState().nodes.map(n => n.position)
    
    // Should restore original positions
    expect(useCanvasStore.getState().nodes.length).toBe(beforeCount)
    expect(undonePositions).toEqual(beforePositions)
    expect(undonePositions).not.toEqual(afterPositions)
  })

  it('does nothing when graph has < 2 nodes', () => {
    const applyLayoutSpy = vi.spyOn(layoutModule, 'applyLayout')
    
    useCanvasStore.getState().reset()
    
    // Remove all but one node
    const { nodes } = useCanvasStore.getState()
    useCanvasStore.setState({ nodes: [nodes[0]] })
    
    // Try to apply layout
    useCanvasStore.getState().applySimpleLayout('grid', 'medium')
    
    // Should not call applyLayout
    expect(applyLayoutSpy).not.toHaveBeenCalled()
    
    applyLayoutSpy.mockRestore()
  })
})

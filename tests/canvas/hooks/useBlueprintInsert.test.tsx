import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { useBlueprintInsert } from '../../../src/canvas/hooks/useBlueprintInsert'
import { useCanvasStore } from '../../../src/canvas/store'
import type { Blueprint } from '../../../src/templates/blueprints/types'

// Mock React Flow
vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return {
    ...actual,
    useReactFlow: () => ({
      getViewport: () => ({ x: 0, y: 0, zoom: 1 })
    })
  }
})

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ReactFlowProvider>{children}</ReactFlowProvider>
)

describe('useBlueprintInsert', () => {
  const mockBlueprint: Blueprint = {
    id: 'test-blueprint',
    name: 'Test Blueprint',
    description: 'A test blueprint',
    nodes: [
      { id: 'n1', kind: 'goal', label: 'Goal Node', position: { x: 0, y: 0 } },
      { id: 'n2', kind: 'option', label: 'Option A', position: { x: 100, y: 100 } },
      { id: 'n3', kind: 'risk', label: 'Risk 1', position: { x: 200, y: 100 } },
      { id: 'n4', kind: 'outcome', label: 'Outcome', position: { x: 300, y: 0 } }
    ],
    edges: [
      { from: 'n1', to: 'n2', probability: 0.6, weight: 1.0 },
      { from: 'n1', to: 'n3', probability: 0.4, weight: 1.0 },
      { from: 'n2', to: 'n4', probability: 1.0, weight: 1.0 }
    ]
  }

  beforeEach(() => {
    useCanvasStore.setState({ nodes: [], edges: [] })
  })

  it('inserts blueprint with correct node types', () => {
    const { result } = renderHook(() => useBlueprintInsert(), { wrapper })
    
    act(() => {
      result.current.insertBlueprint(mockBlueprint)
    })
    
    const nodes = useCanvasStore.getState().nodes
    expect(nodes).toHaveLength(4)
    expect(nodes.map(n => n.type)).toEqual(['goal', 'option', 'risk', 'outcome'])
  })

  it('stamps nodes with template metadata', () => {
    const { result } = renderHook(() => useBlueprintInsert(), { wrapper })
    
    act(() => {
      result.current.insertBlueprint(mockBlueprint)
    })
    
    const nodes = useCanvasStore.getState().nodes
    nodes.forEach(node => {
      expect(node.data.templateId).toBe('test-blueprint')
      expect(node.data.templateName).toBe('Test Blueprint')
      expect(node.data.templateCreatedAt).toBeDefined()
    })
  })

  it('creates edges with probability labels', () => {
    const { result } = renderHook(() => useBlueprintInsert(), { wrapper })
    
    act(() => {
      result.current.insertBlueprint(mockBlueprint)
    })
    
    const edges = useCanvasStore.getState().edges
    expect(edges).toHaveLength(3)
    
    // Check labels
    expect(edges[0].data?.label).toBe('60%')
    expect(edges[1].data?.label).toBe('40%')
    expect(edges[2].data?.label).toBe('100%')
  })

  it('preserves node labels', () => {
    const { result } = renderHook(() => useBlueprintInsert(), { wrapper })
    
    act(() => {
      result.current.insertBlueprint(mockBlueprint)
    })
    
    const nodes = useCanvasStore.getState().nodes
    const labels = nodes.map(n => n.data.label)
    
    expect(labels).toContain('Goal Node')
    expect(labels).toContain('Option A')
    expect(labels).toContain('Risk 1')
    expect(labels).toContain('Outcome')
  })

  it('edges have styled type for rendering', () => {
    const { result } = renderHook(() => useBlueprintInsert(), { wrapper })
    
    act(() => {
      result.current.insertBlueprint(mockBlueprint)
    })
    
    const edges = useCanvasStore.getState().edges
    edges.forEach(edge => {
      expect(edge.type).toBe('styled')
    })
  })

  it('edges have templateId in data', () => {
    const { result } = renderHook(() => useBlueprintInsert(), { wrapper })
    
    act(() => {
      result.current.insertBlueprint(mockBlueprint)
    })
    
    const edges = useCanvasStore.getState().edges
    edges.forEach(edge => {
      expect(edge.data?.templateId).toBe('test-blueprint')
    })
  })
})

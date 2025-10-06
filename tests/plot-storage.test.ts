// tests/plot-storage.test.ts
// Tests for workspace storage

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { saveWorkspaceState, loadWorkspaceState, clearWorkspaceState } from '../src/lib/plotStorage'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    }
  }
})()

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock
})

describe('Plot Storage', () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  it('saves workspace state to localStorage', () => {
    const state = {
      camera: { x: 100, y: 50, zoom: 1.5 },
      nodes: [
        { id: 'node1', label: 'Test Node', x: 200, y: 100, type: 'decision' }
      ],
      edges: [
        { from: 'node1', to: 'node2', label: 'test' }
      ]
    }

    saveWorkspaceState(state)

    const saved = localStorage.getItem('plot_workspace_state')
    expect(saved).toBeTruthy()
    
    const parsed = JSON.parse(saved!)
    expect(parsed.camera).toEqual(state.camera)
    expect(parsed.nodes).toEqual(state.nodes)
    expect(parsed.edges).toEqual(state.edges)
    expect(parsed.lastSaved).toBeDefined()
  })

  it('loads workspace state from localStorage', () => {
    const state = {
      camera: { x: 100, y: 50, zoom: 1.5 },
      nodes: [
        { id: 'node1', label: 'Test Node', x: 200, y: 100, type: 'decision' }
      ],
      edges: [],
      lastSaved: Date.now()
    }

    localStorage.setItem('plot_workspace_state', JSON.stringify(state))

    const loaded = loadWorkspaceState()
    expect(loaded).toBeTruthy()
    expect(loaded!.camera).toEqual(state.camera)
    expect(loaded!.nodes).toEqual(state.nodes)
    expect(loaded!.lastSaved).toBe(state.lastSaved)
  })

  it('returns null when no saved state exists', () => {
    const loaded = loadWorkspaceState()
    expect(loaded).toBeNull()
  })

  it('clears workspace state', () => {
    const state = {
      camera: { x: 0, y: 0, zoom: 1 },
      nodes: [],
      edges: []
    }

    saveWorkspaceState(state)
    expect(localStorage.getItem('plot_workspace_state')).toBeTruthy()

    clearWorkspaceState()
    expect(localStorage.getItem('plot_workspace_state')).toBeNull()
  })

  it('handles corrupted localStorage data gracefully', () => {
    localStorage.setItem('plot_workspace_state', 'corrupted{json')
    
    const loaded = loadWorkspaceState()
    expect(loaded).toBeNull()
  })

  it('preserves complex node data', () => {
    const state = {
      camera: { x: 0, y: 0, zoom: 1 },
      nodes: [
        { id: 'n1', label: 'Goal Node', x: 100, y: 100, type: 'goal' },
        { id: 'n2', label: 'Decision Node', x: 200, y: 200, type: 'decision' },
        { id: 'n3', label: 'Risk Node', x: 300, y: 300, type: 'risk' }
      ],
      edges: [
        { from: 'n1', to: 'n2', label: 'leads to', weight: 1.0 },
        { from: 'n2', to: 'n3' }
      ]
    }

    saveWorkspaceState(state)
    const loaded = loadWorkspaceState()

    expect(loaded!.nodes).toHaveLength(3)
    expect(loaded!.edges).toHaveLength(2)
    expect(loaded!.nodes[0].type).toBe('goal')
    expect(loaded!.edges[0].weight).toBe(1.0)
  })
})

describe('Workspace Restoration Logic', () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  it('should restore workspace when saved state exists', () => {
    const savedState = {
      camera: { x: 100, y: 50, zoom: 1.5 },
      nodes: [
        { id: 'restored1', label: 'Restored Node', x: 200, y: 100 }
      ],
      edges: [],
      lastSaved: Date.now()
    }

    saveWorkspaceState(savedState)
    const loaded = loadWorkspaceState()

    expect(loaded).toBeTruthy()
    expect(loaded!.nodes).toHaveLength(1)
    expect(loaded!.nodes[0].id).toBe('restored1')
    expect(loaded!.camera.x).toBe(100)
  })

  it('should indicate fresh fetch needed when no saved state', () => {
    const loaded = loadWorkspaceState()
    expect(loaded).toBeNull()
  })

  it('should indicate fresh fetch needed when saved state has no nodes', () => {
    const savedState = {
      camera: { x: 0, y: 0, zoom: 1 },
      nodes: [],
      edges: [],
      lastSaved: Date.now()
    }

    saveWorkspaceState(savedState)
    const loaded = loadWorkspaceState()

    // Loaded state exists but has no nodes
    expect(loaded).toBeTruthy()
    expect(loaded!.nodes).toHaveLength(0)
  })

  it('protects restored nodes from being overwritten', () => {
    // Simulate: save workspace, reload page, check if nodes are preserved
    const originalState = {
      camera: { x: 50, y: 30, zoom: 1.2 },
      nodes: [
        { id: 'custom1', label: 'My Custom Node', x: 150, y: 200 },
        { id: 'custom2', label: 'Another Node', x: 300, y: 250 }
      ],
      edges: [
        { from: 'custom1', to: 'custom2' }
      ],
      lastSaved: Date.now() - 5000 // 5 seconds ago
    }

    saveWorkspaceState(originalState)

    // Simulate page reload - load state
    const loaded = loadWorkspaceState()

    // Decision logic: should we fetch fresh scenario?
    const shouldFetchFresh = !loaded || !loaded.nodes || loaded.nodes.length === 0

    expect(shouldFetchFresh).toBe(false) // Should NOT fetch fresh
    expect(loaded!.nodes).toHaveLength(2) // Our custom nodes preserved
    expect(loaded!.nodes[0].label).toBe('My Custom Node')
  })
})

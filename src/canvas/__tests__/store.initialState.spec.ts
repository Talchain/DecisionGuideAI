import { describe, it, expect, beforeEach } from 'vitest'
import { useCanvasStore } from '../store'

// Bug 5 regression: documentSortField/Direction were silently uninitialised
// because `...loadSortPreferences()` spread { sortField, sortDirection }
// (wrong key names) into the canvas store. The documents list ignored the
// user's saved sort preference until the user re-opened sort controls.
//
// Bug 6 regression: the inline `lens: {...}` init covered only 7 of the
// 12 LensState fields, leaving the Brief-5 expanded-lenses Map/Set fields
// undefined at canvas-store creation. The canonical factory returns all 12.

describe('canvas store initial state — Bug 5 + Bug 6 regressions', () => {
  beforeEach(() => {
    useCanvasStore.getState().reset()
  })

  it('initialises documentSortField and documentSortDirection from loadSortPreferences', () => {
    const state = useCanvasStore.getState()
    expect(state.documentSortField).toBeDefined()
    expect(['name', 'date', 'size', 'type']).toContain(state.documentSortField)
    expect(state.documentSortDirection).toBeDefined()
    expect(['asc', 'desc']).toContain(state.documentSortDirection)
  })

  it('initialises lens with every LensState field populated', () => {
    const state = useCanvasStore.getState()
    expect(state.lens.active).toBe('full')
    expect(state.lens.selectedOptionId).toBeNull()
    // "Rests on" marks (18 Oct 2026) — a reader that finds none must get an empty map, never undefined
    expect(state.lens._restsOn).toBeInstanceOf(Map)
    expect(state.lens._dimmedNodeIds).toBeInstanceOf(Set)
    expect(state.lens._dimmedEdgeIds).toBeInstanceOf(Set)
    expect(state.lens._sensitivityWeights).toBeInstanceOf(Map)
    expect(state.lens._fragileEdgeIds).toBeInstanceOf(Set)
  })
})

/**
 * UI Store — E1 cross-tab navigation tests
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useUIStore } from '../uiStore'

describe('uiStore', () => {
  beforeEach(() => {
    // Reset store to default state
    useUIStore.setState({ activeOutputTab: 'results', hoveredElementId: null })
  })

  it('default tab is results', () => {
    expect(useUIStore.getState().activeOutputTab).toBe('results')
  })

  it('setActiveOutputTab updates state', () => {
    useUIStore.getState().setActiveOutputTab('diagnostics')
    expect(useUIStore.getState().activeOutputTab).toBe('diagnostics')
  })

  it('setActiveOutputTab works for all tab types', () => {
    for (const tab of ['results', 'compare', 'diagnostics', 'journey'] as const) {
      useUIStore.getState().setActiveOutputTab(tab)
      expect(useUIStore.getState().activeOutputTab).toBe(tab)
    }
  })

  it('setHoveredElementId sets and clears', () => {
    expect(useUIStore.getState().hoveredElementId).toBeNull()

    useUIStore.getState().setHoveredElementId('node-123')
    expect(useUIStore.getState().hoveredElementId).toBe('node-123')

    useUIStore.getState().setHoveredElementId(null)
    expect(useUIStore.getState().hoveredElementId).toBeNull()
  })
})

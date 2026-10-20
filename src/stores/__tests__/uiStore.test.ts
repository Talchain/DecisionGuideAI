/**
 * UI Store — E1 cross-tab navigation tests + Task C panel coordination
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useUIStore } from '../uiStore'

describe('uiStore', () => {
  beforeEach(() => {
    // Reset store to default state
    useUIStore.setState({
      activeOutputTab: 'results',
      activeRightPanel: null,
    })
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
})

describe('uiStore — Task C: right-panel coordination', () => {
  beforeEach(() => {
    useUIStore.setState({ activeRightPanel: null })
  })

  it('default activeRightPanel is null', () => {
    expect(useUIStore.getState().activeRightPanel).toBeNull()
  })

  it('openRightPanel sets the active panel', () => {
    useUIStore.getState().openRightPanel('provenance')
    expect(useUIStore.getState().activeRightPanel).toBe('provenance')
  })

  it('openRightPanel replaces previous panel (mutual exclusion)', () => {
    useUIStore.getState().openRightPanel('provenance')
    expect(useUIStore.getState().activeRightPanel).toBe('provenance')

    useUIStore.getState().openRightPanel('clarifier')
    expect(useUIStore.getState().activeRightPanel).toBe('clarifier')
  })

  it('closeRightPanel resets to null', () => {
    useUIStore.getState().openRightPanel('results')
    useUIStore.getState().closeRightPanel()
    expect(useUIStore.getState().activeRightPanel).toBeNull()
  })

  it('openRightPanel(null) closes all panels', () => {
    useUIStore.getState().openRightPanel('clarifier')
    useUIStore.getState().openRightPanel(null)
    expect(useUIStore.getState().activeRightPanel).toBeNull()
  })
})

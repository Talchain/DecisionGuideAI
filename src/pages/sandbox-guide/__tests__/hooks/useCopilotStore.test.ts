import { describe, it, expect, beforeEach } from 'vitest'
import { useCopilotStore } from '../../hooks/useCopilotStore'

describe('useCopilotStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    const store = useCopilotStore.getState()
    store.setJourneyStage('empty')
    store.selectElement(null)
    store.setCompareMode(false)
    useCopilotStore.setState({ panelExpanded: true })
  })

  it('initializes with empty stage', () => {
    const { journeyStage } = useCopilotStore.getState()
    expect(journeyStage).toBe('empty')
  })

  it('initializes with panel expanded', () => {
    const { panelExpanded } = useCopilotStore.getState()
    expect(panelExpanded).toBe(true)
  })

  it('initializes with no selected element', () => {
    const { selectedElement } = useCopilotStore.getState()
    expect(selectedElement).toBeNull()
  })

  it('initializes with compare mode off', () => {
    const { compareMode } = useCopilotStore.getState()
    expect(compareMode).toBe(false)
  })

  it('updates journey stage', () => {
    const { setJourneyStage } = useCopilotStore.getState()

    setJourneyStage('building')
    expect(useCopilotStore.getState().journeyStage).toBe('building')

    setJourneyStage('post-run')
    expect(useCopilotStore.getState().journeyStage).toBe('post-run')
  })

  it('toggles panel expansion', () => {
    const { togglePanel } = useCopilotStore.getState()

    togglePanel()
    expect(useCopilotStore.getState().panelExpanded).toBe(false)

    togglePanel()
    expect(useCopilotStore.getState().panelExpanded).toBe(true)
  })

  it('selects and deselects elements', () => {
    const { selectElement } = useCopilotStore.getState()

    selectElement('node-1')
    expect(useCopilotStore.getState().selectedElement).toBe('node-1')

    selectElement('edge-2')
    expect(useCopilotStore.getState().selectedElement).toBe('edge-2')

    selectElement(null)
    expect(useCopilotStore.getState().selectedElement).toBeNull()
  })

  it('enables and disables compare mode', () => {
    const { setCompareMode } = useCopilotStore.getState()

    setCompareMode(true)
    expect(useCopilotStore.getState().compareMode).toBe(true)

    setCompareMode(false)
    expect(useCopilotStore.getState().compareMode).toBe(false)
  })

  it('allows multiple state updates', () => {
    const { setJourneyStage, selectElement, setCompareMode, togglePanel } = useCopilotStore.getState()

    setJourneyStage('building')
    selectElement('node-1')
    setCompareMode(true)
    togglePanel()

    const state = useCopilotStore.getState()
    expect(state.journeyStage).toBe('building')
    expect(state.selectedElement).toBe('node-1')
    expect(state.compareMode).toBe(true)
    expect(state.panelExpanded).toBe(false)
  })
})

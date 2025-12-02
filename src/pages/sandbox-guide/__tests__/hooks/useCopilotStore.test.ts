import { describe, it, expect, beforeEach } from 'vitest'
import { useGuideStore } from '../../hooks/useGuideStore'

describe('useGuideStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    const store = useGuideStore.getState()
    store.setJourneyStage('empty')
    store.selectElement(null)
    store.setCompareMode(false)
    useGuideStore.setState({ panelExpanded: true })
  })

  it('initializes with empty stage', () => {
    const { journeyStage } = useGuideStore.getState()
    expect(journeyStage).toBe('empty')
  })

  it('initializes with panel expanded', () => {
    const { panelExpanded } = useGuideStore.getState()
    expect(panelExpanded).toBe(true)
  })

  it('initializes with no selected element', () => {
    const { selectedElement } = useGuideStore.getState()
    expect(selectedElement).toBeNull()
  })

  it('initializes with compare mode off', () => {
    const { compareMode } = useGuideStore.getState()
    expect(compareMode).toBe(false)
  })

  it('updates journey stage', () => {
    const { setJourneyStage } = useGuideStore.getState()

    setJourneyStage('building')
    expect(useGuideStore.getState().journeyStage).toBe('building')

    setJourneyStage('post-run')
    expect(useGuideStore.getState().journeyStage).toBe('post-run')
  })

  it('toggles panel expansion', () => {
    const { togglePanel } = useGuideStore.getState()

    togglePanel()
    expect(useGuideStore.getState().panelExpanded).toBe(false)

    togglePanel()
    expect(useGuideStore.getState().panelExpanded).toBe(true)
  })

  it('selects and deselects elements', () => {
    const { selectElement } = useGuideStore.getState()

    selectElement('node-1')
    expect(useGuideStore.getState().selectedElement).toBe('node-1')

    selectElement('edge-2')
    expect(useGuideStore.getState().selectedElement).toBe('edge-2')

    selectElement(null)
    expect(useGuideStore.getState().selectedElement).toBeNull()
  })

  it('enables and disables compare mode', () => {
    const { setCompareMode } = useGuideStore.getState()

    setCompareMode(true)
    expect(useGuideStore.getState().compareMode).toBe(true)

    setCompareMode(false)
    expect(useGuideStore.getState().compareMode).toBe(false)
  })

  it('allows multiple state updates', () => {
    const { setJourneyStage, selectElement, setCompareMode, togglePanel } = useGuideStore.getState()

    setJourneyStage('building')
    selectElement('node-1')
    setCompareMode(true)
    togglePanel()

    const state = useGuideStore.getState()
    expect(state.journeyStage).toBe('building')
    expect(state.selectedElement).toBe('node-1')
    expect(state.compareMode).toBe(true)
    expect(state.panelExpanded).toBe(false)
  })
})

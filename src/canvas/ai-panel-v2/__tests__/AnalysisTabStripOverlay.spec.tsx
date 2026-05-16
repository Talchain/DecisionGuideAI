import { describe, it, expect, vi, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, cleanup } from '@testing-library/react'

import { useUIStore } from '../../../stores/uiStore'
import { AnalysisTabStripOverlay } from '../AnalysisTabStripOverlay'
import {
  Z_AI_PANEL_BASE,
  Z_ANALYSIS_OVERLAY,
  Z_ANALYSIS_SCRIM,
} from '../constants'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  useUIStore.setState({
    activeOutputTab: 'results',
    activeRightPanel: null,
    hoveredElementId: null,
    pendingModelTabSection: null,
  })
})

describe('AnalysisTabStripOverlay', () => {
  it('renders above OutputsDock and keeps the outside scrim below it', () => {
    expect(Z_ANALYSIS_OVERLAY).toBeGreaterThan(Z_AI_PANEL_BASE)
    expect(Z_ANALYSIS_SCRIM).toBeLessThan(Z_AI_PANEL_BASE)
  })

  it('opens the real OutputsDock tab instead of rendering placeholder content', () => {
    const onActiveTabChange = vi.fn()
    render(<AnalysisTabStripOverlay active onActiveTabChange={onActiveTabChange} />)

    fireEvent.click(screen.getByTestId('ai-panel-v2-tab-compare'))

    expect(useUIStore.getState().activeOutputTab).toBe('compare')
    expect(useUIStore.getState().activeRightPanel).toBe('results')
    expect(onActiveTabChange).toHaveBeenLastCalledWith('compare')
    expect(screen.queryByTestId('ai-panel-v2-tab-strip-overlay')).toBeNull()
    expect(screen.getByTestId('ai-panel-v2-tab-strip-scrim')).toBeInTheDocument()
  })

  it('Escape closes the temporary dock overlay', () => {
    const onActiveTabChange = vi.fn()
    render(<AnalysisTabStripOverlay active onActiveTabChange={onActiveTabChange} />)

    fireEvent.click(screen.getByTestId('ai-panel-v2-tab-results'))
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onActiveTabChange).toHaveBeenLastCalledWith(null)
    expect(screen.queryByTestId('ai-panel-v2-tab-strip-scrim')).toBeNull()
  })
})

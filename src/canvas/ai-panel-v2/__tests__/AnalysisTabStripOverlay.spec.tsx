import { describe, it, expect, vi, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, cleanup, act } from '@testing-library/react'

import { useUIStore } from '../../../stores/uiStore'
import { AnalysisTabStripOverlay } from '../AnalysisTabStripOverlay'
import {
  Z_AI_PANEL_BASE,
  Z_ANALYSIS_OVERLAY,
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
  it('strip renders above OutputsDock', () => {
    expect(Z_ANALYSIS_OVERLAY).toBeGreaterThan(Z_AI_PANEL_BASE)
  })

  it('opens the real OutputsDock tab instead of rendering placeholder content', () => {
    const onActiveTabChange = vi.fn()
    render(<AnalysisTabStripOverlay active onActiveTabChange={onActiveTabChange} />)

    fireEvent.click(screen.getByTestId('ai-panel-v2-tab-compare'))

    expect(useUIStore.getState().activeOutputTab).toBe('compare')
    expect(useUIStore.getState().activeRightPanel).toBe('results')
    expect(onActiveTabChange).toHaveBeenLastCalledWith('compare')
    expect(screen.queryByTestId('ai-panel-v2-tab-strip-overlay')).toBeNull()
  })

  it('Escape closes the temporary dock overlay', () => {
    const onActiveTabChange = vi.fn()
    render(<AnalysisTabStripOverlay active onActiveTabChange={onActiveTabChange} />)

    fireEvent.click(screen.getByTestId('ai-panel-v2-tab-results'))
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onActiveTabChange).toHaveBeenLastCalledWith(null)
  })

  it('document pointerdown outside the strip + dock closes the overlay', async () => {
    // Stand in for OutputsDock so the handler can recognise "inside dock"
    // clicks (which must NOT close).
    const dock = document.createElement('div')
    dock.setAttribute('data-testid', 'outputs-dock')
    document.body.appendChild(dock)

    const outside = document.createElement('div')
    outside.setAttribute('data-testid', 'fake-canvas')
    document.body.appendChild(outside)

    const onActiveTabChange = vi.fn()
    render(<AnalysisTabStripOverlay active onActiveTabChange={onActiveTabChange} />)
    fireEvent.click(screen.getByTestId('ai-panel-v2-tab-results'))
    expect(onActiveTabChange).toHaveBeenLastCalledWith('results')

    // Wait one tick for the setTimeout(0) registration to attach the
    // document handler (mirrors the production same-tick guard).
    await act(async () => { await new Promise(r => setTimeout(r, 0)) })

    // Click "inside the dock" — must NOT close.
    fireEvent.pointerDown(dock)
    expect(onActiveTabChange).not.toHaveBeenLastCalledWith(null)

    // Click outside (e.g. AI column / canvas) — must close.
    fireEvent.pointerDown(outside)
    expect(onActiveTabChange).toHaveBeenLastCalledWith(null)

    document.body.removeChild(dock)
    document.body.removeChild(outside)
  })
})

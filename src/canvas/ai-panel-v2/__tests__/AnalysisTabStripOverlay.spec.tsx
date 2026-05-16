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

  it('capture-phase pointerdown closes outside strip + dock but keeps both interactive', async () => {
    // Stand in for OutputsDock so the handler can recognise "inside dock"
    // clicks (which must NOT close).
    const dock = document.createElement('div')
    dock.setAttribute('data-testid', 'outputs-dock')
    document.body.appendChild(dock)

    // Stand in for the AI column so we can verify clicks there close the
    // overlay (since AI column is "outside" the strip+dock) WITHOUT
    // suppressing the underlying click (textarea focus, etc.).
    const aiPanel = document.createElement('div')
    aiPanel.setAttribute('data-testid', 'ai-panel-v2-layout')
    document.body.appendChild(aiPanel)

    // Stand in for true-outside surface (canvas / tools rail) — clicks
    // here must close AND have their default suppressed.
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

    // Click "inside the strip" (an active-tab button) — must NOT close.
    // We re-click the active tab to test this; the strip's own handler
    // toggles the tab off, but the outside-click handler must not also
    // fire (or we'd get a double-close path).
    fireEvent.pointerDown(screen.getByTestId('ai-panel-v2-tab-results'))
    expect(onActiveTabChange).not.toHaveBeenLastCalledWith(null)

    // Click on the AI column — outside strip+dock so the overlay closes,
    // BUT preventDefault must NOT fire (AI column clicks keep working).
    // jsdom doesn't ship a PointerEvent constructor; use Event which
    // exercises the same dispatch path our handler subscribes to.
    const aiEvent = new Event('pointerdown', { bubbles: true, cancelable: true })
    aiPanel.dispatchEvent(aiEvent)
    expect(onActiveTabChange).toHaveBeenLastCalledWith(null)
    expect(aiEvent.defaultPrevented).toBe(false)

    // Re-open and click on a true-outside surface — overlay closes AND
    // preventDefault fires so the underlying canvas/tool doesn't react.
    onActiveTabChange.mockClear()
    fireEvent.click(screen.getByTestId('ai-panel-v2-tab-results'))
    await act(async () => { await new Promise(r => setTimeout(r, 0)) })
    const outsideEvent = new Event('pointerdown', { bubbles: true, cancelable: true })
    outside.dispatchEvent(outsideEvent)
    expect(onActiveTabChange).toHaveBeenLastCalledWith(null)
    expect(outsideEvent.defaultPrevented).toBe(true)

    document.body.removeChild(dock)
    document.body.removeChild(aiPanel)
    document.body.removeChild(outside)
  })
})

import { describe, it, expect, afterEach, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, cleanup } from '@testing-library/react'

// Mock heavy children to keep this at the mounting level.
vi.mock('../AIZone', () => ({
  AIZone: () => <div data-testid="stub-ai-zone" />,
}))
vi.mock('../PullTab', () => ({
  PullTab: ({
    activeMode,
    onModeClick,
  }: {
    activeMode: string
    onModeClick: (mode: 'compact' | 'conversation' | 'focus') => void
  }) => (
    <div data-testid="stub-pull-tab" data-active-mode={activeMode}>
      <button type="button" data-testid="stub-focus-mode" onClick={() => onModeClick('focus')}>
        Focus
      </button>
    </div>
  ),
}))

import { AIPanelV2Layout } from '../AIPanelV2Layout'
import {
  AI_PANEL_V2_WIDTH,
  Z_AI_PANEL_BASE,
  AI_ZONE_MIN_HEIGHT,
  ANALYSIS_TAB_STRIP_WIDTH,
} from '../constants'
import { isAiPanelV2Enabled } from '../../../flags'

afterEach(() => {
  cleanup()
  Object.defineProperty(window, 'innerWidth', { writable: true, value: 1024 })
  document.documentElement.style.removeProperty('--olumi-ai-panel-dock-width')
  document.documentElement.style.removeProperty('--olumi-ai-panel-bottom')
})

describe('AIPanelV2Layout (step 5 — vertical split + PullTab)', () => {
  it('mounts AIZone and PullTab inside the layout', () => {
    render(<AIPanelV2Layout />)
    expect(screen.getByTestId('ai-panel-v2-layout')).toBeInTheDocument()
    expect(screen.getByTestId('ai-panel-v2-ai-zone')).toBeInTheDocument()
    expect(screen.getByTestId('stub-pull-tab')).toBeInTheDocument()
    expect(screen.getByTestId('stub-ai-zone')).toBeInTheDocument()
  })

  it('writes the flag-specific dock width override (never --dock-right-expanded)', () => {
    render(<AIPanelV2Layout />)
    expect(document.documentElement.style.getPropertyValue('--olumi-ai-panel-dock-width'))
      .toBe(`${AI_PANEL_V2_WIDTH}px`)
    expect(document.documentElement.style.getPropertyValue('--dock-right-expanded')).toBe('')
  })

  it('writes a pixel-valued --olumi-ai-panel-bottom (no static clamp string)', () => {
    render(<AIPanelV2Layout />)
    const v = document.documentElement.style.getPropertyValue('--olumi-ai-panel-bottom')
    expect(v).toMatch(/^\d+px$/)
  })

  it('removes both CSS variables on unmount (no residue when FF flips off)', () => {
    const { unmount } = render(<AIPanelV2Layout />)
    unmount()
    expect(document.documentElement.style.getPropertyValue('--olumi-ai-panel-dock-width')).toBe('')
    expect(document.documentElement.style.getPropertyValue('--olumi-ai-panel-bottom')).toBe('')
  })

  it('is fixed-position at the configured width, right offset, and z-index', () => {
    render(<AIPanelV2Layout />)
    const aside = screen.getByTestId('ai-panel-v2-layout')
    expect(aside.style.position).toBe('fixed')
    expect(aside.style.width).toBe(`${AI_PANEL_V2_WIDTH}px`)
    expect(aside.style.right).toBe('12px')
    expect(aside.style.zIndex).toBe(String(Z_AI_PANEL_BASE))
  })

  it('exposes the active mode and ratio via data attributes for diagnostics', () => {
    render(<AIPanelV2Layout />)
    const aside = screen.getByTestId('ai-panel-v2-layout')
    expect(aside.getAttribute('data-active-mode')).toBe('compact')
    const ratio = Number(aside.getAttribute('data-ai-ratio'))
    expect(ratio).toBeGreaterThan(0)
    expect(ratio).toBeLessThan(1)
  })

  it('the initial AI-zone height is at least the configured min', () => {
    render(<AIPanelV2Layout />)
    const aside = screen.getByTestId('ai-panel-v2-layout')
    // Without a ResizeObserver firing, the sentinel reports 0 so the
    // height falls back to AI_ZONE_MIN_HEIGHT px.
    expect(aside.style.height).toBe(`${AI_ZONE_MIN_HEIGHT}px`)
  })

  it('has an accessible label', () => {
    render(<AIPanelV2Layout />)
    expect(screen.getByLabelText(/ai conversation/i)).toBeInTheDocument()
  })

  it('collapses the dock to the tab-strip width in 1440-1599 Focus mode and expands it while an overlay tab is open', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 1500 })
    render(<AIPanelV2Layout />)

    fireEvent.click(screen.getByTestId('stub-focus-mode'))

    expect(document.documentElement.style.getPropertyValue('--olumi-ai-panel-dock-width'))
      .toBe(`${ANALYSIS_TAB_STRIP_WIDTH}px`)

    fireEvent.click(screen.getByTestId('ai-panel-v2-tab-results'))

    expect(document.documentElement.style.getPropertyValue('--olumi-ai-panel-dock-width'))
      .toBe(`${AI_PANEL_V2_WIDTH}px`)
  })

  it('slides the Focus AI column LEFT when a tab-strip tab opens so the expanded dock has room', () => {
    // At 1440-1599 with no tab open: dock is a 48px strip, AI column sits
    // close to the right (right = 48 + 12 margin + 12 gutter = 72px).
    // When a tab opens, the dock expands to 400px and the column must
    // shift left or it would overlap the dock at the same z-index. The
    // delta = AI_PANEL_V2_WIDTH − ANALYSIS_TAB_STRIP_WIDTH.
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 1500 })
    render(<AIPanelV2Layout />)
    fireEvent.click(screen.getByTestId('stub-focus-mode'))

    const aside = screen.getByTestId('ai-panel-v2-layout')
    const stripRight = parseFloat(aside.style.right)
    expect(stripRight).toBeCloseTo(ANALYSIS_TAB_STRIP_WIDTH + 12 + 12, 0)

    fireEvent.click(screen.getByTestId('ai-panel-v2-tab-results'))
    const openRight = parseFloat(aside.style.right)
    expect(openRight).toBeCloseTo(AI_PANEL_V2_WIDTH + 12 + 12, 0)
    expect(openRight - stripRight).toBeCloseTo(
      AI_PANEL_V2_WIDTH - ANALYSIS_TAB_STRIP_WIDTH,
      0,
    )
  })
})

describe('FF_AI_PANEL_V2 default', () => {
  it('is off by default (no env var, no localStorage override)', () => {
    expect(isAiPanelV2Enabled()).toBe(false)
  })
})

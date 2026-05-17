import { describe, it, expect, afterEach, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, cleanup } from '@testing-library/react'

// Mock heavy children so the test stays at the mounting level.
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
vi.mock('../../components/OutputsDock', () => ({
  OutputsDock: ({ embedded }: { embedded?: boolean }) => (
    <div data-testid="stub-outputs-dock" data-embedded={String(!!embedded)} />
  ),
}))

import { AIPanelV2Layout } from '../AIPanelV2Layout'
import {
  AI_PANEL_V2_WIDTH,
  Z_AI_PANEL_BASE,
  AI_ZONE_MIN_HEIGHT,
} from '../constants'
import { isAiPanelV2Enabled } from '../../../flags'

afterEach(() => {
  cleanup()
  Object.defineProperty(window, 'innerWidth', { writable: true, value: 1024 })
})

describe('AIPanelV2Layout — single container: analysis zone + AI zone (Fix 1)', () => {
  it('mounts both zones — OutputsDock(embedded) at top + AIZone at bottom', () => {
    render(<AIPanelV2Layout />)
    // Analysis zone
    expect(screen.getByTestId('ai-panel-v2-analysis-zone')).toBeInTheDocument()
    expect(screen.getByTestId('stub-outputs-dock')).toBeInTheDocument()
    expect(screen.getByTestId('stub-outputs-dock').dataset.embedded).toBe('true')
    // AI zone
    expect(screen.getByTestId('ai-panel-v2-layout')).toBeInTheDocument()
    expect(screen.getByTestId('ai-panel-v2-ai-zone')).toBeInTheDocument()
    expect(screen.getByTestId('stub-ai-zone')).toBeInTheDocument()
    expect(screen.getByTestId('stub-pull-tab')).toBeInTheDocument()
  })

  it('exactly one OutputsDock is mounted (singleton at the layout level)', () => {
    render(<AIPanelV2Layout />)
    expect(screen.getAllByTestId('stub-outputs-dock')).toHaveLength(1)
  })

  it('AI zone has its own testid distinct from the analysis zone', () => {
    render(<AIPanelV2Layout />)
    const ai = screen.getByTestId('ai-panel-v2-layout')
    const analysis = screen.getByTestId('ai-panel-v2-analysis-zone')
    expect(ai).not.toBe(analysis)
    expect(ai.getAttribute('aria-label')).toBe('AI conversation')
    expect(analysis.getAttribute('aria-label')).toBe('Analysis')
  })

  it('AI zone is fixed-positioned at the right edge with the configured width + z-index', () => {
    render(<AIPanelV2Layout />)
    const ai = screen.getByTestId('ai-panel-v2-layout')
    expect(ai.style.position).toBe('fixed')
    expect(ai.style.width).toBe(`${AI_PANEL_V2_WIDTH}px`)
    expect(ai.style.right).toBe('12px')
    expect(ai.style.zIndex).toBe(String(Z_AI_PANEL_BASE))
  })

  it('analysis zone is fixed-positioned at the top-right with the configured width', () => {
    render(<AIPanelV2Layout />)
    const a = screen.getByTestId('ai-panel-v2-analysis-zone')
    expect(a.style.position).toBe('fixed')
    expect(a.style.width).toBe(`${AI_PANEL_V2_WIDTH}px`)
    expect(a.style.right).toBe('12px')
    expect(a.style.top).toBe('12px')
  })

  it('exposes the active mode + ratio via data attributes for diagnostics', () => {
    render(<AIPanelV2Layout />)
    const ai = screen.getByTestId('ai-panel-v2-layout')
    expect(ai.getAttribute('data-active-mode')).toBe('compact')
    const ratio = Number(ai.getAttribute('data-ai-ratio'))
    expect(ratio).toBeGreaterThan(0)
    expect(ratio).toBeLessThan(1)
  })

  it('initial AI-zone height is at least AI_ZONE_MIN_HEIGHT', () => {
    render(<AIPanelV2Layout />)
    const ai = screen.getByTestId('ai-panel-v2-layout')
    expect(ai.style.height).toBe(`${AI_ZONE_MIN_HEIGHT}px`)
  })

  it('hides the analysis zone in 1440-1599 Focus tab-strip mode (no tab open)', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 1500 })
    render(<AIPanelV2Layout />)
    fireEvent.click(screen.getByTestId('stub-focus-mode'))
    const analysis = screen.getByTestId('ai-panel-v2-analysis-zone')
    expect(analysis.getAttribute('data-tab-strip-hidden')).toBe('true')
  })

  it('reveals the analysis zone again when a tab opens in tab-strip mode', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 1500 })
    render(<AIPanelV2Layout />)
    fireEvent.click(screen.getByTestId('stub-focus-mode'))
    // Open a tab via the strip (rendered by AnalysisTabStripOverlay).
    fireEvent.click(screen.getByTestId('ai-panel-v2-tab-results'))
    const analysis = screen.getByTestId('ai-panel-v2-analysis-zone')
    expect(analysis.getAttribute('data-tab-strip-hidden')).toBe('false')
  })
})

describe('FF_AI_PANEL_V2 default', () => {
  it('is off by default (no env var, no localStorage override)', () => {
    expect(isAiPanelV2Enabled()).toBe(false)
  })
})

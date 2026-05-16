import { describe, it, expect, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, cleanup } from '@testing-library/react'

import { AIPanelV2Layout } from '../AIPanelV2Layout'
import {
  AI_PANEL_V2_WIDTH,
  AI_ZONE_MIN_HEIGHT,
  ANALYSIS_ZONE_MIN_HEIGHT,
  COMPACT_AI_RATIO,
  Z_AI_PANEL_BASE,
} from '../constants'
import { isAiPanelV2Enabled } from '../../../flags'

const EXPECTED_HEIGHT_CSS = `clamp(${AI_ZONE_MIN_HEIGHT}px, ${Math.round(
  COMPACT_AI_RATIO * 100
)}vh, calc(100vh - 12px - 1rem - var(--bottombar-h, 0px) - ${ANALYSIS_ZONE_MIN_HEIGHT}px))`

afterEach(() => {
  cleanup()
  document.documentElement.style.removeProperty('--olumi-ai-panel-dock-width')
  document.documentElement.style.removeProperty('--olumi-ai-panel-bottom')
})

describe('AIPanelV2Layout (step 1 skeleton)', () => {
  it('renders the AI zone container with the panel testid', () => {
    render(<AIPanelV2Layout />)
    expect(screen.getByTestId('ai-panel-v2-layout')).toBeInTheDocument()
    expect(screen.getByTestId('ai-panel-v2-ai-zone')).toBeInTheDocument()
  })

  it('writes the flag-specific dock width override (never --dock-right-expanded)', () => {
    render(<AIPanelV2Layout />)
    expect(document.documentElement.style.getPropertyValue('--olumi-ai-panel-dock-width'))
      .toBe(`${AI_PANEL_V2_WIDTH}px`)
    // Must NOT touch the dock's persisted width state.
    expect(document.documentElement.style.getPropertyValue('--dock-right-expanded')).toBe('')
  })

  it('writes --olumi-ai-panel-bottom as a clamped height with min-zone enforcement', () => {
    render(<AIPanelV2Layout />)
    expect(document.documentElement.style.getPropertyValue('--olumi-ai-panel-bottom'))
      .toBe(EXPECTED_HEIGHT_CSS)
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

it('has an accessible label', () => {
    render(<AIPanelV2Layout />)
    expect(screen.getByLabelText(/ai conversation/i)).toBeInTheDocument()
  })
})

describe('FF_AI_PANEL_V2 default', () => {
  it('is off by default (no env var, no localStorage override)', () => {
    expect(isAiPanelV2Enabled()).toBe(false)
  })
})

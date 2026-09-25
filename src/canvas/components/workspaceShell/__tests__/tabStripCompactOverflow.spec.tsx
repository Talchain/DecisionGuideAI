/**
 * gap NARROW-1 (design-audit-20260925, severity high) — at a dock width of
 * 320px or less, `WorkspaceShellTabStrip` used to wrap into a 2×2 grid: four
 * tabs on one row, VersionsTrigger / the expert-mode toggle / the collapse
 * control crowded onto a second. This pins the fix: below
 * `SHELL_TABSTRIP_COMPACT_BELOW_PX` the strip stays ONE row (`flex-nowrap`,
 * never `flex-wrap`) and VersionsTrigger plus the expert-mode toggle fold
 * into a single overflow menu, so both stay reachable rather than being
 * silently dropped from the strip.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import { WorkspaceShellTabStrip } from '../WorkspaceShellTabStrip'
import { PanelWidthProvider } from '../usePanelWidth'
import {
  SHELL_TABSTRIP_COMPACT_BELOW_PX,
  type WorkspaceSurfaceDescriptor,
} from '../shellContract'

afterEach(cleanup)

const surfaces: WorkspaceSurfaceDescriptor[] = [
  { id: 'results', label: 'Analysis', scroll: 'self', padding: 'self', presentedAsTab: true, hiddenReason: '', footerBar: 'none' },
  { id: 'diagnostics', label: 'Model', scroll: 'shell', padding: 'shell', presentedAsTab: true, hiddenReason: '', footerBar: 'reanalyse' },
]

const draw = (width: number, expertMode = false, onToggleExpertMode = vi.fn()) =>
  render(
    <PanelWidthProvider value={{ width, contentWidth: width - 26 }}>
      <WorkspaceShellTabStrip
        surfaces={surfaces}
        activeTab="results"
        onTabClick={vi.fn()}
        isOpen={true}
        onToggleOpen={vi.fn()}
        expertMode={expertMode}
        onToggleExpertMode={onToggleExpertMode}
        showResultsFreshnessIcon={false}
        resultsStale={false}
        factorsToVerify={0}
      />
    </PanelWidthProvider>,
  )

describe('gap NARROW-1: at 280px the strip stays one row, and both folded controls stay reachable', () => {
  it('⭐⭐ at 280px (≤320) the tablist never wraps — flex-nowrap, not flex-wrap', () => {
    draw(280)
    const tablist = screen.getByTestId('outputs-dock-tablist')
    expect(tablist.className).toMatch(/\bflex-nowrap\b/)
    expect(tablist.className).not.toMatch(/\bflex-wrap\b/)
  })

  it('⭐⭐ at 280px VersionsTrigger and the expert-mode toggle are NOT direct row controls — they fold behind one overflow trigger', () => {
    draw(280)
    expect(screen.queryByTestId('dock-versions-trigger')).toBeNull()
    expect(screen.queryByLabelText('Enable expert mode')).toBeNull()
    expect(screen.queryByLabelText('Disable expert mode')).toBeNull()
  })

  it('⭐⭐ the overflow trigger is a real button with an accessible name, reachable by keyboard', () => {
    draw(280)
    const trigger = screen.getByTestId('dock-overflow-trigger')
    expect(trigger.tagName).toBe('BUTTON')
    expect(trigger).toHaveAccessibleName('More controls')
    expect(trigger).not.toHaveAttribute('tabindex', '-1')
  })

  it('⭐⭐ opening the overflow menu reveals BOTH folded controls, unchanged', () => {
    draw(280)
    fireEvent.click(screen.getByTestId('dock-overflow-trigger'))
    expect(screen.getByTestId('dock-versions-trigger')).toBeInTheDocument()
    expect(
      screen.getByRole('menuitem', { name: /expert mode/i }),
      'the expert-mode toggle is reachable inside the open menu',
    ).toBeInTheDocument()
  })

  it('⭐⭐ Escape closes the menu and returns focus to the trigger', () => {
    draw(280)
    const trigger = screen.getByTestId('dock-overflow-trigger')
    fireEvent.click(trigger)
    expect(screen.getByTestId('dock-overflow-menu')).toBeInTheDocument()
    fireEvent.keyDown(screen.getByTestId('dock-overflow-menu'), { key: 'Escape' })
    expect(screen.queryByTestId('dock-overflow-menu')).toBeNull()
    expect(trigger).toHaveFocus()
  })

  it('⭐ CONTRAST: at the default 416px width, both controls render inline and no overflow trigger exists', () => {
    draw(416)
    expect(screen.getByTestId('dock-versions-trigger')).toBeInTheDocument()
    expect(screen.getByLabelText('Enable expert mode')).toBeInTheDocument()
    expect(screen.queryByTestId('dock-overflow-trigger')).toBeNull()
    const tablist = screen.getByTestId('outputs-dock-tablist')
    expect(tablist.className).toMatch(/\bflex-wrap\b/)
  })

  it('⭐ the compact threshold is exactly SHELL_TABSTRIP_COMPACT_BELOW_PX, not a dock-width literal', () => {
    draw(SHELL_TABSTRIP_COMPACT_BELOW_PX - 1)
    expect(screen.getByTestId('dock-overflow-trigger')).toBeInTheDocument()
    cleanup()
    draw(SHELL_TABSTRIP_COMPACT_BELOW_PX)
    expect(screen.queryByTestId('dock-overflow-trigger')).toBeNull()
  })
})

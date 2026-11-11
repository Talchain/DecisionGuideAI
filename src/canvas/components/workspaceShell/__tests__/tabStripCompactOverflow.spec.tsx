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
import { DOCK_RESPONSIVE_MAX_WIDTH } from '../../dockWidth'
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import { WorkspaceShellTabStrip } from '../WorkspaceShellTabStrip'
// The lane is pinned per row: these rows are the flush dock's (every lane but olumi-core's, whose dock is a fixed 300 px card: the last
// describe). Without the pin a run with VITE_OLUMI_CORE=1 in its environment would read the other lane's rule.
const lane = vi.hoisted(() => ({ core: false }))
vi.mock('../../../../olumiCore/lane', async (orig) => ({ ...(await orig<typeof import('../../../../olumiCore/lane')>()), isOlumiCoreLane: () => lane.core }))
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

describe('at 280px the four tabs keep their full labels with the stale mark (served 26 Sep: "Ol… Anal… Reaso… M…")', () => {
  // Served at the 280 dock the tablist had 199px; the four labels need exactly
  // 187 + 3 gaps of 4. The stale mark (16px) or the Model badge tipped it into
  // truncation. Compact tabs take 4px side padding and no gap: 44px back.
  it('compact: 4px tab padding, no gap between tabs', () => {
    draw(280)
    // Served 280 + stale mark was still 8px short: the strip gives back 12px too.
    expect(screen.getByTestId('outputs-dock-tabstrip').className).toMatch(/\bpx-1\b/)
    expect(screen.getByTestId('outputs-dock-tabstrip').className).toMatch(/\bgap-1\b/)
    expect(screen.getByTestId('outputs-dock-tablist').className).toMatch(/\bgap-0\b/)
    for (const t of screen.getAllByRole('tab')) {
      expect(t.className).toMatch(/\bpx-1\b/)
      expect(t.className).not.toMatch(/\bpx-2\b/)
    }
  })

  it('CONTRAST: the wide strip keeps the contract\'s 8px tab padding', () => {
    draw(SHELL_TABSTRIP_COMPACT_BELOW_PX + 80)
    // Paul 14 Oct 2026 (tabs evenly spaced with dividers): the tablist gap is 0 in BOTH modes now — the spacing
    // lives inside each `flex-auto` tab, so the divider at a tab's edge sits midway between two labels.
    expect(screen.getByTestId('outputs-dock-tablist').className).toMatch(/\bgap-0\b/)
    expect(screen.getByTestId('outputs-dock-tablist').className).not.toMatch(/\bgap-1\b/)
    for (const t of screen.getAllByRole('tab')) {
      expect(t.className).toMatch(/\bpx-2\b/)
      expect(t.className).not.toMatch(/\bpx-1\b/)
    }
  })
})

describe('Paul 14 Oct 2026: tabs spread evenly across the row, with a divider between neighbours', () => {
  for (const [name, width] of [['compact', 280], ['wide', SHELL_TABSTRIP_COMPACT_BELOW_PX + 80]] as const) {
    it(`${name}: every tab is \`flex-auto\` (not \`flex-initial\`) and carries the divider, hidden on the first`, () => {
      draw(width)
      const tabs = screen.getAllByRole('tab')
      expect(tabs.length).toBe(surfaces.length)
      for (const t of tabs) {
        expect(t.className).toMatch(/(^|\s)flex-auto(\s|$)/)
        expect(t.className).not.toMatch(/(^|\s)flex-initial(\s|$)/)
        expect(t.className).toMatch(/(^|\s)relative(\s|$)/)
        expect(t.className).toMatch(/(^|\s)before:w-px(\s|$)/)
        expect(t.className).toMatch(/(^|\s)before:bg-panel-border(\s|$)/)
        expect(t.className).toMatch(/(^|\s)first:before:hidden(\s|$)/)
      }
    })
  }
})

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
      screen.getByRole('button', { name: /expert mode/i }),
      'the expert-mode toggle is reachable inside the open menu',
    ).toBeInTheDocument()
  })

  it('⭐⭐ Escape closes the menu and returns focus to the trigger', () => {
    draw(280)
    const trigger = screen.getByTestId('dock-overflow-trigger')
    fireEvent.click(trigger)
    expect(screen.getByTestId('dock-overflow-menu')).toBeInTheDocument()
    // ⭐ The path a keyboard user actually takes: focus is still ON THE TRIGGER
    // after opening (review 5833758302 B1), so Escape must work from there.
    trigger.focus()
    fireEvent.keyDown(trigger, { key: 'Escape' })
    expect(screen.queryByTestId('dock-overflow-menu')).toBeNull()
    expect(trigger).toHaveFocus()
  })

  it('⭐⭐ focus leaving the control closes the disclosure (review B2: tabbing out left it open)', () => {
    draw(280)
    const trigger = screen.getByTestId('dock-overflow-trigger')
    fireEvent.click(trigger)
    const inside = screen.getByRole('button', { name: /expert mode/i })
    fireEvent.blur(trigger, { relatedTarget: inside })
    expect(screen.getByTestId('dock-overflow-menu')).toBeInTheDocument()
    fireEvent.blur(inside, { relatedTarget: document.body })
    expect(screen.queryByTestId('dock-overflow-menu')).toBeNull()
  })

  it('⭐⭐ it is a disclosure, not a malformed ARIA menu (review B3)', () => {
    draw(280)
    const trigger = screen.getByTestId('dock-overflow-trigger')
    fireEvent.click(trigger)
    expect(trigger).not.toHaveAttribute('aria-haspopup', 'menu')
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.queryByRole('menu')).toBeNull()
    expect(screen.queryByRole('menuitem')).toBeNull()
    expect(trigger.getAttribute('aria-controls')).toBe(screen.getByTestId('dock-overflow-menu').id)
  })

  // RE-PINNED 27 Sep 2026: the inline controls start at the 420 threshold (they wrapped at 360).
  // RE-PINNED 30 Sep 2026: the threshold is 460 (five tabs wrap at 420, CANVAS measured #2364); 480 is measured one row.
  it('⭐ CONTRAST: at a wide 480px dock, both controls render inline and no overflow trigger exists', () => {
    draw(480)
    expect(screen.getByTestId('dock-versions-trigger')).toBeInTheDocument()
    expect(screen.getByLabelText('Enable expert mode')).toBeInTheDocument()
    expect(screen.queryByTestId('dock-overflow-trigger')).toBeNull()
    const tablist = screen.getByTestId('outputs-dock-tablist')
    expect(tablist.className).toMatch(/\bflex-wrap\b/)
  })

  it('⭐ the DEFAULT dock (360px since 27 Sep 2026) is compact: served 70a03a22 wrapped "Model" to a second row at 360 non-compact', () => {
    expect(DOCK_RESPONSIVE_MAX_WIDTH).toBeLessThan(SHELL_TABSTRIP_COMPACT_BELOW_PX)
  })

  it('⭐ the compact threshold is exactly SHELL_TABSTRIP_COMPACT_BELOW_PX, not a dock-width literal', () => {
    draw(SHELL_TABSTRIP_COMPACT_BELOW_PX - 1)
    expect(screen.getByTestId('dock-overflow-trigger')).toBeInTheDocument()
    cleanup()
    draw(SHELL_TABSTRIP_COMPACT_BELOW_PX)
    expect(screen.queryByTestId('dock-overflow-trigger')).toBeNull()
  })
})

describe('V11 rehearsal (DL 9 Nov): on the olumi-core lane a tab label is never cut', () => {
  afterEach(() => { lane.core = false })
  it('UI restore 11 Nov (Paul withdrew Model · Explore · Team): on the olumi-core lane Model and Team are tabs again, as on the previous product; 44 px tabs that wrap, never cut (T3)', () => {
    lane.core = true
    draw(300)
    // T3 (DL 11 Nov): below the compact width the lane's tabs still wrap, so a label takes a second row rather than "Anal…"; where the labels
    // fit (the 1232 dock) flex-wrap leaves them on one row (seen on the served crops, which jsdom cannot measure).
    expect(SHELL_TABSTRIP_COMPACT_BELOW_PX).toBeGreaterThan(300)
    expect(screen.getByTestId('outputs-dock-tablist').className).toMatch(/\bflex-wrap\b/)
    expect(screen.getByTestId('outputs-dock-tablist').className).not.toMatch(/\bflex-nowrap\b/)
    // On one row (jsdom: every tab's top is 0) the tabs fill it with their dividers, as at 1232.
    for (const tab of screen.getAllByRole('tab')) { expect(tab.className).toMatch(/\bflex-auto\b/); expect(tab.className).not.toMatch(/(^|\s)before:hidden(\s|$)/) }
    expect(screen.getAllByRole('tab').map((t) => t.dataset['testid'])).toEqual(['outputs-dock-tab-results', 'outputs-dock-tab-diagnostics'])
    for (const tab of screen.getAllByRole('tab')) expect(tab.style.height).toBe('44px')
    cleanup(); lane.core = false
    draw(300)
    expect(screen.getAllByRole('tab').map((t) => t.dataset['testid'])).toEqual(['outputs-dock-tab-results', 'outputs-dock-tab-diagnostics'])
    expect(screen.getByTestId('outputs-dock-tablist').className).toMatch(/\bflex-nowrap\b/)
  })

  it('UI restore 11 Nov: no named-panel header on the lane; the active Model tab is a tab like any other', () => {
    lane.core = true
    render(
      <PanelWidthProvider value={{ width: 300, contentWidth: 274 }}>
        <WorkspaceShellTabStrip surfaces={surfaces} activeTab="diagnostics" onTabClick={vi.fn()} isOpen={true} onToggleOpen={vi.fn()}
          expertMode={false} onToggleExpertMode={vi.fn()} showResultsFreshnessIcon={false} resultsStale={false} factorsToVerify={0} />
      </PanelWidthProvider>,
    )
    expect(screen.queryByTestId('outputs-dock-panel-title')).toBeNull()
    expect(screen.getByRole('tab', { name: /Model/ }).getAttribute('aria-selected')).toBe('true')
    lane.core = false
  })
})

describe('T3: where the lane\'s tabs have wrapped (measured), each is its own width with no divider', () => {
  afterEach(() => { lane.core = false; vi.restoreAllMocks() })
  it('a tab on a second row (offsetTop differs) turns every tab to its own width, no rule; the other lane is untouched', () => {
    vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(function (this: HTMLElement) { return this.dataset['testid'] === 'outputs-dock-tab-diagnostics' ? 44 : 0 })
    lane.core = true
    draw(272)
    for (const tab of screen.getAllByRole('tab')) { expect(tab.className, tab.dataset['testid']).toMatch(/\bflex-none\b/); expect(tab.className).toMatch(/(^|\s)before:hidden(\s|$)/) }
    expect(screen.getByTestId('outputs-dock-tablist').className).toMatch(/\bgap-x-2\b/)
    cleanup(); lane.core = false
    draw(272)
    for (const tab of screen.getAllByRole('tab')) expect(tab.className).toMatch(/\bflex-auto\b/)
  })
})

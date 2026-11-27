/** The selected lane tab uses the shared chip geometry and selected-state tokens. */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { WorkspaceShellTabStrip } from '../WorkspaceShellTabStrip'
const lane = vi.hoisted(() => ({ core: true }))
vi.mock('../../../../olumiCore/lane', async (orig) => ({ ...(await orig<typeof import('../../../../olumiCore/lane')>()), isOlumiCoreLane: () => lane.core }))
import { PanelWidthProvider } from '../usePanelWidth'
import type { WorkspaceSurfaceDescriptor } from '../shellContract'
import { SELECTED } from '../../../../styles/selected'
import { laneTipOf } from '../../../../olumiView/__tests__/tipHelpers'

afterEach(() => { cleanup(); lane.core = true })
const surfaces: WorkspaceSurfaceDescriptor[] = [
  { id: 'results', label: 'Analysis', scroll: 'self', padding: 'self', presentedAsTab: true, hiddenReason: '', footerBar: 'none' },
  { id: 'compare' as WorkspaceSurfaceDescriptor['id'], label: 'Compare', scroll: 'self', padding: 'self', presentedAsTab: true, hiddenReason: '', footerBar: 'none' },
]
const draw = (width = 347) => render(
  <PanelWidthProvider value={{ width, contentWidth: width - 26 }}>
    <WorkspaceShellTabStrip surfaces={surfaces} activeTab="results" onTabClick={vi.fn()} isOpen onToggleOpen={vi.fn()} expertMode={false}
      onToggleExpertMode={vi.fn()} showResultsFreshnessIcon={false} resultsStale={false} factorsToVerify={0} />
  </PanelWidthProvider>,
)
const pillOf = (tab: HTMLElement) => tab.querySelector<HTMLElement>('[data-tab-pill]')!
const cls = (e: HTMLElement) => e.className.split(/\s+/)

describe('the selected dock tab is the comp\'s pill', () => {
  it('TP1: the selected tab uses the 28px chip and selected tokens', () => {
    draw()
    const tab = screen.getByTestId('outputs-dock-tab-results')
    expect(tab.style.height).toBe('')
    expect(tab).toHaveClass('min-h-7', 'rounded-control', ...SELECTED.split(' '))
  })
  it('TP2: an unselected tab uses hover feedback', () => {
    draw()
    const tab = screen.getByTestId('outputs-dock-tab-compare')
    expect(tab).toHaveClass('min-h-7', 'rounded-control', 'hover:bg-panel-hover')
    for (const token of SELECTED.split(' ')) expect(cls(tab)).not.toContain(token)
  })
  it('TP3 must not change: another lane draws no pill', () => {
    lane.core = false
    draw()
    expect(pillOf(screen.getByTestId('outputs-dock-tab-results'))).toBeNull()
  })
})

describe('DL 06:57Z (2): on the narrow lane dock (1128: 317 px) the tabs keep one row, every name whole', () => {
  it('TR1 at 317 px: one row (no wrap), each tab its full width, the row scrolls sideways where they do not fit; the pills tighten', () => {
    draw(317)
    const list = screen.getByTestId('outputs-dock-tablist')
    expect([cls(list).includes('flex-nowrap'), cls(list).includes('flex-wrap'), list.closest('nav')!.getAttribute('data-lane-row')]).toEqual([true, false, 'one'])
    for (const id of ['results', 'compare']) expect(cls(screen.getByTestId(`outputs-dock-tab-${id}`))).toContain('shrink-0')
    expect(screen.getByTestId('outputs-dock-tab-results')).toHaveClass('[&]:px-0.5')
  })
  it('TR1 CONTRAST: at the 1232 dock (347 px) the row is as before (it fits one row there; no forced scroll)', () => {
    draw(347)
    const list = screen.getByTestId('outputs-dock-tablist')
    expect([cls(list).includes('flex-wrap'), list.closest('nav')!.getAttribute('data-lane-row')]).toEqual([true, null])
    expect(screen.getByTestId('outputs-dock-tab-results')).not.toHaveClass('[&]:px-0.5')
  })
})

describe('the selected core tab shows its icon and label', () => {
  it('T8a: core tabs keep their Tip and aria-label, and only the selected tab shows its label', () => {
    draw()
    const off = screen.getByTestId('outputs-dock-tab-compare')
    expect(laneTipOf(off)).toBe('Compare')
    expect(off.getAttribute('aria-label')).toBe('Compare')
    expect(off.textContent).toBe('')
    expect(screen.getByRole('tab', { name: 'Compare' })).toBe(off)
    expect(off.querySelector('[data-testid="outputs-dock-tab-icon-compare"]')).not.toBeNull()
    expect(cls(off)).toContain('before:hidden')
    const on = screen.getByTestId('outputs-dock-tab-results')
    expect(on.textContent).toBe('Analysis')
    expect(laneTipOf(on)).toBe('Analysis')
    expect(on.getAttribute('aria-label')).toBe('Analysis')
    const icon = on.querySelector('[data-testid="outputs-dock-tab-icon-results"]')
    expect(icon).not.toBeNull()
    expect(icon?.nextElementSibling).toHaveClass('min-w-0', 'truncate')
  })
  it('T8b contrast: the legacy lane keeps words on every tab and no lane icons', () => {
    lane.core = false
    draw()
    const off = screen.getByTestId('outputs-dock-tab-compare')
    expect(off.textContent).toBe('Compare')
    expect(off).toHaveAttribute('title', 'Compare')
    expect(off.querySelector('[data-testid="outputs-dock-tab-icon-compare"]')).toBeNull()
    expect(cls(off)).not.toContain('before:hidden')
  })
})

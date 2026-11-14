/**
 * P1 (the approved V11 comp's `.ptab.on`, DL 10 Nov): on the olumi-core lane the selected dock tab is a 32 px rounded pill around its label,
 * carrying the one selected token (styles/selected.ts), inside the 44 px button; the button itself is never a filled or ringed full-height
 * box. Other lanes keep their own selected tab.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { WorkspaceShellTabStrip } from '../WorkspaceShellTabStrip'
const lane = vi.hoisted(() => ({ core: true }))
vi.mock('../../../../olumiCore/lane', async (orig) => ({ ...(await orig<typeof import('../../../../olumiCore/lane')>()), isOlumiCoreLane: () => lane.core }))
import { PanelWidthProvider } from '../usePanelWidth'
import type { WorkspaceSurfaceDescriptor } from '../shellContract'
import { SELECTED } from '../../../../styles/selected'

afterEach(() => { cleanup(); lane.core = true })
const surfaces: WorkspaceSurfaceDescriptor[] = [
  { id: 'results', label: 'Analysis', scroll: 'self', padding: 'self', presentedAsTab: true, hiddenReason: '', footerBar: 'none' },
  { id: 'compare' as WorkspaceSurfaceDescriptor['id'], label: 'Compare', scroll: 'self', padding: 'self', presentedAsTab: true, hiddenReason: '', footerBar: 'none' },
]
const draw = () => render(
  <PanelWidthProvider value={{ width: 347, contentWidth: 321 }}>
    <WorkspaceShellTabStrip surfaces={surfaces} activeTab="results" onTabClick={vi.fn()} isOpen onToggleOpen={vi.fn()} expertMode={false}
      onToggleExpertMode={vi.fn()} showResultsFreshnessIcon={false} resultsStale={false} factorsToVerify={0} />
  </PanelWidthProvider>,
)
const pillOf = (tab: HTMLElement) => tab.querySelector<HTMLElement>('[data-tab-pill]')!
const cls = (e: HTMLElement) => e.className.split(/\s+/)

describe('the selected dock tab is the comp\'s pill', () => {
  it('TP1 catch: the selected tab\'s label is a 32 px rounded pill with the selected token; its 44 px button carries no ring or fill', () => {
    draw()
    const tab = screen.getByTestId('outputs-dock-tab-results')
    expect(tab.style.height).toBe('44px')
    expect(cls(pillOf(tab))).toEqual(expect.arrayContaining(['h-8', 'rounded-full', ...SELECTED.split(' ')]))
    for (const t of SELECTED.split(' ')) if (t.startsWith('ring') || t.startsWith('bg-')) expect(cls(tab)).not.toContain(t)
    expect(cls(tab)).not.toContain('rounded-md')
  })
  it('TP2 contrast: an unselected tab\'s pill has no selected token, only a hover fill', () => {
    draw()
    const pill = pillOf(screen.getByTestId('outputs-dock-tab-compare'))
    expect(cls(pill)).toContain('hover:bg-panel-hover')
    for (const t of SELECTED.split(' ')) expect(cls(pill)).not.toContain(t)
  })
  it('TP3 must not change: another lane draws no pill', () => {
    lane.core = false
    draw()
    expect(pillOf(screen.getByTestId('outputs-dock-tab-results'))).toBeNull()
  })
})

describe('DL 05:04Z: on the core lane the dock tab names never touch', () => {
  it('TS1: every core-lane tab button keeps horizontal padding on both sides, so neighbouring names are apart (served 1232 had none)', () => {
    draw()
    for (const id of ['results', 'compare']) expect(cls(screen.getByTestId(`outputs-dock-tab-${id}`))).toContain('px-[3px]')
  })
  it('TS1 contrast: no core-lane tab is drawn with zero horizontal padding', () => {
    draw()
    for (const id of ['results', 'compare']) expect(cls(screen.getByTestId(`outputs-dock-tab-${id}`))).not.toContain('px-0')
  })
})

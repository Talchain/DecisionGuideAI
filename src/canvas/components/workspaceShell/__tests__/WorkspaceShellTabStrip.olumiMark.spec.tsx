/**
 * Vision spec §3 (23 Oct 2026): the Olumi tab is the brand mark alone. "Olumi" stays its accessible name and its
 * tooltip, so a screen reader and a hover still say it; the other tabs keep their words.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

import { WorkspaceShellTabStrip } from '../WorkspaceShellTabStrip'
import { isOlumiCoreLane } from '../../../../olumiCore/lane'
import { PanelWidthProvider } from '../usePanelWidth'
import type { WorkspaceSurfaceDescriptor } from '../shellContract'

afterEach(() => { cleanup(); vi.unstubAllEnvs() })

const surfaces: WorkspaceSurfaceDescriptor[] = [
  { id: 'olumi', label: 'Olumi', scroll: 'self', padding: 'self', presentedAsTab: true, hiddenReason: '', footerBar: 'readiness' },
  { id: 'results', label: 'Analysis', scroll: 'self', padding: 'self', presentedAsTab: true, hiddenReason: '', footerBar: 'none' },
]

function draw() {
  return render(
    <PanelWidthProvider value={{ width: 416, contentWidth: 390 }}>
      <WorkspaceShellTabStrip
        surfaces={surfaces}
        activeTab="olumi"
        onTabClick={vi.fn()}
        isOpen={true}
        onToggleOpen={vi.fn()}
        expertMode={false}
        onToggleExpertMode={vi.fn()}
        showResultsFreshnessIcon={false}
        resultsStale={false}
        factorsToVerify={0}
      />
    </PanelWidthProvider>,
  )
}

describe('the Olumi dock tab is the brand mark, named "Olumi"', () => {
  // CHANGED BY DESIGN (17 Nov, calm panel mock v2, Paul): the Olumi tab is just Olumi's logo on the core lane too; "Olumi" is its hover and label (DL round 5 had drawn the word beside the mark while selected).
  it('draws the mark and no visible word, on every lane', () => {
    draw()
    const tab = screen.getByTestId('outputs-dock-tab-olumi')
    expect(tab.querySelector('[data-testid="outputs-dock-tab-olumi-mark"] svg[data-icon="olumi-ai"]')).not.toBeNull()
    expect(tab.textContent).toBe('')
  })

  it.each([['1', '14'], ['0', '16']])('uses the icon size for lane posture %s', (flag, size) => {
    vi.stubEnv('VITE_OLUMI_CORE', flag)
    draw()
    const mark = screen.getByTestId('outputs-dock-tab-olumi-mark').querySelector('svg')
    expect(mark).toHaveAttribute('width', size)
    expect(mark).toHaveAttribute('height', size)
    if (flag === '1') {
      expect(screen.getByTestId('outputs-dock-tab-icon-results').querySelector('svg')).toHaveAttribute('width', '14')
    }
  })

  it('on the olumi-core lane the collapse control sits in the tabs\' own row, with no header row above it and no "…" menu (Paul, 18 Nov); CONTRAST: the older look keeps its row controls', () => {
    draw()
    expect(screen.queryByTestId('outputs-dock-tabstrip-head')).toBeNull()
    const strip = screen.getByTestId('outputs-dock-tabstrip'), collapse = screen.getByTestId('dock-collapse-control')
    expect(collapse.parentElement).toBe(strip)
    expect(screen.getByTestId('outputs-dock-tablist').contains(collapse)).toBe(false)
    const extras = [screen.queryByTestId('dock-overflow-trigger'), screen.queryByTestId('dock-versions-trigger'), screen.queryByRole('button', { name: /expert mode/i })].map((e) => e !== null)
    if (isOlumiCoreLane()) expect(extras).toEqual([false, false, false])
    else expect(extras.some(Boolean)).toBe(true)
  })

  it('keeps "Olumi" as its accessible name and its tooltip', () => {
    draw()
    const tab = screen.getByRole('tab', { name: 'Olumi' })
    expect(tab).toHaveAttribute('title', 'Olumi')
    expect(tab).toHaveAttribute('data-testid', 'outputs-dock-tab-olumi')
  })

  // CHANGED BY DESIGN (v10 review item 8): on the olumi-core lane an unselected tab is its icon, named by title and aria-label, not a word.
  it('CONTRAST: the Analysis tab keeps its name and draws no Olumi mark', () => {
    draw()
    const tab = screen.getByTestId('outputs-dock-tab-results')
    if (isOlumiCoreLane()) { expect(tab.textContent).toBe(''); expect(tab).toHaveAttribute('aria-label', 'Analysis') } else expect(tab.textContent).toBe('Analysis')
    expect(tab).toHaveAttribute('title', 'Analysis')
    expect(tab.querySelector('[data-icon="olumi-ai"]')).toBeNull()
  })
})

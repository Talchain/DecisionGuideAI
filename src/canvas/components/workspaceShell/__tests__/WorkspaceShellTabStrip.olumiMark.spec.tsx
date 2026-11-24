/** The Olumi tab keeps its brand mark and shows its label when selected on the core lane. */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

import { WorkspaceShellTabStrip } from '../WorkspaceShellTabStrip'
import { isOlumiCoreLane } from '../../../../olumiCore/lane'
import { PanelWidthProvider } from '../usePanelWidth'
import type { WorkspaceSurfaceDescriptor } from '../shellContract'
import { laneTipOf } from '../../../../olumiView/__tests__/tipHelpers'

afterEach(() => { cleanup(); vi.unstubAllEnvs() })

const surfaces: WorkspaceSurfaceDescriptor[] = [
  { id: 'olumi', label: 'Olumi', scroll: 'self', padding: 'self', presentedAsTab: true, hiddenReason: '', footerBar: 'readiness' },
  { id: 'results', label: 'Analysis', scroll: 'self', padding: 'self', presentedAsTab: true, hiddenReason: '', footerBar: 'none' },
]

function draw(activeTab: 'olumi' | 'results' = 'olumi') {
  return render(
    <PanelWidthProvider value={{ width: 416, contentWidth: 390 }}>
      <WorkspaceShellTabStrip
        surfaces={surfaces}
        activeTab={activeTab}
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
  it.each([
    ['1', 'olumi', 'Olumi'],
    ['1', 'results', ''],
    ['0', 'olumi', ''],
    ['0', 'results', ''],
  ] as const)('lane flag %s, selected tab %s: Olumi keeps its mark and shows the expected label', (flag, active, label) => {
    vi.stubEnv('VITE_OLUMI_CORE', flag)
    draw(active)
    const tab = screen.getByTestId('outputs-dock-tab-olumi')
    expect(tab.querySelector('[data-testid="outputs-dock-tab-olumi-mark"] svg[data-icon="olumi-ai"]')).not.toBeNull()
    expect(tab.textContent).toBe(label)
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
    if (isOlumiCoreLane()) expect(laneTipOf(tab)).toBe('Olumi')
    else expect(tab).toHaveAttribute('title', 'Olumi')
    expect(tab).toHaveAttribute('data-testid', 'outputs-dock-tab-olumi')
  })

  it('CONTRAST: the Analysis tab keeps its name and draws no Olumi mark', () => {
    draw()
    const tab = screen.getByTestId('outputs-dock-tab-results')
    if (isOlumiCoreLane()) {
      expect(tab.textContent).toBe('')
      expect(tab).toHaveAttribute('aria-label', 'Analysis')
      expect(laneTipOf(tab)).toBe('Analysis')
    } else {
      expect(tab.textContent).toBe('Analysis')
      expect(tab).toHaveAttribute('title', 'Analysis')
    }
    expect(tab.querySelector('[data-icon="olumi-ai"]')).toBeNull()
  })
})

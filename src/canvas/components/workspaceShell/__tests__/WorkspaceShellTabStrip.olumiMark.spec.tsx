/**
 * Vision spec §3 (23 Oct 2026): the Olumi tab is the brand mark alone. "Olumi" stays its accessible name and its
 * tooltip, so a screen reader and a hover still say it; the other tabs keep their words.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

import { WorkspaceShellTabStrip } from '../WorkspaceShellTabStrip'
import { PanelWidthProvider } from '../usePanelWidth'
import type { WorkspaceSurfaceDescriptor } from '../shellContract'

afterEach(cleanup)

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
  it('draws the mark and no visible word', () => {
    draw()
    const tab = screen.getByTestId('outputs-dock-tab-olumi')
    expect(tab.querySelector('[data-testid="outputs-dock-tab-olumi-mark"][data-icon="olumi-ai"]')).not.toBeNull()
    expect(tab.textContent).toBe('')
  })

  it('keeps "Olumi" as its accessible name and its tooltip', () => {
    draw()
    const tab = screen.getByRole('tab', { name: 'Olumi' })
    expect(tab).toHaveAttribute('title', 'Olumi')
    expect(tab).toHaveAttribute('data-testid', 'outputs-dock-tab-olumi')
  })

  it('CONTRAST: the Analysis tab keeps its word and draws no mark', () => {
    draw()
    const tab = screen.getByTestId('outputs-dock-tab-results')
    expect(tab.textContent).toBe('Analysis')
    expect(tab.querySelector('[data-icon="olumi-ai"]')).toBeNull()
  })
})

/**
 * A5 — a never-run model must not be told its (nonexistent) analysis is
 * stale or that its currency "cannot be confirmed". Audit-measured: the
 * Analysis tab glyph read "Cannot confirm whether this analysis is current."
 * for a model that had never been analysed — `results-tab-cannot-confirm-icon`,
 * the `resultsStale === false` arm of the freshness icon below.
 *
 * `hasCompletedFirstRun` is optional, defaulting to `true`, so every existing
 * mount (this file's sibling `tabStripCompactOverflow.spec.tsx` included)
 * keeps today's behaviour exactly.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

import { WorkspaceShellTabStrip } from '../WorkspaceShellTabStrip'
import { PanelWidthProvider } from '../usePanelWidth'
import type { WorkspaceSurfaceDescriptor } from '../shellContract'

afterEach(cleanup)

const surfaces: WorkspaceSurfaceDescriptor[] = [
  { id: 'results', label: 'Analysis', scroll: 'self', padding: 'self', presentedAsTab: true, hiddenReason: '', footerBar: 'none' },
  { id: 'diagnostics', label: 'Model', scroll: 'shell', padding: 'shell', presentedAsTab: true, hiddenReason: '', footerBar: 'reanalyse' },
]

function draw(props: Partial<Parameters<typeof WorkspaceShellTabStrip>[0]> = {}) {
  return render(
    <PanelWidthProvider value={{ width: 416, contentWidth: 390 }}>
      <WorkspaceShellTabStrip
        surfaces={surfaces}
        activeTab="results"
        onTabClick={vi.fn()}
        isOpen={true}
        onToggleOpen={vi.fn()}
        expertMode={false}
        onToggleExpertMode={vi.fn()}
        showResultsFreshnessIcon={true}
        resultsStale={false}
        factorsToVerify={0}
        {...props}
      />
    </PanelWidthProvider>,
  )
}

describe('WorkspaceShellTabStrip — A5 never-run glyph', () => {
  it('POSITIVE CONTROL: the cannot-confirm icon renders today (hasCompletedFirstRun defaults true)', () => {
    draw()
    expect(screen.getByTestId('results-tab-cannot-confirm-icon')).toBeInTheDocument()
  })

  it('POSITIVE CONTROL: the stale icon renders today when resultsStale is true', () => {
    draw({ resultsStale: true })
    expect(screen.getByTestId('results-tab-stale-icon')).toBeInTheDocument()
  })

  it('RED/A5: a never-run model (hasCompletedFirstRun=false) shows NEITHER freshness icon', () => {
    draw({ hasCompletedFirstRun: false })
    expect(screen.queryByTestId('results-tab-cannot-confirm-icon')).toBeNull()
    expect(screen.queryByLabelText('Cannot confirm whether this analysis is current.')).toBeNull()
  })

  it('RED/A5: a never-run model shows no stale icon either, even if the caller still marks it stale', () => {
    draw({ hasCompletedFirstRun: false, resultsStale: true })
    expect(screen.queryByTestId('results-tab-stale-icon')).toBeNull()
    expect(screen.queryByLabelText('Analysis is stale')).toBeNull()
  })
})

/**
 * ONE RERUN CONTROL ON THE REASONING SURFACE (S-F; Paul, 7 Oct 2026: "just have the re-analyse button").
 *
 * Witness (inflight/reasoning-witness-20261007.md, `rw-1/rerun-controls-3tabs.png`): after a model change the
 * Reasoning tab showed THREE rerun controls — the ribbon's "Re-run" (`analysis-new-glance-ribbon-reanalyse`), the
 * shell footer's Re-analyse bar, and "Rerun analysis" in the ⋯ menu. While the footer shows the bar (the owner,
 * `workspaceShell/rerunControl.ts`, says 'bar'), that button is the rerun: the ribbon keeps its sentence and the menu
 * drops its entry. When the bar is not showing, the ribbon owns rerun if it offers one; otherwise the menu entry stays.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'

vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { genuineDecision } from './analysisNewFixtures'
import { useCanvasStore } from '../../../../canvas/store'

afterEach(cleanup)

const RIBBON_RERUN = 'analysis-new-glance-ribbon-reanalyse'
const STRIP = 'analysis-new-method-strip'

/** The store's verdict the footer bar reads: a completed Run that CEE now calls stale (the model changed). */
function modelChangedSinceRun(changed: boolean) {
  useCanvasStore.setState({
    hasCompletedFirstRun: true,
    results: { status: 'complete' } as never,
    analysisFreshness: null,
    analysisFreshnessDirty: false,
    importPendingServerRegistration: false,
  } as never)
  useCanvasStore.getState().setAnalysisFreshness(
    changed
      ? { freshness: 'stale', freshness_reason: 'graph_changed' }
      : { freshness: 'fresh', freshness_reason: 'graph_hash_match' },
  )
}

const draw = (isStale = true, onReanalyse: (() => void) | null = vi.fn()) =>
  render(
    <AnalysisNewTabBody
      resultsSectionData={genuineDecision()}
      isPreRun={false}
      isRunning={false}
      isStale={isStale}
      staleReason="changed"
      responseHash="run_abc123"
      canRunAnalysis
      runBlockedReason={null}
      onReanalyse={onReanalyse ?? undefined}
    />,
  )

function menuActionIds(): string[] {
  fireEvent.click(within(screen.getByTestId(STRIP)).getByTestId(`${STRIP}-more`))
  return within(screen.getByRole('menu'))
    .getAllByRole('menuitem')
    .map((b) => b.getAttribute('data-testid') ?? '')
    .filter((t) => t.startsWith(`${STRIP}-menu-action-`))
    .map((t) => t.slice(`${STRIP}-menu-action-`.length))
}

describe('Reasoning: one rerun control while the footer bar shows', () => {
  beforeEach(() => {
    useCanvasStore.setState({ analysisFreshness: null, analysisFreshnessDirty: false } as never)
  })

  it('⛔ model changed: no ribbon Re-run and no ⋯ "Rerun analysis" — the footer Re-analyse is the one', () => {
    modelChangedSinceRun(true)
    draw()
    // Precondition: the ribbon is on screen (its sentence stays), so "no Re-run" is not an empty ribbon.
    expect(screen.getByTestId('analysis-new-glance-ribbon')).toBeInTheDocument()
    expect(screen.queryByTestId(RIBBON_RERUN), 'a second rerun control: the ribbon').toBeNull()
    expect(menuActionIds(), 'a third rerun control: the ⋯ menu').not.toContain('rerun_analysis')
  })

  it('unchanged model: the ribbon Re-run is the only control and the menu entry yields', () => {
    modelChangedSinceRun(false)
    draw()
    expect(screen.getByTestId(RIBBON_RERUN)).toBeVisible()
    expect(menuActionIds()).not.toContain('rerun_analysis')
    expect(screen.queryAllByTestId(RIBBON_RERUN).length +
      screen.queryAllByTestId(`${STRIP}-menu-action-rerun_analysis`).length).toBe(1)
  })

  it('CONTROL: no footer and no ribbon offers a rerun, so the menu entry stays', () => {
    modelChangedSinceRun(false)
    draw(false)
    expect(screen.queryByTestId(RIBBON_RERUN)).toBeNull()
    expect(menuActionIds()).toContain('rerun_analysis')
    expect(screen.getByRole('menuitem', { name: 'Rerun analysis' })).toBeVisible()
  })

  it('CONTROL: a ribbon without a run handler offers none, so the menu entry stays', () => {
    modelChangedSinceRun(false)
    draw(true, null)
    expect(screen.getByTestId('analysis-new-glance-ribbon')).toBeVisible()
    expect(screen.queryByTestId(RIBBON_RERUN)).toBeNull()
    expect(menuActionIds()).toContain('rerun_analysis')
  })
})

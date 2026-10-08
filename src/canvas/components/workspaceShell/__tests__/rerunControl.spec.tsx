/**
 * `rerunControl.ts` — the one owner of "which control reruns the analysis" (S-F; Paul, 7 Oct 2026).
 *
 * (1) The bar predicate moved out of `ReanalyseBar` VERBATIM: the full truth table over its three inputs, so the move
 *     cannot have widened or narrowed when the bar shows.
 * (2) The shell's choice is exactly one of bar / composer after the first Run, and readiness / none before it.
 * (3) The chip side, on the real `SuggestedChips`: a host whose shell owns rerun drops the run chip after the first
 *     Run; a host that does not (the floating panel) keeps it as its only rerun control; before the first Run the chip
 *     yields to the readiness Analyse only when it is shown. Non-run chips are never touched.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { reanalyseBarShows, shellRerunControl, hostRerunControl, chatRunChipStandsAside, dockSurfaceShowsRerun, readinessBarShowsAnalyse } from '../rerunControl'
import { SuggestedChips } from '../../../conversation/zones/SuggestedChips'
import { useCanvasStore } from '../../../store'
import type { FreshnessDisplaySemantic } from '../../../store/analysisFreshness'
import type { ActionChip } from '../../../conversation/types'

const SEMANTICS: FreshnessDisplaySemantic[] = ['current', 'changed', 'cannot_confirm', 'none', 'never_run']

/** `ReanalyseBar`'s null, as it stood at 79a058e5 (`ReanalyseBar.tsx:190-192`), restated as the oracle. */
function barAt79a058e5(semantic: FreshnessDisplaySemantic, importHold: boolean, hasCompletedFirstRun: boolean): boolean {
  const neverRun = !hasCompletedFirstRun
  const heldUnsure = !neverRun && importHold && semantic === 'cannot_confirm'
  return !(semantic !== 'changed' && !heldUnsure && !neverRun)
}

describe('reanalyseBarShows: the bar predicate, moved verbatim', () => {
  for (const semantic of SEMANTICS) {
    for (const importHold of [false, true]) {
      for (const hasCompletedFirstRun of [false, true]) {
        it(`semantic=${semantic} importHold=${importHold} firstRun=${hasCompletedFirstRun}`, () => {
          expect(reanalyseBarShows({ semantic, importHold, hasCompletedFirstRun })).toBe(
            barAt79a058e5(semantic, importHold, hasCompletedFirstRun),
          )
        })
      }
    }
  }
})

describe('shellRerunControl: exactly one control after the first Run', () => {
  it('model changed → the bar', () => {
    expect(shellRerunControl({ semantic: 'changed', importHold: false, hasCompletedFirstRun: true })).toBe('bar')
  })
  it('current → the composer icon', () => {
    expect(shellRerunControl({ semantic: 'current', importHold: false, hasCompletedFirstRun: true })).toBe('composer')
  })
  it('held import it cannot confirm → the bar ("Can\'t confirm…" carries the button)', () => {
    expect(shellRerunControl({ semantic: 'cannot_confirm', importHold: true, hasCompletedFirstRun: true })).toBe('bar')
  })
  it('cannot confirm WITHOUT a hold → the bar is null, so the composer icon (never zero controls)', () => {
    expect(shellRerunControl({ semantic: 'cannot_confirm', importHold: false, hasCompletedFirstRun: true })).toBe('composer')
  })
  it('no Run yet → none (a run control is not a rerun; no readiness button is offered)', () => {
    expect(shellRerunControl({ semantic: 'changed', importHold: false, hasCompletedFirstRun: false })).toBe('none')
  })
})

describe('hostRerunControl: one control per chat host', () => {
  const changed = { semantic: 'changed' as const, importHold: false, hasCompletedFirstRun: true }
  const current = { semantic: 'current' as const, importHold: false, hasCompletedFirstRun: true }
  const preRun = { semantic: 'changed' as const, importHold: false, hasCompletedFirstRun: false }
  it('docked: the shell decides (bar / composer / none)', () => {
    expect(hostRerunControl('docked', changed)).toBe('bar')
    expect(hostRerunControl('docked', current)).toBe('composer')
    expect(hostRerunControl('docked', preRun)).toBe('none')
  })
  it('floating alone (buddy r1 P1): its own bar while the model changed; nothing when current; never the pill', () => {
    expect(hostRerunControl('floating', changed)).toBe('bar')
    expect(hostRerunControl('floating', current)).toBe('none')
    expect(chatRunChipStandsAside(hostRerunControl('floating', changed))).toBe(true)
  })
  it('floating beside a dock surface that owns rerun: that surface\'s control is the one; the chip stands aside', () => {
    expect(hostRerunControl('floating-beside-dock', changed)).toBe('elsewhere')
    expect(chatRunChipStandsAside(hostRerunControl('floating-beside-dock', current))).toBe(true)
  })
  it('pre-run: dock readiness owns the run, but a floating host without its own Analyse keeps the chip', () => {
    const withModel = { ...preRun, preRunWithModel: true }
    expect(shellRerunControl(withModel)).toBe('readiness')
    expect(chatRunChipStandsAside(hostRerunControl('docked', withModel))).toBe(true)
    expect(chatRunChipStandsAside(hostRerunControl('floating', withModel))).toBe(false)
    expect(chatRunChipStandsAside(hostRerunControl('floating-beside-dock', withModel))).toBe(true)
  })
  it('pre-run CONTROL: no model means no readiness control, so the docked chip stays', () => {
    const noModel = { ...preRun, preRunWithModel: false }
    expect(readinessBarShowsAnalyse(false)).toBe(false)
    expect(readinessBarShowsAnalyse(true)).toBe(true)
    expect(chatRunChipStandsAside(hostRerunControl('docked', noModel))).toBe(false)
    expect(chatRunChipStandsAside(hostRerunControl('floating', noModel))).toBe(false)
  })
  it('pre-run: defer only to the dock surface that actually renders an Analyse button', () => {
    const withModel = { ...preRun, preRunWithModel: true }
    expect(dockSurfaceShowsRerun('olumi', withModel)).toBe(true)
    expect(dockSurfaceShowsRerun('olumi', { ...preRun, preRunWithModel: false })).toBe(false)
    expect(dockSurfaceShowsRerun('analysisNew', withModel)).toBe(false)
    expect(dockSurfaceShowsRerun('diagnostics', withModel)).toBe(true)
    expect(dockSurfaceShowsRerun('compare', withModel)).toBe(false)
  })
  it('a dock surface defers only to the control it is SHOWING (buddy r2 P2)', () => {
    expect(dockSurfaceShowsRerun('diagnostics', changed)).toBe(true)
    expect(dockSurfaceShowsRerun('analysisNew', changed)).toBe(true)
    expect(dockSurfaceShowsRerun('results', changed)).toBe(true)
    expect(dockSurfaceShowsRerun('compare', changed)).toBe(false)
    // Model with a plain cannot-confirm: its bar is null, so the floating chat must not defer to it (never zero).
    const unsure = { semantic: 'cannot_confirm' as const, importHold: false, hasCompletedFirstRun: true }
    expect(dockSurfaceShowsRerun('diagnostics', unsure)).toBe(false)
    expect(chatRunChipStandsAside(hostRerunControl('floating', unsure)), 'the chip stays as the one control').toBe(false)
  })
})

const runChip: ActionChip = { id: 'agent-run-analysis', label: 'Run analysis', intent: 'primary', message: 'Run analysis', action_type: 'run_analysis' }
const premortem: ActionChip = { id: 'agent-next-pre-mortem', label: 'Run a pre-mortem', intent: 'secondary', message: 'Run a pre-mortem' }

function seed(hasCompletedFirstRun: boolean) {
  useCanvasStore.setState({
    hasCompletedFirstRun,
    results: { status: hasCompletedFirstRun ? 'complete' : 'idle' } as any,
    analysisFreshness: null,
    analysisFreshnessDirty: false,
  })
  if (hasCompletedFirstRun) {
    useCanvasStore.getState().setAnalysisFreshness({ freshness: 'stale', freshness_reason: 'graph_changed' })
  }
}

describe('SuggestedChips: the run chip when the host owns the rerun control', () => {
  beforeEach(() => {
    try { localStorage.setItem('feature.aiPanelV2', 'true') } catch {}
    vi.stubEnv('VITE_ENABLE_V5_ORCHESTRATOR', '')
  })
  afterEach(() => {
    try { localStorage.removeItem('feature.aiPanelV2') } catch {}
    vi.unstubAllEnvs()
    useCanvasStore.setState({ results: { status: 'idle' } as any, analysisFreshness: null, analysisFreshnessDirty: false })
  })

  it('host owns rerun, model changed: the run chip is gone, the pre-mortem chip stays', () => {
    seed(true)
    render(<SuggestedChips chips={[premortem, runChip]} onChipClick={vi.fn().mockResolvedValue(undefined)} rerunOwnedByHost />)
    expect(screen.queryByTestId('suggested-chip-agent-run-analysis')).toBeNull()
    expect(screen.getByTestId('suggested-chip-agent-next-pre-mortem')).toBeInTheDocument()
  })

  it('CONTRAST: a host that owns no rerun control (headless) keeps it, as "Rerun"', () => {
    seed(true)
    render(<SuggestedChips chips={[premortem, runChip]} onChipClick={vi.fn().mockResolvedValue(undefined)} />)
    expect(screen.getByTestId('suggested-chip-agent-run-analysis')).toHaveTextContent(/^\s*Rerun\s*$/)
  })

  it('CONTRAST: before the first Run without a model the host owns no run, so CEE\'s "Run analysis" chip stays (a run, not a rerun)', () => {
    seed(false)
    render(<SuggestedChips chips={[premortem, runChip]} onChipClick={vi.fn().mockResolvedValue(undefined)} rerunOwnedByHost={chatRunChipStandsAside(hostRerunControl('docked', { semantic: 'changed', importHold: false, hasCompletedFirstRun: false }))} />)
    expect(screen.getByTestId('suggested-chip-agent-run-analysis')).toHaveTextContent('Run analysis')
  })
})

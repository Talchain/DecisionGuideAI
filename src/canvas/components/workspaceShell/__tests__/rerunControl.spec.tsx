/**
 * `rerunControl.ts` — the one owner of "which control reruns the analysis" (S-F; Paul, 7 Oct 2026).
 *
 * (1) The bar predicate moved out of `ReanalyseBar` VERBATIM: the full truth table over its three inputs, so the move
 *     cannot have widened or narrowed when the bar shows.
 * (2) The shell's choice is exactly one of bar / composer after the first Run, and none before it.
 * (3) The chip side, on the real `SuggestedChips`: a host whose shell owns rerun drops the run chip after the first
 *     Run; a host that does not (the floating panel) keeps it as its only rerun control; before the first Run nothing
 *     changes. Non-run chips are never touched.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { reanalyseBarShows, shellRerunControl, chatRunChipStandsAside } from '../rerunControl'
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
  it('no Run yet → none (a run control is not a rerun; pre-run controls are untouched)', () => {
    expect(shellRerunControl({ semantic: 'changed', importHold: false, hasCompletedFirstRun: false })).toBe('none')
  })
  it('the chip stands aside only on a shell host after the first Run', () => {
    expect(chatRunChipStandsAside(true, true)).toBe(true)
    expect(chatRunChipStandsAside(true, false)).toBe(false)
    expect(chatRunChipStandsAside(false, true)).toBe(false)
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

describe('SuggestedChips: the run chip on a host whose shell owns rerun', () => {
  beforeEach(() => {
    try { localStorage.setItem('feature.aiPanelV2', 'true') } catch {}
    vi.stubEnv('VITE_ENABLE_V5_ORCHESTRATOR', '')
  })
  afterEach(() => {
    try { localStorage.removeItem('feature.aiPanelV2') } catch {}
    vi.unstubAllEnvs()
    useCanvasStore.setState({ results: { status: 'idle' } as any, analysisFreshness: null, analysisFreshnessDirty: false })
  })

  it('shell host, after the first Run, model changed: the run chip is gone, the pre-mortem chip stays', () => {
    seed(true)
    render(<SuggestedChips chips={[premortem, runChip]} onChipClick={vi.fn().mockResolvedValue(undefined)} shellOwnsRerun />)
    expect(screen.queryByTestId('suggested-chip-agent-run-analysis')).toBeNull()
    expect(screen.getByTestId('suggested-chip-agent-next-pre-mortem')).toBeInTheDocument()
  })

  it('CONTRAST: a host without shell controls (floating) keeps it, as "Rerun" — its only rerun control', () => {
    seed(true)
    render(<SuggestedChips chips={[premortem, runChip]} onChipClick={vi.fn().mockResolvedValue(undefined)} />)
    expect(screen.getByTestId('suggested-chip-agent-run-analysis')).toHaveTextContent(/^\s*Rerun\s*$/)
  })

  it('CONTRAST: before the first Run the shell host keeps CEE\'s "Run analysis" chip (a run, not a rerun)', () => {
    seed(false)
    render(<SuggestedChips chips={[premortem, runChip]} onChipClick={vi.fn().mockResolvedValue(undefined)} shellOwnsRerun />)
    expect(screen.getByTestId('suggested-chip-agent-run-analysis')).toHaveTextContent('Run analysis')
  })
})

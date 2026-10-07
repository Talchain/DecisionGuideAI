/**
 * SuggestedChips — the latest reply's chip row does not change while a turn is in flight.
 *
 * SPEC (Paul, 7 Oct 2026): while a turn is pending "the text doesn't move …
 * it shouldn't go blank or do anything weird"; only the thinking animation
 * changes. The chip row sits between the latest reply and the thinking
 * indicator, so a row that vanishes, relabels or grows a reason line mid-turn
 * moves everything below it.
 *
 * The row's filters read store state a turn changes WHILE IT IS IN FLIGHT: a
 * "Run analysis" turn starts and finishes the Run before its reply lands, so
 * the analysis freshness flips from changed to current mid-turn. On base that
 * deleted the "Rerun" chip from under the reader (and relabelled it on the way).
 * While pending, the row now holds what it showed when the turn started
 * (disabled, as before); it re-reads the store once the turn settles.
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { SuggestedChips } from '../zones/SuggestedChips'
import { useCanvasStore } from '../../store'
import type { ActionChip } from '../types'

const runChip: ActionChip = { id: 'run1', label: 'Run analysis', intent: 'primary', message: 'Run analysis', action_type: 'run_analysis' }
const premortem: ActionChip = { id: 'agent-next-pre-mortem', label: 'Run a pre-mortem', intent: 'secondary', message: 'Run a pre-mortem' }

function setStale() {
  useCanvasStore.setState({
    hasCompletedFirstRun: true,
    results: { status: 'complete', graphHash: 'abc123' } as any,
    analysisFreshness: null,
    analysisFreshnessDirty: false,
  })
  useCanvasStore.getState().setAnalysisFreshness({ freshness: 'stale', freshness_reason: 'graph_changed' })
}

function setCurrent() {
  useCanvasStore.getState().setAnalysisFreshness({ freshness: 'fresh', freshness_reason: 'graph_hash_match' })
}

describe('SuggestedChips: the row is frozen while a turn is in flight', () => {
  beforeEach(() => {
    try { localStorage.setItem('feature.aiPanelV2', 'true') } catch {}
    vi.stubEnv('VITE_ENABLE_V5_ORCHESTRATOR', '')
    setStale()
  })
  afterEach(() => {
    try { localStorage.removeItem('feature.aiPanelV2') } catch {}
    vi.unstubAllEnvs()
    useCanvasStore.setState({ results: { status: 'idle' } as any, analysisFreshness: null, analysisFreshnessDirty: false })
  })

  it('pending: the run finishing mid-turn does not delete or relabel a chip under the reader', () => {
    const onChipClick = vi.fn().mockResolvedValue(undefined)
    const { rerender } = render(<SuggestedChips chips={[premortem, runChip]} onChipClick={onChipClick} />)
    const rerun = screen.getByTestId('suggested-chip-run1')
    expect(rerun, 'precondition: a stale analysis offers the run chip as "Rerun"').toHaveTextContent(/^\s*Rerun\s*$/)

    // The turn goes pending: the row is the same buttons, disabled.
    rerender(<SuggestedChips chips={[premortem, runChip]} onChipClick={onChipClick} isThinking />)
    expect(screen.getByTestId('suggested-chip-run1')).toBe(rerun)
    expect(rerun).toBeDisabled()

    // Mid-turn the Run completes and the analysis is current again.
    act(() => setCurrent())
    expect(screen.queryByTestId('suggested-chip-run1'), 'the chip vanished from under the reader mid-turn').toBe(rerun)
    expect(rerun).toHaveTextContent(/^\s*Rerun\s*$/)
    expect(screen.getByTestId('suggested-chip-agent-next-pre-mortem')).toBeInTheDocument()
  })

  it('control: once the turn settles the row re-reads the store (a current analysis drops the run chip, as before)', () => {
    const onChipClick = vi.fn().mockResolvedValue(undefined)
    const { rerender } = render(<SuggestedChips chips={[premortem, runChip]} onChipClick={onChipClick} isThinking />)
    act(() => setCurrent())
    rerender(<SuggestedChips chips={[premortem, runChip]} onChipClick={onChipClick} isThinking={false} />)
    expect(screen.queryByTestId('suggested-chip-run1')).toBeNull()
    expect(screen.getByTestId('suggested-chip-agent-next-pre-mortem')).not.toBeDisabled()
  })

  it('control: a row first mounted while pending shows the live view (nothing earlier to hold)', () => {
    render(<SuggestedChips chips={[premortem, runChip]} onChipClick={vi.fn().mockResolvedValue(undefined)} isThinking />)
    expect(screen.getByTestId('suggested-chip-run1')).toHaveTextContent(/^\s*Rerun\s*$/)
    expect(screen.getByTestId('suggested-chip-run1')).toBeDisabled()
  })
})

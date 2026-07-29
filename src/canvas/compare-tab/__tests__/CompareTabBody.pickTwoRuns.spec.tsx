/**
 * ROADMAP 2.113a slice 2 — a signed-in user with 2+ PERSISTED runs picks any
 * two and sees them side by side.
 *
 * The whole chain is exercised on the live-shaped path: persisted
 * `run_analysis` facts → slice-1 hydration → snapshots → picker → side-by-side
 * table. Nothing here builds an `AnalysisSnapshot` by hand, because the point
 * is that the PERSISTED envelope carries what the pair view renders.
 *
 * CONTROL IN BOTH DIRECTIONS (CLAUDE.md trap 13). The owner cases assert
 * positive CONTENT — real probabilities in the right cells, a named leader from
 * the producer's own verdict — before any absence case asserts a degradation.
 * Without that half, a mock wired to the wrong module would render nothing and
 * every "shows the degradation" test would pass by testing nothing.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup, fireEvent, within } from '@testing-library/react'
import { makePersistedRunFactRow } from './__fixtures__/persistedRunFact'

// --- seams ----------------------------------------------------------------

const listPersistedAnalysisRuns = vi.fn()
const getSessionIdentity = vi.fn()

vi.mock('../../../services/analysisRunHistoryService', () => ({
  listPersistedAnalysisRuns: (...args: unknown[]) => listPersistedAnalysisRuns(...args),
  MAX_PERSISTED_RUNS: 20,
}))

vi.mock('../../../lib/supabase', () => ({
  getSessionIdentity: () => getSessionIdentity(),
  supabase: {},
}))


let mockCanvasState: any
vi.mock('../../store', () => ({
  useCanvasStore: Object.assign(
     
    (selector: (s: any) => unknown) => selector(mockCanvasState),
    { getState: () => mockCanvasState },
  ),
}))

vi.mock('../../../stores/uiStore', () => ({
  useUIStore: Object.assign(
     
    (selector: (s: any) => unknown) => selector({ activeOutputTab: 'compare' }),
    { getState: () => ({ setActiveOutputTab: vi.fn() }) },
  ),
}))

vi.mock('../../hooks/useAnalysisTrust', () => ({
  useAnalysisTrust: () => ({ semantic: 'fresh', isRunning: false, runStartedAt: null }),
}))

// Only the surfaces under test are real: RunSelector (the picker) and
// RunPairCompare (the side-by-side table). Everything else is stubbed the same
// way the slice-1 spec stubs it.
vi.mock('../Hero', () => ({ Hero: () => null }))
vi.mock('../TrajectorySection', () => ({ TrajectorySection: () => null }))
vi.mock('../CompareFooter', () => ({ CompareFooter: () => null }))
vi.mock('../TabHeader', () => ({ TabHeader: () => null }))
vi.mock('../TransitionsSection', () => ({
  TransitionsSection: ({ transitions }: { transitions: Array<{ fromRunNumber: number; toRunNumber: number; winnerProbDelta: number; edits: string[] }> }) => (
    <div data-testid="transitions-stub">
      {transitions.map(t => (
        <span key={`${t.fromRunNumber}-${t.toRunNumber}`} data-testid="transition-pair">
          {t.fromRunNumber}→{t.toRunNumber}:{t.winnerProbDelta}:{t.edits.length}
        </span>
      ))}
    </div>
  ),
}))

import { CompareTabBody } from '../CompareTabBody'
import { useAnalysisSnapshotStore } from '../../stores/analysisSnapshotStore'

const run = (
  n: number,
  hour: string,
  winProb: number,
  extra: Parameters<typeof makePersistedRunFactRow>[0] = {},
) =>
  makePersistedRunFactRow({
    id: `fact-${n}`,
    createdAt: `2026-07-2${n}T${hour}:00:00.000Z`,
    responseHash: `resp-${n}`,
    graphHashAtRun: `aag-${n}`,
    winner: { option_id: 'opt-a', option_label: 'Option A', win_probability: winProb },
    runnerUp: { option_id: 'opt-b', option_label: 'Option B', win_probability: 1 - winProb },
    ...extra,
  })

async function renderWithRuns(rows: unknown[]) {
  listPersistedAnalysisRuns.mockResolvedValue(rows)
  render(<CompareTabBody onRunAnalysis={vi.fn()} />)
  await waitFor(() => {
    expect(useAnalysisSnapshotStore.getState().snapshots.length).toBe(rows.length)
  })
}

const openPicker = () => fireEvent.click(screen.getByText('Pick two runs'))

beforeEach(() => {
  mockCanvasState = {
    currentScenarioId: 'scenario-owned-1',
    currentScenarioLastResultHash: 'resp-3',
    selection: { nodeIds: new Set<string>() },
    _hydratedEvents: [],
  }
  useAnalysisSnapshotStore.getState().clearSnapshots()
  listPersistedAnalysisRuns.mockReset()
  getSessionIdentity.mockReset()
  getSessionIdentity.mockResolvedValue({ userId: 'user-1', accessToken: 'tok' })
})

afterEach(() => cleanup())

describe('pick-two-runs side-by-side (2.113a slice 2)', () => {
  it('the picker appears once there are 2+ persisted runs, and defaults to first vs latest', async () => {
    await renderWithRuns([run(1, '10', 0.5), run(2, '11', 0.62), run(3, '12', 0.74)])

    // Not shown until the user asks for it — the other presets are unchanged.
    expect(screen.queryByTestId('run-pair-picker')).toBeNull()
    openPicker()

    expect(screen.getByTestId('run-pair-picker')).toBeTruthy()
    expect((screen.getByTestId('run-pick-from') as HTMLSelectElement).value).toBe('1')
    expect((screen.getByTestId('run-pick-to') as HTMLSelectElement).value).toBe('3')
    expect(screen.getByTestId('run-pair-from-heading').textContent).toContain('Run 1')
    expect(screen.getByTestId('run-pair-to-heading').textContent).toContain('Run 3')
  })

  it('POSITIVE CONTROL: the table shows each option’s win probability on both sides and a real delta', async () => {
    await renderWithRuns([run(1, '10', 0.5), run(2, '11', 0.62), run(3, '12', 0.74)])
    openPicker()

    const rowA = within(screen.getByTestId('option-row-opt-a'))
    expect(rowA.getByText('50%')).toBeTruthy()   // run 1
    expect(rowA.getByText('74%')).toBeTruthy()   // run 3
    expect(rowA.getByText('+24pp')).toBeTruthy()

    const rowB = within(screen.getByTestId('option-row-opt-b'))
    expect(rowB.getByText('50%')).toBeTruthy()
    expect(rowB.getByText('26%')).toBeTruthy()
    expect(rowB.getByText('-24pp')).toBeTruthy()
  })

  it('picking a different pair re-derives the whole comparison', async () => {
    await renderWithRuns([run(1, '10', 0.5), run(2, '11', 0.62), run(3, '12', 0.74)])
    openPicker()

    fireEvent.change(screen.getByTestId('run-pick-to'), { target: { value: '2' } })

    expect(screen.getByTestId('run-pair-to-heading').textContent).toContain('Run 2')
    const rowA = within(screen.getByTestId('option-row-opt-a'))
    expect(rowA.getByText('62%')).toBeTruthy()
    expect(rowA.getByText('+12pp')).toBeTruthy()
  })

  it('picking the run already at the other end SWAPS instead of comparing a run with itself', async () => {
    await renderWithRuns([run(1, '10', 0.5), run(2, '11', 0.62), run(3, '12', 0.74)])
    openPicker()

    fireEvent.change(screen.getByTestId('run-pick-from'), { target: { value: '3' } })

    const from = (screen.getByTestId('run-pick-from') as HTMLSelectElement).value
    const to = (screen.getByTestId('run-pick-to') as HTMLSelectElement).value
    expect(from).not.toBe(to)
    // Still a real comparison, not a wall of +0pp.
    expect(screen.getByTestId('run-pair-compare')).toBeTruthy()
  })

  it('the pair’s own transition card is the EXISTING machinery, fed the picked pair', async () => {
    await renderWithRuns([run(1, '10', 0.5), run(2, '11', 0.62), run(3, '12', 0.74)])
    openPicker()

    const pairs = screen.getAllByTestId('transition-pair')
    expect(pairs).toHaveLength(1)
    expect(pairs[0].textContent).toContain('1→3')
  })

  // ── Honest degradation ─────────────────────────────────────────────────
  it('the LEADER row quotes each run’s own producer verdict — and stays silent when there is none', async () => {
    await renderWithRuns([
      run(1, '10', 0.5, { nearTie: { is_tie: false, top_option_id: 'opt-a' } }),
      // Second run: the producer sent NO usable near-tie signal.
      run(2, '11', 0.62, { nearTieOverride: null }),
    ])
    openPicker()

    const leaderRow = within(screen.getByTestId('leader-row'))
    expect(leaderRow.getByText('Option A')).toBeTruthy()      // run 1, entitled
    expect(leaderRow.getByText('Not assessed')).toBeTruthy()  // run 2, silent
    expect(leaderRow.getByText('Not comparable')).toBeTruthy()
  })

  it('two runs whose producer named the same leader report it UNCHANGED', async () => {
    await renderWithRuns([
      run(1, '10', 0.5, { nearTie: { is_tie: false, top_option_id: 'opt-a' } }),
      run(2, '11', 0.62, { nearTie: { is_tie: false, top_option_id: 'opt-a' } }),
    ])
    openPicker()
    expect(within(screen.getByTestId('leader-row')).getByText('Leader unchanged')).toBeTruthy()
  })

  it('MODEL STRUCTURE compares two persisted aag hashes, and says so honestly when they match', async () => {
    await renderWithRuns([
      run(1, '10', 0.5, { graphHashAtRun: 'aag-same' }),
      run(2, '11', 0.62, { graphHashAtRun: 'aag-same' }),
    ])
    openPicker()
    expect(within(screen.getByTestId('structure-row')).getByText('Unchanged')).toBeTruthy()
    expect(screen.getByTestId('structure-detail').textContent)
      .toContain('Both runs were computed over the same model')
  })

  it('a run with NO persisted graph hash makes the structure row NOT COMPARABLE', async () => {
    await renderWithRuns([
      run(1, '10', 0.5, { graphHashAtRun: null }),
      run(2, '11', 0.62, { graphHashAtRun: 'aag-2' }),
    ])
    openPicker()
    expect(within(screen.getByTestId('structure-row')).getByText('Not comparable')).toBeTruthy()
    expect(screen.getByTestId('structure-detail').textContent).toContain('incomparable identifiers')
  })

  it('goal probability and evidence coverage render "Not assessed" on a persisted pair', async () => {
    await renderWithRuns([run(1, '10', 0.5), run(2, '11', 0.62)])
    openPicker()

    expect(within(screen.getByTestId('goal-row')).getAllByText('Not assessed')).toHaveLength(2)
    expect(within(screen.getByTestId('coverage-row')).getAllByText('Not assessed')).toHaveLength(2)
  })

  it('an option only ONE run scored renders "Only in run N" — never a delta', async () => {
    await renderWithRuns([
      run(1, '10', 0.5),
      run(2, '11', 0.62, {
        optionComparison: [
          { option_id: 'opt-a', option_label: 'Option A', win_probability: 0.5 },
          { option_id: 'opt-b', option_label: 'Option B', win_probability: 0.3 },
          { option_id: 'opt-c', option_label: 'Option C', win_probability: 0.2 },
        ],
      }),
    ])
    openPicker()

    const rowC = within(screen.getByTestId('option-row-opt-c'))
    expect(rowC.getByText('20%')).toBeTruthy()
    expect(rowC.getByText('Only in run 2')).toBeTruthy()
    expect(rowC.queryByText('+20pp')).toBeNull()
  })

  it('the factor section compares RANK and never renders a raw elasticity value', async () => {
    await renderWithRuns([run(1, '10', 0.5), run(2, '11', 0.62)])
    openPicker()

    // The default fixture's factors are elasticity 0.42 and 0.18, same order in
    // both runs. Neither number may appear; the ordering must.
    const row = within(screen.getByTestId('factor-row-factor-1'))
    // Top factor in BOTH runs, so "1st" appears in each run column.
    expect(row.getAllByText('1st')).toHaveLength(2)
    expect(row.getByText('Same position')).toBeTruthy()
    expect(screen.getByTestId('run-pair-compare').textContent).not.toContain('0.42')
    expect(screen.getByTestId('run-pair-compare').textContent).not.toContain('0.18')
  })

  // ADVERSARIAL REVIEW OF #526, FINDING 1 — reproduced at the render, which is
  // where the reviewer saw it: "Option X | 55% | 0% | -55pp".
  it('an option the LATER run carries WITHOUT a win probability is membership, not a 0% and a -55pp fall', async () => {
    await renderWithRuns([
      run(1, '10', 0.45, {
        optionComparison: [
          { option_id: 'opt-a', option_label: 'Option A', win_probability: 0.45 },
          { option_id: 'opt-x', option_label: 'Option X', win_probability: 0.55 },
        ],
      }),
      run(2, '11', 0.62, {
        optionComparison: [
          { option_id: 'opt-a', option_label: 'Option A', win_probability: 0.62 },
          // Same option, producer sent no probability for it this time.
          { option_id: 'opt-x', option_label: 'Option X' },
        ],
      }),
    ])
    openPicker()

    const rowX = within(screen.getByTestId('option-row-opt-x'))
    expect(rowX.getByText('55%')).toBeTruthy()          // run 1's real measurement
    expect(rowX.getByText('Only in run 1')).toBeTruthy() // run 2: absence, stated
    expect(rowX.queryByText('0%')).toBeNull()            // the fabricated baseline
    expect(rowX.queryByText('-55pp')).toBeNull()         // the delta measured against it
  })

  it('GUEST UNCHANGED: no session ⇒ no read, no picker, no side-by-side, no error', async () => {
    getSessionIdentity.mockResolvedValue({ userId: null, accessToken: null })

    render(<CompareTabBody onRunAnalysis={vi.fn()} />)
    await waitFor(() => expect(getSessionIdentity).toHaveBeenCalled())

    expect(listPersistedAnalysisRuns).not.toHaveBeenCalled()
    expect(screen.queryByText('Pick two runs')).toBeNull()
    expect(screen.queryByTestId('run-pair-picker')).toBeNull()
    expect(screen.queryByTestId('run-pair-compare')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('the other presets are untouched — "Pick two runs" is additive', async () => {
    await renderWithRuns([run(1, '10', 0.5), run(2, '11', 0.62), run(3, '12', 0.74)])

    expect(screen.getByText('Latest vs previous')).toBeTruthy()
    expect(screen.getByText('Latest vs first')).toBeTruthy()
    expect(screen.getByText('All runs')).toBeTruthy()
    // Default preset still renders the latest pairwise transition, not a pair view.
    expect(screen.queryByTestId('run-pair-compare')).toBeNull()
    expect(screen.getAllByTestId('transition-pair')[0].textContent).toContain('2→3')
  })
})

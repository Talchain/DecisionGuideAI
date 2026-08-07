/**
 * ROADMAP 2.113a slice 1 — the Compare tab populates from PERSISTED analysis
 * runs, and survives a reload.
 *
 * WHY THIS SPEC EXISTS (the defect it pins).
 * ------------------------------------------------------------------
 * The Compare tab's only data source was `analysisSnapshotStore`, seeded
 * exclusively by the capture gate at `canvas/store.ts` `resultsComplete`:
 *
 *     if (isCompareTabEnabled() && rawV2Response && report) { … }
 *
 * The DEPLOYED analyse path is the CEE turn, and its results-hydration
 * applicator calls that same setter with `rawV2Response: null` — explicitly,
 * with the comment "V5 carries no V2 envelope" (`v5/applyV5State.ts:1023`).
 * So on the live wire the gate NEVER opened: the tab showed its empty state
 * even within one session. This is not "compare loses its history on reload"
 * — it is "compare never had a history to lose".
 *
 * RLS CONTROL, BOTH DIRECTIONS (CLAUDE.md trap 13 — an absence assertion must
 * first prove it can see a presence). The owner case asserts positive CONTENT
 * (the journey renders, with the winner's label and a run count), never
 * merely "no error"; the guest and empty-owner cases then assert the empty
 * state. Without the positive half, a mock wired to the wrong module would
 * make every case render the empty state and all of them would "pass".
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { StrictMode } from 'react'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockCanvasState: any
vi.mock('../../store', () => ({
  useCanvasStore: Object.assign(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (selector: (s: any) => unknown) => selector(mockCanvasState),
    { getState: () => mockCanvasState },
  ),
}))

vi.mock('../../../stores/uiStore', () => ({
  useUIStore: Object.assign(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (selector: (s: any) => unknown) => selector({ activeOutputTab: 'compare' }),
    { getState: () => ({ setActiveOutputTab: vi.fn() }) },
  ),
}))

vi.mock('../../hooks/useAnalysisTrust', () => ({
  useAnalysisTrust: () => ({ semantic: 'fresh', isRunning: false, runStartedAt: null }),
}))

// Heavy children stubbed the same way CompareTabBody.freshness.spec does —
// except Hero, which echoes the content we assert on, and EmptyState /
// RunSelector, which ARE the surfaces under test.
vi.mock('../Hero', () => ({
  Hero: ({ snapshots }: { snapshots: Array<{ winnerLabel: string }> }) => (
    <div data-testid="compare-hero">
      {snapshots.length} runs · {snapshots[snapshots.length - 1]?.winnerLabel}
    </div>
  ),
}))
vi.mock('../TrajectorySection', () => ({ TrajectorySection: () => null }))
vi.mock('../TransitionsSection', () => ({ TransitionsSection: () => null }))
vi.mock('../CompareFooter', () => ({ CompareFooter: () => null }))
vi.mock('../TabHeader', () => ({ TabHeader: () => null }))

import { CompareTabBody } from '../CompareTabBody'
import { useAnalysisSnapshotStore } from '../../stores/analysisSnapshotStore'

const emptyState = () => screen.queryByTestId('compare-empty-state')

beforeEach(() => {
  mockCanvasState = {
    currentScenarioId: 'scenario-owned-1',
    currentScenarioLastResultHash: 'resp-hash-2',
    selection: { nodeIds: new Set<string>() },
    _hydratedEvents: [],
  }
  useAnalysisSnapshotStore.getState().clearSnapshots()
  listPersistedAnalysisRuns.mockReset()
  getSessionIdentity.mockReset()
  getSessionIdentity.mockResolvedValue({ userId: 'user-1', accessToken: 'tok' })
})

afterEach(() => cleanup())

describe('Compare tab hydrates from persisted analysis runs (2.113a slice 1)', () => {
  it('renders the Refinement Journey from persisted run_analysis facts — the live V5 path captured nothing', async () => {
    listPersistedAnalysisRuns.mockResolvedValue([
      makePersistedRunFactRow({
        id: 'fact-1',
        createdAt: '2026-07-20T10:00:00.000Z',
        responseHash: 'resp-hash-1',
        graphHashAtRun: 'aag-1',
        winner: { option_id: 'opt-a', option_label: 'Option A', win_probability: 0.62 },
        runnerUp: { option_id: 'opt-b', option_label: 'Option B', win_probability: 0.38 },
      }),
      makePersistedRunFactRow({
        id: 'fact-2',
        createdAt: '2026-07-20T11:00:00.000Z',
        responseHash: 'resp-hash-2',
        graphHashAtRun: 'aag-2',
        winner: { option_id: 'opt-a', option_label: 'Option A', win_probability: 0.74 },
        runnerUp: { option_id: 'opt-b', option_label: 'Option B', win_probability: 0.26 },
      }),
    ])

    render(<CompareTabBody onRunAnalysis={vi.fn()} expertMode={false} onToggleExpert={vi.fn()} />)

    // POSITIVE CONTROL: real content, from rows, not "no error".
    expect(await screen.findByTestId('compare-hero')).toBeTruthy()
    expect(screen.getByTestId('compare-hero').textContent).toContain('2 runs')
    expect(screen.getByTestId('compare-hero').textContent).toContain('Option A')
    // The run selector only renders past the 2-snapshot gate.
    expect(screen.getByText('Latest vs previous')).toBeTruthy()
    expect(emptyState()).toBeNull()

    expect(listPersistedAnalysisRuns).toHaveBeenCalledWith('scenario-owned-1', 20)
    const stored = useAnalysisSnapshotStore.getState().snapshots
    expect(stored).toHaveLength(2)
    expect(stored.map(s => s.source)).toEqual(['persisted', 'persisted'])
    // Durable identity: the fact row id, so a re-hydration is idempotent.
    expect(stored.map(s => s.runId)).toEqual(['fact-1', 'fact-2'])
  })

  it('survives reload: a fresh mount over an EMPTY session store still renders the journey', async () => {
    // A reload is exactly this — zero session snapshots, same scenario id.
    expect(useAnalysisSnapshotStore.getState().snapshots).toHaveLength(0)

    listPersistedAnalysisRuns.mockResolvedValue([
      makePersistedRunFactRow({ id: 'f1', createdAt: '2026-07-20T10:00:00.000Z', responseHash: 'h1' }),
      makePersistedRunFactRow({ id: 'f2', createdAt: '2026-07-20T11:00:00.000Z', responseHash: 'h2' }),
      makePersistedRunFactRow({ id: 'f3', createdAt: '2026-07-20T12:00:00.000Z', responseHash: 'h3' }),
    ])

    render(<CompareTabBody onRunAnalysis={vi.fn()} expertMode={false} onToggleExpert={vi.fn()} />)

    await waitFor(() => {
      expect(useAnalysisSnapshotStore.getState().snapshots).toHaveLength(3)
    })
    expect(emptyState()).toBeNull()
    expect(useAnalysisSnapshotStore.getState().snapshots.map(s => s.runNumber)).toEqual([1, 2, 3])
    expect(screen.getByTestId('compare-hero').textContent).toContain('3 runs')
  })

  it('GUEST UNCHANGED: no signed-in session ⇒ no read attempted, existing empty state, never an error', async () => {
    getSessionIdentity.mockResolvedValue({ userId: null, accessToken: null })

    render(<CompareTabBody onRunAnalysis={vi.fn()} expertMode={false} onToggleExpert={vi.fn()} />)

    await waitFor(() => expect(getSessionIdentity).toHaveBeenCalled())
    expect(listPersistedAnalysisRuns).not.toHaveBeenCalled()
    expect(emptyState()).toBeTruthy()
    expect(useAnalysisSnapshotStore.getState().snapshots).toHaveLength(0)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('an owner whose scenario has no persisted runs sees the SAME empty state', async () => {
    listPersistedAnalysisRuns.mockResolvedValue([])

    render(<CompareTabBody onRunAnalysis={vi.fn()} expertMode={false} onToggleExpert={vi.fn()} />)

    await waitFor(() => expect(listPersistedAnalysisRuns).toHaveBeenCalled())
    expect(emptyState()).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('a failing read (e.g. a revoked grant) degrades to the empty state, never to an error surface', async () => {
    listPersistedAnalysisRuns.mockRejectedValue(
      new Error('permission denied for table v5_handler_facts'),
    )

    render(<CompareTabBody onRunAnalysis={vi.fn()} expertMode={false} onToggleExpert={vi.fn()} />)

    await waitFor(() => expect(listPersistedAnalysisRuns).toHaveBeenCalled())
    expect(emptyState()).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('MOUNT/UNMOUNT/REMOUNT WITHOUT A DEP CHANGE STILL HYDRATES (StrictMode double-invoke)', async () => {
    // The trap this pins: a dedupe key marked when the read STARTS. React can
    // mount, tear down and re-mount an effect with unchanged deps — exactly
    // what StrictMode does in development. The first pass would claim the key,
    // its cleanup would cancel the in-flight read, and the second pass would
    // see the key claimed and do nothing: a tab permanently empty, with no
    // error anywhere. Marking the key on COMPLETION cannot produce that.
    // (StrictMode is not enabled in src/main.tsx today; this keeps enabling it
    // from silently switching the feature off.)
    listPersistedAnalysisRuns.mockResolvedValue([
      makePersistedRunFactRow({ id: 'f1', createdAt: '2026-07-20T10:00:00.000Z', responseHash: 'h1' }),
      makePersistedRunFactRow({ id: 'f2', createdAt: '2026-07-20T11:00:00.000Z', responseHash: 'h2' }),
    ])

    render(
      <StrictMode>
        <CompareTabBody onRunAnalysis={vi.fn()} expertMode={false} onToggleExpert={vi.fn()} />
      </StrictMode>,
    )

    await waitFor(() => {
      expect(useAnalysisSnapshotStore.getState().snapshots).toHaveLength(2)
    })
    expect(emptyState()).toBeNull()
  })

  it('a guest scenario id of null makes no read at all', async () => {
    mockCanvasState.currentScenarioId = null

    render(<CompareTabBody onRunAnalysis={vi.fn()} expertMode={false} onToggleExpert={vi.fn()} />)

    await waitFor(() => expect(emptyState()).toBeTruthy())
    expect(getSessionIdentity).not.toHaveBeenCalled()
    expect(listPersistedAnalysisRuns).not.toHaveBeenCalled()
  })
})

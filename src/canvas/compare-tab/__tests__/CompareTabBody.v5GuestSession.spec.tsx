/**
 * ROADMAP 2.350 — a GUEST who runs the analysis twice in one session sees two
 * versions side by side (PC1 step 6, its last gap).
 *
 * ⚠ HOW THIS DIFFERS FROM `CompareTabBody.pickTwoRuns.spec.tsx`, WHICH IS
 * ALREADY GREEN AND PROVES NOTHING ABOUT THIS.
 * That spec mocks `../../store` wholesale and seeds the journey through
 * `hydrateFromPersisted` from persisted-fact fixtures — i.e. it exercises
 * FEED B, the signed-in path, and it hands the store its runs. This spec uses
 * the REAL canvas store, drives the REAL `applyV5State` applicator from real
 * captured wire bytes, and keeps FEED B EXPLICITLY CLOSED by holding
 * `getSessionIdentity()` at the guest answer (`userId: null`) — the same
 * answer staging gives every session (`VITE_AUTH_MODE=guest`). If the pickers
 * render here, they render for a guest, from the session alone.
 *
 * ⚠⚠ jsdom PROVES PRESENCE, NEVER LAYOUT (CLAUDE.md trap 3). "The pickers are
 * in the DOM" is the whole claim; that they are visible, above the fold, or
 * reachable on a real screen is NOT proven here and rides the next walk.
 *
 * THE RED SIGNATURE IS THE WALK'S OWN. `journey-witness-2026-08-04b-raw/p3b/
 * P3b-compare-before.json` captured, for a guest with two completed runs:
 *     runPickerCount: 0, runAgainCopy: 1,
 *     compareTestids: [… "compare-tab-body", "compare-empty-state"]
 * Both halves are pinned below — the pickers appearing AND the empty state
 * (whose copy tells the user to run an analysis they have already run twice —
 * N6's untruth, PC2) no longer rendering.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react'
import { useCanvasStore } from '../../store'
import { useAnalysisSnapshotStore } from '../../stores/analysisSnapshotStore'
import { applyV5State } from '../../../v5/applyV5State'
import { CompareTabBody } from '../CompareTabBody'
import blocksFixture from './__fixtures__/v5GuestWalkAnalysisBlocks.json'

// ── The ONLY seam mocked: session identity, held at the GUEST answer. ──────
// This is not a convenience stub — it is the condition under test. Feed B
// (persisted hydration) returns before any read when `userId` is null, so
// every snapshot the tab renders below must have come from the session
// capture. `listPersistedAnalysisRuns` is mocked to THROW so that a
// regression which loosened the guest skip would fail loudly here rather than
// quietly supplying the runs this spec credits to Feed A.
const getSessionIdentity = vi.fn(async () => ({ userId: null }))
const listPersistedAnalysisRuns = vi.fn(async () => {
  throw new Error('Feed B must not be reached at guest tier')
})

vi.mock('../../../lib/supabase', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getSessionIdentity: () => getSessionIdentity(),
}))

vi.mock('../../../services/analysisRunHistoryService', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  listPersistedAnalysisRuns: () => listPersistedAnalysisRuns(),
}))

type AnalysisBlock = Record<string, unknown> & { type: 'analysis_result' }
const runA = blocksFixture.runA as unknown as AnalysisBlock
const runB = blocksFixture.runB as unknown as AnalysisBlock

/** The production wiring, verbatim (useConversation.ts:4532-4537). */
function applyTurn(block: AnalysisBlock) {
  const snapshot = useCanvasStore.getState()
  return applyV5State({ blocks: [block] } as never, {
    ...snapshot,
    currentResultsHash: snapshot.results?.hash ?? null,
  } as never)
}

const EMPTY_STATE_COPY = 'Refine your model and run the analysis again'

describe('ROADMAP 2.350 — guest, two runs in one session, Compare tab', () => {
  beforeEach(() => {
    localStorage.setItem('feature.compareTab', '1')
    useAnalysisSnapshotStore.getState().clearSnapshots()
    useCanvasStore.getState().resultsReset()
  })

  afterEach(() => {
    cleanup()
    localStorage.clear()
    useAnalysisSnapshotStore.getState().clearSnapshots()
    vi.clearAllMocks()
  })

  // ── Negative control FIRST (trap 13) ──────────────────────────────────
  // With ONE run the tab must still show the empty state. Without this, a
  // change that rendered the pickers unconditionally would satisfy every
  // assertion below while breaking the <2-runs branch, and the "empty state is
  // gone" assertions would be passing for the wrong reason.
  it('CONTROL: with ONE run the guest still sees the empty state and no pickers', () => {
    applyTurn(runA)
    render(<CompareTabBody onRunAnalysis={() => {}} expertMode={false} onToggleExpert={() => {}} />)

    expect(screen.getByTestId('compare-empty-state')).toBeTruthy()
    expect(screen.getByText(EMPTY_STATE_COPY)).toBeTruthy()
    expect(screen.queryByTestId('run-pick-from')).toBeNull()
    expect(screen.queryByTestId('run-pick-to')).toBeNull()
  })

  // ── Spec 2 (diagnosis §5 RED-first #2) ────────────────────────────────
  it('renders BOTH run pickers after two runs, with Feed B never read', () => {
    applyTurn(runA)
    applyTurn(runB)

    render(<CompareTabBody onRunAnalysis={() => {}} expertMode={false} onToggleExpert={() => {}} />)

    // The `Pick two runs` preset is what mounts the pair picker
    // (RunSelector.tsx:73); the tab opens on `prev`.
    fireEvent.click(screen.getByText('Pick two runs'))

    expect(screen.getByTestId('run-pair-picker')).toBeTruthy()
    expect(screen.getByTestId('run-pick-from')).toBeTruthy()
    expect(screen.getByTestId('run-pick-to')).toBeTruthy()

    // The guest skip held: no persisted read was attempted.
    expect(listPersistedAnalysisRuns).not.toHaveBeenCalled()
  })

  // Identity-bound, not count-bound (trap 19). Two <select>s each holding two
  // <option>s is satisfiable by a picker listing the same run twice, or by
  // options belonging to runs that were never captured. Assert the OPTION SET
  // matches the runs actually in the store, by their run numbers.
  it('the pickers list the two runs that were actually captured', () => {
    applyTurn(runA)
    applyTurn(runB)

    render(<CompareTabBody onRunAnalysis={() => {}} expertMode={false} onToggleExpert={() => {}} />)
    fireEvent.click(screen.getByText('Pick two runs'))

    const captured = useAnalysisSnapshotStore.getState().snapshots
    expect(captured).toHaveLength(2)
    const expectedValues = captured.map(s => String(s.runNumber))
    expect(expectedValues).toEqual(['1', '2'])

    for (const testid of ['run-pick-from', 'run-pick-to']) {
      const select = screen.getByTestId(testid) as HTMLSelectElement
      const options = within(select).getAllByRole('option') as HTMLOptionElement[]
      expect(options.map(o => o.value)).toEqual(expectedValues)
      // Distinct runs, not the same run twice.
      expect(new Set(options.map(o => o.value)).size).toBe(2)
    }

    // The picker resolves to a forward-ordered pair of DISTINCT runs, which is
    // what makes the side-by-side comparison meaningful rather than a run
    // compared with itself.
    const from = screen.getByTestId('run-pick-from') as HTMLSelectElement
    const to = screen.getByTestId('run-pick-to') as HTMLSelectElement
    expect(from.value).not.toBe(to.value)
    expect(Number(from.value)).toBeLessThan(Number(to.value))
  })

  // ── N6 kill pin (PC2) ─────────────────────────────────────────────────
  // The empty state's copy instructs the user to "run the analysis again" —
  // an instruction they have already followed twice by this point. It must not
  // be on the screen. This is asserted on the COPY, not only the testid,
  // because the untruth is the sentence.
  it('N6: the "run the analysis again" copy no longer renders at two runs', () => {
    applyTurn(runA)
    applyTurn(runB)

    render(<CompareTabBody onRunAnalysis={() => {}} expertMode={false} onToggleExpert={() => {}} />)

    expect(screen.queryByTestId('compare-empty-state')).toBeNull()
    expect(screen.queryByText(EMPTY_STATE_COPY)).toBeNull()
    // The tab itself is still mounted — the empty state is gone because the
    // populated branch rendered, not because the tab failed to render.
    expect(screen.getByTestId('compare-tab-body')).toBeTruthy()
  })
})

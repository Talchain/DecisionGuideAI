/**
 * ⭐ THE HALF THAT WAS REFUTED, AND WHY THIS FILE EXISTS ANYWAY.
 *
 * This lane was briefed to fix a second, opposite defect: THE FALSE NEGATIVE.
 * Step 5 gates the results write on `hash !== prevHash`, and the freshness
 * resolution (`clearAnalysisFreshnessDirty` / `noteRunCompletedWithoutVerdict`)
 * sits INSIDE that branch — so a re-run whose report is byte-identical was
 * said to COMPLETE while `analysisFreshnessDirty` stayed SET, leaving
 * "Model changed since this analysis" over the run that had just finished.
 * The prescribed fix was to hoist that resolution out of the hash gate.
 *
 * ⚠ THAT FIX WAS BUILT, MEASURED, AND REVERTED. It is unnecessary where it is
 * safe and unsafe where it is necessary — and both halves of that sentence are
 * measured here rather than argued:
 *
 *   · WHERE THE TURN CARRIES AN EXPLICIT `analysis_ready.freshness` VERDICT the
 *     defect does not exist. Step 4 calls `setAnalysisFreshness`
 *     UNCONDITIONALLY, before step 5, and the reducer clears the overlay itself
 *     on a 'fresh' verdict with nothing pending. Hoisting the clear adds a
 *     second caller for an outcome that has already happened. Pinned below.
 *
 *   · WHERE THE TURN IS SILENT ABOUT FRESHNESS the hoist is a TRUST DEFECT. A
 *     duplicate hash is exactly as consistent with a RE-DELIVERED ECHO of an
 *     earlier `analysis_result` as it is with a genuine identical re-run, and
 *     the UI cannot tell them apart: the block carries `summary`,
 *     `leading_option_id`, `win_probabilities`, `enrichment` and
 *     `computed_against_hash` — and NO `run_id`, `computed_at` or
 *     `analysis_id` (schemas 0.50.0 `boundary/blocks.d.ts`; derived with
 *     `leading_option_id` as the contrast control, 8 hits vs 0). Clearing on an
 *     echo would un-dirty an overlay set by an edit CEE HAS already received
 *     but has NOT re-analysed — the `pendingEmittedEdits` hold cannot cover
 *     that case, because the edit was dispatched. That is a false affirmative:
 *     the same lie this lane's other half exists to close, pointing the other
 *     way.
 *
 * So the retained behaviour is deliberate, `applyV5State.results-hydration
 * .test.ts` ("does NOT clear the overlay for a duplicate analysis_result")
 * already pins it, and the honest cost is a stale "model changed" banner in
 * the narrow silent-verdict case — a visible failure, which is the direction
 * this estate prefers over confident wrongness.
 *
 * These tests are CHARACTERISATION pins, not a fix: they were GREEN at pristine
 * by construction. They are here so the next lane briefed to hoist that block
 * reads the refutation first, and so the composition with the widened
 * undispatched-edit hold (this PR's shipped half) is MEASURED rather than
 * believed.
 */
import { describe, expect, it, vi } from 'vitest'

import type { OlumiResponse } from '@talchain/schemas/boundary'

import { applyV5State, type V5ApplicatorStore } from '../applyV5State'
import { useCanvasStore } from '../../canvas/store'

const analysisBlock = {
  type: 'analysis_result' as const,
  summary: 'A leads',
  leading_option_id: 'opt_a',
  win_probabilities: { opt_a: 0.64, opt_b: 0.36 },
  enrichment: {
    factor_sensitivity: [
      { factor_id: 'fac_market', factor_label: 'Market', sensitivity: 0.4, direction: 'positive' as const },
    ],
  },
}

const freshVerdict = {
  freshness: 'fresh',
  freshness_reason: 'graph_hash_match',
  computed_at: '2026-09-05T10:00:00.000Z',
}

function baseResponse(overrides: Partial<OlumiResponse> = {}): OlumiResponse {
  return {
    response_version: 2,
    assistant_text: '',
    blocks: [],
    suggested_actions: [],
    insights: [],
    stage_indicator: 'analyse',
    ...overrides,
  }
}

/**
 * Compute the hash the applicator WILL derive for a block, by running it once
 * against a capturing store. Binding the duplicate-hash cases to the real
 * derived value by IDENTITY — never to a hand-written literal another report
 * could accidentally match.
 */
function hashOf(block: typeof analysisBlock): string {
  let captured: string | null = null
  const probe: V5ApplicatorStore = {
    setCurrentStage: vi.fn(),
    updateNode: vi.fn(),
    updateEdgeData: vi.fn(),
    setRunMeta: vi.fn(),
    setCeeAnalysisReady: vi.fn(),
    resultsComplete: vi.fn((args: { hash: string }) => { captured = args.hash }),
    nodes: [],
    edges: [],
    currentResultsHash: null,
  }
  applyV5State(baseResponse({ blocks: [block], analysis_ready: freshVerdict } as never), probe)
  if (captured === null) throw new Error('probe never captured a hash — the harness is blind')
  return captured
}

function realStoreApplicator(currentResultsHash: string | null): V5ApplicatorStore {
  const s = () => useCanvasStore.getState()
  return {
    setCurrentStage: vi.fn(),
    updateNode: vi.fn(),
    updateEdgeData: vi.fn(),
    setRunMeta: vi.fn(),
    setCeeAnalysisReady: vi.fn(),
    resultsComplete: vi.fn(),
    setAnalysisFreshness: (raw) => s().setAnalysisFreshness?.(raw),
    clearAnalysisFreshnessDirty: () => s().clearAnalysisFreshnessDirty?.(),
    noteRunCompletedWithoutVerdict: () => s().noteRunCompletedWithoutVerdict?.(),
    nodes: [],
    edges: [],
    currentResultsHash,
  }
}

/** Returns `analysisFreshnessDirty` after applying one response. */
function runCell(opts: {
  pendingEmittedEdits: number
  duplicateHash: boolean
  carriesVerdict: boolean
}): boolean {
  const dup = hashOf(analysisBlock)
  useCanvasStore.setState({
    analysisFreshnessDirty: true,
    pendingEmittedEdits: opts.pendingEmittedEdits,
    importPendingServerRegistration: false,
    analysisFreshness: null,
  } as never)

  applyV5State(
    opts.carriesVerdict
      ? baseResponse({ blocks: [analysisBlock], analysis_ready: freshVerdict } as never)
      : baseResponse({ blocks: [analysisBlock] }),
    realStoreApplicator(opts.duplicateHash ? dup : 'sha_something_else_entirely'),
  )

  return useCanvasStore.getState().analysisFreshnessDirty
}

describe('the briefed false-negative fix is UNNECESSARY on the explicit-verdict arm', () => {
  it('a duplicate-hash rerun with a fresh verdict ALREADY resolves the overlay, via the reducer', () => {
    expect(
      runCell({ pendingEmittedEdits: 0, duplicateHash: true, carriesVerdict: true }),
      'step 4 runs setAnalysisFreshness unconditionally, before the hash gate',
    ).toBe(false)
  })

  it('and it does so WITHOUT the results write — the hash dedupe is untouched', () => {
    const dup = hashOf(analysisBlock)
    const resultsComplete = vi.fn()
    const store: V5ApplicatorStore = { ...realStoreApplicator(dup), resultsComplete }
    useCanvasStore.setState({
      analysisFreshnessDirty: true,
      pendingEmittedEdits: 0,
      importPendingServerRegistration: false,
      analysisFreshness: null,
    } as never)

    applyV5State(
      baseResponse({ blocks: [analysisBlock], analysis_ready: freshVerdict } as never),
      store,
    )

    expect(resultsComplete, 'a byte-identical report must not re-hydrate').not.toHaveBeenCalled()
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(false)
  })
})

describe('the briefed false-negative fix is UNSAFE on the silent arm — held deliberately', () => {
  it('a duplicate-hash turn SILENT about freshness leaves the overlay dirty', () => {
    expect(
      runCell({ pendingEmittedEdits: 0, duplicateHash: true, carriesVerdict: false }),
      'a duplicate hash cannot be told from a re-delivered echo — no run_id on the block',
    ).toBe(true)
  })

  it('OPPOSITE TWIN: a NEW hash silent about freshness DOES resolve — it is provably a new run', () => {
    expect(
      runCell({ pendingEmittedEdits: 0, duplicateHash: false, carriesVerdict: false }),
      'a hash that moved is the one run-identity signal the wire does carry',
    ).toBe(false)
  })

  it('the contract carries no run identity — measured, with a contrast control', async () => {
    const blocks = await import('@talchain/schemas/boundary')
    const shape = (blocks as Record<string, { shape?: Record<string, unknown> }>)
      .AnalysisResultBlockSchema?.shape
    // Contrast control: the probe must SEE a field we know is there, or its
    // silence about run identity is blindness rather than evidence.
    expect(shape, 'the schema shape is reachable at all').toBeTruthy()
    expect(Object.keys(shape ?? {}), 'contrast control').toContain('leading_option_id')
    expect(Object.keys(shape ?? {})).not.toContain('run_id')
    expect(Object.keys(shape ?? {})).not.toContain('computed_at')
    expect(Object.keys(shape ?? {})).not.toContain('analysis_id')
  })
})

/**
 * ⭐ THE COMPOSITION MATRIX — pending model-changing edits × duplicate hash ×
 * freshness arm, driven against the REAL store.
 *
 * This is what makes the SHIPPED half of this PR (the widened undispatched-edit
 * hold) safe to reason about: it proves the widened hold governs every cell it
 * should and no cell it should not. Cells 3, 4, 7 and 8 are the ones the widened
 * predicate reaches.
 */
describe('composition: the widened undispatched-edit hold governs every arm', () => {
  describe('the turn is SILENT about freshness', () => {
    it('CELL 1 — no pending edits, NEW hash → resolves', () => {
      expect(runCell({ pendingEmittedEdits: 0, duplicateHash: false, carriesVerdict: false })).toBe(false)
    })
    it('CELL 2 — no pending edits, DUPLICATE hash → stays dirty (deliberate, see above)', () => {
      expect(runCell({ pendingEmittedEdits: 0, duplicateHash: true, carriesVerdict: false })).toBe(true)
    })
    it('CELL 3 — pending edits, NEW hash → stays dirty', () => {
      expect(runCell({ pendingEmittedEdits: 1, duplicateHash: false, carriesVerdict: false })).toBe(true)
    })
    it('CELL 4 — pending edits, DUPLICATE hash → stays dirty', () => {
      expect(runCell({ pendingEmittedEdits: 1, duplicateHash: true, carriesVerdict: false })).toBe(true)
    })
  })

  describe('the turn carries an EXPLICIT freshness verdict', () => {
    it('CELL 5 — no pending edits, NEW hash → resolves', () => {
      expect(runCell({ pendingEmittedEdits: 0, duplicateHash: false, carriesVerdict: true })).toBe(false)
    })
    it('CELL 6 — no pending edits, DUPLICATE hash → resolves (via the reducer)', () => {
      expect(runCell({ pendingEmittedEdits: 0, duplicateHash: true, carriesVerdict: true })).toBe(false)
    })
    it('CELL 7 — pending edits, NEW hash → stays dirty', () => {
      expect(
        runCell({ pendingEmittedEdits: 1, duplicateHash: false, carriesVerdict: true }),
        'the verdict was computed without the queued change',
      ).toBe(true)
    })
    it('CELL 8 — pending edits, DUPLICATE hash → stays dirty', () => {
      expect(runCell({ pendingEmittedEdits: 1, duplicateHash: true, carriesVerdict: true })).toBe(true)
    })
  })

  it('an UNREGISTERED IMPORT holds the overlay on every arm', () => {
    const dup = hashOf(analysisBlock)
    useCanvasStore.setState({
      analysisFreshnessDirty: true,
      pendingEmittedEdits: 0,
      importPendingServerRegistration: true,
      analysisFreshness: null,
    } as never)

    applyV5State(
      baseResponse({ blocks: [analysisBlock], analysis_ready: freshVerdict } as never),
      realStoreApplicator(dup),
    )

    expect(
      useCanvasStore.getState().analysisFreshnessDirty,
      'the run consumed CEE own graph, not the imported canvas',
    ).toBe(true)
  })
})

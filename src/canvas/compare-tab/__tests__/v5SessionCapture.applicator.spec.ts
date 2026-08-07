/**
 * ROADMAP 2.350 — within-session Compare at guest tier (PC1 step 6).
 *
 * ⚠ WHY THIS SPEC EXISTS WHEN `analysisSnapshotStore.spec.ts` AND
 * `CompareTabBody.pickTwoRuns.spec.tsx` ARE ALREADY GREEN.
 *
 * Both of those SEED the snapshot store — one calls `addSnapshot` directly, the
 * other mocks `../../store` wholesale and feeds `hydrateFromPersisted` from
 * persisted-fact fixtures. Neither can see the defect 2.350 is about, because
 * the defect is not in the store or the tab: it is that **nothing on the
 * deployed wire ever writes to that store**. A spec that hands the store its
 * runs proves the renderer works and proves exactly nothing about the wire.
 *
 * So this spec drives the REAL applicator against the REAL canvas store, wired
 * the way `useConversation.ts:4532-4537` wires it in production:
 *
 *     applyV5State(response, { ...useCanvasStore.getState(),
 *                              currentResultsHash: state.results?.hash ?? null })
 *
 * and asserts on the snapshot store afterwards. Nothing here constructs an
 * `AnalysisSnapshot`.
 *
 * ⭐ THE FIXTURE IS THE REAL GUEST WALK, NOT A HAND-WRITTEN SHAPE.
 * `__fixtures__/v5GuestWalkAnalysisBlocks.json` holds the two DISTINCT
 * `analysis_result` blocks captured off the live staging wire during the
 * 2026-08-04b journey walk, verbatim:
 *
 *   runA ← journey-witness-2026-08-04b-raw/p3b/wire-run1-4-res.txt
 *   runB ← journey-witness-2026-08-04b-raw/p3b/wire-run2-8-res.txt
 *
 * Both carry `enrichment.option_comparison` (4) and `enrichment.factor_sensitivity`
 * (6) at the enrichment ROOT — the premise the fix rests on, verified at the
 * bytes on the walk that produced the 0-picker capture rather than assumed from
 * a code comment. That walk is also where the empty-state signature pinned
 * below comes from (`P3b-compare-before.json`: `runPickerCount: 0`, testids
 * `[compare-tab-body, compare-empty-state]`).
 *
 * ⚠ NEITHER BLOCK CARRIES A `model_card` — so `response_hash` is DERIVED by
 * `mapV5AnalysisToReport` (fnv1a-64 over summary + leading_option_id +
 * win_probabilities + enrichment). Run identity on this path is therefore
 * content-derived, and the dedupe assertions below are about that derived
 * value, not a producer-supplied one.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useCanvasStore } from '../../store'
import { useAnalysisSnapshotStore } from '../../stores/analysisSnapshotStore'
import { applyV5State } from '../../../v5/applyV5State'
import { mapV5AnalysisToReport } from '../../../v5/mapV5AnalysisToReport'
import blocksFixture from './__fixtures__/v5GuestWalkAnalysisBlocks.json'

type AnalysisBlock = Record<string, unknown> & { type: 'analysis_result' }

const runA = blocksFixture.runA as unknown as AnalysisBlock
const runB = blocksFixture.runB as unknown as AnalysisBlock

/**
 * A turn response carrying exactly one `analysis_result` block, shaped the way
 * the walk's captures are shaped. `applyV5State` reads `response.blocks`.
 */
function turnWith(block: AnalysisBlock) {
  return { blocks: [block] } as never
}

/** The production wiring, verbatim (useConversation.ts:4532-4537). */
function applyTurn(block: AnalysisBlock) {
  const snapshot = useCanvasStore.getState()
  return applyV5State(turnWith(block), {
    ...snapshot,
    currentResultsHash: snapshot.results?.hash ?? null,
  } as never)
}

/** The identity the applicator itself uses for "is this a new run". */
function derivedHash(block: AnalysisBlock): string {
  return mapV5AnalysisToReport(block as never).model_card.response_hash
}

describe('ROADMAP 2.350 — V5 session capture feeds the Compare snapshot store', () => {
  beforeEach(() => {
    // The capture gate is flag-gated on `compareTab`, which resolves from
    // localStorage FIRST (src/lib/flagFactory.ts). Setting the key is the same
    // switch staging uses, and it avoids mocking `../../../flags` — a
    // `vi.mock` factory REPLACES the module, and a hand-listed flag allowlist
    // is precisely the mirror CLAUDE.md trap 12 is about.
    localStorage.setItem('feature.compareTab', '1')
    useAnalysisSnapshotStore.getState().clearSnapshots()
    useCanvasStore.getState().resultsReset()
  })

  afterEach(() => {
    localStorage.removeItem('feature.compareTab')
    useAnalysisSnapshotStore.getState().clearSnapshots()
  })

  // ── Positive control FIRST (trap 13) ──────────────────────────────────
  // Before asserting that snapshots appear, prove the harness can actually
  // drive the applicator: the results slice must hydrate. If this fails, every
  // assertion below would be testing a turn that never applied.
  it('CONTROL: the applicator hydrates the results slice from the fixture turn', () => {
    const result = applyTurn(runA)
    expect(result.applied).toContain('analysis_result:results_hydrated')
    expect(useCanvasStore.getState().results?.hash).toBe(derivedHash(runA))
    expect(useCanvasStore.getState().results?.report).toBeTruthy()
  })

  // ── Spec 1 (diagnosis §5 RED-first #1) ────────────────────────────────
  it('captures two runs from two live-shaped V5 turns in ONE session', () => {
    expect(useAnalysisSnapshotStore.getState().getRunCount()).toBe(0)

    applyTurn(runA)
    expect(useAnalysisSnapshotStore.getState().getRunCount()).toBe(1)

    applyTurn(runB)
    expect(useAnalysisSnapshotStore.getState().getRunCount()).toBe(2)
  })

  // Identity-bound, not count-bound (trap 19): a count of 2 is satisfied by two
  // copies of the same run, or by two snapshots of the wrong runs entirely.
  it('the two captured snapshots ARE run A and run B, by response hash', () => {
    applyTurn(runA)
    applyTurn(runB)

    const snaps = useAnalysisSnapshotStore.getState().snapshots
    expect(snaps.map(s => s.responseHash)).toEqual([derivedHash(runA), derivedHash(runB)])
    expect(derivedHash(runA)).not.toBe(derivedHash(runB))
    expect(snaps.map(s => s.runNumber)).toEqual([1, 2])
    expect(snaps.map(s => s.source)).toEqual(['session', 'session'])
  })

  // The snapshot must carry the producer's OWN measurements, not a renderable
  // shell of zeros. This is the absent≠zero guard that `parseRunFact`'s
  // non-empty-array checks exist for, asserted on the V5 path.
  it('the captured snapshot carries the producer values, not fabricated zeros', () => {
    applyTurn(runA)
    const snap = useAnalysisSnapshotStore.getState().snapshots[0]

    // Winner comes from the fixture's own option_comparison, sorted by
    // win_probability desc. These are LITERALS taken from the captured wire
    // bytes, deliberately not re-derived from the fixture in the assertion:
    // re-deriving would reimplement the factory and the two would agree by
    // construction whatever the factory did. Provenance —
    //   "Invest in Content Marketing"  win_probability 0.5241916666666667
    //   "Hire Two Sales Reps"          win_probability 0.2504416666666667
    // and the snapshot reports 0-100 rounded (types.ts:57), so 52 and 25.
    expect(snap.winnerLabel).toBe('Invest in Content Marketing')
    expect(snap.winnerProbability).toBe(52)
    expect(snap.runnerUpProbability).toBe(25)
    // Six factors in the fixture, capped at the factory's top 5
    // (analysisSnapshotFactory.ts:86 `.slice(0, 5)`) — so 5, not 6. Asserting
    // the exact number rather than `> 0` is what makes this see a regression
    // that silently truncated the block to one factor.
    expect(snap.topFactors.length).toBe(5)
    expect(snap.topCalibrationFactor).not.toBe('')
  })

  // ── Spec 3 (diagnosis §5 RED-first #3) — dedupe ────────────────────────
  it('a CONSECUTIVE re-delivery of the same analysis does not double-count', () => {
    // This is the real walk's own shape: p3b/wire-run2-4-res.txt is a
    // byte-identical re-delivery of run 1's block inside run 2's turn
    // sequence, before the genuinely new analysis arrives at wire-run2-8.
    applyTurn(runA)
    applyTurn(runA)
    expect(useAnalysisSnapshotStore.getState().getRunCount()).toBe(1)
  })

  it('a NON-CONSECUTIVE replay of an earlier analysis does not double-count', () => {
    // A, B, A. The applicator's own `hash !== prevHash` guard is CONSECUTIVE
    // only — after B, prevHash is B's, so a re-delivered A passes it and calls
    // resultsComplete again. Only an identity-bound dedupe in the capture can
    // stop that becoming a third "run" in the journey.
    applyTurn(runA)
    applyTurn(runB)
    applyTurn(runA)

    const snaps = useAnalysisSnapshotStore.getState().snapshots
    expect(snaps).toHaveLength(2)
    expect(snaps.map(s => s.responseHash)).toEqual([derivedHash(runA), derivedHash(runB)])
  })

  // The store's sequential renumber must survive a rejected duplicate — a
  // journey numbered 1, 3 would be a visible artefact of the dedupe.
  it('run numbering stays contiguous when a duplicate is rejected', () => {
    applyTurn(runA)
    applyTurn(runA)
    applyTurn(runB)
    expect(useAnalysisSnapshotStore.getState().snapshots.map(s => s.runNumber)).toEqual([1, 2])
  })

  // ── Producer-drift drops, on THIS caller ──────────────────────────────
  //
  // ⚠ WHY THESE EXIST WHEN `persistedRunSnapshotFactory.spec.ts` ALREADY PINS
  // THE SAME GUARDS. The guards live in ONE shared reader
  // (`stores/analysisEnrichmentShape.ts`) used by both the persisted rebuild
  // and this live capture. Sharing the reader makes the two callers AGREE; it
  // does not make either one COVERED. Before these cases, deleting a guard
  // RED-ed only the persisted spec — so the V5 path's drop behaviour was
  // asserted nowhere, and a future change that gave this caller its own
  // lenient parse would have shipped under a green gate. (CLAUDE.md trap 12d:
  // a derived/shared guard proves agreement, never completeness.)
  //
  // The claim is DROP, not degrade: a block that cannot be read as a completed
  // analysis must produce NO snapshot, rather than a run plotted at 0% with an
  // empty winner label.
  const dropCases: Array<[string, unknown]> = [
    ['an EMPTY option_comparison', { ...(runA.enrichment as object), option_comparison: [] }],
    ['NO option_comparison key at all', (() => {
      const e = { ...(runA.enrichment as Record<string, unknown>) }
      delete e.option_comparison
      return e
    })()],
    ['an EMPTY factor_sensitivity', { ...(runA.enrichment as object), factor_sensitivity: [] }],
    ['a non-array option_comparison', { ...(runA.enrichment as object), option_comparison: {} }],
    ['no enrichment envelope at all', null],
  ]

  for (const [label, enrichment] of dropCases) {
    it(`DROPS a V5 analysis block with ${label} — no phantom run`, () => {
      const block = { ...runA, enrichment } as AnalysisBlock
      const result = applyV5State(turnWith(block), {
        ...useCanvasStore.getState(),
        currentResultsHash: null,
      } as never)

      // Control: the turn DID apply — the results slice hydrated. Without
      // this, "no snapshot" would be satisfied by a turn that never ran, and
      // every case here would pass by testing nothing (trap 13).
      expect(result.applied).toContain('analysis_result:results_hydrated')
      // …and the run is absent from the journey rather than present-and-zeroed.
      expect(useAnalysisSnapshotStore.getState().getRunCount()).toBe(0)
    })
  }

  // The capture must not resurrect the OTHER two dead writers, and must not
  // start writing the V2-shaped slots the V5 path deliberately clears.
  it('does not repopulate the V2 enrichment / rawV2Response slots', () => {
    applyTurn(runA)
    const state = useCanvasStore.getState()
    // `enrichment` is on the results slice; `rawV2Response` is a TOP-LEVEL
    // store field (store.ts:615). Both are V2-shaped and both are cleared on
    // purpose by the V5 path — the new `v5Enrichment` param must not have
    // leaked into either.
    expect(state.results?.enrichment ?? null).toBeNull()
    expect(state.rawV2Response ?? null).toBeNull()
  })
})

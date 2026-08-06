/**
 * ONE `AnalysisSnapshot` fixture builder, for every spec that needs one.
 *
 * ⚠ WHY THIS FILE EXISTS. Five specs each carried their own hand-written
 * snapshot literal (`deriveTransitions`, `deriveCompareState`,
 * `analysisSnapshotStore`, `Hero.rerunAction`, `TrajectorySection.absence`,
 * plus one in `model-tab`). That is six copies of the same shape a human must
 * remember to keep in step — CLAUDE.md trap 12, the hand-maintained mirror —
 * and the failure mode is silent: a field added to the type with a plausible
 * default in five of six copies makes five suites test a shape the product
 * never produces. Slice 2 adds two fields, so the mirror is collapsed instead
 * of copied a seventh time. Each spec keeps its own defaults by spreading this.
 *
 * DEFAULTS ARE THE PRODUCER'S HAPPY PATH, deliberately: an entitled leader
 * verdict and a two-option comparison. Absence cases are opt-in per test, so a
 * spec that means to exercise absence has to SAY so.
 */
import type { AnalysisSnapshot, SnapshotOption } from '../../types'
import type { DecisionVerdict } from '../../../../lib/decisionVerdict'
import { NO_CLAIM_VERDICT } from '../../../../lib/decisionVerdict'

export const DEFAULT_SNAPSHOT_OPTIONS: SnapshotOption[] = [
  { id: 'opt-a', label: 'Option A', winProbability: 65 },
  { id: 'opt-b', label: 'Option B', winProbability: 35 },
]

/** A producer-entitled verdict naming `opt-a` — the ordinary live case. */
export const DEFAULT_LEADER_VERDICT: DecisionVerdict = {
  leaderId: 'opt-a',
  separation: 'clear',
  hasLeadingOption: true,
  gapPp: 30,
  source: 'producer_near_tie',
}

/** The producer's own "no clear leading option". */
export const TIED_LEADER_VERDICT: DecisionVerdict = {
  leaderId: 'opt-a',
  separation: 'tied',
  hasLeadingOption: false,
  gapPp: 2,
  source: 'producer_near_tie',
}

/** No applicable producer signal ⇒ silence, never a denial. */
export const UNCLAIMED_LEADER_VERDICT: DecisionVerdict = NO_CLAIM_VERDICT

export function makeAnalysisSnapshot(
  overrides: Partial<AnalysisSnapshot> & { runNumber: number },
): AnalysisSnapshot {
  return {
    runId: `run-${overrides.runNumber}`,
    timestamp: new Date().toISOString(),
    source: 'session',
    graphHash: 'hash-default',
    nodeCount: 5,
    edgeCount: 4,
    /**
     * ROADMAP 2.578. Null by default because this fixture does NOT describe a
     * graph — it describes a run's analysis. A fabricated empty projection would
     * make every snapshot built here compare EQUAL to every other and silently
     * assert "no edits" across the whole suite. Specs that mean to exercise the
     * canonical diff build real nodes/edges through `buildAnalysisSnapshot`
     * (see `compareChangeCoherence.spec.tsx`) rather than hand-writing one here.
     */
    graphProjection: null,
    options: DEFAULT_SNAPSHOT_OPTIONS,
    leaderVerdict: DEFAULT_LEADER_VERDICT,
    winnerId: 'opt-a',
    winnerLabel: 'Option A',
    winnerProbability: 65,
    runnerUpId: 'opt-b',
    runnerUpLabel: 'Option B',
    runnerUpProbability: 35,
    recommendationStability: 0.7,
    stabilityLabel: 'stable',
    fragileEdgeCount: 0,
    evidenceCoverage: '3/5',
    topFactors: [],
    influenceConcentration: 40,
    topCalibrationFactor: 'Factor A',
    topCalibrationFactorId: 'fac-a',
    topElasticity: 30,
    rankFlipRate: 0.05,
    goalProbability: null,
    jointGoalProbability: null,
    inferenceWarnings: [],
    conditionalWinners: [],
    edgeEValues: [],
    seedUsed: 12345,
    /**
     * ⚠ VARIES WITH `runNumber`, LIKE `runId` ABOVE — it used to be a constant
     * `'abc123'`, which made every snapshot this fixture produced claim to be
     * the SAME RUN.
     *
     * That was invisible until ROADMAP 2.350 made `addSnapshot`
     * identity-idempotent: `makeSnapshot(1)`, `makeSnapshot(2)`,
     * `makeSnapshot(3)` are meant to be three distinct runs, and every test
     * that cares about identity already overrides this field explicitly, so
     * only the tests that DON'T care were relying on the collision. A default
     * that contradicts the fixture's own `runId: run-${runNumber}` is a trap
     * for the next reader; deriving both from the same input removes it.
     */
    responseHash: `resp-hash-${overrides.runNumber}`,
    editSummary: 'Test edit',
    ...overrides,
  }
}

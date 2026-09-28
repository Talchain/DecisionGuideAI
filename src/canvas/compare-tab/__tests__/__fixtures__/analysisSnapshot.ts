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

const LABELS: Record<string, string> = { 'opt-a': 'Option A', 'opt-b': 'Option B' }

/**
 * A run whose PRODUCER named `leaderId` and scored it at `leaderProbability`.
 *
 * ⚠ ADDED BY ROADMAP 2.835, AND IT REPLACES A ONE-FIELD OVERRIDE WITH A
 * CONSISTENT PAIR — deliberately.
 *
 * Specs used to say `makeAnalysisSnapshot({ winnerProbability: 60 })` or
 * `{ winnerId: 'opt-b' }`, because the state machine and the transition deltas
 * read the client-side argmax. Those fields are retired: what the tab decides
 * on now is the run's `leaderVerdict` TOGETHER WITH its `options`, and the two
 * have to agree — a verdict naming an option that is absent from `options` is a
 * real and different case (a leader that cannot be NAMED), not a fixture
 * convenience.
 *
 * Building them together here means a spec cannot express "the leader scored
 * 60%" in a way the product could never emit (trap 16-inverse: a fixture you
 * wrote yourself is not evidence about the wire). Specs that MEAN to exercise
 * the mismatch construct it explicitly.
 */
export function makeLedSnapshot(
  runNumber: number,
  leaderId: 'opt-a' | 'opt-b',
  leaderProbability: number,
  overrides: Partial<AnalysisSnapshot> = {},
): AnalysisSnapshot {
  const rivalId = leaderId === 'opt-a' ? 'opt-b' : 'opt-a'
  return makeAnalysisSnapshot({
    runNumber,
    options: [
      { id: leaderId, label: LABELS[leaderId], winProbability: leaderProbability },
      { id: rivalId, label: LABELS[rivalId], winProbability: 100 - leaderProbability },
    ],
    leaderVerdict: {
      ...DEFAULT_LEADER_VERDICT,
      leaderId,
      gapPp: leaderProbability - (100 - leaderProbability),
    },
    winnerId: leaderId,
    runnerUpId: rivalId,
    runnerUpLabel: LABELS[rivalId],
    runnerUpProbability: 100 - leaderProbability,
    ...overrides,
  })
}

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
    /**
     * ⛔ IDENTITY ONLY. `winnerLabel` / `winnerProbability` were removed from
     * `AnalysisSnapshot` by ROADMAP 2.835 — the argmax trio stopped being a
     * display source, and the two display fields were deleted rather than made
     * nullable so a surface reaching for them is a type error.
     *
     * A spec that wants "what may this run SAY about its leader" reads
     * `deriveLeaderClaim`, whose answer comes from `leaderVerdict` above and
     * `options` — both already defaulted here to the producer's happy path
     * (an entitled verdict naming `opt-a`, which `DEFAULT_SNAPSHOT_OPTIONS`
     * scores at 65). So the default claim is still "Option A, 65%"; it is now
     * DERIVED from the same two fields the product derives it from, instead of
     * being a third copy this fixture had to keep in step.
     */
    winnerId: 'opt-a',
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

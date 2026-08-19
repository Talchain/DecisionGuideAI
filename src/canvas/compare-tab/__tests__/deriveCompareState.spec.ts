/**
 * ⚠ REWRITTEN BY ROADMAP 2.835 — read this before comparing against git blame.
 *
 * Every case below used to express its scenario through the client-side ARGMAX
 * (`winnerId`, `winnerProbability`, `runnerUpProbability`) because that is what
 * `deriveCompareState` read. The trio was retired as a display and decision
 * source, so the scenarios are now expressed through the inputs the product
 * actually decides on: the run's own `leaderVerdict` and its `options`.
 *
 * The INTENT of each pre-existing case is preserved and each is still here.
 * Three OUTCOMES changed, deliberately, and each is called out at its own test:
 *
 *   1. A flip INTO a producer-declared tie is `'noWinner'`, not `'flipped'`.
 *      "Result changed: B now leads at 52%" is a leader claim, and a tie is the
 *      producer saying there is no leader to name.
 *   2. A single-option run is `'unclaimed'`, not `'improving'`. With one option
 *      "leading" has no meaning — `deriveDecisionVerdict` says so explicitly and
 *      returns the no-claim verdict. The old path reached `'improving'`, whose
 *      copy reads "Option A leads at 65%", via `65 - (null ?? 0) >= 10`.
 *   3. `isNarrowFlip` quotes the producer's own separation band instead of
 *      re-deriving a 10pp margin from two numbers it may not have.
 */
import { describe, it, expect } from 'vitest'
import { deriveCompareState, isNarrowFlip } from '../deriveCompareState'
import { makeAnalysisSnapshot } from './__fixtures__/analysisSnapshot'
import { NO_CLAIM_VERDICT, type LeaderSeparation } from '../../../lib/decisionVerdict'
import type { AnalysisSnapshot } from '../types'

// ---------------------------------------------------------------------------
// Fixture factory
// ---------------------------------------------------------------------------

const LABELS: Record<string, string> = { 'opt-a': 'Option A', 'opt-b': 'Option B' }

/**
 * A two-option run whose PRODUCER named `leaderId` and scored both options.
 *
 * `options` and `leaderVerdict` are built together and consistently — that
 * pairing IS the scenario now, where a `winnerId` override used to be. A run
 * whose verdict names an option absent from `options` is a different case and
 * is exercised explicitly below.
 */
function led(
  runNumber: number,
  leaderId: 'opt-a' | 'opt-b',
  leaderProb: number,
  rivalProb: number,
  separation: LeaderSeparation = 'clear',
): AnalysisSnapshot {
  const rivalId = leaderId === 'opt-a' ? 'opt-b' : 'opt-a'
  return makeAnalysisSnapshot({
    runNumber,
    options: [
      { id: leaderId, label: LABELS[leaderId], winProbability: leaderProb },
      { id: rivalId, label: LABELS[rivalId], winProbability: rivalProb },
    ],
    leaderVerdict: {
      leaderId,
      separation,
      hasLeadingOption: separation === 'clear' || separation === 'slight',
      gapPp: leaderProb - rivalProb,
      source: 'producer_near_tie',
    },
    winnerId: leaderId,
  })
}

/** The producer's own "no clear leading option" over two scored options. */
function tiedRun(runNumber: number, a: number, b: number): AnalysisSnapshot {
  return led(runNumber, 'opt-a', a, b, 'tied')
}

/** The producer named nothing — silence, not a denial. */
function unclaimedRun(runNumber: number): AnalysisSnapshot {
  return makeAnalysisSnapshot({ runNumber, leaderVerdict: NO_CLAIM_VERDICT })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('deriveCompareState', () => {
  it('returns "stale" when graph has been edited since last run', () => {
    const snapshots = [
      makeAnalysisSnapshot({ runNumber: 1 }),
      makeAnalysisSnapshot({ runNumber: 2 }),
    ]
    expect(deriveCompareState(snapshots, true)).toBe('stale')
  })

  it('returns "flipped" when the named leader changed between the last two runs', () => {
    const snapshots = [led(1, 'opt-a', 65, 35), led(2, 'opt-b', 65, 35)]
    expect(deriveCompareState(snapshots, false)).toBe('flipped')
  })

  it('flipped outranks noWinner when BOTH runs still name a leader', () => {
    // A narrow but real lead: the producer still says there IS a leading
    // option ('slight'), and it is a different one. Precedence is unchanged.
    const snapshots = [led(1, 'opt-a', 65, 35), led(2, 'opt-b', 52, 48, 'slight')]
    expect(deriveCompareState(snapshots, false)).toBe('flipped')
  })

  it('⚠ CHANGED: a flip INTO a producer-declared tie is noWinner, not flipped', () => {
    // This case used to return 'flipped', whose copy reads "Result changed:
    // Option B now leads at 52%". The producer said `is_tie` — there is no
    // leading option to name — so announcing one was a claim we did not have.
    // The old predicate could not see the difference: it compared argmax IDs,
    // and an argmax exists whether or not a leader does.
    const snapshots = [led(1, 'opt-a', 65, 35), tiedRun(2, 52, 48)]
    expect(deriveCompareState(snapshots, false)).toBe('noWinner')
  })

  it('returns "noWinner" on the producer\'s own tie verdict', () => {
    const snapshots = [makeAnalysisSnapshot({ runNumber: 1 }), tiedRun(2, 54, 46)]
    expect(deriveCompareState(snapshots, false)).toBe('noWinner')
  })

  it('returns "unclaimed" when the producer named no leader', () => {
    // ROADMAP 2.835's new arm. NOT 'noWinner': that copy DENIES a leading
    // option, which is a second claim, and silence licenses neither.
    const snapshots = [led(1, 'opt-a', 65, 35), unclaimedRun(2)]
    expect(deriveCompareState(snapshots, false)).toBe('unclaimed')
  })

  it('returns "converged" when 3 runs name the same leader with <3pp variation', () => {
    const snapshots = [
      led(1, 'opt-a', 71, 29),
      led(2, 'opt-a', 72, 28),
      led(3, 'opt-a', 73, 27),
    ]
    expect(deriveCompareState(snapshots, false)).toBe('converged')
  })

  it('returns "improving" when conditions for other states not met', () => {
    const snapshots = [led(1, 'opt-a', 60, 40), led(2, 'opt-a', 70, 30)]
    expect(deriveCompareState(snapshots, false)).toBe('improving')
  })

  it('returns "improving" with fewer than 2 snapshots', () => {
    expect(deriveCompareState([makeAnalysisSnapshot({ runNumber: 1 })], false)).toBe('improving')
    expect(deriveCompareState([], false)).toBe('improving')
  })

  it('⚠ CHANGED: a single-option run is "unclaimed", not "improving"', () => {
    // With one option, "leading" has no meaning — `deriveDecisionVerdict`
    // returns the no-claim verdict for `comparable.length < 2` and says so in
    // its own comment. The old path reached 'improving' — copy: "Option A
    // leads at 65%" — through `winnerProbability - (runnerUpProbability ?? 0)`,
    // i.e. by treating an absent runner-up as a scored 0.
    const single = (runNumber: number) =>
      makeAnalysisSnapshot({
        runNumber,
        options: [{ id: 'opt-a', label: 'Option A', winProbability: 65 }],
        leaderVerdict: NO_CLAIM_VERDICT,
        runnerUpId: null,
        runnerUpLabel: null,
        runnerUpProbability: null,
      })
    expect(deriveCompareState([single(1), single(2)], false)).toBe('unclaimed')
  })

  it('does not return "converged" if the leader changed among the last 3', () => {
    const snapshots = [
      led(1, 'opt-a', 71, 29),
      led(2, 'opt-b', 72, 28),
      led(3, 'opt-a', 73, 27),
    ]
    // Last two name different leaders → flipped
    expect(deriveCompareState(snapshots, false)).toBe('flipped')
  })

  it('does not return "converged" when variation >= 3pp', () => {
    const snapshots = [
      led(1, 'opt-a', 68, 32),
      led(2, 'opt-a', 71, 29),
      led(3, 'opt-a', 74, 26),
    ]
    // maxDelta = |71-68| = 3, and the condition is < 3, so not converged
    expect(deriveCompareState(snapshots, false)).toBe('improving')
  })

  it('does not return "converged" when a run in the window never scored the leader', () => {
    // Convergence is a claim that one option's probability barely moved across
    // three runs. A run that did not measure it cannot support that claim, and
    // must not be treated as a 0 or silently skipped.
    const snapshots = [
      led(1, 'opt-a', 71, 29),
      makeAnalysisSnapshot({
        runNumber: 2,
        // `opt-a` is absent from this run's options — the producer did not
        // score it — while the verdict still names it.
        options: [{ id: 'opt-b', label: 'Option B', winProbability: 28 }],
      }),
      led(3, 'opt-a', 73, 27),
    ]
    expect(deriveCompareState(snapshots, false)).not.toBe('converged')
  })

  it('an entitled verdict naming an option absent from the run is not nameable', () => {
    // The guard `deriveLeaderClaim` already owned: a leader we cannot NAME must
    // not be announced. Reaching 'improving' here would print "undefined leads
    // at undefined%".
    const snapshots = [
      led(1, 'opt-a', 65, 35),
      makeAnalysisSnapshot({
        runNumber: 2,
        options: [{ id: 'opt-b', label: 'Option B', winProbability: 35 }],
        // verdict still names opt-a, which is not in `options`
      }),
    ]
    expect(deriveCompareState(snapshots, false)).toBe('unclaimed')
  })

  it('"stale" outranks all other states', () => {
    // Even with a flip, stale takes precedence
    const snapshots = [led(1, 'opt-a', 65, 35), led(2, 'opt-b', 65, 35)]
    expect(deriveCompareState(snapshots, true)).toBe('stale')
  })
})

describe('isNarrowFlip — quoted from the producer band, not a re-derived margin', () => {
  it('returns true when the producer graded the lead "slight"', () => {
    expect(isNarrowFlip(led(2, 'opt-a', 52, 48, 'slight'))).toBe(true)
  })

  it('returns false when the producer graded the lead "clear"', () => {
    expect(isNarrowFlip(led(2, 'opt-a', 65, 35, 'clear'))).toBe(false)
  })

  it('returns false on the producer\'s tie verdict', () => {
    expect(isNarrowFlip(tiedRun(2, 51, 49))).toBe(false)
  })

  it('fails closed on silence — "unknown" is not narrow', () => {
    // The old version answered this from `winnerProbability -
    // (runnerUpProbability ?? 0)`, so a run with no measurements at all scored
    // |0 - 0| = 0 and was reported as a narrow flip.
    expect(isNarrowFlip(unclaimedRun(2))).toBe(false)
  })
})

/**
 * Compare tab — the leader sentence is QUOTED from the run's own verdict, never
 * re-derived from a client-side argmax (ROADMAP 2.835).
 *
 * ## The residual this closes
 *
 * ROADMAP 2.834 made `runnerUpProbability` absence-preserving. The WINNER half
 * of the same sentence kept minting:
 *
 *     analysisSnapshotFactory.ts:476
 *     winnerProbability: Math.round((winner?.win_probability ?? 0) * 100)
 *
 * `win_probability` is OPTIONAL in the UI's own wire type
 * (`src/adapters/plot/v2/types.ts:175`) and in the vendored schema, so this is
 * contract-admitted, not theoretical. The consequence was visible inside ONE
 * string literal — a guard watching one door, reproduced inside a single
 * template:
 *
 *     Run 3 · No clear leading option (Expand to EU 0%, Enter via partner
 *                                                  ^^                     )
 *                                      minted        not scored in this run
 *                                                    ^^^^^^^^^^^^^^^^^^^^^^
 *                                                    honest (2.834)
 *
 * ## Why the fix is convergence, not a nullable patch
 *
 * `winnerId` / `winnerLabel` / `winnerProbability` are the client-side ARGMAX —
 * the "Authority 3" that `src/lib/decisionVerdict.ts` was written to delete.
 * That module's doctrine: any surface saying "leads" must read the run's own
 * `leaderVerdict` and honour `hasLeadingOption`. Making the argmax nullable
 * would have added a PARALLEL rule beside the canonical owner.
 *
 * So the argmax trio stops being a display source. `deriveLeaderClaim`
 * (now `leaderClaim.ts`) already existed as the one derivation entitled
 * to turn a verdict into a nameable claim; the Compare hero, dot progression,
 * trajectory chart and transition deltas now quote IT.
 *
 * ## What that buys, structurally
 *
 * An unscored option is DROPPED by `extractOptions` (it has no measurement), so
 * it is absent from `snapshot.options`, so `deriveLeaderClaim` cannot name it
 * and returns `'unclaimed'`. The fabricated zero becomes UNREACHABLE rather
 * than handled — there is no longer a code path that owns a winner probability
 * the producer did not send.
 *
 * ## Contrast control (trap 13 / 13e)
 *
 * Every absence assertion below is paired with its opposite-direction twin: a
 * producer-sent `win_probability: 0` is a MEASUREMENT and must still render
 * `0%`. A fix that turned every low value into a gap would pass the absence
 * half and fail these.
 *
 * ## Binding (trap 19)
 *
 * Assertions bind to the option LABEL and `option_id` — identities this change
 * does not touch — never to the copy strings being rewritten. The regexes pair
 * an identity with the quantity beside it (`/Expand to EU\s*0%/`), so a test
 * cannot pass because some OTHER element happened to satisfy a value predicate.
 */
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildAnalysisSnapshot } from '../../stores/analysisSnapshotFactory'
import { deriveCompareState } from '../deriveCompareState'
import { deriveLeaderClaim } from '../leaderClaim'
import { deriveTransitions } from '../deriveTransitions'
import { buildTrajectoryData } from '../TrajectorySection'
import { DotProgression } from '../DotProgression'
import { Hero } from '../Hero'
import type { AnalysisSnapshot } from '../types'
import type { V2RunResponse } from '../../../adapters/plot/v2/types'

// ---------------------------------------------------------------------------
// The identities under test.
// ---------------------------------------------------------------------------

const LEADER_ID = 'opt-eu'
const LEADER_LABEL = 'Expand to EU'
const RIVAL_ID = 'opt-partner'
const RIVAL_LABEL = 'Enter via partner'

/**
 * A rendered "0%" that is genuinely zero — not the tail of "20%" or "70%".
 *
 * The negative lookbehind is the whole point: `toContain('0%')` is a substring
 * test, and every probability ending in a zero contains one.
 */
const ZERO_PERCENT = /(?<!\d)0%/

// ---------------------------------------------------------------------------
// Mount-path binding (trap 3b).
//
// This estate has twice shipped a UI feature DARK because its tests were bound
// to a component the deployed flags do not mount. Hero / DotProgression /
// TrajectorySection reach a user only through CompareTabBody, which mounts only
// when `VITE_FEATURE_COMPARE_TAB` is on. That posture is DERIVED from
// netlify.toml here rather than assumed, so if the flag ever moves this file
// goes RED and says why, instead of staying green about a surface nobody loads.
// ---------------------------------------------------------------------------

describe('mount path — these tests bind to a surface the deployed flags render', () => {
  const repoRoot = resolve(__dirname, '../../../..')
  const netlifyToml = readFileSync(resolve(repoRoot, 'netlify.toml'), 'utf8')

  it('netlify.toml enables VITE_FEATURE_COMPARE_TAB, so CompareTabBody mounts', () => {
    // Positive control on a DIFFERENT key first (trap 13): prove the regex can
    // see a setting in this file at all, so a pattern that matched nothing
    // cannot pass the assertion under test.
    expect(netlifyToml).toMatch(/VITE_V5_CANONICAL_ANALYSIS\s*=\s*"true"/)
    expect(netlifyToml).toMatch(/VITE_FEATURE_COMPARE_TAB\s*=\s*"1"/)
  })

  it('CompareTabBody renders the three surfaces pinned below', () => {
    const body = readFileSync(
      resolve(repoRoot, 'src/canvas/compare-tab/CompareTabBody.tsx'),
      'utf8',
    )
    expect(body).toContain('<Hero')
    expect(body).toContain('<TrajectorySection')
    // DotProgression is a SECOND hop: CompareTabBody renders TrajectorySection,
    // which renders DotProgression for runs < 4 (the chart takes over above
    // that). Asserted as the actual two-hop chain rather than assumed — the
    // first draft of this test asserted `<DotProgression` in CompareTabBody and
    // went RED, correctly, because that is not where it mounts.
    const trajectory = readFileSync(
      resolve(repoRoot, 'src/canvas/compare-tab/TrajectorySection.tsx'),
      'utf8',
    )
    expect(trajectory).toContain('<DotProgression')
  })
})

// ---------------------------------------------------------------------------
// Producer payloads. Built as V2 wire shapes and pushed through the REAL
// factory — a snapshot literal written here would be a fixture of my own
// authorship and therefore no evidence about what the producer can emit
// (trap 16-inverse).
// ---------------------------------------------------------------------------

interface OptionSpec {
  id: string
  label: string
  /** Omitted entirely when the producer sent no measurement. */
  win?: number
}

function response(options: OptionSpec[], opts: { isTie?: boolean; hash?: string } = {}): V2RunResponse {
  const { isTie, hash = 'resp-1' } = opts
  const scored = options.filter(o => o.win != null)
  const top = scored.length > 0 ? scored[0] : null
  return {
    response_hash: hash,
    option_comparison: options.map(o => ({
      option_id: o.id,
      option_label: o.label,
      confidence_interval: [0, 1] as [number, number],
      // The whole point: the key is ABSENT, not zero, when the run did not
      // score this option. `?? 0` upstream is what turned that into a claim.
      ...(o.win != null ? { win_probability: o.win } : {}),
    })),
    // A producer signal is supplied only when the scenario means to grant one;
    // `deriveDecisionVerdict` needs two COMPARABLE options before any authority
    // applies, so an all-unscored run yields the no-claim verdict regardless.
    ...(isTie != null && top != null
      ? { robustness: { near_tie: { is_tie: isTie, top_option_id: top.id } } }
      : {}),
    // A real factor, deliberately. With an empty list the factory derives
    // `topElasticity: 0` and the hero's action line reads "Calibrate 0%
    // influence" — a legitimate zero about a DIFFERENT quantity that would
    // confound every "no fabricated 0%" assertion below. Removing the confound
    // beats loosening the assertion.
    factor_sensitivity: [
      {
        node_id: 'fac-price',
        factor_label: 'Price sensitivity',
        elasticity: 0.41,
        rank_flip_rate: 0.05,
        attribution_stability: 'stable',
      },
    ],
  } as unknown as V2RunResponse
}

function snapshotFrom(raw: V2RunResponse, runNumber: number): AnalysisSnapshot {
  return buildAnalysisSnapshot({
    rawV2Response: raw,
    report: null,
    // Null, not `[]`: this run's graph is not what is under test, and a
    // fabricated empty graph would make every snapshot here compare EQUAL.
    nodes: null,
    edges: null,
    runNumber,
    events: [],
    previousSnapshotTimestamp: runNumber === 1 ? null : '2026-08-19T10:00:00Z',
  })
}

/** Neither option was scored — the contract-admitted absence. */
function unscoredRun(runNumber: number): AnalysisSnapshot {
  return snapshotFrom(
    response(
      [
        { id: LEADER_ID, label: LEADER_LABEL },
        { id: RIVAL_ID, label: RIVAL_LABEL },
      ],
      { hash: `resp-${runNumber}` },
    ),
    runNumber,
  )
}

/** Both scored, producer says there IS a leader. */
function scoredRun(runNumber: number, leaderWin: number, rivalWin: number): AnalysisSnapshot {
  return snapshotFrom(
    response(
      [
        { id: LEADER_ID, label: LEADER_LABEL, win: leaderWin },
        { id: RIVAL_ID, label: RIVAL_LABEL, win: rivalWin },
      ],
      { isTie: false, hash: `resp-${runNumber}` },
    ),
    runNumber,
  )
}

/** Both scored, and the producer says the two are within noise. */
function tiedRun(runNumber: number, leaderWin: number, rivalWin: number): AnalysisSnapshot {
  return snapshotFrom(
    response(
      [
        { id: LEADER_ID, label: LEADER_LABEL, win: leaderWin },
        { id: RIVAL_ID, label: RIVAL_LABEL, win: rivalWin },
      ],
      { isTie: true, hash: `resp-${runNumber}` },
    ),
    runNumber,
  )
}

function renderHero(snapshots: AnalysisSnapshot[]) {
  const state = deriveCompareState(snapshots, false)
  return render(
    <Hero snapshots={snapshots} state={state} showExpert={false} onRunAnalysis={() => {}} />,
  )
}

// ---------------------------------------------------------------------------
// THE ACCEPTANCE GATE — the minted zero, on the mounted sentence.
// ---------------------------------------------------------------------------

describe('ROADMAP 2.835 — an unscored option is never published as a confident 0%', () => {
  it('the hero does not print "Expand to EU 0%" for an option the run never scored', () => {
    const { container } = renderHero([unscoredRun(1), unscoredRun(2)])

    // Binds the IDENTITY to the quantity beside it: this cannot pass because a
    // different element happened to render "0%" elsewhere on the surface.
    expect(container.textContent).not.toMatch(new RegExp(`${LEADER_LABEL}\\s*0%`))
    // ...and no bare "0%" anywhere either.
    //
    // ⚠ NOT `not.toContain('0%')`. That is a substring predicate and it fires
    // on the "0%" inside "20%" — the first draft of this assertion did exactly
    // that and RED-ed on an honest "Enter via partner 20%". A loose value
    // predicate matching an object it was not written for is trap 19 committed
    // inside the test that exists to prevent it. `ZERO_PERCENT` requires a
    // non-digit (or start of string) before the 0.
    expect(container.textContent).not.toMatch(ZERO_PERCENT)
  })

  it('the hero does not NAME a leader the producer never claimed', () => {
    const { container } = renderHero([unscoredRun(1), unscoredRun(2)])
    expect(container.textContent).not.toMatch(new RegExp(`${LEADER_LABEL}\\s+leads`))
  })

  it('CONTRAST: a producer-sent win_probability of 0 is a measurement and still renders 0%', () => {
    // The rival was MEASURED at 0. That is a real fact and must survive — a fix
    // that turned every low value into a gap would fail here while passing the
    // two assertions above.
    //
    // Asserted on the TIE arm, deliberately: it is the arm that prints two
    // probabilities, so it is the only place the hero can render a rival's
    // zero at all — and it is the exact arm whose template carried the minted
    // "Expand to EU 0%". (The first draft asserted this on `improving`, which
    // prints only the leader's own figure, so it was pointed at a sentence that
    // never contained the quantity under test.)
    const { container } = renderHero([tiedRun(1, 0.05, 0), tiedRun(2, 0.05, 0)])
    expect(container.textContent).toContain(`${RIVAL_LABEL} 0%`)
    expect(container.textContent).toMatch(ZERO_PERCENT)
  })

  it('CONTRAST: a scored leader is still named, with its own probability', () => {
    const { container } = renderHero([scoredRun(1, 0.7, 0.2), scoredRun(2, 0.7, 0.2)])
    expect(container.textContent).toMatch(new RegExp(`${LEADER_LABEL}[^.]*70%`))
  })
})

// ---------------------------------------------------------------------------
// The claim itself — the canonical owner, asserted directly.
// ---------------------------------------------------------------------------

describe('deriveLeaderClaim is the one owner, and it declines to name an unscored option', () => {
  it('an all-unscored run yields an unclaimed claim, not a 0% named one', () => {
    const claim = deriveLeaderClaim(unscoredRun(1))
    expect(claim.kind).toBe('unclaimed')
    expect(claim.optionId).toBeNull()
    expect(claim.winProbability).toBeNull()
  })

  it('CONTRAST: a scored, producer-entitled run yields a named claim carrying its probability', () => {
    const claim = deriveLeaderClaim(scoredRun(1, 0.7, 0.2))
    expect(claim.kind).toBe('named')
    // Bound by option_id, never by the label text or by a value predicate.
    expect(claim.optionId).toBe(LEADER_ID)
    expect(claim.winProbability).toBe(70)
  })
})

// ---------------------------------------------------------------------------
// The state machine — which hero copy arm fires.
// ---------------------------------------------------------------------------

describe('deriveCompareState quotes the verdict instead of re-deriving a 17th one', () => {
  it("a run with no claimable leader selects the silent arm, never 'noWinner'", () => {
    // `noWinner` copy DENIES a leader ("No clear leading option"). The verdict
    // here is `unknown` — the producer's SILENCE — and decisionVerdict doctrine
    // is that silence licenses no claim in EITHER direction. Collapsing unknown
    // into a denial is exactly the defect the authority exists to prevent.
    expect(deriveCompareState([unscoredRun(1), unscoredRun(2)], false)).toBe('unclaimed')
  })

  it("the producer's own tie verdict — and only that — selects 'noWinner'", () => {
    const tied = (n: number) =>
      snapshotFrom(
        response(
          [
            { id: LEADER_ID, label: LEADER_LABEL, win: 0.51 },
            { id: RIVAL_ID, label: RIVAL_LABEL, win: 0.49 },
          ],
          { isTie: true, hash: `resp-${n}` },
        ),
        n,
      )
    expect(deriveCompareState([tied(1), tied(2)], false)).toBe('noWinner')
  })

  it("a leader change is claimable only when BOTH runs named one", () => {
    const flipped = snapshotFrom(
      response(
        [
          { id: RIVAL_ID, label: RIVAL_LABEL, win: 0.7 },
          { id: LEADER_ID, label: LEADER_LABEL, win: 0.2 },
        ],
        { isTie: false, hash: 'resp-2' },
      ),
      2,
    )
    expect(deriveCompareState([scoredRun(1, 0.7, 0.2), flipped], false)).toBe('flipped')

    // ...and an unclaimed run beside a named one is NOT a flip: that is a
    // change in what the PRODUCER would say, not a measured change of leader.
    expect(deriveCompareState([scoredRun(1, 0.7, 0.2), unscoredRun(2)], false)).not.toBe('flipped')
  })

  it('staleness still outranks every leader arm', () => {
    expect(deriveCompareState([unscoredRun(1), unscoredRun(2)], true)).toBe('stale')
  })
})

// ---------------------------------------------------------------------------
// The plotted series — a fabricated zero on a chart is worse than one in prose.
// ---------------------------------------------------------------------------

describe('the leader series is bound to ONE option id across runs', () => {
  it('an unscored run is a gap in the trajectory series, never a zero', () => {
    const snaps = [scoredRun(1, 0.7, 0.2), unscoredRun(2)]
    const data = buildTrajectoryData(snaps, deriveLeaderClaim(snaps[0]).optionId)

    const unscored = data.find(d => d.run === 2)
    expect(unscored).toBeDefined()
    expect(unscored!.winner).toBeNull()
    expect(unscored!.winner).not.toBe(0)
    expect(data.find(d => d.run === 1)!.winner).toBe(70)
  })

  it('CONTRAST: an honest zero still plots as zero', () => {
    // The leader option was MEASURED at 0 in run 2.
    const snaps = [scoredRun(1, 0.7, 0.2), scoredRun(2, 0, 0)]
    const data = buildTrajectoryData(snaps, LEADER_ID)
    expect(data.find(d => d.run === 2)!.winner).toBe(0)
  })

  it('the series follows the NAMED option, not each run\'s own argmax', () => {
    // Run 2's argmax is the RIVAL. A series keyed on per-run argmax would
    // attribute the rival's 70 to the leader's row — a cross-option
    // fabrication invisible to any value-based assertion.
    const run2 = snapshotFrom(
      response(
        [
          { id: RIVAL_ID, label: RIVAL_LABEL, win: 0.7 },
          { id: LEADER_ID, label: LEADER_LABEL, win: 0.2 },
        ],
        { isTie: false, hash: 'resp-2' },
      ),
      2,
    )
    const data = buildTrajectoryData([scoredRun(1, 0.7, 0.2), run2], LEADER_ID)
    expect(data.find(d => d.run === 2)!.winner).toBe(20)
  })

  it('DotProgression prints no fabricated 0% for an unscored run', () => {
    const { container } = render(
      <DotProgression snapshots={[scoredRun(1, 0.7, 0.2), unscoredRun(2)]} />,
    )
    expect(container.textContent).not.toMatch(ZERO_PERCENT)
  })

  it('CONTRAST: DotProgression still prints an honestly-measured 0%', () => {
    const { container } = render(
      <DotProgression snapshots={[scoredRun(1, 0.7, 0.2), scoredRun(2, 0, 0)]} />,
    )
    expect(container.textContent).toMatch(ZERO_PERCENT)
  })
})

// ---------------------------------------------------------------------------
// The transition delta — a delta needs two measurements.
// ---------------------------------------------------------------------------

describe('winnerProbDelta is measured on ONE option, at both ends, or not at all', () => {
  it('null when the later run never scored the leader — never a subtraction against 0', () => {
    const [tr] = deriveTransitions([scoredRun(1, 0.7, 0.2), unscoredRun(2)])
    expect(tr.winnerProbDelta).toBeNull()
    expect(tr.magnitude).toBeNull()
  })

  it('CONTRAST: a real movement on the same option is still measured', () => {
    const [tr] = deriveTransitions([scoredRun(1, 0.6, 0.2), scoredRun(2, 0.73, 0.2)])
    expect(tr.winnerProbDelta).toBe(13)
  })

  it('CONTRAST: an honest zero-to-zero movement is 0, not null', () => {
    const [tr] = deriveTransitions([scoredRun(1, 0, 0), scoredRun(2, 0, 0)])
    expect(tr.winnerProbDelta).toBe(0)
  })
})

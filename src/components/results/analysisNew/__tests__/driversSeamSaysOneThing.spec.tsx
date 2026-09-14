/**
 * ⭐⭐ THE DRIVERS SEAM SAYS ONE THING, ONCE, AND ITS SCALE DISTINGUISHES ITS
 * TWO ENDS.
 *
 * ── THE WITNESSED DEFECT (founder captures, staging `acd3db4d`, 6 Sep 2026) ──
 *
 *  1. THE SAME FACTOR RANKING RENDERED TWICE ON ONE TAB, ONE SCROLL APART.
 *     "What matters most" (`AtAGlance`) and "Drivers and dynamics"
 *     (`AnalysisNewSection` + `DriverInfluenceChart`) listed the same factors,
 *     in the same order, at the same magnitudes.
 *
 *     ⚠ DERIVED, NOT ASSUMED — the two ARE one question, at the bytes.
 *     `glanceDrivers` and `buildDrivers` (both in
 *     `buildAnalysisNewViewModel.ts`) read the SAME array
 *     (`data.drivers.drivers`), apply the SAME filter (`zeroReason == null`),
 *     take the SAME magnitude (`displayInfluence ?? 0`), and normalise it the
 *     SAME way (`magnitude / strongest`, floored at 0.04). The glance then
 *     `slice(0, GLANCE_DRIVER_COUNT)`s it and drops `direction`. So the
 *     glance's list is a strict SUBSET of the chart's rows carrying a strict
 *     SUBSET of the chart's information — a summary of a thing that was never
 *     more than a click away, not a second question.
 *
 *     ⚠ AND `analysisNewCopy.ts`'s `driverChart.title` comment SAID they were
 *     different questions — "those rank the top three by size; this one says
 *     which way each pushes". The second half is true and the first is true of
 *     BOTH: the chart's bar lengths are the same fractions. A false comment is
 *     what let the duplication read as a design decision.
 *
 *  2. THE DIVERGING SCALE LABELLED BOTH POLES WITH THE SAME THREE WORDS.
 *     `← Lowers the goal … no effect … Raises the goal →` sat above
 *     `strongest this run … no effect … strongest this run`. The geometry was
 *     and is correct; only the words could not be told apart.
 *
 * ── WHAT IS DELIBERATELY *NOT* CLAIMED HERE ─────────────────────────────────
 * The subtitle is NOT made to say the figure is structural and re-run-invariant.
 * That is false on the elasticity branch: `displayProvenance` is
 * `'influence_score' | 'normalised_elasticity'` (`results/types.ts`), and only
 * the first is the structural score.
 *
 * ⚠⚠ CORRECTED 7 Sep 2026 — THIS FILE SHIPPED THE PARAGRAPH BELOW AS "the basis
 * is disclosed CONDITIONALLY in the section caveat, one sentence per branch, and
 * the discriminating pair below is what stops either sentence reaching the run it
 * would lie about". IT WAS ALREADY FALSE WHEN IT MERGED, and it is the reason
 * `staging` went red: this spec (#1245) and `influenceScaleCopy` (#1228) landed
 * one after the other, touched different lines, merged without conflict, and
 * disagreed about one sentence.
 *
 * ⭐ THE ESTATE'S SIGNATURE DEFECT (CLAUDE.md trap 21): ONE NAME, TWO QUESTIONS.
 * Write down the question each surface answers and the disagreement dissolves.
 *
 *  • THE SCALE QUESTION — "is this figure a share of the outcome?" Answered by
 *    the section CAVEAT. The answer is NO ON BOTH BASES, and it is this app's
 *    own doing: `buildDrivers` renders every bar as
 *    `magnitude(d) / strongest` where `strongest = Math.max(...live.map(
 *    magnitude), 0)` (`buildAnalysisNewViewModel.ts`). A bar is scaled to the
 *    strongest factor in the run whatever provenance stamped it, so
 *    `coverage.setRelativeInfluence` is true unconditionally and
 *    `influenceIsSetRelative` is `drivers.length > 0`.
 *
 *  • THE QUANTITY (GROUNDING) QUESTION — "which quantity is this?" Answered PER
 *    ROW, and it genuinely does differ: `driverFinding`'s `groundedIn` and its
 *    `Basis` inspect row are keyed on `d.displayProvenance === 'influence_score'`
 *    (`buildAnalysisNewViewModel.ts`), which is where "Olumi's structural
 *    influence score" is said and where it is true.
 *
 * So the sentence this spec demanded on the caveat was not deleted by #1228 —
 * it was never the caveat's sentence. Asserting it there also asserted the
 * ABSENCE of "not a share of the outcome" on the ORDINARY run (`makeDriver`
 * defaults to `influence_score`), which is precisely the deployed defect #1228
 * merged to fix: the panel printed "Structural influence 100%." over a figure
 * that is 100% BY CONSTRUCTION. Honouring this spec would have re-shipped it.
 *
 * ⚠ AND THE PAIR HAD ALREADY GONE VACUOUS. Measured at `f4966c20`:
 * `openStrategicChallenge` stamps `["influence_score","influence_score"]` and
 * `highUncertainty` stamps `["normalised_elasticity"]`, and
 * `influenceIsSetRelative` is `true` for BOTH. The two cases were reading one
 * branch while their comments claimed they read two — a guard agreeing with
 * itself (trap 13b). The pair below is rebuilt on the surface that does
 * discriminate, and it pins its own precondition so it cannot go vacuous again.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { AtAGlance } from '../sections/AtAGlance'
import { DriverInfluenceChart } from '../sections/DriverInfluenceChart'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import { ZERO_REASON_BADGE_LABELS } from '../../influenceScaleCopy'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import { highUncertainty, makeDriver, openStrategicChallenge } from './analysisNewFixtures'

const CHART_TID = 'driver-chart'

const renderBody = (data: ResultsSectionDataReturn) =>
  render(
    <AnalysisNewTabBody
      resultsSectionData={data}
      isPreRun={false}
      isRunning={false}
      isStale={false}
      responseHash="run_drivers_seam"
    />,
  )

/**
 * ⚠ OPEN IT ONLY IF IT IS CLOSED. `AnalysisNewSection` passes
 * `defaultOpen={findings.length === 1}`, so an unconditional click CLOSES the
 * one-driver fixtures and the assertion then fails on an unmounted body rather
 * than on the property. Measured: the set-relative twin below RED-ed that way
 * before this helper existed, which would have read as a missing caveat.
 */
const openDrivers = () => {
  const toggle = screen.getByTestId('analysis-new-drivers-toggle')
  if (toggle.getAttribute('aria-expanded') !== 'true') fireEvent.click(toggle)
  expect(toggle).toHaveAttribute('aria-expanded', 'true')
}

beforeEach(() => {
  useStrengthenStore.setState({ records: {}, priorityOrder: [] } as never)
})
afterEach(() => cleanup())

describe('the factor ranking is rendered once on the tab', () => {
  it('the glance no longer restates the drivers section', () => {
    renderBody(openStrategicChallenge())

    /* POSITIVE CONTROLS, BOTH REQUIRED — and they are the whole point of this
       case. Without the first, a run that produced NO drivers satisfies the
       absence assertion vacuously (trap 13). Without the second, a glance that
       failed to render AT ALL would also satisfy it — and that is a regression,
       not this fix. */
    expect(
      screen.getByTestId('analysis-new-drivers'),
      'no drivers section — the absence below would be vacuous',
    ).toBeInTheDocument()
    expect(
      screen.getByTestId('analysis-new-glance'),
      'the glance must still render; only its driver list is removed',
    ).toBeInTheDocument()
    // The section's own promise about how many sit behind it. `openStrategic-
    // Challenge` carries two non-zero drivers.
    expect(screen.getByTestId('analysis-new-drivers-count')).toHaveTextContent('2')

    /* BOUND BY IDENTITY — the glance's own driver testids, never by the factor
       label (which the drivers section legitimately renders too, so a text
       predicate would fail on the surviving copy). */
    expect(screen.queryAllByTestId('analysis-new-glance-driver')).toHaveLength(0)
    expect(screen.queryAllByTestId('analysis-new-glance-driver-bar')).toHaveLength(0)
    expect(screen.queryByTestId('analysis-new-glance-drivers')).toBeNull()
    // The cap's self-disclosure goes with the cap. A "+N more drivers" line
    // over no drivers is a footnote to nothing.
    expect(screen.queryByTestId('analysis-new-glance-drivers-more')).toBeNull()
  })

  it('a run whose ONLY glance content was drivers now renders no glance at all', () => {
    /* ⭐⭐ WRITTEN BECAUSE A MUTANT SURVIVED, AND THE SURVIVOR WAS THE FINDING.
       Reinstating `glance.drivers.length > 0` into `AtAGlance`'s `hasAnything`
       guard RED-ed nothing: every fixture above also carries a headline or a
       verdict, so the disjunct is unobservable on them and the mutant looked
       equivalent. It is not. `hasAnything` asks "have I anything to SHOW?", and
       drivers are no longer something this component shows — so on a run whose
       only glance-worthy content was drivers, the disjunct renders the section
       wrapper over empty space. That is the "heading promising content" defect
       `AnalysisNewSection` refuses at its own early return, and a comment in
       `AtAGlance` claims this guard handles it; nothing pinned the claim.

       ⚠ THE FIXTURE IS THE WHOLE POINT — every other disjunct is nulled, so the
       assertion can only be satisfied by the drivers one being absent. */
    render(
      <AtAGlance
        isRunning={false}
        reanalyseBlocked={false}
        reanalyseBlockedReason={null}
        glance={
          {
            headline: null,
            leaderLabel: null,
            winShare: null,
            winFraction: null,
            comparisonScope: { kind: 'whole_set' },
            comparativeClaim: 'none',
            verdict: null,
            drivers: [
              { id: 'a', label: 'A', fraction: 1, targetId: null },
              { id: 'b', label: 'B', fraction: 0.4, targetId: null },
            ],
            influenceIsSetRelative: false,
            condition: null,
            inputProvenance: null,
          } as never
        }
      />,
    )
    expect(
      screen.queryByTestId('analysis-new-glance'),
      'drivers alone must no longer keep an empty glance on screen',
    ).toBeNull()
  })

  it('CONTROL: the same fixture WITH a verdict still renders the glance', () => {
    // Without this, the case above passes against an `AtAGlance` that renders
    // nothing at all — which would be a far worse regression than the one it is
    // written to catch.
    render(
      <AtAGlance
        isRunning={false}
        reanalyseBlocked={false}
        reanalyseBlockedReason={null}
        glance={
          {
            headline: null,
            leaderLabel: null,
            winShare: null,
            winFraction: null,
            comparisonScope: { kind: 'whole_set' },
            comparativeClaim: 'none',
            verdict: { tone: 'stable', label: 'Stable' },
            drivers: [],
            influenceIsSetRelative: false,
            condition: null,
            inputProvenance: null,
          } as never
        }
      />,
    )
    expect(screen.getByTestId('analysis-new-glance')).toBeInTheDocument()
  })

  it('the surviving rendering is the one that carries direction', () => {
    // DISCRIMINATOR for the deletion: it must have removed the WEAKER of the
    // two. If a later change deletes the chart instead and leaves the glance
    // list, the case above still passes and this one REDs.
    renderBody(openStrategicChallenge())
    openDrivers()
    const chart = screen.getByTestId('analysis-new-driver-chart')
    expect(chart).toBeInTheDocument()
    // Direction is the information the glance list could not carry.
    expect(chart.textContent).toContain(COPY.driverChart.lowers)
    expect(chart.textContent).toContain(COPY.driverChart.raises)
  })
})

describe('the diverging scale names its two ends differently', () => {
  const ROWS = [
    { id: 'f1', label: 'Hiring market tightness', fraction: 1, direction: 'negative' as const, targetId: 'f1' },
    { id: 'f2', label: 'Codebase quality', fraction: 0.6, direction: 'positive' as const, targetId: 'f2' },
  ]

  const renderChart = () =>
    render(
      <DriverInfluenceChart
        rows={ROWS as never}
        onFocusTarget={vi.fn()}
        onCommitOutcome={vi.fn()}
        testId={CHART_TID}
      />,
    )

  it('the left and right endpoint labels are not the same words', () => {
    // THE WITNESSED DEFECT, stated as a property rather than as two strings:
    // whatever the endpoints are called, they must be distinguishable. Written
    // this way so a later rewording cannot silently re-collapse them.
    renderChart()
    const scale = screen.getByTestId(`${CHART_TID}-scale`)
    const ends = Array.from(scale.querySelectorAll('span.w-1\\/2'))
    // CONTROL: the probe must have found both endpoint spans. Reading zero
    // would make the inequality below vacuously true on an empty array.
    expect(ends, 'the scale must render two endpoint labels').toHaveLength(2)
    const [left, right] = ends.map((el) => (el.textContent ?? '').trim())
    expect(left.length, 'the left endpoint must be labelled').toBeGreaterThan(0)
    expect(right.length, 'the right endpoint must be labelled').toBeGreaterThan(0)
    expect(left, `both ends of the scale read "${left}"`).not.toBe(right)
  })

  it('each endpoint names the direction its side of the centre means', () => {
    // Distinguishable is necessary and not sufficient: the two labels must also
    // agree with the legend directly above them, or the chart contradicts
    // itself. Bound to the shared direction words, not to new strings.
    renderChart()
    const ends = Array.from(
      screen.getByTestId(`${CHART_TID}-scale`).querySelectorAll('span.w-1\\/2'),
    ).map((el) => (el.textContent ?? '').toLowerCase())
    expect(ends).toHaveLength(2)
    expect(ends[0]).toContain('lower')
    expect(ends[1]).toContain('raise')
    // The legend's own words, so the two rows cannot drift apart.
    expect(COPY.driverChart.lowers.toLowerCase()).toContain('lower')
    expect(COPY.driverChart.raises.toLowerCase()).toContain('raise')
  })

  it('an unfocusable row routes nowhere, and a focusable one routes by its producer id', () => {
    /* ⭐ THE FAIL-CLOSED FOCUS RULE, INHERITED FROM THE RETIRED GLANCE CASES —
       in the shape the chart actually implements it. The glance rendered a row
       as plain text when `targetId` was null; the chart's row is ALWAYS a button
       (pressing it opens the value editor) and guards the CALL instead. Same
       rule, different mechanism, so it needed re-pinning rather than deleting.

       ⚠ THE PAIR IS THE EVIDENCE. The null case alone passes against a chart
       that never routes at all. */
    const onFocusTarget = vi.fn()
    render(
      <DriverInfluenceChart
        rows={
          [
            { id: 'f1', label: 'Unroutable', fraction: 1, direction: 'negative', targetId: null },
            { id: 'f2', label: 'Routable', fraction: 0.6, direction: 'positive', targetId: 'node_f2' },
          ] as never
        }
        onFocusTarget={onFocusTarget}
        onCommitOutcome={vi.fn()}
        testId={CHART_TID}
      />,
    )
    const bars = screen.getAllByTestId(`${CHART_TID}-bar`)
    expect(bars, 'both rows must render — otherwise this tests nothing').toHaveLength(2)
    fireEvent.click(bars[0]!.closest('button')!)
    expect(onFocusTarget, 'a null target must reach no route').not.toHaveBeenCalled()
    fireEvent.click(bars[1]!.closest('button')!)
    expect(onFocusTarget).toHaveBeenCalledWith('node_f2')
  })

  it('CONTRAST CONTROL (relocated): a driver LABEL may still truncate', () => {
    /* ⛔→⭐ INHERITED FROM `atAGlance.spec.tsx`, WHOSE OBJECT THIS FIX DELETED.
       It is the contrast half of the panel's clipping rule: producer PROSE must
       never sit in a clipping container, and a LABEL may, because a fixed track
       beside it is what makes the bars comparable. Without a live contrast, the
       prose rule reads as "never truncate anything".

       `AtAGlance` now truncates nothing at all, so the only truncating label
       left on this panel is the chart's row — which is where the control has to
       live to keep meaning anything. */
    renderChart()
    const rows = screen.getAllByTestId(`${CHART_TID}-bar`)
    expect(rows.length, 'no rows rendered — this control would be vacuous').toBeGreaterThan(0)
    const label = rows[0]!.closest('li')!.querySelector('.truncate')
    expect(label, 'no truncating label left to contrast the prose rule against').not.toBeNull()
  })

  it('DISCRIMINATOR: the scale still refuses to assert a share of the outcome', () => {
    // Inherited from `driverChartHasAScale.spec.tsx` and restated here because
    // the endpoints are being reworded: "raises 40% of the outcome" is the
    // easiest thing to reach for while renaming them, and it is the one claim
    // neither basis licenses (`buildAnalysisNewViewModel`'s `strongest`).
    renderChart()
    const text = screen.getByTestId(`${CHART_TID}-scale`).textContent ?? ''
    expect(text, `the scale must not assert a percentage: "${text}"`).not.toMatch(/\d\s*%/)
    expect(text).not.toMatch(/share|of the outcome|total/i)
  })
})

describe('the drivers section states which basis its magnitudes are on', () => {
  /**
   * ⚠ THE PAIR IS STILL THE EVIDENCE — but it is a pair across the two
   * QUESTIONS, not across two branches of one sentence. See the module header:
   * the scale answer is provenance-INDEPENDENT and the grounding answer is
   * provenance-KEYED, so a pair that varies only the fixture cannot see either.
   *
   * ⚠ NO COPY IS TYPED HERE. Every expected sentence is the `ANALYSIS_NEW_COPY`
   * constant the component itself consumes, bound by identity. That is the
   * mechanism, not a preference: the red this file caused was a hand-typed
   * second copy of one sentence drifting from its owner (CLAUDE.md trap 12),
   * and `theCaveatHasOneSourceOfTruth` below FAILS if a literal comes back.
   */
  const provenancesOf = (data: ResultsSectionDataReturn) =>
    (data.drivers.drivers ?? []).map((d) => d.displayProvenance)

  const caveatText = (data: ResultsSectionDataReturn) => {
    renderBody(data)
    openDrivers()
    return screen.getByTestId('analysis-new-drivers-caveat').textContent ?? ''
  }

  const findingsOf = (data: ResultsSectionDataReturn) =>
    buildAnalysisNewViewModel({
      data,
      recommendations: [],
      isPreRun: false,
      isRunning: false,
      isStale: false,
    }).drivers.findings

  it('PRECONDITION: the two fixtures really are on different bases', () => {
    /* ⭐⭐ WITHOUT THIS THE WHOLE BLOCK IS VACUOUS, AND IT SILENTLY WAS. At
       `f4966c20` both cases below read the SAME branch while their comments
       claimed otherwise, because `influenceIsSetRelative` had become
       `drivers.length > 0`. A fixture drifting to one provenance would restore
       exactly that, and every assertion here would keep passing. This case is
       what makes the two that follow mean anything (trap 13b: a discriminator
       must pin its own precondition in-test). */
    const structural = provenancesOf(openStrategicChallenge())
    const elasticity = provenancesOf(highUncertainty())
    expect(structural.length, 'the structural fixture must carry rows').toBeGreaterThan(0)
    expect(elasticity.length, 'the elasticity fixture must carry rows').toBeGreaterThan(0)
    expect(new Set(structural), 'the structural fixture must be all influence_score').toEqual(
      new Set(['influence_score']),
    )
    expect(new Set(elasticity), 'the elasticity fixture must be all normalised_elasticity').toEqual(
      new Set(['normalised_elasticity']),
    )
  })

  it('the SCALE sentence is the same on both bases, because every bar is scaled the same way', () => {
    /* #1228's ruling, pinned. `buildDrivers` divides every magnitude by
       `strongest` whatever stamped it, so "not a share of the outcome" is owed
       to BOTH runs. Asserting the structural run must NOT say it — which is what
       this file used to do — withholds the disclosure on the ORDINARY run, which
       is the deployed defect #1228 closed. */
    const structural = caveatText(openStrategicChallenge())
    cleanup()
    const elasticity = caveatText(highUncertainty())
    expect(structural).toContain(COPY.coverage.setRelativeInfluence)
    expect(elasticity).toContain(COPY.coverage.setRelativeInfluence)
    // NEITHER may answer the quantity question here. That is the row's job, and
    // a caveat that names one quantity is false for the run stamped the other.
    expect(structural).not.toContain(COPY.coverage.structuralInfluence)
    expect(elasticity).not.toContain(COPY.coverage.structuralInfluence)
  })

  it('DISCRIMINATOR: the QUANTITY question is answered per row, and it DOES differ', () => {
    /* ⭐ #1245'S REAL CONCERN, PINNED WHERE IT IS TRUE. The sentence that PR
       wanted was not lost when the caveat stopped branching — it lives on the
       row (`driverFinding.groundedIn`, keyed on `displayProvenance`). If a later
       change collapses the grounding onto the scale flag the way the caveat is,
       every row would name one quantity and this REDs. */
    const structural = findingsOf(openStrategicChallenge())[0]
    const elasticity = findingsOf(highUncertainty())[0]
    expect(structural, 'no structural finding — the comparison would be vacuous').toBeDefined()
    expect(elasticity, 'no elasticity finding — the comparison would be vacuous').toBeDefined()
    expect(
      structural!.groundedIn,
      'the two bases must not be described by one grounding noun',
    ).not.toBe(elasticity!.groundedIn)
    /* The structural row's noun is the SAME noun the structural copy uses —
       bound to the constant rather than retyped, so the two surfaces cannot
       drift into two spellings of one quantity (trap 12). */
    expect(COPY.coverage.structuralInfluence).toContain(String(structural!.groundedIn))
  })
})

/**
 * ⭐⭐⭐ THE CLASS PIN: ONE SENTENCE, ONE SOURCE OF TRUTH.
 *
 * The red this file caused was NOT "an expectation was wrong". It was that the
 * caveat's wording existed in TWO places — `analysisNewCopy.ts` and a string
 * typed into this spec — so #1228 could change one while #1245 changed the
 * other, both stay green in isolation, and `git` merges them without a conflict
 * because they touch different lines. That is CLAUDE.md trap 12 (the
 * hand-maintained mirror) reaching the test suite, and flipping the literal
 * would leave the mechanism intact for the next pair of PRs.
 *
 * These two cases remove the mirror rather than re-syncing it:
 *  1. the arm SELECTION is derived from the component's own inputs, so a change
 *     to the predicate REDs here instead of silently re-pointing a sentence;
 *  2. this spec is asserted to contain NO verbatim copy of any basis sentence,
 *     so a future author cannot reintroduce the second source of truth.
 */
describe('theCaveatHasOneSourceOfTruth', () => {
  const noRows = (over: Partial<ResultsSectionDataReturn> = {}): ResultsSectionDataReturn => {
    const base = openStrategicChallenge()
    return { ...base, drivers: { ...base.drivers, drivers: [] }, ...over } as ResultsSectionDataReturn
  }

  const caveatOf = (data: ResultsSectionDataReturn) => {
    renderBody(data)
    openDrivers()
    return screen.queryByTestId('analysis-new-drivers-caveat')?.textContent ?? ''
  }

  it('the basis line is the set-relative sentence where bars are drawn, and NOTHING where they are not', () => {
    /**
     * ⚠⚠ THE CONDITION CHANGED, SO THE PIN CHANGED — 7 Sep 2026. This case was
     * named 'every basis arm is reachable, and each renders exactly its own
     * constant' and asserted the reference arm on `noRows({sensitivityReference})`
     * and the structural arm on `noRows()`. Both of those RENDERED A BASIS
     * SENTENCE OVER AN EMPTY STATE, which is the defect this PR fixes; the old
     * case's own comment reported the structural wording as "MEASURED, NOT
     * BLESSED" and pinned the condition without endorsing it. The condition is
     * now different, so what is pinned is different — and it is STRICTLY
     * STRONGER, not weaker: the old copy cannot satisfy any assertion below.
     *
     * ⚠ NOT ALL THREE ARMS ARE REACHABLE ANY MORE, and claiming they were is
     * what the title used to do. `driversCaveat` evaluates the ternary only when
     * `influenceRows`/`findings` are non-empty, and `buildDrivers` derives both
     * from a subset of `drivers` — so `influenceIsSetRelative` is necessarily
     * true there and the first arm always wins. The unreachability of the other
     * two is pinned by `theBasisLineHasNoReferentWithoutBars` below, on
     * builder-produced view models rather than fabricated ones.
     *
     * ⚠⚠ #1262 REWROTE THIS SAME CASE ON `staging`, AND ITS ASSERTIONS ARE KEPT
     * HERE ALONGSIDE THESE (merged 8 Sep 2026). Its note stands VERBATIM and
     * unamended — `driversCaveat` now returns null when `influenceRows` is
     * empty.
     *
     * ⭐ THIS SENTENCE WAS BRIEFLY REWRITTEN IN THE MERGE AND IS RESTORED. The
     * resolution struck it out and replaced it with a claim that the gate
     * "withholds the BASIS SENTENCE ... and lets the EXCLUSION line through",
     * making the null return look fixture-dependent. That is FALSE, and an
     * independent review of the resolution caught it. Derived at the bytes:
     * `AnalysisNewTabBody.tsx:373` is `if (vm.drivers.influenceRows.length ===
     * 0) return null`, the FIRST statement of `driversCaveat` — so no path
     * exists on which `influenceRows` is empty and the exclusion clause still
     * renders. The `toBe('')` below holds BECAUSE OF THE GATE, not because
     * these fixtures happen to carry no suppressed rows. #1262's original text
     * was correct; the amendment was not. The rest of #1262's note, verbatim: "That gate CHANGES WHICH ARMS
     * ARE REACHABLE, and this case states the new reachability rather than
     * re-pointing an expectation. The previous version of this case pinned the
     * structural arm as reachable 'ONLY on a run with NO rows — where its own
     * sentence opens "Each bar shows"', and called that wording 'a live finding
     * reported with this fix'. That finding is now CLOSED: the sentence no
     * longer renders there."
     *
     * ⚠ BOTH FORMS OF ASSERTION ARE KEPT, AND THEY ARE NOT REDUNDANT. `toBe('')`
     * is the stronger claim (nothing rendered at all); the `not.toContain` pairs
     * name WHICH sentences may not appear, binding to the copy constants by
     * identity so a reworded constant cannot satisfy them by accident (trap 19).
     */
    const withRows = caveatOf(openStrategicChallenge())
    expect(withRows, 'CONTROL: the probe finds a caveat when one renders').toContain(
      COPY.coverage.setRelativeInfluence,
    )
    cleanup()

    /* ⚠ THE REFERENCE LINE IS NO LONGER REACHABLE, AND ITS OLD ARM RENDERED IT
       OVER AN EMPTY STATE. Reproduced at `cdd2f9d8`: "Sensitivities are measured
       against Hold price." directly above "This run did not return factor
       influence.". The producer's own reference disclosure being starved by
       #1228 is a REPORTED FINDING, not a decision taken here — see
       `coverage.referencePrefix`'s block. */
    const withReference = caveatOf(
      noRows({ sensitivityReference: { optionLabel: 'Hold price' } } as Partial<ResultsSectionDataReturn>),
    )
    expect(withReference).not.toContain(COPY.coverage.referencePrefix)
    expect(withReference).not.toContain('Hold price')
    /* #1262's stronger form of the same claim: no rows ⇒ no ranking ⇒ no basis
       claim, and nothing else in its place either. */
    expect(withReference).toBe('')
    cleanup()

    /* ⚠⚠ THE ARM WHOSE SENTENCE OPENS "Each bar shows", ON A RUN THAT DREW NO
       BARS. Reproduced at `cdd2f9d8` beside "This run did not return factor
       influence.", with the chart absent. */
    const structuralArm = caveatOf(noRows())
    expect(structuralArm).not.toContain(COPY.coverage.structuralInfluence)
    expect(structuralArm).not.toContain(COPY.coverage.setRelativeInfluence)
    /* #1262's stronger form, on the other former arm. */
    expect(structuralArm).toBe('')
  })

  /**
   * ⚠⚠ A REPORTED CONSEQUENCE, PINNED SO IT CANNOT DRIFT SILENTLY — NOT AN
   * ENDORSEMENT, AND NOT MINE TO RESOLVE.
   *
   * The gate leaves TWO of the three basis arms with no reachable render path,
   * and it is arithmetic rather than judgement: the gate passes only when
   * something is on display; `influenceRows` and `findings` are both built from
   * the rows that survived suppression, so either being non-empty implies a
   * non-empty `drivers`; and `influenceIsSetRelative` IS `drivers.length > 0`.
   * So wherever the BASIS renders at all, the set-relative arm is taken.
   *
   * `structuralInfluence` and `referencePrefix` are therefore dead through this
   * component. Deleting them, or re-gating the reference line on something
   * other than `!influenceIsSetRelative` so it can be said alongside a ranking,
   * is a decision for the lane that owns the basis branch. This case exists so
   * that whichever way it goes, it goes deliberately.
   *
   * ⚠ THIS CASE READS THE CAVEAT, WHICH IS NOT ONLY THE BASIS. The three
   * fixtures below carry no suppressed rows, so the absence assertions are
   * about the two basis constants specifically, never about the caveat being
   * empty.
   *
   * ⭐ CORRECTED IN THE MERGE, AFTER AN INDEPENDENT REVIEW OF THE RESOLUTION.
   * This note previously said that on an all-suppressed run "the caveat
   * carries the EXCLUSION sentence and no basis at all", and that the twin
   * `theBasisLineHasNoReferentWithoutBars` pinned that. BOTH HALVES WERE
   * FALSE, and the second is the costlier kind — a false claim about what a
   * NAMED test pins, which a later reader trusts instead of opening it.
   * Derived at the bytes: on an all-suppressed run `influenceRows` is empty,
   * so the gate at `AnalysisNewTabBody.tsx:373` fires and `driversCaveat`
   * returns null — no caveat node renders at all. The twin asserts exactly
   * that, at `:910`: `expect(caveatNode(), 'no caveat over an empty
   * ranking').toBeNull()` — the opposite of what this note claimed.
   */
  it('records that two basis arms are now unreachable — owed to the basis-branch owner', () => {
    /* ⚠ ONE RENDER AT A TIME. `caveatOf` renders into the shared container, so
       collecting these in an array literal leaves three trees mounted and the
       testid query throws "multiple elements" before any assertion runs — a
       harness failure that reads exactly like a failed claim. */
    const reachable: string[] = []
    for (const data of [
      () => openStrategicChallenge(),
      () => noRows(),
      () => noRows({ sensitivityReference: { optionLabel: 'Hold price' } } as Partial<ResultsSectionDataReturn>),
    ]) {
      reachable.push(caveatOf(data()))
      cleanup()
    }
    // POSITIVE CONTROL: at least one arm must actually render, or the two
    // absence assertions below are vacuous (trap 13).
    expect(reachable.some((c) => c.length > 0), 'no caveat rendered at all — the probe is blind').toBe(true)
    expect(reachable.some((c) => c.includes(COPY.coverage.structuralInfluence))).toBe(false)
    expect(reachable.some((c) => c.includes(COPY.coverage.referencePrefix))).toBe(false)
  })

  it('this spec types no copy of its own — the mirror cannot come back', () => {
    /* ⭐ THE ACTUAL REGRESSION PIN FOR THE CLASS. Reads its OWN source and
       refuses any verbatim basis sentence. Re-typing "Influence is relative to
       the other factors in this run, not a share of the outcome." here — the
       shape that produced the red — REDs immediately, at authoring time, in the
       file that would carry the drift. */
    const source = readFileSync(fileURLToPath(import.meta.url), 'utf8')
    // POSITIVE CONTROL: the probe must be reading this file and not an empty
    // string, or every absence below is vacuous (trap 13).
    expect(source.length, 'own source unreadable — the assertions would be vacuous').toBeGreaterThan(
      2000,
    )
    expect(source, 'the probe is not pointed at this spec').toContain('theCaveatHasOneSourceOfTruth')

    const owned: readonly string[] = [
      COPY.coverage.setRelativeInfluence,
      COPY.coverage.structuralInfluence,
      COPY.coverage.referencePrefix,
    ]
    for (const sentence of owned) {
      expect(
        source.includes(sentence),
        `this spec types a copy of "${sentence}" — import it from ANALYSIS_NEW_COPY instead`,
      ).toBe(false)
    }
  })
})

/**
 * ⭐⭐ THE FILTER THAT DELETED THE CANVAS'S RANK-1 FACTOR NOW DECLARES ITSELF.
 *
 * ── DERIVED, at `e15416ad` ──────────────────────────────────────────────────
 * `buildDrivers` drops every row with `zeroReason != null`. `ZeroReasonCode`
 * (`results/types.ts`) is `'intervention_override' | 'disconnected' |
 * 'zero_outcome_diff'`, and `mapV5AnalysisToReport.ts` documents the first as
 * the stamp for PINNED factors — a factor held fixed by the options, which
 * therefore has no SENSITIVITY while keeping its `influence_score`. The canvas
 * ranks by `influence_score` (`deriveFactorInfluenceMap`, whose own comment
 * spells out this exact case: "a pinned/intervention-overridden factor carries
 * sensitivity 0 while being the model's most influential"), so it puts that
 * factor at #1 while this panel deleted it.
 *
 * ⚠ THE FILTER IS DELIBERATE AND IS NOT BEING REMOVED HERE. Whether a pinned
 * factor belongs in a drivers ranking is a product question with two surfaces
 * already disagreeing about it — the legacy `DriversSection` KEEPS it and
 * badges it. What is fixed is that the exclusion was SILENT:
 * `suppressedZeroCount` reached the DOM through one line only
 * (`driversEmptyMessage`), which `AnalysisNewSection` renders when
 * `findings.length === 0` — so with survivors the count was computed, stored,
 * and never shown.
 *
 * ⚠ THE REASON IS NAMED PER CODE, NOT SUMMARISED. `analysisNewCopy.ts` already
 * ruled on this for `driversAllZero`: "three reasons cannot share one summary
 * without one of them being described wrongly". The labels are the ones
 * `DriversSection` already renders, imported rather than respelled.
 */
describe('the drivers section declares what it left out', () => {
  const withSuppressed = (): ResultsSectionDataReturn => {
    const base = openStrategicChallenge()
    return {
      ...base,
      drivers: {
        ...base.drivers,
        drivers: [
          // The pinned rank-1: highest influence, stamped by the producer.
          makeDriver({
            factorKey: 'f_pinned',
            factorLabel: 'Technical leadership capacity',
            displayInfluence: 1,
            rank: 1,
            zeroReason: 'intervention_override',
          }),
          ...(base.drivers.drivers ?? []),
        ],
      },
    }
  }

  it('names how many rows it dropped, and the producer’s reason for each', () => {
    renderBody(withSuppressed())
    openDrivers()
    const caveat = screen.getByTestId('analysis-new-drivers-caveat').textContent ?? ''
    // POSITIVE CONTROL: the survivors are still listed, so this is a partial
    // exclusion and not an empty section wearing a disclosure.
    expect(screen.getByTestId('analysis-new-drivers-count')).toHaveTextContent('2')
    expect(caveat).toContain('1')
    // The producer's own words for WHY, bound to the shared map by identity
    // rather than to a string typed here.
    /* ⚠ CASE-INSENSITIVE, DELIBERATELY. The map holds BADGE labels, which open
       with a capital; `coverage.notRanked` splices them mid-sentence and lowers
       the first character (`clauseCase`). Comparing rendered text against the
       map constant is a guard agreeing with itself about casing anyway — both
       sides move together — so this asserts the property it was written for
       (the reason reaches the reader) and leaves the casing to
       `zeroReasonClauseJoin.spec.tsx`, which pins it with literals. */
    expect(caveat.toLowerCase())
      .toContain(ZERO_REASON_BADGE_LABELS.intervention_override.toLowerCase())
  })

  it('TWIN: says nothing about exclusions when it excluded nothing', () => {
    // The discriminating half. Without it a component that printed the
    // disclosure unconditionally passes the case above and lies on every run
    // that dropped no rows — the "+N more" defect one level down.
    renderBody(openStrategicChallenge())
    openDrivers()
    const caveat = screen.queryByTestId('analysis-new-drivers-caveat')?.textContent ?? ''
    /* ⚠ ALSO CASE-INSENSITIVE, AND FOR A SHARPER REASON THAN ITS TWIN ABOVE. A
       case-SENSITIVE negative here would pass against a caveat that had come
       back carrying the CLAUSE form, so the discriminating half would have gone
       blind at exactly the moment the composer started lowercasing. */
    expect(caveat.toLowerCase())
      .not.toContain(ZERO_REASON_BADGE_LABELS.intervention_override.toLowerCase())
    expect(caveat).not.toMatch(/not ranked/i)
  })

  it('the dropped row is still absent from the chart — this discloses, it does not reinstate', () => {
    // ⚠ THE LOAD-BEARING NEGATIVE. The honest fix is a disclosure, not a data
    // change; if a later edit "helpfully" reinstates the pinned row, the chart
    // would rank a factor by an influence the run did not measure sensitivity
    // for, and this REDs.
    renderBody(withSuppressed())
    openDrivers()
    const chart = screen.getByTestId('analysis-new-driver-chart')
    expect(chart.textContent).not.toContain('Technical leadership capacity')
    expect(chart.textContent).toContain('Supplier lead time')
  })
})

/**
 * ⭐⭐⭐ THE BASIS LINE HAS NO REFERENT WITHOUT BARS — the defect, and the
 * unreachability it creates, both pinned.
 *
 * ── THE WITNESSED DEFECT (Paul, staging `f4966c20`; reproduced through this
 *    component at `cdd2f9d8`) ───────────────────────────────────────────────
 * `AnalysisNewSection` early-returns only when `findings.length === 0 &&
 * !emptyMessage`, and `driversEmptyMessage` is non-null on every post-run
 * shape — so the Drivers section RENDERS when it has nothing to show, and the
 * caveat rendered with it. All three basis arms did this, measured:
 *
 *   drivers: []                      "Each bar shows Olumi's structural influence
 *                                     score, scaled against the strongest factor
 *                                     in this run."
 *                                    above "This run did not return factor
 *                                     influence." — chart absent, 0 bars.
 *   drivers: [] + reference option   the reference sentence — "Sensitivities
 *                                     are measured against <option>." — above
 *                                     the same empty message.
 *   every row zeroReason'd           "Influence is relative to the other factors
 *                                     in this run, not a share of the outcome."
 *                                    above "…every factor came back at zero."
 *
 * ⚠ THE THIRD ROW OF THAT TABLE QUOTES A BUILD, NOT THE CURRENT COPY. "…every
 * factor came back at zero." is `empty.driversAllZero`, which #1262 DELETED as
 * a zero the producer never measured; its replacement is
 * `empty.noneRanked(count, reasons)`. The line is kept verbatim because it is a
 * dated record of what `f4966c20` actually put on screen — evidence, not a
 * fixture to keep current.
 *
 * ── WHAT IS PINNED, AND IN BOTH DIRECTIONS ─────────────────────────────────
 *  1. no basis sentence where nothing is on display (the fix);
 *  2. the reasons SURVIVE that suppression, and are said EXACTLY ONCE (the
 *     over-suppression twin). ⚠ AMENDED AT THE #1262 MERGE, 8 Sep 2026:
 *     ~~the EXCLUSION sentence survives that suppression — a blanket `return
 *     null` passes 1 and REDs here~~. #1260 kept `coverage.notRanked` in the
 *     caveat on an all-suppressed run because its base's empty message stated
 *     the outcome without naming reasons. `empty.noneRanked` now names the
 *     count AND the labels, so keeping both would print one fact twice; the
 *     blanket suppression is therefore CORRECT here and the twin pins the
 *     property (the reasons reach the reader) rather than the carrier;
 *  3. the basis sentence still renders where bars ARE drawn (the other
 *     over-suppression twin);
 *  4. UNREACHABILITY, derived rather than asserted: `buildDrivers` filters
 *     `live` out of `drivers`, so bars imply `influenceIsSetRelative`, so the
 *     reference and structural arms cannot be reached by any run the BUILDER
 *     can produce. A fabricated view model can still reach them — which is why
 *     this is asserted on builder output, never on a hand-made `vm`
 *     (CLAUDE.md trap 16-inverse: a fixture you wrote yourself is not evidence
 *     about what the producer can emit).
 *
 * ⚠ THE TWO UNREACHABLE CONSTANTS ARE KEPT ON PURPOSE, and this file is where
 * that is enforced. `coverage.referencePrefix` is a producer disclosure #1228
 * starved as a side effect — deleting it would ratify the loss silently.
 * `coverage.structuralInfluence` is the single spelling of the grounding noun
 * that `driverFinding.groundedIn` is bound to two describes above; deleting it
 * would force that assertion to retype the sentence and rebuild the mirror
 * `theCaveatHasOneSourceOfTruth` exists to forbid.
 */
describe('theBasisLineHasNoReferentWithoutBars', () => {
  const noRows = (over: Partial<ResultsSectionDataReturn> = {}): ResultsSectionDataReturn => {
    const base = openStrategicChallenge()
    return { ...base, drivers: { ...base.drivers, drivers: [] }, ...over } as ResultsSectionDataReturn
  }

  const allSuppressed = (): ResultsSectionDataReturn => {
    const base = openStrategicChallenge()
    return {
      ...base,
      drivers: {
        ...base.drivers,
        drivers: (base.drivers.drivers ?? []).map((d) => ({
          ...d,
          zeroReason: 'intervention_override' as const,
        })),
      },
    } as ResultsSectionDataReturn
  }

  const sectionOf = (data: ResultsSectionDataReturn) => {
    renderBody(data)
    openDrivers()
    return screen.getByTestId('analysis-new-drivers')
  }

  const caveatNode = () => screen.queryByTestId('analysis-new-drivers-caveat')

  const vmOf = (data: ResultsSectionDataReturn) =>
    buildAnalysisNewViewModel({
      data,
      recommendations: [],
      isPreRun: false,
      isRunning: false,
      isStale: false,
    })

  it('CONTROL: the probe can see a basis sentence when one renders', () => {
    /* Without this, every absence below could mean the caveat testid moved, the
       section failed to open, or the sentence was reworded — none of which is
       the property (CLAUDE.md trap 13). */
    const section = sectionOf(openStrategicChallenge())
    expect(caveatNode(), 'no caveat node at all — the absences below would be vacuous').not.toBeNull()
    expect(caveatNode()!.textContent).toContain(COPY.coverage.setRelativeInfluence)
    expect(section.textContent).toContain(COPY.coverage.setRelativeInfluence)
    expect(
      screen.getByTestId('analysis-new-driver-chart'),
      'the control fixture must actually draw bars',
    ).toBeInTheDocument()
  })

  it('drivers: [] — the section renders its empty message and NO basis sentence', () => {
    const section = sectionOf(noRows())

    /* PRECONDITIONS, both required. The first is what makes the absence
       non-vacuous: `AnalysisNewSection` does NOT early-return here, so the
       caveat had every opportunity to render. The second is the referent — the
       thing the sentence claims to explain — measured absent. */
    expect(
      section.textContent,
      'PRECONDITION: the section must still render its empty message',
    ).toContain(COPY.empty.drivers)
    expect(
      screen.queryByTestId('analysis-new-driver-chart'),
      'PRECONDITION: no bars, or the caveat would have a referent',
    ).toBeNull()
    expect(vmOf(noRows()).drivers.influenceRows, 'PRECONDITION: no influence rows').toHaveLength(0)

    expect(caveatNode(), 'a caveat over nothing').toBeNull()
    expect(section.textContent).not.toContain(COPY.coverage.structuralInfluence)
    expect(section.textContent).not.toContain(COPY.coverage.setRelativeInfluence)
  })

  it('drivers: [] with a disclosed reference option — still no basis sentence', () => {
    const section = sectionOf(
      noRows({ sensitivityReference: { optionLabel: 'Hold price' } } as Partial<ResultsSectionDataReturn>),
    )
    expect(
      vmOf(noRows({ sensitivityReference: { optionLabel: 'Hold price' } } as Partial<ResultsSectionDataReturn>))
        .drivers.referenceOptionLabel,
      'PRECONDITION: the builder must actually carry the reference label, or this arm was never in play',
    ).toBe('Hold price')
    expect(caveatNode()).toBeNull()
    expect(section.textContent).not.toContain(COPY.coverage.referencePrefix)
    expect(section.textContent).not.toContain('Hold price')
  })

  it('TWIN: an all-suppressed run still owes its reader the reasons — said ONCE, by the empty message', () => {
    /**
     * ⭐ THE DISCRIMINATING HALF: rows exist, every one is zeroReason'd, so
     * there are no bars AND there are reasons the reader is owed. The two
     * empty-drivers cases above are satisfied by any suppression whatsoever;
     * this one is about what SURVIVES it, and it is the case that decided the
     * shape of the gate.
     *
     * ⚠⚠ RE-TARGETED AT THE #1262 MERGE, 8 Sep 2026, AND THE REASON MATTERS
     * MORE THAN THE EDIT. This case was named 'an all-suppressed run keeps its
     * EXCLUSION sentence and loses only the basis one' and asserted the caveat
     * survived carrying `coverage.notRanked`, above
     * ~~`COPY.empty.driversAllZero`~~. Both halves of that are gone:
     *
     *  · `empty.driversAllZero` was DELETED by #1262 — it asserted a zero the
     *    producer never measured. Left as written, this assertion reads
     *    `toContain(undefined)`, which is a harness failure wearing the clothes
     *    of a failed claim.
     *  · its replacement, `empty.noneRanked(count, reasons)`, NAMES THE COUNT
     *    AND THE REASON LABELS — from the very `ZERO_REASON_BADGE_LABELS` map
     *    `coverage.notRanked` uses. So the branch this case used to pin now
     *    prints one fact TWICE, in two adjacent paragraphs, on the tab #1243
     *    had just stopped printing a paragraph twice on.
     *
     * The PROPERTY the case was written to protect is unchanged and is what is
     * asserted below: an all-suppressed run must not lose its reasons. What
     * changed is which surface carries them — so the pin is now "exactly one",
     * which REDs if the caveat clause comes back AND REDs if the empty message
     * stops naming them. The old form could only see the second failure.
     */
    const section = sectionOf(allSuppressed())
    const vm = vmOf(allSuppressed())
    expect(vm.drivers.influenceRows, 'PRECONDITION: no bars').toHaveLength(0)
    expect(vm.drivers.suppressedZeroCount, 'PRECONDITION: rows were suppressed').toBeGreaterThan(0)
    expect(
      vm.drivers.influenceIsSetRelative,
      'PRECONDITION: the flag is TRUE here — so this case proves the gate is not the flag',
    ).toBe(true)

    /* The reasons are still owed, and still reach the reader. */
    /* ⚠ LOWERCASED ON BOTH SIDES. `empty.noneRanked` splices these BADGE labels
       mid-sentence and lowers the first character (`clauseCase`), so a
       case-sensitive compare against the map constant asserts a casing this
       sentence deliberately does not use. The count below is what makes this a
       duplication pin, and it needs the same treatment or it counts zero. */
    const label = ZERO_REASON_BADGE_LABELS.intervention_override.toLowerCase()
    expect(
      screen.getByTestId('analysis-new-drivers-empty').textContent?.toLowerCase(),
      'the empty message must name the producer reason',
    ).toContain(label)

    /* ⭐ SAID ONCE. Counting occurrences across the whole section is what makes
       this a duplication pin rather than a presence check: a caveat that also
       named the reason would push this to 2 and RED, which is exactly the
       regression the merge could have shipped. */
    const occurrences = (section.textContent ?? '').toLowerCase().split(label).length - 1
    expect(occurrences, `"${label}" must appear exactly once in the section`).toBe(1)

    /* And no basis sentence, on a run that drew nothing — the gate's own claim. */
    expect(caveatNode(), 'no caveat over an empty ranking').toBeNull()
    expect(section.textContent).not.toContain(COPY.coverage.setRelativeInfluence)
  })

  it('UNREACHABLE BY CONSTRUCTION: bars imply the set-relative flag, so no builder run reaches the lower arms', () => {
    /**
     * ⚠ THE DERIVATION, EXECUTED RATHER THAN ARGUED. `buildDrivers` computes
     * `live = drivers.filter(d => d.zeroReason == null)` and builds BOTH
     * `findings` and `influenceRows` from it, while `influenceIsSetRelative` is
     * `drivers.length > 0`. So `influenceRows` non-empty ⟹ `drivers` non-empty
     * ⟹ the flag. `driversCaveat` evaluates its ternary only when something is
     * on display, so the first arm always wins there.
     *
     * ⚠ ASSERTED OVER BUILDER OUTPUT, and the shapes are chosen to span the
     * cases: bars, no rows at all, and rows that all suppressed.
     */
    const CASES: ReadonlyArray<readonly [string, ResultsSectionDataReturn]> = [
      ['openStrategicChallenge', openStrategicChallenge()],
      ['highUncertainty', highUncertainty()],
      ['noRows', noRows()],
      ['noRows + reference', noRows({ sensitivityReference: { optionLabel: 'Hold price' } } as Partial<ResultsSectionDataReturn>)],
      ['allSuppressed', allSuppressed()],
    ]
    let withBars = 0
    for (const [name, data] of CASES) {
      const vm = vmOf(data)
      /* ⚠ THE SELECTOR IS THE GATE'S OWN PREDICATE, not a paraphrase of it.
         #1260 wrote this as `influenceRows.length > 0 || findings.length > 0`;
         the merged gate is `influenceRows` alone (#1262's binding), and the two
         are equal by construction — `findings` and `influenceRows` are both
         built from `live` with no filter between them. Bound to the gate rather
         than to the disjunction so a change to either REDs instead of drifting
         (CLAUDE.md trap 12). */
      const shows = vm.drivers.influenceRows.length > 0
      if (!shows) continue
      withBars += 1
      expect(vm.drivers.influenceIsSetRelative, `${name}: figures on display imply the flag`).toBe(true)
    }
    // The sweep must have SEEN the case it generalises over (trap 13e).
    expect(withBars, 'no case put figures on display — the implication is vacuous').toBeGreaterThan(0)

    /* And the rendered consequence, over every shape: no caveat this panel can
       produce carries either lower-arm sentence. */
    for (const [name, data] of CASES) {
      const section = sectionOf(data)
      expect(section.textContent, `${name}: the structural sentence reached a screen`).not.toContain(
        COPY.coverage.structuralInfluence,
      )
      expect(section.textContent, `${name}: the reference sentence reached a screen`).not.toContain(
        COPY.coverage.referencePrefix,
      )
      cleanup()
    }
  })
})

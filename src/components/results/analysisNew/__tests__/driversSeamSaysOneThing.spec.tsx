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

  it('every basis arm is reachable, and each renders exactly its own constant', () => {
    /* ⚠ ALL THREE ARMS OF `driversCaveat`, EXERCISED THROUGH THE COMPONENT. A
       table over the constants, so an arm that becomes unreachable or starts
       rendering a neighbour's sentence cannot pass. */
    const withRows = caveatOf(openStrategicChallenge())
    expect(withRows).toContain(COPY.coverage.setRelativeInfluence)
    cleanup()

    /* ⚠ THE REFERENCE LINE KEEPS ITS PRECEDENCE over the structural one. */
    const withReference = caveatOf(
      noRows({ sensitivityReference: { optionLabel: 'Hold price' } } as Partial<ResultsSectionDataReturn>),
    )
    expect(withReference).toContain(COPY.coverage.referencePrefix)
    expect(withReference).toContain('Hold price')
    expect(withReference).not.toContain(COPY.coverage.structuralInfluence)
    cleanup()

    /* ⚠⚠ MEASURED, NOT BLESSED. Since #1228 made `influenceIsSetRelative` equal
       `drivers.length > 0`, this arm is reachable ONLY on a run with NO rows —
       where its own sentence opens "Each bar shows". That wording is a live
       finding reported with this fix, not something this case endorses; what is
       pinned is the CONDITION, so the arm cannot move again unnoticed. */
    const structuralArm = caveatOf(noRows())
    expect(structuralArm).toContain(COPY.coverage.structuralInfluence)
    expect(structuralArm).not.toContain(COPY.coverage.setRelativeInfluence)
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
    expect(caveat).toContain(ZERO_REASON_BADGE_LABELS.intervention_override)
  })

  it('TWIN: says nothing about exclusions when it excluded nothing', () => {
    // The discriminating half. Without it a component that printed the
    // disclosure unconditionally passes the case above and lies on every run
    // that dropped no rows — the "+N more" defect one level down.
    renderBody(openStrategicChallenge())
    openDrivers()
    const caveat = screen.queryByTestId('analysis-new-drivers-caveat')?.textContent ?? ''
    expect(caveat).not.toContain(ZERO_REASON_BADGE_LABELS.intervention_override)
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

/**
 * ⭐⭐ THE DRIVERS SCALE CAVEAT DISCLOSES THAT THE TOP DRIVER'S 100% IS
 * GUARANTEED, NOT EARNED. (ROADMAP 2.1376)
 *
 * ── THE WITNESSED DEFECT (deployed `ce4769a1`, fresh guest journey) ─────────
 * Two adjacent Reasoning-tab sections each named a DIFFERENT "most important"
 * thing, a few hundred pixels apart:
 *
 *   Key insights          "…is the hinge. Its effect on Infrastructure Stack
 *                          Fragmentation is the relationship most able to
 *                          change the outcome."
 *   Drivers and dynamics  "…we end up with three divergent stacks within a
 *                          year — 100% — Top driver"
 *
 * ⛔⛔ THE FIX IS NOT TO RECONCILE THEM, AND THIS SPEC EXISTS PARTLY TO STOP A
 * LATER SESSION DOING SO. They answer different questions (CLAUDE.md trap 21),
 * derived at the bytes:
 *
 *   • the HINGE is an EDGE      `buildAnalysisNewViewModel.ts` `hinge.fromLabel`
 *                               / `toLabel`, ranked by `switchProbability`.
 *   • a DRIVER is a NODE        `DriverItem` keyed on `factorKey`, ranked by
 *                               `displayInfluence`, MAX-NORMALISED.
 *
 * Different objects, different quantities, different normalisations. Both
 * readings are real and separately grounded. The precedent a session would
 * reach for — `driversSeamSaysOneThing` — resolved ITS pair by deleting the
 * duplicate; doing that here would destroy a real reading.
 *
 * ── WHAT ACTUALLY MANUFACTURES THE RIVALRY: THE NUMBER, NOT THE COPY ───────
 * The Drivers row never claims to be most important. The top driver shows 100%
 * BY CONSTRUCTION — `buildDrivers` renders every bar as
 * `magnitude(d) / strongest` where `strongest = Math.max(...live.map(magnitude),
 * 0)`, so the leader's fraction is exactly 1 in every run whatever its strength.
 * That guaranteed 100% is what reads as a rival claim to "the hinge".
 *
 * The estate already owns the honest sentence, and it already SHIPS it on the
 * Analysis tab: `influenceScaleCopy.INFLUENCE_SCALE_CAPTION` — "Influence is
 * relative to the strongest factor. The top driver always shows 100%." The
 * Reasoning tab rendered the weaker sibling, which denies the wrong reading
 * ("not a share of the outcome") without disclosing that the 100% is
 * guaranteed. This spec pins that it no longer does.
 *
 * ── WHY THE SENTENCES ARE TYPED HERE, VERBATIM ─────────────────────────────
 * ⚠ THIS IS THE OPPOSITE RULE FROM `driversSeamSaysOneThing`'s
 * `theCaveatHasOneSourceOfTruth`, DELIBERATELY, AND THE TWO ARE NOT IN CONFLICT
 * — they answer different questions, which is the same trap-21 discipline this
 * file is about:
 *
 *   • THAT guard asks "can the caveat drift into two spellings?" and bans a
 *     mirror in the spec that composes the caveat. It reads its OWN source
 *     (`import.meta.url`), so its ban is file-local by construction.
 *   • THIS guard asks "are the WORDS right?" — and `expect(rendered).toContain(
 *     COPY.coverage.setRelativeInfluence)` cannot answer it. Both sides of that
 *     assertion move together, so it is a guard agreeing with itself (trap 13b)
 *     and it passes on any rewording whatsoever, including one that deletes the
 *     disclosure this row exists to add.
 *
 * CLAUDE.md trap 12d is explicit that these two kinds of guard are NOT
 * redundant and neither supersedes the other: derivation stops consumers
 * drifting from the list, a typed corpus is what notices the list is wrong.
 * Ship both.
 *
 * ── AND THE INVARIANT IS WRITTEN AGAINST THE SPEC, NOT THE SYMPTOM ─────────
 * The anchor case below asserts the FACT the sentence claims, not merely that
 * the sentence is present. If someone later rescales the bars to a share of a
 * sum, the sentence becomes false and this file REDs on the anchor rather than
 * passing on the string (trap 13d).
 *
 * ── ⛔⛔ CORRECTED 14 SEP 2026 — THIS FILE ANCHORED ON THE WRONG QUANTITY ────
 * The anchor above was `influenceRows[0].fraction === 1`. That is the BAR, and
 * it is 1 for the leader BY CONSTRUCTION — `magnitude / strongest` over the
 * surviving rows — so it can never fail, whatever the panel says. The sentence
 * is about the FIGURE, `pct(displayInfluence)`, which is the PRODUCER's value
 * and is deliberately never rescaled here. Two quantities, one guard, and the
 * guard was pointed at the one that cannot be wrong.
 *
 * ⛔ WHAT IT CERTIFIED. Both fixtures it asserted the 100% promise on measure
 * a top FIGURE of 60 (`openStrategicChallenge`) and NO FIGURE AT ALL
 * (`highUncertainty`). It has been passing on runs that render the promise
 * beside a number contradicting it.
 *
 * ⛔ AND THE DEFECT REACHED A USER. Witnessed by Paul on the deployed Reasoning
 * tab: a FULL-WIDTH TOP BAR, LABELLED 67%, under "The top driver always shows
 * 100%" — with the cause already disclosed one clause earlier ("2 factors are
 * not ranked here: controlled by your options"). Reproduced at the builder with
 * one suppressed row at 1.0 and survivors at 0.67 / 0.33.
 *
 * ⭐ THE PRODUCER IS NOT AT FAULT, re-derived over every JSON under `src/`:
 * 21 of 22 files carrying `influence_score` max at exactly 1.0. The invariant
 * is real upstream; `buildDrivers` breaks it downstream by dropping rows AFTER
 * normalisation, so the surviving top row is no longer the producer's max.
 *
 * ── ⭐⭐ AND THE REPLACEMENT IS NOT ITSELF A TAUTOLOGY — PROVEN BOTH WAYS ────
 * The class this file exists to close is "a guard that is always true, is
 * well-typed, and reads exactly like a safety check". Replacing one tautology
 * with another is the obvious way to fail, so the discriminating pair was RUN,
 * not reasoned about, in an isolated worktree with isolation asserted by
 * writing a sentinel:
 *
 *   RED   diverge bar from figure — restore the unconditional promise        (2 failed)
 *   RED   derive the figure from the bar (the tempting rescale)              (2 failed)
 *   RED   drop the exclusion filter so nothing is ever suppressed            (2 failed)
 *   GREEN change an UNRELATED quantity — the bar's 0.04 minimum floor -> 0.09 (7 passed)
 *
 * The GREEN arm is the half that matters and the half a careless repair omits:
 * without it, a guard that REDs on everything would score four out of four and
 * still be worthless. Leading and trailing controls agreed at 7/7 with `src/`
 * clean at both ends.
 *
 * ── ⛔⛔ AND THAT GREEN ARM WAS VACUOUS. CORRECTED, NOT DEFENDED. ───────────
 * An independent reviewer showed it proves nothing: every assertion in this
 * file binds to `row[0]`, whose fraction is **1** by construction, so a
 * MINIMUM floor of 0.09 can never touch it. **Any floor ≤ 1 is invisible
 * here** — the arm would have stayed green for a change that could not have
 * affected it whatever the guard did. Demonstrated by the reviewer: a floor of
 * **1.5** REDs three cases, which is the first value large enough to reach
 * `row[0]` at all.
 *
 * ⭐ I INVITED THAT HIT AND IT LANDED, WHICH IS THE POINT. I had written that
 * "a single green arm proves less than two" and then supplied one green arm —
 * chosen, without noticing, from the quantities I already believed were safe.
 * That is the self-authored-corpus problem one level up: a control picked by
 * the same head that wrote the guard tests what that head already expects.
 *
 * ⭐ THE REPLACEMENT ARM BELOW IS THE REVIEWER'S and it rescues the conclusion:
 * it changes a quantity the guard genuinely READS and shows it stays green,
 * so "sensitive to the named thing, not to everything" is now supported rather
 * than asserted.
 *
 * ⭐ THE SHAPE OF THE REPAIR: the anchor now asserts BOTH quantities and names
 * them apart, and the clause is gated on the figure a reader actually sees. A
 * corpus that shares the code's blind spot cannot see the code's defect
 * (CLAUDE.md trap 13d), so the defect state gets its OWN fixture below rather
 * than being reasoned about.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { openGroupsIfPresent } from './openNamedGroups'
import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import { highUncertainty, makeData, makeDriver, openStrategicChallenge } from './analysisNewFixtures'

/**
 * The two sentences, TYPED. Changing the constant without changing these REDs
 * here, which is the entire point of the file.
 */
const SCALE_IS_RELATIVE = 'Influence is relative to the strongest factor in this run, not a share of the outcome.'
const HUNDRED_IS_GUARANTEED = 'The top driver always shows 100%.'
/**
 * The clause that replaces it when the figure is not 100. Typed here for the
 * same reason as its twin: a `toContain(COPY...)` assertion moves with the
 * constant and would pass on any rewording, including one that puts the false
 * promise back.
 */
const BAR_IS_STRONGEST_SHOWN =
  'The top bar is full width because it is the strongest factor shown, not because it reached 100%.'

/**
 * ⭐ A PRODUCER-SHAPED SET — max exactly 1.0, which is what 21 of 22 captures
 * in this repo actually look like. The shared fixtures all default to 0.6, so
 * none of them could ever have exercised the sentence's true state.
 */
const producerNormalisedRun = () =>
  makeData({
    drivers: {
      driversStatus: 'computed',
      totalCount: 2,
      drivers: [
        makeDriver({ factorKey: 'top', factorLabel: 'Churn Risk', displayInfluence: 1.0, rank: 1 }),
        makeDriver({ factorKey: 'second', factorLabel: 'Elasticity', displayInfluence: 0.4, rank: 2 }),
      ],
    } as never,
  })

/**
 * ⭐⭐ THE DEFECT STATE, AS A FIXTURE RATHER THAN AS AN ARGUMENT. The producer's
 * strongest row is suppressed, so the surviving top reads 67% while its bar is
 * still full width. These are the exact magnitudes Paul's deployed run showed.
 */
const strongestRowSuppressed = () =>
  makeData({
    drivers: {
      driversStatus: 'computed',
      totalCount: 3,
      drivers: [
        makeDriver({
          factorKey: 'sup',
          factorLabel: 'Pro Plan Monthly Price',
          displayInfluence: 1.0,
          rank: 1,
          zeroReason: 'intervention_override',
        } as never),
        makeDriver({ factorKey: 'a', factorLabel: 'Price-Driven Churn Risk', displayInfluence: 0.67, rank: 2 }),
        makeDriver({ factorKey: 'b', factorLabel: 'Price Elasticity', displayInfluence: 0.33, rank: 3 }),
      ],
    } as never,
  })

const SECTION = 'analysis-new-drivers'

const renderBody = (data: ResultsSectionDataReturn) => {
  const result = render(
    <AnalysisNewTabBody
      resultsSectionData={data}
      isPreRun={false}
      isRunning={false}
      isStale={false}
      responseHash="run_2_1376_scale"
    />,
  )
  // ⚠ THE SECTIONS THIS SPEC QUERIES SIT INSIDE NAMED GROUPS, and `SectionShell`
  // UNMOUNTS a closed region — without this every query below reads an absence
  // rather than the thing it was written to check. Only the GROUP is opened.
  openGroupsIfPresent()
  return result
}

/**
 * ⚠ OPEN IT ONLY IF IT IS CLOSED — `AnalysisNewSection` passes
 * `defaultOpen={findings.length === 1}`, so an unconditional click CLOSES the
 * one-driver fixture and every assertion then fails on an unmounted body
 * rather than on the property. The same trap `driversSeamSaysOneThing`
 * recorded; the helper is re-derived here rather than imported because that
 * file is not a module this one should depend on.
 */
const openDrivers = () => {
  // V2 prototype (25 Sep): the drivers' group renders only inside the
  // challenge's "Assumptions and evidence" door. The caveat and the 100% move
  // behind it together, so they stay at the same depth.
  const door = screen.getByTestId('analysis-new-signals-disclose')
  if (door.getAttribute('aria-expanded') !== 'true') fireEvent.click(door)
  openGroupsIfPresent()
  const toggle = screen.getByTestId(`${SECTION}-toggle`)
  if (toggle.getAttribute('aria-expanded') !== 'true') fireEvent.click(toggle)
  expect(toggle, 'PRECONDITION: the drivers section must be open').toHaveAttribute(
    'aria-expanded',
    'true',
  )
}

/**
 * ⭐⭐ THE THREE PLACES A CLAUSE CAN NOW LIVE, AND THE ASSERTIONS NAME WHICH.
 *
 * Until 17 Sep 2026 these clauses were one string in one slot, so every case
 * here read `${SECTION}-caveat` and asked "is the sentence in the blob". The
 * approved prototype's Move 5 routes each clause ONTO the thing it qualifies —
 * the scale denial under the chart's scale legend, the top-bar claim on the top
 * row, and the exclusion alone in the section slot.
 *
 * ⛔ THIS IS A STRENGTHENING, NOT AN ACCOMMODATION, AND THE DISTINCTION IS THE
 * WHOLE RISK OF THAT MOVE. The lazy rebinding is a UNION — "the sentence is
 * somewhere in the open section" — which would pass if a clause landed on the
 * wrong number, which is precisely the failure a relocation can cause. Each
 * assertion below names the ONE node its clause must be on, so a clause that
 * moved to the wrong home REDs rather than passing.
 *
 * `region` is retained for ABSENCE claims only: "this run says nothing about
 * 100%" is a claim about the whole open section, not about one node.
 */
interface CaveatParts {
  /** Under the chart's scale legend. Denies a reading of the SCALE. */
  scale: HTMLElement | null
  /** On row index 0. A claim about the FIRST row's figure. */
  topRow: HTMLElement | null
  /** The section slot above the chart. What is missing from the ranking. */
  section: HTMLElement | null
  /** The whole open section, for absence claims. */
  region: HTMLElement
}

const caveatParts = (data: ResultsSectionDataReturn): CaveatParts => {
  renderBody(data)
  openDrivers()
  return {
    scale: screen.queryByTestId('analysis-new-driver-chart-scale-note'),
    topRow: screen.queryByTestId('analysis-new-driver-chart-top-row-note'),
    section: screen.queryByTestId(`${SECTION}-caveat`),
    region: screen.getByTestId(`${SECTION}-region`),
  }
}

beforeEach(() => {
  useStrengthenStore.setState({ records: {}, priorityOrder: [] } as never)
})
afterEach(() => cleanup())

describe('the guaranteed 100% is disclosed where the 100% is shown', () => {
  /**
   * ⭐ THE ANCHOR. The sentence's own truth condition, read off the builder
   * rather than off the copy. This is what makes the string assertions below
   * a claim about the product instead of a claim about a constant.
   */
  it('ANCHOR: bar and figure are DIFFERENT quantities, and only the bar is 1 by construction', () => {
    const drivers = (data: ReturnType<typeof openStrategicChallenge>) =>
      buildAnalysisNewViewModel({
        data,
        recommendations: [],
        isPreRun: false,
        isRunning: false,
        isStale: false,
      }).drivers

    // ── The BAR: 1 for the leader on every basis, whatever its strength. ──
    for (const [name, data] of [
      ['producer basis', openStrategicChallenge()],
      ['fallback basis', highUncertainty()],
      ['strongest row suppressed', strongestRowSuppressed()],
    ] as const) {
      const rows = drivers(data).influenceRows
      expect(rows.length, `PRECONDITION: ${name} must produce influence rows`).toBeGreaterThan(0)
      expect(
        rows[0]!.fraction,
        `${name}: the leader is max-normalised over SURVIVORS, so its fraction is 1 whatever its figure`,
      ).toBe(1)
    }

    /* ── ⭐⭐ THE DISCRIMINATING PAIR. The figure is the producer's and is NOT
       rescaled, so it tracks what was filtered out while the bar cannot. If
       these two ever agree on the suppressed run, someone has rescaled the
       figure — which is the fabrication the caveat's first clause denies. */
    expect(
      drivers(producerNormalisedRun()).topRowFigurePercent,
      'a producer-normalised set survives intact: the figure IS 100',
    ).toBe(100)
    expect(
      drivers(strongestRowSuppressed()).topRowFigurePercent,
      'the producer max was dropped: the surviving figure is 67 while its bar is still 1',
    ).toBe(67)
    expect(
      drivers(highUncertainty()).topRowFigurePercent,
      'a non-`influence_score` basis renders a rank claim and no figure at all',
    ).toBeNull()
  })

  /**
   * ⭐ AND THE 100% IS ON SCREEN, AT DEPTH 1. Without this the caveat could be
   * disclosing a figure no reader ever meets. Bound by identity to the FIRST
   * bar, which is the leader: `influenceRows` is sorted descending by the same
   * magnitude the fraction is computed from.
   */
  it('the leader renders data-fraction="100" in the chart the caveat sits above', () => {
    renderBody(openStrategicChallenge())
    openDrivers()
    const bars = screen.getAllByTestId('analysis-new-driver-chart-bar')
    expect(bars.length, 'PRECONDITION: the chart must draw bars').toBeGreaterThan(0)
    expect(bars[0]!).toHaveAttribute('data-fraction', '100')
  })

  it('the caveat discloses the guaranteed 100% WHERE THE 100% IS ACTUALLY SHOWN', () => {
    const { scale, topRow, region } = caveatParts(producerNormalisedRun())
    // POSITIVE CONTROL: a node that rendered empty would satisfy nothing below
    // by accident, and an absent one fails here rather than silently (trap 13).
    expect(scale, 'the scale denial must render').not.toBeNull()
    expect(scale!.textContent ?? '', 'the scale note rendered empty').not.toBe('')
    expect(scale!).toHaveTextContent(SCALE_IS_RELATIVE)
    // ⭐ ON THE TOP ROW, NOT ANYWHERE IN THE SECTION. The clause is about ONE
    // row's figure; a union assertion would pass with it on the wrong row.
    expect(topRow, 'the guarantee must render on the top row').not.toBeNull()
    expect(topRow!).toHaveTextContent(HUNDRED_IS_GUARANTEED)
    expect(
      screen.getAllByTestId(`${SECTION}-row`)[0]!.contains(topRow!) ||
        screen.getAllByTestId('analysis-new-driver-chart-row')[0]!.contains(topRow!),
      'the clause must sit on the FIRST row, which is the row it is about',
    ).toBe(true)
    // ⭐ BOUND TO THE NUMBER THE SENTENCE IS ABOUT. Without this the case
    // passes on any run at all, which is how the false promise survived.
    expect(
      region.textContent ?? '',
      'the promise must sit beside a row that actually reads 100%',
    ).toContain('Relative influence 100%')
  })

  /**
   * ⭐⭐ THE DEFECT CASE. RED before the fix: the caveat promised 100% while the
   * top row read 67%. The scale clause stays — it is unconditionally true — and
   * only the guarantee is withdrawn, replaced by the one thing the reader
   * cannot otherwise account for: a full-width bar on a row that is not 100%.
   */
  it('the guarantee is WITHHELD when the producer\'s strongest row was filtered out', () => {
    const { scale, topRow, region: reg } = caveatParts(strongestRowSuppressed())
    expect(scale, 'the scale denial is unconditional and must still render').not.toBeNull()
    expect(scale!).toHaveTextContent(SCALE_IS_RELATIVE)
    expect(topRow, 'the top-row clause must still render, in its other form').not.toBeNull()
    expect(topRow!, 'the false promise must not render').not.toHaveTextContent(HUNDRED_IS_GUARANTEED)
    expect(topRow!).toHaveTextContent(BAR_IS_STRONGEST_SHOWN)
    // ⛔ AND NOWHERE ELSE EITHER. Binding the absence to one node would let the
    // false promise survive by moving; this asserts it against the whole open
    // section, which is the right scope for an absence.
    expect(
      reg.textContent ?? '',
      'the false promise must not appear anywhere in the open section',
    ).not.toContain(HUNDRED_IS_GUARANTEED)

    /* ⚠ PIN THE PRECONDITION IN-TEST (trap 13b): assert the payload really
       does render the contradicting number, so a green result is the code's
       doing and not the fixture quietly failing to reproduce the state. */
    const region = screen.getByTestId(`${SECTION}-region`).textContent ?? ''
    expect(region, 'PRECONDITION: the top row must render 67%').toContain('Relative influence 67%')
    expect(region, 'PRECONDITION: the exclusion must be disclosed').toContain('not ranked here')
    expect(screen.getAllByTestId('analysis-new-driver-chart-bar')[0]!).toHaveAttribute(
      'data-fraction',
      '100',
    )
  })

  /**
   * ⚠ NO FIGURE, NO CLAUSE ABOUT A FIGURE. On a basis other than
   * `influence_score` the rows carry a rank claim and no percentage, so BOTH
   * arms of the second clause would describe a number that never appears.
   * #1228's ruling that the SCALE sentence is basis-independent is untouched.
   */
  /**
   * ⭐⭐ THE GREEN ARM, EXECUTABLE AND NON-VACUOUS.
   *
   * The original green arm changed the bar's MINIMUM floor, which `row[0]`
   * (fraction 1 by construction) can never reach — so it proved nothing. This
   * changes a quantity the guard genuinely reads on the row it binds to: a
   * NON-LEADING row's influence. The caveat is a claim about the TOP row, so
   * moving a lower one must leave every assertion alone.
   *
   * ⚠ IN-TEST PRECONDITION: the moved row must actually be present and must
   * NOT be the leader, or this is vacuous in a second, quieter way.
   */
  it('GREEN ARM: moving a NON-LEADING row leaves every assertion alone', () => {
    const shifted = makeData({
      drivers: {
        driversStatus: 'computed',
        totalCount: 2,
        drivers: [
          makeDriver({ factorKey: 'top', factorLabel: 'Churn Risk', displayInfluence: 1.0, rank: 1 }),
          makeDriver({ factorKey: 'second', factorLabel: 'Elasticity', displayInfluence: 0.25, rank: 2 }),
        ],
      } as never,
    })
    const vm = buildAnalysisNewViewModel({
      data: shifted, recommendations: [], isPreRun: false, isRunning: false, isStale: false,
    }).drivers
    expect(vm.influenceRows.length, 'PRECONDITION: two rows, so a non-leader exists').toBe(2)
    expect(vm.influenceRows[1]!.id, 'PRECONDITION: the moved row must not be the leader').toBe('second')
    expect(
      vm.topRowFigurePercent,
      'the caveat is a claim about the TOP row — moving a lower one must not change it',
    ).toBe(100)

    const { scale, topRow } = caveatParts(shifted)
    expect(scale!).toHaveTextContent(SCALE_IS_RELATIVE)
    expect(topRow, 'and the guarantee still renders, unmoved').not.toBeNull()
    expect(topRow!).toHaveTextContent(HUNDRED_IS_GUARANTEED)
  })

  it('says nothing about 100% on a basis that renders no figure', () => {
    const { scale, topRow, region: reg } = caveatParts(highUncertainty())
    expect(scale, 'the scale denial must still render').not.toBeNull()
    expect(scale!.textContent ?? '', 'the scale note rendered empty').not.toBe('')
    expect(scale!).toHaveTextContent(SCALE_IS_RELATIVE)
    // ⭐ THE STRONGEST FORM THE SPLIT MAKES AVAILABLE: the top-row node is not
    // merely silent, it does not exist. A clause with nothing to say renders no
    // element, so there is no node for a later change to quietly fill.
    expect(topRow, 'a basis with no figure earns no top-row clause at all').toBeNull()
    const regText = reg.textContent ?? ''
    expect(regText).not.toContain(HUNDRED_IS_GUARANTEED)
    expect(regText).not.toContain(BAR_IS_STRONGEST_SHOWN)
    expect(
      screen.getByTestId(`${SECTION}-region`).textContent ?? '',
      'PRECONDITION: this basis renders a rank claim, not a percentage',
    ).toContain('Among the strongest influences in this run')
  })

  /**
   * ⭐⭐ THE GATING DECISION, PINNED. The row asked whether the scale caveat
   * belongs "at rest". Derived rather than judged:
   *
   *   • `SectionShell:204` gates the whole section body on `open`.
   *   • `AnalysisNewSection:148` renders the caveat FIRST inside that body,
   *     directly above the chart (`header`) and the rows.
   *   • `DisclosureRow:136` gates the per-row grounding line on a SECOND click
   *     (`hasLevel2 && open`).
   *
   * So the caveat and the 100% are at the SAME depth: a reader cannot meet the
   * number without the caveat already being on screen above it. The two
   * provenance lines are one click deeper, and they answer the QUANTITY
   * question, which is not this sentence's job. Nothing needed surfacing, and
   * that is why this fix adds one clause rather than a screen of hedging.
   *
   * This case fails if a later change moves the caveat behind a disclosure.
   */
  it('the caveat sits in the SAME region as the rows, never behind a second click', () => {
    renderBody(openStrategicChallenge())
    openDrivers()
    const region = screen.getByTestId(`${SECTION}-region`)
    const rows = screen.getAllByTestId(`${SECTION}-row`)
    /* ⭐ EVERY CLAUSE THAT RENDERS, NOT JUST THE ONE THAT USED TO. The move
       created three homes, and the "same depth as the number" rule applies to
       all three — a clause relocated behind a disclosure would be exactly the
       regression this case exists to catch, and a check on one node would miss
       it on the other two. */
    const placed = [
      ['scale note', screen.queryByTestId('analysis-new-driver-chart-scale-note')],
      ['top-row note', screen.queryByTestId('analysis-new-driver-chart-top-row-note')],
      ['section caveat', screen.queryByTestId(`${SECTION}-caveat`)],
    ].filter((e): e is [string, HTMLElement] => e[1] !== null)

    expect(rows.length, 'PRECONDITION: the section must render rows').toBeGreaterThan(0)
    expect(placed.length, 'PRECONDITION: at least one clause must render').toBeGreaterThan(0)
    for (const [name, node] of placed) {
      expect(region.contains(node), `the ${name} must render inside the open section`).toBe(true)
      expect(
        node.closest(`[data-testid="${SECTION}-detail"]`),
        `the ${name} must not be behind a row disclosure`,
      ).toBeNull()
    }
    const caveat = placed[0]![1]
    expect(region.contains(rows[0]!), 'the rows must render inside the same region').toBe(true)
    // The opposite-direction twin: not tucked into a row's level-2 detail,
    // which is where the QUANTITY answer lives and where this one must not.
    expect(
      caveat.closest(`[data-testid="${SECTION}-detail"]`),
      'the scale caveat must not be behind a row disclosure',
    ).toBeNull()
  })

  /**
   * ⚠ THE CAVEAT STILL ANSWERS ONLY THE SCALE QUESTION. `driversSeamSaysOneThing`
   * rules that a caveat naming one QUANTITY is false for the run stamped the
   * other, so this addition had to be a scale fact and nothing else. "The top
   * driver always shows 100%" is true on both bases by construction; naming a
   * quantity here would not be.
   */
  /**
   * ⛔⛔ THE ONE DECISION IN MOVE 5 THAT NOTHING ELSE GUARDS.
   *
   * The scale note sits directly beneath the chart's scale LEGEND, and that
   * legend is `aria-hidden` for a good reason: it labels the endpoints of a
   * graphic assistive tech never receives. Copying that attribute onto the
   * sentence below it is the obvious, plausible, silent mistake — and it would
   * withhold the qualification from exactly the readers who cannot see the
   * bars and therefore need it most.
   *
   * ⚠ NEITHER `toHaveTextContent` NOR ANY OTHER ASSERTION IN THIS FILE CAN SEE
   * IT: the node still renders and still carries the words. Only an explicit
   * check on the attribute, and on the ancestors that could hide it, can.
   */
  it('⛔ the scale denial is NOT hidden from assistive tech, unlike the legend above it', () => {
    const { scale, region } = caveatParts(producerNormalisedRun())
    expect(scale, 'PRECONDITION: the scale note must render').not.toBeNull()
    expect(scale!.getAttribute('aria-hidden'), 'the sentence must not be hidden').toBeNull()
    // ⚠ AND NOT HIDDEN BY AN ANCESTOR EITHER — an attribute on the node is not
    // the whole question, because `aria-hidden` inherits down the tree.
    let node: HTMLElement | null = scale!
    while (node !== null && node !== region) {
      expect(
        node.getAttribute('aria-hidden'),
        'an ancestor hides the scale sentence from assistive tech',
      ).not.toBe('true')
      node = node.parentElement
    }
    // CONTRAST IN THE SAME RUN: the legend directly above it IS hidden, so this
    // is a discrimination between two adjacent nodes and not a probe that
    // cannot find `aria-hidden` anywhere.
    expect(
      screen.getByTestId('analysis-new-driver-chart-scale').getAttribute('aria-hidden'),
      'CONTRAST: the scale legend is hidden, which is what makes the above meaningful',
    ).toBe('true')
  })

  it('DISCRIMINATOR: the addition is a scale fact, not a quantity claim', () => {
    for (const data of [openStrategicChallenge(), highUncertainty()]) {
      const parts = caveatParts(data)
      const text = [parts.scale, parts.topRow, parts.section]
        .map((n) => n?.textContent ?? '')
        .join(' ')
      expect(text.trim(), 'PRECONDITION: at least one clause must have rendered').not.toBe('')
      expect(text).not.toContain("Olumi's structural influence score")
      expect(text).not.toContain('factor sensitivity')
      cleanup()
    }
  })
})

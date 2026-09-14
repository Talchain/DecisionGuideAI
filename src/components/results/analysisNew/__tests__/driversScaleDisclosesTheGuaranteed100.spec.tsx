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
 * The anchor case below asserts the FACT the sentence claims (the top row's
 * fraction is exactly 1), not merely that the sentence is present. If someone
 * later rescales the bars to a share of a sum, the sentence becomes false and
 * this file REDs on the anchor rather than passing on the string (trap 13d).
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import { highUncertainty, openStrategicChallenge } from './analysisNewFixtures'

/**
 * The two sentences, TYPED. Changing the constant without changing these REDs
 * here, which is the entire point of the file.
 */
const SCALE_IS_RELATIVE = 'Influence is relative to the strongest factor in this run, not a share of the outcome.'
const HUNDRED_IS_GUARANTEED = 'The top driver always shows 100%.'

const SECTION = 'analysis-new-drivers'

const renderBody = (data: ResultsSectionDataReturn) =>
  render(
    <AnalysisNewTabBody
      resultsSectionData={data}
      isPreRun={false}
      isRunning={false}
      isStale={false}
      responseHash="run_2_1376_scale"
    />,
  )

/**
 * ⚠ OPEN IT ONLY IF IT IS CLOSED — `AnalysisNewSection` passes
 * `defaultOpen={findings.length === 1}`, so an unconditional click CLOSES the
 * one-driver fixture and every assertion then fails on an unmounted body
 * rather than on the property. The same trap `driversSeamSaysOneThing`
 * recorded; the helper is re-derived here rather than imported because that
 * file is not a module this one should depend on.
 */
const openDrivers = () => {
  const toggle = screen.getByTestId(`${SECTION}-toggle`)
  if (toggle.getAttribute('aria-expanded') !== 'true') fireEvent.click(toggle)
  expect(toggle, 'PRECONDITION: the drivers section must be open').toHaveAttribute(
    'aria-expanded',
    'true',
  )
}

const caveatNode = (data: ResultsSectionDataReturn): HTMLElement => {
  renderBody(data)
  openDrivers()
  return screen.getByTestId(`${SECTION}-caveat`)
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
  it('ANCHOR: the top influence row is exactly 1.0 by construction, on BOTH bases', () => {
    for (const [name, data] of [
      ['producer basis', openStrategicChallenge()],
      ['fallback basis', highUncertainty()],
    ] as const) {
      const rows = buildAnalysisNewViewModel({
        data,
        recommendations: [],
        isPreRun: false,
        isRunning: false,
        isStale: false,
      }).drivers.influenceRows
      expect(rows.length, `PRECONDITION: ${name} must produce influence rows`).toBeGreaterThan(0)
      expect(
        rows[0]!.fraction,
        `${name}: the leader is max-normalised, so its fraction is 1 whatever its strength`,
      ).toBe(1)
    }
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

  it('the caveat discloses the guaranteed 100%, on the producer basis', () => {
    const caveat = caveatNode(openStrategicChallenge())
    // POSITIVE CONTROL: a caveat that rendered empty would satisfy nothing
    // below by accident, and an absent one throws above (trap 13).
    expect(caveat.textContent ?? '', 'the caveat rendered empty').not.toBe('')
    expect(caveat).toHaveTextContent(SCALE_IS_RELATIVE)
    expect(caveat).toHaveTextContent(HUNDRED_IS_GUARANTEED)
  })

  it('the caveat discloses it on the fallback basis too, because the scale is the same', () => {
    /* #1228's ruling, and it is why this sentence may be unconditional:
       `buildDrivers` divides every magnitude by `strongest` WHATEVER stamped
       it. A disclosure withheld on one basis would go missing on exactly the
       runs that need it. */
    const caveat = caveatNode(highUncertainty())
    expect(caveat.textContent ?? '', 'the caveat rendered empty').not.toBe('')
    expect(caveat).toHaveTextContent(SCALE_IS_RELATIVE)
    expect(caveat).toHaveTextContent(HUNDRED_IS_GUARANTEED)
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
    const caveat = screen.getByTestId(`${SECTION}-caveat`)
    const rows = screen.getAllByTestId(`${SECTION}-row`)

    expect(rows.length, 'PRECONDITION: the section must render rows').toBeGreaterThan(0)
    expect(region.contains(caveat), 'the caveat must render inside the open section').toBe(true)
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
  it('DISCRIMINATOR: the addition is a scale fact, not a quantity claim', () => {
    for (const data of [openStrategicChallenge(), highUncertainty()]) {
      const text = caveatNode(data).textContent ?? ''
      expect(text, 'PRECONDITION: the caveat must have rendered').not.toBe('')
      expect(text).not.toContain("Olumi's structural influence score")
      expect(text).not.toContain('factor sensitivity')
      cleanup()
    }
  })
})

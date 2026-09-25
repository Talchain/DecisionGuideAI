/**
 * Analysis (New) — the surface END TO END on a completed analysis.
 *
 * ⚠ WHY THIS FILE EXISTS SEPARATELY FROM THE OTHERS. The adapter suite proves
 * the view model is honest; the dock suite proves the tab mounts and costs
 * nothing to switch to. Neither proves the surface actually SHOWS anything when
 * a run has completed — the dock cases all run pre-run, and a view model full
 * of findings that no component renders is precisely this estate's most
 * expensive defect class ("we build more than we plug in").
 *
 * So this drives the real `AnalysisNewTabBody` with post-run fixtures and
 * asserts rendered content, not shape.
 */

import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { openGroups, openAllSections } from './openNamedGroups'
import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import { ZERO_REASON_BADGE_LABELS } from '../../influenceScaleCopy'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import {
  decisionWithLeaderWithheld,
  decisionWithLeaderWithheldAndReason,
  genuineDecision,
  highUncertainty,
  makeData,
  makeDriver,
  openStrategicChallenge,
  manyFragileEdges,
  withLeaderLicensed,
} from './analysisNewFixtures'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'

/** The adapter under the same inputs `renderBody` gives the component. */
const vmOf = (data: ResultsSectionDataReturn) =>
  buildAnalysisNewViewModel({
    data,
    recommendations: [],
    isPreRun: false,
    isRunning: false,
    isStale: false,
  })
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'

const renderBody = (
  data: ResultsSectionDataReturn,
  over: Partial<Parameters<typeof AnalysisNewTabBody>[0]> = {},
) =>
  render(
    <AnalysisNewTabBody
      resultsSectionData={data}
      isPreRun={false}
      isRunning={false}
      isStale={false}
      responseHash="run_abc123"
      {...over}
    />,
  )

/**
 * ⚠ THE SECTIONS ARE COLLAPSED ROWS NOW (the IA the design asks for), so a case
 * asserting content INSIDE a section opens it first. Every assertion below is
 * unchanged in what it claims — only the navigation to the content is new.
 *
 * ⚠ AND THAT MATTERS MOST FOR THE ABSENCE CASES. `queryByTestId(...)` is null
 * both when a section is COLLAPSED and when the content genuinely is not there,
 * so an absence assertion made against a closed section passes vacuously
 * (CLAUDE.md trap 13). Opening the section first is what keeps those cases
 * meaningful — they are the ones that would otherwise rot silently.
 */
/**
 * ⚠⚠ OPEN, NOT TOGGLE — AND THE DIFFERENCE NOW BITES. A section holding exactly
 * one item opens itself on mount, so a blind click CLOSES it and every
 * assertion inside it fails for a reason that has nothing to do with what it
 * claims. Reading `aria-expanded` first makes this idempotent, which is what
 * the name always promised.
 */
const openSection = (testId: string) => {
  const toggle = screen.queryByTestId(`${testId}-toggle`)
  if (toggle && toggle.getAttribute('aria-expanded') !== 'true') fireEvent.click(toggle)
}

/** Open every section, for cases that assert across the whole surface. */
/**
 * ⭐ DERIVED, NOT LISTED — the change the previous comment here said was "worth
 * making the next time this drifts". This is that time.
 *
 * The list had already drifted once ("What would change your mind" was added to
 * the panel and the list did not know), and a test asserting an ABSENCE inside
 * an unopened section passes VACUOUSLY, which is the dangerous direction
 * (CLAUDE.md trap 12 + trap 13).
 *
 * ⚠ THE REASON A DERIVED SWEEP WAS UNSAFE BEFORE IS NOW FIXED: it would have
 * TOGGLED rather than opened. `openSection` reads `aria-expanded` first, so a
 * blind sweep is now safe, and the list has nothing left to drift from.
 *
 * ⚠ SCOPED TO SECTION TOGGLES. Finding ROWS carry `-row-toggle` since the
 * collision fix, so this cannot accidentally expand every row on the panel.
 */

beforeEach(() => {
  useStrengthenStore.setState({ records: {}, priorityOrder: [] } as never)
})
afterEach(() => cleanup())

describe('the surface renders real content on a completed run', () => {
  it('shows all four sections with findings, not just headings', () => {
    renderBody(openStrategicChallenge())
    openAllSections()

    const insights = screen.getByTestId('analysis-new-key-insights')
    expect(within(insights).getAllByTestId('analysis-new-key-insights-row').length).toBeGreaterThan(0)
    expect(insights).toHaveTextContent('Supplier lead time dominates the model')

    const drivers = screen.getByTestId('analysis-new-drivers')
    expect(within(drivers).getAllByTestId('analysis-new-drivers-row').length).toBeGreaterThan(0)
    expect(drivers).toHaveTextContent('Supplier lead time')
  })

  it('carries the run identity both tabs share, so the comparison is checkable on screen', () => {
    renderBody(genuineDecision())
    expect(screen.getByTestId('analysis-new-tab-body')).toHaveAttribute('data-run-identity', 'run_abc123')
  })
})

/**
 * V2 fidelity gap 23: "Drivers appear twice in Challenge: the 'Top drivers'
 * rows sit directly above a 'What moves the outcome' header with a nested
 * 'Drivers and dynamics' header and an orphan 'Value of information' h3."
 *
 * `highUncertainty()` is used because it is the one fixture in this file that
 * carries BOTH a driver (`f_adopt`) and `decisionVoi: 'measured_non_zero'`, so
 * a single render exercises everything nested inside "What moves the
 * outcome": the driver chart section AND the value-of-information block.
 *
 * ⚠ REVERT THE PRODUCTION CHANGE TO SEE THIS RED. Before the fix, "Drivers and
 * dynamics" was `SectionShell`'s own `<h3>` and "Value of information" was a
 * bare `<h3>` in `AnalysisNewTabBody.tsx` — both landed inside the region this
 * test queries, so `headings.length` read 2, not 0.
 */
describe('V2 gap 23: nothing nested inside "What moves the outcome" reads as a second heading', () => {
  it('the region holds no h1-h4 — its own title, outside the region, is the only heading', () => {
    renderBody(highUncertainty())
    openAllSections()
    const region = screen.getByTestId('analysis-new-what-moves-the-outcome-region')
    const headings = region.querySelectorAll('h1, h2, h3, h4')
    expect(
      Array.from(headings).map((h) => h.textContent),
      'a heading element nested here reads as a second (or third) section title under "What moves the outcome"',
    ).toEqual([])
    // Positive control: the content the old headings named must still be on
    // screen — this is a flatten, not a deletion.
    expect(region).toHaveTextContent(COPY.sections.drivers)
    expect(region).toHaveTextContent(COPY.decisionVoi.label)
    // And every factor keeps its edit control — the chart bar that opens the
    // value editor (`DriverInfluenceChart`, unTouched by this change).
    expect(within(region).getAllByTestId('analysis-new-drivers-row').length).toBeGreaterThan(0)
    expect(within(region).getAllByTestId('analysis-new-driver-chart-bar').length).toBeGreaterThan(0)
  })
})

describe('F · the three scenario classes (§24F)', () => {
  it('OPEN STRATEGIC CHALLENGE — no forced winner or option framing', () => {
    renderBody(openStrategicChallenge())
    openAllSections()
    const body = screen.getByTestId('analysis-new-tab-body')
    expect(body.textContent).not.toMatch(/\bwins\b|\bwinner\b|scores higher/i)
    // …and it is NOT empty: a decision-first IA would have nothing to say here.
    expect(within(screen.getByTestId('analysis-new-key-insights')).getAllByTestId('analysis-new-key-insights-row').length)
      .toBeGreaterThan(0)
  })

  it('GENUINE DECISION — the leading option is named once, as the answer', () => {
    // Stated ONCE, by "At a glance". It used to appear here AND as a key
    // insight one viewport below — measured on a real run, all three insights
    // were restatements of the glance.
    //
    // ⚠ THE HEADLINE IS NOW THE OPTION'S NAME, NOT THE SENTENCE (30 Aug 2026).
    // "…currently scores higher" is composed in the PRESENT tense and is false
    // on a stale run, so the surface typesets the subject as the answer and
    // carries the tense in an eyebrow it can reframe. The claim under test is
    // unchanged: the leader is named here, and not restated below.
    renderBody(genuineDecision())
    openGroups()
    expect(screen.queryByTestId('analysis-new-glance-headline'), 'Paul ruled 18 Sep 2026: delete the conclusion entirely. The panel names no leading option.').toBeNull()
    expect(screen.getByTestId('analysis-new-key-insights').textContent).not.toContain(
      'currently scores higher',
    )
  })

  /**
   * ⚠⚠ REBOUND, NOT RELAXED — AND THE MEASUREMENT THAT FORCED IT.
   *
   * This case asserted `body.textContent).not.toContain('Raise price')`. That
   * string is the OPTION'S LABEL, and "How the options compare" prints it as a
   * plain row — so the assertion was satisfied by the section being CLOSED, not
   * by the product withholding anything.
   *
   * Measured at the tip before this change, on this very fixture, with the
   * suite's own `openAllSections()`:
   *
   *     closed   'Raise price' false   'Hold price' false
   *     opened   'Raise price' TRUE    'Hold price' TRUE
   *     'currently scores higher'  absent in BOTH states
   *
   * Two things follow. The assertion was ALREADY false of the product one click
   * away — every neighbour in this file calls `openAllSections()` and this was
   * the only one that did not. And it is SYMMETRIC: the losing option's label
   * appears too, so it was never discriminating a leader DESIGNATION from a
   * list of options — it was a value-predicate another object satisfies, which
   * is the binding defect CLAUDE.md trap 19 exists for.
   *
   * The claim in this test's NAME — "says nothing about a leader" — is kept and
   * made STRONGER: the leader-naming SENTENCE is still forbidden everywhere,
   * the designation surfaces must not exist, and the option's name may not
   * appear ANYWHERE OUTSIDE the comparison list that is entitled to print it.
   * That last assertion is the one the old string could not make, and it now
   * fails loud if a designation reappears anywhere on the tab.
   */
  it('LEADER WITHHELD — the same fixture with one boolean flipped says nothing about a leader', () => {
    // The discriminating twin of the case above.
    //
    // ⚠ THE FIXTURE CARRIES THE PRODUCER'S REFUSAL MESSAGE. Without it
    // `designationWithheldReason` is null, the glance has nothing to render,
    // and this arm was asserting about a labelled landmark with no content in
    // it. With the message the glance renders its withheld sentence, so the
    // claim "the name appears nowhere outside the comparison" is checked
    // against a glance that actually has words in it.
    renderBody(decisionWithLeaderWithheldAndReason())
    const body = screen.getByTestId('analysis-new-tab-body')
    expect(body.textContent).not.toContain('currently scores higher')

    // No designation surface exists on this run.
    expect(screen.queryByTestId('analysis-new-glance-headline')).toBeNull()
    expect(screen.getByTestId('analysis-new-glance').textContent).not.toContain('Raise price')

    // …and the name appears NOWHERE outside the comparison list, which is the
    // one place licensed to print every option's own label.
    const options = screen.queryByTestId('analysis-new-options')
    // PRECONDITION, PINNED IN-TEST: this case is only meaningful while the
    // comparison is the licensed printer. If it stops rendering, the subtraction
    // below silently becomes `body.textContent` and the case changes meaning.
    expect(options, 'the comparison must render, or this assertion is a different one').not.toBeNull()
    // ⭐ V2 FIDELITY (24 Sep 2026, re-pointed for gap 17): NO OPENING STEP
    // LEFT. The section is `bare` inside "Move towards commitment" now — no
    // `SectionShell`, no toggle, no closed state — so its labels are in the
    // DOM unconditionally and `openSection` (a no-op against a section with no
    // `-toggle`) is not needed to reach them.
    expect(options).not.toHaveAttribute('data-section-open')
    expect(options!.textContent).toContain('Raise price')
    const elsewhere = (body.textContent ?? '').split(options!.textContent ?? '\u0000').join('')
    expect(elsewhere).not.toContain('Raise price')
  })

  /**
   * ⚠ REBOUND, NOT RELAXED. This asserted its finding inside
   * `analysis-new-uncertainty`; `highUncertainty()`'s only row is a
   * `SENSITIVE_ASSUMPTION`, which now lands in "What would change your mind".
   * The claim in this test's NAME is prominence, and the move serves it better
   * — the row went from a collapsed section twelfth of fourteen to an open one
   * third — so the assertion follows the finding AND is strengthened from
   * "present somewhere" to "above the coaching". Presence alone was always the
   * weaker claim than the name promised.
   */
  it('HIGH UNCERTAINTY — uncertainty is prominent and the analysis is NOT presented as blocked', () => {
    // ⚠ LICENSED (24 Sep 2026): the fixture's only row is a fragile edge, and
    // "What would change your mind" mounts only on a run allowed to name a
    // leader. The claim here is prominence, not the licence.
    renderBody(withLeaderLicensed(highUncertainty()))
    openAllSections()
    const sensitivity = screen.getByTestId('analysis-new-sensitivity')
    expect(within(sensitivity).getAllByTestId('analysis-new-sensitivity-row').length).toBeGreaterThan(0)
    expect(sensitivity).toHaveTextContent('Customer adoption')
    // PROMINENT means ahead of the answer, not merely on the page.
    // ⚠ V2 (24 Sep 2026): RE-ANCHORED. This read "above the coaching", and the
    // coaching was the Strengthen wall below the answer. V2 retires that mount
    // (its findings are the review tool's queue, under the model strip) and
    // moves "What would change your mind" into "Challenge the thinking", which
    // sits ABOVE the answer zone. So prominence is now: inside that zone, and
    // before the glance and the figures.
    const challenge = screen.getByTestId('analysis-new-zone-also-group')
    const answer = screen.getByTestId('analysis-new-zone-answer-group')
    expect(challenge).toContainElement(sensitivity)
    expect(
      Boolean(sensitivity.compareDocumentPosition(answer) & Node.DOCUMENT_POSITION_FOLLOWING),
      'the sensitive assumption must sit above the answer it qualifies',
    ).toBe(true)

    const body = screen.getByTestId('analysis-new-tab-body')
    // Nothing may read as a readiness refusal — RunAdmission owns that.
    expect(body.textContent).not.toMatch(/not ready|cannot run|blocked/i)
    // The producer's own partial-run reason is carried verbatim, not dramatised.
    expect(screen.getByTestId('analysis-new-status-note')).toHaveTextContent(
      'Two factors could not be sampled to the requested precision.',
    )
    // The set-relative caveat fires, so no absolute causal-share claim stands.
    /* ⭐ IT LIVES ON THE CHART'S SCALE NOTE SINCE 17 Sep 2026. Move 5 routes
       each clause onto the thing it qualifies; this one denies a reading of the
       SCALE, so it renders under the scale legend rather than in the section's
       caveat slot, which now carries the exclusion clause alone. */
    expect(screen.getByTestId('analysis-new-driver-chart-scale-note')).toHaveTextContent(
      COPY.coverage.setRelativeInfluence,
    )
  })
})

describe('empty states say what was NOT established (§19)', () => {
  it('distinguishes "assessed, none found" from "never assessed"', () => {
    // High-uncertainty fixture has evidenceGapsAssessed:false but DOES have
    // uncertainties, so use a fixture with neither to reach the empty arm.
    const unassessed = {
      ...openStrategicChallenge(),
      confidence: { ...openStrategicChallenge().confidence, evidenceGapsAssessed: false },
    } as ResultsSectionDataReturn
    renderBody(unassessed)
    openAllSections()
    expect(screen.getByTestId('analysis-new-uncertainty-empty')).toHaveTextContent(
      COPY.empty.uncertaintyUnassessed,
    )

    cleanup()
    renderBody(openStrategicChallenge())
    openAllSections()
    expect(screen.getByTestId('analysis-new-uncertainty-empty')).toHaveTextContent(
      COPY.empty.uncertaintyAssessed,
    )
  })

  // ⚠ THE EMPTY-STRENGTHEN CASE LIVES IN `StrengthenTheReasoning.spec.tsx`, NOT
  // HERE, AND THAT IS A CORRECTION. This file first wrapped it in `if (empty)`
  // — and a probe showed the engine DOES emit an intervention for this fixture,
  // so the branch never ran and the case asserted nothing at all. A conditional
  // assertion is a test that cannot fail (CLAUDE.md trap 13b). The empty arm is
  // driven directly, with `interventions={[]}`, in the component's own spec;
  // what belongs HERE is the opposite proof — that a grounded intervention
  // reaches the screen through the real hook and the real engine.
  /**
   * ⭐ V2 (24 Sep 2026): RE-POINTED TO THE CHALLENGE CARD. The Strengthen list
   * is no longer mounted on this tab; the engine's top intervention is the ONE
   * card in "Challenge the thinking" (`ChallengeCard`, the body's
   * `glancePrimary`), and the rest page through the review tool. On this
   * fixture the engine emits one intervention, so it is the card's.
   * ⛔ The "at most three items" cap is RETIRED with the list: V2 shows exactly
   * one card (`getByTestId` throws on two), and the claim that mattered — what /
   * why / do-it, all from the engine, bound by the engine's id — is kept.
   */
  it('a grounded intervention reaches the screen through the real engine', () => {
    renderBody(openStrategicChallenge())
    openAllSections()
    const card = screen.getByTestId('analysis-new-challenge')
    expect(card).toHaveAttribute('data-source', 'intervention')
    // Bound by the ENGINE's id, so the card cannot be satisfied by a lookalike.
    expect(card.getAttribute('data-recommendation-id')).toMatch(/^strengthen:/)
    // What / why / do-it are all present, and all come from the engine.
    expect(within(card).getByTestId('analysis-new-challenge-heading').textContent?.trim()).not.toBe('')
    expect(within(card).getByTestId('analysis-new-challenge-work-through')).toBeInTheDocument()
    fireEvent.click(within(card).getByTestId('analysis-new-challenge-more'))
    fireEvent.click(screen.getByTestId('analysis-new-challenge-why'))
    expect(within(card).getByTestId('analysis-new-challenge-basis-why').textContent?.trim()).not.toBe('')
  })
})

describe('staleness contextualises without dominating (§20)', () => {
  it('states the MODEL changed — not that the result is wrong — and keeps the content', () => {
    // ⚠ `staleReason` IS NOW REQUIRED TO GET THIS SENTENCE. It used to fall out
    // of `isStale` alone, which is how a cannot-confirm run came to assert that
    // the user had changed their model.
    renderBody(genuineDecision(), { isStale: true, staleReason: 'changed' })
    expect(screen.getByTestId('analysis-new-status-stale')).toHaveTextContent(
      'The model has changed since this analysis ran.',
    )
    // One line, not a banner stack: the read is still on screen.
    expect(screen.getByTestId('analysis-new-glance')).toBeInTheDocument()
    expect(screen.queryByTestId('analysis-new-glance-headline'), 'Paul ruled 18 Sep 2026: delete the conclusion entirely. The panel names no leading option.').toBeNull()
  })
})

describe('progressive disclosure on the real surface (§24E)', () => {
  it('holds grounding and inspect behind two levels, and reveals them on request', () => {
    renderBody(openStrategicChallenge())
    openGroups()
    openSection('analysis-new-drivers')
    expect(screen.queryByTestId('analysis-new-drivers-grounding')).toBeNull()

    // ⭐ THE COLLISION IS GONE, SO THIS BINDS BY IDENTITY RATHER THAN BY
    // POSITION. `-toggle` used to name BOTH the section header and each finding
    // row, which forced this test to reach for "the last one inside the
    // section" — a positional binding another element could satisfy (CLAUDE.md
    // trap 19). Finding rows now carry `-row-toggle`, so the control this test
    // means is the only thing that answers to its id.
    const driverRowToggles = within(screen.getByTestId('analysis-new-drivers')).getAllByTestId(
      'analysis-new-drivers-row-toggle',
    )
    fireEvent.click(driverRowToggles[0])
    expect(screen.getByTestId('analysis-new-drivers-grounding')).toBeInTheDocument()
    expect(screen.queryByTestId('analysis-new-drivers-inspect')).toBeNull()

    fireEvent.click(screen.getAllByTestId('analysis-new-drivers-inspect-toggle')[0])
    expect(screen.getByTestId('analysis-new-drivers-inspect')).toBeInTheDocument()
  })

  /**
   * ⚠ V2 (24 Sep 2026): RE-POINTED. `DeeperAnalysis` is no longer mounted; its
   * groups render as the "Run record" detail of `AboutThisAnalysis`, collapsed
   * and last on the tab. The claim is unchanged — the technical record is on
   * the surface but NOT on the first screen, and it opens on request — and it
   * now sits two levels down (About, then its Run record detail).
   */
  it('keeps deeper technical material out of the first screen', () => {
    const ABOUT = 'analysis-new-about'
    renderBody(genuineDecision())
    // V2 fidelity gap 24: About is now itself a named group (`openGroups` would
    // open it), and this case is about About's own rest state — so it is driven
    // by hand and no group is pre-opened.
    // No second, stale mount of the old section.
    expect(screen.queryByTestId('analysis-new-deeper')).toBeNull()
    // Unconditional: the run-identity group always exists when a hash is
    // supplied, so a `if (record)` wrapper here would only ever hide a
    // regression that removed the section entirely.
    const about = screen.getByTestId(ABOUT)
    expect(screen.getByTestId(`${ABOUT}-toggle`)).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByTestId(`${ABOUT}-record-group`)).toBeNull()
    fireEvent.click(screen.getByTestId(`${ABOUT}-toggle`))
    // Still behind its own detail row once About is open.
    expect(screen.queryByTestId(`${ABOUT}-record-group`)).toBeNull()
    fireEvent.click(screen.getByTestId(`${ABOUT}-detail-record-toggle`))
    const groups = screen.getAllByTestId(`${ABOUT}-record-group`)
    expect(groups.length).toBeGreaterThan(0)
    expect(about).toContainElement(groups[0])
  })
})

describe('the empty state never contradicts the surface above it', () => {
  /**
   * A run whose ONLY insight candidate is the hinge, on a model where the
   * glance also states a condition — so the ladder produces something and then
   * everything it produced is deduped away. That is the exact shape in which
   * "No insight is grounded well enough to lead with yet" becomes false: the
   * insight WAS grounded, it is simply being stated above.
   */
  const allDeduped = () =>
    ({
      ...genuineDecision(),
      recommendation: {
        ...genuineDecision().recommendation,
        flipThresholdsStatus: 'computed',
        flipThresholds: [
          { label: 'Timeframe', node_id: 'n_t', current_value: 2, flip_value: 3, flip_reason: 'found' },
        ],
      },
      confidence: {
        ...genuineDecision().confidence,
        topFragileEdge: {
          fromId: 'f_a',
          fromLabel: 'Timeframe',
          toId: 'g',
          toLabel: 'Goal',
          alternativeWinnerLabel: 'Other',
          switchProbability: 0.4,
        },
      },
    }) as unknown as ResultsSectionDataReturn

  it('says NOTHING about key insights when everything it found is stated above', () => {
    // Witnessed on a real run: Key insights printed "No insight is grounded well
    // enough to lead with yet" while the glance directly above stated grounded
    // insights. An empty list with a non-zero candidate count means "shown
    // above", not "none found".
    renderBody(allDeduped())
    openAllSections()
    expect(screen.getByTestId('analysis-new-glance-condition')).toBeInTheDocument()
    expect(screen.queryByTestId('analysis-new-key-insights-empty')).toBeNull()
  })

  it('KEEPS the honest empty message for a run that genuinely produced none', () => {
    // The discriminating twin — without it, deleting the empty state outright
    // would satisfy the case above and lose a truthful message. Here the ladder
    // finds nothing at all, so "none grounded yet" is exactly true.
    renderBody(genuineDecision())
    openGroups()
    openSection('analysis-new-key-insights')
    expect(screen.getByTestId('analysis-new-key-insights-empty')).toHaveTextContent(
      'No insight is grounded well enough to lead with yet.',
    )
  })
})

/**
 * ⭐⭐ THE PRE-RUN SURFACE, PINNED AT WHAT A MOUNTED BUILD ACTUALLY SHOWED.
 *
 * These four assertions exist because the pre-run state was never DRIVEN until
 * the acceptance drive, and every one of them describes something the surface
 * really printed above the sentence "No analysis has run yet for this model":
 *
 *   · three bare section headings with nothing under them (~77px of furniture);
 *   · "A second reading of the same analysis run…", asserting a run;
 *   · "Analysis status: computed" and "Result completeness: full", from
 *     producer DEFAULTS rather than producer statements.
 *
 * Ninety-nine tests were green throughout. None of them rendered this state,
 * which is the whole lesson: a state nobody mounts is a state nobody tests.
 */
describe('pre-run: nothing on screen describes a run that has not happened', () => {
  it('renders no section heading that has nothing under it', () => {
    renderBody(openStrategicChallenge(), { isPreRun: true })

    // Bind by identity to the three sections that carry no pre-run content.
    // A heading with no findings and no honest empty message must not render
    // AT ALL — the section element is the assertion, not its text, because a
    // heading IS the claim that something sits beneath it.
    for (const id of [
      'analysis-new-key-insights',
      'analysis-new-drivers',
      'analysis-new-uncertainty',
    ]) {
      expect(screen.queryByTestId(id), `${id} rendered an empty heading`).toBeNull()
    }

    // POSITIVE CONTROL — without this the three nulls above would also pass on
    // a surface that failed to render anything at all.
    expect(screen.getByTestId('analysis-new-status-pre-run')).toBeInTheDocument()
    // ⚠ V2 (24 Sep 2026): the pre-run coaching is the Challenge card (the
    // Strengthen mount is retired). Bound by the engine's id, so the control
    // is content, not an empty container.
    expect(screen.getByTestId('analysis-new-challenge').getAttribute('data-recommendation-id')).toMatch(
      /^strengthen:/,
    )
  })

  it('does not claim to be a second reading of a run that has not happened', () => {
    // ⚠ THE GATE BECAME A DELETION (30 Aug 2026). The preamble was correct once
    // a run existed, so this pin originally required it in that state. It is now
    // gone in BOTH states: a panel that describes itself before doing its job
    // spends the top of the first viewport on nothing the reader came for. The
    // claim this test defends — the surface never asserts a run that has not
    // happened — is unchanged and now holds by construction.
    renderBody(openStrategicChallenge(), { isPreRun: true })
    expect(screen.queryByTestId('analysis-new-intro')).toBeNull()

    cleanup()
    renderBody(openStrategicChallenge())
    expect(screen.queryByTestId('analysis-new-intro')).toBeNull()
  })

  it('describes no run identity, status or completeness before a run', () => {
    const { container } = renderBody(openStrategicChallenge(), { isPreRun: true })
    expect(screen.queryByTestId('analysis-new-deeper')).toBeNull()
    // ⚠ V2: the run record now lives in "About this analysis", so its absence
    // is what this line means; `-deeper` alone is absent on every run now.
    expect(screen.queryByTestId('analysis-new-about')).toBeNull()

    // The exact strings the mounted build printed. Bound literally, because
    // these came from non-null DEFAULTS: a structural assertion about groups
    // would pass again the moment another defaulting field is added.
    const text = (container.textContent ?? '').toLowerCase()
    for (const lie of ['analysis status', 'result completeness', 'run identity']) {
      expect(text, `pre-run surface still says "${lie}"`).not.toContain(lie)
    }
  })
})


/**
 * ⭐⭐ THE DRIVERS EMPTY STATE — TWO OPPOSITE HARMS THAT CANNOT SHARE ONE
 * SENTENCE (post-merge review of #909).
 *
 * Harm A (shipped): a run whose factors all came back with a producer
 * `zero_reason` was told "This run did not return factor influence." It DID
 * return it — and measured it at zero. Harm B is the mirror: telling a user we
 * measured zero on a run where we genuinely received nothing. One sentence
 * cannot be honest about both, so every case below has its opposite-direction
 * twin, and the twin asserts the OTHER sentence is absent as well as the right
 * one present.
 *
 * ⚠ REACHABILITY IS PRODUCER-BOUNDED, NOT FIXTURE-ASSERTED (trap 16-inverse).
 * `zeroReason` originates at the wire — `mapV5AnalysisToReport.ts:300` reads
 * `entry.zero_reason`, `useResultsSectionData.ts:394` types it — and
 * `useResultsSectionData.ts:2730` sets `driversStatus: driverItems.length > 0 ?
 * 'computed' : driversStatus`, so rows carrying a zero reason arrive WITH
 * `driversStatus: 'computed'`. That combination is the live state, not one
 * these fixtures invented.
 */
describe('the drivers empty state distinguishes "measured at zero" from "we got nothing"', () => {
  /**
   * ⚠ PRECONDITION PINNED IN-TEST. A fixture that silently stopped producing
   * suppressed rows would make every assertion below pass for the wrong reason
   * (trap 13b: a discriminator whose discrimination depends on an unpinned
   * fixture). So each builder asserts the state it claims to be in, at the
   * ADAPTER, before the render is trusted.
   */
  const allFactorsZero = () =>
    makeData({
      drivers: {
        driversStatus: 'computed',
        drivers: [
          makeDriver({ factorKey: 'f_a', factorLabel: 'Supplier lead time', zeroReason: 'zero_outcome_diff' }),
          makeDriver({ factorKey: 'f_b', factorLabel: 'Channel mix', zeroReason: 'disconnected' }),
        ],
      },
    })

  /**
   * ⚠ BUILT, NOT SPELLED. The expected sentence is composed from the same copy
   * function and the same label map the product uses, in the order
   * `suppressedZeroReasons` preserves from the fixture's rows — so a change to
   * either reaches this spec instead of silently passing a stale literal.
   */
  const ALL_ZERO_SENTENCE = COPY.empty.noneRanked(2, [
    ZERO_REASON_BADGE_LABELS.zero_outcome_diff,
    ZERO_REASON_BADGE_LABELS.disconnected,
  ])

  const nothingReturned = () =>
    makeData({ drivers: { driversStatus: 'unavailable', drivers: [] } })

  const skipped = () => makeData({ drivers: { driversStatus: 'skipped', drivers: [] } })

  const emptyText = () => screen.getByTestId('analysis-new-drivers-empty').textContent

  it('PRECONDITION — the two fixtures differ in exactly the way the split depends on', () => {
    const zero = allFactorsZero()
    const none = nothingReturned()
    // Provably suppressed: rows present, every one carrying a producer reason…
    expect(zero.drivers.drivers).toHaveLength(2)
    expect(zero.drivers.drivers.every((d) => d.zeroReason != null)).toBe(true)
    // …and provably NOT returned on the twin. If these two ever coincide the
    // tests below stop discriminating, and this is where that shows up.
    expect(none.drivers.drivers).toHaveLength(0)
    // Both reach the SAME empty render path — which is why one sentence for
    // both was invisible until now.
    expect(vmOf(zero).drivers.findings).toHaveLength(0)
    expect(vmOf(none).drivers.findings).toHaveLength(0)
  })

  it('NOTHING RANKED — says the run returned rows and set them aside, NOT that it returned none', () => {
    renderBody(allFactorsZero())
    openAllSections()
    expect(emptyText()).toBe(ALL_ZERO_SENTENCE)
    // The twin half: the false sentence must be gone, not merely joined.
    expect(emptyText()).not.toBe(COPY.empty.drivers)
  })

  it('TWIN — GENUINELY NOTHING RETURNED keeps "did not return", and never claims a zero', () => {
    renderBody(nothingReturned())
    openAllSections()
    expect(emptyText()).toBe(COPY.empty.drivers)
    expect(emptyText()).not.toBe(ALL_ZERO_SENTENCE)
  })

  /**
   * ⭐ THE OTHER DIRECTION, AND THE REASON `driversStatus === 'computed'` IS NOT
   * THE PREDICATE. On the V5 path `useResultsSectionData.ts:3235` DEFAULTS
   * `drivers_status` to 'computed' when the field is absent, so 'computed' does
   * NOT imply rows were returned. Keying the zero sentence on the status alone
   * would manufacture the mirror falsehood on exactly this run.
   */
  it('TWIN — "computed" with NO rows must not be dressed up as a measured zero', () => {
    const data = makeData({ drivers: { driversStatus: 'computed', drivers: [] } })
    expect(data.drivers.drivers).toHaveLength(0)
    renderBody(data)
    openAllSections()
    expect(emptyText()).not.toBe(ALL_ZERO_SENTENCE)
    expect(emptyText()).toBe(COPY.empty.drivers)
  })

  it('SKIPPED is the producer saying it did not look — a third fact, not either of the two above', () => {
    renderBody(skipped())
    openAllSections()
    expect(emptyText()).toBe(COPY.empty.driversNotComputed)
    expect(emptyText()).not.toBe(COPY.empty.drivers)
    expect(emptyText()).not.toBe(ALL_ZERO_SENTENCE)
  })

  /**
   * ⚠ IDENTITY, NOT TEXT. `analysis-new-uncertainty-empty` renders a sentence
   * from the same COPY object one section below; asserting on a bare
   * `getByText` would let the uncertainty section satisfy a drivers assertion.
   * The testid binds each assertion to the section that owns it.
   */
  it('binds to the DRIVERS section, not to whichever section happens to carry the words', () => {
    renderBody(allFactorsZero())
    openAllSections()
    const drivers = screen.getByTestId('analysis-new-drivers')
    expect(within(drivers).getByTestId('analysis-new-drivers-empty')).toHaveTextContent(
      ALL_ZERO_SENTENCE,
    )
  })
})

/**
 * ⭐ A PARTIAL ANALYSIS SAYS SO ON THE SURFACE.
 *
 * `status.isProvisional` was computed at `buildAnalysisNewViewModel.ts:685` and
 * read by NONE of the six render components (contrast control at the time:
 * `isStale`, 4 hits in this component alone). The only disclosure was the bare
 * enum "partial" inside `Deeper analysis`, which `useState(false)` keeps
 * COLLAPSED by default — so on a 5-to-10-second surface a partial result was
 * presented exactly like a complete one.
 */
describe('a partial analysis carries a provisional marker on the surface', () => {
  const partialRun = () =>
    makeData({
      recommendation: { ...genuineDecision().recommendation },
      completeness: { status: 'partial', missing: ['robustness_level'], reasons: [] },
    })

  it('PRECONDITION — the fixture is provably provisional and its twin provably is not', () => {
    expect(vmOf(partialRun()).status.isProvisional).toBe(true)
    expect(vmOf(genuineDecision()).status.isProvisional).toBe(false)
  })

  it('renders the marker when the result is partial, NAMING what did not come back', () => {
    renderBody(partialRun())
    // The fixture's missing key is `robustness_level`, so the ribbon must say
    // so rather than "some results are missing" — a caveat with no content,
    // rendered in amber above the result, is one a reader learns to skip.
    expect(screen.getByTestId('analysis-new-status-provisional')).toHaveTextContent(
      'This analysis is partial. The overall robustness rating did not come back.',
    )
  })

  /**
   * ⚠ THE FALLBACK, which is the direction that keeps the naming honest. When
   * the producer names nothing this build recognises, the generic sentence must
   * still appear — never an empty list, and never a raw producer token.
   */
  it('falls back to the generic sentence when nothing nameable is missing', () => {
    renderBody(
      makeData({
        recommendation: { ...genuineDecision().recommendation, analysisStatus: 'partial' },
        completeness: { status: 'partial', missing: [], reasons: [] },
      }),
    )
    expect(screen.getByTestId('analysis-new-status-provisional')).toHaveTextContent(
      COPY.status.provisional,
    )
  })

  it('TWIN — a complete run carries NO provisional marker', () => {
    renderBody(genuineDecision())
    expect(screen.queryByTestId('analysis-new-status-provisional')).toBeNull()
  })

  it('is not the row-level badge wearing a different hat', () => {
    // `markers.provisional` ('Provisional') qualifies ONE value inside a
    // DisclosureRow. This is a claim about the whole run. If they ever collapse
    // into one string, the badge starts speaking for the run.
    expect(COPY.status.provisional).not.toBe(COPY.markers.provisional)
  })

  it('states COVERAGE, never READINESS — it does not speak for RunAdmission', () => {
    expect(COPY.status.provisional).not.toMatch(/\bready|readiness|cannot run|not ready\b/i)
  })
})

// ---------------------------------------------------------------------------
// PRE-RUN AND STALE ARE MUTUALLY EXCLUSIVE CLAIMS.
//
// Witnessed on the deployed build at `4401d6d8` (30 Aug 2026), guest session,
// saved example "Usage-Based Billing System Approach": the panel rendered
// `analysis-new-status-pre-run` ("No analysis has run yet for this model.")
// AND `analysis-new-status-stale` ("The model has changed since this analysis
// ran.") at the same time.
//
// The contract settles which is wrong: `isPreRun` is "No completed analysis is
// being displayed"; `isStale` is "The DISPLAYED run predates the current
// model". With nothing displayed, staleness has no subject.
//
// This is the SECOND instance of this shape on this surface — the block above
// records an intro that asserted a run sitting over "No analysis has run yet".
// Same defect, different pairing, which is why it is pinned both ways here.
// ---------------------------------------------------------------------------
describe('pre-run never carries a staleness claim', () => {
  it('suppresses the staleness line when no analysis is displayed', () => {
    renderBody(genuineDecision(), { isPreRun: true, isStale: true })
    expect(screen.getByTestId('analysis-new-status-pre-run')).toBeInTheDocument()
    expect(screen.queryByTestId('analysis-new-status-stale')).toBeNull()
  })

  it('OPPOSITE-DIRECTION TWIN: still shows staleness once a run IS displayed', () => {
    // Without this, the fix could pass by suppressing the line unconditionally
    // — closing a contradiction by deleting a true disclosure.
    renderBody(genuineDecision(), { isPreRun: false, isStale: true, staleReason: 'changed' })
    expect(screen.getByTestId('analysis-new-status-stale')).toHaveTextContent(
      'The model has changed since this analysis ran.',
    )
  })

  /**
   * ⭐⭐ THE CASE THIS SURFACE GOT WRONG, and the reason the two are named apart.
   *
   * `OutputsDock.tsx:981` computes ONE boolean over `'stale' || 'unknown'`, so on
   * a run CEE could not VERIFY this panel's FIRST line told the user their model
   * had CHANGED — an assertion about the world from an absence of evidence. The
   * dock's own comment forbids exactly that, and the old Analysis tab honours it
   * with strict equality (`AnalysisFreshnessNotice`, `freshness === 'stale'`).
   */
  it('says we CANNOT CONFIRM when that is all we know — never that the model changed', () => {
    renderBody(genuineDecision(), { isPreRun: false, isStale: true, staleReason: 'unconfirmed' })
    expect(screen.getByTestId('analysis-new-status-freshness-unknown')).toHaveTextContent(
      'We cannot confirm whether this analysis reflects the current model.',
    )
    // And it must NOT also make the stronger claim.
    expect(screen.queryByTestId('analysis-new-status-stale')).toBeNull()
  })

  /**
   * ⚠ FAIL-CLOSED. A caller that says nothing about WHY gets the weaker claim,
   * because not knowing why is itself a cannot-confirm. The opposite default
   * would reinstate the defect for every caller that forgets the field.
   */
  it('defaults to cannot-confirm when the caller gives no reason', () => {
    renderBody(genuineDecision(), { isPreRun: false, isStale: true })
    expect(screen.getByTestId('analysis-new-status-freshness-unknown')).toBeInTheDocument()
    expect(screen.queryByTestId('analysis-new-status-stale')).toBeNull()
  })

  it('⭐ NO staleness claim on a fresh completed run — the default state', () => {
    // ⚠ THIS CASE WAS MISSING AND A REVIEWER'S MUTANT FOUND THE HOLE. Dropping
    // the `isStale` conjunct — leaving the gate as `!isPreRun` — SURVIVED all
    // 30 tests, because nothing here asserted the line is ABSENT in the
    // surface's own default state. Its effect is to print "The model has
    // changed since this analysis ran" on EVERY completed run, including a
    // fresh one.
    //
    // That is the fabrication direction, and it is worse than the
    // contradiction this PR fixes: a self-contradiction at least tells the
    // reader something is wrong, while a confident false staleness claim tells
    // them something untrue and looks fine doing it.
    //
    // The general lesson, which is why this comment is long: my corpus tested
    // the two states where the line SHOULD appear or is contradictory, and
    // never the state where it should simply be quiet. Check what a corpus
    // EXCLUDES, not what it covers.
    renderBody(genuineDecision(), { isPreRun: false, isStale: false })
    expect(screen.queryByTestId('analysis-new-status-stale')).toBeNull()
    // Pinned in-test: this really is a displayed run, so the absence above is
    // the gate's doing and not an empty panel.
    expect(screen.getByTestId('analysis-new-glance')).toBeInTheDocument()
  })

  it('pre-run without staleness is unchanged', () => {
    renderBody(genuineDecision(), { isPreRun: true, isStale: false })
    expect(screen.getByTestId('analysis-new-status-pre-run')).toBeInTheDocument()
    expect(screen.queryByTestId('analysis-new-status-stale')).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
/**
 * ⭐⭐ A CAVEAT THAT ARRIVES AFTER THE READING IS A FOOTNOTE.
 *
 * #1039 gave the engine's warning strips a consumer on this tab — they had
 * NONE, because `CritiqueWarningStrip` is mounted by `ResultsBody`, which
 * `OutputsDock` never mounts on the `analysisNew` branch. It landed them inside
 * `DeeperAnalysis`, which sits at the BOTTOM of the tab, so the warning arrived
 * after every reading it qualifies. The legacy tab puts them at the top.
 *
 * ⚠ THIS IS THE ONLY TEST THAT CAN SEE THE PLACEMENT. `deeperAnalysisEvidence`
 * asserts what the strips SAY, which the strip components own wherever they are
 * mounted — it stayed green through the move and would stay green if they moved
 * back. Order is a property of the TAB, so it is pinned here, against the thing
 * that can actually break it.
 */
describe('the engine warning arrives before the reading it qualifies', () => {
  /**
   * ⚠ SEVERITY IS THE PRECONDITION, and my first attempt got it wrong: the
   * strip renders ONLY producer severity 'warning', and the shared
   * `manyFragileEdges` fixture carries three warnings with NO severity field —
   * so the strip correctly rendered nothing and the test failed for a reason
   * that had nothing to do with placement. Set the field explicitly.
   */
  /**
   * ⚠⚠ BUILT ON `genuineDecision()` SINCE 18 Sep 2026, AND THAT IS A REAL FIX
   * RATHER THAN A FIXTURE SWAP. It used to be a bare `makeData({...})`, whose
   * glance had no headline, verdict or condition — the ONLY thing making the
   * glance render was the primary-intervention disjunct in `hasAnything`.
   *
   * That card moved to `PrimaryIntervention` and its disjunct left `hasAnything`
   * with it, so this fixture stopped rendering a glance at all and the ordering
   * claim below had nothing to order against. ⭐ The claim is "the strip is ABOVE
   * the glance", so the fixture must produce BOTH; a fixture that produced only
   * one was testing less than its name said even before the move.
   */
  const warned = () =>
    ({
      ...genuineDecision(),
      confidence: {
        ...genuineDecision().confidence,
        inferenceWarnings: [
          {
            code: 'ROOT_NODE_DEFAULT_VALUE',
            affected_nodes: ['n_alpha'],
            message: "No observed value provided for root node 'n_alpha'; defaulted to 0.0.",
            severity: 'warning',
          },
        ],
      },
    }) as never

  /**
   * ⚠⚠ RE-POINTED — THE RULING THIS DESCRIBE BLOCK RECORDS IS REVERSED, KNOWINGLY
   * (Reasoning V2, 24 Sep 2026). Measured on served `c5000550`: the box at the
   * top pushed the chart it qualifies below the fold, so the caveat arrived a
   * whole screen BEFORE the reading, not beside it. The V2 prototype answers the
   * same need with one line directly under the chart ("Provisional · …"), read
   * with no disclosure opened, and the full list one disclosure away in About ›
   * Limitations. "A demotion nobody opens is a deletion" is answered by the
   * qualifier being at rest, beside the chart; the entries themselves are kept.
   */
  it('V2: the caveat is qualified at rest beside the chart, not in a box above the model', () => {
    renderBody(warned())
    expect(screen.queryByTestId('inference-warning-strip'), 'no box at the top').toBeNull()
    const options = screen.getByTestId('analysis-new-options')
    const qualifier = screen.getByTestId('analysis-new-commitment-qualifier')
    expect(qualifier.textContent).toMatch(/^Provisional · /)
    expect(
      options.compareDocumentPosition(qualifier) & Node.DOCUMENT_POSITION_FOLLOWING,
      'the qualifier sits directly under the chart it qualifies',
    ).toBeTruthy()
  })

  it('V2: the full caveat is kept, one disclosure away in About › Limitations', () => {
    renderBody(warned())
    const about = screen.getByTestId('analysis-new-about')
    fireEvent.click(within(about).getByTestId('analysis-new-about-toggle'))
    fireEvent.click(within(about).getByTestId('analysis-new-about-detail-limitations-toggle'))
    expect(within(about).getByTestId('inference-warning-strip')).toBeInTheDocument()
  })

  it('renders no strip at all on a run the engine raised nothing about', () => {
    // The discriminating twin: proves the two above read the warning set and
    // not a container that is always present.
    renderBody(genuineDecision())
    expect(screen.queryByTestId('inference-warning-strip')).toBeNull()
    expect(screen.queryByTestId('critique-warning-strip')).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
/**
 * ⭐⭐ THE COACHING SITS DIRECTLY UNDER THE READING IT RESPONDS TO.
 *
 * Paul's verdict on this tab was "still an absolute mess… such a lack of
 * consistency in the design", and the standing explanation was that the panel
 * coaches you until you press Analyse and then switches to reporting. Derived
 * at the bytes, that explanation is FALSE: `strengthen:success-measure` gates
 * on `goalThreshold == null`, not on the run completing, so it fires PRE-RUN,
 * and post-run the coaching gets RICHER (one card becomes five).
 *
 * The coaching never stopped. It was BURIED — seventh of ten mounts, below the
 * ranked options and below Key insights. This pins the order that fixes it:
 * what happened (the glance) → what to do about it (Strengthen) → the detail.
 *
 * ⚠ WHY IT LIVES HERE AND NOWHERE ELSE. Order is a property of the TAB, not of
 * any section, so no per-section spec can see it — the same reason the warning
 * strip's placement is pinned in this file. `firstViewportCensus` asserts text
 * redundancy across the assembled surface and `collapsedIA` asserts set
 * membership; both are order-blind by construction and stayed green through
 * this move, which is correct and is exactly why neither can stand in for this.
 *
 * ⚠ AND IT BINDS BY IDENTITY, NOT BY "SOMETHING MOVED" (trap 19). Proven with
 * a DISCRIMINATING PAIR rather than a single biting mutant:
 *   RED   — restoring the old order (Strengthen back below Key insights) fails
 *           `Strengthen precedes OptionsComparison` by name.
 *   GREEN — swapping Drivers and Uncertainty, a real reorder of two OTHER
 *           sections, leaves every assertion here passing.
 * One alone would only show sensitivity to some change; the pair shows the
 * assertion is about the named pair.
 */
describe('"What would change your mind" — its place on the tab (V2: in "Challenge the thinking")', () => {
  /** `a` comes before `b` in document order. */
  const before = (a: Element, b: Element) =>
    Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

  /**
   * ⛔ V2 (24 Sep 2026) RETIRED "BELOW THE GLANCE, ABOVE THE COACHING". V2 moves
   * this section into "Challenge the thinking", which sits ABOVE the answer
   * zone, and puts the coaching (the model-wide review tool that replaced the
   * Strengthen mount) under the model strip, above both. Rewritten to the V2
   * order, with the same three-distinct-elements precondition, so neither
   * ordering claim can hold vacuously and a move back REDs by name.
   */
  it('V2: sits in "Challenge the thinking" — below the model-wide review, above the glance', () => {
    renderBody(withLeaderLicensed(manyFragileEdges()))

    const review = screen.getByTestId('analysis-new-review')
    const sensitivity = screen.getByTestId('analysis-new-sensitivity')
    const glance = screen.getByTestId('analysis-new-glance')
    // PRECONDITION, PINNED IN-TEST: three distinct elements.
    expect(new Set([review, sensitivity, glance]).size).toBe(3)

    expect(screen.getByTestId('analysis-new-zone-also-group')).toContainElement(sensitivity)
    expect(before(review, sensitivity), 'the model-wide review comes first').toBe(true)
    expect(
      before(sensitivity, glance),
      'what would change your mind challenges the thinking before the answer is read',
    ).toBe(true)
  })

  it('leaves "Uncertainty and gaps" BELOW it, and no longer carrying the same rows', () => {
    renderBody(withLeaderLicensed(manyFragileEdges()))
    const sensitivity = screen.getByTestId('analysis-new-sensitivity')
    const uncertainty = screen.queryByTestId('analysis-new-uncertainty')
    if (uncertainty) expect(before(sensitivity, uncertainty)).toBe(true)
    // The flip sentence appears once on the whole panel, not once per section.
    const body = screen.getByTestId('analysis-new-tab-body')
    const hits = (body.textContent ?? '').split('could become the better choice').length - 1
    expect(hits, 'the sentence is on the panel more than once').toBeLessThanOrEqual(1)
  })

  /**
   * ⚠⚠ THE GATE IS `emptyMessage={null}`, NOT A CONDITIONAL, and this test is
   * what pins it. An empty list cannot distinguish "nothing would flip this"
   * from "the run did not test it", so the section must be ABSENT rather than
   * empty — `AnalysisNewSection` returns null for exactly that combination
   * (§19). A `length > 0` conditional at the mount was redundant, and a mutant
   * proved it by surviving; giving this section an empty MESSAGE is the change
   * that reopens the defect, and it REDs here.
   */
  /**
   * ⛔⛔ A WITHHELD RUN NAMES NO OPTION THAT "COULD LEAD" — witnessed live on
   * the served build (UI `3cf9fbd0`, OpenAI path, scenario `aca54686`, 24 Sep
   * 2026). With `leader_claim {permitted: false, producer_cause:
   * 'constraint_verdict_withheld'}` this section still read *Bars show how
   * often a different option was stronger in the runs where that assumption
   * came out weak. / Enterprise price → MRR / If this changes significantly,
   * "Raise Pro to £59" could lead in this model / 24%*. "Could lead" presupposes
   * a current leader — the order the run refused to state.
   *
   * ⚠ THE WITNESSED ROW, NOT A PARAPHRASE: the hook's own template, the edge
   * names and the 24% the screen showed, on the two licence twins
   * (`genuineDecision` / `decisionWithLeaderWithheld`), which differ ONLY in the
   * licence fields. So the permitted arm is the contrast control that proves the
   * row reaches the screen at all — without it, the withheld arm would pass on
   * a fixture that renders nothing.
   */
  describe('⛔ a withheld run names no option that "could lead" (served witness, 24 Sep)', () => {
    const WITNESS_ALT = 'Raise Pro to £59'
    const withWitnessedEdge = (base: ResultsSectionDataReturn): ResultsSectionDataReturn => {
      const template = manyFragileEdges().confidence.uncertainties.find(
        (u) => u.code === 'SENSITIVE_ASSUMPTION',
      )
      expect(template, 'precondition: the fixture carries a fragile-edge row to copy').toBeDefined()
      const sentence = `If "Enterprise price → MRR" changes significantly, "${WITNESS_ALT}" could lead in this model`
      return {
        ...base,
        confidence: {
          ...base.confidence,
          uncertainties: [
            {
              ...template,
              message: sentence,
              displayText: sentence,
              messageWithSubjectNamedAbove: `If this changes significantly, "${WITNESS_ALT}" could lead in this model`,
              edgeFromLabel: 'Enterprise price',
              edgeToLabel: 'MRR',
              edgeLabelsResolved: true,
              alternativeWinnerId: 'opt_a',
              alternativeWinnerLabel: WITNESS_ALT,
              switchProbability: 0.24,
            },
          ],
        },
      } as unknown as ResultsSectionDataReturn
    }
    const COULD_LEAD = /could lead in this model/i
    const openSensitivity = () => {
      const toggle = screen.getByTestId('analysis-new-sensitivity-toggle')
      if (toggle.getAttribute('aria-expanded') !== 'true') fireEvent.click(toggle)
    }

    it('CONTRAST — the licensed twin shows the row, its bar and its caption', () => {
      renderBody(withWitnessedEdge(genuineDecision()))
      openSensitivity()
      const section = screen.getByTestId('analysis-new-sensitivity')
      expect(section.textContent ?? '').toMatch(COULD_LEAD)
      expect(within(section).getAllByTestId('analysis-new-sensitivity-flip-bar')).toHaveLength(1)
      expect(within(section).getByTestId('analysis-new-sensitivity-caveat').textContent).toContain(
        'came out weak',
      )
    })

    it('⛔ the withheld twin: no "could lead", no bar, no caption — and no heading over nothing', () => {
      renderBody(withWitnessedEdge(decisionWithLeaderWithheld()))
      // Every closed toggle on the panel is opened, so an absence below cannot
      // be a closed region hiding the sentence.
      openAllSections()
      const body = screen.getByTestId('analysis-new-tab-body')
      expect(body.textContent ?? '', 'the panel names an option that could lead').not.toMatch(COULD_LEAD)
      expect(screen.queryAllByTestId('analysis-new-sensitivity-flip-bar')).toHaveLength(0)
      expect(body.textContent ?? '').not.toContain('a different option was stronger')
      // The section has nothing left that does not presuppose a leader, so it
      // must be ABSENT — not a heading over an empty list.
      expect(screen.queryByTestId('analysis-new-sensitivity')).toBeNull()
      expect(screen.queryByText(COPY.sections.sensitivity)).toBeNull()
      // …and the zone this section lives in rendered, so the absence is the
      // gate's doing rather than an unrendered tab.
      expect(screen.getByTestId('analysis-new-zone-also-group')).toBeInTheDocument()
    })
  })

  it('does not mount at all when the run named no sensitive assumption', () => {
    renderBody(genuineDecision())
    expect(screen.queryByTestId('analysis-new-sensitivity')).toBeNull()
    // …and the surface is genuinely rendered, so the absence is the gate's
    // doing rather than an empty render.
    expect(screen.getByTestId('analysis-new-glance')).toBeInTheDocument()
  })
})

describe('the coaching and the answer — V2 zone order', () => {
  /** `a` comes before `b` in document order. */
  const precedes = (a: Element, b: Element) =>
    Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

  /**
   * ⛔⛔ SUPERSEDED, DELIBERATELY AND WITH ITS REASONING KEPT.
   *
   * This case pinned "Strengthen ABOVE the options comparison". The ruling
   * behind it was sound — coaching belongs beside the reading it responds to —
   * but it treated the OPTIONS COMPARISON as detail, and it is not: "how the
   * options compare" and "what your model implies" ARE the answer.
   *
   * Under the old order a reader on a run whose glance withheld got a caveat,
   * then coaching, and the figures fifteen blocks later. A branch was added to
   * promote them on exactly those runs, which made the answer's POSITION depend
   * on how well the run went. The answer now renders once, beside the glance,
   * on every run.
   *
   * So the rule splits in two, and both halves are pinned below:
   *   the ANSWER is above the coaching   (new)
   *   the coaching is above the DETAIL   (unchanged, minus the answer)
   */
  /**
   * ⛔⛔ V2 (24 Sep 2026) SUPERSEDES THE ORDER BELOW, and the reasoning above is
   * kept for the record. V2's zones run: method strip → model strip → the
   * model-wide REVIEW tool (the coaching: Strengthen's findings, one queue) →
   * "Challenge the thinking" → the answer ("Move towards commitment", with the
   * glance and the comparison) → further detail → "About this analysis". So the
   * coaching now sits ABOVE the answer on every run, by design. What survives
   * from the old rule: the glance leads the figures, and the coaching is above
   * the DETAIL. Each case below states its V2 relation.
   */
  it('V2: the review sits above the answer, and the figures lead the glance reading inside it', () => {
    renderBody(genuineDecision())
    const glance = screen.getByTestId('analysis-new-glance')
    const options = screen.getByTestId('analysis-new-options')
    const review = screen.getByTestId('analysis-new-review')
    expect(new Set([glance, options, review]).size, 'three distinct elements').toBe(3)

    // V2 (fidelity gap 1, 25 Sep 2026): the figures lead; the glance's reading
    // follows them. Its status ribbon stays above (`theChartLeadsTheReading.spec.tsx`).
    expect(precedes(options, glance), 'the figures lead; the glance reading follows them').toBe(true)
    expect(precedes(review, glance), 'V2: the model-wide review comes before the answer').toBe(true)
  })

  it('keeps the coaching above every detail section, not merely above one of them', () => {
    // The move is "above the DETAIL", and the options comparison is only the
    // first of it. Bound section by section so a partial restoration cannot
    // pass by clearing one.
    //
    // ⚠ THE LIST IS A HAND-MAINTAINED MIRROR (trap 12) AND IT HAS ALREADY BEEN
    // SHORT ONCE: `analysis-new-checks` was missing until the readout was
    // mounted, and a section absent from this list is silently uncovered while
    // the case reads green. `getByTestId` THROWS on an id that does not
    // render, so a stale entry fails loudly rather than dropping out — which
    // is the property that makes adding to it safe and never adding the drift.
    renderBody(genuineDecision())
    openGroups()
    // ⚠ V2 (24 Sep 2026): the coaching is the review tool (the Strengthen mount
    // is retired), and `analysis-new-checks` LEFT THE LIST because
    // `WhatWeChecked` is no longer mounted — "About this analysis" absorbs it,
    // so About takes its place and the checks' coverage moves with them.
    const strengthen = screen.getByTestId('analysis-new-review')
    // ⚠ `analysis-new-options` LEFT THIS LIST ON PURPOSE — it is the ANSWER,
    // not detail, and the case above pins it ABOVE the coaching. Removing it
    // here without that case would have dropped the coverage silently, which
    // is the exact drift this comment block warns about one paragraph up.
    // ⚠⚠ `analysis-new-drivers` LEFT THIS LIST ON 17 Sep 2026, FOR THE SAME
    // REASON `analysis-new-options` DID, AND UNDER A RULING RATHER THAN A
    // READING. Paul was asked which of two senses of his acceptance bar's
    // "what matters most" was intended — the DRIVERS (what the answer turns on)
    // or the recommended next move — and ruled the drivers. So the drivers are
    // the ANSWER, not detail, and "What moves the outcome" now renders inside
    // the answer zone.
    //
    // ⛔ THE COVERAGE MOVED, IT DID NOT DISAPPEAR — which is precisely what the
    // paragraph above says must happen: the case directly below pins the
    // drivers ABOVE the coaching, the mirror of the options case. Dropping the
    // id without that case is the silent drift this block warns about.
    const detail = [
      'analysis-new-about',
      'analysis-new-key-insights',
      'analysis-new-uncertainty',
    ]
    for (const id of detail) {
      const section = screen.getByTestId(id)
      expect(precedes(strengthen, section), `the review must precede ${id}`).toBe(true)
    }
  })

  /**
   * ⭐ WHERE THE DRIVERS' COVERAGE WENT. The case above stopped asserting
   * `strengthen -> drivers` when the ruling reclassified them; this asserts the
   * OPPOSITE relation, so the pair still covers the drivers' position and a
   * regression in either direction REDs.
   *
   * ⚠ IT IS THE MIRROR OF THE OPTIONS CASE, deliberately, because they are now
   * the same claim: the answer is above the coaching, and "what the answer
   * turns on" is part of the answer.
   */
  /**
   * ⛔ V2 (24 Sep 2026) RETIRED "DRIVERS ABOVE THE COACHING". V2 moves "What
   * moves the outcome" into "Challenge the thinking": below the review tool,
   * ABOVE the answer zone. Rewritten to that relation — still a pair of
   * distinct, named elements, so a move in either direction REDs.
   */
  /**
   * ⚠ RE-POINTED, Reasoning V2 first screen (24 Sep 2026). What the answer
   * turns on is still read BEFORE the answer — as the "Top drivers" rows of the
   * challenge signals — and the full drivers chart (closed at rest) now follows
   * the answer it explains, so the options chart reaches the first screen.
   */
  it('V2: the top drivers are read in the challenge, before the answer; the full chart follows it', () => {
    renderBody(genuineDecision())
    openGroups()
    const review = screen.getByTestId('analysis-new-review')
    const signals = screen.getByTestId('analysis-new-signals')
    const drivers = screen.getByTestId('analysis-new-drivers')
    const answer = screen.getByTestId('analysis-new-zone-answer-group')
    expect(new Set([review, signals, drivers, answer]).size, 'four distinct elements').toBe(4)
    expect(screen.getByTestId('analysis-new-zone-also-group')).toContainElement(signals)
    expect(precedes(review, signals), 'the model-wide review comes first').toBe(true)
    expect(precedes(signals, answer), 'what the answer turns on is read before the answer').toBe(true)
    expect(answer, 'the full drivers chart follows the answer, inside its zone').toContainElement(drivers)
  })

  it('the ordering probe can actually detect a wrong order', () => {
    // ⭐ The discriminating half, in-test. Without it "everything is in order"
    // could mean the probe is broken rather than the surface being right —
    // `compareDocumentPosition` on a detached or identical node returns a mask
    // with no FOLLOWING bit, which would read as a silent false.
    const root = document.createElement('div')
    root.innerHTML = '<i id="first"></i><i id="second"></i>'
    const first = root.querySelector('#first')!
    const second = root.querySelector('#second')!
    expect(precedes(first, second)).toBe(true)
    expect(precedes(second, first)).toBe(false)
  })
})

/**
 * ⛔ "COULD CHANGE IF" IS NOT SAID AT REST ON A RUN WHOSE LEADER IS WITHHELD.
 *
 * Served witness, UI `c3a39ae7`, OpenAI path, scenario `3d00c023`: a run with
 * `leader_claim.permitted: false` (`constraint_verdict_withheld`) showed, at
 * rest, "Could change if Enterprise tier availability passes 0.9 binary". A
 * flip threshold is where the CURRENT ORDER of the options changes, so it
 * presupposes a leader reading this run is not entitled to state — the same
 * rule V2 already applies to the sensitivity header and the Challenge tipping
 * row. The row below is shaped to reproduce that sentence; it is a fixture,
 * not a capture of the wire.
 *
 * ⚠ THE TWINS DIFFER IN THE TWO LICENCE FIELDS ONLY (`decisionWithLeaderWithheld`
 * spreads `genuineDecision` and moves `verdict.hasLeadingOption` and
 * `leaderDesignationPermitted` together), and both carry the same computed row.
 * Nothing is opened: the glance renders at rest, and "at rest" is the claim.
 *
 * ⛔ THE PERMITTED TWIN NO LONGER READS "passes 0.9 binary", AND THAT WAS A LEAK
 * THIS SPEC USED TO PIN. `binary` is the factor's TYPE descriptor, not a unit
 * (`isSuppressedUnit`), so the permitted sentence takes the unit-less
 * `current -> flip` form. Pinned in full by `anInternalTypeIsNeverAUnit.spec.tsx`.
 */
describe('the glance states no tipping point on a withheld run', () => {
  const ENTERPRISE_ROW = {
    label: 'Enterprise tier availability',
    node_id: 'n_enterprise',
    current_value: 0,
    flip_value: 0.9,
    unit: 'binary',
    flip_reason: 'found',
  }
  const withRow = (data: ResultsSectionDataReturn): ResultsSectionDataReturn =>
    ({
      ...data,
      recommendation: {
        ...data.recommendation,
        flipThresholdsStatus: 'computed',
        flipThresholds: [ENTERPRISE_ROW],
      },
    }) as unknown as ResultsSectionDataReturn

  it('⛔ WITHHELD: no "Could change if" line anywhere at rest; the PERMITTED twin shows it', () => {
    const permitted = renderBody(withRow(genuineDecision()))
    // POSITIVE CONTROL FIRST, same mount path: the row IS renderable, and on
    // the permitted twin it reaches the glance at rest.
    expect(screen.getByTestId('analysis-new-glance-condition')).toHaveTextContent(
      'Could change if Enterprise tier availability moves from 0 to 0.9',
    )
    permitted.unmount()

    const { container } = renderBody(withRow(decisionWithLeaderWithheld()))
    expect(screen.queryByTestId('analysis-new-glance-condition')).toBeNull()
    // The whole body at rest, not one testid: the sentence must not surface
    // through any sibling either.
    expect(container.textContent ?? '').not.toContain('Could change if')
    // The permitted twin's OWN sentence, so this absence is not vacuous.
    expect(container.textContent ?? '').not.toContain('Enterprise tier availability moves from')
  })
})

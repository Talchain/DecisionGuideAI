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

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import {
  decisionWithLeaderWithheld,
  genuineDecision,
  highUncertainty,
  makeData,
  makeDriver,
  openStrategicChallenge,
  manyFragileEdges,
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
const openAllSections = () => {
  for (const toggle of Array.from(
    document.querySelectorAll<HTMLElement>('[data-testid$="-toggle"]'),
  )) {
    if (toggle.getAttribute('aria-expanded') !== 'true') fireEvent.click(toggle)
  }
}

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
    expect(screen.getByTestId('analysis-new-glance-headline')).toHaveTextContent('Raise price')
    expect(screen.getByTestId('analysis-new-key-insights').textContent).not.toContain(
      'currently scores higher',
    )
  })

  it('LEADER WITHHELD — the same fixture with one boolean flipped says nothing about a leader', () => {
    // The discriminating twin of the case above.
    renderBody(decisionWithLeaderWithheld())
    const body = screen.getByTestId('analysis-new-tab-body')
    expect(body.textContent).not.toContain('currently scores higher')
    expect(body.textContent).not.toContain('Raise price')
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
    renderBody(highUncertainty())
    openAllSections()
    const sensitivity = screen.getByTestId('analysis-new-sensitivity')
    expect(within(sensitivity).getAllByTestId('analysis-new-sensitivity-row').length).toBeGreaterThan(0)
    expect(sensitivity).toHaveTextContent('Customer adoption')
    // PROMINENT means above the coaching, not merely on the page.
    const strengthen = screen.getByTestId('analysis-new-strengthen')
    expect(
      Boolean(sensitivity.compareDocumentPosition(strengthen) & Node.DOCUMENT_POSITION_FOLLOWING),
      'the sensitive assumption must sit above the coaching that responds to it',
    ).toBe(true)

    const body = screen.getByTestId('analysis-new-tab-body')
    // Nothing may read as a readiness refusal — RunAdmission owns that.
    expect(body.textContent).not.toMatch(/not ready|cannot run|blocked/i)
    // The producer's own partial-run reason is carried verbatim, not dramatised.
    expect(screen.getByTestId('analysis-new-status-note')).toHaveTextContent(
      'Two factors could not be sampled to the requested precision.',
    )
    // The set-relative caveat fires, so no absolute causal-share claim stands.
    expect(screen.getByTestId('analysis-new-drivers-caveat')).toHaveTextContent(
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
  it('a grounded intervention reaches the screen through the real engine', () => {
    renderBody(openStrategicChallenge())
    openAllSections()
    const items = screen.getAllByTestId('analysis-new-strengthen-item')
    expect(items.length).toBeGreaterThan(0)
    expect(items.length).toBeLessThanOrEqual(3)
    const first = items[0]
    // What / why / do-it are all present, and all come from the engine.
    expect(within(first).getByTestId('analysis-new-strengthen-why')).toBeInTheDocument()
    expect(within(first).getByTestId('analysis-new-strengthen-action')).toBeInTheDocument()
    // Bound by the ENGINE's id, so a row cannot be satisfied by a lookalike.
    expect(first.getAttribute('data-recommendation-id')).toMatch(/^strengthen:/)
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
    expect(screen.getByTestId('analysis-new-glance-headline')).toBeInTheDocument()
  })
})

describe('progressive disclosure on the real surface (§24E)', () => {
  it('holds grounding and inspect behind two levels, and reveals them on request', () => {
    renderBody(openStrategicChallenge())
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

  it('keeps deeper technical material out of the first screen', () => {
    renderBody(genuineDecision())
    // Unconditional: the run-identity group always exists when a hash is
    // supplied, so a `if (deeper)` wrapper here would only ever hide a
    // regression that removed the section entirely.
    expect(screen.getByTestId('analysis-new-deeper')).toBeInTheDocument()
    expect(screen.queryByTestId('analysis-new-deeper-group')).toBeNull()
    fireEvent.click(screen.getByTestId('analysis-new-deeper-toggle'))
    expect(screen.getAllByTestId('analysis-new-deeper-group').length).toBeGreaterThan(0)
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
    expect(screen.getByTestId('analysis-new-strengthen')).toBeInTheDocument()
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

  it('MEASURED AT ZERO — says the run returned influence, and NOT that it returned none', () => {
    renderBody(allFactorsZero())
    openAllSections()
    expect(emptyText()).toBe(COPY.empty.driversAllZero)
    // The twin half: the false sentence must be gone, not merely joined.
    expect(emptyText()).not.toBe(COPY.empty.drivers)
  })

  it('TWIN — GENUINELY NOTHING RETURNED keeps "did not return", and never claims a zero', () => {
    renderBody(nothingReturned())
    openAllSections()
    expect(emptyText()).toBe(COPY.empty.drivers)
    expect(emptyText()).not.toBe(COPY.empty.driversAllZero)
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
    expect(emptyText()).not.toBe(COPY.empty.driversAllZero)
    expect(emptyText()).toBe(COPY.empty.drivers)
  })

  it('SKIPPED is the producer saying it did not look — a third fact, not either of the two above', () => {
    renderBody(skipped())
    openAllSections()
    expect(emptyText()).toBe(COPY.empty.driversNotComputed)
    expect(emptyText()).not.toBe(COPY.empty.drivers)
    expect(emptyText()).not.toBe(COPY.empty.driversAllZero)
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
      COPY.empty.driversAllZero,
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
      'This analysis is partial — the robustness check did not come back.',
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
  const warned = () =>
    makeData({
      confidence: {
        inferenceWarnings: [
          {
            code: 'ROOT_NODE_DEFAULT_VALUE',
            affected_nodes: ['n_alpha'],
            message: "No observed value provided for root node 'n_alpha'; defaulted to 0.0.",
            severity: 'warning',
          },
        ],
      } as never,
    })

  it('mounts the warning strip ABOVE the glance, not below the sections', () => {
    renderBody(warned())

    const strip = screen.queryByTestId('inference-warning-strip')
    const glance = screen.getByTestId('analysis-new-glance')
    // Pinned in-test: this fixture really does carry warnings, so a null strip
    // would be the mount failing rather than the run being clean.
    expect(strip).not.toBeNull()
    expect(
      strip!.compareDocumentPosition(glance) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('renders it without the reader opening anything', () => {
    // The demotion this fixes: a chevron between the reader and an engine
    // warning is a demotion, and a demotion nobody opens is a deletion.
    renderBody(warned())
    expect(screen.getByTestId('inference-warning-strip')).toBeInTheDocument()
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
describe('"What would change your mind" sits between the reading and the coaching', () => {
  /** `a` comes before `b` in document order. */
  const before = (a: Element, b: Element) =>
    Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

  it('mounts BELOW the glance and ABOVE the coaching', () => {
    renderBody(manyFragileEdges())

    const glance = screen.getByTestId('analysis-new-glance')
    const sensitivity = screen.getByTestId('analysis-new-sensitivity')
    const strengthen = screen.getByTestId('analysis-new-strengthen')
    // PRECONDITION, PINNED IN-TEST: three distinct elements, so neither
    // ordering claim can hold vacuously.
    expect(new Set([glance, sensitivity, strengthen]).size).toBe(3)

    expect(
      before(glance, sensitivity),
      'it is a property of the result the glance just stated, so it cannot precede it',
    ).toBe(true)
    expect(
      before(sensitivity, strengthen),
      'below the coaching it is detail again — which is where it came from',
    ).toBe(true)
  })

  it('leaves "Uncertainty and gaps" BELOW it, and no longer carrying the same rows', () => {
    renderBody(manyFragileEdges())
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
  it('does not mount at all when the run named no sensitive assumption', () => {
    renderBody(genuineDecision())
    expect(screen.queryByTestId('analysis-new-sensitivity')).toBeNull()
    // …and the surface is genuinely rendered, so the absence is the gate's
    // doing rather than an empty render.
    expect(screen.getByTestId('analysis-new-glance')).toBeInTheDocument()
  })
})

describe('the coaching sits directly under the reading it responds to', () => {
  /** `a` comes before `b` in document order. */
  const precedes = (a: Element, b: Element) =>
    Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

  it('mounts Strengthen ABOVE the options comparison, and below the glance', () => {
    // `genuineDecision()` carries two labelled options, so OptionsComparison
    // actually mounts — it returns null on `totalCount === 0`, and an absent
    // element would make this pass for the wrong reason.
    renderBody(genuineDecision())

    const glance = screen.getByTestId('analysis-new-glance')
    const strengthen = screen.getByTestId('analysis-new-strengthen')
    const options = screen.getByTestId('analysis-new-options')

    // PRECONDITIONS, PINNED IN-TEST: three distinct elements really are on the
    // surface, so neither ordering claim below can hold vacuously.
    expect(new Set([glance, strengthen, options]).size).toBe(3)

    // WHAT HAPPENED → WHAT TO DO ABOUT IT.
    expect(
      precedes(glance, strengthen),
      'the glance must stay above the coaching: coaching that arrives before the finding it answers has no subject',
    ).toBe(true)

    // WHAT TO DO ABOUT IT → THE DETAIL. This is the move itself.
    expect(
      precedes(strengthen, options),
      'Strengthen must sit above the options comparison — burying it below the detail is the defect this pins',
    ).toBe(true)
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
    const strengthen = screen.getByTestId('analysis-new-strengthen')
    const detail = [
      'analysis-new-checks',
      'analysis-new-options',
      'analysis-new-key-insights',
      'analysis-new-drivers',
      'analysis-new-uncertainty',
    ]
    for (const id of detail) {
      const section = screen.getByTestId(id)
      expect(precedes(strengthen, section), `Strengthen must precede ${id}`).toBe(true)
    }
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

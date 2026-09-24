/**
 * A SECTION WHOSE COLLAPSED ROW ADVERTISES NOTHING MAY NOT HIDE ITS CONTENT.
 *
 * ⛔ WHY THIS EXISTS SEPARATELY FROM `theTippingPointRenders.spec.tsx`. That
 * spec calls `openAllSections()` before every query — correctly, for what it
 * asks — and is therefore STRUCTURALLY UNABLE to observe this defect: it forces
 * open the very disclosure whose resting state is the thing under test. A run
 * could render the threshold sentence nowhere a reader can reach it and that
 * file would stay green, because it clicks its way past the failure.
 *
 * `SectionShell` UNMOUNTS a closed region, so "behind a click" here means
 * ABSENT FROM THE DOCUMENT — not merely out of sight.
 *
 * ⚠ EVERY ARM PINS ITS OWN PRECONDITION IN-TEST. A fixture that quietly stopped
 * producing zero sensitivity findings, or stopped producing a tipping point,
 * would make the claim below vacuous in the direction that keeps a suite green
 * (trap 13b). The pin runs FIRST and fails on its own message.
 *
 * ⭐ V2 RE-POINT (716b8e67, 24 Sep 2026). Tip #1 is now stated AT REST by the
 * Challenge signals row (`analysis-new-signals-tipping-sentence`) and the
 * section header carries only tips #2.. — and both only on a run licensed to
 * name a leader ("…before <option> leads"). So:
 *   · the fixtures are PERMITTED (`manyFragileEdges` publishes no licence, which
 *     made every tipping assertion here read zero for the gate's reason);
 *   · a lone threshold is pinned where it now lives, at rest, in the signals
 *     row — and the section, with nothing left to hold, does not open itself;
 *   · the header-only rule keeps its own arm, with a SECOND found threshold,
 *     which is the only tip the section header can still carry.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { sectionOpensItself } from '../sections/AnalysisNewSection'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import { manyFragileEdges } from './analysisNewFixtures'
import { openGroupsIfPresent } from './openNamedGroups'

/** Paul's run `1dd2133d`, verbatim — the row the producer marked `found`. */
const FOUND_THRESHOLD = {
  label: 'Tech Lead Presence',
  node_id: '3457913d',
  current_value: 0.6,
  flip_value: 0.9619,
  alternative_winner_label: 'Two Developers',
  flip_reason: 'found',
}

/** A second found row (the shape `reasoningSignals.spec.tsx` uses) — the tip #2 the header carries. */
const SECOND_FOUND = { ...FOUND_THRESHOLD, label: 'Onboarding Time', node_id: 'n_onb', current_value: 3, flip_value: 5 }

/** Tip #1's owner at rest (V2): the Challenge signals row. */
const SIGNAL_TIP = 'analysis-new-signals-tipping-sentence'

/**
 * The thresholds, on a run LICENSED to name a leader — the composed answer and
 * its Q2 conjunct move together (see `decisionWithLeaderWithheld`).
 */
const withFlipThresholds = (
  data: ResultsSectionDataReturn,
  rows: readonly unknown[] = [FOUND_THRESHOLD],
): ResultsSectionDataReturn =>
  ({
    ...data,
    recommendation: {
      ...data.recommendation,
      flipThresholds: rows,
      leaderDesignationPermitted: true,
      verdict: { hasLeadingOption: true },
    },
  }) as ResultsSectionDataReturn

/** The reachable class: a run that found threshold(s) and returned no sensitivity rows. */
const noSensitivityFindings = (rows: readonly unknown[] = [FOUND_THRESHOLD]): ResultsSectionDataReturn => {
  const data = manyFragileEdges()
  return withFlipThresholds({
    ...data,
    confidence: {
      ...data.confidence,
      uncertainties: (data.confidence.uncertainties ?? []).filter(
        (u: { code?: string }) => u.code !== 'SENSITIVE_ASSUMPTION',
      ),
    },
  } as ResultsSectionDataReturn, rows)
}

const renderBody = (data: ResultsSectionDataReturn) =>
  render(
    <AnalysisNewTabBody
      resultsSectionData={data}
      isPreRun={false}
      isRunning={false}
      isStale={false}
      responseHash="promises_nothing"
    />,
  )

/**
 * Opens the section under test — and the groups above it — for the
 * PRECONDITIONS, which count what the section holds when open.
 *
 * ⚠ V2 (24 Sep 2026): THIS WAS `openAllSections()`, AND IT CAN NO LONGER
 * CONVERGE ON THIS TAB. `AboutThisAnalysis`'s three details ("Values and
 * ranges", "Limitations", "Run record") are ONE-OPEN-AT-A-TIME by design, so a
 * blind open-every-closed-toggle pass closes one detail each time it opens
 * another (measured: `analysis-new-about-detail-limitations-toggle` is left
 * closed after six passes). The preconditions only ever counted THIS section's
 * rows and tipping points, so opening this section by identity is the
 * narrower, exact instrument; it asserts the section really is open.
 */
const openTheSensitivitySection = () => {
  openGroupsIfPresent()
  const toggle = screen.queryByTestId('analysis-new-sensitivity-toggle')
  if (toggle && toggle.getAttribute('aria-expanded') === 'false') fireEvent.click(toggle)
  expect(screen.getByTestId('analysis-new-sensitivity')).toHaveAttribute('data-section-open', 'true')
}

/** Opens the named GROUPS only, leaving every section at its resting state. */
const atRest = (data: ResultsSectionDataReturn) => {
  renderBody(data)
  openGroupsIfPresent()
}

afterEach(cleanup)

describe('a row that promises nothing may not hide something', () => {
  it('⭐ puts the threshold in the document AT REST when the section has no findings', () => {
    // V2: a lone threshold is tip #1, and tip #1 is the signals row's — AT REST,
    // with no click, which is this file's whole claim.
    atRest(noSensitivityFindings())
    expect(screen.getAllByTestId(SIGNAL_TIP)).toHaveLength(1)
    expect(screen.getByTestId(SIGNAL_TIP)).toHaveTextContent('Tech Lead Presence')
    // …and with no rows and nothing left for its header, the section does not
    // render at all — rather than open itself to repeat the sentence above.
    expect(screen.queryByTestId('analysis-new-sensitivity')).toBeNull()
    expect(screen.queryAllByTestId('analysis-new-sensitivity-tipping-point')).toHaveLength(0)
  })

  it('⭐ a HEADER-ONLY section opens itself AT REST (tip #2, no findings)', () => {
    // PRECONDITION, pinned on the same fixture: no sensitivity rows, one
    // header threshold. Without this the claim below could pass on a fixture
    // that grounds neither half.
    const fixture = () => noSensitivityFindings([FOUND_THRESHOLD, SECOND_FOUND])
    renderBody(fixture())
    openTheSensitivitySection()
    expect(
      screen.queryAllByTestId('analysis-new-sensitivity-row'),
      'fixture no longer produces ZERO sensitivity findings — the case under test is gone',
    ).toHaveLength(0)
    expect(
      screen.queryAllByTestId('analysis-new-sensitivity-tipping-point'),
      'fixture no longer produces a header threshold — nothing to keep reachable',
    ).toHaveLength(1)
    cleanup()

    // THE CLAIM: with no rows, the collapsed row carries no count and so
    // promises nothing; the section must therefore open itself.
    atRest(fixture())
    expect(screen.getByTestId('analysis-new-sensitivity')).toHaveAttribute(
      'data-section-open',
      'true',
    )
    expect(screen.queryAllByTestId('analysis-new-sensitivity-tipping-point')).toHaveLength(1)
    expect(screen.getByTestId('analysis-new-sensitivity-tipping-point')).toHaveTextContent(
      'Onboarding Time',
    )
    // And it is open because it has nothing to advertise, not in spite of it.
    expect(screen.queryByTestId('analysis-new-sensitivity-count')).toBeNull()
    // Tip #1 is at rest too, on its own surface.
    expect(screen.getByTestId(SIGNAL_TIP)).toHaveTextContent('Tech Lead Presence')
  })

  it('⭐ leaves a section that DOES advertise its contents closed at rest', () => {
    // The discriminating twin (trap 19). Without it the arm above could be a
    // section that opens unconditionally, which would spend the height budget
    // this panel's disclosure exists to protect.
    const data = withFlipThresholds(manyFragileEdges(), [FOUND_THRESHOLD, SECOND_FOUND])

    renderBody(data)
    openTheSensitivitySection()
    const rows = screen.queryAllByTestId('analysis-new-sensitivity-row').length
    expect(rows, 'fixture no longer produces the MULTI-row case this twin needs').toBeGreaterThan(1)
    expect(
      screen.queryAllByTestId('analysis-new-sensitivity-tipping-point'),
      'precondition: the open section DOES hold a header threshold',
    ).toHaveLength(1)
    cleanup()

    atRest(data)
    expect(screen.getByTestId('analysis-new-sensitivity')).toHaveAttribute(
      'data-section-open',
      'false',
    )
    expect(screen.queryAllByTestId('analysis-new-sensitivity-tipping-point')).toHaveLength(0)
    // …and this row earns the right to hide it: it says how much is behind it.
    expect(screen.getByTestId('analysis-new-sensitivity-count')).toHaveTextContent(String(rows))
  })
})

describe('sectionOpensItself', () => {
  it('opens a header-only section', () => {
    expect(sectionOpensItself(0, true, false)).toBe(true)
  })

  it('⛔ does NOT open a section whose header sits above an empty message', () => {
    // The drivers guard. Drivers passes an UNCONDITIONAL chart as its header
    // and an empty message on every post-run path, so without this conjunct
    // every driverless run would auto-open to an empty chart above a sentence
    // explaining there is nothing to chart.
    expect(sectionOpensItself(0, true, true)).toBe(false)
  })

  it('leaves the plain empty state closed, as it always was', () => {
    expect(sectionOpensItself(0, false, true)).toBe(false)
  })

  it('preserves the single-finding rule', () => {
    expect(sectionOpensItself(1, false, true)).toBe(true)
    expect(sectionOpensItself(1, true, false)).toBe(true)
  })

  it('keeps a multi-row section closed', () => {
    expect(sectionOpensItself(2, true, false)).toBe(false)
    expect(sectionOpensItself(5, false, true)).toBe(false)
  })
})

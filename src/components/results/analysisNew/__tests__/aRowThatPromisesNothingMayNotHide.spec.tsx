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

const withFlipThresholds = (data: ResultsSectionDataReturn): ResultsSectionDataReturn =>
  ({
    ...data,
    recommendation: { ...data.recommendation, flipThresholds: [FOUND_THRESHOLD] },
  }) as ResultsSectionDataReturn

/** The reachable class: a run that found a threshold and returned no sensitivity rows. */
const noSensitivityFindings = (): ResultsSectionDataReturn => {
  const data = manyFragileEdges()
  return withFlipThresholds({
    ...data,
    confidence: {
      ...data.confidence,
      uncertainties: (data.confidence.uncertainties ?? []).filter(
        (u: { code?: string }) => u.code !== 'SENSITIVE_ASSUMPTION',
      ),
    },
  } as ResultsSectionDataReturn)
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
    // PRECONDITION, pinned on the same fixture: no sensitivity rows, one
    // threshold. Without this the claim below could pass on a fixture that
    // grounds neither half.
    renderBody(noSensitivityFindings())
    openTheSensitivitySection()
    expect(
      screen.queryAllByTestId('analysis-new-sensitivity-row'),
      'fixture no longer produces ZERO sensitivity findings — the case under test is gone',
    ).toHaveLength(0)
    expect(
      screen.queryAllByTestId('analysis-new-sensitivity-tipping-point'),
      'fixture no longer produces a found threshold — nothing to keep reachable',
    ).toHaveLength(1)
    cleanup()

    // THE CLAIM: with no rows, the collapsed row carries no count and so
    // promises nothing; the section must therefore open itself.
    atRest(noSensitivityFindings())
    expect(screen.getByTestId('analysis-new-sensitivity')).toHaveAttribute(
      'data-section-open',
      'true',
    )
    expect(screen.queryAllByTestId('analysis-new-sensitivity-tipping-point')).toHaveLength(1)
    expect(screen.getByTestId('analysis-new-sensitivity-tipping-point')).toHaveTextContent(
      'Tech Lead Presence',
    )
    // And it is open because it has nothing to advertise, not in spite of it.
    expect(screen.queryByTestId('analysis-new-sensitivity-count')).toBeNull()
  })

  it('⭐ leaves a section that DOES advertise its contents closed at rest', () => {
    // The discriminating twin (trap 19). Without it the arm above could be a
    // section that opens unconditionally, which would spend the height budget
    // this panel's disclosure exists to protect.
    const data = withFlipThresholds(manyFragileEdges())

    renderBody(data)
    openTheSensitivitySection()
    const rows = screen.queryAllByTestId('analysis-new-sensitivity-row').length
    expect(rows, 'fixture no longer produces the MULTI-row case this twin needs').toBeGreaterThan(1)
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

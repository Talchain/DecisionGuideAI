/**
 * The threshold the producer found reaches the screen.
 *
 * `buildTippingPoints` is pinned by its own unit spec. This one exists because
 * a correct builder nobody renders is this estate's most-repeated failure —
 * "we build more than we plug in" — and the feature being added here IS a fix
 * for exactly that: `flip_thresholds[]` reached the store already and the tab
 * read it only through `attestsNoFactorFlip`, the negative attestation.
 *
 * Data is Paul's run `1dd2133d` verbatim.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import { manyFragileEdges } from './analysisNewFixtures'

/**
 * V2 RE-POINT (Reasoning V2, 24 Sep 2026). "What would change your mind" moved
 * into the "Challenge the thinking" zone and is opened here BY ITS TESTID.
 * `openAllSections` cannot converge on the V2 tab: About's detail rows are a
 * one-at-a-time accordion, so opening every closed toggle re-closes a sibling.
 * The section is asserted OPEN before it is read, so a "renders nothing" case
 * below can never pass on a closed (unmounted) region.
 */
const SENSITIVITY = 'analysis-new-sensitivity'
const openSensitivity = () => {
  const toggle = screen.getByTestId(`${SENSITIVITY}-toggle`)
  if (toggle.getAttribute('aria-expanded') !== 'true') fireEvent.click(toggle)
  expect(
    screen.getByTestId(`${SENSITIVITY}-toggle`),
    'the section must be open before it is read',
  ).toHaveAttribute('aria-expanded', 'true')
}

const REAL_ROWS = [
  {
    label: 'Tech Lead Presence',
    node_id: '3457913d',
    current_value: 0.6,
    flip_value: 0.9619,
    alternative_winner_label: 'Two Developers',
    flip_reason: 'found',
  },
  {
    label: 'Additional Developer Headcount',
    node_id: '634c5855',
    current_value: 1.2,
    flip_value: null,
    flip_reason: 'no_effect_within_bounds',
  },
  {
    label: 'Hiring and Onboarding Cost',
    node_id: '7809def4',
    current_value: 93000,
    flip_value: null,
    flip_reason: 'structurally_invariant',
  },
]

const withFlipThresholds = (rows: unknown): ResultsSectionDataReturn => {
  const data = manyFragileEdges()
  return {
    ...data,
    recommendation: { ...data.recommendation, flipThresholds: rows },
  } as ResultsSectionDataReturn
}

const renderBody = (data: ResultsSectionDataReturn) => {
  const r = render(
    <AnalysisNewTabBody
      resultsSectionData={data}
      isPreRun={false}
      isRunning={false}
      isStale={false}
      responseHash="tipping_point"
    />,
  )
  // `SectionShell` unmounts a closed region, so a query before this finds
  // nothing whether or not the line exists.
  openSensitivity()
  return r
}

afterEach(cleanup)

describe('the tipping point reaches the screen', () => {
  it('states the found threshold, with the producer’s numbers and both names', () => {
    renderBody(withFlipThresholds(REAL_ROWS))
    const lines = screen.getAllByTestId('analysis-new-sensitivity-tipping-point')
    expect(lines).toHaveLength(1)
    expect(lines[0]).toHaveTextContent(
      'Tech Lead Presence would have to rise from 0.6 to 0.96 before Two Developers leads in this model.',
    )
  })

  it('names the missing scale when the producer states no unit', () => {
    // Reviewed 16 Sep: a bare 0.6 -> 0.96 is precise and unreadable. Where the
    // producer supplies no unit the line must acknowledge the missing
    // interpretation rather than present the numbers as if they carried one.
    renderBody(withFlipThresholds(REAL_ROWS))
    expect(screen.getAllByTestId('analysis-new-sensitivity-tipping-point')[0]).toHaveTextContent(
      'The model does not record what that scale measures',
    )
  })

  it('adds nothing when the producer DOES state a unit', () => {
    // The discriminating twin. Without it the clause could be unconditional,
    // which would name a gap that is not there on a run that has the scale.
    renderBody(
      withFlipThresholds([{ ...REAL_ROWS[0], unit: '£', current_value: 60, flip_value: 96 }]),
    )
    const line = screen.getAllByTestId('analysis-new-sensitivity-tipping-point')[0]
    expect(line).toHaveTextContent('from £60 to £96')
    expect(line).not.toHaveTextContent('does not record what that scale measures')
  })

  it('survives a run with no sensitivity findings, which used to discard it', () => {
    // Found by independent review. `AnalysisNewSection` returned null on
    // `findings.length === 0 && !emptyMessage`, and this section passes
    // `emptyMessage={null}` — so a real producer tipping point was deleted by a
    // guard asking about a different field.
    const data = withFlipThresholds(REAL_ROWS)
    const stripped = {
      ...data,
      confidence: {
        ...data.confidence,
        uncertainties: (data.confidence.uncertainties ?? []).filter(
          (u: { code?: string }) => u.code !== 'SENSITIVE_ASSUMPTION',
        ),
      },
    } as ResultsSectionDataReturn
    renderBody(stripped)
    // ⚠ PRECONDITION, PINNED IN-TEST. This arm's whole subject is the ZERO-row
    // case; if the filter above ever stopped emptying the list, the assertions
    // below would pass through the ordinary path and this test would go green
    // while testing nothing (trap 13b).
    expect(
      screen.queryAllByTestId('analysis-new-sensitivity-row'),
      'the fixture no longer strips every sensitivity finding — this arm is vacuous',
    ).toHaveLength(0)
    const lines = screen.getAllByTestId('analysis-new-sensitivity-tipping-point')
    expect(lines).toHaveLength(1)
    expect(lines[0]).toHaveTextContent('Tech Lead Presence')
  })

  it('renders nothing when no row was found, on the SAME fixture', () => {
    // The discriminating half. Without it, a pass above could be the section
    // rendering something unconditionally; this proves the line is the
    // producer's doing (trap 19 — bind to the object, not to a coincidence).
    renderBody(withFlipThresholds(REAL_ROWS.filter((r) => r.flip_reason !== 'found')))
    expect(screen.queryAllByTestId('analysis-new-sensitivity-tipping-point')).toHaveLength(0)
  })

  it('renders nothing when the producer sent no thresholds at all', () => {
    renderBody(withFlipThresholds(undefined))
    expect(screen.queryAllByTestId('analysis-new-sensitivity-tipping-point')).toHaveLength(0)
  })
})

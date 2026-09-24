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
 *
 * ⭐ V2 RE-POINT (716b8e67, 24 Sep 2026) — THE FIRST TIPPING POINT HAS ONE OWNER,
 * AND EVERY TIPPING SENTENCE IS LEADER-GATED.
 *   · Tip #1 is stated AT REST by the Challenge signals row
 *     (`ReasoningSignals`, `analysis-new-signals-tipping-sentence`). The "What
 *     would change your mind" header carries only tips #2.. — it used to open
 *     itself and print tip #1 a second time.
 *   · The sentence reads "…before <option> leads", which presupposes a current
 *     leader, so neither surface states it unless `leaderClaimPermitted`.
 * `manyFragileEdges` publishes no `leaderDesignationPermitted`, so every
 * positive arm below runs on `permitted(...)` and the withheld twin
 * (`withheld(...)`) asserts ABSENCE on both surfaces — that twin is the point
 * of the gate. The two fixtures differ in the two gate fields only.
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

/**
 * A SECOND found row, the shape `reasoningSignals.spec.tsx` uses. It exists only
 * so there IS a tip #2 for the section header to carry; its numbers are not a
 * capture and nothing asserts them beyond "this row, not the first".
 */
const SECOND_FOUND = { ...REAL_ROWS[0], label: 'Onboarding Time', node_id: 'n_onb', current_value: 3, flip_value: 5 }

/**
 * The run's leader licence — the composed answer and its Q2 conjunct move
 * TOGETHER (see `decisionWithLeaderWithheld` for why a split pair is a shape the
 * producer cannot emit). Nothing else differs between the two.
 */
const licence = (permitted: boolean) => ({
  leaderDesignationPermitted: permitted,
  verdict: { hasLeadingOption: permitted },
})

const withFlipThresholds = (rows: unknown, permitted = true): ResultsSectionDataReturn => {
  const data = manyFragileEdges()
  return {
    ...data,
    recommendation: { ...data.recommendation, flipThresholds: rows, ...licence(permitted) },
  } as ResultsSectionDataReturn
}

/** Tip #1's owner: the Challenge signals row, at rest. */
const SIGNAL_TIP = 'analysis-new-signals-tipping-sentence'
/** Tips #2.. : the "What would change your mind" header. */
const SECTION_TIP = 'analysis-new-sensitivity-tipping-point'

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
    // V2: tip #1 is the signals row's, at rest — exactly one, exact sentence.
    const lines = screen.getAllByTestId(SIGNAL_TIP)
    expect(lines).toHaveLength(1)
    expect(lines[0]).toHaveTextContent(
      'Tech Lead Presence would have to rise from 0.6 to 0.96 before Two Developers leads in this model.',
    )
    // …and the (open) section does not say it a second time.
    expect(screen.queryAllByTestId(SECTION_TIP), 'the section must not repeat tip #1').toHaveLength(0)
  })

  it('names the missing scale when the producer states no unit', () => {
    // Reviewed 16 Sep: a bare 0.6 -> 0.96 is precise and unreadable. Where the
    // producer supplies no unit the line must acknowledge the missing
    // interpretation rather than present the numbers as if they carried one.
    renderBody(withFlipThresholds(REAL_ROWS))
    expect(screen.getByTestId(SIGNAL_TIP)).toHaveTextContent(
      'The model does not record what that scale measures',
    )
  })

  it('adds nothing when the producer DOES state a unit', () => {
    // The discriminating twin. Without it the clause could be unconditional,
    // which would name a gap that is not there on a run that has the scale.
    renderBody(
      withFlipThresholds([{ ...REAL_ROWS[0], unit: '£', current_value: 60, flip_value: 96 }]),
    )
    const line = screen.getByTestId(SIGNAL_TIP)
    expect(line).toHaveTextContent('from £60 to £96')
    expect(line).not.toHaveTextContent('does not record what that scale measures')
  })

  it('tip #2 reaches the section header, and only tip #2 — the section never repeats tip #1', () => {
    renderBody(withFlipThresholds([REAL_ROWS[0], SECOND_FOUND]))
    expect(screen.getAllByTestId(SIGNAL_TIP)).toHaveLength(1)
    expect(screen.getByTestId(SIGNAL_TIP)).toHaveTextContent('Tech Lead Presence')
    const header = screen.getAllByTestId(SECTION_TIP)
    expect(header, 'the header carries the tips AFTER the first').toHaveLength(1)
    expect(header[0]).toHaveTextContent('Onboarding Time')
    expect(header[0]).not.toHaveTextContent('Tech Lead Presence')
  })

  it('survives a run with no sensitivity findings, which used to discard it', () => {
    // Found by independent review. `AnalysisNewSection` returned null on
    // `findings.length === 0 && !emptyMessage`, and this section passes
    // `emptyMessage={null}` — so a real producer tipping point was deleted by a
    // guard asking about a different field.
    // V2: with tip #1 owned by the signals row, only a SECOND tip can still
    // reach that guard, so this arm carries two found rows.
    const data = withFlipThresholds([...REAL_ROWS, SECOND_FOUND])
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
    const lines = screen.getAllByTestId(SECTION_TIP)
    expect(lines).toHaveLength(1)
    expect(lines[0]).toHaveTextContent('Onboarding Time')
    expect(screen.getByTestId(SIGNAL_TIP)).toHaveTextContent('Tech Lead Presence')
  })

  it('renders nothing when no row was found, on the SAME fixture', () => {
    // The discriminating half. Without it, a pass above could be the section
    // rendering something unconditionally; this proves the line is the
    // producer's doing (trap 19 — bind to the object, not to a coincidence).
    renderBody(withFlipThresholds(REAL_ROWS.filter((r) => r.flip_reason !== 'found')))
    expect(screen.queryAllByTestId(SIGNAL_TIP)).toHaveLength(0)
    expect(screen.queryAllByTestId(SECTION_TIP)).toHaveLength(0)
  })

  it('renders nothing when the producer sent no thresholds at all', () => {
    renderBody(withFlipThresholds(undefined))
    expect(screen.queryAllByTestId(SIGNAL_TIP)).toHaveLength(0)
    expect(screen.queryAllByTestId(SECTION_TIP)).toHaveLength(0)
  })

  /**
   * ⛔ THE GATE'S OWN TWIN. The same two found rows, the leader licence
   * withheld: "…before <option> leads" presupposes a current leader, so NEITHER
   * surface may state a tipping point.
   *
   * ⛔ AMENDED 24 Sep 2026 — this said *"The section still renders (its rows
   * are not leader claims)"*, and that premise was refuted on the served build:
   * a withheld run's row read *If this changes significantly, "Raise Pro to
   * £59" could lead in this model*. Every row there is a fragile edge — an edge
   * whose weakening switches the recommended option — so the rows ARE leader
   * claims, and on a withheld run the section is now absent as a whole. The
   * contrast therefore moves to the licensed twin, rendered in the same test:
   * it shows the section and its header tip, so the withheld zeros are the
   * licence's doing rather than a fixture that renders nothing.
   */
  it('⛔ a WITHHELD run states no tipping point on either surface', () => {
    render(
      <AnalysisNewTabBody
        resultsSectionData={withFlipThresholds([REAL_ROWS[0], SECOND_FOUND], false)}
        isPreRun={false}
        isRunning={false}
        isStale={false}
        responseHash="tipping_point"
      />,
    )
    expect(screen.queryAllByTestId(SIGNAL_TIP), 'the signals row must not name a leader').toHaveLength(0)
    expect(screen.queryAllByTestId(SECTION_TIP), 'the section header must not name a leader').toHaveLength(0)
    expect(
      screen.queryByTestId(SENSITIVITY),
      'the section whose every row names a leader is absent on a withheld run',
    ).toBeNull()
    cleanup()
    // Contrast: the licensed twin — same rows, same thresholds — renders both.
    renderBody(withFlipThresholds([REAL_ROWS[0], SECOND_FOUND], true))
    expect(screen.queryAllByTestId(SECTION_TIP).length).toBeGreaterThan(0)
    expect(screen.queryAllByTestId('analysis-new-sensitivity-row').length).toBeGreaterThan(0)
  })
})

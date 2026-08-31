/**
 * ⭐⭐ THE INFORMATION ARCHITECTURE ITSELF, PINNED — because last time it was
 * not, and it silently did not ship.
 *
 * Both revisions of Paul's concept show the surface below "At a glance" as FIVE
 * ONE-LINE ROWS: icon, title, count, chevron. What shipped at `a9fc1564`
 * rendered four sections EXPANDED inline, and nothing anywhere went red about
 * it — no test, no guard, no gate, because every existing case asserted the
 * CONTENT of a section and none asserted the SHAPE of the surface. Measured on
 * the deployed build: 1,584px against a 769px viewport, 2.1 viewports of scroll
 * on a surface whose own header calls itself the five-to-ten-second read.
 *
 * These cases exist so that divergence cannot recur quietly. They are claims
 * about COMPOSITION, which is the class the per-component specs structurally
 * cannot see (the same gap the first-viewport census was written to close, one
 * level up).
 */

import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { openAskOlumi } from '../../coaching/askOlumiStore'
import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { AtAGlance } from '../sections/AtAGlance'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import { genuineDecision, manyFragileEdges, openStrategicChallenge } from './analysisNewFixtures'

const SECTIONS = [
  // ⚠ THIS LIST IS A HAND-MAINTAINED MIRROR (CLAUDE.md trap 12) — a section
  // missing from it is silently uncovered by every assertion below, and the
  // suite reads green. `analysis-new-options` is added in the same commit that
  // mints it; the `present` filter means a fixture without options simply
  // drops out rather than failing, so adding an id is always safe and never
  // adding one is the drift.
  'analysis-new-options',
  'analysis-new-key-insights',
  'analysis-new-strengthen',
  'analysis-new-drivers',
  'analysis-new-uncertainty',
]

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
      responseHash="run_ia"
      {...over}
    />,
  )

beforeEach(() => {
  useStrengthenStore.setState({ records: {}, priorityOrder: [] } as never)
})
afterEach(() => cleanup())

describe('the surface below the glance is a list of collapsed rows', () => {
  it('mounts every section CLOSED, with its content unmounted rather than hidden', () => {
    renderBody(manyFragileEdges())
    const present = SECTIONS.filter((id) => screen.queryByTestId(id))
    // POSITIVE CONTROL: a run rendering no sections would satisfy the loop
    // below vacuously — this is the census's own lesson (trap 13).
    expect(present.length, 'no sections rendered — this case would be vacuous').toBeGreaterThan(2)

    for (const id of present) {
      expect(screen.getByTestId(id)).toHaveAttribute('data-section-open', 'false')
      expect(screen.getByTestId(`${id}-toggle`)).toHaveAttribute('aria-expanded', 'false')
      // ⚠ UNMOUNTED, not CSS-hidden — so a screen reader never walks content
      // the sighted user cannot see. `DisclosureRow` already holds this rule;
      // the section row must not weaken it.
      expect(screen.queryByTestId(`${id}-region`)).toBeNull()
    }
  })

  /**
   * ⚠⚠ THE SAME RULE, ON A FIXTURE THAT ACTUALLY CARRIES OPTIONS — AND IT IS
   * NOT REDUNDANT WITH THE CASE ABOVE. `manyFragileEdges()` has an EMPTY option
   * list, so `analysis-new-options` renders nothing and drops straight out of
   * `present`: adding its id to `SECTIONS` covered it in appearance only, and a
   * mutant forcing that section open left this file GREEN. That is trap 13b —
   * presence of a control is not coverage of the branch — caught by running the
   * mutant rather than by reading the list.
   *
   * `genuineDecision()` carries two labelled options, so the section mounts and
   * the assertions below actually bind to it.
   */
  it('mounts the options section CLOSED on a run that HAS options', () => {
    renderBody(genuineDecision())
    // PRECONDITION, PINNED IN-TEST: without this the case silently becomes the
    // vacuous one it exists to replace.
    const section = screen.getByTestId('analysis-new-options')
    expect(section).toBeInTheDocument()

    expect(section).toHaveAttribute('data-section-open', 'false')
    expect(screen.getByTestId('analysis-new-options-toggle')).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    expect(screen.queryByTestId('analysis-new-options-region')).toBeNull()
  })

  it('opens on click, and only the section clicked', () => {
    renderBody(manyFragileEdges())
    fireEvent.click(screen.getByTestId('analysis-new-uncertainty-toggle'))

    expect(screen.getByTestId('analysis-new-uncertainty')).toHaveAttribute('data-section-open', 'true')
    expect(screen.getByTestId('analysis-new-uncertainty-region')).toBeInTheDocument()
    // The discriminating half: a shell that opened everything would pass the
    // assertion above and destroy the IA.
    expect(screen.getByTestId('analysis-new-drivers')).toHaveAttribute('data-section-open', 'false')
  })

  it('states the count on the CLOSED row, so the row promises what is behind it', () => {
    renderBody(manyFragileEdges())
    const count = screen.getByTestId('analysis-new-uncertainty-count')
    expect(count).toBeInTheDocument()
    // Bound to the SECTION, not to whichever element carries a number.
    // ⚠ FIVE — three same-code uncertainties plus two assumptions, which DO
    // belong to this section. NOT eight: the fixture's three inference warnings
    // are engine diagnostics and render in "Deeper analysis and evidence" now.
    // The row promises exactly what a reader will find behind it.
    expect(within(screen.getByTestId('analysis-new-uncertainty')).getByTestId('analysis-new-uncertainty-count'))
      .toHaveTextContent('5')

    // And it is the ACTUAL list length, not a remembered number — which is the
    // whole reason the count is derived. A count that misreports reads as "you
    // have seen everything" when you have not. Open the row (level 1), then
    // reveal the rest (level 2), and the rows must total the promised five.
    fireEvent.click(screen.getByTestId('analysis-new-uncertainty-toggle'))
    expect(screen.getAllByTestId('analysis-new-uncertainty-row')).toHaveLength(3)
    fireEvent.click(screen.getByTestId('analysis-new-uncertainty-show-more'))
    expect(screen.getAllByTestId('analysis-new-uncertainty-row')).toHaveLength(5)
  })

  it('renders NO count rather than a zero when a section is empty', () => {
    // A row reading "0" invites a click on nothing. The section still opens to
    // its honest empty sentence, which is a claim about the run.
    renderBody(genuineDecision())
    expect(screen.queryByTestId('analysis-new-key-insights-count')).toBeNull()
    fireEvent.click(screen.getByTestId('analysis-new-key-insights-toggle'))
    expect(screen.getByTestId('analysis-new-key-insights-empty')).toBeInTheDocument()
  })
})

describe('the glance declares its own cap', () => {
  it('says how many drivers the run produced beyond the three it shows', () => {
    // Measured on the deployed build: one driver shown, several in the run, and
    // no disclosure anywhere. A cap that does not declare itself reads as a
    // complete list.
    render(
      <AtAGlance
        glance={{
          headline: null, leaderLabel: null, winPercentLabel: null, winFraction: null,
          winShare: null,
          comparisonScope: { kind: 'whole_set' },
          comparativeClaim: 'none',
          verdict: null,
          drivers: [
            { id: 'a', label: 'A', fraction: 1, targetId: null },
            { id: 'b', label: 'B', fraction: 0.5, targetId: null },
            { id: 'c', label: 'C', fraction: 0.2, targetId: null },
          ],
          influenceIsSetRelative: false,
          condition: null,
          inputProvenance: null,
          primaryInterventionId: null,
        }}
        driverTotal={7}
      />,
    )
    expect(screen.getByTestId('analysis-new-glance-drivers-more')).toHaveTextContent(
      '+ 4 more drivers in this run',
    )
  })

  it('says NOTHING when the glance is showing every driver there is', () => {
    // The discriminating twin. Without it, a component that always printed the
    // line would pass the case above and lie on a complete list.
    render(
      <AtAGlance
        glance={{
          headline: null, leaderLabel: null, winPercentLabel: null, winFraction: null,
          winShare: null,
          comparisonScope: { kind: 'whole_set' },
          comparativeClaim: 'none',
          verdict: null,
          drivers: [{ id: 'a', label: 'A', fraction: 1, targetId: null }],
          influenceIsSetRelative: false,
          condition: null,
          inputProvenance: null,
          primaryInterventionId: null,
        }}
        driverTotal={1}
      />,
    )
    expect(screen.queryByTestId('analysis-new-glance-drivers-more')).toBeNull()
  })
})

describe('the one action stays in the glance', () => {
  /**
   * ⚠ WHY THIS ROW EXISTS AT ALL. It was dropped on the reasoning that
   * "Strengthen the reasoning" renders the same recommendation ~120px below —
   * true while Strengthen was EXPANDED. With the sections collapsed the
   * duplication is gone, and without this row the most action-shaped thing the
   * surface produces would sit behind a click.
   */
  it('renders the engine’s top recommendation and routes it through the non-mutating drawer', () => {
    renderBody(openStrategicChallenge())
    const row = screen.getByTestId('analysis-new-glance-primary-intervention')
    // Bound by the ENGINE's id — a lookalike cannot satisfy it.
    expect(row.getAttribute('data-recommendation-id')).toMatch(/^strengthen:/)

    fireEvent.click(row)
    expect(openAskOlumi).toHaveBeenCalledTimes(1)
    // The drawer is PREFILLED and never auto-sent; this surface writes nothing.
    expect(vi.mocked(openAskOlumi).mock.calls[0][0]).toEqual(
      expect.objectContaining({ label: expect.any(String) }),
    )
  })

  it('does not duplicate the Strengthen row it points at', () => {
    // The composition claim: one action, one primary surface. Strengthen is
    // CLOSED, so the same label cannot be on screen twice.
    renderBody(openStrategicChallenge())
    const label = screen
      .getByTestId('analysis-new-glance-primary-intervention')
      .querySelector('span > span')?.textContent?.trim()
    expect(label, 'no label on the glance action — this would be vacuous').toBeTruthy()
    expect(screen.queryByTestId('analysis-new-strengthen-item')).toBeNull()
  })
})

describe('pre-run says what the panel IS, without asserting a run', () => {
  it('orients a first-time reader and still states that nothing has run', () => {
    // Removing the intro that asserted a run was correct; nothing replaced the
    // ORIENTATION, and the existing Analysis tab offers both. Witnessed on the
    // deployed build at `a9fc1564`.
    renderBody(openStrategicChallenge(), { isPreRun: true })
    const block = screen.getByTestId('analysis-new-status-pre-run')
    expect(block).toHaveTextContent('No analysis has run yet for this model.')
    expect(block).toHaveTextContent('this panel reads it back around the reasoning')
  })

  it('still never claims a run happened', () => {
    // The discriminating twin, and the defect this whole area exists for: the
    // intro "A second reading of the same analysis run" must stay absent.
    renderBody(openStrategicChallenge(), { isPreRun: true })
    expect(screen.queryByTestId('analysis-new-intro')).toBeNull()
    expect(screen.getByTestId('analysis-new-tab-body')).not.toHaveTextContent(
      'A second reading of the same analysis run',
    )
  })
})

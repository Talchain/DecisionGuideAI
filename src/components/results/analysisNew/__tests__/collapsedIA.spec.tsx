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
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import {
  genuineDecision,
  manyFragileEdges,
  openStrategicChallenge,
  withLeaderLicensed,
} from './analysisNewFixtures'
import { openGroups } from './openNamedGroups'

const SECTIONS = [
  // ⚠ THIS LIST IS A HAND-MAINTAINED MIRROR (CLAUDE.md trap 12) — a section
  // missing from it is silently uncovered by every assertion below, and the
  // suite reads green. `analysis-new-options` is added in the same commit that
  // mints it; the `present` filter means a fixture without options simply
  // drops out rather than failing, so adding an id is always safe and never
  // adding one is the drift.
  //
  // ⛔ V2 FIDELITY (24 Sep 2026, gap 17): `analysis-new-options` REMOVED from
  // this list. It no longer mounts as a collapsed `SectionShell` row at all —
  // it is `bare` inside "Move towards commitment", always visible, with no
  // toggle, count or region — so `${id}-toggle` below would throw for it.
  // See `theWithheldRunShowsItsFigures.spec.tsx` for its own, positive,
  // always-open coverage.
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
    // ⚠ LICENSED (24 Sep 2026): "What would change your mind" mounts only on a
    // run allowed to name a leader; unlicensed, it would drop out of `present`
    // and this rule would stop covering it.
    renderBody(withLeaderLicensed(manyFragileEdges()))
    openGroups()
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
  /**
   * ⛔ V2 FIDELITY (24 Sep 2026, gap 17): RE-POINTED FROM "…CLOSED…" TO
   * "…OPEN, WITH NO DISCLOSURE AT ALL…". The deployed build nested this
   * section inside "Move towards commitment" as a `SectionShell` row, closed
   * at rest whenever the glance named a leader — hiding the comparison on the
   * run it is the entitled account of (the fidelity finding's own
   * measurement). `bare` (`OptionsComparison.tsx`) replaces the toggle/count/
   * region shell with the identical body, always visible: there is no longer
   * a collapsed state for this section to be in.
   */
  it('mounts the options section OPEN, with no toggle, count or region — it is bare', () => {
    renderBody(genuineDecision())
    // PRECONDITION, PINNED IN-TEST: without this the case silently becomes the
    // vacuous one it exists to replace.
    const section = screen.getByTestId('analysis-new-options')
    expect(section).toBeInTheDocument()

    // `bare` renders no `SectionShell` chrome at all — none of these attach.
    expect(section).not.toHaveAttribute('data-section-open')
    expect(screen.queryByTestId('analysis-new-options-toggle')).toBeNull()
    expect(screen.queryByTestId('analysis-new-options-region')).toBeNull()
    // The rows are on screen with no click, which is the whole point.
    expect(screen.getAllByTestId('analysis-new-options-row').length).toBeGreaterThan(0)
  })

  it('opens on click, and only the section clicked', () => {
    renderBody(manyFragileEdges())
    openGroups()
    fireEvent.click(screen.getByTestId('analysis-new-uncertainty-toggle'))

    expect(screen.getByTestId('analysis-new-uncertainty')).toHaveAttribute('data-section-open', 'true')
    expect(screen.getByTestId('analysis-new-uncertainty-region')).toBeInTheDocument()
    // The discriminating half: a shell that opened everything would pass the
    // assertion above and destroy the IA.
    expect(screen.getByTestId('analysis-new-drivers')).toHaveAttribute('data-section-open', 'false')
  })

  it('states the count on the CLOSED row, so the row promises what is behind it', () => {
    // LICENSED for the same reason as the first case: the sensitivity row's
    // count is half of this claim.
    renderBody(withLeaderLicensed(manyFragileEdges()))
    openGroups()
    const count = screen.getByTestId('analysis-new-uncertainty-count')
    expect(count).toBeInTheDocument()
    // Bound to the SECTION, not to whichever element carries a number.
    // ⚠ TWO, NOT FIVE — and the missing three are the point, not a loss. The
    // fixture's three same-code uncertainties are `SENSITIVE_ASSUMPTION` rows,
    // which now build into "What would change your mind"; the two assumptions
    // stay here. (Still not eight: the three inference warnings are engine
    // diagnostics and render in "Deeper analysis and evidence".) The CLAIM is
    // unchanged — the row promises exactly what a reader finds behind it — so
    // the sibling assertion below makes it about BOTH rows, or this one would
    // pass just as well on a section that had silently lost its contents.
    expect(within(screen.getByTestId('analysis-new-uncertainty')).getByTestId('analysis-new-uncertainty-count'))
      .toHaveTextContent('2')
    expect(within(screen.getByTestId('analysis-new-sensitivity')).getByTestId('analysis-new-sensitivity-count'))
      .toHaveTextContent('3')

    // And each count is the ACTUAL list length, not a remembered number —
    // which is the whole reason it is derived. A count that misreports reads as
    // "you have seen everything" when you have not.
    //
    // ⚠ TWO fits inside `UNCERTAINTY_PREVIEW`, so this section no longer needs
    // a "show more" step; the promise is met on the first open. The disclosure
    // half of the claim moves to the section that now HAS a tail.
    fireEvent.click(screen.getByTestId('analysis-new-uncertainty-toggle'))
    expect(screen.getAllByTestId('analysis-new-uncertainty-row')).toHaveLength(2)

    fireEvent.click(screen.getByTestId('analysis-new-sensitivity-toggle'))
    expect(screen.getAllByTestId('analysis-new-sensitivity-row')).toHaveLength(3)
  })

  it('renders NO count rather than a zero when a section is empty', () => {
    // A row reading "0" invites a click on nothing. The section still opens to
    // its honest empty sentence, which is a claim about the run.
    renderBody(genuineDecision())
    // ⚠ BEFORE THE NULL ASSERTION, NOT AFTER. With the group closed the count
    // is null because the section is UNMOUNTED, which would satisfy the line
    // below for a reason that has nothing to do with the rule it states.
    openGroups()
    expect(screen.queryByTestId('analysis-new-key-insights-count')).toBeNull()
    fireEvent.click(screen.getByTestId('analysis-new-key-insights-toggle'))
    expect(screen.getByTestId('analysis-new-key-insights-empty')).toBeInTheDocument()
  })
})

/**
 * ⛔ RETIRED AT `e15416ad`. "The glance declares its own cap" pinned
 * "+N more drivers in this run" beneath the glance's three driver rows. The
 * rows are gone — they restated the drivers section's ranking from the same
 * view-model fields — so there is no cap on this surface left to declare.
 *
 * ⚠ THE PROPERTY IT PROTECTED IS NOT LOST, it is now structural rather than
 * asserted: `SectionShell` renders `count={findings.length}` on the collapsed
 * "Drivers and dynamics" row, DERIVED from the actual list, and
 * `DriverInfluenceChart` renders every row with no slice. A truncation that
 * misreports what it hid cannot arise where nothing is truncated.
 * `AnalysisNewSection`'s own "Show more" count is separately derived and is
 * covered by the cases above.
 */

describe('the one action stays in the glance', () => {
  /**
   * ⚠ WHY THIS ROW EXISTS AT ALL. It was dropped on the reasoning that
   * "Strengthen the reasoning" renders the same recommendation ~120px below —
   * true while Strengthen was EXPANDED. With the sections collapsed the
   * duplication is gone, and without this row the most action-shaped thing the
   * surface produces would sit behind a click.
   *
   * ⭐ V2 (24 Sep 2026): the row's home is now `ChallengeCard`
   * (`analysis-new-challenge`), which replaced the `PrimaryIntervention` mount
   * and is handed the same `glancePrimary`. It is still at rest (no click to
   * reach it), still bound by the ENGINE's id, and its act — the AI icon
   * "Work through it" — still runs `runIntervention`, i.e. the prefilled drawer.
   */
  it('renders the engine’s top recommendation and routes it through the non-mutating drawer', () => {
    renderBody(openStrategicChallenge())
    const row = screen.getByTestId('analysis-new-challenge')
    // Bound by the ENGINE's id — a lookalike cannot satisfy it.
    expect(row.getAttribute('data-source')).toBe('intervention')
    expect(row.getAttribute('data-recommendation-id')).toMatch(/^strengthen:/)

    fireEvent.click(screen.getByTestId('analysis-new-challenge-work-through'))
    expect(openAskOlumi).toHaveBeenCalledTimes(1)
    // The drawer is PREFILLED and never auto-sent; this surface writes nothing.
    expect(vi.mocked(openAskOlumi).mock.calls[0][0]).toEqual(
      expect.objectContaining({ label: expect.any(String) }),
    )
  })

  it('does not duplicate the Strengthen row it points at', () => {
    // The composition claim: one action, one primary surface. V2: Strengthen is
    // not mounted on this tab at all, and its findings live in the review
    // queue — which must EXCLUDE the promoted one (`excludeId={glancePrimary.id}`).
    renderBody(openStrategicChallenge())
    const card = screen.getByTestId('analysis-new-challenge')
    const id = card.getAttribute('data-recommendation-id')
    const label = screen.getByTestId('analysis-new-challenge-heading').textContent?.trim()
    expect(label, 'no label on the glance action — this would be vacuous').toBeTruthy()
    expect(id, 'no engine id on the glance action — this would be vacuous').toBeTruthy()
    expect(screen.queryByTestId('analysis-new-strengthen-item')).toBeNull()

    // ⭐ UNCONDITIONAL, BY IDENTITY: at rest exactly ONE element carries the
    // engine's id — the card. (Measured: on this fixture the review queue is
    // EMPTY, so it renders no toggle; a walk gated on the toggle alone was a
    // silent skip, which is why this line does not depend on it.)
    expect(screen.getByTestId('analysis-new-review'), 'the review tool must be mounted').toBeInTheDocument()
    expect(
      document.querySelectorAll(`[data-recommendation-id="${id}"], [data-review-key="${id}"]`),
      'the promoted recommendation is carried by more than the card',
    ).toHaveLength(1)
    // …and where the queue HAS items, walk all of them: none may be the promoted one.
    const toggle = screen.queryByTestId('analysis-new-review-toggle')
    if (toggle !== null) {
      fireEvent.click(toggle)
      const seen: string[] = []
      for (let i = 0; i < 50; i += 1) {
        seen.push(screen.getByTestId('analysis-new-review-item').getAttribute('data-review-key') ?? '')
        const next = screen.getByTestId('analysis-new-review-next')
        if ((next as HTMLButtonElement).disabled) break
        fireEvent.click(next)
      }
      expect(seen, 'the promoted recommendation is offered twice').not.toContain(id)
    }
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

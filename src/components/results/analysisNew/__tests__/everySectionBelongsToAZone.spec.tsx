/**
 * ⭐⭐ EVERY SECTION LIVES IN A ZONE — the rule the zone grammar never had.
 *
 * `#1647` gave the panel four named groups so it would read as a few groups
 * rather than a flat stack of peer cards. **Nothing was ever written down that
 * says a section must be IN one**, and the deployed build shows the gap:
 * measured on served `66854e6c`, the content column's five direct children are
 * the model strip, `zone-answer-group`, **`analysis-new-sensitivity`**,
 * `zone-also-group` and `zone-further-group`. One section belongs to no group
 * at all, sitting in the space between the answer group's closing tag and the
 * also group's opening one.
 *
 * ⛔ WHY NO EXISTING GUARD CAN SEE IT, and this is the load-bearing part.
 * `theZonesAreNamed` iterates a **hardcoded four-zone list** and asks, of each
 * zone it knows, whether that zone is well-formed. Every answer is yes. It is
 * structurally incapable of noticing a section OUTSIDE all four, because a
 * section outside the list is not in the list — the hand-maintained-mirror
 * shape (CLAUDE.md trap 12), where the drift always reads as green.
 * `thePanelCannotRegrow` counts the same children and is satisfied by a low
 * number however they are arranged.
 *
 * ⭐ SO THIS RULE IS DERIVED FROM THE DOM AND CARRIES NO LIST OF SECTIONS. It
 * asks the complementary question — *of every child that rendered, is it in a
 * zone?* — which is the only form that can see a section nobody remembered.
 *
 * ⚠ ONE NAMED EXCEPTION, AND IT IS NAMED RATHER THAN PREDICATED. The model
 * strip is the panel's subject header, not one of its sections: it names what
 * the run is about and hosts the census. Writing the exception as a PREDICATE
 * ("anything that is not a section") would readmit the next unzoned section
 * silently; writing it as a NAME means adding a second exception is a visible
 * edit to this file.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { useCanvasStore } from '../../../../canvas/store'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import { genuineDecision, manyFragileEdges } from './analysisNewFixtures'
import { contentColumn, topLevelBlockElements } from './panelContentColumn'

/**
 * ⭐ THE ONE THING THAT IS NOT A SECTION. Kept as a literal id so that a second
 * entry is a deliberate, reviewable edit rather than a predicate quietly
 * widening.
 */
const NOT_A_SECTION = ['analysis-new-model-strip'] as const

const ZONE_GROUP = /^analysis-new-zone-[a-z]+-group$/

const NODES = [
  { id: 'd1', type: 'decision', data: { label: 'Which data platform to adopt' } },
  { id: 'g1', type: 'goal', data: { label: 'Sustained margin' } },
  { id: 'f1', type: 'factor', data: { label: 'Supplier lead time' } },
  { id: 'f2', type: 'factor', data: { label: 'Demand volatility' } },
]

const previous = { nodes: [] as unknown }

const renderBody = (data: ResultsSectionDataReturn) =>
  render(
    <AnalysisNewTabBody
      resultsSectionData={data}
      isPreRun={false}
      isRunning={false}
      isStale={false}
      responseHash="every_section_in_a_zone"
    />,
  )

beforeEach(() => {
  previous.nodes = useCanvasStore.getState().nodes
  useCanvasStore.setState({ nodes: NODES, goalThreshold: null } as never)
  useStrengthenStore.setState({ records: {}, priorityOrder: [] } as never)
})
afterEach(() => {
  cleanup()
  useCanvasStore.setState({ nodes: previous.nodes } as never)
})

describe('every section belongs to a zone', () => {
  /**
   * ⭐ THE PRECONDITION, PINNED IN-TEST. A rule of the form "every X is a Y"
   * is VACUOUSLY TRUE when there are no X. A traversal pointed at the scroll
   * container returns one child and satisfies this rule forever — which is the
   * exact failure `thePanelCannotRegrow`'s own docblock records catching on its
   * first run, and this file shares that traversal precisely so it cannot
   * happen twice.
   */
  it('PRECONDITION: the traversal reached the content column, not the scroll container', () => {
    renderBody(genuineDecision())
    const root = screen.getByTestId('analysis-new-tab-body')
    expect(root.children.length, 'the scroll container has exactly one child').toBe(1)
    expect(
      topLevelBlockElements().length,
      'the traversal read the scroll container — it is measuring the wrong element',
    ).toBeGreaterThan(root.children.length)
    expect(contentColumn()).not.toBe(root)
  })

  /**
   * ⭐ WHICH ARM CAN SEE THE DEFECT, PINNED. `genuineDecision` renders NO
   * sensitivity section at all, so on that fixture the rule is satisfied by an
   * absence and it proved nothing at pristine — only `manyFragileEdges` REDed.
   * An arm that cannot observe the failure is not a second opinion, and a
   * fixture that quietly stops producing fragile edges would leave this file
   * green with the grammar broken.
   */
  it('PRECONDITION: the fragile-edges fixture is the arm that can see it', () => {
    renderBody(manyFragileEdges())
    expect(screen.queryByTestId('analysis-new-sensitivity'), 'the discriminating fixture must render the section').not.toBeNull()
    cleanup()
    renderBody(genuineDecision())
    expect(screen.queryByTestId('analysis-new-sensitivity'), 'and the other arm must NOT — recorded, not assumed').toBeNull()
  })

  it.each([
    ['a run that reached a conclusion', genuineDecision],
    ['a run with many fragile edges', manyFragileEdges],
  ])('⭐ %s renders no section outside a zone', (_name, fixture) => {
    renderBody(fixture())
    const stray = topLevelBlockElements()
      .map((el) => el.getAttribute('data-testid') ?? `<${el.tagName.toLowerCase()} with no testid>`)
      .filter((id) => !ZONE_GROUP.test(id) && !(NOT_A_SECTION as readonly string[]).includes(id))
    expect(stray, 'these rendered outside every zone group').toEqual([])
  })

  /**
   * ⭐ THE COMPLEMENT, AND IT IS NOT REDUNDANT. The rule above is satisfied by
   * a panel with NO zones at all and nothing but the strip — an empty set has
   * no strays. This asserts the zones are actually carrying the sections, so
   * the rule cannot be met by deleting the grammar it exists to protect.
   */
  it('⭐ the zones are what the sections are in, not an empty frame', () => {
    renderBody(genuineDecision())
    const groups = topLevelBlockElements().filter((el) =>
      ZONE_GROUP.test(el.getAttribute('data-testid') ?? ''),
    )
    expect(groups.length, 'a rich run renders more than one zone').toBeGreaterThan(1)
    for (const g of groups) {
      expect(
        g.querySelectorAll('[data-testid]').length,
        `zone ${g.getAttribute('data-testid')} holds nothing`,
      ).toBeGreaterThan(1)
    }
  })

  /**
   * ⛔ THE EXCEPTION IS REAL AND MUST STAY REACHABLE. If the strip stopped
   * rendering, the rule above would keep passing while the exception quietly
   * described nothing — a carve-out for an element that no longer exists is
   * indistinguishable from a carve-out that is doing work.
   */
  it('the named exception names something that actually renders', () => {
    renderBody(genuineDecision())
    for (const id of NOT_A_SECTION) {
      expect(screen.queryByTestId(id), `${id} is excepted but does not render`).not.toBeNull()
    }
  })
})

/**
 * ⭐⭐ WHICH ZONE — A DIFFERENT QUESTION FROM WHETHER, AND NAMED APART.
 *
 * The rules above ask *is every section in a zone*. This asks *is this
 * particular section in the RIGHT one*, and it exists because the answer is a
 * ruling rather than a derivation: Paul, 17 Sep 2026, asked which of two
 * readings of his acceptance bar's "what matters most" was intended — the
 * DRIVERS (what the answer turns on) or the recommended next move — and ruled
 * the drivers.
 *
 * ⛔ WHY IT NEEDED A RULING AND NOT A GUESS. The code carried a reasoned
 * contrary position — that group was deliberately "DETAIL a reader goes looking
 * for" — and a second reading was defensible, since "How robust is this?" (the
 * engine's top recommendation) already renders above the fold. Overturning a
 * reasoned decision on my own reading of a one-line bar is the class of error
 * this lane keeps paying for, so the placement is pinned to the ruling and the
 * superseded rationale is quoted in full at the call site.
 *
 * ⚠ THIS FILE CANNOT SEE THE FOLD. jsdom has no layout, so "above the fold" is
 * a DEPLOYED measurement (`66854e6c`: title at 1118 against a fold at 869
 * before, fully above after) and never something asserted here. What is
 * assertable is containment and order, which is what makes the fold measurement
 * reproducible — so that is what this pins.
 */
describe('the drivers answer "what matters most", so they sit in the answer zone', () => {
  const DRIVERS = 'analysis-new-what-moves-the-outcome'

  it('PRECONDITION: the fixture renders the section at all', () => {
    renderBody(manyFragileEdges())
    expect(screen.queryByTestId(DRIVERS), 'nothing to place if it does not render').not.toBeNull()
  })

  it('⭐ the section is inside the ANSWER group, not FURTHER', () => {
    renderBody(manyFragileEdges())
    const answer = screen.getByTestId('analysis-new-zone-answer-group')
    expect(answer.contains(screen.getByTestId(DRIVERS)), 'the drivers belong to the answer').toBe(true)
    const further = screen.queryByTestId('analysis-new-zone-further-group')
    if (further !== null) {
      expect(further.contains(screen.getByTestId(DRIVERS)), 'and not to the further-reading group').toBe(false)
    }
  })

  /**
   * ⚠ ORDER, NOT JUST MEMBERSHIP. Appended at the END of the answer group the
   * section is still "in the answer zone" and still clears the fold — but it
   * reads after "what would change your mind", which inverts the sequence the
   * ruling asks for: here is the answer, how far it held, what moves it, what
   * would change it. Membership alone cannot see that.
   */
  it('⭐ it reads after the caveat and before "what would change your mind"', () => {
    renderBody(manyFragileEdges())
    const answer = screen.getByTestId('analysis-new-zone-answer-group')
    const order = Array.from(answer.children).map((c) => c.getAttribute('data-testid'))
    const caveat = order.indexOf('analysis-new-robustness-caveat')
    const drivers = order.indexOf(DRIVERS)
    const sensitivity = order.indexOf('analysis-new-sensitivity')
    expect(drivers, 'the drivers are a direct child of the answer group').toBeGreaterThan(-1)
    if (caveat > -1) expect(drivers, 'after the caveat').toBeGreaterThan(caveat)
    if (sensitivity > -1) expect(drivers, 'before what would change your mind').toBeLessThan(sensitivity)
  })
})

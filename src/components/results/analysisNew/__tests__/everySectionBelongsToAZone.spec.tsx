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
 * ⚠ THERE IS A SECOND, NARROWER RULE AND IT IS NOT A DUPLICATE OF THIS ONE.
 * `everySectionLivesInAZone.spec.ts` reads the body's SOURCE and watches one
 * boundary — components written above the first zone. It exists because this
 * file is bound by what its fixtures mount, so a section whose data is absent
 * on every fixture is invisible here and visible there. **This file is the
 * authority on zone membership**; that one is a source-level tripwire above the
 * grammar. Two questions, deliberately named apart (CLAUDE.md trap 21) after
 * the second was written without its author finding this one.
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
import { cleanup, render, screen, within } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { useCanvasStore } from '../../../../canvas/store'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import {
  decisionWithLeaderWithheld,
  genuineDecision,
  manyFragileEdges,
  withLeaderLicensed,
} from './analysisNewFixtures'

/**
 * ⚠ LICENSED (24 Sep 2026): "What would change your mind" mounts only on a run
 * allowed to name a leader, so the arm that can SEE a stray section has to be
 * one. `manyFragileEdges` itself publishes no licence.
 */
const fragileEdgesLicensed = () => withLeaderLicensed(manyFragileEdges())
import { contentColumn, topLevelBlockElements } from './panelContentColumn'
import { readFileSync } from 'node:fs'
import { resolve as resolvePath, join as joinPath } from 'node:path'
import { stripComments } from '../../../../../tests/helpers/stripSourceComments'

/** The `analysisNew` directory, for the source-derived checks at the foot of this file. */
const DIR = resolvePath(__dirname, '..')

/**
 * ⭐ THE ONE THING THAT IS NOT A SECTION. Kept as a literal id so that a second
 * entry is a deliberate, reviewable edit rather than a predicate quietly
 * widening.
 *
 * ⭐ V2 (Reasoning V2 recomposition, 24 Sep 2026) — TWO DELIBERATE, REVIEWABLE
 * ADDITIONS, each placed outside the zones by the V2 composition itself:
 * · `analysis-new-review` — `ModelReviewTool`, the model strip's own "N to
 *   review" queue, mounted directly under the strip. It reviews the model the
 *   strip describes, so it belongs with the strip's subject header.
 * · `analysis-new-about` — `AboutThisAnalysis`, the one collapsed audit utility,
 *   LAST on the tab after "If you want to go further". It absorbs the trust
 *   line, "What we checked" and the run record; it qualifies the whole run.
 * (`MethodStrip` needs no entry: it is icon-only, so `topLevelBlockElements`
 * — which skips text-empty children — never offers it as a stray.)
 */
const NOT_A_SECTION = ['analysis-new-model-strip', 'analysis-new-review', 'analysis-new-about'] as const

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
    renderBody(fragileEdgesLicensed())
    expect(screen.queryByTestId('analysis-new-sensitivity'), 'the discriminating fixture must render the section').not.toBeNull()
    cleanup()
    renderBody(genuineDecision())
    expect(screen.queryByTestId('analysis-new-sensitivity'), 'and the other arm must NOT — recorded, not assumed').toBeNull()
  })

  it.each([
    ['a run that reached a conclusion', genuineDecision],
    ['a run with many fragile edges', fragileEdgesLicensed],
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
 *
 * ⭐ V2 (24 Sep 2026) — THE RULING'S TWO HALVES SURVIVE; THE ZONE NAME MOVED.
 * V2 moved "What moves the outcome" out of the answer zone into "Challenge the
 * thinking" (`analysis-new-zone-also-group`), and moved that whole zone ABOVE
 * the answer — where `ReasoningSignals` also shows the top three drivers at
 * rest. What the ruling protects is (1) the drivers are NOT demoted to further
 * reading and (2) they are read BEFORE the answer's figures. Both are re-pinned
 * below against the V2 zone, positively and without a skip.
 */
describe('the drivers answer "what matters most", so they are read before the answer', () => {
  const DRIVERS = 'analysis-new-what-moves-the-outcome'
  const CHALLENGE = 'analysis-new-zone-also-group'

  it('PRECONDITION: the fixture renders the section at all', () => {
    renderBody(manyFragileEdges())
    expect(screen.queryByTestId(DRIVERS), 'nothing to place if it does not render').not.toBeNull()
  })

  /**
   * ⚠ RE-POINTED, Reasoning V2 first screen (24 Sep 2026): the full section now
   * follows the answer, closed, inside the ANSWER group — it explains the figures
   * it follows. What the ruling protects (the drivers are read before the
   * answer) is carried at rest by the challenge's "Top drivers" signal rows; see
   * the case below. It is still never demoted to FURTHER.
   */
  it('⭐ the full section is inside the ANSWER group, after the figures, not FURTHER', () => {
    renderBody(manyFragileEdges())
    const answer = screen.getByTestId('analysis-new-zone-answer-group')
    expect(answer.contains(screen.getByTestId(DRIVERS)), 'the full drivers section follows the answer it explains').toBe(true)
    expect(screen.getByTestId(CHALLENGE).contains(screen.getByTestId(DRIVERS))).toBe(false)
    const further = screen.queryByTestId('analysis-new-zone-further-group')
    if (further !== null) {
      expect(further.contains(screen.getByTestId(DRIVERS)), 'and not to the further-reading group').toBe(false)
    }
  })

  /**
   * ⭐⭐ ORDER, AND IT IS PAUL'S RULING OF 18 Sep: *"Take option (d) — reorder so
   * drivers come first."*
   *
   * ⛔⛔ THIS CASE WAS VACUOUS AND THE REORDER EXPOSED IT. It used to read
   * `if (caveat > -1) expect(drivers).toBeGreaterThan(caveat)` — and on every
   * fixture here the caveat is NOT a direct child of the answer group, so the
   * conditional skipped and the assertion never ran. When I moved the drivers
   * to the top of the zone, **all 27 symbol-scoped specs stayed green**: nothing
   * pinned the old order, which means nothing would have pinned the new one
   * either. A guard that skips is indistinguishable from a guard that passes.
   *
   * ⭐ SO IT NOW PINS THE RULING POSITIVELY AND CANNOT SKIP. The claim is that
   * "what matters most" is read BEFORE the figures it is about — which is the
   * whole point of the move, measured on the deployed build as +12px of fold
   * margin becoming +378px.
   *
   * ⛔ AND IT ASSERTS AGAINST THE PAIR, NOT ITS HALVES. `answerBlock` binds
   * `ModelImplication` to `OptionsComparison` ("every claim moves with its
   * entitlement"), so the drivers sit above BOTH. Asserting only against
   * `analysis-new-options` would pass if a later edit split the pair and left
   * the implication stranded above the drivers.
   */
  it.each([
    ['a run that reached a conclusion', genuineDecision],
    ['a withheld run — the surface the ruling is about', decisionWithLeaderWithheld],
  ])('⭐ %s reads the drivers BEFORE the answer\'s figures — Paul\'s ruling, not an accident', (_name, fixture) => {
    // ⚠ RE-POINTED, Reasoning V2 first screen (24 Sep 2026): the drivers read
    // before the answer are the challenge's "Top drivers" signal rows, at rest;
    // the full chart (closed) follows the figures so they reach the first screen.
    renderBody(fixture())
    const challenge = screen.getByTestId(CHALLENGE)
    const answer = screen.getByTestId('analysis-new-zone-answer-group')
    const signals = within(challenge).getByTestId('analysis-new-signals')
    // PRECONDITION: this case must not be able to pass by absence.
    expect(signals.textContent ?? '', 'the challenge must name the top drivers at rest').toMatch(/Top drivers/)
    const figures = ['analysis-new-options', 'analysis-new-implication']
      .map((id) => answer.querySelector(`[data-testid="${id}"]`))
      .filter((el): el is Element => el !== null)
    expect(figures.length, 'at least one of the answer figures must render, or this asserts nothing').toBeGreaterThan(0)

    for (const fig of figures) {
      expect(
        signals.compareDocumentPosition(fig) & Node.DOCUMENT_POSITION_FOLLOWING,
        `the top drivers must precede ${fig.getAttribute('data-testid')}`,
      ).toBeTruthy()
    }
  })
})

/**
 * ⭐⭐ A NEXT ACTION IS NOT PART OF THE ANSWER.
 *
 * Paul, 18 Sep 2026: *"Shorten the answer zone so both fit at 1440."* The
 * primary-intervention card rendered inside `AtAGlance` — its own heading there
 * read "WHAT TO THINK ABOUT NEXT" — which put an action in the zone that holds
 * the answer and cost that zone 90px including its gap.
 *
 * ⛔ WHY A GUARD AND NOT JUST THE MOVE. Nothing pinned the card's zone before,
 * so nothing would stop it drifting back: it is one JSX relocation away, and the
 * pixels that justify it are invisible to jsdom. #1671 taught this exactly —
 * every symbol-scoped spec stayed green after that reorder, because no assertion
 * owned the ordering.
 *
 * ⚠⚠ ASSERTED FROM SOURCE, NOT FROM THE DOM, AND THE REASON IS A MEASUREMENT
 * RATHER THAN A PREFERENCE: **none of this file's fixtures produces a primary
 * intervention at all** (probed across `genuineDecision`,
 * `decisionWithLeaderWithheld`, `manyFragileEdges` and `highUncertainty` — the
 * card is absent on every one, because the view model builds it from
 * recommendations these fixtures do not carry). A DOM assertion here would
 * therefore be vacuous, which is the failure this file has already had once.
 * The source position is the thing that is actually true and actually checkable.
 *
 * ⚠ THIS CANNOT SEE THE FOLD. The 89px deficit, and that this move plus two
 * whitespace corrections clears it with 23px to spare at 1440×860, are DEPLOYED
 * measurements recorded in the PR.
 */
describe('the next action lives with the other actions', () => {
  const body = readFileSync(joinPath(DIR, 'AnalysisNewTabBody.tsx'), 'utf8')

  const zoneOfMount = (mount: string): string | null => {
    const at = body.indexOf(mount)
    if (at === -1) return null
    const before = body.slice(0, at)
    const opens = [...before.matchAll(/data-testid="analysis-new-zone-(\w+)-group"/g)]
    return opens.length ? opens[opens.length - 1][1] : null
  }

  /**
   * ⭐ V2 (24 Sep 2026): `ChallengeCard` replaced the `PrimaryIntervention` mount.
   * It is handed the same `glancePrimary` (the engine's top finding) and runs it
   * through the same `runIntervention`, so it IS the next action; re-pointed to
   * it, and the old mount is asserted gone so the action cannot be in two places.
   */
  it('PRECONDITION: the card is mounted, and the zone probe can see a zone', () => {
    expect(body, 'the body must mount the card at all').toContain('<ChallengeCard')
    // the probe must be able to name a zone for a mount we KNOW is in one
    // V2 (fidelity gap 1): the glance element is built once in `renderGlance`
    // and mounted twice, so the control is its status MOUNT, not its JSX tag.
    expect(zoneOfMount("{renderGlance('status')}"), 'control: the glance is in the answer zone').toBe('answer')
  })

  it('⭐ the primary intervention is mounted in ALSO, not in the ANSWER zone', () => {
    expect(zoneOfMount('<ChallengeCard'), 'a next action belongs with the other things to do').toBe('also')
    expect(
      stripComments(body, 'AnalysisNewTabBody.tsx'),
      'V2: the replaced PrimaryIntervention mount must be gone, or the action renders twice',
    ).not.toContain('<PrimaryIntervention')
  })

  it('⛔ and AtAGlance no longer renders it, so it cannot be in two places', () => {
    const glance = readFileSync(joinPath(DIR, 'sections', 'AtAGlance.tsx'), 'utf8')
    const code = stripComments(glance, 'AtAGlance.tsx')
    expect(code, 'the card must not render from the glance any more').not.toContain('-primary-intervention')
    expect(
      code,
      'and its disjunct must have left `hasAnything` with it, or the glance renders an empty wrapper',
    ).not.toContain('primaryIntervention && onRunIntervention')
  })
})

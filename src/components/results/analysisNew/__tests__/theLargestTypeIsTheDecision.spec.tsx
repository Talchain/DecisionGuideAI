/**
 * ⭐⭐ THE PANEL'S LARGEST TYPE IS THE DECISION BEING MADE. ALWAYS.
 *
 * Paul's ruling, 18 Sep 2026, verbatim: *"Lead with the decision label and goal,
 * not the conclusion - there shouldn't be a conclusion. We are a reasoning
 * enhancement tool, not a generic AI and analysis answering tool."*
 *
 * ⛔ THIS SUPERSEDES THE 17 Sep RULING, WHICH IS KEPT HERE SO IT IS NOT
 * REINSTATED BY SOMEONE READING ONLY THE CODE: that ruling read *"the most
 * important thing on this panel right now — the conclusion when there is one,
 * otherwise the question being worked on."* It made the slot CONDITIONAL, and
 * the condition is what has been removed. A panel whose loudest element is a
 * verdict does the reader's thinking for them.
 *
 * ⛔ WHAT THE DEPLOYED BUILD DID INSTEAD, censused on served `a147cfbb` (a run
 * with a named leader, "Segment"): the 18px slot carried the GOAL, and the
 * conclusion sat at 14px — tied for size with "What your model implies", "How
 * robust is this?" and "How far this held". Four things at 14px/600 and the
 * loudest type on the surface spent on context. A reader scanning for the
 * answer found the question.
 *
 * ⭐ THE INVARIANT IS A COUNT, NOT A PLACEMENT, and that is the point. Asserting
 * only "the glance headline is 18px" would pass while the strip ALSO rendered
 * 18px — two leads, which is the same defect wearing a new face. Asserting only
 * "the strip is not 18px" would pass while NOTHING led. Both states are
 * reachable by a one-character edit to the prop, and neither has a red anywhere
 * else: every component renders, every other suite is green, and only the
 * deployed pixels would show it. So every case below counts.
 *
 * ⛔⛔ RE-DERIVED 25 Sep 2026 (design-audit-20260925, gap TYPE-1). Paul's 18
 * Sep ruling above stayed; the SLOT it describes changed shape. The 18px
 * `reasoningLead` token this file used to key its selector on is DELETED —
 * not demoted — because the ruling it answered ("lead with the decision
 * label and goal") no longer needs a size ABOVE `panelHeader` to say it: the
 * decision line now IS `panelHeader` (14px), which is also the size of every
 * zone title on the panel. A selector built from `panelHeader` would
 * therefore match every zone title too, and "exactly one element at the
 * panel's largest size" would break the moment a second zone rendered.
 *
 * ⭐⭐ THE INVARIANT IS RE-STATED, NOT WEAKENED. What Paul's ruling actually
 * requires — the decision is what the panel says FIRST, and nothing on it is
 * typeset LOUDER — survives as two separate, independently checkable facts:
 *
 *   1. NO panel text resolves above 14px (the ceiling `panelHeader` itself
 *      sits at) — pinned here as a render fact, over and above
 *      `reasoning-panel-render-discipline`'s SOURCE-level derivation, so a
 *      component that reached for a raw class rather than the retired token
 *      would still be caught by what actually paints.
 *   2. The `-lead` element (the decision, or the goal when there is no
 *      distinct decision) is the FIRST text the panel body renders — proven
 *      by walking the rendered DOM's text nodes in document order, not by a
 *      size comparison, which is the only way "leads" can mean something once
 *      several elements share one size.
 *
 * ⚠ 18px IS NO LONGER THE PANEL'S CEILING; 14px IS. That distinction is
 * pinned at `tests/ci-guards/reasoning-panel-render-discipline.spec.ts`
 * ("the panel has THREE sizes"), which is the size-vocabulary owner. This
 * file does not restate that derivation; it restates only the RENDER-level
 * consequence Paul's ruling cares about.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { resolve as resolvePath, join as joinPath } from 'node:path'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { useCanvasStore } from '../../../../canvas/store'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import { typography } from '../../../../styles/typography'
import { conclusionLabel, panelHasConclusion } from '../panelLead'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import { decisionWithLeaderWithheld, genuineDecision } from './analysisNewFixtures'
import { stripComments } from '../../../../../tests/helpers/stripSourceComments'

const renderBody = (data: ResultsSectionDataReturn) =>
  render(
    <AnalysisNewTabBody
      resultsSectionData={data}
      isPreRun={false}
      isRunning={false}
      isStale={false}
      responseHash="largest_type_is_the_answer"
    />,
  )

const glanceOf = (data: ResultsSectionDataReturn) =>
  buildAnalysisNewViewModel({ data, recommendations: [], isPreRun: false, isRunning: false, isStale: false })
    .atAGlance

/**
 * ⭐ THE SIZES THAT WOULD MAKE THE DECISION LINE NOT THE CEILING. Every
 * Tailwind step above `text-sm` (14px, `panelHeader`'s own size) — a class
 * found anywhere in the render is by construction a bigger element than the
 * decision, and Paul's ruling is broken whether or not anything is
 * data-testid'd as a "lead".
 */
const OVERSIZED_SIZE_CLASSES = ['text-base', 'text-lg', 'text-xl', 'text-2xl', 'text-3xl', 'text-4xl', 'text-5xl']

/**
 * The first non-whitespace TEXT NODE the panel body renders, in document
 * order. `jsdom` supports `TreeWalker`, so this reads the real DOM rather
 * than re-deriving order from React's tree — the same "measure what rendered"
 * discipline the file's ceiling check uses.
 */
function firstNonWhitespaceTextNode(root: HTMLElement): Text | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let node: Node | null
  while ((node = walker.nextNode())) {
    if (node.textContent && node.textContent.trim().length > 0) return node as Text
  }
  return null
}

/**
 * ⛔ THE STRIP RENDERS NOTHING ON AN EMPTY CANVAS, AND THAT IS WHY THIS IS HERE.
 * `ModelStrip` reads the graph from the canvas store, not from the results
 * fixture. My first version of this file rendered the body without seeding it,
 * counted ZERO leads on both fixtures, and would have read as "the strip never
 * leads" — a census on a surface that was not reachable (CLAUDE.md §4). Two
 * nodes are the minimum that makes the subject line exist at all.
 *
 * ⭐ A DECISION *AND* A GOAL, so the strip is in its two-line shape: the
 * decision leads and the goal sits beneath it. That is the shape where "the
 * subject stands down" has something to stand down FROM.
 */
const NODES = [
  { id: 'd1', type: 'decision', data: { label: 'Which data platform to adopt' } },
  { id: 'g1', type: 'goal', data: { label: 'Sustained margin' } },
  /**
   * ⚠ THE CENSUS ROWS ARE LOAD-BEARING, NOT DECORATION. `buildModelStrip`
   * returns `total: 0` on a graph of a decision and a goal alone, and the strip
   * renders NOTHING on a zero total — the second version of this file seeded
   * only those two nodes and still counted zero leads.
   */
  { id: 'f1', type: 'factor', data: { label: 'Supplier lead time' } },
  { id: 'f2', type: 'factor', data: { label: 'Demand volatility' } },
]

const previous = { nodes: [] as unknown }

beforeEach(() => {
  previous.nodes = useCanvasStore.getState().nodes
  useCanvasStore.setState({ nodes: NODES, goalThreshold: null } as never)
  useStrengthenStore.setState({ records: {}, priorityOrder: [] } as never)
})
afterEach(() => {
  cleanup()
  useCanvasStore.setState({ nodes: previous.nodes } as never)
})

describe('the panel leads with the decision being made', () => {
  /**
   * ⭐ THE PRECONDITION, PINNED IN-TEST (trap 13b). Every case below is a claim
   * about a STATE. A fixture that quietly stopped withholding — or stopped
   * naming a leader — would make the cases pass for the wrong reason, with the
   * product broken and the suite green.
   */
  it('PRECONDITION: the two fixtures differ on exactly the governing fact', () => {
    expect(panelHasConclusion(glanceOf(genuineDecision())), 'the permitted run must reach a conclusion').toBe(true)
    expect(panelHasConclusion(glanceOf(decisionWithLeaderWithheld())), 'the withheld run must reach none').toBe(false)
  })

  /**
   * ⭐ THE SELECTOR'S OWN CONTROL. A selector that matched nothing would make
   * "exactly one" impossible and "never two" vacuous. This proves it can see a
   * lead at all before the counts below are believed (trap 13).
   */
  it('PRECONDITION: the strip is reachable — a census needs a surface', () => {
    renderBody(genuineDecision())
    expect(screen.getByTestId('analysis-new-model-strip-lead')).toBeInTheDocument()
    expect(screen.getByTestId('analysis-new-model-strip-goal')).toBeInTheDocument()
  })

  it.each([
    ['a run that reached a conclusion', genuineDecision],
    ['a run whose leader was withheld', decisionWithLeaderWithheld],
  ])('⭐⭐ %s: NO panel text resolves above 14px', (_name, fixture) => {
    const { container } = renderBody(fixture())
    const oversized = OVERSIZED_SIZE_CLASSES.filter((cls) => container.querySelector(`.${cls}`))
    expect(oversized, 'nothing on the panel should render larger than panelHeader (14px)').toEqual([])
  })

  it('⭐⭐ the -lead element is the FIRST text the panel body renders', () => {
    const { container } = renderBody(genuineDecision())
    const firstText = firstNonWhitespaceTextNode(container)
    expect(firstText, 'PRECONDITION: the panel body must render some text').not.toBeNull()
    const lead = screen.getByTestId('analysis-new-model-strip-lead')
    expect(
      lead.contains(firstText!.parentElement),
      'the decision line must be the first thing the panel says',
    ).toBe(true)
  })

  it('⭐ the DECISION leads even on a run that reached a conclusion', () => {
    renderBody(genuineDecision())
    const lead = screen.getByTestId('analysis-new-model-strip-lead')
    expect(lead.className, 'the lead carries the panel ceiling, panelHeader').toContain(typography.panelHeader.split(' ')[0]!)

    /**
     * ⛔⛔ AND THERE IS NO CONCLUSION AT ALL — DELETED, NOT DEMOTED.
     *
     * This assertion is the INVERSE of what stood here hours earlier. #1676
     * demoted the conclusion from 18px to 14px and this test pinned it at
     * `panelHeader`; Paul then ruled, verbatim, "delete the conclusion entirely".
     * The earlier wording is kept in the commit, not here, because a test that
     * still describes the demotion would read as if both were true.
     *
     * ⭐ THE PANEL'S NUMBERS ARE NOT WHAT WENT. Every option, its win share and
     * its ranking still render in the comparison; so does the disclosure that
     * Olumi invented an option, which `OptionsComparison` owns independently.
     * What is gone is the panel ANNOUNCING one option as the answer.
     */
    expect(
      screen.queryByTestId('analysis-new-glance-headline'),
      'the panel names no conclusion, on ANY run state',
    ).toBeNull()
    expect(
      screen.queryByTestId('analysis-new-glance-option-origin'),
      'and the disclosure that belonged to it went with it — OptionsComparison owns that claim now',
    ).toBeNull()
  })

  it('⭐ the DECISION also leads when no conclusion was reached', () => {
    renderBody(decisionWithLeaderWithheld())
    expect(
      screen.getByTestId('analysis-new-model-strip-lead'),
      'the decision being worked on leads',
    ).toBeInTheDocument()
    expect(
      screen.queryByTestId('analysis-new-glance-headline'),
      'a withheld run names no conclusion to lead with',
    ).toBeNull()
  })

  /**
   * ⛔ THE EMPTY LABEL IS REACHABLE AND THE TWO SPELLINGS DISAGREE ON IT.
   * `??` falls through on null/undefined only, so a producer naming an option
   * with an empty label yields `''`. `Boolean('')` is false — no conclusion, so
   * the subject keeps the lead — while `!== null` would call it a conclusion and
   * hand 18px to an empty string. This pins the spelling `AtAGlance` shipped
   * with, so the hoist into `panelLead` cannot have changed behaviour.
   */
  it('an empty leader label is not a conclusion', () => {
    expect(conclusionLabel({ leaderLabel: '', headline: 'ignored' })).toBe('')
    expect(panelHasConclusion({ leaderLabel: '', headline: 'ignored' })).toBe(false)
    expect(panelHasConclusion({ leaderLabel: null, headline: 'a sentence' })).toBe(true)
    expect(panelHasConclusion({ leaderLabel: null, headline: null })).toBe(false)
  })
})

/**
 * ⭐⭐ ONE OWNER FOR THE PREDICATE — the guard that stops this becoming a mirror.
 *
 * Two components key the panel's largest type off the same fact. Re-typing
 * `leaderLabel ?? headline` at the second call site is three tokens and would
 * never be noticed in review — and a copy that drifts produces either two leads
 * or none, with no red anywhere (CLAUDE.md trap 12).
 */
describe('the lead predicate has exactly one owner', () => {
  const DIR = resolvePath(__dirname, '..')
  const OWNER = 'panelLead.ts'
  const SHAPE = /leaderLabel\s*\?\?/

  const sourcesUnder = (dir: string): string[] =>
    readdirSync(dir).flatMap((entry) => {
      const full = joinPath(dir, entry)
      if (statSync(full).isDirectory()) return entry === '__tests__' ? [] : sourcesUnder(full)
      return /\.tsx?$/.test(entry) ? [full] : []
    })

  it('⭐ the fallback expression is written in one file, and the scan can see it', () => {
    const files = sourcesUnder(DIR)
    /**
     * ⚠ THE SCAN'S OWN MAGNITUDE CHECK. A traversal that silently returned two
     * files would report a clean "one owner" while seeing almost nothing
     * (trap 13e). The directory carried 22 source files when this was written.
     */
    expect(files.length, 'the scan must have read the directory').toBeGreaterThan(15)

    const carriers = files.filter((f) => SHAPE.test(stripComments(readFileSync(f, 'utf8'), f)))
    expect(carriers.map((f) => f.slice(DIR.length + 1))).toEqual([OWNER])
  })

  it('⭐ CONTRAST: the scan reads code, not comments', () => {
    /**
     * Without this, a scan whose `stripComments` silently returned an empty
     * string would report ONE owner — the same clean answer — while reading
     * nothing at all. The owner's own body must survive the strip.
     */
    const owner = joinPath(DIR, OWNER)
    const stripped = stripComments(readFileSync(owner, 'utf8'), owner)
    expect(stripped, 'the owner keeps its code after stripping').toMatch(SHAPE)
    expect(stripped, 'and loses its prose').not.toContain('Paul')
  })
})

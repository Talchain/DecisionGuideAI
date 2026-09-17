/**
 * ⭐⭐ THE PANEL'S LARGEST TYPE IS THE MOST IMPORTANT THING ON IT.
 *
 * Paul's ruling, 17 Sep 2026: the 18px slot means *"the most important thing on
 * this panel right now — the conclusion when there is one, otherwise the
 * question being worked on."*
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
 * ⚠ 18px IS THE PANEL'S CEILING, AND THAT IS PINNED ELSEWHERE, NOT HERE.
 * `tests/ci-guards/reasoning-panel-render-discipline.spec.ts` derives the
 * declared sizes through `typography` and holds the maximum at 18 — so "the
 * largest type" and "the `reasoningLead` token" are the same claim on this
 * surface. This file does not restate that; it would be a second copy of a
 * fact with an owner.
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
 * ⭐ BOUND TO THE TOKEN, NOT TO A SIZE I TYPED. Derived from `typography` at
 * run time, so a token whose classes change still resolves to whatever it now
 * is — and a case that stops matching fails loud instead of matching nothing
 * quietly. Every class must be present, so `text-lg` used raw elsewhere cannot
 * satisfy it.
 */
const LEAD_SELECTOR = '.' + typography.reasoningLead.trim().split(/\s+/).join('.')

const leadElements = (root: HTMLElement): HTMLElement[] =>
  Array.from(root.querySelectorAll<HTMLElement>(LEAD_SELECTOR))

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

describe('the panel leads with the most important thing on it', () => {
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

  it('PRECONDITION: the lead selector resolves and finds a lead', () => {
    expect(LEAD_SELECTOR).toContain('.text-lg')
    const { container } = renderBody(genuineDecision())
    expect(leadElements(container).length, 'the selector must see at least one lead').toBeGreaterThan(0)
  })

  it.each([
    ['a run that reached a conclusion', genuineDecision],
    ['a run whose leader was withheld', decisionWithLeaderWithheld],
  ])('⭐ %s puts EXACTLY ONE element at the panel\'s largest size', (_name, fixture) => {
    const { container } = renderBody(fixture())
    const leads = leadElements(container)
    expect(
      leads.map((el) => el.getAttribute('data-testid') ?? el.textContent?.slice(0, 40)),
      'never two leads, and never none',
    ).toHaveLength(1)
  })

  it('⭐ the CONCLUSION takes the lead when there is one, and the subject stands down', () => {
    const { container } = renderBody(genuineDecision())
    const [lead] = leadElements(container)
    expect(lead.getAttribute('data-testid'), 'the conclusion leads').toBe('analysis-new-glance-headline')

    /**
     * ⛔ STANDS DOWN, NOT DISAPPEARS, AND NOT DEMOTED TO BODY. The subject is
     * still what the run is ABOUT; a reader who loses it cannot tell which
     * decision the conclusion belongs to. It drops one step, to the size the
     * panel's section titles use — second-loudest, not quiet.
     */
    const subject = screen.getByTestId('analysis-new-model-strip-lead')
    expect(subject).toBeInTheDocument()
    expect(subject.className, 'the subject keeps the second-largest size').toContain(typography.panelHeader)
  })

  it('⭐ the SUBJECT keeps the lead when no conclusion was reached', () => {
    const { container } = renderBody(decisionWithLeaderWithheld())
    const [lead] = leadElements(container)
    expect(lead.getAttribute('data-testid'), 'the question being worked on leads').toBe(
      'analysis-new-model-strip-lead',
    )
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

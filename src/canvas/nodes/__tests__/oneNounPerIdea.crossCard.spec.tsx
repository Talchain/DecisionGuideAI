/**
 * ⭐⭐ ONE NOUN PER IDEA — ASSERTED ACROSS TWO CARDS, FROM ONE REPORT.
 *
 * Paul, 31 Aug 2026, on a screenshot: "Four different number vocabularies on
 * one screen, none explained."
 *
 * ⛔ WHY THIS FILE EXISTS AND WHY THE OTHER TESTS ARE NOT ENOUGH. Every other
 * guard in this change is single-sided:
 *
 *   · `RiskNode.spec` / `OutcomeNode.spec` / `nodeMetricRow.goalDecision.spec`
 *     each pin ONE card's caption against the register. All three would stay
 *     green if the register itself grew a second word for one quantity.
 *   · `metricNounVocabulary.canvas.spec` bans the RETIRED literals. It cannot
 *     see a brand-new synonym nobody has retired yet.
 *   · `metricVocabulary.spec` pins the register's shape in isolation, with no
 *     card rendered at all.
 *
 * What none of them does is put the two surfaces that disagreed IN THE SAME
 * RENDER and compare what a user would actually read. That is the assertion
 * that makes "one noun per idea" mechanical rather than aspirational: it
 * compares two DOMs, not two constants, so it stays true through any amount of
 * refactoring underneath — and it is exactly the comparison a reader makes
 * with their eyes when both cards are on screen together.
 *
 * ⭐ THE DEFECT IT PINS WAS DOCUMENTED AT ITS OWN CALL SITE AND SHIPPED ANYWAY.
 * `DecisionNode`'s comment read: "this is the same field, for the same option,
 * that the winning OptionNode renders as `Ahead 47%` — so the two bars are the
 * same quantity on the same scale and a reader is entitled to compare them by
 * eye." One card then captioned it `Leads` and the other `Ahead`. The comment
 * was right about the entitlement and the code withheld the means. A prose
 * concession in a comment is not a guard; this is.
 *
 * ⚠ ONE REPORT, BOTH CARDS — deliberately `PERMITTED_REPORT`, the fixture whose
 * verdict OWNS the leader claim. On a withheld run the decision row does not
 * render at all, so a cross-card comparison would pass by comparing nothing.
 * The precondition is pinned in-test below (CLAUDE.md trap 13b).
 *
 * CLAUDE.md trap 3: this asserts TEXT IN THE TREE. jsdom cannot prove the two
 * captions are visible side by side and nothing here claims it does; what it
 * proves is that they are the same word.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { DecisionNode } from '../DecisionNode'
import { OptionNode } from '../OptionNode'
import { METRIC_NOUN, RETIRED_METRIC_NOUNS } from '../shared/metricVocabulary'
import { COMPARATIVE_COPY } from '../../../components/results/utils/goalAnchorCopy'
import {
  LEADER_ID,
  LEADER_LABEL,
  RUNNER_UP_ID,
  RUNNER_UP_LABEL,
  WIN_LEADER,
  PERMITTED_REPORT,
} from '../../../lib/__fixtures__/ownedLeaderClaim.fixtures'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

vi.mock('../../store', () => ({ useCanvasStore: vi.fn() }))
vi.mock('../../layoutStore', () => ({
  useLayoutStore: vi.fn(((selector: (s: { layoutNodeWidth: number | null }) => unknown) =>
    selector({ layoutNodeWidth: null })) as unknown as (...args: never[]) => unknown),
}))
vi.mock('../../hooks/useNodeDisplayMetadata', () => ({ useNodeDisplayMetadata: vi.fn() }))
vi.mock('../../ui/inspector-v2/useAnalysisResults', () => ({
  useHasAnyRealProbability: vi.fn(() => true),
}))
vi.mock('../shared/NodePopover', () => ({
  NodePopover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

import { useCanvasStore } from '../../store'
import { useNodeDisplayMetadata } from '../../hooks/useNodeDisplayMetadata'

const NODES = [
  { id: 'decision-1', type: 'decision', data: { type: 'decision' } },
  { id: LEADER_ID, type: 'option', data: { type: 'option', label: LEADER_LABEL } },
  { id: RUNNER_UP_ID, type: 'option', data: { type: 'option', label: RUNNER_UP_LABEL } },
]

const storeState = {
  nodes: NODES,
  edges: [],
  hoveredOptionId: null,
  ceeAnalysisReady: null,
  results: { status: 'complete', report: PERMITTED_REPORT },
  highlightedNodes: new Set(),
  dimmedNodeIds: new Set(),
  lens: { _dimmedNodeIds: new Set(), _hiddenNodeIds: new Set(), active: 'full' },
  goalThreshold: null,
  goalConstraints: [],
  setHoveredOption: vi.fn(),
  viewMode: 'expert',
}

const METADATA = {
  sensitivityRank: null,
  influence: null,
  confidence: null,
  inSensitivityAnalysis: false,
  achievementProbability: null,
  stabilityPercentage: null,
  winRate: WIN_LEADER,
  isResultsMode: true,
  predictedOutcome: null,
  valueOfInformation: null,
  voiRank: null,
}

const baseProps = {
  position: { x: 0, y: 0 },
  selected: false,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  dragging: false,
  zIndex: 0,
}

/** Both cards, one report, one render — as a user meets them on the board. */
function renderBoard() {
  vi.mocked(useNodeDisplayMetadata).mockReturnValue({ ...METADATA } as any)
  vi.mocked(useCanvasStore).mockImplementation((selector: any) => selector(storeState as any))
  return render(
    <ReactFlowProvider>
      <DecisionNode
        {...(baseProps as any)}
        id="decision-1"
        type="decision"
        data={{ label: 'Which laptops?', type: 'decision' }}
      />
      <OptionNode
        {...(baseProps as any)}
        id={LEADER_ID}
        type="option"
        data={{ label: LEADER_LABEL, type: 'option' }}
      />
    </ReactFlowProvider>,
  )
}

const DECISION_ROW = 'decision-leader-metric-row'
const OPTION_ANCHOR = `option-win-anchor-${LEADER_ID}`

/** The caption is the row's FIRST child — the noun column. */
function decisionCaption(): string {
  const row = screen.getByTestId(DECISION_ROW)
  return (row.firstElementChild?.textContent ?? '').trim()
}

describe('one noun per idea — the decision card and the option card agree', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('POSITIVE CONTROL: both surfaces mounted and both carry the figure', () => {
    // Without this every comparison below could pass by comparing two absent
    // things, or by comparing a caption to itself (trap 13).
    renderBoard()
    expect(screen.getByTestId(DECISION_ROW)).toBeDefined()
    expect(screen.getByTestId(OPTION_ANCHOR)).toBeDefined()
    // …and the row is the one carrying the leader's win probability, so the
    // caption under test is captioning the quantity we think it is.
    expect(screen.getByTestId(DECISION_ROW).textContent)
      .toContain(`${Math.round(WIN_LEADER * 100)}%`)
  })

  it('⭐ THE ASSERTION: the decision caption IS the option anchor, word for word', () => {
    renderBoard()
    const decision = decisionCaption()
    const option = (screen.getByTestId(OPTION_ANCHOR).textContent ?? '').trim()

    expect(decision, 'the decision card captions the shared quantity with its own word').toBe(option)
    // Bound to the authority as well as to each other — so the pair cannot be
    // "fixed" by making BOTH cards say some third word.
    expect(decision).toBe(COMPARATIVE_COPY.anchor)
    expect(decision).toBe(METRIC_NOUN.ahead)
  })

  it('neither card uses a retired synonym for the shared quantity', () => {
    const { container } = renderBoard()
    const text = container.textContent ?? ''
    // `Leads` is the one that was on the decision card. Asserted on the FULL
    // board text, so it catches the word anywhere on either card, not only in
    // the caption slot the test above reads.
    expect(text).not.toContain('Leads')
    // Discrimination: the board HAS text and DOES carry the live noun, so the
    // absence above is not passing on an empty container.
    expect(text.length).toBeGreaterThan(50)
    expect(text).toContain(METRIC_NOUN.ahead)
  })

  it('CONTRAST: the sentence the row encodes is UNCHANGED — this was a caption change', () => {
    // The eight-surface owned-leader-claim corpus keys on this SENTENCE, not on
    // the caption. A "vocabulary consistency" change that quietly moved or
    // reworded it would hollow every one of those guards without a red here.
    // This is the assertion that keeps the blast radius honest.
    renderBoard()
    expect(screen.getByText(/leads in 66% of scenarios/i)).toBeDefined()
    // ⚠ Note the tension, deliberately left visible: the PROSE still says
    // "leads" while the CAPTION now says "Ahead". That is not a synonym defect
    // — a verb in a sentence and a noun in a column are different parts of
    // speech, and the corpus that guards the sentence is out of this lane's
    // scope. Rowed in the PR body rather than silently changed.
    expect(RETIRED_METRIC_NOUNS).toContain('Leads')
  })

  it('⚠ RESIDUAL, DECIDED NOT DISCOVERED: "Leads" survives as a VERB on the option card', () => {
    // The review found `OptionNode:1601` — "Leads via {factor}" beneath the
    // `Ahead 47%` anchor — and rightly said it should be decided explicitly
    // rather than left to be found. It is: the register retires "Leads" as a
    // CAPTION, and both survivors are verbs inside sentences.
    //
    // This test exists so the decision is VISIBLE and REVERSIBLE. If a later
    // session rules that a caption and a verb must agree, it REDs here and
    // reads the reasoning in metricVocabulary.ts rather than rediscovering the
    // whole question. Bound to the source, since the sentence needs a
    // post-analysis recommended option this harness does not mount.
    const src = readFileSync(resolve(__dirname, '../OptionNode.tsx'), 'utf8')
    expect(src.length, 'source read as empty — the assertion below is vacuous').toBeGreaterThan(1000)
    expect(
      src.includes('Leads via'),
      'the "Leads via" sentence has gone — good, but update the residual note in metricVocabulary.ts',
    ).toBe(true)
    // …and it is prose, not a caption: no `label=` binds it.
    expect(src).not.toMatch(/label=["']Leads["']/)
  })
})

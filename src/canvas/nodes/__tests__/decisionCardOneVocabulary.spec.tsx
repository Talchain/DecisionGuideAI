/**
 * ⭐⭐ THE DECISION CARD SPEAKS ONE VOCABULARY — THE SENTENCE AND THE BAR
 * BENEATH IT DESCRIBE THE SAME QUANTITY WITH THE SAME WORD.
 *
 * ⛔ THIS FILE IS THE DELIBERATE REVERSAL POINT LEFT BY ITS OWN PREDECESSOR.
 * `oneNounPerIdea.crossCard.spec.tsx` renamed the CAPTION `Leads` → `Support`
 * on 7 Sep 2026 and pinned the SENTENCE as unchanged, in a test whose own
 * comment says:
 *
 *   "⚠ Note the tension, deliberately left visible: the PROSE still says
 *    'leads' while the CAPTION now says 'Ahead'. … If a later session rules
 *    that a caption and a verb must agree, it REDs here and reads the
 *    reasoning in metricVocabulary.ts rather than rediscovering the whole
 *    question."
 *
 * This is that session. The tension was real and it shipped: measured on
 * deployed staging `80ccf768`, one entitled decision card rendered
 *
 *     Segment leads in 99% of scenarios          ← DecisionNode.tsx:876
 *     Support  ▬▬▬▬▬▬▬▬  99%                     ← DecisionNode.tsx:940
 *
 * — ONE number, read from ONE binding (`headline.winProb`), captioned twice in
 * two vocabularies, eight pixels apart. Paul's ruling of 7 Sep is that there is
 * never a winner and never a race; the rename honoured it in the column and
 * left it standing in the sentence directly above.
 *
 * ⭐ WHY A RENDER PROBE AND NOT A SOURCE SWEEP. `noContestFraming.canvas.spec`
 * already sweeps `src/canvas` for contest framing and is GREEN at `80ccf768`
 * with this sentence live — because its `renderedRuns()` rejects any run
 * containing `(` `{` `=` as code, and line 876 opens a ternary. That guard's own
 * header states the limit ("it is line-based… a contest phrase split across two
 * source lines is invisible"); this file closes it for the one sentence that
 * matters most by reading the DOM a user gets instead of the source.
 *
 * ⚠ WHAT THIS DOES NOT TOUCH. The card's ENTITLEMENT to make a comparative
 * claim at all (`permitted_analysis_mode`, `DecisionNode.tsx:309-317`) is a
 * separate and already-settled question. ARM WITHHELD below pins that gate
 * unchanged, so a rewording lane cannot quietly buy its copy with a permission.
 *
 * CLAUDE.md trap 3: this asserts TEXT IN THE TREE. jsdom cannot prove the two
 * lines are visible together and nothing here claims it does.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { DecisionNode } from '../DecisionNode'
import { METRIC_NOUN } from '../shared/metricVocabulary'
import { COMPARATIVE_COPY } from '../../../components/results/utils/goalAnchorCopy'
import {
  LEADER_ID,
  LEADER_LABEL,
  RUNNER_UP_ID,
  RUNNER_UP_LABEL,
  WIN_LEADER,
  PERMITTED_REPORT,
  WITHHELD_REPORT,
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
vi.mock('../../ui/inspector-v2/useAnalysisResults', async (importOriginal) => ({
  // Spread the real module — a bare factory REPLACES it (CLAUDE.md trap 12).
  ...(await importOriginal<typeof import('../../ui/inspector-v2/useAnalysisResults')>()),
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

function renderDecision(report: unknown) {
  vi.mocked(useNodeDisplayMetadata).mockReturnValue({ ...METADATA } as any)
  vi.mocked(useCanvasStore).mockImplementation((selector: any) =>
    selector({
      nodes: NODES,
      edges: [],
      hoveredOptionId: null,
      ceeAnalysisReady: null,
      results: { status: 'complete', report },
      highlightedNodes: new Set(),
      dimmedNodeIds: new Set(),
      lens: { _dimmedNodeIds: new Set(), _hiddenNodeIds: new Set(), active: 'full' },
      goalThreshold: null,
      goalConstraints: [],
      setHoveredOption: vi.fn(),
      viewMode: 'expert',
    } as any),
  )
  return render(
    <ReactFlowProvider>
      <DecisionNode
        {...(baseProps as any)}
        id="decision-1"
        type="decision"
        data={{ label: 'Which laptops?', type: 'decision' }}
      />
    </ReactFlowProvider>,
  )
}

const PCT = `${Math.round(WIN_LEADER * 100)}%`
const METRIC_ROW = 'decision-leader-metric-row'

/**
 * What a screen reader is offered: the card's text with every `aria-hidden`
 * subtree removed. `NodeMetricRow` hides EVERY span in the row on purpose
 * (`DecisionNode.tsx:930-937`) because the sentence above already states the
 * claim — so this function is how "exactly once, not twice, not zero times"
 * becomes measurable rather than asserted.
 */
function accessibleText(container: HTMLElement): string {
  const clone = container.cloneNode(true) as HTMLElement
  clone.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove())
  return (clone.textContent ?? '').replace(/\s+/g, ' ').trim()
}

/** Case-insensitive count of a stem in a string. */
function countStem(haystack: string, stem: string): number {
  return haystack.toLowerCase().split(stem.toLowerCase()).length - 1
}

describe('the entitled decision card states one quantity in one vocabulary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('PRECONDITION: the card is entitled to speak, and both surfaces carry the same figure', () => {
    // Pinned in-test (CLAUDE.md trap 13b). Without this, every assertion below
    // could pass on a card that rendered nothing at all — a withheld verdict
    // and a corrected sentence look identical to a `not.toMatch` probe.
    const { container } = renderDecision(PERMITTED_REPORT)
    expect(screen.getByTestId(METRIC_ROW)).toBeDefined()
    expect(screen.getByTestId(METRIC_ROW).textContent).toContain(PCT)
    const text = (container.textContent ?? '').replace(/\s+/g, ' ')
    expect(text).toContain(LEADER_LABEL)
    // The sentence and the row are reading ONE binding, so the figure appears
    // twice — that is the premise of this whole file, asserted rather than
    // assumed.
    expect(countStem(text, PCT)).toBe(2)
  })

  it('⭐ THE SENTENCE IS THE REGISTER\'S OWN CLAUSE, NOT A LOCAL RE-SPELLING', () => {
    // By REFERENCE to `COMPARATIVE_COPY.clause` — the mid-sentence form the
    // register owns precisely so call sites stop doing their own casing and
    // wording surgery (`goalAnchorCopy.ts:281-297`). A literal here would be
    // the same defect one level down.
    const { container } = renderDecision(PERMITTED_REPORT)
    const text = (container.textContent ?? '').replace(/\s+/g, ' ')
    expect(
      text,
      'the decision card writes its comparative claim in its own words instead of the register\'s',
    ).toContain(COMPARATIVE_COPY.clause(PCT))
  })

  it('⭐ THE SENTENCE AND THE BAR CAPTION SHARE THEIR STEM — one quantity, one word', () => {
    // Bound to the AUTHORITY on both sides, so this cannot be "fixed" by making
    // the pair agree on some third word (the sibling cross-card guard's rule).
    const { container } = renderDecision(PERMITTED_REPORT)
    const stem = METRIC_NOUN.support.toLowerCase()
    // ⭐ RE-DERIVED 8 Sep 2026, NOT LOOSENED — which is what this tripwire
    // asked for, and it fired exactly as intended. It read `'support'` until
    // Paul's ruled sentence ("{X} scored highest against your goal in {N}% of
    // runs") landed with no "support" in it. Keeping the caption at `Support`
    // would have left the bar and the sentence sharing no word — the very
    // defect this file pins — so the CAPTION moved to the ruled sentence's own
    // stem and this literal moved with it.
    expect(stem, 'the register moved — re-derive this test, do not loosen it').toBe('highest')
    const row = screen.getByTestId(METRIC_ROW)
    const sentenceOnly = ((container.textContent ?? '').replace(row.textContent ?? '', ''))
      .replace(/\s+/g, ' ')
    expect(
      countStem(sentenceOnly, stem),
      'the sentence above the bar does not use the noun the bar is captioned with',
    ).toBeGreaterThan(0)
  })

  it('⭐ NO CONTEST FRAME SURVIVES ON THE CARD A USER READS', () => {
    // Paul, 7 Sep 2026, of a ruling given "numerous times": "There's never a
    // winner… Terminology like 'winner' is wrong." The three legitimate
    // questions are most-likely outcome, confidence, and which option achieves
    // the goal — none of them is a placing.
    const { container } = renderDecision(PERMITTED_REPORT)
    const text = (container.textContent ?? '').replace(/\s+/g, ' ')
    for (const [name, re] of [
      ['leads', /\bleads\b(?!\s+to\b)/i],
      ['leader', /\bleaders?\b/i],
      ['ahead', /(?<!go[- ])\bahead\b/i],
      ['winner', /\bwinners?\b/i],
      ['beats', /\bbeats?\b/i],
      ['wins', /\bwins\b/i],
    ] as ReadonlyArray<readonly [string, RegExp]>) {
      expect(re.test(text), `the decision card frames the analysis as a contest: "${name}"`).toBe(
        false,
      )
    }
    // DISCRIMINATION: the absence above is not passing on an empty card.
    expect(text.length).toBeGreaterThan(40)
    expect(text).toContain(PCT)
  })

  it('⭐ A11Y: the comparative claim reaches assistive tech EXACTLY ONCE', () => {
    // Not zero times (the row is entirely `aria-hidden`, so if the sentence
    // stopped carrying the claim a screen reader would get the figure with no
    // referent) and not twice (which is why the row carries no `phrase`).
    const { container } = renderDecision(PERMITTED_REPORT)
    const spoken = accessibleText(container)
    expect(
      countStem(spoken, METRIC_NOUN.support),
      'the claim is stated to assistive tech either zero times or twice',
    ).toBe(1)
    expect(countStem(spoken, PCT), 'the figure is spoken more than once').toBe(1)
  })

  it('ARM WITHHELD — Q2 is untouched: a refused VERDICT still says nothing', () => {
    // The copy change must not buy itself a permission.
    //
    // ⚠ SCOPE, STATED BECAUSE A MUTANT MEASURED IT (8 Sep 2026). This arm pins
    // Q2 ONLY — `verdict.hasLeadingOption` (`DecisionNode.tsx:346`). Widening
    // Q2 to `false && …` REDs here; widening Q1, the producer's licence
    // (`modelLicensesComparativeClaim`, `:339`), leaves this arm GREEN,
    // because `WITHHELD_REPORT` is refused by the verdict and never reaches
    // Q1's arm. That survivor is not equivalent and is not hand-waved: Q1 is
    // owned by `canvasLeaderAdmission.spec.tsx` ("DecisionNode headline — Q1
    // is consulted, not only Q2"), whose ARM C / ARM C2 / metric-row
    // assertions were re-pointed at this new wording and DO red on the same
    // mutation. Two gates, two files, both measured.
    const { container } = renderDecision(WITHHELD_REPORT)
    expect(screen.queryByTestId(METRIC_ROW)).toBeNull()
    const text = (container.textContent ?? '').replace(/\s+/g, ' ')
    expect(text).not.toContain(PCT)
    expect(text.toLowerCase()).not.toContain(COMPARATIVE_COPY.clause(PCT).toLowerCase())
  })
})

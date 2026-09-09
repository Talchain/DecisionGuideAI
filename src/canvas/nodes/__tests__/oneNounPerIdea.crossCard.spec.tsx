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
 * ⚠ 8 Sep 2026 — THE SECOND HALF LANDED. This file originally pinned the
 * CAPTION and deliberately left the SENTENCE above it saying "leads", with the
 * reversal point written into the last test. That test has now been taken: the
 * decision card's sentence reads the register's own comparative clause, so the
 * bar's noun and the prose above it are one vocabulary. See
 * `decisionCardOneVocabulary.spec.tsx`.
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
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { DecisionNode } from '../DecisionNode'
import { OptionNode } from '../OptionNode'
import { METRIC_NOUN, RETIRED_METRIC_NOUNS } from '../shared/metricVocabulary'
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
vi.mock('../../ui/inspector-v2/useAnalysisResults', async (importOriginal) => ({
  // Spread the real module. A bare factory REPLACES it, so every export this
  // spec does not name silently disappears -- which is how adding
  // selectHasAnyRealProbability took this whole file red at once.
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

/**
 * The decision card, as a subtree — the nearest ancestor of its metric row that
 * also carries the decision's own label. Both cards are in one render here, and
 * as of 8 Sep 2026 both speak the same comparative phrase, so an unscoped text
 * query matches twice. Scoping by IDENTITY rather than by picking `[0]`
 * (CLAUDE.md trap 19).
 */
// ⛔ `decisionCard()` and `decisionCaption()` are DELETED. Both existed to reach
// into `decision-leader-metric-row` and read the caption beside it. That row is
// gone, so a helper that walks to it is dead code asserting a surface exists.
// The absence arm below binds by test id directly and needs neither.

describe('one noun per idea — the option card speaks the register', () => {
  it('⛔ the decision card carries neither the shared caption nor the shared sentence', () => {
    // Pins the removal from THIS file's angle: the cross-card agreement it was
    // written to protect is now satisfied by there being one speaker, and the
    // way that could silently change is the decision card starting to speak
    // again. `decisionCard()`/`decisionCaption()` are retained above for this
    // arm binds by test id directly, which is why the two decision-card
    // helpers above could be deleted rather than kept alive artificially.
    renderBoard()
    expect(screen.queryByTestId(DECISION_ROW), 'the duplicate bar is back').toBeNull()
    expect(screen.queryByText(/supported in \d+% of simulated scenarios/i), 'the duplicated verdict sentence is back').toBeNull()
  })

  /**
   * ⛔ THREE ARMS RETIRED AND THE DESCRIBE RENAMED: this file compared the
   * DECISION card's sentence with the OPTION card's caption, and the decision
   * side is gone.
   *
   * The retired arms were "both surfaces carry the figure", "the decision
   * caption IS the option anchor, word for word", and "the SENTENCE speaks the
   * caption's noun too". Each was a genuine cross-card property and each needed
   * two cards making the same claim. **The decision card no longer makes it** —
   * its sentence restated the option cards' verdict under a heading that asks a
   * question — so the comparison has one side.
   *
   * ⚠ THIS IS NOT THE DEFECT THE FILE WAS WRITTEN AGAINST BEING REOPENED. That
   * defect was the two cards using DIFFERENT words for one quantity ("Leads" vs
   * "Ahead" vs "Support"). Removing one of the two cannot recreate a
   * disagreement between them; a single speaker cannot contradict itself across
   * cards. What still can drift is the option card drifting from the REGISTER,
   * and that is what survives below.
   */
  it('the option card uses no retired synonym for the shared quantity', () => {
    renderBoard()
    const optionRow = screen.getByTestId(`option-analysis-currency-${LEADER_ID}`)
    const spoken = `${optionRow.getAttribute('aria-label') ?? ''} ${optionRow.textContent ?? ''}`
    for (const retired of RETIRED_METRIC_NOUNS) {
      expect(spoken, `the option card spoke the retired noun "${retired}"`)
        .not.toMatch(new RegExp(`\\b${retired}\\b`, 'i'))
    }
    // …and it DOES speak the register's own word, so the arm cannot pass on a
    // card that says nothing at all.
    expect(spoken.toLowerCase()).toContain(METRIC_NOUN.support.toLowerCase())
    // "Leads" stays retired as a caption, which is what the register ruled.
    expect(RETIRED_METRIC_NOUNS).toContain('Leads')
  })

  it('⭐ REHOMED A11Y: the comparative claim reaches assistive tech EXACTLY ONCE', () => {
    // ⚠ THIS PROPERTY CAME FROM `decisionCardOneVocabulary.spec.tsx`, WHICH IS
    // RETIRED. That file's whole subject was the decision card's sentence and
    // bar speaking one vocabulary; both are gone. This one arm was never about
    // the vocabulary — it guarded against a screen-reader user hearing the same
    // comparative claim twice, which was a live risk while the decision card
    // and the option card both announced it.
    //
    // It is kept rather than deleted because the risk has not gone, it has
    // moved: the option card carries the claim in an `aria-label` on a
    // `role="img"`, and any future visible restatement beside it would double
    // the announcement without changing a single rendered word.
    renderBoard()
    const optionRow = screen.getByTestId(`option-analysis-currency-${LEADER_ID}`)
    // `getByRole` THROWS on more than one match, so this is the "exactly once"
    // assertion — and binding the result to the row by identity is what makes
    // it about THIS surface rather than whichever element matched first.
    expect(screen.getByRole('img', { name: /supported in \d+% of simulated scenarios/i })).toBe(optionRow)
  })

  it('global factor importance offers examination without asserting option-specific support', () => {
    // The factor link is navigation. Global importance does not establish
    // why this particular option wins; the delivery-state test also mounts
    // the link and checks that it targets the right factor.
    const src = readFileSync(resolve(__dirname, '../OptionNode.tsx'), 'utf8')
    expect(src.length, 'source read as empty — the assertion below is vacuous').toBeGreaterThan(1000)
    expect(src).toContain('Factor to examine:')
    expect(src).not.toContain('Supported by')
    expect(src).not.toMatch(/label=["']Leads["']/)
  })
})

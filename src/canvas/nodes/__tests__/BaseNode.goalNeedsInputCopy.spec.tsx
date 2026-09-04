/**
 * THE GOAL "NEEDS INPUT" PILL STATES A CONSEQUENCE, NEVER A GATE.
 *
 * `BaseNode`'s goal branch read "Set a success threshold to enable analysis".
 * Nothing gates analysis on a threshold. `isIncomplete`'s goal arm asks
 * "before results exist, does this goal node carry a success target?"
 * (completeness, one node); `canRunAnalysis` → `readinessObjectsToRun` asks
 * "has an authority stated this model cannot be analysed now?" (admissibility,
 * whole model, producer-decided — it never reads node data). Correctly
 * different questions, and `readinessObjectsToRun`'s header explicitly bans the
 * parallel UI-side rule a threshold check would create. The gate is right; the
 * SENTENCE was false.
 *
 * With no target the run SUCCEEDS — the producer synthesises
 * `auto_goal_threshold` and goal-fit claims are honestly suppressed. Then
 * `results.status === 'complete'` clears `isPreRunMode` and the pill vanishes
 * with nothing set, so the product silently retracted its own claim rather than
 * ever being contradicted on screen. There was no refusal to make it visible.
 *
 * ⚠ WHY THE aria-label ASSERTION IS THE LOAD-BEARING ONE. `StatusPill` reuses
 * `title` as `aria-label` (StatusPill.tsx:29,32). A sighted user also reads the
 * co-rendered goal chip; a screen-reader user received the pill's sentence and it
 * was the ONLY thing carrying this claim. Pinning the visible title alone would
 * leave the worse path unpinned.
 *
 * ⚠ THIS SENTENCE ONCE NAMED THAT CHIP AS READING "Target not captured — add one".
 * That string does not exist at this head, and THIS PR is why: `825fbee0` changed
 * this line from "No target set" (correct at the merge base) to copy the same
 * commit introduced, and `7bc7a9f4` then withdrew that copy. `40f7918b` fixed the
 * identical staleness in `BaseNode.tsx` and described the mechanism — but one
 * commit produced TWO instances and only one was corrected. The chip now reads
 * `GOAL_NO_TARGET_STATE` (`GoalNode.tsx:160`) = 'Target not captured'.
 *
 * ── PROOF SHAPE (RED-first is INVERTED — the string was unpinned, so a pin
 * passes immediately and proves nothing on its own) ────────────────────────
 * Evidence is a DISCRIMINATING MUTANT PAIR, reported in the PR:
 *   RED  — restore the old gate sentence on the GOAL branch → these tests fail.
 *   GREEN— put the goal sentence on the FACTOR branch instead → these still pass.
 * A single biting mutant proves sensitivity to something; only the pair proves
 * the assertion binds to the GOAL branch. This file therefore asserts NOTHING
 * about the factor branch, deliberately.
 *
 * The expectation binds to `FOOTER_COPY.readySubSuccessUnset` — the ratified
 * string the pre-analysis footer already ships for this exact state, which
 * BaseNode now imports rather than re-types. The literal negative guard below
 * is what stops that indirection from laundering a future gate claim through
 * the constant.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

const makeStoreState = (overrides: Record<string, unknown> = {}) => ({
  results: { status: 'idle', report: null },
  highlightedNodes: new Set(),
  dimmedNodeIds: new Set(),
  lens: { _dimmedNodeIds: new Set() },
  goalThreshold: null,
  goalConstraints: [],
  nodes: [],
  edges: [],
  ceeAnalysisReady: null,
  viewMode: 'expert',
  ...overrides,
})

vi.mock('../../ui/inspector-v2/useAnalysisResults', () => ({
  useHasAnyRealProbability: vi.fn(() => false),
}))

vi.mock('../../store', () => ({ useCanvasStore: vi.fn() }))

vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null,
    influence: null,
    confidence: null,
    inSensitivityAnalysis: false,
    achievementProbability: null,
    stabilityPercentage: null,
    winRate: null,
    isResultsMode: false,
    predictedOutcome: null,
    valueOfInformation: null,
    voiRank: null,
  })),
}))

import { useCanvasStore } from '../../store'
import { GoalNode } from '../GoalNode'
import { FOOTER_COPY } from '../../components/pre-analysis-v3/constants'

/* ReactFlow's NodeProps requires a dozen fields no assertion here depends on;
   the sibling GoalNode specs cast the same way. */
const baseProps = {
  id: 'goal-1',
  type: 'goal',
  position: { x: 0, y: 0 },
  selected: false,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  dragging: false,
  zIndex: 0,
}

function renderGoal(storeOverrides: Record<string, unknown> = {}) {
  vi.mocked(useCanvasStore).mockImplementation((selector: any) =>
    selector(makeStoreState(storeOverrides) as never),
  )
  return render(
    <ReactFlowProvider>
      <GoalNode {...(baseProps as any)} data={{ label: 'Increase revenue', type: 'goal' }} />
    </ReactFlowProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('goal "Needs input" pill — the sentence states a consequence, not a gate', () => {
  it('PRECONDITION PIN — the pill renders because the goal is UNDEFINED, and not otherwise', () => {
    // Without this, every assertion below could pass on a fixture that renders
    // the pill unconditionally, and the file would be a guard agreeing with
    // itself. Same component, same props; only the target differs.
    renderGoal()
    expect(screen.getByTestId('needs-input-pill')).toBeTruthy()

    cleanup()
    renderGoal({ goalThreshold: { value: 12, unit: '%' } })
    expect(screen.queryByTestId('needs-input-pill')).toBeNull()
  })

  it('⭐ the aria-label — the screen-reader user\'s ONLY signal — carries the ratified consequence', () => {
    renderGoal()
    const pill = screen.getByTestId('needs-input-pill')
    expect(pill.getAttribute('aria-label')).toBe(FOOTER_COPY.readySubSuccessUnset)
  })

  it('the visible tooltip carries the same ratified consequence', () => {
    renderGoal()
    const pill = screen.getByTestId('needs-input-pill')
    expect(pill.getAttribute('title')).toBe(FOOTER_COPY.readySubSuccessUnset)
  })

  it('⛔ neither the title nor the aria-label asserts that analysis is gated on the target', () => {
    // Literal, not derived from the constant: this is what stops a future edit
    // to `readySubSuccessUnset` from re-introducing a gate claim behind an
    // indirection that every equality assertion above would happily follow.
    renderGoal()
    const pill = screen.getByTestId('needs-input-pill')
    for (const attr of ['title', 'aria-label']) {
      const text = pill.getAttribute(attr) ?? ''
      expect(text).not.toMatch(/enable analysis/i)
      expect(text).not.toMatch(/to enable/i)
      expect(text).not.toMatch(/set a success threshold/i)
    }
  })
})

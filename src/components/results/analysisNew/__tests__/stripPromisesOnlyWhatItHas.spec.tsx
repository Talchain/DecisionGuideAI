/**
 * Analysis (New) — THE MODEL STRIP NEVER PROMISES ANALYSIS CONTENT BEFORE A RUN.
 *
 * ⚠⚠ THE DEFECT THIS PINS, MEASURED ON DEPLOYED `3595403b` (guest, a saved
 * model, no run). One line beneath the panel's own banner —
 *
 *     "No analysis has run yet for this model."
 *
 * — the strip offered:
 *
 *     "Pick a mark to see what this analysis says about it, and to show it on
 *      the canvas."
 *
 * and picking a mark returned:
 *
 *     "Status Quo: Hold Current Strategy · Option · Show on canvas ·
 *      Nothing else on this panel refers to this node."
 *
 * ⭐ IT WAS NOT AN UNLUCKY NODE. There was no analysis, so the affordance could
 * not have behaved differently on ANY of the 17 marks — a dead promise the
 * reader can take seventeen times. Both sentences were literally true, which is
 * why neither had ever been questioned: the offer names a real capability and
 * the absence names a real absence. Together, in this state, they tell a reader
 * their MODEL has a gap when what is missing is the RUN.
 *
 * ⚠ THE MARKS ARE NOT DEAD PRE-RUN, so the fix is not to hide the control. They
 * route to the node on canvas, which is worth offering; the offer is simply
 * narrowed to what it can deliver. `noInsight` gains the cause for the same
 * reason: "nothing refers to this node" is a fact about the model, "no analysis
 * has run" is a fact about the run, and only one of them is true here.
 *
 * ── WHAT IS UNDER TEST ─────────────────────────────────────────────────────
 * Not the wording — the STATE-DEPENDENCE. Every sentence is derived from
 * `ANALYSIS_NEW_COPY` rather than retyped, so a copy edit moves the test with
 * it; a hand-copied sentence list is the mirror that goes stale and reads green
 * (CLAUDE.md trap 12). Both directions are asserted, because a suppression test
 * that only checks the pre-run side would pass on a strip that had lost the
 * post-run promise entirely.
 */

import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { useCanvasStore } from '../../../../canvas/store'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import { openStrategicChallenge } from './analysisNewFixtures'

const NODES = [
  { id: 'g1', type: 'goal', data: { label: 'Board wants NRR back above 110%' } },
  { id: 'o1', type: 'option', data: { label: 'Hold current strategy' } },
  { id: 'f1', type: 'factor', data: { label: 'Mid-market churn pressure' } },
]

const previous = { nodes: [] as unknown }

beforeEach(() => {
  previous.nodes = useCanvasStore.getState().nodes
  useCanvasStore.setState({ nodes: NODES, goalThreshold: null } as never)
  useStrengthenStore.setState({ records: {} })
})
afterEach(() => {
  cleanup()
  useCanvasStore.setState({ nodes: previous.nodes } as never)
})

const renderPanel = (isPreRun: boolean) =>
  render(
    <AnalysisNewTabBody
      resultsSectionData={openStrategicChallenge()}
      isPreRun={isPreRun}
      isRunning={false}
      isStale={false}
      responseHash="run_abc123"
    />,
  )

/**
 * ⚠⚠ THE STRIP DEFAULTS CLOSED AFTER A RUN AND OPEN BEFORE ONE
 * (`ModelStrip`: `const open = override ?? isPreRun`), and its marks and hint
 * are UNMOUNTED while closed. Without this, every post-run assertion here runs
 * against an empty tree — which is how a `toBe(null)` matcher would have
 * "passed" both directions and certified nothing. Opening is asserted, not
 * assumed.
 */
const openStrip = () => {
  const toggle = screen.getByTestId('analysis-new-model-strip-toggle')
  if (toggle.getAttribute('aria-expanded') !== 'true') fireEvent.click(toggle)
  expect(screen.getByTestId('analysis-new-model-strip-toggle')).toHaveAttribute(
    'aria-expanded',
    'true',
  )
}

const hintText = () => screen.queryByTestId('analysis-new-model-strip-hint')?.textContent ?? null

/** Pick the first mark and return the detail's absence line, or null. */
const pickFirstMarkAndReadAbsence = (): string | null => {
  const marks = screen.queryAllByTestId('analysis-new-model-strip-mark')
  expect(marks.length).toBeGreaterThan(0) // ⚠ a zero-mark strip proves nothing
  fireEvent.click(marks[0])
  return screen.queryByTestId('analysis-new-model-strip-detail-empty')?.textContent ?? null
}

describe('THE INSTRUMENT — the two states are genuinely different sentences', () => {
  /**
   * ⭐ THE CONTRAST CONTROL. If the pre-run and post-run copy keys ever collapse
   * to one string, every assertion below would still pass while the defect was
   * fully restored. This is the only test here that can see that.
   */
  it('the pre-run copy is not the post-run copy', () => {
    expect(COPY.modelStrip.hintPreRun).not.toBe(COPY.modelStrip.hint)
    expect(COPY.modelStrip.noInsightPreRun).not.toBe(COPY.modelStrip.noInsight)
  })

  /**
   * ⚠ THE PROPERTY THE DEFECT VIOLATED, STATED DIRECTLY RATHER THAN AS A
   * SENTENCE MATCH: the pre-run offer must not claim the analysis says
   * anything. Keyed on the noun, so a reworded promise still REDs.
   */
  it('the pre-run sentences make no claim about an analysis saying something', () => {
    expect(COPY.modelStrip.hintPreRun.toLowerCase()).not.toContain('this analysis says')
    expect(COPY.modelStrip.noInsightPreRun.toLowerCase()).toContain('no analysis has run')
  })
})

describe('before a run — the strip offers only what it can deliver', () => {
  it('the hint does not promise what the analysis says', () => {
    renderPanel(true)
    // ⚠ The pre-run half pins its own precondition: open by default is the
    // behaviour these assertions rely on, and it is a real rule, not a given.
    expect(screen.getByTestId('analysis-new-model-strip-toggle')).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    expect(hintText()).toBe(COPY.modelStrip.hintPreRun)
    expect(hintText()).not.toBe(COPY.modelStrip.hint)
  })

  it('picking a mark names the missing RUN, not a gap in the model', () => {
    renderPanel(true)
    expect(pickFirstMarkAndReadAbsence()).toBe(COPY.modelStrip.noInsightPreRun)
  })

  /** ⚠ THE CONTROL STAYS USEFUL — this is a narrowing, not a removal. */
  it('the marks still route to the canvas', () => {
    renderPanel(true)
    const marks = screen.queryAllByTestId('analysis-new-model-strip-mark')
    expect(marks.length).toBeGreaterThan(0)
    fireEvent.click(marks[0])
    expect(screen.getByTestId('analysis-new-model-strip-detail')).toBeInTheDocument()
  })
})

describe('after a run — the promise is kept, and must not be lost to this fix', () => {
  it('the hint offers what the analysis says', () => {
    renderPanel(false)
    openStrip()
    expect(hintText()).toBe(COPY.modelStrip.hint)
  })

  it('an absent finding is still reported as an absence about this node', () => {
    renderPanel(false)
    openStrip()
    const absence = pickFirstMarkAndReadAbsence()
    // A node the run DID speak about renders a detail instead — either is
    // correct post-run; what must never appear is the pre-run sentence.
    expect(absence).not.toBe(COPY.modelStrip.noInsightPreRun)
  })
})

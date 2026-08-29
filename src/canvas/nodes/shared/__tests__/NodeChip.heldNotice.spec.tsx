/**
 * A run chip on a model the engine cannot see says so BEFORE it is clicked.
 *
 * THE DEFECT, measured 29 Aug 2026 on the pinned immutable deploy
 * `6a931247c9b93500080a958b--olumi.netlify.app` (commit `64f2cdef`, asserted
 * from inside the page), guest, `#/canvas`, starter `headcount-allocation`:
 *
 *   · `pre-analysis-v3-analyse` → `disabled: true`,
 *     `title: "Analysis is held on a saved example. Re-draft it live to run one."`
 *   · the `decision_run_analysis` chip on node `dec_hiring` → enabled, no
 *     `title`, no visible state at all until clicked.
 *
 * One state, two surfaces, two stories. Present on 3 of the 5 starters
 * (market-entry x2, headcount-allocation x1, pricing-model x2); the other two
 * render no run chip because readiness is incomplete.
 *
 * ⚠ WHAT THIS SPEC IS NOT ABOUT, because the brief that commissioned it said
 * the button "does nothing" and that is FALSE. The click DOES answer: a warning
 * toast carrying that exact sentence appears within 300 ms. It auto-dismisses
 * at 5000 ms (`ToastContext.AUTO_DISMISS_MS.warning`), which is why every
 * observation taken later read an empty page and looked like a dead control.
 * `NodeChip.canonicalRun.spec.tsx` already pins the click. This pins the
 * caveat that was missing before it.
 *
 * BINDING BY IDENTITY, not by a value predicate: the expected title is imported
 * from `ANALYSIS_HELD_NOTICE`, the one authority the gate and the starter
 * banner also read, so a copy change moves all three or fails here. A hardcoded
 * string would pass while the product said something else.
 */

import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'

import { NodeChip } from '../NodeChip'
import { ToastProvider } from '../../../ToastContext'
import { useCanvasStore } from '../../../store'
import { ANALYSIS_HELD_NOTICE } from '../../../utils/analysisHeldOnInjectedModel'

// The held rung is a CONJUNCTION with the canonical run path, so the path must
// be pinned true or every assertion below passes vacuously by the other limb.
// `importOriginal`-spread, never a hand-listed factory: a `vi.mock` factory
// REPLACES the module, and this estate has lost 51 tests to exactly that.
const isV5CanonicalRunPathMock = vi.fn(() => true)
vi.mock('../../../../v5/eligibility', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../v5/eligibility')>()
  return { ...actual, isV5CanonicalRunPath: () => isV5CanonicalRunPathMock() }
})

const RUN_CHIP = 'decision_run_analysis'
const COACHING_CHIP = 'decision_explore_more_options'

function setNodes(nodes: Array<{ id: string; data?: Record<string, unknown> }>) {
  useCanvasStore.setState({ nodes: nodes as never })
}

function renderChips() {
  return render(
    <ToastProvider>
      <NodeChip
        chipId={RUN_CHIP}
        actionType="run_analysis"
        label="Run analysis"
        message="Run the analysis now"
      />
      <NodeChip
        chipId={COACHING_CHIP}
        actionType={null}
        label="Explore more options"
        message="Suggest a third option"
      />
    </ToastProvider>,
  )
}

const runChip = () => screen.getByRole('button', { name: 'Run analysis' })
const coachingChip = () => screen.getByRole('button', { name: 'Explore more options' })

beforeEach(() => {
  isV5CanonicalRunPathMock.mockReturnValue(true)
  setNodes([])
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('NodeChip — the held-model caveat rides the run chip', () => {
  it('carries the gate\'s own sentence when the graph is a starter', () => {
    setNodes([
      { id: 'goal_1', data: { type: 'goal' } },
      { id: 'dec_hiring', data: { type: 'decision', starterId: 'headcount-allocation' } },
    ])
    renderChips()
    expect(runChip()).toHaveAttribute('title', ANALYSIS_HELD_NOTICE.starter)
  })

  it('names an inserted TEMPLATE as a template, not as a saved example', () => {
    // The opposite-direction twin on the PROVENANCE axis: two states share one
    // remedy and must not share one noun phrase. Without this, a fix that
    // hardcoded the starter sentence would pass the test above and lie here.
    setNodes([{ id: 'n1', data: { templateId: 'marketing-v1' } }])
    renderChips()
    expect(runChip()).toHaveAttribute('title', ANALYSIS_HELD_NOTICE.template)
    expect(runChip().getAttribute('title')).not.toBe(ANALYSIS_HELD_NOTICE.starter)
  })

  it('makes NO claim when Olumi drafted the model (no title attribute at all)', () => {
    // Not `title=""`. An empty tooltip is a control that opens and says nothing,
    // which is the small version of the defect this spec exists for.
    setNodes([
      { id: 'goal_1', data: { type: 'goal' } },
      { id: 'dec_1', data: { type: 'decision' } },
    ])
    renderChips()
    expect(runChip()).not.toHaveAttribute('title')
  })

  it('makes no claim when the run would not take the canonical path', () => {
    // The gate's second conjunct. A V2-direct run DOES carry the canvas graph,
    // so the model is not held and the caveat would be false.
    isV5CanonicalRunPathMock.mockReturnValue(false)
    setNodes([{ id: 'dec_hiring', data: { starterId: 'headcount-allocation' } }])
    renderChips()
    expect(runChip()).not.toHaveAttribute('title')
  })

  it('does NOT put the refusal on a coaching chip in the same held state', () => {
    // THE DISCRIMINATING HALF. A coaching chip is not a run affordance: it
    // dispatches an ordinary turn and is not refused, so labelling it with the
    // run refusal would be a fresh falsehood. This is what separates "the
    // caveat is bound to run chips" from "the caveat is bound to something".
    setNodes([{ id: 'dec_hiring', data: { starterId: 'headcount-allocation' } }])
    renderChips()
    expect(runChip()).toHaveAttribute('title', ANALYSIS_HELD_NOTICE.starter)
    expect(coachingChip()).not.toHaveAttribute('title')
  })

  it('binds to the ONE authority, not to a copy of its words', () => {
    // Pins its own precondition: if `ANALYSIS_HELD_NOTICE` ever stopped naming
    // the remedy, the assertions above would still pass against whatever it
    // became. This asserts the property the user actually needs.
    setNodes([{ id: 'dec_hiring', data: { starterId: 'headcount-allocation' } }])
    renderChips()
    const title = runChip().getAttribute('title')
    expect(title).toBe(ANALYSIS_HELD_NOTICE.starter)
    expect(title).toMatch(/Re-draft it live to run one\.$/)
  })
})

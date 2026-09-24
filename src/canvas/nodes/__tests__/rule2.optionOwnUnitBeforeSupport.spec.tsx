/**
 * ⭐⭐⭐ RULE 2 ON THE OPTION CARD: WHAT IT SETS COMES BEFORE HOW IT SCORED.
 *
 * Node design system, rule 2 and the anatomy it serves:
 *
 * > **The node's own unit comes before any score.** … *The node's own value in
 * > its own unit comes first, and the line beneath says where the number came
 * > from. A run adds relative scores **below** that — never in place of it.*
 *
 * ⛔ THE DEFECT, AND WHY 270 LINES IS THE WHOLE STORY. `OptionNode` rendered the
 * run's normalised `Support 48%` near the top of the card body, and the option's
 * own change rows — *"Price · 40% → 80%"*, the value in the TARGET FACTOR'S unit,
 * which is what the option actually SETS — roughly two hundred and seventy lines
 * further down the same render. Both blocks are direct children of the same
 * `BaseNode`, so source order IS DOM order: a reader met the score before the
 * thing the score is about.
 *
 * *Neither block was wrong. They were never read together, because nothing in
 * either one mentions the other.* That is the same shape as the two height
 * authorities and the two `generateGraphHash` twins — a defect that lives in the
 * relationship between two correct things, where no single reading can see it.
 *
 * ⚠ THIS SPEC ASSERTS DOM ORDER, NOT SOURCE ORDER. A source-order guard over a
 * 2,000-line component would pass the moment either block moved into a different
 * parent while the user's reading order stayed wrong. `compareDocumentPosition`
 * binds to what is painted.
 *
 * ⚠ AND IT PINS ITS OWN PRECONDITION. An order assertion between two elements is
 * vacuous if either is absent, and absent is the DEFAULT for both here (no
 * interventions, no run). So both are asserted present first, by identity,
 * before any ordering claim is made.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { OptionNode } from '../OptionNode'
import { changeRow } from './__helpers__/optionChangeRowText'
import { useCanvasStore } from '../../store'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

const option = (id: string, data: Record<string, unknown> = {}) => ({
  id, type: 'option', position: { x: 0, y: 0 },
  data: { label: id, type: 'option', ...data },
})
const price = {
  id: 'price', type: 'factor', position: { x: 0, y: 0 },
  data: { label: 'Price', observedState: { unit: 'fraction', value: 0.8 } },
}
const candidate = option('candidate', { interventions: { price: 0.8 } })
const baseline = option('reference', {
  label: 'Keep the original plan', is_baseline: true, interventions: { price: 0.4 },
})

/**
 * ⛔⛔ THE FIRST VERSION OF THIS FIXTURE MADE THE GUARD VACUOUS, AND ONLY THE
 * MUTANT SAID SO. It set `results: { status: 'complete', report: {} }` — a
 * completed run with an EMPTY report — so `winRate` resolved null, the support
 * readout never mounted, and the ordering test took its own no-support branch.
 * Moving the deltas block back below the score left the spec **GREEN**.
 *
 * *An order assertion between two elements is vacuous whenever either is absent,
 * and absent was the default here.* Nothing errored, nothing was skipped, and
 * the file read exactly as it does now.
 *
 * The shape below is the one `OptionNode.currentness.spec.tsx` derived from
 * production — and its own comment records the same class of miss one level
 * down: *"A completed run sets BOTH in production. Writing the slice directly
 * reproduced only half of it, so this fixture named a completed run without
 * being one."* `option_probabilities[id].win_probability` is what actually feeds
 * `winRate` (`useNodeDisplayMetadata.ts:638`); `hasCompletedFirstRun` is the
 * other half.
 */
beforeEach(() => {
  useCanvasStore.setState({
    nodes: [candidate, price, baseline], edges: [], ceeAnalysisReady: null,
    viewMode: 'expert',
    importPendingServerRegistration: false, currentScenarioId: 'rule2-scenario',
    analysisFreshness: {
      freshness: 'fresh', freshnessReason: 'graph_hash_match',
      computedAt: '2026-09-17T00:00:00.000Z',
    },
    analysisFreshnessDirty: false, analysisStateV1: null,
    v5AnalysisFact: { scenarioId: 'rule2-scenario', analysisHash: 'last-run', hasRunAnalysisFact: true },
    hasCompletedFirstRun: true,
    results: { status: 'complete', hash: 'last-run', report: {
      option_probabilities: {
        candidate: { status: 'computed', win_probability: 0.48 },
        reference: { status: 'computed', win_probability: 0.52 },
      },
      robustness: { near_tie: { is_tie: false, top_option_id: 'reference' } },
    } },
  } as never)
})
afterEach(cleanup)

const mount = () => render(<ReactFlowProvider><OptionNode
  id={candidate.id} type="option" data={candidate.data} selected={false}
  isConnectable positionAbsoluteX={0} positionAbsoluteY={0}
  dragging={false} zIndex={0} deletable selectable draggable
/></ReactFlowProvider>)

describe('rule 2 — an option states what it sets before how it scored', () => {
  it('precondition: BOTH blocks render, so an ordering claim is meaningful', () => {
    mount()
    expect(document.querySelector(`[data-testid="option-analysis-currency-${candidate.id}"]`)).not.toBeNull()
    // Bound by IDENTITY — the exact pair in the target factor's unit — not by a
    // value predicate another row could satisfy.
    // contract v3.1 OPT-03: the card row's "from" half is its own muted span,
    // so the row is found by the change-row identity matcher, not one text node.
    expect(screen.getByText(changeRow('40% → 80%'))).toBeInTheDocument()
    expect(screen.getAllByText('Reference: Keep the original plan').length).toBeGreaterThan(0)
  })

  it('the own-unit change row precedes the support score in the DOM', () => {
    mount()
    // Bound to the CARD's own change row by identity (contract v3.1 OPT-03) —
    // `getAllByText(...)[0]` would now resolve to whatever else carries the text.
    const delta = screen.getByText(changeRow('40% → 80%'))
    const support = document.querySelector(`[data-testid="option-analysis-currency-${candidate.id}"]`)

    /**
     * ⚠⚠ A HARD PRECONDITION, NOT A BRANCH. The first cut wrote this as
     * `if (!support) { expect(support).toBeNull(); return }` — which turns a
     * fixture that stopped producing the score into a PASS, and that is exactly
     * what happened: the mutant moved the block back and the spec stayed green.
     * A guard whose discrimination depends on a fixture that nothing pins is a
     * guard agreeing with itself.
     */
    expect(support, 'the support readout must render, or this test asserts nothing').not.toBeNull()
    const rel = delta.compareDocumentPosition(support as Element)
    // DOCUMENT_POSITION_FOLLOWING === 4: `support` comes AFTER `delta`.
    expect(rel & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(rel & Node.DOCUMENT_POSITION_PRECEDING).toBeFalsy()
  })
})

/**
 * ⭐⭐ THE PANEL NEVER SAID WHAT DECISION IT WAS ABOUT.
 *
 * Measured on deployed `d135ff7e`, guest, starter `vendor-selection`, analysed:
 * the panel's own text contains the GOAL (`Replace CDP Within Budget and
 * Compliance Constraints`) and does NOT contain the decision label (`Customer
 * Data Platform Selection`). A reader could not name the decision from the
 * panel, because the panel never names it.
 *
 * ⭐ AND THE VALUE WAS ALREADY COMPUTED AND THROWN AWAY. `buildModelStrip` has
 * derived `decisionLabel` all along and collapsed it at the return:
 * `goalLabel: goalLabel ?? decisionLabel` — so the decision survives only on
 * models with no goal, which is the minority. Same shape as ROADMAP 2.1427:
 * a second value computed and discarded before anyone can read it.
 *
 * ── THE ARM THAT MATTERS IS THE ABSENT ONE, AND IT IS WRITTEN FIRST ─────────
 * This estate has shipped the same defect three times — an affordance gated on
 * producer data that real runs do not carry (#1643, and the census that was
 * supposed to catch it). A fixture that SUPPLIES a decision node proves the
 * decision arm works and says nothing about models without one. So the first
 * test below is the no-decision model, and every arm pins its own precondition
 * at the builder rather than trusting the fixture (trap 13b).
 *
 * ── WHAT THIS SPEC CANNOT CLAIM ────────────────────────────────────────────
 * jsdom applies no CSS and cannot prove visual hierarchy (trap 3). It asserts
 * the STRUCTURAL facts that produce it and are checkable: which string leads,
 * that the lead is never empty, and that no label is rendered twice. The
 * pixel claim is measured on the deployed build, not here.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

let nodes: unknown[] = []
type MockState = { nodes: unknown; setHighlightedNodes: unknown }
vi.mock('../../../../canvas/store', () => {
  const read = (): MockState => ({ nodes, setHighlightedNodes: vi.fn() })
  const useCanvasStore = (select: (s: MockState) => unknown) => select(read())
  ;(useCanvasStore as unknown as { getState: () => MockState }).getState = read
  return { useCanvasStore }
})
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: () => true }))
vi.mock('../../../../canvas/utils/highlightHelpers', () => ({
  highlightNode: vi.fn(),
  clearHighlight: vi.fn(),
}))
vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/ToastContext', () => ({ useShowToastSafe: () => vi.fn() }))

import { ModelStrip } from '../sections/ModelStrip'
import { buildModelStrip } from '../buildModelStrip'

const TID = 'analysis-new-model-strip'
const node = (id: string, type: string, label: string) => ({ id, type, data: { label } })
const OPTION = node('o1', 'option', 'Adopt Segment')

const DECISION = 'Customer Data Platform Selection'
const GOAL = 'Replace CDP Within Budget and Compliance Constraints'

const setNodes = (next: unknown[]) => {
  nodes = next
}
const mount = () => render(<ModelStrip isPreRun={false} />)

afterEach(() => {
  cleanup()
  nodes = []
})

describe('the builder stops discarding the decision', () => {
  it('⭐ a goal-only model reports NO decision — the absent arm, pinned at the builder', () => {
    const strip = buildModelStrip([node('g1', 'goal', GOAL), OPTION])
    expect(strip.decisionLabel).toBeNull()
    expect(strip.goalLabel).toBe(GOAL)
  })

  it('carries BOTH when the model names both, rather than collapsing one into the other', () => {
    const strip = buildModelStrip([node('d1', 'decision', DECISION), node('g1', 'goal', GOAL), OPTION])
    expect(strip.decisionLabel).toBe(DECISION)
    expect(strip.goalLabel).toBe(GOAL)
  })

  it('a decision-only model still names the question through goalLabel — the existing fallback is untouched', () => {
    const strip = buildModelStrip([node('d1', 'decision', DECISION), OPTION])
    expect(strip.decisionLabel).toBe(DECISION)
    expect(strip.goalLabel).toBe(DECISION)
  })
})

describe('what the panel leads with', () => {
  /**
   * ⭐⭐ THE ARM THAT WOULD CATCH A DARK LEAD. Every starter this product ships
   * is drafted by Olumi, and a model may carry a goal and no decision. If the
   * lead rendered only on models with a decision node, it would be invisible
   * here — and this is the shape the deployed build is in most often.
   */
  it('⭐ a model with NO decision still leads, with the goal — the lead is never empty', () => {
    setNodes([node('g1', 'goal', GOAL), OPTION])
    // PRECONDITION, IN-TEST: this really is the decision-less shape, so a pass
    // is the component's doing and not a fixture quietly supplying one.
    expect(buildModelStrip(nodes as never).decisionLabel, 'precondition: no decision node').toBeNull()
    mount()

    expect(screen.getByTestId(`${TID}-lead`)).toHaveTextContent(GOAL)
    // Nothing to put underneath: the goal IS the lead, and repeating it is the
    // restatement the first-viewport census exists to stop.
    expect(screen.queryByTestId(`${TID}-goal`)).toBeNull()
  })

  it('leads with the DECISION and demotes the goal beneath it when the model names both', () => {
    setNodes([node('d1', 'decision', DECISION), node('g1', 'goal', GOAL), OPTION])
    mount()

    expect(screen.getByTestId(`${TID}-lead`)).toHaveTextContent(DECISION)
    expect(screen.getByTestId(`${TID}-goal`)).toHaveTextContent(GOAL)
  })

  it('⛔ never renders one label twice — a decision-only model states it once', () => {
    setNodes([node('d1', 'decision', DECISION), OPTION])
    // PRECONDITION: this is the shape where goalLabel falls back to the
    // decision, which is exactly how a duplicate would be produced.
    const strip = buildModelStrip(nodes as never)
    expect(strip.goalLabel, 'precondition: the fallback is engaged').toBe(strip.decisionLabel)
    mount()

    expect(screen.getByTestId(`${TID}-lead`)).toHaveTextContent(DECISION)
    expect(screen.queryByTestId(`${TID}-goal`)).toBeNull()
    expect(screen.getAllByText(DECISION)).toHaveLength(1)
  })

  it('⛔ states a degenerate pair once, not twice', () => {
    setNodes([node('d1', 'decision', GOAL), node('g1', 'goal', GOAL), OPTION])
    mount()

    expect(screen.getAllByText(GOAL)).toHaveLength(1)
    expect(screen.queryByTestId(`${TID}-goal`)).toBeNull()
  })

  it('names no subject rather than rendering an empty lead when the model names neither', () => {
    setNodes([OPTION])
    mount()

    const lead = screen.getByTestId(`${TID}-lead`)
    expect(lead.textContent?.trim()).not.toBe('')
    expect(screen.queryByTestId(`${TID}-goal`)).toBeNull()
  })
})

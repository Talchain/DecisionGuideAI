/**
 * ⭐ THE KEY QUESTION BELONGS TO THE SCENARIO THAT PRODUCED IT.
 *
 * `KeyQuestionCard` reads `runMeta.decisionReview030.decision_quality_prompts`
 * with NO scenario gate and NO status gate. `runMeta` was not cleared at the two
 * scenario boundaries a user actually walks (`store.loadScenario` and
 * `store.hydrateGraphSlice` — `store.ts:1452` names all four and only
 * `resetCanvas` / `importCanvas` cleared it), so after A → B this card printed
 * the science-grounded key question CEE asked about A, under B's heading, on a
 * model B that may never have been analysed at all.
 *
 * ── WHY THIS RENDER LIVES HERE AND NOT BESIDE THE STORE FIX ────────────────
 *
 * `inertness.spec.ts` in this directory forbids ANY file outside
 * `components/results/analysis-hero` from importing the module — it is the
 * trap-3b defence, because a second importer is a potential second mount path,
 * and this estate has shipped a hero-bound test against an unmounted component
 * twice.
 *
 * The store-boundary spec (`canvas/__tests__/store.scenarioSwitchRunMetaEviction`)
 * originally rendered this card and was, measurably, the SOLE entry in that
 * guard's offender list. ⛔ The repair is to put the render WITH the component —
 * where the guard skips it by design — and NOT to widen `AUTHORIZED_IMPORTERS`
 * for a test's convenience. An allow-list entry added to clear a red is exactly
 * how a guard stops guarding.
 *
 * ── WHAT THIS BINDS TO ─────────────────────────────────────────────────────
 *
 * The question text by IDENTITY (a unique sentinel compared with `toContain`),
 * never a count. The precondition is PINNED: the card must genuinely render A's
 * question BEFORE the switch, so this cannot pass because the card stopped
 * mounting for some unrelated reason (trap 13b).
 *
 * Scope (trap 3): one jsdom render pair. It proves the card's content changes
 * with the scenario. It does not prove layout.
 */
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { useCanvasStore } from '../../../../canvas/store'
import { createScenario } from '../../../../canvas/store/scenarios'
import { KeyQuestionCard } from '../KeyQuestionCard'
import type { DecisionReview030 } from '../../../../v5/decisionReviewAdapter'

const LS_KEYS = [
  'olumi-canvas-scenarios',
  'olumi-canvas-autosave',
  'olumi-canvas-current-scenario-id',
  'olumi-canvas-run-history',
]

/** Scenario A's key question, verbatim. A pass cannot come from a paraphrase. */
const A_QUESTION = 'Which assumption about A-headcount would most change this decision?'

const goalNode = (id: string, label: string) =>
  ({ id, type: 'goal', position: { x: 0, y: 0 }, data: { kind: 'goal', label } }) as never
const factorNode = (id: string, label: string) =>
  ({ id, type: 'factor', position: { x: 0, y: 100 }, data: { kind: 'factor', label } }) as never
const edge = (id: string, source: string, target: string) =>
  ({ id, source, target, type: 'styled', data: { weight: 0.5, direction: 'positive' } }) as never

const makeScenario = (name: string, goalLabel: string) =>
  createScenario({
    name,
    nodes: [goalNode('1', goalLabel), factorNode('2', `${name} spend`)],
    edges: [edge('e1', '2', '1')],
  })

/** Declared as `DecisionReview030` with NO cast, so every member must be present. */
function reviewForA(): DecisionReview030 {
  return {
    narrative_summary: 'A-scenario narrative summary sentinel',
    story_headlines: [],
    robustness_explanation: null,
    readiness_rationale: null,
    scenario_contexts: [],
    decision_quality_prompts: [
      {
        principle: 'Sensitivity',
        applies_because: 'One factor dominates the comparison.',
        question: A_QUESTION,
      },
    ],
    produced_at: '2026-09-11T00:00:00.000Z',
    hasProse: true,
  }
}

beforeEach(() => {
  for (const k of LS_KEYS) localStorage.removeItem(k)
  useCanvasStore.getState().reset()
})
afterEach(cleanup)

describe('KeyQuestionCard — the question does not outlive its scenario', () => {
  it("stops rendering A's key question once B is on the canvas", () => {
    const a = makeScenario('Scenario A', 'A revenue')
    const b = makeScenario('Scenario B', 'B revenue')

    expect(useCanvasStore.getState().loadScenario(a.id)).toBe(true)
    useCanvasStore.getState().setRunMeta({ decisionReview030: reviewForA() })

    const first = render(<KeyQuestionCard />)
    // PRECONDITION, pinned: the card genuinely renders A's question first.
    expect(screen.getByTestId('key-question-text').textContent).toContain(A_QUESTION)
    first.unmount()

    expect(useCanvasStore.getState().loadScenario(b.id)).toBe(true)

    render(<KeyQuestionCard />)
    expect(screen.queryByTestId('key-question-card')).toBeNull()
  })
})

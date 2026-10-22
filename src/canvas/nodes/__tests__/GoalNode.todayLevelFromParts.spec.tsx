/**
 * F3 (DL 22 Oct, café level journey on UI 0d6418b7 / CEE 68ca54f0): a goal defined by its parts (takings = customers ×
 * spend) carries the level CEE worked out from them on `observedState` with no source, and the card showed "—". It now
 * says the level as worked out from its parts, never as one the person stated, and offers no field to type over it.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { GoalNode } from '../GoalNode'

vi.mock('@xyflow/react', async () => ({ ...await vi.importActual<Record<string, unknown>>('@xyflow/react'), Handle: () => null }))

const PARTS = [
  { id: 'customers', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Weekly customers' } },
  { id: 'spend', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Average spend per customer' } },
]
const store = vi.hoisted(() => ({ nodes: [] as unknown[] }))
vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector: (s: unknown) => unknown) => selector({
    results: { status: 'idle', report: null }, highlightedNodes: new Set(), dimmedNodeIds: new Set(),
    lens: { _dimmedNodeIds: new Set() }, goalThreshold: null, goalConstraints: [], nodes: store.nodes, edges: [],
    ceeAnalysisReady: null, viewMode: 'expert',
  })),
}))
// A core scenario (its saved model has a living model): where a stated level would be typed on the card.
vi.mock('../shared/savedGraph', () => ({ useSavedGraph: () => ({ nodes: [], living_model: { aims: [], links: [] } }) }))
vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: () => ({ sensitivityRank: null, influence: null, confidence: null, inSensitivityAnalysis: false,
    achievementProbability: null, stabilityPercentage: null, winRate: null, isResultsMode: false, predictedOutcome: null,
    valueOfInformation: null, voiRank: null }),
}))

/** The café goal's canvas data, as the served turn (c5398960) hydrated it: the keys `takings` held, verbatim. */
const SERVED_GOAL = {
  label: 'I want weekly takings of at least £2,800 within three months.', kind: 'goal', type: 'goal', ref: 'G1',
  goal_direction: '>=', goal_threshold: 0.8, goal_threshold_raw: 2800, goal_threshold_unit: '£ per week',
  goal_threshold_frame: 'level', goal_threshold_cap: 3500, goal_deadline_as_stated: 'within three months',
  nonlinear_identity: { operation: 'product', factor_ids: ['customers', 'spend'], stated_in_brief: true },
  observedState: { cap: 3500, unit: '£ per week', value: 0.744, baseline: 0.744, raw_value: 2604 },
}

function today(data: Record<string, unknown>, nodes: unknown[] = PARTS) {
  store.nodes = nodes
  const { container } = render(<ReactFlowProvider><GoalNode id="takings" type="goal" data={data} selected={false}
    isConnectable positionAbsoluteX={0} positionAbsoluteY={0} dragging={false} zIndex={0} deletable selectable draggable /></ReactFlowProvider>)
  const line = container.querySelector('[data-testid="goal-today-level-takings"]')
  return { text: line?.textContent ?? null, editor: container.querySelector('[data-testid="goal-today-level-editor-takings"]') }
}

afterEach(cleanup)

describe('a goal defined by its parts says today\'s level as worked out from them', () => {
  it('⭐ served café goal: "Today: £2,604 … — worked out from Weekly customers × Average spend per customer", read-only', () => {
    const { text, editor } = today(SERVED_GOAL)
    expect(text).toMatch(/^Today: £2,604\b.* — worked out from Weekly customers × Average spend per customer$/)
    expect(text).not.toMatch(/you said|you confirmed|your brief/)
    expect(editor).toBeNull()
  })

  it('a sum is spelt with "+"; a part with no label on the canvas, or an operation the UI cannot spell, says "its parts"', () => {
    expect(today({ ...SERVED_GOAL, nonlinear_identity: { operation: 'sum', factor_ids: ['customers', 'spend'] } }).text)
      .toMatch(/ — worked out from Weekly customers \+ Average spend per customer$/)
    cleanup()
    expect(today(SERVED_GOAL, PARTS.slice(0, 1)).text).toMatch(/ — worked out from its parts$/)
    cleanup()
    expect(today({ ...SERVED_GOAL, nonlinear_identity: { operation: 'ratio', factor_ids: ['customers', 'spend'] } }).text)
      .toMatch(/ — worked out from its parts$/)
  })

  it('⛔ CONTROLS: a sourced level keeps its own words; no identity, one part, another unit or no figure says no worked-out level', () => {
    const stated = today({ ...SERVED_GOAL, observedState: { ...SERVED_GOAL.observedState, source: 'user' } })
    expect(stated.text).toMatch(/^Today: £2,604\b.* — you said$/)
    cleanup()
    const olumi = today({ ...SERVED_GOAL, observedState: { ...SERVED_GOAL.observedState, source: 'cee_inference' } }).text
    expect(olumi ?? '').not.toContain('2,604')
    cleanup()
    const { nonlinear_identity: _, ...noIdentity } = SERVED_GOAL
    for (const data of [noIdentity, { ...SERVED_GOAL, nonlinear_identity: { operation: 'product', factor_ids: ['customers'] } },
      { ...SERVED_GOAL, observedState: { ...SERVED_GOAL.observedState, unit: '£ per month' } },
      { ...SERVED_GOAL, observedState: { ...SERVED_GOAL.observedState, raw_value: undefined } }]) {
      expect(today(data).text ?? '').not.toContain('worked out')
      cleanup()
    }
  })
})

/**
 * ⭐ Today's level on a change goal (cut-costs served `09af9019`, UI 330240a4; AIQ 5902409861).
 * "Target: down 20% from today" never said what today is, so the journey's correction ("£50k, not £45k") had nothing on
 * the graph to correct. Rows: AIQ's three plus the false-figure guard.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { GoalNode } from '../GoalNode'

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

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector) => selector(makeStoreState())),
}))

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
import type { LodRung } from '../../utils/zoomLegibility'

const baseProps = {
  id: 'goal-1',
  type: 'goal',
  selected: false,
  isConnectable: true,
  position: { x: 0, y: 0 },
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  dragging: false,
  zIndex: 0,
  deletable: true,
  selectable: true,
  draggable: true,
}

function renderCard(data: Record<string, unknown>, lodRung: LodRung = 'full') {
  vi.mocked(useCanvasStore).mockImplementation((selector) =>
    selector(makeStoreState({ lodRung }) as never),
  )
  const { container, unmount } = render(
    <ReactFlowProvider>
      <GoalNode {...baseProps} data={{ label: 'Grow annual revenue', type: 'goal', ...data }} />
    </ReactFlowProvider>,
  )
  return {
    container,
    text: container.textContent ?? '',
    lodLine: container.querySelector('[data-testid="node-lod-line"]')?.textContent ?? null,
    unmount,
  }
}


// The served cut-costs goal node, field for field (goal-src-probe on 09af9019, 30 Sep 01:4xZ).
const SERVED_CUT_COSTS = {
  label: 'Costs',
  goal_direction: '<=',
  goal_threshold: -0.2,
  threshold_source: 'brief_extraction',
  goal_level_reading: { lead: "Olumi reads your ‘£45k’ (‘Monthly spend is £45k’) as today's level of ‘costs’", bound: '<=', level: 45000, quote: 'Monthly spend is £45k', level_unit: '£/month' },
  goal_threshold_cap: 56250,
  goal_threshold_raw: -0.2,
  goal_threshold_unit: '£/month',
  goal_threshold_frame: 'change_rel',
  goal_threshold_cap_provenance: 'target_derived_headroom',
}
const line = (container: HTMLElement) => container.querySelector('[data-testid="goal-today-level-goal-1"]')?.textContent ?? null

describe('GoalNode — today\'s level on a change goal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useCanvasStore).mockImplementation((selector) => selector(makeStoreState() as never))
  })

  it('RED: the served reading → "Today: £45,000/month — Olumi\'s reading of ‘Monthly spend is £45k’" (never "your brief")', () => {
    const { container } = renderCard(SERVED_CUT_COSTS)
    expect(line(container)).toBe('Today: £45,000 / month — Olumi\'s reading of ‘Monthly spend is £45k’')
    expect(container.textContent).not.toMatch(/your brief/)
  })

  it('RED: after MG\'s apply (no reading, a user-stated level) → "Today: £50,000/month — you said"', () => {
    const { goal_level_reading: _r, ...rest } = SERVED_CUT_COSTS
    const { container } = renderCard({ ...rest, observedState: { raw_value: 50000, unit: '£/month', source: 'user', value: 0.8 } })
    expect(line(container)).toBe('Today: £50,000 / month — you said')
  })

  it('a REFRESHED reading wins over a user-stated level (AIQ: subject differs from the user\'s words)', () => {
    const { container } = renderCard({
      ...SERVED_CUT_COSTS,
      goal_level_reading: { ...SERVED_CUT_COSTS.goal_level_reading, level: 50000, quote: 'Actually our monthly cloud spend is £50k' },
      observedState: { raw_value: 50000, unit: '£/month', source: 'user' },
    })
    expect(line(container)).toBe('Today: £50,000 / month — Olumi\'s reading of ‘Actually our monthly cloud spend is £50k’')
  })

  it('⛔ CONTROL: a level goal with neither carrier says nothing; a level goal is never given the line', () => {
    const level = { label: 'MRR', goal_threshold_raw: 25000, goal_threshold_unit: '£/month', goal_threshold_frame: 'level', goal_direction: '>=' }
    expect(line(renderCard(level).container)).toBeNull()
    expect(line(renderCard({ ...level, goal_level_reading: SERVED_CUT_COSTS.goal_level_reading }).container)).toBeNull()
  })

  it('⛔ FALSE-FIGURE GUARD: never a normalised value, never another unit, never an Olumi-sourced level', () => {
    const { goal_level_reading: _r, ...rest } = SERVED_CUT_COSTS
    expect(line(renderCard({ ...rest, observedState: { value: 0.8, unit: '£/month', source: 'user' } }).container)).toBeNull()
    expect(line(renderCard({ ...rest, observedState: { raw_value: 50000, unit: '$/month', source: 'user' } }).container)).toBeNull()
    expect(line(renderCard({ ...rest, observedState: { raw_value: 45000, unit: '£/month', source: 'cee_inference' } }).container)).toBeNull()
    expect(line(renderCard({ ...SERVED_CUT_COSTS, goal_level_reading: { ...SERVED_CUT_COSTS.goal_level_reading, level_unit: 'GBP' } }).container)).toBeNull()
  })
})

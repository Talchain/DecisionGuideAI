/**
 * ⭐ R1 S4-core (MG 5879952291): the goal CARD says a change-framed target as the change — at full zoom and on the
 * reduced line derived from it. "Cut the cloud bill by 15%" arrives as `goal_threshold_frame: 'change_rel'`,
 * `goal_threshold_raw: -0.15` beside the metric's unit; read as a level the card printed "Target: -0.15 GBP/month".
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { GoalNode } from '../GoalNode'
import { formatGoalTarget } from '../../../components/results/utils/formatGoalTarget'

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
    text: container.textContent ?? '',
    lodLine: container.querySelector('[data-testid="node-lod-line"]')?.textContent ?? null,
    unmount,
  }
}

describe('GoalNode — a target stated as a change from today', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useCanvasStore).mockImplementation((selector) => selector(makeStoreState() as never))
  })

  const CHANGE = { goal_threshold_raw: -0.15, goal_threshold_unit: 'GBP/month', goal_threshold_frame: 'change_rel' }

  it('RED: the card reads "Target: down 15% from today", never the fraction as a price', () => {
    const { text } = renderCard(CHANGE)
    expect(text).toContain('Target: down 15% from today')
    expect(text).not.toMatch(/0\.15|GBP/)
  })

  it('RED: the reduced line says the same change (derived from the full-zoom line)', () => {
    const { lodLine } = renderCard(CHANGE, 'line')
    expect(lodLine).toContain('down 15% from today')
  })

  it('RED: change_abs keeps the metric\'s money notation — "Target: down £5,000 from today"', () => {
    const { text } = renderCard({ goal_threshold_raw: -5000, goal_threshold_unit: 'GBP', goal_threshold_frame: 'change_abs' })
    expect(text).toContain('Target: down £5,000 from today')
  })

  it('⛔ CONTRAST: a level target on the same unit reads exactly as before', () => {
    const { text } = renderCard({ goal_threshold_raw: 20000, goal_threshold_unit: 'GBP/month', goal_threshold_frame: 'level' })
    expect(text).toContain(`Target: ${formatGoalTarget(20000, 'GBP/month')}`)
    expect(text).not.toContain('from today')
  })

  it('RED: a change target\'s line is plain text, never a button routing to the (read-only) Model tab editor', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) => selector(makeStoreState({ lodRung: 'full' }) as never))
    const { container } = render(
      <ReactFlowProvider>
        <GoalNode {...baseProps} data={{ label: 'Cut the cloud bill', type: 'goal', ...CHANGE }} />
      </ReactFlowProvider>,
    )
    const line = container.querySelector('[data-testid="goal-target-line"]')
    expect(line, 'the target line').not.toBeNull()
    expect(line!.tagName).not.toBe('BUTTON')
    expect(line!.getAttribute('aria-label') ?? '').not.toMatch(/change it in/i)
  })
})

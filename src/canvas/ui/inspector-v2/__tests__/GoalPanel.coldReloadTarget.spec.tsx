/**
 * ⛔ DL 5902607375 (signed-in MRR `520aab46`, guest control `3b6369b0`, UI 330240a4): after a COLD RELOAD the Goal
 * panel said "Adding a specific target unlocks probability calculations." beside a stated £85,000 target and a 41%
 * readout. The cold read carries CEE's target on the NODE (0.8 model / £85,000 raw); the store scalar the panel asked
 * is only written by `setCeeAnalysisReady`, which a reload does not replay. The pipeline's number on the node now
 * answers "does the pipeline hold a number" too.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { GoalPanel } from '../panels/GoalPanel'
import { useCanvasStore } from '../../../store'
import { useAuth } from '../../../../contexts/AuthContext'
import { GOAL_CONSTRAINT_COPY } from '../inspectorStrings'

vi.mock('../../../../contexts/AuthContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../contexts/AuthContext')>()
  return { ...actual, useAuth: vi.fn() }
})

const REAL_AUTH = { authenticated: true, user: { id: 'u-123', email: 'real@user.io' } }

const GOAL_ID = 'goal1'
const GOAL_NODE = {
  id: GOAL_ID,
  type: 'goal',
  position: { x: 0, y: 0 },
  data: { label: 'Reach £30k MRR within 18 months' },
}

function seedCanvas(data: Record<string, unknown> = {}) {
  useCanvasStore.getState().reset()
  useCanvasStore.setState({
    nodes: [{ ...GOAL_NODE, data: { ...GOAL_NODE.data, ...data } }],
    edges: [],
    goalThreshold: null,
  } as never)
}

function renderPanel() {
  return render(
    <GoalPanel nodeId={GOAL_ID} techMode={false} onClose={() => {}} onNavigate={() => {}} />,
  )
}

/** Bind the shared target control independently of the legacy readout text. */
function editorIn(container: HTMLElement): HTMLElement | null {
  return container.querySelector('[data-testid="goal-panel-target"]')
}

/** The readout sentence, which is the editor's alternative on this branch. */
function hasReadout(container: HTMLElement): boolean {
  return /Success means reaching\s*≥/.test(container.textContent ?? '')
}

beforeEach(() => {
  cleanup()
  seedCanvas()
  vi.mocked(useAuth).mockReset()
  vi.mocked(useAuth).mockReturnValue(REAL_AUTH as unknown as ReturnType<typeof useAuth>)
})


// The cold-read goal node as served (DL run4): CEE's model-scale threshold + raw, no user target, store scalar empty.
const COLD_READ = { goal_threshold: 0.8, goal_threshold_raw: 85000, goal_threshold_unit: '£', goal_direction: '>=', threshold_source: 'brief_extraction' }

describe('the Goal panel after a cold reload', () => {
  it('RED: a target on the node + an empty store scalar → the readout, never "unlocks probability calculations"', () => {
    seedCanvas(COLD_READ)
    expect(useCanvasStore.getState().goalThreshold).toBeNull()
    const { container } = renderPanel()
    expect(container.textContent).not.toContain(GOAL_CONSTRAINT_COPY.targetUnlocks)
    expect(hasReadout(container)).toBe(true)
    expect(container.textContent).toContain('£85,000')
    expect(editorIn(container)).toBeNull()
  })

  it('CONTROL: a goal with no target anywhere still says the true sentence', () => {
    seedCanvas({})
    const { container } = renderPanel()
    expect(container.textContent).toContain(GOAL_CONSTRAINT_COPY.targetUnlocks)
    expect(hasReadout(container)).toBe(false)
  })

  it('CONTROL: a non-finite node threshold is not a pipeline number', () => {
    seedCanvas({ goal_threshold: Number.NaN })
    const { container } = renderPanel()
    expect(container.textContent).toContain(GOAL_CONSTRAINT_COPY.targetUnlocks)
  })
})

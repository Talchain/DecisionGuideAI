/**
 * F9 (UI brief 2026-07-16 item 3): the Model tab must SHOW a run in flight.
 * Before this change it had zero isRunning handling: dispatching a run with
 * Model fronted left the sections frozen with no in-flight signal.
 *
 * Pins: banner above the retained model + body marked busy while running;
 * treatment gone on settle (complete or error); no aria-live region of its
 * own (the dock-level announcer is the single voice); defensive skeleton
 * when there is no model to retain.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import type { Node } from '@xyflow/react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockCanvasState: any

vi.mock('../../store', () => ({
  useCanvasStore: Object.assign(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (selector: (s: any) => unknown) => selector(mockCanvasState),
    { getState: () => mockCanvasState },
  ),
}))
vi.mock('../../../stores/uiStore', () => ({
  useUIStore: Object.assign(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (selector: (s: any) => unknown) => selector({ pendingModelTabSection: null }),
    { getState: () => ({ requestModelTabSection: vi.fn() }) },
  ),
}))
vi.mock('../../../telemetry/guidanceEvents', () => ({ trackGuidance: vi.fn() }))
vi.mock('../GraphTextView', () => ({
  SectionErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
// Stub the heavy section tree; the header passes children through so the
// sections' wrapper (the retained content) stays in the DOM.
vi.mock('../model-tab/ModelTabHeader', () => ({
  ModelTabHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="model-content">{children}</div>
  ),
}))
vi.mock('../model-tab/StatusBar', () => ({ StatusBar: () => null }))
vi.mock('../model-tab/EntityBar', () => ({ EntityBar: () => null }))
vi.mock('../model-tab/GoalSection', () => ({ GoalSection: () => null }))
vi.mock('../model-tab/OptionsSection', () => ({ OptionsSection: () => null }))
vi.mock('../model-tab/FactorsSection', () => ({ FactorsSection: () => null }))
vi.mock('../model-tab/RelationshipsSection', () => ({ RelationshipsSection: () => null }))
vi.mock('../model-tab/RisksSection', () => ({ RisksSection: () => null }))
vi.mock('../model-tab/ModelAdjustments', () => ({ ModelAdjustments: () => null }))
vi.mock('../model-tab/ModelHealthSection', () => ({ ModelHealthSection: () => null }))
vi.mock('../model-tab/StreamingDiagnostics', () => ({ StreamingDiagnostics: () => null }))
vi.mock('../model-tab/ReanalyseBar', () => ({ ReanalyseBar: () => null }))
vi.mock('../model-tab/ModelFooter', () => ({ ModelFooter: () => null }))

import { ModelTabBody } from '../ModelTabBody'

const NODES: Node[] = [
  { id: 'goal-1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Goal' } },
  { id: 'fac-1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Factor' } },
]

function renderModelTab(nodes: Node[] = NODES) {
  return render(
    <ModelTabBody
      showDebug={false}
      hasDiagnostics={false}
      diagnostics={null}
      hasTrim={false}
      effectiveCorrelationId={null}
      correlationMismatch={false}
      correlationIdHeader={null}
      nodes={nodes}
      edges={[]}
      robustness={null}
    />,
  )
}

function setRun(status: string, startedAt?: number) {
  mockCanvasState = {
    ...mockCanvasState,
    results: { status, startedAt },
  }
}

beforeEach(() => {
  mockCanvasState = {
    updateEdge: vi.fn(),
    ceeAnalysisReady: null,
    ceePipelineTrace: null,
    repairsApplied: null,
    results: { status: 'idle' },
    hasCompletedFirstRun: false,
    rawV2Response: null,
    analysisFreshness: null,
    analysisFreshnessDirty: false,
    currentScenarioId: null,
    v5AnalysisFact: null,
    selection: { nodeIds: new Set(), edgeIds: new Set() },
  }
})

describe('F9: ModelTabBody run-state coverage', () => {
  it('positive control: idle shows the model with no run treatment and no busy mark', () => {
    renderModelTab()
    expect(screen.getByTestId('model-content')).toBeInTheDocument()
    expect(screen.queryByTestId('analysis-running-banner')).not.toBeInTheDocument()
    expect(screen.queryByTestId('analysis-run-skeleton')).not.toBeInTheDocument()
    expect(screen.getByTestId('model-tab')).not.toHaveAttribute('aria-busy')
  })

  it('run in flight: banner above the retained model, body marked busy, never blanked', () => {
    setRun('streaming', Date.now())
    renderModelTab()
    expect(screen.getByTestId('analysis-running-banner')).toBeInTheDocument()
    expect(screen.getByTestId('model-content')).toBeInTheDocument()
    expect(screen.getByTestId('model-tab')).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByTestId('analysis-run-skeleton')).not.toBeInTheDocument()
  })

  it('run in flight with no model to retain: skeleton, not a blank body', () => {
    setRun('preparing', Date.now())
    renderModelTab([])
    expect(screen.getByTestId('analysis-run-skeleton')).toBeInTheDocument()
    expect(screen.queryByTestId('analysis-running-banner')).not.toBeInTheDocument()
  })

  it('settle: treatment gone, busy mark gone', () => {
    setRun('complete')
    renderModelTab()
    expect(screen.queryByTestId('analysis-running-banner')).not.toBeInTheDocument()
    expect(screen.queryByTestId('analysis-run-skeleton')).not.toBeInTheDocument()
    expect(screen.getByTestId('model-tab')).not.toHaveAttribute('aria-busy')
  })

  it('error: honest settled state, never a stuck treatment', () => {
    setRun('error')
    renderModelTab()
    expect(screen.queryByTestId('analysis-running-banner')).not.toBeInTheDocument()
    expect(screen.queryByTestId('analysis-run-skeleton')).not.toBeInTheDocument()
    expect(screen.getByTestId('model-content')).toBeInTheDocument()
  })

  it('contributes no aria-live region of its own (the dock announcer is the single voice)', () => {
    setRun('streaming', Date.now())
    const { container } = renderModelTab()
    expect(container.querySelectorAll('[aria-live]')).toHaveLength(0)
  })
})

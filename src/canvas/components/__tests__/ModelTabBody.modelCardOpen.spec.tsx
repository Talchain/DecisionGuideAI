/**
 * THE MODEL CARD IS OPEN ON ARRIVAL — ON BOTH OF ITS TWO CODE PATHS.
 *
 * ## The defect this pins
 *
 * The Model card carries the run's seed, sample count and VOI method, and
 * prints *"Not reported by this run"* for anything the engines did not
 * report. It is the product's honesty story about its own compute — and it
 * shipped shut (deployed-bundle census, 29 Aug 2026).
 *
 * ## Why there are two cases, and why one is not a copy of the other
 *
 * `ModelTabBody.makeSectionProps` returns TWO DIFFERENT SHAPES, so "the card
 * is open" is decided by different code in each mode:
 *
 *   expert mode ON  → `{}`                       → the Accordion is
 *                                                  UNCONTROLLED, and its own
 *                                                  `defaultExpanded` governs
 *   expert mode OFF → `{ isExpanded, onExpandChange }` → the Accordion is
 *                                                  CONTROLLED, `defaultExpanded`
 *                                                  is INERT, and the initial
 *                                                  `openSection` state governs
 *
 * A fix applied to only one of these leaves the other shut, and the passing
 * half would read as a completed change. The two cases below are the
 * opposite-direction twin the standing brief requires: they exercise the two
 * mechanisms separately, and neither can carry the other.
 *
 * ## What this does NOT claim
 *
 * Only that the card is expanded on first render. It says nothing about the
 * card's CONTENT, which `ModelHealthSection.spec.tsx` owns.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, within } from '@testing-library/react'
import type { Node } from '@xyflow/react'

let mockCanvasState: any

vi.mock('../../store', () => ({
  useCanvasStore: Object.assign(
    (selector: (s: any) => unknown) => selector(mockCanvasState),
    { getState: () => mockCanvasState },
  ),
}))
vi.mock('../../../stores/uiStore', () => ({
  useUIStore: Object.assign(
    (selector: (s: any) => unknown) => selector({ pendingModelTabSection: null }),
    { getState: () => ({ requestModelTabSection: vi.fn() }) },
  ),
}))
vi.mock('../../../telemetry/guidanceEvents', () => ({ trackGuidance: vi.fn() }))
vi.mock('../GraphTextView', () => ({
  SectionErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
// Every heavy sibling is stubbed EXCEPT `ModelHealthSection`, which is the
// subject — stubbing it is exactly how this file would pass vacuously.
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
vi.mock('../model-tab/StreamingDiagnostics', () => ({ StreamingDiagnostics: () => null }))
vi.mock('../model-tab/ReanalyseBar', () => ({ ReanalyseBar: () => null }))
vi.mock('../model-tab/ModelFooter', () => ({ ModelFooter: () => null }))

import { ModelTabBody } from '../ModelTabBody'

const NODES: Node[] = [
  { id: 'goal-1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Goal' } },
  { id: 'fac-1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Factor' } },
]

function renderModelTab(expertMode: boolean) {
  return render(
    <ModelTabBody
      showDebug={false}
      hasDiagnostics={false}
      diagnostics={null}
      hasTrim={false}
      effectiveCorrelationId={null}
      correlationMismatch={false}
      correlationIdHeader={null}
      nodes={NODES}
      edges={[]}
      robustness={null}
      expertMode={expertMode}
    />,
  )
}

/** The Accordion primitive publishes its state on its header button. */
function modelCardHeader(): HTMLElement {
  return within(screen.getByTestId('model-health-section')).getAllByRole('button')[0]
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

describe('the Model card is open on arrival', () => {
  it('(a) CONTROLLED path (default, expert mode off) — open without a click', () => {
    renderModelTab(false)
    // Positive control: the card mounted, so the reading below is a fact about
    // the accordion and not about a section that never rendered.
    expect(screen.getByTestId('model-health-section')).toBeInTheDocument()
    expect(modelCardHeader()).toHaveAttribute('aria-expanded', 'true')
  })

  it('(b) UNCONTROLLED path (expert mode on) — open without a click', () => {
    renderModelTab(true)
    expect(screen.getByTestId('model-health-section')).toBeInTheDocument()
    expect(modelCardHeader()).toHaveAttribute('aria-expanded', 'true')
  })
})

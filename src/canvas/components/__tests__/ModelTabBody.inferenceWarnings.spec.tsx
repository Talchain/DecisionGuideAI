/**
 * ModelTabBody — inference-warnings adoption pin (ROADMAP 2.173, Paul-ratified
 * 2026-07-30; evidence: PHASE0-EVIDENCE-2026-07-28/inference-warnings-derivation.md).
 *
 * The Model card's audit-trail `inferenceWarnings` was one of the two STOPPED
 * readers recorded in `readInferenceWarnings.ts`: it read ONLY the legacy
 * `report.robustness.inference_warnings` slot, which is empty on every live
 * run (0/827 measured 2026-07-30), while the real data lives at the report
 * ROOT (419/827 non-empty). So the ModelHealthSection banner ("N factors have
 * no value set") and the codes-only audit row were permanently blank.
 *
 * Pin: a fixture carrying ROOT-slot `inference_warnings` renders both
 * surfaces. RED before the ModelTabBody swap to the shared dual reader,
 * GREEN after.
 *
 * Controls:
 *  - legacy-slot payload still renders both surfaces (the dual read's second
 *    arm is not dead — positive control against a root-only regression);
 *  - absent warnings in BOTH slots → neither surface renders, while the rest
 *    of the audit block still does (no new blank-state regression).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
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
// Stub the heavy section tree. ModelTabHeader stays REAL (it provides
// DetailToggleContext, which gates the audit row under test) and
// ModelHealthSection stays REAL (it renders both surfaces under test).
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

// Shapes mirror live staging items (code/message/severity, per the 2026-07-30
// probe): one ROOT_NODE_DEFAULT_VALUE (drives the banner) plus one other code
// (proves the audit row lists ALL codes, not just the banner's).
const WARNING_ITEMS = [
  {
    code: 'ROOT_NODE_DEFAULT_VALUE',
    severity: 'info',
    message: "No observed value provided for root node 'fac-1'; defaulted to 0.0.",
  },
  {
    code: 'CONSTRAINT_TARGET_UNRELIABLE',
    severity: 'warning',
    message: 'The success target cannot be evaluated reliably.',
  },
]

function renderModelTab() {
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
      expertMode
    />,
  )
}

function setReport(report: Record<string, unknown>) {
  mockCanvasState = {
    ...mockCanvasState,
    results: { status: 'complete', report },
  }
}

beforeEach(() => {
  mockCanvasState = {
    updateEdge: vi.fn(),
    ceeAnalysisReady: null,
    ceePipelineTrace: null,
    repairsApplied: null,
    results: { status: 'complete', report: {} },
    hasCompletedFirstRun: true,
    // Non-warning audit signal, so the audit block renders in EVERY case and
    // the absence control below measures the warnings row, not the block.
    rawV2Response: {
      meta: { seed_used: '4242', n_samples: 1000 },
      response_hash: 'resp-hash-1',
    },
    analysisFreshness: null,
    analysisFreshnessDirty: false,
    currentScenarioId: null,
    currentStage: null,
    v5AnalysisFact: null,
    selection: { nodeIds: new Set(), edgeIds: new Set() },
  }
})

describe('ModelTabBody — inference_warnings dual read (ROADMAP 2.173)', () => {
  it('ROOT-slot warnings render the ModelHealthSection banner and the codes-only audit row', () => {
    setReport({ inference_warnings: WARNING_ITEMS })
    renderModelTab()

    // Banner: 1 ROOT_NODE_DEFAULT_VALUE item → "1 factor has no value set"
    expect(screen.getByTestId('root-node-warning')).toBeInTheDocument()
    expect(screen.getByText(/1 factor has no value set/)).toBeInTheDocument()

    // Audit row: codes only, comma-joined — never messages
    expect(screen.getByText(/Inference warnings:/)).toBeInTheDocument()
    expect(
      screen.getByText('ROOT_NODE_DEFAULT_VALUE, CONSTRAINT_TARGET_UNRELIABLE'),
    ).toBeInTheDocument()
  })

  it('LEGACY control: robustness-slot-only warnings still render both surfaces (second arm not dead)', () => {
    setReport({ robustness: { inference_warnings: WARNING_ITEMS } })
    renderModelTab()

    expect(screen.getByTestId('root-node-warning')).toBeInTheDocument()
    expect(
      screen.getByText('ROOT_NODE_DEFAULT_VALUE, CONSTRAINT_TARGET_UNRELIABLE'),
    ).toBeInTheDocument()
  })

  it('ABSENCE control: no warnings in either slot → neither surface, audit block still renders', () => {
    setReport({})
    renderModelTab()

    expect(screen.queryByTestId('root-node-warning')).not.toBeInTheDocument()
    expect(screen.queryByText(/Inference warnings:/)).not.toBeInTheDocument()
    // The audit block itself still renders off the non-warning signal —
    // adoption must not regress the current empty state.
    expect(screen.getByTestId('model-health-audit')).toBeInTheDocument()
  })
})

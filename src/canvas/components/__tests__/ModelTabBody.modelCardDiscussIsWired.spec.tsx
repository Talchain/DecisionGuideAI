/**
 * ⭐⭐ THE HOST REALLY PASSES THE HAND-OFF — not just the component accepting one.
 *
 * ── THE GAP THIS CLOSES, MEASURED ────────────────────────────────────────────
 *
 * `modelCardDiscussFrontsOlumi.spec.tsx` proves the BUTTON fronts Olumi when it is
 * given a hand-off. It renders `ModelHealthSection` directly, so it says nothing
 * about whether the product ever supplies one.
 *
 * Swept at `18110e37`: `modelcard-discuss` had ZERO references in
 * `canvas/components/__tests__/` — no host-level spec mentioned it at all. So if
 * `ModelTabBody` stopped passing `onHandOffToOlumi`, the `{onHandOffToOlumi && …}`
 * guard would take the button off screen and NOTHING would have gone red. A
 * capability silently leaving the product under a green suite is this estate's
 * most expensive recurring failure, and the guard against it cannot live in the
 * component's own spec.
 *
 * ⚠ TYPE SAFETY COVERS ONLY HALF OF IT. Passing a bare `onSendMessage` to
 * `ModelHealthSection` is now a type error, so that regression cannot compile.
 * Passing NOTHING compiles perfectly and ships a missing button — which is the
 * half a typecheck cannot see and this file does.
 *
 * ── WHY `ModelHealthSection` IS REAL HERE ────────────────────────────────────
 *
 * Every heavy sibling is stubbed EXCEPT the subject. Stubbing it is precisely how
 * this file would pass vacuously — the mock set is copied from
 * `ModelTabBody.modelCardOpen.spec.tsx`, which states the same rule.
 *
 * `revealOlumi` is mocked because it reaches into the UI store and the real DOM.
 * `createOlumiHandOff` stays REAL: the wiring is the subject, and a mocked
 * hand-off would test nothing.
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { Node } from '@xyflow/react'

let mockCanvasState: any

vi.mock('../../conversation/revealOlumi', () => ({
  revealOlumiSurface: vi.fn(() => true),
}))
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

import { revealOlumiSurface } from '../../conversation/revealOlumi'
import { ModelTabBody } from '../ModelTabBody'

const NODES: Node[] = [
  { id: 'goal-1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Goal' } },
  { id: 'fac-1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Factor' } },
]

/** The turn the model card has always sent. Asserted as a literal. */
const V1_TURN = 'Help me understand the reliability and limitations of my model'

function renderTab(onSendMessage?: (m: string, o?: { debugSource?: string }) => void) {
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
      expertMode={false}
      {...(onSendMessage ? { onSendMessage } : {})}
    />,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockCanvasState = {
    updateEdge: vi.fn(),
    ceeAnalysisReady: null,
    ceePipelineTrace: null,
    repairsApplied: null,
    results: { status: 'idle' },
    hasCompletedFirstRun: false,
    rawV2Response: null,
    analysisFreshness: null,
  }
})

describe('⭐ ModelTabBody wires the model card through the hand-off, not a bare send', () => {
  it('renders the discuss button when the tab has a conversation', () => {
    renderTab(vi.fn())

    // Bound by IDENTITY. If the host stops supplying a hand-off, the component's
    // own guard removes this button and THIS is the assertion that notices.
    expect(screen.getByTestId('modelcard-discuss')).toBeInTheDocument()
  })

  it('⚠ clicking it FRONTS Olumi before the turn leaves the host', () => {
    const onSendMessage = vi.fn(
      (_m: string, _o?: { hidden?: boolean; debugSource?: string }) => {},
    )
    renderTab(onSendMessage)

    fireEvent.click(screen.getByTestId('modelcard-discuss'))

    // The whole point of the change: the real product path fronts. Reverting
    // `ModelTabBody` to pass a bare sender cannot compile, and passing nothing
    // REDs the test above — this one pins that what IS passed actually fronts.
    expect(revealOlumiSurface).toHaveBeenCalledTimes(1)
    expect(onSendMessage).toHaveBeenCalledTimes(1)
    expect(onSendMessage).toHaveBeenCalledWith(V1_TURN, { debugSource: 'modelcard-discuss' })
  })

  /**
   * ⚠ THE DISCRIMINATING TWIN. Without it, the first test could be satisfied by a
   * button that renders unconditionally, and the guard would be proving nothing.
   * `createOlumiHandOff(undefined)` is `null`, so a tab with no conversation must
   * show no affordance at all rather than one whose turn cannot land.
   */
  it('⚠ renders NO discuss button when the tab has no conversation', () => {
    renderTab(undefined)

    expect(screen.queryByTestId('modelcard-discuss')).toBeNull()
    expect(revealOlumiSurface).not.toHaveBeenCalled()
  })

  /**
   * ⚠ AND THE CARD ITSELF IS STILL THERE IN BOTH CASES. Otherwise the twin above
   * could pass because the whole Model card vanished — a far larger regression
   * reading as a clean result. The card's own testid is the deep-link target, so
   * losing it would break more than this button.
   */
  it('⚠ the Model card mounts either way — the twin is about the BUTTON', () => {
    renderTab(undefined)
    expect(screen.getByTestId('model-health-section')).toBeInTheDocument()
  })
})

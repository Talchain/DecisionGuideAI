/**
 * ⭐ THE MOUNTED CARD SAYS "OLUMI'S ESTIMATE · YOU ACCEPTED IT" — not the reader alone (52f8cd; served witness on UI
 * `cb25e5e2`, guest `9cec5206`, 1 Oct 01:3xZ: the resolver returned AIQ's words, but `FactorNode` routed every
 * `olumi`-kind mark to `EstimateMarker`, whose fixed copy reads "Estimate not yet confirmed — this value was filled in
 * for you" over a figure the user had accepted). Bound to the component the deployment renders (CLAUDE.md §6).
 */
import { describe, it, expect, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { FactorNode } from '../FactorNode'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

/**
 * The view and run status are read at CALL time, so the design-integration
 * cases below can drive the locked Standard face after a run; every original
 * case keeps the Detailed / pre-run state it was written against.
 */
let mockViewMode: 'expert' | 'standard' = 'expert'
let mockResultsStatus: 'idle' | 'complete' = 'idle'
vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector) =>
    selector({
      hoveredOptionId: null,
      nodes: [],
      edges: [],
      ceeAnalysisReady: null,
      results: { status: mockResultsStatus, report: null },
      highlightedNodes: new Set(),
      dimmedNodeIds: new Set(),
      goalThreshold: null,
      goalConstraints: [],
      viewMode: mockViewMode,
    })
  ),
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

vi.mock('../../hooks/useScienceIcons', () => ({
  useScienceIcons: vi.fn(() => []),
}))

vi.mock('../shared/NodePopover', () => ({
  NodePopover: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="factor-node-popover">{children}</div>
  ),
}))

// `importOriginal`-spread, never a hand-listed factory: a factory REPLACES the
// module, and any export this import graph reaches would go missing.
vi.mock('../../../flags', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    isGraphBadgesEnabled: vi.fn(() => false),
    isCrossHighlightEnabled: vi.fn(() => false),
    isGraphLensEnabled: vi.fn(() => false),
  }
})

const ACCEPTED = 'Olumi\u2019s estimate \u00b7 you accepted it'
const NOT_YET = 'Estimate not yet confirmed'
const AT = '2026-10-01T00:38:30.155Z'
/** The served pair on CEE `6c5ae17` (guest `9cec5206`, run-0040Z): the adoption's review, node `ai_inferred`. */
const ADOPTED = { value: 0.04, raw_value: 2, unit: 'introductions/week', source: 'user_assumption', reviewed_by_user: { intent: 'confirm', at: AT } }
/** CONTRAST (the same served read): Olumi's estimate the user never accepted. */
const OLUMIS = { value: 0.08, raw_value: 40, unit: 'emails/week', source: 'cee_inference', extractionType: 'inferred' }

const props = (id: string, label: string, observedState: Record<string, unknown>) => ({
  id, type: 'factor', position: { x: 0, y: 0 }, selected: false, isConnectable: true, positionAbsoluteX: 0, positionAbsoluteY: 0,
  dragging: false, zIndex: 0, deletable: true, selectable: true, draggable: true,
  data: { label, kind: 'factor', provenance: 'ai_inferred', observedState },
})
const card = (id: string, label: string, observedState: Record<string, unknown>) => {
  const { container } = render(<ReactFlowProvider><FactorNode {...(props(id, label, observedState) as unknown as React.ComponentProps<typeof FactorNode>)} /></ReactFlowProvider>)
  // What the card SAYS: its text plus every accessible name (the estimate marker speaks only through `aria-label`).
  return [container.textContent ?? '', ...[...container.querySelectorAll('[aria-label]')].map((e) => e.getAttribute('aria-label') ?? '')].join(' | ')
}

describe('the mounted factor card over Olumi\u2019s accepted figure', () => {
  it('RED: says AIQ\u2019s words and never "not yet confirmed" or "filled in for you"', () => {
    const said = card('warm_introductions', 'Warm introductions', ADOPTED)
    expect(said).toContain(ACCEPTED)
    expect(said).not.toContain(NOT_YET)
    expect(said).not.toContain('filled in for you')
    expect(said).not.toContain('Your assumption')
  })

  it('CONTRAST: Olumi\u2019s unaccepted estimate keeps the estimate marker\u2019s "not yet confirmed"', () => {
    const said = card('cold_emails', 'Cold emails', OLUMIS)
    expect(said).toContain(NOT_YET)
    expect(said).not.toContain(ACCEPTED)
  })
})

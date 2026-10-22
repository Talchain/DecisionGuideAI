/**
 * ⭐ A RISK THE ENGINE GRAPH LEAVES OUT IS DRAWN WITH ONE QUIET LINE (Paul 22 Oct: draw the person's model). The card
 * `drawLivingModel` builds for it says "Not in the calculation yet", with the reason where the canvas knows one; an
 * engine risk says nothing of the kind.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})
vi.mock('../../store', () => ({ useCanvasStore: vi.fn() }))
vi.mock('../../layoutStore', () => ({
  useLayoutStore: vi.fn(((s: (x: { layoutNodeWidth: number | null }) => unknown) =>
    s({ layoutNodeWidth: null })) as unknown as (...a: never[]) => unknown),
}))
vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null, influence: null, confidence: null,
    inSensitivityAnalysis: false, achievementProbability: null, stabilityPercentage: null,
  })),
}))

import { useCanvasStore } from '../../store'
import { RiskNode } from '../RiskNode'
import { drawLivingModel, NOT_IN_CALCULATION_TEST_ID } from '../../domain/livingModelCanvas'

const baseProps = {
  selected: false, dragging: false, zIndex: 0, isConnectable: false,
  positionAbsoluteX: 0, positionAbsoluteY: 0, deletable: false, selectable: false, draggable: false,
}

/** The risk card exactly as the canvas draws it from a SYNTHETIC living model. */
function drawnRisk(risk: Record<string, unknown>) {
  const graph = { nodes: [], edges: [], living_model: { factors: [], risks: [risk], links: [] } }
  return drawLivingModel([], [], graph).nodes.find((n) => n.id === risk.id)!
}

function renderRisk(id: string, data: Record<string, unknown>) {
  vi.mocked(useCanvasStore).mockImplementation((selector) =>
    selector({
      hoveredOptionId: null, nodes: [], edges: [], ceeAnalysisReady: null,
      results: { status: 'idle', report: null },
      highlightedNodes: new Set(), dimmedNodeIds: new Set(), lens: { _dimmedNodeIds: new Set() },
      goalThreshold: null, goalConstraints: [], setHoveredOption: vi.fn(), viewMode: 'expert',
    } as never),
  )
  return render(
    <ReactFlowProvider>
      <RiskNode {...(baseProps as any)} type="risk" id={id} data={data as any} />
    </ReactFlowProvider>,
  )
}

beforeEach(() => { vi.clearAllMocks(); cleanup() })

describe('a drawn-only risk card', () => {
  it('⭐ says "Not in the calculation yet", and keeps the chance the person\'s model gives it', () => {
    const node = drawnRisk({ id: 'port_strike', label: 'Port strike', occurrence: { low: 0.1, high: 0.4, estimate_by: null }, horizon_months: 1, horizon_by: null, source: 'olumi', mitigations: [] })
    renderRisk(node.id, node.data as Record<string, unknown>)
    expect(screen.getByTestId(NOT_IN_CALCULATION_TEST_ID).textContent).toBe('Not in the calculation yet')
    expect(document.body.textContent).toContain('May happen · about 10–40% within a month')
  })

  it('⭐ names the reason where the canvas knows it: no chance given', () => {
    const node = drawnRisk({ id: 'recall', label: 'Product recall', occurrence: { low: null, high: null, estimate_by: null }, horizon_months: null, horizon_by: null, source: 'user', mitigations: [] })
    renderRisk(node.id, node.data as Record<string, unknown>)
    expect(screen.getByTestId(NOT_IN_CALCULATION_TEST_ID).textContent).toBe('Not in the calculation yet: it needs a chance of happening')
  })

  it('⛔ an engine risk card carries no such line', () => {
    renderRisk('flood', { label: 'Warehouse flood', kind: 'risk' })
    expect(screen.queryByTestId(NOT_IN_CALCULATION_TEST_ID)).toBeNull()
  })
})

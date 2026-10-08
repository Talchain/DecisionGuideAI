import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { ReactFlowProvider, type NodeProps } from '@xyflow/react'
import { RiskNode } from '../RiskNode'
import { useCanvasStore } from '../../store'
import { typography } from '../../../styles/typography'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

const makeStoreState = () => ({
  results: { status: 'idle', report: null },
  highlightedNodes: new Set(),
  dimmedNodeIds: new Set(),
  editedSinceRunNodeIds: new Set(),
  analysisHighlight: { source: null, edgeIds: new Set(), nodeIds: new Set() },
  lens: { _dimmedNodeIds: new Set(), _hiddenNodeIds: new Set(), active: 'full' },
  goalThreshold: null,
  goalConstraints: [],
  hoveredOptionId: null,
  ceeAnalysisReady: null,
  edges: [],
  nodes: [],
  viewMode: 'standard',
  lodRung: 'full',
})

vi.mock('../../store', () => ({ useCanvasStore: vi.fn() }))
vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null, influence: null, influenceProvenance: null, confidence: null,
    inSensitivityAnalysis: false, achievementProbability: null,
    achievementProbabilityIsModelledBasis: null, stabilityPercentage: null,
    winRate: null, isResultsMode: false,
  })),
}))

const FACE = "Olumi's suggestion · not in the chance"
const WHY = "Olumi added this risk to challenge your draft. It isn't in the chance until you bring it in; remove it if it doesn't fit."
const markerId = (id: string) => `risk-olumi-suggestion-${id}`

function draw(id: string, data: Record<string, unknown>) {
  const props: NodeProps = {
    id, type: 'risk', selected: false, isConnectable: true,
    draggable: true, selectable: true, deletable: true,
    positionAbsoluteX: 0, positionAbsoluteY: 0, dragging: false, zIndex: 0,
    data: { label: 'Customers may resist the price rise', type: 'risk', ...data },
  }
  return render(<ReactFlowProvider><RiskNode {...props} /></ReactFlowProvider>)
}

function expectAbsent(id: string) {
  expect(screen.queryByTestId(markerId(id))).toBeNull()
  expect(screen.queryByText(FACE, { exact: true })).toBeNull()
  expect(screen.queryByText(WHY, { exact: true })).toBeNull()
}

describe('RiskNode Olumi suggestion marker', () => {
  beforeEach(() => {
    cleanup()
    vi.mocked(useCanvasStore).mockImplementation(selector => selector(makeStoreState() as never))
  })

  it('row 1: marks an Olumi risk retained outside analysis with the exact face and accessible why', () => {
    draw('olumi-risk', { proposed_by: 'olumi', analysis_participation: 'retained_excluded' })
    const marker = screen.getByTestId(markerId('olumi-risk'))
    const face = within(marker).getByText(FACE, { exact: true })
    expect(face.getAttribute('aria-hidden')).toBe('true')
    const why = within(marker).getByText(WHY, { exact: true })
    expect(why.className).toBe(typography.screenReaderOnly)
    expect(marker.getAttribute('title')).toBe(WHY)
    expect(marker.className).toContain('text-text-light')
    // Its own line, never inside the one-line h-[1lh] exposure box (two items there overflow a compact card).
    expect(marker.parentElement?.className ?? '').not.toContain('h-[1lh]')
    expect(screen.getByTestId('risk-exposure-unset').closest('[data-card-bottom-band]'))
      .toBe(screen.getByTestId('risk-bottom-marks-olumi-risk'))
  })

  it('row 2: CONTRAST — a user risk has no marker even when retained outside analysis', () => {
    draw('user-risk', { analysis_participation: 'retained_excluded' })
    expectAbsent('user-risk')
  })

  it('row 3: CONTRAST — an Olumi risk brought into analysis has no marker', () => {
    draw('included-risk', { proposed_by: 'olumi', analysis_participation: 'included' })
    expectAbsent('included-risk')
  })

  it('row 4: CONTRAST — Olumi authorship without a participation stamp licenses no marker', () => {
    draw('unstamped-risk', { proposed_by: 'olumi' })
    expectAbsent('unstamped-risk')
  })
})

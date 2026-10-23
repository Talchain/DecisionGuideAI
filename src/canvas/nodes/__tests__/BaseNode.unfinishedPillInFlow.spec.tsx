/**
 * The retained-exclusion sentence sits in the card's own state row, full card width, never in the bottom band.
 * The band is `absolute bottom-1.5 left-3` and shrink-to-fit, so a wrapping sentence there broke word by word and was
 * drawn over the card's value, "What has to be true?" and chance lines (hiring board, 23 Oct 2026). jsdom has no
 * layout, so this pins the DOM home; the pixel overlap is measured in the geometry A/B on the hiring board.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ReactFlowProvider, type NodeProps } from '@xyflow/react'
import type { ComponentType } from 'react'
import { FactorNode } from '../FactorNode'
import { OptionNode } from '../OptionNode'
import { ActionNode } from '../ActionNode'
import { useCanvasStore } from '../../store'

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

const SENTENCE = 'Unfinished — not included in analysis.'

function draw(Node: ComponentType<NodeProps>, id: string, type: string, data: Record<string, unknown>) {
  const props = {
    id, type, selected: false, isConnectable: true,
    draggable: true, selectable: true, deletable: true,
    positionAbsoluteX: 0, positionAbsoluteY: 0, dragging: false, zIndex: 0,
    data: { label: `A ${type} card`, type, analysis_participation: 'retained_excluded', ...data },
  } as NodeProps
  return render(<ReactFlowProvider><Node {...props} /></ReactFlowProvider>)
}

const cases: Array<[string, ComponentType<NodeProps>, string, Record<string, unknown>]> = [
  ['factor', FactorNode as ComponentType<NodeProps>, 'f1', { value: 6 }],
  ['option', OptionNode as ComponentType<NodeProps>, 'o1', {}],
  ['action', ActionNode as ComponentType<NodeProps>, 'a1', { subtype: 'assumption' }],
]

describe('retained-exclusion pill: its own full-width row, never the bottom band', () => {
  beforeEach(() => {
    cleanup()
    vi.mocked(useCanvasStore).mockImplementation(selector => selector(makeStoreState() as never))
  })

  it.each(cases)('%s card: the whole sentence, in the state row, outside the band', (_type, Node, id, data) => {
    draw(Node, id, _type, data)
    const pill = screen.getByTestId('unfinished-contribution-pill')
    expect(pill.textContent).toBe(SENTENCE)
    expect(pill.getAttribute('title')).toBe(SENTENCE)
    expect(pill.parentElement?.getAttribute('data-testid')).toBe(`node-state-row-${id}`)
    expect(pill.closest('[data-card-bottom-band]')).toBeNull()
  })
})

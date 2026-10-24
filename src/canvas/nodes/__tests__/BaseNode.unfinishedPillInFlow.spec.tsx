/**
 * Paul (24 Oct): "Unfinished" is an icon, not words. A retained exclusion draws the circle-slash card mark in the
 * card's bottom marks band, muted, with the founder's ruled sentence whole as its tooltip and accessible name, and no
 * visible words anywhere on the card. (Before: the sentence sat in the card's state row, full width, after it was
 * drawn over the card's text in the bottom band on the hiring board, 23 Oct 2026. An icon is one row tall, so the band
 * is its home again.)
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

describe('retained-exclusion mark: the circle-slash icon in the bottom band, its sentence only on hover', () => {
  beforeEach(() => {
    cleanup()
    vi.mocked(useCanvasStore).mockImplementation(selector => selector(makeStoreState() as never))
  })

  it.each(cases)('%s card: the icon in the band, the whole sentence as its name, no words on the card', (_type, Node, id, data) => {
    const { container } = draw(Node, id, _type, data)
    const mark = screen.getByTestId('unfinished-contribution-pill')
    expect(mark.textContent).toBe('')
    expect(mark.getAttribute('data-card-mark')).toBe('not-analysed')
    expect(mark.querySelector('svg.lucide-circle-slash')).not.toBeNull()
    expect(mark.getAttribute('aria-label')).toBe(SENTENCE)
    expect(mark.getAttribute('role')).toBe('img')
    expect(mark.getAttribute('tabindex')).toBe('0')
    expect(mark.className).toContain('text-text-light')
    expect(mark.className).not.toContain('text-text-body')
    expect(mark.closest('[data-card-bottom-band]')).not.toBeNull()
    expect(container.textContent).not.toContain('Unfinished')
    // The claim still outranks "Needs input": no state row is drawn for it.
    expect(screen.queryByTestId(`node-state-row-${id}`)).toBeNull()
  })

  it('an included card draws no mark (contrast)', () => {
    draw(FactorNode as ComponentType<NodeProps>, 'f2', 'factor', { value: 6, analysis_participation: 'included' })
    expect(screen.queryByTestId('unfinished-contribution-pill')).toBeNull()
  })
})

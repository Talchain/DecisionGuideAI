/**
 * ⭐⭐ THE EVIDENCE LENS MUST NOT SAY IT IN COLOUR ALONE.
 *
 * `evidenceBgStyle` tints the card by `evidenceClass` and that fill was the only
 * carrier of the claim — so a reader with a colour-vision deficiency saw three
 * tinted cards and was told nothing, on the one lens whose whole purpose is
 * "which of these numbers do we actually know?".
 *
 * ⚠ jsdom cannot prove the word is VISIBLE (trap 3). It proves the word is
 * RENDERED and bound to the producer-derived class — which is what a mutant
 * dropping the second channel would break.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { FactorNode } from '../FactorNode'
import { useCanvasStore } from '../../store'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})
vi.mock('../../../flags', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, isGraphLensEnabled: () => true }
})

const ID = 'fac_1'
const state = (cls: string | null, active = 'evidence') => ({
  selectedNodeId: null, hoveredOptionId: null, nodes: [], edges: [],
  ceeAnalysisReady: null, results: { status: 'complete', report: null },
  highlightedNodes: new Set(), dimmedNodeIds: new Set(), editedSinceRunNodeIds: new Set(),
  analysisHighlight: { source: null, edgeIds: new Set(), nodeIds: new Set() },
  lens: {
    active, _dimmedNodeIds: new Set(), _hiddenNodeIds: new Set(),
    _evidenceNodeClass: cls ? new Map([[ID, cls]]) : new Map(),
  },
  goalThreshold: null, goalConstraints: [], viewMode: 'standard', lodRung: 'full',
})

vi.mock('../../store', () => ({ useCanvasStore: vi.fn((s) => s(state('grounded'))) }))

const props = {
  type: 'factor', position: { x: 0, y: 0 }, selected: false, isConnectable: true,
  positionAbsoluteX: 0, positionAbsoluteY: 0, dragging: false, zIndex: 0,
  deletable: true, selectable: true, draggable: true, width: 240, height: 100,
  sourcePosition: undefined, targetPosition: undefined,
}

function renderAt(cls: string | null, active = 'evidence') {
  vi.mocked(useCanvasStore).mockImplementation((sel) => (sel as (s: unknown) => unknown)(state(cls, active) as never))
  const r = render(
    <ReactFlowProvider>
      <FactorNode {...props} id={ID} data={{ label: 'Churn', kind: 'factor', category: 'external' }} />
    </ReactFlowProvider>,
  )
  // Positive control: the card mounted before any absence is asserted (trap 13).
  expect(screen.getByTestId('node-title'), 'the card did not mount').toBeTruthy()
  return r
}

describe('the evidence lens says it in words, not only in colour', () => {
  it('⭐ grounded reads "From your data"', () => {
    renderAt('grounded')
    expect(screen.getByTestId('evidence-lens-class').textContent).toBe('From your data')
  })

  it('⭐ assumed reads "Assumed"', () => {
    renderAt('assumed')
    expect(screen.getByTestId('evidence-lens-class').textContent).toBe('Assumed')
  })

  it('⭐ none reads "No data"', () => {
    renderAt('none')
    expect(screen.getByTestId('evidence-lens-class').textContent).toBe('No data')
  })

  /**
   * ⛔ CONTRAST ONE — `na` is "we were not told", and an absence must not be
   * rendered as one of the three verdicts.
   */
  it('⛔ CONTRAST: `na` says nothing at all', () => {
    renderAt('na')
    expect(screen.queryByTestId('evidence-lens-class')).toBeNull()
  })

  /**
   * ⛔ CONTRAST TWO — without it, a word printed unconditionally passes every
   * row above, and every card on every lens would carry an evidence claim.
   */
  it('⛔ CONTRAST: no word outside the evidence lens', () => {
    renderAt('grounded', 'full')
    expect(screen.queryByTestId('evidence-lens-class')).toBeNull()
  })
})

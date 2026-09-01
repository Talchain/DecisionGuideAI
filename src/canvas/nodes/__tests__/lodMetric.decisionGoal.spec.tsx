/**
 * The anchor of the model says something when it is too small to say anything else.
 *
 * ⭐ THE DEFECT, REPORTED BY PAUL THREE TIMES AND MEASURED ON DEPLOYED `7d717c13`.
 * Below the legibility floor the decision card rendered as an empty box carrying
 * only its title. Its body was not missing — `textContent` held "Segment leads in
 * 48% of scenarios, but sensitive to Operational Overhead…" — it was
 * `visibility: hidden`, with NOTHING put in its place, because `lodMetricLine.ts`
 * scoped `decision` and `goal` out on the grounds that neither has a single
 * headline quantity. True premise, wrong conclusion: every other node type got a
 * line and the one a reader looks at first got none.
 *
 * ⛔ WHAT THIS FILE IS REALLY GUARDING is not "a line appears" but "a leader is
 * named only where the card was already entitled to name one". The reduced line
 * reads `headline`, the same permission the full-zoom body consumes. A run whose
 * verdict WITHHOLDS a leader must produce no leader here either — this product
 * has already shipped a withheld verdict and a named leader two pixels apart
 * (CLAUDE.md trap 21), and a low-zoom line is the easiest place to reopen it,
 * because the body it would contradict is hidden.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { DecisionNode } from '../DecisionNode'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

const OPTION = { id: 'opt-1', type: 'option', data: { type: 'option', label: 'Segment' } }

const makeStoreState = (o: Record<string, unknown> = {}) => ({
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
  lodActive: true,
  ...o,
})

vi.mock('../../store', () => ({ useCanvasStore: vi.fn((s: any) => s(makeStoreState())) }))
vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null, influence: null, influenceProvenance: null, confidence: null,
    inSensitivityAnalysis: false, achievementProbability: null,
    achievementProbabilityIsModelledBasis: null, stabilityPercentage: null,
    winRate: null, isResultsMode: false,
  })),
}))

import { useCanvasStore } from '../../store'

const baseProps = {
  id: 'dec-1', type: 'decision', position: { x: 0, y: 0 }, selected: false,
  isConnectable: true, positionAbsoluteX: 0, positionAbsoluteY: 0, dragging: false, zIndex: 0,
}

const renderDecision = (state: Record<string, unknown>) => {
  vi.mocked(useCanvasStore).mockImplementation((sel: any) => sel(makeStoreState(state) as any))
  return render(
    <ReactFlowProvider>
      <DecisionNode {...(baseProps as any)} data={{ label: 'Decision', type: 'decision' }} />
    </ReactFlowProvider>,
  )
}

const lodLine = () => screen.queryByTestId('node-lod-line')?.textContent ?? null

describe('the decision card is never an empty box at low zoom', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('with no options linked it states what is absent, not nothing', () => {
    renderDecision({ nodes: [], edges: [] })
    expect(lodLine()).toBe('No options linked yet')
  })

  it('CONTRAST CONTROL — above the floor there is no reduced line at all, so this is a ZOOM behaviour and not a second body', () => {
    renderDecision({ nodes: [], edges: [], lodActive: false })
    expect(lodLine()).toBeNull()
  })

  it('and it never renders as only its title — the state that was reported three times', () => {
    const { container } = renderDecision({ nodes: [], edges: [] })
    const visible = container.querySelector('[data-testid="node-lod-line"]')
    expect(visible).not.toBeNull()
    expect(visible!.textContent!.trim().length).toBeGreaterThan(0)
  })
})

describe('⛔ a leader is named only where the card may name one', () => {
  beforeEach(() => { vi.clearAllMocks() })

  /*
   * THE DISCRIMINATING PAIR. Same completed run, same option set. The only
   * difference is whether the report entitles the card to name a leader. If the
   * line were composed from the option list rather than from `headline`, BOTH
   * would name Segment — which is exactly the defect this pair exists to catch.
   */
  it('does NOT name one when the run withheld its verdict', () => {
    renderDecision({
      nodes: [OPTION],
      results: { status: 'complete', report: { option_probabilities: {} } },
    })
    const line = lodLine()
    expect(line).not.toBeNull()
    expect(line).not.toContain('Segment')
  })

  it('and says nothing about the analysis in that state — no invented verdict', () => {
    renderDecision({
      nodes: [OPTION],
      results: { status: 'complete', report: { option_probabilities: {} } },
    })
    const line = (lodLine() ?? '').toLowerCase()
    expect(line).not.toMatch(/lead|ahead|close|tie|winner|too close/)
  })
})

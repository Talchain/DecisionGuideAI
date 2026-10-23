/**
 * The Question node remains structural at reduced zoom. Tests mount the real
 * BaseNode and read its reduced line, so a duplicate verdict cannot survive in
 * the LOD prop while tests inspect only the normal-sized body.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { DecisionNode, DECISION_RESTING_COPY } from '../DecisionNode'
import { deriveDecisionVerdict } from '../../../lib/decisionVerdict'
import {
  LEADER_ID, LEADER_LABEL, RUNNER_UP_ID, RUNNER_UP_LABEL,
  PERMITTED_REPORT, WITHHELD_REPORT,
} from '../../../lib/__fixtures__/ownedLeaderClaim.fixtures'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

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
  lodRung: 'line',
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

const renderDecision = (state: Record<string, unknown>, label = 'Decision') => {
  vi.mocked(useCanvasStore).mockImplementation((sel: any) => sel(makeStoreState(state) as any))
  return render(
    <ReactFlowProvider>
      <DecisionNode {...(baseProps as any)} data={{ label, type: 'decision' }} />
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
    renderDecision({ nodes: [], edges: [], lodRung: 'full' })
    expect(lodLine()).toBeNull()
  })

  it('and it never renders as only its title — the state that was reported three times', () => {
    const { container } = renderDecision({ nodes: [], edges: [] })
    const visible = container.querySelector('[data-testid="node-lod-line"]')
    expect(visible).not.toBeNull()
    expect(visible!.textContent!.trim().length).toBeGreaterThan(0)
  })
})

const CLAIM_OPTIONS = [
  { id: LEADER_ID, type: 'option', data: { type: 'option', label: LEADER_LABEL } },
  { id: RUNNER_UP_ID, type: 'option', data: { type: 'option', label: RUNNER_UP_LABEL } },
  { id: 'opt_status_quo', type: 'option', data: { type: 'option', label: 'Keep the current laptops' } },
]
const CLAIM_EDGES = CLAIM_OPTIONS.map(node => ({
  id: `dec-${node.id}`, source: 'dec-1', target: node.id,
}))

describe('a completed run does not turn the Question node into an option verdict at low zoom', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('uses a genuinely permitted result as its regression control', () => {
    const options = { visibleOptionIds: new Set(CLAIM_OPTIONS.map(node => node.id)) }
    const permitted = deriveDecisionVerdict(PERMITTED_REPORT, options)
    expect(permitted.hasLeadingOption).toBe(true)
    expect(permitted.leaderId).toBe(LEADER_ID)
    expect(deriveDecisionVerdict(WITHHELD_REPORT, options).hasLeadingOption).toBe(false)
  })

  it.each([
    { name: 'permitted comparison', report: PERMITTED_REPORT, mode: 'comparative_leader' },
    { name: 'model refuses comparison', report: PERMITTED_REPORT, mode: 'none' },
    { name: 'result withholds a leader', report: WITHHELD_REPORT, mode: 'comparative_leader' },
    { name: 'admission absent', report: PERMITTED_REPORT, mode: undefined },
    { name: 'report absent', report: null, mode: undefined },
  ])('$name: shows linked options, not their result', ({ report, mode }) => {
    renderDecision({
      nodes: CLAIM_OPTIONS,
      edges: CLAIM_EDGES,
      ceeAnalysisReady: mode ? {
        status: 'ready', options: [], goal_node_id: 'goal-1',
        analysis_admission: {
          permitted_analysis_mode: mode,
          reasons: mode === 'none' ? [{ field: 'evidence', message: 'More evidence needed.' }] : [],
        },
      } : null,
      results: { status: 'complete', report },
    })
    const line = lodLine()
    expect(line).toBe('3 options')
    expect(line).not.toContain(LEADER_LABEL)
    expect(line).not.toContain('%')
  })

  it('keeps the authoring prompt when the question is unnamed', () => {
    renderDecision({
      nodes: CLAIM_OPTIONS, edges: CLAIM_EDGES,
      results: { status: 'complete', report: PERMITTED_REPORT },
    }, '')
    expect(lodLine()).toBe(DECISION_RESTING_COPY.unnamedLine)
  })
})

/**
 * ⭐⭐ THE SENTENCE THAT WAS THE SAME ON EVERY MODEL.
 *
 * Measured in a real browser (`e2e/geometry/zoomLadder.measure.ts`, 1 Sep 2026)
 * across all five committed starter drafts at 1280x800 and 1440x900: at the
 * zoom "Show whole model" parks at, the anchor card's one line read
 * `Nothing to show on this node` in **10 of 10** readings.
 *
 * Paul's canvas-density ruling (31 Aug) is that copy identical on every card is
 * furniture, not information. This was worse than furniture: the anchor of the
 * model announcing it has nothing on it, while holding three or four linked
 * options and knowing the number.
 */
const OPTIONS_3 = [
  { id: 'opt-1', type: 'option', data: { type: 'option', label: 'Segment' } },
  { id: 'opt-2', type: 'option', data: { type: 'option', label: 'Hold' } },
  { id: 'opt-3', type: 'option', data: { type: 'option', label: 'Partner' } },
]
const EDGES_3 = [
  { id: 'e1', source: 'dec-1', target: 'opt-1' },
  { id: 'e2', source: 'dec-1', target: 'opt-2' },
  { id: 'e3', source: 'dec-1', target: 'opt-3' },
]

describe('the anchor states what it holds, not that it holds nothing', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('states the option count it already knows', () => {
    renderDecision({ nodes: OPTIONS_3, edges: EDGES_3 })
    expect(lodLine()).toBe('3 options')
  })

  /**
   * THE REGRESSION PIN. Bound to the EXACT string, because the defect was a
   * specific sentence and "the line is non-empty" was already true while it was
   * on screen — the previous describe's last test passes on the defect.
   */
  it('and never the sentence that was identical on every model', () => {
    renderDecision({ nodes: OPTIONS_3, edges: EDGES_3 })
    expect(lodLine()).not.toBe('Nothing to show on this node')
  })

  /**
   * THE DISCRIMINATING TWIN (CLAUDE.md trap 19). A line composed from anything
   * other than THIS decision's own option edges would answer identically for
   * both models. Changing only the number of linked options must change only
   * the number — so the line is provably reading the count and not a constant.
   */
  it('DISCRIMINATION — a different number of options produces a different line', () => {
    renderDecision({ nodes: OPTIONS_3.slice(0, 2), edges: EDGES_3.slice(0, 2) })
    expect(lodLine()).toBe('2 options')
  })

  it('and the singular is not a plural with an s bolted on', () => {
    renderDecision({ nodes: OPTIONS_3.slice(0, 1), edges: EDGES_3.slice(0, 1) })
    expect(lodLine()).toBe('1 option')
  })

  /**
   * ⛔ THE OPPOSITE-DIRECTION TWIN (trap 22b). The count arm must NOT eat the
   * arms either side of it. `optionCount === 0` belongs to `noOptionsLine`,
   * which carries a CTA — replacing it with `0 options` would delete a working
   * affordance and state a number as if it were a finding.
   */
  it('CONTRAST — with no options linked the CTA line still wins, not "0 options"', () => {
    renderDecision({ nodes: [], edges: [] })
    expect(lodLine()).toBe('No options linked yet')
  })

  it('on a completed run the count still reflects only the linked options', () => {
    renderDecision({
      nodes: CLAIM_OPTIONS,
      edges: CLAIM_EDGES.slice(0, 1),
      results: { status: 'complete', report: PERMITTED_REPORT },
    })
    expect(lodLine()).toBe('1 option')
  })
})

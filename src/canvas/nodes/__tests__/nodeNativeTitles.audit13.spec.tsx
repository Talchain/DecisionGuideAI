/**
 * ⭐ ONE TOOLTIP SYSTEM ON CARDS, AND NO INSTRUCTION CHROME (design audit #13, 26 Sep 2026).
 *
 * Served on UI `853feeb7` at 1280×800, the five starter boards carried 94 / 104 /
 * 106 / 107 / 89 `[title]` attributes inside `.react-flow__node`. Of those, 17 /
 * 17 / 16 / 17 / 14 were NON-EMPTY native tooltips beside the styled one. On
 * pricing they were:
 *   · "Click to edit" on each factor value (`node-value-editor-*`);
 *   · "Outside your control" on each external factor card (the group);
 *   · "Likelihood and impact not set yet" on each risk (`risk-exposure-unset`),
 *     the visible line repeated;
 *   · "Outcome not quantified" on each outcome (`outcome-unquantified`), the
 *     visible line repeated;
 *   · the goal's target route, and the option change rows (other lane).
 * The rest were EMPTY `title=""` blockers that `components/Tooltip.tsx` sets on
 * every `asChild` reference; they show nothing.
 *
 * And hovering an option title showed the styled tooltip "Hybrid Platform Fee
 * Plus Usage / Double-click to rename it" (201.9×52.8): an instruction on a
 * card. The inspector's title is already the rename control (`EditableLabel`),
 * so the hover hint goes. The screen-reader name keeps it.
 *
 * CLAIM TYPE: jsdom DOM, by testid and exact text. The served strings are the
 * fixtures.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import { ReactFlowProvider, type NodeProps } from '@xyflow/react'
import { Target } from 'lucide-react'
import { BaseNode } from '../BaseNode'
import { OutcomeNode } from '../OutcomeNode'
import { RiskNode } from '../RiskNode'
import { NodeValueEditor } from '../shared/NodeValueEditor'
import { NODE_RENAME_AFFORDANCE } from '../shared/nodeRenameAffordance'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null, useUpdateNodeInternals: () => vi.fn() }
})

const storeState = {
  results: { status: 'idle', report: null },
  highlightedNodes: new Set(),
  dimmedNodeIds: new Set(),
  lens: { _dimmedNodeIds: new Set() },
  goalThreshold: null,
  goalConstraints: [],
  edges: [],
  nodes: [],
  viewMode: 'standard',
  editedSinceRunNodeIds: new Set(),
  analysisHighlight: { source: null, edgeIds: new Set(), nodeIds: new Set() },
  hoveredOptionId: null,
  ceeAnalysisReady: null,
  lodRung: 'full',
}

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector) => selector(storeState)),
}))

vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null, influence: null, confidence: null, inSensitivityAnalysis: false,
    achievementProbability: null, stabilityPercentage: null, winRate: null, isResultsMode: false,
    predictedOutcome: null, valueOfInformation: null, voiRank: null,
  })),
}))

const baseProps = {
  selected: false, dragging: false, zIndex: 0, isConnectable: true,
  positionAbsoluteX: 0, positionAbsoluteY: 0, xPos: 0, yPos: 0,
  deletable: true, selectable: true, draggable: true,
}

/** The served option name the audit hovered (pricing, `opt_hybrid`). */
const SERVED_OPTION = 'Hybrid Platform Fee Plus Usage'
const KINDS = ['decision', 'goal', 'option', 'factor', 'outcome', 'risk'] as const

afterEach(() => cleanup())

describe('audit #13: a card name\'s hover shows the name only, in the one styled tooltip', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  for (const kind of KINDS) {
    it(`${kind}: the tooltip reads exactly the name; no "${NODE_RENAME_AFFORDANCE}"`, () => {
      const { container } = render(
        <BaseNode {...baseProps} id="opt_hybrid" type={kind} data={{ label: SERVED_OPTION }} nodeType={kind} icon={Target} />,
      )
      const title = container.querySelector('[data-testid="node-title"]') as HTMLElement
      act(() => {
        fireEvent.mouseEnter(title)
        vi.advanceTimersByTime(400)
      })
      const tip = document.querySelector('[data-testid="node-title-tooltip-name"]')?.closest('[role="tooltip"]')
      expect(tip?.textContent).toBe(SERVED_OPTION)
      expect(document.querySelector('[data-testid="node-title-tooltip-affordance"]')).toBeNull()
      // CONTRAST: the screen-reader name still says what a double-click does.
      expect(container.querySelector('[role="group"]')?.getAttribute('aria-label') ?? '').toContain(NODE_RENAME_AFFORDANCE)
    })
  }
})

describe('audit #13: no native title on the card internals the served boards showed', () => {
  it('a factor value: no "Click to edit" title; the accessible name still says it edits', () => {
    render(
      <NodeValueEditor
        value={0.8}
        readout="Very high"
        onCommit={vi.fn(() => 'dispatched' as const)}
        ariaLabel="Value for Bottom-Up Adoption Friction"
        testId="node-value-editor-fac_adoption_friction"
      />,
    )
    const button = screen.getByTestId('node-value-editor-fac_adoption_friction')
    expect(button.hasAttribute('title')).toBe(false)
    expect(button.getAttribute('aria-label')).toBe('Value for Bottom-Up Adoption Friction — click to edit')
  })

  it('an external factor card: no "Outside your control" title on the group; it is its accessible description', () => {
    render(
      <BaseNode
        {...baseProps}
        id="fac_market_competition"
        type="factor"
        data={{ label: 'Competitive Pressure for Usage Pricing', category: 'external' }}
        nodeType="factor"
        icon={Target}
      />,
    )
    const group = screen.getByRole('group')
    expect(group.hasAttribute('title')).toBe(false)
    expect(group.getAttribute('aria-description')).toBe('Outside your control')
  })

  it('CONTROL: a controllable factor card carries no such description', () => {
    render(
      <BaseNode {...baseProps} id="fac_adoption_friction" type="factor" data={{ label: 'Bottom-Up Adoption Friction' }} nodeType="factor" icon={Target} />,
    )
    expect(screen.getByRole('group').hasAttribute('aria-description')).toBe(false)
  })

  it('an unquantified outcome: the visible line, with no native title repeating it', () => {
    render(
      <ReactFlowProvider>
        <OutcomeNode {...(baseProps as unknown as NodeProps)} id="out_1" type="outcome" data={{ label: 'Net revenue retention', type: 'outcome' }} />
      </ReactFlowProvider>,
    )
    const line = screen.getByTestId('outcome-unquantified')
    expect(line.querySelector('[aria-hidden="true"]')?.textContent).toBe('Outcome not quantified')
    expect(line.hasAttribute('title')).toBe(false)
  })

  it('an unset risk: the visible line, with no native title repeating it', () => {
    render(
      <ReactFlowProvider>
        <RiskNode {...(baseProps as unknown as NodeProps)} id="risk_1" type="risk" data={{ label: 'Enterprise churn', type: 'risk' }} />
      </ReactFlowProvider>,
    )
    const line = screen.getByTestId('risk-exposure-unset')
    expect(line.querySelector('[aria-hidden="true"]')?.textContent).toBe('Likelihood and impact not set yet')
    expect(line.hasAttribute('title')).toBe(false)
  })
})

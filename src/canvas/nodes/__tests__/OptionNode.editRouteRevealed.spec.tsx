/**
 * ⭐ DESIGN-GAP ROW 20 — the OPTION half: "The option pencil is not
 * hover-revealed" (audit 24 Sep, `OptionNode.tsx` with `NodeRailIcons.tsx`:
 * `reveal` defaulted to false, so the pencil was a RESTING icon).
 *
 * Contract v3 §02 draws the edit route as `tooltipButton('edit', …, 'revealed')`
 * — `.icon-btn.revealed{opacity:0;pointer-events:none}` with
 * `.node:hover/.node:focus-within .icon-btn.revealed{opacity:1;pointer-events:auto}`
 * — and only `&&!n.baseline`. `NodeRailIcon`'s `reveal` prop is exactly that
 * rule (contract v3.1 OPT-02 / ICON-03); the option card simply never passed it.
 *
 * Pinned here:
 *  1. The option's edit route is REVEALED (hover/focus/touch), not resting.
 *  2. It is the card's ONE edit route: the shared rail (`NodeQuickActions`)
 *     draws no second pencil on an option.
 *  3. The baseline option gets none (the contract's `!n.baseline`) — with the
 *     non-baseline render as the present control.
 *
 * Harness: `OptionNode.factorTargetsAreReachable.spec.tsx`'s selector-mocked
 * store, unchanged in shape. jsdom proves classes, never pixels (trap 3).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { OptionNode, OPTION_TARGETS_ROUTE_IS_LIVE } from '../OptionNode'
import { NODE_RAIL_REVEAL_CLASSES } from '../shared/NodeRailIcons'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

const openNodeInspector = vi.fn((_nodeId: string) => true)
vi.mock('../shared/openNodeInspector', () => ({
  OPEN_FULL_INSPECTOR_EVENT: 'open-full-inspector',
  openNodeInspector: (...args: unknown[]) => openNodeInspector(...(args as [string])),
}))

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn(),
}))
vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(),
}))

import { useCanvasStore } from '../../store'
import { useNodeDisplayMetadata } from '../../hooks/useNodeDisplayMetadata'

const OPTION_ID = 'opt_hybrid'
const NODES = [
  { id: OPTION_ID, type: 'option', data: { label: 'Hybrid Platform Fee Plus Usage', type: 'option' } },
  { id: 'fac_usage_exposure', type: 'factor', data: { label: 'Usage-Based Pricing Exposure', type: 'factor' } },
]
const EDGES = [{ id: 'e1', source: OPTION_ID, target: 'fac_usage_exposure' }]
const CEE = { options: [{ id: OPTION_ID, interventions: { fac_usage_exposure: 0.6 } }] }

const baseProps = {
  id: OPTION_ID,
  type: 'option',
  position: { x: 0, y: 0 },
  selected: false,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  dragging: false,
  zIndex: 0,
  deletable: true,
  selectable: true,
  draggable: true,
}

function renderCard(dataOverride?: Record<string, unknown>) {
  vi.mocked(useNodeDisplayMetadata).mockReturnValue({
    sensitivityRank: null, influence: null, confidence: null,
    inSensitivityAnalysis: false, achievementProbability: null,
    stabilityPercentage: null, winRate: null, isResultsMode: false,
    predictedOutcome: null, valueOfInformation: null, voiRank: null,
  } as never)
  vi.mocked(useCanvasStore).mockImplementation((selector) =>
    selector({
      hoveredOptionId: null,
      nodes: NODES,
      edges: EDGES,
      ceeAnalysisReady: CEE,
      results: { status: 'idle', report: null },
      highlightedNodes: new Set(),
      dimmedNodeIds: new Set(),
      lens: { _dimmedNodeIds: new Set(), _hiddenNodeIds: new Set(), active: 'full' },
      goalThreshold: 0.6,
      goalConstraints: [],
      setHoveredOption: vi.fn(),
      runMeta: { ceeReview: null },
      viewMode: 'standard',
      lodRung: 'full',
    } as never),
  )
  const { container } = render(
    <ReactFlowProvider>
      <OptionNode {...baseProps} data={{ ...NODES[0].data, ...(dataOverride ?? {}) }} />
    </ReactFlowProvider>,
  )
  // Positive control: the card mounted, so a null below is an absence.
  expect(container.querySelector('[data-testid="node-title"]'), 'the card did not mount').not.toBeNull()
  // …and so did its rail, so an absent pencil is not an absent rail.
  expect(container.querySelector(`[data-testid="node-card-rail-${OPTION_ID}"]`), 'the rail did not mount').not.toBeNull()
  return container
}

const tokens = (el: Element | null) => (el?.getAttribute('class') ?? '').split(/\s+/).filter(Boolean)
const pencil = (c: Element) => c.querySelector(`[data-testid="option-edit-targets-${OPTION_ID}"]`)

describe('row 20 — the option\'s edit route is revealed on hover/focus, once, and never on the baseline', () => {
  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('precondition: the carrier is live at this tip, so the route is expected to render', () => {
    // If this ever flips, every "present" assertion below is vacuous — stop here.
    expect(OPTION_TARGETS_ROUTE_IS_LIVE).toBe(true)
  })

  it('the pencil is a REVEALED rail icon (contract `.icon-btn.revealed`), not a resting one', () => {
    const c = renderCard()
    const btn = pencil(c)
    expect(btn, 'the option edit route must render').not.toBeNull()
    expect(btn!.getAttribute('data-rail-reveal')).toBe('true')
    const t = tokens(btn)
    for (const cls of NODE_RAIL_REVEAL_CLASSES.split(/\s+/).filter(Boolean)) expect(t).toContain(cls)
    // Hidden at rest by opacity only — still in the tab order and the a11y tree.
    expect(btn!.getAttribute('tabindex')).toBeNull()
    expect(btn!.getAttribute('aria-hidden')).toBeNull()
  })

  it('it still opens THIS option\'s existing editor (the inspector), bound by id', () => {
    const c = renderCard()
    ;(pencil(c) as HTMLButtonElement).click()
    expect(openNodeInspector).toHaveBeenCalledTimes(1)
    expect(openNodeInspector).toHaveBeenCalledWith(OPTION_ID)
  })

  it('ONE edit route on the card: the shared rail draws no second pencil on an option', () => {
    const c = renderCard()
    expect(c.querySelector(`[data-testid="node-action-edit-${OPTION_ID}"]`)).toBeNull()
    const rail = c.querySelector(`[data-testid="node-card-rail-${OPTION_ID}"]`)!
    expect(rail.querySelectorAll('svg.lucide-pencil')).toHaveLength(1)
  })

  it('the baseline option gets no edit route (contract `&&!n.baseline`) — control: the rail is mounted', () => {
    const c = renderCard({ is_baseline: true })
    expect(pencil(c)).toBeNull()
    expect(c.querySelector(`[data-testid="node-action-edit-${OPTION_ID}"]`)).toBeNull()
    expect(c.querySelector(`[data-testid="node-action-menu-${OPTION_ID}"]`)).not.toBeNull()
  })
})

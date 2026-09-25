/**
 * ⭐ REAL-INTERACTION CONTROL for Codex CR 5810966650 (#1932, 24 Sep 2026): on
 * TOUCH, tapping `+N more` must reach the inspector. The bounded anatomy (ED
 * 5809278282) had moved `+N more` into the portalled popover, where
 * `usePopoverHover`'s outside-tap close fired first. Paul (25 Sep) put the rows
 * and `+N more` back ON THE CARD (the prototype), so the tap now lands on the
 * card itself — this pins that a single tap, with no preview opened first,
 * still reaches THIS option's inspector, and that the control is not in the
 * popover.
 *
 * Real `OptionNode`, real `NodePopover` (NOT mocked), emulated `(hover: none)`.
 * Pre-run and post-run. jsdom has no layout: this pins the event protocol, not
 * a pixel.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, act, waitFor } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { OptionNode } from '../OptionNode'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

// ⭐ The REAL `NodePopover` — portalled under `document.body` — is the point here.

vi.mock('../shared/openNodeInspector', () => ({ openNodeInspector: vi.fn(() => true) }))

const FACTOR_PRICE = { id: 'f-price', type: 'factor', data: { label: 'Pro plan monthly price', type: 'factor' } }
const FACTOR_HEAD = {
  id: 'f-head', type: 'factor',
  data: { label: 'Developer headcount', type: 'factor', observedState: { value: 0, unit: 'count' }, unit: 'count' },
}
const FACTOR_ADOPT = { id: 'f-adopt', type: 'factor', data: { label: 'Adoption friction', type: 'factor' } }
const OPTION_1 = { id: 'option-1', type: 'option', data: { label: 'Raise the Pro price', type: 'option' } }
const OPTION_2 = { id: 'option-2', type: 'option', data: { label: 'Hold the price', type: 'option' } }
const BASELINE = {
  id: 'option-b', type: 'option',
  data: {
    label: 'Status quo', type: 'option', is_baseline: true,
    interventions: { 'f-price': { value: 49, display_value: '£49' }, 'f-adopt': { value: 0.2, display_value: 'Low' } },
  },
}

/**
 * Shared change order (non-baseline coverage, then model order): f-price (2),
 * f-adopt (2), f-head (1), f-seats (1). option-1 sets all four, so its card
 * shows three rows (Paul 25 Sep) with one behind `+1 more`.
 */
const CEE_READY = {
  options: [
    {
      id: 'option-1',
      interventions: {
        'f-price': { value: 79, display_value: '£79', source: 'user_specified' },
        'f-head': { value: 30, display_value: '30 engineers', source: 'cee_hypothesis' },
        'f-adopt': { value: 0.9, display_value: 'Very high', source: 'brief_extraction' },
        'f-seats': { value: 12, display_value: '12 seats', source: 'cee_hypothesis' },
      },
    },
    {
      id: 'option-2',
      interventions: {
        'f-price': { value: 59, display_value: '£59', source: 'cee_hypothesis' },
        'f-adopt': { value: 0.9, display_value: 'Very high' },
      },
    },
  ],
}

let winRate: number | null = null

const makeStoreState = (overrides: Record<string, unknown> = {}) => ({
  hoveredOptionId: null,
  nodes: [FACTOR_PRICE, FACTOR_HEAD, FACTOR_ADOPT, OPTION_1, OPTION_2, BASELINE],
  edges: [],
  ceeAnalysisReady: CEE_READY,
  results: { status: 'idle' },
  highlightedNodes: new Set(),
  dimmedNodeIds: new Set(),
  lens: { _dimmedNodeIds: new Set() },
  goalThreshold: null,
  goalConstraints: [],
  setHoveredOption: vi.fn(),
  viewMode: 'standard',
  lodRung: 'quiet',
  ...overrides,
})

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector) => selector(makeStoreState())),
}))

vi.mock('../../layoutStore', () => ({
  useLayoutStore: vi.fn(((selector: (s: { layoutNodeWidth: number | null }) => unknown) =>
    selector({ layoutNodeWidth: null })) as unknown as (...args: never[]) => unknown),
}))

vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null,
    influence: null,
    confidence: null,
    inSensitivityAnalysis: false,
    achievementProbability: null,
    stabilityPercentage: null,
    winRate,
    isResultsMode: useCanvasStore((state) => state.results.status) === 'complete',
    predictedOutcome: null,
    valueOfInformation: null,
    voiRank: null,
  })),
}))

import { useCanvasStore } from '../../store'
import { openNodeInspector } from '../shared/openNodeInspector'

const baseProps = {
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

const COMPLETE = { status: 'complete', report: {} }

const renderCard = (
  { id = 'option-1', data = {}, store = {} }: { id?: string; data?: Record<string, unknown>; store?: Record<string, unknown> } = {},
) => {
  vi.mocked(useCanvasStore).mockImplementation((selector) => selector(makeStoreState(store) as any))
  // The card's own data is the store node's data (so `is_baseline` is the
  // explicit flag, never the "Status quo" label regex), plus any override.
  const own = (makeStoreState(store).nodes as Array<{ id: string; data: Record<string, unknown> }>).find((n) => n.id === id)?.data
  return render(
    <ReactFlowProvider>
      {/* The wrapper xyflow renders around every node — the owner id both
          `NodePopover` and the outside-tap predicate read. */}
      <div className="react-flow__node" data-id={id}>
        <OptionNode {...baseProps} id={id} data={{ label: 'Option', type: 'option', ...own, ...data }} />
      </div>
    </ReactFlowProvider>,
  )
}


const realMatchMedia = window.matchMedia
beforeEach(() => {
  window.matchMedia = ((q: string) => ({
    matches: q === '(hover: none)', media: q, onchange: null,
    addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
  vi.mocked(openNodeInspector).mockClear()
  winRate = null
})
afterEach(() => { window.matchMedia = realMatchMedia })

async function tapPlusMore(container: HTMLElement) {
  // `+N more` is ON THE CARD — no preview has to open first.
  let more: HTMLElement | null = null
  await waitFor(() => {
    more = container.querySelector<HTMLElement>('[data-testid="option-change-more-option-1"]')
    expect(more, '`+N more` is on the card').not.toBeNull()
  })
  expect(more!.closest('[data-node-popover]'), '`+N more` is not in the popover').toBeNull()
  expect(document.querySelectorAll('[data-testid="option-change-more-option-1"]').length).toBe(1)
  // The real sequence a tap produces: pointerdown (document capture sees it
  // first), then click.
  act(() => { fireEvent.pointerDown(more!) })
  act(() => { fireEvent.click(more!) })
}

describe('on touch, `+N more` on the card opens the inspector', () => {
  it('pre-run', async () => {
    const { container } = renderCard()
    await tapPlusMore(container)
    expect(openNodeInspector).toHaveBeenCalledWith('option-1')
  })

  it('post-run', async () => {
    winRate = 0.42
    const { container } = renderCard({ store: { results: COMPLETE } })
    await tapPlusMore(container)
    expect(openNodeInspector).toHaveBeenCalledWith('option-1')
  })
})

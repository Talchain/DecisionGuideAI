/**
 * The card hover pop-up (Paul, 29 Sep 2026): light panel, server data only,
 * never beside the inspector, placed clear of the neighbouring cards.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, act } from '@testing-library/react'
import { Target } from 'lucide-react'
import { BaseNode } from '../../../nodes/BaseNode'
import { nodeHoverFacts, NOT_ON_RECORD } from '../NodeHoverCard'
import { placeHoverCard, HOVER_CARD_OPEN_DELAY_MS, HOVER_CARD_SURFACE_CLASS } from '../hoverCardPlacement'
import { TOOLTIP_SURFACE_CLASS } from '../../../../components/Tooltip'

const state: Record<string, unknown> = {}
vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null, useUpdateNodeInternals: () => vi.fn() }
})
vi.mock('../../../store', () => ({
  useCanvasStore: vi.fn((selector: (s: unknown) => unknown) => selector(state)),
}))
vi.mock('../../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null, influence: null, confidence: null,
    inSensitivityAnalysis: false, achievementProbability: null, winRate: null, isResultsMode: false,
  })),
}))

const baseProps = {
  id: 'fac_price', selected: false, dragging: false, zIndex: 0, isConnectable: true,
  positionAbsoluteX: 0, positionAbsoluteY: 0, xPos: 0, yPos: 0,
  deletable: true, selectable: true, draggable: true,
}

const PRICE = {
  label: 'Pro plan monthly price',
  category: 'controllable',
  observedState: { value: 0.49, raw_value: 49, unit: '£', cap: 100, source: 'brief_extraction', extractionType: 'explicit' },
}
const NODES = [
  { id: 'fac_price', type: 'factor', data: PRICE },
  { id: 'out_churn', type: 'outcome', data: { label: 'Monthly churn' } },
  { id: 'goal_mrr', type: 'goal', data: { label: 'Grow MRR' } },
]
const EDGES = [
  { id: 'e1', source: 'fac_price', target: 'out_churn', data: { direction: 'positive', directionSource: 'cee', weight: 0.4, weightSource: 'cee' } },
  { id: 'e2', source: 'out_churn', target: 'goal_mrr', data: { direction: 'negative' } },
]

function seed() {
  for (const k of Object.keys(state)) delete state[k]
  Object.assign(state, {
    highlightedNodes: new Set(), dimmedNodeIds: new Set(), lens: { _dimmedNodeIds: new Set() },
    results: { status: 'idle' }, goalThreshold: null, goalConstraints: [], viewMode: 'standard',
    nodes: NODES, edges: EDGES,
  })
}

function hoverCard(props: { id: string; nodeType: 'factor' | 'outcome' | 'goal' | 'risk' | 'option' | 'decision'; data: Record<string, unknown>; selected?: boolean }) {
  const { container } = render(
    <BaseNode {...baseProps} id={props.id} selected={props.selected ?? false} type={props.nodeType} data={props.data} nodeType={props.nodeType} icon={Target} />,
  )
  const card = container.querySelector('[role="group"]') as HTMLElement
  act(() => {
    fireEvent.mouseEnter(card.querySelector('[data-testid="node-title"]') as HTMLElement)
    vi.advanceTimersByTime(HOVER_CARD_OPEN_DELAY_MS + 50)
  })
  return document.querySelector('[data-testid="node-hover-card"]') as HTMLElement | null
}

describe('card hover pop-up — what it shows', () => {
  beforeEach(() => { vi.useFakeTimers(); seed() })
  afterEach(() => { vi.useRealTimers() })

  it('a factor: full name, its value as the card formats it, whose it is, and what it affects with the stated direction', () => {
    const pop = hoverCard({ id: 'fac_price', nodeType: 'factor', data: PRICE })
    expect(pop).not.toBeNull()
    expect(pop!.querySelector('[data-testid="node-hover-card-title"]')!.textContent).toBe('Pro plan monthly price')
    const value = pop!.querySelector('[data-testid="node-hover-card-value"]')!.textContent!
    expect(value).toContain('£49')
    expect(value).toContain('From your brief')
    expect(pop!.querySelector('[data-testid="node-hover-card-links-affects"]')!.textContent).toBe('AffectsMonthly churn (positive)')
    // The stated strength is drawn beside the name, only when the server stated one (CONTRAST row below has none).
    const bar = pop!.querySelector('[data-testid="node-hover-card-link-bar-0"]') as HTMLElement
    expect((bar.firstElementChild as HTMLElement).style.width).toBe('40%')
    expect((bar.firstElementChild as HTMLElement).className).toContain('bg-success')
  })

  it('CONTRAST — nothing invented when fields are absent: no value says "not on record", an unstated direction says nothing', () => {
    const bare = { label: 'Pro plan monthly price', category: 'controllable' }
    state.nodes = [{ id: 'fac_price', type: 'factor', data: bare }, NODES[1]]
    state.edges = [{ id: 'e1', source: 'fac_price', target: 'out_churn', data: { direction: 'positive' } }]
    const pop = hoverCard({ id: 'fac_price', nodeType: 'factor', data: bare })!
    expect(pop.querySelector('[data-testid="node-hover-card-value"]')!.textContent).toBe(`Value${NOT_ON_RECORD}`)
    // `direction: 'positive'` with no source stamp is the UI default, not a statement.
    expect(pop.querySelector('[data-testid="node-hover-card-links-affects"]')!.textContent).toBe('AffectsMonthly churn')
    expect(pop.textContent).not.toMatch(/%|positive|Moderate|Low|High/)
    expect(pop.querySelector('[data-testid^="node-hover-card-link-bar-"]')).toBeNull()
  })

  it('an outcome shows what drives it and what it affects; a connection to a node with no name is dropped, not invented', () => {
    state.edges = [...EDGES, { id: 'e3', source: 'ghost', target: 'out_churn', data: {} }]
    const pop = hoverCard({ id: 'out_churn', nodeType: 'outcome', data: { label: 'Monthly churn' } })!
    expect(pop.querySelector('[data-testid="node-hover-card-links-driven-by"]')!.textContent).toBe('Driven byPro plan monthly price (positive)')
    expect(pop.querySelector('[data-testid="node-hover-card-links-affects"]')!.textContent).toBe('AffectsGrow MRR')
    expect(pop.querySelector('[data-testid="node-hover-card-value"]')).toBeNull()
  })

  it('wears the light panel surface, never the black tooltip, and takes no pointer events', () => {
    const pop = hoverCard({ id: 'fac_price', nodeType: 'factor', data: PRICE })!
    for (const token of ['bg-panel', 'border-panel-border', 'rounded-lg', 'shadow-lg']) expect(pop.className).toContain(token)
    expect(HOVER_CARD_SURFACE_CLASS.split(/\s+/).every(t => pop.className.includes(t))).toBe(true)
    // CONTRAST — the black tooltip's ground is not on it.
    expect(TOOLTIP_SURFACE_CLASS).toContain('bg-text-body')
    expect(pop.className).not.toContain('bg-text-body')
    expect(pop.style.pointerEvents).toBe('none')
    expect(pop.style.maxWidth).toBe('260px')
    expect(pop.parentElement).toBe(document.body)
    // The black one-line name tooltip is gone from the card title.
    expect(document.querySelector('[data-testid="node-title-tooltip-name"]')).toBeNull()
  })

  it('does not open before the hover delay', () => {
    const { container } = render(
      <BaseNode {...baseProps} type="factor" data={PRICE} nodeType="factor" icon={Target} />,
    )
    act(() => {
      fireEvent.mouseEnter(container.querySelector('[data-testid="node-title"]') as HTMLElement)
      vi.advanceTimersByTime(HOVER_CARD_OPEN_DELAY_MS - 100)
    })
    expect(document.querySelector('[data-testid="node-hover-card"]')).toBeNull()
  })

  it('never opens on a SELECTED card — CONTRAST: the same card unselected opens (row above)', () => {
    expect(hoverCard({ id: 'fac_price', nodeType: 'factor', data: PRICE, selected: true })).toBeNull()
  })
})

describe('every kind opens it, carrying the full name first (the name tooltip it replaces)', () => {
  beforeEach(() => { vi.useFakeTimers(); seed() })
  afterEach(() => { vi.useRealTimers() })
  const LABEL = 'Transition to usage-based pricing'
  for (const kind of ['decision', 'goal', 'option', 'factor', 'outcome', 'risk'] as const) {
    it(`${kind}`, () => {
      const pop = hoverCard({ id: `n_${kind}`, nodeType: kind, data: { label: LABEL } })
      expect(pop?.firstElementChild?.textContent).toBe(LABEL)
    })
  }
})

describe('nodeHoverFacts — pure', () => {
  it('a yes/no factor reads the card\'s own words, never a tier over 0/1', () => {
    const binary = { label: 'Segment platform adoption', observedState: { value: 0, factor_type: 'binary', encoding_map: { '0': 'Not adopted', '1': 'Adopted' }, source: 'brief_extraction' } }
    const facts = nodeHoverFacts('f', 'factor', binary, [], [])
    expect(facts.value?.text ?? '').not.toMatch(/Low|High|\(0\)/)
  })
})

describe('placeHoverCard — clear of the neighbouring cards', () => {
  const viewport = { width: 1280, height: 800 }
  const size = { width: 240, height: 120 }
  const anchor = { left: 500, top: 300, right: 700, bottom: 380 }

  it('goes right when right is free', () => {
    expect(placeHoverCard(anchor, size, viewport, []).side).toBe('right')
  })

  it('avoids a card on the right and one below, taking the free side', () => {
    const right = { left: 720, top: 280, right: 920, bottom: 400 }
    const below = { left: 480, top: 400, right: 720, bottom: 500 }
    const placed = placeHoverCard(anchor, size, viewport, [right, below])
    expect(['left', 'above']).toContain(placed.side)
  })

  it('stays inside the viewport', () => {
    const p = placeHoverCard({ left: 1100, top: 700, right: 1270, bottom: 790 }, size, viewport, [])
    expect(p.left).toBeGreaterThanOrEqual(8)
    expect(p.left + size.width).toBeLessThanOrEqual(viewport.width - 8)
    expect(p.top + size.height).toBeLessThanOrEqual(viewport.height - 8)
  })
})

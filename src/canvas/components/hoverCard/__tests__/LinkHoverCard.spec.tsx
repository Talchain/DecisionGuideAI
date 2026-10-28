/**
 * The link hover pop-up (Paul, 29 Sep 2026): light panel, server data only —
 * direction and strength, each with who stated it; nothing banded or defaulted.
 * Replaces the v3.1 one-line dark tooltip (`StyledEdge.hoverTooltip.contractV31`).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, act, cleanup } from '@testing-library/react'
import { Position } from '@xyflow/react'
import { StyledEdge } from '../../../edges/StyledEdge'
import { EDGE_EXISTENCE_DOUBT_SENTENCE } from '../../../edges/connectorCopy'
import { TOOLTIP_SURFACE_CLASS } from '../../../../components/Tooltip'
import { HOVER_CARD_OPEN_DELAY_MS } from '../hoverCardPlacement'
import { NOT_ON_RECORD } from '../NodeHoverCard'
import served from '../../../edges/__tests__/fixtures/journey4ServedGraph.d4e6a8ba.json'
import { mapDraftEdgeToCanvas } from '../../../utils/applyDraftResult'
import words from '../../../nodes/shared/__tests__/fixtures/q1-words-graph.hand-made.json'
import parallel from '../../../nodes/shared/__tests__/fixtures/q1-parallel-links.hand-made.json'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return {
    ...actual,
    BaseEdge: () => <path data-testid="base-edge" />,
    EdgeLabelRenderer: ({ children }: any) => <div>{children}</div>,
    getBezierPath: () => ['M0 0 L100 100', 50, 50],
    getSmoothStepPath: () => ['M0 0 L100 100', 50, 50],
    getStraightPath: () => ['M0 0 L100 100', 50, 50],
    useReactFlow: () => ({ getNode: () => null, getEdges: () => [], getNodes: () => [] }),
    useStore: (selector: any) => selector({ nodes: [] }),
  }
})
// Gate 5 item 5: a row may add store slices (e.g. the run-changes light) without touching the others.
const storeExtra = vi.hoisted(() => ({ value: {} as Record<string, unknown> }))
vi.mock('../../../store', () => ({
  useCanvasStore: vi.fn((selector: any) =>
    selector({
      ...storeExtra.value,
      updateEdgeData: vi.fn(),
      runMeta: { ceeReview: null },
      results: { status: 'idle', report: null },
      hoveredOptionId: null,
      highlightedEdges: new Set<string>(),
      dimmedEdgeIds: new Set<string>(),
      lens: {
        active: 'full',
        _dimmedEdgeIds: new Set<string>(),
        _sensitivityWeights: new Map<string, number>(),
        _sensitivityQuartiles: null,
        _fragileEdgeIds: new Set<string>(),
        _lensFragileLabels: new Map<string, string>(),
      },
    })
  ),
}))
// Q1 readers: the saved read a link's words come from (`savedModelProgram.programLinkWords`); none unless a row sets one.
const savedRead = vi.hoisted(() => ({ graph: null as unknown }))
vi.mock('../../../nodes/shared/savedGraph', async (importOriginal) => ({ ...(await importOriginal<Record<string, unknown>>()), useSavedGraph: () => savedRead.graph }))
vi.mock('../../../hooks/useModelChangedSinceRun', () => ({
  useModelChangedSinceRunLight: () => false,
  useModelChangedSinceRun: () => false,
}))
vi.mock('../../../store/edgeLabelMode', () => ({
  useEdgeLabelMode: vi.fn((selector: any) => selector({ mode: 'human' })),
}))
vi.mock('../../../hooks/useTheme', () => ({ useIsDark: () => false }))
vi.mock('../../../hooks/useFirstTimeHints', () => ({
  useEdgeEditHint: () => ({ showHint: false, dismissHint: vi.fn() }),
}))
vi.mock('../../../hooks/usePrefersReducedMotion', () => ({ usePrefersReducedMotion: () => false }))
vi.mock('../../../../flags', () => ({ isGraphLensEnabled: () => false }))

const edgeProps = {
  id: 'e1', source: 'n1', target: 'n2',
  sourceX: 0, sourceY: 0, targetX: 100, targetY: 100,
  sourcePosition: Position.Right, targetPosition: Position.Left, selected: false,
}

function hover(data: Record<string, unknown>, advance = HOVER_CARD_OPEN_DELAY_MS + 50) {
  const { container } = render(<StyledEdge {...(edgeProps as any)} data={data} />)
  act(() => {
    fireEvent.mouseEnter(container.querySelector('path[stroke="transparent"]')!)
    vi.advanceTimersByTime(advance)
  })
  return container.querySelector('[data-testid="edge-hover-popover"]') as HTMLElement | null
}
const text = (pop: HTMLElement, id: string) => pop.querySelector(`[data-testid="${id}"]`)?.textContent ?? null

describe('link hover pop-up', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('shows the server direction and strength, each with who stated it', () => {
    const pop = hover({ weight: 0.35, weightSource: 'cee', direction: 'positive', directionSource: 'user' })!
    expect(text(pop, 'edge-hover-arrow-sentence')).toBe('n1 → n2. Positive direction in this model.')
    expect(text(pop, 'edge-hover-direction')).toBe('DirectionSet by you')
    expect(text(pop, 'edge-hover-strength')).toBe('Strength0.35 · Olumi’s estimate')
    // No percentage, no band word, no second "Positive", no control.
    expect(pop.textContent).not.toMatch(/%|confident|Moderate|Strong|Weak/)
    expect((pop.textContent!.match(/Positive/g) ?? []).length).toBe(1)
    expect(pop.querySelectorAll('button')).toHaveLength(0)
  })

  it('draws the server strength as a bar: fill = |strength|, one neutral colour (never green/red); no bar when nothing is stated', () => {
    const pop = hover({ weight: 0.35, weightSource: 'cee', direction: 'negative', directionSource: 'user' })!
    const fill = pop.querySelector('[data-testid="edge-hover-strength-bar-fill"]') as HTMLElement
    expect(fill.style.width).toBe('35%')
    // The light ink since 1 Oct (Grammar v0 §2: no blue on the canvas); still ONE neutral, never green/red.
    expect(fill.className).toContain('bg-text-light')
    expect(fill.className).not.toContain('bg-info')
    expect(pop.querySelector('.bg-success, .bg-danger')).toBeNull()
    const bare = hover({ weight: 0.5, direction: 'positive' })!
    expect(bare.querySelector('[data-testid="edge-hover-strength-bar"]')).toBeNull()
  })

  it('a strength the user set reads as theirs', () => {
    const pop = hover({ weight: 0.6, weightSource: 'user', direction: 'negative', directionSource: 'cee' })!
    expect(text(pop, 'edge-hover-direction')).toBe('DirectionOlumi’s estimate')
    expect(text(pop, 'edge-hover-strength')).toBe('Strength0.60 · Set by you')
  })

  it('CONTRAST — nothing stated: defaulted direction and weight are "not on record", never a number', () => {
    const pop = hover({ weight: 0.5, direction: 'positive' })!
    expect(text(pop, 'edge-hover-arrow-sentence')).toBe('n1 → n2. Direction not stated in this model.')
    expect(text(pop, 'edge-hover-direction')).toBe(`Direction${NOT_ON_RECORD}`)
    expect(text(pop, 'edge-hover-strength')).toBe(`Strength${NOT_ON_RECORD}`)
    expect(pop.textContent).not.toMatch(/0\.5/)
  })

  it('a recorded existence doubt still appends its sentence', () => {
    const pop = hover({ weight: 0.35, weightSource: 'cee', direction: 'positive', directionSource: 'user', beliefExists: 0.5, beliefExistsSource: 'user' })!
    expect(text(pop, 'edge-hover-arrow-sentence')).toBe(`n1 → n2. Positive direction in this model. ${EDGE_EXISTENCE_DOUBT_SENTENCE}`)
  })

  it('wears the light panel surface, not the black tooltip; non-interactive, max 300px (260 until 1 Oct: names no longer truncate)', () => {
    const pop = hover({ weight: 0.35, weightSource: 'cee' })!
    for (const token of ['bg-panel', 'border-panel-border', 'rounded-lg', 'shadow-lg']) expect(pop.className).toContain(token)
    expect(TOOLTIP_SURFACE_CLASS).toContain('bg-text-body')
    expect(pop.className).not.toContain('bg-text-body')
    expect(pop.getAttribute('role')).toBe('tooltip')
    expect(pop.style.pointerEvents).toBe('none')
    expect(pop.style.maxWidth).toBe('300px')
    expect(pop.getAttribute('data-edge-popover')).toBe('e1')
  })

  it('waits for hover intent before opening', () => {
    expect(hover({ weight: 0.35, weightSource: 'cee' }, HOVER_CARD_OPEN_DELAY_MS - 100)).toBeNull()
  })

  // ⭐ BEAT 1 (Canvas lane, 4 Oct 2026): SERVED journey-4 links (fixture = wire capture 09, verbatim), through the real
  // ingestion mapper. Bound by the link's end ids. The size is the user's business figure (visible on hover);
  // the strength keeps Paul's 29 Sep form (the number + who stands behind it).
  const servedLink = (from: string, to: string) => {
    const wire = (served as { graph: { edges: Array<Record<string, unknown>> } }).graph.edges.filter((e) => e.from === from && e.to === to)
    expect(wire).toHaveLength(1)
    return mapDraftEdgeToCanvas(wire[0], 0).data as Record<string, unknown>
  }

  it('⭐ Beat 1: a link the user sized in the brief says its size "from your brief", and its strength "from your figure"', () => {
    const pop = hover(servedLink('existing_customers_lost_from_price_rise', 'monthly_recurring_revenue'))!
    expect(text(pop, 'edge-hover-size')).toBe('SizeDecrease of about £300 / month per 1 customer · from your brief')
    expect(text(pop, 'edge-hover-strength')).toMatch(/^Strength0\.80 · from your figure$/)
    expect(text(pop, 'edge-hover-direction')).toBe('Directionfrom your figure')
    expect(pop.textContent).not.toMatch(/Olumi/)
  })

  it("CONTROL — the served £1,200 link, stored as Olumi's estimate, says so in both rows", () => {
    const pop = hover(servedLink('existing_price_change_from_today', 'monthly_recurring_revenue'))!
    expect(text(pop, 'edge-hover-size')).toMatch(/^SizeIncrease of about £1,200 \/ month per 1 ?% · Olumi's estimate$/)
    expect(text(pop, 'edge-hover-strength')).toMatch(/· Olumi’s estimate$/)
    expect(text(pop, 'edge-hover-direction')).toBe('DirectionOlumi’s estimate')
  })

  it('CONTROL — a link with no stored size has no Size row', () => {
    const pop = hover({ weight: 0.35, weightSource: 'cee', direction: 'positive', directionSource: 'user' })!
    expect(pop.querySelector('[data-testid="edge-hover-size"]')).toBeNull()
  })
})

/**
 * ⭐ GATE 5 ITEM 5: a link the last Run's changes light (`analysisHighlight.source === 'run_changes'`) is marked on the
 * canvas by a glow — colour alone. The hover says it in the Changes view's own word. Bound by the edge's id in the light.
 */
describe('a link the last run changed says so on hover', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers(); storeExtra.value = {} })
  const DATA = { weight: 0.35, weightSource: 'cee', direction: 'positive', directionSource: 'user' }

  it('lit by the run changes → "Changed since the last run."', () => {
    storeExtra.value = { analysisHighlight: { source: 'run_changes', edgeIds: new Set(['e1']) } }
    const pop = hover(DATA)!
    expect(text(pop, 'edge-hover-run-changed')).toBe('Changed since the last run.')
  })
  it('CONTRAST: another link lit, or a light from another source → no such line', () => {
    storeExtra.value = { analysisHighlight: { source: 'run_changes', edgeIds: new Set(['e-other']) } }
    expect(text(hover(DATA)!, 'edge-hover-run-changed')).toBeNull()
    cleanup()
    storeExtra.value = { analysisHighlight: { source: 'flip_risks', edgeIds: new Set(['e1']) } }
    expect(text(hover(DATA)!, 'edge-hover-run-changed')).toBeNull()
  })
})

// Q1 readers (DL GO, 28 Oct): a link in words says its stated direction, that it is in words and not sized, and its basis.
// The edge and the saved read are the hand-made graph's, moved onto n1 → n2.
describe('Q1: a link in words says its words on hover', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers(); savedRead.graph = null; storeExtra.value = {} })
  type Rec = Record<string, unknown>
  const onN1N2 = (id: string): Rec => ({ ...structuredClone((words.edges as Rec[]).find((e) => e.id === id)!), from: 'n1', to: 'n2' })
  const program = (edge: Rec) => ({ edges: [edge], living_model: { model_program: 'v1' } })

  it('conditional, with a basis: the arrow alone, the stated direction, "In words, not sized", the basis', () => {
    const edge = onN1N2('evening_classes__member_mood')
    savedRead.graph = program(edge)
    const pop = hover(mapDraftEdgeToCanvas(edge, 0).data)!
    expect(text(pop, 'edge-hover-arrow-sentence')).toBe('n1 → n2.')
    expect(text(pop, 'edge-hover-direction')).toBe('DirectionDepends on conditions')
    expect(text(pop, 'edge-hover-strength')).toBe('StrengthIn words, not sized')
    expect(text(pop, 'edge-hover-basis')).toBe('Basis: Members asked for them in the spring survey')
    expect(pop.textContent).not.toMatch(/%|Not on record|runs both ways|not stated/)
  })
  it('up, with no basis: "Raises it", and no basis line', () => {
    const edge = onN1N2('member_mood__keep_members')
    savedRead.graph = program(edge)
    const pop = hover(mapDraftEdgeToCanvas(edge, 0).data)!
    expect(text(pop, 'edge-hover-direction')).toBe('DirectionRaises it')
    expect(text(pop, 'edge-hover-strength')).toBe('StrengthIn words, not sized')
    expect(pop.querySelector('[data-testid="edge-hover-basis"]')).toBeNull()
  })
  it('CONTROL: the same link with no saved words keeps today\'s rows', () => {
    const edge = onN1N2('evening_classes__member_mood')
    const pop = hover(mapDraftEdgeToCanvas(edge, 0).data)!
    expect(text(pop, 'edge-hover-arrow-sentence')).toBe('n1 → n2. Direction not stated in this model.')
    expect(text(pop, 'edge-hover-strength')).toBe(`Strength${NOT_ON_RECORD}`)
    expect(pop.querySelector('[data-testid="edge-hover-basis"]')).toBeNull()
  })
})

// Q1 readers (PL BLOCK 1): the second link of each parallel pair says its own record on hover, never the first's.
describe('Q1: parallel links each say their own record on hover', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers(); savedRead.graph = null })
  type Rec = Record<string, unknown>
  const hoverParallel = (id: string) => {
    savedRead.graph = parallel
    const wire = (parallel.edges as Rec[]).find((e) => e.id === id)!
    const { container } = render(<StyledEdge {...(edgeProps as any)} id={id} source={wire.from} target={wire.to} data={mapDraftEdgeToCanvas(wire, 0).data} />)
    act(() => {
      fireEvent.mouseEnter(container.querySelector('path[stroke="transparent"]')!)
      vi.advanceTimersByTime(HOVER_CARD_OPEN_DELAY_MS + 50)
    })
    return container.querySelector('[data-testid="edge-hover-popover"]') as HTMLElement
  }
  it('price → demand, the word link second: "Disputed", in words, its basis', () => {
    const pop = hoverParallel('price__demand__2')
    expect(text(pop, 'edge-hover-direction')).toBe('DirectionDisputed')
    expect(text(pop, 'edge-hover-strength')).toBe('StrengthIn words, not sized')
    expect(text(pop, 'edge-hover-basis')).toBe('Basis: Staff disagree')
  })
  it('quality → members, the numerical link second: its own strength, no words, no basis', () => {
    const pop = hoverParallel('quality__members__2')
    expect(text(pop, 'edge-hover-arrow-sentence')).toBe('quality → members. Positive direction in this model.')
    expect(text(pop, 'edge-hover-strength')).not.toBe('StrengthIn words, not sized')
    expect(pop.querySelector('[data-testid="edge-hover-basis"]')).toBeNull()
  })
})

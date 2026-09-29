/**
 * The link hover pop-up (Paul, 29 Sep 2026): light panel, server data only —
 * direction and strength, each with who stated it; nothing banded or defaulted.
 * Replaces the v3.1 one-line dark tooltip (`StyledEdge.hoverTooltip.contractV31`).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, act } from '@testing-library/react'
import { Position } from '@xyflow/react'
import { StyledEdge } from '../../../edges/StyledEdge'
import { EDGE_EXISTENCE_DOUBT_SENTENCE } from '../../../edges/connectorCopy'
import { TOOLTIP_SURFACE_CLASS } from '../../../../components/Tooltip'
import { HOVER_CARD_OPEN_DELAY_MS } from '../hoverCardPlacement'
import { NOT_ON_RECORD } from '../NodeHoverCard'

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
vi.mock('../../../store', () => ({
  useCanvasStore: vi.fn((selector: any) =>
    selector({
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

  it('wears the light panel surface, not the black tooltip; non-interactive, max 260px', () => {
    const pop = hover({ weight: 0.35, weightSource: 'cee' })!
    for (const token of ['bg-panel', 'border-panel-border', 'rounded-lg', 'shadow-lg']) expect(pop.className).toContain(token)
    expect(TOOLTIP_SURFACE_CLASS).toContain('bg-text-body')
    expect(pop.className).not.toContain('bg-text-body')
    expect(pop.getAttribute('role')).toBe('tooltip')
    expect(pop.style.pointerEvents).toBe('none')
    expect(pop.style.maxWidth).toBe('260px')
    expect(pop.getAttribute('data-edge-popover')).toBe('e1')
  })

  it('waits for hover intent before opening', () => {
    expect(hover({ weight: 0.35, weightSource: 'cee' }, HOVER_CARD_OPEN_DELAY_MS - 100)).toBeNull()
  })
})

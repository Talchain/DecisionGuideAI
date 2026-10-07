import type { ComponentProps, CSSProperties, ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { Position } from '@xyflow/react'
import { StyledEdge, EDGE_GLOW } from '../StyledEdge'
import { useCanvasStore } from '../../store'
import { OPEN_FULL_INSPECTOR_EVENT } from '../../utils/openEdgeStrengthEditor'
import { focusEdgeById } from '../../utils/focusHelpers'

vi.mock('@xyflow/react', async importOriginal => ({
  ...(await importOriginal<typeof import('@xyflow/react')>()),
  BaseEdge: ({ id, style }: { id: string; style: CSSProperties }) => <path data-testid="driver-edge-path" data-edge-id={id} style={style} />,
  EdgeLabelRenderer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  getBezierPath: () => ['M0 0 L100 100', 50, 50],
  getSmoothStepPath: () => ['M0 0 L100 100', 50, 50],
  getStraightPath: () => ['M0 0 L100 100', 50, 50],
  useReactFlow: () => ({ getNode: () => null, getEdges: () => [], getNodes: () => [] }),
  useStore: (selector: (state: unknown) => unknown) => selector({ nodes: [], transform: [0, 0, 1] }),
}))
vi.mock('../../utils/focusHelpers', async importOriginal => ({
  ...(await importOriginal<typeof import('../../utils/focusHelpers')>()), focusEdgeById: vi.fn(),
}))
vi.mock('../../hooks/useModelChangedSinceRun', () => ({
  useModelChangedSinceRunLight: () => false,
}))
vi.mock('../../store/edgeLabelMode', () => ({
  useEdgeLabelMode: (selector: (state: { mode: string }) => unknown) => selector({ mode: 'human' }),
}))
vi.mock('../../hooks/useFirstTimeHints', () => ({
  useEdgeEditHint: () => ({ showHint: false, dismissHint: vi.fn() }),
}))
vi.mock('../../hooks/usePrefersReducedMotion', () => ({ usePrefersReducedMotion: () => false }))
vi.mock('../../../flags', () => ({ isGraphLensEnabled: () => false }))
vi.mock('../../utils/graphDisplayCalculations', async importOriginal => ({
  ...(await importOriginal<typeof import('../../utils/graphDisplayCalculations')>()),
  calculateEdgeImportance: () => 0.5, weightMagnitudeToStrokeWidth: () => 2,
}))
vi.mock('../../theme/edges', () => ({ applyEdgeVisualProps: (_: unknown, props: unknown) => props }))
vi.mock('../../ui/inspector-v2/inspectorStrings', () => ({
  getStrengthDescription: () => 'moderate', getProvenanceLabel: () => '',
}))

const STRENGTH = {
  quantity_id: 'a->b', kind: 'link_strength', from: 'a', to: 'b', side: 'low', strength: 'weaker',
  authored_by: 'olumi', user_stated_link: false,
}
const FACTOR = {
  quantity_id: 'a', kind: 'factor_value', factor_id: 'a', side: 'high', cut_value: 4.1,
  cut_unit: '%', pct_if_side: 40, pct_if_side_rounding: 'whole', authored_by: 'user',
}
const EDGE = {
  id: 'e_ab', source: 'a', target: 'b',
  data: { weight: 0.6, direction: 'positive', beliefExists: 0.8 },
}
const NODES = [
  { id: 'o1', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Expand' } },
  { id: 'o2', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Hold' } },
]
const PROPS = {
  ...EDGE, sourceX: 0, sourceY: 0, targetX: 100, targetY: 100,
  sourcePosition: Position.Right, targetPosition: Position.Left, selected: false,
} as unknown as ComponentProps<typeof StyledEdge>

function report(drivers: Record<string, unknown> = { o1: STRENGTH }) {
  return { inference_warnings: [{
    code: 'GOAL_CHANCE_LICENSED', severity: 'info', message: 'm', form: 'each',
    option_ids: ['o1', 'o2'], pct_by_option: { o1: 62, o2: 41 },
    target: { comparator: 'at_least', value: 120000, unit: '£' }, driver_by_option: drivers,
  }] }
}
function seedReport(next: unknown, status: 'complete' | 'running' = 'complete') {
  // Exercise the brief's non-complete 'running' contrast even though the
  // store's current status union names in-flight results 'loading'.
  useCanvasStore.setState({ results: { ...useCanvasStore.getState().results, status: status as never, report: next as never } })
}
function tag(container: HTMLElement) {
  return container.querySelector<HTMLButtonElement>('button[data-testid="goal-chance-driver-tag"][data-driver-tag-edge-id="e_ab"]')
}
function marker(container: HTMLElement) {
  return container.querySelector('g[data-edge-group-id="e_ab"][data-goal-chance-driver="true"]')
}
function filter(container: HTMLElement) {
  const path = container.querySelector<SVGElement>('path[data-testid="driver-edge-path"][data-edge-id="e_ab"]')
  expect(path).not.toBeNull()
  return path!.style.filter
}

beforeEach(() => {
  vi.clearAllMocks()
  useCanvasStore.setState({
    nodes: NODES as never, edges: [EDGE] as never, viewMode: 'standard', lodRung: 'full',
    highlightedEdges: new Set(), dimmedEdgeIds: new Set(),
    analysisHighlight: { source: null, edgeIds: new Set(), nodeIds: new Set() },
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
    showResultsPanel: true,
  })
  seedReport(report())
})

describe('StyledEdge — goal-chance driver tag bound to e_ab', () => {
  it('complete results mark the exact link with the exact text, aria and existing glow', () => {
    const { container } = render(<StyledEdge {...PROPS} />)
    const button = tag(container)
    expect(button).not.toBeNull()
    expect(button!.getAttribute('type')).toBe('button')
    expect(button!.textContent).toBe('Chance rests most on this')
    expect(button!.getAttribute('aria-label')).toBe('In this model, the chance of meeting your goal for ‘Expand’ rests most on this link. Open the link.')
    expect(marker(container)).not.toBeNull()
    expect(filter(container)).toBe(EDGE_GLOW.selected)
  })

  it('click opens the full inspector on e_ab once and leaves the camera alone', () => {
    const { container } = render(<StyledEdge {...PROPS} />)
    const button = tag(container)
    expect(button).not.toBeNull()
    const seen = vi.fn()
    window.addEventListener(OPEN_FULL_INSPECTOR_EVENT, seen)
    try { fireEvent.click(button!) } finally { window.removeEventListener(OPEN_FULL_INSPECTOR_EVENT, seen) }
    expect(seen).toHaveBeenCalledTimes(1)
    expect([...useCanvasStore.getState().selection.edgeIds]).toEqual(['e_ab'])
    expect(useCanvasStore.getState().edges.find(edge => edge.id === 'e_ab')?.selected).toBe(true)
    expect(focusEdgeById).not.toHaveBeenCalled()
  })

  it('CONTRAST: the same edge without a licence has no tag or marker', () => {
    seedReport({})
    const { container } = render(<StyledEdge {...PROPS} />)
    expect(tag(container)).toBeNull()
    expect(marker(container)).toBeNull()
  })

  it('CONTRAST: a licence naming another pair does not mark e_ab', () => {
    seedReport(report({ o1: { ...STRENGTH, from: 'b', to: 'a' } }))
    const { container } = render(<StyledEdge {...PROPS} />)
    expect(tag(container)).toBeNull()
    expect(marker(container)).toBeNull()
  })

  it('CONTRAST: running results with the same licence have no tag or marker', () => {
    seedReport(report(), 'running')
    const { container } = render(<StyledEdge {...PROPS} />)
    expect(tag(container)).toBeNull()
    expect(marker(container)).toBeNull()
  })

  it('CONTRAST: a factor_value driver does not mark e_ab', () => {
    seedReport(report({ o1: FACTOR }))
    const { container } = render(<StyledEdge {...PROPS} />)
    expect(tag(container)).toBeNull()
    expect(marker(container)).toBeNull()
  })

  it('uses canvas labels in model option order even when driver insertion order differs', () => {
    seedReport(report({ o2: STRENGTH, o1: STRENGTH }))
    const { container } = render(<StyledEdge {...PROPS} />)
    expect(tag(container)?.getAttribute('aria-label')).toBe('In this model, the chance of meeting your goal for ‘Expand’ and ‘Hold’ rests most on this link. Open the link.')
  })

  it('skips unlabelled option ids', () => {
    seedReport(report({ o2: STRENGTH, o1: STRENGTH }))
    useCanvasStore.setState({ nodes: [NODES[1]] as never })
    const { container } = render(<StyledEdge {...PROPS} />)
    expect(tag(container)?.getAttribute('aria-label')).toBe('In this model, the chance of meeting your goal for ‘Hold’ rests most on this link. Open the link.')
  })

  it('uses the exact generic aria when no option has a label', () => {
    useCanvasStore.setState({ nodes: [] })
    const { container } = render(<StyledEdge {...PROPS} />)
    expect(tag(container)?.getAttribute('aria-label')).toBe('In this model, an option’s chance of meeting your goal rests most on this link. Open the link.')
  })

  it('structural edges have no driver tag, marker or driver glow', () => {
    const { container } = render(<StyledEdge {...PROPS} data={{ ...EDGE.data, edge_type: 'structural' } as never} />)
    expect(tag(container)).toBeNull()
    expect(marker(container)).toBeNull()
    expect(filter(container)).not.toContain(EDGE_GLOW.selected)
  })

  it('far zoom hides only the tag and keeps the marked edge glow', () => {
    useCanvasStore.setState({ lodRung: 'line' })
    const { container } = render(<StyledEdge {...PROPS} />)
    expect(tag(container)).toBeNull()
    expect(marker(container)).not.toBeNull()
    expect(filter(container)).toBe(EDGE_GLOW.selected)
  })

  it('a driver edge marked by Changes receives the selected shadow exactly once', () => {
    useCanvasStore.setState({ analysisHighlight: { source: 'run_changes', edgeIds: new Set(['e_ab']), nodeIds: new Set() } as never })
    const { container } = render(<StyledEdge {...PROPS} />)
    expect(filter(container)).toBe(EDGE_GLOW.selected)
  })

  it('a selected driver edge retains exactly its selected glow', () => {
    const { container } = render(<StyledEdge {...PROPS} selected />)
    expect(filter(container)).toBe(EDGE_GLOW.selected)
  })
})

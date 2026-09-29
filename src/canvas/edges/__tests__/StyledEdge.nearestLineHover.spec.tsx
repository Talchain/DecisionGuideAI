/**
 * F8 — STYLEDEDGE'S OWN POINTER HANDLERS HAND THE HOVER TO THE NEAREST LINE
 * (review r08 blocker 2: nothing bound `onMouseEnter` / `onMouseMove` to the
 * arbiter, so reverting the wiring left every test green).
 *
 * Two real `StyledEdge`s are mounted inside xyflow-shaped wrappers
 * (`g.react-flow__edge[data-id]` under a `.react-flow` root), in the served
 * build-vs-buy shape: e-9's line at y=200, e-10's at y=206, e-10 on top. The
 * pointer events are fired at e-10's OWN hit path — where the browser delivers
 * them — and the tooltip must open on e-9 and only e-9 when the pointer is on
 * e-9's line. The drawn path is the mocked `BaseEdge`, given straight-line
 * geometry by `__helpers__/edgeLineGeometry.ts` (jsdom has none).
 *
 * The comparison-view case (review note 4) mounts the same two ids on a second
 * canvas: the hover must stay on the canvas the pointer is on.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, act } from '@testing-library/react'
import { Position } from '@xyflow/react'
import { StyledEdge } from '../StyledEdge'
import { stubStraightLine, stubElementsFromPoint, restoreElementsFromPoint } from './__helpers__/edgeLineGeometry'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return {
    ...actual,
    // The drawn line carries xyflow's own class, which the resolver measures.
    BaseEdge: ({ style }: any) => <path className="react-flow__edge-path" data-testid="base-edge" style={style} />,
    EdgeLabelRenderer: ({ children }: any) => <>{children}</>,
    getBezierPath: () => ['M0 0 L100 100', 50, 50],
    getSmoothStepPath: () => ['M0 0 L100 100', 50, 50],
    getStraightPath: () => ['M0 0 L100 100', 50, 50],
    useReactFlow: () => ({ getNode: () => null, getEdges: () => [], getNodes: () => [] }),
    useStore: (selector: any) => selector({ nodes: [] }),
  }
})

vi.mock('../../store', () => ({
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
    }),
  ),
}))
vi.mock('../../hooks/useModelChangedSinceRun', () => ({
  useModelChangedSinceRunLight: () => false,
  useModelChangedSinceRun: () => false,
}))
vi.mock('../../store/edgeLabelMode', () => ({
  useEdgeLabelMode: vi.fn((selector: any) => selector({ mode: 'human' })),
}))
vi.mock('../../hooks/useTheme', () => ({ useIsDark: () => false }))
vi.mock('../../hooks/useFirstTimeHints', () => ({
  useEdgeEditHint: () => ({ showHint: false, dismissHint: vi.fn() }),
}))
vi.mock('../../hooks/usePrefersReducedMotion', () => ({ usePrefersReducedMotion: () => false }))
vi.mock('../../../flags', () => ({ isGraphLensEnabled: () => false }))

const DATA = { weight: 0.5, weightSource: 'user', direction: 'positive', directionSource: 'user', beliefExists: 0.8 }
const edgeProps = (id: string, target: string) => ({
  id, source: 'engineering_capacity', target,
  sourceX: 0, sourceY: 0, targetX: 100, targetY: 100,
  sourcePosition: Position.Bottom, targetPosition: Position.Top,
  selected: false, data: DATA,
})

/** One canvas: e-9 then e-10 (so e-10 paints later and is on top). */
function Canvas({ name }: { name: string }) {
  return (
    <div className="react-flow" data-canvas={name}>
      <svg>
        <g className="react-flow__edge" data-id="e-9">
          <StyledEdge {...(edgeProps('e-9', 'on_time_delivery') as any)} />
        </g>
      </svg>
      <svg>
        <g className="react-flow__edge" data-id="e-10">
          <StyledEdge {...(edgeProps('e-10', 'engineering_overload') as any)} />
        </g>
      </svg>
    </div>
  )
}

function mount(canvases: string[]) {
  const { container } = render(<>{canvases.map((c) => <Canvas key={c} name={c} />)}</>)
  const on = (canvas: string, id: string) => {
    const wrapper = container.querySelector(`[data-canvas="${canvas}"] g.react-flow__edge[data-id="${id}"]`)!
    return {
      wrapper,
      hit: wrapper.querySelector('path[stroke="transparent"]')!,
      drawn: wrapper.querySelector('path.react-flow__edge-path')!,
      hovered: () => wrapper.querySelector('[data-testid="edge-hover-popover"]') !== null,
    }
  }
  for (const c of canvases) {
    stubStraightLine(on(c, 'e-9').drawn, 0, 200, 400, 200)
    stubStraightLine(on(c, 'e-10').drawn, 0, 206, 400, 206)
  }
  // The pointer is over the FIRST canvas: its e-10 hit area on top of its e-9's.
  stubElementsFromPoint(() => [on(canvases[0], 'e-10').hit, on(canvases[0], 'e-9').hit, document.body])
  return on
}

const ON_E9_LINE = { clientX: 150, clientY: 200.5 }
const ON_E10_LINE = { clientX: 150, clientY: 205.5 }

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'requestAnimationFrame', 'cancelAnimationFrame'],
  })
})
// ⚠ The setup file's afterEach (cleanup + real timers) runs BEFORE this one, so
// every test flushes the frames it schedules itself (the arbiter holds at most
// one pending frame; an unflushed one would swallow the next file-local move).
afterEach(() => {
  restoreElementsFromPoint()
})

describe('onMouseEnter — the hover opens on the nearest line, not the receiving hit area', () => {
  it('the pointer enters e-10\'s hit area ON e-9\'s line: e-9 shows the tooltip, e-10 does not', () => {
    const on = mount(['A'])
    act(() => {
      fireEvent.mouseEnter(on('A', 'e-10').hit, ON_E9_LINE)
      vi.advanceTimersByTime(400)
    })
    expect(on('A', 'e-9').hovered()).toBe(true)
    expect(on('A', 'e-10').hovered()).toBe(false)
  })

  it('CONTRAST: entering on e-10\'s own line hovers e-10', () => {
    const on = mount(['A'])
    act(() => {
      fireEvent.mouseEnter(on('A', 'e-10').hit, ON_E10_LINE)
      vi.advanceTimersByTime(400)
    })
    expect(on('A', 'e-10').hovered()).toBe(true)
    expect(on('A', 'e-9').hovered()).toBe(false)
  })

  it('leaving the hit area ends the hover it handed to e-9', () => {
    const on = mount(['A'])
    act(() => {
      fireEvent.mouseEnter(on('A', 'e-10').hit, ON_E9_LINE)
      vi.advanceTimersByTime(400)
    })
    expect(on('A', 'e-9').hovered()).toBe(true) // PRECONDITION
    act(() => {
      fireEvent.mouseLeave(on('A', 'e-10').hit, ON_E9_LINE)
      vi.advanceTimersByTime(400)
    })
    expect(on('A', 'e-9').hovered()).toBe(false)
  })
})

describe('onMouseMove — the hover follows the pointer across lines inside one hit area', () => {
  it('entering on e-10\'s line, then moving onto e-9\'s line, moves the tooltip to e-9', () => {
    const on = mount(['A'])
    act(() => {
      fireEvent.mouseEnter(on('A', 'e-10').hit, ON_E10_LINE)
      vi.advanceTimersByTime(400)
    })
    expect(on('A', 'e-10').hovered()).toBe(true) // PRECONDITION
    act(() => {
      fireEvent.mouseMove(on('A', 'e-10').hit, ON_E9_LINE)
      vi.advanceTimersByTime(450) // one frame, then the 400ms hover-card delay
    })
    expect(on('A', 'e-9').hovered()).toBe(true)
    expect(on('A', 'e-10').hovered()).toBe(false)
  })
})

describe('two canvases mount the same ids (comparison view, review note 4)', () => {
  it('the hover handed to e-9 is canvas A\'s e-9 — the canvas under the pointer — not B\'s', () => {
    const on = mount(['A', 'B'])
    act(() => {
      fireEvent.mouseEnter(on('A', 'e-10').hit, ON_E9_LINE)
      vi.advanceTimersByTime(400)
    })
    expect(on('A', 'e-9').hovered()).toBe(true)
    expect(on('B', 'e-9').hovered()).toBe(false)
    expect(on('B', 'e-10').hovered()).toBe(false)
  })
})

// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Position, ReactFlowProvider, type EdgeProps } from '@xyflow/react'
import { ViewLinkEdge } from '../../../../canvas/edges/ViewLinkEdge'
import { EdgeLabelLayer } from '../../../__tests__/edgeLabelLayer'
import type { View, ViewLink } from '../../../client'
import { drawnModelOf } from '../../../layout'
import { useViewStore } from '../../../store'
import { ViewLegend } from '../../../ViewLegend'
import { boardOf, drawViewCanvas, GROUP_LINK, VIEW_LINK, type ViewLinkData } from '../../../canvas'
import { useCanvasStore } from '../../../../canvas/store'
import { setDefaultLevel } from '../../simpleStore'
import { inputIdsOf } from '../bands'
import { inputsFolded, useInputsOpen } from '../foldStore'
import { applied } from '../../links/__tests__/applied'

const capacity: View = JSON.parse(readFileSync('src/olumiView/fixtures/real/capacity.view3.json', 'utf8'))
const model = capacity.model!
const base = model.links[0]!
const unsigned = (fields: Partial<ViewLink>): ViewLink => ({ ...base, causal: null, direction: null, ...fields })
const reason = unsigned({ kind: 'reason' })
const effect = (direction: ViewLink['direction'], fields: Partial<ViewLink> = {}): ViewLink =>
  unsigned({ ...fields, direction })
const typed = (links: ViewLink[], ids: string[]): View => ({
  ...capacity,
  model: { ...model, links, key: ids.map((id) => ({ id, glyph: '', text: `Core’s ${id} explanation` })) },
})

afterEach(() => {
  cleanup()
  useViewStore.setState({ view: null, sid: null })
  setDefaultLevel('working')
  useInputsOpen.setState({ open: {} })
  useCanvasStore.setState({ nodes: [], edges: [] } as never)
})

/** PL 1647: the key follows what the canvas committed. Commit the board as the canvas does (drawViewCanvas over boardOf). */
const commitBoard = () => { const b = boardOf(useViewStore.getState().view!.model!); drawViewCanvas(b.model, new Map(), b.extras, b.links) }
/** The committed edges of one type, from the canvas store. */
const committed = (type: string) => useCanvasStore.getState().edges.filter((e) => e.type === type)
/** Render the committed edge props, including the exact owner object stored by the board. */
function committedEdges() {
  const rendered = render(
    <ReactFlowProvider><EdgeLabelLayer><svg>
      {committed(VIEW_LINK).map((edge) => (
        <ViewLinkEdge key={(edge.data as unknown as ViewLinkData).i} {...edge as EdgeProps} sourceX={0} sourceY={0} targetX={100} targetY={100}
          sourcePosition={Position.Bottom} targetPosition={Position.Top} />
      ))}
    </svg></EdgeLabelLayer></ReactFlowProvider>,
  )
  const traces = committed(VIEW_LINK).map((edge) => {
    const { i } = edge.data as unknown as ViewLinkData
    return [i, boardTrace(rendered.container, i)] as const
  })
  rendered.unmount()
  return new Map(traces)
}

function draw(view: View) {
  useViewStore.setState({ view, sid: view.id })
  commitBoard()
  render(<ViewLegend open onOpenChange={() => {}} />)
  return screen.getByTestId('view-key-lines')
}

const glyph = (el: Element | null | undefined) => el?.querySelector('svg')?.getAttribute('class')?.match(/lucide-[\w-]+/g) ?? null

function boardTrace(canvas: Element, i: number) {
  const edge = canvas.querySelector(`[data-view-link="links.${i}"]`)!
  const line = edge.querySelector('.react-flow__edge-path')!
  const markerId = line.getAttribute('marker-end')?.match(/^url\(#(.+)\)$/)?.[1]
  const marker = markerId === undefined ? null : edge.querySelector(`marker[id="${markerId}"]`)
  const style = applied(line)
  return {
    stroke: style.stroke,
    dash: style.strokeDasharray ?? null,
    width: Number.parseFloat(style.strokeWidth!),
    mark: glyph(canvas.querySelector(`[data-view-link-mark="links.${i}"]`)),
    endStroke: marker === null ? null : applied(marker.querySelector('circle, path')!).fill,
    end: marker?.querySelector('circle') ? 'dot' : marker?.querySelector('path') ? 'arrow' : 'none',
    halos: [...edge.querySelectorAll('[data-link-halo-path]')].map((halo) => {
      const css = applied(halo)
      return [css.stroke, css.strokeWidth, css.strokeDasharray ?? null]
    }),
  }
}

function keyTrace(sample: SVGSVGElement) {
  const [line, ...ends] = [...sample.querySelectorAll('path:not(.ok-link-halo)')]
  const style = applied(line!)
  return {
    stroke: style.stroke ?? line!.getAttribute('stroke'),
    dash: style.strokeDasharray ?? line!.getAttribute('stroke-dasharray'),
    width: Number.parseFloat(line!.getAttribute('stroke-width')!),
    mark: glyph(sample.closest('[data-key-look]')?.querySelector('[data-key-direction]')),
    endStroke: sample.querySelector('circle')?.getAttribute('fill') ?? ends[0]?.getAttribute('stroke') ?? null,
    end: sample.querySelector('circle') ? 'dot' : ends.length > 0 ? 'arrow' : 'none',
    halos: [...sample.querySelectorAll('.ok-link-halo')].map((halo) => {
      const css = applied(halo)
      return [css.stroke, css.strokeWidth, css.strokeDasharray ?? null]
    }),
  }
}

const samples = (key: Element) => [...key.querySelectorAll<SVGSVGElement>('svg[data-key-sample]')]
const tracesOf = (traces: Iterable<ReturnType<typeof keyTrace>>) => [...new Set([...traces].map((trace) => JSON.stringify(trace)))].sort()

function expectCommittedLooks(key: Element) {
  const edges = committedEdges()
  const traces = samples(key).map(keyTrace)
  expect(traces.map((trace) => JSON.stringify(trace)).sort()).toEqual(tracesOf(edges.values()))
  return edges
}

const cases = [
  { name: 'the real capacity View', view: capacity, reasons: [14] },
  { name: 'the capacity links with typed key items', view: typed(model.links, ['reason', 'doubted', 'alert']), reasons: [14] },
  {
    name: 'doubted and alerted reasons, with and without proposals',
    view: typed([reason, { ...reason, doubt: true, alert: true, proposed: true }, unsigned({ role: 'size' })], ['reason', 'doubted', 'alert', 'olumi', 'size']),
    reasons: [1],
  },
  {
    name: 'unsigned links only',
    view: typed([
      effect('unknown', { doubt: true }), effect('depends'), unsigned({ role: 'input' }),
      unsigned({ role: 'size', doubt: true }), unsigned({ role: 'measures' }), unsigned({ role: 'target' }),
    ], ['effect', 'doubted', 'unsettled', 'input', 'size', 'measures', 'target']),
  },
  {
    name: 'signed controls and an unmodified size link',
    view: typed([
      effect('raises'), effect('lowers'), effect('raises', { doubt: true }), effect('lowers', { doubt: true }),
      effect('raises', { alert: true }), effect('raises', { proposed: true }), unsigned({ role: 'size' }),
    ], ['effect', 'doubted', 'alert', 'olumi', 'size']),
  },
  {
    name: 'signed links with combined modifiers',
    view: typed([
      effect('lowers', { alert: true }), effect('raises', { proposed: true, doubt: true }),
      effect('raises', { alert: true, proposed: true }), effect('depends'), effect('depends'),
    ], ['effect', 'doubted', 'alert', 'olumi', 'unsettled']),
  },
]

it.each(cases)('shows every distinct committed Detailed look for $name', ({ view, reasons }) => {
  const edges = expectCommittedLooks(draw(view))
  for (const index of reasons ?? []) {
    const trace = edges.get(index)!
    expect(trace).toMatchObject({ stroke: 'var(--olumi-mark-orange)', dash: '5 4', end: 'arrow' })
    expect(trace.halos).toEqual(view.model!.links[index]!.proposed ? [['var(--semantic-info)', '3px', trace.dash]] : [])
  }
})

it('a size edge with a direction keeps its stroke and omits its direction mark', () => {
  const key = draw(typed([effect('lowers', { role: 'size' })], ['size']))
  const edge = expectCommittedLooks(key).get(0)!
  expect(edge).toMatchObject({ stroke: 'var(--edge-negative)', mark: null })
  expect(key.querySelector('[data-key-direction]')).toBeNull()
  expect(key.querySelector('[data-key-item="size"]')?.textContent).toBe('Core’s size explanation')
})

const borrowed = {
  ...model.cards[0]!, id: 'invented_relation', family: 'relation', author: { by: 'olumi' },
} as unknown as typeof model.cards[number]
const joined = effect('lowers', { proposed: false, alert: false, doubt: false })
const relation = typed([
  joined, { ...reason, from: borrowed.id, to: joined.from }, { ...reason, from: borrowed.id, to: joined.to },
], ['effect', 'olumi'])
const relationView = { ...relation, model: { ...relation.model!, cards: [...model.cards, borrowed], first_draft: false } } as View

it('an Olumi relation card leaves a proposal halo on its committed link', () => {
  const key = draw(relationView)
  const edges = expectCommittedLooks(key)
  expect(edges.size).toBe(1)
  expect(edges.get(0)?.halos).toEqual([['var(--semantic-info)', '3px', null]])
  expect(key.querySelector('[data-key-item="halo-proposed"]')?.textContent).toBe('Core’s olumi explanation')
})

it('a first draft keeps the same relation link without the proposal halo', () => {
  const key = draw({ ...relationView, model: { ...relationView.model!, first_draft: true } } as View)
  expect(expectCommittedLooks(key).get(0)?.halos).toEqual([])
  expect(key.querySelector('[data-key-item="halo-proposed"] svg')).toBeNull()
})

it.each(['replacement View', 'scenario change'] as const)('%s shows words during the pending layout, then restores swatches on an owner-only commit', (change) => {
  const key = draw(relationView)
  const before = useCanvasStore.getState()
  expectCommittedLooks(key)
  const replacement = change === 'replacement View' ? structuredClone(relationView) : relationView
  const sid = change === 'scenario change' ? 'sid-other' : replacement.id
  act(() => useViewStore.setState({ view: replacement, sid }))
  expect(useCanvasStore.getState().edges).toBe(before.edges)
  expect(samples(key)).toHaveLength(0)
  expect(key.querySelector('[data-key-item="halo-proposed"]')?.textContent).toBe('Core’s olumi explanation')
  act(commitBoard)
  const after = useCanvasStore.getState()
  expect(after.nodes).toBe(before.nodes)
  expect(after.layoutRequestId).toBe(before.layoutRequestId)
  const [edge] = committed(VIEW_LINK)
  const owner = (edge!.data as unknown as ViewLinkData).owner
  expect(owner.view).toBe(replacement)
  expect(owner.sid).toBe(sid)
  expectCommittedLooks(key)
  expect(samples(key)).toHaveLength(1)
})

describe('Simple folded inputs (PL 1526): a swatch stands only for a link the board draws as itself', () => {
  /** INVENTED: capacity with one input card copied (no links) until Simple folds the inputs; one link from a real input carries the alert halo. */
  const folded = (() => {
    const drawn0 = drawnModelOf(model)
    const inputs = new Set(inputIdsOf(drawn0))
    const at = model.links.findIndex((l) => inputs.has(l.from) && !inputs.has(l.to))
    const seed = model.cards.find((c) => c.id === model.links[at]!.from)!
    const cards = [...model.cards]
    for (let i = 0; inputIdsOf(drawnModelOf({ ...model, cards })).length < 15; i++) cards.push({ ...seed, id: `invented_input_${i}`, badge: null } as typeof seed)
    const links = model.links.map((l, i) => (i === at ? effect('raises', { from: l.from, to: l.to, alert: true }) : { ...l, alert: false, proposed: false }))
    return { at, view: { ...typed(links, ['effect', 'alert']), id: 'sid-folded', model: { ...model, cards, links, key: [{ id: 'effect', glyph: '', text: 'Core’s effect explanation' }, { id: 'alert', glyph: '', text: 'Core’s alert explanation' }] } } as View }
  })()
  function drawSimple(open: boolean) {
    setDefaultLevel('simple')
    useInputsOpen.setState({ open: open ? { [folded.view.id]: true } : {} })
    return draw(folded.view)
  }
  it('the fixture folds and the alerted link runs from a folded input', () => {
    expect(inputsFolded(folded.view.id, drawnModelOf(folded.view.model!), {})).toBe(true)
    expect(inputIdsOf(drawnModelOf(folded.view.model!))).toContain(folded.view.model!.links[folded.at]!.from)
  })
  it('folded: the board draws no single edge for it, and the key keeps Core’s alert words with no halo swatch', () => {
    const key = drawSimple(false)
    const edges = expectCommittedLooks(key)
    expect(edges.has(folded.at)).toBe(false)
    const row = key.querySelector('[data-key-item="halo-alert"]')!
    expect(row.textContent).toBe('Core’s alert explanation')
    expect(row.querySelector('[data-key-sample]')).toBeNull()
  })
  const link = () => folded.view.model!.links[folded.at]!
  /** The folded link is drawn as a neutral group connector into its target (GroupLinkEdge), not as its own link edge. */
  const connectorDrawn = () => committed(GROUP_LINK).some((e) => e.target === link().to && e.source !== link().from)
  it('one mounted key follows the committed board: a fold change shows in the key only once the canvas commits it', () => {
    const key = drawSimple(false)
    const swatch = () => key.querySelector('[data-key-item="halo-alert"] svg[data-key-sample]') !== null
    expect([connectorDrawn(), swatch()]).toEqual([true, false])
    act(() => useInputsOpen.setState({ open: { [folded.view.id]: true } }))
    expect([connectorDrawn(), swatch()]).toEqual([true, false]) // layout pending: the folded board is still up, and so is its key
    act(() => { commitBoard() })
    expect([connectorDrawn(), swatch()]).toEqual([false, true])
    act(() => useInputsOpen.setState({ open: {} }))
    expect(swatch()).toBe(true) // the opened board is still drawn
    expectCommittedLooks(key)
    act(() => { commitBoard() })
    expect([connectorDrawn(), swatch()]).toEqual([true, false])
  })
  it('opened: the board draws the edge and the key’s halo swatch matches it', () => {
    const key = drawSimple(true)
    const edge = expectCommittedLooks(key).get(folded.at)!
    const sample = key.querySelector<SVGSVGElement>('[data-key-item="halo-alert"] svg[data-key-sample]')!
    expect(keyTrace(sample)).toEqual(edge)
  })
})

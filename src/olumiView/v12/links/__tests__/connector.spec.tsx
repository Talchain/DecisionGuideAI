import '@testing-library/jest-dom/vitest'
import { readFileSync } from 'node:fs'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { Position, ReactFlow } from '@xyflow/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ToastProvider } from '../../../../canvas/ToastContext'
import { ViewLinkEdge } from '../../../../canvas/edges/ViewLinkEdge'
import { useCanvasStore } from '../../../../canvas/store'
import { drawViewCanvas, GROUP_LINK, ROOT_LINK, useViewFocusLink, VIEW_LINK } from '../../../canvas'
import type { View, ViewLink } from '../../../client'
import { RootLinkEdge } from '../../../previous/RootLinkEdge'
import { useViewStore } from '../../../store'
import { ViewLegend } from '../../../ViewLegend'
import { GroupLinkEdge } from '../../bands/GroupLinkEdge'
import { GROUP_ID_PREFIX } from '../../bands/groups'
import { KeyLines } from '../../bands/KeyPill'
import { useFocusPath } from '../../bands/focusPath'
import { LaneInspector } from '../../edit/LaneInspector'
import { useLaneInspector } from '../../edit/inspectorStore'
import { showSimple, showWholeModel } from '../../simpleStore'
import { connectorLookOf, ROOT_LOOK, type ConnectorLook } from '../connector'

const fixture = (name: string) => JSON.parse(readFileSync(`src/olumiView/fixtures/real/${name}.view3.json`, 'utf8')) as View
const hiring = fixture('hiring')
const model = hiring.model!
const plain: ViewLink = { ...model.links[0]!, kind: 'plain', causal: null, doubt: false, alert: false, proposed: false }
const signed = (sign: 'increases' | 'decreases'): ViewLink => ({
  ...plain,
  causal: {
    sign, of: 'more_of_from', target: plain.to, disputed: false, author: null, text: '',
    strength: { state: 'in_words', figure: null, low: null, likely: null, high: null, unit: null, per: null, share: null, relative_to: null },
  },
})
const effect = { id: 'effect', glyph: '→', text: 'Modelled effect' }
const parallel = [signed('increases'), { ...signed('decreases'), title: 'The second causal link' }]
const viewWith = (links: ViewLink[], key = [effect]): View => ({ ...hiring, model: { ...model, links, key } })
const commit = (view: View, detailed = false) => {
  useViewStore.setState({ sid: view.id, view })
  if (detailed) showWholeModel(view.id)
  else showSimple(view.id)
  drawViewCanvas(view.model!, new Map())
}
const edgeTypes = { [VIEW_LINK]: ViewLinkEdge, [ROOT_LINK]: RootLinkEdge, [GROUP_LINK]: GroupLinkEdge }
function Board() {
  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)
  return <ReactFlow edgeTypes={edgeTypes} edges={edges} nodes={nodes.map((node) => ({
    ...node, type: 'default', initialWidth: 120, initialHeight: 60,
    handles: [
      { type: 'source', position: Position.Bottom, x: 60, y: 60 },
      { type: 'target', position: Position.Top, x: 60, y: 0 },
    ],
  }))} />
}
const key = () => screen.getByTestId('view-key-lines')
const looks = (el: ParentNode) => new Set([...el.querySelectorAll('[data-look]')].map((item) => item.getAttribute('data-look')))
const boardLooks = (el: ParentNode) => looks(el.querySelector('.react-flow')!)
const rows = () => [...key().querySelectorAll('[data-key-row="lines"] [data-key-item]')].map((row) => row.textContent)

afterEach(() => {
  cleanup()
  useViewStore.setState({ sid: null, view: null })
  useCanvasStore.setState({ nodes: [], edges: [] })
  useFocusPath.setState({ path: null })
})

describe('one View connector', () => {
  it.each([
    'src/olumiView/v12/bands/KeyPill.tsx',
    'src/canvas/edges/ViewLinkEdge.tsx',
    'src/olumiView/previous/RootLinkEdge.tsx',
    'src/olumiView/v12/bands/GroupLinkEdge.tsx',
  ])('keeps drawing primitives in the shared drawer (%s)', (file) => {
    expect(readFileSync(file, 'utf8')).not.toMatch(/<path\b|\bstrokeWidth\b|\bstroke\s*=/)
  })

  it.each<{ name: string; link: ViewLink; flags?: Partial<Parameters<typeof connectorLookOf>[1]>; want: Partial<ConnectorLook> }>([
    { name: 'effect role alone', link: { ...plain, role: 'effect' }, want: {} },
    { name: 'input role', link: { ...plain, role: 'input' }, want: { end: 'dot' } },
    { name: 'size role', link: { ...plain, role: 'size' }, want: { end: 'none' } },
    { name: 'measures role', link: { ...plain, role: 'measures' }, want: { tone: 'goal', end: 'none' } },
    { name: 'target role', link: { ...plain, role: 'target' }, want: { tone: 'goal' } },
    { name: 'positive sign', link: signed('increases'), want: { tone: 'positive' } },
    { name: 'negative sign', link: signed('decreases'), want: { tone: 'negative' } },
    { name: 'typed direction takes precedence', link: { ...signed('increases'), direction: 'depends' }, want: {} },
    { name: 'reason role', link: { ...plain, role: 'reason' }, want: { dash: 'dotted' } },
    { name: 'doubt over reason dots', link: { ...plain, kind: 'reason' as const, doubt: true }, want: { dash: 'doubt' } },
    { name: 'reason alert', link: { ...plain, kind: 'reason' as const, alert: true }, want: { dash: 'dotted', reasonAlert: true } },
    { name: 'both halos', link: { ...signed('decreases'), alert: true, proposed: true }, want: { tone: 'negative', halo: 'both' } },
    { name: 'first draft', link: { ...plain, alert: true, proposed: true }, flags: { firstDraft: true }, want: { halo: 'alert' } },
    { name: 'Olumi inferred link', link: plain, flags: { byOlumi: true }, want: { halo: 'proposed' } },
    { name: 'plain driver', link: plain, flags: { driver: true }, want: { tone: 'ink' } },
    { name: 'modelled driver keeps polarity', link: signed('increases'), flags: { driver: true }, want: { tone: 'positive' } },
  ])('uses the existing appearance for $name', ({ link, flags, want }) => {
    expect(connectorLookOf(link, { firstDraft: false, byOlumi: false, driver: false, ...flags }))
      .toEqual({ ...ROOT_LOOK, end: 'arrow', ...want })
  })

  it.each(['hiring', 'european-22cards', 'bakery-r5'])('matches every mounted connector look on %s', (name) => {
    commit(fixture(name), true)
    const { container } = render(<><Board /><KeyLines /></>)
    expect(container.querySelectorAll('.react-flow [data-look]')).toHaveLength(useCanvasStore.getState().edges.length)
    expect(boardLooks(container).size).toBeGreaterThan(0)
    expect(looks(key())).toEqual(boardLooks(container))
  })

  it('uses the committed group connector when its member link is folded away', () => {
    const view = viewWith([parallel[0]!])
    const group = `${GROUP_ID_PREFIX}test`
    const board = { ...view.model!, cards: view.model!.cards.map((card) => card.id === plain.from ? { ...card, id: group } : card) }
    useViewStore.setState({ sid: view.id, view })
    showSimple(view.id)
    drawViewCanvas(board, new Map(), [], [{ from: group, to: plain.to, count: 1 }])
    const { container } = render(<><Board /><KeyLines /></>)
    expect(container.querySelectorAll('.react-flow [data-look]')).toHaveLength(1)
    expect(container.querySelector('[data-group-link] .ok-link-line')).toHaveAttribute('marker-end')
    expect(rows()).toEqual(['line with arrow'])
    expect(looks(key())).toEqual(boardLooks(container))
  })

  it('opens with an empty Core key and describes the line by appearance', () => {
    commit(viewWith([{ ...plain, doubt: true }], []))
    render(<ViewLegend open onOpenChange={() => {}} />)
    const legend = screen.getByRole('dialog', { name: 'How to read this' })
    expect(within(legend).getByText('dashed line')).toBeInTheDocument()
    expect(rows()).toEqual(['dashed line'])
    expect(legend.querySelector('[data-view-key]')).toBeNull()
  })

  it('draws both parallels and opens the second link in the inspector', () => {
    const view = viewWith(parallel)
    commit(view)
    const ids = parallel.map((link, i) => `${link.from}->${link.to}:${link.kind}#${i}`)
    expect(useCanvasStore.getState().edges.map((edge) => edge.id)).toEqual(ids)
    render(<ToastProvider><Board /><KeyLines /><LaneInspector /></ToastProvider>)
    expect(rows()).toEqual([effect.text])
    expect(key().querySelectorAll('[data-look]')).toHaveLength(2)
    fireEvent.click(screen.getByTestId(`rf__edge-${ids[1]}`).querySelector('.react-flow__edge-interaction')!)
    expect(screen.getByTestId('lane-inspector-title')).toHaveTextContent(parallel[1]!.title)
    act(() => {
      useViewFocusLink.setState({ id: ids[1]! })
      useCanvasStore.getState().selectEdgeWithoutHistory(ids[1]!)
      useViewStore.setState({ view: viewWith([...parallel].reverse()) })
    })
    expect(useLaneInspector.getState().current).toBeNull()
    expect(useViewFocusLink.getState().id).toBeNull()
    expect(useCanvasStore.getState().selection.edgeIds.size).toBe(0)
    fireEvent.click(screen.getByTestId(`rf__edge-${ids[1]}`).querySelector('.react-flow__edge-interaction')!)
    expect(screen.queryByTestId('lane-inspector-title')).toBeNull()
  })

  it('keeps key swatches resting while the board is lit or focused', () => {
    commit(viewWith([plain]))
    const { container } = render(<><Board /><KeyLines /></>)
    const before = rows()
    act(() => {
      useViewFocusLink.setState({ id: useCanvasStore.getState().edges[0]!.id })
      useFocusPath.setState({ path: new Set([plain.from, plain.to]) })
    })
    expect(container.querySelector('.react-flow .ok-link-on-path')).toBeInTheDocument()
    expect(key().querySelector('.ok-link-on-path')).toBeNull()
    expect(looks(key())).toEqual(boardLooks(container))
    expect(rows()).toEqual(before)
  })

  it('keeps the committed rows pending redraw, including the Core wording', () => {
    commit(viewWith([parallel[0]!]))
    const { container } = render(<><Board /><KeyLines /></>)
    const before = looks(key())
    const pending = viewWith([parallel[1]!], [{ ...effect, text: 'Revised effect' }])
    act(() => { useViewStore.setState({ view: pending }) })
    expect(looks(key())).toEqual(before)
    expect(rows()).toEqual([effect.text])
    act(() => { drawViewCanvas(pending.model!, new Map()) })
    expect(looks(key())).toEqual(boardLooks(container))
    expect(looks(key())).not.toEqual(before)
    expect(rows()).toEqual(['Revised effect'])
  })

  it.each(['src/canvas/edges/StyledEdge.tsx', 'src/canvas/components/CanvasLegendPopover.tsx'])('leaves the older UI isolated (%s)', (file) => {
    expect(readFileSync(file, 'utf8')).not.toMatch(/from\s+['"][^'"]*\/connector(?:\.tsx)?['"]/)
  })
})

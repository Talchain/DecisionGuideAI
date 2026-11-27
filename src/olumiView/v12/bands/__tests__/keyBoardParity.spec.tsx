// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Position, ReactFlowProvider, type EdgeProps } from '@xyflow/react'
import { ViewLinkEdge } from '../../../../canvas/edges/ViewLinkEdge'
import { EdgeLabelLayer } from '../../../__tests__/edgeLabelLayer'
import type { View, ViewLink } from '../../../client'
import { drawnModelOf, QUESTION } from '../../../layout'
import * as layout from '../../../layout'
import { ICONS } from '../../../look/icons'
import { TIP_DELAY } from '../../../look/Tip'
import { useViewStore } from '../../../store'
import { ViewLegend } from '../../../ViewLegend'
import { boardOf, drawViewCanvas, GROUP_LINK, placeViewCards, VIEW_LINK, type ViewLinkData } from '../../../canvas'
import { useCanvasStore } from '../../../../canvas/store'
import { setDefaultLevel, setLevel, useSimpleLevel } from '../../simpleStore'
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
  model: { ...model, links, key: ids.map((id) => ({ id, glyph: '·', text: `Core’s ${id} explanation` })) },
})

afterEach(() => {
  cleanup()
  useViewStore.setState({ view: null, sid: null })
  setDefaultLevel('working')
  useInputsOpen.setState({ open: {} })
  useSimpleLevel.setState({ levels: {} })
  window.localStorage.clear()
  useCanvasStore.setState({ nodes: [], edges: [], viewCanvasOwner: null })
  vi.restoreAllMocks()
  vi.useRealTimers()
})

/** PL 1647: the key follows what the canvas committed. Commit the board as the canvas does (drawViewCanvas over boardOf). */
const commitBoard = () => { const b = boardOf(useViewStore.getState().view!.model!); drawViewCanvas(b.model, new Map(), b.extras, b.links) }
/** The committed edges of one type, from the canvas store. */
const committed = (type: string) => useCanvasStore.getState().edges.filter((e) => e.type === type)
/** Render the committed edge props, including the exact owner object stored by the board. */
function renderCommittedEdges() {
  return render(
    <ReactFlowProvider><EdgeLabelLayer><svg>
      {committed(VIEW_LINK).map((edge) => (
        <ViewLinkEdge key={(edge.data as unknown as ViewLinkData).i} {...edge as EdgeProps} sourceX={0} sourceY={0} targetX={100} targetY={100}
          sourcePosition={Position.Bottom} targetPosition={Position.Top} />
      ))}
    </svg></EdgeLabelLayer></ReactFlowProvider>,
  )
}

function committedEdges() {
  const rendered = renderCommittedEdges()
  const traces = committed(VIEW_LINK).map((edge) => {
    const { i } = edge.data as unknown as ViewLinkData
    return [i, boardTrace(rendered.container, i)] as const
  })
  rendered.unmount()
  return new Map(traces)
}

function draw(view: View, commit = true) {
  useViewStore.setState({ view, sid: view.id })
  if (commit) commitBoard()
  render(<ViewLegend open onOpenChange={() => {}} />)
  return screen.getByTestId('view-key-lines')
}

const glyph = (el: Element | null | undefined) => el?.querySelector('svg')?.getAttribute('class')?.match(/lucide-[\w-]+/g) ?? null

function endOf(svg: Element, line: Element) {
  const id = line.getAttribute('marker-end')?.match(/^url\(#(.+)\)$/)?.[1]
  const marker = [...svg.querySelectorAll('marker')].find((m) => m.id === id)
  const shape = marker?.querySelector('circle, path')
  return {
    end: shape?.tagName ?? null,
    endShape: shape?.getAttribute('d') ?? shape?.getAttribute('r') ?? null,
    endStroke: shape ? applied(shape).fill : null,
  }
}

function boardTrace(canvas: Element, i: number) {
  const edge = canvas.querySelector(`[data-view-link="links.${i}"]`)!
  const line = edge.querySelector('.react-flow__edge-path')!
  const style = applied(line)
  return {
    stroke: style.stroke,
    dash: style.strokeDasharray ?? null,
    cap: style.strokeLinecap ?? 'butt',
    width: Number.parseFloat(style.strokeWidth!),
    mark: glyph(canvas.querySelector(`[data-view-link-mark="links.${i}"]`)),
    ...endOf(edge, line),
    halos: [...edge.querySelectorAll('[data-link-halo-path]')].map((halo) => {
      const css = applied(halo)
      return [css.stroke, css.strokeWidth, css.strokeDasharray ?? null]
    }),
  }
}

function keyTrace(sample: SVGSVGElement) {
  const line = sample.querySelector('path:not(.ok-link-halo)')!
  const style = applied(line!)
  return {
    stroke: style.stroke ?? line!.getAttribute('stroke'),
    dash: style.strokeDasharray ?? line!.getAttribute('stroke-dasharray'),
    cap: line.getAttribute('stroke-linecap') ?? 'butt',
    width: Number.parseFloat(line!.getAttribute('stroke-width')!),
    mark: glyph(sample.closest('[data-key-look]')?.querySelector('[data-key-direction]')),
    ...endOf(sample, line),
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
  expect(tracesOf(traces)).toEqual(tracesOf(edges.values()))
  return edges
}

const cases = [
  // Red on f54041ee: the real board's unlabelled link looks had no swatches.
  { name: 'the real capacity View', view: capacity, reasons: [14] },
  // Red on f54041ee: a typed reason had words only.
  { name: 'the capacity links with typed key items', view: typed(model.links, ['reason', 'doubted', 'alert']), reasons: [14] },
  // Red on f54041ee: the doubted reason with both alert ink and a proposal lacked a swatch.
  {
    name: 'doubted and alerted reasons, with and without proposals',
    view: typed([reason, { ...reason, doubt: true, alert: true, proposed: true }, unsigned({ role: 'size' })], ['reason', 'doubted', 'alert', 'olumi', 'size']),
    reasons: [1],
  },
  {
    name: 'unsigned links only',
    // Red on f54041ee: the unknown and depends marks lost their complete line looks.
    view: typed([
      effect('unknown', { doubt: true }), effect('depends'), unsigned({ role: 'input' }),
      unsigned({ role: 'size', doubt: true }), unsigned({ role: 'measures' }), unsigned({ role: 'target' }),
    ], ['effect', 'doubted', 'unsettled', 'input', 'size', 'measures', 'target']),
  },
  {
    name: 'signed controls and an unmodified size link',
    // Red on f54041ee: the control swatches used a chevron in place of the filled marker.
    view: typed([
      effect('raises'), effect('lowers'), effect('raises', { doubt: true }), effect('lowers', { doubt: true }),
      effect('raises', { alert: true }), effect('raises', { proposed: true }), unsigned({ role: 'size' }),
    ], ['effect', 'doubted', 'alert', 'olumi', 'size']),
  },
  {
    name: 'signed links with combined modifiers',
    // Red on f54041ee: combined halos and doubt had no matching swatch.
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
    expect(trace).toMatchObject({ stroke: 'var(--olumi-mark-orange)', dash: '5 4', cap: 'butt', end: 'path' })
    expect(trace.halos).toEqual(view.model!.links[index]!.proposed ? [['var(--semantic-info)', '3px', trace.dash]] : [])
  }
})

// Red with SizeDirectionMark (keep the mark on size links).
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
const joined = effect('raises', { proposed: false, alert: false, doubt: false })
const relation = typed([
  joined, { ...reason, from: borrowed.id, to: joined.from }, { ...reason, from: borrowed.id, to: joined.to },
], ['effect', 'olumi'])
const relationView = { ...relation, model: { ...relation.model!, cards: [...model.cards, borrowed], first_draft: false } } as View

// Red with IgnoreRelationAuthor (omit inferred Olumi authorship from the proposal halo).
it('an Olumi relation card leaves a proposal halo on its committed link', () => {
  const key = draw(relationView)
  const edges = expectCommittedLooks(key)
  expect(edges.size).toBe(1)
  expect(edges.get(0)?.halos).toEqual([['var(--semantic-info)', '3px', null]])
  expect(key.querySelector('[data-key-item="halo-proposed"]')?.textContent).toBe('Core’s olumi explanation')
})

// Red with KeepAbsentProposalRow (keep Core’s olumi row without a proposal swatch).
it('a first draft keeps the same relation link without the proposal halo or row', () => {
  const key = draw({ ...relationView, model: { ...relationView.model!, first_draft: true } } as View)
  expect(expectCommittedLooks(key).get(0)?.halos).toEqual([])
  expect(key.querySelector('[data-key-item="halo-proposed"]')).toBeNull()
})

// Red on f54041ee: a scenario change leaves the pre-existing raised proposal swatch visible.
it('a scenario change leaves words pending until an owner-only commit', () => {
  const key = draw(relationView)
  const before = useCanvasStore.getState()
  expect(samples(key)).toHaveLength(1)
  const sid = 'sid-other'
  act(() => useViewStore.setState({ sid }))
  expect(useCanvasStore.getState().edges).toBe(before.edges)
  expect(samples(key)).toHaveLength(0)
  expect(key.querySelector('[data-key-item="halo-proposed"]')?.textContent).toBe('Core’s olumi explanation')
  act(commitBoard)
  const after = useCanvasStore.getState()
  expect(after.nodes).toBe(before.nodes)
  expect(after.layoutRequestId).toBe(before.layoutRequestId)
  const [edge] = committed(VIEW_LINK)
  const owner = (edge!.data as unknown as ViewLinkData).owner
  expect(owner.view).toBe(relationView)
  expect(owner.sid).toBe(sid)
  expectCommittedLooks(key)
  expect(samples(key)).toHaveLength(1)
})

// Red with BoardReadsCommittedOwner (read first draft, authorship and key words from the edge owner).
// Red on f54041ee for key invalidation: its raised proposal swatch survives before the replacement commits.
it('a replacement View updates the board’s live reads while the key waits for its commit', () => {
  const view = { ...relationView, model: {
    ...relationView.model!, links: [{ ...joined, label_key: 'link-word' }, ...relationView.model!.links.slice(1)],
    key: [...relationView.model!.key, { id: 'link-word', glyph: '+', text: 'Original Core link word' }],
  } }
  const key = draw(view)
  const { container } = renderCommittedEdges()
  const edge = container.querySelector('[data-view-link="links.0"]')!
  const before = useCanvasStore.getState().edges
  expect(samples(key)).toHaveLength(1)
  expect(edge.getAttribute('data-link-halo')).toBe('proposed')
  expect(edge.getAttribute('data-olumi')).toBe('true')
  vi.useFakeTimers()
  const tip = () => {
    fireEvent.pointerEnter(edge)
    act(() => vi.advanceTimersByTime(TIP_DELAY))
    const text = screen.getByRole('tooltip').textContent
    fireEvent.pointerLeave(edge)
    return text
  }
  expect(tip()).toContain('Original Core link word')
  const replacement = { ...view, model: { ...view.model, first_draft: true,
    key: view.model.key.map((item) => item.id === 'link-word' ? { ...item, text: 'Replacement Core link word' } : item),
  } }
  act(() => useViewStore.setState({ view: replacement }))
  expect(useCanvasStore.getState().edges).toBe(before)
  expect(edge.getAttribute('data-link-halo')).toBeNull()
  expect(tip()).toContain('Replacement Core link word')
  expect(samples(key)).toHaveLength(0)
  act(() => useViewStore.setState({ view: { ...replacement, model: {
    ...replacement.model, cards: replacement.model.cards.filter((card) => card.id !== borrowed.id),
  } } }))
  expect(edge.getAttribute('data-olumi')).toBeNull()
  expect(useCanvasStore.getState().edges).toBe(before)
  expect(samples(key)).toHaveLength(0)
  act(commitBoard)
  expect(samples(key)).toHaveLength(1)
  expect(key.querySelector('[data-key-item="link-word"]')?.textContent).toBe('Replacement Core link word')
})

// Red with EmptyMeansPending (require a link edge before recognizing a matching commit).
it('an empty commit removes the pending words and keeps both attribution marks', () => {
  const key = draw(typed([], ['effect', 'alert']), false)
  expect(key.querySelector('[data-key-item="effect"]')?.textContent).toBe('Core’s effect explanation')
  expect(samples(key)).toHaveLength(0)
  act(commitBoard)
  expect(committed(VIEW_LINK)).toHaveLength(0)
  expect(useCanvasStore.getState().viewCanvasOwner?.view).toBe(useViewStore.getState().view)
  expect([...key.querySelectorAll('[data-key-item]')].map((row) => row.textContent)).toEqual(["Olumi's", "a person's"])
})

// Red with CategoryBeforeLinkKey (prefer the look category), or AppendPolarity (append UI polarity text).
it('uses the link’s key item, then its look category, then its registry mark word', () => {
  const key = draw(typed([
    effect('raises', { label: '+', label_key: 'belief' }),
    effect('lowers', { label_key: null }),
    effect('depends', { label_key: 'missing' }),
  ], ['effect', 'belief']))
  expect(key.querySelector('[data-key-item="belief"]')?.textContent).toBe('Core’s belief explanation')
  expect(key.querySelector('[data-key-item="effect"]')?.textContent).toBe('Core’s effect explanation')
  expect(key.querySelector('[data-key-item="effect"] [data-key-direction="lowers"]')).not.toBeNull()
  expect(key.querySelector('[data-key-item="effect"] [data-key-direction="depends"]')).not.toBeNull()
  act(() => {
    useViewStore.setState({ view: typed([effect('depends', { label_key: 'missing' })], ['belief']) })
    commitBoard()
  })
  expect(key.querySelector('[data-key-item="belief"]')).toBeNull()
  expect(key.querySelector('[data-key-item="direction"]')?.textContent).toBe(ICONS['link-depends'].hover)
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
    const view = typed(links, ['effect', 'alert'])
    return { at, view: { ...view, id: 'sid-folded', model: { ...view.model!, cards } } }
  })()
  function drawSimple(open: boolean) {
    setDefaultLevel('simple')
    useInputsOpen.setState({ open: open ? { [folded.view.id]: true } : {} })
    return draw(folded.view)
  }
  // Red with KeepAbsentAlertRow (keep Core’s alert row after the only alerted link folds).
  it('folded: the board draws no single edge for the alerted link, and the key omits its row', () => {
    expect(inputsFolded(folded.view.id, drawnModelOf(folded.view.model!), {})).toBe(true)
    const key = drawSimple(false)
    const edges = expectCommittedLooks(key)
    expect(edges.has(folded.at)).toBe(false)
    expect(key.querySelector('[data-key-item="halo-alert"]')).toBeNull()
  })
  const link = () => folded.view.model!.links[folded.at]!
  /** The folded link is drawn as a neutral group connector into its target (GroupLinkEdge), not as its own link edge. */
  const connectorDrawn = () => committed(GROUP_LINK).some((e) => e.target === link().to && e.source !== link().from)
  // Red with ReadLiveFold (suppress the swatch when the open map changes, before the board commits).
  it('one mounted key follows the committed board: a fold change shows in the key only once the canvas commits it', () => {
    const key = drawSimple(false)
    const row = () => key.querySelector('[data-key-item="halo-alert"]')
    expect([connectorDrawn(), row()]).toEqual([true, null])
    act(() => useInputsOpen.setState({ open: { [folded.view.id]: true } }))
    expect([connectorDrawn(), row()]).toEqual([true, null])
    act(() => { commitBoard() })
    expect(connectorDrawn()).toBe(false)
    expect(row()?.querySelector('svg[data-key-sample]')).not.toBeNull()
    act(() => useInputsOpen.setState({ open: {} }))
    expect(row()?.querySelector('svg[data-key-sample]')).not.toBeNull()
    expectCommittedLooks(key)
    act(() => { commitBoard() })
    expect([connectorDrawn(), row()]).toEqual([true, null])
  })
  // Red on f54041ee: the open board's alert swatch has a chevron in place of the filled marker.
  it('opened: the board draws the edge and the key’s halo swatch matches it', () => {
    const key = drawSimple(true)
    const edge = expectCommittedLooks(key).get(folded.at)!
    const sample = key.querySelector<SVGSVGElement>('[data-key-item="halo-alert"] svg[data-key-sample]')!
    expect(keyTrace(sample)).toEqual(edge)
  })

  // Red with CommitStaleFold or CommitStaleLevel (omit the corresponding projection guard).
  it.each(['fold', 'level'] as const)('Auto-arrange discards an older layout after a %s change commits', async (change) => {
    const view = change === 'fold' ? folded.view : { ...folded.view, model: {
      ...folded.view.model!, cards: [...folded.view.model!.cards, { ...folded.view.model!.cards[0]!, id: 'extra_level_race_card' }],
    } }
    setDefaultLevel('simple')
    useInputsOpen.setState({ open: { [view.id]: true } })
    const key = draw(view)
    expect(key.querySelector('[data-key-item="halo-alert"] svg[data-key-sample]')).not.toBeNull()
    let resolve!: (places: Awaited<ReturnType<typeof layout.causalPlaces>>) => void
    vi.spyOn(layout, 'causalPlaces').mockImplementationOnce(() => new Promise((done) => { resolve = done }))
    const arranged = placeViewCards(view.model!)
    act(() => {
      if (change === 'fold') useInputsOpen.setState({ open: {} })
      else setLevel('working', view.id)
      commitBoard()
    })
    expect(connectorDrawn()).toBe(change === 'fold')
    const edges = useCanvasStore.getState().edges
    await act(async () => {
      resolve(new Map([[QUESTION, { x: -1000, y: -1000 }]]))
      expect(await arranged).toBe(false)
    })
    expect(useCanvasStore.getState().edges).toBe(edges)
    expect(connectorDrawn()).toBe(change === 'fold')
    expect(key.querySelector('[data-key-item="halo-alert"]')?.textContent ?? null).toBe(change === 'fold' ? null : 'Core’s alert explanation')
  })
})

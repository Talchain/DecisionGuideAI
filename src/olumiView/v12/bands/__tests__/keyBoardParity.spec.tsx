// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { View, ViewLink } from '../../../client'
import { drawnModelOf } from '../../../layout'
import { useViewStore } from '../../../store'
import { ViewLegend } from '../../../ViewLegend'
import { boardOf, drawViewCanvas, GROUP_LINK, VIEW_LINK } from '../../../canvas'
import { useCanvasStore } from '../../../../canvas/store'
import { setDefaultLevel } from '../../simpleStore'
import { inputIdsOf } from '../bands'
import { inputsFolded, useInputsOpen } from '../foldStore'
import { applied } from '../../links/__tests__/applied'
import { drawLinkEdge } from '../../links/__tests__/drawEdge'

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
  useViewStore.setState({ view: null })
  useCanvasStore.setState({ nodes: [], edges: [] } as never)
})

/** PL 1647: the key follows what the canvas committed. Commit the board as the canvas does (drawViewCanvas over boardOf). */
const commitBoard = () => { const b = boardOf(useViewStore.getState().view!.model!); drawViewCanvas(b.model, new Map(), b.extras, b.links) }
/** The committed edges of one type, from the canvas store. */
const committed = (type: string) => useCanvasStore.getState().edges.filter((e) => e.type === type)
/** The board's own drawing of each committed link edge, by its place in the View's links. */
const committedEdges = () => new Map(committed(VIEW_LINK).map((e) => { const { link, i } = e.data as unknown as { link: ViewLink; i: number }; return [i, drawLinkEdge(link, i)] }))

function draw(view: View) {
  useViewStore.setState({ view })
  commitBoard()
  render(<ViewLegend open onOpenChange={() => {}} />)
  return { key: screen.getByTestId('view-key-lines'), edges: committedEdges() }
}

function boardTrace(edge: Element) {
  const line = edge.querySelector('.react-flow__edge-path')!
  const markerId = line.getAttribute('marker-end')?.match(/^url\(#(.+)\)$/)?.[1]
  const marker = markerId === undefined ? null : edge.querySelector(`marker[id="${markerId}"]`)
  const style = applied(line)
  return {
    stroke: style.stroke,
    dash: style.strokeDasharray ?? null,
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
    end: sample.querySelector('circle') ? 'dot' : ends.length > 0 ? 'arrow' : 'none',
    halos: [...sample.querySelectorAll('.ok-link-halo')].map((halo) => {
      const css = applied(halo)
      return [css.stroke, css.strokeWidth, css.strokeDasharray ?? null]
    }),
  }
}

const cases = [
  { name: 'the real capacity View', view: capacity, matches: {}, reasons: [14] },
  {
    name: 'the capacity links with typed key items',
    view: typed(model.links, ['reason', 'doubted', 'alert']),
    matches: {},
    textOnly: { dotted: 'reason', doubted: 'doubted', 'halo-alert': 'alert' },
    reasons: [14],
  },
  {
    name: 'doubted and alerted reasons, with and without proposals',
    view: typed([
      reason, { ...reason, doubt: true, alert: true, proposed: true }, unsigned({ role: 'size' }),
    ], ['reason', 'doubted', 'alert', 'olumi', 'size']),
    matches: { size: 2 },
    textOnly: { dotted: 'reason', doubted: 'doubted', 'halo-alert': 'alert', 'halo-proposed': 'olumi' },
    reasons: [1],
  },
  {
    name: 'unsigned links only',
    view: typed([
      effect('unknown', { doubt: true }),
      effect('depends'),
      unsigned({ role: 'input' }),
      unsigned({ role: 'size', doubt: true }),
      unsigned({ role: 'measures' }),
      unsigned({ role: 'target' }),
    ], ['effect', 'doubted', 'unsettled', 'input', 'size', 'measures', 'target']),
    matches: { input: 2, measures: 4, target: 5 },
    textOnly: { doubted: 'doubted', size: 'size' },
    unsettled: true,
  },
  {
    name: 'signed controls and an unmodified size link',
    view: typed([
      effect('raises'), effect('lowers'), effect('raises', { doubt: true }),
      effect('lowers', { doubt: true }), effect('raises', { alert: true }),
      effect('raises', { proposed: true }), unsigned({ role: 'size' }),
    ], ['effect', 'doubted', 'alert', 'olumi', 'size']),
    matches: {
      'effect:increases': 0, 'effect:decreases': 1, 'doubted:increases': 2, 'doubted:decreases': 3,
      'halo-alert': 4, 'halo-proposed': 5, size: 6,
    },
  },
  {
    name: 'signed links with modifiers the restored swatches cannot show',
    view: typed([
      effect('lowers', { alert: true }),
      effect('raises', { proposed: true, doubt: true }),
      effect('raises', { alert: true, proposed: true }),
      effect('depends'),
    ], ['effect', 'doubted', 'alert', 'olumi', 'unsettled']),
    matches: {},
    textOnly: { doubted: 'doubted', 'halo-alert': 'alert', 'halo-proposed': 'olumi', unsettled: 'unsettled' },
  },
]

it.each(cases)('only shows matching board swatches for $name', ({ view, matches, textOnly, unsettled, reasons }) => {
  const { key, edges } = draw(view)
  const samples = [...key.querySelectorAll<SVGSVGElement>('svg[data-key-sample]')].map((sample) => {
    const item = sample.closest('[data-key-item]')!.getAttribute('data-key-item')
    const polarity = sample.closest('[data-key-polarity]')?.getAttribute('data-key-polarity')
    return [polarity ? `${item}:${polarity}` : item, sample] as const
  })
  expect(samples.map(([id]) => id).sort()).toEqual(Object.keys(matches).sort())
  for (const index of reasons ?? []) {
    const edge = edges.get(index)!.querySelector('[data-view-link]')!
    const trace = boardTrace(edge)
    expect(trace).toMatchObject({ stroke: 'var(--olumi-mark-orange)', dash: '5 4', end: 'arrow' })
    expect(edge.querySelector('[data-link-halo-path="alert"]')).toBeNull()
    expect(trace.halos).toEqual(view.model!.links[index]!.proposed ? [['var(--semantic-info)', '3px', trace.dash]] : [])
  }
  const traces = []
  for (const [id, sample] of samples) {
    const index = (matches as Readonly<Record<string, number>>)[id!]!
    const edge = edges.get(index)!.querySelector('[data-view-link]')!
    const trace = keyTrace(sample)
    expect(trace, id!).toEqual(boardTrace(edge))
    traces.push(JSON.stringify(trace))
  }
  expect(new Set(traces).size).toBe(traces.length)

  for (const [item, id] of Object.entries(textOnly ?? {})) {
    const row = key.querySelector(`[data-key-item="${item}"]`)!
    expect(row.textContent).toBe(view.model!.key.find((entry) => entry.id === id)!.text)
    expect(row.querySelector('[data-key-sample]')).toBeNull()
  }
  if (unsettled) {
    const boardMark = edges.get(0)!.querySelector('[data-view-link-unsettled="links.0"] svg')!
    const swatch = key.querySelector('[data-key-sample="unsettled"] svg')!
    expect(swatch.getAttribute('class')?.match(/lucide-[\w-]+/g)).toEqual(boardMark.getAttribute('class')?.match(/lucide-[\w-]+/g))
    expect(key.querySelector('[data-key-direction="unknown"]')).toBeNull()
    expect(key.querySelector('[data-key-item="unsettled"]')?.textContent).toBe('Core’s unsettled explanation')
  }
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
  afterEach(() => {
    setDefaultLevel('working')
    useInputsOpen.setState({ open: {} })
    useViewStore.setState({ sid: null })
  })
  function drawSimple(open: boolean) {
    setDefaultLevel('simple')
    useInputsOpen.setState({ open: open ? { [folded.view.id]: true } : {} })
    useViewStore.setState({ view: folded.view, sid: folded.view.id })
    commitBoard()
    render(<ViewLegend open onOpenChange={() => {}} />)
    return { key: screen.getByTestId('view-key-lines'), edges: committedEdges() }
  }
  it('the fixture folds and the alerted link runs from a folded input', () => {
    expect(inputsFolded(folded.view.id, drawnModelOf(folded.view.model!), {})).toBe(true)
    expect(inputIdsOf(drawnModelOf(folded.view.model!))).toContain(folded.view.model!.links[folded.at]!.from)
  })
  it('folded: the board draws no single edge for it, and the key keeps Core’s alert words with no halo swatch', () => {
    const { key, edges } = drawSimple(false)
    expect(edges.has(folded.at)).toBe(false)
    const row = key.querySelector('[data-key-item="halo-alert"]')!
    expect(row.textContent).toBe('Core’s alert explanation')
    expect(row.querySelector('[data-key-sample]')).toBeNull()
  })
  const link = () => folded.view.model!.links[folded.at]!
  /** The folded link is drawn as a neutral group connector into its target (GroupLinkEdge), not as its own link edge. */
  const connectorDrawn = () => committed(GROUP_LINK).some((e) => e.target === link().to && e.source !== link().from)
  it('one mounted key follows the committed board: a fold change shows in the key only once the canvas commits it', () => {
    const { key } = drawSimple(false)
    const swatch = () => key.querySelector('[data-key-item="halo-alert"] svg[data-key-sample]') !== null
    expect([connectorDrawn(), swatch()]).toEqual([true, false])
    act(() => useInputsOpen.setState({ open: { [folded.view.id]: true } }))
    expect([connectorDrawn(), swatch()]).toEqual([true, false]) // layout pending: the folded board is still up, and so is its key
    act(() => { commitBoard() })
    expect([connectorDrawn(), swatch()]).toEqual([false, true])
    act(() => useInputsOpen.setState({ open: {} }))
    expect(swatch()).toBe(true) // the opened board is still drawn
    act(() => { commitBoard() })
    expect([connectorDrawn(), swatch()]).toEqual([true, false])
  })
  it('a failed or pending layout after a sid switch leaves the previous board, and the key stays with what is drawn', () => {
    const { key } = drawSimple(true)
    const swatch = () => key.querySelector('[data-key-item="halo-alert"] svg[data-key-sample]') !== null
    const drawsIt = () => committed(VIEW_LINK).some((e) => (e.data as unknown as { i: number }).i === folded.at)
    expect([drawsIt(), swatch()]).toEqual([true, true])
    act(() => useViewStore.setState({ sid: 'sid-other' }))
    expect([drawsIt(), swatch()]).toEqual([true, true])
    act(() => { commitBoard() })
    expect([drawsIt(), swatch()]).toEqual([false, false])
  })
  it('contrast, opened: the board draws the edge and the key’s halo swatch matches it', () => {
    const { key, edges } = drawSimple(true)
    const edge = edges.get(folded.at)!.querySelector('[data-view-link]')!
    const sample = key.querySelector<SVGSVGElement>('[data-key-item="halo-alert"] svg[data-key-sample]')!
    expect(sample).not.toBeNull()
    expect(keyTrace(sample)).toEqual(boardTrace(edge))
  })
})

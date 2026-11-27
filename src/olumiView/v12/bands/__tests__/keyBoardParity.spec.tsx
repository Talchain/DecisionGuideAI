// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import type { View, ViewLink } from '../../../client'
import { cardLinks, drawnModelOf } from '../../../layout'
import { useViewStore } from '../../../store'
import { ViewLegend } from '../../../ViewLegend'
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
})

function draw(view: View) {
  useViewStore.setState({ view })
  render(<ViewLegend open onOpenChange={() => {}} />)
  const edges = new Map(
    cardLinks(drawnModelOf(view.model!)).map(({ link, i }) => [i, drawLinkEdge(link, i)]),
  )
  return { key: screen.getByTestId('view-key-lines'), edges }
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

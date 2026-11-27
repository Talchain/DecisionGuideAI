import { readFileSync } from 'node:fs'
import { Position } from '@xyflow/react'
import { act, cleanup, fireEvent, render, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useCanvasStore } from '../../../../canvas/store'
import { ViewCanvas } from '../../../ViewCanvas'
import { ViewLegend } from '../../../ViewLegend'
import { boardOf, drawViewCanvas } from '../../../canvas'
import type { View, ViewLink, ViewModel } from '../../../client'
import { useViewStore } from '../../../store'
import { useViewLens } from '../../../lens'
import { FOLD_AT, FOLD_ID } from '../../bands/bands'
import { useInputsOpen } from '../../bands/foldStore'
import { levelOf, showSimple, showWholeModel, useSimpleLevel } from '../../simpleStore'
import { applied } from './applied'

vi.mock('../../../../canvas/components/OutputsDock', () => ({ OutputsDock: () => null }))
vi.mock('../../../../canvas/components/OlumiAttentionCard', () => ({ OlumiAttentionCard: () => null }))
vi.mock('../../../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('../../../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: 'u1', accessToken: null }), supabase: {} }))
vi.mock('../../../../canvas/nodes/shared/savedGraph', () => ({ useSavedGraphRead: () => ({ status: 'none' }), useSavedGraph: () => null }))

const view: View = JSON.parse(readFileSync('src/olumiView/fixtures/real/bakery-r5.view3.json', 'utf8'))
const model = view.model!
const card = (id: string) => model.cards.find((c) => c.id === id)!
const key = ['input', 'effect', 'doubted', 'alert', 'olumi', 'depends', 'unsettled'].map((id) => ({
  id, text: `Core’s ${id}`, glyph: '+',
}))
const link = (fields: Partial<ViewLink> = {}): ViewLink => ({
  ...model.links[0]!, kind: 'plain', label: '', effect: null, remove: null, causal: null, direction: null,
  alert: false, proposed: false, doubt: false, ...fields,
})

afterEach(() => {
  cleanup()
  useCanvasStore.setState({ nodes: [], edges: [] })
  useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none' } as never)
  useInputsOpen.setState({ open: {} })
  useSimpleLevel.setState({ levels: {} })
  useViewLens.setState({ lens: 'full' })
})

function draw(links: ViewLink[], cards = model.cards, detailed = false, words = key) {
  const core: ViewModel = { ...model, cards, links, key: words, first_draft: false }
  useViewStore.setState({ uuid: 'u1', sid: view.id, view: { ...view, model: core }, status: 'ready' } as never)
  if (detailed) showWholeModel(view.id)
  else showSimple(view.id)
  expect(levelOf(view.id)).toBe(detailed ? 'working' : 'simple')
  const board = boardOf(core)
  drawViewCanvas(board.model, new Map(), board.extras, board.links)
  // Supply node measurements jsdom cannot calculate so React Flow draws its real edges.
  useCanvasStore.setState(({ nodes }) => ({
    nodes: nodes.map((node) => ({
      ...node, width: 100, height: 40,
      handles: [
        { type: 'source' as const, position: Position.Bottom, x: 50, y: 40 },
        { type: 'target' as const, position: Position.Top, x: 50, y: 0 },
      ],
    })),
  }))
  const { container } = render(
    <div style={{ width: 1440, height: 900 }}><ViewCanvas /><ViewLegend open onOpenChange={() => {}} /></div>,
  )
  return {
    board: within(container).getByTestId('view-canvas'),
    key: within(container).getByTestId('view-legend'),
  }
}

function drawnLook(root: Element, mark: Element | null) {
  const line = root.querySelector('.ok-link-line')!
  const marker = root.querySelector('marker')
  expect(line.getAttribute('marker-end')).toBe(marker ? `url(#${marker.id})` : null)
  return {
    tone: [line, ...lineAncestors(line, root)].flatMap((el) => [...el.classList]).find((c) => c.startsWith('ok-link-tone-')),
    classes: [...line.classList].filter((c) => !c.startsWith('ok-link-tone-')).sort(),
    dash: root.querySelector('[data-link-dash]')?.getAttribute('data-link-dash') ?? root.getAttribute('data-link-dash'),
    end: marker?.firstElementChild?.outerHTML ?? null,
    halos: [...root.querySelectorAll('[data-link-halo-path]')].map((el) => el.getAttribute('class')),
    mark: mark?.querySelector('svg')?.innerHTML ?? null,
  }
}

function lineAncestors(line: Element, root: Element): Element[] {
  const ancestors: Element[] = []
  for (let el = line.parentElement; el !== null && root.contains(el); el = el.parentElement) ancestors.push(el)
  return ancestors
}

const sampleRows = (key: HTMLElement) => [...key.querySelectorAll('[data-key-row="link"]')]
function expectParity({ board, key }: ReturnType<typeof draw>, boardCount: number, sampleCount: number) {
  const edges = [...board.querySelectorAll('.react-flow__edge')]
  const rows = sampleRows(key)
  expect(edges).toHaveLength(boardCount)
  expect(rows).toHaveLength(sampleCount)
  const boardLooks = edges.map((edge) => {
    const index = edge.querySelector('[data-view-link]')?.getAttribute('data-view-link')
    const mark = index === undefined ? null : board.querySelector(`[data-view-link-mark="${index}"]`)
    return drawnLook(edge, mark)
  })
  const keyLooks = rows.map((row) => drawnLook(row, row.querySelector('[data-key-direction]')))
  expect(new Set(keyLooks.map((look) => JSON.stringify(look)))).toEqual(new Set(boardLooks.map((look) => JSON.stringify(look))))
}

describe('the key follows the mounted canvas', () => {
  it('draws one doubted input with its neutral line, dot and verbatim labels', () => {
    const page = draw([link({ role: 'input', doubt: true })])
    expectParity(page, 1, 1)
    const [row] = sampleRows(page.key)
    expect(row!.querySelector('.ok-link-tone-neutral .ok-link-doubt')).not.toBeNull()
    expect(row!.querySelector('marker > circle')).not.toBeNull()
    expect(page.key.textContent).not.toContain('Core’s effect')
    expect([...row!.querySelectorAll('[data-key-item]')].map((el) => el.textContent)).toEqual(['Core’s input', 'Core’s doubted'])
  })

  it('deduplicates unsigned effects and draws the neutral line with no Core label supplied', () => {
    const page = draw([
      link({ role: 'effect' }),
      link({ from: 'extra_hours_sold', role: 'effect' }),
    ], model.cards, false, [])
    expectParity(page, 2, 1)
    const [row] = sampleRows(page.key)
    expect(row!.querySelector('.ok-link-tone-neutral')).not.toBeNull()
    expect(row!.querySelector('[data-key-item]')).toBeNull()
  })

  it('shows the group connector when a challenged link ends at a folded input', () => {
    const cards = [...model.cards, ...Array.from({ length: FOLD_AT }, (_, i) => ({ ...card('base_sales'), id: `extra_${i}` }))]
    const page = draw([link({ from: 'second_oven', to: 'base_sales', alert: true, direction: 'raises' })], cards)
    expect(page.board.querySelector(`[data-group-link="group:second_oven->${FOLD_ID}"]`)).not.toBeNull()
    expectParity(page, 1, 1)
    expect(page.key.querySelector('[data-link-halo-path]')).toBeNull()
  })

  it('keeps a lit, challenged and doubted proposal after the single-halo links, and tracks focus', () => {
    const page = draw([
      link({ from: 'budget', to: 'within_budget', alert: true }),
      link({ from: 'fitting', to: 'spend', proposed: true }),
      link({ direction: 'raises', alert: true, proposed: true, doubt: true }),
    ])
    fireEvent.mouseEnter(page.board.querySelector('.react-flow__node[data-id="base_sales"]')!)
    expectParity(page, 3, 3)
    const combined = sampleRows(page.key).find((row) => row.querySelectorAll('[data-link-halo-path]').length === 2)!
    expect([...combined.querySelectorAll('[data-link-halo-path]')].map((el) => el.getAttribute('data-link-halo-path'))).toEqual(['alert', 'proposed'])
    expect(applied(combined.querySelector('.ok-link-line')!)).toMatchObject({ strokeWidth: '3px', strokeDasharray: '5 4' })
    expect(applied(combined.querySelector('[data-link-halo-path="proposed"]')!).strokeWidth).toBe('5px')
    expect([...combined.querySelectorAll('[data-key-item]')].map((el) => el.textContent)).toEqual(['Core’s effect', 'Core’s doubted', 'Core’s alert', 'Core’s olumi'])

    const proposed = page.board.querySelector<SVGGElement>('.react-flow__edge[data-id="fitting->spend:plain"]')!
    act(() => { proposed.focus() })
    expectParity(page, 3, 3)
    const focused = page.key.querySelector('.ok-link-line.ok-link-focused')!
    expect(applied(focused).strokeWidth).toBe('3px')
    expect(applied(focused.previousElementSibling!).strokeWidth).toBe('5px')
  })

  it('uses the board’s depends glyph and Core’s typed labels', () => {
    const page = draw([link({ direction: 'depends' })])
    expectParity(page, 1, 1)
    const [row] = sampleRows(page.key)
    expect(page.board.querySelector('[data-view-link-mark][data-link-direction="depends"] svg')).not.toBeNull()
    expect(row!.querySelector('[data-key-direction="depends"] svg')).not.toBeNull()
    expect([...row!.querySelectorAll('[data-key-item]')].map((el) => el.textContent)).toEqual(['Core’s effect', 'Core’s depends', 'Core’s unsettled'])
  })

  it('updates the sample when What would change draws the driver link in ink', () => {
    const option = card('second_oven')
    const cards = model.cards.map((c) => c.id === option.id
      ? { ...c, driver: { ...option.driver!, figure: 'base_sales' } }
      : c)
    const page = draw([link()], cards)
    expectParity(page, 1, 1)
    expect(page.key.querySelector('[data-key-sample].ok-link-tone-neutral')).not.toBeNull()
    act(() => { useViewLens.setState({ lens: 'what_changes' }) })
    expectParity(page, 1, 1)
    expect(page.key.querySelector('[data-key-sample].ok-link-tone-ink')).not.toBeNull()
  })

  it('deduplicates the Detailed view’s root connectors with their neutral markerless look', () => {
    const page = draw([], model.cards.filter((c) => c.family === 'option'), true)
    expectParity(page, 3, 1)
    const [row] = sampleRows(page.key)
    expect(row!.querySelector('.ok-link-tone-neutral')).not.toBeNull()
    expect(row!.querySelector('marker')).toBeNull()
  })
})

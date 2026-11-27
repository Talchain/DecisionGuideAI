import { readFileSync } from 'node:fs'
import { Position } from '@xyflow/react'
import { act, cleanup, fireEvent, render, waitFor, within } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { useCanvasStore } from '../../../../canvas/store'
import { ViewCanvas } from '../../../ViewCanvas'
import { ViewLegend } from '../../../ViewLegend'
import { useViewCanvas, useViewFocusLink, useViewHover } from '../../../canvas'
import type { View, ViewLink, ViewModel } from '../../../client'
import { useViewStore } from '../../../store'
import { useViewLens } from '../../../lens'
import { FOLD_AT, FOLD_ID } from '../../bands/bands'
import { setInputsOpen, useInputsOpen } from '../../bands/foldStore'
import { levelOf, showSimple, showWholeModel, useSimpleLevel } from '../../simpleStore'
import { applied } from './applied'

vi.mock('../../../../canvas/components/OutputsDock', () => ({ OutputsDock: () => null }))
vi.mock('../../../../canvas/components/OlumiAttentionCard', () => ({ OlumiAttentionCard: () => null }))
vi.mock('../../../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('../../../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: 'u1', accessToken: null }), supabase: {} }))
vi.mock('../../../../canvas/nodes/shared/savedGraph', () => ({ useSavedGraphRead: () => ({ status: 'none' }), useSavedGraph: () => null }))

beforeAll(() => {
  if (typeof window.DOMMatrixReadOnly !== 'function') vi.stubGlobal('DOMMatrixReadOnly', class { m22 = 1 })
})
afterAll(() => vi.unstubAllGlobals())

const view: View = JSON.parse(readFileSync('src/olumiView/fixtures/real/bakery-r5.view3.json', 'utf8'))
const model = view.model!
const card = (id: string) => model.cards.find((c) => c.id === id)!
const key = [
  { id: 'input', text: 'Input to', glyph: '+' },
  { id: 'doubted', text: 'Doubted', glyph: '–' },
  { id: 'evidence', text: 'Evidence from the brief', glyph: '+' },
  { id: 'depends', text: 'It depends', glyph: '?' },
  { id: 'size', text: 'Sizes the influence', glyph: '·' },
]
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
  useViewHover.setState({ id: null })
  useViewLens.setState({ lens: 'full' })
})

function refresh(links: ViewLink[], cards = model.cards, words = key) {
  const core: ViewModel = { ...model, cards, links, key: words, first_draft: false }
  act(() => useViewStore.setState({ uuid: 'u1', sid: view.id, view: { ...view, model: core }, status: 'ready' } as never))
}

function Board() {
  useViewCanvas(true)
  return <ViewCanvas />
}

function mount(detailed = false) {
  if (detailed) showWholeModel(view.id)
  else showSimple(view.id)
  expect(levelOf(view.id)).toBe(detailed ? 'working' : 'simple')
  const layout = (board: boolean) => (
    <div style={{ width: 1440, height: 900 }}>
      {board ? <Board /> : null}
      <ViewLegend open onOpenChange={() => {}} />
    </div>
  )
  const { container, rerender } = render(layout(true))
  return {
    board: within(container).getByTestId('view-canvas'),
    get key() { return within(container).getByTestId('view-legend') },
    lens: () => within(container).getByTestId('lens-bar-what_changes'),
    unmountBoard: () => rerender(layout(false)),
  }
}

// Give React Flow the measurements jsdom cannot take, after asserting what renders while handles are pending.
function placeHandles() {
  act(() => useCanvasStore.setState(({ nodes }) => ({
    nodes: nodes.map((node) => ({
      ...node, width: 100, height: 40,
      handles: [
        { type: 'source' as const, position: Position.Bottom, x: 50, y: 40 },
        { type: 'target' as const, position: Position.Top, x: 50, y: 0 },
      ],
    })),
  })))
}

const queuedEdgeIds = () => useCanvasStore.getState().edges.map((edge) => edge.id)
const boardEdges = (board: HTMLElement) => [...board.querySelectorAll('.react-flow__edge')]
const sampleRows = (key: HTMLElement) => [...key.querySelectorAll('[data-key-row="link"]')]

async function draw(links: ViewLink[], cards = model.cards, detailed = false, words = key) {
  const page = mount(detailed)
  refresh(links, cards, words)
  await waitFor(() => expect(queuedEdgeIds().length).toBeGreaterThan(0))
  placeHandles()
  await waitFor(() => expect(page.board.classList.contains('ok-board-unframed')).toBe(false), { timeout: 3500 })
  return page
}

function drawnLook(root: Element, mark: Element | null) {
  const line = root.querySelector('.ok-link-line')!
  const marker = root.querySelector('marker')
  expect(line.getAttribute('marker-end')).toBe(marker ? `url(#${marker.id})` : null)
  return {
    dashCss: applied(line).strokeDasharray,
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

function signature(element: Element) {
  const value = element.querySelector('.ok-link-line')?.getAttribute('data-link-look')
  expect(value).toBeTruthy()
  return value!
}

function expectSubset(page: ReturnType<typeof mount>) {
  const boardSignatures = new Set(boardEdges(page.board).map(signature))
  for (const row of sampleRows(page.key)) expect(boardSignatures.has(signature(row))).toBe(true)
}

function expectParity({ board, key }: ReturnType<typeof mount>, boardCount: number, sampleCount: number) {
  const edges = boardEdges(board)
  const rows = sampleRows(key)
  expect(edges).toHaveLength(boardCount)
  expect(rows).toHaveLength(sampleCount)
  const boardSignatures = edges.map(signature)
  const keySignatures = new Set(rows.map(signature))
  expect(keySignatures.size).toBe(rows.length)
  expect(keySignatures).toEqual(new Set(boardSignatures))
  for (const row of rows) {
    const keyLook = drawnLook(row, row.querySelector('[data-key-direction]'))
    for (const edge of edges.filter((_, index) => boardSignatures[index] === signature(row))) {
      const index = edge.querySelector('[data-view-link]')?.getAttribute('data-view-link')
      const mark = index === undefined ? null : board.querySelector(`[data-view-link-mark="${index}"]`)
      expect(keyLook).toEqual(drawnLook(edge, mark))
    }
  }
}

describe('the key follows the mounted canvas', () => {
  it('waits for handles and framing on cold open, then shows one doubted input', async () => {
    const page = mount()
    refresh([link({ role: 'input', doubt: true, label: '+', label_key: 'evidence' })])
    await waitFor(() => expect(queuedEdgeIds()).toHaveLength(1))
    expectParity(page, 0, 0)

    placeHandles()
    expect(boardEdges(page.board)).toHaveLength(1)
    expect(page.board.classList.contains('ok-board-unframed')).toBe(true)
    expect(sampleRows(page.key)).toHaveLength(0)
    await waitFor(() => expectParity(page, 1, 1), { timeout: 3500 })

    const [row] = sampleRows(page.key)
    expect(row!.querySelector('.ok-link-tone-neutral .ok-link-doubt')).not.toBeNull()
    expect(row!.querySelector('marker > circle')).not.toBeNull()
    expect([...row!.querySelectorAll('[data-key-item]')].map((el) => el.textContent)).toEqual(['Evidence from the brief'])

    page.unmountBoard()
    expect(sampleRows(page.key)).toHaveLength(0)
  })

  it('deduplicates unsigned effects and leaves the sample unlabelled without a typed Core label', async () => {
    const page = await draw([
      link({ role: 'effect', label: '+' }),
      link({ from: 'extra_hours_sold', role: 'effect', label: '+', label_key: null }),
    ])
    expectParity(page, 2, 1)
    const [row] = sampleRows(page.key)
    expect(row!.querySelector('.ok-link-tone-neutral')).not.toBeNull()
    expect(row!.querySelector('[data-key-item]')).toBeNull()
  })

  it('follows a challenged link through folding and unfolding its input group', async () => {
    const cards = [...model.cards, ...Array.from({ length: FOLD_AT }, (_, i) => ({ ...card('base_sales'), id: `extra_${i}` }))]
    setInputsOpen(view.id, true)
    const page = await draw([link({ from: 'second_oven', to: 'base_sales', alert: true, direction: 'raises' })], cards)
    expectParity(page, 1, 1)
    expect(page.key.querySelector('[data-link-halo-path="alert"]')).not.toBeNull()

    fireEvent.click(within(page.board).getByTestId('view-inputs-unfold'))
    const groupId = `group:second_oven->${FOLD_ID}`
    await waitFor(() => expect(queuedEdgeIds()).toEqual([groupId]))
    expectParity(page, 0, 0)
    placeHandles()
    expectParity(page, 1, 1)
    expect(page.board.querySelector(`[data-group-link="${groupId}"]`)).not.toBeNull()
    expect(page.key.querySelector('[data-link-halo-path]')).toBeNull()

    fireEvent.click(within(page.board).getByTestId('view-inputs-fold'))
    await waitFor(() => expect(queuedEdgeIds()).toEqual(['second_oven->base_sales:plain']))
    expectParity(page, 0, 0)
    placeHandles()
    expectParity(page, 1, 1)
    expect(page.key.querySelector('[data-link-halo-path="alert"]')).not.toBeNull()
  })

  it('updates a mounted look and waits for a new link’s handles on a View refresh', async () => {
    const page = await draw([link({ direction: 'raises' })])
    expectParity(page, 1, 1)
    const initialSignature = signature(sampleRows(page.key)[0]!)
    const cards = [...model.cards, { ...card('base_sales'), id: 'new_input' }]

    refresh([link({ direction: 'lowers' }), link({ from: 'new_input', role: 'input', label_key: 'input' })], cards)
    expectSubset(page)
    await waitFor(() => expect(queuedEdgeIds()).toHaveLength(2))
    expectSubset(page)
    expect(boardEdges(page.board).some((edge) => edge.getAttribute('data-id') === 'new_input->sales:plain')).toBe(false)
    expect(page.key.querySelector('[data-key-item="input"]')).toBeNull()

    placeHandles()
    expectParity(page, 2, 2)
    expect(sampleRows(page.key).map(signature)).not.toContain(initialSignature)
    expect(page.key.querySelector('[data-key-item="input"]')?.textContent).toBe('Input to')
  })

  it('keeps the combined lit, alert, proposed and doubt treatment', async () => {
    const page = await draw([
      link({ from: 'budget', to: 'within_budget', alert: true }),
      link({ from: 'fitting', to: 'spend', proposed: true, remove: { record: 'fitting', part: null } }),
      link({ direction: 'raises', alert: true, proposed: true, doubt: true, label_key: 'doubted' }),
    ])
    fireEvent.mouseEnter(page.board.querySelector('.react-flow__node[data-id="base_sales"]')!)
    expectParity(page, 3, 3)
    const combined = sampleRows(page.key).find((row) => row.querySelectorAll('[data-link-halo-path]').length === 2)!
    expect([...combined.querySelectorAll('[data-link-halo-path]')].map((el) => el.getAttribute('data-link-halo-path'))).toEqual(['alert', 'proposed'])
    expect(applied(combined.querySelector('.ok-link-line')!)).toMatchObject({ strokeWidth: '3px', strokeDasharray: '5 4' })
    expect(applied(combined.querySelector('[data-link-halo-path="proposed"]')!).strokeWidth).toBe('5px')
    expect(combined.querySelector('[data-key-item]')?.textContent).toBe('Doubted')

    const proposed = page.board.querySelector<SVGGElement>('.react-flow__edge[data-id="fitting->spend:plain"]')!
    act(() => { proposed.focus() })
    expect(proposed.matches(':focus-visible')).toBe(true)
    expect(applied(proposed.querySelector('.ok-link-line')!).strokeWidth).toBe('3px')
    expect(applied(proposed.querySelector('[data-link-halo-path="proposed"]')!).strokeWidth).toBe('5px')
    expectParity(page, 3, 3)
    const remove = page.board.querySelector<HTMLButtonElement>('button[data-link-for="fitting->spend:plain"]')!
    act(() => { remove.focus() })
    expect(document.activeElement).toBe(remove)
    expect(useViewFocusLink.getState().id).toBe('fitting->spend:plain')
    expect(applied(proposed.querySelector('.ok-link-line')!).strokeWidth).toBe('2px')
    expect(applied(proposed.querySelector('[data-link-halo-path="proposed"]')!).strokeWidth).toBe('3px')
    expectParity(page, 3, 3)
  })

  it('uses the board’s depends glyph and Core’s typed label', async () => {
    const page = await draw([link({ direction: 'depends', label_key: 'depends' })])
    expectParity(page, 1, 1)
    const [row] = sampleRows(page.key)
    expect(page.board.querySelector('[data-view-link-mark][data-link-direction="depends"] svg')).not.toBeNull()
    expect(row!.querySelector('[data-key-direction="depends"] svg')).not.toBeNull()
    expect(row!.querySelector('[data-key-item]')?.textContent).toBe('It depends')
  })

  it('updates the sample when What would change draws the driver link in ink', async () => {
    const option = card('second_oven')
    const cards = model.cards.map((c) => c.id === option.id
      ? { ...c, driver: { ...option.driver!, figure: 'base_sales' } }
      : c)
    const page = await draw([link()], cards)
    expectParity(page, 1, 1)
    expect(page.key.querySelector('[data-key-sample].ok-link-tone-neutral')).not.toBeNull()
    fireEvent.click(page.lens())
    expectParity(page, 1, 1)
    expect(page.key.querySelector('[data-key-sample].ok-link-tone-ink')).not.toBeNull()
  })

  it('keeps a size wire distinct from neutral root connectors in Detailed', async () => {
    const size = { ...link({ from: 'budget', role: 'size', label_key: 'size' }), sizes: { from: 'base_sales', to: 'sales' } }
    const page = await draw([link(), size], model.cards, true)
    expectParity(page, 5, 3)
    const wire = page.board.querySelector('[data-link-role="size"]')!
    const root = page.board.querySelector('.react-flow__edge[data-id="root:second_oven"]')!
    expect(wire.querySelector('[data-view-link-size-label]')?.textContent).toBe('size')
    expect(drawnLook(wire, null)).toEqual(drawnLook(root, null))
    expect(signature(wire)).not.toBe(signature(root))
    const wireSample = sampleRows(page.key).find((row) => signature(row) === signature(wire))!
    expect(wireSample.querySelector('[data-key-item="size"]')?.textContent).toBe('Sizes the influence')
  })
})

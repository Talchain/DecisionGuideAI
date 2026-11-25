import '@testing-library/jest-dom/vitest'
import { Position } from '@xyflow/react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { edgeIdOf } from '../../canvas/contextMenu/laneMenu'
import { useCanvasStore } from '../../canvas/store'
import { boardOf, drawViewCanvas } from '../canvas'
import { QUESTION } from '../layout'
import { ViewCanvas } from '../ViewCanvas'
import { approved, install, uninstall } from '../v12/edit/__tests__/harness'
import { useLaneInspector } from '../v12/edit/inspectorStore'
import { DETAILS_H, DETAILS_X, DETAILS_Y } from '../v12/edit/placeBeside'
import { setDefaultLevel } from '../v12/simpleStore'

vi.mock('../../canvas/components/OutputsDock', () => ({ OutputsDock: () => null }))
vi.mock('../../canvas/components/OlumiAttentionCard', () => ({ OlumiAttentionCard: () => null }))
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: 'u1', accessToken: null }), supabase: {} }))
vi.mock('../../canvas/nodes/shared/savedGraph', () => ({ useSavedGraphRead: () => ({ status: 'none' }), useSavedGraph: () => null }))

beforeAll(() => { ;(window as unknown as { DOMMatrixReadOnly?: unknown }).DOMMatrixReadOnly ??= class { m22 = 1 } })
beforeEach(() => { vi.stubEnv('VITE_OLUMI_CORE', '1') })
afterEach(() => {
  cleanup()
  uninstall()
  useCanvasStore.setState({ nodes: [], edges: [] })
  setDefaultLevel('working')
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const overlaps = (a: DOMRect, b: DOMRect): boolean =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
const distanceBetween = (a: DOMRect, b: DOMRect): number => Math.hypot(
  Math.max(0, a.left - b.right, b.left - a.right),
  Math.max(0, a.top - b.bottom, b.top - a.bottom),
)

it('places the hidden bar’s editor beside its aim and clear of the question at 1128 × 680', () => {
  const view = approved(), model = view.model!
  const aim = 'reach_customer_target', bar = 'customer_target'
  const withBar = { ...model, cards: model.cards.map((card) => card.id === bar ? { ...card, bar_of: aim } : card) }
  install({ ...view, model: withBar })
  setDefaultLevel('simple')
  const board = boardOf(withBar)
  drawViewCanvas(board.model, new Map(), board.extras, board.links)

  vi.stubGlobal('innerWidth', 1128)
  vi.stubGlobal('innerHeight', 680)
  // Screen-space card rectangles at the compact viewport and 1.33 scale. jsdom does not calculate layout.
  const questionBox = new DOMRect(62, 68, 456, 146)
  const aimBox = new DOMRect(84, 244, 300, 120)
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const id = this.closest('.react-flow__node')?.getAttribute('data-id')
    if (id === QUESTION) return questionBox
    if (id === aim) return aimBox
    if (this.matches('[data-testid="lane-inspector"]')) return new DOMRect(0, 0, 280, 221)
    if (this.matches('[role="banner"]')) return new DOMRect(0, 0, 1128, 60)
    if (this.matches('nav[aria-label="Canvas tools"]')) return new DOMRect(0, 60, 54, 620)
    if (this.matches('aside[aria-label="Outputs dock"]')) return new DOMRect(768, 60, 360, 620)
    return new DOMRect()
  })
  const { container } = render(
    <>
      <div role="banner" />
      <nav aria-label="Canvas tools" />
      <aside aria-label="Outputs dock" />
      <ViewCanvas />
    </>,
  )
  expect(container.querySelector(`.react-flow__node[data-id="${QUESTION}"]`)).toBeInTheDocument()
  expect(container.querySelector(`.react-flow__node[data-id="${aim}"]`)).toBeInTheDocument()
  expect(container.querySelector(`.react-flow__node[data-id="${bar}"]`)).toBeNull()
  fireEvent.click(screen.getByTestId(`view-aim-edit-${bar}`))
  const sheet = screen.getByTestId('lane-inspector')
  expect(sheet).toHaveAttribute('data-box-card', bar)
  expect(screen.getByTestId('inspector-figure-typed')).toHaveFocus()
  const left = parseFloat(sheet.style.getPropertyValue(DETAILS_X))
  const top = parseFloat(sheet.style.getPropertyValue(DETAILS_Y))
  expect([left, top].every(Number.isFinite)).toBe(true)
  const placed = new DOMRect(left, top, 280, parseFloat(sheet.style.getPropertyValue(DETAILS_H)) || 221)
  expect(distanceBetween(placed, aimBox)).toBeLessThanOrEqual(48)
  expect(overlaps(placed, aimBox)).toBe(false)
  expect(overlaps(placed, questionBox)).toBe(false)
})

it('opens the selected link’s details from the rendered line and from its focused edge', () => {
  const view = approved(), model = view.model!
  const link = model.links.find((item) => item.size?.edit != null)!
  const id = edgeIdOf(link)
  install(view)
  const cards = model.cards.filter((card) => card.id === link.from || card.id === link.to)
  drawViewCanvas({ ...model, cards, links: [link] }, new Map([
    [link.from, { x: 80, y: 150 }],
    [link.to, { x: 420, y: 350 }],
  ]))
  // Supply the dimensions and handles that React Flow would otherwise measure in the browser.
  useCanvasStore.setState((state) => ({
    nodes: state.nodes.map((node) => ({
      ...node,
      initialWidth: 240,
      initialHeight: 100,
      handles: [
        { type: 'source', position: Position.Bottom, x: 120, y: 100 },
        { type: 'target', position: Position.Top, x: 120, y: 0 },
      ],
    })),
  }))
  render(<ViewCanvas />)
  const edge = screen.getByTestId(`rf__edge-${id}`)
  const hitArea = edge.querySelector('.react-flow__edge-interaction')!
  fireEvent.click(hitArea)
  expect(screen.getByTestId('lane-inspector')).toHaveAttribute('data-kind', 'link')
  expect(screen.getByTestId('lane-inspector-title')).toHaveTextContent(link.title)
  expect(screen.getByTestId('lane-inspector-strength')).toHaveTextContent(link.size!.text)
  fireEvent.click(screen.getByRole('button', { name: 'Close details' }))
  expect(screen.queryByTestId('lane-inspector')).toBeNull()
  act(() => edge.focus())
  expect(edge).toHaveFocus()
  fireEvent.keyDown(edge, { key: 'Enter' })
  expect(screen.getByTestId('lane-inspector-title')).toHaveTextContent(link.title)
  fireEvent.click(screen.getByRole('button', { name: 'Close details' }))
  // The lane control opens the removal form for this link without opening its details.
  expect(link.remove).not.toBeNull()
  const open = document.querySelector<HTMLButtonElement>(`[data-link-for="${id}"]`)!
  fireEvent.click(open)
  const form = screen.getByRole('dialog', { name: 'Remove this link?' })
  expect(form).toBeInTheDocument()
  const review = screen.getByTestId('lane-link-removal-summary')
  const heading = (cardId: string) => cards.find((card) => card.id === cardId)!.heading
  expect(review).toHaveTextContent(`from ${heading(link.from)} to ${heading(link.to)}`)
  expect(screen.queryByTestId('lane-inspector')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Keep' }))
  expect(form).not.toBeInTheDocument()
  expect(screen.queryByTestId('lane-inspector')).toBeNull()
  // The focused link opens on Enter only: Space leaves its details closed, Enter opens them.
  act(() => edge.focus())
  expect(edge).toHaveFocus()
  fireEvent.keyDown(edge, { key: ' ' })
  expect(screen.queryByTestId('lane-inspector')).toBeNull()
  fireEvent.keyDown(edge, { key: 'Enter' })
  expect(screen.getByTestId('lane-inspector')).toHaveAttribute('data-kind', 'link')
  expect(screen.getByTestId('lane-inspector-title')).toHaveTextContent(link.title)
})

const CARD_ID = 'slow_ramp'

it('D2 a details box on a full board stays within 48 px of its card without moving the board', async () => {
  const view = approved(), model = view.model!
  const target = model.cards.find((card) => card.id === CARD_ID)!
  const cards = model.cards.filter((card) => card.id !== CARD_ID).slice(0, 8)
  cards.splice(4, 0, target)
  const fullBoard = { ...model, cards, links: [] }
  install({ ...view, model: fullBoard })
  const grid = [20, 350, 680].flatMap((x) => [40, 290, 540].map((y) => new DOMRect(x, y, 300, 200)))
  const rects = new Map(cards.map((card, i) => [card.id, grid[i]!]))
  drawViewCanvas(fullBoard, new Map([...rects].map(([id, rect]) => [id, { x: rect.x, y: rect.y }])))

  vi.stubGlobal('innerWidth', 1024)
  vi.stubGlobal('innerHeight', 768)
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const id = this.closest('.react-flow__node')?.getAttribute('data-id')
    if (this.matches('[data-testid="lane-inspector"]')) return new DOMRect(0, 0, 280, 300)
    return rects.get(id ?? '') ?? new DOMRect()
  })
  const { container } = render(<ViewCanvas />)
  const settleBoard = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 60)) })
  await settleBoard()
  const viewport = container.querySelector<HTMLElement>('.react-flow__viewport')!
  const before = viewport.style.transform
  expect(container.querySelectorAll('.react-flow__node').length).toBeGreaterThanOrEqual(cards.length)
  fireEvent.click(container.querySelector(`.react-flow__node[data-id="${CARD_ID}"]`)!)
  await settleBoard()

  const details = screen.getByTestId('lane-inspector')
  const left = parseFloat(details.style.getPropertyValue(DETAILS_X))
  const top = parseFloat(details.style.getPropertyValue(DETAILS_Y))
  const box = new DOMRect(left, top, 280, parseFloat(details.style.getPropertyValue(DETAILS_H)) || 300)
  const card = rects.get(CARD_ID)!
  expect(distanceBetween(box, card)).toBeLessThanOrEqual(48)
  expect(overlaps(box, card)).toBe(false)
  expect(grid.some((neighbour) => neighbour !== card && overlaps(box, neighbour))).toBe(true)
  expect(viewport.style.transform).toBe(before)
})

function renderCardNode(id: string) {
  const view = approved(), model = view.model!
  install(view)
  drawViewCanvas({ ...model, cards: model.cards.filter((card) => card.id === CARD_ID), links: [] }, new Map([
    [CARD_ID, { x: 80, y: 150 }],
  ]))
  const { container } = render(<ViewCanvas />)
  return container.querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"]`)!
}

it('opens a focused model card’s details on Enter', () => {
  const card = renderCardNode(CARD_ID)
  act(() => card.focus())
  expect(card).toHaveFocus()
  fireEvent.keyDown(card, { key: 'Enter' })
  expect(useLaneInspector.getState().current).toMatchObject({ kind: 'details', target: { kind: 'card', id: CARD_ID } })
})

it('opens a focused model card’s details on Space', () => {
  const card = renderCardNode(CARD_ID)
  act(() => card.focus())
  expect(card).toHaveFocus()
  fireEvent.keyDown(card, { key: ' ' })
  expect(useLaneInspector.getState().current).toMatchObject({ kind: 'details', target: { kind: 'card', id: CARD_ID } })
})

it('leaves details closed on Enter from a button inside a model card', () => {
  const card = renderCardNode(CARD_ID)
  act(() => card.focus())
  const button = card.querySelector<HTMLButtonElement>(`button[data-testid="view-figure-edit-${CARD_ID}"]`)!
  act(() => button.focus())
  expect(button).toHaveFocus()
  fireEvent.keyDown(button, { key: 'Enter' })
  expect(useLaneInspector.getState().current).toBeNull()
})

it('opens nothing on Enter from the focused question card and leaves the open details box as it was', () => {
  const question = renderCardNode(QUESTION)
  act(() => useLaneInspector.getState().open({ kind: 'card', id: CARD_ID }))
  expect(useLaneInspector.getState().current).toMatchObject({ kind: 'details', target: { kind: 'card', id: CARD_ID } })

  act(() => question.focus())
  expect(question).toHaveFocus()
  fireEvent.keyDown(question, { key: 'Enter' })

  const current = useLaneInspector.getState().current
  const target = current?.kind === 'details' ? current.target : undefined
  expect(current?.kind, 'current.kind').toBe('details')
  expect(target?.kind, 'current.target.kind').toBe('card')
  expect(target?.id, 'current.target.id').toBe(CARD_ID)
})

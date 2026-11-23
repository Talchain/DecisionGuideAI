import '@testing-library/jest-dom/vitest'
import { Position } from '@xyflow/react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { edgeIdOf } from '../../canvas/contextMenu/laneMenu'
import { useCanvasStore } from '../../canvas/store'
import { boardOf, drawViewCanvas } from '../canvas'
import { QUESTION } from '../layout'
import { ViewCanvas } from '../ViewCanvas'
import { approved, install, uninstall } from '../v12/edit/__tests__/harness'
import { DETAILS_H, DETAILS_X, DETAILS_Y } from '../v12/edit/placeBeside'
import { setDefaultLevel } from '../v12/simpleStore'

vi.mock('../../canvas/components/OutputsDock', () => ({ OutputsDock: () => null }))
vi.mock('../../canvas/components/OlumiAttentionCard', () => ({ OlumiAttentionCard: () => null }))
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: 'u1', accessToken: null }), supabase: {} }))
vi.mock('../../canvas/nodes/shared/savedGraph', () => ({ useSavedGraphRead: () => ({ status: 'none' }), useSavedGraph: () => null }))

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
  // The link's remove control is its own press: Remove link, Keep and Yes never open the link's details over the removal.
  expect(link.remove).not.toBeNull()
  const open = document.querySelector<HTMLButtonElement>('[data-testid^="view-link-remove-open-"]')!
  fireEvent.click(open)
  expect(screen.queryByTestId('lane-inspector')).toBeNull()
  fireEvent.click(document.querySelector<HTMLButtonElement>('[data-testid^="view-link-remove-keep-"]')!)
  expect(screen.queryByTestId('lane-inspector')).toBeNull()
})

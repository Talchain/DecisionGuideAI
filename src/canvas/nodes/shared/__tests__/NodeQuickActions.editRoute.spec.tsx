/**
 * ⭐ DESIGN-GAP ROW 20 — "Edit route in the rail" (contract v3 §02, VC-01).
 *
 * The contract's rail builder:
 *   `if(['question','goal','factor','option'].includes(n.kind)&&!n.baseline)
 *      rail += tooltipButton('edit', …, 'revealed')`
 * with the note "The existing edit route is shown on hover/focus where the real
 * carrier exists", and for the rest: "Do not advertise unsupported risk/outcome
 * editors." So four families get an EDIT icon, revealed on hover/focus, that
 * opens the EXISTING edit route; Outcome and Risk get coaching only.
 *
 * What is pinned here, each as its own claim:
 *
 * 1. PRESENCE BY KIND — Question (`decision`), Goal and Factor carry the edit
 *    button in the rail's hover group; Outcome and Risk do NOT (the opposite
 *    control), with More present in the SAME render so an absence is not a
 *    blind probe. Option's edit route is the card's own gated pencil
 *    (`option-edit-targets-<id>`, pinned in `OptionNode.editRouteRevealed.spec`),
 *    so the shared rail draws no second one there.
 * 2. THE ROUTE IS THE EXISTING ONE, BOUND BY IDENTITY — the click selects THIS
 *    node (and not its neighbour: a discriminating pair) and raises the full
 *    inspector through `olumi:open-full-inspector`, the event ReactFlowGraph
 *    listens for — the path "Open details" in the More menu and the option
 *    pencil already take (`openNodeInspector`). No new editing surface.
 * 3. NAVIGATION IS NOT A MUTATION — the click leaves the graph untouched, so it
 *    can never read as a save; whatever the inspector's own editors do is
 *    governed by their authority there.
 * 4. THE ANCHOR RESERVE LEARNS THE NEW MEMBER — Question and Goal reserve the
 *    rail's width beside their last row (`anchorRailButtons` in BaseNode). The
 *    reserve must equal the rail the card actually mounts, or the revealed rail
 *    covers the title.
 *
 * jsdom cannot prove "hidden at rest, shown on hover": the reveal is asserted as
 * the hover group's classes, not as pixels (CLAUDE.md trap 3).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { Circle } from 'lucide-react'
import { NodeQuickActions } from '../NodeQuickActions'
import { BaseNode } from '../../BaseNode'
import { useCanvasStore } from '../../../store'
import { useGuidanceStore } from '../../../stores/guidanceStore'
import { NODE_RAIL_BUTTON_CLASSES, NODE_RAIL_GLYPH_CLASSES } from '../nodeCardRailStyles'
import type { NodeType } from '../../../domain/nodes'

vi.mock('../../../../components/Tooltip', () => ({
  default: ({ children, content }: { children: React.ReactNode; content: React.ReactNode }) => (
    <span data-tooltip-content={String(content)}>{children}</span>
  ),
}))

const tokens = (el: Element | null) => (el?.getAttribute('class') ?? '').split(/\s+/).filter(Boolean)
const classTokens = (s: string) => s.split(/\s+/).filter(Boolean)

const EDIT_KINDS = ['decision', 'goal', 'factor'] as const
const NO_EDIT_KINDS = ['outcome', 'risk'] as const

function seed(nodes: Array<{ id: string; type: NodeType; label: string }>) {
  useCanvasStore.setState({
    nodes: nodes.map(n => ({ id: n.id, type: n.type, position: { x: 0, y: 0 }, data: { label: n.label, type: n.type } })),
    edges: [],
    highlightedNodes: new Set<string>(),
    dimmedNodeIds: new Set<string>(),
    lodRung: 'quiet',
  } as never)
}

beforeEach(() => {
  useGuidanceStore.setState({ _sendMessage: null, _prefillChat: null } as never)
})
afterEach(() => {
  cleanup()
  useCanvasStore.setState({ lodRung: 'full' } as never)
})

describe('row 20 — the edit route by kind (contract §02)', () => {
  it.each(EDIT_KINDS)('%s: an Edit button in the rail, named for THIS node, hinted "Edit"', (kind) => {
    const id = `${kind}-1`
    const label = `A ${kind} title`
    seed([{ id, type: kind, label }])
    render(<NodeQuickActions nodeId={id} nodeType={kind} label={label} />)

    const edit = screen.getByTestId(`node-action-edit-${id}`)
    expect(edit.tagName.toLowerCase()).toBe('button')
    expect(edit.getAttribute('type')).toBe('button')
    // Accessible name carries the node identity; the visible hint names the act.
    expect(screen.getByRole('button', { name: `Edit ${label}` })).toBe(edit)
    const wrapper = edit.closest('[data-tooltip-content]')
    expect(wrapper, 'the edit button is not inside a Tooltip').not.toBeNull()
    expect(wrapper!.getAttribute('data-tooltip-content')).toBe('Edit')
    // It lives in the HOVER group — revealed on hover/focus, never a resting icon.
    expect(within(screen.getByTestId(`node-quick-actions-${id}`)).getByTestId(`node-action-edit-${id}`)).toBe(edit)
  })

  it.each(EDIT_KINDS)('%s: the rail\'s own geometry and the pencil glyph (one icon language)', (kind) => {
    const id = `${kind}-geom`
    seed([{ id, type: kind, label: 'Geometry' }])
    render(<NodeQuickActions nodeId={id} nodeType={kind} label="Geometry" />)
    const edit = screen.getByTestId(`node-action-edit-${id}`)
    const more = screen.getByTestId(`node-action-menu-${id}`)
    // Same box/slop/hover language as its siblings — token-exact, not substring.
    for (const t of classTokens(NODE_RAIL_BUTTON_CLASSES)) expect(tokens(edit)).toContain(t)
    expect(tokens(edit)).toEqual(tokens(more))
    const svg = edit.querySelector('svg')
    expect(svg, 'the edit button has no glyph').not.toBeNull()
    expect(svg!.classList.contains('lucide-pencil')).toBe(true)
    for (const t of classTokens(NODE_RAIL_GLYPH_CLASSES)) expect(svg!.classList.contains(t)).toBe(true)
    expect(svg!.getAttribute('aria-hidden')).toBe('true')
  })

  it.each(NO_EDIT_KINDS)('%s: coaching only — NO edit button (contrast: More renders in the same row)', (kind) => {
    const id = `${kind}-1`
    seed([{ id, type: kind, label: `A ${kind}` }])
    render(<NodeQuickActions nodeId={id} nodeType={kind} label={`A ${kind}`} />)
    // Present control first: the row mounted and draws its overflow.
    expect(screen.getByTestId(`node-action-menu-${id}`)).toBeInTheDocument()
    expect(screen.queryByTestId(`node-action-edit-${id}`)).toBeNull()
    expect(screen.queryByRole('button', { name: /^Edit\b/ })).toBeNull()
  })

  it('option: the shared rail draws NO second edit — the card owns its gated pencil (contrast: More renders)', () => {
    seed([{ id: 'opt-1', type: 'option', label: 'Raise the price' }])
    render(<NodeQuickActions nodeId="opt-1" nodeType="option" label="Raise the price" />)
    expect(screen.getByTestId('node-action-menu-opt-1')).toBeInTheDocument()
    expect(screen.queryByTestId('node-action-edit-opt-1')).toBeNull()
  })

  it('is hidden at rest and revealed by hover/focus — it rides the hover group\'s reveal, not a class of its own', () => {
    seed([{ id: 'factor-r', type: 'factor', label: 'Reveal' }])
    render(<NodeQuickActions nodeId="factor-r" nodeType="factor" label="Reveal" />)
    const group = screen.getByTestId('node-quick-actions-factor-r')
    const t = tokens(group)
    expect(t).toContain('opacity-0')
    expect(t).toContain('pointer-events-none')
    expect(t).toContain('group-hover:opacity-100')
    expect(t).toContain('group-focus-within:opacity-100')
    expect(t).toContain('[@media(pointer:coarse)]:opacity-100')
    // Still in the tab order and the accessibility tree at rest.
    const edit = within(group).getByTestId('node-action-edit-factor-r')
    expect(edit.getAttribute('tabindex')).toBeNull()
    expect(edit.getAttribute('aria-hidden')).toBeNull()
  })
})

describe('row 20 — the click opens the EXISTING edit route for THIS node', () => {
  const opened: Event[] = []
  const onOpen = (e: Event) => { opened.push(e) }
  beforeEach(() => {
    opened.length = 0
    window.addEventListener('olumi:open-full-inspector', onOpen)
  })
  afterEach(() => window.removeEventListener('olumi:open-full-inspector', onOpen))

  const renderPair = () => {
    seed([
      { id: 'node-a', type: 'factor', label: 'Hiring spend' },
      { id: 'node-b', type: 'factor', label: 'Team productivity' },
    ])
    render(
      <>
        <NodeQuickActions nodeId="node-a" nodeType="factor" label="Hiring spend" />
        <NodeQuickActions nodeId="node-b" nodeType="factor" label="Team productivity" />
      </>,
    )
  }

  it('selects node-b (not node-a) and raises the inspector once — the SECOND node, so nodes[0] cannot pass', () => {
    renderPair()
    fireEvent.click(screen.getByTestId('node-action-edit-node-b'))
    const selected = useCanvasStore.getState().selection.nodeIds
    expect(selected.has('node-b')).toBe(true)
    expect(selected.has('node-a')).toBe(false)
    expect(opened).toHaveLength(1)
  })

  it('the discriminating twin: node-a\'s button selects node-a, not node-b', () => {
    renderPair()
    fireEvent.click(screen.getByTestId('node-action-edit-node-a'))
    const selected = useCanvasStore.getState().selection.nodeIds
    expect(selected.has('node-a')).toBe(true)
    expect(selected.has('node-b')).toBe(false)
    expect(opened).toHaveLength(1)
  })

  /**
   * The only thing the click may change is the SELECTION — which
   * `selectNodeWithoutHistory` also writes onto each node as React Flow's
   * `selected` flag (a view state, not model data). So the model is compared
   * with that one key stripped: ids, kinds, labels, data and positions must be
   * byte-identical, and the edges untouched.
   */
  it('is navigation, not a mutation: the model is untouched, so nothing can read as saved', () => {
    renderPair()
    const model = (ns: ReadonlyArray<Record<string, unknown>>) =>
      JSON.stringify(ns.map(({ selected: _selected, ...rest }) => rest))
    const before = model(useCanvasStore.getState().nodes as never)
    const edgesBefore = useCanvasStore.getState().edges
    fireEvent.click(screen.getByTestId('node-action-edit-node-b'))
    // Precondition: the click DID act (selection moved), so the equality below
    // is not the result of a click that never happened.
    expect(useCanvasStore.getState().selection.nodeIds.has('node-b')).toBe(true)
    expect(model(useCanvasStore.getState().nodes as never)).toBe(before)
    expect(useCanvasStore.getState().edges).toBe(edgesBefore)
  })

  it('fail-closes on a node that is no longer on the graph: opens nothing', () => {
    seed([{ id: 'node-a', type: 'factor', label: 'Hiring spend' }])
    render(<NodeQuickActions nodeId="node-gone" nodeType="factor" label="Gone" />)
    fireEvent.click(screen.getByTestId('node-action-edit-node-gone'))
    expect(opened).toHaveLength(0)
  })

  it('does not bubble to the card — the button performs the selection itself', () => {
    seed([{ id: 'node-a', type: 'factor', label: 'Hiring spend' }])
    const cardClick = vi.fn()
    render(
      <div onClick={cardClick}>
        <NodeQuickActions nodeId="node-a" nodeType="factor" label="Hiring spend" />
      </div>,
    )
    fireEvent.click(screen.getByTestId('node-action-edit-node-a'))
    expect(cardClick).not.toHaveBeenCalled()
    expect(opened).toHaveLength(1)
  })
})

describe('row 20 — on the card (BaseNode), and the anchor reserve learns the new member', () => {
  const cardProps = (kind: NodeType, id: string, label: string) => ({
    id,
    type: kind,
    position: { x: 0, y: 0 },
    selected: false,
    isConnectable: true,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    dragging: false,
    zIndex: 0,
    data: { type: kind, label },
  })

  function renderCard(kind: NodeType) {
    const id = `${kind}-card`
    const props = cardProps(kind, id, `The ${kind}`)
    useCanvasStore.setState({
      nodes: [props] as never,
      edges: [],
      highlightedNodes: new Set<string>(),
      dimmedNodeIds: new Set<string>(),
      lodRung: 'full',
    } as never)
    render(
      <ReactFlowProvider>
        <BaseNode {...(props as any)} nodeType={kind} icon={Circle}>
          <div data-testid="anchor-row">row</div>
        </BaseNode>
      </ReactFlowProvider>,
    )
    return id
  }

  it.each(EDIT_KINDS)('%s card: exactly one edit route in its rail', (kind) => {
    const id = renderCard(kind)
    const rail = screen.getByTestId(`node-card-rail-${id}`)
    expect(within(rail).getAllByRole('button', { name: /^Edit\b/ })).toHaveLength(1)
    expect(within(rail).getByTestId(`node-action-edit-${id}`)).toBeInTheDocument()
  })

  it.each(NO_EDIT_KINDS)('%s card: no edit route (contrast: the rail and its More are mounted)', (kind) => {
    const id = renderCard(kind)
    const rail = screen.getByTestId(`node-card-rail-${id}`)
    expect(within(rail).getByTestId(`node-action-menu-${id}`)).toBeInTheDocument()
    expect(within(rail).queryAllByRole('button', { name: /^Edit\b/ })).toHaveLength(0)
  })

  /**
   * ⭐ THE RESERVE EQUALS THE RAIL IT MOUNTS. With an ask surface registered at
   * Normal zoom every member the anchor can draw with no caller icons and no
   * attention reasons is on screen: Edit, Challenge, More (hover) and the
   * coaching icon (resting; it replaces the hover Ask). Counting the buttons the
   * rail ACTUALLY renders — rather than restating a number — is what makes this
   * RED when the rail gains a member BaseNode's count does not know about.
   */
  it.each(['decision', 'goal'] as const)('%s: `data-anchor-rail-buttons` equals the buttons its rail renders', (kind) => {
    useGuidanceStore.setState({ _sendMessage: null, _prefillChat: vi.fn() } as never)
    const id = renderCard(kind)
    const rail = screen.getByTestId(`node-card-rail-${id}`)
    const rendered = within(rail).getAllByRole('button')
    // Precondition: the edit route and the coaching icon are both drawn, so the
    // count below is the full no-extras rail and not a partial one.
    expect(within(rail).getByTestId(`node-action-edit-${id}`)).toBeInTheDocument()
    expect(within(rail).getByTestId(`node-action-challenge-${id}`)).toBeInTheDocument()
    expect(rendered).toHaveLength(4)
    const reserved = screen.getByTestId('anchor-body-rail-beside').getAttribute('data-anchor-rail-buttons')
    expect(Number(reserved)).toBe(rendered.length)
  })
})

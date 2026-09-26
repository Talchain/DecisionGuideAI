/**
 * Canvas visual contract v3.1 — the inspector shell (DESIGN-GAP-v31 rows 7, 8).
 *
 *   `.inspector{width:330px;border:1px solid #B8D5CF;border-radius:12px}`
 *   `.inspector-head .label{font-size:10px;color:var(--muted)}` — the KIND,
 *     never the kind colour (Goal yellow measured 1.62:1) and never a claim
 *     about the element ("You can change this").
 *   `.inspector-head h3{font-size:14px;font-weight:600}` — unclipped.
 *   Buttons: "Explore with Olumi" and "Back to the conversation" (v3.1 point
 *     11: "Inspectors gain 'Back to the conversation'"), not "Back to results".
 *   v3.1 point 11: ONE human-agency statement, in the PANEL footer — so an
 *     inspector carries none. What an inspector keeps is its save truth, as the
 *     contract's quiet 10px `.inspector-note` at the foot of the body.
 *
 * Every assertion binds by identity (test id, exact label, exact constant),
 * never by a value predicate another element could satisfy.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'

vi.mock('@xyflow/react', () => ({ useViewport: () => ({ x: 0, y: 0, zoom: 1 }) }))
const reveal = vi.fn(() => true)
vi.mock('../../../conversation/revealOlumi', () => ({ revealOlumiSurface: () => reveal() }))

import { InspectorRouter } from '../InspectorRouter'
import { useCanvasStore } from '../../../store'
import { useGuidanceStore } from '../../../stores/guidanceStore'
import { useAskOlumiStore } from '../../../../components/results/coaching/askOlumiStore'
import { INSPECTOR_AGENCY_STATEMENT } from '../useInspectorMutations'
import { DECISION_NODE_LABEL } from '../../../domain/vocabulary'

const NODES = [
  { id: 'g1', type: 'goal', data: { label: 'Revenue target', kind: 'goal' }, position: { x: 0, y: 0 } },
  { id: 'd1', type: 'decision', data: { label: 'Strategy', kind: 'decision' }, position: { x: 0, y: 0 } },
  { id: 'o1', type: 'option', data: { label: 'Grow', kind: 'option' }, position: { x: 0, y: 0 } },
  { id: 'fc', type: 'factor', data: { label: 'Bottom-Up Adoption Friction For Self-Serve Trials', kind: 'factor', category: 'controllable', value: 0.4 }, position: { x: 0, y: 0 } },
  { id: 'fe', type: 'factor', data: { label: 'Competition', kind: 'factor', category: 'external' }, position: { x: 0, y: 0 } },
  { id: 'fo', type: 'factor', data: { label: 'Churn', kind: 'factor', category: 'observable' }, position: { x: 0, y: 0 } },
  { id: 'oc', type: 'outcome', data: { label: 'Revenue', kind: 'outcome' }, position: { x: 0, y: 0 } },
  { id: 'r1', type: 'risk', data: { label: 'Op risk', kind: 'risk' }, position: { x: 0, y: 0 } },
  { id: 'x1', type: 'action', data: { label: 'Hire', kind: 'action' }, position: { x: 0, y: 0 } },
]
const EDGES = [
  { id: 'e1', source: 'fc', target: 'oc', data: { weight: 0.5, weightSource: 'user', direction: 'positive', beliefExists: 0.7, beliefExistsSource: 'cee' } },
]

const PANES: Array<{ name: string; nodeId: string | null; edgeId: string | null; kind: string }> = [
  { name: 'goal', nodeId: 'g1', edgeId: null, kind: 'Goal' },
  { name: 'decision', nodeId: 'd1', edgeId: null, kind: DECISION_NODE_LABEL },
  { name: 'option', nodeId: 'o1', edgeId: null, kind: 'Option' },
  { name: 'factor-controllable', nodeId: 'fc', edgeId: null, kind: 'Factor' },
  { name: 'factor-external', nodeId: 'fe', edgeId: null, kind: 'Factor' },
  { name: 'factor-observable', nodeId: 'fo', edgeId: null, kind: 'Factor' },
  { name: 'outcome', nodeId: 'oc', edgeId: null, kind: 'Outcome' },
  { name: 'risk', nodeId: 'r1', edgeId: null, kind: 'Risk' },
  { name: 'generic', nodeId: 'x1', edgeId: null, kind: 'Action' },
  { name: 'edge', nodeId: null, edgeId: 'e1', kind: 'Relationship' },
]

beforeEach(() => {
  reveal.mockClear()
  useAskOlumiStore.getState().close()
  // A conversation surface is registered, so the conversation routes may show.
  useGuidanceStore.setState({ _prefillChat: null, _sendMessage: vi.fn(), _dispatchAction: null } as never)
  useCanvasStore.setState({
    nodes: NODES as never[],
    edges: EDGES as never[],
    results: { status: 'idle' },
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
    goalThreshold: null,
    confirmedNodeIds: new Set(),
    _internal: {},
  } as never)
})

describe('v3.1 inspector shell — every pane', () => {
  for (const pane of PANES) {
    it(`${pane.name}: kind label, title, header, buttons, one quiet note, no agency statement`, () => {
      const onClose = vi.fn()
      const { container } = render(
        <InspectorRouter nodeId={pane.nodeId} edgeId={pane.edgeId} onClose={onClose} />,
      )
      const shell = screen.getByRole('region', { name: 'Inspector panel' })
      expect(shell.getAttribute('data-inspector-width')).toBe('330')

      // Kind label: the kind word, 10px, muted — never the kind colour.
      const kind = screen.getByTestId('inspector-kind-label')
      expect(kind.textContent).toBe(pane.kind)
      expect(kind.className).toContain('text-[10px]')
      expect(kind.className).toContain('text-text-light')
      expect(kind.style.color).toBe('')
      expect(container.textContent).not.toContain('You can change this')

      // Header holds the kind, the title and Close — nothing else.
      const header = screen.getByTestId('inspector-header')
      expect(within(header).queryByText('Back to results')).toBeNull()
      expect(within(header).queryByRole('button', { name: /technical detail/i })).toBeNull()
      expect(screen.queryByTestId('inspector-back-to-results')).toBeNull()
      expect(within(header).getByRole('button', { name: 'Close inspector' })).toBeTruthy()

      // Technical detail stays reachable, at the foot of the body.
      const tech = screen.getByTestId('inspector-tech-toggle')
      expect(tech.getAttribute('aria-label')).toBe('Show technical detail')
      expect(header.contains(tech)).toBe(false)

      // The two contract buttons, and not the old chips.
      expect(screen.getByTestId('inspector-quick-ask').textContent).toBe('Explore with Olumi')
      expect(screen.getByTestId('inspector-back-to-conversation').textContent).toBe('Back to the conversation')
      expect(screen.queryByTestId('inspector-quick-change')).toBeNull()
      expect(screen.queryByTestId('inspector-quick-analysis')).toBeNull()

      // v3.1 point 11: the agency statement lives in the panel footer, not here.
      expect(screen.queryByTestId('inspector-agency-statement')).toBeNull()
      expect(container.textContent).not.toContain(INSPECTOR_AGENCY_STATEMENT)
      expect(screen.queryByTestId('inspector-agency-note')).toBeNull()

      // The save truth survives as ONE quiet 10px note, last in the body.
      const notes = screen.getAllByTestId('inspector-authority-notice')
      expect(notes).toHaveLength(1)
      const note = notes[0]
      expect(note.className).toContain('text-[10px]')
      const body = screen.getByTestId('inspector-body')
      const lastBlock = body.lastElementChild
      expect(lastBlock === note || lastBlock?.contains(note)).toBe(true)
    })
  }

  it('the title is never clipped and carries ONE edit route (no dashed underline)', () => {
    render(<InspectorRouter nodeId="fc" edgeId={null} onClose={vi.fn()} />)
    const trigger = screen.getByTestId('inspector-rename-trigger')
    const text = trigger.querySelector('span')!
    expect(text.textContent).toBe('Bottom-Up Adoption Friction For Self-Serve Trials')
    expect(text.className).not.toContain('truncate')
    expect(text.className).not.toContain('border-dashed')
    // One pencil, and no second "Change this" route beside it.
    expect(screen.getAllByTestId('inspector-rename-cue')).toHaveLength(1)
    expect(screen.queryByText('Change this')).toBeNull()
  })

  it('"Back to the conversation" fronts the conversation, then closes — the element stays selected', () => {
    const onClose = vi.fn()
    useCanvasStore.setState({ selection: { nodeIds: new Set(['fc']), edgeIds: new Set(), anchorPosition: null } } as never)
    render(<InspectorRouter nodeId="fc" edgeId={null} onClose={onClose} />)
    fireEvent.click(screen.getByTestId('inspector-back-to-conversation'))
    expect(reveal).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect([...useCanvasStore.getState().selection.nodeIds]).toEqual(['fc'])
  })

  it('"Explore with Olumi" lands an editable draft about this element and sends nothing', () => {
    const send = vi.fn()
    useGuidanceStore.setState({ _sendMessage: send } as never)
    render(<InspectorRouter nodeId="fc" edgeId={null} onClose={vi.fn()} />)
    fireEvent.click(screen.getByTestId('inspector-quick-ask'))
    const drawer = useAskOlumiStore.getState()
    expect(drawer.isOpen).toBe(true)
    expect(drawer.targetId).toBe('fc')
    expect(send).not.toHaveBeenCalled()
  })

  it('⭐ CONTRAST — with no conversation surface, neither conversation route is offered', () => {
    useGuidanceStore.setState({ _prefillChat: null, _sendMessage: null, _dispatchAction: null } as never)
    render(<InspectorRouter nodeId="fc" edgeId={null} onClose={vi.fn()} />)
    expect(screen.queryByTestId('inspector-quick-ask')).toBeNull()
    expect(screen.queryByTestId('inspector-back-to-conversation')).toBeNull()
    // The shell itself is unchanged.
    expect(screen.getByTestId('inspector-kind-label').textContent).toBe('Factor')
  })
})

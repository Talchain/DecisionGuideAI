/**
 * Paul 23 Sep contract feedback, point 11 (the canvas part) and point 12.
 *
 *   "One human-agency statement, not three versions of the same disclaimer."
 *   "Attention → inspector/AI should have an obvious route back to the
 *    conversation/context."
 *   "Icons need hover/focus labels and inspector access."
 *
 * What these pin, per inspector pane (every node panel type and the edge pane):
 *
 *   1. EXACTLY ONE human-agency statement, bound by identity (its test id AND
 *      the constant's exact text), never a value predicate.
 *   2. The save/not-saved truth is said ONCE. The "… still work" boilerplate
 *      that every arm repeated is gone, and no pane states "not sent yet" /
 *      "can't yet be saved" / "read-only for now" more than once.
 *   3. The pane-specific truths the older specs pin are still there — this
 *      file shortens the notice, it does not delete a truth.
 *   4. A node the attention plan flagged shows WHY at the top of its inspector,
 *      directly above "Ask Olumi", and the ask carries that context.
 *   5. The confidence glyph has an accessible name (not colour or glyph alone).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { AttentionReason } from '../../../nodes/shared/nodeAttention'

const attentionByNode = new Map<string, AttentionReason[]>()
vi.mock('../../../nodes/shared/useNodeAttention', () => ({
  useNodeAttention: (id: string) => {
    const reasons = attentionByNode.get(id) ?? []
    return { reasons, marked: reasons.length > 0, markedCount: reasons.length > 0 ? 1 : 0, candidateCount: reasons.length > 0 ? 1 : 0 }
  },
}))
vi.mock('@xyflow/react', () => ({ useViewport: () => ({ x: 0, y: 0, zoom: 1 }) }))
vi.mock('../../../conversation/revealOlumi', () => ({ revealOlumiSurface: vi.fn() }))

import { InspectorRouter } from '../InspectorRouter'
import { INSPECTOR_GOAL_REASON } from '../panels/GoalPanel'
import { useCanvasStore } from '../../../store'
import { useGuidanceStore } from '../../../stores/guidanceStore'
import { useAskOlumiStore } from '../../../../components/results/coaching/askOlumiStore'
import {
  INSPECTOR_AGENCY_STATEMENT,
  INSPECTOR_READ_ONLY_REASON,
  INSPECTOR_OPTION_READ_ONLY_REASON,
  INSPECTOR_FACTOR_CONTROLLABLE_REASON,
  INSPECTOR_FACTOR_EXTERNAL_REASON,
  INSPECTOR_EDGE_REASON,
  INSPECTOR_EDGE_NO_STRENGTH_BASIS_REASON,
  INSPECTOR_EDGE_AWAITING_STATED_STRENGTH_REASON,
} from '../useInspectorMutations'
import { ConfidenceBadge } from '../shared/ConfidenceBadge'

const NODES = [
  { id: 'g1', type: 'goal', data: { label: 'Revenue target', kind: 'goal' }, position: { x: 0, y: 0 } },
  { id: 'd1', type: 'decision', data: { label: 'Strategy', kind: 'decision' }, position: { x: 0, y: 0 } },
  { id: 'o1', type: 'option', data: { label: 'Grow', kind: 'option' }, position: { x: 0, y: 0 } },
  { id: 'fc', type: 'factor', data: { label: 'Budget', kind: 'factor', category: 'controllable', value: 0.4 }, position: { x: 0, y: 0 } },
  { id: 'fe', type: 'factor', data: { label: 'Competition', kind: 'factor', category: 'external' }, position: { x: 0, y: 0 } },
  { id: 'fo', type: 'factor', data: { label: 'Churn', kind: 'factor', category: 'observable' }, position: { x: 0, y: 0 } },
  { id: 'oc', type: 'outcome', data: { label: 'Revenue', kind: 'outcome' }, position: { x: 0, y: 0 } },
  { id: 'r1', type: 'risk', data: { label: 'Op risk', kind: 'risk' }, position: { x: 0, y: 0 } },
  { id: 'x1', type: 'action', data: { label: 'Hire', kind: 'action' }, position: { x: 0, y: 0 } },
]
const EDGES = [
  // A server-held link with no stated strength (the "no basis" population).
  { id: 'e1', source: 'fc', target: 'oc', data: { weight: 0.5, weightSource: 'user', direction: 'positive', beliefExists: 0.7, beliefExistsSource: 'cee' } },
  // A drawn link the server has never received.
  { id: 'e2', source: 'fe', target: 'oc', data: { structuralAddStandDown: 'strength_not_stated' } },
]

function seed() {
  useCanvasStore.setState({
    nodes: NODES as never[],
    edges: EDGES as never[],
    results: { status: 'idle' },
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
    goalThreshold: null,
    confirmedNodeIds: new Set(),
    _internal: {},
  } as never)
}

const PANES: Array<{ name: string; nodeId: string | null; edgeId: string | null; truth: string }> = [
  // 24 Sep 2026: the goal pane opted out of the blanket — its target control is
  // the Model tab's `SuccessTargetLine` — so it says its own facts.
  { name: 'goal', nodeId: 'g1', edgeId: null, truth: INSPECTOR_GOAL_REASON },
  { name: 'decision (blanket)', nodeId: 'd1', edgeId: null, truth: INSPECTOR_READ_ONLY_REASON },
  { name: 'option', nodeId: 'o1', edgeId: null, truth: INSPECTOR_OPTION_READ_ONLY_REASON },
  { name: 'factor-controllable', nodeId: 'fc', edgeId: null, truth: INSPECTOR_FACTOR_CONTROLLABLE_REASON },
  { name: 'factor-external', nodeId: 'fe', edgeId: null, truth: INSPECTOR_FACTOR_EXTERNAL_REASON },
  // 24 Sep 2026: the observable pane opted out of the blanket — its value now
  // commits through `factor_value_edit`, the controllable pane's carrier — so it
  // says the controllable pane's facts, not the blanket's.
  { name: 'factor-observable', nodeId: 'fo', edgeId: null, truth: INSPECTOR_FACTOR_CONTROLLABLE_REASON },
  { name: 'outcome (blanket)', nodeId: 'oc', edgeId: null, truth: INSPECTOR_READ_ONLY_REASON },
  { name: 'risk (blanket)', nodeId: 'r1', edgeId: null, truth: INSPECTOR_READ_ONLY_REASON },
  { name: 'generic (blanket)', nodeId: 'x1', edgeId: null, truth: INSPECTOR_READ_ONLY_REASON },
  { name: 'edge, no strength basis', nodeId: null, edgeId: 'e1', truth: INSPECTOR_EDGE_NO_STRENGTH_BASIS_REASON },
  { name: 'edge, drawn and awaiting a strength', nodeId: null, edgeId: 'e2', truth: INSPECTOR_EDGE_AWAITING_STATED_STRENGTH_REASON },
]

const count = (text: string, re: RegExp) => (text.match(new RegExp(re.source, 'gi')) ?? []).length

beforeEach(() => {
  attentionByNode.clear()
  useAskOlumiStore.getState().close()
  useGuidanceStore.setState({ _prefillChat: null, _sendMessage: null, _dispatchAction: null } as never)
  seed()
})

describe('Paul 23 Sep point 11 — one human-agency statement per inspector pane', () => {
  it('the agency statement is short, model-relative and names who decides', () => {
    expect(INSPECTOR_AGENCY_STATEMENT).toMatch(/^You decide\b/)
    expect(INSPECTOR_AGENCY_STATEMENT).toMatch(/Olumi/)
    // No recommendation language, and no em-dash (the external pane pins that).
    expect(INSPECTOR_AGENCY_STATEMENT).not.toMatch(/recommend|best|should|—/i)
    expect(INSPECTOR_AGENCY_STATEMENT.split(/\s+/).length).toBeLessThanOrEqual(16)
  })

  for (const pane of PANES) {
    it(`${pane.name}: exactly one agency statement, one save truth, no boilerplate`, () => {
      const { container } = render(
        <InspectorRouter nodeId={pane.nodeId} edgeId={pane.edgeId} onClose={vi.fn()} />,
      )
      const agency = screen.getAllByTestId('inspector-agency-statement')
      expect(agency).toHaveLength(1)
      expect(agency[0].textContent).toBe(INSPECTOR_AGENCY_STATEMENT)

      // The notice is still the SAME element the fieldset describes, and it
      // still carries this pane's own truth — shortened, not deleted.
      const notice = screen.getByTestId('inspector-authority-notice')
      expect(notice.textContent).toBe(pane.truth)

      const text = container.textContent ?? ''
      expect(count(text, /You decide\b/)).toBe(1)
      expect(text).not.toMatch(/still work/i)
      expect(count(text, /not sent yet|can't yet be saved|read-only for now/)).toBeLessThanOrEqual(1)
    })
  }

  it('the server-held edge WITH a stated strength keeps its own truth', () => {
    useCanvasStore.setState({
      edges: [
        {
          id: 'e3',
          source: 'fc',
          target: 'oc',
          data: { weight: 0.5, direction: 'positive', serverStrength: { mean: 0.5, effect_direction: 'positive' } },
        },
      ] as never[],
    } as never)
    const { container } = render(<InspectorRouter nodeId={null} edgeId="e3" onClose={vi.fn()} />)
    expect(screen.getByTestId('inspector-authority-notice').textContent).toBe(INSPECTOR_EDGE_REASON)
    expect(screen.getAllByTestId('inspector-agency-statement')).toHaveLength(1)
    const text = container.textContent ?? ''
    expect(text).not.toMatch(/still work/i)
    expect(count(text, /not sent yet|can't yet be saved|read-only for now/)).toBeLessThanOrEqual(1)
  })

  it('the truths older specs pin are still said', () => {
    expect(INSPECTOR_READ_ONLY_REASON).toMatch(/You can rename this/)
    expect(INSPECTOR_READ_ONLY_REASON).toMatch(/can't yet be saved/)
    expect(INSPECTOR_READ_ONLY_REASON).toMatch(/Model tab/)
    expect(INSPECTOR_FACTOR_CONTROLLABLE_REASON).toMatch(/The value saves to the shared model/)
    expect(INSPECTOR_FACTOR_EXTERNAL_REASON).toMatch(/a judgement for Olumi, not an edit to the shared model/)
    expect(INSPECTOR_EDGE_REASON).toMatch(/link strength saves to the shared model/)
    expect(INSPECTOR_EDGE_NO_STRENGTH_BASIS_REASON).toMatch(/ask olumi to set/i)
    for (const s of [
      INSPECTOR_READ_ONLY_REASON,
      INSPECTOR_OPTION_READ_ONLY_REASON,
      INSPECTOR_FACTOR_CONTROLLABLE_REASON,
      INSPECTOR_FACTOR_EXTERNAL_REASON,
      INSPECTOR_GOAL_REASON,
    ]) {
      expect(s).toMatch(/only for elements the model already holds/)
    }
  })
})

describe('Paul 23 Sep point 11 — attention → inspector has a route back to the conversation', () => {
  const REASON: AttentionReason = {
    kind: 'evidence_gap',
    order: 2,
    label: 'Evidence here would most reduce uncertainty in the comparison. What would you check first?',
  }

  it('a flagged node shows why at the top, above Ask Olumi and above the notice', () => {
    attentionByNode.set('fc', [REASON])
    useGuidanceStore.setState({ _sendMessage: vi.fn() } as never)
    render(<InspectorRouter nodeId="fc" edgeId={null} onClose={vi.fn()} />)

    const block = screen.getByTestId('inspector-attention-context')
    expect(block).toHaveTextContent('Worth reviewing')
    expect(block).toHaveTextContent(REASON.label)

    const ask = screen.getByTestId('inspector-quick-ask')
    const notice = screen.getByTestId('inspector-authority-notice')
    // DOM order: attention context → Ask Olumi → notice.
    expect(block.compareDocumentPosition(ask) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(ask.compareDocumentPosition(notice) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('Ask Olumi opens the conversation with this element and its attention reason as context', () => {
    attentionByNode.set('fc', [REASON])
    const send = vi.fn()
    useGuidanceStore.setState({ _sendMessage: send } as never)
    render(<InspectorRouter nodeId="fc" edgeId={null} onClose={vi.fn()} />)

    fireEvent.click(screen.getByTestId('inspector-quick-ask'))
    const drawer = useAskOlumiStore.getState()
    expect(drawer.isOpen).toBe(true)
    expect(send).not.toHaveBeenCalled()
    expect(drawer.targetId).toBe('fc')
    expect(drawer.draft).toContain('Budget')
    expect(drawer.context).toContain(REASON.label)
  })

  it('⭐ CONTRAST — an unflagged node renders no attention block, and the ask carries no invented reason', () => {
    useGuidanceStore.setState({ _sendMessage: vi.fn() } as never)
    render(<InspectorRouter nodeId="fc" edgeId={null} onClose={vi.fn()} />)
    expect(screen.queryByTestId('inspector-attention-context')).toBeNull()
    fireEvent.click(screen.getByTestId('inspector-quick-ask'))
    expect(useAskOlumiStore.getState().context).not.toMatch(/Worth reviewing/)
  })
})

describe('Paul 23 Sep point 12 — the confidence glyph is not glyph or colour alone', () => {
  it('has an accessible name and a hover label naming the level and value', () => {
    render(<ConfidenceBadge level="medium" value={55} />)
    const badge = screen.getByTestId('inspector-confidence-badge')
    expect(badge.getAttribute('aria-label')).toMatch(/medium/i)
    expect(badge.getAttribute('aria-label')).toMatch(/55%/)
    expect(badge.getAttribute('title')).toBe(badge.getAttribute('aria-label'))
  })
})

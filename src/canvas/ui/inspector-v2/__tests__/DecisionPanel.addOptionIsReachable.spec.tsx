/**
 * ⭐⭐ THE DECISION'S "+ Add option" MUST BE OPERABLE IN THE MOUNTED INSPECTOR.
 *
 * ── THE DEFECT ───────────────────────────────────────────────────────────────
 * `DecisionPanel` rendered a real `+ Add option` button whose handler calls
 * `addNodeWithEdge(pos, 'option', decisionId, 'from-target')` — the same store
 * action the canvas context menu uses, which captures a durable
 * `structural_add` intent for the new option. `DecisionPanel.addOption.spec.tsx`
 * proved that handler. It could not prove a user could press it, because it
 * renders the panel DIRECTLY: `'decision'` is not in `InspectorRouter`'s
 * `AUTHORITY_OWNING_PANELS`, so in the mounted app the whole panel — this button
 * included — sits inside `<fieldset disabled data-authority="disabled">`, and a
 * disabled fieldset natively inerts every descendant `<button>`. Coded, tested,
 * and dead for every user (EDITABILITY-MATRIX-20260924, Decision row 2).
 *
 * ── THE FIX, AND WHY IT IS THIS SHAPE ────────────────────────────────────────
 * The control moves to the Inspector's `quickActions` slot — the same escape
 * hatch the rename already uses, above the fenced body — and NOTHING ELSE on the
 * decision panel is unfenced. The panel stays wrapped. Adding `'decision'` to
 * `AUTHORITY_OWNING_PANELS` would have released every other control on the pane
 * too, which is a wider change than the one gap being closed.
 *
 * ── SO THIS FILE MOUNTS THE REAL ROUTER, AND ASKS FOUR THINGS ────────────────
 *   1. the control is present and NOT inert, walking ancestors for a disabled
 *      fieldset (jsdom does not propagate `<fieldset disabled>` to a
 *      descendant's `disabled` property — `inspectorAuthorityBinding.spec.tsx`
 *      records that instrument trap);
 *   2. pressing it — with `userEvent`, which refuses a disabled target — creates
 *      an option joined to THIS decision and puts a `structural_add` for THAT
 *      option on the wire, asserted at the sender, bound by the created node's
 *      identity;
 *   3. CONTRAST: the rest of the decision panel is still behind the Router's
 *      boundary, and a writer inside it is still inert;
 *   4. CONTRAST: a non-decision panel gets no such control.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Node } from '@xyflow/react'

vi.mock('@xyflow/react', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useViewport: () => ({ x: 0, y: 0, zoom: 1 }),
}))
// The drain gates on the orchestrator flag; spread the real module so no other
// flag goes silently absent (CLAUDE.md trap 12).
vi.mock('../../../../flags', async importOriginal => ({
  ...(await importOriginal<typeof import('../../../../flags')>()),
  isOrchestratorV2Enabled: () => true,
}))

import { InspectorRouter } from '../InspectorRouter'
import { useCanvasStore } from '../../../store'
import { useStructuralAddEvents } from '../../../conversation/useStructuralAddEvents'

const DECISION_ID = 'dec_pricing'
const RISK_ID = 'risk_churn'
/** A CEE-stamped hash, so the capture is a SEND rather than a deferral. */
const SERVER_HASH = 'aag_v1:deadbeefcafe'
const ADD = '[data-testid="decision-add-option"]'

const DECISION: Node = {
  id: DECISION_ID,
  type: 'decision',
  position: { x: 40, y: 40 },
  data: {
    kind: 'decision',
    label: 'How should we price the Pro tier?',
    // A description, so the panel renders a real <textarea> writer — the
    // contrast control below needs a form control that must STAY inert.
    description: 'Pricing decision for next quarter.',
  },
} as Node

const RISK: Node = {
  id: RISK_ID,
  type: 'risk',
  position: { x: 0, y: 0 },
  data: { kind: 'risk', label: 'Churn spikes after the rise' },
} as Node

function seed() {
  useCanvasStore.setState({
    currentScenarioId: 'scenario-1',
    lastServerGraphHash: SERVER_HASH,
    lastAuthoritativeGraph: null,
    pendingStructuralAdds: [],
    pendingStructuralAddEdges: [],
    structuralAddLifecycle: [],
    _externalMutationActive: 0,
    nodes: [structuredClone(DECISION), structuredClone(RISK)] as unknown as Node[],
    edges: [],
    history: { past: [], future: [] },
    engineLimits: null,
    results: { status: 'idle', report: null },
    ceeAnalysisReady: null,
    selection: { nodeIds: new Set([DECISION_ID]), edgeIds: new Set(), anchorPosition: null },
    goalThreshold: null,
    confirmedNodeIds: new Set(),
    _internal: {},
  } as never)
  // The product's own id reseed, so the created option can never reuse a
  // fixture id (`structuralAdd.connectedAddIsDurable.spec.ts` records the false
  // result a raw `setState` produces without it).
  useCanvasStore.getState().reseedIds([DECISION, RISK] as unknown as Node[], [])
}

/** Mounts the REAL drain beside the Inspector, so the send is observed at the sender. */
function Drain({ send }: { send: (e: unknown, o?: unknown) => Promise<unknown> }) {
  useStructuralAddEvents(send as never)
  return null
}

function isInert(el: Element | null): boolean {
  if (el === null) return true
  if (el.hasAttribute('disabled')) return true
  return el.closest('fieldset[disabled]') !== null
}

const send = vi.fn(async (_event: unknown, _opts?: unknown): Promise<unknown> => undefined)

beforeEach(() => {
  vi.clearAllMocks()
  seed()
})
afterEach(cleanup)

describe('the decision\'s "+ Add option" is reachable through the mounted Inspector', () => {
  it('is rendered and is NOT inert — it sits outside the Router boundary', () => {
    const { container } = render(<InspectorRouter nodeId={DECISION_ID} edgeId={null} onClose={vi.fn()} />)
    const add = container.querySelector(ADD)
    expect(add, 'the add-option control must be rendered for a decision').not.toBeNull()
    const boundary = container.querySelector('fieldset[data-authority="disabled"]')
    expect(boundary, 'PRECONDITION: the decision panel is still wrapped').not.toBeNull()
    expect(boundary!.contains(add!), 'the control is still inside the disabled boundary').toBe(false)
    expect(isInert(add), 'the add-option control is inert — no user can press it').toBe(false)
  })

  it('pressing it creates an option joined to THIS decision and SENDS structural_add for it', async () => {
    render(
      <>
        <Drain send={send} />
        <InspectorRouter nodeId={DECISION_ID} edgeId={null} onClose={vi.fn()} />
      </>,
    )
    const before = new Set(useCanvasStore.getState().nodes.map(n => n.id))

    // userEvent, not fireEvent: it refuses a disabled target, so this press is
    // an actionability check and not a synthetic dispatch past the fence.
    await userEvent.click(screen.getByTestId('decision-add-option'))

    const s = useCanvasStore.getState()
    const created = s.nodes.filter(n => !before.has(n.id))
    expect(created, 'exactly one node must be created').toHaveLength(1)
    const option = created[0]
    expect(option.type).toBe('option')

    // Joined to THIS decision, decision → option.
    const link = s.edges.find(e => e.source === DECISION_ID && e.target === option.id)
    expect(link, 'the new option must be joined to the decision it was added from').toBeDefined()

    // ⭐ THE OUTGOING EVENT, asserted at the sender and bound by the CREATED
    // node's identity — never "some structural_add was sent" (trap 19).
    await waitFor(() => expect(send).toHaveBeenCalled())
    const addEvents = send.mock.calls
      .map(c => c[0] as { type: string; payload: Record<string, unknown> })
      .filter(e => e.type === 'structural_add')
    expect(addEvents, 'exactly one structural_add must be sent').toHaveLength(1)
    expect(addEvents[0].payload.node_id).toBe(option.id)
    expect(addEvents[0].payload.node_id).not.toBe(DECISION_ID)
    expect(addEvents[0].payload.node_kind).toBe('option')
    expect(addEvents[0].payload.label).toBe((option.data as { label?: string }).label)
    expect(addEvents[0].payload.base_graph_hash).toBe(SERVER_HASH)
  })

  it('CONTRAST — the rest of the decision panel stays fenced: its description writer is inert', () => {
    const { container } = render(<InspectorRouter nodeId={DECISION_ID} edgeId={null} onClose={vi.fn()} />)
    const boundary = container.querySelector('fieldset[data-authority="disabled"]')
    expect(boundary).not.toBeNull()
    const textarea = boundary!.querySelector('textarea')
    expect(textarea, 'PRECONDITION: the description writer is rendered inside the boundary').not.toBeNull()
    expect(isInert(textarea), 'the description writer was unfenced along with the add-option control').toBe(true)
  })

  it('CONTRAST — a non-decision panel offers no add-option control', () => {
    const { container } = render(<InspectorRouter nodeId={RISK_ID} edgeId={null} onClose={vi.fn()} />)
    expect(container.querySelector('[role="region"][aria-label="Inspector panel"]')).not.toBeNull()
    expect(container.querySelector(ADD)).toBeNull()
  })
})

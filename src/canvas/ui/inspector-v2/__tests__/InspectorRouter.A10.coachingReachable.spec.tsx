/**
 * A10 — the Router's panel-wide `<fieldset disabled>` was killing Ask,
 * Dismiss and Explore on the Risk and Outcome panels, along with the Risk
 * panel's likelihood trigger ("Not set. Click to enter.") and its Low–Critical
 * impact buttons — none of which distinguishes a writer from a non-writer, so
 * the blanket disabled all of it.
 *
 * `RiskPanel`'s likelihood/impact controls DO write (via a bare `updateNode`,
 * no durable carrier), so they stay fenced — now inside `RiskPanel` itself,
 * scoped to just those two controls. `OutcomePanel` owns no writer at all
 * ("Read-first panel" — its own docblock), so nothing inside it is fenced.
 *
 * THE DISCRIMINATING PAIR, for Risk: "every writer disabled" alone passes if
 * the panel disables everything (the defect this replaces); "every
 * non-writer enabled" alone passes if it disables nothing (the authority it
 * must never take). Only both together describe the boundary.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

import { InspectorRouter } from '../InspectorRouter'
import { useCanvasStore } from '../../../store'

vi.mock('@xyflow/react', () => ({
  useViewport: () => ({ x: 0, y: 0, zoom: 1 }),
}))

function setStoreState(nodes: unknown[], edges: unknown[] = []) {
  useCanvasStore.setState({
    nodes: nodes as never[],
    edges: edges as never[],
    results: { status: 'idle' },
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
    goalThreshold: null,
    confirmedNodeIds: new Set(),
    _internal: {},
  } as never)
}

const RISK_FIXTURE = [
  {
    id: 'r1',
    type: 'risk',
    data: { label: 'Operational risk', kind: 'risk' },
    position: { x: 0, y: 0 },
  },
]

const OUTCOME_FIXTURE = [
  {
    id: 'out1',
    type: 'outcome',
    data: { label: 'Monthly revenue', kind: 'outcome' },
    position: { x: 0, y: 0 },
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  cleanup()
})
afterEach(cleanup)

describe('the risk panel — writers stay fenced, everything else does not', () => {
  beforeEach(() => setStoreState(RISK_FIXTURE))

  it('is NOT wrapped by the Router — the panel-wide blanket is gone', () => {
    render(<InspectorRouter nodeId="r1" edgeId={null} onClose={vi.fn()} />)
    expect(document.querySelector('fieldset[data-authority="disabled"]')).toBeNull()
  })

  it('keeps the likelihood trigger fenced — it writes, with no durable carrier', () => {
    render(<InspectorRouter nodeId="r1" edgeId={null} onClose={vi.fn()} />)
    const trigger = screen.getByTestId('risk-probability-display')
    expect(trigger, 'likelihood is live with no carrier').toBeDisabled()
  })

  it('keeps every impact button fenced', () => {
    render(<InspectorRouter nodeId="r1" edgeId={null} onClose={vi.fn()} />)
    for (const level of ['low', 'medium', 'high', 'critical']) {
      expect(
        screen.getByTestId(`risk-impact-${level}`),
        `impact "${level}" is live with no carrier`,
      ).toBeDisabled()
    }
  })

  it('the fence names itself, so the reason is visible rather than assumed', () => {
    render(<InspectorRouter nodeId="r1" edgeId={null} onClose={vi.fn()} />)
    const fence = document.querySelector('fieldset[data-writer-fence="probability-impact"]')
    expect(fence, 'PRECONDITION: the pane must self-fence its writers').not.toBeNull()
    expect(fence).toBeDisabled()
    expect(screen.getByTestId('inspector-authority-notice')).toHaveTextContent(
      'not yet saved to the shared model',
    )
  })

  it('leaves the coaching card reachable — Dismiss is not disabled', () => {
    render(<InspectorRouter nodeId="r1" edgeId={null} onClose={vi.fn()} />)
    expect(
      screen.getByRole('button', { name: 'Dismiss suggestion' }),
      'coaching dismissal writes nothing; the blanket should never have reached it',
    ).not.toBeDisabled()
  })

  it('leaves the Close affordance reachable, unaffected by either fence', () => {
    render(<InspectorRouter nodeId="r1" edgeId={null} onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: /close/i })).not.toBeDisabled()
  })
})

describe('the outcome panel — a read-first pane fences nothing', () => {
  beforeEach(() => setStoreState(OUTCOME_FIXTURE))

  it('is NOT wrapped by the Router — the panel-wide blanket is gone', () => {
    render(<InspectorRouter nodeId="out1" edgeId={null} onClose={vi.fn()} />)
    expect(document.querySelector('fieldset[data-authority="disabled"]')).toBeNull()
  })

  it('declares no writer fence at all — the pane has nothing to protect', () => {
    render(<InspectorRouter nodeId="out1" edgeId={null} onClose={vi.fn()} />)
    expect(document.querySelectorAll('fieldset[data-writer-fence]')).toHaveLength(0)
  })

  it('leaves the coaching card reachable — Dismiss is not disabled', () => {
    render(<InspectorRouter nodeId="out1" edgeId={null} onClose={vi.fn()} />)
    expect(
      screen.getByRole('button', { name: 'Dismiss suggestion' }),
    ).not.toBeDisabled()
  })
})

describe('CONTRAST — a panel that took on no duty keeps the Router wrap', () => {
  it('an unresolved node kind (GenericNodePanel) is still blanket-fenced', () => {
    setStoreState([
      {
        id: 'g1',
        type: 'milestone',
        data: { label: 'Ship it', kind: 'milestone', description: 'No bespoke panel yet.' },
        position: { x: 0, y: 0 },
      },
    ])
    render(<InspectorRouter nodeId="g1" edgeId={null} onClose={vi.fn()} />)
    const fieldset = document.querySelector('fieldset[data-authority="disabled"]')
    expect(fieldset, 'a non-opted-in panel lost the Router wrap').not.toBeNull()
    expect(fieldset).toBeDisabled()
  })
})

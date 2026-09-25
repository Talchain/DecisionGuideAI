/**
 * A10 — the Router's panel-wide `<fieldset disabled>` was killing Ask,
 * Dismiss and Explore on the Risk and Outcome panels, along with the Risk
 * panel's likelihood trigger ("Not set. Click to enter.") and its Low–Critical
 * impact buttons — none of which distinguishes a writer from a non-writer, so
 * the blanket disabled all of it.
 *
 * `RiskPanel`'s likelihood/impact controls DO write (via a bare `updateNode`,
 * no durable carrier), so they stay fenced — now inside `RiskPanel` itself.
 *
 * ⛔ CORRECTED (review 2038 on `1cd208f5`): this header said `OutcomePanel`
 * "owns no writer at all". It owns one, and so does Risk beyond the two above:
 * the Description textarea in each pane's ADVANCED EDITOR, behind "Show
 * technical detail" → "Show model detail", commits `setDescription` — a bare
 * store write with no carrier. Leaving the Router's blanket un-fenced it on
 * both panes. Each pane now fences that editor itself
 * (`data-writer-fence="advanced-editor"`, the factor pane's pattern), pinned by
 * the last block below.
 *
 * THE DISCRIMINATING PAIR, for Risk: "every writer disabled" alone passes if
 * the panel disables everything (the defect this replaces); "every
 * non-writer enabled" alone passes if it disables nothing (the authority it
 * must never take). Only both together describe the boundary.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

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

describe('the outcome panel — a read-first pane, fenced only where it writes', () => {
  beforeEach(() => setStoreState(OUTCOME_FIXTURE))

  it('is NOT wrapped by the Router — the panel-wide blanket is gone', () => {
    render(<InspectorRouter nodeId="out1" edgeId={null} onClose={vi.fn()} />)
    expect(document.querySelector('fieldset[data-authority="disabled"]')).toBeNull()
  })

  it('declares no writer fence in the default view — its one writer sits behind technical detail', () => {
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

describe('review 2038 — the advanced editor\'s Description writer stays fenced on Risk AND Outcome', () => {
  // ⚠ jsdom's `.disabled` IDL property reflects only the element's OWN
  // attribute, never an ancestor `<fieldset disabled>`, so `toBeDisabled()` on
  // `.disabled` is the wrong probe here. `:disabled` is the selector the
  // browser applies, and it DOES inherit from the fieldset.
  const PANES = [
    { name: 'risk', fixture: RISK_FIXTURE, nodeId: 'r1' },
    { name: 'outcome', fixture: OUTCOME_FIXTURE, nodeId: 'out1' },
  ] as const

  for (const pane of PANES) {
    it(`${pane.name}: the Description textarea under model detail is :disabled, and typing + blur writes nothing`, async () => {
      setStoreState(pane.fixture)
      const user = userEvent.setup()
      const { container } = render(<InspectorRouter nodeId={pane.nodeId} edgeId={null} onClose={vi.fn()} />)
      await user.click(screen.getByRole('button', { name: 'Show technical detail' }))
      await user.click(screen.getByRole('button', { name: /Show model detail/i }))

      // Bound by IDENTITY: the editor's own labelled control, and it must be
      // the textarea (anti-vacuity — a readonly row would have no control).
      const description = screen.getByLabelText('Description')
      expect(description.tagName).toBe('TEXTAREA')
      expect(
        description.matches(':disabled'),
        `${pane.name}: the carrier-less setDescription writer is live`,
      ).toBe(true)
      expect(
        description.closest('fieldset[data-writer-fence="advanced-editor"]'),
        `${pane.name}: the writer must sit behind the pane's own advanced-editor fence`,
      ).not.toBeNull()
      expect(container.querySelector('fieldset[data-authority="disabled"]')).toBeNull()

      // The OUTCOME, not the symptom: a user's edit must not land in the store
      // as a silent local-only description.
      await user.click(description)
      await user.type(description, 'edited locally')
      await user.tab()
      const node = useCanvasStore.getState().nodes.find(n => n.id === pane.nodeId) as
        { data?: { description?: unknown } } | undefined
      expect(node, 'PRECONDITION: the node is still in the store').toBeDefined()
      expect(node?.data?.description, `${pane.name}: the fenced editor wrote a local-only description`).toBeUndefined()
    })
  }
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

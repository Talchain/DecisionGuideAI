/**
 * ⭐⭐ THE CONTROLLABLE-FACTOR PANEL FENCES ITS OWN WRITERS — AND KEEPS THE ONE
 * THAT SAVES.
 *
 * ── WHY THIS PANEL MAY BE LET OUT ────────────────────────────────────────────
 * The factor VALUE has a durable server-authoritative carrier,
 * `factor_value_edit`, built and merged in July (#513) and still this panel's
 * commit path (`buildFactorValueEditEvent` → `sendSystemEvent`). It has been
 * unreachable ever since, because `InspectorRouter`'s blanket
 * `<fieldset disabled>` cannot tell a control that saves from one that does not.
 * Nothing about the write changed; the fence moved to the place that can see the
 * difference.
 *
 * ── THE DISCRIMINATING SET, AND WHY EACH MEMBER IS NEEDED ────────────────────
 * A single assertion is satisfiable by doing something useless:
 *   · "the value control is enabled"  — passes if the panel fences NOTHING,
 *                                       which grants authority it must not take.
 *   · "every writer fence is disabled" — passes if the panel fences EVERYTHING,
 *                                       which is the defect it replaces.
 *   · neither sees navigation or coaching, which the blanket was killing for a
 *     reason that was never about them.
 *   · and none of them notices if the blanket were deleted for EVERY panel.
 * Trap 22b: one predicate guarding two opposite harms needs both directions
 * asserted, or the suite applauds a trade.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { InspectorModal } from '../../../components/InspectorModal'
import { useCanvasStore } from '../../../store'

// importOriginal-spread, NOT a hand-listed factory: `vi.mock` REPLACES the
// module, so a bare factory silently removes every other @xyflow/react export
// the subtree imports (CLAUDE.md trap 12).
vi.mock('@xyflow/react', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useViewport: () => ({ x: 0, y: 0, zoom: 1 }),
}))

const NODE_INSPECTOR = 'div[role="dialog"][aria-label="Node inspector"]'
const FACTOR_ID = 'fac_price'
const FACTOR_LABEL = 'Pro plan price'
const NEIGHBOUR_ID = 'out_revenue'
const RISK_ID = 'risk_churn'

function seed() {
  useCanvasStore.setState({
    nodes: [
      {
        id: FACTOR_ID,
        type: 'factor',
        position: { x: 0, y: 0 },
        data: {
          kind: 'factor',
          category: 'controllable',
          label: FACTOR_LABEL,
          description: 'What we charge for the Pro tier.',
          observedState: { value: 0.59, raw_value: 59, unit: '£' },
        },
      },
      {
        id: NEIGHBOUR_ID,
        type: 'outcome',
        position: { x: 0, y: 0 },
        data: { kind: 'outcome', label: 'Monthly revenue' },
      },
      {
        id: RISK_ID,
        type: 'risk',
        position: { x: 0, y: 0 },
        data: { kind: 'risk', label: 'Churn spikes after the rise' },
      },
    ] as never[],
    edges: [{ id: 'e1', source: FACTOR_ID, target: NEIGHBOUR_ID, data: {} }] as never[],
    results: { status: 'idle' },
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: { x: 0, y: 0 } },
    goalThreshold: null,
    confirmedNodeIds: new Set(),
    _internal: {},
  } as never)
}

function openFactor() {
  const utils = render(<InspectorModal nodeId={FACTOR_ID} edgeId={null} onClose={vi.fn()} />)
  // PRECONDITION: without the deployed chain mounted every assertion below is
  // about a component the product does not render (trap 3b).
  expect(
    utils.container.querySelector(NODE_INSPECTOR),
    'PRECONDITION: the node inspector dialog must be mounted',
  ).not.toBeNull()
  return utils
}

/**
 * ⚠ `fieldset[disabled]` INERTS ITS DESCENDANTS WITHOUT SETTING `disabled` ON
 * THEM, so asking a control whether it is disabled answers about the control and
 * not about the blanket over it. Every enabled-ness assertion below therefore
 * walks up for an ancestor fieldset as well.
 */
function isInert(el: Element | null): boolean {
  if (el === null) return true
  if (el.hasAttribute('disabled')) return true
  return el.closest('fieldset[disabled]') !== null
}

describe('the controllable-factor panel owns its authority boundary', () => {
  beforeEach(seed)

  it('is NOT wrapped by the Router — the outer blanket is gone for this panel', () => {
    const { container } = openFactor()
    expect(
      container.querySelector('[data-authority="disabled"]'),
      'the Router still wrapped the factor panel; the value control stays dead',
    ).toBeNull()
  })

  it('CONTRAST — a panel that owns no fence keeps the Router wrap, unchanged', () => {
    // ⭐ Without this, the assertion above passes on a change that deleted the
    // blanket EVERYWHERE, silently un-fencing panels that took on no duty.
    const { container } = render(
      <InspectorModal nodeId={RISK_ID} edgeId={null} onClose={vi.fn()} />,
    )
    expect(container.querySelector(NODE_INSPECTOR)).not.toBeNull()
    expect(
      container.querySelector('[data-authority="disabled"]'),
      'a non-opted-in panel lost the Router wrap — it owns no fence of its own',
    ).not.toBeNull()
  })
})

describe('the writer that saves is live, and the writer that does not is fenced', () => {
  beforeEach(seed)

  it('ENABLES the value control — it has a durable carrier', () => {
    const { container } = openFactor()
    const value = container.querySelector('input[type="number"]')
    expect(value, 'the factor value input must be rendered').not.toBeNull()
    expect(
      isInert(value),
      'the value control is inert — the one write with a carrier cannot be made',
    ).toBe(false)
  })

  it('DISABLES every writer fence the panel declares, and declares at least one', () => {
    const { container } = openFactor()
    const fences = [...container.querySelectorAll('fieldset[data-writer-fence]')]
    // ⚠ A sweep over an empty set passes vacuously — this is the guard against
    // asserting nothing at all (trap 13).
    expect(fences.length, 'no writer fences found — the sweep would be vacuous').toBeGreaterThan(0)
    for (const f of fences) {
      expect(
        f.hasAttribute('disabled'),
        `writer fence "${f.getAttribute('data-writer-fence')}" is not disabled`,
      ).toBe(true)
    }
  })

  it('fences the DESCRIPTION specifically — it writes to the local store only', () => {
    const { container } = openFactor()
    const desc = container.querySelector('fieldset[data-writer-fence="description"]')
    expect(desc, 'the description writer must sit behind its own fence').not.toBeNull()
    expect(desc!.hasAttribute('disabled')).toBe(true)
    // Bound by IDENTITY to the control inside it, not by a value predicate
    // another element could satisfy (trap 19).
    expect(within(desc as HTMLElement).getByRole('textbox')).toBeTruthy()
  })
})

describe('the controls that write nothing stay usable', () => {
  beforeEach(seed)

  it('leaves navigation to a connected element alive', () => {
    const { container } = openFactor()
    const nav = screen.queryByRole('button', { name: new RegExp('Monthly revenue') })
    expect(nav, 'the connection navigation control must be rendered').not.toBeNull()
    expect(
      isInert(nav),
      'navigation is inert — a reader cannot follow the model from the panel built to explain it',
    ).toBe(false)
    expect(container.querySelector(NODE_INSPECTOR)).not.toBeNull()
  })
})

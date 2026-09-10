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
import userEvent from '@testing-library/user-event'
import { InspectorModal } from '../../../components/InspectorModal'
import { FactorControllablePanel } from '../panels/FactorControllablePanel'
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
/**
 * Renders the panel on its own so `readOnly` can be varied. The Router hands
 * an opted-in panel `readOnly` unconditionally, so the enabled half of the
 * discriminating pair is unreachable through `InspectorModal`.
 */
function renderPanel(opts: { readOnly: boolean }) {
  return render(
    <FactorControllablePanel
      nodeId={FACTOR_ID}
      techMode
      onClose={vi.fn()}
      onNavigate={vi.fn()}
      readOnly={opts.readOnly}
    />,
  )
}

/**
 * ⭐ THE DEFECT THIS HELPER WAS WRITTEN AROUND IS NOW FIXED, SO THE HELPER USES
 * THE ASSOCIATION INSTEAD OF GUESSING AT THE DOM.
 *
 * ⚠ What stood here, and why it is being replaced rather than kept:
 *
 *     "The advanced editor's field label is a bare `<span>` with no `htmlFor`
 *      and no `aria-label`, so `getByLabelText` cannot reach its input — it is
 *      not a label in the accessibility sense at all. (That is a real defect in
 *      `AdvancedField.tsx:163`; it is rowed, not fixed here.)"
 *
 * That note was exactly right, and it is the reason the old body walked
 * `querySelectorAll('span')` and then groped upwards through `.closest('div')
 * ?.parentElement` for an input. `AdvancedField` now renders a real
 * `<label htmlFor>` bound to the control's `id`, so the workaround no longer
 * finds anything — and leaving the comment in place would turn an honest
 * confession into a false label about current code, which is the trap-14
 * failure mode this estate keeps paying for. Quoted above rather than deleted,
 * because it is *why* the helper looked the way it did.
 *
 * ⭐ THE BINDING GETS STRICTLY STRONGER, WHICH IS THE POINT OF THE SWAP. The
 * original intent — bind to the input beside the EXACTLY-matching label text so
 * a sibling field cannot satisfy it (trap 19) — is preserved and improved on
 * three counts: the link is the programmatic `htmlFor`/`id` association rather
 * than an inferred DOM ancestry; `getByLabelText` REQUIRES exactly one match
 * and throws on two, where the old `.find()` silently took the first; and the
 * `within(fence)` scope still confines the search to the fenced subtree, so a
 * same-named field outside the fence cannot answer for one inside it.
 */
function editorField(fence: HTMLElement, label: string): HTMLInputElement {
  const input = within(fence).getByLabelText(label, { exact: true })
  if (input.tagName !== 'INPUT') {
    throw new Error(`field "${label}" is a <${input.tagName.toLowerCase()}>, not an input`)
  }
  return input as HTMLInputElement
}

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

  it('fences the ADVANCED EDITOR — 14 writers that a file-scoped sweep misses', async () => {
    // ⚠ THIS IS THE CASE THE FIRST VERSION OF THIS PR DID NOT HAVE, AND ITS
    // ABSENCE IS WHY THE PR SHIPPED THE DEFECT IT EXISTS TO PREVENT. Removing
    // the Router blanket un-fenced `FactorControllableEditor`, mounted through
    // `TechnicalDisclosure` and reachable in one click. Its 14 `mutations.set*`
    // calls are spelled in ANOTHER FILE, so counting the writers named in this
    // panel found none of them. `setObservedValue` among them writes the SAME
    // field as the headline control with no `factor_value_edit` send.
    //
    // ⚠ RENDERED DIRECTLY, not through the Router, and deliberately: the Router
    // passes `readOnly` UNCONDITIONALLY to an opted-in panel
    // (`InspectorRouter.tsx:449`), so it cannot produce the contrast below.
    // `inspectorAuthorityBinding.spec.tsx` is what pins the Router half.
    const { container } = renderPanel({ readOnly: true })
    await userEvent.click(screen.getByRole('button', { name: /Show model detail/i }))

    const fence = container.querySelector('fieldset[data-writer-fence="advanced-editor"]')
    expect(fence, 'the advanced editor must sit behind its own fence').not.toBeNull()

    // Bound by IDENTITY to a control the EDITOR renders (trap 19), and asserted
    // INERT rather than merely nested — the fence is worth nothing unless the
    // browser actually refuses the write.
    const normalised = editorField(fence as HTMLElement, 'Normalised value')
    expect(
      isInert(normalised),
      'the editor control that writes the headline value WITHOUT the wire send is live',
    ).toBe(true)
  })

  it('DISCRIMINATES — the same editor control is live when the panel is NOT read-only', async () => {
    // ⭐ The pair. Without this, the case above also passes on a change that
    // disabled the editor unconditionally — a fence that can never open is not
    // a fence, it is a deletion, and it would take the expert surface with it.
    const { container } = renderPanel({ readOnly: false })
    await userEvent.click(screen.getByRole('button', { name: /Show model detail/i }))
    const fence = container.querySelector('fieldset[data-writer-fence="advanced-editor"]')
    expect(fence, 'the fence element must exist in both states').not.toBeNull()
    const normalised = editorField(fence as HTMLElement, 'Normalised value')
    expect(
      isInert(normalised),
      'the editor is inert even when nothing is read-only — the fence never opens',
    ).toBe(false)
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

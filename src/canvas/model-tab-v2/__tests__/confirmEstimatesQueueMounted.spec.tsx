/**
 * QUEUE B IS MOUNTED, AND "N TO VERIFY" IS A CONTROL FOR THE FIRST TIME
 * (18 Aug 2026, the REHOME → DELETE lane).
 *
 * ## What changed and why it could change now
 *
 * `RepairQueueList` and all four queue producers have existed, correct and
 * unmounted, since the 16 Aug mount train. They were inert for a stated reason:
 * applying needed write carriers that did not exist. #777 landed two of them —
 * `proposeFactorConfirmation` and `proposeOptionIntervention`. So the
 * confirm-estimates queue is no longer blocked, and mounting what already
 * exists closes design F2 rather than building new UI for it.
 *
 * Today the v1 tab renders a "N to verify" badge that scrolls somewhere. The
 * queue behind this chip is the first time that number can be acted on.
 *
 * ## The invariant this spec exists to protect, above all others
 *
 * ⭐ THE QUEUE REPLACES THE OUTLINE; IT NEVER SITS BESIDE IT. Design §5.3: a
 * queue is *a filtered view of the same outline* — "there is only ever one
 * rendering of a row". This whole consolidation exists because the Model tab
 * renders every element twice; a queue rendered alongside the outline would
 * reproduce that defect INSIDE the fix. So the outline's absence in queue mode
 * is asserted directly, with a contrast control in the same test.
 *
 * ## Binding
 *
 * The store is REAL — the sanctioned setter reads the node back out of
 * `useCanvasStore.getState()` — so Confirm is proven by the MODEL CHANGING, not
 * by a spy agreeing with itself. Two unverified factors are seeded and only one
 * is confirmed, so every assertion binds to its node BY ID and a handler wired
 * to the wrong row fails (trap 19).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent, screen } from '@testing-library/react'
import type { Node } from '@xyflow/react'

const sendSystemEvent = vi.fn()

// Trap 12: spread the real module rather than hand-listing its exports.
vi.mock('../../conversation/ConversationContext', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, useOptionalConversationContext: () => ({ sendSystemEvent }) }
})

vi.mock('../../utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusEdgeById: vi.fn(),
}))

import { ModelTabV2Panel } from '../ModelTabV2Panel'
import { useCanvasStore } from '../../store'

const UNVERIFIED_A = 'fac_sales_cycle_length'
const UNVERIFIED_B = 'fac_win_rate'
const VERIFIED = 'fac_headcount'

function factor(id: string, label: string, source: string | undefined): Node {
  return {
    id,
    type: 'factor',
    position: { x: 0, y: 0 },
    data: {
      label,
      kind: 'factor',
      observedState: { value: 0.45, raw_value: 45, cap: 100, ...(source ? { source } : {}) },
    },
  } as unknown as Node
}

/** Two unverified factors and one already-confirmed — the discriminating set. */
function allNodes(): Node[] {
  return [
    factor(UNVERIFIED_A, 'Sales cycle length', 'cee_inference'),
    factor(UNVERIFIED_B, 'Win rate', 'cee_inference'),
    factor(VERIFIED, 'Headcount', 'user_confirmed'),
  ]
}

function storedSource(id: string): unknown {
  const n = useCanvasStore.getState().nodes.find(x => x.id === id)
  return (
    ((n?.data as Record<string, unknown> | undefined)?.observedState as
      | Record<string, unknown>
      | undefined)?.source
  )
}

function renderPanel(nodes: Node[] = allNodes()) {
  useCanvasStore.setState({ nodes, edges: [] } as never, false)
  render(<ModelTabV2Panel nodes={nodes} edges={[]} goalThreshold={null} />)
}

const CHIP = 'model-tab-v2-chip-confirm-estimates'
const QUEUE = 'repair-queue-v2-confirm-estimates'

beforeEach(() => {
  vi.clearAllMocks()
})
afterEach(() => cleanup())

// ── The chip ─────────────────────────────────────────────────────────────────

describe('the "N to verify" chip is derived from the queue it opens', () => {
  it('states the count of unverified factors — two, not three', () => {
    renderPanel()
    // Bound to the derivation: three factors are seeded, one is already
    // confirmed, so a chip reading "3" would mean the chip and the queue
    // disagree — the exact defect the v1 badge ships.
    expect(screen.getByTestId(CHIP)).toHaveTextContent('2 to verify')
  })

  it('CONTRAST CONTROL: with nothing to verify there is no chip at all', () => {
    // Without this, "renders a chip" would pass on a chip that always renders.
    renderPanel([factor(VERIFIED, 'Headcount', 'user_confirmed')])
    expect(screen.queryByTestId(CHIP)).not.toBeInTheDocument()
    // …and the outline is still there, so the absence above is about the chip
    // and not about the panel failing to render.
    expect(screen.getByTestId(`model-row-v2-${VERIFIED}`)).toBeInTheDocument()
  })

  it('singularises honestly', () => {
    renderPanel([
      factor(UNVERIFIED_A, 'Sales cycle length', 'cee_inference'),
      factor(VERIFIED, 'Headcount', 'user_confirmed'),
    ])
    expect(screen.getByTestId(CHIP)).toHaveTextContent('1 to verify')
  })
})

// ── The mode ─────────────────────────────────────────────────────────────────

describe('⭐ the queue REPLACES the outline — never a second rendering of a row', () => {
  it('opening the queue removes the outline rows', () => {
    renderPanel()
    // Contrast control, first: the rows ARE on screen before the click, so the
    // absence asserted below is a change and not a permanently empty outline.
    expect(screen.getByTestId(`model-row-v2-${UNVERIFIED_A}`)).toBeInTheDocument()

    fireEvent.click(screen.getByTestId(CHIP))

    // The queue is up…
    expect(screen.getByTestId(QUEUE)).toBeInTheDocument()
    expect(screen.getByTestId(`${QUEUE}-item-${UNVERIFIED_A}`)).toBeInTheDocument()
    // …and the element is rendered ONCE. This is the consolidation's whole
    // point: the same factor must not appear in an outline row AND a queue row.
    expect(screen.queryByTestId(`model-row-v2-${UNVERIFIED_A}`)).not.toBeInTheDocument()
    expect(screen.queryByTestId(`model-row-v2-${VERIFIED}`)).not.toBeInTheDocument()
  })

  it('the queue holds exactly the unverified factors — the confirmed one is absent', () => {
    renderPanel()
    fireEvent.click(screen.getByTestId(CHIP))
    expect(screen.getByTestId(`${QUEUE}-item-${UNVERIFIED_A}`)).toBeInTheDocument()
    expect(screen.getByTestId(`${QUEUE}-item-${UNVERIFIED_B}`)).toBeInTheDocument()
    expect(screen.queryByTestId(`${QUEUE}-item-${VERIFIED}`)).not.toBeInTheDocument()
  })

  it('Back returns to the outline, and the queue goes', () => {
    renderPanel()
    fireEvent.click(screen.getByTestId(CHIP))
    fireEvent.click(screen.getByTestId('model-tab-v2-queue-back'))
    expect(screen.getByTestId(`model-row-v2-${UNVERIFIED_A}`)).toBeInTheDocument()
    expect(screen.queryByTestId(QUEUE)).not.toBeInTheDocument()
  })
})

// ── The write ────────────────────────────────────────────────────────────────

describe('Confirm in the queue commits through the ONE authority', () => {
  it('stamps user_confirmed on the row confirmed — and specifically NOT user', () => {
    renderPanel()
    expect(storedSource(UNVERIFIED_B)).toBe('cee_inference')

    fireEvent.click(screen.getByTestId(CHIP))
    fireEvent.click(screen.getByTestId(`${QUEUE}-item-${UNVERIFIED_B}-apply`))

    expect(storedSource(UNVERIFIED_B)).toBe('user_confirmed')
    // The forbidden literal, stated explicitly: `'user'` classifies as the
    // `edited` kind, so the pill would read "User edited" for a gesture in
    // which the user changed no number (F8).
    expect(storedSource(UNVERIFIED_B)).not.toBe('user')
  })

  it('⭐ confirms ONLY the row clicked — the other unverified factor is untouched', () => {
    // The discriminating half. A handler wired to the wrong row, or to "all
    // shown", passes every assertion above and fails this one.
    renderPanel()
    fireEvent.click(screen.getByTestId(CHIP))
    fireEvent.click(screen.getByTestId(`${QUEUE}-item-${UNVERIFIED_B}-apply`))

    expect(storedSource(UNVERIFIED_B)).toBe('user_confirmed')
    expect(storedSource(UNVERIFIED_A)).toBe('cee_inference')
  })

  it('the confirm button is ENABLED here, because its carrier exists', () => {
    renderPanel()
    fireEvent.click(screen.getByTestId(CHIP))
    const apply = screen.getByTestId(`${QUEUE}-item-${UNVERIFIED_A}-apply`)
    expect(apply).toBeEnabled()
    // …and it says Confirm, not Apply: this queue ratifies a number that is
    // already in the model, and "Apply" would imply a change that never happens.
    expect(apply).toHaveTextContent('Confirm')
  })

  it('⭐ the controls whose carriers do NOT exist are still disabled, and still say why', () => {
    // The honesty half of the mount. `proposeDeferral` and `proposeBatch` do
    // not exist, so enabling Defer or Apply-all would report a decision the
    // product cannot persist. Mounting the queue must not quietly turn the
    // whole component live.
    renderPanel()
    fireEvent.click(screen.getByTestId(CHIP))
    expect(screen.getByTestId(`${QUEUE}-item-${UNVERIFIED_A}-defer`)).toBeDisabled()
    expect(screen.getByTestId(`${QUEUE}-apply-all`)).toBeDisabled()
  })

  it('a confirmed row leaves the queue once the host re-renders — chip and list stay in step', () => {
    /*
     * ⚠ THE RE-RENDER IS SUPPLIED DELIBERATELY, AND SAYING SO IS THE POINT.
     * This panel takes the model AS PROPS and holds no store subscription of
     * its own — that is a stated design property (a second subscription would
     * be a second render authority). So the queue refreshes when `ModelTabBody`
     * re-renders it from the store, exactly as every other row on the tab does.
     *
     * The first version of this test asserted the count fell WITHOUT a
     * re-render and failed. That failure was the test being wrong about the
     * architecture, not the product being wrong — and it is recorded here
     * rather than quietly deleted, because "the count did not update" is
     * exactly the shape of a real defect and a future reader must be able to
     * tell the two apart.
     */
    renderPanel()
    fireEvent.click(screen.getByTestId(CHIP))
    fireEvent.click(screen.getByTestId(`${QUEUE}-item-${UNVERIFIED_B}-apply`))

    // The host's re-render: the store is the source, as in the live app.
    const fresh = useCanvasStore.getState().nodes as Node[]
    cleanup()
    render(<ModelTabV2Panel nodes={fresh} edges={[]} goalThreshold={null} />)

    // Derived from the same predicate as the queue, so they cannot disagree.
    expect(screen.getByTestId(CHIP)).toHaveTextContent('1 to verify')
    // Bound by identity: it is specifically the confirmed row that left.
    fireEvent.click(screen.getByTestId(CHIP))
    expect(screen.queryByTestId(`${QUEUE}-item-${UNVERIFIED_B}`)).not.toBeInTheDocument()
    expect(screen.getByTestId(`${QUEUE}-item-${UNVERIFIED_A}`)).toBeInTheDocument()
  })
})

// ── F8: finishing the job must not look like a dead end ─────────────────────

describe('⭐ resolving the LAST item returns you to the outline (F8)', () => {
  it('does not strand the user in an empty queue', () => {
    // The chip renders only on a non-zero count, so an empty queue cannot be
    // ENTERED — only arrived at. Left as it was, the outline stayed replaced by
    // "Nothing needs attention here." and the chip that would bring it back is
    // suppressed while a queue is open.
    const only = [
      factor(UNVERIFIED_A, 'Sales cycle length', 'cee_inference'),
      factor(VERIFIED, 'Headcount', 'user_confirmed'),
    ]
    renderPanel(only)
    fireEvent.click(screen.getByTestId(CHIP))
    fireEvent.click(screen.getByTestId(`${QUEUE}-item-${UNVERIFIED_A}-apply`))

    // The host's re-render — this panel holds no store subscription by design.
    const fresh = useCanvasStore.getState().nodes as Node[]
    cleanup()
    render(<ModelTabV2Panel nodes={fresh} edges={[]} goalThreshold={null} />)

    // The outline is back…
    expect(screen.getByTestId(`model-row-v2-${UNVERIFIED_A}`)).toBeInTheDocument()
    // …the queue is gone, and so is the empty-state text that would have been
    // the only thing on screen.
    expect(screen.queryByTestId(QUEUE)).not.toBeInTheDocument()
    expect(screen.queryByTestId(`${QUEUE}-empty`)).not.toBeInTheDocument()
    // …and there is nothing left to verify, so no chip either.
    expect(screen.queryByTestId(CHIP)).not.toBeInTheDocument()
  })
})

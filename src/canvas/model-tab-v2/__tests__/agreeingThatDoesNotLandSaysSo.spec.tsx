/**
 * ⭐⭐ WHEN AGREEING WITH AN ESTIMATE DOES NOT LAND, THE ROW SAYS SO.
 *
 * ⛔ THE DEFECT. `proposeEdgeStrengthConfirmation`'s send was `.catch(() => {})`
 * and its synchronous refusals were discarded at the call site. So a person
 * pressed "adopt Olumi's estimate as your own judgement", CEE answered no, and
 * **the surface that made the statement never heard** — on the one act whose
 * entire point is that the SERVER records it.
 *
 * ⛔⛔ AND THE HALF THAT MUST NEVER BE ADDED: there is no success line, and the
 * `'sent'` case below is the assertion that keeps it that way. `'sent'` means a
 * POST left, not that the agreement is on file — CEE owns edge provenance and
 * the canvas learns it from the response. A row that said "recorded" on `'sent'`
 * would be the optimistic write this surface exists to remove, wearing a
 * receipt's clothes, on a confirmation. That is why this file asserts SILENCE
 * for the successful send: the dangerous direction here is the flattering one.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

const sendSystemEvent = vi.fn()
/**
 * ⚠ MUTABLE ON PURPOSE. `no_carrier` is the one synchronous refusal that is
 * reachable WITH the chip on screen — the chip's gate asks whether the edge is
 * assertable and says nothing about whether a conversation exists — so the
 * absence of a carrier has to be expressible per test.
 */
let carrier: { sendSystemEvent?: unknown } = { sendSystemEvent }
vi.mock('../../conversation/ConversationContext', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, useOptionalConversationContext: () => carrier }
})

import { ModelRowView } from '../ModelRowView'
import { ModelTabV2Panel } from '../ModelTabV2Panel'
import { useCanvasStore } from '../../store'
import { SystemEventSendError } from '../../conversation/useConversation'
import type { ModelRow } from '../types'

// ── the row arm ───────────────────────────────────────────────────────────

const row = (over: Partial<ModelRow> & Pick<ModelRow, 'id'>): ModelRow => ({
  kind: 'relationship', group: 'relationships', label: 'Demand → Revenue',
  primaryValue: '0.45', attention: [], editable: true, ...over,
})

describe('the row arm', () => {
  it('states the reason, as an alert, because it answers an act the user just made', () => {
    render(
      <ModelRowView
        row={row({ id: 'e-1' })}
        tier="plain"
        commit={{ phase: 'confirm_unsettled', reason: 'Not sent — try again in a moment.' }}
      />,
    )
    const el = screen.getByTestId('model-row-v2-e-1-value-confirm-unsettled')
    expect(el).toHaveTextContent('Not sent — try again in a moment.')
    expect(el).toHaveAttribute('role', 'alert')
  })

  it('⛔ shows NO value and NO arrow — a confirmation proposes no change', () => {
    render(
      <ModelRowView
        row={row({ id: 'e-1' })}
        tier="plain"
        commit={{ phase: 'confirm_unsettled', reason: 'Not recorded.' }}
      />,
    )
    // ⚠ POSITIVE ANCHOR FIRST. `queryByTestId(...).toBeNull()` passes just as
    // happily against a row that never rendered at all, so the absence claim is
    // only worth anything once presence is pinned. Swept after M5 survived.
    const cell = screen.getByTestId('model-row-v2-e-1-value')
    expect(cell).toHaveTextContent('Not recorded.')
    // `from → to` would invent a change the user never made: the act's whole
    // content is "the number you already have is right".
    expect(screen.queryByTestId('model-row-v2-e-1-value-from')).toBeNull()
    expect(cell.textContent).not.toContain('→')
  })

  /**
   * ⭐ THE SHRINK CONTRACT, MEASURED RATHER THAN CLAIMED — and this is the
   * assertion `darkCommitPhasesStayDark` demands of any newly-wired arm.
   *
   * The value cell sits in an `auto` grid track and the identity track is the
   * only flexible one, so 100% of any width this cell takes comes OUT OF THE
   * LABEL. A sentence in an unbounded arm eats the node name beside it. The
   * `proposed` arm already solved this with `flex-wrap`: the cell grows in
   * HEIGHT instead. This arm takes that shape.
   */
  it('⭐ takes the bounded flex-wrap shape, so a sentence costs height and not the label', () => {
    render(
      <ModelRowView
        row={row({ id: 'e-1' })}
        tier="plain"
        commit={{ phase: 'confirm_unsettled', reason: 'A sentence long enough to matter at any dock width.' }}
      />,
    )
    const cell = screen.getByTestId('model-row-v2-e-1-value')
    expect(cell.className).toMatch(/\bflex-wrap\b/)
    expect(cell.className).toMatch(/\bmin-w-0\b/)
  })

  it('⭐ DISCRIMINATING PAIR: `refused` does NOT carry it, so the claim is about THIS arm', () => {
    // Without this, `flex-wrap` could have been added to every arm and the
    // assertion above would pass while saying nothing about which one was fixed.
    render(
      <ModelRowView
        row={row({ id: 'e-2' })}
        tier="plain"
        commit={{ phase: 'refused', from: '0.4', attempted: '0.9', reason: 'no' }}
      />,
    )
    // ⚠ AND ITS OWN POSITIVE ANCHOR: `not.toMatch` passes against an element
    // with no className whatsoever, which is exactly what a broken render gives.
    const refusedCell = screen.getByTestId('model-row-v2-e-2-value')
    // `typography.panelTabular` resolves to Tailwind utilities, so the anchor is
    // that the arm rendered its OWN content — not a guess at its class string.
    expect(refusedCell.className.trim().length).toBeGreaterThan(0)
    expect(screen.getByTestId('model-row-v2-e-2-value-refusal')).toHaveTextContent('no')
    expect(refusedCell.className).not.toMatch(/\bflex-wrap\b/)
  })
})

// ── the host ──────────────────────────────────────────────────────────────

const EDGE = 'e-fac_demand-out_rev'
const NODES = [
  { id: 'fac_demand', type: 'factor', position: { x: 0, y: 0 },
    data: { label: 'Demand', kind: 'factor' } },
  { id: 'out_rev', type: 'outcome', position: { x: 0, y: 0 },
    data: { label: 'Revenue', kind: 'outcome' } },
]
/**
 * ⚠ `provenanceDisplay: 'ai_inferred'` PLUS a server-stated tuple, and both are
 * load-bearing — `adapters.ts:777-781` requires the estimate to be Olumi's AND
 * `edgeStrengthEditIsAssertable`, because with no `expected` to ratify the chip
 * would be an advertisement. A fixture missing either renders no chip, and the
 * host assertions below would pass by never exercising anything.
 */
const EDGES = [
  { id: EDGE, source: 'fac_demand', target: 'out_rev',
    data: {
      provenanceDisplay: 'ai_inferred',
      serverStrength: { mean: 0.4, effect_direction: 'positive' },
      strength_mean: 0.4,
      effect_direction: 'positive',
    } },
]

function renderPanel() {
  useCanvasStore.setState(
    { nodes: NODES, edges: EDGES, lastServerGraphHash: 'abc123' } as never,
    false,
  )
  render(<ModelTabV2Panel nodes={NODES as never} edges={EDGES as never} goalThreshold={null} />)
  // ID-addressed, never label-derived: the group opens by its own toggle.
  fireEvent.click(screen.getByTestId('model-group-v2-relationships-toggle'))
}

/** Press the relationship row's "adopt Olumi's estimate" chip. */
function agree() {
  // ⭐ THE PRECONDITION, PINNED IN-TEST. If the fixture ever stops producing the
  // `unconfirmed-estimate` attention, this throws by name instead of letting a
  // "no notice rendered" assertion pass against a row that was never pressed.
  const chip = screen.getByTestId(`model-row-v2-${EDGE}-confirm-as-is`)
  fireEvent.click(chip)
}

beforeEach(() => { vi.clearAllMocks(); carrier = { sendSystemEvent } })
afterEach(() => cleanup())

describe('the host reports what happened to the statement', () => {
  it('⛔ a server refusal that certifies no write reaches the row', async () => {
    sendSystemEvent.mockRejectedValue(
      new SystemEventSendError('server', { conflictCategory: 'BASE_HASH_DIVERGED' }),
    )
    renderPanel()
    agree()
    const el = await screen.findByTestId(`model-row-v2-${EDGE}-value-confirm-unsettled`)
    expect(el.textContent).toMatch(/not recorded/i)
  })

  it('⭐ a STOPPED turn (CEE #1868 `turn_fence_stopped`) says the fence\'s own sentence, never "moved on"', async () => {
    sendSystemEvent.mockRejectedValue(
      new SystemEventSendError('server', { conflictCategory: 'turn_fence_stopped' }),
    )
    renderPanel()
    agree()
    const el = await screen.findByTestId(`model-row-v2-${EDGE}-value-confirm-unsettled`)
    expect(el.textContent).toBe("That change wasn't saved because this turn was stopped. Nothing in your decision changed. Send the change again if you still want it.")
    expect(el.textContent).not.toMatch(/moved on/i)
  })

  it('CONTRAST — `BASE_HASH_DIVERGED` keeps the moved-on line, exactly', async () => {
    sendSystemEvent.mockRejectedValue(
      new SystemEventSendError('server', { conflictCategory: 'BASE_HASH_DIVERGED' }),
    )
    renderPanel()
    agree()
    const el = await screen.findByTestId(`model-row-v2-${EDGE}-value-confirm-unsettled`)
    expect(el.textContent).toBe(
      'Not recorded — the model moved on while this was in flight. Ask Olumi about this link, then agree again.',
    )
  })

  it('⛔ a failure that proves nothing says so, and does NOT claim "not sent"', async () => {
    // The more dangerous half: answering "not sent" to a failure that MAY have
    // written invites the user to re-send something the model already holds.
    sendSystemEvent.mockRejectedValue(new SystemEventSendError('transport'))
    renderPanel()
    agree()
    const el = await screen.findByTestId(`model-row-v2-${EDGE}-value-confirm-unsettled`)
    expect(el.textContent).toMatch(/may not have recorded/i)
    expect(el.textContent).not.toMatch(/^Not sent/)
  })

  it('⭐⭐ a SUCCESSFUL send says NOTHING — no row may claim the agreement is on file', async () => {
    sendSystemEvent.mockResolvedValue(undefined)
    renderPanel()
    agree()
    await waitFor(() => expect(sendSystemEvent).toHaveBeenCalled())
    // ⚠ The row must still BE there for its silence to mean anything.
    expect(screen.getByTestId(`model-row-v2-${EDGE}`)).toBeInTheDocument()
    expect(screen.queryByTestId(`model-row-v2-${EDGE}-value-confirm-unsettled`)).toBeNull()
  })

  /**
   * ⛔⛔ THIS TEST REPLACES ONE THAT COULD NOT FAIL, AND THE REPLACEMENT IS THE
   * POINT. Its first version wrapped the assertions in `if (chip) { … } else { … }`
   * and took the `else`, so it asserted nothing about the refusal channel — a
   * mutant that deleted that channel entirely SURVIVED it (applied=1, failed=0).
   * Vacuity found by the mutant, not by reading it.
   *
   * `no_carrier` is the reachable case: the chip's gate asks whether the EDGE is
   * assertable and says nothing about whether a conversation exists, so a person
   * on a decision with no open conversation is offered the act and — until now —
   * got silence when it went nowhere.
   */
  it('⛔ a refusal that happens BEFORE any send is reported too, not just the wire ones', async () => {
    carrier = {} // no `sendSystemEvent` — the carrier the act needs is absent
    renderPanel()
    agree()
    const el = await screen.findByTestId(`model-row-v2-${EDGE}-value-confirm-unsettled`)
    expect(el.textContent).toMatch(/no open conversation/i)
    // Nothing was sent, so no settlement will ever arrive: a surface waiting on
    // one would wait forever. This is the state that has no other way to end.
    expect(sendSystemEvent).not.toHaveBeenCalled()
  })
})

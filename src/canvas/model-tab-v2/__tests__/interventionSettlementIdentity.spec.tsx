/**
 * ⭐⭐ WHICH EDIT A LATE ANSWER IS ABOUT, AND WHAT A FAILED SEND MAY CLAIM.
 *
 * Two defects an independent review returned against `2686b817`, both about the
 * same thing from opposite ends: a settlement is a statement about ONE attempt,
 * and it must say what actually happened to that attempt.
 *
 *  1. THE FENCE WAS FACTOR-AND-VALUE ONLY, and the hole is reachable. A on
 *     option A, factor X, 0.6 is pending; the user moves to option B and saves
 *     the same factor and the same number; B is blocked; A's late rejection then
 *     relabels B — "Sent, but I could not confirm" about a send that never
 *     happened. Same factor, same value, different edit.
 *
 *  2. EVERY TRANSPORT REJECTION WAS REPORTED AS `blocked`, whose copy names the
 *     busy lock. `isUnverifiedDelivery` (ROADMAP 2.665) splits transport into two
 *     OPPOSITE claims: a fetch that threw (nothing left the client) and a proxy
 *     or edge timeout on a request that REACHED CEE, which goes on to commit it,
 *     live-witnessed at 123.1s. Collapsing them told the second half "not sent".
 *
 * This file is separate from `interventionRowTellsTheTruth` because it needs TWO
 * option rows, and changing that file's fixture would move the ground under
 * twenty passing assertions whose subject is something else.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { Node } from '@xyflow/react'

const sendSystemEvent = vi.fn().mockResolvedValue(undefined)
vi.mock('../../conversation/ConversationContext', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useOptionalConversationContext: () => ({ sendSystemEvent }),
}))
vi.mock('../../utils/focusHelpers', () => ({ focusNodeById: vi.fn(), focusEdgeById: vi.fn() }))

const authority = vi.hoisted(() => ({ value: 'server_graph' as string }))
vi.mock('../../mutations/mutationAuthority', async importOriginal => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    get CANONICAL_EDIT_AUTHORITY() {
      return {
        ...(actual.CANONICAL_EDIT_AUTHORITY as Record<string, string>),
        modelOptionIntervention: authority.value,
      }
    },
  }
})

import { useCanvasStore } from '../../store'
import { SystemEventSendError } from '../../conversation/useConversation'
import { ModelTabV2Panel } from '../ModelTabV2Panel'
import { openOutlineGroups } from './openOutlineGroups'

const OPTION_A = 'opt_leeds'
const OPTION_B = 'opt_bristol'
const FACTOR = 'fac_capex'
const HASH = '9f2c1b0ae4d37c5a'

function nodes(): Node[] {
  return [
    {
      id: FACTOR, type: 'factor', position: { x: 0, y: 0 },
      data: { label: 'Capital expenditure', kind: 'factor' },
    },
    {
      id: OPTION_A, type: 'option', position: { x: 0, y: 0 },
      data: { label: 'Open Leeds', kind: 'option', interventions: { [FACTOR]: 0.2 } },
    },
    {
      id: OPTION_B, type: 'option', position: { x: 0, y: 0 },
      data: { label: 'Open Bristol', kind: 'option', interventions: { [FACTOR]: 0.2 } },
    },
  ] as unknown as Node[]
}

function renderPanel() {
  const n = nodes()
  useCanvasStore.setState(
    { nodes: n, edges: [], lastServerGraphHash: HASH, currentScenarioId: 'scn_1' } as never,
    false,
  )
  render(
    <ModelTabV2Panel
      nodes={n}
      edges={[]}
      goalThreshold={null}
      currentScenarioId="scn_1"
      lastServerGraphHash={HASH}
    />,
  )
  openOutlineGroups()
}

/** Stand on an option row. */
function select(optionId: string) {
  fireEvent.click(screen.getByTestId(`model-row-v2-${optionId}`))
}

/** Open the row's editor, type a value and press Save — the real gesture. */
function commit(value: string) {
  fireEvent.click(screen.getByTestId(`model-detail-v2-intervention-${FACTOR}-value`))
  fireEvent.change(screen.getByTestId(`model-detail-v2-intervention-${FACTOR}-input`), {
    target: { value },
  })
  fireEvent.click(screen.getByTestId(`model-detail-v2-intervention-${FACTOR}-save`))
}

function noticeText(): string {
  return screen.queryByTestId(`model-detail-v2-intervention-${FACTOR}-notice`)?.textContent ?? ''
}

beforeEach(() => {
  vi.clearAllMocks()
  sendSystemEvent.mockResolvedValue(undefined)
  authority.value = 'server_graph'
  cleanup()
})

describe("a late answer belongs to ONE attempt", () => {
  it("⚠ A's rejection does NOT relabel B — same factor, same number, different edit", async () => {
    // A goes out and its promise is held open, so the rejection lands AFTER the
    // user has moved on. This is the review's exact sequence.
    let rejectA: ((e: unknown) => void) | undefined
    sendSystemEvent.mockImplementationOnce(
      () => new Promise((_res, rej) => { rejectA = rej }),
    )

    renderPanel()
    select(OPTION_A)
    commit('0.6')
    await screen.findByTestId(`model-detail-v2-intervention-${FACTOR}-pending`)

    // B: the same factor and the same number, on a different option. Blocked,
    // so the row is back in `editing` with the busy-lock notice.
    sendSystemEvent.mockResolvedValueOnce('send_blocked')
    select(OPTION_B)
    commit('0.6')
    await waitFor(() => expect(noticeText()).toMatch(/still in flight/i))

    // Now A answers. It must be dropped: B was never sent, so nothing may claim
    // anything about what a server did with it.
    // Flush the rejection's `.catch` and the state update it would attempt.
    // ⚠ INSIDE `act`, and awaited twice: the settlement rides a promise chain,
    // so a bare microtask tick can assert BEFORE the drop would have happened —
    // which would make this pass against the defect it exists to catch.
    await act(async () => {
      rejectA?.(new SystemEventSendError('server', { code: 'INGRESS_CONTRACT_VIOLATION' }))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(noticeText()).toMatch(/still in flight/i)
    expect(noticeText()).not.toMatch(/could not confirm/i)
    expect(
      screen.queryByTestId(`model-detail-v2-intervention-${FACTOR}-pending`),
    ).not.toBeInTheDocument()
  })

  it('POSITIVE CONTROL: with no second edit, that same rejection DOES settle A', async () => {
    // Without this, the assertion above would pass on a surface that ignores
    // every late answer — which is the stuck label, not the fix.
    let rejectA: ((e: unknown) => void) | undefined
    sendSystemEvent.mockImplementationOnce(
      () => new Promise((_res, rej) => { rejectA = rej }),
    )

    renderPanel()
    select(OPTION_A)
    commit('0.6')
    await screen.findByTestId(`model-detail-v2-intervention-${FACTOR}-pending`)

    await act(async () => {
      rejectA?.(new SystemEventSendError('server', { code: 'INGRESS_CONTRACT_VIOLATION' }))
      await Promise.resolve()
      await Promise.resolve()
    })
    await waitFor(() => expect(noticeText()).toMatch(/could not confirm/i))
  })
})

describe('what a FAILED send may claim — the three are not one sentence', () => {
  it('⚠ an UNVERIFIED transport failure says COULD NOT CONFIRM, never "not sent"', async () => {
    // `meta.network === false`: a non-2xx arrived carrying no CEE signal — the
    // request reached CEE, which goes on to commit that turn.
    sendSystemEvent.mockRejectedValueOnce(
      new SystemEventSendError('transport', { deliveryUnverified: true }),
    )
    renderPanel()
    select(OPTION_A)
    commit('0.6')

    await waitFor(() => expect(noticeText()).toMatch(/could not confirm/i))
    expect(noticeText()).not.toMatch(/not sent/i)
    expect(noticeText()).not.toMatch(/still in flight/i)
  })

  it('a VERIFIED non-delivery says it could not reach the server — and not the busy-lock story', async () => {
    // `meta.network === true`: the fetch threw, so nothing left this machine.
    sendSystemEvent.mockRejectedValueOnce(
      new SystemEventSendError('transport', { deliveryUnverified: false }),
    )
    renderPanel()
    select(OPTION_A)
    commit('0.6')

    await waitFor(() => expect(noticeText()).toMatch(/could not reach the server/i))
    expect(noticeText()).not.toMatch(/still in flight/i)
    expect(noticeText()).not.toMatch(/could not confirm/i)
  })

  it('⭐ CONTRAST: a genuine SEND_BLOCKED keeps the busy-lock sentence', async () => {
    // The distinction the previous collapse destroyed: this is the only cause
    // that sentence names.
    sendSystemEvent.mockResolvedValueOnce('send_blocked')
    renderPanel()
    select(OPTION_A)
    commit('0.6')

    await waitFor(() => expect(noticeText()).toMatch(/still in flight/i))
    expect(noticeText()).not.toMatch(/could not reach/i)
  })

  it('an UNRECOGNISED rejection shape takes the cannot-confirm line, never "not sent"', async () => {
    // It cannot prove non-delivery, so it must not claim it.
    sendSystemEvent.mockRejectedValueOnce(new Error('something else entirely'))
    renderPanel()
    select(OPTION_A)
    commit('0.6')

    await waitFor(() => expect(noticeText()).toMatch(/could not confirm/i))
    expect(noticeText()).not.toMatch(/not sent/i)
  })
})

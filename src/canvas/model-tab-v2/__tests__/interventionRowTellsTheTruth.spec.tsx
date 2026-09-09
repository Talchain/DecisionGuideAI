/**
 * ⭐⭐ THE INTERVENTION ROW SAYS WHICH OF THREE THINGS HAPPENED — DRIVEN THROUGH
 * THE REAL PANEL.
 *
 * ⚠⚠ THE FIRST VERSION OF THIS FILE INJECTED `interventionEdit` STRAIGHT INTO
 * `ModelDetailRegion` AND WAS GREEN WHILE THE FEATURE WAS BROKEN. The panel
 * projected exactly `{factorId, draft}` on the way to the child, dropping the
 * `phase` and `notice` it had just computed — so pending and refusal could never
 * reach the only component that renders them. A child-only test asserts the
 * child's rendering and says NOTHING about what the parent sends: two green
 * halves with a dead seam between them, which an independent review caught and
 * the test did not.
 *
 * So every case below drives the REAL panel: type into the row, press Save, and
 * assert what the user is left looking at.
 *
 * ⚠ THE AFFORDANCE IS PRODUCTION-DISABLED, and that is asserted here too rather
 * than worked around. `CANONICAL_EDIT_AUTHORITY.modelOptionIntervention` is
 * `'disabled'`, so the panel passes no intervention handlers at all. The
 * connected posture is supplied by mocking that ONE declaration — the same
 * question the production table answers, answered differently for the test —
 * and the final case asserts the production posture still renders no control.
 * Without that contrast every assertion here would be about a surface users
 * cannot reach.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { Node } from '@xyflow/react'

const sendSystemEvent = vi.fn().mockResolvedValue(undefined)
vi.mock('../../conversation/ConversationContext', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useOptionalConversationContext: () => ({ sendSystemEvent }),
}))
vi.mock('../../utils/focusHelpers', () => ({ focusNodeById: vi.fn(), focusEdgeById: vi.fn() }))

// The one declaration that decides whether this surface offers the control.
// `'server_graph'` here is the POST-FLIP posture; the last test restores the
// production value and asserts the control is absent.
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

const OPTION = 'opt_leeds'
const FACTOR = 'fac_capex'
const HASH = '9f2c1b0ae4d37c5a'

function nodes(): Node[] {
  return [
    {
      id: FACTOR, type: 'factor', position: { x: 0, y: 0 },
      data: { label: 'Capital expenditure', kind: 'factor' },
    },
    {
      id: OPTION, type: 'option', position: { x: 0, y: 0 },
      data: { label: 'Open Leeds', kind: 'option', interventions: { [FACTOR]: 0.2 } },
    },
  ] as unknown as Node[]
}

function renderPanel(lastServerGraphHash: string | null = HASH) {
  const n = nodes()
  useCanvasStore.setState({ nodes: n, edges: [], lastServerGraphHash, currentScenarioId: 'scn_1' } as never, false)
  render(<ModelTabV2Panel nodes={n} edges={[]} goalThreshold={null} />)
  openOutlineGroups()
  fireEvent.click(screen.getByTestId(`model-row-v2-${OPTION}`))
}

/** Open the row's editor, type a value and press Save — the real gesture. */
function commit(value: string) {
  fireEvent.click(screen.getByTestId(`model-detail-v2-intervention-${FACTOR}-value`))
  fireEvent.change(screen.getByTestId(`model-detail-v2-intervention-${FACTOR}-input`), {
    target: { value },
  })
  fireEvent.click(screen.getByTestId(`model-detail-v2-intervention-${FACTOR}-save`))
}

beforeEach(() => {
  vi.clearAllMocks()
  // `undefined` is the sender's "the turn was actually issued" answer.
  sendSystemEvent.mockResolvedValue(undefined)
  authority.value = 'server_graph'
})
afterEach(() => cleanup())

describe('the three honest states, through the panel', () => {
  it('PENDING — dispatched, and the row says "sent, not saved yet"', () => {
    renderPanel()
    commit('0.6')

    expect(sendSystemEvent).toHaveBeenCalledTimes(1)
    expect(sendSystemEvent.mock.calls[0]?.[0]?.type).toBe('option_intervention_edit')

    const pending = screen.getByTestId(`model-detail-v2-intervention-${FACTOR}-pending`)
    expect(pending).toHaveTextContent('0.6')
    expect(pending.textContent ?? '').toMatch(/sent, not saved yet/i)
    // Not closed, and not back to a display that reads as saved.
    expect(screen.queryByTestId(`model-detail-v2-intervention-${FACTOR}-save`)).not.toBeInTheDocument()
    // The store is untouched: the applied response owns that write.
    const option = useCanvasStore.getState().nodes.find(n => n.id === OPTION)
    expect((option?.data as { interventions: Record<string, unknown> }).interventions[FACTOR]).toBe(0.2)
  })

  it('RECOVERABLE — no server base hash: nothing sent, and the row names the action that clears it', () => {
    renderPanel(null)
    commit('0.6')

    expect(sendSystemEvent).not.toHaveBeenCalled()
    const notice = screen.getByTestId(`model-detail-v2-intervention-${FACTOR}-notice`)
    // ⚠ It must name a TURN. "try again" re-sends the same stale base forever
    // and "reload" builds a fresh store with no server hash at all.
    expect(notice.textContent ?? '').toMatch(/ask me anything/i)
    // Still editable — the user can act without reopening the row.
    expect(screen.getByTestId(`model-detail-v2-intervention-${FACTOR}-input`)).toBeInTheDocument()
  })

  it('REFUSED — out of the model scale: nothing sent, and the row says the scale', () => {
    renderPanel()
    commit('120000')

    expect(sendSystemEvent).not.toHaveBeenCalled()
    const notice = screen.getByTestId(`model-detail-v2-intervention-${FACTOR}-notice`)
    expect(notice.textContent ?? '').toMatch(/between 0 and 1/i)
  })

  it('typing clears a stale notice — it is about a number no longer on screen', () => {
    renderPanel()
    commit('120000')
    expect(screen.getByTestId(`model-detail-v2-intervention-${FACTOR}-notice`)).toBeInTheDocument()

    fireEvent.change(screen.getByTestId(`model-detail-v2-intervention-${FACTOR}-input`), {
      target: { value: '0.6' },
    })
    expect(
      screen.queryByTestId(`model-detail-v2-intervention-${FACTOR}-notice`),
    ).not.toBeInTheDocument()
  })
})

describe('the sender settles, and two of its three answers mean nothing was sent', () => {
  it('QUEUED — SEND_DEFERRED says another turn holds the lock; the row must not say "sent"', async () => {
    // ⚠ The promise resolves BEFORE the turn exists. A row that read this as
    // "sent" would be describing a turn that has not happened.
    sendSystemEvent.mockResolvedValue('send_deferred')
    renderPanel()
    commit('0.6')

    await screen.findByTestId(`model-detail-v2-intervention-${FACTOR}-queued`)
    expect(
      screen.getByTestId(`model-detail-v2-intervention-${FACTOR}-queued`).textContent ?? '',
    ).toMatch(/queued behind another change/i)
    expect(
      screen.queryByTestId(`model-detail-v2-intervention-${FACTOR}-pending`),
    ).not.toBeInTheDocument()
  })

  it('BLOCKED — SEND_BLOCKED was never queued, so the row reopens and says so', async () => {
    sendSystemEvent.mockResolvedValue('send_blocked')
    renderPanel()
    commit('0.6')

    const notice = await screen.findByTestId(`model-detail-v2-intervention-${FACTOR}-notice`)
    expect(notice.textContent ?? '').toMatch(/not sent/i)
    // Editable again: the caller owns the retry, so the user must be able to.
    expect(screen.getByTestId(`model-detail-v2-intervention-${FACTOR}-input`)).toBeInTheDocument()
  })

  it('a TRANSPORT rejection is reported as blocked, never as sent', async () => {
    // A failed POST is not a server refusal — nothing reached the server — so
    // the row must not imply the model has heard about this number. This is the
    // FALLBACK arm: an unrecognised error shape lands here too, which is why
    // the two cases below have to prove they do NOT.
    sendSystemEvent.mockRejectedValue(new Error('network'))
    renderPanel()
    commit('0.6')

    const notice = await screen.findByTestId(`model-detail-v2-intervention-${FACTOR}-notice`)
    expect(notice.textContent ?? '').toMatch(/not sent/i)
  })

  /**
   * ⭐⭐ THE SERVER ANSWERED, AND THE ROW MAY NOT CALL THAT "NOT SENT".
   *
   * Every rejection used to land on `blocked`, whose copy says nothing reached
   * the server. That is false about a turn the server received and deliberately
   * failed — and the more dangerous half is the one where a write is not ruled
   * out, because "not sent" invites the user to re-send a number the model may
   * already hold.
   */
  it('REFUSED — a proven no-write conflict: the row says NOT SAVED and names the recovery', async () => {
    // `stale_base_graph_hash` is CEE's option-intervention stale gate, which
    // refuses before any write. It is in the closed proven-no-write set, so the
    // row is entitled to state the outcome rather than hedge.
    sendSystemEvent.mockRejectedValue(
      new SystemEventSendError('server', { conflictCategory: 'stale_base_graph_hash' }),
    )
    renderPanel()
    commit('0.6')

    const notice = await screen.findByTestId(`model-detail-v2-intervention-${FACTOR}-notice`)
    expect(notice.textContent ?? '').toMatch(/not saved/i)
    expect(notice.textContent ?? '').toMatch(/ask me anything/i)
    // It must NOT claim nothing was sent — the server is exactly who refused it.
    expect(notice.textContent ?? '').not.toMatch(/not sent/i)
    // And pending is over: a refusal that leaves the row saying "sent, not
    // saved yet" is the stuck label this whole leg exists to end.
    expect(
      screen.queryByTestId(`model-detail-v2-intervention-${FACTOR}-pending`),
    ).not.toBeInTheDocument()
  })

  it('UNVERIFIED — a server failure with no no-write guarantee claims NEITHER outcome', async () => {
    // `INGRESS_CONTRACT_VIOLATION` is non-retryable and carries no statement
    // about whether bytes landed — the exact trap `provenNoWriteConflict`'s
    // header names. An unknown category takes the cannot-confirm line.
    sendSystemEvent.mockRejectedValue(
      new SystemEventSendError('server', { code: 'INGRESS_CONTRACT_VIOLATION' }),
    )
    renderPanel()
    commit('0.6')

    const notice = await screen.findByTestId(`model-detail-v2-intervention-${FACTOR}-notice`)
    expect(notice.textContent ?? '').toMatch(/could not confirm/i)
    expect(notice.textContent ?? '').not.toMatch(/not sent/i)
    expect(notice.textContent ?? '').not.toMatch(/not saved/i)
    expect(
      screen.queryByTestId(`model-detail-v2-intervention-${FACTOR}-pending`),
    ).not.toBeInTheDocument()
  })

  it('⚠ DISCRIMINATING TWIN: a TRANSPORT-kind SystemEventSendError still says "not sent"', async () => {
    // Without this, the two cases above would pass on an implementation that
    // simply reported every `SystemEventSendError` as a server answer — losing
    // the one distinction the error class carries `kind` to make.
    sendSystemEvent.mockRejectedValue(new SystemEventSendError('transport'))
    renderPanel()
    commit('0.6')

    const notice = await screen.findByTestId(`model-detail-v2-intervention-${FACTOR}-notice`)
    expect(notice.textContent ?? '').toMatch(/not sent/i)
    expect(notice.textContent ?? '').not.toMatch(/could not confirm/i)
  })

  it('POSITIVE CONTROL: an ordinary send stays pending — the three above are not "everything fails"', async () => {
    renderPanel()
    commit('0.6')
    await screen.findByTestId(`model-detail-v2-intervention-${FACTOR}-pending`)
    expect(
      screen.queryByTestId(`model-detail-v2-intervention-${FACTOR}-notice`),
    ).not.toBeInTheDocument()
  })
})

describe('the canonical settlement — what ENDS a pending state', () => {
  it('the row clears when the CANONICAL store carries the value that was sent', async () => {
    renderPanel()
    commit('0.6')
    await screen.findByTestId(`model-detail-v2-intervention-${FACTOR}-pending`)

    // The applied response landing: the store now holds what was sent. Nothing
    // echoes the hook's own number back — this is the model the rest of the
    // surface reads.
    const applied = nodes().map(n =>
      n.id === OPTION
        ? { ...n, data: { ...(n.data as object), interventions: { [FACTOR]: 0.6 } } }
        : n,
    )
    await act(async () => {
      useCanvasStore.setState({ nodes: applied } as never, false)
    })

    expect(
      screen.queryByTestId(`model-detail-v2-intervention-${FACTOR}-pending`),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByTestId(`model-detail-v2-intervention-${FACTOR}-input`),
    ).not.toBeInTheDocument()
  })

  it('⚠ a DIFFERENT value landing does NOT settle it — the row is about the number that was sent', async () => {
    // The discriminating twin. Without it, "clears when the store changes"
    // would pass on any store movement at all, including a server value the
    // user never asked for.
    renderPanel()
    commit('0.6')
    await screen.findByTestId(`model-detail-v2-intervention-${FACTOR}-pending`)

    const other = nodes().map(n =>
      n.id === OPTION
        ? { ...n, data: { ...(n.data as object), interventions: { [FACTOR]: 0.42 } } }
        : n,
    )
    await act(async () => {
      useCanvasStore.setState({ nodes: other } as never, false)
    })

    expect(screen.getByTestId(`model-detail-v2-intervention-${FACTOR}-pending`)).toBeInTheDocument()
  })

  it('⚠ a SCENARIO SWITCH mid-flight stops the row claiming anything about this model', async () => {
    renderPanel()
    commit('0.6')
    await screen.findByTestId(`model-detail-v2-intervention-${FACTOR}-pending`)

    await act(async () => {
      useCanvasStore.setState({ currentScenarioId: 'a-different-scenario' } as never, false)
    })

    const notice = await screen.findByTestId(`model-detail-v2-intervention-${FACTOR}-notice`)
    expect(notice.textContent ?? '').toMatch(/scenario changed/i)
  })
})

describe('the production posture', () => {
  it('⭐ CONTRAST: with the shipped authority the control is not offered at all', async () => {
    // Without this, every case above would be a statement about a surface no
    // user can reach — and it is also the pin that the flip is a DELIBERATE act
    // rather than something a refactor can do by accident.
    //
    // ⚠ THE MODULE IS RE-IMPORTED, and it has to be: the panel reads the
    // authority ONCE, into a module-level `OPTION_INTERVENTION_CONNECTED`. Just
    // flipping the mocked value here would change nothing — the const was
    // already evaluated at first import, so this test would "pass" against the
    // connected build and prove the opposite of what it claims.
    authority.value = 'disabled'
    vi.resetModules()
    const { ModelTabV2Panel: ProductionPanel } = await import('../ModelTabV2Panel')

    const n = nodes()
    useCanvasStore.setState({ nodes: n, edges: [], lastServerGraphHash: HASH } as never, false)
    render(<ProductionPanel nodes={n} edges={[]} goalThreshold={null} />)
    openOutlineGroups()
    fireEvent.click(screen.getByTestId(`model-row-v2-${OPTION}`))

    // The value cell falls back to a plain span: no editor, nothing to press.
    expect(
      screen.getByTestId(`model-detail-v2-intervention-${FACTOR}-value`).tagName,
    ).toBe('SPAN')
    expect(
      screen.queryByTestId(`model-detail-v2-intervention-${FACTOR}-input`),
    ).not.toBeInTheDocument()
  })
})

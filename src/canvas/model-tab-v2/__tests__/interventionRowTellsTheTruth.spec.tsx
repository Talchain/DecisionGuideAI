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

/**
 * ⚠⚠ THE HARNESS SUBSCRIBES TO THE STORE, AND THAT IS NOT A CONVENIENCE.
 *
 * The panel takes `nodes` as a PROP. In production the prop is a store
 * subscription: `OutputsDock` reads `nodes: s.nodes` through
 * `useCanvasStore(useShallow(...))` and threads it down via `ModelTabBody`, so a
 * store write re-renders the panel with a new array — which is exactly how an
 * applied response reaches this surface.
 *
 * The first version of this file rendered `<ModelTabV2Panel nodes={n} …/>` with
 * a FIXED array and then wrote to the store. The prop never moved, so the
 * settlement could never fire: the applied-settlement test failed on CI, and —
 * worse — its DISCRIMINATING TWIN ("a different value does NOT settle it")
 * passed for the wrong reason. Nothing could settle it, so that assertion held
 * against every possible implementation. A twin that cannot fail is not a twin.
 *
 * Reproducing the real subscription here binds every case below to the mechanism
 * production uses, rather than to a prop the test hands over by hand.
 */
function StoreBoundPanel() {
  const storeNodes = useCanvasStore(s => s.nodes)
  const scenarioId = useCanvasStore(s => s.currentScenarioId)
  const baseHash = useCanvasStore(s => s.lastServerGraphHash)
  return (
    <ModelTabV2Panel
      nodes={storeNodes as Node[]}
      edges={[]}
      goalThreshold={null}
      currentScenarioId={scenarioId}
      lastServerGraphHash={baseHash}
    />
  )
}

function renderPanel(lastServerGraphHash: string | null = HASH) {
  const n = nodes()
  useCanvasStore.setState({ nodes: n, edges: [], lastServerGraphHash, currentScenarioId: 'scn_1' } as never, false)
  render(<StoreBoundPanel />)
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
  it('⭐ the send OPTS OUT of the sender\'s hidden queue — `deferIfBusy: false`', () => {
    // Bound by identity to the option, not to a behaviour that happens to look
    // right today. With the default, a send made during an in-flight turn is
    // buffered and the promise resolves SEND_DEFERRED *before the turn exists* —
    // so the row's "queued" would have no way to end, and the buffered copy
    // would carry a base hash the waited-for turn had already superseded.
    renderPanel()
    commit('0.6')
    expect(sendSystemEvent).toHaveBeenCalledTimes(1)
    expect(sendSystemEvent.mock.calls[0]?.[1]).toEqual({ deferIfBusy: false })
  })

  // ⚠ DEFENSIVE, NOT LIVE. The case above pins `deferIfBusy: false`, so the real
  // sender returns SEND_BLOCKED rather than SEND_DEFERRED here. This asserts the
  // branch stays correct if that option is ever dropped — deleting it would let
  // a SEND_DEFERRED fall through to `sent`, the one answer that is definitely
  // wrong.
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

/**
 * ⭐⭐ THE RECOVERY LOOP, END TO END — a reload, the refusal, the turn, the send.
 *
 * `needs_fresh_base` is the one refusal that names an action, and until now
 * nothing proved the action WORKS. A refusal whose recovery is untested is a
 * promise, and this surface has already shipped one state that could only be
 * entered.
 */
describe('reload → refusal → a turn arrives → the same edit now goes', () => {
  it('the notice clears when the base actually arrives, and the number stays put', async () => {
    renderPanel(null)
    commit('0.6')
    expect(sendSystemEvent).not.toHaveBeenCalled()
    expect(
      (await screen.findByTestId(`model-detail-v2-intervention-${FACTOR}-notice`)).textContent ?? '',
    ).toMatch(/re-sync/i)

    // A turn lands. `applyV5State` stamps the hash from the response's
    // top-level `graph_hash`; this is that write, and nothing else about it.
    await act(async () => {
      useCanvasStore.setState({ lastServerGraphHash: HASH } as never, false)
    })

    expect(
      screen.queryByTestId(`model-detail-v2-intervention-${FACTOR}-notice`),
    ).not.toBeInTheDocument()
    // ⚠ THE DRAFT SURVIVES. Clearing the reason is not the same as discarding
    // what the user typed.
    expect(
      (screen.getByTestId(`model-detail-v2-intervention-${FACTOR}-input`) as HTMLInputElement).value,
    ).toBe('0.6')
    // ⚠ AND NOTHING WAS SENT FOR THEM. A recovered base does not authorise a
    // send the user did not press.
    expect(sendSystemEvent).not.toHaveBeenCalled()
  })

  it('and pressing Save again DISPATCHES, with the recovered hash on the wire', async () => {
    renderPanel(null)
    commit('0.6')
    await act(async () => {
      useCanvasStore.setState({ lastServerGraphHash: HASH } as never, false)
    })

    fireEvent.click(screen.getByTestId(`model-detail-v2-intervention-${FACTOR}-save`))

    expect(sendSystemEvent).toHaveBeenCalledTimes(1)
    expect(sendSystemEvent.mock.calls[0]?.[0]?.payload?.base_graph_hash).toBe(HASH)
    expect(sendSystemEvent.mock.calls[0]?.[0]?.payload?.value).toBe(0.6)
    await screen.findByTestId(`model-detail-v2-intervention-${FACTOR}-pending`)
  })

  /**
   * ⭐ THE BASE IS READ AT SEND TIME, NOT CAPTURED — and that claim was untested.
   *
   * `useModelEditAuthority` says of `lastServerGraphHash`: "THE ONE OWNER OF THE
   * BASE HASH, read here rather than captured". Captured — at mount, at row
   * selection, at the first send — the SECOND send of a session would carry a
   * hash the server had already superseded, CEE would refuse it as stale, and
   * the user would be told to re-sync after every single edit on a surface whose
   * whole point is that an edit reaches the server.
   *
   * The case above already proves it across a mount that began with NO hash.
   * This proves the harder half: a second send from the SAME mount, after the
   * base has moved underneath it. The row is reopened by a `SEND_BLOCKED`
   * settlement — a real, reachable way back to a Save without unmounting
   * anything, and the only one available while the applied receipt is missing
   * (see `interventionAppliedCarrierGap.spec.ts`).
   */
  it('⭐ a SECOND send from the same mount carries the MOVED hash, not the first one', async () => {
    const HASH_B = '11223344aabbccdd'
    sendSystemEvent.mockResolvedValue('send_blocked')
    renderPanel()
    commit('0.6')
    expect(sendSystemEvent.mock.calls[0]?.[0]?.payload?.base_graph_hash).toBe(HASH)

    // The blocked settlement reopens the row with the draft intact.
    await screen.findByTestId(`model-detail-v2-intervention-${FACTOR}-notice`)

    // A turn lands and moves the base — exactly what the committed arm's
    // response does: `applyV5State` stamps the top-level `graph_hash`.
    await act(async () => {
      useCanvasStore.setState({ lastServerGraphHash: HASH_B } as never, false)
    })

    fireEvent.click(screen.getByTestId(`model-detail-v2-intervention-${FACTOR}-save`))

    expect(sendSystemEvent).toHaveBeenCalledTimes(2)
    expect(sendSystemEvent.mock.calls[1]?.[0]?.payload?.base_graph_hash).toBe(HASH_B)
    expect(sendSystemEvent.mock.calls[1]?.[0]?.payload?.value).toBe(0.6)
  })

  it('⚠ DISCRIMINATING CONTROL: with NO base arriving, the second Save refuses again', async () => {
    // Without this, the case above would pass on a surface where any second
    // attempt succeeds — which is what a dropped guard looks like from outside.
    renderPanel(null)
    commit('0.6')
    fireEvent.click(screen.getByTestId(`model-detail-v2-intervention-${FACTOR}-save`))

    expect(sendSystemEvent).not.toHaveBeenCalled()
    expect(
      (await screen.findByTestId(`model-detail-v2-intervention-${FACTOR}-notice`)).textContent ?? '',
    ).toMatch(/re-sync/i)
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
    render(
      <ProductionPanel
        nodes={n}
        edges={[]}
        goalThreshold={null}
        currentScenarioId="scn_1"
        lastServerGraphHash={HASH}
      />,
    )
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

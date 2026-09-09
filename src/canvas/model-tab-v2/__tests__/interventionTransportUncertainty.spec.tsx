/**
 * ⭐⭐⭐ THE GUARANTEE, NOT THE ANSWER — real adapter → router → system error → row.
 *
 * The row's transport wording was pinned twice before this file existed, and
 * both pins tested the ANSWER by handing the seam a hand-built error. The second
 * one was worse than useless: it injected `deliveryUnverified: false` and read
 * that as proof the request never left, so the assertion agreed with a bit
 * nobody had derived.
 *
 * ── WHY A FALSY BIT IS NOT PROOF (verified at the bytes) ────────────────────
 *   · `v5Adapter` awaits `fetchFn(...)` and catches ANY rejection. It does not
 *     observe whether the server accepted the request.
 *   · `responseRouter` sets `transportMeta.network = (http_status === undefined)`
 *     — true for every fetch-threw path, by its own comment.
 *   · `isUnverifiedDelivery` is `isTransportFailure && network === false`, so a
 *     fetch rejection returns FALSE — the same value as a genuinely impossible
 *     delivery.
 *
 * So the counterexample is reachable and ordinary: CEE commits the POST, the
 * connection dies before headers reach the browser, `fetch` rejects with a
 * `TypeError` — and the old row said "Not sent … Try again", inviting the user
 * to re-send a number the model already holds.
 *
 * ── WHAT THIS FILE DOES DIFFERENTLY ────────────────────────────────────────
 * It mocks ONLY the network, and only in the one way that reproduces the
 * counterexample: the fetch stub RECORDS that it was called — that is the
 * acceptance the client can actually observe — and then rejects. Everything
 * between that and the notice is the real chain: real `callV5Turn`, real
 * parser, real `routeV5Response`, real `useConversation` inside the real
 * `ConversationProvider`, the real authority, and the real mounted panel.
 *
 * Nothing here asserts a certificate it manufactured.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { Node } from '@xyflow/react'

// ── Seams only. The V5 adapter/parser/router chain stays REAL. ──────────────
// V4 transport must never be touched: `src/canvas/conversation/turnService`.
vi.mock('../../conversation/turnService', () => ({
  callOrchestratorTurn: vi.fn(),
  streamOrchestratorTurn: vi.fn(),
  OrchestratorError: class OrchestratorError extends Error {},
}))
vi.mock('../../../v5/streamedTurnTransport', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  openV5TurnStream: async () => {
    throw new TypeError('Failed to fetch')
  },
}))
vi.mock('../../../lib/supabase', () => ({
  getUserId: async () => null,
  getSessionIdentity: async () => ({ userId: null, accessToken: null }),
}))
vi.mock('../../../services/scenarioService', () => ({
  loadScenario: async () => null,
  storeAnalysis: async () => undefined,
}))
vi.mock('../../../lib/posthog', () => ({ trackEvent: () => undefined }))
vi.mock('../../../v5/eligibility', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  isV5Eligible: () => ({ eligible: true }),
  isV5CanonicalRunPath: () => false,
}))
vi.mock('../../utils/focusHelpers', () => ({ focusNodeById: vi.fn(), focusEdgeById: vi.fn() }))

// The one declaration that decides whether this surface offers the control.
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
import { ConversationProvider, useOptionalConversationContext } from '../../conversation/ConversationContext'
import { ModelTabV2Panel } from '../ModelTabV2Panel'
import { openOutlineGroups } from './openOutlineGroups'

const OPTION = 'opt_leeds'
const FACTOR = 'fac_capex'
const HASH = '9f2c1b0ae4d37c5a'
const SCENARIO = 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4'

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

/** Captured so a test can take the in-flight lock the way a real turn does. */
let conversation: ReturnType<typeof useOptionalConversationContext> = null
function CaptureConversation() {
  conversation = useOptionalConversationContext()
  return null
}

function renderMounted() {
  const n = nodes()
  useCanvasStore.setState(
    { nodes: n, edges: [], lastServerGraphHash: HASH, currentScenarioId: SCENARIO } as never,
    false,
  )
  render(
    <ConversationProvider>
      <CaptureConversation />
      <ModelTabV2Panel
        nodes={n}
        edges={[]}
        goalThreshold={null}
        currentScenarioId={SCENARIO}
        lastServerGraphHash={HASH}
      />
    </ConversationProvider>,
  )
  openOutlineGroups()
  fireEvent.click(screen.getByTestId(`model-row-v2-${OPTION}`))
}

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

function interventionInStore(): unknown {
  const option = useCanvasStore.getState().nodes.find(n => n.id === OPTION)
  return ((option?.data as { interventions?: Record<string, unknown> })?.interventions ?? {})[FACTOR]
}

beforeEach(() => {
  conversation = null
  authority.value = 'server_graph'
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
  cleanup()
})

describe('a fetch that was MADE and then rejected', () => {
  it('⭐ the row claims neither sent nor saved, and offers no retry it cannot justify', async () => {
    // The stub records the call FIRST — that record is the acceptance the client
    // can actually observe — and only then rejects, exactly as a connection
    // dropped after CEE committed would appear here.
    const fetchStub = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    vi.stubGlobal('fetch', fetchStub)

    renderMounted()
    commit('0.6')

    // The request LEFT. Whatever the row says next, it may not say otherwise.
    await waitFor(() => expect(fetchStub).toHaveBeenCalled())
    await waitFor(() => expect(noticeText()).toMatch(/could not confirm/i))

    expect(noticeText()).not.toMatch(/not sent/i)
    expect(noticeText()).not.toMatch(/try again/i)
    expect(noticeText()).not.toMatch(/still in flight/i)
    // And no local optimistic value stands in for the answer.
    expect(interventionInStore()).toBe(0.2)
  })

  it('⭐ CONTRAST: a genuine SEND_BLOCKED makes NO fetch at all, and only it says "not sent"', async () => {
    // A turn is taken and never settles, so the sender refuses the dispatch
    // outright. That is the ONE pre-dispatch proof on this path — a fact about
    // the client's own behaviour, not an inference about the network's — and it
    // is the only settlement entitled to claim the edit was not sent.
    const fetchStub = vi.fn(() => new Promise<Response>(() => {}))
    vi.stubGlobal('fetch', fetchStub)

    renderMounted()
    await waitFor(() => expect(conversation).not.toBeNull())
    await act(async () => {
      void conversation?.sendMessage('take the lock')
      await Promise.resolve()
    })
    const callsBeforeEdit = fetchStub.mock.calls.length

    commit('0.6')
    await waitFor(() => expect(noticeText()).toMatch(/still in flight/i))

    // ZERO fetches for the edit itself — the proof, stated as a count rather
    // than inferred from the copy.
    expect(fetchStub.mock.calls.length).toBe(callsBeforeEdit)
    expect(noticeText()).toMatch(/not sent/i)
    expect(interventionInStore()).toBe(0.2)
  })
})

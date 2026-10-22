/**
 * LIVE-CHAIN V5 error-recovery tests (Codex F6 — recovery renders on the
 * LIVE path, server retryability authoritative).
 *
 * These tests drive an ACTUAL non-2xx CEE body through the LIVE V5 branch:
 * a stubbed global fetch returns the real wire shape, then the REAL
 * `callV5Turn` → REAL `parseV5Response` (real `BoundaryErrorSchema`) → REAL
 * `routeV5Response` → useConversation's V5 typed_error branch run
 * unmocked. The only seams stubbed are eligibility (flag on), auth/session,
 * telemetry, the DB service, and the network itself.
 *
 * Why this shape is load-bearing: #383 shipped its recovery rendering with
 * a renderer unit test fed a hand-built object — and was wired to the DEAD
 * V4 `handleEnvelope` path (the V5 branch `return`s before it). A grepped
 * symbol proves presence-in-repo, never presence-on-the-live-wire; only a
 * wire-in test proves the live chain. These specs FAIL on the pre-fix code.
 *
 * Wire provenance (verified at CEE staging cbb619a3, src/orchestrator/
 * route-v2.ts): every non-2xx `/orchestrate/v2/turn` body is a strict
 * BoundaryError; recovery rides NESTED at `details.recovery` ({ hints,
 * suggestion, example? }); `details.reason` carries MACHINE codes
 * (draft_graph_cee_timeout) that must never render to users. The flat
 * `recovery_suggestion` (0.19.0 `CeeTypedErrorSchema`, root export) rides
 * CEEErrorResponseV1-shaped envelopes, which are not BoundaryErrors.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderHook, act, render, fireEvent, cleanup } from '@testing-library/react'
import { useConversation } from '../useConversation'
import { useCanvasStore } from '../../store'
import { ChatThread } from '../zones/ChatThread'
import { ConversationProvider, useConversationContext } from '../ConversationContext'
import { FirstUseComposer } from '../../components/FirstUseComposer'
import { useFloatingPanelState } from '../../hooks/useFloatingPanelState'
import r2Errors from '../../../v5/__tests__/fixtures/core-turn-r2-errors.json'

// ---------------------------------------------------------------------------
// Mocks — seams only; the V5 adapter/parser/router chain stays REAL.
// ---------------------------------------------------------------------------

// V4 transport must never be touched by these tests.
const mockCallTurn = vi.fn()
vi.mock('../turnService', () => ({
  callOrchestratorTurn: (...args: unknown[]) => mockCallTurn(...args),
  streamOrchestratorTurn: (...args: unknown[]) => mockCallTurn(...args),
  OrchestratorError: class OrchestratorError extends Error {
    status: number
    body: unknown
    constructor(message: string, status: number, body: unknown) {
      super(message)
      this.name = 'OrchestratorError'
      this.status = status
      this.body = body
    }
  },
}))

// ROADMAP 2.122 — `sendMessage` on an EMPTY canvas is now dispatched to the
// STREAMED turn sibling first (`<endpoint>/stream`, CEE #751), with a
// transparent fallback to the buffered turn on any stream failure.
//
// This spec's subject is the BUFFERED chain, so the streamed sibling is stubbed
// unreachable — which is not an artificial construction: it is exactly the state
// of a deployment where the streamed route is absent or refusing, and the
// fallback it triggers is the behaviour under test elsewhere
// (`streamedDraftTurn.spec.ts`). With the sibling unreachable the buffered path
// runs exactly once, which is what this spec's request-count pins measure.
vi.mock('../../../v5/streamedTurnTransport', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../v5/streamedTurnTransport')>()
  return {
    ...actual,
    openV5TurnStream: async () => {
      throw new TypeError('Failed to fetch')
    },
  }
})

vi.mock('../../../lib/supabase', () => ({
  getUserId: async () => null,
  getSessionIdentity: async () => ({ userId: null, accessToken: null }),
}))

vi.mock('../../../services/scenarioService', () => ({
  loadScenario: async () => null,
  storeAnalysis: async () => undefined,
}))

vi.mock('../../../lib/posthog', () => ({
  trackEvent: () => undefined,
}))
vi.mock('../../../adapters/plot', () => ({ plot: { templates: () => new Promise(() => {}) } }))
vi.mock('../../hooks/useStageAwarePlaceholder', () => ({ useStageAwarePlaceholder: () => 'Describe your model…' }))
vi.mock('../../hooks/useSelectionContext', () => ({ useSelectionContext: () => null }))
vi.mock('../../hooks/usePrefersReducedMotion', () => ({ usePrefersReducedMotion: () => true }))

// Eligibility ON so sendMessage enters the V5 exclusive branch regardless of
// the developer's env (same pattern as useConversation.hook.spec.ts).
vi.mock('../../../v5/eligibility', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../v5/eligibility')>()
  return {
    ...actual,
    isV5Eligible: () => ({ eligible: true }),
    isV5CanonicalRunPath: () => false,
  }
})

// ---------------------------------------------------------------------------
// Wire fixtures + fetch stub
// ---------------------------------------------------------------------------

const RECOVERY_SUGGESTION = 'Add more detail about your options, then draft again.'
const RECOVERY_HINTS = [
  'Name the decision you are weighing',
  'List at least two options you are choosing between',
]
const MACHINE_REASON = 'draft_graph_cee_llm_validation_failed'

/** The LIVE wire shape: strict BoundaryError, recovery NESTED in details. */
function liveBoundaryErrorBody(overrides: {
  retryable: boolean
  reason?: string
  recovery?: { hints: string[]; suggestion: string; example?: string }
}): Record<string, unknown> {
  return {
    error: 'INTERNAL_ERROR',
    boundary: 'B1',
    direction: 'egress',
    validator: 'draft_graph_pipeline',
    details: {
      retryable: overrides.retryable,
      ...(overrides.reason !== undefined ? { reason: overrides.reason } : {}),
      ...(overrides.recovery !== undefined ? { recovery: overrides.recovery } : {}),
      pipeline_error_code: 'CEE_LLM_VALIDATION_FAILED',
      stage: 'frame',
    },
    request_id: 'req_live_1',
    retryable: overrides.retryable,
  }
}

function stubFetchWith(status: number, body: unknown) {
  const fetchStub = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>(async () => ({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response))
  vi.stubGlobal('fetch', fetchStub)
  return fetchStub
}

async function sendAndGetLastMessage() {
  const { result } = renderHook(() => useConversation())
  await act(async () => {
    await result.current.sendMessage('draft my decision')
  })
  const messages = result.current.messages
  const last = messages[messages.length - 1]
  expect(last).toBeDefined()
  expect(last.role).toBe('assistant')
  return { last, result }
}

beforeEach(() => {
  window.history.replaceState({}, '', '/#/canvas?ai=openai')
  useCanvasStore.setState({
    currentScenarioId: 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4',
    nodes: [],
    edges: [],
    results: { status: 'idle' } as never,
    currentScenarioLastResultHash: null,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  })
})

afterEach(() => {
  cleanup()
  window.history.replaceState({}, '', '/')
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('L2-UI core save outcomes through the real fetch → parser → router → conversation → thread', () => {
  const CAPACITY = "Olumi's AI service is temporarily out of capacity. Nothing was saved. Try again later."
  const SAVED = 'Your model was saved, but the reply failed. Send a new message to continue.'
  const RETRY = [{ id: 'retry', label: 'Try again', intent: 'primary' }]
  function Surface({ children }: { children: ReactNode }) {
    return createElement(ConversationProvider, null, children, createElement(FirstUseComposer))
  }

  it.each([
    { row: 'capacity/no write overrides safe resend', body: { error: 'PROVIDER_CAPACITY', retryable: false, nothing_saved: true, retry_safe: true }, words: CAPACITY, retry: false },
    { row: 'verified save/reply failed', body: { error: 'UPSTREAM_ERROR', nothing_saved: false, save_outcome: 'VERIFIED_SAVED', retry_safe: false }, words: SAVED, retry: false },
    { row: 'safe no-write retry', body: { error: 'UPSTREAM_ERROR', nothing_saved: true, retry_safe: true }, words: 'Something went wrong on our side. Please retry.', retry: true },
    { row: 'unsafe retry', body: { error: 'UPSTREAM_ERROR', retry_safe: false }, words: 'Something went wrong on our side.', retry: false },
    { row: 'missing retry proof', body: { error: 'UPSTREAM_ERROR' }, words: 'Something went wrong on our side.', retry: false },
    { row: 'unknown save is not a saved claim', body: { error: 'UPSTREAM_ERROR', nothing_saved: false, save_outcome: 'UNKNOWN', retry_safe: false }, words: 'Something went wrong on our side.', retry: false },
    { row: 'capacity without no-write proof', body: { error: 'PROVIDER_CAPACITY', retryable: false, retry_safe: true }, words: "Olumi's AI service is temporarily out of capacity. Try again later.", retry: false },
    { row: 'saved before capacity refusal', body: { error: 'PROVIDER_CAPACITY', retryable: false, nothing_saved: false, save_outcome: 'VERIFIED_SAVED', retry_safe: false }, words: SAVED, retry: false },
    { row: 'unrelated diagnostic cannot authorise Retry or saved copy', body: { error: 'UPSTREAM_ERROR', provider_error: { retry_safe: true, save_outcome: 'VERIFIED_SAVED' }, detail: 'retry_safe: true; model saved' }, words: 'Something went wrong on our side.', retry: false },
  ])('openai lane (flat bodies): $row', async ({ body, words, retry }) => {
    window.history.replaceState({}, '', '/#/canvas?ai=openai')
    useFloatingPanelState.getState().reset()
    useFloatingPanelState.getState().open('system-first-use')
    const fetchStub = stubFetchWith(502, body)
    const { result } = renderHook(() => useConversationContext(), { wrapper: Surface })
    // Same contract across independent strategic briefs; no provider is called.
    for (const brief of ['Explore staffing options', 'Explore a market launch']) {
      await act(async () => { await result.current.sendMessage(brief) })
      const last = result.current.messages.at(-1)!
      expect(last.content).toBe(words)
      expect(last.actionChips).toEqual(retry ? RETRY : [])
      expect(result.current.lastSendFailure?.retryable).toBe(retry)
      expect(document.querySelector('[data-testid="first-use-send-failure"] p')?.textContent).toBe(words)
      expect(result.current.messages.filter(m => m.role === 'user').at(-1)?.deliveryState).toBe('sent')
    }
    expect(fetchStub).toHaveBeenCalledTimes(2)
    expect(new Headers(fetchStub.mock.calls[0][1]?.headers).get('x-olumi-ai-mode')).toBe('openai')
    const { container } = render(createElement(ChatThread, {
      messages: result.current.messages, isThinking: false, longRunningHint: null, nodeCount: 0,
      patchBlockStates: new Map(), patchRejections: new Map(), onChipClick: async () => {},
      onPatchAccept: () => {}, onPatchDismiss: () => {}, onFeedback: () => {}, onRetry: () => {},
    }))
    expect(container.querySelectorAll('[data-testid="message-body-text"]')[1]?.textContent).toBe(words)
    expect(container.querySelector('[aria-label="Retry sending this message"]')).toBeNull()
    const assistant = container.querySelector('[data-testid="chat-message-assistant"]')!
    fireEvent.click(assistant.querySelector('[data-testid="message-menu-trigger"]')!)
    expect(assistant.querySelector('[data-testid="message-menu-retry"]') !== null).toBe(retry)
  })

  // The core route's failed turn is the whole contract with its `error` set, in R2's served shape (an empty model with
  // null revisions: `fixtures/core-turn-r2-errors.json`); only the error is read.
  const coreFailure = (code: string, retrySafe: boolean, nothingSaved: boolean, message = 'x') => ({
    ...r2Errors.resend_after_claim_wait.body, error: { code, message, retry_safe: retrySafe, nothing_saved: nothingSaved },
  })
  it.each([
    { row: 'capacity, nothing saved: no resend', status: 503, body: coreFailure('PROVIDER_CAPACITY', true, true), words: CAPACITY, retry: false },
    { row: 'safe no-write retry', status: 502, body: coreFailure('UPSTREAM_ERROR', true, true), words: 'Something went wrong on our side. Please retry.', retry: true },
    { row: 'unsafe retry', status: 502, body: coreFailure('UPSTREAM_ERROR', false, false), words: 'Something went wrong on our side.', retry: false },
    { row: '⭐ legacy scenario (409): one line, no resend, though CEE marks it retry-safe', status: 409,
      body: coreFailure('legacy_scenario', true, true, 'This scenario was saved before the current Olumi model and cannot be opened on this route. Nothing was changed.'),
      words: 'This scenario was built with an earlier version of Olumi. Start a new scenario to continue; this one stays here to read.', retry: false },
  ])('core route (the staging default, contract bodies): $row', async ({ status, body, words, retry }) => {
    window.history.replaceState({}, '', '/#/canvas?ai=core-route')
    useFloatingPanelState.getState().reset()
    useFloatingPanelState.getState().open('system-first-use')
    const fetchStub = stubFetchWith(status, body)
    const { result } = renderHook(() => useConversationContext(), { wrapper: Surface })
    await act(async () => { await result.current.sendMessage('Explore staffing options') })
    const last = result.current.messages.at(-1)!
    expect(last.content).toBe(words)
    expect(last.actionChips).toEqual(retry ? RETRY : [])
    expect(result.current.lastSendFailure?.retryable).toBe(retry)
    expect(document.querySelector('[data-testid="first-use-send-failure"] p')?.textContent).toBe(words)
    expect(new Headers(fetchStub.mock.calls[0][1]?.headers).get('x-olumi-ai-mode')).toBe('core-route')
  })

  it.each(['openai', 'conventional'])('%s retains legacy copy and Retry even with core sidecars', async mode => {
    window.history.replaceState({}, '', `/#/canvas?ai=${mode}`)
    stubFetchWith(502, { error: 'PROVIDER_CAPACITY', retry_safe: false, nothing_saved: true, save_outcome: 'VERIFIED_SAVED' })
    const { last, result } = await sendAndGetLastMessage()
    expect(last.content).toBe('Something went wrong on our side. Please retry.')
    expect(last.actionChips).toEqual(RETRY)
    expect(result.current.lastSendFailure?.retryable).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('V5 live-chain error recovery — non-2xx BoundaryError through the real adapter/parser/router', () => {
  it('envelope WITH nested recovery + server retryable:false → suggestion and hints render, machine reason does not, no retry affordance despite client-retryable INTERNAL_ERROR', async () => {
    const fetchStub = stubFetchWith(500, liveBoundaryErrorBody({
      retryable: false,
      reason: MACHINE_REASON,
      recovery: { hints: RECOVERY_HINTS, suggestion: RECOVERY_SUGGESTION },
    }))

    const { last, result } = await sendAndGetLastMessage()
    expect(fetchStub).toHaveBeenCalledTimes(1)

    // The user sees the specific recovery suggestion…
    expect(last.content).toContain(RECOVERY_SUGGESTION)
    // …and the hints, as bullets…
    expect(last.content).toContain(`• ${RECOVERY_HINTS[0]}`)
    expect(last.content).toContain(`• ${RECOVERY_HINTS[1]}`)
    // …and NEVER the raw machine reason code.
    expect(last.content).not.toContain(MACHINE_REASON)

    // Server said non-retryable — no retry affordance, even though the
    // client table classifies INTERNAL_ERROR as retryable.
    expect(last.actionChips ?? []).toHaveLength(0)
    // And the copy must not instruct a retry the UI does not offer.
    expect(last.content).not.toMatch(/please retry|try again/i)
    // The failure notice is still raised — a non-retryable failure must not be
    // SILENT — but it is marked non-retryable so no surface offers a retry.
    // (This assertion previously read `lastFailedInput === null`. That field
    // was set only when `retryable` was true and has been deleted; the two
    // signals genuinely differ here, so the check moved onto the flag that
    // actually governs the affordance rather than onto payload presence.)
    expect(result.current.lastSendFailure?.retryable).toBe(false)
    // The user's text is still preserved for restore-into-composer — losing
    // typing is never the right answer, retryable or not.
    expect(result.current.lastSendFailure?.inputText).toBe('draft my decision')
  })

  it('envelope WITHOUT recovery + server retryable:true → canonical copy with retry affordance, machine reason still never leaks', async () => {
    stubFetchWith(500, liveBoundaryErrorBody({
      retryable: true,
      reason: 'draft_graph_cee_timeout',
    }))

    const { last } = await sendAndGetLastMessage()

    // Safe fallback: the canonical taxonomy copy.
    expect(last.content).toContain('Something went wrong on our side. Please retry.')
    // The machine reason code must not leak to the user.
    expect(last.content).not.toContain('draft_graph_cee_timeout')
    // Server says retryable — the affordance is offered.
    expect(last.actionChips).toEqual([
      { id: 'retry', label: 'Try again', intent: 'primary' },
    ])
  })

  it('server retryable:false WITHOUT recovery → no retry affordance and no retry instruction in the copy', async () => {
    stubFetchWith(500, liveBoundaryErrorBody({
      retryable: false,
      reason: 'draft_graph_cee_graph_invalid',
    }))

    const { last } = await sendAndGetLastMessage()

    expect(last.content).toContain('Something went wrong on our side.')
    expect(last.content).not.toMatch(/please retry/i)
    expect(last.actionChips ?? []).toHaveLength(0)
  })

  it('prose details.reason (no recovery) renders — the display gate rejects codes, not sentences', async () => {
    stubFetchWith(500, liveBoundaryErrorBody({
      retryable: true,
      reason: 'The upstream model returned an empty response',
    }))

    const { last } = await sendAndGetLastMessage()

    expect(last.content).toContain('The upstream model returned an empty response')
  })

  it('flat CeeTypedError-shaped non-2xx body (0.19.0 recovery_suggestion, not a BoundaryError) → suggestion renders and server retryable:false is honoured through the rawBody passthrough', async () => {
    stubFetchWith(500, {
      error: 'CEE_LLM_VALIDATION_FAILED',
      message: 'Draft failed validation.',
      retryable: false,
      request_id: 'req_flat_1',
      recovery_suggestion: RECOVERY_SUGGESTION,
      recovery: { hints: RECOVERY_HINTS, suggestion: RECOVERY_SUGGESTION },
    })

    const { last } = await sendAndGetLastMessage()

    expect(last.content).toContain(RECOVERY_SUGGESTION)
    expect(last.content).toContain(`• ${RECOVERY_HINTS[0]}`)
    expect(last.actionChips ?? []).toHaveLength(0)
    expect(last.content).not.toMatch(/please retry|try again/i)
  })

  it('2.472: the witnessed server-fault ingress violation (scenario_preflight / ownership unverifiable) renders server-fault guidance through the LIVE chain — never "rephrase"', async () => {
    // Byte-for-byte the BoundaryError CEE served during the 4 Aug outage
    // (PHASE0-EVIDENCE-2026-07-28/rewalk-2459b-raw/run2-rewalk-wire.json).
    // Pre-2.472 this told the user to rephrase a message that was fine.
    stubFetchWith(422, {
      error: 'INGRESS_CONTRACT_VIOLATION',
      boundary: 'B1',
      direction: 'ingress',
      validator: 'scenario_preflight',
      details: {
        reason: 'scenario_ownership_unverifiable',
        scenario_id: 'c261b74a-c7ce-4aad-96ca-04f0fdfd0fce',
      },
      request_id: 'd3daf877-2adb-4dde-babf-daa7d7a30d0b',
      retryable: false,
    })

    const { last } = await sendAndGetLastMessage()

    // The honest server-fault guidance, verbatim.
    expect(last.content).toContain(
      "Something on our side isn't working — your message was fine. Please try again in a moment.",
    )
    // The wording-blame untruth is gone.
    expect(last.content).not.toMatch(/rephrase/i)
    // The machine reason never leaks.
    expect(last.content).not.toContain('scenario_ownership_unverifiable')
    // Server said non-retryable — no retry chip.
    expect(last.actionChips ?? []).toHaveLength(0)
  })

  it('no envelope at all (200 with a severity-error block) → client table resolves retryability safely', async () => {
    stubFetchWith(200, {
      response_version: 2,
      assistant_text: '',
      blocks: [{ type: 'error', error_code: 'TURN_BUDGET_EXCEEDED', severity: 'error' }],
      suggested_actions: [],
      insights: [],
      stage_indicator: 'frame',
    })

    const { last } = await sendAndGetLastMessage()

    // Client-table fallback: TURN_BUDGET_EXCEEDED is non-retryable.
    expect(last.actionChips ?? []).toHaveLength(0)
    // Copy agrees with the withheld affordance and the guidance names the way forward.
    expect(last.content).toContain('That took longer than we allow for a single turn.')
    expect(last.content).not.toMatch(/please retry/i)
    expect(last.content).toContain('start a new scenario')
  })
})

/**
 * ROADMAP 1.177 (UI half) — the STREAMED draft 500 carries CEE's recovery to
 * the screen, witnessed with the REAL captured body.
 *
 * ── Premise correction (a deliverable of this lane, 2026-08-08) ────────────
 * Row 1.177's "the UI has ZERO readers of `recovery.suggestion`" (positive-
 * controlled 19 Jul) is STALE: readers landed the following day — #383
 * (renderer, wired to the then-dead V4 path), #391 (LIVE V5 chain, server
 * retryability authoritative), #398/#613 (transport-class split) — via
 * `ceeRecovery.extractCeeRecovery` + useConversation's typed_error branch.
 * What did NOT exist until this spec: any test driving the DEPLOYED failure
 * shape through the DEPLOYED path. Every existing recovery spec either walks
 * the BUFFERED chain (useConversation.v5ErrorRecovery.spec.ts stubs the
 * stream unreachable) or hand-builds a clean BoundaryError the schema
 * accepts. The live producer does neither — see the precondition pin below.
 *
 * ── Fixture provenance (bytes, not a paraphrase) ───────────────────────────
 * `fixtures/cee-draft-500-recovery-wire-20260808.json` is the verbatim `body`
 * of a LIVE deployed-staging draft failure captured 2026-08-08T12:30Z
 * (PHASE0-EVIDENCE-2026-07-28/golden-journey-runs/
 * 20260808T123007Z-fresh-extended-32dc39-raw/step-T1_DRAFT.json): SSE
 * `/proxy/v5/turn/stream`, COMPLETE frame `status_code: 500`, measured on
 * 2-of-4 fresh drafts that day. A fixture you wrote yourself is not evidence
 * about the wire (trap 16-inverse); this one is the wire.
 *
 * ── The load-bearing discovery this spec pins ──────────────────────────────
 * The live body FAILS `BoundaryErrorSchema.safeParse` at the pinned schemas
 * (strict object; CEE staging appends `_diagnostic_trace`). So the deployed
 * 500 does NOT ride the boundary_error branch: it is a `parse_error` whose
 * recovery survives ONLY through routeV5Response's `rawBody` passthrough +
 * `extractCeeRecovery`'s duck-typed read of `details.recovery` /
 * `details.recovery_suggestion`. Nothing else covered that chain with this
 * shape — a tidy-up of the passthrough would leave every prior recovery spec
 * green while the deployed body lost its suggestion. The precondition pin
 * makes the branch claim itself fail loud: if a future schemas re-vendor
 * starts ACCEPTING `_diagnostic_trace`, that pin goes red and this file must
 * be re-pointed at whichever branch the live shape then takes (trap 13b —
 * a discriminator must pin its own precondition).
 *
 * ── Mount-path derivation (trap 3b) ────────────────────────────────────────
 * Deployed staging posture: `VITE_FEATURE_AI_PANEL_V2 = "true"`
 * (netlify.toml [build.environment]) AND `flags.ts aiPanelV2.defaultValue:
 * true` → ReactFlowGraph's MaybeConversationProvider mounts the singleton
 * useConversation feeding ConversationPanel → ChatThread → ChatMessage →
 * MessageBubble. These specs bind at useConversation (upstream of BOTH flag
 * postures — the same `messages` array feeds DraftChat/OutputsDock when the
 * flag is off) and the final test renders the hook's ACTUAL output through
 * ChatThread, the surface the deployed flags mount, asserting the DOM.
 *
 * Harness pattern is streamedDraftTurn.spec.ts's: a real ReadableStream
 * through the real streamStageFrames → consumeStreamedDraftTurn →
 * terminalPayloadToResponse → parseV5Response → routeV5Response, with only
 * the network seams mocked.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, render, screen, act, cleanup } from '@testing-library/react'
import { BoundaryErrorSchema, FAILURE_USER_TEXT } from '@talchain/schemas/boundary'

import { useConversation } from '../useConversation'
import { useCanvasStore } from '../../store'
import { useDraftStore } from '../../stores/draftStore'
import { ChatThread } from '../zones/ChatThread'
import type { ConversationMessage } from '../types'
import liveBody from './fixtures/cee-draft-500-recovery-wire-20260808.json'

// ---------------------------------------------------------------------------
// Network seams — the only things mocked (same seams as streamedDraftTurn.spec)
// ---------------------------------------------------------------------------

const mockOpenStream = vi.fn()
const mockCallV5Turn = vi.fn()
const mockStopV5Turn = vi.fn(() => Promise.resolve({ kind: 'not_saved' as const }))

vi.mock('../../../v5/stopTurn', () => ({
  stopV5Turn: (...args: unknown[]) => mockStopV5Turn(...args),
  getV5StopEndpoint: () => 'https://cee.test/proxy/v5/turn/stop',
  STOP_ACK_BUDGET_MS: 5000,
}))

vi.mock('../../../v5/streamedTurnTransport', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../v5/streamedTurnTransport')>()
  return {
    ...actual,
    openV5TurnStream: (...args: unknown[]) => mockOpenStream(...args),
  }
})

vi.mock('../../../v5/v5Adapter', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../v5/v5Adapter')>()
  return {
    ...actual,
    callV5Turn: (...args: unknown[]) => mockCallV5Turn(...args),
    getV5Endpoint: () => 'https://cee.test/proxy/v5/turn',
  }
})

vi.mock('../../../v5/eligibility', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../v5/eligibility')>()
  return { ...actual, isV5Eligible: () => ({ eligible: true }) }
})

vi.mock('../../../lib/supabase', () => ({
  getUserId: async () => null,
  getSessionIdentity: async () => ({ userId: null, accessToken: null }),
}))

vi.mock('../../../services/scenarioService', () => ({ loadScenario: async () => null }))

// ---------------------------------------------------------------------------
// Fixture accessors — every expectation below derives from the CAPTURED bytes,
// never from a string this file's author typed (trap 13c: the producer is the
// oracle).
// ---------------------------------------------------------------------------

type LiveBody = {
  error: string
  retryable: boolean
  details: {
    retryable: boolean
    reason: string
    recovery: { suggestion: string; hints: string[] }
    recovery_suggestion: string
    [k: string]: unknown
  }
  [k: string]: unknown
}
const LIVE = liveBody as unknown as LiveBody
const SUGGESTION = LIVE.details.recovery.suggestion
const HINTS = LIVE.details.recovery.hints
const MACHINE_REASON = LIVE.details.reason // 'draft_graph_cee_graph_invalid'

/** Deep clone so per-test surgery never mutates the shared fixture object. */
function cloneBody(): LiveBody {
  return JSON.parse(JSON.stringify(LIVE)) as LiveBody
}

// ---------------------------------------------------------------------------
// Stream harness (streamedDraftTurn.spec.ts's, reduced to what these tests use)
// ---------------------------------------------------------------------------

function frame(obj: Record<string, unknown>): string {
  return `event: stage\ndata: ${JSON.stringify(obj)}\n\n`
}
const F_DRAFTING = frame({ stage: 'DRAFTING', seq: 0, status: 'in_progress' })
const fComplete500 = (payload: unknown) =>
  frame({ stage: 'COMPLETE', seq: 1, status: 'complete', status_code: 500, payload })

function controllableStream() {
  const encoder = new TextEncoder()
  let ctrl!: ReadableStreamDefaultController<Uint8Array>
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      ctrl = c
    },
  })
  const res = new Response(body, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  })
  const settle = () =>
    act(async () => {
      await new Promise((r) => setTimeout(r, 0))
      await new Promise((r) => setTimeout(r, 0))
    })
  let closed = false
  return {
    response: res,
    async push(text: string) {
      if (!closed) ctrl.enqueue(encoder.encode(text))
      await settle()
    },
    async close() {
      if (!closed) {
        closed = true
        try {
          ctrl.close()
        } catch {
          /* already closed by the consumer's own cancel */
        }
      }
      await settle()
    },
  }
}

const SCENARIO = 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4'
const BRIEF =
  'Should we replace our current CRM with HubSpot next quarter, or keep what we have?'

/**
 * Drive one streamed draft to its COMPLETE(500) terminal frame and return the
 * hook's rendered messages. This is the DEPLOYED failure path end to end:
 * real SSE parse, real consumeStreamedDraftTurn, real parseV5Response, real
 * routeV5Response, real typed_error branch.
 */
async function runStreamedDraft500(payload: unknown): Promise<ConversationMessage[]> {
  const stream = controllableStream()
  mockOpenStream.mockResolvedValue(stream.response)
  const { result } = renderHook(() => useConversation())
  let sent!: Promise<void>
  await act(async () => {
    sent = result.current.sendMessage(BRIEF, { turnType: 'explicit_generate' }) as Promise<void>
  })
  await stream.push(F_DRAFTING + fComplete500(payload))
  await stream.close()
  await act(async () => {
    await sent
  })
  return result.current.messages
}

/**
 * Identity binding (trap 19): the failure bubble is THE synthetic assistant
 * message, bound by role + synthetic provenance — and the tests assert there
 * is exactly one, so no other message can satisfy the predicate.
 */
function theFailureBubble(messages: ConversationMessage[]): ConversationMessage {
  const bubbles = messages.filter((m) => m.role === 'assistant' && m.synthetic === true)
  expect(bubbles).toHaveLength(1)
  return bubbles[0]
}

beforeEach(() => {
  // jsdom does not implement scrollIntoView (ChatThread's smart-scroll calls
  // it on mount) — same stub every other ChatThread spec uses.
  Element.prototype.scrollIntoView = vi.fn()
  mockOpenStream.mockReset()
  mockCallV5Turn.mockReset()
  useDraftStore.getState().resetDraft()
  useCanvasStore.setState({
    currentScenarioId: SCENARIO,
    nodes: [],
    edges: [],
    history: { past: [], future: [] },
    _internal: {
      ...(useCanvasStore.getState() as unknown as { _internal: object })._internal,
      lastHistoryHash: null,
    },
    ceeAnalysisReady: null,
    lastAuthoritativeGraph: null,
    results: { status: 'idle' } as never,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  } as never)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------

describe('precondition pins — what the live body IS, so the branch claim fails loud', () => {
  it('the live 8 Aug body is REJECTED by BoundaryErrorSchema over _diagnostic_trace — the deployed 500 rides the rawBody passthrough, not the boundary_error branch', () => {
    const parsed = BoundaryErrorSchema.safeParse(LIVE)
    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      const unrecognised = parsed.error.issues.filter((i) => i.code === 'unrecognized_keys')
      expect(unrecognised.length).toBeGreaterThan(0)
      expect(
        unrecognised.some((i) => (i as { keys?: string[] }).keys?.includes('_diagnostic_trace')),
      ).toBe(true)
    }
  })

  it('fixture integrity: recovery is present, non-empty, producer-mirrored, and marked retryable at both carriers', () => {
    expect(SUGGESTION.length).toBeGreaterThan(0)
    // The flat mirror is present exactly when the structured object is, and
    // they agree byte for byte (CEE buildCeeErrorResponse contract).
    expect(LIVE.details.recovery_suggestion).toBe(SUGGESTION)
    expect(HINTS).toHaveLength(3)
    for (const h of HINTS) expect(h.length).toBeGreaterThan(0)
    expect(LIVE.retryable).toBe(true)
    expect(LIVE.details.retryable).toBe(true)
    // The reason is a machine code (no whitespace) — the display gate MUST
    // reject it, and the rendering tests below assert it never appears.
    expect(/\s/.test(MACHINE_REASON)).toBe(false)
  })
})

describe('streamed COMPLETE(500) — the deployed failure path, with the deployed bytes', () => {
  it('renders the CEE recovery suggestion byte-identical, the hints beneath it, and an honest retry chip derived from the producer retryable:true', async () => {
    const messages = await runStreamedDraft500(cloneBody())
    const bubble = theFailureBubble(messages)

    // The suggestion — THAT sentence, from the capture, byte-compared.
    expect(bubble.content).toContain(SUGGESTION)
    // Hints render beneath the suggestion as bullets, each byte-identical.
    for (const hint of HINTS) {
      expect(bubble.content).toContain(`• ${hint}`)
    }
    const suggestionAt = bubble.content.indexOf(SUGGESTION)
    const firstHintAt = bubble.content.indexOf(`• ${HINTS[0]}`)
    expect(suggestionAt).toBeGreaterThanOrEqual(0)
    expect(firstHintAt).toBeGreaterThan(suggestionAt)

    // Machine vocabulary never reaches the user.
    expect(bubble.content).not.toContain(MACHINE_REASON)
    expect(bubble.content).not.toContain('INTERNAL_ERROR')
    expect(bubble.content).not.toContain('MISSING_BRIDGE')

    // Retry affordance derived from the PRODUCER's field (retryable:true).
    expect(bubble.actionChips?.some((c) => c.id === 'retry')).toBe(true)

    // A terminal 500 is a terminal answer — it must NOT trigger the buffered
    // fallback (a second send is a second committed turn server-side).
    expect(mockCallV5Turn).not.toHaveBeenCalled()
  })

  it('producer retryable:false withholds the retry affordance — and the copy stops instructing a retry — while the suggestion still renders', async () => {
    const body = cloneBody()
    body.retryable = false
    body.details.retryable = false
    const messages = await runStreamedDraft500(body)
    const bubble = theFailureBubble(messages)

    expect(bubble.content).toContain(SUGGESTION)
    expect(bubble.actionChips?.some((c) => c.id === 'retry')).toBe(false)
    // Copy-agrees-with-affordance: the canonical retry instruction is stripped
    // when the chip is withheld.
    expect(bubble.content).not.toMatch(/Please\s+(?:retry|try\s+again)/i)
  })

  it("a 500 WITHOUT details.recovery renders today's canonical copy EXACTLY — the fallback regression pin", async () => {
    const body = cloneBody()
    delete (body.details as Record<string, unknown>).recovery
    delete (body.details as Record<string, unknown>).recovery_suggestion
    const messages = await runStreamedDraft500(body)
    const bubble = theFailureBubble(messages)

    // Pinned as a literal (captured by running this case at pristine), and
    // cross-checked against the canonical table the code composes from.
    expect(bubble.content).toBe('Something went wrong on our side. Please retry.')
    expect(bubble.content).toBe(FAILURE_USER_TEXT.INTERNAL_ERROR)
    expect(bubble.content).not.toContain(SUGGESTION)
    // details.retryable:true still honoured on the recovery-less shape.
    expect(bubble.actionChips?.some((c) => c.id === 'retry')).toBe(true)
  })

  it("an older minimal error shape ({ error: 'INTERNAL_ERROR' }) renders exactly today's behaviour — zero regression on pre-recovery producers", async () => {
    const messages = await runStreamedDraft500({ error: 'INTERNAL_ERROR' })
    const bubble = theFailureBubble(messages)

    expect(bubble.content).toBe('Something went wrong on our side. Please retry.')
    expect(bubble.content).toBe(FAILURE_USER_TEXT.INTERNAL_ERROR)
    // No envelope marker → client table resolves INTERNAL_ERROR retryable.
    expect(bubble.actionChips?.some((c) => c.id === 'retry')).toBe(true)
  })
})

describe('mount surface (trap 3b) — the hook output renders through ChatThread, the surface aiPanelV2=ON mounts', () => {
  it('the failure bubble the hook produced reaches the DOM with its suggestion, hints and retry chip', async () => {
    const messages = await runStreamedDraft500(cloneBody())
    // Sanity: the bubble exists before we hand the array to the surface.
    theFailureBubble(messages)

    render(
      <ChatThread
        messages={messages}
        isThinking={false}
        longRunningHint={null}
        nodeCount={0}
        patchBlockStates={new Map()}
        patchRejections={new Map()}
        onChipClick={async () => {}}
        onPatchAccept={() => {}}
        onPatchDismiss={() => {}}
        onFeedback={() => {}}
        onRetry={() => {}}
      />,
    )

    // The DOM does NOT carry the sentence byte-identical BY DESIGN:
    // `safeRichText` applies the DS house-style dash substitution (em dash →
    // ' - ') and renders '• ' bullets as <ul><li> (glyph stripped). Byte
    // identity of the producer copy is pinned at the HOOK level above; here
    // the binding is the fixture-derived byte-runs AROUND the dash — split on
    // the em dash by the fixture's own bytes, never typed by this file.
    const dashSegments = SUGGESTION.split(/\s*—\s*/)
    expect(dashSegments.length).toBeGreaterThan(1) // precondition: the pin is not vacuous
    const assistantBubbles = screen.getAllByTestId('message-assistant')
    const withSuggestion = assistantBubbles.filter((el) =>
      dashSegments.every((seg) => (el.textContent ?? '').includes(seg)),
    )
    expect(withSuggestion).toHaveLength(1)
    for (const hint of HINTS) {
      expect(withSuggestion[0].textContent).toContain(hint)
    }
    // The `retry` CHIP is deliberately NOT rendered by this surface — a
    // documented product decision (chipDispatch.ts RENDERABLE_LOCAL_CHIP_IDS
    // excludes RETRY_CHIP_ID: every failure bubble already carries
    // MessageActions' hover Retry, wired to the same retryLast). Pinned here
    // so a future flip of that decision fails this spec loud and the mount
    // claim gets re-derived rather than silently drifting.
    expect(screen.queryByTestId('suggested-chip-retry')).toBeNull()
    // The retry affordance the surface ACTUALLY provides on the failure
    // bubble: MessageActions' Retry (hover/focus action bar, aria-label).
    const wrapper = withSuggestion[0].closest('[data-testid="chat-message-assistant"]')
    expect(wrapper).not.toBeNull()
    expect(
      Array.from(wrapper!.querySelectorAll('button')).some(
        (b) => b.getAttribute('aria-label') === 'Retry',
      ),
    ).toBe(true)
  })
})

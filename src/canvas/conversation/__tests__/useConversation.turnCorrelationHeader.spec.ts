/**
 * HOP ZERO — the browser is now the ORIGIN of the turn's correlation id.
 *
 * ── THE DEFECT ────────────────────────────────────────────────────────────
 * The estate propagates one id across CEE → PLoT → ISL, but the browser sent
 * none, so `getOrGenerateRequestId` MINTED it inside CEE. Anything that died
 * before CEE — the Netlify edge, a CORS refusal, a network drop — had no id
 * anywhere in the estate, and no browser-side event could ever be joined to a
 * server log line.
 *
 * ── WHY THIS SUITE DRIVES THE V5 PATH AND NOT `turnService` ───────────────
 * `turnService.ts` is the V4 client and is DEAD on staging: its two exports are
 * called only from the `useConversation.ts` block that is reachable ONLY when
 * `VITE_ENABLE_V5_ORCHESTRATOR !== 'true'`, and staging bakes it `'true'`.
 * `netlify/edge-functions/orchestrator-proxy.ts` says so in its own dated
 * header ("The live product does not use this seam. The V5 turn path posts to
 * the baked-absolute https://cee-staging.onrender.com/proxy/v5/turn") and backs
 * it with an emptied `ALLOWED_TARGETS`, so `/bff/orchestrate/*` 404s every path.
 * A pin written against `turnService` would be green forever about code no user
 * loads — CLAUDE.md trap 3b.
 *
 * ── WHAT MAKES THIS "ONE ID PER SEND" RATHER THAN "ONE PER FETCH" ────────
 * A single send can issue THREE HTTP calls: the streamed draft
 * (`openV5TurnStream`), its buffered fallback (`callV5Turn`), and the
 * non-streamed turn (`callV5Turn`). All three are handed the SAME `v5Headers`
 * object, built ONCE per send. The per-fetch shape this deliberately avoids is
 * `adapters/cee/client.ts:636`, which mints inside `fetchWithBase` — a turn
 * making three calls there gets three ids and correlates nothing.
 *
 * ── WHY THE ID IS NOT THE BODY `turn_id`, AND WHY THAT IS SAFETY-CRITICAL ─
 * CEE has no trace-only id. `getOrGenerateRequestId` feeds `context.request_id`,
 * and 29 commit sites in `orchestrator-v5/turn-executor.ts` pass
 * `turn_id: context.request_id` into an append RPC keyed
 * `INSERT … ON CONFLICT (scenario_id, turn_id) DO NOTHING`. So whatever the
 * browser sends in this header BECOMES a commit key.
 *
 * `turnClientId` is REUSED on purpose — `retryLast` re-sends with the same
 * `client_turn_id` and its own comment says it relies on CEE keying the commit
 * on a per-request id so that "a retry writes a SECOND turn row". Sending it
 * would make the retry conflict, skip the row AND the graph write, and still
 * report success (`commit.ts:1606` derives `graphPersisted` from whether a write
 * was INTENDED). That is a silent divergence between response and durable state
 * on the recovery path — worse than the untraced request this lane fixes.
 *
 * ── THE DISCRIMINATING SET ───────────────────────────────────────────────
 * No case says merely "a UUID was sent".
 *   1. every egress of one send carries a well-formed id      (presence)
 *   2. the stream and its fallback carry the SAME id          (defeats per-fetch)
 *   3. a RETRY — which reuses `turn_id` — carries a DIFFERENT id, and never the
 *      reused `turn_id`                                        (the safety pin)
 *   4. the header is ADDED to the auth headers, not substituted
 * Case 2 alone is satisfied by a module-level constant; case 3 alone is
 * satisfied by a per-fetch mint. Only the PAIR proves per-send scope.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderHook, act } from '@testing-library/react'

import { useConversation } from '../useConversation'
import { useCanvasStore } from '../../store'
import { useResultsStore } from '../../stores/resultsStore'
import { REQUEST_ID_HEADER, SAFE_REQUEST_ID_PATTERN } from '../../../types/requestId'

// ---------------------------------------------------------------------------
// Mocks — the network egress and the auth/scenario bridges ONLY. Everything
// between `sendMessage` and the transport (buildV5Payload, the turn-id mint,
// the header composition) is REAL; mocking any of it would rebuild the vacuity
// this suite exists to close.
// ---------------------------------------------------------------------------

const mockCallTurn = vi.fn()
const mockStreamTurn = vi.fn()

vi.mock('../turnService', () => ({
  callOrchestratorTurn: (...args: unknown[]) => mockCallTurn(...args),
  streamOrchestratorTurn: (...args: unknown[]) => mockStreamTurn(...args),
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

const mockCallV5Turn = vi.fn()
// `importOriginal`-spread, never a bare factory (trap 12): a bare factory
// REPLACES the module and every export added since — `__internals` among them —
// silently vanishes.
vi.mock('../../../v5/v5Adapter', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../v5/v5Adapter')>()
  return {
    ...actual,
    callV5Turn: (...args: unknown[]) => mockCallV5Turn(...args),
    getV5Endpoint: () => 'https://cee.test/proxy/v5/turn',
  }
})

/**
 * The streamed sibling RECORDS its headers and THEN refuses.
 *
 * The refusal is what triggers the buffered fallback, which is the second HTTP
 * call of the same turn. Recording BEFORE throwing is the whole point: a mock
 * that only threw (the construction other suites use) would make case 2
 * impossible to write, because the stream's headers would never be observed.
 */
const mockOpenStream = vi.fn()
vi.mock('../../../v5/streamedTurnTransport', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../v5/streamedTurnTransport')>()
  return {
    ...actual,
    openV5TurnStream: (...args: unknown[]) => mockOpenStream(...args),
  }
})

vi.mock('../../../v5/eligibility', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../v5/eligibility')>()
  const flags = await import('../../../flags')
  return {
    ...actual,
    isV5Eligible: () => ({ eligible: true as const }),
    isV5CanonicalRunPath: () => flags.isV5CanonicalAnalysisEnabled(),
  }
})

const mockGetUserId = vi.fn<[], Promise<string | null>>()
vi.mock('../../../lib/supabase', () => ({
  getUserId: (...args: unknown[]) => mockGetUserId(...(args as [])),
  getSessionIdentity: async () => ({
    userId: (await mockGetUserId()) ?? null,
    accessToken: null,
  }),
}))

const mockLoadScenario = vi.fn<[string], Promise<unknown>>()
vi.mock('../../../services/scenarioService', () => ({
  loadScenario: (...args: unknown[]) => mockLoadScenario(...(args as [string])),
}))

// ---------------------------------------------------------------------------
// Fixtures + observation helpers
// ---------------------------------------------------------------------------

const SCENARIO_ID = 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4'

const makeV5SuccessResult = (text = 'OK') => ({
  kind: 'response' as const,
  response: {
    response_version: 2,
    assistant_text: text,
    blocks: [] as unknown[],
    suggested_actions: [] as unknown[],
    insights: [] as unknown[],
    stage_indicator: 'frame',
  },
})

type Egress = { payload: { turn_id?: string }; headers: Record<string, string> }

/** Every V5 egress observed, in call order, whichever transport issued it. */
function egressCalls(mock: ReturnType<typeof vi.fn>): Egress[] {
  return mock.mock.calls.map((c) => ({
    payload: (c[0] ?? {}) as { turn_id?: string },
    headers: ((c[1] as { headers?: Record<string, string> })?.headers ?? {}) as Record<string, string>,
  }))
}

// ---------------------------------------------------------------------------

/**
 * ── SOURCE-SHAPE GUARD ────────────────────────────────────────────────────
 * The behavioural cases below mock the transport, so they prove the header is
 * composed and threaded. They do NOT prove WHERE it is composed — and the
 * failure mode this guard exists for is structural, not behavioural.
 *
 * #933 deleted the V4 orchestration path and de-indented this entire block by
 * one level. A rebase across a change of that shape can drop the two-line
 * spread while leaving `import { buildRequestIdHeaders } …` at the top of the
 * file perfectly intact — and an import is not a call. Source review can miss
 * it inside a 300 KB structural diff.
 *
 * ⚠ A BUNDLE GREP CANNOT SUBSTITUTE FOR THIS, and the reason is worth keeping:
 * `'X-Request-Id'` already ships from `hooks/useAsk.ts`, so grepping the built
 * output for the header name reads NON-ZERO whether or not this call site
 * survives. It is a presence probe whose failure mode is a false positive —
 * guarantee theatre wearing the costume of the check meant to prevent it.
 *
 * This binds the call to the INITIALISER, which is the thing that actually has
 * to be true. It goes red under the same mutant that kills the behavioural
 * cases (delete the spread, keep the import), which is what shows it bites.
 */
describe('source shape — the call site itself, not merely the import', () => {
  const sourcePath = resolve(process.cwd(), 'src/canvas/conversation/useConversation.ts')
  const source = readFileSync(sourcePath, 'utf8')

  it('read the real module (positive control — an empty read would make every regex below vacuously false)', () => {
    // trap 13: a probe asserting a PRESENCE must first be shown able to see
    // one. A silently-empty read would turn the two structural cases into
    // failures for the wrong reason, and a silently-truncated one into a pass.
    expect(source.length).toBeGreaterThan(100_000)
    expect(source).toContain('export function useConversation')
  })

  it('calls buildRequestIdHeaders INSIDE the v5Headers initialiser', () => {
    // Whitespace- and indent-tolerant on purpose: the indent is exactly what a
    // structural rebase changes, so pinning it would make this guard fail for
    // the one reason that is harmless.
    const initialiser =
      /const\s+v5Headers\s*:\s*Record<string,\s*string>\s*=\s*\{[^}]*buildRequestIdHeaders\s*\(/
    expect(initialiser.test(source)).toBe(true)
  })

  it('composes rather than replaces — the auth builder stays in the same initialiser', () => {
    const both =
      /const\s+v5Headers\s*:\s*Record<string,\s*string>\s*=\s*\{[^}]*buildTurnAuthHeaders\s*\([^}]*buildRequestIdHeaders\s*\(/
    expect(both.test(source)).toBe(true)
  })

  it('the import alone does NOT satisfy the guard (proves the guard is not vacuous)', () => {
    // Pin the precondition in-test: the import IS present. So if the two cases
    // above ever passed on the strength of the import, this would be the tell.
    // Constructed here rather than asserted about the real file: a variant with
    // the import kept and the call site severed must FAIL the same regex.
    const severed = source.replace(
      /(const\s+v5Headers\s*:\s*Record<string,\s*string>\s*=\s*)\{[\s\S]*?\}/,
      '$1buildTurnAuthHeaders(v5Identity)',
    )
    expect(severed).toContain("import { buildRequestIdHeaders, generateRequestId }")
    const initialiser =
      /const\s+v5Headers\s*:\s*Record<string,\s*string>\s*=\s*\{[^}]*buildRequestIdHeaders\s*\(/
    expect(initialiser.test(severed)).toBe(false)
  })
})

describe('the turn correlation id leaves the browser on the LIVE V5 path', () => {
  beforeEach(() => {
    mockCallTurn.mockReset()
    mockStreamTurn.mockReset()
    mockCallV5Turn.mockReset()
    mockCallV5Turn.mockResolvedValue(makeV5SuccessResult())
    mockOpenStream.mockReset()
    mockGetUserId.mockReset()
    mockGetUserId.mockResolvedValue(null)
    mockLoadScenario.mockReset()
    mockLoadScenario.mockResolvedValue(null)

    useResultsStore.setState({
      results: { status: 'idle', progress: 0, analysisSummary: undefined, lastSnapshotId: undefined },
    } as never)

    useCanvasStore.getState().resetCanvas()
    useCanvasStore.setState({ currentScenarioId: SCENARIO_ID, nodes: [], edges: [] })
  })

  it('a buffered turn carries a well-formed X-Request-Id', async () => {
    // A non-empty canvas makes the turn streamed-INELIGIBLE
    // (`streamedDraftEligible` requires nodeCountAtDispatch === 0), so this is
    // the single-fetch shape.
    useCanvasStore.setState({
      nodes: [{ id: 'n1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Existing' } }] as never,
    })
    mockOpenStream.mockRejectedValue(new Error('stream must not be used on an ineligible turn'))

    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.sendMessage('Should we expand into Germany?')
    })

    const calls = egressCalls(mockCallV5Turn)
    // Pin the precondition in-test (trap 13b): exactly one egress. Without it a
    // suite that sent zero turns would fall through to a vacuous pass.
    expect(calls).toHaveLength(1)
    expect(mockOpenStream).not.toHaveBeenCalled()

    const [only] = calls
    const sent = only.headers[REQUEST_ID_HEADER]
    // SafeRequestId, asserted with CEE's OWN predicate. A value CEE rejects
    // would be silently replaced there and the trace would still be broken, so
    // "a header exists" is not the claim — "a header CEE will HONOUR" is.
    expect(sent).toBeTruthy()
    expect(SAFE_REQUEST_ID_PATTERN.test(sent)).toBe(true)
  })

  it('ONE id spans a send\'s TWO HTTP calls — a per-fetch mint cannot pass this', async () => {
    // Empty canvas + a frame-stage conversation turn ⇒ streamed-draft eligible.
    // The stream records its headers, then refuses, which routes the SAME send
    // to the buffered fallback: one user turn, two HTTP calls.
    mockOpenStream.mockImplementation(async () => {
      throw new TypeError('Failed to fetch')
    })

    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.sendMessage('Should we expand our coffee subscription into Germany or the UAE?')
    })

    const streamCalls = egressCalls(mockOpenStream)
    const bufferedCalls = egressCalls(mockCallV5Turn)

    // Preconditions pinned: the two-call shape this case is ABOUT actually
    // occurred. If the stream stopped being eligible, or the fallback stopped
    // firing, this fails HERE rather than letting the equality below pass by
    // comparing one call to itself.
    expect(streamCalls).toHaveLength(1)
    expect(bufferedCalls).toHaveLength(1)

    const streamed = streamCalls[0].headers[REQUEST_ID_HEADER]
    const buffered = bufferedCalls[0].headers[REQUEST_ID_HEADER]

    expect(streamed).toBeTruthy()
    // The assertion a per-fetch generator fails: it would give two well-formed,
    // self-consistent ids that do not correlate.
    expect(streamed).toBe(buffered)
  })

  it('a RETRY gets a DIFFERENT id — and never the reused turn_id (the commit-key safety pin)', async () => {
    // `retryLast` re-sends with the SAME `client_turn_id`, deliberately. CEE
    // turns this header into `context.request_id` and 29 commit sites use that
    // as `turn_id` in `ON CONFLICT (scenario_id, turn_id) DO NOTHING`. Had we
    // sent the reused turn id, the retry's row AND its graph write would be
    // silently skipped while CEE still reported success.
    //
    // This case is what makes case 2 non-trivial: a module-level constant, or
    // any id derived from the turn id, passes case 2 and FAILS here.
    useCanvasStore.setState({
      nodes: [{ id: 'n1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Existing' } }] as never,
    })
    mockOpenStream.mockRejectedValue(new Error('stream must not be used on an ineligible turn'))

    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.sendMessage('Should we expand into Germany?')
    })
    await act(async () => {
      await result.current.retryLast()
    })

    const calls = egressCalls(mockCallV5Turn)
    // Precondition: the retry actually re-sent. Without this the inequality
    // below could pass on a single call by comparing nothing.
    expect(calls).toHaveLength(2)
    const [first, retry] = calls

    // Precondition, and the whole reason this case exists: the retry really
    // does reuse the turn id. If that ever stopped being true this pin would
    // silently stop testing the hazard it was written for.
    expect(retry.payload.turn_id).toBe(first.payload.turn_id)

    const firstId = first.headers[REQUEST_ID_HEADER]
    const retryId = retry.headers[REQUEST_ID_HEADER]
    expect(firstId).toBeTruthy()
    expect(retryId).toBeTruthy()
    expect(retryId).not.toBe(firstId)
    // Bound by identity to the value that must NOT be sent.
    expect(retryId).not.toBe(retry.payload.turn_id)
    expect(firstId).not.toBe(first.payload.turn_id)
  })

  it('the correlation header is ADDED to the auth headers, not substituted for them', async () => {
    // Without this, a mutant that REPLACED `v5Headers` with just the
    // correlation header would pass every other case in this file while
    // silently dropping identity from every turn.
    mockGetUserId.mockResolvedValue('user-abc-123')
    useCanvasStore.setState({
      nodes: [{ id: 'n1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Existing' } }] as never,
    })
    mockOpenStream.mockRejectedValue(new Error('stream must not be used on an ineligible turn'))

    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.sendMessage('Another brief')
    })

    const calls = egressCalls(mockCallV5Turn)
    expect(calls).toHaveLength(1)
    const [only] = calls
    expect(only.headers['X-User-Id']).toBe('user-abc-123')
    expect(only.headers[REQUEST_ID_HEADER]).toBeTruthy()
  })
})

/**
 * ROADMAP 1.42 — Show-reasoning progressive disclosure (Paul ruled
 * VERBATIM-with-label).
 *
 * Verifies the addMessage success-site sidecar extraction in
 * useConversation.ts:
 *  - CEE's `_reasoning` additive-extension sidecar (attached by
 *    responseParser's splitAdditiveExtensions under ADDITIVE_EXTENSIONS_KEY)
 *    is read into `message.reasoning` when the flag is on
 *  - reasoning NEVER lands in `message.content` (that field only ever
 *    carries `assistant_text` — content feeds extractFromRawJson/truncation
 *    in MessageBubble, which reasoning must bypass)
 *  - absent sidecar / absent `_reasoning` → `message.reasoning` stays undefined
 *  - flag off → sidecar is never read, `message.reasoning` stays undefined
 *    even when CEE sent `_reasoning`
 *  - non-string / empty-string `_reasoning` is rejected defensively
 *  - an oversized `_reasoning` is capped with a disclosed truncation suffix
 *
 * Mirrors the mocking harness in useConversation.hook.spec.ts (turnService,
 * v5Adapter, supabase, scenarioService) trimmed to only what the V5
 * happy-path (`sendMessage` → `callV5Turn` → `routeV5Response` → `addMessage`)
 * needs to resolve deterministically.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useConversation } from '../useConversation'
import { useCanvasStore } from '../../store'
import { useResultsStore } from '../../stores/resultsStore'
import { ADDITIVE_EXTENSIONS_KEY } from '../../../v5/responseParser'

// ---------------------------------------------------------------------------
// Mocks
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
vi.mock('../../../v5/v5Adapter', () => ({
  callV5Turn: (...args: unknown[]) => mockCallV5Turn(...args),
  getV5Endpoint: () => 'https://cee.test/orchestrate/v2/turn',
}))

// Force the V5-eligibility gate on, independent of VITE_ENABLE_V5_ORCHESTRATOR.
// sendMessage's V5 routing (useConversation.ts) reads
// import.meta.env.VITE_ENABLE_V5_ORCHESTRATOR directly and passes it through
// isV5Eligible — Vite's loadEnv pulls that var in from the developer's
// untracked .env.local, so this suite silently depended on a machine-local
// file (passes when .env.local sets VITE_ENABLE_V5_ORCHESTRATOR=true, fails
// on a clean checkout where the flag is undefined and sendMessage takes the
// V4 path instead, so mockCallV5Turn is never invoked). Mocking the gate
// itself makes the suite self-contained.
vi.mock('../../../v5/eligibility', () => ({
  isV5Eligible: () => ({ eligible: true as const }),
}))

const mockGetUserId = vi.fn<[], Promise<string | null>>()
vi.mock('../../../lib/supabase', () => ({
  getUserId: (...args: unknown[]) => mockGetUserId(...(args as [])),
  // Login 3.4: see useConversation.hook.spec.ts — same mock bridge.
  getSessionIdentity: async () => ({
    userId: (await mockGetUserId()) ?? null,
    accessToken: null,
  }),
}))

const mockLoadScenario = vi.fn<[string], Promise<unknown>>()
vi.mock('../../../services/scenarioService', () => ({
  loadScenario: (...args: unknown[]) => mockLoadScenario(...(args as [string])),
}))

// Flag control: reasoningDisclosure toggled per-test; streaming/orchestratorV2
// pinned like the sibling hook spec so sendMessage resolves deterministically.
let mockReasoningDisclosureEnabled = true
vi.mock('../../../flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../flags')>()
  return {
    ...actual,
    isOrchestratorStreamingEnabled: () => true,
    isOrchestratorV2Enabled: () => true,
    isReasoningDisclosureEnabled: () => mockReasoningDisclosureEnabled,
  }
})

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/**
 * A minimal V5 "response" call-result. When `reasoning` is provided, it is
 * attached under ADDITIVE_EXTENSIONS_KEY exactly as the real parser's
 * splitAdditiveExtensions does (responseParser.ts:657-697) — proving the
 * useConversation extraction reads the sidecar, not the strict surface.
 */
function makeV5Result(opts: { text?: string; reasoning?: unknown; noSidecar?: boolean } = {}) {
  const { text = 'The answer is 42.', reasoning, noSidecar = false } = opts
  const response: Record<string, unknown> = {
    response_version: 2,
    assistant_text: text,
    blocks: [] as unknown[],
    suggested_actions: [] as unknown[],
    insights: [] as unknown[],
    stage_indicator: 'frame',
  }
  if (!noSidecar && reasoning !== undefined) {
    response[ADDITIVE_EXTENSIONS_KEY] = { _reasoning: reasoning }
  }
  return { kind: 'response' as const, response }
}

beforeEach(() => {
  mockReasoningDisclosureEnabled = true
  mockCallTurn.mockReset()
  mockStreamTurn.mockReset()
  mockCallV5Turn.mockReset()
  mockGetUserId.mockReset()
  mockGetUserId.mockResolvedValue(null)
  mockLoadScenario.mockReset()
  mockLoadScenario.mockResolvedValue(null)

  useResultsStore.setState({
    results: {
      status: 'idle',
      progress: 0,
      analysisSummary: undefined,
      lastSnapshotId: undefined,
    },
  } as any)

  useCanvasStore.setState({
    currentScenarioId: 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4',
    nodes: [],
    edges: [],
    results: { status: 'idle' } as any,
    currentScenarioLastResultHash: null,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  })
})

afterEach(() => {
  vi.useRealTimers()
})

function lastAssistantMessage(messages: ReturnType<typeof useConversation>['messages']) {
  return [...messages].reverse().find((m) => m.role === 'assistant')
}

describe('useConversation — reasoning sidecar extraction (ROADMAP 1.42)', () => {
  it('reads _reasoning from the additive sidecar into message.reasoning when the flag is on', async () => {
    mockCallV5Turn.mockResolvedValue(
      makeV5Result({ text: 'Here is my answer.', reasoning: 'Because X implies Y, and Y implies Z.' }),
    )

    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.sendMessage('question')
    })

    const msg = lastAssistantMessage(result.current.messages)
    expect(msg).toBeDefined()
    expect(msg!.reasoning).toBe('Because X implies Y, and Y implies Z.')
  })

  it('0.15.0: reads the FORMALISED top-level reasoning field (no sidecar needed)', async () => {
    const result5 = makeV5Result({ text: 'Answer.' })
    ;(result5.response as Record<string, unknown>).reasoning = 'Formal field reasoning.'
    mockCallV5Turn.mockResolvedValue(result5)

    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.sendMessage('question')
    })
    expect(lastAssistantMessage(result.current.messages)!.reasoning).toBe(
      'Formal field reasoning.',
    )
  })

  it('0.15.0: prefers the formal field over the legacy _reasoning sidecar when both arrive', async () => {
    const result5 = makeV5Result({ text: 'Answer.', reasoning: 'legacy sidecar value' })
    ;(result5.response as Record<string, unknown>).reasoning = 'formal wins'
    mockCallV5Turn.mockResolvedValue(result5)

    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.sendMessage('question')
    })
    expect(lastAssistantMessage(result.current.messages)!.reasoning).toBe('formal wins')
  })

  it('never places reasoning content into message.content', async () => {
    const reasoning = 'SECRET_REASONING_TOKEN should never leak into content'
    mockCallV5Turn.mockResolvedValue(
      makeV5Result({ text: 'Here is my answer.', reasoning }),
    )

    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.sendMessage('question')
    })

    const msg = lastAssistantMessage(result.current.messages)
    expect(msg!.content).toBe('Here is my answer.')
    expect(msg!.content).not.toContain('SECRET_REASONING_TOKEN')
  })

  it('leaves message.reasoning undefined when CEE sends no sidecar at all', async () => {
    mockCallV5Turn.mockResolvedValue(makeV5Result({ text: 'Plain answer, no reasoning.' }))

    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.sendMessage('question')
    })

    const msg = lastAssistantMessage(result.current.messages)
    expect(msg!.reasoning).toBeUndefined()
  })

  it('leaves message.reasoning undefined when the sidecar carries other additive keys but not _reasoning', async () => {
    mockCallV5Turn.mockResolvedValue({
      kind: 'response' as const,
      response: {
        response_version: 2,
        assistant_text: 'Answer.',
        blocks: [],
        suggested_actions: [],
        insights: [],
        stage_indicator: 'frame',
        [ADDITIVE_EXTENSIONS_KEY]: { some_other_extension: 'value' },
      },
    })

    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.sendMessage('question')
    })

    const msg = lastAssistantMessage(result.current.messages)
    expect(msg!.reasoning).toBeUndefined()
  })

  it('rejects a non-string _reasoning value defensively', async () => {
    mockCallV5Turn.mockResolvedValue(
      makeV5Result({ text: 'Answer.', reasoning: { not: 'a string' } }),
    )

    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.sendMessage('question')
    })

    const msg = lastAssistantMessage(result.current.messages)
    expect(msg!.reasoning).toBeUndefined()
  })

  it('rejects an empty/whitespace-only _reasoning value', async () => {
    mockCallV5Turn.mockResolvedValue(
      makeV5Result({ text: 'Answer.', reasoning: '   \n  ' }),
    )

    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.sendMessage('question')
    })

    const msg = lastAssistantMessage(result.current.messages)
    expect(msg!.reasoning).toBeUndefined()
  })

  it('caps an oversized _reasoning at 20000 chars with a disclosed truncation suffix', async () => {
    const huge = 'A'.repeat(25_000)
    mockCallV5Turn.mockResolvedValue(makeV5Result({ text: 'Answer.', reasoning: huge }))

    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.sendMessage('question')
    })

    const msg = lastAssistantMessage(result.current.messages)
    expect(msg!.reasoning).toBeDefined()
    expect(msg!.reasoning!.length).toBeLessThan(huge.length)
    expect(msg!.reasoning).toContain('[reasoning truncated]')
    expect(msg!.reasoning!.startsWith('A'.repeat(100))).toBe(true)
  })

  it('does not attach reasoning when the flag is off, even though CEE sent it', async () => {
    mockReasoningDisclosureEnabled = false
    mockCallV5Turn.mockResolvedValue(
      makeV5Result({ text: 'Answer.', reasoning: 'Because X implies Y.' }),
    )

    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.sendMessage('question')
    })

    const msg = lastAssistantMessage(result.current.messages)
    expect(msg!.reasoning).toBeUndefined()
    // Content is unaffected by the flag either way.
    expect(msg!.content).toBe('Answer.')
  })
})

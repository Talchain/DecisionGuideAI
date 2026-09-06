/**
 * The draft turn records the user's brief for the decision it drafted — driven
 * through the REAL `sendTurn`, not by seeding the store.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE DEFECT (witnessed on deployed UI `127bdee7`, 6 Sep 2026, fresh guest)
 * ═══════════════════════════════════════════════════════════════════════════
 * A 279-character brief was typed, a model drafted and a provisional analysis
 * delivered — and the decision node still read "Question" with no brief block,
 * because `contextIntegrityStore` had only one writer, the cold read, which
 * answers `absent` for a scenario that fresh. A page reload hydrated the store
 * and the node then carried the full brief on `title`. So the anchor brief that
 * #1229 shipped was reachable ONLY after a reload.
 *
 * The component spec (`DecisionNode.anchorBrief.spec.tsx`) seeds the store by
 * hand and so could not see this: it proves store → node, and this file proves
 * the half that was missing, draft turn → store, against the live hook.
 *
 * ── WHAT IS MOCKED, AND WHAT IS NOT ────────────────────────────────────────
 * Only the two network calls are mocked (the streamed transport and the buffered
 * adapter). The scenario id is minted by the real `sendTurn`, the response is
 * fenced by the real `responseBelongsToDispatchingScenario`, the graph is
 * applied by the real `applyDraftResult`, and the store is the real
 * `useContextIntegrityStore`. The assertions bind to the MINTED id, never to a
 * value another decision's record could satisfy (CLAUDE.md trap 19).
 *
 * ── THE NEGATIVE CASES ARE THE LOAD-BEARING ONES ───────────────────────────
 * A record that displaced the cold read's copy would drop the manifest; a
 * record written for a hidden turn would put machine text under "What you gave
 * me"; a record keyed on the previous scenario would be the P0 this store's
 * header describes. Each is pinned below, each with its precondition asserted
 * in-test so a fixture that stopped reaching the seam cannot pass it vacuously
 * (CLAUDE.md trap 13b).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'

import { useConversation } from '../useConversation'
import { useCanvasStore } from '../../store'
import { useDraftStore } from '../../stores/draftStore'
import { useContextIntegrityStore } from '../../stores/contextIntegrityStore'
import { DecisionNode } from '../../nodes/DecisionNode'
import wireFixture from './fixtures/cee-draft-goal-constraints-wire.json'

const mockOpenStream = vi.fn()
const mockCallV5Turn = vi.fn()

vi.mock('../../../v5/streamedTurnTransport', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../v5/streamedTurnTransport')>()
  return { ...actual, openV5TurnStream: (...args: unknown[]) => mockOpenStream(...args) }
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

// The node render below needs the same three seams the component spec mocks:
// React Flow handles, the popover shell, and the display-metadata hook.
vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})
vi.mock('../../nodes/shared/NodePopover', () => ({
  NodePopover: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="decision-node-popover">{children}</div>
  ),
}))
vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null, influence: null, confidence: null,
    inSensitivityAnalysis: false, achievementProbability: null,
    stabilityPercentage: null, winRate: null, isResultsMode: false,
    predictedOutcome: null, valueOfInformation: null, voiRank: null,
  })),
}))

const TERMINAL_BODY = wireFixture as unknown as Record<string, unknown>
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const BRIEF =
  'Should we open a second engineering hub in Lisbon next year, or keep hiring remotely ' +
  'across Europe? We need to grow the platform team by twenty engineers within twelve ' +
  'months without raising cost per engineer above £95k.'
const PREVIOUS_SCENARIO = 'f2b0c1a4-0000-4000-8000-000000000001'
const PREVIOUS_BRIEF = 'Should we hire a tech lead or two developers, on a budget of £180k?'

function frame(obj: Record<string, unknown>): string {
  return `event: stage\ndata: ${JSON.stringify(obj)}\n\n`
}

/** A complete stream, pre-enqueued: DRAFTING then COMPLETE carrying the terminal body. */
function completedStream(): Response {
  const text =
    frame({ stage: 'DRAFTING', seq: 0, status: 'in_progress' }) +
    frame({ stage: 'COMPLETE', seq: 4, status: 'complete', status_code: 200, payload: TERMINAL_BODY })
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(new TextEncoder().encode(text))
      c.close()
    },
  })
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } })
}

function resetCanvasToNoDecision() {
  useCanvasStore.setState({
    currentScenarioId: null,
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
}

async function sendBrief(text: string, opts: { hidden?: boolean } = {}) {
  mockOpenStream.mockResolvedValue(completedStream())
  const { result } = renderHook(() => useConversation())
  await act(async () => {
    await (result.current.sendMessage(text, {
      turnType: 'explicit_generate',
      ...(opts.hidden ? { hidden: true } : {}),
    }) as Promise<void>)
  })
}

/** The seam actually ran: a graph landed and a real id was minted. Asserted, not assumed. */
function assertDraftLanded() {
  const canvas = useCanvasStore.getState()
  expect(canvas.nodes.length).toBeGreaterThan(0)
  expect(String(canvas.currentScenarioId)).toMatch(UUID_RE)
  return canvas.currentScenarioId as string
}

beforeEach(() => {
  mockOpenStream.mockReset()
  mockCallV5Turn.mockReset()
  useDraftStore.getState().resetDraft()
  useContextIntegrityStore.getState().reset()
  resetCanvasToNoDecision()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('the draft turn records the brief for the decision it drafted', () => {
  it('a fresh brief is recorded under the MINTED scenario id, with no manifest', async () => {
    // Precondition: nothing recorded, no decision open.
    expect(useContextIntegrityStore.getState().scenarioId).toBeNull()
    expect(useCanvasStore.getState().currentScenarioId).toBeNull()

    await sendBrief(BRIEF)
    const minted = assertDraftLanded()

    const recorded = useContextIntegrityStore.getState()
    expect(recorded.scenarioId).toBe(minted)
    expect(recorded.briefText).toBe(BRIEF)
    // The manifest only ever arrives on the cold read. Told nothing = null.
    expect(recorded.manifest).toBeNull()
  })

  it('…and the anchor node then carries that brief, full text on `title` (draft → store → node)', async () => {
    await sendBrief(BRIEF)
    assertDraftLanded()
    const canvas = useCanvasStore.getState()
    const decision = canvas.nodes.find((n) => n.type === 'decision')
    expect(decision).toBeDefined()

    // The brief displaces only the CONTENT-FREE resting lines (#1229's rule),
    // and straight after a draft the card carries a `Top gap:` triage headline
    // instead — measured, not assumed: without the run below the block is
    // absent. A completed run puts the card on `completedRunLine`, which is
    // the state the deployed witness was taken in (a provisional analysis had
    // delivered itself within the first minute).
    expect(screen.queryByTestId('decision-node-brief')).toBeNull()
    const options = canvas.nodes.filter((n) => n.type === 'option').map((n) => n.id)
    expect(options.length).toBeGreaterThan(0)
    useCanvasStore.setState({
      results: {
        status: 'complete',
        report: {
          option_probabilities: Object.fromEntries(
            options.map((id, i) => [id, { win_probability: i === 0 ? 0.6 : 0.4 }]),
          ),
          robustness: { recommended_option_id: options[0], recommendation_stability: 0.62 },
        },
      },
    } as never)

    const nodeProps = {
      id: decision!.id,
      type: 'decision',
      data: decision!.data,
      position: { x: 0, y: 0 },
      selected: false,
      isConnectable: true,
      positionAbsoluteX: 0,
      positionAbsoluteY: 0,
      dragging: false,
      zIndex: 0,
    } as unknown as Parameters<typeof DecisionNode>[0]
    render(
      <ReactFlowProvider>
        <DecisionNode {...nodeProps} />
      </ReactFlowProvider>,
    )

    const quote = screen.getByTestId('decision-node-brief-text')
    expect(quote.getAttribute('title')).toBe(BRIEF)
    // The fixture is long enough to truncate, so `title` recovering the full
    // text is a real recovery and not shown === full (trap 13b).
    expect(quote.textContent).not.toBe(BRIEF)
    expect(BRIEF.length).toBeGreaterThan((quote.textContent ?? '').length)
  })

  it('⛔ the P0 twin: the PREVIOUS decision’s record is replaced by the new decision’s own, under its own id', async () => {
    // Exactly as the cold read leaves it for the previous decision.
    useContextIntegrityStore
      .getState()
      .setContextIntegrity({ scenarioId: PREVIOUS_SCENARIO, briefText: PREVIOUS_BRIEF, manifest: null })
    // reset-canvas → no decision open.
    resetCanvasToNoDecision()
    expect(useContextIntegrityStore.getState().briefText).toBe(PREVIOUS_BRIEF)

    await sendBrief(BRIEF)
    const minted = assertDraftLanded()
    expect(minted).not.toBe(PREVIOUS_SCENARIO)

    const recorded = useContextIntegrityStore.getState()
    expect(recorded.scenarioId).toBe(minted)
    expect(recorded.briefText).toBe(BRIEF)
    expect(recorded.briefText).not.toContain('tech lead')
  })

  it('a HIDDEN turn that lands a graph records nothing — machine text is not "what you gave me"', async () => {
    const canned = 'Generate a model for the decision described in the composer.'
    await sendBrief(canned, { hidden: true })
    // Precondition: the graph DID land — the refusal is about attribution, not
    // about the draft failing. Without this line the case would pass on a turn
    // that never reached the seam at all.
    assertDraftLanded()

    const recorded = useContextIntegrityStore.getState()
    expect(recorded.scenarioId).toBeNull()
    expect(recorded.briefText).toBeNull()
  })
})

describe('the record never displaces a record that already stands for the same scenario', () => {
  const S = 'f2b0c1a4-0000-4000-8000-000000000009'
  const MANIFEST = {
    status: 'derived',
    quantities: { total: 0, absent: 0, proseOnly: 0, inModel: 0, truncated: false, items: [] },
    inferredFactors: { items: [] },
    declaredExclusions: { status: 'reported', items: [] },
  } as never

  it('a second draft-turn record for the same scenario is refused', () => {
    const store = useContextIntegrityStore.getState()
    expect(store.recordBriefForFreshDraft({ scenarioId: S, briefText: 'first' })).toBe(true)
    expect(store.recordBriefForFreshDraft({ scenarioId: S, briefText: 'second' })).toBe(false)
    expect(useContextIntegrityStore.getState().briefText).toBe('first')
  })

  it('the cold read’s copy (with its manifest) wins and is never displaced afterwards', () => {
    const store = useContextIntegrityStore.getState()
    store.recordBriefForFreshDraft({ scenarioId: S, briefText: 'typed' })
    // The cold read overwrites unconditionally — existing behaviour, unchanged.
    store.setContextIntegrity({ scenarioId: S, briefText: 'persisted', manifest: MANIFEST })
    expect(useContextIntegrityStore.getState().manifest).toBe(MANIFEST)
    // A later draft-turn record for the same scenario must not drop the manifest.
    expect(store.recordBriefForFreshDraft({ scenarioId: S, briefText: 'typed again' })).toBe(false)
    const after = useContextIntegrityStore.getState()
    expect(after.briefText).toBe('persisted')
    expect(after.manifest).toBe(MANIFEST)
  })

  it('a blank brief or a non-string id is refused and writes nothing', () => {
    const store = useContextIntegrityStore.getState()
    expect(store.recordBriefForFreshDraft({ scenarioId: S, briefText: '   ' })).toBe(false)
    expect(store.recordBriefForFreshDraft({ scenarioId: '', briefText: 'x' })).toBe(false)
    expect(store.recordBriefForFreshDraft({ scenarioId: null as never, briefText: 'x' })).toBe(false)
    expect(useContextIntegrityStore.getState().scenarioId).toBeNull()
  })
})

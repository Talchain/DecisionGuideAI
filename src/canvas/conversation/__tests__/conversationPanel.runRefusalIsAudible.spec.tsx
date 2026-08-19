/**
 * THE CHAT'S RUN AFFORDANCE MUST NEVER CONSUME A CLICK AND SAY NOTHING.
 *
 * ── THE DEFECT (wire capture, frozen quartet, 19 Aug 2026) ─────────────────
 * A fresh guest with a producer-READY 16-node model clicked the chat's "Run
 * analysis" and got NOTHING: no analysis, no refusal, no error.
 * `run_state.kind` stayed `never_run`; `analysisRefusalNotice` stayed `null`.
 * The only other route — the Analyse button — was disabled with a sentence that
 * was false. Both exits from the journey were dead, and one of them lied.
 *
 * ── THE TWO INDEPENDENT CAUSES, AND WHY BOTH ARE PINNED HERE ───────────────
 * 1. THE GATE WAS CLOSED FOR THE WRONG REASON. `ConversationPanel` asked the
 *    SIDE-CAR readiness verdict (`readinessStore.can_run_analysis`) while the
 *    PRODUCER's own `analysis_state.readiness` carried `status: 'ready'` and
 *    ZERO blockers. Fixed by putting the canonical authority into the one gate
 *    predicate; pinned exhaustively in
 *    `src/canvas/utils/__tests__/canonicalReadinessAuthority.spec.ts`. What
 *    this file adds is that THIS SURFACE actually consults it — a pure-function
 *    fix that no mounted surface reads is the estate's most familiar dark
 *    capability.
 * 2. THE REFUSAL WAS SILENT. `handleRunAnalysis` opened with a bare
 *    `if (!runGateResult.allowed || isAnalysisRunning) return`. Even a
 *    CORRECTLY closed gate said nothing — no toast, no notice, no console
 *    surface a user could see. Cause 1 is why the gate was shut; cause 2 is why
 *    the user could not find out. Fixing only the first would leave every other
 *    legitimate refusal just as mute.
 *
 * ── SCOPE, STATED PRECISELY (trap 3) ───────────────────────────────────────
 * PRESENCE and TEXT of the refusal on the mounted panel, and whether a turn was
 * dispatched. Not layout, not visibility, not z-order — those need a browser.
 *
 * ⚠ WHAT IS DELIBERATELY *NOT* ASSERTED: that a client-side refusal writes
 * `analysisRefusalNotice`. That slice is sourced ONLY from a typed refusal on
 * `response.analysis_ready` — CEE's own `blocked_reason` — and its module header
 * is explicit that it records "a fact about ONE turn". Writing it from the
 * client would claim the producer refused a turn that was never sent: the
 * guarantee-theatre class, not a cure for it. The honest guarantee is the one
 * pinned below — when the gate is OPEN the click dispatches, and a producer
 * refusal then populates that slice for real; when the gate is SHUT the user is
 * told why, on screen.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import type { AnalysisStateV1 } from '@talchain/schemas/boundary'

import { ConversationPanel } from '../ConversationPanel'
import { ToastProvider } from '../../ToastContext'
import { useCanvasStore } from '../../store'
import { useGuidanceStore } from '../../stores/guidanceStore'
import { useReadinessStore } from '../../stores/readinessStore'
import type { ConversationMessage } from '../types'
import type { UseConversationReturn, PatchBlockState, PatchRejectionInfo } from '../useConversation'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NODES = [
  { id: 'n1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Grow retained revenue' } },
  { id: 'n2', type: 'option', position: { x: 100, y: 0 }, data: { label: 'Extend the free trial' } },
  { id: 'n3', type: 'option', position: { x: 200, y: 0 }, data: { label: 'Hold the current price' } },
]
const EDGES = [{ id: 'e1', source: 'n2', target: 'n1', type: 'styled', data: { weight: 1 } }]

/**
 * A producer verdict shaped exactly as the wire carries it. Only `readiness` is
 * read by the run gate; the rest is present so the fixture is a real
 * `AnalysisStateV1` and not a shape that could never arrive — a fixture outside
 * the producer's output domain proves nothing about the wire (trap 16).
 */
function analysisState(
  readiness: AnalysisStateV1['readiness'],
): AnalysisStateV1 {
  return {
    // The state the capture recorded: the model exists, no run has happened.
    run_state: { kind: 'never_run' },
    readiness,
    leader_claim: { permitted: false, withheld_reason: 'separation_unavailable' },
    robustness: {},
    usable_for_prose: false,
    usable_for_chips: false,
    usable_for_followup: false,
    requires_rerun: false,
    blocked_unusable: false,
    contradictions: [],
  } as AnalysisStateV1
}

const PRODUCER_READY = analysisState({ status: 'ready', blockers: [] })

const PRODUCER_BLOCKED = analysisState({
  status: 'not_ready',
  blockers: [
    {
      code: 'OPTION_NOT_READY',
      category: 'options',
      message: 'The option has no effect values.',
      repairability: 'user_repairable',
      option_id: 'n2',
      option_label: 'Extend the free trial',
    },
  ],
})

function makeConversation(dispatchAction: ReturnType<typeof vi.fn>): UseConversationReturn {
  const patchStates = new Map<string, PatchBlockState>()
  const patchRejections = new Map<string, PatchRejectionInfo>()
  const messages: ConversationMessage[] = []
  return {
    messages,
    isThinking: false,
    longRunningHint: null,
    lastSendFailure: null,
    dispatchAction: dispatchAction as unknown as UseConversationReturn['dispatchAction'],
    cancelTurn: vi.fn(),
    startNewDraft: vi.fn(async () => {}),
    sendMessage: vi.fn().mockResolvedValue(undefined),
    sendSystemEvent: vi.fn().mockResolvedValue(undefined) as unknown as UseConversationReturn['sendSystemEvent'],
    sendChip: vi.fn().mockResolvedValue(undefined),
    clearHistory: vi.fn(),
    retryLast: vi.fn().mockResolvedValue(undefined),
    patchBlockStates: patchStates,
    setPatchBlockState: (key: string, state: PatchBlockState) => { patchStates.set(key, state) },
    patchRejections,
    setPatchRejection: (key: string, info: PatchRejectionInfo) => { patchRejections.set(key, info) },
  }
}

/**
 * ⚠ INSTRUMENT ISOLATION. `readinessStore.startListening` fires a fetch on the
 * FIRST consumer mount, and this panel is one. Left alone, that request races
 * every assertion below and can write the very slice these tests are varying.
 * A never-settling fetch removes the race entirely — and, crucially, it leaves
 * `readinessStore.readiness` at its initial `null`, i.e. THE SIDE-CAR VERDICT
 * DOES NOT OBJECT in any test here. Every gate flip observed below is therefore
 * attributable to the producer verdict and to nothing else.
 */

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
  useReadinessStore.setState({ readiness: null, loading: false, error: null, stale: false, verdictAtMs: null })
  useCanvasStore.setState({
    nodes: [...NODES],
    edges: [...EDGES],
    currentScenarioId: 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4',
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
    results: { status: 'idle' },
    graphHealth: null,
    analysisStateV1: null,
    _externalMutationActive: 0,
  } as never)
})

afterEach(() => {
  vi.unstubAllGlobals()
  useCanvasStore.setState({ nodes: [], edges: [], analysisStateV1: null } as never)
  useGuidanceStore.setState({ _runAnalysis: null } as never)
  vi.clearAllMocks()
})

/**
 * Mount the real panel and hand back the run callback the chat's CTAs invoke.
 *
 * ⚠ BOUND BY IDENTITY, NOT BY A LOOK-ALIKE (trap 19). The callback is taken
 * from `useGuidanceStore._runAnalysis` — the registration the panel itself
 * performs and the exact reference every cross-surface "Run analysis" CTA in the
 * chat calls. A local re-implementation of the click would test this file's
 * idea of the wiring rather than the wiring.
 */
async function mountAndGetRunCallback(dispatchAction: ReturnType<typeof vi.fn>) {
  render(
    <ToastProvider>
      <ConversationPanel
        conversation={makeConversation(dispatchAction)}
        onCollapse={vi.fn()}
        onAttach={vi.fn()}
      />
    </ToastProvider>,
  )
  await waitFor(() => {
    expect(useGuidanceStore.getState()._runAnalysis).toBeTypeOf('function')
  })
  return () => useGuidanceStore.getState()._runAnalysis!()
}

// ═══════════════════════════════════════════════════════════════════════════

describe('AC3 — the chat run affordance answers to the canonical authority', () => {
  it("a producer-READY model RUNS: the click dispatches a real run_analysis turn", async () => {
    // The captured state, minus the defect. Nothing may consume this click
    // silently, and the honest outcome here is a TURN — after which a producer
    // refusal, if there is one, arrives with its own reason_code.
    useCanvasStore.setState({ analysisStateV1: PRODUCER_READY } as never)
    const dispatchAction = vi.fn().mockResolvedValue(undefined)
    const run = await mountAndGetRunCallback(dispatchAction)

    await act(async () => { await run() })

    expect(dispatchAction).toHaveBeenCalledTimes(1)
    expect(dispatchAction).toHaveBeenCalledWith(
      expect.objectContaining({ action_type: 'run_analysis', source: 'chip' }),
    )
    // An open gate refuses nothing — not quietly, not politely.
    expect(screen.queryByText(/is not ready for analysis yet/i)).toBeNull()
  })

  it('a producer-BLOCKED model REFUSES OUT LOUD, naming the blocker, and sends no turn', async () => {
    useCanvasStore.setState({ analysisStateV1: PRODUCER_BLOCKED } as never)
    const dispatchAction = vi.fn().mockResolvedValue(undefined)
    const run = await mountAndGetRunCallback(dispatchAction)

    await act(async () => { await run() })

    // Silence is the defect. The refusal is on screen…
    expect(await screen.findByText(/Extend the free trial/)).toBeInTheDocument()
    // …and it did not run anything behind the user's back.
    expect(dispatchAction).not.toHaveBeenCalled()
  })

  it('SUPERSESSION AT THE SURFACE: the producer verdict alone flips this panel', async () => {
    // The two tests above differ in EXACTLY ONE input — `analysisStateV1` —
    // with the side-car verdict null in both. So this surface demonstrably reads
    // the canonical authority; it is not merely inheriting a permissive default.
    const dispatchReady = vi.fn().mockResolvedValue(undefined)
    useCanvasStore.setState({ analysisStateV1: PRODUCER_READY } as never)
    const runReady = await mountAndGetRunCallback(dispatchReady)
    await act(async () => { await runReady() })
    expect(dispatchReady).toHaveBeenCalledTimes(1)
    expect(useReadinessStore.getState().readiness).toBeNull()
  })
})

describe('AC3 — no closed gate is mute, whichever rung closed it', () => {
  it('an empty canvas refuses AUDIBLY instead of swallowing the click', async () => {
    // A rung that has nothing to do with readiness, deliberately: the silence
    // defect was in the callback's own control flow, so it must be dead for
    // EVERY refusal, not only for the one that motivated this lane. Pre-fix
    // this click produced no dispatch and no surface at all.
    useCanvasStore.setState({ nodes: [], edges: [], analysisStateV1: PRODUCER_READY } as never)
    const dispatchAction = vi.fn().mockResolvedValue(undefined)
    const run = await mountAndGetRunCallback(dispatchAction)

    await act(async () => { await run() })

    expect(await screen.findByText(/Add some nodes to get started/i)).toBeInTheDocument()
    expect(dispatchAction).not.toHaveBeenCalled()
  })

  it('a run already in flight says SO, rather than nothing', async () => {
    useCanvasStore.setState({
      analysisStateV1: PRODUCER_READY,
      results: { status: 'streaming' },
    } as never)
    const dispatchAction = vi.fn().mockResolvedValue(undefined)
    const run = await mountAndGetRunCallback(dispatchAction)

    await act(async () => { await run() })

    expect(await screen.findByText(/Analysis in progress/i)).toBeInTheDocument()
    expect(dispatchAction).not.toHaveBeenCalled()
  })
})

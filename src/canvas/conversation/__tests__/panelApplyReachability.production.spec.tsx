/**
 * Panel apply reachability — the production route and feature-flag boundary.
 *
 * This is intentionally broader than `panelApplyClickToWire.spec.tsx`. That
 * spec pins the data transforms; this one mounts AppPoC's real HashRouter and
 * the real aiPanelV2 boundary, closes a recovered round through the real owner
 * page, clicks RevealBody's real Apply control, then clicks the real return
 * Link. The canvas body is a lightweight route harness, but the conversation
 * boundary and headless drain it mounts are the production components.
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { StrictMode } from 'react'

const SCENARIO_ID = '22222222-3333-4444-8555-666677778888'
const OTHER_SCENARIO_ID = '33333333-4444-4555-8666-777788889999'
const ROUND_ID = 'c3d4e5f6-a7b8-4901-9234-56789abcdef0'
const GRACE_ID = '9f1c7d2e-4b3a-4c11-8e6f-0a2b5c8d7e10'
const TARGET_ID = 'factor-churn-risk'
const TURN_ID = '11111111-2222-4333-8444-555566667777'

const harness = vi.hoisted(() => {
  const systemEvents: unknown[] = []
  return {
    systemEvents,
    sendSystemEvent: vi.fn(async (event: unknown, _opts?: unknown): Promise<unknown> => {
      systemEvents.push(event)
      return undefined
    }),
    getSessionIdentity: vi.fn(async () => ({
      userId: 'owner-user-id',
      accessToken: 'owner-access-token',
    })),
  }
})

// The headless host must consume the existing ConversationProvider singleton.
// Mock only the transport implementation; the provider and host are real.
vi.mock('../useConversation', () => ({
  SEND_DEFERRED: 'send_deferred',
  SEND_BLOCKED: 'send_blocked',
  useConversation: () => ({ sendSystemEvent: harness.sendSystemEvent }),
}))

vi.mock('../../../lib/supabase', () => ({
  getSessionIdentity: harness.getSessionIdentity,
}))

// Auth is not the seam under test. Keep AppPoC's real route table while making
// its guarded branch deterministically reachable in jsdom.
vi.mock('../../../contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: unknown }) => children,
  useAuth: () => ({ loading: false, authenticated: true, user: { id: 'owner-user-id' } }),
}))
vi.mock('../../../components/auth/AuthGuard', async () => {
  const { Outlet } = await import('react-router-dom')
  return { default: Outlet }
})
vi.mock('../../../lib/monitoring', () => ({
  initMonitoring: vi.fn(),
  setSentryUser: vi.fn(),
  clearSentryUser: vi.fn(),
}))
vi.mock('../../../components/debug/debugPanelVisibility', () => ({
  useShouldShowDebugPanel: () => false,
}))

// AppPoC still owns the real HashRouter and route declarations. The canvas
// route body is narrowed to the production conversation boundary so this test
// settles the apply handoff without mounting the entire ReactFlow renderer.
vi.mock('../../../routes/CanvasMVP', async () => {
  const { MaybeConversationProvider } = await import('../../ReactFlowGraph')
  return {
    default: function CanvasRouteHarness() {
      return (
        <MaybeConversationProvider>
          <div data-testid="production-canvas-route" />
        </MaybeConversationProvider>
      )
    },
  }
})

import AppPoC from '../../../poc/AppPoC'
import { isAiPanelV2Enabled } from '../../../flags'
import { rememberOpenRound } from '../../../collab/openRoundRecord'
import {
  readPendingApply,
  rememberPendingApply,
} from '../../../collab/panelApplyHandoff'
import { MaybeConversationProvider } from '../../ReactFlowGraph'
import { buildV5Payload } from '../../../v5/buildPayload'
import { useCanvasStore } from '../../store'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { SEND_BLOCKED, SEND_DEFERRED } from '../useConversation'

const REVEAL = {
  round_id: ROUND_ID,
  status: 'closed',
  graph_version_ref: 'mv-1',
  per_target: [
    {
      target: { kind: 'factor', id: TARGET_ID },
      label: 'Churn risk',
      model_value_at_version: 0.5,
      responses: [
        {
          participant_id: GRACE_ID,
          display_label: 'Grace',
          value: 0.85,
          expression_raw: 'pretty likely',
          confidence: 0.7,
          kind: 'belief_submitted',
        },
      ],
    },
  ],
}

function jsonResponse(body: unknown, status = 200): Pick<Response, 'ok' | 'status' | 'json'> {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }
}

function readyGraph(scenarioId = SCENARIO_ID): void {
  useCanvasStore.setState({
    currentScenarioId: scenarioId,
    nodes: [
      {
        id: TARGET_ID,
        type: 'factor',
        position: { x: 0, y: 0 },
        data: { label: 'Churn risk', observedState: { value: 0.5 } },
      },
    ],
    edges: [],
  })
}

function renderBoundaryAt(
  routeScenarioId: string,
  options?: { strict?: boolean },
): ReturnType<typeof render> {
  const boundary = (
    <MemoryRouter initialEntries={[`/scenario/${routeScenarioId}`]}>
      <Routes>
        <Route
          path="/scenario/:id"
          element={
            <MaybeConversationProvider>
              <div data-testid="boundary-child" />
            </MaybeConversationProvider>
          }
        />
      </Routes>
    </MemoryRouter>
  )
  return render(options?.strict === true ? <StrictMode>{boundary}</StrictMode> : boundary)
}

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  window.history.replaceState({}, '', `/#/scenario/${SCENARIO_ID}/panel`)
  window.localStorage.setItem('feature.aiPanelV2', 'true')
  harness.systemEvents.length = 0
  harness.sendSystemEvent.mockReset()
  harness.sendSystemEvent.mockImplementation(async (event: unknown, _opts?: unknown) => {
    harness.systemEvents.push(event)
    return undefined
  })
  harness.getSessionIdentity.mockClear()
  readyGraph()
})

afterEach(() => {
  vi.unstubAllGlobals()
  useCanvasStore.getState().resetCanvas()
})

describe('production panel-apply route', () => {
  it('real reveal Apply + canonical return Link reaches one uncited wire edit exactly once', async () => {
    expect(isAiPanelV2Enabled()).toBe(true)

    rememberOpenRound({
      roundId: ROUND_ID,
      scenarioId: SCENARIO_ID,
      participants: [{ participant_id: GRACE_ID, display_name: 'Grace' }],
    })

    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === `/bff/collab/rounds/${ROUND_ID}/close`) return jsonResponse({})
      if (url === `/bff/collab/rounds/${ROUND_ID}/reveal`) return jsonResponse(REVEAL)
      if (url === `/bff/collab/rounds/${ROUND_ID}/disagreement`) {
        return jsonResponse({ code: 'not_available', message: 'not available' }, 404)
      }
      return jsonResponse({ code: 'not_stubbed', message: url }, 404)
    }))

    render(<AppPoC />)

    fireEvent.click(await screen.findByTestId('panel-resume-close'))
    const apply = await screen.findByTestId(`reveal-apply-${TARGET_ID}-${GRACE_ID}`)
    fireEvent.click(apply)

    expect(readPendingApply(SCENARIO_ID)).toMatchObject({
      round_id: ROUND_ID,
      participant_id: GRACE_ID,
      target_id: TARGET_ID,
      value: 0.85,
    })

    const returnLink = screen.getByTestId('reveal-back-to-model')
    expect(returnLink.getAttribute('href')).toBe(`#/scenario/${SCENARIO_ID}`)
    fireEvent.click(returnLink)

    await screen.findByTestId('production-canvas-route')
    expect(screen.queryByTestId(`reveal-apply-${TARGET_ID}-${GRACE_ID}`)).toBeNull()
    expect((window.location.href.match(/#/g) ?? []).length).toBe(1)
    expect(window.location.hash).toBe(`#/scenario/${SCENARIO_ID}`)

    await waitFor(() => expect(harness.sendSystemEvent).toHaveBeenCalledTimes(1))
    expect(readPendingApply(SCENARIO_ID)).toBeNull()

    const built = buildV5Payload({
      turnId: TURN_ID,
      scenarioId: SCENARIO_ID,
      stage: 'frame' as never,
      turnClass: 'system' as never,
      mode: 'system',
      systemEvent: harness.systemEvents[0] as never,
    })
    expect(built.ok).toBe(true)
    if (!built.ok) throw new Error('positive control: factor edit payload was refused')

    const wire = (built.payload as unknown as { event: Record<string, unknown> }).event
    expect(wire).toMatchObject({
      kind: 'factor_value_edit',
      target_id: TARGET_ID,
      value: 0.85,
      applied_from: { round_id: ROUND_ID, participant_id: GRACE_ID },
    })
    expect(wire).not.toHaveProperty('cited_evidence')
    expect(wire).not.toHaveProperty('evidence')
  })

  it('delayed target hydration retriggers the pending drain once, then removal prevents replay', async () => {
    useCanvasStore.setState({ currentScenarioId: SCENARIO_ID, nodes: [], edges: [] })
    rememberPendingApply({
      scenarioId: SCENARIO_ID,
      roundId: ROUND_ID,
      participantId: GRACE_ID,
      targetId: TARGET_ID,
      value: 0.85,
    })

    renderBoundaryAt(SCENARIO_ID)
    expect(harness.sendSystemEvent).not.toHaveBeenCalled()
    expect(readPendingApply(SCENARIO_ID)).not.toBeNull()

    await act(async () => {
      readyGraph()
    })
    await waitFor(() => expect(harness.sendSystemEvent).toHaveBeenCalledTimes(1))
    expect(readPendingApply(SCENARIO_ID)).toBeNull()

    await act(async () => {
      useCanvasStore.setState((state) => ({ nodes: [...state.nodes] }))
    })
    expect(harness.sendSystemEvent).toHaveBeenCalledTimes(1)
  })

  it('an unresolved send survives re-render, remount, and StrictMode without double-dispatch', async () => {
    let resolveSend: (() => void) | undefined
    harness.sendSystemEvent.mockImplementationOnce(
      () => new Promise<undefined>((resolve) => {
        resolveSend = () => resolve(undefined)
      }),
    )
    rememberPendingApply({
      scenarioId: SCENARIO_ID,
      roundId: ROUND_ID,
      participantId: GRACE_ID,
      targetId: TARGET_ID,
      value: 0.85,
    })
    const storageKey = `olumi.collab.pending-apply.${SCENARIO_ID}`
    const exactPending = window.localStorage.getItem(storageKey)

    const firstMount = renderBoundaryAt(SCENARIO_ID, { strict: true })
    await waitFor(() => expect(harness.sendSystemEvent).toHaveBeenCalledTimes(1))
    expect(harness.sendSystemEvent.mock.calls[0]?.[1]).toEqual({ deferIfBusy: false })
    expect(window.localStorage.getItem(storageKey)).toBe(exactPending)

    // MUTANT: removing the in-flight guard sends again on this graph revision.
    await act(async () => {
      useCanvasStore.setState((state) => ({ nodes: [...state.nodes] }))
      await Promise.resolve()
    })
    expect(harness.sendSystemEvent).toHaveBeenCalledTimes(1)
    expect(window.localStorage.getItem(storageKey)).toBe(exactPending)

    // MUTANT: a component-local-only guard is lost here and dispatches a
    // second copy when StrictMode (or route churn) mounts a fresh host.
    firstMount.unmount()
    renderBoundaryAt(SCENARIO_ID, { strict: true })
    await act(async () => { await Promise.resolve() })
    expect(harness.sendSystemEvent).toHaveBeenCalledTimes(1)
    expect(window.localStorage.getItem(storageKey)).toBe(exactPending)

    await act(async () => {
      resolveSend?.()
      await Promise.resolve()
      await Promise.resolve()
    })
    await waitFor(() => expect(readPendingApply(SCENARIO_ID)).toBeNull())

    await act(async () => {
      useCanvasStore.setState((state) => ({ nodes: [...state.nodes] }))
    })
    expect(harness.sendSystemEvent).toHaveBeenCalledTimes(1)
  })

  it('an older accepted citation cannot clear a newer same-millisecond citation, which retries exactly once', async () => {
    const oldEvidenceId = '77777777-7777-4777-8777-777777777777'
    const newEvidenceId = '88888888-8888-4888-8888-888888888888'
    const recordedAt = new Date().toISOString()
    const storageKey = `olumi.collab.pending-apply.${SCENARIO_ID}`
    const oldIntent = {
      scenario_id: SCENARIO_ID,
      round_id: ROUND_ID,
      participant_id: GRACE_ID,
      target_id: TARGET_ID,
      value: 0.85,
      evidence_event_id: oldEvidenceId,
      recorded_at: recordedAt,
    }
    const newerIntent = { ...oldIntent, evidence_event_id: newEvidenceId }

    let resolveOldSend: (() => void) | undefined
    harness.sendSystemEvent.mockImplementationOnce(
      (event: unknown) => {
        harness.systemEvents.push(event)
        return new Promise<undefined>((resolve) => {
          resolveOldSend = () => resolve(undefined)
        })
      },
    )
    window.localStorage.setItem(storageKey, JSON.stringify(oldIntent))

    renderBoundaryAt(SCENARIO_ID)
    await waitFor(() => expect(harness.sendSystemEvent).toHaveBeenCalledTimes(1))
    expect(harness.sendSystemEvent.mock.calls[0]?.[1]).toEqual({ deferIfBusy: false })
    expect(harness.systemEvents[0]).toMatchObject({
      type: 'factor_value_edit',
      payload: {
        applied_from: { evidence_event_id: oldEvidenceId },
      },
    })

    // This is a genuinely newer owner action even though Date's millisecond
    // clock collided. The changed citation is part of what the owner claimed.
    window.localStorage.setItem(storageKey, JSON.stringify(newerIntent))
    await act(async () => {
      resolveOldSend?.()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(readPendingApply(SCENARIO_ID)).toEqual(newerIntent)

    // Settlement releases only the old transport claim. A later graph revision
    // must still be able to drain the new action through the singleton sender.
    await act(async () => {
      useCanvasStore.setState((state) => ({ nodes: [...state.nodes] }))
    })
    await waitFor(() => expect(harness.sendSystemEvent).toHaveBeenCalledTimes(2))
    expect(harness.sendSystemEvent.mock.calls[1]?.[1]).toEqual({ deferIfBusy: false })
    expect(harness.systemEvents[1]).toMatchObject({
      type: 'factor_value_edit',
      payload: {
        applied_from: { evidence_event_id: newEvidenceId },
      },
    })
    await waitFor(() => expect(readPendingApply(SCENARIO_ID)).toBeNull())

    await act(async () => {
      useCanvasStore.setState((state) => ({ nodes: [...state.nodes] }))
    })
    expect(harness.sendSystemEvent).toHaveBeenCalledTimes(2)
  })

  it('a rejected send retains the exact action and a later revision retries it successfully once', async () => {
    harness.sendSystemEvent.mockRejectedValueOnce(new Error('transport rejected'))
    rememberPendingApply({
      scenarioId: SCENARIO_ID,
      roundId: ROUND_ID,
      participantId: GRACE_ID,
      targetId: TARGET_ID,
      value: 0.85,
    })
    const storageKey = `olumi.collab.pending-apply.${SCENARIO_ID}`
    const exactPending = window.localStorage.getItem(storageKey)

    renderBoundaryAt(SCENARIO_ID)
    await waitFor(() => expect(harness.sendSystemEvent).toHaveBeenCalledTimes(1))
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(window.localStorage.getItem(storageKey)).toBe(exactPending)

    // MUTANT: stamping drainedFor on rejection prevents this retry; forgetting
    // before success makes the exact-pending assertion above fail.
    await act(async () => {
      useCanvasStore.setState((state) => ({ nodes: [...state.nodes] }))
    })
    await waitFor(() => expect(harness.sendSystemEvent).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(readPendingApply(SCENARIO_ID)).toBeNull())

    await act(async () => {
      useCanvasStore.setState((state) => ({ nodes: [...state.nodes] }))
    })
    expect(harness.sendSystemEvent).toHaveBeenCalledTimes(2)
  })

  it.each([
    ['SEND_DEFERRED', SEND_DEFERRED],
    ['SEND_BLOCKED', SEND_BLOCKED],
    ['a generic resolved no-op', { status: 'no-op' }],
  ])('%s retains the exact action and releases it for one later accepted retry', async (_label, outcome) => {
    harness.sendSystemEvent.mockResolvedValueOnce(outcome)
    rememberPendingApply({
      scenarioId: SCENARIO_ID,
      roundId: ROUND_ID,
      participantId: GRACE_ID,
      targetId: TARGET_ID,
      value: 0.85,
    })
    const storageKey = `olumi.collab.pending-apply.${SCENARIO_ID}`
    const exactPending = window.localStorage.getItem(storageKey)

    renderBoundaryAt(SCENARIO_ID)
    await waitFor(() => expect(harness.sendSystemEvent).toHaveBeenCalledTimes(1))
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(window.localStorage.getItem(storageKey)).toBe(exactPending)
    expect(harness.sendSystemEvent.mock.calls[0]?.[1]).toEqual({ deferIfBusy: false })

    await act(async () => {
      useCanvasStore.setState((state) => ({ nodes: [...state.nodes] }))
    })
    await waitFor(() => expect(harness.sendSystemEvent).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(readPendingApply(SCENARIO_ID)).toBeNull())

    await act(async () => {
      useCanvasStore.setState((state) => ({ nodes: [...state.nodes] }))
    })
    expect(harness.sendSystemEvent).toHaveBeenCalledTimes(2)
  })

  it('does not drain a pending apply when the route and hydrated graph name different scenarios', () => {
    rememberPendingApply({
      scenarioId: SCENARIO_ID,
      roundId: ROUND_ID,
      participantId: GRACE_ID,
      targetId: TARGET_ID,
      value: 0.85,
    })
    readyGraph(SCENARIO_ID)

    renderBoundaryAt(OTHER_SCENARIO_ID)

    expect(harness.sendSystemEvent).not.toHaveBeenCalled()
    expect(readPendingApply(SCENARIO_ID)).not.toBeNull()
  })

  it('does not drain an expired pending apply', () => {
    window.localStorage.setItem(
      `olumi.collab.pending-apply.${SCENARIO_ID}`,
      JSON.stringify({
        scenario_id: SCENARIO_ID,
        round_id: ROUND_ID,
        participant_id: GRACE_ID,
        target_id: TARGET_ID,
        value: 0.85,
        recorded_at: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
      }),
    )

    renderBoundaryAt(SCENARIO_ID)

    expect(harness.sendSystemEvent).not.toHaveBeenCalled()
    expect(readPendingApply(SCENARIO_ID)).toBeNull()
  })

  it('production mount and rollback paths stay explicit', () => {
    const graphSource = readFileSync(resolve(process.cwd(), 'src/canvas/ReactFlowGraph.tsx'), 'utf8')
    const legacySource = readFileSync(resolve(process.cwd(), 'src/canvas/components/DraftChat.tsx'), 'utf8')

    // Mutation guards: removing the production boundary mount, inverting its
    // flag branch, or deleting the flag-off legacy drain makes one fail.
    expect(graphSource).toContain('<MaybeConversationProvider>')
    expect(graphSource).toContain('</MaybeConversationProvider>')
    expect(graphSource).toContain('if (isAiPanelV2Enabled()) {')
    expect(graphSource.match(/<PanelApplyDrainHost \/>/g)).toHaveLength(1)
    expect(legacySource).toContain('usePanelApplyDrain({')
    expect(graphSource).toContain('{!isAiPanelV2Enabled() && <DraftChat />}')
  })

  // ═══ schemas 0.48.0 — the durable-delete drain gets the SAME two-host pin ═══
  //
  // ⚠ THIS LIMB EXISTS BECAUSE THE CAPABILITY SHIPPED DARK WITHOUT IT. The
  // delete drain was hosted only in DraftChat, which the line pinned above
  // mounts ONLY when aiPanelV2 is OFF — and it is ON for every fresh user. The
  // queue was never drained and no turn could ever be sent, yet the whole suite
  // stayed green: deleting the single call site left 157 files / 1773 tests
  // passing, because nothing bound the MOUNT.
  //
  // A green suite is not evidence about a component the deployment does not
  // render, so the binding has to be to the mount itself. Both hosts are pinned
  // by source, exactly as the sibling drain's are, so deleting EITHER reds here.
  it('the durable-delete drain is mounted on BOTH flag postures', () => {
    const graphSource = readFileSync(resolve(process.cwd(), 'src/canvas/ReactFlowGraph.tsx'), 'utf8')
    const legacySource = readFileSync(resolve(process.cwd(), 'src/canvas/components/DraftChat.tsx'), 'utf8')
    const flagOnHost = readFileSync(
      resolve(process.cwd(), 'src/canvas/conversation/StructuralDeleteDrainHost.tsx'),
      'utf8',
    )

    // Flag ON: the headless host is mounted exactly once, and INSIDE the
    // provider — outside it there is no sendSystemEvent to drain through.
    expect(graphSource.match(/<StructuralDeleteDrainHost \/>/g)).toHaveLength(1)
    const providerBlock = graphSource.slice(
      graphSource.indexOf('<ConversationProvider>'),
      graphSource.indexOf('</ConversationProvider>'),
    )
    expect(providerBlock).toContain('<StructuralDeleteDrainHost />')
    expect(flagOnHost).toContain('useStructuralDeleteEvents(sendSystemEvent)')

    // Flag OFF: DraftChat keeps its own host, or the rollback posture goes dark.
    expect(legacySource).toContain('useStructuralDeleteEvents(')
  })
})

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
    sendSystemEvent: vi.fn(async (event: unknown) => {
      systemEvents.push(event)
      return {}
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

function renderBoundaryAt(routeScenarioId: string): ReturnType<typeof render> {
  return render(
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
    </MemoryRouter>,
  )
}

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  window.history.replaceState({}, '', `/#/scenario/${SCENARIO_ID}/panel`)
  window.localStorage.setItem('feature.aiPanelV2', 'true')
  harness.systemEvents.length = 0
  harness.sendSystemEvent.mockClear()
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
})

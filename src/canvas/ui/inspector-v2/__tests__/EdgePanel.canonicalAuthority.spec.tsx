/**
 * EdgePanel canonical-authority integration.
 *
 * These cases join the real editor, store watcher, transaction coordinator and
 * Run barrier. They prevent a control-local draft or timer from hiding the
 * value on screen from the writer, and prove a typed shared-value replacement
 * reaches focused controls immediately.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react'
import type { BoundaryError, OlumiResponse } from '@talchain/schemas/boundary'

import { EdgePanel } from '../panels/EdgePanel'
import { useCanvasStore } from '../../../store'
import { useGraphEditEvents } from '../../../conversation/useGraphEditEvents'
import type { WireSystemEvent } from '../../../conversation/types'
import {
  __resetEdgeStrengthCoordinatorForTests,
  beginEdgeStrengthHydration,
  finishEdgeStrengthHydration,
  flushEdgeStrengthEditsBeforeRun,
  settleEdgeStrengthResponse,
} from '../../../edge-strength/edgeStrengthCoordinator'

vi.mock('../../../../flags', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../../../flags')>(),
  isOrchestratorV2Enabled: () => true,
  isJourneyTabEnabled: () => false,
}))
vi.mock('../../../../v5/eligibility', () => ({ isV5CanonicalRunPath: () => true }))
vi.mock('../../../../services/scenarioService', () => ({ appendEvent: vi.fn() }))
vi.mock('../../../edge-strength/EdgeStrengthSyncStatus', () => ({
  EdgeStrengthSyncStatus: () => null,
}))
vi.mock('../../../conversation/ConversationContext', () => ({
  useOptionalConversationContext: () => null,
}))

const SCENARIO = '22222222-2222-4222-8222-222222222222'
const EDGE_ID = 'rf-private-edge'

function setCanonicalGraph(): void {
  useCanvasStore.setState({
    currentScenarioId: SCENARIO,
    nodes: [
      {
        id: 'fac_demand', type: 'factor', position: { x: 0, y: 0 },
        data: { label: 'Demand', observedState: { value: 0.55, source: 'cee_inference', cap: 1 } },
      },
      { id: 'goal_profit', type: 'goal', position: { x: 200, y: 0 }, data: { label: 'Profit' } },
      { id: 'opt_plan_a', type: 'option', position: { x: 0, y: 120 }, data: { label: 'Plan A' } },
    ] as never,
    edges: [{
      id: EDGE_ID,
      source: 'fac_demand',
      target: 'goal_profit',
      data: {
        weight: 0.4,
        direction: 'positive',
        strengthStd: 0.1,
        strengthStdSource: 'cee',
        beliefExists: 0.9,
        beliefExistsSource: 'cee',
        weightSource: 'cee',
        directionSource: 'cee',
      },
    }] as never,
    results: { status: 'none', report: null } as never,
    analysisFreshness: {
      freshness: 'fresh',
      freshnessReason: 'graph_hash_match',
      currentGraphHash: 'old-hash',
      graphHashAtRun: 'old-hash',
      computedAt: '2026-08-15T13:00:00.000Z',
    },
    analysisFreshnessDirty: false,
    _externalMutationActive: 0,
  })
}

function makeHydrationUsable(): void {
  const revision = beginEdgeStrengthHydration(SCENARIO)
  finishEdgeStrengthHydration({ scenarioId: SCENARIO, startedAtRevision: revision, usable: true })
}

function exactReceipt(event: WireSystemEvent): OlumiResponse {
  const payload = event.payload as Record<string, any>
  const expected = payload.expected as { mean: number; effect_direction: 'positive' | 'negative' }
  const direction = payload.direction_intent === 'preserve'
    ? expected.effect_direction
    : payload.direction_intent as 'positive' | 'negative'
  const mean = payload.magnitude === 0
    ? 0
    : direction === 'negative' ? -payload.magnitude : payload.magnitude

  return {
    response_version: 2,
    assistant_text: 'Adjusted.',
    stage_indicator: 'analyse',
    suggested_actions: [],
    insights: [],
    blocks: [{
      type: 'graph_patch',
      status: 'applied',
      operation: 'adjust_edge_strength',
      target_id: 'fac_demand→goal_profit',
      before: {
        from: 'fac_demand', to: 'goal_profit',
        strength: { mean: expected.mean, std: 0.1 },
        effect_direction: expected.effect_direction,
      },
      after: {
        from: 'fac_demand', to: 'goal_profit',
        strength: { mean, std: 0.1 },
        effect_direction: direction,
      },
    }],
    graph_hash: 'new-hash',
    analysis_ready: {
      options: [{
        option_id: 'opt_plan_a', label: 'Plan A', status: 'needs_user_mapping',
        interventions: {}, is_baseline: false,
      }],
      goal_node_id: 'goal_profit',
      status: 'needs_user_input',
      computed_at: '2026-08-15T14:00:39.168Z',
      freshness: 'stale',
      freshness_reason: 'graph_hash_diverged',
      graph_hash_at_run: 'old-hash',
      current_graph_hash: 'new-hash',
    },
    draft_graph: {
      nodes: [
        { id: 'goal_profit', kind: 'goal', label: 'Profit' },
        {
          id: 'fac_demand', kind: 'factor', label: 'Demand',
          observed_state: { value: 0.55, source: 'cee_inference', cap: 1 },
        },
        { id: 'opt_plan_a', kind: 'option', label: 'Plan A' },
      ],
      edges: [{
        from: 'fac_demand',
        to: 'goal_profit',
        strength: { mean, std: 0.1 },
        exists_probability: 0.9,
        effect_direction: direction,
        provenance: { source: 'user_specified', reasoning: 'User judgement' },
        provenance_display: 'user_set',
      }],
      node_count: 3,
      edge_count: 1,
    },
  } as OlumiResponse
}

function sharedConflict(mean = 0.25): BoundaryError {
  return {
    error: 'GRAPH_DIVERGED',
    message: 'Graph diverged',
    retryable: false,
    details: {
      recovery_action: 'refresh_and_reconfirm',
      edge: { current: { mean, std: 0.1, effect_direction: 'positive' } },
    },
  } as unknown as BoundaryError
}

function renderEditor(
  sendSystemEvent: (
    event: WireSystemEvent,
    opts?: { deferIfBusy?: boolean; edgeStrengthAttemptId?: string },
  ) => Promise<unknown>,
) {
  const watcher = renderHook(() => useGraphEditEvents(sendSystemEvent))
  makeHydrationUsable()
  const panel = render(
    <EdgePanel
      edgeId={EDGE_ID}
      techMode={true}
      onClose={() => {}}
      onNavigate={() => {}}
    />,
  )
  return { watcher, panel }
}

beforeEach(() => {
  __resetEdgeStrengthCoordinatorForTests()
  setCanonicalGraph()
})

afterEach(() => {
  __resetEdgeStrengthCoordinatorForTests()
})

describe('EdgePanel — one canonical live strength authority', () => {
  it('puts the released slider value on the writer before an immediate Run flush', async () => {
    const events: WireSystemEvent[] = []
    const sendSystemEvent = vi.fn(async (
      event: WireSystemEvent,
      opts?: { edgeStrengthAttemptId?: string },
    ) => {
      events.push(event)
      settleEdgeStrengthResponse({
        attemptId: opts?.edgeStrengthAttemptId ?? '',
        response: exactReceipt(event),
      })
      return undefined
    })
    renderEditor(sendSystemEvent)
    const slider = screen.getByRole('slider', { name: 'Effect on target' })

    fireEvent.focus(slider)
    fireEvent.change(slider, { target: { value: '0.7' } })
    fireEvent.mouseUp(slider)

    // No 120 ms control timer: the optimistic graph already carries 0.7.
    expect(useCanvasStore.getState().edges[0]?.data?.weight).toBe(0.7)

    let result: Awaited<ReturnType<typeof flushEdgeStrengthEditsBeforeRun>> | undefined
    await act(async () => {
      result = await flushEdgeStrengthEditsBeforeRun(SCENARIO)
    })

    expect(result).toEqual({ ok: true })
    expect(events).toHaveLength(1)
    expect(events[0]?.payload).toMatchObject({
      from: 'fac_demand',
      to: 'goal_profit',
      magnitude: 0.7,
      expected: { mean: 0.4, effect_direction: 'positive' },
      intent: 'set',
    })
  })

  it.each([
    ['fine-tune slider', () => screen.getByRole('slider', { name: 'Effect on target' })],
    ['expert beta', () => screen.getByRole('spinbutton', { name: 'Signed relationship strength' })],
  ] as const)('renders a typed 409 shared value during active %s editing', async (_label, controlFor) => {
    const sendSystemEvent = vi.fn(async (
      _event: WireSystemEvent,
      opts?: { edgeStrengthAttemptId?: string },
    ) => {
      settleEdgeStrengthResponse({
        attemptId: opts?.edgeStrengthAttemptId ?? '',
        boundaryError: sharedConflict(),
      })
      throw new Error('typed refusal')
    })
    renderEditor(sendSystemEvent)
    const control = controlFor() as HTMLInputElement

    fireEvent.focus(control)
    fireEvent.change(control, { target: { value: '0.7' } })
    expect((controlFor() as HTMLInputElement).value).toBe('0.7')

    let result: Awaited<ReturnType<typeof flushEdgeStrengthEditsBeforeRun>> | undefined
    await act(async () => {
      result = await flushEdgeStrengthEditsBeforeRun(SCENARIO)
    })

    expect(result).toMatchObject({ ok: false })
    expect((controlFor() as HTMLInputElement).value).toBe('0.25')
    expect(useCanvasStore.getState().edges[0]?.data).toMatchObject({
      weight: 0.25,
      weightSource: 'shared',
      directionSource: 'shared',
    })
    expect(sendSystemEvent).toHaveBeenCalledTimes(1)
  })
})

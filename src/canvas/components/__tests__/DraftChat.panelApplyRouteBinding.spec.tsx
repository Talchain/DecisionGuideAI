/**
 * The real FF-off DraftChat host must bind panel apply to the requested route.
 * A store can still hold scenario A for a render after navigation requests B;
 * that transition must never drain A's pending action on B's route.
 */

import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

const SCENARIO_A = '22222222-3333-4444-8555-666677778888'
const SCENARIO_B = '33333333-4444-4555-8666-777788889999'
const ROUND_ID = 'c3d4e5f6-a7b8-4901-9234-56789abcdef0'
const GRACE_ID = '9f1c7d2e-4b3a-4c11-8e6f-0a2b5c8d7e10'
const TARGET_ID = 'factor-churn-risk'

const controls = vi.hoisted(() => ({
  sendSystemEvent: vi.fn(async (_event: unknown, _opts?: unknown): Promise<undefined> => undefined),
  sendMessage: vi.fn(async () => ({})),
}))

vi.mock('../../../hooks/useCEEDraft', () => ({
  useCEEDraft: () => ({
    data: null,
    loading: false,
    error: null,
    draft: vi.fn(),
    guidance: null,
    retryAfterSeconds: null,
  }),
}))
vi.mock('../../conversation/useConversation', () => ({
  useConversation: () => ({
    messages: [],
    isThinking: false,
    sendMessage: controls.sendMessage,
    sendSystemEvent: controls.sendSystemEvent,
  }),
}))
vi.mock('../../conversation/useGraphEditEvents', () => ({
  useGraphEditEvents: () => undefined,
}))
vi.mock('../../conversation/useAnalysisCompleteEvent', () => ({
  useAnalysisCompleteEvent: () => undefined,
}))

import { DraftChat } from '../DraftChat'
import { rememberPendingApply, readPendingApply } from '../../../collab/panelApplyHandoff'
import { isAiPanelV2Enabled } from '../../../flags'
import { useCanvasStore } from '../../store'

function graphA(): void {
  useCanvasStore.setState({
    currentScenarioId: SCENARIO_A,
    showDraftChat: false,
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

function rememberA(): void {
  rememberPendingApply({
    scenarioId: SCENARIO_A,
    roundId: ROUND_ID,
    participantId: GRACE_ID,
    targetId: TARGET_ID,
    value: 0.85,
  })
}

function mountDraftChatAt(routeScenarioId: string): ReturnType<typeof render> {
  return render(
    <MemoryRouter initialEntries={[`/scenario/${routeScenarioId}`]}>
      <Routes>
        <Route path="/scenario/:id" element={<DraftChat />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  window.localStorage.clear()
  window.localStorage.setItem('feature.aiPanelV2', 'false')
  controls.sendSystemEvent.mockReset()
  controls.sendSystemEvent.mockResolvedValue(undefined)
  controls.sendMessage.mockClear()
  useCanvasStore.getState().resetCanvas()
  graphA()
})

afterEach(() => {
  cleanup()
  useCanvasStore.getState().resetCanvas()
})

describe('DraftChat panel apply route binding (aiPanelV2 off)', () => {
  it('MUTANT — /scenario/B with A still in the store does not emit A pending', async () => {
    expect(isAiPanelV2Enabled()).toBe(false)
    rememberA()

    mountDraftChatAt(SCENARIO_B)
    await Promise.resolve()
    await Promise.resolve()

    expect(controls.sendSystemEvent).not.toHaveBeenCalled()
    expect(readPendingApply(SCENARIO_A)).not.toBeNull()
  })

  it('same route and hydrated scenario still drains once through DraftChat', async () => {
    expect(isAiPanelV2Enabled()).toBe(false)
    rememberA()

    mountDraftChatAt(SCENARIO_A)

    await waitFor(() => expect(controls.sendSystemEvent).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(readPendingApply(SCENARIO_A)).toBeNull())
    expect(controls.sendSystemEvent.mock.calls[0]?.[0]).toMatchObject({
      type: 'factor_value_edit',
      payload: {
        field: 'value',
        target_id: TARGET_ID,
        value: 0.85,
        applied_from: { round_id: ROUND_ID, participant_id: GRACE_ID },
      },
    })
  })
})

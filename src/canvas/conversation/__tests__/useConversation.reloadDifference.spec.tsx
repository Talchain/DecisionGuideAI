/**
 * ON RELOAD, THE SAVED MODEL WINS — THE LASTING LINE. RED-first.
 *
 * When the boot merge takes elements off the canvas because the saved model
 * lacks them (`mergeServerGraph.reloadShowsSavedModel.spec.ts`), the hydration
 * path records a scenario-keyed notice (`reloadDifferenceStore`). This pins the
 * other half: the conversation shows it as ONE synthetic assistant line for the
 * current decision — after the transcript restore, never twice, never on another
 * decision — in the proposed copy.
 *
 * Harness adapted from `useConversation.resetTranscript.spec.tsx`: the mocks
 * exist only to stop the hook reaching a network path at mount.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useConversation } from '../useConversation'
import { useCanvasStore } from '../../store'
import * as scenarios from '../../store/scenarios'
import {
  TRANSCRIPT_STORAGE_KEY,
  __resetTranscriptTombstonesForTests,
} from '../utils/transcriptStore'
import {
  RELOAD_DIFFERENCE_COPY,
  formatReloadDifferenceNotice,
  useReloadDifferenceStore,
} from '../../stores/reloadDifferenceStore'

vi.mock('../turnService', () => ({
  callOrchestratorTurn: vi.fn(),
  streamOrchestratorTurn: vi.fn(),
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
vi.mock('../../../v5/v5Adapter', () => ({
  callV5Turn: vi.fn(),
  getV5Endpoint: () => 'https://cee.test/orchestrate/v2/turn',
}))
vi.mock('../../../v5/stopTurn', () => ({
  stopV5Turn: vi.fn(() => Promise.resolve({ kind: 'not_saved' })),
  getV5StopEndpoint: () => 'https://cee.test/proxy/v5/turn/stop',
  STOP_ACK_BUDGET_MS: 5000,
}))
vi.mock('../../../v5/eligibility', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../v5/eligibility')>()
  return { ...actual, isV5Eligible: () => ({ eligible: false }), isV5CanonicalRunPath: () => false }
})
vi.mock('../../../lib/posthog', () => ({ trackEvent: vi.fn() }))
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
vi.mock('../../../services/scenarioService', () => ({ loadScenario: async () => null }))

const SCENARIO = '5a1e7ab0-0d04-4dd4-89db-bb6470a98fc5'
const OTHER_SCENARIO = '0b0b0b0b-1111-4222-8333-444444444444'
const LABEL = 'Competitive Pressure'

const SINGLE =
  "The saved model doesn't include Competitive Pressure, so I've taken it off this canvas. " +
  'It may have been removed in another tab, or it may never have finished saving. ' +
  'Add it back if you still want it.'

function noticeMessages(messages: ReadonlyArray<{ content?: string; synthetic?: boolean; role?: string }>) {
  return messages.filter(
    (m) => m.role === 'assistant' && m.synthetic === true && typeof m.content === 'string' &&
      m.content.startsWith("The saved model doesn't include"),
  )
}

function enterScenario(id: string): void {
  scenarios.setCurrentScenarioId(id)
  useCanvasStore.setState({ currentScenarioId: id, nodes: [], edges: [] } as never)
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  __resetTranscriptTombstonesForTests()
  useReloadDifferenceStore.getState().clear()
  enterScenario(SCENARIO)
})

describe('the copy (PROPOSED — Experience Design sign-off)', () => {
  it('one element names it and says it may have been removed elsewhere or never saved', () => {
    expect(formatReloadDifferenceNotice([LABEL])).toBe(SINGLE)
  })

  it('two elements are joined with "and"', () => {
    expect(formatReloadDifferenceNotice([LABEL, 'Customer Price'])).toBe(
      "The saved model doesn't include Competitive Pressure and Customer Price, so I've taken them off this canvas. " +
        'They may have been removed in another tab, or may never have finished saving. ' +
        'Add back any you still want.',
    )
  })

  it('more than two name the first two and count the rest', () => {
    expect(formatReloadDifferenceNotice([LABEL, 'Customer Price', 'Churn', 'Seats'])).toBe(
      "The saved model doesn't include Competitive Pressure, Customer Price and 2 more, so I've taken them off this canvas. " +
        'They may have been removed in another tab, or may never have finished saving. ' +
        'Add back any you still want.',
    )
  })

  it('never blames or says "sync" or "conflict"', () => {
    const all = Object.values(RELOAD_DIFFERENCE_COPY).join(' ').toLowerCase()
    expect(all).not.toMatch(/sync|conflict|your fault|error/)
  })
})

describe('the lasting chat line', () => {
  it('a notice for the CURRENT decision appears as exactly ONE synthetic assistant line', async () => {
    const { result, rerender } = renderHook(() => useConversation())
    await act(async () => { await Promise.resolve() })

    await act(async () => {
      useReloadDifferenceStore.getState().recordRemoval({ scenarioId: SCENARIO, removedLabels: [LABEL] })
      await Promise.resolve()
    })
    rerender()
    await act(async () => { await Promise.resolve() })

    const lines = noticeMessages(result.current.messages)
    expect(lines).toHaveLength(1)
    expect(lines[0].content).toBe(SINGLE)
  })

  it('never twice — not on re-render, not on a remount of the conversation host', async () => {
    const first = renderHook(() => useConversation())
    await act(async () => {
      useReloadDifferenceStore.getState().recordRemoval({ scenarioId: SCENARIO, removedLabels: [LABEL] })
      await Promise.resolve()
    })
    expect(noticeMessages(first.result.current.messages)).toHaveLength(1)
    first.rerender()
    expect(noticeMessages(first.result.current.messages)).toHaveLength(1)
    first.unmount()

    const second = renderHook(() => useConversation())
    await act(async () => { await Promise.resolve() })
    expect(noticeMessages(second.result.current.messages)).toHaveLength(0)
  })

  it('CONTROL: a notice for ANOTHER decision never appears here', async () => {
    const { result } = renderHook(() => useConversation())
    await act(async () => {
      useReloadDifferenceStore.getState().recordRemoval({ scenarioId: OTHER_SCENARIO, removedLabels: [LABEL] })
      await Promise.resolve()
    })
    expect(noticeMessages(result.current.messages)).toHaveLength(0)
  })

  it('ORDERING: a notice already recorded at mount lands AFTER the restored transcript, once', async () => {
    localStorage.setItem(
      TRANSCRIPT_STORAGE_KEY,
      JSON.stringify({
        [SCENARIO]: {
          savedAt: new Date().toISOString(),
          pageLoadId: 'a-previous-page-load',
          dropped: 0,
          messages: [
            { id: 'm1', role: 'user', content: 'Should we raise prices?', ts: new Date().toISOString() },
            { id: 'm2', role: 'assistant', content: 'Here is a first read.', ts: new Date().toISOString() },
          ],
        },
      }),
    )
    useReloadDifferenceStore.getState().recordRemoval({ scenarioId: SCENARIO, removedLabels: [LABEL] })

    const { result } = renderHook(() => useConversation())
    await act(async () => { await Promise.resolve() })

    const ids = result.current.messages.map((m) => m.id)
    expect(ids, 'the restored transcript must not be skipped because the notice got there first').toContain('m1')
    expect(ids).toContain('m2')
    const lines = noticeMessages(result.current.messages)
    expect(lines).toHaveLength(1)
    const messages = result.current.messages
    expect(messages[messages.length - 1].content).toBe(SINGLE)
  })
})

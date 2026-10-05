/** R1b: real panel → send/ref/retry → real payload builder → mocked turn transport.
 * No chip handler, retry handler, metadata builder, store, auth or renderer mock.
 * `chipMeta` is the send option; its transport representation is payload.chip.
 * All four metadata fields below use accepted tokens so equality with the
 * original buildChipMeta result is observable at that boundary.
 */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useConversation, type UseConversationReturn } from '../useConversation'
import { ConversationPanel } from '../ConversationPanel'
import { ChatThread, THREAD_TESTID_DOCKED } from '../zones/ChatThread'
import type { ActionChip } from '../types'
import { buildChipMeta, type ChipMetaInput } from '../chipMeta'
import { OrchestratorTurnPayloadSchema } from '@talchain/schemas/boundary'
import { useCanvasStore } from '../../store'
import { setCurrentScenarioId, clearCurrentScenarioId } from '../../store/scenarios'
import { useGuidanceStore } from '../../stores/guidanceStore'
import { useResultsStore } from '../../stores/resultsStore'
import { useServerConversationTurnsStore } from '../../stores/serverConversationTurnsStore'
import { __resetTranscriptTombstonesForTests } from '../utils/transcriptStore'
import { __resetPersistenceSessionForTests } from '../../../lib/persistenceSession'

const mockCallV5Turn = vi.fn()
vi.mock('../../../v5/v5Adapter', async (original) => ({
  ...await original<typeof import('../../../v5/v5Adapter')>(),
  callV5Turn: (...args: unknown[]) => mockCallV5Turn(...args),
}))

const SID = '561548c3-acd6-4488-b088-399c7cc15631'
const OTHER = '11111111-2222-4333-8444-555555555555'
const LINK_ID = 'agent-test-without-link:["factor:price_rise","goal:mrr"]'
const RETRY_PATHS = ['Try again', 'onRetry'] as const
type RetryPath = typeof RETRY_PATHS[number]
type Press = { name: string; via: 'sendChip' | 'science' | 'label bridge'; label: string; message: string; meta: ChipMetaInput }
const PRESSES: Press[] = [
  { name: 'science what-would-change', via: 'science', label: 'What would change this?',
    message: 'What would most likely change this result?', meta: { id: 'agent-next-what-would-change' } },
  { name: 'science review-decision', via: 'science', label: 'Review this decision',
    message: 'Review this decision', meta: { id: 'agent-next-review-decision' } },
  { name: 'science test-without-link JSON identity', via: 'science', label: 'Test without this link',
    message: 'Test without this link', meta: { id: LINK_ID } },
  { name: 'sendChip test-without-link JSON identity', via: 'sendChip', label: 'Test without this link',
    message: 'Test without this link', meta: { id: LINK_ID } },
  { name: 'sendChip full metadata', via: 'sendChip', label: 'Review this decision',
    message: 'Review this decision', meta: { id: 'agent-next-review-decision', action_type: 'explain_result',
      intent: 'challenge_frame', parameters: { chip_id: 'agent-next-review-decision', target_ids: ['goal:mrr'], nested: { preserve: true } } } },
  { name: 'sendChipByLabelMessage full metadata', via: 'label bridge', label: 'What would change this?',
    message: 'What would most likely change this result?', meta: { id: 'agent-next-what-would-change', action_type: 'what_would_flip',
      intent: 'challenge_assumption', parameters: { chip_id: 'agent-next-what-would-change', threshold: 0, nested: { preserve: ['a', 'b'] } } } },
]

type Payload = { chip?: ReturnType<typeof buildChipMeta>; message: string; turn_id: string; scenario_id: string; source: string }
let conversation: UseConversationReturn
function Panel() {
  conversation = useConversation()
  return <ConversationPanel conversation={conversation} onCollapse={() => {}} onAttach={() => {}} hideComposer />
}
function payload(index: number): Payload {
  expect(mockCallV5Turn.mock.calls.length).toBeGreaterThan(index)
  return mockCallV5Turn.mock.calls[index][0] as Payload
}
async function settled(count: number) {
  await waitFor(() => {
    expect(mockCallV5Turn).toHaveBeenCalledTimes(count)
    expect(conversation.isThinking).toBe(false)
    expect(conversation.lastSendFailure?.retryable).toBe(true)
    const retryChip = conversation.messages.at(-1)?.actionChips?.find(c => c.id === 'retry')
    expect(retryChip).toStrictEqual({ id: 'retry', label: 'Try again', intent: 'primary' })
    // The existing product guard deliberately hides this local chip. Never
    // add fake message/prompt fields or change its renderability to test it.
    expect(screen.queryByTestId('suggested-chip-retry')).toBeNull()
    expect(screen.getByTestId('send-failed-retry')).toBeTruthy()
  })
}
async function press(p: Press, count = 1) {
  await act(async () => {
    if (p.via === 'sendChip') {
      await conversation.sendChip({ id: p.meta.id!, label: p.label, message: p.message, intent: 'primary',
        action_type: p.meta.action_type, wire_intent: p.meta.intent, parameters: p.meta.parameters })
    } else {
      // The science sender IS this registered label/message bridge, as at the
      // Reasoning and inspector call sites. No substitute callback is installed.
      const sendScienceChip = useGuidanceStore.getState()._sendChip
      expect(sendScienceChip).not.toBeNull()
      sendScienceChip!(p.label, p.message, p.meta)
    }
  })
  await settled(count)
}
/** Observe the installed callback at the real panel → ChatThread boundary.
 * React has no public DOM API for a non-rendered chip's component callback.
 * This narrowly reads the mounted React tree (including its current alternate),
 * binding by component AND current messages identity. It mocks nothing and
 * invokes the unmodified minted chip, so the render guard is never bypassed.
 * If the renderer seam changes this fails before any claimed wire evidence.
 */
function panelChipHandler(): (chip: ActionChip) => Promise<void> {
  type Fiber = { type?: unknown; memoizedProps?: {
    messages?: unknown; onChipClick?: (chip: ActionChip) => Promise<void>
  }; return?: Fiber | null; alternate?: Fiber | null }
  const host = screen.getByTestId(THREAD_TESTID_DOCKED)
  const key = Object.keys(host).find(k => k.startsWith('__reactFiber$'))
  expect(key, 'mounted React component tree is available').toBeDefined()
  const start = (host as unknown as Record<string, Fiber>)[key!]
  const visited = new Set<Fiber>()
  const pending = [start]
  while (pending.length) {
    const fiber = pending.pop()!
    if (visited.has(fiber)) continue
    visited.add(fiber)
    if ((fiber.type === ChatThread || fiber.type === (ChatThread as unknown as { type: unknown }).type)
      && fiber.memoizedProps?.messages === conversation.messages
      && fiber.memoizedProps.onChipClick) return fiber.memoizedProps.onChipClick
    if (fiber.return) pending.push(fiber.return)
    if (fiber.alternate) pending.push(fiber.alternate)
  }
  throw new Error('No current real ConversationPanel → ChatThread chip callback')
}
async function retry(path: RetryPath, count: number) {
  await act(async () => {
    if (path === 'Try again') {
      const chip = conversation.messages.at(-1)?.actionChips?.find(c => c.id === 'retry')
      expect(chip?.label).toBe('Try again')
      await panelChipHandler()(chip!)
    } else {
      fireEvent.click(screen.getByTestId('send-failed-retry'))
    }
  })
  await settled(count)
}
function expectSameRequest(original: Payload, retried: Payload) {
  expect(retried.message).toBe(original.message)
  expect(original.turn_id).toMatch(/^[0-9a-f-]{36}$/i)
  expect(retried.turn_id).toBe(original.turn_id)
  expect(retried.scenario_id).toBe(original.scenario_id)
  if (original.chip) {
    // A typed press retries AS ITSELF: CEE hashes the chip into the request, and the shared ingress schema admits
    // `chip` only on 'chip' | 'chip_click' sources. 'retry' + chip would be refused on the wire.
    expect(['chip', 'chip_click']).toContain(original.source)
    expect(retried.source).toBe(original.source)
  } else {
    expect(retried.source).toBe('retry')
  }
  // The exact schema CEE validates ingress with: the retried wire payload must be admissible.
  expect(() => OrchestratorTurnPayloadSchema.parse(retried)).not.toThrow()
}
function expectFreeText(p: Payload) {
  expect(p).not.toHaveProperty('chip')
  expect(p).not.toHaveProperty('chipMeta') // internal metadata is never a second wire field
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  __resetTranscriptTombstonesForTests()
  __resetPersistenceSessionForTests()
  vi.stubEnv('VITE_FEATURE_THREAD_PERSIST', 'false')
  vi.stubEnv('VITE_FEATURE_THREAD_HYDRATE', 'false')
  Element.prototype.scrollIntoView = vi.fn()
  useCanvasStore.getState().resetCanvas()
  setCurrentScenarioId(SID)
  useCanvasStore.setState({ currentScenarioId: SID, scenarioPersistedToDb: false, _hydratedThread: null,
    // An existing model uses the buffered turn: no stream stub or fallback required.
    nodes: [{ id: 'factor:price_rise', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Price rise' } }], edges: [] })
  useResultsStore.setState(state => ({ results: { ...state.results, status: 'idle', lastSnapshotId: null, analysisSummary: undefined } }))
  useServerConversationTurnsStore.setState({ offer: null })
  mockCallV5Turn.mockReset()
  mockCallV5Turn.mockResolvedValue({ kind: 'boundary_error', error: {
    error: 'INTERNAL_ERROR', boundary: 'B1', direction: 'egress', validator: 'draft_graph_pipeline',
    request_id: 'r1b-retryable-failure', retryable: true,
    details: { retryable: true, pipeline_error_code: 'CEE_LLM_VALIDATION_FAILED', stage: 'frame' },
  } })
})
afterEach(() => { cleanup(); vi.unstubAllEnvs() })

describe('R1b outgoing typed retry', () => {
  for (const p of PRESSES) for (const path of RETRY_PATHS) {
    it(`TYPED ${p.name} → retryable failure → ${path} preserves chipMeta, message and client turn id`, async () => {
      render(<Panel />)
      await press(p)
      const original = payload(0)
      const meta = buildChipMeta(p.meta)
      expect(original.chip?.id).toBe(p.meta.id)
      expect(original.chip).toStrictEqual(meta)
      await retry(path, 2)
      const retried = payload(1)
      expectSameRequest(original, retried)
      // Observe call 2 by order AND identity, never filter away a dropped chip.
      expect(retried.chip?.id).toBe(p.meta.id)
      expect(retried.chip).toStrictEqual(meta)
      expect(retried.chip).toStrictEqual(original.chip)
      expect(conversation.messages.filter(m => m.role === 'user')).toHaveLength(1)
    })
  }
  for (const path of RETRY_PATHS) {
    it(`CONTROL free text → retryable failure → ${path} stays free text`, async () => {
      render(<Panel />)
      await act(async () => { await conversation.sendMessage('How should we frame this work?') })
      await settled(1)
      expectFreeText(payload(0))
      await retry(path, 2)
      expectSameRequest(payload(0), payload(1))
      expectFreeText(payload(1))
    })
    it(`CONTROL failed typed press → later free text → retryable failure → ${path} clears chip`, async () => {
      render(<Panel />)
      await press(PRESSES[0])
      expect(payload(0).chip?.id).toBe(PRESSES[0].meta.id)
      await act(async () => { await conversation.sendMessage('What assumptions have we missed?') })
      await settled(2)
      expectFreeText(payload(1))
      expect(payload(1).turn_id).not.toBe(payload(0).turn_id)
      await retry(path, 3)
      expectSameRequest(payload(1), payload(2))
      expectFreeText(payload(2))
    })
  }
  for (const destination of [OTHER, null]) {
    it(`ISOLATION failed typed press → scenario ${destination === null ? 'cleared' : 'switch'} → retryLast sends nothing`, async () => {
      render(<Panel />)
      await press(PRESSES[0])
      await act(async () => {
        if (destination === null) clearCurrentScenarioId(); else setCurrentScenarioId(destination)
        useCanvasStore.setState({ currentScenarioId: destination })
      })
      await act(async () => { await conversation.retryLast() })
      expect(mockCallV5Turn).toHaveBeenCalledTimes(1)
    })
  }
  it('ISOLATION failed free text → scenario switch → retryLast sends nothing', async () => {
    render(<Panel />)
    await act(async () => { await conversation.sendMessage('Keep our reasoning in this workspace') })
    await settled(1)
    await act(async () => { setCurrentScenarioId(OTHER); useCanvasStore.setState({ currentScenarioId: OTHER }) })
    await act(async () => { await conversation.retryLast() })
    expect(mockCallV5Turn).toHaveBeenCalledTimes(1)
  })
  for (const path of RETRY_PATHS) {
    it(`TYPED initial lazy scenario assignment → ${path} keeps the original press`, async () => {
      clearCurrentScenarioId()
      useCanvasStore.setState({ currentScenarioId: null })
      render(<Panel />)
      await press(PRESSES[0])
      expect(payload(0).scenario_id).toBe(useCanvasStore.getState().currentScenarioId)
      await retry(path, 2)
      expectSameRequest(payload(0), payload(1))
      expect(payload(1).chip?.id).toBe(PRESSES[0].meta.id)
      expect(payload(1).chip).toStrictEqual(buildChipMeta(PRESSES[0].meta))
    })
  }
})

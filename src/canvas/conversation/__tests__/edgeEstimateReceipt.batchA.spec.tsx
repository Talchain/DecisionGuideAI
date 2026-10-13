import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, renderHook, screen, act, cleanup } from '@testing-library/react'
import { useConversation } from '../useConversation'
import { MessageBubble } from '../MessageBubble'
import { useCanvasStore } from '../../store'

vi.mock('../turnService', () => ({
  callOrchestratorTurn: vi.fn(),
  streamOrchestratorTurn: vi.fn(),
  OrchestratorError: class OrchestratorError extends Error {},
}))
vi.mock('../../../lib/supabase', () => ({
  getUserId: async () => null,
  getSessionIdentity: async () => ({ userId: null, accessToken: null }),
}))
vi.mock('../../../services/scenarioService', () => ({
  loadScenario: async () => null,
  storeAnalysis: async () => undefined,
}))
vi.mock('../../../lib/posthog', () => ({ trackEvent: () => undefined }))
vi.mock('../../../flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../flags')>()
  return { ...actual, isOrchestratorV2Enabled: () => true, isOrchestratorStreamingEnabled: () => false }
})
vi.mock('../../../v5/eligibility', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../v5/eligibility')>()
  return { ...actual, isV5Eligible: () => ({ eligible: true }), isV5CanonicalRunPath: () => false }
})


const GUIDANCE = "There's no Olumi estimate for this link yet — give your own figure or ask Olumi to estimate it."
const RECEIPT = "You accepted Olumi's estimate for how much Price changes Revenue."
const EVENT = { type: 'edge_strength_edit', payload: {
  from: 'fac_price', to: 'goal_revenue', magnitude: 0.4, direction_intent: 'preserve',
  expected: { mean: 0.4, effect_direction: 'positive' }, intent: 'confirm_current',
} } as const

beforeEach(() => {
  useCanvasStore.setState({
    currentScenarioId: 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4',
    nodes: [], edges: [], results: { status: 'idle' } as never,
    currentScenarioLastResultHash: null,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

// CEE composeRecoverableHandlerResponse emits the no_olumi_estimate D1 guidance
// as assistant_text with blocks: [], not a BoundaryError or a noop patch.
async function receive(text: string, blocks: unknown[] = []) {
  const fetchStub = vi.fn(async () => new Response(JSON.stringify({
    response_version: 2, assistant_text: text, blocks,
    suggested_actions: [], insights: [], stage_indicator: 'frame',
  }), { status: 200, headers: { 'content-type': 'application/json' } }))
  vi.stubGlobal('fetch', fetchStub)
  const { result } = renderHook(() => useConversation())
  await act(async () => { await result.current.sendSystemEvent(EVENT, { deferIfBusy: false }) })
  expect(fetchStub).toHaveBeenCalledTimes(1)
  const message = result.current.messages.at(-1)!
  expect(message.role).toBe('assistant')
  expect(message.content).toBe(text)
  expect(result.current.lastSendFailure).toBeNull()
  render(<MessageBubble message={message} onChipClick={async () => {}} />)
  return message
}

describe('Batch A CEE receipts through the real adapter, dispatcher and message renderer', () => {
  it('no_olumi_estimate displays CEE guidance and its next step without an error or already-set card', async () => {
    await receive(GUIDANCE)
    expect(screen.getByTestId('message-assistant')).toHaveTextContent(GUIDANCE)
    expect(screen.queryByTestId('v5-change-receipt')).toBeNull()
    expect(screen.queryByText(/No change|Connection strength already set/)).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it.each([
    RECEIPT, // edge_strength_edit composer
    "Confirmed Olumi's estimate for the link between Price and Revenue without a numerical change.", // D1 handler
  ])('genuine confirmation keeps CEE receipt wording: %s', async (receipt) => {
    const tuple = { from: 'fac_price', to: 'goal_revenue', strength: { mean: 0.4, std: 0.1 }, effect_direction: 'positive' }
    await receive(receipt, [{ type: 'graph_patch', status: 'noop', operation: 'adjust_edge_strength',
      target_id: 'fac_price→goal_revenue', before: tuple, after: tuple }])
    expect(screen.getByTestId('message-assistant')).toHaveTextContent(receipt)
  })
})

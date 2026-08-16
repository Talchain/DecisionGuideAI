/**
 * Real adoption chain: raw HTTP bytes -> callV5Turn -> strict
 * parseV5Response -> routeV5Response -> useConversation -> MessageBubble DOM.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, renderHook, screen } from '@testing-library/react'

import { useCanvasStore } from '../../store'
import { MessageBubble } from '../MessageBubble'
import { buildHistory, useConversation } from '../useConversation'

const mockV4Turn = vi.fn()

vi.mock('../turnService', () => ({
  callOrchestratorTurn: (...args: unknown[]) => mockV4Turn(...args),
  streamOrchestratorTurn: (...args: unknown[]) => mockV4Turn(...args),
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
  return {
    ...actual,
    isOrchestratorV2Enabled: () => true,
    isOrchestratorStreamingEnabled: () => false,
  }
})

vi.mock('../../../v5/eligibility', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../v5/eligibility')>()
  return {
    ...actual,
    isV5Eligible: () => ({ eligible: true as const }),
    isV5CanonicalRunPath: () => false,
  }
})

const BASE_WIRE = {
  response_version: 2,
  assistant_text: 'A first model is ready.',
  blocks: [],
  suggested_actions: [],
  insights: [],
  stage_indicator: 'frame',
} as const

const VALID_NOTICES = {
  total_count: 3,
  groups: [
    { kind: 'detail_not_connected', count: 1 },
    { kind: 'relationship_not_used', count: 2 },
  ],
  details_redacted: true,
} as const

function stubWire(body: unknown) {
  const fetchStub = vi.fn(async () => new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  }))
  vi.stubGlobal('fetch', fetchStub)
  return fetchStub
}

function lastAssistant(messages: ReturnType<typeof useConversation>['messages']) {
  return [...messages].reverse().find((message) => message.role === 'assistant')
}

beforeEach(() => {
  localStorage.clear()
  mockV4Turn.mockReset()
  useCanvasStore.setState({
    currentScenarioId: 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4',
    nodes: [],
    edges: [],
    results: { status: 'idle' } as never,
    currentScenarioLastResultHash: null,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('model-building notices — real V5 reader chain', () => {
  it('carries validated notices ephemerally into the assistant DOM and not conversation context', async () => {
    const fetchStub = stubWire({
      ...BASE_WIRE,
      model_building_notices: VALID_NOTICES,
    })
    const { result } = renderHook(() => useConversation())

    await act(async () => {
      await result.current.sendMessage('Build a model of this situation')
    })

    // A cold first turn may probe the streamed sibling and transparently
    // fall back to the buffered endpoint; either way the buffered response
    // bytes below travel through the single production parser.
    expect(fetchStub).toHaveBeenCalled()
    expect(mockV4Turn).not.toHaveBeenCalled()
    const message = lastAssistant(result.current.messages)
    expect(message?.modelBuildingNotices).toEqual(VALID_NOTICES)

    const contextBytes = JSON.stringify(buildHistory([message!], 5))
    expect(contextBytes).not.toContain('modelBuildingNotices')
    expect(contextBytes).not.toContain('model_building_notices')
    expect(contextBytes).not.toContain('detail_not_connected')

    render(<MessageBubble message={message!} onChipClick={async () => {}} />)
    const strip = screen.getByRole('note', { name: 'Model-building notices' })
    expect(strip.textContent).toContain('3 modelling choices noted')
    expect(strip.textContent).toContain('1 detail not connected')
    expect(strip.textContent).toContain('2 relationships not used')
  })

  it('legacy no-field response keeps the carrier absent and renders no notice DOM', async () => {
    stubWire(BASE_WIRE)
    const { result } = renderHook(() => useConversation())

    await act(async () => {
      await result.current.sendMessage('Continue')
    })

    const message = lastAssistant(result.current.messages)
    expect(message?.modelBuildingNotices).toBeUndefined()
    render(<MessageBubble message={message!} onChipClick={async () => {}} />)
    expect(screen.queryByTestId('model-building-notices')).toBeNull()
  })

  it('malformed wire fails the strict response parse and cannot partially render a notice', async () => {
    stubWire({
      ...BASE_WIRE,
      model_building_notices: {
        ...VALID_NOTICES,
        total_count: 99,
      },
    })
    const { result } = renderHook(() => useConversation())

    await act(async () => {
      await result.current.sendMessage('Continue')
    })

    const message = lastAssistant(result.current.messages)
    expect(message).toBeDefined()
    expect(message?.modelBuildingNotices).toBeUndefined()
    render(<MessageBubble message={message!} onChipClick={async () => {}} />)
    expect(screen.queryByTestId('model-building-notices')).toBeNull()
  })
})

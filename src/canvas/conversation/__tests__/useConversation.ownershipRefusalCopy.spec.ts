/** Ownership refusal: real buffered parser → router → conversation → mounted surfaces. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { render, screen, cleanup, renderHook, act, fireEvent } from '@testing-library/react'
import { ConversationProvider, useConversationContext } from '../ConversationContext'
import { ChatThread } from '../zones/ChatThread'
import { FirstUseComposer } from '../../components/FirstUseComposer'
import { useFloatingPanelState } from '../../hooks/useFloatingPanelState'
import { useCanvasStore } from '../../store'
import { useDraftStore } from '../../stores/draftStore'
import { parseV5Response } from '../../../v5/responseParser'

const mockCallTurn = vi.fn()
vi.mock('../turnService', () => ({
  callOrchestratorTurn: (...args: unknown[]) => mockCallTurn(...args),
  streamOrchestratorTurn: (...args: unknown[]) => mockCallTurn(...args),
  OrchestratorError: class OrchestratorError extends Error {
    status: number
    body: unknown
    constructor(msg: string, status: number, body: unknown) {
      super(msg)
      this.name = 'OrchestratorError'
      this.status = status
      this.body = body
    }
  },
}))

vi.mock('../../../lib/supabase', () => ({
  getUserId: async () => null,
  getSessionIdentity: async () => ({ userId: null, accessToken: null }),
}))

vi.mock('../../../services/scenarioService', () => ({
  loadScenario: async () => null,
  storeAnalysis: async () => undefined,
}))

vi.mock('../../../lib/posthog', () => ({
  trackEvent: () => undefined,
}))

vi.mock('../../../v5/eligibility', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../v5/eligibility')>()
  return {
    ...actual,
    isV5Eligible: () => ({ eligible: true }),
    isV5CanonicalRunPath: () => false,
  }
})


vi.mock('../../../adapters/plot', () => ({ plot: { templates: () => new Promise(() => {}) } }))
vi.mock('../../hooks/useStageAwarePlaceholder', () => ({ useStageAwarePlaceholder: () => 'Describe your model…' }))
vi.mock('../../hooks/useSelectionContext', () => ({ useSelectionContext: () => null }))
vi.mock('../../hooks/usePrefersReducedMotion', () => ({ usePrefersReducedMotion: () => true }))

const NOT_OWNER = "Nothing was saved. You don't have access to change this model."
const UNREADABLE = "Nothing was saved. I couldn't check access to this model. Try again."
const CODE_ONLY = "You don't have access to change this model."
const GENERIC = 'Something went wrong on our side. Please retry.'
const ERROR = 'model_write_ownership_refused'
const UNEXPECTED = 'SECRET arbitrary server text: saved everything; please contact admin'

function stubFetchWith(status: number, body: unknown) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), {
    status, headers: { 'content-type': 'application/json' },
  })))
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
  useDraftStore.getState().resetDraft()
  useFloatingPanelState.getState().reset()
  useFloatingPanelState.getState().open('system-first-use')
  useCanvasStore.setState({
    currentScenarioId: 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4',
    nodes: [], edges: [], results: { status: 'idle' } as never,
    currentScenarioLastResultHash: null,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks() })

function Wrapper({ children }: { children: ReactNode }) {
  return createElement(ConversationProvider, null, children, createElement(FirstUseComposer))
}

describe('ownership refusal copy and retryability at the real V5 surface', () => {
  it.each([
    { row: 'canonical not_owner', status: 403, body: { error: ERROR, message: NOT_OWNER }, words: NOT_OWNER, retry: false, ownership: true },
    { row: 'canonical owner_unreadable', status: 403, body: { error: ERROR, message: UNREADABLE }, words: UNREADABLE, retry: true, ownership: true },
    { row: 'code-only', status: 403, body: { error: ERROR }, words: CODE_ONLY, retry: false, ownership: true },
    { row: 'unexpected message is never echoed', status: 403, body: { error: ERROR, message: UNEXPECTED }, words: CODE_ONLY, retry: false, ownership: true },
    { row: 'generic 403 control', status: 403, body: { error: 'some_other_error' }, words: GENERIC, retry: true, ownership: false },
    { row: '500 control with the ownership body', status: 500, body: { error: ERROR, message: NOT_OWNER }, words: GENERIC, retry: true, ownership: false },
  ])('$row → exact words and honest retry controls', async ({ status, body, words, retry, ownership }) => {
    stubFetchWith(status, body)
    const { result } = renderHook(() => useConversationContext(), { wrapper: Wrapper })
    await act(async () => { await result.current.sendMessage('Change churn to 80%') })
    const last = result.current.messages.at(-1)!
    expect(last.role).toBe('assistant')
    expect(last.content).toBe(words)
    expect(last.actionChips).toEqual(retry ? [{ id: 'retry', label: 'Try again', intent: 'primary', ...(ownership ? { message: 'Change churn to 80%' } : {}) }] : [])
    expect(result.current.lastSendFailure?.retryable).toBe(retry)
    expect(result.current.messages.find(m => m.role === 'user')?.deliveryState).toBe(ownership ? 'sent' : 'failed')
    if (ownership) expect(screen.getByTestId('first-use-send-failure').querySelector('p')?.textContent).toBe(words)
    const { container } = render(createElement(ChatThread, {
      messages: result.current.messages, isThinking: false, longRunningHint: null, nodeCount: 0,
      patchBlockStates: new Map(), patchRejections: new Map(), onChipClick: async () => {},
      onPatchAccept: () => {}, onPatchDismiss: () => {}, onFeedback: () => {}, onRetry: () => {},
    }))
    expect(container.querySelector('[data-testid="message-assistant"] [data-testid="message-body-text"]')?.textContent).toBe(words)
    // The base deliberately suppresses generic retry chips; ownership unreadable offers its own.
    expect(container.querySelector('[data-testid="suggested-chip-retry"]') !== null).toBe(ownership && retry)
    expect(container.querySelector('[aria-label="Retry sending this message"]') !== null).toBe(!ownership)
    if (ownership) expect(container.textContent).not.toContain('Not delivered')
    const assistant = container.querySelector('[data-testid="chat-message-assistant"]')!
    fireEvent.click(assistant.querySelector('[data-testid="message-menu-trigger"]')!)
    expect(assistant.querySelector('[data-testid="message-menu-retry"]') !== null).toBe(retry)
    expect(container.textContent).not.toContain(UNEXPECTED)
    if (words === CODE_ONLY) {
      expect(container.textContent).not.toMatch(/saved/i)
      expect(screen.getByTestId('first-use-send-failure').textContent).not.toMatch(/saved/i)
    }
  })

  it.each([
    { error: ERROR, message: 42 },
    { error: ERROR, message: null },
    { error: ERROR, retryable: true },
    { error: ERROR, message: NOT_OWNER, _diagnostic_trace: {} },
    null, [ERROR],
  ])('strict ownership admission rejects %j without widening the generic parse path', async body => {
    const parsed = await parseV5Response(new Response(JSON.stringify(body), { status: 403 }))
    expect(parsed).toMatchObject({ kind: 'parse_error', parse_failure_kind: 'non_ok_non_boundary', raw: body })
  })
})

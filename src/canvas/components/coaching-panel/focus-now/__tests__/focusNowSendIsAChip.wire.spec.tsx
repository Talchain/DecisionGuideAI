/**
 * T1H-2 (14 Oct): the Focus-now row prompt is OLUMI's text. `useFocusNow` auto-sent
 * it through `_sendMessage` without a chip, so it reached CEE as `source: 'composer'`
 * — the user's own typed words. It now travels as chip `focus_now_prompt`.
 *
 * Lives inside the focus-now module (not beside `olumiTextIsAChip.wire.spec.tsx`)
 * because its `inertness.spec.ts` forbids importing Focus Now from outside it.
 *
 * REAL chain: useFocusNow → FocusNowPanel "Try this" → the `_sendMessage`
 * the REAL ConversationPanel registers → `useConversation().sendMessage` →
 * `buildV5Payload` → the body handed to `callV5Turn` (the one mocked seam).
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'

const mockCallV5Turn = vi.fn()
vi.mock('../../../../../v5/v5Adapter', async (original) => ({
  ...await original<typeof import('../../../../../v5/v5Adapter')>(),
  callV5Turn: (...args: unknown[]) => mockCallV5Turn(...args),
}))

import { useConversation, type UseConversationReturn } from '../../../../conversation/useConversation'
import { ConversationPanel } from '../../../../conversation/ConversationPanel'
import { OLUMI_TEXT_CHIP_IDS } from '../../../../conversation/chipMeta'
import { useCanvasStore } from '../../../../store'
import { setCurrentScenarioId } from '../../../../store/scenarios'
import { __resetTranscriptTombstonesForTests } from '../../../../conversation/utils/transcriptStore'
import { __resetPersistenceSessionForTests } from '../../../../../lib/persistenceSession'
import { useFocusNow } from '../useFocusNow'
import { FocusNowPanel } from '../FocusNowPanel'

const SID = '0b9e3c44-1f6a-4c1e-8f0d-5a7d2e9b6c21'
type Payload = { chip?: { id?: string }; message: string; source: string }

let conversation: UseConversationReturn
function Host({ children }: { children: ReactNode }) {
  conversation = useConversation()
  return <><ConversationPanel conversation={conversation} onCollapse={() => {}} onAttach={() => {}} hideComposer />{children}</>
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
  useCanvasStore.setState({ currentScenarioId: SID, scenarioPersistedToDb: false, _hydratedThread: null } as never)
  mockCallV5Turn.mockReset()
  mockCallV5Turn.mockResolvedValue({ kind: 'boundary_error', error: {
    error: 'INTERNAL_ERROR', boundary: 'B1', direction: 'egress', validator: 'draft_graph_pipeline',
    request_id: 't1h2-focus-now', retryable: true,
    details: { retryable: true, pipeline_error_code: 'CEE_LLM_VALIDATION_FAILED', stage: 'frame' },
  } })
})
afterEach(() => { cleanup(); vi.unstubAllEnvs() })

describe('T1H-2 — Focus-now row prompt', () => {
  it('"Try this" on "Add a risk worth watching" → chip focus_now_prompt, prompt unchanged', async () => {
    // `actionsEnabled` also needs aiPanelV2 (a reveal precondition, not the send); passed so the control renders.
    function FocusProbe() { return <FocusNowPanel {...useFocusNow()} actionsEnabled /> }
    render(<Host><FocusProbe /></Host>)
    fireEvent.click(screen.getByRole('button', { name: /add a risk worth watching/i }))
    await act(async () => { fireEvent.click(screen.getByTestId('focus-action')) })
    await waitFor(() => expect(mockCallV5Turn).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(conversation.isThinking).toBe(false))
    const body = mockCallV5Turn.mock.calls[0][0] as Payload
    expect(body.source).toBe('chip')
    expect(body.chip?.id).toBe(OLUMI_TEXT_CHIP_IDS.focusNowPrompt)
    expect(body.message).toBe('Help me think through a risk worth adding to this decision.')
  })
})

/**
 * T1H-2 (14 Oct): the act-on-it row's chat prompt is OLUMI's text. Sent through
 * `_sendMessage` without a chip it reached CEE as `source: 'composer'` — the
 * user's own typed words. It now travels as chip `act_on_it_row`.
 *
 * Lives inside the hero module (not beside `olumiTextIsAChip.wire.spec.tsx`)
 * because `inertness.spec.ts` forbids importing the hero from outside it.
 *
 * REAL chain: AnalysisHeroContainer → act-on-it row action → the `_sendMessage`
 * the REAL ConversationPanel registers → `useConversation().sendMessage` →
 * `buildV5Payload` → the body handed to `callV5Turn` (the one mocked seam).
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'

const mockCallV5Turn = vi.fn()
vi.mock('../../../../v5/v5Adapter', async (original) => ({
  ...await original<typeof import('../../../../v5/v5Adapter')>(),
  callV5Turn: (...args: unknown[]) => mockCallV5Turn(...args),
}))

import { useConversation, type UseConversationReturn } from '../../../../canvas/conversation/useConversation'
import { ConversationPanel } from '../../../../canvas/conversation/ConversationPanel'
import { OLUMI_TEXT_CHIP_IDS } from '../../../../canvas/conversation/chipMeta'
import { useCanvasStore } from '../../../../canvas/store'
import { setCurrentScenarioId } from '../../../../canvas/store/scenarios'
import { __resetTranscriptTombstonesForTests } from '../../../../canvas/conversation/utils/transcriptStore'
import { __resetPersistenceSessionForTests } from '../../../../lib/persistenceSession'
import { AnalysisHeroContainer } from '../AnalysisHeroContainer'
import { makeHeroData } from '../__fixtures__/hero.fixtures'
import { withGoalChanceReport } from '../../__tests__/helpers/goalChanceReport'
import { mapM2BiasFindings } from '../../mapM2BiasFindings'

const SID = '7d0c1a52-55a4-4d4f-9a39-2c1f0b6d3e11'
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
    request_id: 't1h2-act-on-it', retryable: true,
    details: { retryable: true, pipeline_error_code: 'CEE_LLM_VALIDATION_FAILED', stage: 'frame' },
  } })
})
afterEach(() => { cleanup(); vi.unstubAllEnvs() })

describe('T1H-2 — act-on-it row action', () => {
  it('"Work through with AI" on a reflect row → chip act_on_it_row, the row\'s prompt unchanged', async () => {
    const data = withGoalChanceReport(makeHeroData())
    ;(data.confidence as unknown as { m2BiasFindings: unknown }).m2BiasFindings = mapM2BiasFindings([{
      id: 'rev-bias-1', type: 'SUNK_COST', description: 'Past spend is shaping the preference more than the outcome does.',
    }])
    render(<Host><AnalysisHeroContainer data={data} /></Host>)
    const row = screen.getByTestId('hero-act-on-it-row-reflect')
    await act(async () => { fireEvent.click(within(row).getByRole('button', { name: 'Work through with AI' })) })
    await waitFor(() => expect(mockCallV5Turn).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(conversation.isThinking).toBe(false))
    const body = mockCallV5Turn.mock.calls[0][0] as Payload
    expect(body.source).toBe('chip')
    expect(body.chip?.id).toBe(OLUMI_TEXT_CHIP_IDS.actOnItRow)
    expect(body.message).toBe(PROMPT)
  })
})

/** Hand-pinned from the reflect row's producer (`rankActOnItRows.reflectRows`), never derived at runtime. */
const PROMPT = 'Help me with SUNK_COST. Ask one focused question first, then suggest the smallest useful update.'

/** REVIEWER PROBE (Claude, DGAI #2813 @a14523d7) — NOT FOR COMMIT.
 * Served G2 row 7b: tab A's canonical re-read completed with exit 'merged' 0.8 s after its 409, yet the write base the
 * settlement watches never moved and the editor kept 2 while the server held 5. Hypothesis H: the re-read answered with
 * the PRE-tab-B graph (b275a016, 0.2). Same real chain as the PR's wire rows; only the GET answer differs. */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { createElement } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { ConversationProvider } from '../ConversationContext'
import { OptionNode } from '../../nodes/OptionNode'
import { mergeServerGraphOnHydrate } from '../../utils/mergeServerGraph'
import conflictCapture from './fixtures/option-edit-conflict-2b073341.json'
import { scenarioGraphUrl } from '../../../adapters/cee/scenarioGraph'
import { useCanvasStore } from '../../store'

vi.mock('../turnService', () => ({
  callOrchestratorTurn: vi.fn(), streamOrchestratorTurn: vi.fn(),
  OrchestratorError: class OrchestratorError extends Error {},
}))
vi.mock('../../../lib/supabase', () => ({
  getUserId: async () => null, getSessionIdentity: async () => ({ userId: null, accessToken: null }),
}))
vi.mock('../../../services/scenarioService', () => ({ loadScenario: async () => null, storeAnalysis: async () => undefined }))
vi.mock('../../../lib/posthog', () => ({ trackEvent: () => undefined }))
vi.mock('../../../flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../flags')>()
  return { ...actual, isOrchestratorV2Enabled: () => true, isOrchestratorStreamingEnabled: () => false }
})
vi.mock('../../../v5/eligibility', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../v5/eligibility')>()
  return { ...actual, isV5Eligible: () => ({ eligible: true }), isV5CanonicalRunPath: () => false }
})
vi.mock('@xyflow/react', async original => ({ ...await original<typeof import('@xyflow/react')>(), Handle: () => null }))

describe('PROBE served 7b: 409, then a canonical read that answers with the pre-winner graph', () => {
  const optionId = 'add_one_specialist'
  const factorId = 'number_of_additional_specialists'
  const editorId = `option-value-editor-${optionId}-${factorId}`
  let reads = 0
  let posts = 0
  function LiveOption() {
    const option = useCanvasStore(state => state.nodes.find(node => node.id === optionId))!
    return createElement(OptionNode, {
      id: option.id, data: option.data, type: 'option', position: option.position,
      selected: false, isConnectable: true, positionAbsoluteX: 0, positionAbsoluteY: 0,
      dragging: false, zIndex: 0, deletable: true, selectable: true, draggable: true,
    } as never)
  }
  beforeEach(() => {
    reads = 0; posts = 0
    useCanvasStore.setState({ currentScenarioId: conflictCapture.before.scenario_id,
      nodes: [], edges: [], importPendingServerRegistration: false, serverGraphIdentity: null,
      analysisFreshnessDirty: false, ceeAnalysisReady: null, lastServerGraphHash: null } as never)
    expect(mergeServerGraphOnHydrate(conflictCapture.before.graph).accepted).toBe(true)
    useCanvasStore.setState({ lastServerGraphHash: conflictCapture.before.graph_hash })
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      if (String(url) === scenarioGraphUrl(conflictCapture.before.scenario_id)) {
        reads += 1
        return new Response(JSON.stringify(conflictCapture.before), { status: 200 }) // H: pre-winner answer
      }
      if (init?.method === 'POST') { posts += 1; return new Response(JSON.stringify(conflictCapture.conflict), { status: 409 }) }
      throw new Error(`Unexpected HTTP boundary: ${String(url)}`)
    }))
  })

  it('records what the losing card says and shows 30 s after the 409', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      render(createElement(ReactFlowProvider, null, createElement(ConversationProvider, null, createElement(LiveOption))))
      fireEvent.click(screen.getByTestId(editorId))
      const input = screen.getByTestId(`${editorId}-input`) as HTMLInputElement
      fireEvent.change(input, { target: { value: '4' } })
      fireEvent.keyDown(input, { key: 'Enter' })
      await act(async () => { await vi.advanceTimersByTimeAsync(0) })
      await act(async () => { await vi.advanceTimersByTimeAsync(30_001) })
      const word = screen.queryByTestId(`${editorId}-settlement`)?.textContent ?? null
      const shown = screen.getByTestId(editorId).textContent
      // eslint-disable-next-line no-console
      console.log('PROBE_RESULT', JSON.stringify({ word, shown, reads, posts, base: useCanvasStore.getState().lastServerGraphHash }))
      expect(posts).toBe(1)
      expect(reads).toBe(1)
      expect(useCanvasStore.getState().lastServerGraphHash).toBe(conflictCapture.before.graph_hash)
      expect(shown).toMatch(/2 specialists/)
      expect(word).toBe('Not saved on this attempt. The latest model could not be refreshed. Reload it before editing again.')
    } finally {
      vi.useRealTimers()
    }
  })
})

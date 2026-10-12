/**
 * ⭐ RECOVERY BATCH R3 — the receipt after a lost revision race (served `live/runs/2026-10-12T144844Z/capacity`, row 6).
 * Self-contained (its own store seam), so the same file runs on staging a9a5c26f (RED) and on B UI (GREEN).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import type { ReactNode } from 'react'
import { OptionNode } from '../OptionNode'
import { settleSystemEventSend } from '../../conversation/settleSystemEventSend'
import { SystemEventSendError } from '../../conversation/useConversation'

vi.mock('@xyflow/react', async () => ({ ...(await vi.importActual('@xyflow/react')), Handle: () => null }))
vi.mock('../shared/NodePopover', () => ({ NodePopover: ({ children }: { children: ReactNode }) => <div>{children}</div> }))
vi.mock('../shared/openNodeInspector', () => ({ openNodeInspector: vi.fn(() => true) }))
// The served 409 is built with the real `SystemEventSendError`; its module reads the session through this seam.
vi.mock('../../../lib/supabase', () => ({
  getUserId: async () => null,
  getSessionIdentity: async () => ({ userId: null, accessToken: null }),
}))

/** What a row puts in the store (the served nodes, the write base); `storeListeners` hear each replacement. */
let storeOverlay: Record<string, unknown> = {}
const storeListeners = new Set<() => void>()
const makeStoreState = () => ({
  hoveredOptionId: null, nodes: [], edges: [], ceeAnalysisReady: null, results: { status: 'idle' },
  highlightedNodes: new Set(), dimmedNodeIds: new Set(), lens: { _dimmedNodeIds: new Set() }, goalThreshold: null,
  goalConstraints: [], setHoveredOption: vi.fn(), viewMode: 'standard', lodRung: 'full', lastServerGraphHash: null,
  ...storeOverlay,
})
vi.mock('../../store', () => ({
  useCanvasStore: Object.assign(vi.fn((selector: (s: unknown) => unknown) => selector(makeStoreState())), {
    getState: () => makeStoreState(),
    subscribe: (listener: () => void) => { storeListeners.add(listener); return () => { storeListeners.delete(listener) } },
  }),
}))
vi.mock('../../layoutStore', () => ({ useLayoutStore: vi.fn((selector: (s: unknown) => unknown) => selector({ layoutNodeWidth: null })) }))
vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({ sensitivityRank: null, influence: null, confidence: null, inSensitivityAnalysis: false,
    achievementProbability: null, stabilityPercentage: null, winRate: null, isResultsMode: false, predictedOutcome: null,
    valueOfInformation: null, voiRank: null })),
}))
const proposeOptionIntervention = vi.fn((..._args: unknown[]) => 'dispatched')
vi.mock('../../hooks/useModelEditAuthority', async (orig) => ({
  ...(await orig<typeof import('../../hooks/useModelEditAuthority')>()),
  useModelEditAuthority: () => new Proxy({}, { get: (_t, k) => (k === 'proposeOptionIntervention' ? proposeOptionIntervention : () => undefined) }),
}))
beforeEach(() => { proposeOptionIntervention.mockClear(); storeOverlay = {}; storeListeners.clear() })

/**
 * TWO TABS, ONE VALUE (served `live/runs/2026-10-12T144844Z/capacity`, row 6 "conflict"; UI
 * 52936df0, CEE aadcf897). Both tabs opened on revision 3 (graph e311efdf92f354f5), "Add one specialist" at 2. Tab A
 * set 4 (200, graph c145ce4a9c520a3a, revision 4); tab B set 5 on the old base and got 409 `revision_conflict`
 * (expected 3, current 4). Tab B said "Not saved. The model kept its previous value; Olumi's reply says why." and
 * showed 2, while the model held 4 and no reply came (its chat stayed empty). The nodes, hashes and envelope below are
 * the served bytes (turns/05–07.json).
 */
describe('a send that lost a revision race says what the saved model holds, and claims no reply', () => {
  const OPTION_ID = 'add_one_specialist'
  const FACTOR_ID = 'additional_specialists'
  const MATCH = { node_id: FACTOR_ID, confidence: 'high', match_type: 'exact_id' }
  /** turns/05.json `draft_graph`: the factor (cap 20, so 0.05 is one specialist). */
  const SERVED_FACTOR = { id: FACTOR_ID, type: 'factor', data: { label: 'Additional specialists', type: 'factor',
    observedState: { value: 0, unit: 'specialists', source: 'cee_inference', raw_value: 0, cap: 20, declared_scale: 'unit_interval' } } }
  const servedOption = (value: number) => ({ id: OPTION_ID, type: 'option',
    data: { label: 'Add one specialist', type: 'option',
      interventions: { [FACTOR_ID]: { unit: 'specialists', value, source: 'user_specified', target_match: MATCH } } } })
  /** turns/05.json: revision 3, graph e311efdf92f354f5, 0.1 (2 specialists): what both tabs opened on. */
  const REVISION_3 = servedOption(0.1)
  /** turns/07.json: tab A's 200, revision 4, graph c145ce4a9c520a3a, 0.2 (4 specialists). */
  const TAB_A_SAVED = servedOption(0.2)
  /** turns/06.json `response_body`: tab B's 409, byte for byte in the fields the UI reads. */
  const SERVED_409 = {
    error: 'GRAPH_DIVERGED', code: 'revision_conflict',
    message: 'The scenario changed while I was saving, so nothing was saved. Try again.',
    details: { retryable: false, reason: 'graph_write_conflict', failure_type: 'GRAPH_DIVERGED', conflict_category: 'revision_conflict',
      recovery_action: 'refresh_and_reconfirm', expected: 3, current: 4 },
  }
  const served409 = () => new SystemEventSendError('server', {
    code: SERVED_409.details.failure_type, conflictCategory: SERVED_409.details.conflict_category,
    reason: SERVED_409.details.reason, retryable: SERVED_409.details.retryable,
  })
  const EDITOR = `option-value-editor-${OPTION_ID}-${FACTOR_ID}`
  const word = () => screen.queryByTestId(`${EDITOR}-settlement`)?.textContent ?? null
  const card = (data: unknown) => (
    <ReactFlowProvider>
      <OptionNode type="option" position={{ x: 0, y: 0 }} selected={false} isConnectable positionAbsoluteX={0} positionAbsoluteY={0}
        dragging={false} zIndex={0} deletable selectable draggable id={OPTION_ID} data={data as never} {...({} as any)} />
    </ReactFlowProvider>
  )

  /** Tab B: 2 → 5 on revision 3; the writer dispatches 0.25 and the served 409 comes back through the real settlement. */
  async function tabBLosesTheRace() {
    storeOverlay = { nodes: [SERVED_FACTOR, REVISION_3], lastServerGraphHash: 'e311efdf92f354f5' }
    const view = render(card(REVISION_3.data))
    fireEvent.click(screen.getByTestId(EDITOR))
    const input = screen.getByTestId(`${EDITOR}-input`) as HTMLInputElement
    expect(input.value).toBe('2')
    fireEvent.change(input, { target: { value: '5' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(proposeOptionIntervention).toHaveBeenCalledTimes(1)
    expect(proposeOptionIntervention.mock.calls[0][1]).toBeCloseTo(0.25, 12)
    const opts = proposeOptionIntervention.mock.calls[0][2] as { onSendSettled: Parameters<typeof settleSystemEventSend>[1] }
    await act(async () => { settleSystemEventSend(Promise.reject(served409()), opts.onSendSettled); await Promise.resolve() })
    return view
  }
  /** The canonical re-read a proven-no-write 409 requests (`refusedGraphRefresh`) lands revision 4. */
  async function savedModelRead(option: { data: unknown }, base: string, view: ReturnType<typeof render>) {
    await act(async () => {
      storeOverlay = { ...storeOverlay, nodes: [SERVED_FACTOR, option], lastServerGraphHash: base }
      storeListeners.forEach(listener => listener())
      await new Promise(resolve => setTimeout(resolve, 5))
    })
    view.rerender(card(option.data))
  }

  it('RED on a9a5c26f: after the read, it says CEE\'s own sentence for the conflict, and the card shows the saved 4', async () => {
    const view = await tabBLosesTheRace()
    await savedModelRead(TAB_A_SAVED, 'c145ce4a9c520a3a', view)
    // The true reason, in the producer's words (the served 409's own `message`); no "kept its previous value", no reply.
    expect(word()).toBe(SERVED_409.message)
    expect(screen.queryByText(/kept its previous value/)).toBeNull()
    expect(screen.queryByText(/reply says why/)).toBeNull()
    // The card shows what the model holds now: 4 specialists, in the factor's unit (the current read), never tab B's 5.
    const resting = screen.getByTestId(EDITOR).textContent ?? ''
    expect(resting).toMatch(/\b4\b/)
    expect(resting).not.toMatch(/\b5\b/)
    // Nothing is written a second time.
    expect(proposeOptionIntervention).toHaveBeenCalledTimes(1)
  })

  it('says nothing about saving until the saved model has been read', async () => {
    await tabBLosesTheRace()
    expect(word()).toBe('Checking the saved model…')
    expect(screen.queryByText(/^Not saved\./)).toBeNull()
  })

  it('CONTRAST: the same race, where the saved model already holds 5 (this edit landed, its reply lost), says saved', async () => {
    const view = await tabBLosesTheRace()
    await savedModelRead(servedOption(0.25), 'c145ce4a9c520a3a', view)
    expect(word()).toBe('Saved. The model holds this value.')
    expect(proposeOptionIntervention).toHaveBeenCalledTimes(1)
  })
})

/**
 * JOURNEY BLOCKER (RC, programme-docs #63 5819467504): a "Run analysis"
 * suggested chip must answer to the SAME run gate as the panel's Analyse
 * control — never start a run that gate refuses.
 *
 * THE DEFECT. `SuggestedChips` dispatched `run_analysis` straight through
 * `onChipClick`, consulting none of `canRunAnalysis`'s rungs. The panel's own
 * gated runner (`handleRunAnalysis`, registered as the guidance store's
 * `_runAnalysis`) refuses out loud; the chip beside it did not ask.
 *
 * HARNESS: the REAL `ConversationPanel` (the production host of the chip row)
 * with a conversation whose last assistant turn offers a run_analysis chip — so
 * the chip, the gate and the registration are all the shipped ones. The chip is
 * admitted by CEE's readiness (`ceeAnalysisReady.status: 'ready'`) while a
 * DIFFERENT gate rung refuses: exactly the chip-visible-but-gate-closed state.
 *
 * No model calls: `fetch` is stubbed to a never-settling promise and the turn
 * dispatcher is a mock.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, act, waitFor, fireEvent } from '@testing-library/react'

import { ConversationPanel } from '../ConversationPanel'
import { ToastProvider } from '../../ToastContext'
import { useCanvasStore } from '../../store'
import { useGuidanceStore } from '../../stores/guidanceStore'
import { useReadinessStore } from '../../stores/readinessStore'
import type { ActionChip, ConversationMessage } from '../types'
import type { UseConversationReturn, PatchBlockState, PatchRejectionInfo } from '../useConversation'

const NODES = [
  { id: 'n1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Grow retained revenue' } },
  { id: 'n2', type: 'option', position: { x: 100, y: 0 }, data: { label: 'Extend the free trial' } },
  { id: 'n3', type: 'option', position: { x: 200, y: 0 }, data: { label: 'Hold the current price' } },
]
const EDGES = [{ id: 'e1', source: 'n2', target: 'n1', type: 'styled', data: { weight: 1 } }]

const RUN_CHIP: ActionChip = {
  id: 'chip_run',
  label: 'Run analysis',
  message: 'Run analysis',
  action_type: 'run_analysis',
  intent: 'primary',
}
const EXPLAIN_CHIP: ActionChip = {
  id: 'chip_explain',
  label: 'Explain the result',
  message: 'Explain the result',
  action_type: 'explain_results',
  intent: 'secondary',
}

/** CEE admits the run affordance, so the chip renders. */
const CEE_READY = {
  goal_node_id: 'n1',
  status: 'ready',
  options: [{ id: 'n2', label: 'Extend the free trial', status: 'ready', interventions: {} }],
}

function conversationOffering(
  chips: ActionChip[],
  dispatchAction: ReturnType<typeof vi.fn>,
  sendChip: ReturnType<typeof vi.fn>,
): UseConversationReturn {
  const patchStates = new Map<string, PatchBlockState>()
  const patchRejections = new Map<string, PatchRejectionInfo>()
  const messages: ConversationMessage[] = [
    { id: 'u1', role: 'user', content: 'Help me decide', timestamp: new Date('2026-09-24T12:00:00Z') },
    {
      id: 'a1',
      role: 'assistant',
      content: 'Your model is ready to analyse.',
      actionChips: chips,
      timestamp: new Date('2026-09-24T12:00:05Z'),
    },
  ] as ConversationMessage[]
  return {
    messages,
    isThinking: false,
    longRunningHint: null,
    lastSendFailure: null,
    dispatchAction: dispatchAction as unknown as UseConversationReturn['dispatchAction'],
    cancelTurn: vi.fn(),
    startNewDraft: vi.fn(async () => {}),
    sendMessage: vi.fn().mockResolvedValue(undefined),
    sendSystemEvent: vi.fn().mockResolvedValue(undefined) as unknown as UseConversationReturn['sendSystemEvent'],
    sendChip: sendChip as unknown as UseConversationReturn['sendChip'],
    clearHistory: vi.fn(),
    retryLast: vi.fn().mockResolvedValue(undefined),
    patchBlockStates: patchStates,
    setPatchBlockState: (key: string, state: PatchBlockState) => { patchStates.set(key, state) },
    settledSourceBlockKeys: new Set<string>(),
    patchRejections,
    setPatchRejection: (key: string, info: PatchRejectionInfo) => { patchRejections.set(key, info) },
  }
}

async function mountPanel(chips: ActionChip[]) {
  const dispatchAction = vi.fn().mockResolvedValue(undefined)
  const sendChip = vi.fn().mockResolvedValue(undefined)
  render(
    <ToastProvider>
      <ConversationPanel
        conversation={conversationOffering(chips, dispatchAction, sendChip)}
        onCollapse={vi.fn()}
        onAttach={vi.fn()}
      />
    </ToastProvider>,
  )
  await waitFor(() => {
    expect(useGuidanceStore.getState()._runAnalysis).toBeTypeOf('function')
  })
  return { dispatchAction, sendChip }
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
  useReadinessStore.setState({ readiness: null, loading: false, error: null, stale: false, verdictAtMs: null })
  useCanvasStore.setState({
    nodes: [...NODES],
    edges: [...EDGES],
    currentScenarioId: 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4',
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
    results: { status: 'idle' },
    graphHealth: null,
    analysisStateV1: null,
    ceeAnalysisReady: CEE_READY,
    _externalMutationActive: 0,
  } as never)
})

afterEach(() => {
  vi.unstubAllGlobals()
  useCanvasStore.setState({ nodes: [], edges: [], analysisStateV1: null, ceeAnalysisReady: null } as never)
  useGuidanceStore.setState({ _runAnalysis: null } as never)
  vi.clearAllMocks()
})

describe('a Run chip answers to the run gate', () => {
  it('gate CLOSED (run already in flight): the chip click refuses out loud and sends no turn', async () => {
    useCanvasStore.setState({ results: { status: 'streaming' } } as never)
    const { dispatchAction, sendChip } = await mountPanel([RUN_CHIP])

    await act(async () => { fireEvent.click(screen.getByTestId('suggested-chip-chip_run')) })

    expect(await screen.findByText(/Analysis in progress/i)).toBeInTheDocument()
    expect(dispatchAction).not.toHaveBeenCalled()
    expect(sendChip).not.toHaveBeenCalled()
  })

  it('gate CLOSED (empty canvas): refuses with the gate’s own sentence, no turn', async () => {
    useCanvasStore.setState({ nodes: [], edges: [] } as never)
    const { dispatchAction, sendChip } = await mountPanel([RUN_CHIP])

    await act(async () => { fireEvent.click(screen.getByTestId('suggested-chip-chip_run')) })

    expect(await screen.findByText(/Add some nodes to get started/i)).toBeInTheDocument()
    expect(dispatchAction).not.toHaveBeenCalled()
    expect(sendChip).not.toHaveBeenCalled()
  })

  it('gate OPEN: the chip click dispatches exactly one canonical run_analysis turn', async () => {
    const { dispatchAction, sendChip } = await mountPanel([RUN_CHIP])

    await act(async () => { fireEvent.click(screen.getByTestId('suggested-chip-chip_run')) })

    expect(dispatchAction).toHaveBeenCalledTimes(1)
    expect(dispatchAction).toHaveBeenCalledWith(
      expect.objectContaining({ action_type: 'run_analysis', source: 'chip' }),
    )
    expect(sendChip).not.toHaveBeenCalled()
  })

  it('control: a non-run chip keeps its own path, gate or no gate', async () => {
    useCanvasStore.setState({ results: { status: 'streaming' } } as never)
    const { dispatchAction, sendChip } = await mountPanel([EXPLAIN_CHIP])

    await act(async () => { fireEvent.click(screen.getByTestId('suggested-chip-chip_explain')) })

    expect(sendChip).toHaveBeenCalledTimes(1)
    expect(dispatchAction).not.toHaveBeenCalled()
  })
})

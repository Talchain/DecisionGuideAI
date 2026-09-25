/**
 * A "Run analysis" suggested chip must never LOOK clickable while the run gate
 * would refuse it.
 *
 * THE DEFECT. #1966 routed a Run chip's click through the panel's gated runner,
 * so a closed gate refused — but only AFTER the click, with a toast. The chip
 * itself stayed live-looking: a clickable-but-refused journey blocker.
 *
 * THE REPAIR. `ConversationPanel` hands `ChatThread` → `SuggestedChips` the SAME
 * gate verdict and sentence its composer Analyse control uses (`runGate`). A
 * closed gate renders the Run chip `disabled`, with the gate's own sentence
 * visible under the row and wired as the chip's accessible description. Non-run
 * chips stay live. No gate passed (headless mounts) ⇒ the old path, unchanged.
 *
 * Plus the two residuals from the #1966 review, both on the gated click path:
 *   (a) a "Rerun analysis" chip echoed into the transcript as "Run analysis";
 *   (b) the gated path skipped `onChipTaken`, so the chip was never recorded as
 *       taken for thread persistence.
 *
 * HARNESS: the REAL `ConversationPanel`, pattern from
 * `SuggestedChips.runGate.spec.tsx`. No model calls: `fetch` is stubbed to a
 * never-settling promise, the turn dispatcher is a mock, and thread persistence
 * is mocked so `onChipTaken` can be observed.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, act, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { ConversationPanel } from '../ConversationPanel'
import { SuggestedChips } from '../zones/SuggestedChips'
import { ToastProvider } from '../../ToastContext'
import { useCanvasStore } from '../../store'
import { useGuidanceStore } from '../../stores/guidanceStore'
import { useReadinessStore } from '../../stores/readinessStore'
import type { ActionChip, ConversationMessage } from '../types'
import type { UseConversationReturn, PatchBlockState, PatchRejectionInfo } from '../useConversation'

const { onChipTaken } = vi.hoisted(() => ({ onChipTaken: vi.fn() }))
vi.mock('../hooks/useThreadPersistence', () => ({
  useThreadPersistence: () => ({ onBlockAction: vi.fn(), onChipTaken }),
}))
// Analytics off, whole export surface (it is a no-op until initialised anyway).
vi.mock('../../../lib/posthog', () => ({
  initPostHog: vi.fn(),
  identifyUser: vi.fn(),
  resetPostHog: vi.fn(),
  trackEvent: vi.fn(),
}))

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
const RERUN_CHIP: ActionChip = {
  id: 'chip_rerun',
  label: 'Rerun analysis',
  message: 'Rerun analysis',
  action_type: 'run_analysis',
  intent: 'primary',
}
/** Prompt-only Run chip: no action_type, recognised by the label/message detector. */
const RERUN_PROMPT_CHIP: ActionChip = {
  id: 'chip_rerun_prompt',
  label: 'Rerun the analysis',
  message: 'Rerun the analysis',
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

// ---------------------------------------------------------------------------
// The real panel: the chip shows the gate
// ---------------------------------------------------------------------------

describe('ConversationPanel → Run chip shows the run gate', () => {
  it('gate CLOSED (run in flight): Run chip disabled, reason visible + described, click does nothing; non-run chip stays live', async () => {
    useCanvasStore.setState({ results: { status: 'streaming' } } as never)
    const { dispatchAction, sendChip } = await mountPanel([RUN_CHIP, EXPLAIN_CHIP])

    const runChip = screen.getByTestId('suggested-chip-chip_run')
    expect(runChip).toBeDisabled()
    expect(runChip).toHaveAttribute('aria-disabled', 'true')
    expect(runChip).toHaveAttribute('data-run-gated', 'true')

    // The gate's OWN sentence, visible, and the chip's accessible description.
    const reason = screen.getByTestId('suggested-chips-run-gate-reason')
    expect(reason).toBeVisible()
    expect(reason).toHaveTextContent(/^Analysis in progress$/)
    expect(reason.id).not.toBe('')
    expect(runChip).toHaveAttribute('aria-describedby', reason.id)
    expect(runChip).toHaveAccessibleDescription('Analysis in progress')

    // No click path starts anything — not a raw DOM click, not a user click,
    // not a programmatic `.click()` — and nothing is refused after the fact
    // either (the only copy of the sentence is the standing one, no toast).
    await act(async () => { fireEvent.click(runChip) })
    await userEvent.click(runChip)
    await act(async () => { (runChip as HTMLButtonElement).click() })
    expect(dispatchAction).not.toHaveBeenCalled()
    expect(sendChip).not.toHaveBeenCalled()
    expect(onChipTaken).not.toHaveBeenCalled()
    expect(screen.getAllByText('Analysis in progress')).toHaveLength(1)

    // The non-run chip beside it is untouched by the gate and still works.
    const explainChip = screen.getByTestId('suggested-chip-chip_explain')
    expect(explainChip).toBeEnabled()
    expect(explainChip).not.toHaveAttribute('data-run-gated')
    expect(explainChip).not.toHaveAttribute('aria-describedby')
    await act(async () => { fireEvent.click(explainChip) })
    expect(sendChip).toHaveBeenCalledTimes(1)
    expect(sendChip).toHaveBeenCalledWith(expect.objectContaining({ id: 'chip_explain' }))
    expect(dispatchAction).not.toHaveBeenCalled()
  })

  it('gate CLOSED: the chip states the SAME verdict and sentence as the composer’s Analyse control', async () => {
    // A structural rung (graph-health error), not the in-flight one.
    useCanvasStore.setState({
      graphHealth: { status: 'errors', issues: [{ severity: 'error', message: 'Two factors form a loop' }] },
    } as never)
    await mountPanel([RUN_CHIP])

    const analyse = screen.getByTestId('run-analysis-chip')
    const runChip = screen.getByTestId('suggested-chip-chip_run')
    const reason = screen.getByTestId('suggested-chips-run-gate-reason')

    expect(analyse).toBeDisabled()
    expect(runChip).toBeDisabled()
    const composerSentence = analyse.getAttribute('title')
    expect(composerSentence).toBeTruthy()
    expect(composerSentence).not.toBe('Run analysis')
    expect(reason.textContent).toBe(composerSentence)
    expect(runChip).toHaveAccessibleDescription(composerSentence as string)
  })

  it('gate CLOSED (empty canvas): disabled with the gate’s own sentence; no turn', async () => {
    useCanvasStore.setState({ nodes: [], edges: [] } as never)
    const { dispatchAction, sendChip } = await mountPanel([RUN_CHIP])

    const runChip = screen.getByTestId('suggested-chip-chip_run')
    expect(runChip).toBeDisabled()
    expect(screen.getByTestId('suggested-chips-run-gate-reason')).toHaveTextContent('Add some nodes to get started')

    await act(async () => { fireEvent.click(runChip) })
    expect(dispatchAction).not.toHaveBeenCalled()
    expect(sendChip).not.toHaveBeenCalled()
  })

  it('gate OPEN: Run chip enabled, no reason shown, click dispatches the gated run_analysis exactly once', async () => {
    const { dispatchAction, sendChip } = await mountPanel([RUN_CHIP])

    const runChip = screen.getByTestId('suggested-chip-chip_run')
    expect(runChip).toBeEnabled()
    expect(runChip).not.toHaveAttribute('data-run-gated')
    expect(runChip).not.toHaveAttribute('aria-describedby')
    expect(screen.queryByTestId('suggested-chips-run-gate-reason')).toBeNull()

    await act(async () => { fireEvent.click(runChip) })

    expect(dispatchAction).toHaveBeenCalledTimes(1)
    expect(dispatchAction).toHaveBeenCalledWith(
      expect.objectContaining({ action_type: 'run_analysis', message: 'Run analysis', source: 'chip' }),
    )
    expect(sendChip).not.toHaveBeenCalled()
  })

  it('gate flips closed → open on a re-render: the same chip becomes live', async () => {
    useCanvasStore.setState({ results: { status: 'streaming' } } as never)
    const { dispatchAction } = await mountPanel([RUN_CHIP])
    expect(screen.getByTestId('suggested-chip-chip_run')).toBeDisabled()

    await act(async () => { useCanvasStore.setState({ results: { status: 'idle' } } as never) })

    const runChip = screen.getByTestId('suggested-chip-chip_run')
    expect(runChip).toBeEnabled()
    expect(screen.queryByTestId('suggested-chips-run-gate-reason')).toBeNull()
    await act(async () => { fireEvent.click(runChip) })
    expect(dispatchAction).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// #1966 review residuals, on the real panel
// ---------------------------------------------------------------------------

describe('residual (a): the transcript echoes the chip the user clicked', () => {
  it('a "Rerun analysis" chip echoes "Rerun analysis", not "Run analysis"', async () => {
    const { dispatchAction, sendChip } = await mountPanel([RERUN_CHIP])

    await act(async () => { fireEvent.click(screen.getByTestId('suggested-chip-chip_rerun')) })

    expect(dispatchAction).toHaveBeenCalledTimes(1)
    // `label` is what dispatchAction renders as the user's bubble.
    expect(dispatchAction).toHaveBeenCalledWith(
      expect.objectContaining({ action_type: 'run_analysis', label: 'Rerun analysis', source: 'chip' }),
    )
    expect(sendChip).not.toHaveBeenCalled()
  })

  it('a prompt-only Run chip (no action_type) is still the canonical gated run, echoing its own label', async () => {
    const { dispatchAction, sendChip } = await mountPanel([RERUN_PROMPT_CHIP])

    await act(async () => { fireEvent.click(screen.getByTestId('suggested-chip-chip_rerun_prompt')) })

    expect(dispatchAction).toHaveBeenCalledTimes(1)
    expect(dispatchAction).toHaveBeenCalledWith(
      expect.objectContaining({ action_type: 'run_analysis', label: 'Rerun the analysis', source: 'chip' }),
    )
    expect(sendChip).not.toHaveBeenCalled()
  })

  it('the composer’s Analyse control keeps its canonical "Run analysis" echo', async () => {
    const { dispatchAction } = await mountPanel([EXPLAIN_CHIP])

    await act(async () => { fireEvent.click(screen.getByTestId('run-analysis-chip')) })

    expect(dispatchAction).toHaveBeenCalledTimes(1)
    expect(dispatchAction).toHaveBeenCalledWith(
      expect.objectContaining({ action_type: 'run_analysis', label: 'Run analysis', source: 'chip' }),
    )
  })
})

describe('residual (b): a dispatched Run chip is recorded as taken', () => {
  it('gate OPEN: the Run chip is marked taken on the assistant turn that offered it, once', async () => {
    const { dispatchAction } = await mountPanel([RUN_CHIP])

    await act(async () => { fireEvent.click(screen.getByTestId('suggested-chip-chip_run')) })

    expect(dispatchAction).toHaveBeenCalledTimes(1)
    await waitFor(() => { expect(onChipTaken).toHaveBeenCalledTimes(1) })
    expect(onChipTaken).toHaveBeenCalledWith('a1', 'chip_run')
  })

  it('control: a non-run chip is still marked taken through the send path', async () => {
    const { sendChip } = await mountPanel([EXPLAIN_CHIP])

    await act(async () => { fireEvent.click(screen.getByTestId('suggested-chip-chip_explain')) })

    expect(sendChip).toHaveBeenCalledTimes(1)
    await waitFor(() => { expect(onChipTaken).toHaveBeenCalledWith('a1', 'chip_explain') })
  })
})

// ---------------------------------------------------------------------------
// SuggestedChips alone: the prop contract
// ---------------------------------------------------------------------------

describe('SuggestedChips — runGate prop contract (direct render)', () => {
  it('no runGate: the Run chip is enabled and the previous click path is unchanged', () => {
    const gatedRun = vi.fn()
    useGuidanceStore.setState({ _runAnalysis: gatedRun } as never)
    const onChipClick = vi.fn().mockResolvedValue(undefined)
    render(<SuggestedChips chips={[RUN_CHIP]} onChipClick={onChipClick} />)

    const runChip = screen.getByTestId('suggested-chip-chip_run')
    expect(runChip).toBeEnabled()
    expect(runChip).not.toHaveAttribute('data-run-gated')
    expect(runChip).not.toHaveAttribute('aria-describedby')
    expect(screen.queryByTestId('suggested-chips-run-gate-reason')).toBeNull()

    fireEvent.click(runChip)
    // The registered gated runner, exactly as before this change.
    expect(gatedRun).toHaveBeenCalledTimes(1)
    expect(onChipClick).not.toHaveBeenCalled()
  })

  it('no runGate and no registered runner: the click falls through to onChipClick, as before', () => {
    const onChipClick = vi.fn().mockResolvedValue(undefined)
    render(<SuggestedChips chips={[RUN_CHIP]} onChipClick={onChipClick} />)

    fireEvent.click(screen.getByTestId('suggested-chip-chip_run'))
    expect(onChipClick).toHaveBeenCalledTimes(1)
  })

  it('runGate closed WITHOUT a reason: disabled only — no sentence is invented', () => {
    const onChipClick = vi.fn().mockResolvedValue(undefined)
    const { container } = render(
      <SuggestedChips chips={[RUN_CHIP]} onChipClick={onChipClick} runGate={{ allowed: false }} />,
    )

    const runChip = screen.getByTestId('suggested-chip-chip_run')
    expect(runChip).toBeDisabled()
    expect(runChip).toHaveAttribute('data-run-gated', 'true')
    expect(runChip).not.toHaveAttribute('aria-describedby')
    expect(screen.queryByTestId('suggested-chips-run-gate-reason')).toBeNull()
    // No text node beyond the chip's own label: no sentence of any kind.
    expect(container.querySelector('p')).toBeNull()
    expect(runChip).toHaveTextContent(/^Run analysis$/)
  })

  it('belt-and-braces: a handler call that reaches past `disabled` still starts nothing', () => {
    // `disabled` already stops every DOM route (fireEvent, user-event and
    // `.click()` above), so the in-handler guard is only reachable by calling
    // the React onClick prop directly. Done here on purpose, so the guard is a
    // measured claim rather than an asserted one.
    const gatedRun = vi.fn()
    useGuidanceStore.setState({ _runAnalysis: gatedRun } as never)
    const onChipClick = vi.fn().mockResolvedValue(undefined)
    render(
      <SuggestedChips
        chips={[RUN_CHIP]}
        onChipClick={onChipClick}
        runGate={{ allowed: false, reason: 'Critical issues need to be resolved' }}
      />,
    )
    const runChip = screen.getByTestId('suggested-chip-chip_run')
    const propsKey = Object.keys(runChip).find((k) => k.startsWith('__reactProps$'))
    expect(propsKey, 'React props key not found on the chip element').toBeDefined()
    const props = (runChip as unknown as Record<string, { onClick: () => void }>)[propsKey as string]
    act(() => { props.onClick() })

    expect(onChipClick).not.toHaveBeenCalled()
    expect(gatedRun).not.toHaveBeenCalled()
  })

  it('runGate closed with a blank reason: treated as absent', () => {
    render(
      <SuggestedChips
        chips={[RUN_CHIP]}
        onChipClick={vi.fn().mockResolvedValue(undefined)}
        runGate={{ allowed: false, reason: '   ' }}
      />,
    )
    expect(screen.getByTestId('suggested-chip-chip_run')).toBeDisabled()
    expect(screen.queryByTestId('suggested-chips-run-gate-reason')).toBeNull()
  })

  it('runGate closed with no Run chip in the row: nothing is disabled and no reason is shown', () => {
    const onChipClick = vi.fn().mockResolvedValue(undefined)
    render(
      <SuggestedChips
        chips={[EXPLAIN_CHIP]}
        onChipClick={onChipClick}
        runGate={{ allowed: false, reason: 'Critical issues need to be resolved' }}
      />,
    )
    expect(screen.getByTestId('suggested-chip-chip_explain')).toBeEnabled()
    expect(screen.queryByTestId('suggested-chips-run-gate-reason')).toBeNull()
    fireEvent.click(screen.getByTestId('suggested-chip-chip_explain'))
    expect(onChipClick).toHaveBeenCalledTimes(1)
  })

  it('runGate open: the click goes to the host (onChipClick), not around it via the store', () => {
    const gatedRun = vi.fn()
    useGuidanceStore.setState({ _runAnalysis: gatedRun } as never)
    const onChipClick = vi.fn().mockResolvedValue(undefined)
    render(
      <SuggestedChips chips={[RERUN_CHIP]} onChipClick={onChipClick} runGate={{ allowed: true }} />,
    )

    const runChip = screen.getByTestId('suggested-chip-chip_rerun')
    expect(runChip).toBeEnabled()
    fireEvent.click(runChip)
    expect(onChipClick).toHaveBeenCalledTimes(1)
    expect(onChipClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'chip_rerun', label: 'Rerun analysis' }))
    expect(gatedRun).not.toHaveBeenCalled()
  })
})

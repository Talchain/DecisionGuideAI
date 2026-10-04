import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ReasoningSignals } from '../sections/ReasoningSignals'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { makeData } from './analysisNewFixtures'
import { useCanvasStore } from '../../../../canvas/store'
import { isTestWithoutLinkEnabled } from '../../../../flags'
import type { ConversationContextValue } from '../../../../canvas/conversation/ConversationContext'
import type { SourceKeyedMessage } from '../../../../canvas/conversation/utils/transcriptStore'

let conversation: (Pick<ConversationContextValue, 'sendChip' | 'isThinking'> & { messages: SourceKeyedMessage[] }) | null
vi.mock('../../../../canvas/conversation/ConversationContext', () => ({ useOptionalConversationContext: () => conversation }))
vi.mock('../../../../canvas/conversation/revealOlumi', () => ({ revealOlumiSurface: vi.fn() }))
vi.mock('../../../../lib/supabase', () => ({ supabase: {}, isSupabaseAvailable: () => false }))
vi.mock('../../../../adapters/plot', () => ({ plot: { validatePatch: vi.fn() } }))

const initialCanvas = useCanvasStore.getState()
const sendChip = vi.fn<Parameters<ConversationContextValue['sendChip']>, ReturnType<ConversationContextValue['sendChip']>>()
const FLAG = 'feature.testWithoutLink'
const vm = () => {
  const model = buildAnalysisNewViewModel({
    data: makeData(), recommendations: [], isPreRun: false, isRunning: false, isStale: false, responseHash: 'run-1',
  })
  model.uncertainty.findings = [{
    id: 'uncertainty:assumed-strength:link-1', headline: 'Check this link',
    targetId: 'factor-a', reviewTargetId: 'link-1', focusTargetId: 'link-1',
    detail: 'Olumi estimated this relationship.', implication: 'Check its strength.', inspect: [],
  }] as never
  return model
}

beforeEach(() => {
  localStorage.removeItem(FLAG)
  sendChip.mockResolvedValue(undefined)
  conversation = { sendChip, isThinking: false, messages: [] }
  useCanvasStore.setState({
    currentScenarioId: 'scenario-1',
    nodes: [], edges: [{ id: 'link-1', source: 'factor-a', target: 'goal-b', data: {} }],
    hasCompletedFirstRun: true,
    analysisFreshness: { freshness: 'fresh', freshnessReason: 'graph_hash_match' },
    analysisFreshnessDirty: false, analysisStateV1: null, importPendingServerRegistration: false,
    results: { status: 'complete', report: { option_probabilities: { a: 0.6, b: 0.4 } } },
  } as never)
})
afterEach(() => {
  cleanup()
  localStorage.removeItem(FLAG)
  useCanvasStore.setState(initialCanvas, true)
})

function mount(model = vm()) {
  return render(<ReasoningSignals vm={model} flipThresholds={null} onInspect={vi.fn()} />)
}

describe('Test without this link on the existing Challenge signals', () => {
  it('can be switched off even when the Challenge has a link', () => {
    localStorage.setItem(FLAG, '0')
    expect(isTestWithoutLinkEnabled()).toBe(false)
    mount()
    expect(screen.queryByRole('button', { name: 'Test without this link' })).not.toBeInTheDocument()
  })

  it('shows when enabled on a current link and dispatches the exact press once', async () => {
    localStorage.setItem(FLAG, '1')
    let complete!: () => void
    sendChip.mockReturnValue(new Promise<void>(resolve => { complete = resolve }))
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Test without this link' }))
    const pending = screen.getByRole('button', { name: 'Testing without this link…' })
    expect(pending).toBeDisabled()
    expect(pending).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('status')).toHaveTextContent('Waiting for Olumi.')
    fireEvent.click(pending)
    expect(sendChip).toHaveBeenCalledTimes(1)
    expect(sendChip).toHaveBeenCalledWith({
      id: 'agent-test-without-link:["factor-a","goal-b"]',
      label: 'Test without this link', message: 'Test without this link', intent: 'primary',
      sourceBlockKey: 'test-without-link:scenario-1:factor-a::goal-b',
    })
    await act(async () => complete())
    expect(screen.getByRole('button', { name: 'Test without this link' })).toBeEnabled()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  // The wire literal is CEE's canonical press, `structuralChallengePressId`: the prefix, then the JSON pair
  // [from, to]. Node ids may contain ':', so a '::' join is ambiguous ("a:::b") and the served CEE parser
  // (JSON.parse of the suffix) refused it, so every press fell through to an ordinary model turn.
  it('sends the canonical JSON press, which keeps colon-bearing node ids unambiguous', () => {
    localStorage.setItem(FLAG, '1')
    useCanvasStore.setState({ edges: [{ id: 'link-1', source: 'factor:price_rise', target: 'goal:mrr', data: {} }] } as never)
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Test without this link' }))
    expect(sendChip).toHaveBeenCalledTimes(1)
    const { id } = sendChip.mock.calls[0][0]
    expect(id).toBe('agent-test-without-link:["factor:price_rise","goal:mrr"]')
    expect(JSON.parse(id.slice('agent-test-without-link:'.length))).toEqual(['factor:price_rise', 'goal:mrr'])
  })

  it.each(['missing link', 'no sender', 'stale', 'pre-run', 'non-link finding'])(
    'stays hidden when %s', (state) => {
      localStorage.setItem(FLAG, '1')
      if (state === 'missing link') useCanvasStore.setState({ edges: [] })
      if (state === 'no sender') conversation = null
      if (state === 'stale') useCanvasStore.setState({ analysisFreshnessDirty: true })
      const model = vm()
      if (state === 'pre-run') model.status.isPreRun = true
      if (state === 'non-link finding') model.uncertainty.findings[0].id = 'gap:factor-a'
      mount(model)
      expect(screen.queryByRole('button', { name: 'Test without this link' })).not.toBeInTheDocument()
    },
  )

  it('shows a send failure and permits another attempt without rendering a science result', async () => {
    localStorage.setItem(FLAG, '1')
    sendChip.mockRejectedValueOnce(new Error('not delivered'))
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Test without this link' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('This test could not be sent. Try again.')
    expect(screen.getByRole('button', { name: 'Test without this link' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Test without this link' }))
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
    expect(sendChip).toHaveBeenCalledTimes(2)
    expect(screen.queryByTestId('test-without-link-result')).not.toBeInTheDocument()
  })

  it('reads a verified delivery failure from the existing conversation, even when the send resolves', async () => {
    localStorage.setItem(FLAG, '1')
    const view = mount()
    fireEvent.click(screen.getByRole('button', { name: 'Test without this link' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Test without this link' })).toBeEnabled())
    conversation!.messages = [{
      id: 'send-1', role: 'user', content: 'Test without this link', timestamp: new Date(),
      sourceBlockKey: 'test-without-link:scenario-1:factor-a::goal-b', deliveryState: 'failed',
    }]
    view.rerender(<ReasoningSignals vm={vm()} flipThresholds={null} />)
    expect(screen.getByRole('alert')).toHaveTextContent('This test could not be sent. Try again.')
  })
})

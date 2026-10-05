import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ReasoningSignals } from '../sections/ReasoningSignals'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { makeData } from './analysisNewFixtures'
import { useCanvasStore } from '../../../../canvas/store'
import { isTestWithoutLinkEnabled } from '../../../../flags'
import { recordBootReadAdmission, __resetBootReadAdmissionForTests } from '../../../../canvas/hydrate/bootReadAdmission'
import type { PermittedAnalysisMode } from '../../../../adapters/cee/types'
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
    analysisFreshnessDirty: false, importPendingServerRegistration: false,
    results: { status: 'complete', report: { option_probabilities: { a: 0.6, b: 0.4 } } },
    // The served shape the offer gate reads. `analysisStateV1` is the analysis_state of a served turn VERBATIM
    // (journey 4, 4 Oct, CEE 24e9b102, wire/16); only the admission's mode is lifted to quantified_provisional,
    // the lowest the service answers this press on (that capture's own mode was exploratory).
    ceeAnalysisReady: { analysis_admission: { permitted_analysis_mode: 'quantified_provisional' } },
    analysisStateV1: {
      run_state: { kind: 'complete_current', computed_at: '2026-10-04T18:32:06.624Z' },
      readiness: { status: 'ready', blockers: [] },
      leader_claim: { permitted: false, withheld_reason: 'separation_unavailable' },
      robustness: {},
      usable_for_prose: true, usable_for_chips: true, usable_for_followup: true,
      requires_rerun: false, blocked_unusable: false, contradictions: [],
    },
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

  // The offer gate (testWithoutLinkEligibility): a press the service is certain to refuse is not offered, and the
  // reason is said in one plain sentence instead. Each row changes one producer field of the served seed.
  it('says why instead of offering the press when the admission is below quantified_provisional', () => {
    localStorage.setItem(FLAG, '1')
    useCanvasStore.setState({ ceeAnalysisReady: { analysis_admission: { permitted_analysis_mode: 'exploratory' } } } as never)
    mount()
    expect(screen.queryByRole('button', { name: 'Test without this link' })).not.toBeInTheDocument()
    const hold = screen.getByTestId('challenge-test-without-link-hold')
    expect(hold).toHaveAttribute('data-hold', 'not_quantified')
    expect(hold).toHaveTextContent('this analysis cannot measure that yet')
  })

  it('says why for an option-wiring link, whatever the Run', () => {
    localStorage.setItem(FLAG, '1')
    useCanvasStore.setState({
      nodes: [{ id: 'factor-a', type: 'option', position: { x: 0, y: 0 }, data: {} }],
    } as never)
    mount()
    expect(screen.queryByRole('button', { name: 'Test without this link' })).not.toBeInTheDocument()
    expect(screen.getByTestId('challenge-test-without-link-hold')).toHaveAttribute('data-hold', 'option_wiring')
  })

  // ⭐ THE CANVAS SEAM (Canvas ↔ Reasoning, 5 Oct): Canvas's admission-on-hydrate writes the read's admission into
  // `retainedAnalysisAdmission`, with no live admission beside it. The gate must honour that slot alone, or a cold
  // load of an exploratory Run would offer a press the service refuses.
  it('holds on a cold load whose READ carried an exploratory admission (retained slot, no live admission)', () => {
    localStorage.setItem(FLAG, '1')
    useCanvasStore.setState({
      ceeAnalysisReady: null,
      retainedAnalysisAdmission: { permitted_analysis_mode: 'exploratory' },
    } as never)
    mount()
    expect(screen.queryByRole('button', { name: 'Test without this link' })).not.toBeInTheDocument()
    expect(screen.getByTestId('challenge-test-without-link-hold')).toHaveAttribute('data-hold', 'not_quantified')
  })

  it('CONTROL: the same retained slot at quantified_provisional offers the press', () => {
    localStorage.setItem(FLAG, '1')
    useCanvasStore.setState({
      ceeAnalysisReady: null,
      retainedAnalysisAdmission: { permitted_analysis_mode: 'quantified_provisional' },
    } as never)
    mount()
    expect(screen.getByRole('button', { name: 'Test without this link' })).toBeInTheDocument()
  })

  it('still offers the press when no admission is loaded (a fresh-browser cold load stores none)', () => {
    localStorage.setItem(FLAG, '1')
    useCanvasStore.setState({ ceeAnalysisReady: null, retainedAnalysisAdmission: null } as never)
    mount()
    expect(screen.getByRole('button', { name: 'Test without this link' })).toBeInTheDocument()
    expect(screen.queryByTestId('challenge-test-without-link-hold')).not.toBeInTheDocument()
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

describe('⭐ a cold load uses the graph read\'s mode while no turn has spoken (bootReadAdmission; Reasoning conditions 1–3)', () => {
  const READ = 'read-revision-1'
  /** A cold load before any turn: no live or retained admission; the read's revision is the one on screen. */
  function coldLoad(mode: PermittedAnalysisMode, over: Record<string, unknown> = {}, recordedFor = 'scenario-1') {
    useCanvasStore.setState({
      ceeAnalysisReady: null, retainedAnalysisAdmission: null,
      bootAdmittedRevision: READ, lastServerGraphHash: READ, pendingEmittedEdits: 0, ...over,
    } as never)
    recordBootReadAdmission({ scenarioId: recordedFor, graphHash: READ, permittedAnalysisMode: mode })
  }
  const holdOf = () => screen.queryByTestId('challenge-test-without-link-hold')?.getAttribute('data-hold') ?? null
  const offered = () => screen.queryByRole('button', { name: 'Test without this link' }) !== null
  beforeEach(() => localStorage.setItem(FLAG, '1'))
  afterEach(() => __resetBootReadAdmissionForTests())

  it('⭐ hydrate only, a mode below quantified: holds with the plain sentence (it was offered, then refused)', () => {
    coldLoad('exploratory')
    mount()
    expect(holdOf()).toBe('not_quantified')
    expect(offered()).toBe(false)
  })
  it('control: hydrate only, quantified_provisional: offered', () => {
    coldLoad('quantified_provisional')
    mount()
    expect(offered()).toBe(true)
    expect(holdOf()).toBeNull()
  })

  it('⭐ a turn\'s admission wins over the read\'s mode', () => {
    coldLoad('exploratory', { ceeAnalysisReady: { analysis_admission: { permitted_analysis_mode: 'quantified_provisional' } } })
    mount()
    expect(offered()).toBe(true)
  })
  it('control: the same read without the turn holds', () => {
    coldLoad('exploratory')
    mount()
    expect(holdOf()).toBe('not_quantified')
  })

  it('⭐ the read was recorded for ANOTHER scenario: its mode is not this one\'s (absent = not loaded, offered)', () => {
    coldLoad('exploratory', {}, 'scenario-2')
    mount()
    expect(holdOf()).toBeNull()
    expect(offered()).toBe(true)
  })

  it('⭐ the revision on screen moved since the read (an edit or a turn): its mode is not used', () => {
    coldLoad('exploratory', { lastServerGraphHash: 'moved-revision' })
    mount()
    expect(holdOf()).toBeNull()
    expect(offered()).toBe(true)
  })
  it('⭐ the boot revision is no longer the read\'s (a decision-context clear): its mode is not used', () => {
    coldLoad('exploratory', { bootAdmittedRevision: null })
    mount()
    expect(holdOf()).toBeNull()
  })
})

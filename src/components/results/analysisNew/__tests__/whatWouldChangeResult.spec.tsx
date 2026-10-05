import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { genuineDecision, decisionWithLeaderWithheld } from './analysisNewFixtures'
import { useCanvasStore } from '../../../../canvas/store'
import { useGuidanceStore } from '../../../../canvas/stores/guidanceStore'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import { selectRunAffirmedCurrent } from '../../../../canvas/state/analysisStateSelector'
import { useUIStore } from '../../../../stores/uiStore'
import { focusModelTarget } from '../../../../canvas/utils/focusHelpers'

vi.mock('../../../../canvas/ToastContext', () => ({ useShowToastSafe: () => vi.fn() }))
vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))
vi.mock('../../../../lib/supabase', () => ({ supabase: {}, isSupabaseAvailable: () => false }))
vi.mock('../../../../adapters/plot', () => ({ plot: { validatePatch: vi.fn() } }))

const initialCanvas = useCanvasStore.getState()
const initialGuidance = useGuidanceStore.getState()
const initialUI = useUIStore.getState()
const sendChip = vi.fn()

beforeEach(() => {
  useStrengthenStore.setState({ records: {}, priorityOrder: [] } as never)
  useGuidanceStore.setState({ _sendChip: sendChip })
  useCanvasStore.setState({
    nodes: [{ id: 'f_elasticity', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Price elasticity' } }],
    edges: [],
    hasCompletedFirstRun: true,
    analysisFreshness: { freshness: 'fresh', freshnessReason: 'graph_hash_match' },
    analysisFreshnessDirty: false,
    analysisStateV1: null,
    importPendingServerRegistration: false,
    results: { status: 'complete', report: { option_probabilities: { opt_a: 0.31, opt_b: 0.69 } } },
  } as never)
  expect(selectRunAffirmedCurrent(useCanvasStore.getState())).toBe(true)
})

afterEach(() => {
  cleanup()
  useCanvasStore.setState(initialCanvas, true)
  useGuidanceStore.setState(initialGuidance, true)
  useUIStore.setState(initialUI, true)
})

function mount(overrides: Partial<React.ComponentProps<typeof AnalysisNewTabBody>> = {}) {
  const data = genuineDecision()
  data.recommendation.flipThresholds = [{
    label: 'Price elasticity', node_id: 'f_elasticity', current_value: 0.6,
    flip_value: 0.9, flip_reason: 'found', alternative_winner_label: 'Hold price',
  }] as never
  return render(<AnalysisNewTabBody
    resultsSectionData={data} isPreRun={false} isRunning={false} isStale={false}
    responseHash="run-1" onReviewTarget={vi.fn()} {...overrides}
  />)
}

describe('What would change the result in Analysis', () => {
  it('shows one obvious entry on a current run and dispatches the existing exact press', () => {
    mount()
    const entry = screen.getByRole('button', { name: 'What would change this?' })
    expect(screen.getAllByRole('button', { name: 'What would change this?' })).toHaveLength(1)
    fireEvent.click(entry)
    expect(sendChip).toHaveBeenCalledTimes(1)
    expect(sendChip).toHaveBeenCalledWith(
      'What would change this?', 'What would most likely change this result?',
      { id: 'agent-next-what-would-change' },
    )
  })

  it.each(['pre-run', 'running', 'wire-running', 'stale', 'unconfirmed', 'no sender'])(
    'hides the entry when %s', (state) => {
      if (state === 'stale') useCanvasStore.setState({ analysisFreshnessDirty: true })
      if (state === 'unconfirmed') useCanvasStore.setState({ analysisFreshness: null })
      if (state === 'no sender') useGuidanceStore.setState({ _sendChip: null })
      mount({ isPreRun: state === 'pre-run', isRunning: state === 'running', isBusy: state === 'running' || state === 'wire-running' })
      expect(screen.queryByRole('button', { name: 'What would change this?' })).not.toBeInTheDocument()
    },
  )

  // #2466 (4 Oct, journey fix): the entry no longer requires a named leader, because "it is most useful exactly when
  // the result is withheld"; CEE answers a withheld Run with its own honest limit. The two rows here asserted the
  // pre-#2466 gate and were red on staging. The tipping row stays leader-gated: its sentence names an option.
  it.each([
    ['the producer withheld the leader', () => useCanvasStore.setState({
      results: { status: 'complete', report: { producer_leader_permission: { permitted: false } } },
    } as never)],
    ['the view model withheld the leader', () => undefined],
  ])('offers the entry on a current Run when %s, and still states no tipping point', (state, seed) => {
    seed()
    mount(state === 'the view model withheld the leader' ? { resultsSectionData: decisionWithLeaderWithheld() } : {})
    expect(screen.getByRole('button', { name: 'What would change this?' })).toBeInTheDocument()
    if (state === 'the view model withheld the leader') {
      expect(screen.queryByTestId('analysis-new-signals-tipping')).not.toBeInTheDocument()
    }
  })

  it('takes the tipping factor to its existing edit door and names rerun then Compare', () => {
    mount()
    const next = screen.getByTestId('analysis-new-signals-tipping-next-step')
    expect(next).toHaveTextContent('After editing, rerun the analysis, then open Compare to see what changed.')
    fireEvent.click(screen.getByRole('button', { name: 'Edit Price elasticity' }))
    expect(focusModelTarget).toHaveBeenCalledWith('f_elasticity')
    expect(useUIStore.getState().activeOutputTab).toBe('diagnostics')
    expect(useUIStore.getState().pendingModelTabSection).toBe('factors')
    fireEvent.click(screen.getByRole('button', { name: 'Compare' }))
    expect(useUIStore.getState().activeOutputTab).toBe('compare')
    expect(sendChip).not.toHaveBeenCalled()
  })

  it('withdraws the tipping edit and result when the existing freshness selector becomes stale', () => {
    mount()
    expect(screen.getByRole('button', { name: 'Edit Price elasticity' })).toBeInTheDocument()
    act(() => useCanvasStore.setState({ analysisFreshnessDirty: true }))
    expect(screen.queryByTestId('analysis-new-signals-tipping')).not.toBeInTheDocument()
  })
})

/**
 * BEAT 5 entry: "Strengthen the model" sends CEE's own next-step press (`agent-next-strengthen`,
 * NEXT_STEP_CHIPS at CEE 24e9b102 agent-v1-turn.ts:590-594), whose answer is ONE held link-strength card with
 * no model call, or CEE's ordinary answer when no unsized link exists (strengthen-press.ts). The tab decides
 * nothing: same gate as "What would change this?", the exact chip id and message, and nothing of its own after
 * the press. The card names no option, so a withheld leader does not hide it.
 */
describe('Strengthen the model in Analysis (beat 5)', () => {
  const STRENGTHEN = 'Strengthen the model'

  it('shows one entry on a current Run and sends CEE\'s exact next-step press, once', () => {
    mount()
    expect(screen.getAllByRole('button', { name: STRENGTHEN })).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: STRENGTHEN }))
    expect(sendChip).toHaveBeenCalledTimes(1)
    expect(sendChip).toHaveBeenCalledWith(STRENGTHEN, 'What would most strengthen this model?', { id: 'agent-next-strengthen' })
  })

  it.each(['pre-run', 'running', 'wire-running', 'stale', 'unconfirmed', 'no sender'])(
    'hides the entry when %s', (state) => {
      if (state === 'stale') useCanvasStore.setState({ analysisFreshnessDirty: true })
      if (state === 'unconfirmed') useCanvasStore.setState({ analysisFreshness: null })
      if (state === 'no sender') useGuidanceStore.setState({ _sendChip: null })
      mount({ isPreRun: state === 'pre-run', isRunning: state === 'running', isBusy: state === 'running' || state === 'wire-running' })
      expect(screen.queryByRole('button', { name: STRENGTHEN })).not.toBeInTheDocument()
    },
  )

  it('is offered when the leader is withheld (the card names no option)', () => {
    mount({ resultsSectionData: decisionWithLeaderWithheld() })
    expect(screen.getByRole('button', { name: STRENGTHEN })).toBeInTheDocument()
  })

  it('adds nothing of its own after the press: the answer, card or not, is CEE\'s reply in the conversation', () => {
    const { container } = mount()
    const before = container.textContent
    fireEvent.click(screen.getByRole('button', { name: STRENGTHEN }))
    expect(sendChip).toHaveBeenCalledTimes(1)
    expect(container.textContent).toBe(before)
  })
})

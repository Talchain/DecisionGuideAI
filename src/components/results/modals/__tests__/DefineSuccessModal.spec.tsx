/**
 * Define-success modal (prototype #successModal) — chrome/a11y, live
 * assembled-sentence preview, field-level validation (never silent-close),
 * and the canonical threshold commit: ONE setter + ONE canonical rerun,
 * the same path as OutputsDock.handleApplyThreshold.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

import { DefineSuccessModal, DEFINE_SUCCESS_COPY } from '../DefineSuccessModal'
import {
  openDefineSuccess,
  selectSuccessMeasure,
  useSuccessMeasureStore,
} from '../successMeasureStore'
import {
  registerCanonicalRunner,
  __resetCanonicalRunnerForTests,
  type CanonicalRunOptions,
  type CanonicalRunOutcome,
} from '../../../../canvas/analysis/canonicalRunRegistry'
import { useCanvasStore } from '../../../../canvas/store'

const originalSetGoalThreshold = useCanvasStore.getState().setGoalThreshold

function seedCanvas(opts: { goalLabel?: string; goalThreshold?: number | null } = {}) {
  useCanvasStore.setState({
    nodes: opts.goalLabel
      ? ([
          {
            id: 'goal_1',
            type: 'goal',
            position: { x: 0, y: 0 },
            data: { label: opts.goalLabel },
          },
        ] as never)
      : ([] as never),
    currentScenarioId: 'scn_test',
    goalThreshold: opts.goalThreshold ?? null,
  } as never)
}

function openModal() {
  act(() => openDefineSuccess())
}

function fillValid(threshold = '20') {
  fireEvent.change(screen.getByTestId('define-success-metric'), {
    target: { value: 'Productivity' },
  })
  fireEvent.change(screen.getByTestId('define-success-threshold'), {
    target: { value: threshold },
  })
  fireEvent.change(screen.getByTestId('define-success-timeframe'), {
    target: { value: 'Within 6 months' },
  })
}

function createRunnerMock() {
  return vi.fn(
    async (_opts?: CanonicalRunOptions): Promise<CanonicalRunOutcome> => ({
      status: 'dispatched',
    }),
  )
}

let runner: ReturnType<typeof createRunnerMock>

beforeEach(() => {
  sessionStorage.clear()
  useSuccessMeasureStore.getState()._reset()
  __resetCanonicalRunnerForTests()
  runner = createRunnerMock()
  registerCanonicalRunner(runner)
  seedCanvas()
})

afterEach(() => {
  useCanvasStore.setState({ setGoalThreshold: originalSetGoalThreshold } as never)
})

describe('DefineSuccessModal — chrome and a11y', () => {
  it('renders nothing until opened', () => {
    render(<DefineSuccessModal />)
    expect(screen.queryByTestId('define-success-modal')).not.toBeInTheDocument()
  })

  it('opens as an aria-modal dialog labelled by the title, focusing the first field', () => {
    render(<DefineSuccessModal />)
    openModal()
    const dialog = screen.getByTestId('define-success-modal')
    expect(dialog).toHaveAttribute('role', 'dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    const labelledBy = dialog.getAttribute('aria-labelledby')
    expect(labelledBy).toBeTruthy()
    expect(document.getElementById(labelledBy as string)).toHaveTextContent(
      DEFINE_SUCCESS_COPY.title,
    )
    expect(document.activeElement).toBe(screen.getByTestId('define-success-metric'))
  })

  it('Escape closes and focus returns to the invoking element', () => {
    render(
      <>
        <button type="button" data-testid="opener">
          open
        </button>
        <DefineSuccessModal />
      </>,
    )
    const opener = screen.getByTestId('opener')
    opener.focus()
    openModal()
    expect(document.activeElement).not.toBe(opener)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByTestId('define-success-modal')).not.toBeInTheDocument()
    expect(document.activeElement).toBe(opener)
  })

  it('the Close icon-button closes', () => {
    render(<DefineSuccessModal />)
    openModal()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByTestId('define-success-modal')).not.toBeInTheDocument()
  })

  it('backdrop click closes; clicks inside the card do not', () => {
    render(<DefineSuccessModal />)
    openModal()
    fireEvent.mouseDown(screen.getByTestId('define-success-modal'))
    expect(screen.getByTestId('define-success-modal')).toBeInTheDocument()
    fireEvent.mouseDown(screen.getByTestId('define-success-modal-overlay'))
    expect(screen.queryByTestId('define-success-modal')).not.toBeInTheDocument()
  })

  it('renders the write-behaviour note and the honesty meta line', () => {
    render(<DefineSuccessModal />)
    openModal()
    expect(screen.getByText(DEFINE_SUCCESS_COPY.writeNote)).toBeInTheDocument()
    expect(screen.getByTestId('define-success-honesty-note')).toHaveTextContent(
      'Only the target number affects the analysis today.',
    )
  })
})

describe('DefineSuccessModal — prefill', () => {
  it('prefills the metric from the live goal node and the threshold from the store', () => {
    seedCanvas({ goalLabel: 'Team output', goalThreshold: 120 })
    render(<DefineSuccessModal />)
    openModal()
    expect(screen.getByTestId('define-success-metric')).toHaveValue('Team output')
    expect(screen.getByTestId('define-success-threshold')).toHaveValue('120')
  })

  it('reopening after a save keeps the saved values', async () => {
    render(<DefineSuccessModal />)
    openModal()
    fillValid('42')
    fireEvent.change(screen.getByTestId('define-success-direction'), {
      target: { value: 'keep_below' },
    })
    fireEvent.change(screen.getByTestId('define-success-baseline'), {
      target: { value: 'Q1 survey' },
    })
    await act(async () => {
      fireEvent.click(screen.getByTestId('define-success-save'))
    })
    expect(screen.queryByTestId('define-success-modal')).not.toBeInTheDocument()

    openModal()
    expect(screen.getByTestId('define-success-metric')).toHaveValue('Productivity')
    expect(screen.getByTestId('define-success-direction')).toHaveValue('keep_below')
    expect(screen.getByTestId('define-success-threshold')).toHaveValue('42')
    expect(screen.getByTestId('define-success-timeframe')).toHaveValue('Within 6 months')
    expect(screen.getByTestId('define-success-baseline')).toHaveValue('Q1 survey')
  })
})

describe('DefineSuccessModal — live preview', () => {
  it('starts with placeholder tokens and assembles the authored sentence as fields fill', () => {
    render(<DefineSuccessModal />)
    openModal()
    expect(screen.getByTestId('measure-preview')).toHaveTextContent(
      'Success means: increase [outcome] by at least [number]% [timeframe].',
    )
    fillValid()
    expect(screen.getByTestId('measure-preview')).toHaveTextContent(
      'Success means: increase Productivity by at least 20% within 6 months.',
    )
  })

  it('re-assembles per direction change', () => {
    render(<DefineSuccessModal />)
    openModal()
    fillValid()
    fireEvent.change(screen.getByTestId('define-success-direction'), {
      target: { value: 'reach_at_least' },
    })
    expect(screen.getByTestId('measure-preview')).toHaveTextContent(
      'Success means: Productivity reaches at least 20% within 6 months.',
    )
    fireEvent.change(screen.getByTestId('define-success-direction'), {
      target: { value: 'keep_below' },
    })
    expect(screen.getByTestId('measure-preview')).toHaveTextContent(
      'Success means: keep Productivity below 20% within 6 months.',
    )
  })
})

describe('DefineSuccessModal — validation (never silent-close)', () => {
  it('Save is disabled while fields are empty and no canonical call fires', () => {
    render(<DefineSuccessModal />)
    openModal()
    const save = screen.getByTestId('define-success-save')
    expect(save).toBeDisabled()
    fireEvent.click(save)
    expect(screen.getByTestId('define-success-modal')).toBeInTheDocument()
    expect(runner).not.toHaveBeenCalled()
  })

  it.each([['20%'], ['abc'], ['1e'], ['']])(
    'threshold %j blocks Save with an inline 11px danger error on blur',
    (bad) => {
      render(<DefineSuccessModal />)
      openModal()
      fillValid()
      const threshold = screen.getByTestId('define-success-threshold')
      fireEvent.change(threshold, { target: { value: bad } })
      fireEvent.blur(threshold)
      expect(screen.getByText(DEFINE_SUCCESS_COPY.thresholdError)).toBeInTheDocument()
      expect(screen.getByTestId('define-success-save')).toBeDisabled()
      expect(threshold).toHaveAttribute('aria-invalid', 'true')
    },
  )

  it('negative thresholds are legitimate and pass', () => {
    render(<DefineSuccessModal />)
    openModal()
    fillValid('-5')
    expect(screen.getByTestId('define-success-save')).toBeEnabled()
  })

  it('empty metric and timeframe each block Save with their own field errors', () => {
    render(<DefineSuccessModal />)
    openModal()
    fillValid()
    const metric = screen.getByTestId('define-success-metric')
    fireEvent.change(metric, { target: { value: '  ' } })
    fireEvent.blur(metric)
    expect(screen.getByText(DEFINE_SUCCESS_COPY.metricError)).toBeInTheDocument()
    expect(screen.getByTestId('define-success-save')).toBeDisabled()

    fireEvent.change(metric, { target: { value: 'Productivity' } })
    const timeframe = screen.getByTestId('define-success-timeframe')
    fireEvent.change(timeframe, { target: { value: '' } })
    fireEvent.blur(timeframe)
    expect(screen.getByText(DEFINE_SUCCESS_COPY.timeframeError)).toBeInTheDocument()
    expect(screen.getByTestId('define-success-save')).toBeDisabled()
  })

  it('the baseline is optional', () => {
    render(<DefineSuccessModal />)
    openModal()
    fillValid()
    expect(screen.getByTestId('define-success-save')).toBeEnabled()
  })
})

describe('DefineSuccessModal — save commits through the canonical path exactly once', () => {
  it('Codex B2+B3: with a goal node and a provable cap, commits atomically to the node and sends the NORMALISED threshold', async () => {
    // Goal node + a cap on ceeAnalysisReady (the same source the V2 request
    // boundary uses). Entering 60 (unit %) must: update the goal node's
    // data (B2 — no more "target missing"), and send goal_threshold 0.6 on
    // the chip (B3 — 60 / cap 100), not raw 60.
    useCanvasStore.setState({
      nodes: [
        { id: 'goal_1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Ship on time' } },
      ] as never,
      currentScenarioId: 'scn_test',
      outcomeNodeId: 'goal_1',
      ceeAnalysisReady: { goal_threshold_cap: 100 } as never,
      goalThreshold: null,
    } as never)

    render(<DefineSuccessModal />)
    openModal()
    fillValid('60')
    await act(async () => {
      fireEvent.click(screen.getByTestId('define-success-save'))
    })

    // B2: the goal node carries the user target atomically (store + node).
    const goalNode = useCanvasStore.getState().nodes.find((n) => n.id === 'goal_1')!
    expect((goalNode.data as { success_threshold?: number }).success_threshold).toBe(60)
    expect((goalNode.data as { threshold_source?: string }).threshold_source).toBe('user')
    expect(useCanvasStore.getState().goalThreshold).toBe(60)

    // B3: the chip carries the NORMALISED 0-1 value, never raw 60.
    expect(runner).toHaveBeenCalledTimes(1)
    expect(runner).toHaveBeenCalledWith({
      source: 'define-success-modal',
      parameters: { goal_threshold: 0.6 },
    })
  })

  it('persists the full structured measure, calls the ONE setter and ONE canonical rerun, toasts and closes', async () => {
    const setterSpy = vi.fn(originalSetGoalThreshold)
    useCanvasStore.setState({ setGoalThreshold: setterSpy } as never)

    render(<DefineSuccessModal />)
    openModal()
    fillValid('20')
    fireEvent.change(screen.getByTestId('define-success-direction'), {
      target: { value: 'reach_at_least' },
    })
    await act(async () => {
      fireEvent.click(screen.getByTestId('define-success-save'))
    })

    // ONE setter call with the raw user-unit number (UI-SEM-058 normalises
    // downstream at the request boundary, same as the hero editor).
    expect(setterSpy).toHaveBeenCalledTimes(1)
    expect(setterSpy).toHaveBeenCalledWith(20)
    expect(useCanvasStore.getState().goalThreshold).toBe(20)

    // ONE canonical rerun. Deliberate pin flip (Lane 1b, UI-SEM-081): this
    // fixture has no producer/node cap, but the modal's default unit is "%",
    // which is a definitional cap of 100 — so raw 20 now provably normalises
    // to 0.2 and RIDES the chip (previously the fail-closed omission
    // swallowed every %-target on live drafts, V-P0-1). Raw values are still
    // never sent.
    expect(runner).toHaveBeenCalledTimes(1)
    expect(runner).toHaveBeenCalledWith({
      source: 'define-success-modal',
      parameters: { goal_threshold: 0.2 },
    })

    // Full structured measure persisted per scenario.
    const saved = selectSuccessMeasure(useSuccessMeasureStore.getState(), 'scn_test')
    expect(saved).toMatchObject({
      metric: 'Productivity',
      direction: 'reach_at_least',
      threshold: 20,
      unit: '%',
      timeframe: 'Within 6 months',
      baseline: null,
    })

    expect(screen.queryByTestId('define-success-modal')).not.toBeInTheDocument()
    expect(screen.getByTestId('define-success-toast')).toHaveTextContent(
      DEFINE_SUCCESS_COPY.toastSaved,
    )
  })

  it('fires the canonical run again on a later save (guard resets per open)', async () => {
    render(<DefineSuccessModal />)
    openModal()
    fillValid('20')
    await act(async () => {
      fireEvent.click(screen.getByTestId('define-success-save'))
    })
    openModal()
    await act(async () => {
      fireEvent.click(screen.getByTestId('define-success-save'))
    })
    expect(runner).toHaveBeenCalledTimes(2)
  })

  it('a blocked rerun still saves the measure and toasts the honest gate reason', async () => {
    runner.mockImplementation(async () => ({ status: 'blocked', reason: 'Add a goal first.' }))
    render(<DefineSuccessModal />)
    openModal()
    fillValid('20')
    await act(async () => {
      fireEvent.click(screen.getByTestId('define-success-save'))
    })
    expect(
      selectSuccessMeasure(useSuccessMeasureStore.getState(), 'scn_test'),
    ).not.toBeNull()
    expect(screen.getByTestId('define-success-toast')).toHaveTextContent(
      'Success measure saved. Add a goal first.',
    )
  })

  it('with NO registered runner the save degrades honestly (toast, no crash)', async () => {
    __resetCanonicalRunnerForTests()
    render(<DefineSuccessModal />)
    openModal()
    fillValid('20')
    await act(async () => {
      fireEvent.click(screen.getByTestId('define-success-save'))
    })
    expect(screen.getByTestId('define-success-toast')).toHaveTextContent(
      /Success measure saved\./,
    )
  })
})

describe('DefineSuccessModal — Lane 1b (V-P0-1): the target must reach the wire, or say why not', () => {
  it('the % unit ALONE proves the cap: 60 % with no producer/node cap sends goal_threshold 0.6', async () => {
    // Live staging repro (2026-07-13, scenario f0acea23): analysis_ready has
    // no goal_threshold_cap and the CEE-drafted goal node has no scale_max,
    // so the save shipped a chip with NO parameters at all — the modal's own
    // explicit "%" unit was never consulted. "%" is a definitional cap of 100.
    useCanvasStore.setState({
      nodes: [
        { id: 'goal_1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Conversion' } },
      ] as never,
      currentScenarioId: 'scn_test',
      outcomeNodeId: null,
      ceeAnalysisReady: null,
      goalThreshold: null,
    } as never)

    render(<DefineSuccessModal />)
    openModal()
    fillValid('60') // default unit is %
    await act(async () => {
      fireEvent.click(screen.getByTestId('define-success-save'))
    })

    expect(runner).toHaveBeenCalledTimes(1)
    expect(runner).toHaveBeenCalledWith({
      source: 'define-success-modal',
      parameters: { goal_threshold: 0.6 },
    })
  })

  it('the cap resolves from the COMMITTED goal node, not store.outcomeNodeId', async () => {
    // Test-practice audit finding: the B2 commit resolved
    // analysisReady.goal_node_id ?? first goal node, while the B3 cap context
    // used store.outcomeNodeId — two different ids in one handler. With a
    // divergent outcomeNodeId, the cap must still come from the node the
    // threshold was just committed to.
    useCanvasStore.setState({
      nodes: [
        {
          id: 'goal_1',
          type: 'goal',
          position: { x: 0, y: 0 },
          data: { label: 'Throughput', scale_max: 200 },
        },
      ] as never,
      currentScenarioId: 'scn_test',
      outcomeNodeId: 'some_other_node',
      ceeAnalysisReady: { goal_node_id: 'goal_1' } as never,
      goalThreshold: null,
    } as never)

    render(<DefineSuccessModal />)
    openModal()
    fillValid('60')
    // A non-% unit isolates the node-cap path from the unit cap.
    fireEvent.change(screen.getByTestId('define-success-unit'), {
      target: { value: 'projects' },
    })
    await act(async () => {
      fireEvent.click(screen.getByTestId('define-success-save'))
    })

    expect(runner).toHaveBeenCalledTimes(1)
    expect(runner).toHaveBeenCalledWith({
      source: 'define-success-modal',
      parameters: { goal_threshold: 0.3 },
    })
  })

  it('when the target genuinely cannot reach the analysis, the toast says so honestly', async () => {
    // Non-% unit, no cap anywhere: the parameter is rightly omitted — but the
    // user must not be told a plain "saved" while the analysis silently never
    // sees the target (the live goal node then advises futile reruns).
    useCanvasStore.setState({
      nodes: [
        { id: 'goal_1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Projects' } },
      ] as never,
      currentScenarioId: 'scn_test',
      outcomeNodeId: null,
      ceeAnalysisReady: null,
      goalThreshold: null,
    } as never)

    render(<DefineSuccessModal />)
    openModal()
    fillValid('60')
    fireEvent.change(screen.getByTestId('define-success-unit'), {
      target: { value: 'projects' },
    })
    await act(async () => {
      fireEvent.click(screen.getByTestId('define-success-save'))
    })

    expect(runner).toHaveBeenCalledTimes(1)
    expect(runner).toHaveBeenCalledWith({ source: 'define-success-modal' })
    expect(screen.getByTestId('define-success-toast')).toHaveTextContent(
      DEFINE_SUCCESS_COPY.toastSavedNoScale,
    )
  })
})

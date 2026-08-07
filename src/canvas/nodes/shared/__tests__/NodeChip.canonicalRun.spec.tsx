/**
 * Node "Run analysis" chips execute the CANONICAL run pipeline.
 *
 * The defect (derived 2026-07-28): the chips at GoalNode.tsx
 * (`goal_run_analysis`) and DecisionNode.tsx (`decision_run_analysis`) called
 * the guidance bridge's `_dispatchAction` DIRECTLY, so a click bypassed
 * everything OutputsDock's `runCanonicalAnalysis` does before dispatching:
 *
 *  1. the readiness gate (`canRunAnalysis`, incl. computeCeeCannotSeeModel) —
 *     a graph CEE cannot see could still dispatch a run;
 *  2. the `flushPendingSaves()` barrier — a click inside the 1500ms autosave
 *     debounce resolved against the PREVIOUS persisted graph (edit loss);
 *  3. the stored `goal_threshold` re-attachment — the user's saved success
 *     target was silently dropped (the V-P0-1 defect, through another door).
 *
 * And with no dispatcher registered the click was a SILENT no-op
 * (`if (send) send(message)`), unlike `executeCanonicalRun`, which always
 * returns a reason.
 *
 * These tests pin the ROUTING at the real registry seam. Whether the
 * canonical pipeline itself applies the gate / flush / threshold is pinned
 * where that pipeline lives (OutputsDock.analysis-run.spec.tsx) — including
 * the case that matters for this fix: a chip's `chip_id` parameter must NOT
 * suppress the store threshold.
 */

import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, cleanup, screen, waitFor, act } from '@testing-library/react'

import { NodeChip } from '../NodeChip'
import { ToastProvider } from '../../../ToastContext'
import { useGuidanceStore } from '../../../stores/guidanceStore'
import {
  registerCanonicalRunner,
  __resetCanonicalRunnerForTests,
  RUNNER_UNAVAILABLE_MESSAGE,
  type CanonicalRunner,
  type CanonicalRunOutcome,
} from '../../../analysis/canonicalRunRegistry'

/** Typed spy: preserves the runner's option parameter so `mock.calls[0][0]`
 *  is the CanonicalRunOptions the chip passed, not an empty tuple. */
function runnerSpy(outcome: CanonicalRunOutcome) {
  return vi.fn<Parameters<CanonicalRunner>, ReturnType<CanonicalRunner>>(
    async () => outcome,
  )
}

let unregisterBridge: (() => void) | null = null

/** Register the guidance bridge so a bypass would be VISIBLE, not silent. */
function registerBridge() {
  const sendMessage = vi.fn()
  const dispatchAction = vi.fn()
  unregisterBridge = useGuidanceStore
    .getState()
    .registerConversationCallbacks(
      sendMessage,
      vi.fn(),
      undefined,
      undefined,
      undefined,
      dispatchAction,
    )
  return { sendMessage, dispatchAction }
}

afterEach(() => {
  unregisterBridge?.()
  unregisterBridge = null
  __resetCanonicalRunnerForTests()
  cleanup()
})

function clickRunChip(chipId: string) {
  render(
    <ToastProvider>
      <NodeChip
        chipId={chipId}
        actionType="run_analysis"
        label="Run analysis"
        message="Run the analysis now"
      />
    </ToastProvider>,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Run analysis' }))
}

describe('node run chips → the registered canonical runner', () => {
  it.each([
    ['goal_run_analysis', 'GoalNode'],
    ['decision_run_analysis', 'DecisionNode'],
  ])('%s (%s) reaches the REGISTERED canonical runner, never the bridge directly', async (chipId) => {
    const { dispatchAction, sendMessage } = registerBridge()
    const runner = runnerSpy({ status: 'dispatched' })
    registerCanonicalRunner(runner)

    clickRunChip(chipId)

    await waitFor(() => expect(runner).toHaveBeenCalledTimes(1))
    // The bypass is what this lane closed: a direct bridge dispatch skips the
    // gate, the save flush and the threshold. It must not happen.
    expect(dispatchAction).not.toHaveBeenCalled()
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('carries chip_id provenance and its own source label into the canonical call', async () => {
    registerBridge()
    const runner = runnerSpy({ status: 'dispatched' })
    registerCanonicalRunner(runner)

    clickRunChip('goal_run_analysis')

    await waitFor(() => expect(runner).toHaveBeenCalledTimes(1))
    expect(runner.mock.calls[0][0]).toEqual({
      source: 'node-chip',
      parameters: { chip_id: 'goal_run_analysis' },
    })
  })

  it('surfaces a BLOCKED gate reason instead of running (the readiness gate is now reachable)', async () => {
    registerBridge()
    registerCanonicalRunner(async () => ({
      status: 'blocked',
      reason: 'Add at least two options before running.',
    }))

    clickRunChip('decision_run_analysis')

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Add at least two options before running.')
  })

  it('with NO canonical runner registered the click surfaces a reason — never a silent no-op', async () => {
    // The pre-fix behaviour with no bridge registered was `if (send) send(...)`:
    // nothing happened and nothing was said. executeCanonicalRun folds the
    // no-host case into the outcome union precisely so this cannot recur.
    const { dispatchAction, sendMessage } = registerBridge()
    __resetCanonicalRunnerForTests()

    clickRunChip('goal_run_analysis')

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(RUNNER_UNAVAILABLE_MESSAGE)
    expect(dispatchAction).not.toHaveBeenCalled()
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('the direct-V2 arm is announced — a canvas click never looks like nothing happened', async () => {
    // Review amendment, 2026-07-28. When the canonical path is off (or V5 is
    // ineligible at runtime) runCanonicalAnalysis returns {status:'v2'}: the
    // run started, but via direct PLoT, so there is NO chat turn. Pre-fix the
    // chip always produced a V5 chip turn, so without this arm the fix would
    // have traded one silence for another on that branch.
    //
    // Derived from the DEPLOYED staging bundle (assets/flags-BOFkajto.js,
    // 2026-07-28): VITE_V5_CANONICAL_ANALYSIS:"true" and
    // VITE_ENABLE_V5_ORCHESTRATOR:"true" — so staging takes the 'dispatched'
    // arm today and this is belt-and-braces. It is still reachable there:
    // isV5CanonicalRunPath() ALSO requires isV5Eligible(), which can fail at
    // runtime. Note the flag is absent from netlify.toml and defaults OFF in
    // flags.ts — repo config is not evidence of what is deployed.
    registerBridge()
    registerCanonicalRunner(async () => ({ status: 'v2' }))

    clickRunChip('goal_run_analysis')

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Running analysis…')
  })

  it('the dispatched arm stays quiet — its V5 chip turn is the acknowledgement', async () => {
    // Guards against double-announcing: a toast here would sit on top of the
    // conversation bubble the dispatch already produces.
    //
    // NOT a vacuous absence (trap 13): the absence is asserted only AFTER the
    // runner has demonstrably been called and the outcome promise has been
    // flushed — the same point at which every other arm in this file has its
    // alert on screen. A mutant that toasts here turns it RED.
    registerBridge()
    const runner = runnerSpy({ status: 'dispatched' })
    registerCanonicalRunner(runner)

    clickRunChip('goal_run_analysis')

    await waitFor(() => expect(runner).toHaveBeenCalledTimes(1))
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('already-running is reported, not swallowed', async () => {
    registerBridge()
    registerCanonicalRunner(async () => ({ status: 'already-running' }))

    clickRunChip('goal_run_analysis')

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('An analysis is already running.')
  })

  it('a COACHING chip is untouched — it still uses the guidance bridge, not the runner', async () => {
    const { dispatchAction } = registerBridge()
    const runner = runnerSpy({ status: 'dispatched' })
    registerCanonicalRunner(runner)

    render(
      <ToastProvider>
        <NodeChip
          chipId="risk_add_mitigation"
          actionType={null}
          label="Add mitigation"
          message="Suggest a mitigation strategy for this risk"
        />
      </ToastProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Add mitigation' }))

    await waitFor(() => expect(dispatchAction).toHaveBeenCalledTimes(1))
    expect(runner).not.toHaveBeenCalled()
    expect(dispatchAction.mock.calls[0][0]).toMatchObject({
      parameters: { chip_id: 'risk_add_mitigation' },
      source: 'chip',
    })
  })
})

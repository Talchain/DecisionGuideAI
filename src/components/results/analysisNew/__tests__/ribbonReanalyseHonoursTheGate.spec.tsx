/**
 * ONE QUESTION — "MAY I RE-ANALYSE?" — ASKED BY TWO CONTROLS ON ONE SURFACE.
 *
 * The Analysis (New) surface offers the re-run twice: the staleness ribbon's
 * inline control inside `AtAGlance`, and the shell's footer bar
 * (`shellContract.ts` declares `footerBar: 'reanalyse'` for this surface). The
 * footer control reads the dock's shared admission (`runGateResult`); the
 * ribbon control was handed a bare handler and no gate at all.
 *
 * ⭐ THE HARM IS A SELF-CONTRADICTING SURFACE. Once the footer control honours
 * the gate, a blocked model renders a DISABLED footer control carrying the
 * refusal beside an ENABLED ribbon control for the same action, ~200px apart.
 * The product tells the user both that it will not run and that it will.
 *
 * ⚠ AND THE FIX IS NOT TWO AGREEING DEFAULTS. This estate has shipped that
 * before (CLAUDE.md trap 21): two predicates that agree today drift tomorrow.
 * Both controls must read the SAME verdict, threaded down from the one place
 * `canRunAnalysis` is computed. This file pins what the component does with
 * the verdict it is handed; `ribbonAndFooterShareOneAdmission.sourceScan`
 * pins that the dock hands it the footer's own expression.
 *
 * ⚠ `isRunning` IS LOAD-BEARING AND HAS ITS OWN CASE BELOW. `canRunAnalysis`
 * is FALSE while a run is in flight, so `blocked = !canRun` alone would make
 * this bar call a RUNNING analysis a REFUSAL. The predicate is
 * `!canRun && !isAnalysing`, the same shape `AnalysisReadinessBar` and
 * `PanelFooter` already use over the same verdict.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { genuineDecision } from './analysisNewFixtures'

afterEach(cleanup)

const RIBBON = 'analysis-new-glance-ribbon-reanalyse'
const REFUSAL = 'Add values to Option B before running'

/** Stale + a handler is the only state in which the ribbon control renders at
 *  all, so every case here holds those two fixed and varies ONLY the gate. */
const draw = (over: Record<string, unknown> = {}) =>
  render(
    <AnalysisNewTabBody
      resultsSectionData={genuineDecision()}
      isPreRun={false}
      isRunning={false}
      isStale
      staleReason="unconfirmed"
      responseHash="run_abc123"
      canRunAnalysis
      runBlockedReason={null}
      {...over}
    />,
  )

describe('the ribbon re-analyse control honours the run gate', () => {
  /**
   * ⚠ THE PRECONDITION IS PINNED IN-TEST. A blocked-state assertion passes
   * vacuously on a render that shows no control for some unrelated reason, so
   * the allowed case below proves the control IS reachable on this fixture
   * before the blocked cases claim anything about it being unreachable.
   */
  it('CONTROL: an allowed gate leaves the control pressable', async () => {
    const onReanalyse = vi.fn()
    draw({ onReanalyse, canRunAnalysis: true, runBlockedReason: null })
    const control = screen.getByTestId(RIBBON)
    expect(control).toBeEnabled()
    await userEvent.click(control)
    expect(onReanalyse).toHaveBeenCalledTimes(1)
  })

  it('refuses the run the gate refuses, and says why', async () => {
    const onReanalyse = vi.fn()
    draw({ onReanalyse, canRunAnalysis: false, runBlockedReason: REFUSAL })
    const control = screen.getByTestId(RIBBON)
    expect(control).toBeDisabled()
    expect(control).toHaveAttribute('title', REFUSAL)
    await userEvent.click(control)
    expect(onReanalyse).not.toHaveBeenCalled()
  })

  /**
   * ⭐ THE CLAUSE A NAIVE FIX DROPS. `canRunAnalysis` is false DURING a run —
   * the gate refuses a double-run. Reading that as a refusal would put the
   * gate's blocked copy on a control whose action is already happening.
   */
  it('does NOT call a run in flight a refusal', () => {
    draw({ onReanalyse: vi.fn(), isRunning: true, canRunAnalysis: false, runBlockedReason: REFUSAL })
    const control = screen.getByTestId(RIBBON)
    expect(control).toBeEnabled()
    expect(control).not.toHaveAttribute('title', REFUSAL)
  })

  /**
   * ⚠ FAIL-CLOSED, AND IT IS THE DISCRIMINATING HALF. A host that hands no
   * verdict must not get today's behaviour by default — that is exactly how
   * this defect would return at the next mount site. No verdict and no reason
   * is a dead button with nothing to say, so the panel offers no control, the
   * same shape it already uses for a missing handler.
   */
  it('renders NO control when no verdict was supplied', () => {
    draw({ onReanalyse: vi.fn(), canRunAnalysis: null, runBlockedReason: null })
    expect(screen.getByTestId('analysis-new-status-freshness-unknown')).toBeInTheDocument()
    expect(screen.queryByTestId(RIBBON)).toBeNull()
  })

  it('renders NO control when the gate refuses without a reason', () => {
    draw({ onReanalyse: vi.fn(), canRunAnalysis: false, runBlockedReason: null })
    expect(screen.queryByTestId(RIBBON)).toBeNull()
  })
})

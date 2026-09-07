/**
 * ONE QUESTION — "MAY I RE-ANALYSE?" — ASKED BY TWO CONTROLS ON ONE SURFACE.
 *
 * The Analysis (New) surface offers the re-run twice: the staleness ribbon's
 * inline control inside `AtAGlance`, and the shell's footer bar
 * (`shellContract.ts` declares `footerBar: 'reanalyse'` for this surface,
 * which renders `ReanalyseBar`). The ribbon control was handed a bare handler
 * and no gate at all, so it could not refuse anything.
 *
 * ⚠ NEITHER CONTROL READ THE GATE AT THE HEAD THIS FILE WAS WRITTEN AGAINST.
 * `ReanalyseBar` takes only `onReanalyse` and disables on `!onReanalyse`; PR
 * #1212 is what gives it the dock's `canRunAnalysis` / `runBlockedTooltip`.
 * The two are siblings and should land adjacent.
 *
 * ⭐ THE HARM IS A SELF-CONTRADICTING SURFACE. With only #1212 landed, a
 * blocked model renders a DISABLED footer control carrying the refusal beside
 * an ENABLED ribbon control for the same action on the same screen: the
 * product tells the user both that it will not run and that it will. With
 * only this half landed the contradiction runs the other way — the ribbon
 * refuses while the footer still offers the run, which fails loudly through
 * `showToast` rather than silently. This file closes the ribbon's half.
 *
 * ⚠ AND THE FIX IS NOT TWO AGREEING DEFAULTS. This estate has shipped that
 * before (CLAUDE.md trap 21): two predicates that agree today drift tomorrow.
 * Both controls must read the SAME verdict, threaded down from the one place
 * `canRunAnalysis` is computed. This file pins what the component does with
 * the verdict it is handed; `ribbonAndFooterShareOneAdmission.sourceScan`
 * pins that the dock hands it the same expression `AnalysisReadinessBar`
 * receives.
 *
 * ⚠ `isRunning` IS LOAD-BEARING AND HAS THREE CASES BELOW, BECAUSE IT ANSWERS
 * A DIFFERENT QUESTION FROM THE GATE. `canRunAnalysis` is FALSE while a run is
 * in flight, so `blocked = !canRun` alone would make this control call a
 * RUNNING analysis a REFUSAL — hence `!canRun && !isRunning` for the copy, the
 * shape `AnalysisReadinessBar` and `PanelFooter` already use over the same
 * verdict.
 *
 * ⚠⚠ AND THAT PREDICATE MUST NOT ALSO DRIVE `disabled`, WHICH IS HOW THIS FILE
 * FIRST PINNED THE DEFECT. It is false mid-run, so the control was ENABLED
 * during a run: the click reached `runCanonicalAnalysis`, took its
 * `already-running` early return, and `handleRunAnalysis` — which toasts on
 * `blocked` / `unavailable` only — dropped it. An enabled control that does
 * nothing and says nothing. Pressability is `isRunning || reanalyseBlocked`;
 * refusal is `reanalyseBlocked`. One name, two questions (CLAUDE.md trap 21).
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { AtAGlance } from '../sections/AtAGlance'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
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
   * ── A RUN IN FLIGHT: ONE STATE, TWO QUESTIONS, THREE ARMS ────────────────
   *
   * ⭐ THE CLAUSE A NAIVE FIX DROPS. `canRunAnalysis` is false DURING a run —
   * the gate refuses a double-run. Reading that as a refusal would put the
   * gate's blocked copy on a control whose action is already happening.
   *
   * ⚠ AND THE CLAUSE THE FIRST FIX DROPPED THE OTHER WAY. The original of
   * this case asserted `toBeEnabled()` mid-run, which pinned the defect: it
   * bound one predicate to two questions. A run in flight is genuinely NOT a
   * refusal (so no refusal copy — the arm below keeps that claim intact) AND
   * genuinely NOT pressable (so `disabled` — the arm after it). The two are
   * separated here because a single arm asserting both cannot say which one a
   * regression broke, and because the mutants that discriminate them are
   * different mutants.
   */
  it('does NOT call a run in flight a refusal — no refusal copy mid-run', () => {
    draw({ onReanalyse: vi.fn(), isRunning: true, canRunAnalysis: false, runBlockedReason: REFUSAL })
    const control = screen.getByTestId(RIBBON)
    // The control is still RENDERED — a run in flight must not make it vanish,
    // and this pins the precondition for the negative assertion beside it.
    expect(control).toBeInTheDocument()
    expect(control).not.toHaveAttribute('title', REFUSAL)
    expect(screen.queryByText(REFUSAL)).toBeNull()
  })

  /**
   * ⭐⭐ AND IT IS NOT PRESSABLE EITHER. `reanalyseBlocked` is
   * `!canRunAnalysis && !isRunning`, so it is FALSE mid-run; binding
   * `disabled` to it left the button live for the one state in which pressing
   * it can achieve nothing. The siblings all disable here —
   * `PanelFooter` (`isAnalysing || !canRun`), `AnalysisReadinessBar`
   * (`disabled={isAnalysing || !canRun}`) — and so does `ReanalyseBar` once
   * #1212 lands (`!onReanalyse || blocked || isAnalysing`). This surface now
   * reads the same shape.
   */
  it('disables the control while a run is in flight', () => {
    draw({ onReanalyse: vi.fn(), isRunning: true, canRunAnalysis: false, runBlockedReason: REFUSAL })
    expect(screen.getByTestId(RIBBON)).toBeDisabled()
  })

  /**
   * ⭐⭐ THE HARM ITSELF, NOT A PROXY FOR IT: A CLICK THAT REACHES NOTHING AND
   * SAYS NOTHING.
   *
   * Mid-run the ribbon is still mounted (`isStale` is independent of
   * `isRunning` — `OutputsDock` passes `isStale={analysisNotConfirmedFresh}`,
   * and `useAnalysisNewViewModel` passes it straight through), so the user
   * genuinely sees this control while an analysis runs. `onReanalyse` is the
   * dock's `handleRunAnalysis`, whose `runCanonicalAnalysis` opens with
   * `if (isRunning) return { status: 'already-running' }` — and
   * `handleRunAnalysis` raises a toast on `'blocked' | 'unavailable'` ONLY.
   * So a mid-run click was a silent no-op: no run, no message, no change.
   *
   * ⚠ THIS ARM ASSERTS THE HANDLER IS NEVER REACHED, which is the only fix
   * available on this side of the boundary — the toast gap lives in
   * `OutputsDock`. A disabled button cannot dispatch the click, so the dead
   * path is unreachable rather than merely quiet.
   */
  it('a mid-run click cannot reach the silent already-running no-op', async () => {
    const onReanalyse = vi.fn()
    draw({ onReanalyse, isRunning: true, canRunAnalysis: false, runBlockedReason: REFUSAL })
    await userEvent.click(screen.getByTestId(RIBBON))
    expect(onReanalyse).not.toHaveBeenCalled()
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

/**
 * ── THE COMPONENT'S OWN REFUSAL GATE, ISOLATED FROM THE CALLER'S MASK ───────
 *
 * ⚠⚠ WHY THIS BLOCK EXISTS, AND IT IS A MEASURED FINDING RATHER THAN A
 * PRECAUTION. The mid-run "no refusal copy" arm above renders through
 * `AnalysisNewTabBody`, which passes
 * `reanalyseBlockedReason={reanalyseBlocked ? runBlockedReason : null}` — so
 * mid-run the REASON IS ALREADY NULL before `AtAGlance` sees it. A mutant that
 * loosens `AtAGlance`'s own `title` gate to the pressability predicate
 * therefore SURVIVES that arm (measured: 7/7 green under it). The arm is not
 * wrong, but what protects it is the caller's mask, not the expression it
 * names, so it cannot discriminate this component's own behaviour.
 *
 * Rendering `AtAGlance` directly with `reanalyseBlocked={false}` AND a
 * NON-NULL reason is the only state that isolates its `title` gate. It is also
 * a state a future caller could reach by dropping the mask — defence in depth
 * is only defence if each layer is pinned separately.
 */
describe('AtAGlance does not caption a running control with a refusal that did not happen', () => {
  const glanceOf = () =>
    buildAnalysisNewViewModel({
      data: genuineDecision(),
      recommendations: [],
      isPreRun: false,
      isRunning: false,
      isStale: false,
    }).atAGlance

  it('CONTROL: this fixture renders the ribbon control at all', () => {
    render(
      <AtAGlance
        glance={glanceOf()}
        isStale
        staleKind="unconfirmed"
        onReanalyse={vi.fn()}
        reanalyseBlocked={false}
        reanalyseBlockedReason={REFUSAL}
        isRunning={false}
      />,
    )
    expect(screen.getByTestId(RIBBON)).toBeInTheDocument()
  })

  it('withholds the refusal title mid-run even when handed a reason', () => {
    render(
      <AtAGlance
        glance={glanceOf()}
        isStale
        staleKind="unconfirmed"
        onReanalyse={vi.fn()}
        // A run in flight is NOT a refusal — so the gate's verdict is false…
        reanalyseBlocked={false}
        // …while a reason is nonetheless present. Only `AtAGlance`'s own
        // `title` gate decides whether it is shown.
        reanalyseBlockedReason={REFUSAL}
        isRunning
      />,
    )
    const control = screen.getByTestId(RIBBON)
    expect(control).not.toHaveAttribute('title', REFUSAL)
    expect(control).not.toHaveAttribute('title')
  })
})

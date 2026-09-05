/**
 * ReanalyseBar — the bar's Re-analyse control obeys the SAME run gate its
 * sibling bar obeys.
 *
 * ── THE WITNESSED DEFECT (fresh guest, deployed `582b7ea7`, 5 Sep 2026) ─────
 * Starter model *Customer Data Platform Selection*, dock at 416px. On ONE
 * model at ONE moment:
 *
 *   - Analysis tab      `pre-analysis-v3-analyse`  DISABLED, title
 *                       "Analysis is held on a saved example. Re-draft it
 *                        live to run one."
 *   - Analysis (New)    `reanalyse-button`         ENABLED, no title
 *   - Model tab         `reanalyse-button`         ENABLED, no title
 *
 * Clicking the enabled control produced **zero network requests** (read at the
 * CDP layer, not through a patched `window.fetch`: 109 requests before, 109
 * after, same last request id) and no state change of any kind. The product
 * offered an action that terminates in silence, while the sentence explaining
 * the refusal was already on screen — attached to the other tab's control.
 *
 * ── WHY THE FIX IS WIRING, NOT COPY ────────────────────────────────────────
 * `OutputsDock` computes `canRunAnalysis` and `runBlockedTooltip` ONCE, above
 * the tab branch, and its footer switch has two arms:
 *
 *     case 'reanalyse':  <ReanalyseBar onReanalyse={handleRunAnalysis} />
 *     case 'readiness':  <AnalysisReadinessBar canRun={…} blockedReason={…} …/>
 *
 * One switch, one owner, two bars — and only one of them was handed the
 * verdict. `AnalysisReadinessBar`'s header already states the rule this spec
 * enforces for its sibling: *"THE BUTTON'S HONESTY IS THE POINT AND IS NOT
 * NEGOTIABLE. It is `disabled` on exactly `!canRun`, and carries the gate's own
 * sentence as its `title`. It must never look pressable while the gate is
 * shut."* Nothing is re-derived here; the gate stays the shell's.
 *
 * ⚠ THE TWO QUESTIONS STAY APART (trap 21). *"Has the model changed since the
 * last run?"* is the bar's CLAIM; *"may an analysis run right now?"* is the
 * button's GATE. They are independently true, so the fix ADDS the refusal and
 * leaves the claim alone — the last test here fails if a future edit collapses
 * them into one sentence.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ReanalyseBar } from '../ReanalyseBar'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockFreshness: any = null
let mockDirty = false
let mockImportHold = false

vi.mock('../../../store', () => ({
  useCanvasStore: vi.fn((selector: (s: unknown) => unknown) =>
    selector({
      analysisFreshness: mockFreshness,
      analysisFreshnessDirty: mockDirty,
      importPendingServerRegistration: mockImportHold,
    })
  ),
}))

/** The exact sentence the deployed Analysis tab carried while the Model tab's
 *  control sat enabled beside it. */
const HELD = 'Analysis is held on a saved example. Re-draft it live to run one.'

beforeEach(() => {
  // The one state the defect was witnessed in: a genuine CEE stale verdict, so
  // the bar mounts on its normal `model-changed` branch.
  mockFreshness = { freshness: 'stale' }
  mockDirty = false
  mockImportHold = false
})

describe('ReanalyseBar honours the run gate', () => {
  it('PRECONDITION: this fixture mounts the bar on the model-changed branch', () => {
    render(<ReanalyseBar onReanalyse={vi.fn()} />)
    // Pins the precondition in-test: every assertion below is about a MOUNTED
    // bar on the branch the defect was measured on, not a bar that failed to
    // render for some unrelated reason.
    expect(screen.getByTestId('reanalyse-bar')).toHaveAttribute('data-reason', 'model-changed')
  })

  it('disables the control when the shell says the run is refused', () => {
    render(<ReanalyseBar onReanalyse={vi.fn()} canRun={false} blockedReason={HELD} />)
    expect(screen.getByTestId('reanalyse-button')).toBeDisabled()
  })

  it('carries the gate’s own sentence as the control’s title', () => {
    render(<ReanalyseBar onReanalyse={vi.fn()} canRun={false} blockedReason={HELD} />)
    expect(screen.getByTestId('reanalyse-button')).toHaveAttribute('title', HELD)
  })

  it('shows the reason as TEXT, not only on hover', () => {
    // A `title` is unreachable by touch and by keyboard. The deployed defect was
    // not merely that the button was enabled — it was that pressing it said
    // nothing at all, so the reason has to be legible without a pointer.
    render(<ReanalyseBar onReanalyse={vi.fn()} canRun={false} blockedReason={HELD} />)
    expect(screen.getByTestId('reanalyse-blocked-reason')).toHaveTextContent(HELD)
  })

  it('cannot fire the runner while the gate is shut — the silent no-op becomes impossible', () => {
    const onReanalyse = vi.fn()
    render(<ReanalyseBar onReanalyse={onReanalyse} canRun={false} blockedReason={HELD} />)
    fireEvent.click(screen.getByTestId('reanalyse-button'))
    expect(onReanalyse).not.toHaveBeenCalled()
  })

  it('leaves the working control exactly as it was when the gate is open', () => {
    const onReanalyse = vi.fn()
    render(<ReanalyseBar onReanalyse={onReanalyse} canRun={true} />)
    const btn = screen.getByTestId('reanalyse-button')
    expect(btn).toBeEnabled()
    expect(btn).not.toHaveAttribute('title')
    expect(screen.queryByTestId('reanalyse-blocked-reason')).toBeNull()
    fireEvent.click(btn)
    expect(onReanalyse).toHaveBeenCalledTimes(1)
  })

  it('an omitted verdict keeps today’s behaviour — absence is not a refusal', () => {
    // Losing this control outright is a defect this component has already paid
    // for once (ROADMAP 2.129 (a)). A caller that supplies nothing must not have
    // its button silently taken away; the shell-binding guard below is what
    // stops that default from quietly reinstating the original defect.
    const onReanalyse = vi.fn()
    render(<ReanalyseBar onReanalyse={onReanalyse} />)
    expect(screen.getByTestId('reanalyse-button')).toBeEnabled()
  })

  it('DISCRIMINATOR: the gate changes the control, never the bar’s own claim', () => {
    // The two questions are independently true. If a later edit replaces the
    // "Model changed" claim with the refusal sentence, the surface stops saying
    // that results are out of date - which is still a fact the user needs.
    render(<ReanalyseBar onReanalyse={vi.fn()} canRun={false} blockedReason={HELD} />)
    expect(screen.getByText(/Model changed\. Results may be out of date\./)).toBeInTheDocument()
    expect(screen.getByTestId('reanalyse-blocked-reason')).toHaveTextContent(HELD)
  })

  it('falls back to the shared subline when the gate refuses without a sentence', () => {
    render(<ReanalyseBar onReanalyse={vi.fn()} canRun={false} />)
    const reason = screen.getByTestId('reanalyse-blocked-reason')
    expect(reason.textContent?.trim().length ?? 0).toBeGreaterThan(0)
    expect(screen.getByTestId('reanalyse-button')).toBeDisabled()
  })

  // ── A RUN IN FLIGHT IS NOT A REFUSAL ───────────────────────────────────────
  //
  // `canRunAnalysis` is FALSE while an analysis is running. Without
  // `isAnalysing` this bar would put "Analysis is currently running" through
  // `gateBlockedSubline` and print it as the reason the button is dead —
  // turning a progress state into a refusal. Every other consumer of this pair
  // excludes the running state; review found this one did not.
  it('does not call a running analysis a refusal', () => {
    render(
      <ReanalyseBar
        onReanalyse={vi.fn()}
        canRun={false}
        blockedReason="Analysis is currently running"
        isAnalysing
      />,
    )
    expect(screen.queryByTestId('reanalyse-blocked-reason')).toBeNull()
    expect(screen.getByTestId('reanalyse-button')).not.toHaveAttribute('title')
  })

  it('still prevents a second dispatch while the analysis runs', () => {
    // The sibling's exact rule: `disabled = isAnalysing || !canRun`. Not calling
    // it a refusal must not make it pressable mid-run.
    const onReanalyse = vi.fn()
    render(<ReanalyseBar onReanalyse={onReanalyse} canRun={false} isAnalysing />)
    const btn = screen.getByTestId('reanalyse-button')
    expect(btn).toBeDisabled()
    fireEvent.click(btn)
    expect(onReanalyse).not.toHaveBeenCalled()
  })

  // ── THE SECOND MOUNT BRANCH, WHICH NOTHING COVERED ─────────────────────────
  //
  // `heldUnsure` (an import hold with a cannot-confirm verdict) is the bar's
  // other reason to render. Neither this file's first cut nor the pre-existing
  // spec ever set `importPendingServerRegistration`, so every assertion landed
  // on `model-changed` and the gate was unproven on the branch review judged
  // most likely to carry the running state.
  it('gates the import-hold branch too, and says so on its own terms', () => {
    mockFreshness = { freshness: 'unknown' }
    mockImportHold = true
    render(<ReanalyseBar onReanalyse={vi.fn()} canRun={false} blockedReason={HELD} />)
    const bar = screen.getByTestId('reanalyse-bar')
    // PRECONDITION: this really is the other branch.
    expect(bar).toHaveAttribute('data-reason', 'import-unregistered')
    expect(screen.getByText(/Can't confirm this analysis matches the current model\./)).toBeInTheDocument()
    expect(screen.getByTestId('reanalyse-button')).toBeDisabled()
    expect(screen.getByTestId('reanalyse-blocked-reason')).toHaveTextContent(HELD)
  })
})

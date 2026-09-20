/**
 * A REFUSAL CARRIES ITS REMEDY, OR IT IS A DEAD END.
 *
 * ## The witnessed failure
 *
 * 2026-09-19, staging `bcc88813`, real session. A user sent a brief, CEE drafted
 * a 19-node model, and the user read a substantial coaching reply. They
 * concluded an analysis had run. **It had not** — `run_state.kind: "never_run"`
 * in their own debug bundle, and all three recorded actions were a brief and a
 * coaching chip.
 *
 * The panel was TRUTHFUL throughout: *"No analysis has run yet for this model."*
 * It simply offered no way to change that — on the FIRST SCREEN a new user
 * meets — while CEE was returning a `run_analysis` suggested action on that very
 * turn, and the panel rendered seven *"Methods you can run"* instead. The user
 * re-ran manually 13 minutes later, spending a second full compute.
 *
 * ⭐ `onReanalyse` WAS ALREADY THERE. `OutputsDock` passes `handleRunAnalysis`
 * to this body; it reached only `AtAGlance`, which ZONE: ANSWER gates off
 * pre-run. **The handler was present and unreachable in the one state that
 * needs it** — this estate's chronic failure (built, not plugged in) at the
 * grain of a single prop.
 *
 * ## The rule this pins, which is the point rather than the button
 *
 * A state that names a blocker renders the act that clears it, **or renders no
 * act at all** — never a control that refuses. Two arms, and the second is the
 * one that usually rots:
 *
 *  · the gate does NOT block → the remedy is "run it" → the act renders
 *  · the gate DOES block     → the remedy is resolving the blockers, which
 *    `WhyNoAnalysisYet` already lists WITH focus targets → no run act, because
 *    a button that would be refused is the defect one level down
 *
 * ⚠ `blockedListing == null` IS THE GATE'S OWN CONTRACT, not a re-derivation:
 * `WhyNoAnalysisYetProps` documents it as *"null when the run is not blocked"*.
 * Reading the gate's published refusal is what stops this surface minting a
 * second opinion about whether a run would succeed (trap 21).
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import { makeData } from './analysisNewFixtures'
import type { GateBlockedListing } from '../../../../canvas/utils/canRunAnalysis'

afterEach(() => cleanup())

const ACT = 'analysis-new-status-pre-run-act'
const PRE_RUN = 'analysis-new-status-pre-run'

function renderPreRun(opts: {
  onReanalyse?: () => void
  blockedListing?: GateBlockedListing | null
}) {
  return render(
    <AnalysisNewTabBody
      resultsSectionData={makeData({})}
      isPreRun
      isRunning={false}
      isStale={false}
      onReanalyse={opts.onReanalyse}
      blockedListing={opts.blockedListing ?? null}
    />,
  )
}

describe('the pre-run panel', () => {
  it('PRECONDITION: it really is in the pre-run state — otherwise every case below is vacuous', () => {
    renderPreRun({ onReanalyse: vi.fn() })
    expect(screen.getByTestId(PRE_RUN)).toBeInTheDocument()
    expect(screen.getByTestId(PRE_RUN).textContent).toContain(COPY.status.preRun)
  })

  it('⭐ offers the act that clears the blocker it names', () => {
    const onReanalyse = vi.fn()
    renderPreRun({ onReanalyse })

    const act = screen.getByTestId(ACT)
    expect(act).toHaveTextContent(COPY.status.preRunRunAction)

    fireEvent.click(act)
    expect(onReanalyse, 'the act must reach the host handler, not just render').toHaveBeenCalledTimes(1)
  })

  /**
   * ⛔ THE ARM THAT ROTS. Without this, "carries its remedy" degrades into
   * "always shows a button", which is the worse defect: a control that refuses.
   */
  it('⛔ renders NO run act when the gate would refuse the run', () => {
    renderPreRun({
      onReanalyse: vi.fn(),
      // ⚠ THE GATE'S REAL SHAPE, not a hand-waved one. `GateBlockedListing` is
      // `{ summary, sentences: GateBlockedItem[] }` and `GateBlockedItem` is
      // `{ text, scope? }` — a fixture I invented would encode my model of the
      // gate rather than the gate, and would let this case pass over a shape it
      // never publishes.
      blockedListing: {
        summary: 'A goal with no target cannot be analysed.',
        sentences: [{ text: 'A goal with no target cannot be analysed.' }],
      },
    })

    expect(screen.getByTestId(PRE_RUN), 'PRECONDITION: still pre-run').toBeInTheDocument()
    expect(
      screen.queryByTestId(ACT),
      'a button that would be refused is worse than no button — the blockers above carry the remedy',
    ).toBeNull()
  })

  it('renders no act for a host that supplies no run handler', () => {
    renderPreRun({ onReanalyse: undefined })
    expect(screen.queryByTestId(ACT), 'fail closed, never a control that does nothing').toBeNull()
  })

  /**
   * ⚠ The act is an ACTION TIER, so its touch target is the tier's and not this
   * call site's — the arrangement `everyInlineActIsReachableByTouch` exists to
   * keep, and the one a new control is most likely to break.
   */
  it('takes its geometry from the tier, not from here', () => {
    renderPreRun({ onReanalyse: vi.fn() })
    const act = screen.getByTestId(ACT)
    expect(act.classList.contains('min-h-[24px]'), '24px height from the tier').toBe(true)
    expect(act.classList.contains('min-w-[24px]'), '24px width from the tier').toBe(true)
  })
})

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
import {
  canRunAnalysis,
  getRunButtonTooltip,
  type GateBlockedListing,
} from '../../../../canvas/utils/canRunAnalysis'

afterEach(() => cleanup())

const ACT = 'analysis-new-status-pre-run-act'
const PRE_RUN = 'analysis-new-status-pre-run'

function renderPreRun(opts: {
  onReanalyse?: () => void
  blockedListing?: GateBlockedListing | null
  /**
   * ⭐ THE GATE'S VERDICT, WHICH THIS FILE USED TO OMIT — and omitting it is
   * what let every case below pass over the defect in the second describe.
   * `canRunAnalysis` defaults to `null` on the body, documented as
   * "no verdict supplied, which is treated as blocked", so a host that has
   * answered must say so here. Default `true` keeps the original cases'
   * meaning: the gate permits, therefore the remedy is "run it".
   */
  canRunAnalysis?: boolean | null
  runBlockedReason?: string | null
}) {
  return render(
    <AnalysisNewTabBody
      resultsSectionData={makeData({})}
      isPreRun
      isRunning={false}
      isStale={false}
      onReanalyse={opts.onReanalyse}
      blockedListing={opts.blockedListing ?? null}
      canRunAnalysis={'canRunAnalysis' in opts ? opts.canRunAnalysis : true}
      runBlockedReason={opts.runBlockedReason ?? null}
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
      // ⚠ THE VERDICT THAT PRODUCED THE LISTING. A gate that publishes an
      // itemised refusal has already answered `allowed: false`; a fixture with
      // a listing beside `allowed: true` is a state the gate cannot reach, and
      // leaving it unstated is what let this case pass over the defect the
      // second describe pins.
      canRunAnalysis: false,
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

/**
 * ⛔⛔ THE HOLE THE RULE ABOVE LEFT OPEN, WITNESSED ON STAGING `1f77130d`.
 *
 * Model "International Expansion Strategy", scenario `cb592d1a`. Registration
 * had been ABORTED (`POST …/graph/register` → `net::ERR_ABORTED`,
 * acknowledgements 0, `GET …/graph` → 404 "No readable graph for that
 * scenario"), so the hold was armed and CEE could not see the model at all.
 * The panel rendered `analysis-new-status-pre-run-act` **enabled, with no
 * reason shown anywhere on the tab**. Clicking it would have asked CEE to
 * analyse a graph it answers 404 for.
 *
 * ⭐ THE CAUSE IS A CONTRACT THAT OVER-CLAIMS, IN THREE PLACES AT ONCE, and
 * this file's own header is one of them: *"`blockedListing == null` IS THE
 * GATE'S OWN CONTRACT … documented as 'null when the run is not blocked'"*.
 * The gate says the opposite about itself, directly above its early returns:
 *
 *   "⚠ The early returns below do NOT publish a listing, and that is
 *    deliberate … They are all single-blocker states, which render as a
 *    sentence rather than a list anyway."
 *
 * So `blockedListing == null` means "no ITEMISED refusal", never "no refusal".
 * Four states take an early return — a held model, zero nodes, an unsettled
 * streamed draft, and a run already in flight — and in three of them this
 * panel offered the control anyway.
 *
 * ⭐ THE FIX READS THE VERDICT, NOT THE LISTING. `canRunAnalysis` (the gate's
 * `allowed`) and `runBlockedReason` (`getRunButtonTooltip`) were ALREADY passed
 * to this body by `OutputsDock` and already read by the ribbon one section
 * down — the same "present and unreachable" shape this file's header records.
 */
describe('⛔ the gate\'s single-blocker states — it refuses and publishes NO listing', () => {
  /**
   * ⭐⭐ PRECONDITION, BOUND TO THE REAL GATE. A fixture asserting
   * "refuses with no listing" would encode my model of `canRunAnalysis`
   * rather than `canRunAnalysis`. This calls it.
   */
  it('PRECONDITION: a held model really does refuse with a reason and NO listing', () => {
    const held = canRunAnalysis({
      graphHealth: null,
      readiness: null,
      hasBlockers: false,
      nodeCount: 19,
      analysisHeldOn: 'starter',
    })
    expect(held.allowed, 'the gate refuses a model the engine cannot see').toBe(false)
    expect(
      held.blockedListing,
      'AND publishes no itemised listing — this is the hole, stated by the gate itself',
    ).toBeUndefined()
    expect(getRunButtonTooltip(held), 'but it DOES state a reason').toBeTruthy()

    // The CONTRAST CONTROL in the same call: a state that reaches the itemised
    // path publishes a listing, so the assertion above is about this rung and
    // not about a probe that can never see a listing.
    const itemised = canRunAnalysis({
      graphHealth: {
        issues: [{ severity: 'error', message: 'A goal with no target cannot be analysed.' }],
      },
      readiness: null,
      hasBlockers: false,
      nodeCount: 19,
    })
    expect(itemised.allowed).toBe(false)
    expect(itemised.blockedListing?.sentences.length, 'contrast: this rung DOES itemise').toBeGreaterThan(0)
  })

  it('⛔ renders NO run act when the gate refuses, listing or no listing', () => {
    const held = canRunAnalysis({
      graphHealth: null,
      readiness: null,
      hasBlockers: false,
      nodeCount: 19,
      analysisHeldOn: 'starter',
    })
    renderPreRun({
      onReanalyse: vi.fn(),
      blockedListing: null,
      canRunAnalysis: held.allowed,
      runBlockedReason: getRunButtonTooltip(held) ?? null,
    })

    expect(screen.getByTestId(PRE_RUN), 'PRECONDITION: still pre-run').toBeInTheDocument()
    expect(
      screen.queryByTestId(ACT),
      'a control that would ask CEE to analyse a graph it answers 404 for',
    ).toBeNull()
  })

  /**
   * ⭐⭐⭐ AND THE REFUSAL IS NOT SILENT — the half that makes removing the
   * button a fix rather than a second dead end. Withdrawing the control and
   * saying nothing leaves the reader with strictly less than before.
   */
  it('⭐ says why instead, in the gate\'s own words', () => {
    const held = canRunAnalysis({
      graphHealth: null,
      readiness: null,
      hasBlockers: false,
      nodeCount: 19,
      analysisHeldOn: 'starter',
    })
    const reason = getRunButtonTooltip(held) as string
    renderPreRun({
      onReanalyse: vi.fn(),
      blockedListing: null,
      canRunAnalysis: false,
      runBlockedReason: reason,
    })

    const why = screen.getByTestId('analysis-new-why-no-analysis')
    expect(why, 'the explanation box carries the single-blocker sentence').toBeInTheDocument()
    // VERBATIM, and sourced from the gate rather than retyped here — a literal
    // would pass on a panel that composed a sentence of its own.
    expect(why).toHaveTextContent(reason)
  })

  /**
   * ⚠ AND THE ITEMISED PATH IS UNCHANGED. The fallback must never fire beside
   * a listing, or a refusal that itemises would also print its own summary.
   */
  it('a listing still wins — the summary is never printed twice', () => {
    renderPreRun({
      onReanalyse: vi.fn(),
      canRunAnalysis: false,
      runBlockedReason: 'SUMMARY-SENTINEL',
      blockedListing: {
        summary: 'SUMMARY-SENTINEL',
        sentences: [{ text: 'ITEM-SENTINEL' }],
      },
    })
    const why = screen.getByTestId('analysis-new-why-no-analysis')
    expect(why).toHaveTextContent('ITEM-SENTINEL')
    expect(
      screen.getAllByTestId('analysis-new-why-no-analysis-item'),
      'exactly the gate\'s items, with no summary row appended',
    ).toHaveLength(1)
  })

  /**
   * ⚠ A HOST THAT HAS NOT ANSWERED GETS NO CONTROL — the prop's own
   * documented behaviour ("`null` = no verdict supplied, which is treated as
   * blocked … the fail-closed render is no control at all"), which the body
   * was not honouring on this control.
   */
  it('no verdict supplied is treated as blocked', () => {
    renderPreRun({ onReanalyse: vi.fn(), canRunAnalysis: null })
    expect(screen.queryByTestId(ACT)).toBeNull()
  })
})

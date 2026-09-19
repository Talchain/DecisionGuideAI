/**
 * A RUN THE CLIENT HAS GIVEN UP ON IS NOT A RUN IN FLIGHT.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE DEFECT, WITNESSED (bundle `b3d5806d`, 19 Sep 2026, scenario `2b1a023c`)
 * ═══════════════════════════════════════════════════════════════════════════
 *   14:31:06.392  run_state = { kind: "running", started_at }
 *   14:31:48.309  auto_run_after_draft  dispatch_outcome="ok"  commit_performed=true
 *   14:32:09      bundle exported, STILL `kind: "running"`
 *
 * The result existed 42s in. The directive that delivers it was suppressed, so
 * no later turn corrected `run_state` — and `wireRunning` has no clock, so it
 * never corrects itself. The bundle also records `panel_state.results.visible:
 * false` with every `rank_source: "withheld"`, i.e. this user was in the
 * PRE-RUN state, which is the block under test.
 *
 * What the panel rendered there, forever: "Analysis is running.", with
 * `aria-busy="true"`, and with BOTH the explanation (`WhyNoAnalysisYet`) and
 * the run affordance suppressed because a run was supposedly in flight. One
 * sentence, no remedy, no exit.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT THIS FILE PINS, AND WHAT IT DELIBERATELY DOES NOT
 * ═══════════════════════════════════════════════════════════════════════════
 * ⭐ IT PINS THE BOUND AGAINST THE DELIVERY HOOK'S OWN CONSTANT, not against
 * 130_000. The number is meaningful only because it is the instant the hook
 * "stops and writes nothing"; a literal here would keep passing if the ladder
 * moved, which is the hand-maintained mirror the constant's own docblock
 * records being caught as once already (CLAUDE.md trap 12).
 *
 * ⛔ IT DOES NOT ASSERT THE RUN FAILED, FINISHED, OR IS STILL GOING. The client
 * consumes no run state and cannot know. Every assertion below is about what
 * THIS CLIENT did, which is the only thing it can observe.
 *
 * ⚠ SCOPE. This is the PANEL half. The same bound is threaded to
 * `AnalysisRunStateCover` from one derivation in `OutputsDock`, so the skeleton
 * above this block clears with it; that wiring is asserted by reading the dock,
 * not here, and is stated as wiring rather than as a witnessed pixel.
 */

import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn(() => true) }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { useCanvasStore } from '../../../../canvas/store'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import { openStrategicChallenge } from './analysisNewFixtures'
import {
  waitIsExhausted,
  PROVISIONAL_DELIVERY_DEADLINE_MS,
} from '../useAnalysisWaitExhausted'
import { PROVISIONAL_DELIVERY_DEADLINE_MS as HOOK_DEADLINE_MS } from '../../../../canvas/hooks/useProvisionalAnalysisDelivery'

const NODES = [
  { id: 'g1', type: 'goal', data: { label: 'Board wants NRR above 110%' } },
  { id: 'o1', type: 'option', data: { label: 'Raise price' } },
  { id: 'o2', type: 'option', data: { label: 'Hold current strategy' } },
]

afterEach(cleanup)
beforeEach(() => {
  useCanvasStore.setState({ nodes: NODES, goalThreshold: null } as never)
  useStrengthenStore.setState({ records: {} })
})

interface DrawOpts {
  isBusy?: boolean
  waitExhausted?: boolean
  onReanalyse?: () => void
}

const draw = ({ isBusy = true, waitExhausted, onReanalyse = vi.fn() }: DrawOpts = {}) =>
  render(
    <AnalysisNewTabBody
      resultsSectionData={openStrategicChallenge()}
      isPreRun
      isRunning={false}
      isBusy={isBusy}
      {...(waitExhausted === undefined ? {} : { waitExhausted })}
      isStale={false}
      blockedListing={null}
      onReanalyse={onReanalyse}
    />,
  )

const block = () => screen.getByTestId('analysis-new-status-pre-run')
const busyAttr = () => screen.getByTestId('analysis-new-tab-body').getAttribute('aria-busy')

describe('THE BOUND IS THE DELIVERY HOOK\'S OWN, NOT A NUMBER THIS MODULE CHOSE', () => {
  /**
   * ⭐⭐ THE PIN THAT MAKES EVERY OTHER ARM MEAN SOMETHING. If this module ever
   * grows its own constant, the panel starts giving up at a moment unrelated to
   * when the client actually stops trying, and every arm below would still pass.
   */
  it('re-exports the hook\'s deadline rather than restating it', () => {
    expect(PROVISIONAL_DELIVERY_DEADLINE_MS).toBe(HOOK_DEADLINE_MS)
    // ⚠ And it is a real duration, so a future refactor cannot satisfy the line
    // above with two matching zeroes.
    expect(PROVISIONAL_DELIVERY_DEADLINE_MS).toBeGreaterThan(60_000)
  })

  const T0 = 1_700_000_000_000

  it('is false while any attempt remains', () => {
    expect(waitIsExhausted(true, T0, T0 + PROVISIONAL_DELIVERY_DEADLINE_MS - 1)).toBe(false)
  })

  it('is false AT the bound, and true after it', () => {
    expect(waitIsExhausted(true, T0, T0 + PROVISIONAL_DELIVERY_DEADLINE_MS)).toBe(false)
    expect(waitIsExhausted(true, T0, T0 + PROVISIONAL_DELIVERY_DEADLINE_MS + 1)).toBe(true)
  })

  /**
   * ⚠ FAIL-CLOSED WITHOUT A CLOCK. Mount time measures the age of a COMPONENT,
   * not of a run — the round-2 P1 regression recorded in
   * `AnalysisRunningBanner.tsx`. A surface with no run clock keeps saying what
   * it was last honestly told.
   */
  it('no clock means never exhausted, however long the page has been open', () => {
    expect(waitIsExhausted(true, undefined, T0 + 10 * PROVISIONAL_DELIVERY_DEADLINE_MS)).toBe(false)
    expect(waitIsExhausted(true, Number.NaN, T0 + 10 * PROVISIONAL_DELIVERY_DEADLINE_MS)).toBe(false)
  })

  /** And with no run asserted there is nothing to have given up on. */
  it('no run means never exhausted', () => {
    expect(waitIsExhausted(false, T0, T0 + 10 * PROVISIONAL_DELIVERY_DEADLINE_MS)).toBe(false)
  })
})

describe('THE CONTROL — the busy state this file bounds really renders', () => {
  /**
   * ⭐⭐ Without this arm every assertion below could pass on a panel that never
   * reaches the busy branch at all (CLAUDE.md trap 13). It pins the exact
   * precondition: the fixture, the props and the store together DO produce the
   * running sentence.
   */
  it('a run in flight still says so, and is still marked busy', () => {
    draw({ isBusy: true, waitExhausted: false })
    expect(block()).toHaveTextContent(COPY.status.running)
    expect(block()).toHaveTextContent('Analysis is running.')
    expect(busyAttr()).toBe('true')
    // The remedy is correctly withheld while a run is genuinely in flight.
    expect(screen.queryByTestId('analysis-new-status-pre-run-act')).toBeNull()
  })

  /**
   * ⚠ AND THE FALLBACK IS UNCHANGED. A caller that has not been given the new
   * prop keeps today's behaviour — never a silent "given up".
   */
  it('with the prop absent entirely, nothing moves', () => {
    draw({ isBusy: true, waitExhausted: undefined })
    expect(block()).toHaveTextContent('Analysis is running.')
    expect(busyAttr()).toBe('true')
  })
})

describe('once the client has stopped waiting, the panel stops claiming a run', () => {
  it('it says the analysis has not reached this page', () => {
    draw({ isBusy: true, waitExhausted: true })
    expect(block()).toHaveTextContent(COPY.status.waitExhausted)
    // The literal twin: a constant-only pin moves with the register, so it
    // cannot observe the register itself being edited (trap 12d).
    expect(block()).toHaveTextContent('This analysis has not reached this page.')
  })

  /**
   * ⭐ AND IT STOPS SAYING THE OPPOSITE. Adding a sentence while leaving the
   * old one is this panel's signature regression — pre-run vs the intro,
   * pre-run vs staleness, and the running sentence vs pre-run before it.
   */
  it('and stops saying a run is in flight', () => {
    draw({ isBusy: true, waitExhausted: true })
    expect(block()).not.toHaveTextContent(COPY.status.running)
    expect(block()).not.toHaveTextContent('Analysis is running.')
  })

  /** Nor does it fall back to denying a run was ever asked for. */
  it('and does not claim nothing was ever run', () => {
    draw({ isBusy: true, waitExhausted: true })
    expect(block()).not.toHaveTextContent(COPY.status.preRun)
  })

  /**
   * ⭐⭐⭐ THE HALF THAT MAKES IT A FIX RATHER THAN A BETTER-WORDED DEAD END.
   * The witnessed state had no route out: the run affordance was suppressed
   * because a run was supposedly in flight.
   */
  it('the way out is restored', () => {
    draw({ isBusy: true, waitExhausted: true })
    const act = screen.getByTestId('analysis-new-status-pre-run-act')
    expect(act).toBeInTheDocument()
    expect(act).toHaveTextContent(COPY.status.preRunRunAction)
  })

  it('and says why running again is worth doing', () => {
    draw({ isBusy: true, waitExhausted: true })
    expect(block()).toHaveTextContent(COPY.status.waitExhaustedWhy)
    expect(block()).toHaveTextContent('It may have finished without being sent back.')
  })

  /**
   * ⭐⭐ ONE EXPRESSION, EVERY READER. The marker and the sentence move together
   * or the panel ends up marked busy while saying nothing arrived — which is
   * the contradiction being closed, relocated rather than fixed (trap 21).
   */
  it('the busy marker clears with the sentence', () => {
    draw({ isBusy: true, waitExhausted: true })
    expect(busyAttr()).toBeNull()
  })
})

describe('the flag cannot leak into a panel that was never waiting', () => {
  /**
   * ⚠ THE OPPOSITE-DIRECTION TWIN (trap 22b). `waitExhausted` is computed from
   * a run the host asserted; a cold panel that somehow receives it must read as
   * an ordinary pre-run panel, not as an abandoned run.
   */
  it('exhausted but never busy reads as an ordinary pre-run panel', () => {
    draw({ isBusy: false, waitExhausted: true })
    expect(block()).toHaveTextContent(COPY.status.preRun)
    expect(block()).not.toHaveTextContent(COPY.status.waitExhausted)
    expect(block()).not.toHaveTextContent('This analysis has not reached this page.')
    expect(busyAttr()).toBeNull()
  })
})

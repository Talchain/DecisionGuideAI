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
import type { ProvisionalDeliveryRecord } from '../../../../canvas/hooks/provisionalDeliveryRecord'

const KEY = 'scenario-1:2026-09-19T14:31:06.392Z'
const T0 = 1_700_000_000_000

/**
 * ⚠ FIELD BY FIELD, NOT A SPREAD. `Partial<T>` admits `undefined` for every
 * key, so `{ ...base, ...over }` widens the REQUIRED `attempt` to
 * `number | undefined` and the gate rejects it. Naming each field keeps the
 * fixture honest about the record's real shape — which is the thing the
 * privacy guard in `deliveryIsObservable.spec.ts` pins.
 */
const rec = (over: Partial<ProvisionalDeliveryRecord> = {}): ProvisionalDeliveryRecord => ({
  run_key: over.run_key ?? KEY,
  attempt: over.attempt ?? 1,
  armed_at: over.armed_at ?? new Date(T0).toISOString(),
  outcome: over.outcome ?? null,
  settled_at: over.settled_at ?? null,
})

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
  /**
   * ⭐ THE HOST'S RUN VERDICT, WHICH THIS FIXTURE USED TO OMIT. The body
   * documents `canRunAnalysis` as *"`null` = no verdict supplied, which is
   * treated as blocked … the fail-closed render is no control at all"*, so a
   * fixture that omits it is asking for the refused state while asserting the
   * permitted one. Default `true` is the host ANSWERING "a run may start",
   * which is the state "the way out is restored" is about.
   */
  canRunAnalysis?: boolean | null
  runBlockedReason?: string | null
}

const draw = ({
  isBusy = true,
  waitExhausted,
  onReanalyse = vi.fn(),
  canRunAnalysis = true,
  runBlockedReason = null,
}: DrawOpts = {}) =>
  render(
    <AnalysisNewTabBody
      resultsSectionData={openStrategicChallenge()}
      isPreRun
      isRunning={false}
      isBusy={isBusy}
      {...(waitExhausted === undefined ? {} : { waitExhausted })}
      isStale={false}
      blockedListing={null}
      canRunAnalysis={canRunAnalysis}
      runBlockedReason={runBlockedReason}
      onReanalyse={onReanalyse}
    />,
  )

/**
 * ⭐ THE EXHAUSTED STATE AS THE HOST PRODUCES IT. `OutputsDock` computes
 * `analysisStillAwaited = isRunning && !exhausted` and passes it as `isBusy`,
 * so by the time this body sees an abandoned run, `isBusy` is ALREADY false.
 * A fixture that sent `isBusy: true` here would be testing a state the product
 * cannot reach (CLAUDE.md trap 16-inverse: a self-authored input encodes the
 * author's model of the producer rather than the producer).
 */
const EXHAUSTED = { isBusy: false, waitExhausted: true } as const

const block = () => screen.getByTestId('analysis-new-status-pre-run')
const busyAttr = () => screen.getByTestId('analysis-new-tab-body').getAttribute('aria-busy')

describe('THE ANSWER IS OBSERVED, NOT INFERRED FROM THE PRODUCER\'S CLOCK', () => {
  /**
   * ⭐⭐ THE PIN THAT MAKES THE FLOOR MEAN SOMETHING. If this module grows its
   * own constant, the floor stops matching the moment the hook actually stops.
   */
  it('re-exports the hook\'s deadline rather than restating it', () => {
    expect(PROVISIONAL_DELIVERY_DEADLINE_MS).toBe(HOOK_DEADLINE_MS)
    expect(PROVISIONAL_DELIVERY_DEADLINE_MS).toBeGreaterThan(60_000)
  })

  /**
   * ⭐⭐⭐ THE ARM THE FIRST CUT FAILED, AND THE REASON THIS FILE EXISTS.
   * The first predicate measured `now - run_state.started_at`. That is the
   * PRODUCER's clock; the schedule arms when the client mounts. A page opened
   * long after a run was asserted must NOT report that it has stopped waiting,
   * because it has just started. CI caught this as a missing run banner.
   */
  it('a run asserted long ago, with a schedule that has only just armed, is NOT exhausted', () => {
    const justArmed = rec({ armed_at: new Date(T0).toISOString() })
    expect(waitIsExhausted(true, justArmed, KEY, T0 + 1_000)).toBe(false)
    // Even if the RUN itself was asserted hours earlier — which is the exact
    // shape of the fixture that RED'd.
    expect(waitIsExhausted(true, justArmed, KEY, T0 + 5_000)).toBe(false)
  })

  /**
   * ⭐⭐ THE OUTCOME A CLOCK CANNOT SEE. `withheld` settles the schedule EARLY
   * — "divergence is a property of the canvas, not of the answer's timing" — so
   * a clock-only predicate would keep claiming a run was in flight for the
   * whole remaining ladder on the one outcome that is already final.
   */
  it('a schedule that settled WITHHELD is exhausted immediately, long before any deadline', () => {
    const settled = rec({ outcome: 'withheld', settled_at: new Date(T0 + 9_000).toISOString() })
    expect(waitIsExhausted(true, settled, KEY, T0 + 10_000)).toBe(true)
  })

  it('a schedule that settled at the DEADLINE is exhausted', () => {
    const settled = rec({ outcome: 'deadline' })
    expect(waitIsExhausted(true, settled, KEY, T0 + 1_000)).toBe(true)
  })

  /**
   * ⭐ THE DISCRIMINATING TWIN. Without this, "settled means exhausted" would
   * also fire on the one ending that PUT SOMETHING ON SCREEN, and the panel
   * would announce an abandoned run over a delivered result.
   */
  it('a schedule that DELIVERED is never exhausted', () => {
    const delivered = rec({ outcome: 'delivered', settled_at: new Date(T0 + 9_000).toISOString() })
    expect(waitIsExhausted(true, delivered, KEY, T0 + 10_000)).toBe(false)
  })

  /**
   * ⚠ THE FLOOR, on THIS CLIENT's clock. Armed and never settled, which is
   * possible if the effect was torn down mid-schedule.
   */
  it('armed and never settled is exhausted only past the deadline, measured from arming', () => {
    const armed = rec()
    expect(waitIsExhausted(true, armed, KEY, T0 + PROVISIONAL_DELIVERY_DEADLINE_MS)).toBe(false)
    expect(waitIsExhausted(true, armed, KEY, T0 + PROVISIONAL_DELIVERY_DEADLINE_MS + 1)).toBe(true)
  })

  /**
   * ⭐⭐ THE KEY MATCH, AND IT IS LOAD-BEARING. A settled record from a PREVIOUS
   * run must not mark the current one abandoned — otherwise every re-run opens
   * already claiming it was given up on.
   */
  it('a settled record for a DIFFERENT run says nothing about this one', () => {
    const other = rec({ run_key: 'scenario-1:2026-09-19T99:99:99.999Z', outcome: 'deadline' })
    expect(waitIsExhausted(true, other, KEY, T0 + 10 * PROVISIONAL_DELIVERY_DEADLINE_MS)).toBe(false)
  })

  /** ⚠ FAIL-CLOSED AT EVERY ABSENCE. */
  it('no record, no key, no run, or an unparseable stamp: never exhausted', () => {
    const far = T0 + 10 * PROVISIONAL_DELIVERY_DEADLINE_MS
    expect(waitIsExhausted(true, null, KEY, far)).toBe(false)
    expect(waitIsExhausted(true, rec({ outcome: 'deadline' }), null, far)).toBe(false)
    expect(waitIsExhausted(false, rec({ outcome: 'deadline' }), KEY, far)).toBe(false)
    expect(waitIsExhausted(true, rec({ armed_at: 'not-a-date' }), KEY, far)).toBe(false)
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
    draw(EXHAUSTED)
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
    draw(EXHAUSTED)
    expect(block()).not.toHaveTextContent(COPY.status.running)
    expect(block()).not.toHaveTextContent('Analysis is running.')
  })

  /** Nor does it fall back to denying a run was ever asked for. */
  it('and does not claim nothing was ever run', () => {
    draw(EXHAUSTED)
    expect(block()).not.toHaveTextContent(COPY.status.preRun)
  })

  /**
   * ⭐⭐⭐ THE HALF THAT MAKES IT A FIX RATHER THAN A BETTER-WORDED DEAD END.
   * The witnessed state had no route out: the run affordance was suppressed
   * because a run was supposedly in flight.
   */
  it('the way out is restored', () => {
    draw(EXHAUSTED)
    const act = screen.getByTestId('analysis-new-status-pre-run-act')
    expect(act).toBeInTheDocument()
    expect(act).toHaveTextContent(COPY.status.preRunRunAction)
  })

  /**
   * ⛔⛔ AND IT IS NOT RESTORED WHEN THE GATE REFUSES — the twin, added
   * 22 Sep 2026 with the staging `1f77130d` witness. Exhaustion says the CLIENT
   * stopped waiting; it says nothing about whether a run may start. On a model
   * whose registration CEE aborted, both were true at once and this panel
   * offered the control anyway.
   */
  it('but not when the gate refuses a run — then it says why instead', () => {
    draw({
      ...EXHAUSTED,
      canRunAnalysis: false,
      runBlockedReason: 'Olumi cannot see this model yet.',
    })
    expect(
      screen.queryByTestId('analysis-new-status-pre-run-act'),
      'a control that would ask for a run the gate has already refused',
    ).toBeNull()
    expect(block()).toHaveTextContent('Olumi cannot see this model yet.')
    // ⭐ AND THE EXHAUSTION SENTENCE STAYS. The two facts are independent, and
    // suppressing one because the other is true is this panel's signature
    // regression.
    expect(block()).toHaveTextContent(COPY.status.waitExhausted)
  })

  it('and says why running again is worth doing', () => {
    draw(EXHAUSTED)
    expect(block()).toHaveTextContent(COPY.status.waitExhaustedWhy)
    expect(block()).toHaveTextContent('Olumi has stopped waiting for it.')
  })

  /**
   * ⭐⭐⭐ THE BREADTH ARM — and it exists because the first draft of this copy
   * FAILED it, caught in self-review before merge.
   *
   * The flag is reached by at least two opposite outcomes of
   * `runProvisionalDeliverySchedule`:
   *   `deadline`  nothing usable arrived inside the budget.
   *   `withheld`  a terminal verdict DID arrive and was declined as divergent.
   *               `applyScenarioAnalysisRead`: "A divergent read writes
   *               NOTHING: no verdict, no results" — so `run_state` stays
   *               `running` and the panel lands in the same state.
   *
   * The draft said "It may have finished without being sent back", which is
   * true of the first and false of the second. This pins that the shipped line
   * makes no claim about WHAT HAPPENED TO THE RUN — only about what this client
   * did and what the reader can do — so it cannot go stale against an outcome
   * it does not enumerate (CLAUDE.md trap 13d: write the invariant against the
   * spec, never against the failure mode in hand).
   *
   * ⚠ Asserted as an ABSENCE OF CAUSAL CLAIMS, which is the property, rather
   * than as "does not contain the old sentence" — that would pass the moment
   * someone wrote a DIFFERENT false cause.
   */
  it('makes no claim about what happened to the run itself', () => {
    draw(EXHAUSTED)
    const said = block().textContent ?? ''
    expect(said).not.toMatch(/\bfailed\b|\bcrashed\b|\berror\b/i)
    expect(said).not.toMatch(/\bstill (?:running|going|analysing)\b/i)
    expect(said).not.toMatch(/without being sent back|never sent|was not sent/i)
    expect(said).not.toMatch(/\bfinished\b|\bcompleted\b/i)
    // ⭐ The precondition twin: the block must actually be the exhausted one,
    // or every absence above is satisfied by an empty string.
    expect(said).toContain('This analysis has not reached this page.')
  })

  /**
   * ⭐⭐ ONE EXPRESSION, EVERY READER. The marker and the sentence move together
   * or the panel ends up marked busy while saying nothing arrived — which is
   * the contradiction being closed, relocated rather than fixed (trap 21).
   */
  it('the busy marker clears with the sentence', () => {
    draw(EXHAUSTED)
    expect(busyAttr()).toBeNull()
  })
})

describe('A LIVE LOCAL RUN OUTRANKS ANY RECORD ABOUT AN EARLIER ONE', () => {
  /**
   * ⛔⛔ THE REGRESSION AN INDEPENDENT SEAT FOUND BEFORE MERGE, and it is the
   * sharpest kind: the recovery affordance breaking the recovery.
   *
   * `trust.isRunning` is `localRunning || wireRunning`. An earlier cut
   * subtracted the exhaustion from the COMBINED value, so:
   *
   *   old record settles `deadline` -> user presses the restored "Run the
   *   analysis" -> `resultsAnalysing` sets `preparing` -> BUT the wire still
   *   carries the old `started_at`, so the old record still matches and
   *   exhaustion is still true -> the panel hides the cover for the run
   *   dispatched one second ago and says it stopped waiting.
   *
   * The host now subtracts only the wire half (`provisionalWaitExhausted &&
   * !isRunning`). This arm pins the BODY's half of that contract: given the
   * props the host produces mid-retry, it must speak as a live run.
   */
  it('mid-retry, the panel reports the run and not the abandonment', () => {
    // What the host passes once a local run is in flight: `analysisStillAwaited`
    // is true because `isRunning` is, and `analysisWaitExhausted` is subtracted
    // to false by the same local flag.
    draw({ isBusy: true, waitExhausted: false })
    expect(block()).toHaveTextContent(COPY.status.running)
    expect(block()).not.toHaveTextContent(COPY.status.waitExhausted)
    expect(busyAttr()).toBe('true')
  })

  /**
   * ⭐ THE DEFENCE-IN-DEPTH TWIN. Even if a future host regressed and sent both,
   * the body must not announce an abandoned run over a live one. Being wrong
   * toward "still running" is recoverable; the inverse is what was witnessed.
   */
  it('and even a host that wrongly sends both still reports the run', () => {
    draw({ isBusy: true, waitExhausted: true })
    expect(block()).toHaveTextContent(COPY.status.running)
    expect(block()).not.toHaveTextContent('This analysis has not reached this page.')
  })
})

describe('a cold panel is not an abandoned run', () => {
  /**
   * ⚠ THE OPPOSITE-DIRECTION TWIN (trap 22b). Both a cold panel and an
   * abandoned run are "not busy"; only one of them has a run to report on, and
   * conflating them would greet every first-time reader with a sentence about
   * a run that never existed.
   *
   * ⭐ The guarantee behind it is the PREDICATE's, not this component's:
   * `waitIsExhausted` returns false whenever no run is asserted, pinned above
   * in "no record, no key, no run". This arm pins the component's half — that
   * it renders the ordinary sentence when the host says there is nothing to
   * report.
   */
  it('nothing running and nothing abandoned reads as an ordinary pre-run panel', () => {
    draw({ isBusy: false, waitExhausted: false })
    expect(block()).toHaveTextContent(COPY.status.preRun)
    expect(block()).not.toHaveTextContent(COPY.status.waitExhausted)
    expect(block()).not.toHaveTextContent('This analysis has not reached this page.')
    expect(busyAttr()).toBeNull()
  })

  /**
   * ⭐⭐ AND THE STATE THE HOST CANNOT PRODUCE IS STILL SAFE. `analysisStillAwaited`
   * is `isRunning && !exhausted`, so `isBusy` and `waitExhausted` are never both
   * true. If a future caller sends both anyway, the run claim wins — being wrong
   * toward "still running" is recoverable, announcing an abandoned run over a
   * live one is not.
   */
  it('if a caller sends both, the live run wins', () => {
    draw({ isBusy: true, waitExhausted: true })
    expect(block()).toHaveTextContent(COPY.status.running)
    expect(block()).not.toHaveTextContent(COPY.status.waitExhausted)
  })
})

/**
 * Analysis (New) — WHILE A FIRST RUN IS IN FLIGHT, THE PANEL SAYS SO.
 *
 * ⚠⚠ THE DEFECT, MEASURED AT THIS RENDER PATH ON `staging` (`3b2df4ce`).
 * `isPreRun` means "no COMPLETED analysis is being displayed", so on a model's
 * FIRST run both `isPreRun` and the run flags are true at once. In that state
 * the panel rendered, on an element it had itself marked `aria-busy="true"`:
 *
 *     "No analysis has run yet for this model."
 *
 * And the shell's in-flight treatment directly above it is `AnalysisRunSkeleton`
 * — mounted because `OutputsDock` passes `contentRetained={!isPreRun}`, which is
 * FALSE here. A skeleton carries no words. So on a first run the only sentence
 * on screen said nothing was happening, while everything on the surface that
 * could not speak said it was.
 *
 * ⭐ AND THE SENTENCE FOR IT WAS ALREADY WRITTEN AND HAD NO READER.
 * `ANALYSIS_NEW_COPY.status.running` ('Analysis is running.') is declared,
 * documented, and had ZERO production references repo-wide — while
 * `vm.status.isRunning` was computed and read by nothing on this surface. The
 * estate's first chronic failure ("we build more than we plug in"), in one
 * constant.
 *
 * ── WHAT IS UNDER TEST, AND THE AUTHORITY IT MUST READ ─────────────────────
 * ⭐⭐ THE FLAG IS THE COMPOSED ONE, AND THAT IS THE LOAD-BEARING CHOICE.
 * This component takes TWO run flags and its own header explains why: `isRunning`
 * is the dock's LOCAL flag; `isBusy` is `composedAnalysisState.trust.isRunning`
 * — `localRunning || wireRunning` — which is what `AnalysisRunStateCover` and
 * `AnalysisRunAnnouncer` read. The header records the exact divergence that
 * cost this surface once already: on a WIRE-asserted run the user was told an
 * analysis was running and this content was not marked (`cover=present`,
 * `isRunning_prop=false`, `aria-busy=null`).
 *
 * A new sentence keyed on the LOCAL flag would reproduce that defect in copy
 * rather than in an attribute — so the wire-asserted case is tested explicitly,
 * and it is the row that would RED if someone reached for `isRunning` here.
 *
 * ⚠ ONE EXPRESSION, TWO READERS — never two predicates that happen to agree
 * (CLAUDE.md trap 21). The sentence and `aria-busy` are asserted to move
 * TOGETHER, so they cannot drift into a panel that is marked busy and says
 * nothing has run, which is the state this file exists to close.
 *
 * ⚠ SCOPE, STATED HONESTLY. The refusal box is ALSO suppressed while busy, and
 * that half is NOT a witnessed user-visible fix: `canRunAnalysis` returns EARLY
 * when `isRunning`, and that early return publishes NO `blockedListing`
 * (`canRunAnalysis.ts:782-787`, and the comment above it says the early returns
 * deliberately publish none). So in production the box is already absent during
 * a run. The suppression makes that a property of THIS code rather than of the
 * gate's current behaviour — the same move `buildAnalysisNewViewModel`'s header
 * argues for its own pre-run gates ("Gating here makes it a property of the
 * code"). A fixture can put a listing there; the wire cannot today.
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
import { genuineDecision, openStrategicChallenge } from './analysisNewFixtures'
import type { GateBlockedListing } from '../../../../canvas/utils/canRunAnalysis'

const NODES = [
  { id: 'g1', type: 'goal', data: { label: 'Board wants NRR above 110%' } },
  { id: 'o1', type: 'option', data: { label: 'Raise price' } },
  { id: 'o2', type: 'option', data: { label: 'Hold current strategy' } },
]

/** A refusal the gate CAN publish — but only while no run is in flight. */
const LISTING: GateBlockedListing = {
  summary: 'Hold current strategy has no effect values yet.',
  sentences: [
    { text: 'Hold current strategy has no effect values yet.', scope: { id: 'o2', label: 'Hold current strategy' } },
  ],
}

afterEach(cleanup)

beforeEach(() => {
  useCanvasStore.setState({ nodes: NODES, goalThreshold: null } as never)
  useStrengthenStore.setState({ records: {} })
})

interface DrawOpts {
  isPreRun?: boolean
  isRunning?: boolean
  isBusy?: boolean
  listing?: GateBlockedListing | null
}

const draw = ({ isPreRun = true, isRunning = false, isBusy, listing = null }: DrawOpts = {}) =>
  render(
    <AnalysisNewTabBody
      resultsSectionData={isPreRun ? openStrategicChallenge() : genuineDecision()}
      isPreRun={isPreRun}
      isRunning={isRunning}
      {...(isBusy === undefined ? {} : { isBusy })}
      isStale={false}
      blockedListing={listing}
      responseHash={isPreRun ? undefined : 'run_abc123'}
    />,
  )

const block = () => screen.getByTestId('analysis-new-status-pre-run')
const busyAttr = () => screen.getByTestId('analysis-new-tab-body').getAttribute('aria-busy')

describe('THE INSTRUMENT — the idle pre-run sentence is unchanged', () => {
  /**
   * ⭐⭐ THE POSITIVE CONTROL. Every "it now says running" assertion below is
   * vacuous unless the ORIGINAL sentence is provably still there when no run is
   * in flight (CLAUDE.md trap 13).
   */
  it('with nothing running, it still says no analysis has run', () => {
    draw()
    expect(block()).toHaveTextContent(COPY.status.preRun)
    expect(block()).not.toHaveTextContent(COPY.status.running)
    expect(busyAttr()).toBeNull()
  })

  /** And the orientation line survives in BOTH states — it asserts no run. */
  it('the orientation line is stated whether or not a run is in flight', () => {
    draw()
    expect(block()).toHaveTextContent('this panel reads it back around the reasoning')
    cleanup()
    draw({ isRunning: true })
    expect(block()).toHaveTextContent('this panel reads it back around the reasoning')
  })
})

describe('a first run in flight is stated, not denied', () => {
  it('the panel says the analysis is running', () => {
    draw({ isRunning: true })
    expect(block()).toHaveTextContent(COPY.status.running)
  })

  /**
   * ⚠ THE OTHER HALF, AND IT IS THE DEFECT ITSELF. Adding a sentence while
   * LEAVING the denial would put both claims in one block — the shape this
   * panel has already had to fix twice (pre-run vs the intro, pre-run vs
   * staleness).
   */
  it('and stops saying that none has run', () => {
    draw({ isRunning: true })
    expect(block()).not.toHaveTextContent(COPY.status.preRun)
  })
})

describe('it reads the COMPOSED run authority, not the local flag', () => {
  /**
   * ⭐⭐ THE ROW THAT WOULD RED IF SOMEONE REACHED FOR `isRunning`.
   * A wire-asserted run: the dock's local flag is false, the composed one true.
   * This is the exact state the component header records as having shipped once
   * — cover present, content unmarked — and a sentence keyed on the local flag
   * would reproduce it in copy.
   */
  it('a WIRE-asserted run is stated too', () => {
    draw({ isRunning: false, isBusy: true })
    expect(block()).toHaveTextContent(COPY.status.running)
    expect(block()).not.toHaveTextContent(COPY.status.preRun)
  })

  /**
   * ⚠ AND THE DOCUMENTED FALLBACK IS KEPT. `isBusy` is optional; absent, the
   * prop's own note says the component falls back to `isRunning` — "today's
   * behaviour for any caller that has not been given the composed value, never
   * a silent 'not running'".
   */
  it('with no composed value supplied, the local flag still speaks', () => {
    draw({ isRunning: true, isBusy: undefined })
    expect(block()).toHaveTextContent(COPY.status.running)
  })

  /**
   * ⚠ AND AN EXPLICIT `isBusy: false` MUST NOT BE SWALLOWED BY THE FALLBACK.
   * `??` and `||` differ exactly here, and a host that has answered "not
   * running" has answered it.
   */
  it('a composed FALSE outranks a stale local true', () => {
    draw({ isRunning: true, isBusy: false })
    expect(block()).toHaveTextContent(COPY.status.preRun)
    expect(block()).not.toHaveTextContent(COPY.status.running)
  })

  /**
   * ⭐⭐ ONE EXPRESSION, TWO READERS — pinned by moving them together rather
   * than by trusting a comment. If the sentence ever grows a predicate of its
   * own, the panel can be marked busy while denying the run, which is the
   * defect this file closes (CLAUDE.md trap 21).
   */
  it('the sentence and the busy marker never disagree', () => {
    draw({ isRunning: false, isBusy: true })
    expect(busyAttr()).toBe('true')
    expect(block()).toHaveTextContent(COPY.status.running)
    cleanup()
    draw({ isRunning: true, isBusy: false })
    expect(busyAttr()).toBeNull()
    expect(block()).toHaveTextContent(COPY.status.preRun)
  })
})

describe('the refusal has no subject while the run is happening', () => {
  /**
   * ⭐ THE PRECONDITION TWIN FIRST — without it the suppression below could
   * pass on a panel that never renders the box at all.
   */
  it('idle, the gate\'s refusal still reaches the panel', () => {
    draw({ listing: LISTING })
    expect(screen.getByTestId('analysis-new-why-no-analysis')).toBeInTheDocument()
  })

  it('running, it does not', () => {
    draw({ isRunning: true, listing: LISTING })
    expect(screen.queryByTestId('analysis-new-why-no-analysis')).toBeNull()
  })
})

describe('nothing else moves', () => {
  /** A displayed run has no pre-run block at all, running or not. */
  it('a completed run is unchanged while a re-run is in flight', () => {
    draw({ isPreRun: false, isRunning: true })
    expect(screen.queryByTestId('analysis-new-status-pre-run')).toBeNull()
    expect(screen.getByTestId('analysis-new-tab-body')).toHaveAttribute('aria-busy', 'true')
  })
})

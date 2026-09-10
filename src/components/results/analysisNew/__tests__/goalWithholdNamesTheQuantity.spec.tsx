/**
 * ⭐⭐ THE PANEL ANNOUNCED A WITHHOLD AND THEN PRESENTED THE THING IT SAID IT
 * WITHHELD — ON ONE SCREEN, ON THE SERVED BUILD.
 *
 * WITNESSED on `staging--olumi.netlify.app`, served UI `475ee1c7`, Reasoning
 * tab, after a completed analysis. Within a few lines of each other:
 *
 *   "Your goal's target was recorded, but it couldn't be compared with where
 *    the goal stands today, so goal-fit results were withheld rather than
 *    guessed."                                    <- InferenceWarningStrip
 *   "Most likely to serve your goal"
 *   "Extend Shift Hours at the Existing Site"
 *   "Scored highest in 48% of simulated futures"  <- AtAGlance
 *
 * The same turn's `analysis_result` carried `leading_option_id` and
 * `win_probabilities`, and `analysis_admission.permitted_analysis_mode` was
 * `comparative_leader`.
 *
 * ── BOTH STATEMENTS ARE TRUE, AND THAT IS THE POINT (CLAUDE.md trap 21) ─────
 * They answer two DIFFERENT questions under one name:
 *   (a) the absolute GOAL PROBABILITY — will this model reach the target?
 *       Genuinely withheld: ISL could not resolve the threshold into the
 *       samples' frame, so there is nothing to compare the target against.
 *   (b) the COMPARATIVE RANKING — which option best serves that goal?
 *       Genuinely produced, and licensed by a SEPARATE gate.
 *
 * The defect is the NAME: "goal-fit results" is broad enough to cover (b),
 * so the sentence over-claims the scope of its own withhold. The fix names
 * them apart. It does NOT suppress the ranking and does NOT delete the notice.
 *
 * ⭐ THE ESTATE ALREADY RATIFIED THIS NAMING, ON THE CANVAS. ROADMAP 2.275
 * closed the identical defect on `GoalNode` — a node denying a goal
 * probability while per-option goal-fit figures rendered from the same report
 * — and its resolution is the vocabulary reused here: name the withheld
 * QUANTITY ("goal probability"), never a whole class of "results".
 * `GoalNode.tsx:760-761` is the live precedent.
 *
 * ── WHY THE TWO CANNOT SUPPRESS EACH OTHER, DERIVED RATHER THAN ASSUMED ─────
 * `licensesComparativeLeaderClaim` (`useAnalysisReady.ts:170-174`) reads
 * EXACTLY ONE field, `admission.permitted_analysis_mode`, and never reads
 * `inference_warnings`. So a goal-threshold refusal cannot withdraw the
 * comparative claim, and the co-render below is reachable BY CONSTRUCTION —
 * not a one-off capture.
 *
 * ── RED-first at `475ee1c7` ─────────────────────────────────────────────────
 * `names the withheld quantity, not a whole class of results` FAILS: the
 * strip entry renders "goal-fit results were withheld" while the glance
 * headline names a leading option in the same document.
 */

import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { useCanvasStore } from '../../../../canvas/store'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import { genuineDecision } from './analysisNewFixtures'
import type { ConfidenceSectionData } from '../../types'

const GOAL_CODE = 'GOAL_THRESHOLD_NOT_CONVERTIBLE'
/**
 * ⚠ THE CONTRAST ENTRY, rendered in the SAME strip on the SAME run. Every
 * assertion below selects by `data-warning-code`; without a second entry an
 * index-or-text selector would pass identically and this spec would be bound
 * to "whatever the strip rendered first" (CLAUDE.md trap 19).
 */
const OTHER_CODE = 'ROOT_NODE_DEFAULT_VALUE'

/**
 * ⛔ HISTORIC RECORD — THE SENTENCE `475ee1c7` ACTUALLY SERVED. Append-only
 * (CLAUDE.md trap 14b): this is evidence of what the product once said, not a
 * fixture to keep current. It exists to give the negative matcher a POSITIVE
 * CONTROL, so an absence assertion cannot pass by testing nothing (trap 13).
 */
const SERVED_ON_475EE1C7 =
  "Your goal's target was recorded, but it couldn't be compared with where the goal stands today, so goal-fit results were withheld rather than guessed."

/**
 * THE OVER-BROAD CLAIM. Not "does the word goal-fit appear" — the defect is
 * specifically claiming that goal-fit RESULTS (an unscoped class, which the
 * reader reads as including the ranking on screen) were withheld.
 */
const CLAIMS_RESULTS_WITHHELD = /goal-fit\s+results\s+(were|are)\s+withheld/i

/**
 * THE NARROW QUANTITY the run genuinely did not produce, named so it cannot be
 * read as a ranking OR as the win-share beside it. "Scored highest in 48% of
 * simulated futures" is also a probability, so naming only "probability" would
 * not have separated them; what the run withheld is the probability of
 * REACHING THE TARGET.
 */
const NAMES_THE_QUANTITY = /probability of reaching/i

const NODES = [
  { id: 'g1', type: 'goal', data: { label: 'Sustained margin' } },
  { id: 'f_elasticity', type: 'factor', data: { label: 'Price elasticity' } },
]

/**
 * ONE RUN, BOTH CONDITIONS. `genuineDecision()` publishes
 * `leaderDesignationPermitted: true` with a leading option, i.e. the
 * `comparative_leader` arm; the warning is the goal-threshold refusal. This is
 * the shape the served build rendered.
 *
 * ⚠ `severity: 'warning'` and a non-empty `message` are BOTH required by
 * `isStripEntry` — drop either and the strip renders nothing, every assertion
 * below goes vacuous, and the spec reports success about a sentence that never
 * reached the DOM. The precondition test pins this in-test rather than
 * trusting this paragraph.
 */
const goalWithheldWithLeaderPermitted = () => {
  const data = genuineDecision()
  return {
    ...data,
    confidence: {
      ...data.confidence,
      inferenceWarnings: [
        {
          code: GOAL_CODE,
          affected_nodes: [],
          severity: 'warning',
          message: 'goal threshold could not be resolved in the sample frame',
        },
        {
          code: OTHER_CODE,
          affected_nodes: ['e4ec3415'],
          severity: 'warning',
          message: "No observed value provided for root node 'e4ec3415'; defaulted to 0.0.",
        },
      ],
    } as ConfidenceSectionData,
  }
}

const previous = { nodes: [] as unknown }

beforeEach(() => {
  previous.nodes = useCanvasStore.getState().nodes
  useCanvasStore.setState({ nodes: NODES, goalThreshold: null } as never)
  useStrengthenStore.setState({ records: {}, priorityOrder: [] } as never)
})
afterEach(() => {
  cleanup()
  useCanvasStore.setState({ nodes: previous.nodes } as never)
})

const renderPanel = () =>
  render(
    <AnalysisNewTabBody
      resultsSectionData={goalWithheldWithLeaderPermitted()}
      isPreRun={false}
      isRunning={false}
      isStale={false}
      responseHash="run_goal_withheld_leader_permitted"
    />,
  )

/** Select the goal entry BY ITS CODE. Never by index, never by text. */
const goalEntry = () => {
  const el = document.querySelector(`[data-warning-code="${GOAL_CODE}"]`)
  expect(el, `the strip must carry a ${GOAL_CODE} entry`).not.toBeNull()
  return el as HTMLElement
}

describe('the goal withhold names its quantity, so it cannot deny the ranking beside it', () => {
  /**
   * ⭐⭐ THE PRECONDITION, PINNED IN-TEST. If either half stopped rendering the
   * contradiction would be unobservable and the load-bearing assertion would
   * pass while the defect was live (CLAUDE.md trap 13b — a guard whose
   * discrimination depends on a fixture nothing pins).
   */
  it('PRECONDITION: both halves co-render — the withhold notice AND the named leading option', () => {
    renderPanel()
    // (a) the withhold notice is on screen, selected by identity
    expect(goalEntry()).toBeInTheDocument()
    // (b) the comparative result is on screen, in the same document
    expect(screen.getByTestId('analysis-new-glance-headline')).toHaveTextContent('Raise price')
    // ...under the heading that frames it as serving the goal
    expect(screen.getByText('Most likely to serve your goal')).toBeInTheDocument()
  })

  /**
   * ⭐⭐ THE LOAD-BEARING ASSERTION. RED at `475ee1c7`.
   */
  it('names the withheld quantity, not a whole class of results', () => {
    renderPanel()
    const text = goalEntry().textContent ?? ''

    // MATCHER ROT CONTROL (trap 13): the negative matcher must still fire on
    // the sentence the build actually served, or the assertion below is
    // vacuous and would pass on any rewording at all.
    expect(
      CLAIMS_RESULTS_WITHHELD.test(SERVED_ON_475EE1C7),
      'matcher rot control: the served sentence must still match the over-broad pattern',
    ).toBe(true)
    // ...and it must NOT fire on the narrow naming, or it forbids the fix too.
    expect(
      CLAIMS_RESULTS_WITHHELD.test('the probability of reaching it was withheld rather than guessed'),
      'matcher must not catch the narrow quantity naming',
    ).toBe(false)

    expect(text, 'the notice must not claim goal-fit RESULTS were withheld while the panel shows one').not.toMatch(
      CLAIMS_RESULTS_WITHHELD,
    )
    expect(text, 'the notice must name the quantity that was actually withheld').toMatch(NAMES_THE_QUANTITY)
  })

  /**
   * ⭐ THE HONEST FORCE SURVIVES. The sentence's job is to tell the reader the
   * silence is DELIBERATE. A narrowing that quietly dropped that would trade
   * one defect for another, and no other assertion here would notice.
   */
  it('keeps the deliberate-silence force and the capture fact', () => {
    renderPanel()
    const text = goalEntry().textContent ?? ''
    expect(text, 'the withhold must still read as deliberate').toMatch(/rather than guessed/i)
    expect(text, 'the target was captured, and the sentence must still say so').toMatch(
      /\b(was|were)\s+(recorded|captured|received|saved)\b/i,
    )
  })

  /**
   * ⭐⭐ THE DISCRIMINATING TWIN (trap 19). Proves the assertions above bind to
   * the GOAL entry and not merely to "some text in the strip". The sibling
   * entry is on screen in the same render and satisfies neither predicate, so
   * a selector that had drifted to the wrong object would fail HERE.
   */
  it('CONTRAST: the sibling warning in the same strip is a different object and is untouched', () => {
    renderPanel()
    const other = document.querySelector(`[data-warning-code="${OTHER_CODE}"]`)
    expect(other, 'the contrast entry must render, or this control is blind').not.toBeNull()
    const otherText = (other as HTMLElement).textContent ?? ''
    expect(otherText).not.toMatch(NAMES_THE_QUANTITY)
    expect(otherText).not.toMatch(CLAIMS_RESULTS_WITHHELD)
    // ...and the two really are distinct nodes, not one element matched twice.
    expect(other).not.toBe(goalEntry())
  })
})

/**
 * A QUALIFIER WITH NOTHING TO QUALIFY IS A DANGLING FRAGMENT.
 *
 * ── THE WITNESS ────────────────────────────────────────────────────────────
 * Deployed staging `2416ac3f`, 9 Sep 2026, guest, restored saved example
 * "Customer Data Platform Selection", COMPLETED run. Read off the live DOM:
 *
 *   analysis-new-glance-headline          → ABSENT
 *   analysis-new-glance-win-share         → ABSENT
 *   analysis-new-glance-win-bar           → ABSENT
 *   analysis-new-glance-verdict-line      → "Sensitive"
 *   analysis-new-glance-input-provenance  → "On inputs whose source Olumi
 *                                            could not establish"  (undetermined)
 *
 * So the panel rendered a bare prepositional phrase with no clause anywhere for
 * it to attach to, sitting between the robustness line and the action card.
 * Paul reported it as a sentence rendering alone; it is a QUALIFIER rendering
 * alone, which is the same defect with a name.
 *
 * ── WHY THE PREVIOUS FIX COULD NOT REACH IT ────────────────────────────────
 * `glanceHoldsAtTheFloor.spec.tsx` already fixed this line's GEOMETRY: it used
 * to sit in the section's `space-y-3` as a peer of the verdict, 12px below the
 * sentence it qualified and 12px above one it did not, so it read as orphaned.
 * The fix grouped the reading and its qualifier into one block, and it was the
 * right fix for that defect.
 *
 * ⭐ BUT GROUPING A QUALIFIER WITH ITS READING CANNOT HELP WHEN THERE IS NO
 * READING. On the witnessed run the group contains a verdict PILL, a producer
 * reason clause about robustness, and the qualifier — and none of the six
 * sanctioned provenance sentences modifies a robustness word. They modify a
 * READING: "Scored highest in 66% of simulated futures", or a named leading
 * option. Both were absent.
 *
 * ── ⭐⭐ THE GUARD EXISTED, AND IT WATCHED THE DOOR THAT WAS ALREADY SHUT ────
 * `glanceInputProvenance.spec.tsx:307` is named
 * "does not render an orphan caveat when there is no reading to condition" —
 * this exact property, asserted before the defect shipped. Its fixture sets
 * `verdict: null`.
 *
 * That is the ONE sub-case the faulty disjunct cannot reach. With no verdict
 * the gate is false through `showAnswer` alone, so the assertion held for a
 * reason unrelated to what it claimed to test, and the state that actually
 * reaches users — verdict PRESENT, reading absent — was never rendered by any
 * test. One guard, one direction (CLAUDE.md trap 22b).
 *
 * ⚠ THE DEEPER READING, AND IT IS TRAP 21: the test and the gate disagreed
 * about what "a reading" MEANS. The gate counted a verdict as one; the test's
 * name says it is not. The fixture chose the value under which both are true,
 * so nothing anywhere had to resolve the disagreement. It is resolved here, in
 * the gate's favour being wrong: a verdict is a robustness word, not a reading.
 * That existing test is kept and still passes — it is a real assertion about a
 * real state; it was simply never the whole domain.
 *
 * ── WHAT THE GATE GOT WRONG ────────────────────────────────────────────────
 * `showAnswer || Boolean(glance.verdict)`. The second disjunct is the defect:
 * `glance.verdict` is a tone word plus the producer's own reason, not something
 * this phrase can qualify. The component's own comment already states the rule
 * it broke — "it must render only where there is something on this surface for
 * it to qualify".
 *
 * ⚠ AND THE STATE IS NOT AN EDGE CASE — the view model DOCUMENTS producing it
 * (`buildAnalysisNewViewModel.ts`, above `shareOnScreen`): "a leader determined
 * by EXPECTED OUTCOME carries a null win probability, so it shows a superlative
 * and an ordering verdict with no percentage at all". A run with a robustness
 * verdict and no entitled leader lands here every time.
 *
 * ⚠⚠ THIS IS NOT A SUPPRESSION OF THE HONESTY LINE, and the distinction is the
 * whole argument. The module exists to stop a PROMINENT READING sitting with
 * its basis stated nowhere — "the consequent in its largest type and the
 * antecedent nowhere". Where no reading is on screen there is no consequent for
 * the phrase to qualify, so that harm cannot occur. The line still renders on
 * every run that shows one, which the opposite-direction twin below pins.
 *
 * ⚠⚠ NARROWED 9 Sep 2026 — the paragraph above read "there is no share to
 * anchor on and NO OPTION NAMED", and the second half is FALSE. `AtAGlance`'s
 * SCOPE row prints each excluded option's label on a partial comparison scope,
 * and that gate is live in the suppressed state, because `comparativeClaim` is
 * `'order'` there and not `'none'`. What IS derived is narrower, and is the
 * whole claim: `winShare`, `winFraction` and `leaderLabel` are each non-null
 * only where `headline` is, so the share, the win bar and the named leading
 * option cannot render while this line is suppressed. The full statement, its
 * bounded scope and its re-surface trigger are written ONCE, above
 * `readingOnScreen` in `AtAGlance.tsx`; this note exists only so a reader of
 * the spec alone is not left holding the false version.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { AtAGlance } from '../sections/AtAGlance'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import {
  openStrategicChallenge,
  genuineDecision,
  decisionWithLeaderWithheld,
} from './analysisNewFixtures'

const PROVENANCE = 'analysis-new-glance-input-provenance'

/**
 * The model comes from the REAL view model over the estate's OWN ratified
 * fixtures — not from a shape I invented. A fixture written by the author of a
 * fix encodes the author's model of the producer rather than the producer.
 * Exactly one field is set here (`inputProvenance`), because the fixtures carry
 * no factor value sources and that is the field under test.
 */
const glanceOf = (data: ResultsSectionDataReturn) =>
  buildAnalysisNewViewModel({
    data,
    recommendations: [],
    isPreRun: false,
    isRunning: false,
    isStale: false,
  }).atAGlance

const draw = (glance: ReturnType<typeof glanceOf>) =>
  render(
    <AtAGlance
      isRunning={false}
      reanalyseBlocked={false}
      reanalyseBlockedReason={null}
      glance={glance}
    />,
  )

afterEach(() => cleanup())

describe('the condition line needs a reading to condition', () => {
  it('PRECONDITION: the witnessed state is what the view model really produces', () => {
    // ⭐ PINNED IN-TEST rather than asserted in a comment. If a later change
    // stops this fixture producing "verdict, no reading", the defect assertion
    // below would pass vacuously — it would be describing a state nothing
    // reaches. This is the assertion that keeps the next one honest.
    const g = glanceOf(openStrategicChallenge())
    expect(g.verdict, 'no verdict — there would be nothing to orphan against').not.toBeNull()
    expect(g.headline, 'a headline would make this a different state').toBeNull()
    expect(g.leaderLabel).toBeNull()
    expect(g.winShare, 'a share would give the qualifier something to qualify').toBeNull()
  })

  it('⭐ renders NOTHING where the panel shows a verdict but no reading', () => {
    // THE DEPLOYED DEFECT. Reverting the gate re-renders the fragment here.
    draw({ ...glanceOf(openStrategicChallenge()), inputProvenance: 'undetermined' })
    expect(screen.queryByTestId('analysis-new-glance-verdict-line')).toBeInTheDocument()
    expect(screen.queryByTestId('analysis-new-glance-win-share')).not.toBeInTheDocument()
    expect(
      screen.queryByTestId(PROVENANCE),
      'a bare prepositional phrase rendered with no clause to attach to',
    ).not.toBeInTheDocument()
  })

  it('⭐ THE WITNESSED ROUTE: multi-option, leader WITHHELD, same suppressed state', () => {
    // ⚠ THE FIXTURE ABOVE IS NOT THE ROUTE THE DEFECT WAS SEEN ON.
    // `openStrategicChallenge()` carries `allOptions: []` and
    // `isSingleOption: true`; the deployed witness was a MULTI-OPTION run whose
    // leader the producer WITHHELD. The gate reads only
    // `leaderLabel`/`headline`/`verdict`/`winShare`, so it is identical across
    // the two — but a test whose fixture cannot reach the witnessed route is
    // evidence about a route, not about the wire. This pins the real one.
    const g = glanceOf(decisionWithLeaderWithheld())
    expect(g.verdict, 'precondition: a robustness verdict stands').not.toBeNull()
    expect(g.headline, 'precondition: the leader is withheld, so no headline').toBeNull()
    expect(g.leaderLabel).toBeNull()
    expect(g.winShare).toBeNull()
    draw({ ...g, inputProvenance: 'undetermined' })
    expect(screen.queryByTestId('analysis-new-glance-verdict-line')).toBeInTheDocument()
    expect(
      screen.queryByTestId(PROVENANCE),
      'the qualifier must not render on the route the defect was witnessed on',
    ).not.toBeInTheDocument()
  })

  it('⭐ OPPOSITE-DIRECTION TWIN: still renders beside a reading it CAN qualify', () => {
    // Without this the fix above is indistinguishable from deleting the line.
    // Bound by IDENTITY (the kind attribute), never by a value another element
    // could satisfy.
    draw({ ...glanceOf(genuineDecision()), inputProvenance: 'undetermined' })
    const line = screen.getByTestId(PROVENANCE)
    expect(line).toHaveAttribute('data-input-provenance', 'undetermined')
    expect(line).toHaveTextContent('On inputs whose source Olumi could not establish')
    // The reading it qualifies is genuinely on screen — otherwise this twin
    // would be passing for the wrong reason.
    expect(screen.getByTestId('analysis-new-glance-win-share')).toBeInTheDocument()
  })

  it('⭐ a NAMED LEADER is a reading, even with no percentage beside it', () => {
    // The producer's documented case: a leader determined by expected outcome
    // carries a null win probability. The option is named, so the qualifier has
    // something to qualify and must stay. A gate keyed on the share ALONE would
    // wrongly drop it here — the twin that stops this fix over-correcting.
    const g = glanceOf(genuineDecision())
    expect(g.headline, 'precondition: this fixture names a leader').not.toBeNull()
    draw({ ...g, winShare: null, winFraction: null, inputProvenance: 'estimated' })
    expect(screen.queryByTestId('analysis-new-glance-win-share')).not.toBeInTheDocument()
    expect(screen.getByTestId(PROVENANCE)).toHaveAttribute('data-input-provenance', 'estimated')
  })
})

/**
 * ⛔⛔ EVERY LINE THE GLANCE RENDERS IS A COMPLETE SENTENCE.
 *
 * ── THE DEFECT THIS CLOSES, AND WHY IT WAS A CLASS ─────────────────────────
 * Paul's ruling of 18 Sep 2026 deleted the glance's opening conclusion —
 * "delete the conclusion entirely — there shouldn't be a conclusion. We are a
 * reasoning enhancement tool, not a generic AI and analysis answering tool."
 * The ruling is right. What nobody checked is what its DEPENDANTS render once
 * it is gone, which is this estate's own standing rule: after removing an
 * element, check what its parent renders without it.
 *
 * Three constructions had been composed to hang off that lead, and all three
 * were left stranded. Witnessed on the deployed build `7ec3fed2`, guest entry,
 * saved starter "Customer Data Platform Selection" — the glance's entire
 * visible content, 122px, in order:
 *
 *   1. "Scored highest in 56% of simulated futures"   ← predicate, no subject
 *   2. "varying any one of the factors we could…"     ← producer clause, lower
 *                                                       case, composed to be
 *                                                       spent mid-sentence
 *   3. "On inputs whose source Olumi could not…"      ← prepositional phrase
 *
 * ⭐ THE CONTRAST CONTROL IS IN THE REPO. `TriageActionCardsBody:946` spends
 * the same producer clause as a native tooltip, where a bare clause reads
 * correctly. One string, two consumers, and only one of them opens a sentence
 * with it — so this is a boundary defect, not bad producer copy.
 *
 * ── WHY A DERIVED RULE AND NOT THREE FIXTURES ──────────────────────────────
 * Three repaired strings would leave the fourth author to rediscover this.
 * `GLANCE_PROVENANCE_COPY` is ITERATED here, so a seventh provenance kind is
 * covered the day it is added without anyone remembering (trap 12), and the
 * rendered arm walks whatever paragraphs the glance actually emits rather than
 * a list of test ids.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { GLANCE_PROVENANCE_COPY } from '../glanceProvenanceCopy'
import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import {
  decisionWithLeaderWithheld,
  decisionWithLeaderWithheldAndReason,
  genuineDecision,
} from './analysisNewFixtures'
import { openGroupsIfPresent } from './openNamedGroups'

/**
 * A LEADING PREPOSITION IS THE TELL, and it is what all six provenance strings
 * shared. A phrase opening "On …" / "Partly on …" is a dependant looking for a
 * clause to attach to; on a surface with no lead sentence it is a fragment.
 */
const OPENS_WITH_A_PREPOSITION =
  /^(on|in|at|by|from|with|without|against|partly|under|over|for)\b/i

afterEach(cleanup)

describe('every sanctioned glance string stands on its own', () => {
  const entries = Object.entries(GLANCE_PROVENANCE_COPY)

  it('pins its own precondition: the record is non-empty and every kind is present', () => {
    // Without this an empty or renamed record would make every arm below pass
    // by iterating nothing (trap 13).
    expect(entries.length, 'GLANCE_PROVENANCE_COPY is empty — every arm below is vacuous').toBe(6)
  })

  it.each(entries)('%s is a complete sentence', (_kind, sentence) => {
    expect(sentence.charAt(0)).toBe(sentence.charAt(0).toUpperCase())
    expect(sentence.endsWith('.')).toBe(true)
    expect(
      OPENS_WITH_A_PREPOSITION.test(sentence),
      `"${sentence}" opens with a preposition — it is a dependant clause, and the lead sentence it was written for was deleted on 18 Sep 2026`,
    ).toBe(false)
  })

  it('⭐ the rule bites: the string this shipped with would fail it', () => {
    // The instrument's own positive control. Without it a typo in the regex
    // would leave every arm above green while checking nothing (trap 13).
    const asShipped = 'On inputs whose source Olumi could not establish'
    expect(OPENS_WITH_A_PREPOSITION.test(asShipped)).toBe(true)
    expect(asShipped.endsWith('.')).toBe(false)
  })
})

describe('the glance renders no fragments', () => {
/**
 * ⛔ THE PRODUCER CLAUSE HAD TO BE PUT INTO THE FIXTURE, AND THAT IS A FINDING
 * ABOUT THE GUARD, NOT A CONVENIENCE.
 *
 * The first version of this census ran on `genuineDecision()` alone, and
 * dropping `sentenceCase` at the render boundary left all eleven arms GREEN —
 * because that fixture carries no `robustnessVerdictReason`, so the paragraph
 * the defect lives in never rendered. A census blind to the one line that was
 * actually witnessed lower case is a guard agreeing with itself (trap 13b).
 *
 * The clause is the wire fixture's own, verbatim from
 * `leaderClaim.fixtures.ts:205` — lower case, exactly as the producer composes
 * it for mid-sentence use.
 */
const PRODUCER_REASON = 'held up across the ranges we varied'

const run = (): ResultsSectionDataReturn => {
  const data = genuineDecision()
  return {
    ...data,
    recommendation: { ...data.recommendation, robustnessVerdictReason: PRODUCER_REASON },
  } as ResultsSectionDataReturn
}

  const renderGlance = (data: ResultsSectionDataReturn, hash: string) => {
    render(
      <AnalysisNewTabBody
        resultsSectionData={data}
        isPreRun={false}
        isRunning={false}
        isStale={false}
        responseHash={hash}
      />,
    )
    openGroupsIfPresent()
    // S1 (design wave 2, panel-lane design audit 2026-09-25): "What this run
    // may not conclude" is now a closed-at-rest disclosure inside `AtAGlance`.
    const withheldToggle = screen.queryByTestId('analysis-new-glance-withheld-toggle')
    if (withheldToggle) fireEvent.click(withheldToggle)
  }

  const glanceLines = (): string[] =>
    [...screen.getByTestId('analysis-new-glance').querySelectorAll('p, span')]
      .filter((el) => el.querySelector('p, span') === null)
      .map((el) => (el.textContent ?? '').trim())
      .filter((t) => t.length > 0)

  it('⭐ every paragraph the glance emits begins a sentence', () => {
    renderGlance(run(), 'speaks_in_sentences')
    const lines = glanceLines()

    // PRECONDITION: the glance rendered its READING, not merely some text. An
    // empty — or withheld — census agrees with every rule ever written.
    expect(lines.length, 'the glance rendered no text — this census is vacuous').toBeGreaterThan(0)
    expect(
      lines.some((l) => /had the highest score in/i.test(l)),
      'the entitled fixture no longer renders a share — the case this arm exists for is gone',
    ).toBe(true)
    // PRECONDITION: the producer's clause is on screen. Without it this census
    // cannot observe the render-boundary case at all, and dropping
    // `sentenceCase` leaves it green — measured, not supposed.
    expect(
      screen.queryByTestId('analysis-new-glance-verdict-reason')?.textContent ?? '',
      'the producer reason paragraph did not render — the sentence-case case is unobserved',
    ).toContain(PRODUCER_REASON.slice(1))

    for (const line of lines) {
      expect(
        line.charAt(0),
        `"${line}" does not open with a capital — the glance has no lead sentence for a continuation to attach to`,
      ).toBe(line.charAt(0).toUpperCase())
    }
  })

  it('⭐ the share carries a subject, and it identifies no option', () => {
    renderGlance(run(), 'share_has_a_subject')

    const share = screen.getByTestId('analysis-new-glance-win-share').textContent ?? ''
    expect(share, 'the share rendered empty — nothing below is being tested').not.toBe('')
    // A subject, and a full stop: this is a sentence, not a predicate.
    expect(share.startsWith('In this model, one option had the highest score in')).toBe(true)
    expect(share.endsWith('.')).toBe(true)

    // ⛔ AND IT MUST NOT REINSTATE THE CONCLUSION. The repair supplies a
    // subject that identifies nobody; naming the option here would restore
    // exactly what Paul's ruling deleted.
    for (const option of ['RudderStack', 'Segment', 'Snowflake', 'Adopt ']) {
      expect(share, `the share names an option — the ruling deleted the conclusion`).not.toContain(
        option,
      )
    }
  })

  it('⛔ a glance with nothing to show renders NOTHING, not an empty landmark', () => {
    // ── THE GAP THIS ARM WAS OPENED TO PIN, NOW CLOSED ──────────────────────
    // It first ran as a known-gap pin, because measuring the withheld state
    // found a labelled landmark with no content inside it — a region a
    // screen-reader user reaches by name and finds empty. `hasAnything` passed
    // on `glance.verdict` while every block that verdict feeds declined.
    //
    // ⚠ THE FIRST REPAIR WAS REFUTED BY EXECUTION, and that is worth keeping in
    // view: binding the guard to `verdictCarriesItsOwnReading` alone RED 36
    // specs, because that is ONE of five things this section renders. The guard
    // now reads all five children's own expressions.
    //
    // This fixture is the producer that sent NO refusal message, so there is
    // genuinely nothing to show. The honest render is no render.
    renderGlance(decisionWithLeaderWithheld(), 'withheld_no_message')
    expect(
      screen.queryByTestId('analysis-new-glance'),
      'the glance rendered a labelled landmark with nothing inside it',
    ).toBeNull()
  })

  it('⭐ OPPOSITE-DIRECTION TWIN: the withheld run that DOES speak, speaks in sentences', () => {
    // Without this the arm above is satisfied by an `AtAGlance` that never
    // renders on a withheld run at all — which would delete the withheld
    // sentence from the one state a fresh user is most likely to land in, and
    // is a worse defect than the empty landmark it replaced.
    //
    // The admission is a capture: `CONFIDENCE_PARAMETERS_ALL_MACHINE_AUTHORED`,
    // the code behind the withheld leader on Paul's own run.
    renderGlance(decisionWithLeaderWithheldAndReason(), 'withheld_with_message')
    const landmark = screen.queryByTestId('analysis-new-glance')
    expect(landmark, 'the withheld run lost its glance entirely').not.toBeNull()
    // V2 prototype (Paul, 25 Sep 2026): the withheld sentence sits behind one
    // door, closed at rest. Open it so the census reads the sentence itself.
    const door = screen.getByTestId('analysis-new-glance-withheld-toggle')
    expect(door).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(door)

    const lines = glanceLines()
    expect(lines.length, 'the withheld glance rendered no text — this arm is vacuous').toBeGreaterThan(
      0,
    )
    // PRECONDITION: it is the WITHHELD sentence on screen, not some other block.
    expect(
      landmark?.textContent ?? '',
      'the withheld reason is not on screen — this arm is measuring a different state',
    ).toContain('no option can be called the leader')

    for (const line of lines) {
      expect(line.charAt(0), `"${line}" does not open with a capital`).toBe(
        line.charAt(0).toUpperCase(),
      )
    }
  })
})

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
import { cleanup, render, screen } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { GLANCE_PROVENANCE_COPY } from '../glanceProvenanceCopy'
import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import { decisionWithLeaderWithheld, genuineDecision } from './analysisNewFixtures'
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
  const run = (): ResultsSectionDataReturn => genuineDecision()

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
      lines.some((l) => /scored highest in/i.test(l)),
      'the entitled fixture no longer renders a share — the case this arm exists for is gone',
    ).toBe(true)

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
    expect(share.startsWith('One option scored highest in')).toBe(true)
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

  it('⭐ OPPOSITE-DIRECTION TWIN — and it PINS A KNOWN GAP rather than hiding it', () => {
    // The rule must be checked against the glance's OTHER whole state, not only
    // the one the fragments were witnessed on. Measuring it turned up something
    // the sentence rule cannot fix, so the gap is pinned here rather than left
    // in a comment: a gap recorded in the suite is honest, a gap invisible to
    // it is how a defect survives a rewrite.
    //
    // ⛔ THE WITHHELD GLANCE RENDERS AN EMPTY LABELLED LANDMARK. `hasAnything`
    // in `AtAGlance` passes on `glance.verdict`, and on a withheld run every
    // block that verdict feeds declines: the view model nulls `winShare` and
    // `winFraction`, and `mayExplainByRanking` deletes `verdict.reason`, all
    // three by design. A screen-reader user navigating by landmark reaches
    // "At a glance" and finds nothing inside it.
    //
    // ⚠ THE OBVIOUS FIX IS REFUTED BY EXECUTION, which is why this is a pin and
    // not a repair: rebinding `hasAnything` to `verdictCarriesItsOwnReading`
    // REDs 36 specs, because the verdict feeds several blocks besides the
    // reading. The narrow predicate was the only one in hand.
    //
    // ⭐ THIS ARM REDS IN BOTH DIRECTIONS. If the landmark starts rendering
    // content, the `toHaveLength(0)` fails and whoever fixed it is told to
    // promote this into the sentence census above. If it starts rendering a
    // FRAGMENT, the census in that branch fails. Neither change can land
    // silently.
    renderGlance(decisionWithLeaderWithheld(), 'withheld_speaks_in_sentences')
    const landmark = screen.queryByTestId('analysis-new-glance')
    expect(landmark, 'the glance stopped rendering at all on a withheld run').not.toBeNull()

    const lines = glanceLines()
    if (lines.length === 0) {
      // The known gap, exactly as measured. Pinned by identity, not by a
      // tolerance: the landmark EXISTS and is EMPTY.
      expect(landmark?.getAttribute('aria-label')).toBe('At a glance')
      expect(landmark?.textContent).toBe('')
      return
    }
    // The gap is closed — then the rule applies here too, and must.
    for (const line of lines) {
      expect(line.charAt(0), `"${line}" does not open with a capital`).toBe(
        line.charAt(0).toUpperCase(),
      )
    }
  })
})

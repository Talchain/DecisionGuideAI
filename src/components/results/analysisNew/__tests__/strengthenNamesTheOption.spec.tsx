/**
 * ⭐⭐⭐ THE SUBJECT OF A PERMITTED CLAIM IS AN OPTION'S NAME, NOT ITS PLACING.
 *
 * THE DEFECT, AND WHY EVERY GUARD IN THIS ESTATE WAS BLIND TO IT. The Strengthen
 * engine's challenge trigger said:
 *
 *   "Pressure-test the option that scored highest"
 *   "Build the strongest case AGAINST the option that scored highest and see if
 *    it survives."
 *
 * Both sentences are TRUE of whichever option landed at rank 0, FALSE of every
 * other option, and NAME NONE. The reader is handed a placing and left to
 * resolve it, on a comparative claim the system chose and the user never asked
 * for. The race frame is in the REFERENT, so it carries NO BANNED WORD — which
 * is exactly why `noWinnerVocabulary.spec.ts` and
 * `ownedLeaderClaim.strengthen.spec.tsx`'s designating-form net were both green
 * while it shipped. A vocabulary guard cannot see a rank description.
 *
 * ⭐ PERMISSION IS NOT IDENTITY (CLAUDE.md trap 21). Both sites were already
 * gated on `leaderClaimWithheld`. That gate answers *may this panel designate a
 * leader?*; it says nothing about what the option is CALLED, so the only
 * referent the engine held was the ranking itself. The repair is a second field
 * (`StrengthenInputs.leadingOptionLabel`), not a re-wording.
 *
 * ⭐⭐ WHY THIS SPEC IS A DISCRIMINATING PAIR AND NOT A "A NAME APPEARS" CHECK.
 * Asserting that the sentence contains SOME option label passes on a constant,
 * on the wrong option, and on the first option in the list. The two cases below
 * are byte-identical except for WHICH option `recommendedOption` points at, and
 * each asserts the OTHER option's label is absent — so the sentence is proved to
 * track the designated option rather than to mention one. A fix that named a
 * fixed option, or the first option, passes case A and REDS case B.
 *
 * ⚠ BOUND BY IDENTITY, NEVER BY A VALUE PREDICATE. The recommendation is
 * selected by its register id (`strengthen:robustness`) and read back through
 * the `data-testid` the component renders it under. No assertion here compares
 * the render against a constant the component or the engine exports: every
 * expected sentence is written out longhand in this file, so a change to the
 * copy module cannot make an assertion agree with itself.
 *
 * ⚠ THE CHAIN, NOT THE COMPONENT. The fixture enters at
 * `buildStrengthenInputsForAnalysisNew` (the builder that must READ
 * `recommendation.recommendedOption`), runs the real engine, and renders the
 * real section — so deleting the threading line in the builder REDS this file.
 * A component-only test would pass with the builder's field removed.
 */

import '@testing-library/jest-dom/vitest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'
import { StrengthenTheReasoning } from '../sections/StrengthenTheReasoning'
import { buildStrengthenInputsForAnalysisNew } from '../buildStrengthenInputsForAnalysisNew'
import { buildRecommendations } from '../../strengthen/buildRecommendations'
import type { Recommendation } from '../../strengthen/strengthenTypes'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'

/**
 * TWO OPTIONS, DELIBERATELY. One option cannot discriminate: with a single
 * option in the run, "the option that scored highest" and the option's name pick
 * out the same thing, so the defect is invisible. Two distinctive labels, each
 * of which must be absent from the other's sentence.
 */
const OPTION_A = { id: 'opt_a', label: 'Extend the current contract' }
const OPTION_B = { id: 'opt_b', label: 'Modernise the platform' }

/**
 * A run that is ENTITLED to designate (`leaderDesignationPermitted: true` — the
 * composed answer `leaderDesignationPermitted()` reads first) and whose
 * robustness grade is `low`, which is the challenge trigger's own condition.
 *
 * `designated` is the ONLY axis that moves between the two cases.
 */
const runDesignating = (designated: { id: string; label: string }): ResultsSectionDataReturn =>
  ({
    recommendation: {
      analysisStatus: 'computed',
      goalThreshold: 62,
      hasGoalTarget: true,
      leaderDesignationPermitted: true,
      verdict: {
        leaderId: designated.id,
        separation: 'clear',
        hasLeadingOption: true,
        gapPp: 40,
        source: 'producer_near_tie',
      },
      allOptions: [
        { ...OPTION_A, isRecommended: designated.id === OPTION_A.id },
        { ...OPTION_B, isRecommended: designated.id === OPTION_B.id },
      ],
      recommendedOption: { ...designated, isRecommended: true },
      flipThresholds: null,
    },
    confidence: {
      challengeFragileEdges: [],
      robustnessStatus: 'computed',
      robustnessLevel: 'low',
    },
    drivers: { drivers: [] },
  }) as unknown as ResultsSectionDataReturn

/** The challenge recommendation, selected BY REGISTER ID. */
const challengeRec = (data: ResultsSectionDataReturn): Recommendation[] =>
  buildRecommendations(
    buildStrengthenInputsForAnalysisNew({
      data,
      guidanceItems: [],
      biasSignals: null,
      currentStage: null,
    }),
  ).filter((r) => r.id === 'strengthen:robustness')

/**
 * ⚠ THE SECTION HEADER SHARES THE ROW'S `data-testid`. The collapsible header
 * renders "Strengthen the reasoning" under `analysis-new-strengthen-title` and
 * every row renders its own title under the SAME id, so an unscoped
 * `getByTestId` matches two elements and throws before one assertion runs.
 * Scope to the ROW, selected by its register id — the identity binding this
 * file already uses to pick the recommendation, and the pattern
 * `theFocusCardReferencesRatherThanReprints.spec.tsx` established. Nothing is
 * relaxed by this: both the presence and the absence assertions below still
 * read the same rendered strings, now provably from the challenge row.
 */
const challengeRow = (): HTMLElement => {
  const row = screen
    .getAllByTestId('analysis-new-strengthen-item')
    .find((r) => r.getAttribute('data-recommendation-id') === 'strengthen:robustness')
  expect(row, 'the challenge row did not render — every assertion below is vacuous').toBeTruthy()
  return row as HTMLElement
}

/** Open the collapsed section, exactly as the sibling specs do. */
const renderOpen = (interventions: Recommendation[]) => {
  render(<StrengthenTheReasoning interventions={interventions} />)
  fireEvent.click(screen.getByTestId('analysis-new-strengthen-toggle'))
}

beforeEach(() => {
  cleanup()
  useStrengthenStore.getState()._reset()
  try {
    sessionStorage.clear()
  } catch {
    /* jsdom */
  }
})

describe('the challenge recommendation names the designated option', () => {
  it('CASE A: the sentence names option A and is FALSE of option B', () => {
    const recs = challengeRec(runDesignating(OPTION_A))
    // ⚠ The trigger must actually have fired, or every assertion below is
    // vacuous — an absent card contains no wrong sentence either.
    expect(recs, 'the challenge trigger did not fire on this fixture').toHaveLength(1)
    renderOpen(recs)
    const row = challengeRow()

    expect(within(row).getByTestId('analysis-new-strengthen-title')).toHaveTextContent(
      'Pressure-test Extend the current contract',
    )
    expect(within(row).getByTestId('analysis-new-strengthen-try')).toHaveTextContent(
      'Build the strongest case against Extend the current contract and see what survives.',
    )
    // THE DISCRIMINATION: the option that was NOT designated is not the subject.
    expect(within(row).getByTestId('analysis-new-strengthen-title')).not.toHaveTextContent(
      'Modernise the platform',
    )
    expect(within(row).getByTestId('analysis-new-strengthen-try')).not.toHaveTextContent(
      'Modernise the platform',
    )
  })

  it('CASE B: move the designation, and the SAME sentence names option B instead', () => {
    const recs = challengeRec(runDesignating(OPTION_B))
    expect(recs, 'the challenge trigger did not fire on this fixture').toHaveLength(1)
    renderOpen(recs)
    const row = challengeRow()

    expect(within(row).getByTestId('analysis-new-strengthen-title')).toHaveTextContent(
      'Pressure-test Modernise the platform',
    )
    expect(within(row).getByTestId('analysis-new-strengthen-try')).toHaveTextContent(
      'Build the strongest case against Modernise the platform and see what survives.',
    )
    expect(within(row).getByTestId('analysis-new-strengthen-title')).not.toHaveTextContent(
      'Extend the current contract',
    )
    expect(within(row).getByTestId('analysis-new-strengthen-try')).not.toHaveTextContent(
      'Extend the current contract',
    )
  })

  it('the assistant is asked about the NAMED option, not about a placing', () => {
    // The prompt is the sharper half of the harm: a label the reader can shrug
    // at becomes an assertion of fact once the assistant is told to argue
    // against "the option that scored highest".
    const [rec] = challengeRec(runDesignating(OPTION_B))
    expect(rec.action.prompt).toBe(
      'Build the strongest case against Modernise the platform.',
    )
  })

  it('the RANK DESCRIPTION reaches no channel, on either designation', () => {
    // ⭐ THE GUARD THE VOCABULARY NETS COULD NOT BE. Swept across every string
    // the engine hands the reader or the assistant, on both cases, so a
    // fallback that reinstates the placing for one designation cannot hide.
    for (const designated of [OPTION_A, OPTION_B]) {
      const [rec] = challengeRec(runDesignating(designated))
      const channels = [
        rec.title,
        rec.signal,
        rec.whyNow,
        rec.tryThis ?? '',
        rec.action.label,
        rec.action.prompt ?? '',
      ]
      for (const s of channels) {
        expect(s, `rank description reached a channel: ${s}`).not.toMatch(
          /\b(the option that scored highest|which option scores highest|the leading option|the current leader)\b/i,
        )
      }
    }
  })

  it('CONTROL: the fixture pair genuinely differs — the two runs designate different options', () => {
    // ⚠ Without this, both cases could be passing because the fixture builder
    // silently returns the same run twice and the assertions happen to be
    // satisfied by one constant. Sameness across inputs that ought to differ is
    // evidence about the instrument (CLAUDE.md trap 20).
    const [a] = challengeRec(runDesignating(OPTION_A))
    const [b] = challengeRec(runDesignating(OPTION_B))
    expect(a.title).not.toBe(b.title)
    expect(a.action.prompt).not.toBe(b.action.prompt)
  })
})

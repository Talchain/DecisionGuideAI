/**
 * comparisonScopeDisclosure — a rendered result computed over a SUBSET says so,
 * next to the number.
 *
 * ## The defect
 *
 * CEE's admission gate already drops an option with nothing to submit and runs
 * the rest, so subset results reach users today. ISL is explicit that
 * `win_probability`, `rank`, `expected_regret` and the flip thresholds are
 * defined OVER THE CANDIDATE SET — so "Option A — 62%" with no statement of
 * which options were compared asserts something false about the user's actual
 * decision. A 62% among three is not a 62% among four.
 *
 * `NotAnalysedOptionCard` discloses the exclusion on the EXCLUDED OPTION'S OWN
 * CARD — which is precisely where a reader of a headline percentage is not
 * looking. This file pins the qualification at the three surfaces a customer
 * reads first: the hero headline, the WinGauge comparative block, and the
 * option cards' rank markers.
 *
 * ⚠ THE HERO HALF LIVES ELSEWHERE — `analysis-hero/__tests__/
 * comparisonScopeDisclosure.hero.spec.tsx`. `analysis-hero/__tests__/
 * inertness.spec.ts` allows only `ResultsBody` to import that module from
 * outside it, so the hero pins sit inside the module rather than widening an
 * architectural boundary to suit a test.
 *
 * ## What each pin exists for
 *
 * - **Presence on a subset run** at each of the three mounted surfaces.
 * - **ABSENCE on a full-set run** — the boundary that stops this shipping as
 *   noise on every result. A "comparing 4 of 4" note everywhere is how a real
 *   disclosure stops being read, and it is also how this spec would become a
 *   tautology that cannot tell the two states apart.
 * - **The excluded option is NAMED**, and named by the label on its own
 *   record — bound by IDENTITY (`option_id`-keyed fixture labels, exact
 *   testids), never by matching a copy string this change is authoring
 *   (trap 19).
 * - **The GOAL block is NOT qualified.** ISL lists `probability_of_goal` among
 *   the per-option quantities that are INVARIANT on a subset. Attaching the
 *   note there would be an untruth in the opposite direction — telling a user a
 *   figure is set-dependent when it is not. This is a discrimination the
 *   instrument makes on purpose: a blind probe could fake the presence
 *   assertions above by rendering the note everywhere, and it cannot fake
 *   this one (trap 20's corollary — keep one probe whose expected answer
 *   DIFFERS).
 *
 * ## Deployed-flag posture (trap 3b)
 *
 * All three surfaces are mounted UNCONDITIONALLY by `ResultsBody`:
 * `AnalysisHeroContainer` (the analysis-hero fork is closed — `netlify.toml`
 * records `VITE_FEATURE_ANALYSIS_HERO_PANEL` as retired with no readers),
 * `WinGauge`, and `OptionCards`. So this file's greenness is a claim about
 * something a user loads on the deployed posture, not about a component a flag
 * switches off.
 */

import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { OptionCards } from '../OptionCards'
import { WinGauge } from '../WinGauge'
import {
  COMPARISON_SCOPE_COPY,
  EXCLUDED_LABEL_NAME_CAP,
  deriveComparisonScope,
} from '../utils/goalAnchorCopy'
import type { OptionResult } from '../types'

// ── Identity anchors. Every query binds to these, never to prose. ──────────
const KEEP_A = 'opt-keep-a'
const KEEP_B = 'opt-keep-b'
const KEEP_C = 'opt-keep-c'
const DROPPED = 'opt-dropped'
const DROPPED_TWO = 'opt-dropped-two'

const DROPPED_LABEL = 'Hybrid Phased Approach'
const DROPPED_TWO_LABEL = 'Rip and Replace'

const NOTE = {
  gauge: 'comparison-scope-note-comparative',
  cards: 'comparison-scope-note-options',
  goal: 'comparison-scope-note-goal',
} as const

function analysed(id: string, winProbability: number): OptionResult {
  return {
    id,
    label: `Analysed ${id}`,
    expected: 100,
    outcome: { mean: 100, p10: 60, p50: 100, p90: 140 },
    p10: 60,
    p50: 100,
    p90: 140,
    isRecommended: false,
    winProbability,
    goalProbability: 0.55,
  } as OptionResult
}

/** Exactly the shape `useResultsSectionData` produces for an excluded option. */
function excluded(id: string, label: string): OptionResult {
  return {
    id,
    label,
    expected: null,
    outcome: { mean: null, p10: null, p50: null, p90: null },
    p10: null,
    p50: null,
    p90: null,
    isRecommended: false,
    notAnalysed: true,
    notAnalysedReason: 'no_interventions',
  } as OptionResult
}

/** THREE ARMS OF FOUR — the measured draw-10 shape from the CEE capture. */
const subsetOptions = (): OptionResult[] => [
  analysed(KEEP_A, 0.62),
  analysed(KEEP_B, 0.23),
  analysed(KEEP_C, 0.15),
  excluded(DROPPED, DROPPED_LABEL),
]

/** The contrast arm: every option compared. */
const fullSetOptions = (): OptionResult[] => [
  analysed(KEEP_A, 0.62),
  analysed(KEEP_B, 0.23),
  analysed(KEEP_C, 0.15),
]

function gaugeShares(options: OptionResult[]) {
  return options
    .filter((o): o is OptionResult & { winProbability: number } =>
      typeof o.winProbability === 'number',
    )
    .map(o => ({
      id: o.id,
      label: o.label,
      winProbability: o.winProbability,
      isWinner: o.id === KEEP_A,
      goalProbability: o.goalProbability,
    }))
}

describe('comparison-scope disclosure — a subset result says which options it compared', () => {
  describe('OptionCards (rank markers, win percentages)', () => {
    it('renders the scope note when one of four options was left out', () => {
      render(<OptionCards options={subsetOptions()} winnerId={KEEP_A} hasLeadingOption />)
      const note = screen.getByTestId(NOTE.cards)
      expect(note).toHaveTextContent('3 of your 4 options')
    })

    it('names the excluded option on the note itself, not only on its card', () => {
      render(<OptionCards options={subsetOptions()} winnerId={KEEP_A} hasLeadingOption />)
      expect(screen.getByTestId(NOTE.cards)).toHaveTextContent(DROPPED_LABEL)
    })

    // ⭐ THE DISCRIMINATING TWIN (trap 19). The pin above is a PRESENCE check,
    // and a mutant that names EVERY option satisfies it while saying something
    // false — the note would list options that were in the comparison as
    // though they had been left out. Binding the claim to the excluded
    // option's identity requires asserting the analysed ones are ABSENT.
    it('names ONLY the excluded option — an analysed sibling never appears', () => {
      render(<OptionCards options={subsetOptions()} winnerId={KEEP_A} hasLeadingOption />)
      const note = screen.getByTestId(NOTE.cards)
      expect(note).not.toHaveTextContent(`Analysed ${KEEP_A}`)
      expect(note).not.toHaveTextContent(`Analysed ${KEEP_B}`)
      expect(note).not.toHaveTextContent(`Analysed ${KEEP_C}`)
    })

    it('names BOTH excluded options when two of five were left out', () => {
      const options = [...subsetOptions(), excluded(DROPPED_TWO, DROPPED_TWO_LABEL)]
      render(<OptionCards options={options} winnerId={KEEP_A} hasLeadingOption />)
      const note = screen.getByTestId(NOTE.cards)
      expect(note).toHaveTextContent('3 of your 5 options')
      expect(note).toHaveTextContent(DROPPED_LABEL)
      expect(note).toHaveTextContent(DROPPED_TWO_LABEL)
    })

    // ── THE BOUNDARY. Without this the presence pins above are satisfied by
    // rendering the note unconditionally, which is the noise failure mode.
    it('renders NO scope note when every option was compared', () => {
      render(<OptionCards options={fullSetOptions()} winnerId={KEEP_A} hasLeadingOption />)
      expect(screen.queryByTestId(NOTE.cards)).toBeNull()
    })

    // Contrast control: the ranked chrome this note qualifies is genuinely on
    // screen in the subset render. Without it, "the note appeared" could be
    // true of a surface that renders no numbers at all (trap 13e).
    it('CONTROL — the ranked chrome the note qualifies is present in the same render', () => {
      render(<OptionCards options={subsetOptions()} winnerId={KEEP_A} hasLeadingOption />)
      expect(screen.getByTestId(`rank-marker-${KEEP_A}`)).toBeTruthy()
      expect(screen.getByTestId(`win-pct-${KEEP_A}`)).toBeTruthy()
    })
  })

  describe('WinGauge (comparative block)', () => {
    it('renders the scope note INSIDE the comparative block', () => {
      const options = subsetOptions()
      render(
        <WinGauge shares={gaugeShares(options)} comparisonScope={deriveComparisonScope(options)} />,
      )
      const comparative = screen.getByTestId('win-gauge-comparative-block')
      expect(within(comparative).getByTestId(NOTE.gauge)).toHaveTextContent('3 of your 4 options')
    })

    // ⭐ THE DISCRIMINATING PIN, CORRECTED.
    //
    // The first version asserted the goal block carried NO qualification at
    // all, on the grounds that `probability_of_goal` is subset-invariant. That
    // is right about the MAGNITUDES and wrong about the BLOCK: `goalRows` is
    // sorted descending by the goal quantity on every non-withheld run, and
    // order is a designation (`optionDisplayOrder`, ROADMAP 1.306 — a rule
    // WinGauge itself already applies to `designationsWithheld`). So the block
    // gets the neutral scope SENTENCE, and must still NOT get the
    // set-dependence `detail` line.
    //
    // ⚠ The block's EXISTENCE is asserted first. The previous version wrapped
    // the assertion in `if (goalBlock)`, which is vacuous whenever the fixture
    // stops producing goal numbers — a reviewer proved the contingency by
    // dropping one unpinned fixture property and watching the misplacement
    // mutant go red → green (trap 13: an absence probe needs to prove it can
    // see a presence).
    it('qualifies the goal block with the SENTENCE but never the detail line', () => {
      const options = subsetOptions()
      render(
        <WinGauge
          shares={gaugeShares(options)}
          comparisonScope={deriveComparisonScope(options)}
          goalThreshold={0.5}
        />,
      )
      const goalBlock = screen.getByTestId('win-gauge-goal-block')
      const note = within(goalBlock).getByTestId(NOTE.goal)
      expect(note).toHaveTextContent('3 of your 4 options')
      expect(note).toHaveTextContent(DROPPED_LABEL)
      // The set-dependence claim belongs to the comparative surfaces only.
      expect(note).not.toHaveTextContent('Ranks and comparative percentages')
    })

    it('renders NO goal-block note when every option was compared', () => {
      const options = fullSetOptions()
      render(
        <WinGauge
          shares={gaugeShares(options)}
          comparisonScope={deriveComparisonScope(options)}
          goalThreshold={0.5}
        />,
      )
      expect(screen.getByTestId('win-gauge-goal-block')).toBeTruthy()
      expect(screen.queryByTestId(NOTE.goal)).toBeNull()
    })

    it('renders NO scope note when every option was compared', () => {
      const options = fullSetOptions()
      render(
        <WinGauge shares={gaugeShares(options)} comparisonScope={deriveComparisonScope(options)} />,
      )
      expect(screen.queryByTestId(NOTE.gauge)).toBeNull()
    })
  })

  // ── THE VERBATIM COPY. Pinned so the sentence a user reads is a decision in
  // the record rather than whatever the register happens to compose today, and
  // so a reviewer can read the shipped wording without running the app.
  describe('COMPARISON_SCOPE_COPY — the sentence a user reads', () => {
    const scope = deriveComparisonScope(subsetOptions())!

    it('composes the draw-10 shape verbatim', () => {
      expect(COMPARISON_SCOPE_COPY.sentence(scope)).toBe(
        'Comparing 3 of your 4 options — Hybrid Phased Approach was left out.',
      )
      expect(COMPARISON_SCOPE_COPY.detail(scope)).toBe(
        'Ranks and comparative percentages describe those 3 only.',
      )
    })

    it('joins two excluded options in British house style (no serial comma)', () => {
      const two = deriveComparisonScope([...subsetOptions(), excluded(DROPPED_TWO, DROPPED_TWO_LABEL)])!
      expect(COMPARISON_SCOPE_COPY.sentence(two)).toBe(
        'Comparing 3 of your 5 options — Hybrid Phased Approach and Rip and Replace were left out.',
      )
    })

    it('falls back to the COUNT when no excluded option carries a usable label', () => {
      const unnamed = deriveComparisonScope([
        analysed(KEEP_A, 0.62),
        { label: '   ', notAnalysed: true },
      ])!
      expect(COMPARISON_SCOPE_COPY.sentence(unnamed)).toBe(
        'Comparing 1 of your 2 options — 1 was left out.',
      )
    })

    // ⚠ NEUTRALITY. The excluded option was never scored, so nothing here may
    // read as a verdict on it. A comparative verb would imply it was
    // considered and lost.
    it('claims nothing about the excluded option\'s merit', () => {
      const text = `${COMPARISON_SCOPE_COPY.sentence(scope)} ${COMPARISON_SCOPE_COPY.detail(scope)}`
      for (const verb of ['worse', 'lost', 'weaker', 'beaten', 'behind', 'ruled out', 'rejected']) {
        expect(text.toLowerCase()).not.toContain(verb)
      }
    })
  })

  /**
   * ⭐⭐ THE NAMES ARE BOUNDED, AND THE CLAUSE STOPS READING AS EXHAUSTIVE.
   *
   * Two defects, one cause, both measured before this block existed.
   *
   * 1. HONESTY. `excludedLabels` MAY BE SHORTER than `total - analysed` — an
   *    option with no usable label, or one labelled with its own node id, is
   *    dropped from the list. The clause then NAMED FIVE and said nothing about
   *    the other twenty-five, while reading as a complete list:
   *      "Comparing 1 of your 31 options — Alpha, Bravo, Charlie, Delta and
   *       Echo were left out."
   *    Thirty were left out. A reader takes the clause as exhaustive because
   *    nothing signals that it is partial.
   *
   * 2. LENGTH. The clause grew without limit. Measured in a real browser at
   *    280px inside the Analysis (New) dock: 229px tall at 3 excluded options,
   *    440px at 12, 741px at 30 — against a ~769px usable dock height. The note
   *    alone could consume the entire first viewport.
   *
   * ⛔ THE COUNT IS NOT CAPPED AND MUST NEVER BE. `phrase` carries "N of your M"
   * and is untouched by any of this — that is the ROADMAP 2.1340 guarantee.
   * Only the NAMES are bounded, and the overflow is counted from `total -
   * analysed`, NOT from `excludedLabels.length`, so unnameable options are
   * counted in it rather than vanishing.
   *
   * ⚠ THIS IS A DELIBERATE CHANGE TO THE EXISTING ANALYSIS TAB. Every excluded
   * option remains NAMED on every user-reachable surface that mounts this note:
   * `OptionCards` renders a `NotAnalysedOptionCard` for each one unconditionally
   * (its NO-RANK RULING appends them past the TOP_N truncation), and the
   * Analysis (New) glance names them behind its own disclosure. Capping here is
   * therefore a DISCLOSURE, not a drop. Derived at the bytes, not assumed.
   */
  describe('COMPARISON_SCOPE_COPY.excludedClause — bounded names, honest overflow', () => {
    /** `total`/`analysed` are the run's; `excludedLabels` only the nameable. */
    const scopeOf = (analysedCount: number, total: number, labels: string[]) =>
      ({ analysed: analysedCount, total, excludedLabels: labels }) as ReturnType<
        typeof deriveComparisonScope
      > & object

    it('the cap is 2, and moving it requires re-measuring rather than re-running this suite', () => {
      // ⭐⭐ THE ONE ASSERTION HERE THAT IS NOT DERIVED, AND THAT IS THE POINT.
      // Every other pin reads `EXCLUDED_LABEL_NAME_CAP`, so the constant and its
      // guards move together: a derived guard proves the copies AGREE, never
      // that the value is RIGHT (CLAUDE.md trap 12d). Measured: cap 3 -> 4 REDs
      // only one case here, and only by an arithmetic coincidence in its
      // fixture — not by design. This is the designed guard.
      //
      // The value's justification is a BROWSER MEASUREMENT at 280px, recorded on
      // the constant. jsdom cannot check that (trap 3), so what this pin does is
      // stop the cap drifting SILENTLY. Changing it means re-measuring.
      expect(EXCLUDED_LABEL_NAME_CAP).toBe(2)
    })

    it('names at most the cap, then counts the remainder', () => {
      const labels = Array.from({ length: 30 }, (_, i) => `Option ${i}`)
      const clause = COMPARISON_SCOPE_COPY.excludedClause(scopeOf(1, 31, labels))

      const named = labels.filter((l) => clause.includes(l))
      expect(named).toHaveLength(EXCLUDED_LABEL_NAME_CAP)
      // Bound to the FIRST n by identity — order is the producer's arrival order.
      expect(named).toEqual(labels.slice(0, EXCLUDED_LABEL_NAME_CAP))
      expect(clause).toContain(`${30 - EXCLUDED_LABEL_NAME_CAP} others`)
    })

    it('counts UNNAMEABLE options into the overflow rather than losing them', () => {
      // ⭐ THE HONESTY CASE. 30 left out, only 5 nameable. Before this change the
      // clause named all five and read as the complete list.
      const clause = COMPARISON_SCOPE_COPY.excludedClause(
        scopeOf(1, 31, ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo']),
      )
      // 30 missing − 3 named = 27, NOT 5 − 3 = 2. Deriving the overflow from the
      // label list would silently drop the 25 that carry no usable label.
      // PRECONDITION FIRST. Asserting only the correct figure would also pass if
      // the clause stopped rendering entirely; asserting only the absence of the
      // wrong one would pass on an empty string. Both, plus non-emptiness.
      expect(clause.length, 'the clause rendered nothing — both assertions below would be vacuous').toBeGreaterThan(20)
      expect(clause).toContain(`${30 - EXCLUDED_LABEL_NAME_CAP} others`)
      expect(clause).not.toContain(`${5 - EXCLUDED_LABEL_NAME_CAP} others`)
    })

    it('says nothing about others when every excluded option is named', () => {
      // The discriminating twin: a clause that ALWAYS appended an overflow would
      // pass both cases above while lying on the ordinary two-option run.
      const clause = COMPARISON_SCOPE_COPY.excludedClause(scopeOf(2, 4, ['Alpha', 'Bravo']))
      expect(clause).toBe('Alpha and Bravo were left out')
      expect(clause).not.toContain('other')
    })

    it('keeps singular agreement when exactly one more is unnamed', () => {
      // ⚠ DERIVED FROM THE CAP, not written as a literal. Two earlier drafts of
      // this case hardcoded the arithmetic and both broke the moment the cap
      // moved — once wrongly (I asserted "1 other" against an actual 2, and the
      // TEST was wrong, not the code). The construction below yields exactly one
      // unnamed option at any cap: 1 analysed + cap named + 1 other.
      const total = 1 + EXCLUDED_LABEL_NAME_CAP + 1
      const labels = Array.from({ length: EXCLUDED_LABEL_NAME_CAP + 1 }, (_, i) => `Label ${i}`)
      const clause = COMPARISON_SCOPE_COPY.excludedClause(scopeOf(1, total, labels))

      // PRECONDITION: the construction really does leave exactly one over, so
      // this case cannot pass by testing a different arithmetic than it names.
      expect(total - 1 - EXCLUDED_LABEL_NAME_CAP).toBe(1)
      expect(clause).toContain('1 other')
      expect(clause).not.toContain('1 others')
      expect(clause).toBe(
        `${labels.slice(0, EXCLUDED_LABEL_NAME_CAP).join(', ')} and 1 other were left out`.replace(
          /^([^,]+), and/,
          '$1 and',
        ),
      )
    })

    it('a capped note can never be the ONLY place an excluded option appears', () => {
      // ⭐⭐ THE PROPERTY THE WHOLE CAP RESTS ON, PINNED AS AN IMPLICATION rather
      // than left as a co-mount someone read in source once.
      //
      // Capping the NAMES is a disclosure and not a drop only because the option
      // cards name every excluded option on the same screen. A source reading
      // proves the code path EXISTS; it cannot prove the producer can never feed
      // one without the other. So the claim is derived instead from the two
      // conditions themselves:
      //
      //   note renders        <=>  deriveComparisonScope(...) !== null
      //                       =>   >=1 excluded AND >=1 analysed
      //                       =>   allOptions.length >= 2
      //   options block gates on  !isSingleOption && allOptions.length > 1
      //   and `useResultsSectionData:2211` sets isSingleOption = length <= 1
      //
      // so the note's own render condition IMPLIES the block's guard. The other
      // `isSingleOption: true` branch (:1719) is the no-run case and ships
      // `allOptions: []`, which makes the scope null — no note there either.
      //
      // This asserts the arithmetic half, which is the half that could silently
      // change: if `deriveComparisonScope` ever returned non-null for a set of
      // fewer than two options, the options block would be gated off while the
      // note still rendered, and the cap WOULD become a drop.
      const sets: OptionResult[][] = [
        [],
        [analysed(KEEP_A, 0.62)],
        [excluded(DROPPED, DROPPED_LABEL)],
        [excluded(DROPPED, DROPPED_LABEL), excluded(DROPPED_TWO, DROPPED_TWO_LABEL)],
        subsetOptions(),
        fullSetOptions(),
        [...subsetOptions(), excluded(DROPPED_TWO, DROPPED_TWO_LABEL)],
      ]

      let nonNull = 0
      for (const set of sets) {
        const scope = deriveComparisonScope(set)
        if (!scope) continue
        nonNull++
        // The guard `ResultsBody` uses, restated as the implication it must satisfy.
        expect(set.length, `a note would render over ${set.length} option(s)`).toBeGreaterThan(1)
        expect(set.length <= 1, 'isSingleOption would gate the option cards off').toBe(false)
      }
      // POSITIVE CONTROL — a loop that never entered its body would pass this
      // test while asserting nothing at all (trap 13).
      expect(nonNull, 'no set produced a scope — this implication is vacuous').toBeGreaterThan(0)
    })

    it('the COUNT is never capped — the phrase still states the whole run', () => {
      // ⛔ The 2.1340 guarantee, pinned against this cap.
      const scope = scopeOf(1, 31, Array.from({ length: 30 }, (_, i) => `Option ${i}`))
      expect(COMPARISON_SCOPE_COPY.phrase(scope)).toBe('Comparing 1 of your 31 options')
      expect(COMPARISON_SCOPE_COPY.sentence(scope)).toContain('Comparing 1 of your 31 options')
    })

    it('leaves the no-usable-label fallback exactly as it was', () => {
      // The pre-existing path must not acquire an overflow clause of its own.
      expect(COMPARISON_SCOPE_COPY.excludedClause(scopeOf(1, 31, []))).toBe('30 were left out')
      expect(COMPARISON_SCOPE_COPY.excludedClause(scopeOf(3, 4, []))).toBe('1 was left out')
    })
  })

  describe('deriveComparisonScope — the derivation, at its own boundaries', () => {
    it('is null when nothing was excluded', () => {
      expect(deriveComparisonScope(fullSetOptions())).toBeNull()
    })

    it('is null when NOTHING was analysed (no comparative numbers to qualify)', () => {
      expect(
        deriveComparisonScope([excluded(DROPPED, DROPPED_LABEL), excluded(DROPPED_TWO, DROPPED_TWO_LABEL)]),
      ).toBeNull()
    })

    it('is null on an empty run', () => {
      expect(deriveComparisonScope([])).toBeNull()
      expect(deriveComparisonScope(null)).toBeNull()
    })

    it('counts the flag it is given and reports labels in arrival order', () => {
      const scope = deriveComparisonScope([...subsetOptions(), excluded(DROPPED_TWO, DROPPED_TWO_LABEL)])
      expect(scope).toEqual({
        analysed: 3,
        total: 5,
        excludedLabels: [DROPPED_LABEL, DROPPED_TWO_LABEL],
      })
    })

    // ⛔ THE ID LEAK. `useResultsSectionData` sets
    // `label: node.data?.label || nodeId`, so an unlabelled option arrives
    // carrying its own id as a well-formed string. Without the guard the
    // sentence under the hero reads "— 79b5d7c0 was left out.", i.e. a raw
    // internal identifier presented to a user as the name of their option.
    it('never names an option by its own node id', () => {
      const scope = deriveComparisonScope([
        analysed(KEEP_A, 0.62),
        { id: '79b5d7c0', label: '79b5d7c0', notAnalysed: true },
      ])
      expect(scope).toEqual({ analysed: 1, total: 2, excludedLabels: [] })
      expect(COMPARISON_SCOPE_COPY.sentence(scope!)).toBe(
        'Comparing 1 of your 2 options — 1 was left out.',
      )
      expect(COMPARISON_SCOPE_COPY.sentence(scope!)).not.toContain('79b5d7c0')
    })

    // CONTRAST CONTROL — the guard rejects a label that IS the id, and must
    // not reject a real label that merely sits beside one (trap 13e).
    it('CONTRAST — a genuine label on an option with an id is still named', () => {
      const scope = deriveComparisonScope([
        analysed(KEEP_A, 0.62),
        { id: '79b5d7c0', label: DROPPED_LABEL, notAnalysed: true },
      ])
      expect(scope!.excludedLabels).toEqual([DROPPED_LABEL])
    })

    it('reports the COUNT rather than inventing a name when a label is unusable', () => {
      const scope = deriveComparisonScope([
        analysed(KEEP_A, 0.62),
        { label: '   ', notAnalysed: true },
      ])
      expect(scope).toEqual({ analysed: 1, total: 2, excludedLabels: [] })
    })
  })
})

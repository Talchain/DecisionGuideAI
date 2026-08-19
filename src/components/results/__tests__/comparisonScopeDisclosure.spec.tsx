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
import { COMPARISON_SCOPE_COPY, deriveComparisonScope } from '../utils/goalAnchorCopy'
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

    // ⭐ THE DISCRIMINATING PIN. `probability_of_goal` is subset-INVARIANT per
    // ISL's own response builder, so the goal block must NOT carry this
    // qualification. A note rendered everywhere passes every other assertion
    // in this file and fails only here.
    it('does NOT qualify the goal block — goal fit is subset-invariant', () => {
      const options = subsetOptions()
      render(
        <WinGauge
          shares={gaugeShares(options)}
          comparisonScope={deriveComparisonScope(options)}
          goalThreshold={0.5}
        />,
      )
      const goalBlock = screen.queryByTestId('win-gauge-goal-block')
      if (goalBlock) {
        expect(within(goalBlock).queryByTestId(NOTE.gauge)).toBeNull()
      }
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

    it('reports the COUNT rather than inventing a name when a label is unusable', () => {
      const scope = deriveComparisonScope([
        analysed(KEEP_A, 0.62),
        { label: '   ', notAnalysed: true },
      ])
      expect(scope).toEqual({ analysed: 1, total: 2, excludedLabels: [] })
    })
  })
})

/**
 * ⭐⭐ WIN SHARES FOLLOW THE LEADER CLAIM on the ANALYSIS TAB — CURRENT-READ-v1 row 9 (AIQ #75 5912710392),
 * replayed on the Run Paul actually saw (4276f3f9, `helpers/paulRun4276f3f9.ts`).
 *
 * The Run withheld the leader (`leader_claim.permitted: false`, `constraint_verdict_withheld`), yet the options
 * panel printed Convertible bridge 80% / Angel bridge 13% / Current outreach 7%, as a stacked bar, a legend, a
 * header figure and a fill bar on each card. A share that singles one option out names the leader in numbers.
 *
 * Surfaces (each read through `canvas/state/winShareGate`, never a re-implementation):
 *   · WinGauge — the comparative block becomes the reason line, once, for the whole options panel.
 *   · OptionCards — no header %, no fill bar, no leader sentence (the panel's reason line already sits above).
 *   · ConditionalWinnerCards — no bucket %; the reason line once.
 *   · useResultsSectionData — publishes the flag and the line (the hero reads them from here).
 *
 * The harness mounts WinGauge and OptionCards with the SAME props `ResultsBody.tsx` gives them (the `shares`
 * map, `designationsWithheld`, `hasLeadingOption`), from the product hook over the served Run.
 *
 * AIQ's three rows per surface:
 *   1. 4276f3f9 → 0 option percentages, and the reason line;
 *   2. CONTROL: `{permitted: true}` still shows the shares (Convertible bridge "80%");
 *   3. CONTROL: another cause (`separation_unavailable`) also hides them, in that cause's own words.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { useResultsSectionData } from '../useResultsSectionData'
import { WinGauge } from '../WinGauge'
import { OptionCards } from '../OptionCards'
import { ConditionalWinnerCards } from '../ConditionalWinnerCards'
import { leaderDesignationPermitted } from '../leaderDesignation'
import { leaderClaimWithheld } from '../analysisClaimPolicy'
import { deriveComparisonScope } from '../utils/goalAnchorCopy'
import { leaderWithholdCause } from '../analysisNew/analysisNewCopy'
import { EXPLORATORY_REASON_LINE } from '../../../canvas/state/winShareGate'
import type { ConditionalWinner } from '../types'
import {
  CONVERTIBLE, OTHER_CAUSE_STAMP, PERMITTED_STAMP, SCORED, SERVED_STAMP, report, resetPaulRun, seedPaulRun,
} from './helpers/paulRun4276f3f9'

const PANEL = 'options-panel-under-test'
const OTHER_CAUSE_WORDS = leaderWithholdCause('separation_unavailable')

/** Everything a person can perceive as text: visible text, plus the aria-labels and titles that carry figures. */
function perceivable(root: HTMLElement): string {
  const attrs = Array.from(root.querySelectorAll('[aria-label],[title]'))
    .flatMap((el) => [el.getAttribute('aria-label') ?? '', el.getAttribute('title') ?? ''])
  return [root.textContent ?? '', ...attrs].join(' | ')
}
const PERCENT = /\d+(?:\.\d+)?\s*%/g
const countOf = (hay: string, needle: string) => hay.split(needle).length - 1

function hookData() {
  return renderHook(() => useResultsSectionData()).result.current
}

/** The options panel exactly as `ResultsBody.tsx` mounts it (WinGauge then OptionCards). */
function renderOptionsPanel() {
  const data = hookData()
  const rec = data.recommendation
  render(
    <div data-testid={PANEL}>
      <WinGauge
        shares={rec.allOptions
          .filter((o): o is typeof o & { winProbability: number } => typeof o.winProbability === 'number')
          .map((o) => ({
            id: o.id, label: o.label, winProbability: o.winProbability, isWinner: o.isRecommended,
            goalProbability: o.goalProbability, nValidSamples: o.nValidSamples,
            goalFitIsSubstitutedJoint: o.goalFitIsSubstitutedJoint, goalFitWithheld: o.goalFitWithheld,
          }))}
        designationsWithheld={leaderDesignationPermitted(rec) === false}
        goalThreshold={rec.goalThreshold}
        comparisonScope={deriveComparisonScope(rec.allOptions)}
      />
      <OptionCards
        options={rec.allOptions}
        winnerId={rec.recommendedOption?.id}
        hasLeadingOption={leaderDesignationPermitted(rec)}
        hasGoalThreshold={rec.goalThreshold != null}
        storyHeadlines={rec.storyHeadlines}
        leadingOptionDownsideFlag={rec.leadingOptionDownsideFlag}
      />
    </div>,
  )
  // Show every card, so no share hides behind "Show all".
  const toggle = screen.queryByTestId('option-cards-toggle')
  if (toggle) fireEvent.click(toggle)
  return { panel: screen.getByTestId(PANEL), data }
}

afterEach(() => {
  cleanup()
  resetPaulRun()
})

describe('preconditions — the served Run, through the product hook', () => {
  it('the hook builds the three scored options with their shares; nothing carries a goal figure', () => {
    seedPaulRun(SERVED_STAMP)
    const rec = hookData().recommendation
    const scored = rec.allOptions.filter((o) => typeof o.winProbability === 'number').map((o) => o.id).sort()
    expect(scored).toEqual(SCORED.map((o) => o.id).sort())
    expect(rec.allOptions.find((o) => o.id === CONVERTIBLE)?.winProbability).toBeCloseTo(0.7966, 3)
    // The goal chance is governed separately; on this Run no option carries one, so every % on the options
    // panel is a win share.
    expect(rec.allOptions.every((o) => o.goalProbability == null)).toBe(true)
    expect(SERVED_STAMP).toMatchObject({ permitted: false, producer_cause: 'constraint_verdict_withheld' })
  })
})

describe('useResultsSectionData publishes the gate (read by the hero)', () => {
  it('ROW 1: withheld, with the exploratory line', () => {
    seedPaulRun(SERVED_STAMP)
    const data = hookData()
    expect(data.winSharesWithheld).toBe(true)
    expect(data.winShareWithheldReason).toBe(EXPLORATORY_REASON_LINE)
  })
  it('ROW 2 CONTROL: permitted ⇒ not withheld, no line', () => {
    seedPaulRun(PERMITTED_STAMP)
    const data = hookData()
    expect(data.winSharesWithheld).toBe(false)
    expect(data.winShareWithheldReason).toBeNull()
  })
  it('ROW 3 CONTROL: another cause ⇒ withheld, in that cause\'s words', () => {
    seedPaulRun(OTHER_CAUSE_STAMP)
    const data = hookData()
    expect(data.winSharesWithheld).toBe(true)
    expect(OTHER_CAUSE_WORDS).not.toBeNull()
    expect(data.winShareWithheldReason).toBe(OTHER_CAUSE_WORDS)
  })
})

describe('CURRENT-READ row 9 — the options panel (WinGauge + OptionCards)', () => {
  it('⭐ ROW 1 (Paul\'s 4276f3f9): 0 option percentages anywhere on the panel, and the exploratory reason line once', () => {
    seedPaulRun(SERVED_STAMP)
    const { panel } = renderOptionsPanel()
    expect(perceivable(panel).match(PERCENT)).toBeNull()
    // Per surface, bound by identity.
    for (const o of SCORED) {
      expect(screen.queryByTestId(`legend-pct-${o.id}`)).toBeNull()
      expect(screen.queryByTestId(`win-pct-${o.id}`)).toBeNull()
    }
    expect(screen.queryByTestId('win-gauge-comparative-heading')).toBeNull()
    // The reason line, once for the panel, in the gauge's comparative slot.
    expect(screen.getByTestId('win-gauge-win-shares-withheld').textContent).toBe(EXPLORATORY_REASON_LINE)
    expect(countOf(panel.textContent ?? '', EXPLORATORY_REASON_LINE)).toBe(1)
  })

  it('⭐ ROW 2 — CONTROL: a PERMITTED Run still shows its shares (Convertible bridge 80%) and no reason line', () => {
    seedPaulRun(PERMITTED_STAMP)
    const { panel } = renderOptionsPanel()
    expect(screen.getByTestId(`legend-pct-${CONVERTIBLE}`).textContent).toBe('80%')
    expect(screen.getByTestId(`win-pct-${CONVERTIBLE}`).textContent).toBe('80%')
    expect(screen.getByTestId('win-gauge-comparative-heading')).toBeTruthy()
    expect(screen.queryByTestId('win-gauge-win-shares-withheld')).toBeNull()
    expect(panel.textContent).not.toContain(EXPLORATORY_REASON_LINE)
  })

  it('⭐ ROW 3 — CONTROL: a Run withheld for ANOTHER reason hides every share too, in that reason\'s own words', () => {
    seedPaulRun(OTHER_CAUSE_STAMP)
    const { panel } = renderOptionsPanel()
    expect(perceivable(panel).match(PERCENT)).toBeNull()
    expect(screen.queryByTestId(`win-pct-${CONVERTIBLE}`)).toBeNull()
    expect(screen.getByTestId('win-gauge-win-shares-withheld').textContent).toBe(OTHER_CAUSE_WORDS)
    expect(panel.textContent).not.toContain(EXPLORATORY_REASON_LINE)
  })
})

describe('CURRENT-READ row 9 — OptionCards on its own (no gauge above it)', () => {
  const renderCards = () => {
    const rec = hookData().recommendation
    render(
      <OptionCards
        options={rec.allOptions}
        winnerId={CONVERTIBLE}
        // The leader sentence's own arm: a caller that still hands the card a leader and a permission must not
        // get "Supported in 80% of simulated scenarios" on a withheld Run.
        hasLeadingOption
        decisionState="robust"
      />,
    )
    const toggle = screen.queryByTestId('option-cards-toggle')
    if (toggle) fireEvent.click(toggle)
    return screen.getByTestId('option-cards')
  }

  it('ROW 1: no header %, no fill bar, no leader sentence', () => {
    seedPaulRun(SERVED_STAMP)
    const cards = renderCards()
    expect(perceivable(cards).match(PERCENT)).toBeNull()
    expect(cards.textContent).not.toMatch(/supported in/i)
  })

  it('ROW 2 CONTROL: permitted keeps the header %, the fill bar and the leader sentence', () => {
    seedPaulRun(PERMITTED_STAMP)
    const cards = renderCards()
    expect(screen.getByTestId(`win-pct-${CONVERTIBLE}`).textContent).toBe('80%')
    expect(cards.querySelector(`[title*="80%"]`)).not.toBeNull()
    expect(cards.textContent).toMatch(/supported in 80% of simulated scenarios/i)
  })

  it('ROW 3 CONTROL: another cause hides them too', () => {
    seedPaulRun(OTHER_CAUSE_STAMP)
    const cards = renderCards()
    expect(perceivable(cards).match(PERCENT)).toBeNull()
  })
})

/**
 * ConditionalWinnerCards. The served Run carried `conditional_winners: []`, so the ROW is constructed; the
 * PERMISSION and the shares are Paul's (his report's stamp; bucket shares = his Run's Convertible bridge and Angel
 * bridge figures). Buckets carry no identity, as CEE's withheld-claim projection ships them: that is the shape
 * whose "Above: 80%" survived the existing label filter.
 */
describe('CURRENT-READ row 9 — ConditionalWinnerCards', () => {
  const share = (id: string) => report.option_probabilities[id].win_probability!
  const ROW: ConditionalWinner = {
    factor_label: 'Existing supporter outreach',
    factor_id: 'fac_existing_supporter_outreach',
    split_value: 0.5,
    high_bucket: { win_probability: share(CONVERTIBLE) },
    low_bucket: { win_probability: share('angel_bridge') },
    winner_flips: true,
  }
  const renderCw = () => {
    const rec = hookData().recommendation
    render(<ConditionalWinnerCards winners={[ROW]} useV17Copy mayNameLeader={!leaderClaimWithheld(rec)} />)
    return screen.getByTestId('conditional-winner-cards')
  }

  it('ROW 1: no bucket %, and the exploratory reason line once', () => {
    seedPaulRun(SERVED_STAMP)
    const cw = renderCw()
    expect(perceivable(cw).match(PERCENT)).toBeNull()
    expect(countOf(cw.textContent ?? '', EXPLORATORY_REASON_LINE)).toBe(1)
    // The science stays: the factor, the threshold, the flip.
    expect(cw.textContent).toContain('Existing supporter outreach')
  })

  it('ROW 2 CONTROL: permitted keeps the bucket shares', () => {
    seedPaulRun(PERMITTED_STAMP)
    const cw = renderCw()
    expect(cw.textContent).toContain('Above: 80%')
    expect(cw.textContent).not.toContain(EXPLORATORY_REASON_LINE)
  })

  it('ROW 3 CONTROL: another cause hides them too, in its own words', () => {
    seedPaulRun(OTHER_CAUSE_STAMP)
    const cw = renderCw()
    expect(perceivable(cw).match(PERCENT)).toBeNull()
    expect(cw.textContent).toContain(OTHER_CAUSE_WORDS!)
  })
})

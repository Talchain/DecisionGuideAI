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
 *
 * #2747 re-scope 2 (U0, DL ruling (A)): WinGauge is deleted and NO win share is shown in C, permitted or not. The panel
 * is now OptionCards alone (as `ResultsBody` mounts it); its permitted-Run controls pin the ABSENCE of any share; the
 * gauge's own assertions (legend, heading, its reason-line slot) are deleted with it; ConditionalWinnerCards' bucket
 * share assertion is deleted (off U0). The hook's gate rows are unchanged.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { useResultsSectionData } from '../useResultsSectionData'
import { OptionCards } from '../OptionCards'
import { ConditionalWinnerCards } from '../ConditionalWinnerCards'
import { leaderDesignationPermitted } from '../leaderDesignation'
import { leaderClaimWithheld } from '../analysisClaimPolicy'
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

/**
 * The options panel exactly as `ResultsBody.tsx` mounts it. #2747 re-scope 2 (U0, DL ruling (A)): WinGauge no longer sits
 * above the cards (deleted in C), so the panel is OptionCards alone.
 */
function renderOptionsPanel() {
  const data = hookData()
  const rec = data.recommendation
  render(
    <div data-testid={PANEL}>
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

describe('CURRENT-READ row 9 — the options panel (OptionCards; WinGauge deleted in #2747 re-scope 2)', () => {
  // #2747 re-scope 2 (DL ruling (A)): title lost ', and the exploratory reason line once' — that line sat in the gauge's slot.
  it('⭐ ROW 1 (Paul\'s 4276f3f9): 0 option percentages anywhere on the panel', () => {
    seedPaulRun(SERVED_STAMP)
    const { panel } = renderOptionsPanel()
    expect(perceivable(panel).match(PERCENT)).toBeNull()
    // Per surface, bound by identity.
    for (const o of SCORED) {
      expect(screen.queryByTestId(`legend-pct-${o.id}`)).toBeNull()
      expect(screen.queryByTestId(`win-pct-${o.id}`)).toBeNull()
    }
    expect(screen.queryByTestId('win-gauge-comparative-heading')).toBeNull()
    // #2747 re-scope 2 (DL ruling (A)): the reason-line assertions (the gauge's comparative slot, once for the panel)
    // deleted — their only subject, WinGauge, was removed in C.
  })

  // #2747 re-scope 2 (U0, DL ruling (A)): was '⭐ ROW 2 — CONTROL: a PERMITTED Run still shows its shares (Convertible bridge
  // 80%) and no reason line'. In C no share is shown even on a permitted Run; the legend/heading assertions went with WinGauge.
  it('⭐ ROW 2 — a PERMITTED Run shows NO share in C either (no Convertible bridge 80%), and no reason line', () => {
    seedPaulRun(PERMITTED_STAMP)
    const { panel } = renderOptionsPanel()
    expect(screen.getByTestId(`option-card-${CONVERTIBLE}`)).toBeTruthy()
    expect(screen.queryByTestId(`win-pct-${CONVERTIBLE}`)).toBeNull()
    expect(perceivable(panel)).not.toContain('80%')
    expect(perceivable(panel).match(PERCENT)).toBeNull()
    expect(screen.queryByTestId('win-gauge-win-shares-withheld')).toBeNull()
    expect(panel.textContent).not.toContain(EXPLORATORY_REASON_LINE)
  })

  // #2747 re-scope 2 (DL ruling (A)): title lost ', in that reason's own words' — those words sat in the gauge's slot.
  it('⭐ ROW 3 — CONTROL: a Run withheld for ANOTHER reason hides every share too', () => {
    seedPaulRun(OTHER_CAUSE_STAMP)
    const { panel } = renderOptionsPanel()
    expect(perceivable(panel).match(PERCENT)).toBeNull()
    expect(screen.queryByTestId(`win-pct-${CONVERTIBLE}`)).toBeNull()
    // #2747 re-scope 2 (DL ruling (A)): the gauge-slot reason-line assertion deleted with WinGauge.
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

  // #2747 re-scope 2 (U0, DL ruling (A)): was 'ROW 2 CONTROL: permitted keeps the header %, the fill bar and the leader
  // sentence'. In C a permitted card keeps the leader sentence, with no magnitude, and shows no header % and no fill bar.
  // Run-4 judge, BLOCKING (DL 12 Oct): a permitted card makes no win-share leader sentence either; the control is that the
  // permitted card still renders (the cards are not blanked), with no header %, no fill bar and no "than any other option".
  it('ROW 2 CONTROL: permitted renders the cards with no leader sentence; no header %, no fill bar', () => {
    seedPaulRun(PERMITTED_STAMP)
    const cards = renderCards()
    expect(screen.queryByTestId(`win-pct-${CONVERTIBLE}`)).toBeNull()
    expect(cards.querySelector(`[title*="80%"]`)).toBeNull()
    expect(screen.getByTestId(`option-card-${CONVERTIBLE}`)).toBeDefined()
    expect(cards.textContent).not.toMatch(/than any other option/i)
    expect(cards.textContent).not.toMatch(/supported in 80% of simulated scenarios/i)
    expect(perceivable(cards).match(PERCENT)).toBeNull()
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

  // #2747 re-scope 2 (DL ruling (A)): the 'Above: 80%' bucket-share assertion deleted — no bucket win share is said in C
  // (ConditionalWinnerCards is off U0). The permitted Run's no-reason-line assertion stays.
  it('ROW 2 CONTROL: permitted says no reason line', () => {
    seedPaulRun(PERMITTED_STAMP)
    const cw = renderCw()
    expect(cw.textContent).not.toContain(EXPLORATORY_REASON_LINE)
  })

  it('ROW 3 CONTROL: another cause hides them too, in its own words', () => {
    seedPaulRun(OTHER_CAUSE_STAMP)
    const cw = renderCw()
    expect(perceivable(cw).match(PERCENT)).toBeNull()
    expect(cw.textContent).toContain(OTHER_CAUSE_WORDS!)
  })
})

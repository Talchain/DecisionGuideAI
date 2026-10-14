/**
 * ⭐ CUT 6 — THE LEADER-FRAMING CLASS, SAID AS RUN SHARES (WORDING BATCH; DL lease; Science d5 #87 6007954023 + 6007969474).
 *
 * Olumi names no contest ("there is never a winner"), and a share of runs is never a chance (CLAUDE.md, 6 Oct: the
 * per-option headline is the chance of meeting the goal; the share of runs is supporting detail, never presented as a
 * chance). These lines said "which option leads", "the leading option", "led", "chance of coming out ahead" and "Chance
 * the leading option changes" — now they say what the model measured: the most-supported option, and shares of runs.
 *
 * Exact-string rows pin each new line; the scan rows pin the class (no contest verb, no "chance" on a run share). The
 * contest half is also swept by `noContestFraming.canvas.spec.ts`, whose SCOPE_FILES now name these files. The hero
 * caption rows live in `analysis-hero/__tests__/wordingBatch.mostSupportedOption.hero.spec.ts` (hero inertness guard).
 */
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'

import { getStabilityClassification } from '../../../lib/stability'
import { ConditionalWinnerCards } from '../ConditionalWinnerCards'
import { ASSUMED_STRENGTH_REFUSAL_COPY } from '../strengthElicitation/assumedStrengthCopy'
import type { ConditionalWinner } from '../types'

const CONTEST = /\b(lead|leads|leading|led|leader|ahead|winner|wins?|best|beats?|overtake)\b/i

describe('stability classification: the most-supported option, never who leads', () => {
  // Run-4 judge (DL 12 Oct, the class): `heroExpandedText` and `coaching` ("The most-supported option was the same /
  // changed …") are removed from the classification; nothing replaces them. The exact-line rows became "the field is
  // gone" rows, one per level.
  it.each([0.9, 0.75, 0.5, 0.2])('stability %s → no heroExpandedText and no coaching field', (stability) => {
    const c = getStabilityClassification(stability)
    expect(c, 'PRECONDITION: a classification exists').not.toBeNull()
    expect('heroExpandedText' in c!).toBe(false)
    expect('coaching' in c!).toBe(false)
  })

  it('SCAN: no level says who leads (every served text field, every level)', () => {
    const fields: string[] = []
    for (const s of [0.9, 0.75, 0.5, 0.2]) {
      const c = getStabilityClassification(s)!
      // Run-4 judge (DL 12 Oct, the class): heroExpandedText / coaching are gone; the remaining text fields are scanned.
      fields.push(c.heroLabel, c.heroShortText, c.badgeLabel)
    }
    expect(fields.length, 'magnitude: the scan read every level').toBeGreaterThanOrEqual(12)
    for (const f of fields) expect(f, f).not.toMatch(CONTEST)
    for (const f of fields) expect(f, f).not.toMatch(/most[- ]supported|more runs|most runs/i)
  })

  it('POSITIVE CONTROL: the lines served before are caught by the same scan', () => {
    for (const before of [
      'The same option led in nearly every scenario we sampled. Individual estimates can still be off.',
      'The leading option was the same in most of the scenarios we sampled. A few edge cases could change it.',
      'Which option leads changed across the scenarios we sampled. Review key inputs.',
    ]) expect(before).toMatch(CONTEST)
  })
})

describe('conditional-winner cards: the header help names no contest', () => {
  const row: ConditionalWinner = {
    factor_label: 'Market growth',
    factor_id: 'fac_growth',
    split_value: 42.5,
    split_unit: '%',
    winner_flips: true,
    high_bucket: { winner_id: 'opt_expand', winner_label: 'Expand into Europe', runner_up_id: 'opt_hold', runner_up_label: 'Hold position', win_probability: 0.7 },
    low_bucket: { winner_id: 'opt_hold', winner_label: 'Hold position', runner_up_id: 'opt_expand', runner_up_label: 'Expand into Europe', win_probability: 0.6 },
  }

  it('v17 copy: "Factors that change the result when they shift" (no most-supported option)', () => {
    const { container } = render(<ConditionalWinnerCards winners={[row]} recommendedOptionId="opt_expand" useV17Copy />)
    const cards = container.querySelector('[data-testid="conditional-winner-cards"]')
    expect(cards, 'PRECONDITION: the cards render').not.toBeNull()
    // Run-4 judge (DL 12 Oct, the class): "Factors that change the most-supported option when they shift" is removed;
    // every run takes the neutral header.
    expect(cards!.textContent).not.toContain('Factors that change the most-supported option when they shift')
    expect(cards!.textContent).toContain('Factors that change the result when they shift')
    expect(cards!.textContent).not.toContain('which option leads')
  })
})

describe('no fragile relationship: plain words, not "measured weak-link rate" (red team, #2548 witness)', () => {
  it('exact', () => {
    expect(ASSUMED_STRENGTH_REFUSAL_COPY.no_fragile_edges).toBe(
      'In this run, no link’s assumed strength changed how the options compare often enough to show here.')
    expect(ASSUMED_STRENGTH_REFUSAL_COPY.no_fragile_edges).not.toMatch(/weak-link|surface here/i)
    // Science 393023, 7 Oct: it must not presuppose a most-supported option (a withheld-leader Run has none).
    expect(ASSUMED_STRENGTH_REFUSAL_COPY.no_fragile_edges).not.toMatch(/most[- ]supported|leader|leads|ahead|best/i)
  })
})

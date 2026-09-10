/**
 * The severity channel says the same thing on BOTH surfaces, and this file
 * pins what it SAYS — not merely that the two agree.
 *
 * ## Why this exists, and why the sibling spec was not enough
 *
 * `coachingLineSeverityChannel.spec.tsx` proves the collapsed line draws what
 * the full card draws. It does that by computing its expectation from
 * `reviewSeverityVisual` — the same function the component calls. That is the
 * right target for a consumer-agreement test and it has a real blind spot,
 * found by the reviewer of #1463 rather than by me:
 *
 *   ⛔ CHANGE `REVIEW_SEVERITY_TINT.warning` TO `'text-info'` AND THAT SPEC
 *   STAYS GREEN. Both surfaces would agree, on the wrong colour — a warning
 *   review card silently rendered as routine, which is the EXACT defect #1463
 *   was opened to remove, reachable again through the shared module.
 *
 * The sibling spec still catches a collapse to a flat channel (its
 * `warning !== info` assertion), so the module cannot go uniform. What was
 * unpinned on both surfaces is a WRONG-BUT-DISTINCT tint. No card-side spec
 * closed it either: `V5Phase3Blocks.spec.tsx` asserts `data-severity`
 * attributes, which are the block's own field echoed back, not the channel.
 *
 * ## So the expectations below are LITERAL and are written out by hand
 *
 * Deliberately. Deriving them from `REVIEW_SEVERITY_TINT`, from
 * `reviewSeverityVisual`, or from any export of the module under test would
 * reproduce the blind spot one file along. These strings are the design
 * system's, and if the module stops agreeing with them the module is wrong.
 */
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { V5ReviewCardBlock } from '../V5ReviewCardBlock'
import { adaptTypedReviewCardBlock } from '../../phase3TypedBlocks'
import type { V5ReviewCardBlock as V5ReviewCardBlockType } from '../../../canvas/conversation/types'
import capture from '../../__tests__/fixtures/live-analysis-turn-walkA-2026-08-04.json'

/**
 * The DS three-channel mapping for a review card's severity, written out.
 * `info` is the only severity that reads as an idea rather than a caution, so
 * it alone takes the lightbulb.
 */
const EXPECTED = {
  info: { glyph: 'lucide-lightbulb', tint: 'text-info', border: 'border-info/30' },
  warning: { glyph: 'lucide-alert-triangle', tint: 'text-warning', border: 'border-warning/30' },
  critical: { glyph: 'lucide-alert-triangle', tint: 'text-danger', border: 'border-danger/30' },
} as const

/** A real captured review card, re-severitied — the surrounding fields stay the producer's. */
function cardAt(severity: keyof typeof EXPECTED): V5ReviewCardBlockType {
  const raw = ((capture as { blocks?: Array<Record<string, unknown>> }).blocks ?? []).find(
    (b) => b.type === 'review_card',
  )
  const adapted = adaptTypedReviewCardBlock(raw)
  if (!adapted) throw new Error('capture carries no adaptable review_card')
  return { ...adapted, severity }
}

describe('the card draws the severity the design system specifies', () => {
  /**
   * PRECONDITION, pinned in-test: the capture really yields an adaptable card,
   * so a fixture change cannot leave the assertions below passing vacuously.
   */
  it('the dated capture still yields an adaptable review card', () => {
    expect(cardAt('info').title.length).toBeGreaterThan(0)
  })

  for (const severity of ['info', 'warning', 'critical'] as const) {
    it(`${severity} → ${EXPECTED[severity].glyph} in ${EXPECTED[severity].tint}, border ${EXPECTED[severity].border}`, () => {
      const { container } = render(<V5ReviewCardBlock block={cardAt(severity)} />)
      const root = container.querySelector('[data-testid="v5-review-card"]')
      const icon = container.querySelector('[data-testid="v5-review-card"] svg')

      expect(icon, 'no icon rendered').toBeTruthy()
      const iconClass = icon?.getAttribute('class') ?? ''
      expect(iconClass, 'glyph').toContain(EXPECTED[severity].glyph)
      expect(iconClass, 'tint').toContain(EXPECTED[severity].tint)
      expect(root?.getAttribute('class') ?? '', 'border').toContain(EXPECTED[severity].border)
    })
  }

  /**
   * The channel DISCRIMINATES. Without this, three assertions that each named
   * the same class would pass while the channel said nothing — and a flat
   * channel is the original defect, not a lesser one.
   */
  it('the three severities are mutually distinguishable, not three names for one look', () => {
    const seen = (['info', 'warning', 'critical'] as const).map((s) => {
      const { container } = render(<V5ReviewCardBlock block={cardAt(s)} />)
      const icon = container.querySelector('[data-testid="v5-review-card"] svg')
      const root = container.querySelector('[data-testid="v5-review-card"]')
      return `${icon?.getAttribute('class')}|${root?.getAttribute('class')}`
    })
    expect(new Set(seen).size, 'two severities render identically').toBe(3)
  })
})

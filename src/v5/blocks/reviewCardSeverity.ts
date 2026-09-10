/**
 * reviewCardSeverity — THE single authority on how a `v5_review_card`'s
 * `severity` becomes a visual channel.
 *
 * ## Why this is its own module
 *
 * The mapping used to be two module-private consts inside
 * `V5ReviewCardBlock.tsx`, which was fine while the card was the only surface
 * that drew a review card. #1450 added a second one — the collapsed coaching
 * line — and it did NOT consume this mapping. It took its icon from the block's
 * guidance `category` instead, and `adaptTypedReviewCardBlock` does not carry
 * `category` at all (a review card has `severity`; only `v5_coaching` has a
 * category). So `blockCategory` returned null on every review card and every
 * line drew the same `Lightbulb` in `text-info`.
 *
 * ⛔ THE CONSEQUENCE WAS NOT COSMETIC AND IT WAS LIVE, NOT LATENT. On
 * `live-analysis-turn-walkA-2026-08-04` the card titled "How robust is this?"
 * carries `severity: 'warning'` among four `info`s — and collapsed, it was
 * indistinguishable from them. The turn's one warning read as routine. A
 * second dated capture (`live-analysis-turn-no-critiques-2026-08-08`) carries
 * the same 5-info/1-warning shape, so this reproduces rather than being one
 * capture's quirk.
 *
 * Copying the two consts to the line would have fixed the pixels and left a
 * hand-maintained mirror to drift at the next severity value. One exported
 * resolver, both callers, no mirror.
 *
 * ## What this does NOT do
 *
 * It emits no COPY. `V5ReviewCardBlock`'s contract is explicit that the UI adds
 * "NO severity copy", and that holds here: severity reaches the screen as glyph
 * and tint only. The collapsed line therefore shows no severity chip — and it
 * shows no CATEGORY chip either, because a review card genuinely sends no
 * category and inventing one would be a UI fabrication.
 */
import { AlertTriangle, Lightbulb } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { V5ReviewCardBlock as V5ReviewCardBlockType } from '../../canvas/conversation/types'

export type ReviewSeverity = V5ReviewCardBlockType['severity']

/**
 * Border tint. Exported as a record because the card applies it inside a
 * longer className expression; the line does not draw a border at all.
 */
export const REVIEW_SEVERITY_BORDER: Record<ReviewSeverity, string> = {
  info: 'border-info/30',
  warning: 'border-warning/30',
  critical: 'border-danger/30',
}

const REVIEW_SEVERITY_TINT: Record<ReviewSeverity, string> = {
  info: 'text-info',
  warning: 'text-warning',
  critical: 'text-danger',
}

export interface ReviewSeverityVisual {
  Icon: LucideIcon
  /** Text-colour utility for the glyph. */
  tintClass: string
  /** Border-colour utility, for surfaces that draw one. */
  borderClass: string
}

/**
 * The glyph/tint pair for a review card's severity.
 *
 * `info` is the only severity that reads as an idea rather than a caution, so
 * it alone takes `Lightbulb`; `warning` and `critical` take `AlertTriangle` and
 * are separated by tint. That is the card's existing behaviour, moved rather
 * than redesigned — this module changes WHERE the mapping lives, never what it
 * says.
 */
export function reviewSeverityVisual(severity: ReviewSeverity): ReviewSeverityVisual {
  return {
    Icon: severity === 'info' ? Lightbulb : AlertTriangle,
    tintClass: REVIEW_SEVERITY_TINT[severity],
    borderClass: REVIEW_SEVERITY_BORDER[severity],
  }
}

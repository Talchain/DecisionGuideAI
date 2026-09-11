/**
 * severityChannel — THE single authority on how a typed block's `severity`
 * becomes the BORDER-AND-TINT colour channel, plus one glyph descriptor per
 * block family.
 *
 * ⚠ SCOPED DELIBERATELY, because "the authority on severity colour" would be
 * an overclaim: `resolveBlockBadgeDotClass` (`conversation/InlineBlocks.tsx`)
 * maps every non-`info` severity to the DANGER dot, warning included, and that
 * is a real constraint rather than drift — `Conversation.module.css` has no
 * warning dot to reach for. Border and tint are this module's; the badge dot
 * is not. Saying so here is cheaper than the next reader finding the mismatch
 * and assuming one of the two is a bug.
 *
 * ⚠ RENAMED FROM `reviewCardSeverity` when `V5EvidenceBlock` became the second
 * consumer. The mapping was never review-card-specific: it is the design
 * system's severity→colour mapping, and a file called `reviewCardSeverity`
 * holding it would have been a name that discouraged the next surface from
 * reaching for it — which is how the third mirror came to exist.
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
import { AlertTriangle, Lightbulb, Search } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { V5ReviewCardBlock as V5ReviewCardBlockType } from '../../canvas/conversation/types'

export type Severity = V5ReviewCardBlockType['severity']

/**
 * Border tint. Module-private, like its tint twin below: no surface outside
 * this file may re-declare a channel of its own. Reach it through
 * `severityChannel` (the colours alone) or through a family descriptor —
 * `reviewSeverityVisual` / `evidenceSeverityVisual` (colours plus that
 * family's glyph).
 *
 * ⛔ TWO FALSE SENTENCES HAVE STOOD HERE, AND THE SECOND WAS WRITTEN INTO THE
 * PARAGRAPH RECORDING THE FIRST. It was briefly exported under a comment
 * saying "the card applies it inside a longer className expression" — false
 * when written; the card destructures `borderClass` off the resolver. The
 * correction then said "every consumer reaches it through
 * `reviewSeverityVisual`, and nothing outside this file may pick one channel
 * out of the three" — falsified in the very change that added
 * `severityChannel` below, whose whole purpose is to hand out exactly two of
 * the three. A file that exists to stop surfaces disagreeing has now twice
 * carried a sentence disagreeing with the code beside it. Recorded rather than
 * quietly deleted, because the pattern is the lesson.
 */
const SEVERITY_BORDER: Record<Severity, string> = {
  info: 'border-info/30',
  warning: 'border-warning/30',
  critical: 'border-danger/30',
}

const SEVERITY_TINT: Record<Severity, string> = {
  info: 'text-info',
  warning: 'text-warning',
  critical: 'text-danger',
}

/** The COLOUR channel alone — no glyph. */
export interface SeverityChannel {
  /** Text-colour utility for the glyph. */
  tintClass: string
  /** Border-colour utility, for surfaces that draw one. */
  borderClass: string
}

/** A block family's full visual: the shared colours plus that family's glyph. */
export interface SeverityVisual extends SeverityChannel {
  Icon: LucideIcon
}

/**
 * Tint and border for a severity, WITHOUT a glyph.
 *
 * ⚠⚠ THE SPLIT EXISTS BECAUSE THE GLYPH IS NOT SHARED AND MUST NOT BE. Review
 * cards draw `Lightbulb` for `info`; `V5EvidenceBlock` draws `Search`, because
 * an evidence gap is a thing to go and look at, not an idea. A caller that
 * took `reviewSeverityVisual` wholesale to get the colours would silently
 * swap the magnifying glass for a lightbulb — a behaviour change wearing a
 * refactor's clothes. So the colour channel is reachable on its own, and the
 * evidence block keeps deciding its own glyph.
 */
export function severityChannel(severity: Severity): SeverityChannel {
  return {
    tintClass: SEVERITY_TINT[severity],
    borderClass: SEVERITY_BORDER[severity],
  }
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
/**
 * The glyph/tint pair for an EVIDENCE block's severity.
 *
 * ⚠⚠ IT EXISTS SO THE GLYPH RULE IS NOT COMPONENT-LOCAL, which is the exact
 * altitude that produced #1450 and #1463. `v5_evidence` is ALREADY in
 * `POINT_CANDIDATE_TYPES`; the only thing keeping it out of the collapsed line
 * is that `collapsibleTitle` reads `title` while an evidence block carries
 * `factor_label`. The day one fallback closes that gap a second surface needs
 * this glyph — and if the rule is still a ternary inside the component, that
 * surface will guess, exactly as the collapsed review card once guessed
 * `Lightbulb`/`text-info` for every severity.
 *
 * `Search` for `info`, because an evidence gap is something to go and look at
 * rather than an idea to consider; the caution glyph otherwise. Moved here
 * verbatim from the component — this changes WHERE the rule lives, never what
 * it says.
 */
export function evidenceSeverityVisual(severity: Severity): SeverityVisual {
  return {
    Icon: severity === 'info' ? Search : AlertTriangle,
    ...severityChannel(severity),
  }
}

export function reviewSeverityVisual(severity: Severity): SeverityVisual {
  return {
    Icon: severity === 'info' ? Lightbulb : AlertTriangle,
    ...severityChannel(severity),
  }
}

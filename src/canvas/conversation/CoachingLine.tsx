/**
 * CoachingLine — one coaching/review card as a single producer-titled line,
 * expandable to the card itself.
 *
 * ## The defect this exists to fix
 *
 * The panel's coaching is good and it is buried. A turn's cards each render as
 * a bordered panel carrying a category chip, a title, a body paragraph, entity
 * chips and a disclosure; roughly two fill a tall narrow panel. That is
 * tolerable at the DRAFT turn's three or four cards and it is not what the
 * product actually produces: analysis turns carry roughly 8-14 point
 * candidates, of which `MAX_POINTS = 3` stay top-level and the rest sit behind
 * "Show N more". Opening that disclosure replaced one wall with a larger one.
 *
 * So the card stack becomes a LIST: the user scans what the coaching is about,
 * and opens the one they want.
 *
 * ⚠ SIZED FOR THE HIGH COUNT DELIBERATELY, NOT FOR TODAY'S SCREENSHOT — AND
 * THE HIGH COUNT IS AN OBSERVATION, NOT A LAW. Its only primary record in this
 * repo is `phase3Pacing.ts`, which reports the phase-3 card counts on ONE
 * walk's analysis turns as `8, 8, 8, 11, 13, 14` — n=6, one capture, one
 * pipeline version, no distribution and no upper bound claimed.
 * `messageComposition.ts` quotes those same six numbers; it is not a second
 * measurement. So "8-14" is the range those six observations spanned, and a
 * turn outside it is not a contradiction of anything.
 *
 * That scope is deliberately weak and it is still sufficient, because nothing
 * here is tuned to the number. The mechanism collapses whatever the producer
 * sends, at any count — the figure only justifies designing for a LIST instead
 * of for the three or four cards a draft turn shows. Three cards is the
 * regression case, and the twelve-card arm in the spec is the design case.
 *
 * ⛔ AN EARLIER REVISION OF THIS BLOCK ALSO CITED "9 of 13 measured live turns"
 * for a CEE-lane gate that discards freeform coaching on turns whose analysis is
 * not `ready`. THAT FIGURE IS WITHDRAWN HERE: the seat that produced it
 * retracted it the same day as having NO COMMITTED ARTEFACT, and it survived
 * only as prose in source comments — this file having been one of them. It is
 * removed rather than re-attributed, because a number that cannot be re-derived
 * should not be load-bearing rhetoric for a design decision.
 *
 * The gate itself may well be real and is another lane's to evidence; nothing
 * here depends on it. If it lands and coaching volume rises on non-analysis
 * turns, this change gets MORE useful, not less — which is an argument that
 * needs no measurement of mine.
 *
 * ## The line is an INDEX ENTRY, and is weighted as one
 *
 * ⚠ IT SHIPPED AT THE PANEL'S LARGEST WEIGHT, WHICH IS WHY IT READ AS A WALL
 * OF ITS OWN. The title used `typography.panelHeader` — 14px SEMIBOLD, a
 * token whose docstring reserves it for section titles and key emphasis (that
 * docstring also names a race-framing term this estate has ruled out; quoting
 * it verbatim here only spread it, so it is paraphrased — the CONSTANT is what
 * wants renaming, and that is reported, not done from this lane) — and the
 * icon used `ICON_STATUS` (14). A row whose whole job is to let someone scan
 * past it is none of those things, and at 14px semibold a real producer title
 * ("Include new subscriber acquisition as a pathway to MRR", 52 chars) wraps
 * to two lines at the 416px dock, so three "single lines" were six.
 *
 * Now: title `panelBody` (12px regular), icon `ICON_DENSE` (12 — the token's
 * own docstring says "dense rows, inline chips"). Every value is an existing
 * token; the panel's three-size census (14/12/11) is untouched, and nothing
 * here invents a scale.
 *
 * ## ⭐ ONE CHANNEL PER MEANING — the row was saying the same thing three times
 *
 * Photographed on deployed staging (b7c8c74e), a live row carried a blue DOT,
 * a lightbulb GLYPH drawn on top of it, and a "Could fix" PILL, before a single
 * word of the producer's title — in a 416px dock.
 *
 * ⛔ AN EARLIER REVISION OF THIS HEADER SAID "THE CATEGORY CHIP STAYS", and
 * argued it: `guidanceCategoryIcon` was BINARY, so the glyph could not separate
 * `could_fix` from `technique`, and dropping the chip would have left a
 * four-value distinction carried by tint alone — WCAG 1.4.1 (Use of Colour) at
 * Level A. That reasoning was SOUND and the conclusion drawn from it was
 * WRONG: the answer to "the glyph cannot carry four values" is to make the
 * glyph carry four values, not to keep a second element that can. The glyph is
 * now four distinct SHAPES (`guidanceCategoryIcon`), shape being a non-colour
 * channel, and the chip is retired as the duplicate it had become.
 *
 * ⛔ THE BADGE DOT IS NOT DRAWN HERE AND NEVER WAS — it is painted by
 * `InlineBlocks`, which is why `suppressHeader` could not reach it and why it
 * outlived every other limb of the card treatment. It is gated there now.
 *
 * ⚠⚠ THE PILL WAS ALSO THIS ROW'S ONLY ACCESSIBLE NAME for the category, the
 * glyph having shipped `aria-hidden`. The name moved to the glyph rather than
 * being dropped with it; see the summary below.
 *
 * ## ⚠⚠ THE LINE IS PRODUCER COPY, VERBATIM, OR THERE IS NO LINE
 *
 * `block.title` is rendered character-for-character. It is never summarised,
 * truncated, ellipsised, re-cased or paraphrased, and this module authors no
 * replacement for it. The UI must not sanitise server copy at the render
 * boundary: rewriting a producer's sentence at render makes the wire and the
 * screen disagree, which is a worse defect than the one it hides. If a title is
 * too long to scan, that is a finding to report to the CEE lane — not a
 * substring to take here.
 *
 * The glyph is the same `guidanceCategoryIcon` the full card calls, and its
 * accessible name is the same `STRENGTHEN_COPY.severityLabel` string the card's
 * badge renders. Nothing on this line is derived — the line shows fewer of the
 * card's elements than it did, never different ones.
 *
 * ## Fail closed
 *
 * A block with no `title`, or a blank one, gets NO line and renders expanded
 * exactly as before. This is a live case rather than a hypothetical:
 * `v5_evidence` and `v5_exercise` carry no `title` field at all (`types.ts`),
 * so they keep their existing full render.
 *
 * ## ⛔ Pinned blocks never collapse
 *
 * `PINNED_BLOCK_TYPES` — graph patches, proposals, held proposals, the analysis
 * result, commentary. The first three carry the user's CONSENT affordance, and
 * hiding the thing the user is being asked to agree to behind a summary is a
 * trust regression rather than a tidy-up; the analysis result IS the answer.
 * The gate is pinned membership, never "does it look like a card".
 *
 * ## Why a native <details>
 *
 * Keyboard operation, focus order and disclosure semantics come for free, and
 * this estate has shipped controls bound only to `onDoubleClick` — where Enter
 * and Space dispatch `click` and never `dblclick`, so the control had no
 * keyboard route at all. `V5CoachingBlock`'s own "Why this, and how sure"
 * already uses this element for the same reason; a second, hand-rolled
 * `aria-expanded` button next to it would be two mechanisms for one behaviour.
 *
 * The body stays mounted while closed, exactly as the browser intends: closed
 * `<details>` content is hidden from assistive technology too, so nothing is
 * announced that the user cannot see.
 */
import type { ReactNode } from 'react'
import { typography } from '../../styles/typography'
import { guidanceCategoryIcon } from '../stores/guidanceStore'
import { STRENGTHEN_COPY } from '../../components/results/strengthen/strengthenCopy'
import { isPinnedBlock, isPointCandidate } from './messageComposition'
import { ICON_DENSE } from './panelIcons'
import { evidenceBlockTitle } from '../../v5/blocks/V5EvidenceBlock'
import type { V5EvidenceBlock as V5EvidenceBlockType } from './types'
import {
  evidenceSeverityVisual,
  reviewSeverityVisual,
  type Severity,
} from '../../v5/blocks/severityChannel'
import type { ConversationBlock } from './types'
import styles from './Conversation.module.css'

/** The producer's four-value severity class, where the block carries one. */
type CoachingCategory = keyof typeof STRENGTHEN_COPY.severityLabel

/*
 * ⛔ `CHIP_CLASS` LIVED HERE AND IS GONE WITH THE PILL IT STYLED. Its four
 * border tints were the row's only four-value channel while the glyph was
 * binary; now `guidanceCategoryIcon` returns four distinct SHAPES, the chip
 * is a second channel saying what the glyph already says, and the estate's
 * own rule is that no channel duplicates another. The category badge on the
 * full CARD (`V5CoachingBlock`) is untouched — a card has the room, and this
 * change is about the LINE.
 */

/** The producer's own title, or null when it did not send a usable one. */
export function collapsibleTitle(block: ConversationBlock): string | null {
  const direct = (block as { title?: unknown }).title
  if (typeof direct === 'string' && direct.trim().length > 0) return direct.trim()

  /*
    ⭐ EVIDENCE BLOCKS CARRY `factor_label`, NOT `title` — and without this
    fallback they were the one point-candidate family that could never
    collapse. Witnessed on deployed staging: a turn whose coaching blocks
    rendered as compact lines while its evidence blocks rendered as full
    bordered walls, two of them filling the panel above "Show 11 more". The
    list read as working on one reply and broken on the next, which is exactly
    how it was reported.

    ⚠ THIS IS NOT A SYNTHESISED TITLE, AND IT ASKS THE ONE AUTHORITY.
    `evidenceBlockTitle` is the card's own §1.3 resolution — the primary
    `target_refs` factor entry, with `factor_label` only as the
    backward-compatibility fallback. Reading `factor_label` directly here
    would have been the shorter fix and the wrong one: the two fields differ
    on conflict, so the line and the card would have put different names on
    one block. The UI composes nothing and shortens nothing.
  */
  if ((block as { type?: unknown }).type === 'v5_evidence') {
    const resolved = evidenceBlockTitle(block as unknown as V5EvidenceBlockType)
    return typeof resolved === 'string' && resolved.trim().length > 0 ? resolved.trim() : null
  }
  return null
}

/** The producer's category, where this block type carries one at all. */
function blockCategory(block: ConversationBlock): CoachingCategory | null {
  const category = (block as { category?: unknown }).category
  return typeof category === 'string' && category in STRENGTHEN_COPY.severityLabel
    ? (category as CoachingCategory)
    : null
}

/**
 * The producer's review SEVERITY, where this block type carries one at all.
 *
 * ⚠ A REVIEW CARD HAS NO `category` AND A COACHING BLOCK HAS NO `severity` —
 * they are different taxonomies from different producers, and `blockCategory`
 * above returns null for every review card. #1450 read only the category, so
 * every review card collapsed to the same `Lightbulb`/`text-info` and the
 * turn's `warning` card was flattened into the `info`s around it. Read the
 * channel the block actually carries.
 */
function blockReviewSeverity(block: ConversationBlock): Severity | null {
  const type = (block as { type?: unknown }).type
  if (type !== 'v5_review_card' && type !== 'v5_evidence') return null
  const severity = (block as { severity?: unknown }).severity
  return severity === 'info' || severity === 'warning' || severity === 'critical'
    ? severity
    : null
}

/**
 * May this block render as a line?
 *
 * Three producer facts, all of which must hold: it is NOT pinned (consent and
 * the answer itself are never collapsed), it is one of the coaching/review
 * family the cap already treats as a point candidate, and it carries a usable
 * title of its own. Nothing is inferred from the body, the turn, or the count.
 */
export function isCollapsibleCardBlock(block: ConversationBlock): boolean {
  if (isPinnedBlock(block)) return false
  if (!isPointCandidate(block)) return false
  return collapsibleTitle(block) !== null
}

export interface CoachingLineProps {
  block: ConversationBlock
  /** The block's OWN renderer, unchanged — mounted inside the disclosure. */
  children: ReactNode
}

export function CoachingLine({ block, children }: CoachingLineProps) {
  const title = collapsibleTitle(block)
  const category = blockCategory(block)
  const severity = blockReviewSeverity(block)
  // TWO producer channels, one per block family, each resolved by ITS OWN
  // single authority — `guidanceCategoryIcon` for a coaching block's category,
  // `reviewSeverityVisual` for a review card's severity. Re-deriving either
  // here would be a second mirror to keep; reading only one of them is the
  // #1450 defect this replaces.
  /*
    ⛔ THE FAMILY DESCRIPTOR IS CHOSEN BY BLOCK TYPE, NOT BY "has a severity".
    An evidence block's glyph is `Search` — an evidence gap is something to go
    and look at — and routing it through `reviewSeverityVisual` would hand back
    `Lightbulb`, which is #1450 exactly: one family's glyph rule silently
    applied to another's blocks. Making evidence collapsible WITHOUT this line
    would have reintroduced the defect the compact line exists to fix, on the
    very turn that made the gap visible.
  */
  const isEvidence = (block as { type?: unknown }).type === 'v5_evidence'
  const { Icon, tintClass } = severity
    ? (isEvidence ? evidenceSeverityVisual(severity) : reviewSeverityVisual(severity))
    : guidanceCategoryIcon(category ?? undefined)

  // Fail closed: no usable producer title, no line. The caller renders the
  // block's own full card instead.
  if (!title) return <>{children}</>

  const blockId = (block as { block_id?: string }).block_id ?? title

  return (
    <details
      className={styles.coachingLine}
      data-testid={`coaching-line-${blockId}`}
      /*
        ⛔ NO `data-block-id` HERE, AND THAT IS LOAD-BEARING RATHER THAN AN
        OMISSION. The CARD already carries `data-block-id`, and several specs —
        and any future consumer — resolve it with
        `document.querySelector('[data-block-id="…"]')`. A second element with
        the same attribute WRAPPING the first wins that query by document order,
        so the caller silently gets the line instead of the card and reads
        `null` for every `data-*` the card publishes. This wrapper is addressed
        by its own testid only.
      */
      {...(category ? { 'data-category': category } : {})}
    >
      <summary
        className={styles.coachingLineSummary}
        data-testid={`coaching-line-summary-${blockId}`}
      >
        {/*
          ⭐ THE GLYPH CARRIES THE CATEGORY NOW, so the pill beside it is gone.
          It was not removable before: `guidanceCategoryIcon` was binary, so
          `could_fix` and `technique` drew the SAME Lightbulb and only the pill
          said which a row was. Dropping it then would have left a four-value
          distinction carried by tint alone — WCAG 1.4.1 (Use of Colour) at
          Level A. Four shapes is what makes the pill redundant rather than
          merely unfashionable.

          ⚠⚠ AND THE PILL WAS THIS ROW'S ONLY ACCESSIBLE NAME FOR THE CATEGORY.
          The glyph shipped `aria-hidden`, so deleting the pill without naming
          the glyph would have removed the category from assistive technology
          altogether — a visual defect traded for an accessibility one. The
          name moves to the glyph, from the SAME `STRENGTHEN_COPY` map the pill
          rendered, so the screen and the screen reader cannot drift.

          ⚠ Only the coaching family carries a `category`. Review-card and
          evidence lines have none and never had a pill, so their glyph stays
          `aria-hidden` exactly as before — their meaning is in the title beside
          it. That those families convey SEVERITY through glyph and tint with
          no text equivalent is a real and PRE-EXISTING gap; it is reported,
          not silently widened or quietly fixed from this lane.
        */}
        <Icon
          size={ICON_DENSE}
          className={`flex-none ${tintClass}`}
          {...(category
            ? { role: 'img', 'aria-label': STRENGTHEN_COPY.severityLabel[category] }
            : { 'aria-hidden': true })}
        />
        {/* The producer's title, verbatim. No clamp, no ellipsis, no clip. */}
        <span className={typography.panelBody}>{title}</span>
      </summary>
      <div className={styles.coachingLineBody}>{children}</div>
    </details>
  )
}

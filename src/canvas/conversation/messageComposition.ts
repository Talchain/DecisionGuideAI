/**
 * messageComposition — THE typed composition layer for an assistant turn's
 * blocks (PX-B, Paul's 15 Aug ruling on response presentation).
 *
 * ## The defect this exists to fix
 *
 * A turn's blocks were governed by TWO overlapping budgets that each decided
 * visibility independently: the legacy per-turn budget (4 non-phase-3 blocks,
 * `MAX_VISIBLE_BLOCKS_PER_TURN`) and the phase-3 pacing group (6
 * default-expanded cards, `PHASE3_DEFAULT_EXPANDED`), plus a bias-signal set
 * exempt from BOTH (2 more). On the phase-3 counts this repo measured live —
 * 8, 8, 8, 11, 13, 14 cards per analysis turn (see phase3Pacing.ts) — that
 * yields up to TWELVE cards stacked under the prose, each its own bordered
 * panel. That is the "panels-within-panels / walls" defect.
 *
 * ## The ruling
 *
 * headline → at most MAX_POINTS prioritised coaching points → clear next
 * action(s) → expandable supporting detail. The product controls what is
 * initially EXPOSED; the producer may still generate as much as it likes.
 *
 * ⚠ THIS SUPERSEDES the default-expanded cap of `PHASE3_DEFAULT_EXPANDED = 6`
 * (ROADMAP 2.211-②, 1 Aug) as the TOP-LEVEL exposure rule. That earlier ruling
 * raised the cap 3→6 because rank ≠ visibility: a collapsed card renders null
 * and the lens-selected card was being buried. The 2.242 companion RESERVATION
 * that answered it is carried forward here (see `reserveCompanion`) rather than
 * dropped — the cap changes, the reason the reservation existed does not.
 *
 * ## Honesty invariants (the load-bearing ones)
 *
 * 1. TOTAL PARTITION. `pinned ∪ points ∪ detail` is exactly the set of input
 *    indices — every block appears in exactly ONE class, none is dropped and
 *    none duplicated. `assertTotalPartition` is exported so the spec binds it.
 *    Demotion is presentational: a demoted block renders through its OWN
 *    existing renderer, byte-for-byte, inside the disclosure.
 * 2. NO FABRICATION. `headline` is only ever the producer's own answer-shape
 *    headline. It is never derived, split, or summarised out of prose — the
 *    same rule answerShape.ts already holds ("never fabricates structure").
 *    A turn with no producer headline gets `headline: null`, NOT an invented one.
 * 3. NO REORDERING. Within every class, blocks keep PRODUCER ORDER. The cap is
 *    applied by taking a prefix, never by sorting: CEE has already applied
 *    `priority_rank`, and a UI-invented rank is exactly the defect
 *    phase3Pacing.ts documents at EXERCISE_RANK_AFTER_REVIEW_CARDS. The one
 *    exception is the companion reservation, which SWAPS one member of the
 *    point set and is bounded to one.
 *
 * ## ONE RENDER AUTHORITY (L-16 / NEW-9, 16 Aug 2026) — added, nothing weakened
 *
 * The three invariants above govern which CLASS a block lands in. They said
 * nothing about the same TEXT arriving through two channels at once, and it
 * does — by producer design:
 *
 *   · CEE derives `assistant_text` FROM the answer shape
 *     (`deriveAnswerTextFromShape`, derived at the CEE bytes on staging
 *     `2988eacf`): `headline \n\n • bullets \n\n detail`. The `_answer_shape`
 *     sidecar carries the same three parts. The byte-equality is DELIBERATE and
 *     producer-side — it exists so legacy `assistant_text` consumers keep
 *     working — so the fix cannot be "stop one of them being emitted".
 *   · a held-proposal / patch card restates the plan the prose already stated
 *     (the scoreboard measured this byte-for-byte on the edit path, NEW-9).
 *
 * Rendering both is the defect the user sees. So this module also owns the
 * RENDER AUTHORITY ORDER, and one suppression rule applied at every surface:
 *
 *   TIER 0  consent / answer cards (the `pinned` class)  — highest authority
 *   TIER 1  the answer-shape headline
 *   TIER 2  the prose body
 *   TIER 3  points
 *   TIER 4  the detail disclosure
 *
 * A LOWER tier's segment is withheld when a HIGHER tier has already rendered
 * that exact segment. A higher tier is never withheld, so no surface can lose
 * content to a surface the user has not been shown.
 *
 * 4. NO CONTENT EDITING, AND NOTHING IS WITHHELD EXCEPT AGAINST A HIGHER TIER.
 *    Stated as narrowly as the code actually delivers, because the first draft
 *    of this invariant was written wider than its implementation and an
 *    adversarial review found the gap:
 *      (a) suppression compares WHOLE SEGMENTS — a paragraph or a line — and
 *          only on EXACT equality after whitespace/case normalisation. Never a
 *          rewrite, never a substring, never a similarity threshold;
 *      (b) a segment is withheld ONLY when a surface ABOVE it in the tier order
 *          has already rendered that exact segment. Repetition WITHIN one
 *          surface is the producer's and always survives;
 *      (c) the text a caller passes as `alreadyRendered` must be what that
 *          surface ACTUALLY RENDERS. Suppressing against text the user cannot
 *          see is content loss wearing de-duplication's clothes, and it is how
 *          both of this rule's shipped defects worked.
 *    Two things this rule therefore does NOT do, deliberately: it does not split
 *    sentences out of a paragraph (that needs a predicate over natural language
 *    — the class this platform watched oscillate for four rounds without
 *    terminating, trap 22f), and it does not de-duplicate a text against itself.
 *    Both limits are pinned by their own specs — stated and visible, never
 *    silently absorbed.
 */
import type { ConversationBlock, GraphPatchBlock } from './types'
import { readDecisionReviewWireState } from '../../v5/decisionReviewAdapter'
import { isLensCompanionBlock } from './phase3Pacing'
import {
  isGraphPatchApplied,
  resolveGraphPatchSummaryText,
} from './blocks/GraphPatchBlockRenderer'
import type { PatchBlockState } from './useConversation'

/**
 * How many coaching points are exposed at top level. Paul's ruling: "max ~3
 * prioritised coaching points". Everything beyond this is DEMOTED to the
 * disclosure body — never dropped.
 */
export const MAX_POINTS = 3

/**
 * How many point slots may be reserved for the turn's lens companion card.
 * Carried forward from ROADMAP 2.242. A reservation INSIDE MAX_POINTS, never
 * an addition to it: the companion displaces the last point, so the number of
 * top-level points is unchanged on every turn.
 */
export const RESERVED_COMPANION_POINTS = 1

/**
 * Blocks that are PINNED to the top level regardless of the point cap.
 *
 * Two families, one rule — "the block IS the response, or the block is the
 * user's consent affordance":
 *   · graph patches and proposals carry accept / dismiss / confirm. Demoting a
 *     consent control into a collapsed disclosure would hide the thing the user
 *     is being asked to agree to, which is a trust regression, not a tidy-up.
 *     (The pre-existing rule "graph_patch proposed blocks always stay visible"
 *     is preserved by this set, not weakened.)
 *   · `v5_analysis_result` is the analysis answer itself on an analysis turn.
 *   · `commentary` renders INLINE — no card, no border, no badge dot (DS v5
 *     §21.2) — so it is not part of the stacking harm and belongs with the body.
 */
export const PINNED_BLOCK_TYPES: ReadonlySet<ConversationBlock['type']> = new Set([
  'graph_patch',
  'v5_graph_patch',
  'proposal',
  'v5_held_proposal',
  'v5_analysis_result',
  'commentary',
] as const)

/**
 * The coaching/review card family — the blocks eligible to be one of the ≤3
 * top-level POINTS.
 *
 * Deliberately the measured flood family (phase3Pacing's PHASE3_CARD_TYPES plus
 * the legacy `review_card`), because that is the family the live counts of
 * 8–14 cards per turn came from. Every other block type is supporting detail by
 * default; that is the ruling's "expandable supporting detail" tier, and it is
 * what turns comparison / premortem / flip_analysis / exercise / framing /
 * brief / fact / evidence from top-level stacking panels into disclosure-level
 * citizens.
 */
export const POINT_CANDIDATE_TYPES: ReadonlySet<ConversationBlock['type']> = new Set([
  'v5_coaching',
  'v5_review_card',
  'v5_evidence',
  'v5_exercise',
  'review_card',
] as const)

/** One block's place in the composition, bound to its source by INDEX (identity, not value). */
export interface CompositionEntry {
  /** Index into the original `blocks` array. The identity a spec binds to. */
  index: number
  /** The source block's own type, carried so a consumer never re-derives it. */
  blockType: ConversationBlock['type']
}

export interface MessageComposition {
  /**
   * The producer's own one-sentence headline, or null. NEVER derived from prose
   * (invariant 2). Supplied by the caller from the answer-shape sidecar.
   */
  headline: string | null
  /** Blocks pinned to the top level — the response itself, and consent affordances. */
  pinned: CompositionEntry[]
  /** At most MAX_POINTS coaching points, in producer order. */
  points: CompositionEntry[]
  /** Everything else, in producer order, rendered inside ONE disclosure. */
  detail: CompositionEntry[]
}

/** Is this block eligible to be one of the top-level points? */
export function isPointCandidate(block: ConversationBlock): boolean {
  return POINT_CANDIDATE_TYPES.has(block.type) && !PINNED_BLOCK_TYPES.has(block.type)
}

/** Is this block pinned to the top level? */
export function isPinnedBlock(block: ConversationBlock): boolean {
  return PINNED_BLOCK_TYPES.has(block.type)
}

/**
 * ROADMAP 2.242, carried forward under the new cap. When the turn's lens
 * companion card falls into the overflow, promote it into the point set by
 * DISPLACING the last point — never by growing the set.
 *
 * Returns the promoted index set. Bounded by RESERVED_COMPANION_POINTS and by
 * MAX_POINTS itself, so a mis-set constant can never grow the exposed count
 * (the same guard `defaultExpandedIndices` carries in phase3Pacing.ts).
 */
function reserveCompanion(
  blocks: readonly ConversationBlock[],
  candidateIndices: readonly number[],
): Set<number> {
  const chosen = new Set(candidateIndices.slice(0, MAX_POINTS))
  const overflow = candidateIndices.slice(MAX_POINTS)
  const reservable = Math.min(RESERVED_COMPANION_POINTS, MAX_POINTS)
  let promoted = 0
  for (const i of overflow) {
    if (promoted >= reservable) break
    if (!isLensCompanionBlock(blocks[i])) continue
    const displaced = candidateIndices[MAX_POINTS - 1 - promoted]
    chosen.delete(displaced)
    chosen.add(i)
    promoted++
  }
  return chosen
}

/**
 * THE composition function. Pure: reads blocks, mutates nothing, returns the
 * partition. The message/store keeps every block exactly as ingested — this
 * decides only what is EXPOSED first, which is the whole point of the ruling.
 */
export function composeMessage(
  blocks: readonly ConversationBlock[],
  headline: string | null = null,
): MessageComposition {
  const entry = (index: number): CompositionEntry => ({ index, blockType: blocks[index].type })

  const candidateIndices: number[] = []
  for (let i = 0; i < blocks.length; i++) {
    if (isPointCandidate(blocks[i])) candidateIndices.push(i)
  }
  const chosenPoints = reserveCompanion(blocks, candidateIndices)

  /**
   * FILL. The cap governs TOTAL top-level exposure, not the coaching family
   * alone — so when a turn carries fewer than MAX_POINTS coaching cards, the
   * remaining slots are filled from the other blocks in producer order.
   *
   * ⚠ Without this the composition had a defect worse than the one it fixes:
   * a turn whose only block is a `fact` (or `framing`, `brief`, `model_receipt`,
   * or an unknown-type fallback card) has NO point candidate, so every block
   * was demoted and the user saw an empty message body above a "Show 1 more"
   * toggle. Capping a flood and hiding a single block are the two opposite
   * harms of one predicate; they cannot share a rule (platform trap 22b), so
   * selection is preference-then-fill, both stages in producer order.
   *
   * Preference, not reordering: coaching cards get first claim on the slots
   * because they are what the ruling calls "prioritised coaching points", and
   * the fill is strictly earliest-first. No UI-invented rank at either stage.
   */
  for (let i = 0; i < blocks.length && chosenPoints.size < MAX_POINTS; i++) {
    if (isPinnedBlock(blocks[i]) || chosenPoints.has(i)) continue
    if (isPointCandidate(blocks[i])) continue // already considered above; overflow stays demoted
    chosenPoints.add(i)
  }

  const pinned: CompositionEntry[] = []
  const points: CompositionEntry[] = []
  const detail: CompositionEntry[] = []

  // ONE pass, ONE decision per block, in producer order — so the three classes
  // cannot disagree about a block's fate and the partition is total by
  // construction rather than by a later reconciliation.
  for (let i = 0; i < blocks.length; i++) {
    if (isPinnedBlock(blocks[i])) pinned.push(entry(i))
    else if (chosenPoints.has(i)) points.push(entry(i))
    else detail.push(entry(i))
  }

  return { headline, pinned, points, detail }
}

// ---------------------------------------------------------------------------
// ONE RENDER AUTHORITY — the suppression primitives (invariant 4)
// ---------------------------------------------------------------------------

/**
 * The comparison key for "has this exact segment already been rendered?".
 *
 * Whitespace-insensitive and case-insensitive, because the two channels that
 * carry the same sentence are assembled by different code paths (a template
 * join on one side, a tool-call field on the other) and differ in newlines and
 * padding without differing in content. NOTHING ELSE is normalised: no
 * punctuation stripping, no stemming, no fuzzy distance. Two segments match
 * only when they are the same words in the same order.
 *
 * A blank segment normalises to '' and is never treated as a duplicate of
 * anything — see `isRenderableSegment`.
 */
export function renderSegmentKey(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase()
}

/**
 * Segment boundaries: a blank line (paragraph) OR a single newline (a list
 * line). Deliberately NOT sentence boundaries — see invariant 4.
 *
 * Returns the segments with their ORIGINAL bytes (only the split is derived
 * from the normalised form), so re-joining survivors reproduces the producer's
 * text exactly for any input in which nothing was suppressed.
 */
export function splitRenderSegments(text: string): string[] {
  return text.split(/\n/).map((s) => s.replace(/\s+$/, ''))
}

/**
 * Is this segment eligible to participate in duplicate suppression at all?
 *
 * Blank segments carry no content — suppressing them would collapse the
 * producer's paragraph spacing, and treating them as duplicates of each other
 * would fold a whole message into one run-on block.
 */
function isRenderableSegment(segment: string): boolean {
  return renderSegmentKey(segment).length > 0
}

/** What `dedupeRenderedText` withheld, so a caller can disclose it rather than hide it. */
export interface DedupeResult {
  /** The surviving text. Identical to the input when nothing was withheld. */
  text: string
  /** How many segments were withheld because a higher tier had already rendered them. */
  suppressedCount: number
}

/**
 * Withhold from `text` every whole segment a HIGHER-AUTHORITY surface has
 * already rendered this turn.
 *
 * `alreadyRendered` is the higher tiers' text, in authority order. It is read,
 * never written: this function cannot suppress anything FROM it, so the
 * authority order is enforced by the call site's argument order and by nothing
 * else — which is why every call site names its tier in a comment.
 *
 * ⚠⚠ IT DOES NOT DE-DUPLICATE `text` AGAINST ITSELF, AND THAT IS THE WHOLE
 * POINT OF THIS PARAGRAPH.
 *
 * An earlier version of this function accumulated its own segments into `seen`,
 * so with an EMPTY `alreadyRendered` — the default path, i.e. every ordinary
 * assistant turn — the second occurrence of any identical line was deleted.
 * An adversarial review proved it at the rendered HTML: "Timeline slips"
 * appearing under both Risks and Mitigations rendered ONCE; three "Confidence:
 * not stated" status lines became one. That is CONTENT LOSS, shipped by
 * default, in the module whose first invariant is that nothing is dropped.
 *
 * The root error was treating two DIFFERENT QUESTIONS as one predicate:
 *
 *   CROSS-TIER  "has a higher-authority surface already rendered this exact
 *               segment?"  — a FACT. The caller supplies the other surface's
 *               text; equality settles it; there is nothing to infer.
 *   WITHIN-TEXT "did the producer repeat this line by accident, or on purpose
 *               because it is a structural label under two headings?" — a
 *               GUESS. Nothing in the text distinguishes them.
 *
 * They cannot share a window (trap 22b: one predicate, two opposite harms —
 * a missed duplicate is cosmetic, a deleted line is a lie about what the
 * producer said). So only the fact is implemented. Repetition INSIDE one
 * surface is the producer's and is rendered verbatim.
 *
 * L-16 is unaffected: its mechanism, derived at the CEE bytes, is cross-tier
 * (`_answer_shape.headline` and `assistant_text` carrying the same bytes; a
 * consent card restating the prose). And "the same sentence twice inside one
 * disclosure" is still closed where it actually occurs — ACROSS blocks, by the
 * caller accumulating each rendered block into `alreadyRendered` (InlineBlocks).
 *
 * Total by construction: with an empty `alreadyRendered` the output is now
 * byte-identical to the input, ALWAYS.
 */
export function dedupeRenderedText(
  text: string,
  alreadyRendered: readonly string[] = [],
): DedupeResult {
  if (!text) return { text, suppressedCount: 0 }

  const seen = new Set<string>()
  for (const prior of alreadyRendered) {
    for (const segment of splitRenderSegments(prior)) {
      if (isRenderableSegment(segment)) seen.add(renderSegmentKey(segment))
    }
    // The whole prior surface also counts as one segment: a card summary that
    // is a single paragraph must suppress the identical single paragraph in the
    // prose, and splitting both sides identically is what makes that hold.
    if (isRenderableSegment(prior)) seen.add(renderSegmentKey(prior))
  }

  const segments = splitRenderSegments(text)
  const kept: string[] = []
  let suppressedCount = 0
  for (const segment of segments) {
    if (!isRenderableSegment(segment)) {
      kept.push(segment)
      continue
    }
    // NOT added to `seen` — see the docstring. A repeat of THIS text's own
    // earlier segment survives; only a repeat of a HIGHER TIER is withheld.
    if (seen.has(renderSegmentKey(segment))) {
      suppressedCount++
      continue
    }
    kept.push(segment)
  }

  if (suppressedCount === 0) return { text, suppressedCount: 0 }

  // Collapse the runs of blank segments a suppression can strand, so removing a
  // paragraph does not leave a hole where it used to be. Leading/trailing blanks
  // go entirely; interior runs collapse to ONE blank line (the paragraph break
  // the producer used).
  const trimmed: string[] = []
  for (const segment of kept) {
    if (isRenderableSegment(segment)) {
      trimmed.push(segment)
      continue
    }
    if (trimmed.length === 0) continue
    if (!isRenderableSegment(trimmed[trimmed.length - 1])) continue
    trimmed.push('')
  }
  while (trimmed.length > 0 && !isRenderableSegment(trimmed[trimmed.length - 1])) trimmed.pop()

  return { text: trimmed.join('\n'), suppressedCount }
}

/**
 * TIER 0's text: what the turn's pinned consent / answer cards will render.
 *
 * Read by the bubble so the PROSE body can withhold a plan the card is about to
 * state again (NEW-9: the scoreboard measured the plan printed twice per
 * structural edit, byte-for-byte — prose and card). The card wins because it
 * carries the consent affordance: a user confirming a structural change must
 * read the change ON the control they are agreeing through.
 *
 * ⚠ `commentary` is PINNED but is deliberately NOT a tier-0 surface. It is
 * prose, not a consent control, and its duplication against `assistant_text` is
 * already resolved one level upstream at ingest
 * (`deduplicateAgainstCommentary`). Listing it here would put two mechanisms on
 * one seam, which is how this estate produces a defect and its exact inverse in
 * consecutive rounds (trap 22b). One seam, one writer.
 *
 * Unknown / future pinned types contribute nothing rather than guessing at a
 * field name — a wrong guess would suppress prose against text that never
 * renders, which is content loss. Absence here only ever costs a duplicate.
 */
export function collectConsentSurfaceText(
  blocks: readonly ConversationBlock[] | undefined,
  /**
   * Runtime patch state + turn id. REQUIRED to answer "is this patch card
   * applied?", which decides WHICH of its two summary fields renders. A caller
   * that cannot supply them gets nothing collected for patch cards rather than
   * a guess — see the graph_patch case.
   */
  patchBlockStates?: Map<string, PatchBlockState>,
  turnId?: string,
): string[] {
  if (!blocks || blocks.length === 0) return []
  const out: string[] = []
  for (const block of blocks) {
    if (!isPinnedBlock(block)) continue
    switch (block.type) {
      case 'v5_held_proposal':
      case 'v5_analysis_result': {
        const summary = (block as { summary?: unknown }).summary
        if (typeof summary === 'string' && summary.trim().length > 0) out.push(summary)
        break
      }
      case 'graph_patch': {
        /**
         * ⚠ EXACTLY ONE FIELD RENDERS, AND WHICH ONE DEPENDS ON RUNTIME STATE.
         *
         * This used to push BOTH `applied_summary` and `summary`. An
         * adversarial review caught it: `GraphPatchBlockRenderer` shows
         * `applied_summary` only when applied, and the stripped `summary`
         * otherwise — so on a PROPOSED patch the collector suppressed prose
         * against `applied_summary`, text the user would never see. Withholding
         * prose against unshown text is content loss, not de-duplication.
         *
         * Resolved through the renderer's OWN exported helpers, so there is one
         * authority and no mirror to drift.
         */
        const patch = block as GraphPatchBlock
        const applied = isGraphPatchApplied(patch, patchBlockStates, turnId)
        const rendered = resolveGraphPatchSummaryText(patch, applied)
        if (rendered.trim().length > 0) out.push(rendered)
        break
      }
      // 'proposal' is DELIBERATELY ABSENT. `ProposalBlock` carries
      // `description` + `changes[]` and has NO `summary` / `applied_summary`
      // field at all, so the branch that used to sit here could never fire —
      // a dead case that read as coverage. `ProposalBlockRenderer` composes its
      // card from those other fields; wiring it up is a separate change with
      // its own evidence, not something to guess at inside a suppression rule.
      //
      // 'v5_graph_patch' renders a structured before/after receipt, not prose,
      // and 'commentary' is excluded by the rule above.
      default:
        break
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// THE DEMOTED FAMILIES' PROSE — what a block behind "Show N more" renders
// ---------------------------------------------------------------------------

/** One free-prose field of a block, named so suppression can be PER-FIELD. */
export interface BlockProseField {
  /** The block's own property name. The identity a clone writes back through. */
  readonly field: string
  /** Its text exactly as the producer sent it. Never normalised here. */
  readonly text: string
}

/** What free prose a block renders, and whether that prose is all it has. */
export interface BlockProseSurface {
  readonly fields: readonly BlockProseField[]
  /**
   * True when `fields` is the block's ONLY reader-facing content, so a block
   * whose every field was suppressed has nothing left to render and must be
   * dropped rather than shown as an empty shell.
   *
   * False for every card that keeps a title, a table or a list — those still
   * carry content the user has not seen, and dropping them would be per-BLOCK
   * suppression by the back door.
   */
  readonly proseIsSoleContent: boolean
}

const NO_PROSE: BlockProseSurface = { fields: [], proseIsSoleContent: false }

function prose(
  proseIsSoleContent: boolean,
  ...candidates: ReadonlyArray<readonly [string, unknown]>
): BlockProseSurface {
  const fields: BlockProseField[] = []
  for (const [field, value] of candidates) {
    if (typeof value === 'string' && value.trim().length > 0) fields.push({ field, text: value })
  }
  return fields.length === 0 ? NO_PROSE : { fields, proseIsSoleContent }
}

/**
 * THE PER-TYPE PROSE ACCESSOR — the enabling change UX gate point 4 needed.
 *
 * ## The question this answers, and the one it does NOT
 *
 * `collectConsentSurfaceText` above answers *"what will this turn's CONSENT
 * SURFACES state?"* — a tier-0 SOURCE question, pinned-only, dependent on
 * runtime patch state. This answers *"what free prose does this ONE block
 * render, field by field?"* — a TARGET question over the demoted families.
 *
 * They are deliberately two functions with two names because they are two
 * questions, and this estate's chronic defect is two questions sharing one
 * name until their defaults disagree on a reachable class of turn (trap 21).
 * Their domains are DISJOINT by construction — every type below is
 * non-pinned, every type the collector reads is pinned — so there is no
 * mirror between them to drift. What they share, and what makes this ONE
 * dedupe authority rather than two, is the comparison: both feed the single
 * `dedupeRenderedText` / `renderSegmentKey` pair. Nothing here re-implements
 * a match.
 *
 * ## Why per-FIELD and not per-block
 *
 * `v5_evidence` carries THREE independent paragraphs and `v5_exercise` up to
 * six. Suppressing a whole card to remove one repeated line would delete
 * paragraphs the user has never seen — the inverse harm, and the worse one.
 * A duplicate is cosmetic; a deleted line is a lie about what the producer
 * said. So the unit of suppression is the FIELD, and within a field the
 * existing paragraph-segment rule applies unchanged.
 *
 * ## Why the list is deliberately PARTIAL, and what each omission costs
 *
 * Absence here costs a duplicate. A wrong INCLUSION costs content, or
 * replaces the producer's words with the UI's. Every omission below was
 * derived by reading the renderer, not by guessing at a field name:
 *
 *   · `brief.summary` — its "Show more" toggle renders unconditionally, so a
 *     blanked summary leaves a live disclosure that reveals nothing.
 *   · `evidence.findings[].text` (legacy) — blank findings are filtered out
 *     and REPLACED with the UI's own "Research findings available". Blanking
 *     would substitute our copy for the producer's, which is worse than a
 *     repeat.
 *   · `model_receipt.coachingSummary` — the dispatcher returns null on a
 *     blank one, so suppressing it deletes the whole card. That is per-block
 *     suppression by the back door.
 *   · `framing.goal` — the decision statement itself, structural, not a
 *     paragraph.
 *   · `premortem.risk_paths[]`, `flip_analysis.flip_conditions[]`,
 *     `v5_exercise.warning_signs[]` — short structured clauses inside list
 *     rows, not prose paragraphs; blanking one leaves a dangling row.
 *   · `v5_coaching.signal` — provenance ("Why this came up"), not the card's
 *     prose.
 *   · `fact`, `artefact`, `v5_unsupported` — carry no free prose at all.
 *   · `commentary` — PINNED, and its suppression is already owned by
 *     InlineBlocks' existing whole-text path with its own ratified rule
 *     ("never empties a block"). One seam, one writer.
 *   · every pinned consent type — a control's copy is what the user is
 *     agreeing THROUGH. It is a dedupe SOURCE, never a target.
 *
 * Unknown / future types fall through to `NO_PROSE` rather than guessing.
 */
export function collectBlockProseSurface(block: ConversationBlock): BlockProseSurface {
  switch (block.type) {
    // ── one prose paragraph under a title the card keeps ──────────────────
    case 'v5_coaching':
    case 'v5_review_card':
    case 'review_card':
      return prose(false, ['body', (block as { body?: unknown }).body])

    // ── three independent paragraphs under a factor label the card keeps ──
    case 'v5_evidence':
      return prose(
        false,
        ['evidence_gap', block.evidence_gap],
        ['suggested_technique', block.suggested_technique],
        ['impact_if_gathered', block.impact_if_gathered],
      )

    /**
     * ⚠ SOLE CONTENT. `V5ExerciseBlock` has no title: with every prose field
     * blank the renderer emits a bordered card with an icon and nothing to
     * read. Each field is individually truthiness-guarded, so partial
     * suppression degrades cleanly.
     */
    case 'v5_exercise':
      return prose(
        true,
        ['failure_scenario', block.failure_scenario],
        ['mitigation', block.mitigation],
        ['reference_class', block.reference_class],
        ['counter_case', block.counter_case],
        ['review_trigger', block.review_trigger],
      )

    /**
     * ⚠ SOLE CONTENT. The renderer's heading is the hard-coded word
     * "Explanation" — UI copy, not the producer's — so a blanked narrative
     * leaves a card titled "Explanation" saying nothing at all.
     */
    case 'v5_explanation':
      return prose(true, ['narrative', block.narrative])

    /**
     * Narrative plus a structure the block keeps. `v5_flip_analysis` is sole
     * content only when it carries no scenarios, because its heading is
     * hard-coded UI copy in exactly the way `v5_explanation`'s is.
     */
    case 'v5_flip_analysis':
      return prose(block.flip_scenarios.length === 0, ['narrative', block.narrative])
    case 'v5_comparison':
      return prose(false, ['narrative', block.narrative])
    case 'comparison':
    case 'premortem':
    case 'flip_analysis':
      return prose(false, ['narrative', (block as { narrative?: unknown }).narrative])

    // ── legacy exercise: instructions under a title the card keeps ────────
    case 'exercise':
      return prose(false, ['instructions', block.instructions])

    default:
      return NO_PROSE
  }
}

/**
 * A block with the named prose fields replaced by what survived suppression.
 *
 * A SHALLOW CLONE, because `BlockRenderer` hands the whole block object to
 * every renderer and none of them destructures prose at the dispatcher — so a
 * clone flows through all 21 arms with no renderer change and no new prop.
 * The original array is never mutated: the composition, the citation indices
 * and the store all keep reading the block exactly as ingested.
 */
export function withSuppressedProse(
  block: ConversationBlock,
  survived: ReadonlyMap<string, string>,
): ConversationBlock {
  if (survived.size === 0) return block
  const clone: Record<string, unknown> = { ...(block as unknown as Record<string, unknown>) }
  for (const [field, text] of survived) clone[field] = text
  return clone as unknown as ConversationBlock
}

/**
 * SECOND-CHANNEL ROUTING — a different question from suppression, kept apart
 * from it on purpose (UX gate 2026-08-18 point 4b).
 *
 * ## The producer fact
 *
 * CEE's `decision_review_enricher` emits the analysis narrative on TWO
 * channels of the SAME turn:
 *
 *   · `analysis_result.enrichment.decision_review.narrative_summary`
 *     — untyped prose inside the pinned answer card;
 *   · a `review_card` with `card_kind: "narrative"`, title "How the analysis
 *     reads" — the same string, byte for byte.
 *
 * Measured over every analysis-turn capture in this repo carrying
 * `narrative_summary` (8 payloads, 2026-07-31 → 2026-08-17): the narrative
 * card is present in 8/8, exactly one per turn, byte-identical in 8/8, and
 * always the turn's FIRST point candidate — so it is always top-level, never
 * demoted into the disclosure. The contrast that proves the measurement
 * discriminates: `readiness_rationale` is duplicated in 0/8.
 *
 * ## Why this is NOT `dedupeRenderedText`
 *
 * `dedupeRenderedText` answers "has a higher tier already rendered this exact
 * segment?" — a string question, deliberately narrow, and deliberately unable
 * to touch a typed card (withholding a line of a card changes what the card
 * means, and a card emptied of its body is a worse artefact than the
 * duplicate). Running it over these two surfaces would ALSO suppress a
 * legitimately repeated sentence the day CEE has a reason to repeat one, and
 * it would leave the two channels in place, hidden.
 *
 * The question here is not about strings at all. It is: WHICH CHANNEL
 * DELIVERS THIS CONTENT? Answered structurally, by block presence, so the
 * routing cannot depend on the prose staying byte-identical and cannot
 * silently start or stop discriminating when the wording changes. Two harms
 * under one predicate is the mistake this module already refuses to make
 * (trap 22b); this is the second predicate, named apart.
 *
 * ## Direction of the residual risk
 *
 * The card wins because it TITLES the content ("How the analysis reads") and
 * is always top-level. Absence of the card costs a duplicate, never a
 * paragraph — the caller's flag defaults to "not delivered", exactly as
 * `collectConsentSurfaceText` defaults to collecting nothing. The one thing
 * this cannot survive is CEE making the two channels carry DIFFERENT prose;
 * the spec pins that precondition against the corpus so a divergence REDs
 * rather than quietly dropping text.
 */
/**
 * ⚠ A HAND-MAINTAINED MIRROR OF CEE'S VOCABULARY, and named as one.
 *
 * `card_kind` is deliberately typed loosely on the wire so a future producer
 * kind passes through without a UI release, which means a CEE rename would
 * NOT be a type error here — this constant would simply stop matching and the
 * duplicate would come back. It fails OPEN (a duplicate, never a deletion),
 * which is the safe direction, but nothing in the type system REDs on drift.
 *
 * So the spec carries a CORPUS-DERIVED guard: it reads the narrative card's
 * `card_kind` out of every capture in the corpus and asserts it equals this
 * constant. Derivation cannot prove the constant is RIGHT, only that the
 * corpus and the code still agree — which is exactly the drift that would
 * silently reopen the defect (platform trap 12/12d).
 */
export const NARRATIVE_REVIEW_CARD_KIND = 'narrative'

/**
 * Does this turn deliver the analysis narrative as a TYPED, TITLED card?
 *
 * True iff the turn carries a review card of the narrative kind whose body
 * carries the narrative IN FULL. An empty card delivers nothing; so does a
 * card carrying only part of the paragraph.
 *
 * ⚠ THE BODY *IS* COMPARED, and this docstring used to say it never was.
 * The check is DELIVERY-COMPLETENESS, not de-duplication: the two channels
 * are never reconciled by matching prose, and a repeated sentence is never
 * suppressed for being repeated. What is asked is only whether the card
 * carries the whole of what the untyped copy would otherwise say — because
 * withholding a complete copy in favour of a truncated one deletes the tail.
 *
 * Do not "simplify" this back to presence-only. That is precisely the shape
 * that deleted the end of the paragraph: the card body is bounded BY THE
 * CONTRACT (`ReviewCardBlockSchema.body` is `.max(300)`), while
 * `narrative_summary` is not a declared field of
 * `EnrichmentDecisionReviewSchema` at all — that object is `.passthrough()`
 * and documented "deliberately open ... passes through verbatim". One channel
 * is capped by the spec and the other is uncapped by the spec, so the
 * overrun is ADMITTED BY THE CONTRACT, not merely observed.
 *
 * THE DELTA IS MONOTONE, which is why this is safe: no card still returns
 * false, and a card present returns true UNLESS there is positive evidence
 * of a short body. Every input that kept the untyped copy before still keeps
 * it — the change can only ever ADD kept copies, never remove one.
 */
export function turnDeliversNarrativeAsTypedCard(
  blocks: readonly ConversationBlock[] | undefined,
): boolean {
  if (!blocks || blocks.length === 0) return false

  let cardBody: string | null = null
  for (const block of blocks) {
    // `v5_review_card` ONLY — and that is the POST-ADAPTER type, not the wire
    // type. CEE sends `type: "review_card"` with `card_kind: "narrative"`
    // (`phase3-blocks.ts:2544-2545`); `adaptTypedReviewCardBlock`
    // (`src/v5/phase3TypedBlocks.ts:104-131`) accepts that wire type and
    // re-emits it as `v5_review_card`, carrying `card_kind` through verbatim.
    // Comparing this constant against CEE's wire literal therefore compares
    // across a translation boundary and reads as a mismatch that is not one.
    // `narrativeChannelContract.spec.ts` pins both ends against the shared
    // contract so a real divergence REDs.
    //
    // The legacy `review_card` was in this condition and was UNREACHABLE:
    // the UI's own `ReviewCardBlock` (types.ts) carries
    // title/body/variant/tone/priority and has NO `card_kind` at all.
    if (block.type !== 'v5_review_card') continue
    if (block.card_kind !== NARRATIVE_REVIEW_CARD_KIND) continue
    const body: unknown = block.body
    if (typeof body === 'string' && body.trim().length > 0) {
      cardBody = body
      break
    }
  }
  if (cardBody === null) return false

  // ── COMPLETENESS ────────────────────────────────────────────────────────
  // Presence of the card is not delivery of the narrative. CEE builds the
  // body as `truncate(narrative_summary, 300)`
  // (`phase3-blocks.ts:2529`, cap at `:214`), while `narrative_summary`
  // is uncapped free prose at every hop. When the narrative overruns, the
  // card carries a PREFIX — and withholding the untyped copy in favour of it
  // renders the tail NOWHERE.
  //
  // The rule this file already states, on the no-card twin, is that absence
  // of the card may only ever cost a DUPLICATE, never a paragraph. The same
  // rule decides this: a card that carries only part of the narrative has
  // not delivered it, so the complete copy stands. The cost is a
  // near-duplicate on long narratives; the alternative is deleting the end
  // of the producer's own paragraph.
  //
  // Deliberately CONTAINMENT, not equality: a future producer that frames the
  // narrative inside a longer body still delivers it in full. And the check
  // only ever flips the answer to false on POSITIVE evidence of a short body
  // — when the turn carries no readable narrative to compare against, the
  // structural verdict stands unchanged.
  const narrative = turnNarrativeSummary(blocks)
  if (narrative === null) return true
  return cardBody.trim().includes(narrative.trim())
}

/**
 * The turn's `narrative_summary`, read through the SAME canonical adapter the
 * analysis-result card renders from (`readDecisionReviewWireState`), so the
 * two can never disagree about what the untyped copy would say. A second
 * hand-rolled path-walk into `enrichment.decision_review` would be exactly the
 * parallel reader this platform keeps paying for.
 *
 * `null` when the turn carries no analysis-result block, no decision review,
 * or no narrative prose — all of which mean there is nothing to lose.
 */
function turnNarrativeSummary(blocks: readonly ConversationBlock[]): string | null {
  for (const block of blocks) {
    if (block.type !== 'v5_analysis_result') continue
    const state = readDecisionReviewWireState(block.enrichment)
    if (state.kind !== 'v0_30') continue
    const summary = state.review.narrative_summary
    if (typeof summary === 'string' && summary.trim().length > 0) return summary
  }
  return null
}

/**
 * Invariant 1, as an executable check: the composition is a TOTAL PARTITION of
 * the input indices. Exported so the spec binds the real function rather than
 * re-implementing the rule (a guard that re-states the code agrees with itself
 * — platform trap 13b).
 *
 * Returns null when the partition holds, or a description of the breach.
 */
export function assertTotalPartition(
  blockCount: number,
  composition: MessageComposition,
): string | null {
  const seen = new Set<number>()
  for (const e of [...composition.pinned, ...composition.points, ...composition.detail]) {
    if (seen.has(e.index)) return `index ${e.index} appears in more than one class`
    seen.add(e.index)
  }
  if (seen.size !== blockCount) {
    return `partition covers ${seen.size} of ${blockCount} blocks`
  }
  for (let i = 0; i < blockCount; i++) {
    if (!seen.has(i)) return `index ${i} is in no class`
  }
  return null
}

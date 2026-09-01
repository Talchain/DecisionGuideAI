/**
 * ⭐ ONE GLYPH PER PROVENANCE KIND — the icon half of `VALUE_PROVENANCE_LABEL`.
 *
 * The founder, against deployed staging `d4ff3683`: *"We're not using enough
 * iconography. There's lots of text with things like AI Estimate and From Brief,
 * when they should all be icons with hoverover states."* On a real 14-node model
 * **9 of 14 cards read "AI estimate"**, 4 read "From brief", 1 read "Set by
 * you". Copy identical on every card is furniture, not information.
 *
 * ─── ⚠ WHY THIS IS A REGISTER AND NOT A GLYPH PICKED AT THE CALL SITE ───────
 * The estate already learned this with the WORDS. `VALUE_PROVENANCE_LABEL`'s
 * header records why they moved out of `SourceProvenancePill`: two spellings of
 * one authorship claim, free to drift into disagreeing about the same factor.
 * A glyph is the same claim in a different alphabet — a second picture for "AI
 * estimate" is how one idea comes to have two names (CLAUDE.md trap 12). So the
 * mapping lives here, TOTAL over `ValueProvenanceKind`, and a new kind is a
 * TYPE ERROR rather than a silent fallback at every consumer.
 *
 * ⚠ NOTHING HERE IS INVENTED — every glyph is one this estate already uses for
 * this concept, and the byte read that established each is on its row. The one
 * exception is `panel`, named as such rather than smuggled in.
 *
 * ⛔ WHAT THIS FILE DELIBERATELY IS NOT: it is NOT a second classifier.
 * `classifyNodeProvenance` / `classifyValueProvenance` remain the only
 * authorities on what a literal MEANS; this maps an already-classified kind to
 * a mark. A consumer that reaches for a glyph without going through a
 * classifier is inventing an attribution, which is the exact defect
 * `NodeProvenanceMark` exists to make impossible.
 *
 * ─── ⚠ LAYERING, STATED RATHER THAN DISCOVERED ─────────────────────────────
 * `domain/` is otherwise UI-library-free, and this file imports `lucide-react`.
 * It holds component REFERENCES only (no JSX, no rendering), and it sits here
 * because the alternative — parking it in `nodes/shared/` — would make the
 * Reasoning tab import a canvas-node module to answer a question the domain
 * layer already owns, which is how the labels ended up owned by a pill in the
 * first place. If `domain/` is ever made import-clean by a guard, this file is
 * the one to move, and it moves WHOLE so the register stays single.
 */
import {
  CheckCircle,
  FileText,
  Flag,
  Pencil,
  Sparkles,
  UserCheck,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { ValueProvenanceKind } from './valueProvenance'

/**
 * ⚠ NOT ONE OF THE RESERVED NODE-TYPE GLYPHS. `DESIGN_SYSTEM.md`
 * §"Node-type icons (off-canvas use only)" reserves `Target`, `GitBranch`,
 * `Lightbulb`, `Settings`, `AlertTriangle` and `TrendingUp` for goal /
 * decision / option / factor / risk / outcome, and says plainly that on the
 * canvas *shapes* identify node type. Provenance is not node type, so a mark
 * here is allowed — but reusing one of those six on a card would collide with
 * a reserved meaning, so none of them appears below. Checked by hand against
 * the table, not assumed.
 */
export const VALUE_PROVENANCE_ICON: Readonly<Record<ValueProvenanceKind, LucideIcon>> =
  Object.freeze({
    /**
     * Extracted from the user's own brief. `FileText` is already this estate's
     * "a document the user gave us" glyph — `TemplateCard`, `DocumentsDrawer`,
     * `ProvenanceHub`, `ProvenanceHubTab` all use it for exactly that.
     */
    brief: FileText,
    /**
     * The model's own estimate. `Sparkles` is the estate's AI glyph by a wide
     * margin — `CoachingTip`, `SuggestionCard`, `AcceptOverrideControl`,
     * `CoachingCard`, `AssistantFocusChip`, `DraftChat`, and the legacy
     * `ProvenanceBadge`'s own `'ai-suggested'` row.
     */
    ai: Sparkles,
    /**
     * A person owns the value but the record does not say which act — the
     * wire-level `user_set`.
     *
     * ⭐ `UserCheck`, NOT bare `User` (Paul's call, 1 Sep 2026). The claim this
     * mark has to carry is **human-vetted or human-provided**, and neither half
     * of that survives on its own: a bare person says "a human" without saying
     * they stood behind the number, and a bare tick says "done" without saying
     * by whom. The pair says it in one glyph.
     *
     * It also has to READ against its two siblings on the same card, which is
     * what actually decides a canvas glyph: `Sparkles` = the machine made this
     * up, `FileText` = lifted from your document, `UserCheck` = a person stood
     * behind it. The discriminator between them is the SHAPE (spark / page /
     * person), and the tick only qualifies the person — so the set stays
     * legible when the glyphs are small.
     *
     * ⚠ Deliberately NOT `Pencil`: that is `edited`'s glyph below, for when the
     * record says the human SUPPLIED the number. `user_set` does not say which
     * act occurred, so a glyph asserting authorship would claim more than the
     * wire does — the same over-claim this whole register exists to avoid.
     */
    human: UserCheck,
    /**
     * The human read the number that was there and endorsed it.
     * `ProvenanceBadge`'s `'accepted'` row uses bare `Check`; `CheckCircle` is
     * the Tier-3 STATUS member of that family in `DESIGN_SYSTEM.md`
     * §"Visibility tiers", and a status mark is what this is.
     */
    confirmed: CheckCircle,
    /**
     * The human supplied the number. `Pencil` is the estate's edit glyph
     * (`SuggestionCard`, `AcceptOverrideControl`).
     *
     * ⚠ NOT REACHABLE FROM A CANVAS CARD TODAY, and the scope is stated rather
     * than generalised (CLAUDE.md trap 20): `classifyNodeProvenance` recognises
     * three literals only, so `NodeProvenanceMark` can render `brief`, `ai` and
     * `human` and nothing else. `Pencil` is a Tier-2 ACTION glyph in
     * §"Visibility tiers"; used as a persistent status mark it could read as a
     * clickable edit. That question is owed by whichever surface first renders
     * this kind persistently — it is not owed by the canvas mark, which cannot
     * reach it.
     */
    edited: Pencil,
    /**
     * Recorded as an explicit assumption. `Flag` is already the canvas's
     * assumption mark — `BaseNode`'s `assumption-badge` renders
     * `Flag as FlagIcon` for `data.flagged_as_assumption`.
     */
    assumption: Flag,
    /**
     * A named colleague's panel answer, adopted by the owner.
     *
     * ⚠ THE ONE GLYPH WITH NO PRIOR USE IN THIS ESTATE, named as new rather
     * than presented as reuse. `Users` is the plural of the `human` mark, which
     * is the relationship the kind itself has: somebody ELSE vouched for this
     * number. Also unreachable from a canvas card today.
     */
    panel: Users,
  })

/**
 * The DS canvas-node-badge size, in CSS px.
 *
 * `DESIGN_SYSTEM.md` §Iconography sizing table: *"Canvas node badge / panel
 * inline | 14px | `w-3.5 h-3.5`"*. Exported as a number so a legibility claim
 * can be ARITHMETIC rather than a DOM read — jsdom has no layout, and
 * `zoomLegibility.renderedLabelPx` exists for exactly this.
 */
export const PROVENANCE_ICON_DECLARED_PX = 14

/**
 * ⭐⭐ THE RATIFIED 14px, CARRIED THROUGH THE CANVAS COUNTER-SCALE — WITHOUT
 * WHICH THE RATIFIED SIZE IS NOMINAL RATHER THAN TRUE.
 *
 * Node DOM sits inside React Flow's viewport transform, which scales it. A
 * post-draft auto-fit parks at `LABEL_LEGIBLE_ZOOM` (0.50) because
 * `useFitViewOnLayoutVersion` passes it as `minZoom`, so a plain `w-3.5` would
 * reach the user at **7px** on the default whole-model view — half the size the
 * design system ratified, and past the point where a glyph is identifiable.
 *
 * This is not a size chosen here. It is the DS's own 14px, multiplied by the
 * same `--canvas-label-scale` the canvas type tokens carry
 * (`styles/typography.ts` §canvas), so `declared × scale × zoom` resolves to 14
 * across the whole legible band and degrades exactly as the text beside it does
 * below the floor. The `var(…, 1)` fallback is load-bearing in the same way:
 * outside the React Flow subtree the property is unset and the icon is a plain
 * 14px, so any future off-canvas consumer of this register is unaffected.
 */
export const PROVENANCE_ICON_SIZE_CLASSES =
  'w-[calc(14px*var(--canvas-label-scale,1))] h-[calc(14px*var(--canvas-label-scale,1))]'

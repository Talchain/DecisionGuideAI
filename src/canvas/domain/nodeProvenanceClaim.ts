/**
 * ⭐⭐ WHICH CLAIM MAY THIS CARD MAKE ABOUT `data.provenance`?
 *
 * ─── THE DEFECT ─────────────────────────────────────────────────────────────
 * `data.provenance` is ONE field answering DIFFERENT questions depending on the
 * node kind it arrives on — this estate's chronic defect (CLAUDE.md trap 21).
 * `NodeProvenanceMark` renders `VALUE_PROVENANCE_LABEL`, which spells it
 * **"AI estimate" / "From brief" / "Set by you"** — words about a NUMBER. A
 * corpus of 8 deployed draft captures, counted on `draft_graph.nodes[].kind`:
 *
 *   | kind          | nodes | carrying any value key |
 *   |---------------|-------|------------------------|
 *   | factor        |    10 |                      8 |
 *   | risk          |     7 |                      0 |
 *   | outcome       |     4 |                      0 |
 *   | option        |    10 |                      0 |
 *   | goal/decision |     4 |                      0 |
 *
 * So on 21 of 25 non-factor cards the product asserted an *estimate* of a
 * number that does not exist on that node.
 *
 * ─── ⛔ AND SUPPRESSION IS THE WRONG FIX (the first attempt; withdrawn) ─────
 * The instinct was to delete the mark from every kind without a value. That
 * destroys the signal to fix the wording. On an OPTION, `provenance` means
 * something genuinely valuable — *did Olumi suggest this option, or did I bring
 * it?* — and the founder specifically valued learning that 9 of 14 elements on
 * his model were Olumi's. Deleting the mark from 21 of 25 cards to fix a
 * sentence is the cure killing the patient.
 *
 * **The defect is the WORDING, not the presence.** So this module adds a second
 * AXIS — which claim to make — and changes nothing about the first.
 * `classifyNodeProvenance` remains the ONE authority on what a literal MEANS;
 * this answers only which vocabulary may say it.
 *
 * ─── THE THREE ANSWERS ──────────────────────────────────────────────────────
 *   · `'value'`      — the card carries a modelled number and `provenance` is
 *                      about it. `VALUE_PROVENANCE_LABEL` applies.
 *   · `'structural'` — no number here. The honest claim is about the ELEMENT:
 *                      "Olumi suggested this" / "From your brief" /
 *                      "You added this". Never "estimate".
 *   · `'none'`       — say nothing at all.
 *
 * ─── ⚠ THE GOAL IS SILENT ONLY WHERE ITS OWN CARD IS ALREADY SPEAKING ───────
 * `GoalNode` renders this exact wire literal, correctly scoped, as
 * `GOAL_LABEL_FROM_BRIEF_COPY.pill` ("From your brief"). Shipped together they
 * produced the duplication measured on deployed staging `be33648b`: **one wire
 * literal in two spellings, 18px apart**, which a reader cannot tell is one
 * fact.
 *
 * ⚠ BUT THAT PILL FIRES FOR `from_brief` ALONE. Suppressing the mark on the
 * KIND — the first version of this module — deleted the fact outright on a goal
 * carrying `user_set` or `ai_inferred`, because neither has a competing
 * surface. That is the same over-suppression this module was written to reject.
 * The gate is therefore the goal surface's OWN predicate
 * (`goalLabelIsUnconfirmedBriefExtract`), so silence is granted exactly where
 * something else is already saying it, and nowhere else.
 *
 * `decision` is NOT suppressed. It has no competing surface, and "Olumi
 * suggested this" is true and useful about a question Olumi framed. The old
 * "AI estimate" was false about it; the structural claim is not.
 *
 * ─── ⚠ THE SPLIT IS DERIVED, NOT HAND-LISTED ────────────────────────────────
 * `VALUE_FIELDS_BY_KIND` names, per kind, the field(s) that kind's OWN data
 * schema declares as a value carrier. It is guarded from drift in two
 * directions by `nodeProvenanceClaim.schemaDerivation.spec.ts`, which reads the
 * Zod shapes themselves:
 *
 *   (a) every field named here must actually be declared by that kind's schema
 *       and must NOT come from the shared `NodeDataSchema` base — so a renamed
 *       or deleted field REDs rather than silently making a kind structural;
 *   (b) a kind named here with NO value fields must have no own-schema key that
 *       intersects the estate's value vocabulary — so a kind that GAINS a value
 *       field REDs rather than silently keeping the structural claim.
 *
 * A derived guard proves agreement and can never prove completeness (trap 12d),
 * which is why (b) exists: it is the completeness half, written against the
 * schema rather than against this list.
 *
 * The switch below is EXHAUSTIVE with NO `default`, so adding a member to
 * `NodeTypeEnum` fails the typecheck until someone answers this question for it
 * — the alarm is the compiler, not a comment asking to be remembered.
 *
 * ⚠ WHY `interventions` IS NOT A VALUE FIELD OF AN OPTION. An option's
 * `interventions` record holds values it sets on OTHER nodes. `provenance` on
 * the option answers who put the OPTION on the board, not who chose those
 * numbers — which is precisely the conflation this module exists to end.
 */
import type { NodeType } from './nodes'
import { VALUE_PROVENANCE_LABEL, type ValueProvenanceKind } from './valueProvenance'
import {
  GOAL_LABEL_FROM_BRIEF_COPY,
  goalLabelIsUnconfirmedBriefExtract,
} from './goalLabelProvenance'

/** Which vocabulary, if any, may describe `data.provenance` on this card. */
export type NodeProvenanceClaim = 'value' | 'structural' | 'none'

/**
 * ⭐ THE STRUCTURAL VOCABULARY — a claim about the ELEMENT, never about a number.
 *
 * TOTAL over `ValueProvenanceKind`, in the same shape as
 * `VALUE_PROVENANCE_LABEL`, so a new kind is a type error here rather than a
 * silent fallback at the card.
 *
 * ⚠ `brief` REUSES `GOAL_LABEL_FROM_BRIEF_COPY.pill` RATHER THAN RESPELLING IT.
 * The duplication this whole change exists to fix was one wire literal wearing
 * two spellings; authoring a second "From your brief" here would rebuild it in
 * the same commit that removes it.
 */
export const STRUCTURAL_PROVENANCE_LABEL: Readonly<Record<ValueProvenanceKind, string>> =
  Object.freeze({
    /** Olumi read it out of the user's own document. */
    brief: GOAL_LABEL_FROM_BRIEF_COPY.pill,
    /** Olumi put this element on the board. The founder's actual question. */
    ai: 'Olumi suggested this',
    /** A person put it there; the wire does not say by which act. */
    human: 'You added this',
    confirmed: 'You confirmed this',
    edited: 'You added this',
    assumption: 'Your assumption',
    panel: 'From your panel',
  })

/**
 * The value-carrying field(s) each kind's OWN data schema declares.
 *
 * ⚠ EVERY ONE OF THESE IS `.optional()` IN THE SCHEMA, INCLUDING THE FACTOR'S.
 * That is why the claim is carrier-dependent rather than kind-only: a factor
 * that arrived with no observed value has no number to attribute either, and
 * saying "AI estimate" about it is the same false claim, just rarer. Kind alone
 * cannot answer this question — the corpus above shows it for `risk` and the
 * schema shows it for `factor`.
 *
 * ⚠ EXPORTED FOR ITS GUARD, NOT FOR CONSUMERS. `nodeProvenanceClaim` is the
 * only thing that should read it; `nodeProvenanceClaim.schemaDerivation.spec.ts`
 * needs it to check the list against the Zod shapes in both directions.
 */
export const VALUE_FIELDS_BY_KIND: Readonly<Record<NodeType, readonly string[]>> = Object.freeze({
  // `observedState` holds the runtime value; `display_value` is CEE's top-level
  // wire spelling of the same thing, and a factor can arrive with only that.
  factor: ['observedState', 'display_value'],
  // Declared OPTIONAL — a risk with no probability states no number.
  risk: ['probability'],
  // Declared OPTIONAL. Never emitted as a canvas node today; handled by rule
  // rather than by exception so it cannot become a gap.
  constraint: ['thresholdValue'],
  goal: [],
  decision: [],
  option: [],
  outcome: [],
  action: [],
})

/** Read a declared value field off a node's `data`, tolerating both spellings. */
function carriesDeclaredValue(nodeType: NodeType, data: unknown): boolean {
  const d = data as Record<string, unknown> | null | undefined
  if (!d || typeof d !== 'object') return false
  return VALUE_FIELDS_BY_KIND[nodeType].some((field) => {
    // Canvas stores `observedState`; the CEE/PLoT wire uses `observed_state`,
    // and real graphs carry both. Reading one under-counts — the same lesson
    // `factorNeedsVerification` records.
    const snake = field.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
    const v = d[field] ?? d[snake]
    if (v === null || v === undefined) return false
    if (typeof v === 'string') return v.trim().length > 0
    return true
  })
}

/**
 * Which claim this card may make. Takes the kind AND the node's `data`, because
 * for the optional-value kinds the schema alone cannot answer it.
 */
export function nodeProvenanceClaim(nodeType: NodeType, data: unknown): NodeProvenanceClaim {
  switch (nodeType) {
    /**
     * ⛔ SILENT ONLY WHERE THE GOAL CARD IS ALREADY SPEAKING — and this is
     * DERIVED from the goal surface's own predicate, not from the kind.
     *
     * ⚠ THE FIRST VERSION OF THIS RETURNED `'none'` FOR EVERY GOAL, AND THAT
     * WAS THE OVER-SUPPRESSION THIS MODULE EXISTS TO REJECT, COMMITTED INSIDE
     * THE MODULE THAT REJECTS IT. `goalLabelIsUnconfirmedBriefExtract` fires
     * for `kind === 'brief'` ONLY (`from_brief`), so `GoalNode`'s pill renders
     * for that literal and NOTHING ELSE. A goal carrying `user_set` — which
     * `provenanceAfterHumanAuthoredLabel` stamps the moment a human authors the
     * label, and which the pill deliberately disappears on — or `ai_inferred`
     * had no competing surface at all. Blanket suppression therefore DELETED
     * the fact on those two literals instead of de-duplicating it: exactly the
     * "smaller half of its own defect" charge laid against the earlier design.
     *
     * So the gate is the goal surface's OWN predicate. Where that surface
     * speaks, this one is silent; where it does not, the structural claim
     * stands. The two cannot drift, because there is one predicate.
     */
    case 'goal':
      return goalLabelIsUnconfirmedBriefExtract(
        data as { provenance?: unknown } | null | undefined,
      )
        ? 'none'
        : 'structural'

    // Carrier-dependent: the schema declares an optional value field, so the
    // node itself decides which claim is true of it.
    case 'factor':
    case 'risk':
    case 'constraint':
      return carriesDeclaredValue(nodeType, data) ? 'value' : 'structural'

    // No value field declared at all. `provenance` here can only be about the
    // element — who put it on the board — and that is worth saying.
    case 'decision':
    case 'option':
    case 'outcome':
    case 'action':
      return 'structural'
  }
}

/**
 * The label this card may show for an already-classified kind.
 *
 * ⚠ NOT A SECOND CLASSIFIER. The `kind` argument comes from
 * `classifyNodeProvenance` and nothing here re-decides what a literal means.
 */
export function provenanceClaimLabel(
  claim: Exclude<NodeProvenanceClaim, 'none'>,
  kind: ValueProvenanceKind,
): string {
  return claim === 'value' ? VALUE_PROVENANCE_LABEL[kind] : STRUCTURAL_PROVENANCE_LABEL[kind]
}

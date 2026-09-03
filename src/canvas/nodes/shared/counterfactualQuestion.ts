/**
 * counterfactualQuestion — the ONE sentence behind the "What if … worsens?"
 * affordance on Risk and Factor cards.
 *
 * ⛔ THE INVARIANT THIS MODULE EXISTS TO HOLD: the sentence a user READS and the
 * sentence sent on their BEHALF are THE SAME STRING — not two expressions that
 * happen to agree today.
 *
 * Before this module, each card composed the question twice, at two adjacent
 * lines, and the two copies had drifted in three separate ways:
 *
 *   • `RiskNode.tsx` rendered the subject sliced to 18 chars + "..." INSIDE the
 *     sentence, and sent the full untruncated subject. A user read
 *     "What if which we believe is p… worsens?" and asked something else.
 *   • `FactorNode.tsx` rendered `cleanedLabel.toLowerCase()` and sent
 *     `cleanedLabel` un-lowercased.
 *   • `FactorNode.tsx` additionally sent a trailing "How should I plan for that
 *     scenario?" that appeared nowhere on screen.
 *
 * None of these is visible without diffing two adjacent lines, which is exactly
 * why all three shipped. The defence is structural, not vigilance: there is now
 * ONE composition, and both the label and the message read its single output.
 *
 * ⚠ NO CHARACTER SLICE LIVES HERE, AND NONE MAY BE ADDED.
 * If the subject is too long for the affordance, that is a PRESENTATION problem
 * and belongs in CSS on the element — never in the sentence. A slice inside the
 * sentence is precisely the defect above: it produces a DIFFERENT SENTENCE, and
 * a different sentence is a different question.
 *
 * ⚠ THIS IS DELIBERATELY A LOCAL COMPOSITION, NOT A RELOCATION.
 * Moving question composition to CEE is separate, already-agreed work owned
 * elsewhere. This module exists so that relocation later replaces ONE string
 * rather than reconciling two.
 *
 * ⚠ FORWARD CONTRACT: a short noun-phrase `name` (banked upstream, alongside
 * `claim`) will supply the subject for exactly this purpose, and explicitly
 * forbids a consumer keeping its own slice. When it arrives, callers pass
 * `name` here instead of the display label and nothing else changes — there is
 * no consumer-side truncation to unpick, by construction.
 */

/**
 * Compose the counterfactual question for `subject`.
 *
 * Returns `null` when the subject is empty or whitespace-only, so callers
 * render no affordance at all rather than offering "What if  worsens?" — a
 * question the product cannot answer and the user did not ask. Fail-closed:
 * the affordance is withheld, never shown in a degenerate form.
 *
 * The subject is passed through verbatim apart from trimming. In particular it
 * is NOT re-cased: node labels are authored by the user or drafted by CEE, and
 * lower-casing them corrupts proper nouns and acronyms ("EU tariffs" →
 * "eu tariffs"). The product does not silently rewrite the user's own words.
 */
export function composeCounterfactualQuestion(subject: string | null | undefined): string | null {
  const trimmed = (subject ?? '').trim()
  if (trimmed.length === 0) return null
  return `What if ${trimmed} worsens?`
}

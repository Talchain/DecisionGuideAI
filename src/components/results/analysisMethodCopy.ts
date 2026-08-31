/**
 * Standing disclosures about the ANALYSIS METHOD itself.
 *
 * These are true of every run, derive from no producer field, and are owed to
 * the reader by every surface that presents a result as a result. They live
 * here so there is exactly ONE spelling of each.
 *
 * ⚠ WHY THIS FILE EXISTS AT ALL. The sentence below shipped as an inline
 * literal inside `AdvancedSection` — the existing Analysis tab's "Advanced and
 * receipts". `Deeper analysis and evidence` on the Analysis (New) tab owes the
 * same disclosure, and hand-typing a second copy of it is the hand-maintained
 * mirror this estate keeps paying for (CLAUDE.md trap 12): the day one is
 * reworded, the two surfaces disagree about what the model does not capture and
 * nothing reds. Both surfaces now import this constant, so the two cannot
 * drift; `__tests__/scienceLimitationsSingleSpelling.spec.ts` pins that there is
 * no second literal anywhere in the tree.
 *
 * ⚠ EXTRACTING A LITERAL IS NOT LICENCE TO IMPROVE IT. The wording is the
 * shipped one, character for character. A reworded disclosure is a new claim
 * about the science and is not this lane's to make.
 */

/**
 * What the structural causal model does NOT capture.
 *
 * A trust surface: without it the panel is quietly more confident than the
 * analysis warrants. Producer-independent — it describes the method, not the
 * run — so it carries no gate and renders wherever an analysis is being read
 * back.
 */
export const SCIENCE_LIMITATIONS_DISCLOSURE =
  'This analysis uses a simplified structural causal model. Some uncertainty sources (intercepts, node-level noise) are not yet captured.'

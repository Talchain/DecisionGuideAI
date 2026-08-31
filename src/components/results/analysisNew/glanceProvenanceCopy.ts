/**
 * The glance's CONDITION LINE — what the reading above it rests on.
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
 * Olumi's alignment principle states that analysis describes what the current
 * model implies, CONDITIONAL ON ITS ASSUMPTIONS AND EVIDENCE, and that
 * AI-generated estimates must be distinguishable from user-supplied knowledge.
 * "At a glance" stated the consequent prominently — "Ahead in 68% of simulated
 * futures" — with the antecedent nowhere on the surface. On a run driven on
 * 30 Aug 2026 every input was Olumi's own estimate and the panel said so
 * nowhere.
 *
 * ── WHY THESE STRINGS AND NOT SHORTER ONES ─────────────────────────────────
 * Six kinds, not two, because the producer's provenance signal is THREE-STATE
 * and the third state is the point (see `HeroDriverValueProvenance`). A run
 * where every factor is positively marked as the user's is a different claim
 * from one where SOME are the user's and the rest were never asserted either
 * way. Collapsing the second into the first would author exactly the
 * user-authorship claim this line exists to keep honest.
 *
 * ── WHY THE SIXTH SENTENCE EXISTS ──────────────────────────────────────────
 * Because on real payloads it is the most common answer, and the surface had
 * no word for it. Replaying the oracle over every factor-bearing capture in
 * this repo, nine files hold rows the producer settled in NEITHER direction —
 * and on those nine this panel rendered a prominent share with its basis
 * stated nowhere. Silence is honest about the producer; it is NOT honest about
 * the reading, which the reader would otherwise take as resting on something
 * established. `undetermined` states the one thing that is true.
 *
 * ⛔ NO NUMBER AND NO COUNT, DELIBERATELY. The producer supplies a per-factor
 * provenance flag, not a proportion. "Six of nine inputs were estimated" is a
 * quantity nothing on the wire licenses, and this surface has already had three
 * invented metrics caught on it. A stated condition is what the evidence
 * supports, so a stated condition is what this renders.
 */

import type { GlanceInputProvenance } from './analysisNewTypes'

/**
 * One sentence per provenance kind. British English.
 *
 * The "Partly" forms are EXISTENTIAL claims and are the honest reading when the
 * producer asserted provenance for some factors and stayed silent on others:
 * at least one factor is known to be what the sentence says, and the sentence
 * claims nothing about the rest. The unqualified forms are UNIVERSAL and are
 * used only when the producer settled every factor.
 */
export const GLANCE_PROVENANCE_COPY: Record<GlanceInputProvenance, string> = {
  estimated: 'On inputs Olumi estimated',
  partly_estimated: 'Partly on inputs Olumi estimated',
  mixed: "On a mix of your figures and Olumi's estimates",
  user_supplied: 'On figures you supplied',
  partly_user_supplied: 'Partly on figures you supplied',
  // ⚠ A STATEMENT ABOUT OUR KNOWLEDGE, NOT ABOUT THE USER — which is exactly
  // why it is safe to render where the other five are not. It attributes the
  // figures to nobody, so it cannot commit the authorship claim this module
  // exists to prevent, and it leaves the reading above it visibly conditional
  // instead of silently unconditioned.
  undetermined: 'On inputs whose source Olumi could not establish',
}

/**
 * ⚠ UI-AUTHORED TEXT, NOT PRODUCER PROSE.
 *
 * When a readiness improvement arrives with neither `action` nor
 * `recommendation`, `readinessStore` SYNTHESISES this line so the improvements
 * LIST still renders a row. That is legitimate for a list of suggestions. It is
 * NOT legitimate anywhere the text is presented as the producer naming what is
 * missing — once it is in the field a synthesised sentence is indistinguishable
 * from a real one, which is a worse failure than generic copy: generic copy is
 * visibly generic.
 *
 * ── WHY THIS IS ITS OWN MODULE ─────────────────────────────────────────────
 * The fabricating module (`stores/readinessStore`) and the refusing module
 * (`utils/composeBlockedReason`) must agree by IDENTITY, never by two copies of
 * a literal — a copy is a hand-maintained mirror and would drift silently the
 * day this wording changes, leaving the refusal passing while the fabrication
 * ships. An import cannot drift; it breaks the build.
 *
 * It lives in a LEAF with no imports of its own because the alternative — the
 * composer importing the store — is a value import that would drag store module
 * side effects into every consumer of `canRunAnalysis`, which is most of the
 * canvas. A shared constant should not carry a store's initialisation with it.
 */
export const IMPROVEMENT_ACTION_PLACEHOLDER = 'Review this area'

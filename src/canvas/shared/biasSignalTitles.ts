/**
 * biasSignalTitles — the ONE canonical bias-signal registry: CEE bias code
 * → { humanised title, Lucide icon }. (#356 fast-follow grew this from a
 * titles-only map into the full registry — review-folds 2026-07-17: the
 * panel-local icon channel was a hand-maintained mirror with a dual-case
 * key space, a diverging CONFIRMATION_BIAS icon, prototype-chain crash
 * codes and a vacuous drift trap. One lowercase-keyed map + one guarded
 * resolver kills all four at the root.)
 *
 * Importers:
 *   - src/canvas/conversation/draftBiasSignalBlocks.ts (v5_coaching
 *     bias-signal card titles; fail-closed allowlist lookup)
 *   - src/canvas/components/pre-analysis/PreAnalysisPanel.tsx (bias
 *     trigger cards + deterministic-trigger names)
 *   - src/canvas/hooks/useScienceIcons.ts, src/canvas/nodes/OptionNode.tsx,
 *     src/canvas/nodes/DecisionNode.tsx (composed trigger/tooltip names)
 *
 * Keys are canonical lowercase; `resolveBiasSignal` lowercases first (both
 * wire conventions arrive: lowercase `type` and uppercase `code`) and
 * guards with an own-key check so hostile prototype-chain codes
 * ('__proto__' → Object.prototype, 'constructor' → Function) can never
 * escape as a truthy config. Unknown codes are the caller's fail-closed
 * concern — this registry never invents a title. Drift traps:
 * biasSignalTitles.parity.spec.ts.
 *
 * CONFIRMATION_BIAS icon: the pre-registry panel map carried Frame on the
 * lowercase row and Gauge on the uppercase row (silent divergence).
 * Canonical pick: Frame — the lowercase/wire-common row.
 */
import { Anchor, EyeOff, Frame, Gauge } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface BiasSignalEntry {
  title: string
  icon: LucideIcon
}

/**
 * ⭐⭐ THE HEADING FOR AN OBSERVATION WHOSE CATEGORY WE DO NOT RECOGNISE.
 *
 * ⚠ NOT AN INVENTED TITLE, and the distinction is why it belongs here. This
 * registry's rule is that it never invents a BIAS NAME for an unknown code.
 * That rule is unchanged and this constant obeys it: it names NOTHING about
 * which bias the observation concerns. It is the heading a card carries when we
 * decline to name one.
 *
 * ── WHY IT EXISTS ───────────────────────────────────────────────────────────
 * `draftBiasSignalBlocks` used to `continue` on an unresolved code, which
 * dropped the WHOLE signal — including `detail`, the producer's actual
 * observation. So the model naming a bias in words the UI has no key for meant
 * the coaching never reached the reader at all. The shipped `build-vs-buy`
 * starter carries exactly that: `"type": "omission / status-quo bias"`, free
 * text, no key, and a real paragraph nobody has ever seen.
 *
 * That inverts the feature — the LESS standard the insight, the more likely it
 * was binned — and it is Paul's ruling in miniature: no hiding, caveat instead.
 *
 * ⚠ AND IT IS A QUESTION, NOT A FINDING. "Reasoning check" invites the reader
 * to examine something; it does not announce that a bias has been detected.
 * That matters because the observation may itself be contestable — the
 * starter's paragraph asserts a baseline with full factor connections carries
 * "unwarranted analytical weight", which does not follow from having
 * connections. Rescuing it from silence must not upgrade it into a validated
 * diagnosis.
 */
export const UNRECOGNISED_BIAS_SIGNAL_TITLE = 'Reasoning check'

/**
 * ⚠⚠ A SECOND NAME FOR THIS CONCEPT IS ALREADY SHIPPED, AND I AM NOT
 * UNIFYING IT HERE — IT IS FLAGGED, NOT FIXED.
 *
 * `PreAnalysisPanel` has carried `BIAS_FALLBACK = { title: 'Bias detected' }`
 * since the brief, for exactly this case: a code the registry does not hold
 * still gets a card, under a generic heading. So the ruling this file's
 * constant implements was ALREADY the estate's behaviour on the sibling
 * surface — the draft bridge was the outlier in discarding the entry, not the
 * innovator in keeping it.
 *
 * Two names for one concept is the divergence this registry exists to kill
 * (see the CONFIRMATION_BIAS Frame/Gauge note in the header). They are not
 * unified in this change for one reason and one only: 'Bias detected' asserts
 * a finding, and the paragraph underneath it may not support one — so
 * unifying means changing SHIPPED pre-analysis copy, which is a separate
 * surface with its own review. Recorded here so the next reader finds the
 * divergence rather than discovering it as a bug.
 */

/**
 * Entity-ID prefixes that must NEVER be read as a bias category. Hoisted here
 * from `PreAnalysisPanel` (which re-exports it, so its existing importers and
 * its per-prefix drift spec are untouched) because BOTH bias surfaces need
 * the same question answered and a second copy is the mirror defect.
 *
 * Lockstep replica of the canonical CEE pattern at
 *   olumi-assistants-service:src/orchestrator/shared/entity-id-pattern.ts
 * (also mirrored at tools/v5-journey-replay/output-safety.ts). The two repos
 * share no package boundary; update both together when it changes.
 *
 * ⭐ WHY THIS MATTERS TO THE DRAFT BRIDGE, and why it is not a heuristic I
 * invented. An unrecognised code and an entity id look alike from inside the
 * UI — both are strings the registry does not hold — but they are different
 * facts about the producer. `'omission / status-quo bias'` is a CATEGORY the
 * UI has no key for. `'fac_current_supplier'` is a NODE REFERENCE sitting in
 * the category slot: the producer populated the wrong field, and the entry is
 * malformed in the same way `type: 42` is. Telling them apart needs the
 * producer's own id convention, which is what this list is — not a shape rule
 * written from the UI's imagination (CLAUDE.md trap 22).
 */
export const FORBIDDEN_TYPE_PREFIXES = [
  // Canonical CEE entity-ID prefixes (lockstep with ENTITY_ID_RE)
  'fac_', 'opt_', 'goal_', 'dec_', 'out_', 'risk_',
  'con_', 'factor_', 'option_', 'decision_', 'outcome_', 'constraint_',
  // UI-side defensive prefixes
  'node_', 'edge_',
] as const

/**
 * True when a wire code is shaped like a graph entity id rather than a bias
 * category. Callers use it AFTER `resolveBiasSignal` misses, never before: a
 * code the registry holds is a category by definition, so the registry always
 * wins and no future key can be shadowed by a prefix collision.
 */
export function isEntityIdShapedCode(code: unknown): boolean {
  if (typeof code !== 'string') return false
  const lower = code.trim().toLowerCase()
  return FORBIDDEN_TYPE_PREFIXES.some((prefix) => lower.startsWith(prefix))
}

/**
 * ⭐⭐ THE ONE QUESTION A CALLER RESCUING AN UNRECOGNISED SIGNAL ACTUALLY ASKS:
 * **is this string a bias CATEGORY at all?** — which is NOT the question
 * `resolveBiasSignal` answers.
 *
 * That resolver answers *"is this a code I hold?"*, and a caller that reads its
 * miss as "an unrecognised category" collapses two questions into one (the
 * estate's signature defect). Three classes sit between them, and every one is
 * a producer FAULT rather than an unfamiliar name:
 *
 *   · ABSENT / NON-STRING — `''`, `42`, a missing key. The wire schema types
 *     `type` as a required string, so the entry violates its own contract.
 *   · ENTITY-ID SHAPED — `fac_current_supplier`. A node reference in the
 *     category slot; the producer populated the wrong field.
 *   · A PROTOTYPE-CHAIN KEY — `__proto__`, `CONSTRUCTOR`, `toString`. Not a
 *     name anything means; the marker of an attack or a serialisation
 *     artefact.
 *
 * ⚠ THE PROTOTYPE CLASS IS DERIVED, NOT LISTED. `lower in Object.prototype` is
 * true for exactly the keys a bare object index would have walked into, so it
 * cannot drift from the hazard the registry's own-key guard was written for
 * (trap 12 — derive, don't mirror). A hand list would have to remember
 * `__defineGetter__`.
 *
 * ⛔ AND IT STAYS REFUSED EVEN THOUGH THE ORIGINAL HARM IS ALREADY GONE. That
 * guard existed because a bare index returned `Object.prototype` (a truthy
 * object React refuses to render) or `Function` (a blank title) as CONFIG. A
 * rescued card never touches the config — its heading is a fixed constant — so
 * nothing pathological could reach copy through this path today. The refusal is
 * kept anyway, because the entry is still not a category, and weakening a
 * deliberate security-shaped guard on the grounds that a different mitigation
 * happens to cover it is how such guards die.
 */
export function isRescuableBiasCode(code: unknown): boolean {
  if (typeof code !== 'string') return false
  const raw = code.trim()
  if (!raw) return false
  // ⚠ BOTH CASINGS, AND THE FIRST CUT TESTED ONLY THE LOWERCASED ONE — which
  // refused `__proto__` and `CONSTRUCTOR` (the two the ratified arm names) and
  // let `toString`, `hasOwnProperty` and eight more straight through, because
  // `'tostring' in Object.prototype` is false. The mixed-case keys are the
  // majority of the prototype, so a guard that only sees the lowercase ones is
  // most of a guard. None of them is a bias category under any casing.
  if (raw in Object.prototype || raw.toLowerCase() in Object.prototype) return false
  return !isEntityIdShapedCode(raw)
}

export const BIAS_SIGNAL_REGISTRY = {
  framing: { title: 'Narrow framing', icon: Frame },
  framing_bias: { title: 'Narrow framing', icon: Frame },
  narrow_framing: { title: 'Narrow framing', icon: Frame },
  anchoring: { title: 'Anchoring', icon: Anchor },
  anchoring_bias: { title: 'Anchoring', icon: Anchor },
  confidence: { title: 'Overconfidence', icon: Gauge },
  overconfidence: { title: 'Overconfidence', icon: Gauge },
  optimism_bias: { title: 'Optimism bias', icon: Gauge },
  blind_spots: { title: 'Blind spots', icon: EyeOff },
  status_quo_bias: { title: 'Status quo bias', icon: EyeOff },
  confirmation: { title: 'Confirmation bias', icon: Frame },
  confirmation_bias: { title: 'Confirmation bias', icon: Frame },
  authority_bias: { title: 'Authority bias', icon: Anchor },
  availability: { title: 'Availability bias', icon: Frame },
  availability_bias: { title: 'Availability bias', icon: Frame },
  sunk_cost: { title: 'Sunk cost', icon: Anchor },
} as const satisfies Record<string, BiasSignalEntry>

/**
 * The registry's own key space, as a literal union. Composed call sites
 * (`biasSignal('narrow_framing')`) type against THIS, so renaming or
 * removing a registry key is a compile error at every surface that composes
 * copy from it — the compiler replaces the hand-maintained
 * COMPOSED_TRIGGER_CODES allowlist the parity spec used to carry
 * (review-folds /simplify item 2; platform trap 12 — derive, don't mirror).
 */
export type KnownBiasCode = keyof typeof BIAS_SIGNAL_REGISTRY

/**
 * TOTAL accessor for COMPOSED copy — the code is a compile-time literal the
 * registry provably holds, so the lookup cannot fail and needs no `!`.
 * Wire input must go through `resolveBiasSignal` instead: only that path
 * carries the trim/lowercase/own-key guard.
 */
export function biasSignal(code: KnownBiasCode): BiasSignalEntry {
  return BIAS_SIGNAL_REGISTRY[code]
}

/**
 * THE guarded registry lookup for WIRE input, shared by every surface. The
 * guard logic used to live in the draft bridge's humaniseBiasSignalCode
 * delegate; it lives here once now, and that delegate is gone
 * (/simplify item 7).
 *
 * - trims + lowercases, so both wire conventions resolve;
 * - own-key guard: a bare object-literal index walks the prototype chain,
 *   so the hostile wire codes '__proto__' (returns Object.prototype, a
 *   truthy object React refuses to render) and 'constructor' (returns a
 *   Function whose .title/.icon are undefined) would escape a `?? null`
 *   and the caller's `if (!entry)` check. Only own keys are entries;
 *   everything else fails closed like any other unknown code.
 */
export function resolveBiasSignal(code: unknown): BiasSignalEntry | null {
  if (typeof code !== 'string') return null
  const key = code.trim().toLowerCase()
  if (!key) return null
  return Object.prototype.hasOwnProperty.call(BIAS_SIGNAL_REGISTRY, key)
    ? (BIAS_SIGNAL_REGISTRY as Record<string, BiasSignalEntry>)[key]
    : null
}

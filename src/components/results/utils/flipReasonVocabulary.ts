/**
 * flipReasonVocabulary — THE producer's flip-reason vocabulary, derived from
 * the producer rather than imagined (ROADMAP 2.280).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS
 * ─────────────────────────────────────────────────────────────────────────
 * The UI declared `FlipReason = 'no_bracket' | 'timeout' | 'isl_error'`. Read
 * against the producer, that union was very nearly fiction:
 *
 *   · `no_bracket`  — ZERO occurrences anywhere in `Talchain/plot-lite-service`
 *                     (whole working tree at `c0e4dc73`, `rg -a`). Invented.
 *   · `isl_error`   — exists in PLoT, but NEVER as a `flip_reason`. All of its
 *                     occurrences are a transport-error envelope field
 *                     (`routes/v1/types/proxy.types.ts:228,291,433,579,684,872`
 *                     — `isl_error?: ProxyError`). The union had conflated a
 *                     proxy error field with a flip reason.
 *   · `timeout`     — the ONLY one of the three the producer really emits
 *                     (`flip-threshold-status.ts:86`).
 *
 * Meanwhile the tokens the live wire actually carries — `found`,
 * `no_effect_within_bounds`, `structurally_invariant` — appeared in the union
 * not at all.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * DERIVATION — cite the source, do not re-imagine it
 * ─────────────────────────────────────────────────────────────────────────
 * AUTHORITY IS PLoT, NOT THE SCHEMAS PACKAGE. The pinned contract
 * (`package.json:102` → `file:./vendor/talchain-schemas-0.31.0.tgz`) types this
 * field as an OPEN string, not a union — `dist/boundary/enrichment.d.ts:2010`
 * (`flip_reason: z.ZodString`) and `json-schema/EnrichmentFlipThresholdSchema
 * .json` (`"flip_reason": {"type": "string"}`) — and its own docblock at
 * `enrichment.d.ts:1983` warns that string-matching these tokens is a trap. The
 * contract deliberately declines to enumerate; so there is no disagreement
 * between the two sources, only one that makes a claim.
 *
 * The token list below is read at the bytes from `Talchain/plot-lite-service`
 * at `c0e4dc73` (matches `gh api .../git/ref/heads/staging`), live path
 * `src/routes/v2/run.ts:129-131`: ISL envelope → `mapIslFactorFlipValues` →
 * `denormaliseFlipThresholds` → `classifyFlipThresholdsStatus`. Per-token
 * citations are on each entry.
 *
 * ⚠ AND THE VOCABULARY IS OPEN — DO NOT CLOSE IT. PLoT states outright
 * (`factor-flip-values.ts:317-324`) that it reduces ISL's open vocabulary and
 * that "every other token — including ones this build has never seen — passes
 * through verbatim". A closed union here would be the same defect one layer
 * down. So `FlipReason` stays assignable from any string, this module
 * enumerates only what is KNOWN, and every predicate below is written so that
 * an UNRECOGNISED token lands on the conservative side.
 */

/**
 * The producer says a flip WAS found. Substantive, and positive.
 * `isl-types.ts:515`; counted at `factor-flip-values.ts:310`.
 */
export const FLIP_REASON_FOUND = 'found'

/**
 * THE ONLY TWO TOKENS THAT ATTEST A SUBSTANTIVE NO-FLIP — i.e. the probe RAN
 * and concluded that nothing flips. PLoT groups exactly these as
 * `NO_EFFECT_REASONS` (`flip-threshold-status.ts:75-78`).
 *
 * This set is the whole reason the module exists: it is the ONLY basis on
 * which a surface may state an attested absence of flip risk. Everything else
 * — every probe failure, and every token this build has never seen — means
 * "we did not establish anything", which is not the same claim and must never
 * be rendered as one.
 */
export const ATTESTED_NO_FLIP_REASONS = [
  /** `flip-threshold-status.ts:76`; `isl-types.ts:516` */
  'no_effect_within_bounds',
  /** `flip-threshold-status.ts:77`; `isl-types.ts:518` */
  'structurally_invariant',
] as const

/**
 * Tokens KNOWN to mean the probe did not establish anything. Enumerated for
 * documentation and for the drift pin — NOT consulted by the predicates, which
 * are written as "not substantive" precisely so an unknown token needs no entry
 * here to be treated safely (CLAUDE.md trap 12: a hand-maintained list that
 * must be remembered WILL drift, so nothing may depend on its completeness).
 */
export const KNOWN_PROBE_FAILURE_REASONS = [
  /** `flip-threshold-status.ts:97`; `isl-types.ts:523` — never evaluated */
  'candidate_cap_exceeded',
  /** `flip-threshold-status.ts:86` — the one real token the old union had */
  'timeout',
  /** `flip-threshold-status.ts:87` */
  'error',
  /** `flip-threshold-status.ts:88` */
  'insufficient_precision',
  /** `flip-threshold-status.ts:89` */
  'non_monotonic_grid',
  /** `flip-threshold-status.ts:90`; minted live at
   *  `flip-threshold-denormaliser.ts:259,300` as the default when
   *  `flip_reason` is absent */
  'heuristic',
  /** `flip-threshold-status.ts:91` */
  'zero_elasticity_fallback',
  /** `flip-threshold-status.ts:92` — ISL-side; no emitter in PLoT `src/` */
  'single_option',
  /** `factor-flip-values.ts:117`, minted `:334` — producer contradiction */
  'found_without_value',
  /** `factor-flip-values.ts:132`, minted `:421` — producer contradiction */
  'value_without_direction',
  /** `factor-flip-values.ts:120`, minted `:331` — reason missing/empty */
  'unattested',
  /** `flip-threshold-status.ts:110`; minted `flip-threshold-denormaliser.ts:259` */
  'non_finite_denormalisation',
] as const

/**
 * Retained from the pre-2.280 union so historical rows still narrow, and
 * DELIBERATELY classified as probe failures.
 *
 * `no_bracket` was never emitted by any producer and `isl_error` was a
 * conflation with a transport field — but a row bearing either of them is, by
 * construction, a row that establishes nothing, so the conservative treatment
 * is also the correct one. Keeping them typed costs nothing and stops a
 * historical fixture becoming a type error.
 */
export const LEGACY_PROBE_FAILURE_REASONS = ['no_bracket', 'isl_error'] as const

/** Every token this build KNOWS about. Not exhaustive of the wire — see above. */
export type KnownFlipReason =
  | typeof FLIP_REASON_FOUND
  | (typeof ATTESTED_NO_FLIP_REASONS)[number]
  | (typeof KNOWN_PROBE_FAILURE_REASONS)[number]
  | (typeof LEGACY_PROBE_FAILURE_REASONS)[number]

/**
 * True ⇔ the producer AFFIRMATIVELY established that this factor does not flip.
 *
 * ⚠ THE POLARITY IS THE POINT. This is written as an allow-list membership
 * test, never as "not a probe failure". An unrecognised token — a new ISL
 * reason, a typo, `undefined`, a row that carries no reason at all — returns
 * FALSE, so it can never be promoted into an attested absence. Fail toward
 * "we do not know", which for the caller means `no_producer_flip_data`.
 */
export function isAttestedNoFlipReason(reason: string | null | undefined): boolean {
  return (
    typeof reason === 'string' &&
    (ATTESTED_NO_FLIP_REASONS as readonly string[]).includes(reason)
  )
}

/**
 * True ⇔ this row establishes nothing about flipping — the complement of the
 * three substantive tokens (`found` + the two attested-no-flip), and therefore
 * true for every unknown token by construction.
 */
export function isProbeFailureFlipReason(reason: string | null | undefined): boolean {
  if (isAttestedNoFlipReason(reason)) return false
  return reason !== FLIP_REASON_FOUND
}

/** True ⇔ this build recognises the token at all. For the drift pin only. */
export function isKnownFlipReason(reason: string | null | undefined): reason is KnownFlipReason {
  if (typeof reason !== 'string') return false
  return (
    reason === FLIP_REASON_FOUND ||
    (ATTESTED_NO_FLIP_REASONS as readonly string[]).includes(reason) ||
    (KNOWN_PROBE_FAILURE_REASONS as readonly string[]).includes(reason) ||
    (LEGACY_PROBE_FAILURE_REASONS as readonly string[]).includes(reason)
  )
}

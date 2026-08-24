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
 * THE ONE TOKEN THAT IS AN ALGEBRAIC PROOF RATHER THAN A MEASURED SEARCH.
 *
 * PLoT's own words, `lib/flip-threshold-status.ts:44-49` read at staging
 * `7e5d8a7d`: the per-option transmission slopes are IDENTICAL (spread
 * <= 1e-9), so "no value of this factor can move the argmax"; ISL calls it
 * "a MATHEMATICAL ATTESTATION, not a failed or timed-out probe".
 *
 * It is a SUBSET of {@link ATTESTED_NO_FLIP_REASONS}, and the distinction is
 * the whole point — see {@link provesFactorCannotMoveWinner}.
 */
export const STRUCTURAL_NO_FLIP_PROOF = 'structurally_invariant'

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

/**
 * ═════════════════════════════════════════════════════════════════════════
 * THE SECOND PREDICATE — AND WHY IT MUST NEVER BE MERGED WITH THE FIRST
 * ═════════════════════════════════════════════════════════════════════════
 *
 * TWO QUESTIONS, WRITTEN DOWN BEFORE ANYTHING WAS RECONCILED (trap 21):
 *
 *   Q1  "May this run state that NO factor reached a tipping point?"
 *       → `isAttestedNoFlipReason`, consumed by `selectFlipRisk`
 *         (`classifyFlipEvidence`, RUN-LEVEL: every row must attest).
 *       → BOTH tokens qualify. `no_effect_within_bounds` genuinely IS an
 *         attested absence over the tested range, and narrowing Q1 would make
 *         the product name a flip risk it has no evidence for.
 *
 *   Q2  "May this factor's attestation be used to WITHHOLD a positive claim
 *        another instrument computed about the same factor?"
 *       → `provesFactorCannotMoveWinner`, consumed by the conditional-winner
 *         suppression (PER-FACTOR).
 *       → ONLY `structurally_invariant` qualifies.
 *
 * WHY Q2 IS STRICTLY NARROWER, derived at the producer rather than chosen:
 *
 *   · `structurally_invariant` — the per-option transmission slopes are
 *     IDENTICAL. Slope equality is a TOPOLOGICAL property of the graph (which
 *     of the factor's causal paths each option's intervention severs), so it
 *     holds under EVERY sampled edge configuration, not merely at the mean.
 *     The per-sample winner is therefore independent of the factor, and the
 *     median-split bucket comparison behind `conditional_winners.winner_flips`
 *     is a comparison of two random halves of ONE sequence — its disagreement
 *     rate is governed only by proximity to a 50/50 win probability. Measured
 *     on the deployed build: 4/8 near-tie responses assert both claims for one
 *     factor; 0/8 in the separated contrast control.
 *
 *   · `no_effect_within_bounds` — the slopes GENUINELY DIFFER and the crossing
 *     merely lies outside the domain AT THE MEAN edge configuration. Each
 *     Monte-Carlo sample draws different strengths, so the crossing moves and
 *     can fall inside the domain for a real share of draws. A bucket
 *     disagreement there is a finding ISL computed. Withholding it is
 *     over-suppression — the mirror harm.
 *
 * ⚠ PLoT'S BOOLEAN CANNOT CARRY THIS DISTINCTION. `no_flip_in_range: true` is
 * stamped from the SET of both tokens (`factor-flip-values.ts:304` over
 * `NO_EFFECT_REASONS`, `flip-threshold-status.ts:75-78`). A consumer that gates
 * on the boolean gates on the union, which is exactly the over-suppression this
 * predicate exists to end. Read the REASON.
 *
 * ⚠ TWO OPPOSITE HARMS, TWO PREDICATES (trap 22b). Over-suppression withholds
 * real science; under-suppression states a falsehood. They are not two ends of
 * one window and must never be tuned as if they were.
 */

/** Minimal row shape both consumers can satisfy without a shared row type. */
export interface FlipAttestationRowLike {
  factor_id?: string | null
  node_id?: string | null
  flip_value?: number | null
  flip_reason?: string | null
}

/** True ⇔ `reason` is the algebraic proof (Q2's allow-list of exactly one). */
export function isStructuralNoFlipProof(reason: string | null | undefined): boolean {
  return reason === STRUCTURAL_NO_FLIP_PROOF
}

/**
 * True ⇔ this row PROVES the factor cannot move the winner, and is therefore
 * entitled to withhold a sibling surface's positive flip claim about it.
 *
 * Requires the proof token AND the absence of a numeric `flip_value`. PLoT
 * cannot emit both (`isAttestedNoFlip` demands `flipValue === null`,
 * `factor-flip-values.ts:365-367`), so the second clause is defence in depth —
 * and its POLARITY is deliberate: an incoherent attestation fails toward NOT
 * withholding, because for THIS question "we do not know" must never license a
 * suppression. (Note the polarity is the OPPOSITE of `isAttestedNoFlipReason`'s
 * for the same reason: there, failing safe means declining to assert an
 * absence; here, failing safe means declining to hide a computed claim.)
 */
export function provesFactorCannotMoveWinner(
  row: FlipAttestationRowLike | null | undefined,
): boolean {
  if (!row || typeof row !== 'object') return false
  if (typeof row.flip_value === 'number') return false
  return isStructuralNoFlipProof(row.flip_reason)
}

/**
 * The factor ids whose flip rows carry the algebraic proof.
 *
 * Bound by IDENTITY, never by label (trap 19): a label join would both miss a
 * real contradiction between two same-labelled factors and invent one between
 * two differently-labelled rows for the same factor. `factor_id` is the wire
 * spelling PLoT emits; `node_id` is the spelling the UI's adapted
 * `FlipThreshold` carries (`normaliseFactorFields`: node_id > factor_id > id),
 * so both are read and neither is preferred over a non-empty other.
 */
export function collectStructurallyProvenNoFlipIds(
  rows: readonly FlipAttestationRowLike[] | null | undefined,
): Set<string> {
  const out = new Set<string>()
  if (!Array.isArray(rows)) return out
  for (const row of rows) {
    if (!provesFactorCannotMoveWinner(row)) continue
    for (const id of [row?.factor_id, row?.node_id]) {
      if (typeof id === 'string' && id !== '') out.add(id)
    }
  }
  return out
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

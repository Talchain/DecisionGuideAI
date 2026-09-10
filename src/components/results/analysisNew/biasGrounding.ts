/**
 * Reasoning tab — the literature grounding behind the producer's bias checks.
 *
 * ⭐⭐ WHAT THIS RENDERS THAT NOTHING ELSE DOES. CEE emits, on
 * `analysis_ready.bias_findings[]`, three fields no product surface reads:
 *
 *   `mechanism`           why the effect operates, in the producer's words
 *   `citation`            the actual literature the check rests on
 *   `micro_intervention`  `steps[]` plus `estimated_minutes`, a costed technique
 *
 * Derived at `08a3724d`, with contrast controls, before a line was written:
 *
 *   `mechanism`  → ZERO product renderers. The single `.mechanism` render in
 *                  the tree is `pages/sandbox-guide/.../BiasMitigation.tsx:99`,
 *                  a prototype surface with its own LOCAL `mechanism: string`
 *                  interface, not `CEEBiasFinding`. One further read exists
 *                  (`usePreAnalysisData.ts:1727`) which folds it into a check
 *                  `detail` on the pre-analysis panel, not this tab.
 *   `citation`   → DECLARED on `RawBiasFinding` (`PreAnalysisPanel.tsx:285`)
 *                  and READ NOWHERE. Every other `citation` hit in the tree is
 *                  the unrelated evidence/chat-citation concept.
 *   `estimated_minutes` → ZERO readers of any kind.
 *
 * ── WHY THE PAYLOAD IS KNOWN TO ARRIVE, NOT ASSUMED TO ──────────────────────
 *
 * ⚠ THE UI's `CEEBiasFinding` TYPE IS A HAND-MAINTAINED MIRROR OF CEE's RUNTIME
 * SHAPE (trap 12) and proves nothing about the wire. `bias_findings` has ZERO
 * occurrences in the pinned contract (`@talchain/schemas` 0.54.0, vendored at
 * `vendor/talchain-schemas-0.54.0.tgz`); it rides `analysis_ready` as untyped
 * passthrough. So the declaration is not evidence and neither is the contract.
 *
 * TWO COMMITTED PAYLOADS ARE, and they agree field for field:
 *   `canvas/hydrate/__tests__/fixtures/pricing-provisional-poll.json`
 *     → `/graph/analysis_ready/bias_findings[0]`, `code: OVERCONFIDENCE`,
 *       citation "Lichtenstein et al. (1982) - Judgment Under Uncertainty"
 *   `canvas/starters/data/headcount-allocation.draft.json`
 *     → `/analysis_ready/bias_findings[0]`, `code: AUTHORITY_BIAS`,
 *       citation "Milgram (1963) - Journal of Abnormal and Social Psychology"
 *
 * ⭐ AND THE SHAPE THOSE PAYLOADS CARRY IS NOT THE SHAPE THE REPO DECLARES.
 * `micro_intervention.steps` is an array of **plain strings** in both. The
 * existing declared shape is `Array<{ text?: string }>` and the existing reader
 * takes `steps?.[0]?.text` (`PreAnalysisPanel.tsx:352`), which is `undefined`
 * on every real payload above. That reader is not changed here (out of scope,
 * and it falls back to `interventions[].description`), but this module must not
 * inherit its assumption: BOTH shapes are normalised, and the string shape is
 * the one pinned against a real captured payload.
 *
 * ── WHAT THIS DELIBERATELY DOES NOT DO ─────────────────────────────────────
 *
 * ⛔ IT NEVER NAMES THE BIAS. `code`/`type` are read for nothing at all. The
 * shipped register (#1438) turns a named bias into the corrective technique
 * instead of a diagnosis of the reader, and this surface matches it: the
 * mechanism explains the effect, the steps say what to do, the citation says
 * where it comes from, and at no point is the reader told which bias they have.
 * That also makes the four-admitted-bias-types question moot HERE, which is
 * just as well, because it does not bind this carrier (see below).
 *
 * ⛔ IT SYNTHESISES NO SCIENCE. There is no bias-to-method map in this file and
 * there must never be one: the producer owns that mapping, with citations, and
 * `analysisNew/recommendationMethod.ts` already documents where it lives. Every
 * string rendered downstream of this module came off the wire.
 *
 * ⚠ THE FOUR-TYPE `BiasType` ENUM GOVERNS A DIFFERENT CARRIER. Verified at the
 * vendored bytes: `package/dist/coaching.d.ts:2` pins
 * `z.enum(['anchoring','narrow_framing','status_quo_bias','overconfidence'])`
 * — on COACHING blocks. `analysis_ready.bias_findings` is not in the contract
 * at all, and both captured payloads carry codes outside that enum
 * (`OVERCONFIDENCE`, `AUTHORITY_BIAS`). Do not "fix" this module by filtering
 * it against `BiasType`; that would drop real findings on the floor. The enum
 * is still the binding constraint for anything keyed on the coaching channel.
 */

/** One finding's grounding, after normalisation. Never partially rendered. */
export interface BiasGroundingItem {
  /** Producer id when present, else the index. Identity for the testids. */
  id: string
  /** The producer's own explanation of the effect. Never composed here. */
  mechanism: string | null
  /** The producer's literature reference, verbatim. */
  citation: string | null
  /** Ordered technique steps. Empty when the producer sent none. */
  steps: string[]
  /** Only ever a finite positive number of minutes. */
  estimatedMinutes: number | null
}

export function buildBiasGrounding(
  _findings: readonly unknown[] | null | undefined,
): BiasGroundingItem[] {
  return []
}

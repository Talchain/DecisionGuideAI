/**
 * Single source of truth for indicative scientific keys that gate
 * "is this CEE enrichment really evidence-bearing?" decisions.
 *
 * Consumed by:
 *   - src/lib/v5EmbeddedEvidence.ts (resolver indicative-keys gate)
 *   - src/lib/evidenceBearingCeeTurn.ts (selector evidence-bearing filter)
 *
 * Both call sites import from this module so the resolver (which
 * decides whether to promote a found enrichment block) and the
 * selector (which decides whether a candidate is even eligible to
 * be selected) agree exactly on what counts as "real" evidence.
 *
 * Keep this list in sync with PLoT enrichment emission. Adding a
 * key here widens the "evidence-bearing" definition; removing one
 * narrows it.
 */
export const RAW_PAYLOAD_INDICATIVE_KEYS = [
  'option_comparison',
  'factor_sensitivity',
  'm1_coaching',
  'flip_thresholds',
  'robustness',
] as const

export type RawPayloadIndicativeKey = (typeof RAW_PAYLOAD_INDICATIVE_KEYS)[number]

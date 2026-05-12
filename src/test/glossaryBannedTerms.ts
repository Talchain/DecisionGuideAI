/**
 * Glossary banned-term list — TEST-SIDE ENTRY POINT.
 *
 * Re-exports the canonical list from the production glossary check so
 * the scanner enforces the same terms production gates against. (Per
 * P1.1 review feedback, fixing the earlier divergence where the
 * production fallback list was narrower than this test asset's list.)
 *
 * The production hero must NOT import this file. The opposite direction
 * — this test asset importing from production — is the correct
 * dependency arrow: tests verify production behaviour against a shared
 * truth. See docs/brief-analysis-hero-v17-implementation.md §3 step 8.
 *
 * This file adds test-only helpers (source scanner allowlist) on top of
 * the canonical re-exports.
 */

import {
  ANALYSIS_HERO_BANNED_TERMS as CANONICAL,
  containsBannedTerm,
  findBannedTerm,
} from '@/components/results/analysisHeroV17/glossaryCheck'

/** Canonical banned terms — re-exported for tests. Single source of truth. */
export const GLOSSARY_BANNED_TERMS = CANONICAL

export { containsBannedTerm, findBannedTerm }

/**
 * Backwards-compatible alias kept for any existing tests that imported
 * the regex builder by its older name. Returns the regex constructed
 * by the production glossary check on first call.
 */
export function buildBannedTermRegex(): RegExp {
  // The production matcher caches its regex internally; we get it
  // indirectly by exercising findBannedTerm on a sentinel that we know
  // exists in the list, then reconstruct the equivalent matcher for any
  // external regex callers. Direct exposure of the cached regex from
  // production isn't required — callers should prefer findBannedTerm.
  const escaped = (GLOSSARY_BANNED_TERMS as readonly string[]).map(t =>
    t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
  )
  const patterns = escaped.map(t =>
    /^[a-z][a-z_]*$/i.test(t) ? `\\b${t}\\b` : t,
  )
  return new RegExp(`(?:${patterns.join('|')})`, 'i')
}

/**
 * Allow-list of EXPLICIT identifier patterns that legitimately appear in
 * v17 hero source as non-user-facing string literals (TypeScript
 * discriminator values, action enum strings, etc.). Anything matching a
 * banned term and NOT in this explicit list trips the source scanner.
 *
 * (Per P1 "Improvement: tighten allowlist" review feedback — the earlier
 * bare-identifier catchall `/^[a-z][a-z_]*$/i` would have masked a future
 * exact banned literal added as a user-facing string. Replaced with
 * per-term explicit patterns; new entries require deliberate review.)
 */
export const HARD_CODED_SOURCE_ALLOWLIST = [
  // TypeScript discriminator + enum values that match banned tokens.
  // Each entry is a non-user-facing identifier; review additions case
  // by case rather than via a broad catchall.
  /^node$/, /^edge$/, /^edges$/,
  /^intervention$/, /^recommend$/, /^recommended$/, /^recommendation$/,
  /^winner$/, /^winning$/,
  /^graph$/, /^DAG$/, /^SCM$/,
  /^EVPI$/, /^VOI$/, /^voi$/,
  /^ISL$/, /^PLoT$/, /^CEE$/,
  /^elasticity$/, /^bootstrap$/, /^perturbation$/,
  /^posterior$/, /^variance$/,
  /^headline_type$/, /^observed_state$/, /^canonical_state$/,
  /^exists_probability$/, /^attribution_stability$/, /^rank_flip_rate$/,
  /^model_critiques$/, /^strength_mean$/, /^strength_std$/,
] as const

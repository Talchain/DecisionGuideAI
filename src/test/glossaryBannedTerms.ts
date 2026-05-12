/**
 * Glossary banned-term list — TEST-SIDE ONLY.
 *
 * Source: docs/investigations/analysis-hero-v17.md §12 (the canonical
 * banned-term list documented in the investigation, derived from the
 * Olumi Communication Glossary v1).
 *
 * The production hero must NOT import this file. The production builder
 * has its own narrower in-place check (containsBannedTerm in
 * buildAnalysisHeroViewModel.ts) that gates label interpolation. This
 * test-side asset is the broader scanner used by spec files to assert
 * that no banned term reaches the rendered DOM, including post-
 * interpolation copy.
 *
 * Per docs/brief-analysis-hero-v17-implementation.md §3 step 8.
 */

/** Canonical banned terms — never appear in user-facing copy. */
export const GLOSSARY_BANNED_TERMS = [
  // §1 Leading option
  'recommend', 'recommended', 'recommendation', 'winner', 'winning', 'best choice',
  // §2 Win probability
  'wins', 'win rate', 'chance of winning', 'probability of success',
  // §3 Stability
  'recommendation stability', 'robustness score', 'confidence score',
  // §4 Sensitivity
  'elasticity', 'factor sensitivity', 'sensitivity score', 'beta coefficient',
  // §5 Confidence (edge)
  'exists probability', 'belief exists', 'epistemic uncertainty',
  // §6 Effect strength
  'strength mean', 'b coefficient', 'regression weight',
  // §8 Value of information
  'EVPI', 'expected value of perfect information', 'VOI', 'voi ranking',
  // §10 Fragile edge
  'fragile edge', 'switch probability', 'marginal switch probability',
  // §11 Simulation
  'stochastic', 'random sampling',
  // §15 Causal model
  'graph', 'DAG', 'SCM', 'structural causal model', 'nodes and edges',
  // §17 Decision readiness
  'blocked', 'cannot run', 'fix issues', 'fix issue', 'required actions', 'validation errors',
  // §18 Bias
  'you have a bias', 'bias detected', 'you are exhibiting',
  // §19 Uncertainty
  'prior range', 'posterior', 'variance',
  // Internal terms
  'headline_type', 'observed state', 'observed_state', 'canonical_state',
  'exists_probability', 'voi', 'attribution_stability', 'rank_flip_rate',
  'model_critiques', 'strength_mean', 'strength_std', 'intervention',
  'bootstrap', 'perturbation', 'ISL', 'PLoT', 'CEE',
] as const

/**
 * Build a single regex from the banned list. Case-insensitive, word-boundary
 * aware for short tokens (so "graph" in "telegraph" doesn't false-positive on
 * an unrelated word). Multi-word entries match literally.
 */
export function buildBannedTermRegex(): RegExp {
  const escaped = GLOSSARY_BANNED_TERMS.map(t =>
    t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
  )
  // Word-boundary wrap for tokens that are pure ASCII words; otherwise embed plain.
  const patterns = escaped.map(t =>
    /^[a-z][a-z_]*$/i.test(t) ? `\\b${t}\\b` : t,
  )
  return new RegExp(`(?:${patterns.join('|')})`, 'i')
}

/**
 * Scan a string for any banned term. Returns the first match (or null).
 * Use in tests over: hard-coded strings, view-model output, post-
 * interpolation rendered text.
 */
export function findBannedTerm(text: string | null | undefined): string | null {
  if (!text) return null
  const m = buildBannedTermRegex().exec(text)
  return m ? m[0] : null
}

/**
 * Allow-list of patterns inside JSX/TS source files where banned terms
 * legitimately appear as identifiers, comments, or test data — NOT as
 * user-facing strings. The hard-coded-string scanner must skip these.
 *
 * Keep this list minimal. Each entry should be self-evidently a
 * non-user-facing occurrence.
 */
export const HARD_CODED_SOURCE_ALLOWLIST = [
  // Internal identifier names
  /winProbability/g,
  /winProbabilityScore/g,
  /winProbabilityGap/g,
  /coachingHeadline/g,
  /m1CoachingTopFragileEdge/g,
  /topFragileEdge/g,
  /switchProbability/g,
  /fragileEdgeCount/g,
  /VITE_FEATURE_/g,
  /ANALYSIS_HERO/g,
  // VM tokens — internal type literals
  /'evidence'/g,
  // Comments that reference the banned-term list itself
  /HIGH_RISK_TERMS/g,
  /GLOSSARY_BANNED_TERMS/g,
] as const

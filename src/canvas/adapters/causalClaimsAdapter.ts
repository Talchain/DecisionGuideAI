/**
 * Causal claims adapter — extracts and normalises causal_claims from edge data.
 *
 * The pipeline outputs `causal_claims` (snake_case). This adapter handles both
 * casings defensively and logs a warning if the wrong casing is encountered.
 *
 * Phase 2A: causal claims in edge inspector.
 */

// ---------------------------------------------------------------------------
// § 1 — Types
// ---------------------------------------------------------------------------

export interface CausalClaim {
  claim_type: string
  statement: string
  source?: string
}

// ---------------------------------------------------------------------------
// § 2 — Extraction with normalisation
// ---------------------------------------------------------------------------

/**
 * Extracts causal claims from raw edge data, checking both `causal_claims`
 * (canonical snake_case) and `causalClaims` (camelCase fallback).
 *
 * Logs a dev warning if camelCase is used, prompting upstream correction.
 */
export function extractCausalClaims(edgeData: Record<string, unknown> | null | undefined): CausalClaim[] {
  if (!edgeData) return []

  // Canonical: snake_case (matches pipeline output)
  let raw = edgeData.causal_claims as unknown

  // Fallback: camelCase (wrong casing — log warning)
  if (raw == null && edgeData.causalClaims != null) {
    raw = edgeData.causalClaims
    if (import.meta.env.DEV) {
      console.warn(
        '[causalClaimsAdapter] Edge data uses camelCase "causalClaims" — expected snake_case "causal_claims". ' +
        'Update the upstream pipeline to use the canonical field name.',
      )
    }
  }

  if (!Array.isArray(raw)) return []

  // Validate and normalise each claim
  const claims: CausalClaim[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const obj = item as Record<string, unknown>

    const claimType = typeof obj.claim_type === 'string' ? obj.claim_type
      : typeof obj.claimType === 'string' ? obj.claimType
      : null
    const statement = typeof obj.statement === 'string' ? obj.statement : null

    if (!claimType || !statement) continue

    claims.push({
      claim_type: claimType,
      statement,
      source: typeof obj.source === 'string' ? obj.source : undefined,
    })
  }

  return claims
}

// ---------------------------------------------------------------------------
// § 3 — Display helpers
// ---------------------------------------------------------------------------

/** Human-readable label for claim types (sentence case) */
export function claimTypeLabel(claimType: string): string {
  const labels: Record<string, string> = {
    theoretical: 'Theoretical',
    empirical: 'Empirical',
    mechanistic: 'Mechanistic',
    definitional: 'Definitional',
    established: 'Established',
    probable: 'Probable',
    hypothesised: 'Hypothesised',
  }
  return labels[claimType.toLowerCase()] ?? claimType
}

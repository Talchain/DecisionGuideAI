import { computePayloadHash } from '../lib/canonical-hash'

/**
 * Turn auth headers — login UI half (3.4).
 *
 * Coordination contract (LOGIN-CEE-HALF-SPEC): every turn call carries
 * `Authorization: Bearer <supabase access token>` so CEE's flag-gated JWT
 * half can verify the user and derive identity server-side. `X-User-Id`
 * KEEPS being sent until CEE confirms derivation is live — skew-safe
 * order: add JWT now, CEE switches source, then drop x-user-id.
 *
 * Guests have no Supabase session → both values null → no auth headers,
 * byte-identical to today.
 */
export interface SessionIdentity {
  userId: string | null
  accessToken: string | null
}

export function buildTurnAuthHeaders(identity: SessionIdentity): Record<string, string> {
  return {
    ...(identity.userId ? { 'X-User-Id': identity.userId } : {}),
    ...(identity.accessToken ? { Authorization: `Bearer ${identity.accessToken}` } : {}),
  }
}

/** Non-reversible identity for request caches and owner-bound publication. */
export async function buildSessionAuthKey(identity: SessionIdentity): Promise<string> {
  const fingerprint = identity.accessToken ? await computePayloadHash(identity.accessToken) : 'none'
  return JSON.stringify([identity.userId, fingerprint])
}

/**
 * Turn auth headers — login UI half (3.4).
 *
 * STUB (RED phase): inert until the lane's GREEN commit.
 */
export interface SessionIdentity {
  userId: string | null
  accessToken: string | null
}

export function buildTurnAuthHeaders(_identity: SessionIdentity): Record<string, string> {
  return {}
}

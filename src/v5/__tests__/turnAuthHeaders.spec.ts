/**
 * Login UI half (3.4) — turn auth headers.
 *
 * Coordination contract (LOGIN-CEE-HALF-SPEC): `Authorization: Bearer
 * <supabase access token>` rides every turn call; `X-User-Id` KEEPS being
 * sent until CEE confirms server-side derivation is live (skew-safe order:
 * add JWT now, CEE switches source, then drop x-user-id).
 */
import { describe, it, expect } from 'vitest'

import { buildTurnAuthHeaders } from '../turnAuthHeaders'

describe('buildTurnAuthHeaders', () => {
  it('sends both X-User-Id and Authorization when a full session exists', () => {
    expect(
      buildTurnAuthHeaders({ userId: 'user-123', accessToken: 'tok-abc' }),
    ).toEqual({
      'X-User-Id': 'user-123',
      Authorization: 'Bearer tok-abc',
    })
  })

  it('sends only X-User-Id when no access token is available', () => {
    expect(buildTurnAuthHeaders({ userId: 'user-123', accessToken: null })).toEqual({
      'X-User-Id': 'user-123',
    })
  })

  it('sends only Authorization when a token exists without a user id', () => {
    expect(buildTurnAuthHeaders({ userId: null, accessToken: 'tok-abc' })).toEqual({
      Authorization: 'Bearer tok-abc',
    })
  })

  it('sends no auth headers for a guest (no session at all) — byte-identical pin', () => {
    expect(buildTurnAuthHeaders({ userId: null, accessToken: null })).toEqual({})
  })

  it('never emits an empty Bearer', () => {
    expect(buildTurnAuthHeaders({ userId: 'user-123', accessToken: '' })).toEqual({
      'X-User-Id': 'user-123',
    })
  })
})

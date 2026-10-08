/**
 * ⭐ IDENTITY-EXACT (DL 8 Oct; design lane-placeholder-licence.md): the identities THIS Run evaluated.
 *
 * CEE's goal-certainty rule (`goal-certainty.ts` `exact`): a link from an identity operand INTO its identity is exact
 * when THIS Run evaluated that identity. CEE carries the Run's evaluated identity node ids on two legs, one reader
 * (the `storedOptionParticipation.ts` precedent): the turn's sidecar root key `identity_evaluated_node_ids` (top level,
 * then the additive sidecar) and the cold read's `analysis_identity_evaluated_node_ids`. Absent = not attested (every
 * link keeps today's marking); `[]` = attested, none evaluated.
 */
import { ADDITIVE_EXTENSIONS_KEY, type OlumiResponseWithExtensions } from '../../v5/responseParser'

export const IDENTITY_EVALUATED_TURN_KEY = 'identity_evaluated_node_ids'
export const IDENTITY_EVALUATED_READ_KEY = 'analysis_identity_evaluated_node_ids'

/** The raw list from a parsed turn: top level first, then the additive sidecar. */
export function identityEvaluatedFromResponse(response: unknown): unknown {
  if (response === null || typeof response !== 'object') return undefined
  const top = (response as Record<string, unknown>)[IDENTITY_EVALUATED_TURN_KEY]
  if (top !== undefined) return top
  const additive = (response as OlumiResponseWithExtensions)[ADDITIVE_EXTENSIONS_KEY] as Record<string, unknown> | undefined
  return additive?.[IDENTITY_EVALUATED_TURN_KEY]
}

/** A list of non-empty node ids, sorted and de-duplicated; anything else is not attested (`null`). */
export function readIdentityEvaluated(raw: unknown): readonly string[] | null {
  if (!Array.isArray(raw) || !raw.every((id) => typeof id === 'string' && id !== '')) return null
  return [...new Set(raw as string[])].sort()
}

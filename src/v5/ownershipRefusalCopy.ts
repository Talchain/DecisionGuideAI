/** Only DL-ACKed ownership sentences may make a save claim. */
export const OWNERSHIP_REFUSAL_COPY = {
  not_owner: "Nothing was saved. You don't have access to change this model.",
  owner_unreadable: "Nothing was saved. I couldn't check access to this model. Try again.",
  code_only: "You don't have access to change this model.",
} as const

export type OwnershipRefusalReason = keyof typeof OWNERSHIP_REFUSAL_COPY

/** Exact equality: never echo arbitrary server prose, even on the right code. */
export function ownershipRefusalReason(message: unknown): OwnershipRefusalReason {
  if (message === OWNERSHIP_REFUSAL_COPY.not_owner) return 'not_owner'
  if (message === OWNERSHIP_REFUSAL_COPY.owner_unreadable) return 'owner_unreadable'
  return 'code_only'
}

export function ownershipRefusalRetryable(reason: OwnershipRefusalReason): boolean {
  return reason === 'owner_unreadable'
}

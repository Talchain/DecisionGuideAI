/**
 * Wave 1 — the ONE stable Actions catalogue (brief §4.7).
 * STUB (RED phase): entries land in the GREEN commit.
 */
export interface MethodEntry {
  id: string
  title: string
  description: string
  /** Opening message for the contextual AI session. */
  prompt: string
}

export interface GlobalActionEntry {
  id: string
  title: string
  description: string
}

export const METHOD_CATALOGUE: MethodEntry[] = []
export const GLOBAL_ACTIONS: GlobalActionEntry[] = []

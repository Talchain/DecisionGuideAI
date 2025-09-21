export type GhostFlow = {
  id: string
  title: string
  why: string
  suggestion_confidence: number
  parse_json: unknown
  parse_json_hash: string
  critique: Array<{ note: string; severity: 'BLOCKER' | 'IMPROVEMENT' | 'OBSERVATION'; fix_available: boolean }>
  fork_suggested?: boolean
  fork_labels?: string[]
  threshold_crossings?: Array<{ from: number | string; to: number | string }>
}

export type GhostState = { drafts: GhostFlow[]; lastSeed?: number; lastHash?: string }

export const ghost: GhostState = { drafts: [] }
export const setGhost = (g: GhostState) => {
  ghost.drafts = g.drafts
  ghost.lastSeed = g.lastSeed
  ghost.lastHash = g.lastHash
}

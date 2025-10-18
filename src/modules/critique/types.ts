// src/modules/critique/types.ts
export type CritiqueSeverity = 'blocker' | 'improvement' | 'observation'

export interface CritiqueItem {
  id: string
  severity: CritiqueSeverity
  title: string
  rationale: string
  nodeId?: string
  fixAction?: 'link-outcome' | 'add-assumption' | 'focus-rename'
}

export interface CritiqueHeuristics {
  blockers: CritiqueItem[]
  improvements: CritiqueItem[]
  observations: CritiqueItem[]
}

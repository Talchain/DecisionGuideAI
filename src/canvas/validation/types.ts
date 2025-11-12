/**
 * M4: Graph Health & Repair Types
 * Validation issue types and repair actions
 */

export type IssueType =
  | 'cycle'
  | 'dangling_edge'
  | 'orphan_node'
  | 'duplicate_edge'
  | 'missing_label'
  | 'invalid_type'
  | 'self_loop'

export type IssueSeverity = 'error' | 'warning' | 'info'

export interface ValidationIssue {
  id: string
  type: IssueType
  severity: IssueSeverity
  message: string
  nodeIds?: string[]
  edgeIds?: string[]
  suggestedFix?: RepairAction
}

export interface RepairAction {
  type: 'remove_node' | 'remove_edge' | 'add_edge' | 'update_node' | 'update_edge'
  targetId: string
  data?: any
}

export interface GraphHealth {
  status: 'healthy' | 'warnings' | 'errors'
  issues: ValidationIssue[]
  score: number // 0-100
}

export interface NeedleMover {
  nodeId: string
  impact: number // 0-1 (relative impact on decision)
  reason: string
  type: 'high' | 'medium' | 'low'
}

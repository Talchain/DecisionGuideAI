/**
 * N2: Issue Explainers
 *
 * "Why this matters" copy for each issue type
 */

import type { IssueType } from '../validation/types'

export const ISSUE_EXPLAINERS: Record<IssueType, string> = {
  cycle: 'Circular dependencies prevent deterministic outcome calculation',
  orphan_node: 'Isolated nodes do not contribute to the final analysis',
  self_loop: 'Self-referencing nodes create infinite probability loops',
  dangling_edge: 'Edges without valid endpoints cause analysis failures',
  duplicate_edge: 'Duplicate connections skew probability calculations',
  missing_label: 'Unlabelled elements reduce graph readability',
  invalid_type: 'Invalid node types may not render or analyse correctly'
}

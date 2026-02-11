/**
 * Composite graph type.
 *
 * Combines node and edge schemas into a complete graph structure.
 */

import type { NodeV3 } from './nodes.js'
import type { EdgeV3 } from './edges.js'

/**
 * Complete V3 graph structure for analysis.
 */
export interface GraphV3 {
  nodes: NodeV3[]
  edges: EdgeV3[]
}

/**
 * The previous graph's line from the question to one of its options, on the lane's own canvas (RULING 1, output/ui-restore-20261111).
 * Core states that the card is an option of this question; the line draws that and nothing else: no strength, no sign, no word, no hover.
 */
import { memo } from 'react'
import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react'

function RootLinkEdgeImpl({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition }: EdgeProps): JSX.Element {
  const [path] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })
  return <BaseEdge path={path} style={{ stroke: 'var(--border-strong, var(--panel-border))', strokeWidth: 1 }} />
}
export const RootLinkEdge = memo(RootLinkEdgeImpl)

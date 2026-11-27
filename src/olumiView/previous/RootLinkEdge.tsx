/**
 * The previous graph's line from the question to one of its options, on the lane's own canvas (RULING 1, output/ui-restore-20261111).
 * Core states that the card is an option of this question; the line draws that and nothing else: no strength, no sign, no word, no hover.
 */
import { memo } from 'react'
import { getBezierPath, type EdgeProps } from '@xyflow/react'
import '../look/olumiLook.css'
import { edgeLook } from '../v12/links/edgeLook'
import { LinkTrace } from '../v12/links/LinkTrace'

const look = edgeLook({ connector: 'root' })

function RootLinkEdgeImpl({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition }: EdgeProps): JSX.Element {
  const [path] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })
  return <LinkTrace look={look} path={path} toneOnLine />
}
export const RootLinkEdge = memo(RootLinkEdgeImpl)

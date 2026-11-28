/**
 * The previous graph's line from the question to one of its options, on the lane's own canvas (RULING 1, output/ui-restore-20261111).
 * Core states that the card is an option of this question; the line draws that and nothing else: no strength, no sign, no word, no hover.
 */
import { memo } from 'react'
import { getBezierPath, type EdgeProps } from '@xyflow/react'
import { ConnectorLine, ROOT_LOOK, lookKey } from '../v12/links/connector'

function RootLinkEdgeImpl({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition }: EdgeProps): JSX.Element {
  const [path] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })
  return <g className="ok-link-tone-neutral" data-look={lookKey(ROOT_LOOK)}><ConnectorLine id={id} path={path} look={ROOT_LOOK} /></g>
}
export const RootLinkEdge = memo(RootLinkEdgeImpl)

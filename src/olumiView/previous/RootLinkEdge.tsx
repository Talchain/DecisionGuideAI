/**
 * The previous graph's line from the question to one of its options, on the lane's own canvas (RULING 1, output/ui-restore-20261111).
 * Core states that the card is an option of this question; the line draws that and nothing else: no strength, no sign, no word, no hover.
 */
import { memo } from 'react'
import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react'

/** The previous graph's neutral link grey (brand.css `--edge-neutral`). `--border-strong` is defined nowhere and `--panel-border` is not a
 *  colour an SVG stroke can read, so the line computed to `none` and was never seen (Paul's A11 board, 12 Nov). */
export const ROOT_LINK_STROKE = 'var(--edge-neutral)'

function RootLinkEdgeImpl({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition }: EdgeProps): JSX.Element {
  const [path] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })
  return <BaseEdge path={path} style={{ stroke: ROOT_LINK_STROKE, strokeWidth: 1 }} />
}
export const RootLinkEdge = memo(RootLinkEdgeImpl)

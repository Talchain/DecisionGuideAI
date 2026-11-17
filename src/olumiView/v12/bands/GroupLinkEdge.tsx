/**
 * V12 Simple: the connector from a row's group card to a drawn card (groups.ts GroupLink). It is an aggregate: a plain neutral line that says how
 * many links it stands for and nothing about any one of them. It has no words, no sign, no strength, no removal and no focus; opening the group draws
 * the real links (ViewLinkEdge) with their own controls.
 */
import { memo } from 'react'
import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react'
import { EDGE_NEUTRAL, PLAIN_WIDTH } from '../links/styles'
import type { GroupLink } from './groups'

/** The connector's hover: how many links, never whose. */
export const groupLinkTitle = (count: number): string => (count === 1 ? '1 link' : `${count} links`)

function GroupLinkEdgeImpl({ id, data, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition }: EdgeProps): JSX.Element {
  const { count } = data as unknown as GroupLink
  const [path] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })
  return (
    <g data-group-link={id} data-group-link-count={count}>
      <title>{groupLinkTitle(count)}</title>
      <BaseEdge id={id} path={path} style={{ stroke: EDGE_NEUTRAL, strokeWidth: PLAIN_WIDTH, vectorEffect: 'non-scaling-stroke' }} />
    </g>
  )
}
export const GroupLinkEdge = memo(GroupLinkEdgeImpl)

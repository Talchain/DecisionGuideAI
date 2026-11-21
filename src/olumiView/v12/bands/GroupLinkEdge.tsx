/**
 * V12 Simple: the connector from a row's group card to a drawn card (groups.ts GroupLink). It is an aggregate: a plain neutral line that says how
 * many links it stands for and nothing about any one of them. It has no words, no sign, no strength, no removal and no focus; opening the group draws
 * the real links (ViewLinkEdge) with their own controls.
 */
import { memo, useId } from 'react'
import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react'
import { EndMarker } from '../links/LinkEnds'
import { GROUP_ID_PREFIX, type GroupLink } from './groups'

/** The connector's hover: how many links, never whose. */
export const groupLinkTitle = (count: number): string => (count === 1 ? '1 link' : `${count} links`)

function GroupLinkEdgeImpl({ id, data, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition }: EdgeProps): JSX.Element {
  const { from, to, count } = data as unknown as GroupLink
  const arrow = useId()
  const folded = from.startsWith(GROUP_ID_PREFIX) || to.startsWith(GROUP_ID_PREFIX)
  const [path] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })
  return (
    <g className="ok-link-tone-neutral" data-group-link={id} data-group-link-count={count}>
      <title>{groupLinkTitle(count)}</title>
      {folded ? <defs><EndMarker id={arrow} end="arrow" /></defs> : null}
      <BaseEdge id={id} path={path} className="ok-link-line" markerEnd={folded ? `url(#${arrow})` : undefined} />
    </g>
  )
}
export const GroupLinkEdge = memo(GroupLinkEdgeImpl)

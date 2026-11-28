/**
 * V12 Simple: the connector between a row's group card and a drawn card (groups.ts GroupLink). It is an aggregate: a neutral line that says how
 * many links it stands for and nothing about any one of them. It has no words, no sign, no strength, no removal and no focus; opening the group draws
 * the real links (ViewLinkEdge) with their own controls.
 */
import { memo } from 'react'
import { getBezierPath, type EdgeProps } from '@xyflow/react'
import { ConnectorLine, groupLook, lookKey } from '../links/connector'
import { GROUP_ID_PREFIX, type GroupLink } from './groups'

/** The connector's hover: how many links, never whose. */
export const groupLinkTitle = (count: number): string => (count === 1 ? '1 link' : `${count} links`)

export const groupConnectorLook = ({ from, to, mixedDirection }: GroupLink) =>
  groupLook(!mixedDirection && (from.startsWith(GROUP_ID_PREFIX) || to.startsWith(GROUP_ID_PREFIX)))

function GroupLinkEdgeImpl({ id, data, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition }: EdgeProps): JSX.Element {
  const group = data as unknown as GroupLink
  const { count, mixedDirection } = group
  const look = groupConnectorLook(group)
  const [path] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })
  return (
    <g data-look={lookKey(look)} className="ok-link-tone-neutral" data-group-link={id} data-group-link-count={count} data-mixed-direction={mixedDirection ? '' : undefined}>
      <title>{groupLinkTitle(count)}</title>
      <ConnectorLine id={id} path={path} look={look} />
    </g>
  )
}
export const GroupLinkEdge = memo(GroupLinkEdgeImpl)

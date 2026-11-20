/** Test seam for the links lane: one View link drawn by the lane's own edge component, with no canvas around it (so a spec can assert what is rendered at rest). */
import { render } from '@testing-library/react'
import { Position, ReactFlowProvider } from '@xyflow/react'
import type { ViewLink } from '../../../client'
import { ViewLinkEdge } from '../../../../canvas/edges/ViewLinkEdge'
import { EdgeLabelLayer } from '../../../__tests__/edgeLabelLayer'

const Edge = ViewLinkEdge as unknown as (p: Record<string, unknown>) => JSX.Element

export const drawLinkEdge = (link: ViewLink, i = 0): HTMLElement => render(
  <ReactFlowProvider><EdgeLabelLayer><svg>
    <Edge id={`e${i}`} source={link.from} target={link.to} sourceX={0} sourceY={0} targetX={100} targetY={100}
      sourcePosition={Position.Bottom} targetPosition={Position.Top} data={{ link, i }} />
  </svg></EdgeLabelLayer></ReactFlowProvider>,
).container

/** What an edge draws at rest: its path, and the data the lane reads off it. */
export const restingEdge = (c: HTMLElement) => {
  const g = c.querySelector('g[data-view-link]')
  const p = c.querySelector('path.react-flow__edge-path')
  return { drawn: g !== null && p !== null, dotted: g?.hasAttribute('data-link-dotted') === true, faded: g?.hasAttribute('data-off-path') === true }
}

/**
 * A link on the olumi-core lane's canvas (decision A, 00057 #3): one View link as core's page draws it. Its kind, challenge and
 * proposal are on the path (`data-kind`, `data-alert`, `data-proposed`), a link core doubts is dashed, its hover is core's `title`, and
 * its sign (`label`), when it has one, sits on the line in the canvas's edge-label token, carrying `data-view`.
 */
import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react'
import type { ViewLink } from '../../olumiView/client'
import { typography } from '../../styles/typography'

export type ViewLinkData = { link: ViewLink; i: number }

export function ViewLinkEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, markerEnd }: EdgeProps) {
  const { link, i } = data as ViewLinkData
  const [path, x, y] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })
  const stroke = link.alert ? 'var(--olumi-mark-orange)' : link.proposed ? 'var(--semantic-info)' : 'var(--text-light, #6E6B6B)'
  return (
    <g data-view-link={`links.${i}`} data-kind={link.kind} data-alert={link.alert || undefined} data-proposed={link.proposed || undefined}>
      <title>{link.title}</title>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={{ stroke, strokeWidth: 1.4, ...(link.doubt ? { strokeDasharray: '4 4' } : {}) }} />
      {link.label === '' ? null : (
        <text x={x} y={y} dy="0.35em" textAnchor="middle" className={`${typography.edgeLabel} fill-current`} paintOrder="stroke" stroke="var(--bg-canvas)" strokeWidth={3} data-view={`links.${i}.label`}>{link.label}</text>
      )}
    </g>
  )
}

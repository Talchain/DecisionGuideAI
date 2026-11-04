/**
 * A link on the olumi-core lane's canvas (decision A, 00057 #3): one View link as core's page draws it. Its kind, challenge and
 * proposal are on the path (`data-kind`, `data-alert`, `data-proposed`), a link core doubts is dashed, its hover is core's `title`, and
 * its sign (`label`), when it has one, sits on the line in the canvas's edge-label token, carrying `data-view`. A reason link (a premise
 * or an assumption) is drawn only while one of its cards is hovered or selected (`linkDrawn`); the causal links always are.
 */
import { BaseEdge, getBezierPath, useStore, type EdgeProps } from '@xyflow/react'
import type { ViewLink } from '../../olumiView/client'
import { typography } from '../../styles/typography'
import { linkDrawn } from '../../olumiView/layout'
import { useViewHover } from '../../olumiView/canvas'

export type ViewLinkData = { link: ViewLink; i: number }

export function ViewLinkEdge({ id, source, target, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, markerEnd }: EdgeProps) {
  const { link, i } = data as ViewLinkData
  const hovered = useViewHover((h) => h.id)
  const fromSelected = useStore((s) => s.nodeLookup.get(source)?.selected === true)
  const toSelected = useStore((s) => s.nodeLookup.get(target)?.selected === true)
  const active = new Set<string>()
  if (hovered !== null) active.add(hovered)
  if (fromSelected) active.add(source)
  if (toSelected) active.add(target)
  if (!linkDrawn(link, active)) return null
  const [path, x, y] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })
  const stroke = link.alert ? 'var(--olumi-mark-orange)' : link.proposed ? 'var(--semantic-info)' : 'color-mix(in srgb, var(--text-light, #6E6B6B) 55%, transparent)'
  return (
    <g data-view-link={`links.${i}`} data-kind={link.kind} data-alert={link.alert || undefined} data-proposed={link.proposed || undefined}>
      <title>{link.title}</title>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={{ stroke, strokeWidth: 1, ...(link.doubt ? { strokeDasharray: '4 4' } : {}) }} />
      {link.label === '' ? null : (
        <text x={x} y={y} dy="0.35em" textAnchor="middle" className={`${typography.edgeLabel} fill-current`} paintOrder="stroke" stroke="var(--bg-canvas)" strokeWidth={3} data-view={`links.${i}.label`}>{link.label}</text>
      )}
    </g>
  )
}

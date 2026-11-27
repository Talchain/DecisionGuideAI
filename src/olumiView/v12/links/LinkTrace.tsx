import { BaseEdge } from '@xyflow/react'
import { ICONS, OkIcon, type IconId } from '../../look/icons'
import type { EdgeLook } from './edgeLook'
import { EndMarker } from './LinkEnds'

const MARK_ICON = {
  raises: 'link-raises', lowers: 'link-lowers', depends: 'link-depends',
  disputed: 'link-disputed', unknown: 'link-unknown', none: 'link-none',
} as const satisfies Record<NonNullable<EdgeLook['mark']>, IconId>

type Mark = keyof typeof MARK_ICON

export const linkDirectionHover = (mark: Mark) => ICONS[MARK_ICON[mark]].hover

export function LinkDirectionIcon({ mark }: { mark: Mark }) {
  return <OkIcon id={MARK_ICON[mark]} size={12} decorative inherit />
}

/** The same line, underlays and end at any geometry, with a hit area only on interactive drawings. */
export function LinkTrace({ look, signature, path, marker, id, markerEnd, sample, toneOnLine, keepMarkerDefs }: {
  look: EdgeLook
  signature: string
  path: string
  marker?: string
  id?: string
  markerEnd?: string
  sample?: boolean
  toneOnLine?: boolean
  keepMarkerDefs?: boolean
}) {
  const { end, halos, lineClass, toneClass, allowMarkerOverride } = look
  const endRef = end === 'none' ? undefined
    : (allowMarkerOverride ? markerEnd : undefined) ?? (marker === undefined ? undefined : `url(#${marker})`)

  return (
    <>
      {marker === undefined || (end === 'none' && !keepMarkerDefs) ? null : <defs><EndMarker id={marker} end={end} /></defs>}
      {halos.map(({ kind, className }) => <path key={kind} data-link-halo-path={kind} d={path} className={className} />)}
      <BaseEdge id={id} path={path} className={toneOnLine ? `${lineClass} ${toneClass}` : lineClass} markerEnd={endRef} interactionWidth={sample ? 0 : undefined} data-link-look={signature} />
    </>
  )
}

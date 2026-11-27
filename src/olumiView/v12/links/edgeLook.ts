import type { ViewLink } from '../../client'
import { linkRole } from '../contract'
import { linkLook } from '../fields/fields'
import { DOUBT_DASH, EDGE_NEUTRAL, PLAIN_WIDTH, effectStroke, linkAlertStyle, linkStyle, toneOf } from './styles'

export interface EdgeLookState {
  link: ViewLink
  byOlumi?: boolean
  firstDraft?: boolean
  onPath?: boolean
  driver?: boolean
}

interface HaloPath {
  kind: 'alert' | 'proposed'
  className: string
}

/** The classes and end marker for one View link, independent of its geometry. */
export function edgeLook({ link, byOlumi, firstDraft, onPath, driver }: EdgeLookState) {
  const causal = link.causal ?? null
  const look = linkLook(link)
  const direction = look.source === 'view' && look.direction !== null ? look.direction
    : causal?.sign === 'increases' ? 'raises' : causal?.sign === 'decreases' ? 'lowers' : causal?.sign === 'unknown' ? 'unknown' : null
  const mark = direction ?? (causal?.sign === 'none' ? 'none' : null)
  const role = linkRole(link)
  const style = linkStyle(link)
  const modelled = causal !== null || direction !== null
  const styled = !modelled && style?.role !== 'effect' ? style : null
  const stroke = styled !== null ? styled.stroke
    : modelled ? effectStroke(direction === 'raises' ? 'increases' : direction === 'lowers' ? 'decreases' : null)
      : driver ? 'var(--text-header)' : EDGE_NEUTRAL
  const tone = toneOf(stroke)
  const dash = link.doubt ? DOUBT_DASH : null
  const dotted = styled === null && !modelled && (link.kind === 'reason' || role === 'reason')
  const pathClasses = `${onPath ? ' ok-link-on-path' : ''}${dotted ? ' ok-link-dotted' : ''}${dash !== null ? ' ok-link-doubt' : ''}`
  const alert = linkAlertStyle(link)
  const reasonAlert = alert === 'reason'
  const halos: HaloPath[] = []
  if (alert === 'halo') halos.push({ kind: 'alert', className: 'ok-link-halo ok-link-halo-alert' })
  if ((link.proposed || byOlumi) && !firstDraft) {
    halos.push({
      kind: 'proposed',
      className: `ok-link-halo ok-link-halo-proposed${alert === 'halo' ? ' ok-link-halo-inner' : ''}${pathClasses}`,
    })
  }
  const end = styled?.end ?? 'arrow'
  return {
    direction, confidence: look.confidence, mark, role, styled, modelled, tone, dash, dotted, reasonAlert, halos,
    toneClass: `ok-link-tone-${tone}`,
    lineClass: `ok-link-line${pathClasses}${reasonAlert ? ' ok-link-reason-alert' : ''}`,
    end,
    allowMarkerOverride: styled === null,
    width: (styled?.width ?? PLAIN_WIDTH) + (onPath ? 1 : 0),
  }
}

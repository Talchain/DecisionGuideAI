import { useId } from 'react'
import { BaseEdge } from '@xyflow/react'
import '../../look/olumiLook.css'
import type { ViewLink, ViewModel } from '../../client'
import { linkRole } from '../contract'
import { linkLook } from '../fields/fields'
import { EndMarker } from './LinkEnds'
import { EDGE_NEUTRAL, INK, effectStroke, linkStyle, toneOf, type LineEnd, type Tone } from './styles'

export type ConnectorLook = { tone: Tone; dash: 'none' | 'doubt' | 'dotted'; end: LineEnd; halo: 'none' | 'alert' | 'proposed' | 'both'; reasonAlert: boolean }
export const lookKey = ({ tone, dash, end, halo, reasonAlert }: ConnectorLook): string => `${tone}:${dash}:${end}:${halo}:${reasonAlert}`

export function directionOf(link: ViewLink) {
  const typed = linkLook(link)
  return typed.source === 'view' && typed.direction !== null ? typed.direction
    : link.causal?.sign === 'increases' ? 'raises' : link.causal?.sign === 'decreases' ? 'lowers' : link.causal?.sign === 'unknown' ? 'unknown' : null
}

export function connectorLookOf(link: ViewLink, { firstDraft, byOlumi, driver }: { firstDraft: boolean; byOlumi: boolean; driver: boolean }): ConnectorLook {
  const direction = directionOf(link)
  const modelled = link.causal != null || direction !== null
  const role = linkRole(link), style = linkStyle(link)
  const styled = !modelled && style?.role !== 'effect' ? style : null
  const reason = link.kind === 'reason'
  const alert = link.alert && !reason, proposed = (link.proposed || byOlumi) && !firstDraft
  const stroke = styled?.stroke ?? (modelled ? effectStroke(direction === 'raises' ? 'increases' : direction === 'lowers' ? 'decreases' : null) : driver ? INK : EDGE_NEUTRAL)
  return {
    tone: toneOf(stroke), end: styled?.end ?? 'arrow',
    dash: link.doubt ? 'doubt' : styled === null && !modelled && (reason || role === 'reason') ? 'dotted' : 'none',
    halo: alert ? (proposed ? 'both' : 'alert') : proposed ? 'proposed' : 'none',
    reasonAlert: Boolean(link.alert && reason),
  }
}

export function connectorMeaning(link: ViewLink, key: ViewModel['key']) {
  const { direction, directionState } = linkLook(link)
  const unsettled = directionState === 'present'
    ? direction === 'depends' || direction === 'disputed' || direction === 'unknown'
    : link.causal?.sign === 'unknown'
  const role = linkRole(link)
  // Prefer a more specific typed meaning when Core supplies its wording.
  const ids = [link.doubt === true ? 'doubted' : null, unsettled ? 'unsettled' : null,
    link.kind === 'reason' || role === 'reason' ? 'reason' : null, link.causal != null ? 'effect' : role]
  for (const id of ids) {
    const item = key?.find((k) => k.id === id)
    if (item !== undefined) return item
  }
  return undefined
}

export const ROOT_LOOK: ConnectorLook = { tone: 'neutral', dash: 'none', end: 'none', halo: 'none', reasonAlert: false }
export const groupLook = (directed: boolean): ConnectorLook => directed ? { ...ROOT_LOOK, end: 'arrow' } : ROOT_LOOK

export function ConnectorLine({ id, path, look, markerId, onPath }: { id?: string; path: string; look: ConnectorLook; markerId?: string; onPath?: boolean }) {
  const uid = useId()
  const marker = markerId ?? uid
  const alert = look.halo === 'alert' || look.halo === 'both'
  const proposed = look.halo === 'proposed' || look.halo === 'both'
  return <>
    {look.end === 'none' ? null : <defs><EndMarker id={marker} end={look.end} /></defs>}
    {alert ? <path data-link-halo-path="alert" d={path} className="ok-link-halo ok-link-halo-alert" /> : null}
    {proposed ? <path data-link-halo-path="proposed" d={path} className={alert ? 'ok-link-halo ok-link-halo-proposed ok-link-halo-inner' : 'ok-link-halo ok-link-halo-proposed'} /> : null}
    <BaseEdge id={id} path={path} interactionWidth={id === undefined ? 0 : undefined}
      className={`ok-link-line${onPath ? ' ok-link-on-path' : ''}${look.dash === 'dotted' ? ' ok-link-dotted' : ''}${look.dash === 'doubt' ? ' ok-link-doubt' : ''}${look.reasonAlert ? ' ok-link-reason-alert' : ''}`}
      markerEnd={look.end === 'none' ? undefined : `url(#${marker})`} />
  </>
}

export function ConnectorSwatch({ look }: { look: ConnectorLook }) {
  const path = look.end === 'dot' ? 'M6 2V12' : 'M6 2V14'
  return <svg width="12" height="16" aria-hidden="true" data-look={lookKey(look)} className={`ok-connector-swatch ok-link-tone-${look.tone}`}>
    <ConnectorLine path={path} look={look} />
  </svg>
}

export function ConnectorLeader({ i, path, removal }: { i: number; path: string; removal?: boolean }) {
  return <path d={path} className="ok-link-leader" {...(removal ? { 'data-view-link-remove-leader': `links.${i}` } : { 'data-view-link-leader': `links.${i}` })} />
}

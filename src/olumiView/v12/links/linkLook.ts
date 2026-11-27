import type { ViewLink, ViewModel } from '../../client'
import { linkByOlumi } from '../../layout'
import { linkRole } from '../contract'
import { linkLook } from '../fields/fields'
import { DOUBT_DASH, EDGE_NEUTRAL, PLAIN_WIDTH, effectStroke, linkAlertStyle, linkStyle, toneOf } from './styles'

export const LINK_MARK_IDS = { raises: 'link-raises', lowers: 'link-lowers', depends: 'link-depends', disputed: 'link-disputed', unknown: 'link-unknown', none: 'link-none' } as const

/** The committed link at rest. Selection, the lit path and the driver lens are canvas interactions. */
export function linkLookOf(link: ViewLink, owner: ViewModel | null, firstDraft: boolean) {
  const causal = link.causal ?? null
  const look = linkLook(link)
  const direction = look.source === 'view' && look.direction !== null ? look.direction
    : causal?.sign === 'increases' ? 'raises' : causal?.sign === 'decreases' ? 'lowers' : causal?.sign === 'unknown' ? 'unknown' : null
  const directionMark = direction ?? (causal?.sign === 'none' ? 'none' : null)
  const role = linkRole(link)
  const style = linkStyle(link)
  const styled = causal === null && direction === null && style !== null && style.role !== 'effect' ? style : null
  const modelled = styled === null && (causal !== null || direction !== null)
  const byOlumi = owner !== null && linkByOlumi(owner, link.from, link.to)
  const alert = linkAlertStyle(link)
  const reasonAlert = alert === 'reason'
  const stroke = styled?.stroke ?? (modelled ? effectStroke(direction === 'raises' ? 'increases' : direction === 'lowers' ? 'decreases' : null) : EDGE_NEUTRAL)
  const doubt = !!link.doubt
  const dotted = styled === null && !modelled && (link.kind === 'reason' || role === 'reason')
  return {
    role, styled, direction, directionMark, modelled, byOlumi, confidence: look.confidence,
    stroke: reasonAlert ? 'var(--olumi-mark-orange)' : stroke,
    tone: toneOf(stroke),
    // olumiLook.css applies the reason dots first, then the doubt dash.
    dash: doubt ? DOUBT_DASH : dotted ? '0.1 6' : null,
    endStroke: stroke,
    end: styled?.end ?? 'arrow',
    width: styled?.width ?? PLAIN_WIDTH,
    mark: role === 'size' ? null : directionMark,
    doubt,
    haloAlert: alert === 'halo',
    haloProposed: (link.proposed || byOlumi) && !firstDraft,
    dotted,
    reasonAlert,
  } as const
}

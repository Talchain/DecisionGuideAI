/**
 * A link on the olumi-core lane's canvas (decision A, 00057 #3): one View link as core's page draws it. Its kind, challenge and
 * proposal are on the path (`data-kind`, `data-alert`, `data-proposed`), a link core doubts is dashed, its hover is core's `title`, and
 * its sign (`label`), when it has one, sits on the line in the canvas's edge-label token, carrying `data-view`, and its strength in core's
 * words (`effect.text`, its hover core's `effect.title`) when core sizes it; both in React Flow's label layer, above resting cards. A reason link (a premise
 * or an assumption) is drawn only while one of its cards is hovered or selected (`linkDrawn`); the causal links always are.
 */
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { BaseEdge, EdgeLabelRenderer, getBezierPath, useStore, type EdgeProps } from '@xyflow/react'
import { linkWordsAt } from './linkWordsPlace'
import { railOf } from './linkRail'
import type { ViewLink } from '../../olumiView/client'
import { typography } from '../../styles/typography'
import { linkDrawn } from '../../olumiView/layout'
import { useViewHover } from '../../olumiView/canvas'
import { useDriverLink } from '../../olumiView/lens'
import { GOAL_CHANCE_DRIVER_TAG_Z } from '../utils/goalChanceDriverLinks'

export type ViewLinkData = { link: ViewLink; i: number }

export function ViewLinkEdge({ id, source, target, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, markerEnd }: EdgeProps) {
  const { link, i } = data as ViewLinkData
  const hovered = useViewHover((h) => h.id)
  const fromSelected = useStore((s) => s.nodeLookup.get(source)?.selected === true)
  const toSelected = useStore((s) => s.nodeLookup.get(target)?.selected === true)
  // What would change: a link leaving (or sized by) a figure an option's chance moves most with is drawn wider, in ink.
  const driver = useDriverLink(i)
  const active = new Set<string>()
  if (hovered !== null) active.add(hovered)
  if (fromSelected) active.add(source)
  if (toSelected) active.add(target)
  // The cards as React Flow holds them (flow units), and the words' own drawn size: the words sit off every card (linkWordsPlace.ts).
  const nodeLookup = useStore((s) => s.nodeLookup)
  const cards = useMemo(() => [...nodeLookup.values()].map((n) => ({ x: n.internals.positionAbsolute.x, y: n.internals.positionAbsolute.y, w: n.measured.width ?? 0, h: n.measured.height ?? 0 })), [nodeLookup])
  const wordsRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  // eslint-disable-next-line react-hooks/exhaustive-deps -- after every render; an equal size bails out
  useLayoutEffect(() => { const el = wordsRef.current; if (el && (el.offsetWidth !== size.w || el.offsetHeight !== size.h)) setSize({ w: el.offsetWidth, h: el.offsetHeight }) })
  if (!driver && !linkDrawn(link, active)) return null
  // R25: a link into a card above its source (an outcome into its aim beside the question) runs round the board (linkRail.ts).
  const boxOf = (n: string) => { const v = nodeLookup.get(n); return v ? { x: v.internals.positionAbsolute.x, y: v.internals.positionAbsolute.y, w: v.measured.width ?? 0, h: v.measured.height ?? 0 } : null }
  const from = boxOf(source), to = boxOf(target)
  const rail = from && to ? railOf(from, to, cards) : null
  const [bezier, midX, midY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })
  const path = rail?.path ?? bezier
  const { x, y } = rail ?? linkWordsAt(path, cards, size, { x: midX, y: midY })
  const stroke = link.alert ? 'var(--olumi-mark-orange)' : link.proposed ? 'var(--semantic-info)' : driver ? 'var(--text-header)' : 'color-mix(in srgb, var(--text-light, #6E6B6B) 55%, transparent)'
  return (
    <g data-view-link={`links.${i}`} data-rail={rail ? '' : undefined} data-driver-link={driver || undefined} data-kind={link.kind} data-alert={link.alert || undefined} data-proposed={link.proposed || undefined}>
      <title>{link.title}</title>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={{ stroke, strokeWidth: driver ? 2.5 : 1, ...(link.doubt ? { strokeDasharray: '4 4' } : {}) }} />
      {link.label === '' && link.effect == null ? null : (
        // The words on the line sit in React Flow's label layer, above a resting card (z 0) and below a selected one (1000), so a card
        // never cuts them (DL 4 Nov, R3: "…week" clipped under a card); the line itself stays under the cards. They sit at the nearest point
        // along the path clear of every card (R5 item 3), so they never cover a card's text either.
        <EdgeLabelRenderer>
          <div ref={wordsRef} className={`nodrag nopan ${typography.viewLabel} flex flex-col items-center rounded px-1 text-text-body`} data-view-link-words={`links.${i}`}
            style={{ position: 'absolute', transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`, zIndex: GOAL_CHANCE_DRIVER_TAG_Z, background: 'var(--bg-canvas)', pointerEvents: 'none' }}>
            {link.label === '' ? null : <span data-view={`links.${i}.label`}>{link.label}</span>}
            {/* Its strength in core's words (`effect`, core 685e725), with core's hover; under the sign when the link has one. */}
            {link.effect == null ? null : <span title={link.effect.title} style={{ pointerEvents: 'auto' }} data-view={`links.${i}.effect.text`}>{link.effect.text}</span>}
          </div>
        </EdgeLabelRenderer>
      )}
    </g>
  )
}

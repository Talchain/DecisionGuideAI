/**
 * A link on the olumi-core lane's canvas (decision A, 00057 #3): one View link as core's page draws it. Its kind, challenge and
 * proposal are on the path (`data-kind`, `data-alert`, `data-proposed`), a link core doubts is dashed, its hover is core's `title`, and
 * its sign (`label`), when it has one, sits on the line in the canvas's edge-label token, carrying `data-view`, and its strength in core's
 * words (`effect.text`, its hover core's `effect.title`) when core sizes it; both in React Flow's label layer, above resting cards. A reason link (a premise
 * or an assumption) is drawn only while one of its cards is hovered or selected (`linkDrawn`); the causal links always are.
 */
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { BaseEdge, EdgeLabelRenderer, getBezierPath, useStore, type EdgeProps, type ReactFlowState } from '@xyflow/react'
import { linkWordsAt, type Placed } from './linkWordsPlace'
import { railOf, railSlots, railWordsAt } from './linkRail'
import type { ViewLink } from '../../olumiView/client'
import { typography } from '../../styles/typography'
import { linkDrawn } from '../../olumiView/layout'
import { linkWordsIdOf, useViewFocusLink, useViewHover } from '../../olumiView/canvas'
import { useDriverLink } from '../../olumiView/lens'
import { GOAL_CHANCE_DRIVER_TAG_Z } from '../utils/goalChanceDriverLinks'

export type ViewLinkData = { link: ViewLink; i: number }

type CardBox = { readonly id: string; readonly x: number; readonly y: number; readonly w: number; readonly h: number }
/**
 * The cards as React Flow holds them now (flow units). React Flow refills one `nodeLookup` Map in place (xyflow adoptUserNodes), so a
 * memo keyed on the Map kept the boxes of the edge's first render, before the cards were laid out and measured, and the words then sat
 * at the midpoint over a card (Paul's "ent!prise", 7 Nov). This reads the boxes on every store change and re-renders only when one moved
 * or resized.
 */
export const cardBoxesOf = (s: ReactFlowState): CardBox[] =>
  [...s.nodeLookup.values()].map((n) => ({ id: n.id, x: n.internals.positionAbsolute.x, y: n.internals.positionAbsolute.y, w: n.measured.width ?? 0, h: n.measured.height ?? 0 }))
const sameBoxes = (a: CardBox[], b: CardBox[]) =>
  a.length === b.length && a.every((p, k) => { const q = b[k]!; return p.id === q.id && p.x === q.x && p.y === q.y && p.w === q.w && p.h === q.h })

export function ViewLinkEdge({ id, source, target, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, markerEnd, selected = false }: EdgeProps) {
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
  const cards = useStore(cardBoxesOf, sameBoxes)
  // R25: a link into a card above its source (an outcome into its aim beside the question) runs round the board (linkRail.ts).
  const from = cards.find((c) => c.id === source), to = cards.find((c) => c.id === target)
  // Each rail link has its own rail (PL 7 Nov): the slots of every drawn link into the head row, by their sources across the board.
  const edges = useStore((s) => s.edges)
  const slot = useMemo(() => {
    const at = (n: string) => cards.find((c) => c.id === n)
    const ls = edges.flatMap((e) => { const f = at(e.source), t = at(e.target); return f && t ? [{ id: e.id, from: f, to: t }] : [] })
    return railSlots(ls, cards).get(id) ?? 0
  }, [edges, cards, id])
  const wordsRef = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  // eslint-disable-next-line react-hooks/exhaustive-deps -- after every render; an equal size bails out
  useLayoutEffect(() => { const el = wordsRef.current; if (el && (el.offsetWidth !== size.w || el.offsetHeight !== size.h)) setSize({ w: el.offsetWidth, h: el.offsetHeight }) })
  // And the moment the words are put in the label layer, which can mount after the edge (the effect above runs only when the edge renders).
  const attachWords = useCallback((el: HTMLDivElement | null) => {
    wordsRef.current = el
    if (el) setSize((s) => (s.w === el.offsetWidth && s.h === el.offsetHeight ? s : { w: el.offsetWidth, h: el.offsetHeight }))
  }, [])
  // A link with keyboard focus (links are focusable) is drawn and says its words, as a selected one does (DL 7 Nov: focus alone).
  const focused = useViewFocusLink((f) => f.id === id)
  if (!driver && !focused && !linkDrawn(link, active)) return null
  // R25 (plan v3 item 7, Paul's 2A): at rest a link says its sign and any "!"; its strength in core's words shows while the link is selected
  // or focused, or a card at either end is hovered or selected, and on a driver link.
  const near = selected || focused || driver || active.has(source) || active.has(target)
  const effect = near ? link.effect ?? null : null
  const rail = from && to ? railOf(from, to, cards, slot) : null
  const [bezier, midX, midY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })
  const path = rail?.path ?? bezier
  const placed: Placed = rail ? railWordsAt(rail, size, cards) : linkWordsAt(path, cards, size, { x: midX, y: midY })
  const { x, y } = placed
  // Words with no clear room within reach of their link (PL/DL 7 Nov: never detached) show only while the link is near, with their leader.
  const words = (link.label !== '' || effect !== null) && (placed.far !== true || near)
  const stroke = link.alert ? 'var(--olumi-mark-orange)' : link.proposed ? 'var(--semantic-info)' : driver ? 'var(--text-header)' : 'color-mix(in srgb, var(--text-light, #6E6B6B) 55%, transparent)'
  return (
    <g data-view-link={`links.${i}`} data-rail={rail ? '' : undefined} data-driver-link={driver || undefined} data-kind={link.kind} data-alert={link.alert || undefined} data-proposed={link.proposed || undefined}>
      <title>{link.title}</title>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={{ stroke, strokeWidth: driver ? 2.5 : 1, ...(link.doubt ? { strokeDasharray: '4 4' } : {}) }} />
      {words && placed.leaderTo ? (
        <path data-view-link-leader={`links.${i}`} d={`M ${x},${y} L ${placed.leaderTo.x},${placed.leaderTo.y}`} fill="none" stroke={stroke} strokeWidth={1} strokeDasharray="2 3" />
      ) : null}
      {!words ? null : (
        // The words on the line sit in React Flow's label layer, above a resting card (z 0) and below a selected one (1000), so a card
        // never cuts them (DL 4 Nov, R3: "…week" clipped under a card); the line itself stays under the cards. They sit at the nearest point
        // along the path clear of every card (R5 item 3), so they never cover a card's text either.
        <EdgeLabelRenderer>
          <div ref={attachWords} id={linkWordsIdOf(i)} className={`nodrag nopan ${typography.viewLabel} flex flex-col items-center rounded px-1 text-text-body`} data-view-link-words={`links.${i}`}
            style={{ position: 'absolute', transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`, zIndex: GOAL_CHANCE_DRIVER_TAG_Z, background: 'var(--bg-canvas)', pointerEvents: 'none' }}>
            {link.label === '' ? null : <span data-view={`links.${i}.label`}>{link.label}</span>}
            {/* Its strength in core's words (`effect`, core 685e725), with core's hover; under the sign when the link has one. */}
            {effect === null ? null : <span title={effect.title} style={{ pointerEvents: 'auto' }} data-view={`links.${i}.effect.text`}>{effect.text}</span>}
          </div>
        </EdgeLabelRenderer>
      )}
    </g>
  )
}

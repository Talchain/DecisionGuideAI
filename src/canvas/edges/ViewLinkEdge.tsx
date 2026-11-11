/**
 * A link on the olumi-core lane's canvas (decision A, 00057 #3): one View link as core's page draws it. Its kind, challenge and
 * proposal are on the path (`data-kind`, `data-alert`, `data-proposed`), a link core doubts is dashed, its hover is core's `title`, and
 * its sign (`label`), when it has one, sits on the line in the canvas's edge-label token, carrying `data-view`, and its strength in core's
 * words (`effect.text`, its hover core's `effect.title`) when core sizes it; both in React Flow's label layer, above resting cards. A reason link (a premise
 * or an assumption) is drawn only while one of its cards is hovered or selected (`linkDrawn`); the causal links always are.
 */
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { reducedFaceSize } from '../../olumiView/camera'
import { BaseEdge, EdgeLabelRenderer, getBezierPath, useStore, type EdgeProps, type ReactFlowState } from '@xyflow/react'
import { linkWordsAt, type Placed } from './linkWordsPlace'
import { railOf, railSlots, railWordsAt } from './linkRail'
import type { ViewLink } from '../../olumiView/client'
import { typography } from '../../styles/typography'
import { LinkRemove, useRemovingLink } from '../../olumiView/LinkRemove'
import { linkByOlumi, linkDrawn, routeRailAtRest } from '../../olumiView/layout'
import { useViewStore } from '../../olumiView/store'
import { linkWordsIdOf, useViewFocusLink, useViewHover } from '../../olumiView/canvas'
import { useDriverLink } from '../../olumiView/lens'
import { GOAL_CHANCE_DRIVER_TAG_Z } from '../utils/goalChanceDriverLinks'
import { LinkMarkChip, useLineMarked } from '../../olumiView/LinkMarkChip'
import { railObstacles, useLinkWordsBoxes, useRailBoxes, wordsBefore } from '../../olumiView/railBoxes'

export type ViewLinkData = { link: ViewLink; i: number }

export type CardBox = { readonly id: string; readonly x: number; readonly y: number; readonly w: number; readonly h: number }
/**
 * The cards as React Flow holds them now (flow units). React Flow refills one `nodeLookup` Map in place (xyflow adoptUserNodes), so a
 * memo keyed on the Map kept the boxes of the edge's first render, before the cards were laid out and measured, and the words then sat
 * at the midpoint over a card (Paul's "ent!prise", 7 Nov). This reads the boxes on every store change and re-renders only when one moved
 * or resized.
 */
export const cardBoxesOf = (s: ReactFlowState): CardBox[] =>
  [...s.nodeLookup.values()].map((n) => ({ id: n.id, x: n.internals.positionAbsolute.x, y: n.internals.positionAbsolute.y, w: n.measured.width ?? 0, h: n.measured.height ?? 0 }))
export const sameBoxes = (a: CardBox[], b: CardBox[]) =>
  a.length === b.length && a.every((p, k) => { const q = b[k]!; return p.id === q.id && p.x === q.x && p.y === q.y && p.w === q.w && p.h === q.h })

export function ViewLinkEdge({ id, source, target, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, markerEnd, selected = false }: EdgeProps) {
  const { link, i } = data as ViewLinkData
  const byOlumi = useViewStore((s) => (s.view?.model == null ? false : linkByOlumi(s.view.model, link.from, link.to)))
  const fromRoute = useViewStore((s) => s.view?.model?.cards.find((c) => c.id === link.from)?.family === 'option')
  const hovered = useViewHover((h) => h.id)
  const fromSelected = useStore((s) => s.nodeLookup.get(source)?.selected === true)
  const toSelected = useStore((s) => s.nodeLookup.get(target)?.selected === true)
  // What would change: a link leaving (or sized by) a figure an option's chance moves most with is drawn wider, in ink.
  const driver = useDriverLink(i)
  const marked = useLineMarked(i, link)
  const active = new Set<string>()
  if (hovered !== null) active.add(hovered)
  if (fromSelected) active.add(source)
  if (toSelected) active.add(target)
  // The cards as React Flow holds them (flow units), and the words' own drawn size: the words sit off every card (linkWordsPlace.ts).
  const cards = useStore(cardBoxesOf, sameBoxes)
  // ...and off the chips on every card's rail, which hangs below the card out of React Flow's box (olumiView/railBoxes.ts; Paul's gate,
  // 8 Nov: "replaces" sat over the end of a doubted link's chip). Only the words move; the line and its rail run by the cards alone.
  // The same boxes keep the same array, so a rail elsewhere changing does not place these words again.
  const rails = useRailBoxes((s) => s.rails)
  const lastClear = useRef<CardBox[] | null>(null)
  const clearOf = useMemo(() => {
    const next = [...cards, ...railObstacles(cards, rails)]
    if (lastClear.current !== null && sameBoxes(lastClear.current, next)) return lastClear.current
    lastClear.current = next
    return next
  }, [cards, rails])
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
  // A removal on its way keeps the link and its ask drawn, whatever focus does (Codex delta 4960db98).
  const removing = useRemovingLink(link.remove)
  const rail = from && to ? railOf(from, to, cards, slot) : null
  const [bezier, midX, midY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })
  const path = rail?.path ?? bezier
  // Placed again only when the path, the cards or the words' size change (the off-path search is the costly part). A rail's path fixes its rail.
  // Clear of the words of the links before this one too (railBoxes.ts useLinkWordsBoxes): opened cards' near links no longer stack words.
  const before = wordsBefore(useLinkWordsBoxes((s) => s.boxes), i)
  const clearOfWords = useMemo(() => (before.list.length === 0 ? clearOf : [...clearOf, ...before.list]), [clearOf, before.key]) // eslint-disable-line react-hooks/exhaustive-deps -- the key names the boxes
  const placed: Placed = useMemo(() => (rail ? railWordsAt(rail, size, clearOfWords, cards) : linkWordsAt(path, clearOfWords, size, { x: midX, y: midY })),
    [path, clearOfWords, size, midX, midY]) // eslint-disable-line react-hooks/exhaustive-deps -- `rail` follows `path`
  // R25 (plan v3 item 7, Paul's 2A): at rest a link says its sign and any "!"; its strength in core's words shows while the link is selected
  // or focused, or a card at either end is hovered or selected, and on a driver link.
  const near = selected || focused || driver || active.has(source) || active.has(target)
  const effect = near ? link.effect ?? null : null
  const { x, y } = placed
  // Zoomed out (below the readable zoom, camera.ts) the cards draw less and so do the links: at rest a link says its sign by its colour
  // only, so the overview stays quiet (Paul 10 Nov, 68be1258). B1 (Paul's "do now", 11 Nov): the first open is the whole board, below that
  // zoom on every real model, so a link near what the person points at (a card hovered or selected, the link selected or focused, a driver
  // link) says its sign and its strength there too, at the size the cards' reduced face draws at: the reduced face's own label
  // counter-scale (camera.ts reducedFaceSize), set on the words as on the face, so they never draw at the bare zoom's ~5 px (DL 10 Nov).
  const faceScale = useStore((st) => reducedFaceSize(st.transform[2]))
  const zoomedOut = faceScale > 0
  const words = (link.label !== '' || effect !== null) && (!zoomedOut || near)
  // Words with no room within reach of their link (PL/DL 7 Nov: never detached) are hidden at rest and shown, with their leader, while the
  // link is near. Hidden, not removed, so they are still measured: as the strength words leave, the sign alone may fit by the link again.
  const hidden = placed.far === true && !near
  // This link's words, while drawn, are a box the later links keep clear of.
  const putWords = useLinkWordsBoxes((s) => s.put), dropWords = useLinkWordsBoxes((s) => s.drop)
  const shown = words && !hidden && size.w > 0
  useLayoutEffect(() => { if (shown) putWords(i, { id: '', x: placed.x - size.w / 2, y: placed.y - size.h / 2, w: size.w, h: size.h }); else dropWords(i) }, [shown, i, placed.x, placed.y, size.w, size.h, putWords, dropWords])
  useLayoutEffect(() => () => dropWords(i), [i, dropWords])
  // The remove control (R25 slice 2b) goes by the words' own rule: at the point nearest the link where its measured box touches no card
  // and not the link's words (DL 7 Nov: under the words it covered OC1 "total capacity" at every width). Measured as it attaches and
  // whenever its size changes (its ask is wider than its button); until measured it is not shown.
  const offering = (selected || focused || removing) && link.remove != null
  const [ctl, setCtl] = useState({ w: 0, h: 0 })
  const ctlSeen = useRef<ResizeObserver | null>(null)
  const attachCtl = useCallback((el: HTMLDivElement | null) => {
    ctlSeen.current?.disconnect(); ctlSeen.current = null
    if (!el) return
    const read = () => setCtl((s) => (s.w === el.offsetWidth && s.h === el.offsetHeight ? s : { w: el.offsetWidth, h: el.offsetHeight }))
    read()
    if (typeof ResizeObserver !== 'undefined') { ctlSeen.current = new ResizeObserver(read); ctlSeen.current.observe(el) }
  }, [])
  const ctlAt: Placed | null = useMemo(() => {
    if (!offering || ctl.w === 0) return null
    const shownWords = words && !hidden ? [{ id: '', x: x - size.w / 2, y: y - size.h / 2, w: size.w, h: size.h }] : []
    return linkWordsAt(path, [...clearOf, ...shownWords], ctl, { x: midX, y: midY })
  }, [offering, ctl, words, hidden, x, y, size, path, clearOf, midX, midY])
  const markCards = useMemo(() => (words && !hidden ? [...clearOf, { id: '', x: x - size.w / 2, y: y - size.h / 2, w: size.w, h: size.h }] : clearOf), [words, hidden, clearOf, x, y, size])
  // A route's rail is drawn while either of its cards is active (layout.ts routeRailAtRest).
  if (!driver && !focused && !removing && !marked && (!linkDrawn(link, active) || !routeRailAtRest(link, fromRoute, rail !== null, active))) return null
  // J1 gate (the prototype's links): full strength, 1.5 px, an arrowhead where it arrives, its sign as its colour (core's "+" green, "−"
  // pink), which outranks Olumi's colour (both prototypes); a link Olumi inferred is dashed, and in Olumi's colour where it has no sign.
  // DL round 5 (rehearsal item 10): a rail round the board is quiet at rest, the neutral link grey at 1 px, so the rails are not the first
  // thing the eye meets; near (either card hovered or selected, the link selected or focused) it takes its sign's colour and full weight.
  // Never faded: a quieter colour, not opacity (nothing dims). An alert, a proposal or a driver link is never quiet.
  const quiet = rail !== null && !near && !link.alert && !link.proposed && !marked && !removing
  const stroke = link.alert ? 'var(--olumi-mark-orange)' : link.proposed ? 'var(--semantic-info)' : driver ? 'var(--text-header)' : quiet ? 'var(--edge-neutral)' : link.label === '+' ? '#62B290' : link.label === '−' ? '#D6336C' : byOlumi ? 'var(--semantic-info)' : '#A9AAA5'
  const arrow = `view-link-arrow-${i}`
  return (
    <g data-view-link={`links.${i}`} data-rail={rail ? '' : undefined} data-quiet={quiet || undefined} data-driver-link={driver || undefined} data-kind={link.kind} data-alert={link.alert || undefined} data-proposed={link.proposed || undefined} data-olumi={byOlumi || undefined}>
      <title>{link.title}</title>
      <defs><marker id={arrow} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M0,0 L8,4 L0,8 z" fill={stroke} /></marker></defs>
      <BaseEdge id={id} path={path} markerEnd={markerEnd ?? `url(#${arrow})`} style={{ stroke, strokeWidth: driver ? 2.5 : quiet ? 1 : 1.5, ...(link.doubt || byOlumi ? { strokeDasharray: '5 5' } : {}) }} />
      {words && !hidden && placed.leaderTo ? (
        <path data-view-link-leader={`links.${i}`} d={`M ${x},${y} L ${placed.leaderTo.x},${placed.leaderTo.y}`} fill="none" stroke={stroke} strokeWidth={1} strokeDasharray="2 3" />
      ) : null}
      {!words ? null : (
        // The words on the line sit in React Flow's label layer, above a resting card (z 0) and below a selected one (1000), so a card
        // never cuts them (DL 4 Nov, R3: "…week" clipped under a card); the line itself stays under the cards. They sit at the nearest point
        // along the path clear of every card and the chips on its rail (R5 item 3; TM-04 gate), so they never cover a card's or a chip's text.
        <EdgeLabelRenderer>
          <div ref={attachWords} id={linkWordsIdOf(i)} className={`nodrag nopan ${typography.viewLabel} flex flex-col items-center rounded px-1 text-text-body`} data-view-link-words={`links.${i}`}
            style={{ position: 'absolute', transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`, zIndex: GOAL_CHANCE_DRIVER_TAG_Z, background: 'var(--bg-canvas)', pointerEvents: 'none', ...(hidden ? { visibility: 'hidden' as const } : {}), ...(zoomedOut ? { ['--canvas-label-scale' as string]: String(faceScale) } : {}) }}>
            {link.label === '' ? null : <span data-view={`links.${i}.label`}>{link.label}</span>}
            {/* Its strength in core's words (`effect`, core 685e725), with core's hover; under the sign when the link has one. */}
            {effect === null ? null : <span title={effect.title} style={{ pointerEvents: 'auto' }} data-view={`links.${i}.effect.text`}>{effect.text}</span>}
          </div>
        </EdgeLabelRenderer>
      )}
      {/* A revealed stance on this line (core `link_marks`), off every card and off this line's own words. */}
      <LinkMarkChip i={i} link={link} path={path} cards={markCards} midX={midX} midY={midY} />
      {/* R25 slice 2b: where core names the one record (and part) this line stands for (`remove`), the selected or focused link offers to
          take it off, in the label layer above the cards, at its own clear point (`ctlAt`), with a leader to the link when it sits off it. */}
      {offering && ctlAt?.leaderTo ? (
        <path data-view-link-remove-leader={`links.${i}`} d={`M ${ctlAt.x},${ctlAt.y} L ${ctlAt.leaderTo.x},${ctlAt.leaderTo.y}`} fill="none" stroke={stroke} strokeWidth={1} strokeDasharray="2 3" />
      ) : null}
      {offering && link.remove != null ? (
        <EdgeLabelRenderer>
          <div ref={attachCtl} data-link-remove-at={`links.${i}`}
            style={{ position: 'absolute', transform: `translate(-50%, -50%) translate(${ctlAt?.x ?? x}px, ${ctlAt?.y ?? y}px)`, zIndex: GOAL_CHANCE_DRIVER_TAG_Z + 1, ...(ctlAt === null ? { visibility: 'hidden' as const } : {}) }}>
            <LinkRemove edge={id} from={source} remove={link.remove} />
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </g>
  )
}

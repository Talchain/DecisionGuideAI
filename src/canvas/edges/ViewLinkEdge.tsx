/**
 * A link on the olumi-core lane's canvas (decision A, 00057 #3): one View link as core's page draws it. Its kind, challenge and
 * proposal are on the path (`data-kind`, `data-alert`, `data-proposed`), a link core doubts is dashed, its hover is core's `title`, and
 * its sign (`label`), when it has one, sits on the line in the canvas's edge-label token, carrying `data-view`, and its strength in core's
 * words (`effect.text`, its hover core's `effect.title`) when core sizes it; both in React Flow's label layer, above resting cards. A reason link (a premise
 * or an assumption) is drawn only while one of its cards is hovered or selected (`linkDrawn`); the causal links always are.
 */
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { reducedFaceSize } from '../../olumiView/camera'
import { BaseEdge, EdgeLabelRenderer, getBezierPath, Position, useStore, type EdgeProps, type ReactFlowState } from '@xyflow/react'
import { linkWordsAt, type Placed } from './linkWordsPlace'
import { railOf, railSlots, railWordsAt } from './linkRail'
import type { ViewLink } from '../../olumiView/client'
import { typography } from '../../styles/typography'
import { LinkRemove, useRemovingLink } from '../../olumiView/LinkRemove'
import { linkByOlumi, linkDrawn, routeRailAtRest } from '../../olumiView/layout'
import { useViewStore } from '../../olumiView/store'
import { linkWordsIdOf, useViewFocusLink, useViewHover } from '../../olumiView/canvas'
import { useLevel } from '../../olumiView/v12/simpleStore'
import { useDriverLink } from '../../olumiView/lens'
import { GOAL_CHANCE_DRIVER_TAG_Z } from '../utils/goalChanceDriverLinks'
import { LinkMarkChip, useLineMarked } from '../../olumiView/LinkMarkChip'
import { linkRole, sizedLink } from '../../olumiView/v12/contract'
import { firstDraft as firstDraftOf, linkLook, type Direction } from '../../olumiView/v12/fields/fields'
import { HelpCircle, MessagesSquare, Split, type LucideIcon } from 'lucide-react'
import { DIRECTION_NOT_SETTLED, DRIVER_WIDTH, EDGE_NEUTRAL, PLAIN_WIDTH, effectStroke, effectWidth, linkStyle, DOUBT_DASH } from '../../olumiView/v12/links/styles'
import { LINK_OFF_PATH_OPACITY, useFocusPath } from '../../olumiView/v12/bands/focusPath'
import { effectMidpoint } from '../../olumiView/v12/links/geometry'
import { EndMarker, OlumiLineMark, SizeLabel } from '../../olumiView/v12/links/LinkEnds'
import { railObstacles, useLinkWordsBoxes, useRailBoxes, wordsBefore } from '../../olumiView/railBoxes'

export type ViewLinkData = { link: ViewLink; i: number }
/** A causal belief with no verdict (D4): its own small icon (Lucide), on the neutral line; core's words for it are its name. */
const VERDICTLESS_ICON: Readonly<Record<'depends' | 'disputed' | 'unknown', LucideIcon>> = { depends: Split, disputed: MessagesSquare, unknown: HelpCircle }
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

/**
 * MOUNT: this edge draws only on the olumi-core lane's own canvas (olumiView/ViewCanvas): routes/CanvasMVP.tsx mounts ViewCanvas on the lane "never the
 * legacy one" and ReactFlowGraph (the old canvas, which still registers this type) only off it, where no View is drawn (UNVERIFIED by a render; read from source).
 * So the V12 rules below (R5 ladder and neutral lines, the lit path, the first draft) need no second look beside them.
 */
export function ViewLinkEdge({ id, source, target, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, markerEnd, selected = false }: EdgeProps) {
  const { link, i } = data as ViewLinkData
  const causal = link.causal ?? null
  // D4 (the lead, 17 Nov): a causal belief's direction is core's (`link.direction`, fields.ts linkLook); a line core sends none for keeps its typed
  // sign (`causal.sign`), as before: a calculation line's sign is real and already derived, so adopting the field never strips a colour a line has today.
  const look = linkLook(link)
  const direction: Direction | null = look.source === 'view' && look.direction !== null ? look.direction
    : causal?.sign === 'increases' ? 'raises' : causal?.sign === 'decreases' ? 'lowers' : causal?.sign === 'unknown' ? 'unknown' : null
  // V12 (rule 2): a modelled effect says its sign by nothing but its direction of travel; only a legacy link with no typed `causal` keeps its label.
  const signed = causal === null && direction === null && link.label !== ''
  // No verdict (depends, disputed, unknown): the neutral grey and the direction's own small icon, core's words for it on hover.
  const verdictless = direction === 'depends' || direction === 'disputed' || direction === 'unknown' ? direction : null
  const role = linkRole(link)
  const style = linkStyle(link)
  // R5 (Paul, 16 Nov): only a link the engine marks as a causal effect (`causal`, or a direction) is a modelled effect, coloured by its direction and
  // weighted on the width ladder, whatever its role says; every other line is a plain 2 px line (a role's own colour and end stay, its dots and weights do not).
  const styled = causal === null && direction === null && style !== null && style.role !== 'effect' ? style : null
  const modelled = styled === null && (causal !== null || direction !== null)
  const labelWord = useViewStore((s) => causal === null ? s.view?.model?.key.find((k) => k.glyph === link.label)?.text : undefined)
  const byOlumi = useViewStore((s) => (s.view?.model == null ? false : linkByOlumi(s.view.model, link.from, link.to)))
  const linkOlumi = causal === null ? byOlumi : causal.author?.by === 'olumi'
  const fromRoute = useViewStore((s) => s.view?.model?.cards.find((c) => c.id === link.from)?.family === 'option')
  const hovered = useViewHover((h) => h.id)
  const simple = useLevel() === 'simple'
  // A path is lit while a card is hovered or selected (focusPath.ts): the links off it fade to production's 0.18, and only then.
  const offPath = useFocusPath((f) => f.path !== null && !(f.path.has(source) && f.path.has(target)))
  // R3: on a first draft (a proposal and no approved version) everything is proposed, so a proposal is no mark on a link.
  const firstDraft = useViewStore((s) => s.view !== null && firstDraftOf(s.view).firstDraft === true)
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
  // A size wire runs from its figure to the midpoint of the effect link it sizes (never to a card, never as a cause).
  const sizes = role === 'size' ? sizedLink(link) : null
  const sFrom = sizes === null ? undefined : cards.find((c) => c.id === sizes.from), sTo = sizes === null ? undefined : cards.find((c) => c.id === sizes.to)
  const sizeAt = sFrom && sTo ? effectMidpoint(sFrom, sTo) : null
  const rail = sizeAt === null && from && to ? railOf(from, to, cards, slot) : null
  // A link into a card wholly above its source (a claim under the option it argues about) leaves the source's top and enters the target's
  // foot. From the fixed bottom and top handles it ran down, behind both cards and back up, so only two curls showed (Paul's A11 board,
  // 12 Nov). A rail keeps its own ends.
  const up = rail === null && from !== undefined && to !== undefined && to.y + to.h <= from.y ? { from, to } : null
  const [bezier, midX, midY] = getBezierPath(up !== null
    ? { sourceX: up.from.x + up.from.w / 2, sourceY: up.from.y, targetX: up.to.x + up.to.w / 2, targetY: up.to.y + up.to.h, sourcePosition: Position.Top, targetPosition: Position.Bottom }
    : { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })
  const path = sizeAt !== null ? `M ${sourceX},${sourceY} L ${sizeAt.x},${sizeAt.y}` : rail?.path ?? bezier
  // Placed again only when the path, the cards or the words' size change (the off-path search is the costly part). A rail's path fixes its rail.
  // Clear of the words of the links before this one too (railBoxes.ts useLinkWordsBoxes): opened cards' near links no longer stack words.
  const before = wordsBefore(useLinkWordsBoxes((s) => s.boxes), i)
  const clearOfWords = useMemo(() => (before.list.length === 0 ? clearOf : [...clearOf, ...before.list]), [clearOf, before.key]) // eslint-disable-line react-hooks/exhaustive-deps -- the key names the boxes
  const placed: Placed = useMemo(() => (rail ? railWordsAt(rail, size, clearOfWords, cards) : linkWordsAt(path, clearOfWords, size, { x: midX, y: midY })),
    [path, clearOfWords, size, midX, midY]) // eslint-disable-line react-hooks/exhaustive-deps -- `rail` follows `path`
  // R25 (plan v3 item 7, Paul's 2A): at rest a link says its sign and any "!"; its strength in core's words shows while the link is selected
  // or focused, or a card at either end is hovered or selected, and on a driver link.
  const near = selected || focused || driver || active.has(source) || active.has(target)
  const effect = near && role !== 'size' ? link.effect ?? null : null
  const { x, y } = placed
  // Zoomed out (below the readable zoom, camera.ts) the cards draw less and so do the links: at rest a link says its sign by its colour
  // only, so the overview stays quiet (Paul 10 Nov, 68be1258). B1 (Paul's "do now", 11 Nov): the first open is the whole board, below that
  // zoom on every real model, so a link near what the person points at (a card hovered or selected, the link selected or focused, a driver
  // link) says its sign and its strength there too, at the size the cards' reduced face draws at: the words' `viewLabel` token reads the
  // label counter-scale CanvasLabelScaleSync writes on the canvas root (the reduced face's own, camera.ts reducedFaceSize), so they never
  // draw at the bare zoom's ~5 px (DL 10 Nov). The flag, not the scale, is selected: an edge re-renders only when it flips.
  const zoomedOut = useStore((st) => reducedFaceSize(st.transform[2]) > 0)
  // A no-verdict icon (D4) is the line's meaning, not words: Simple draws it at rest at every zoom (its type is counter-scaled to the board, so it is not "zoomed out").
  const words = (signed || effect !== null || verdictless !== null) && role !== 'size' && (!zoomedOut || near || (simple && verdictless !== null))
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
  // V12 Simple draws every link at rest (the structure is the reasoning; only text is removed): reason links and route rails included, quiet.
  if (styled === null && !simple && !driver && !focused && !removing && !marked && (!linkDrawn(link, active) || !routeRailAtRest(link, fromRoute, rail !== null, active))) return null
  // R5 (Paul, 16 Nov): a modelled effect (`causal`) takes its direction's colour and production's width ladder (2 / 3 / 4 / 5); every other line,
  // a plain structural one and a reason link (a note, a route "considered against this aim") included, is 2 px and neutral, and an effect's
  // colour is never borrowed for it. A dash means doubt and nothing else. Nothing fades at rest: a link fades only while a path is lit (`offPath`).
  // An alert (core's orange) and a driver link (the lens) are never quiet. Olumi's blue marks a link Olumi proposed or inferred inside a model
  // already approved; on a first draft everything is proposed, so it marks nothing (R3).
  // An Olumi-proposed link in an approved model draws as Olumi's whatever its kind, a reason line included (Line reviewer, 38ef5ce8).
  const olumiInk = (link.proposed || byOlumi) && !firstDraft
  const stroke = styled !== null ? styled.stroke : link.alert ? 'var(--olumi-mark-orange)' : modelled ? effectStroke(direction === 'raises' ? 'increases' : direction === 'lowers' ? 'decreases' : null) : driver ? 'var(--text-header)' : olumiInk ? 'var(--semantic-info)' : EDGE_NEUTRAL
  const dash = link.doubt ? DOUBT_DASH : null
  // A driver link (the lens) is at least the ladder's 4 px rung, never thinner than the width its own strength earns.
  const width = Math.max(modelled ? effectWidth(causal?.strength.share) : styled?.width ?? PLAIN_WIDTH, driver ? DRIVER_WIDTH : 0)
  const title = causal === null ? link.title : [causal.text, causal.author?.title, link.title].filter(Boolean).join('\n')
  const arrow = `view-link-arrow-${i}`
  return (
    <g data-view-link={`links.${i}`} data-link-direction={direction ?? undefined} data-link-confidence={look.confidence ?? undefined} data-rail={rail ? '' : undefined} data-driver-link={driver || undefined} data-kind={link.kind} data-alert={link.alert || undefined} data-proposed={link.proposed || undefined} data-olumi={linkOlumi || undefined} data-causal-sign={causal?.sign} data-causal-state={causal?.strength.state} data-causal-disputed={causal?.disputed || undefined} data-link-role={styled?.role ?? role ?? undefined} data-link-end={styled?.end ?? (modelled ? 'arrow' : undefined)} data-link-dash={dash ?? undefined} data-link-width={width} data-off-path={offPath || undefined} style={{ opacity: offPath ? LINK_OFF_PATH_OPACITY : undefined, transition: 'opacity 300ms ease' }}>
      <title>{title}</title>
      <defs><EndMarker id={arrow} end={styled?.end ?? 'arrow'} colour={stroke} /></defs>
      <BaseEdge id={id} path={path} markerEnd={styled === null ? markerEnd ?? `url(#${arrow})` : styled.end === 'none' ? undefined : `url(#${arrow})`}
        style={{ stroke, strokeWidth: width, vectorEffect: 'non-scaling-stroke', ...(dash !== null ? { strokeDasharray: dash } : {}) }} />
      {styled?.label != null && sizeAt !== null ? <SizeLabel i={i} x={(sourceX + sizeAt.x) / 2} y={(sourceY + sizeAt.y) / 2} text={styled.label} /> : null}
      {modelled && linkOlumi ? <OlumiLineMark i={i} x={rail?.x ?? midX} y={rail?.y ?? midY} title={causal?.author?.title} /> : null}
      {words && !hidden && placed.leaderTo ? (
        <path data-view-link-leader={`links.${i}`} d={`M ${x},${y} L ${placed.leaderTo.x},${placed.leaderTo.y}`} fill="none" stroke={stroke} strokeWidth={1} strokeDasharray="2 3" />
      ) : null}
      {!words ? null : (
        // The words on the line sit in React Flow's label layer, above a resting card (z 0) and below a selected one (1000), so a card
        // never cuts them (DL 4 Nov, R3: "…week" clipped under a card); the line itself stays under the cards. They sit at the nearest point
        // along the path clear of every card and the chips on its rail (R5 item 3; TM-04 gate), so they never cover a card's or a chip's text.
        <EdgeLabelRenderer>
          <div ref={attachWords} id={linkWordsIdOf(i)} className={`nodrag nopan ${typography.viewLabel} flex flex-col items-center rounded px-1 font-normal text-text-light`} data-view-link-words={`links.${i}`}
            style={{ position: 'absolute', transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`, zIndex: GOAL_CHANCE_DRIVER_TAG_Z, background: 'var(--bg-canvas)', pointerEvents: 'none', ...(hidden ? { visibility: 'hidden' as const } : {}) }}>
            {verdictless === null ? null : (() => { const Icon = VERDICTLESS_ICON[verdictless], said = causal?.text || DIRECTION_NOT_SETTLED; return (
              <span data-view-link-unsettled={`links.${i}`} data-link-direction={verdictless} title={said} aria-label={said} role="img" className="inline-flex" style={{ pointerEvents: 'auto', color: EDGE_NEUTRAL }}><Icon aria-hidden="true" strokeWidth={1.75} style={{ width: 'calc(12px * var(--canvas-label-scale, 1))', height: 'calc(12px * var(--canvas-label-scale, 1))' }} /></span>
            ) })()}
            {!signed ? null : <span data-view={`links.${i}.label`} role={labelWord ? 'img' : undefined} aria-label={labelWord} title={labelWord} style={labelWord ? { pointerEvents: 'auto' } : undefined}>{link.label}</span>}
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

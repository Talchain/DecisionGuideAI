/**
 * A link on the olumi-core lane's canvas (decision A, 00057 #3): one View link as core's page draws it. Its kind, challenge and
 * proposal are on the path (`data-kind`, `data-alert`, `data-proposed`), a link core doubts is dashed, its hover is core's `title`, and
 * its sign (`label`), when it has one, sits on the line in the canvas's edge-label token, carrying `data-view`, and its strength in core's
 * words (`effect.text`, its hover core's `effect.title`) when core sizes it; both in React Flow's label layer, above resting cards.
 * Every View link is drawn at rest (panel-visual system §4, L1): a reason link (a premise or an assumption) is a distinct DOTTED line, so a dash
 * still means doubt and only doubt. A modelled effect carries a small midpoint icon from its typed direction (L2). Polarity (colour), doubt (dash),
 * alert (orange) and proposal (blue) are four channels (L4): on a line that has a direction, alert and proposal are a halo under it, never its colour.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type SyntheticEvent } from 'react'
import { reducedFaceSize } from '../../olumiView/camera'
import { BaseEdge, EdgeLabelRenderer, getBezierPath, Position, useStore, type EdgeProps, type ReactFlowState } from '@xyflow/react'
import { linkWordsAt, type Placed } from './linkWordsPlace'
import { railOf, railSlots, railWordsAt } from './linkRail'
import type { ViewLink } from '../../olumiView/client'
import { typography } from '../../styles/typography'
import { LinkRemove, useRemovingLink } from '../../olumiView/LinkRemove'
import { linkByOlumi } from '../../olumiView/layout'
import { useViewStore } from '../../olumiView/store'
import { linkWordsIdOf, useViewFocusLink, useViewHover } from '../../olumiView/canvas'
import { useDriverLink } from '../../olumiView/lens'
import { LinkMarkChip } from '../../olumiView/LinkMarkChip'
import { linkRole, sizedLink } from '../../olumiView/v12/contract'
import { firstDraft as firstDraftOf, linkKey, linkLook, type Direction } from '../../olumiView/v12/fields/fields'
import { useAnchoredTip } from '../../olumiView/look/Tip'
import { ICONS, OkIcon, type IconId } from '../../olumiView/look/icons'
import { EDGE_NEUTRAL, PLAIN_WIDTH, effectStroke, linkStyle, DOUBT_DASH, toneOf } from '../../olumiView/v12/links/styles'
import { placeAt } from '../../olumiView/v12/links/place'
import { useFocusPath } from '../../olumiView/v12/bands/focusPath'
import { effectMidpoint } from '../../olumiView/v12/links/geometry'
import { EndMarker, OlumiLineMark, SizeLabel } from '../../olumiView/v12/links/LinkEnds'
import { railObstacles, useLinkWordsBoxes, useRailBoxes, wordsBefore } from '../../olumiView/railBoxes'

export type ViewLinkData = { link: ViewLink; i: number }
/**
 * The midpoint mark of a modelled effect (panel-visual system L2): the registry's icon for its typed direction, so the direction is said by shape as
 * well as by colour. Six states, six registry ids (look/icons.tsx `link-*`); `none` (core's "no effect") keeps its own.
 */
type LinkMark = 'raises' | 'lowers' | 'depends' | 'disputed' | 'unknown' | 'none'
const ICONS_HOVER = (m: LinkMark): string => ICONS[MARK_ID[m]].hover
const MARK_ID: Readonly<Record<LinkMark, IconId>> = { raises: 'link-raises', lowers: 'link-lowers', depends: 'link-depends', disputed: 'link-disputed', unknown: 'link-unknown', none: 'link-none' }
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
  // L2: a modelled effect's midpoint mark is its typed direction's small icon (`none` keeps its own); no verdict (depends, disputed, unknown) stays the neutral grey.
  const mark: LinkMark | null = direction !== null ? direction : causal?.sign === 'none' ? 'none' : null
  const verdictless = direction === 'depends' || direction === 'disputed' || direction === 'unknown' ? direction : null
  const role = linkRole(link)
  const style = linkStyle(link)
  // R5 (Paul, 16 Nov): only a link the engine marks as a causal effect (`causal`, or a direction) is a modelled effect, coloured by its direction and
  // weighted on the width ladder, whatever its role says; every other line is a plain 2 px line (a role's own colour and end stay, its dots and weights do not).
  const styled = causal === null && direction === null && style !== null && style.role !== 'effect' ? style : null
  const modelled = styled === null && (causal !== null || direction !== null)
  // The mark's word is the key item core names for it (`label_key`); an older core's View, without the field, is read by its glyph (fields.ts linkKey).
  const labelWord = useViewStore((s) => causal === null && s.view?.model != null ? linkKey(link, s.view.model.key).item?.text : undefined)
  const byOlumi = useViewStore((s) => (s.view?.model == null ? false : linkByOlumi(s.view.model, link.from, link.to)))
  const linkOlumi = causal === null ? byOlumi : causal.author?.by === 'olumi'
  const hovered = useViewHover((h) => h.id)
  // A path is lit while a card is hovered or selected (focusPath.ts): emphasise its links without dimming any others.
  const onPath = useFocusPath((f) => f.path !== null && f.path.has(source) && f.path.has(target))
  // R3: on a first draft (a proposal and no approved version) everything is proposed, so a proposal is no mark on a link.
  const firstDraft = useViewStore((s) => s.view !== null && firstDraftOf(s.view).firstDraft === true)
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
  // Where the words stand, kept for the moment they attach (the label layer can mount after the edge): written to `--link-x/--link-y` (links/place.ts).
  const wordsAt = useRef({ x: 0, y: 0 })
  const [size, setSize] = useState({ w: 0, h: 0 })
  // eslint-disable-next-line react-hooks/exhaustive-deps -- after every render; an equal size bails out
  useLayoutEffect(() => { const el = wordsRef.current; if (el && (el.offsetWidth !== size.w || el.offsetHeight !== size.h)) setSize({ w: el.offsetWidth, h: el.offsetHeight }) })
  // And the moment the words are put in the label layer, which can mount after the edge (the effect above runs only when the edge renders).
  const attachWords = useCallback((el: HTMLDivElement | null) => {
    wordsRef.current = el
    placeAt(el, wordsAt.current.x, wordsAt.current.y)
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
  wordsAt.current = { x, y }
  useLayoutEffect(() => { placeAt(wordsRef.current, x, y) })
  // Zoomed out (below the readable zoom, camera.ts) the cards draw less and so do the links: at rest a link says its sign by its colour
  // only, so the overview stays quiet (Paul 10 Nov, 68be1258). B1 (Paul's "do now", 11 Nov): the first open is the whole board, below that
  // zoom on every real model, so a link near what the person points at (a card hovered or selected, the link selected or focused, a driver
  // link) says its sign and its strength there too, at the size the cards' reduced face draws at: the words' `viewLabel` token reads the
  // label counter-scale CanvasLabelScaleSync writes on the canvas root (the reduced face's own, camera.ts reducedFaceSize), so they never
  // draw at the bare zoom's ~5 px (DL 10 Nov). The flag, not the scale, is selected: an edge re-renders only when it flips.
  const zoomedOut = useStore((st) => reducedFaceSize(st.transform[2]) > 0)
  // A no-verdict icon (D4) is the line's meaning, not words: Simple draws it at rest at every zoom (its type is counter-scaled to the board, so it is not "zoomed out").
  // The mark is the line's meaning, not words: every modelled effect always says its direction, at every zoom and level and in a crowd (its type is
  // counter-scaled to the board). Only the longer words (the sign glyph, `effect.text`) disclose progressively, by zoom and nearness.
  const markShown = mark !== null && role !== 'size'
  const textShown = (signed || effect !== null) && role !== 'size' && (!zoomedOut || near)
  const words = markShown || textShown
  // Words with no room within reach of their link (PL/DL 7 Nov: never detached) are hidden at rest and shown, with their leader, while the
  // link is near. Hidden, not removed, so they are still measured: as the strength words leave, the sign alone may fit by the link again.
  const farAtRest = placed.far === true && !near
  const hidden = farAtRest && !markShown
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
  const ctlRef = useRef<HTMLDivElement | null>(null)
  const ctlStand = useRef({ x: 0, y: 0 })
  const attachCtl = useCallback((el: HTMLDivElement | null) => {
    ctlSeen.current?.disconnect(); ctlSeen.current = null
    ctlRef.current = el
    if (!el) return
    placeAt(el, ctlStand.current.x, ctlStand.current.y)
    const read = () => setCtl((s) => (s.w === el.offsetWidth && s.h === el.offsetHeight ? s : { w: el.offsetWidth, h: el.offsetHeight }))
    read()
    if (typeof ResizeObserver !== 'undefined') { ctlSeen.current = new ResizeObserver(read); ctlSeen.current.observe(el) }
  }, [])
  const ctlAt: Placed | null = useMemo(() => {
    if (!offering || ctl.w === 0) return null
    const shownWords = words && !hidden ? [{ id: '', x: x - size.w / 2, y: y - size.h / 2, w: size.w, h: size.h }] : []
    return linkWordsAt(path, [...clearOf, ...shownWords], ctl, { x: midX, y: midY })
  }, [offering, ctl, words, hidden, x, y, size, path, clearOf, midX, midY])
  ctlStand.current = { x: ctlAt?.x ?? x, y: ctlAt?.y ?? y }
  useLayoutEffect(() => { placeAt(ctlRef.current, ctlStand.current.x, ctlStand.current.y) })
  const markCards = useMemo(() => (words && !hidden ? [...clearOf, { id: '', x: x - size.w / 2, y: y - size.h / 2, w: size.w, h: size.h }] : clearOf), [words, hidden, clearOf, x, y, size])
  const markVisible = markShown && !hidden
  // L1: every View link is drawn at rest (the old fold of reason links and route rails to hover and selection is gone); only `focusPath` fades a link, and
  // only while a path is lit.
  // R5 (Paul, 16 Nov): a modelled effect (`causal`) takes its direction's colour; every other line, a plain structural one and a reason link (a note,
  // a route "considered against this aim") included, is neutral, and an effect's colour is never borrowed for it. EVERY line is one width (L3).
  // A dash means doubt and nothing else; a reason link is DOTTED (L1, a round-dot recipe, never a dash).
  // L4, four channels that coexist on every kind of line: polarity is the COLOUR (a line with none of its own is the neutral grey), doubt the DASH,
  // alert (core's orange) and proposal (Olumi's blue) each its own HALO underlay, so neither overwrites the other nor the direction. A driver link
  // (the lens) is never quiet. Olumi's blue marks a link Olumi proposed or inferred inside a model already approved; on a first draft everything is
  // proposed, so it marks nothing (R3). An Olumi-proposed link in an approved model is Olumi's whatever its kind, a reason line included (Line reviewer, 38ef5ce8).
  const olumiInk = (link.proposed || byOlumi) && !firstDraft
  const coloured = styled !== null || modelled
  const haloAlert = link.alert, haloProposed = olumiInk
  const stroke = styled !== null ? styled.stroke : modelled ? effectStroke(direction === 'raises' ? 'increases' : direction === 'lowers' ? 'decreases' : null) : driver ? 'var(--text-header)' : EDGE_NEUTRAL
  // The ink is a tone class on the `<g>` (olumiLook.css `.ok-link-tone-*` sets `--link-tone` from a token); the line, its end and its leader read it. No inline style.
  const tone = toneOf(stroke)
  const dash = link.doubt ? DOUBT_DASH : null
  const dotted = !coloured && (link.kind === 'reason' || role === 'reason')
  const width = (styled?.width ?? PLAIN_WIDTH) + (onPath ? 1 : 0)
  const title = causal === null ? link.title : [causal.text, causal.author?.title, link.title].filter(Boolean).join('\n')
  // THE LINK'S ONE HOVER (L2; Codex review-links-2): every link says its core words through the lane's one Tip (look/Tip.tsx `useAnchoredTip`: 150 ms, Escape,
  // closes on leave and blur), by pointer on the line, its mark or its words, and by keyboard focus on the link. They are core's: the title, the typed belief's
  // text and its author's title, the effect's `text` and `title`, and the key word core names for the sign, each once, in that order. A modelled mark core gave
  // no words for says its registry entry's words (look/icons.tsx `link-*`); nothing is written here.
  const said = [...new Set([...title.split('\n'), link.effect?.text, link.effect?.title, labelWord].filter((t): t is string => typeof t === 'string' && t !== ''))].join('\n')
  const tipWords = said !== '' ? said : mark === null ? '' : ICONS_HOVER(mark)
  const gRef = useRef<SVGGElement | null>(null)
  const markEl = useRef<HTMLSpanElement | null>(null)
  const linkTip = useAnchoredTip(tipWords, 'peek')
  const tipNow = useRef(linkTip); tipNow.current = linkTip
  // The hook anchors on `event.currentTarget`, which here is the link's `<g>` (or a focus target outside it), so the Tip is anchored by a stand-in that answers
  // with the mark's rect when the mark is on screen, else the pointer's own point (or the link's box for focus).
  const anchored = (e: SyntheticEvent, at: 'pointer' | 'focus'): SyntheticEvent<HTMLElement> => {
    const pointer = e as unknown as { clientX?: number; clientY?: number }
    const rect = (): DOMRect => {
      if (markEl.current !== null && markVisible) return markEl.current.getBoundingClientRect()
      if (at === 'pointer') { const px = pointer.clientX ?? 0, py = pointer.clientY ?? 0; return { x: px, y: py, left: px, top: py, right: px, bottom: py, width: 0, height: 0, toJSON: () => ({}) } }
      return gRef.current?.getBoundingClientRect() ?? ({ x: 0, y: 0, left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON: () => ({}) })
    }
    const wrapper = gRef.current?.closest('.react-flow__edge') ?? null
    const ring = (): boolean => { if (at === 'pointer' || wrapper === null) return true; try { return wrapper.matches(':focus-visible') } catch { return true } }
    return Object.create(e, { currentTarget: { value: { getBoundingClientRect: rect, matches: ring } } }) as SyntheticEvent<HTMLElement>
  }
  // A link with keyboard focus (links are focusable; the canvas writes `useViewFocusLink`) opens the same Tip as the pointer, through the same hook.
  useEffect(() => {
    if (!focused) return
    tipNow.current.handlers.onFocus(anchored({} as SyntheticEvent, 'focus'))
    return () => tipNow.current.handlers.onBlur()
  }, [focused]) // eslint-disable-line react-hooks/exhaustive-deps -- `anchored` and the hook's handlers are read fresh through refs; focus opening is the only trigger
  // Escape closes it whichever way it opened, the pointer's or the focus's.
  const tipOpen = linkTip.describedBy !== undefined
  // The focus target is React Flow's `.react-flow__edge` wrapper (canvas.ts gives it `aria-describedby` = the words id), so while the Tip is open under focus its id
  // is appended there, and the previous value comes back on close or blur (the same host rule as look/icons.tsx LabelledIcon).
  const tipId = linkTip.describedBy
  useEffect(() => {
    if (!focused || tipId === undefined) return
    const host = gRef.current?.closest('.react-flow__edge') ?? null
    if (host === null) return
    const before = host.getAttribute('aria-describedby')
    host.setAttribute('aria-describedby', before === null || before === '' ? tipId : `${before} ${tipId}`)
    return () => { if (before === null) host.removeAttribute('aria-describedby'); else host.setAttribute('aria-describedby', before) }
  }, [focused, tipId])
  useEffect(() => {
    if (!tipOpen) return
    const close = (e: KeyboardEvent) => { if (e.key === 'Escape') tipNow.current.dismiss() }
    document.addEventListener('keydown', close)
    return () => document.removeEventListener('keydown', close)
  }, [tipOpen])
  // The Tip keeps its first measure, so the board moving under it (pan, zoom) closes it, as a scroll does; a focused link then opens it again at its new place.
  // The viewport is read only while the pointer is on this link or it has focus, so a pan never re-renders every link.
  const [hot, setHot] = useState(false)
  const viewport = useStore((st) => (focused || hot ? st.transform : null))
  const lastViewport = useRef<typeof viewport>(null)
  useEffect(() => {
    const before = lastViewport.current
    lastViewport.current = viewport
    if (before === null || viewport === null || before === viewport) return
    tipNow.current.dismiss()
    if (focused) tipNow.current.handlers.onFocus(anchored({} as SyntheticEvent, 'focus'))
  }, [viewport]) // eslint-disable-line react-hooks/exhaustive-deps -- a new viewport is the only trigger
  const name = title !== '' ? title : mark === null ? '' : ICONS_HOVER(mark)
  const arrow = `view-link-arrow-${i}`
  return (
    <g data-view-link={`links.${i}`} data-link-direction={direction ?? undefined} data-link-confidence={look.confidence ?? undefined} data-rail={rail ? '' : undefined} data-driver-link={driver || undefined} data-kind={link.kind} data-alert={link.alert || undefined} data-proposed={link.proposed || undefined} data-olumi={linkOlumi || undefined} data-causal-sign={causal?.sign} data-causal-state={causal?.strength.state} data-causal-disputed={causal?.disputed || undefined} data-link-role={styled?.role ?? role ?? undefined} data-link-end={styled?.end ?? (modelled ? 'arrow' : undefined)} data-link-dash={dash ?? undefined} data-link-dotted={dotted || undefined} data-link-halo={haloAlert || haloProposed ? [haloAlert ? 'alert' : '', haloProposed ? 'proposed' : ''].filter(Boolean).join(' ') : undefined} data-link-width={width} data-on-path={onPath || undefined} className={`ok-link ok-link-tone-${tone}`} role="group" aria-label={name !== '' ? name : undefined} aria-describedby={linkTip.describedBy} data-link-tone={tone}
      ref={gRef} onPointerEnter={(e) => { setHot(true); linkTip.handlers.onPointerEnter(anchored(e, 'pointer')) }} onPointerLeave={() => { setHot(false); linkTip.handlers.onPointerLeave() }}>
      <defs><EndMarker id={arrow} end={styled?.end ?? 'arrow'} /></defs>
      {haloAlert ? <path data-link-halo-path="alert" d={path} className="ok-link-halo ok-link-halo-alert" /> : null}
      {haloProposed ? <path data-link-halo-path="proposed" d={path} className={haloAlert ? 'ok-link-halo ok-link-halo-proposed ok-link-halo-inner' : 'ok-link-halo ok-link-halo-proposed'} /> : null}
      <BaseEdge id={id} path={path} className={`ok-link-line${onPath ? ' ok-link-on-path' : ''}${dotted ? ' ok-link-dotted' : ''}${dash !== null ? ' ok-link-doubt' : ''}`} markerEnd={styled === null ? markerEnd ?? `url(#${arrow})` : styled.end === 'none' ? undefined : `url(#${arrow})`}
      />
      {styled?.label != null && sizeAt !== null ? <SizeLabel i={i} x={(sourceX + sizeAt.x) / 2} y={(sourceY + sizeAt.y) / 2} text={styled.label} /> : null}
      {modelled && linkOlumi ? <OlumiLineMark i={i} x={rail?.x ?? midX} y={rail?.y ?? midY} name={causal?.author?.title} /> : null}
      {words && !hidden && placed.leaderTo ? (
        <path data-view-link-leader={`links.${i}`} d={`M ${x},${y} L ${placed.leaderTo.x},${placed.leaderTo.y}`} className="ok-link-leader" />
      ) : null}
      {!words ? null : (
        // The words on the line sit in React Flow's label layer, above a resting card (z 0) and below a selected one (1000), so a card
        // never cuts them (DL 4 Nov, R3: "…week" clipped under a card); the line itself stays under the cards. They sit at the nearest point
        // along the path clear of every card and the chips on its rail (R5 item 3; TM-04 gate), so they never cover a card's or a chip's text.
        <EdgeLabelRenderer>
          <div ref={attachWords} id={linkWordsIdOf(i)} className={`ok-link-words nodrag nopan ${typography.viewLabel} flex flex-col items-center rounded px-1 font-normal text-text-light${hidden ? ' ok-link-hidden' : ''}`} data-view-link-words={`links.${i}`}>
            {!markShown || mark === null ? null : (
              <span ref={markEl} data-view-link-mark={`links.${i}`} data-link-direction={mark} data-view-link-unsettled={verdictless === null ? undefined : `links.${i}`} className="ok-link-mark inline-flex">
                {/* The registry draws the glyph; the hover is the link's one Tip (the `<g>`'s handlers), so this icon carries none of its own. */}
                <OkIcon id={MARK_ID[mark]} size={12} decorative inherit />
              </span>
            )}
            {/* Far at rest the sign WAITS hidden, never removed: the box keeps one measured size whatever the placement says, so size and placement settle
                (DL BLOCKER 20 Nov: removing it made the box fit, the sign return, the box not fit, an update-depth loop, React #185). */}
            {!signed || !textShown ? null : <span data-view={`links.${i}.label`} role={labelWord ? 'img' : undefined} aria-label={labelWord} className={farAtRest ? 'ok-link-hit ok-link-hidden' : 'ok-link-hit'}>{link.label}</span>}
            {/* Its strength in core's words (`effect`, core 685e725); core's hover for it is part of the link's Tip. */}
            {effect === null ? null : <span className="ok-link-hit" data-view={`links.${i}.effect.text`}>{effect.text}</span>}
          </div>
        </EdgeLabelRenderer>
      )}
      {/* A revealed stance on this line (core `link_marks`), off every card and off this line's own words. */}
      <LinkMarkChip i={i} link={link} path={path} cards={markCards} midX={midX} midY={midY} />
      {/* R25 slice 2b: where core names the one record (and part) this line stands for (`remove`), the selected or focused link offers to
          take it off, in the label layer above the cards, at its own clear point (`ctlAt`), with a leader to the link when it sits off it. */}
      {offering && ctlAt?.leaderTo ? (
        <path data-view-link-remove-leader={`links.${i}`} d={`M ${ctlAt.x},${ctlAt.y} L ${ctlAt.leaderTo.x},${ctlAt.leaderTo.y}`} className="ok-link-leader" />
      ) : null}
      {offering && link.remove != null ? (
        <EdgeLabelRenderer>
          <div ref={attachCtl} data-link-remove-at={`links.${i}`}
            className={ctlAt === null ? 'ok-link-ctl ok-link-hidden' : 'ok-link-ctl'}>
            <LinkRemove edge={id} from={source} remove={link.remove} />
          </div>
        </EdgeLabelRenderer>
      ) : null}
      {linkTip.tip}
    </g>
  )
}

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type SyntheticEvent } from 'react'
import { reducedFaceSize } from '../../olumiView/camera'
import { EdgeLabelRenderer, getBezierPath, Position, useStore, type EdgeProps, type ReactFlowState } from '@xyflow/react'
import { linkWordsAt, type Placed } from './linkWordsPlace'
import { railOf, railSlots, railWordsAt } from './linkRail'
import type { ViewLink } from '../../olumiView/client'
import { typography } from '../../styles/typography'
import { isOlumiCoreLane } from '../../olumiCore/lane'
import { LaneLinkRemoveButton } from '../../olumiView/v12/edit/LaneLinkRemoveButton'
import { useLaneInspector } from '../../olumiView/v12/edit/inspectorStore'
import { LinkRemove, useRemovingLink } from '../../olumiView/LinkRemove'
import { linkByOlumi } from '../../olumiView/layout'
import { useViewStore } from '../../olumiView/store'
import { linkWordsIdOf, useViewFocusLink, useViewHover } from '../../olumiView/canvas'
import { useDriverLink, useViewLens } from '../../olumiView/lens'
import { LinkMarkChip } from '../../olumiView/LinkMarkChip'
import { linkRole, sizedLink } from '../../olumiView/v12/contract'
import { firstDraft as firstDraftOf, linkKey, linkLook } from '../../olumiView/v12/fields/fields'
import { useAnchoredTip } from '../../olumiView/look/Tip'
import { useEscapeLayer } from '../../olumiView/v12/edit/escapeLayers'
import { ICONS, OkIcon, type IconId } from '../../olumiView/look/icons'
import { PLAIN_WIDTH, linkStyle, DOUBT_DASH } from '../../olumiView/v12/links/styles'
import { placeAt } from '../../olumiView/v12/links/place'
import { useFocusPath } from '../../olumiView/v12/bands/focusPath'
import { effectMidpoint } from '../../olumiView/v12/links/geometry'
import { OlumiLineMark, SizeLabel } from '../../olumiView/v12/links/LinkEnds'
import { railObstacles, useLinkWordsBoxes, useRailBoxes, wordsBefore } from '../../olumiView/railBoxes'
import { ConnectorLeader, ConnectorLine, connectorLookOf, directionOf, lookKey } from '../../olumiView/v12/links/connector'

export type ViewLinkData = { link: ViewLink; i: number; committed?: {
  firstDraft: boolean; byOlumi: boolean; driver: boolean; meaning?: { id: string; text: string }
} }
type LinkMark = 'raises' | 'lowers' | 'depends' | 'disputed' | 'unknown' | 'none'
const ICONS_HOVER = (m: LinkMark): string => ICONS[MARK_ID[m]].hover
const MARK_ID: Readonly<Record<LinkMark, IconId>> = { raises: 'link-raises', lowers: 'link-lowers', depends: 'link-depends', disputed: 'link-disputed', unknown: 'link-unknown', none: 'link-none' }
export type CardBox = { readonly id: string; readonly x: number; readonly y: number; readonly w: number; readonly h: number }
// Read the boxes again on each store change because React Flow mutates nodeLookup in place.
export const cardBoxesOf = (s: ReactFlowState): CardBox[] =>
  [...s.nodeLookup.values()].map((n) => ({ id: n.id, x: n.internals.positionAbsolute.x, y: n.internals.positionAbsolute.y, w: n.measured.width ?? 0, h: n.measured.height ?? 0 }))
export const sameBoxes = (a: CardBox[], b: CardBox[]) =>
  a.length === b.length && a.every((p, k) => { const q = b[k]!; return p.id === q.id && p.x === q.x && p.y === q.y && p.w === q.w && p.h === q.h })

export function ViewLinkEdge({ id, source, target, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected = false }: EdgeProps) {
  const { link, i, committed } = data as ViewLinkData
  const causal = link.causal ?? null
  const look = linkLook(link)
  const direction = directionOf(link)
  const signed = causal === null && direction === null && link.label !== ''
  const mark: LinkMark | null = direction !== null ? direction : causal?.sign === 'none' ? 'none' : null
  const verdictless = direction === 'depends' || direction === 'disputed' || direction === 'unknown' ? direction : null
  const role = linkRole(link)
  const style = linkStyle(link)
  const styled = causal === null && direction === null && style !== null && style.role !== 'effect' ? style : null
  const modelled = styled === null && (causal !== null || direction !== null)
  const labelWord = useViewStore((s) => causal === null && s.view?.model != null ? linkKey(link, s.view.model.key).item?.text : undefined)
  const byOlumi = useViewStore((s) => committed?.byOlumi ?? (s.view?.model != null && linkByOlumi(s.view.model, link.from, link.to)))
  const linkOlumi = causal === null ? byOlumi : causal.author?.by === 'olumi'
  const hovered = useViewHover((h) => h.id)
  const onPath = useFocusPath((f) => f.path !== null && f.path.has(source) && f.path.has(target))
  const firstDraft = useViewStore((s) => committed?.firstDraft ?? (s.view !== null && firstDraftOf(s.view).firstDraft === true))
  const fromSelected = useStore((s) => s.nodeLookup.get(source)?.selected === true)
  const toSelected = useStore((s) => s.nodeLookup.get(target)?.selected === true)
  // What would change: a link leaving (or sized by) a figure an option's chance moves most with is drawn wider, in ink.
  const lensOn = useViewLens((s) => s.lens === 'what_changes')
  const liveDriver = useDriverLink(i)
  const driver = committed === undefined ? liveDriver : committed.driver && lensOn
  const active = new Set<string>()
  if (hovered !== null) active.add(hovered)
  if (fromSelected) active.add(source)
  if (toSelected) active.add(target)
  const cards = useStore(cardBoxesOf, sameBoxes)
  // Place the words clear of the measured cards and their rails.
  const rails = useRailBoxes((s) => s.rails)
  const lastClear = useRef<CardBox[] | null>(null)
  const clearOf = useMemo(() => {
    const next = [...cards, ...railObstacles(cards, rails)]
    if (lastClear.current !== null && sameBoxes(lastClear.current, next)) return lastClear.current
    lastClear.current = next
    return next
  }, [cards, rails])
  const from = cards.find((c) => c.id === source), to = cards.find((c) => c.id === target)
  // Each rail link has its own rail (PL 7 Nov): the slots of every drawn link into the head row, by their sources across the board.
  const edges = useStore((s) => s.edges)
  const slot = useMemo(() => {
    const at = (n: string) => cards.find((c) => c.id === n)
    const ls = edges.flatMap((e) => { const f = at(e.source), t = at(e.target); return f && t ? [{ id: e.id, from: f, to: t }] : [] })
    return railSlots(ls, cards).get(id) ?? 0
  }, [edges, cards, id])
  const wordsRef = useRef<HTMLDivElement | null>(null)
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
  // An upward link reverses the handles to avoid curling behind both cards.
  const up = rail === null && from !== undefined && to !== undefined && to.y + to.h <= from.y ? { from, to } : null
  const [bezier, midX, midY] = getBezierPath(up !== null
    ? { sourceX: up.from.x + up.from.w / 2, sourceY: up.from.y, targetX: up.to.x + up.to.w / 2, targetY: up.to.y + up.to.h, sourcePosition: Position.Top, targetPosition: Position.Bottom }
    : { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })
  const path = sizeAt !== null ? `M ${sourceX},${sourceY} L ${sizeAt.x},${sizeAt.y}` : rail?.path ?? bezier
  // Later links also avoid the earlier links’ label boxes.
  const before = wordsBefore(useLinkWordsBoxes((s) => s.boxes), i)
  const clearOfWords = useMemo(() => (before.list.length === 0 ? clearOf : [...clearOf, ...before.list]), [clearOf, before.key]) // eslint-disable-line react-hooks/exhaustive-deps -- the key names the boxes
  const placed: Placed = useMemo(() => (rail ? railWordsAt(rail, size, clearOfWords, cards) : linkWordsAt(path, clearOfWords, size, { x: midX, y: midY })),
    [path, clearOfWords, size, midX, midY]) // eslint-disable-line react-hooks/exhaustive-deps -- `rail` follows `path`
  const near = selected || focused || driver || active.has(source) || active.has(target)
  const effect = near && role !== 'size' ? link.effect ?? null : null
  const { x, y } = placed
  wordsAt.current = { x, y }
  useLayoutEffect(() => { placeAt(wordsRef.current, x, y) })
  // The counter-scaled words only show at low zoom near an active link.
  const zoomedOut = useStore((st) => reducedFaceSize(st.transform[2]) > 0)
  const markShown = mark !== null && role !== 'size'
  const textShown = (signed || effect !== null) && role !== 'size' && (!zoomedOut || near)
  const words = markShown || textShown
  // Keep the hidden words measurable so placement settles.
  const farAtRest = placed.far === true && !near
  const hidden = farAtRest && !markShown
  // This link's words, while drawn, are a box the later links keep clear of.
  const putWords = useLinkWordsBoxes((s) => s.put), dropWords = useLinkWordsBoxes((s) => s.drop)
  const shown = words && !hidden && size.w > 0
  useLayoutEffect(() => { if (shown) putWords(i, { id: '', x: placed.x - size.w / 2, y: placed.y - size.h / 2, w: size.w, h: size.h }); else dropWords(i) }, [shown, i, placed.x, placed.y, size.w, size.h, putWords, dropWords])
  useLayoutEffect(() => () => dropWords(i), [i, dropWords])
  // Measure the removal control before placing it clear of the cards and words.
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
  const connector = connectorLookOf(link, { firstDraft, byOlumi, driver })
  const { tone, halo, reasonAlert } = connector
  const dotted = connector.dash === 'dotted'
  const dash = connector.dash === 'doubt' ? DOUBT_DASH : undefined
  const width = PLAIN_WIDTH + (onPath ? 1 : 0)
  const title = causal === null ? link.title : [causal.text, causal.author?.title, link.title].filter(Boolean).join('\n')
  // The line, mark and words share one Tip with Core’s words.
  const said = [...new Set([...title.split('\n'), link.effect?.text, link.effect?.title, labelWord].filter((t): t is string => typeof t === 'string' && t !== ''))].join('\n')
  const tipWords = said !== '' ? said : mark === null ? '' : ICONS_HOVER(mark)
  const gRef = useRef<SVGGElement | null>(null)
  const markEl = useRef<HTMLSpanElement | null>(null)
  const linkTip = useAnchoredTip(tipWords, 'peek')
  const tipNow = useRef(linkTip); tipNow.current = linkTip
  // Anchor the Tip to the visible mark, pointer or focused edge.
  const anchored = (e: SyntheticEvent, at: 'pointer' | 'focus'): SyntheticEvent<HTMLElement> => {
    const pointer = e as unknown as { clientX?: number; clientY?: number }
    const rect = (): DOMRect => {
      if (markEl.current !== null && markVisible) return markEl.current.getBoundingClientRect()
      if (at === 'pointer') { const px = pointer.clientX ?? 0, py = pointer.clientY ?? 0; return { x: px, y: py, left: px, top: py, right: px, bottom: py, width: 0, height: 0, toJSON: () => ({}) } }
      return gRef.current?.getBoundingClientRect() ?? ({ x: 0, y: 0, left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON: () => ({}) })
    }
    const wrapper = gRef.current?.closest('.react-flow__edge') ?? null
    const ring = (): boolean => { if (at === 'pointer' || wrapper === null) return true; try { return wrapper.matches(':focus-visible') } catch { return true } }
    const currentTarget = {
      getBoundingClientRect: rect,
      matches: ring,
      closest: (selector: string) => gRef.current?.closest(selector) ?? null,
    }
    return Object.create(e, { currentTarget: { value: currentTarget } }) as SyntheticEvent<HTMLElement>
  }
  useEffect(() => {
    if (!focused) return
    tipNow.current.handlers.onFocus(anchored({} as SyntheticEvent, 'focus'))
    return () => tipNow.current.handlers.onBlur()
  }, [focused]) // eslint-disable-line react-hooks/exhaustive-deps -- `anchored` and the hook's handlers are read fresh through refs; focus opening is the only trigger
  // Escape closes it whichever way it opened, the pointer's or the focus's.
  const tipOpen = linkTip.describedBy !== undefined
  const lane = isOlumiCoreLane()
  useEscapeLayer(lane && tipOpen, linkTip.dismiss)
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
    if (lane || !tipOpen) return
    const close = (e: KeyboardEvent) => { if (e.key === 'Escape') tipNow.current.dismiss() }
    document.addEventListener('keydown', close)
    return () => document.removeEventListener('keydown', close)
  }, [lane, tipOpen])
  // Close a pointer Tip after a pan or zoom. Reopen it for a focused link.
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
    <g data-view-link={`links.${i}`} data-look={lookKey(connector)} data-link-direction={direction ?? undefined} data-link-confidence={look.confidence ?? undefined} data-rail={rail ? '' : undefined} data-driver-link={driver || undefined} data-kind={link.kind} data-alert={link.alert || undefined} data-proposed={link.proposed || undefined} data-olumi={linkOlumi || undefined} data-causal-sign={causal?.sign} data-causal-state={causal?.strength.state} data-causal-disputed={causal?.disputed || undefined} data-link-role={styled?.role ?? role ?? undefined} data-link-end={styled?.end ?? (modelled ? 'arrow' : undefined)} data-link-dash={dash ?? undefined} data-link-dotted={dotted || undefined} data-link-reason-alert={reasonAlert ? '' : undefined} data-link-halo={halo === 'both' ? 'alert proposed' : halo === 'none' ? undefined : halo} data-link-width={width} data-on-path={onPath || undefined} className={`ok-link ok-link-tone-${tone}`} role="group" aria-label={name !== '' ? name : undefined} aria-describedby={linkTip.describedBy} data-link-tone={tone}
      ref={gRef} onPointerEnter={(e) => { setHot(true); linkTip.handlers.onPointerEnter(anchored(e, 'pointer')) }} onPointerLeave={() => { setHot(false); linkTip.handlers.onPointerLeave() }}
      onClick={isOlumiCoreLane() ? () => {
        linkTip.dismiss()
        useLaneInspector.getState().open({ kind: 'link', id })
      } : undefined}>
      <ConnectorLine id={id} path={path} look={connector} markerId={arrow} onPath={onPath} />
      {styled?.label != null && sizeAt !== null ? <SizeLabel i={i} x={(sourceX + sizeAt.x) / 2} y={(sourceY + sizeAt.y) / 2} text={styled.label} /> : null}
      {modelled && linkOlumi ? <OlumiLineMark i={i} x={rail?.x ?? midX} y={rail?.y ?? midY} name={causal?.author?.title} /> : null}
      {words && !hidden && placed.leaderTo ? (
        <ConnectorLeader i={i} path={`M ${x},${y} L ${placed.leaderTo.x},${placed.leaderTo.y}`} />
      ) : null}
      {!words ? null : (
        <EdgeLabelRenderer>
          <div ref={attachWords} id={linkWordsIdOf(i)} className={`ok-link-words nodrag nopan ${typography.viewLabel} flex flex-col items-center rounded px-1 font-normal text-text-light${hidden ? ' ok-link-hidden' : ''}`} data-view-link-words={`links.${i}`}>
            {!markShown || mark === null ? null : (
              <span ref={markEl} data-view-link-mark={`links.${i}`} data-link-direction={mark} data-view-link-unsettled={verdictless === null ? undefined : `links.${i}`} className="ok-link-mark inline-flex">
                {/* The registry draws the glyph; the hover is the link's one Tip (the `<g>`'s handlers), so this icon carries none of its own. */}
                <OkIcon id={MARK_ID[mark]} size={12} decorative inherit />
              </span>
            )}
            {!signed || !textShown ? null : <span data-view={`links.${i}.label`} role={labelWord ? 'img' : undefined} aria-label={labelWord} className={farAtRest ? 'ok-link-hit ok-link-hidden' : 'ok-link-hit'}>{link.label}</span>}
            {/* Its strength in core's words (`effect`, core 685e725); core's hover for it is part of the link's Tip. */}
            {effect === null ? null : <span className="ok-link-hit" data-view={`links.${i}.effect.text`}>{effect.text}</span>}
          </div>
        </EdgeLabelRenderer>
      )}
      {/* A revealed stance on this line (core `link_marks`), off every card and off this line's own words. */}
      <LinkMarkChip i={i} link={link} path={path} cards={markCards} midX={midX} midY={midY} />
      {offering && ctlAt?.leaderTo ? (
        <ConnectorLeader i={i} removal path={`M ${ctlAt.x},${ctlAt.y} L ${ctlAt.leaderTo.x},${ctlAt.leaderTo.y}`} />
      ) : null}
      {offering && link.remove != null ? (
        <EdgeLabelRenderer>
          <div ref={attachCtl} data-link-remove-at={`links.${i}`}
            className={ctlAt === null ? 'ok-link-ctl ok-link-hidden' : 'ok-link-ctl'}>
            {isOlumiCoreLane() ? <LaneLinkRemoveButton edge={id} link={link} /> : <LinkRemove edge={id} from={source} remove={link.remove} />}
          </div>
        </EdgeLabelRenderer>
      ) : null}
      {linkTip.tip}
    </g>
  )
}

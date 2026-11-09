/**
 * A link on the olumi-core lane's canvas (decision A, 00057 #3): one View link as core's page draws it. Its kind, challenge and
 * proposal are on the path (`data-kind`, `data-alert`, `data-proposed`), a link core doubts is dashed, its hover is core's `title`, and
 * its sign (`label`), when it has one, sits on the line in the canvas's edge-label token, carrying `data-view`, and its strength in core's
 * words (`effect.text`, its hover core's `effect.title`) when core sizes it; both in React Flow's label layer, above resting cards. A reason link (a premise
 * or an assumption) is drawn only while one of its cards is hovered or selected (`linkDrawn`); the causal links always are.
 * Where members said they doubt or keep the link this line holds, core's one chip for it sits on the line (`collab.link_marks`,
 * olumiCore/team/LinkMarks.tsx), clear of the cards, the cards' rails and the chips of the links before it; the words keep clear of it.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { BaseEdge, EdgeLabelRenderer, getBezierPath, Position, useStore, type EdgeProps, type ReactFlowState } from '@xyflow/react'
import { linkWordsAt, type Placed } from './linkWordsPlace'
import { downSlots, goesDown, railOf, railSlots, railWordsAt, type DownEnds } from './linkRail'
import type { ViewLink } from '../../olumiView/client'
import { typography } from '../../styles/typography'
import { LinkRemove, useRemovingLink } from '../../olumiView/LinkRemove'
import { linkDrawn } from '../../olumiView/layout'
import { linkWordsIdOf, useViewFocusLink, useViewHover } from '../../olumiView/canvas'
import { useDriverLink } from '../../olumiView/lens'
import { GOAL_CHANCE_DRIVER_TAG_Z } from '../utils/goalChanceDriverLinks'
import { railObstacles, useRailBoxes } from '../../olumiView/railBoxes'
import { LinkMarkChip, linkKeyOf, useLineMark, usePlacedKeys } from '../../olumiCore/team/LinkMarks'
import { CHIP_ROOM, chipsBefore, useLineChips } from './lineChipBoxes'

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
/** The selected cards' ids, one per line: a value, so an edge draws again only when the selection changes (craft 8 counts the drawn links). */
export const selectedKeyOf = (s: ReactFlowState): string => { let k = ''; for (const n of s.nodeLookup.values()) if (n.selected) k += (k === '' ? '' : '\n') + n.id; return k }
export const sameBoxes = (a: CardBox[], b: CardBox[]) =>
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
  // The link's chip (core's `collab.link_marks`) and every chip drawn on a line (lineChipBoxes.ts): this chip keeps clear of the chips of the
  // links before it, and the words of every link keep clear of every chip. Chips never move for words, so the placing settles.
  const mark = useLineMark(i)
  const chips = useLineChips((s) => s.chips)
  const lastChipClear = useRef<CardBox[] | null>(null)
  const chipClear = useMemo(() => {
    const next = [...clearOf, ...chipsBefore(chips, i)]
    if (lastChipClear.current !== null && sameBoxes(lastChipClear.current, next)) return lastChipClear.current
    lastChipClear.current = next
    return next
  }, [clearOf, chips, i])
  const lastWordsClear = useRef<CardBox[] | null>(null)
  const wordsClear = useMemo(() => {
    const next = [...clearOf, ...chipsBefore(chips, Infinity)]
    if (lastWordsClear.current !== null && sameBoxes(lastWordsClear.current, next)) return lastWordsClear.current
    lastWordsClear.current = next
    return next
  }, [clearOf, chips])
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
  // A link someone said they doubt or keep is drawn at rest with its chip, a reason link too (which otherwise shows only while one of its
  // cards is hovered or selected): its chip is that link's one mark, and it would vanish under the pointer on its way to it.
  const drawn = driver || focused || removing || mark !== null || linkDrawn(link, active)
  const rail = from && to ? railOf(from, to, cards, slot) : null
  // Craft 8 (UI craft pass, 9 Nov): a link into a card wholly below its source runs from the source's bottom edge to the target's top edge,
  // its ends spread along each edge in the order of the far ends (linkRail.ts downSlots), counting only the links drawn now: the others at
  // rest by `linkDrawn` (with every hovered or selected card) or by their chip, this one by its own rule. Same-row and upward links keep
  // their handles (or their rail).
  const selectedKey = useStore(selectedKeyOf)
  const placedKeys = usePlacedKeys()
  const down: DownEnds | null = useMemo(() => {
    if (!drawn || !from || !to || !goesDown(from, to)) return null
    const act = new Set(selectedKey === '' ? [] : selectedKey.split('\n'))
    if (hovered !== null) act.add(hovered)
    const at = (n: string) => cards.find((c) => c.id === n)
    const others = edges.flatMap((e) => {
      const d = e.data as ViewLinkData | undefined, f = at(e.source), t = at(e.target)
      if (e.id === id || d?.link == null || !f || !t) return []
      const shown = linkDrawn(d.link, act) || (d.link.holds != null && placedKeys.has(linkKeyOf(d.link.holds)))
      return shown ? [{ id: e.id, from: f, to: t }] : []
    })
    return downSlots([...others, { id, from, to }]).get(id) ?? null
  }, [drawn, from, to, selectedKey, hovered, cards, edges, id, placedKeys])
  const [bezier, midX, midY] = rail === null && down !== null
    ? getBezierPath({ sourceX: down.sx, sourceY: down.sy, sourcePosition: Position.Bottom, targetX: down.tx, targetY: down.ty, targetPosition: Position.Top })
    : getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })
  const path = rail?.path ?? bezier
  // Placed again only when the path, the cards or the words' size change (the off-path search is the costly part). A rail's path fixes its rail.
  const placed: Placed = useMemo(() => (rail ? railWordsAt(rail, size, wordsClear, cards) : linkWordsAt(path, wordsClear, size, { x: midX, y: midY })),
    [path, wordsClear, size, midX, midY]) // eslint-disable-line react-hooks/exhaustive-deps -- `rail` follows `path`
  // The chip goes by the words' own rule (on its line where it is clear, else at the clear point nearest it, with a leader past NEAR), over
  // the cards, their rails and the chips before it. Measured as it attaches and whenever its size changes; until measured it is not shown.
  const [chip, setChip] = useState({ w: 0, h: 0 })
  const chipSeen = useRef<ResizeObserver | null>(null)
  const attachChip = useCallback((el: HTMLDivElement | null) => {
    chipSeen.current?.disconnect(); chipSeen.current = null
    if (!el) return
    const read = () => setChip((s) => (s.w === el.offsetWidth && s.h === el.offsetHeight ? s : { w: el.offsetWidth, h: el.offsetHeight }))
    read()
    if (typeof ResizeObserver !== 'undefined') { chipSeen.current = new ResizeObserver(read); chipSeen.current.observe(el) }
  }, [])
  const chipAt: Placed | null = useMemo(() => (mark === null ? null : rail ? railWordsAt(rail, chip, chipClear, cards) : linkWordsAt(path, chipClear, chip, { x: midX, y: midY })),
    [mark, path, chipClear, chip, midX, midY]) // eslint-disable-line react-hooks/exhaustive-deps -- `rail` follows `path`
  // R25 (plan v3 item 7, Paul's 2A): at rest a link says its sign and any "!"; its strength in core's words shows while the link is selected
  // or focused, or a card at either end is hovered or selected, and on a driver link.
  const near = selected || focused || driver || active.has(source) || active.has(target)
  const effect = near ? link.effect ?? null : null
  const { x, y } = placed
  const words = link.label !== '' || effect !== null
  // Words with no room within reach of their link (PL/DL 7 Nov: never detached) are hidden at rest and shown, with their leader, while the
  // link is near. Hidden, not removed, so they are still measured: as the strength words leave, the sign alone may fit by the link again.
  const hidden = placed.far === true && !near
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
    return linkWordsAt(path, [...wordsClear, ...shownWords], ctl, { x: midX, y: midY })
  }, [offering, ctl, words, hidden, x, y, size, path, wordsClear, midX, midY])
  // The chip's box, once drawn and measured, for the words of every link and the chips after it; taken back when it goes.
  const shownChip = mark !== null && drawn && chipAt !== null && chip.w > 0
  useLayoutEffect(() => {
    if (shownChip && chipAt !== null) useLineChips.getState().put({ id, i, x: chipAt.x - chip.w / 2 - CHIP_ROOM, y: chipAt.y - chip.h / 2 - CHIP_ROOM, w: chip.w + 2 * CHIP_ROOM, h: chip.h + 2 * CHIP_ROOM })
    else useLineChips.getState().drop(id)
  }, [shownChip, chipAt, chip, id, i])
  useEffect(() => () => useLineChips.getState().drop(id), [id])
  if (!drawn) return null
  // A resting link is solid --edge-neutral: nothing fades at rest (craft 12, UI craft pass 9 Nov; it was a 55% mix towards transparent).
  // A link carrying a chip is drawn in body ink, a little stronger than the resting links, so its chip reads as its own where other links
  // cross by it (the line-chip gate, 9 Nov: "which connector it refers to"); a challenged, proposed or driver link keeps its own colour.
  const stroke = link.alert ? 'var(--olumi-mark-orange)' : link.proposed ? 'var(--semantic-info)' : driver ? 'var(--text-header)'
    : mark !== null ? 'var(--text-body)' : 'var(--edge-neutral)'
  return (
    <g data-view-link={`links.${i}`} data-route={rail ? 'rail' : down !== null ? 'down' : 'handle'} data-rail={rail ? '' : undefined} data-driver-link={driver || undefined} data-kind={link.kind} data-alert={link.alert || undefined} data-proposed={link.proposed || undefined}>
      <title>{link.title}</title>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={{ stroke, strokeWidth: driver ? 2.5 : mark !== null ? 1.5 : 1, ...(link.doubt ? { strokeDasharray: '4 4' } : {}) }} />
      {words && !hidden && placed.leaderTo ? (
        <path data-view-link-leader={`links.${i}`} d={`M ${x},${y} L ${placed.leaderTo.x},${placed.leaderTo.y}`} fill="none" stroke={stroke} strokeWidth={1} strokeDasharray="2 3" />
      ) : null}
      {!words ? null : (
        // The words on the line sit in React Flow's label layer, above a resting card (z 0) and below a selected one (1000), so a card
        // never cuts them (DL 4 Nov, R3: "…week" clipped under a card); the line itself stays under the cards. They sit at the nearest point
        // along the path clear of every card, the chips on its rail and every link's chip (R5 item 3; TM-04 gate; the line chip), so they
        // never cover a card's or a chip's text.
        <EdgeLabelRenderer>
          <div ref={attachWords} id={linkWordsIdOf(i)} className={`nodrag nopan ${typography.viewLabel} flex flex-col items-center rounded px-1 text-text-body`} data-view-link-words={`links.${i}`}
            style={{ position: 'absolute', transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`, zIndex: GOAL_CHANCE_DRIVER_TAG_Z, background: 'var(--bg-canvas)', pointerEvents: 'none', ...(hidden ? { visibility: 'hidden' as const } : {}) }}>
            {link.label === '' ? null : <span data-view={`links.${i}.label`}>{link.label}</span>}
            {/* Its strength in core's words (`effect`, core 685e725), with core's hover; under the sign when the link has one. */}
            {effect === null ? null : <span title={effect.title} style={{ pointerEvents: 'auto' }} data-view={`links.${i}.effect.text`}>{effect.text}</span>}
          </div>
        </EdgeLabelRenderer>
      )}
      {/* Core's one chip for this link (`collab.link_marks`): on its line, in the label layer with the words, shown at rest, with a leader
          to the line where it sits off it. Hidden only until it is measured. */}
      {mark !== null && chip.w > 0 && chipAt?.leaderTo ? (
        <path data-link-mark-leader={`links.${i}`} d={`M ${chipAt.x},${chipAt.y} L ${chipAt.leaderTo.x},${chipAt.leaderTo.y}`} fill="none" stroke={stroke} strokeWidth={1} strokeDasharray="2 3" />
      ) : null}
      {mark === null ? null : (
        <EdgeLabelRenderer>
          <div ref={attachChip} className="nodrag nopan" data-link-mark-on={`links.${i}`}
            style={{ position: 'absolute', transform: `translate(-50%, -50%) translate(${chipAt?.x ?? midX}px, ${chipAt?.y ?? midY}px)`, zIndex: GOAL_CHANCE_DRIVER_TAG_Z, pointerEvents: 'none', ...(chip.w === 0 ? { visibility: 'hidden' as const } : {}) }}>
            <LinkMarkChip m={mark} at="line" />
          </div>
        </EdgeLabelRenderer>
      )}
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

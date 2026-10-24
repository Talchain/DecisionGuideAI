/**
 * The card Olumi speaks from, anchored to the element it is speaking about.
 *
 * ⭐ WHY THIS EXISTS. Every coaching intervention the product produces is
 * delivered in a side panel, one step away from the part of the model it
 * concerns. The panel says "2 risks captured, all Olumi's so far — a pre-mortem
 * typically surfaces failure modes you have not listed", and the risks it means
 * are somewhere else on screen. The intervention is right; the delivery point
 * is wrong. This puts it beside the thing.
 *
 * It renders inside React Flow's viewport transform, so it tracks the node as
 * the user pans and zooms — the card belongs to the element, not to the screen.
 *
 * ⚠ IT NEVER AUTHORS. `title`, `body` and `sourceLine` are rendered verbatim
 * from whatever produced the attention. A card that composed its own coaching
 * sentence beside a producer's finding would be exactly the fabricated-guidance
 * defect the estate forbids; the closed `move` vocabulary is the only thing
 * this file decides, and it decides only which word labels the card.
 *
 * ⭐ THE ONE THING IT DOES SAY IN ITS OWN VOICE IS A DISCLOSURE ABOUT THE MARK
 * — never a finding about the model. The staleness notice below is the existing
 * instance of that, and `attention.caveat` is the general form: a sentence about
 * what the highlight the UI just drew does and does not claim. It is a SEPARATE
 * FIELD from `note` on purpose, so a UI-authored line can never be read as the
 * producer's coaching, and it renders in the same quiet warning register.
 *
 * ⚠ A CAVEAT ALONE IS ENOUGH TO RENDER. If the card required a `note`, a
 * highlight that carries only a caveat would draw the mark and drop the
 * admission — which is the exact defect the caveat exists to close, reproduced
 * one layer down.
 *
 * ⚠ AND IT SAYS WHEN IT HAS GONE STALE rather than quietly lying. Attention
 * carries the saved model it was computed against (PR #747's objection: the
 * canvas is one global slot): CEE's graph hash, never the layout counter. If the
 * saved model has moved since, the card says so instead of continuing to present
 * the note as current.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useStore } from '@xyflow/react'
import { ArrowUp, HelpCircle, History, Info, Lightbulb, MessageCircleQuestion, RefreshCw, Scale, X, type LucideIcon } from 'lucide-react'
import { useCanvasStore } from '../store'
import { clearOlumiAttention, nodeLabel, type OlumiAttention } from '../utils/olumiAttention'
import { openAskOlumi } from '../../components/results/coaching/askOlumiStore'
import { openNodeInspector } from '../nodes/shared/openNodeInspector'
import { measureDockInset } from './FloatingOlumiPanel'
import { typography } from '../../styles/typography'
import { COACHING_ICON_GLYPH } from '../nodes/shared/NodeCoachingIcon'
import { askAi } from '../conversation/askAi'
import { revealOlumiSurface } from '../conversation/revealOlumi'
import { useIsViewer } from '../../lib/viewerMode'
import { useAnsweredQuestionsStore } from '../stores/answeredQuestionsStore'
import { useCurrentGoalWaitsOn, WaitsOnList } from '../../components/results/analysisNew/ViewOnlyRunChances'
import { goalTargetLine } from '../domain/goalTargetLine'
import type { GoalTargetSource } from '../domain/goalTarget'

/** The closed grammar. Every intervention is one of these four moves. */
const MOVE_LABEL: Record<string, string> = {
  expand: 'Consider',
  challenge: 'Challenge',
  calibrate: 'Check',
  reframe: 'Reframe',
}

/**
 * The note's header is the Olumi mark and the move's icon, never a word (vision spec §2c, 23 Oct): the move's word is the
 * icon's name and tooltip. `HelpCircle` is DS v5 §9.7's Challenge icon (the rail's Challenge wears it too).
 */
const MOVE_ICON: Record<string, LucideIcon> = {
  expand: Lightbulb,
  challenge: HelpCircle,
  calibrate: Scale,
  reframe: RefreshCw,
}
/** A note with no move that asks the person something: the Question chip (its answer box is right below). */
const QUESTION_LABEL = 'Question'

/**
 * The label a caveat-only card wears. Deliberately NOT one of the four moves:
 * this is the UI disclosing something about its own mark, not Olumi making a
 * reasoning intervention, and the two must not share a word.
 */
const CAVEAT_LABEL = 'About this highlight'

/** A note whose producer named no move is labelled as Olumi's, never given a move nobody chose. */
/** Short words the card keeps; the rest is said by the Olumi mark and icons, with the words on hover (Paul, 22 Oct). */
export const ATTENTION_CARD_COPY = {
  olumi: 'Olumi',
  stale: 'The model has changed since Olumi said this.',
  answer: 'Your answer',
  send: 'Send your answer to Olumi',
} as const

/** A note that asks the person something is answered where it is asked. */
export const isQuestion = (text: string | undefined): boolean => typeof text === 'string' && text.trim().endsWith('?')

const CARD_WIDTH = 268
const CARD_GAP = 14

export const OLUMI_ATTENTION_CARD_TESTID = 'olumi-attention-card'

type Box = { readonly x: number; readonly y: number; readonly w: number; readonly h: number }
/**
 * Where the note sits, in screen px: beside its card on the right, else on the left, else below, else above: the first
 * spot that fits between `roomLeft` and `roomRight` and covers no other card (Paul's pre-flight, 22 Oct: placed on the
 * left it covered the next option's title). None free: the spot that covers the least (served café board, 22 Oct:
 * above touched the question card by 2px while left covered O1). Unmeasured, or none fits: as before, right if it
 * fits, else left.
 */
export function attentionCardSpot(anchor: Box, card: { readonly w: number; readonly h: number }, others: readonly Box[],
  roomLeft: number, roomRight: number, roomTop = -Infinity): { left: number; top: number } {
  const right = { left: anchor.x + anchor.w + CARD_GAP, top: anchor.y }
  const left = { left: anchor.x - card.w - CARD_GAP, top: anchor.y }
  const fits = (s: { left: number }) => s.left >= roomLeft && s.left + card.w <= roomRight
  const covered = (s: { left: number; top: number }) => others.reduce((area, o) =>
    area + Math.max(0, Math.min(s.left + card.w, o.x + o.w) - Math.max(s.left, o.x))
      * Math.max(0, Math.min(s.top + card.h, o.y + o.h) - Math.max(s.top, o.y)), 0)
  const before = right.left + card.w <= roomRight ? right : left
  if (!(card.h > 0)) return before
  const below = { left: anchor.x, top: anchor.y + anchor.h + CARD_GAP }
  const above = { left: anchor.x, top: anchor.y - card.h - CARD_GAP }
  const spots = [right, left, below, above]
  // ⛔ NEVER OVER A CARD (DL 23 Oct: the "most sensitive" link note covered F5's right edge on a cold reopen): when none
  // of the four is free, slide each along its side, nearest first, and take the first spot that covers nothing.
  for (let k = 1; k <= SLIDE_STEPS; k++) {
    const d = k * SLIDE_PX
    spots.push(
      { ...right, top: right.top + d }, { ...right, top: right.top - d }, { ...left, top: left.top + d }, { ...left, top: left.top - d },
      { ...below, left: below.left + d }, { ...below, left: below.left - d }, { ...above, left: above.left + d }, { ...above, left: above.left - d },
    )
  }
  const room = spots.filter((s) => fits(s) && s.top >= roomTop)
  const free = room.find((s) => covered(s) === 0)
  if (free) return free
  // Nothing free anywhere: the spot that covers least (strictly less, so the earlier, nearer spot wins a tie).
  return room.reduce<{ left: number; top: number } | null>(
    (best, s) => (best === null || covered(s) < covered(best) ? s : best), null) ?? before
}

/** How far the note slides along a side looking for a free spot (screen px), and how many steps it tries. */
const SLIDE_PX = 16
const SLIDE_STEPS = 24

const OlumiMark = COACHING_ICON_GLYPH.Icon

/**
 * Every card React Flow has drawn except the anchor, as boxes in the note's own frame (its offset parent). Measured, not
 * guessed: the store's nodes can lack `measured`, and the 240 × 80 fallback is narrower and shorter than a real card.
 */
function drawnCardBoxes(note: HTMLElement | null, anchorId: string): Box[] {
  const frame = note?.offsetParent?.getBoundingClientRect()
  if (!note || !frame) return []
  const flow = note.closest('.react-flow') ?? document
  return Array.from(flow.querySelectorAll<HTMLElement>('.react-flow__node'))
    .filter((el) => el.getAttribute('data-id') !== anchorId)
    .map((el) => el.getBoundingClientRect())
    .filter((r) => r.width > 0 && r.height > 0)
    .map((r) => ({ x: r.left - frame.left, y: r.top - frame.top, w: r.width, h: r.height }))
}

/** A link's anchor, in flow units: the midpoint along its drawn path (where its label sits), else between its cards. */
function linkMidpoint(edgeId: string): { x: number; y: number } | null {
  if (typeof document === 'undefined') return null
  const path = document.querySelector<SVGPathElement>(`.react-flow__edge[data-id="${CSS.escape(edgeId)}"] path.react-flow__edge-path`)
  const length = path && typeof path.getTotalLength === 'function' ? path.getTotalLength() : 0
  if (!path || !(length > 0)) return null
  const p = path.getPointAtLength(length / 2)
  return { x: Math.round(p.x), y: Math.round(p.y) }
}

/**
 * `held`: a note that is not the assistant's slot (the canvas's one suggested move, pinned on its link by
 * `ArtefactOffer`), with its own dismissal and press. Absent: the store's `olumiAttention`, as always.
 */
export function OlumiAttentionCard({ held, onDismiss, onPress }: {
  held?: OlumiAttention | null
  onDismiss?: () => void
  onPress?: (actionId: string) => void
} = {}) {
  const fromStore = useCanvasStore((s) => s.olumiAttention)
  const attention = held !== undefined ? held : fromStore
  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)
  const savedModel = useCanvasStore((s) => s.lastServerGraphHash)
  // Re-render on camera moves so the card stays with its element.
  const transform = useStore((s) => s.transform)

  const dismiss = useCallback(() => (onDismiss ? onDismiss() : clearOlumiAttention()), [onDismiss])
  // A note on a LINK (no card attended): anchored at the link's midpoint, measured from its drawn path after render.
  const linkId = attention && attention.nodeIds.length === 0 ? (attention.edgeIds[0] ?? null) : null
  const [linkPoint, setLinkPoint] = useState<{ x: number; y: number } | null>(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- after every render; an equal point bails out
  useLayoutEffect(() => {
    const p = linkId ? linkMidpoint(linkId) : null
    if (p?.x !== linkPoint?.x || p?.y !== linkPoint?.y) setLinkPoint(p)
  })
  const viewer = useIsViewer()
  const waitsOn = useCurrentGoalWaitsOn()
  const [answer, setAnswer] = useState('')
  // The card's own height, for a spot that covers no other card (`attentionCardSpot`); 0 until measured.
  const cardRef = useRef<HTMLDivElement>(null)
  const [cardHeight, setCardHeight] = useState(0)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- after every render; an equal height bails out
  useLayoutEffect(() => { const h = cardRef.current?.offsetHeight ?? 0; if (h !== cardHeight) setCardHeight(h) })

  /*
   * ⭐ ESCAPE RELEASES THE HOLD, AND IT IS DELIBERATELY ABOVE THE EARLY RETURN.
   *
   * Attention dims the whole model around its target, but the DIM is derived
   * from `olumiAttention` alone while this card renders only when there is a
   * NOTE — so attention held without one dims everything and shows no card,
   * and therefore no Dismiss button. Nothing reaches that state today (the
   * `ui_directive` path only accumulates targets inside `if (attentionNote)`,
   * and `focusModelTarget` only holds when it was given a note), but the exit
   * must not depend on that staying true.
   *
   * Placed before the `return null` so the listener is bound whenever ANY
   * attention is held, note or no note. Escape is also simply the key a user
   * reaches for first when the screen dims.
   */
  // A `held` note owns its own dismissal; Escape releases the assistant's slot only.
  const isHeld = held === undefined && attention != null
  useEffect(() => {
    if (!isHeld) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') clearOlumiAttention()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isHeld])

  if (!attention || (!attention.note && !attention.caveat)) return null
  const anchorId = attention.nodeIds[0] ?? linkId
  if (!anchorId) return null
  const anchor = nodes.find((n) => n.id === anchorId)
  const link = anchor ? undefined : edges.find((e) => e.id === anchorId)
  if (!anchor && !link) return null
  // Before the path is measured (or with none drawn), the link's anchor is the midpoint between its two cards' centres.
  const between = (): { x: number; y: number } | null => {
    const ends = [link?.source, link?.target].map((id) => nodes.find((n) => n.id === id))
    if (!ends[0] || !ends[1]) return null
    const c = (n: (typeof nodes)[number]) => ({ x: n.position.x + (n.measured?.width ?? 240) / 2, y: n.position.y + (n.measured?.height ?? 80) / 2 })
    return { x: (c(ends[0]).x + c(ends[1]).x) / 2, y: (c(ends[0]).y + c(ends[1]).y) / 2 }
  }
  const point = link ? (linkPoint ?? between()) : null
  if (link && !point) return null

  const measured = (anchor as { measured?: { width?: number; height?: number } } | undefined)?.measured
  const w = anchor ? (measured?.width ?? 240) : 0
  const [tx, ty, zoom] = transform
  // Beside the card it is about, never over another card: right, else left (the dock is the right edge), else below/above.
  const roomRight = typeof window === 'undefined' ? Infinity : window.innerWidth - measureDockInset() - CARD_GAP
  const screenBox = (n: { position: { x: number; y: number }; measured?: { width?: number; height?: number } }): Box => ({
    x: n.position.x * zoom + tx, y: n.position.y * zoom + ty, w: (n.measured?.width ?? 240) * zoom, h: (n.measured?.height ?? 80) * zoom })
  // The cards as drawn (their real rects, in this note's frame); the store's sizes only where the DOM has none (tests).
  const drawn = cardHeight > 0 ? drawnCardBoxes(cardRef.current, anchorId) : []
  const others = cardHeight > 0
    ? (drawn.length > 0 ? drawn : nodes.filter((n) => n.id !== anchorId).map((n) => screenBox(n as never)))
    : []
  const anchorBox: Box = anchor
    ? { ...screenBox(anchor as never), w: w * zoom }
    : { x: point!.x * zoom + tx, y: point!.y * zoom + ty, w: 0, h: 0 }
  const { left, top } = attentionCardSpot(anchorBox, { w: CARD_WIDTH, h: cardHeight }, others, 0, roomRight, 0)

  const note = attention.note
  const caveat = attention.caveat
  // ⭐ A NOTE ON A GOAL WHOSE CHANCE WAITS says the target as the goal card says it and what CEE says the result waits on,
  // each answerable label opening its card's answer box (Paul, 24 Oct: the threshold and notes go "In Olumi's note").
  // Read, never composed: the card's own target line and CEE's `goal_chance.waits_on`, in its order and words.
  const goalWaits = Boolean(note) && anchor?.type === 'goal' && waitsOn.length > 0
  const goalTarget = goalWaits ? goalTargetLine(anchor?.data as GoalTargetSource) : null
  // Stale only when the SAVED model has moved since (a new server hash: a value set, an accepted change, a structural
  // edit) or an item the note is about was renamed (the hash leaves labels out), never when the canvas merely laid
  // itself out again.
  const renamed = attention.nodeIds.some((id) => {
    const then = attention.labels?.[id]
    return then !== undefined && then !== nodeLabel(nodes.find((n) => n.id === id))
  })
  const isStale = renamed || (
    attention.modelVersion !== null &&
    savedModel !== null &&
    savedModel !== attention.modelVersion)
  // The header's chip: the producer's move, a caveat's disclosure, or a move-less question; else the mark alone.
  const chip: { Icon: LucideIcon; label: string } | null = !note
    ? { Icon: Info, label: CAVEAT_LABEL }
    : note.move
      ? { Icon: MOVE_ICON[note.move] ?? Info, label: MOVE_LABEL[note.move] ?? note.move }
      : !viewer && !link && isQuestion(note.body ?? note.title)
        ? { Icon: MessageCircleQuestion, label: QUESTION_LABEL }
        : null

  return (
    <div
      ref={cardRef}
      data-testid={OLUMI_ATTENTION_CARD_TESTID}
      data-anchor-id={anchorId}
      {...(link ? { 'data-anchor-kind': 'link' } : {})}
      {...(note ? { 'data-move': note.move } : {})}
      style={{ position: 'absolute', left, top, width: CARD_WIDTH, zIndex: 95 }}
      className="pointer-events-auto rounded-lg border border-panel-border bg-panel shadow-panel p-3"
      role="complementary"
      aria-label={`Olumi on ${anchorId}`}
    >
      <div className="flex items-start gap-2">
        <span title={ATTENTION_CARD_COPY.olumi} className="mt-0.5 flex-none">
          <OlumiMark size={16} aria-hidden="true" />
          <span className="sr-only">{ATTENTION_CARD_COPY.olumi}</span>
        </span>
        {/* The move's chip; stale, it becomes the clock (the stale sentence is its name). */}
        {isStale ? (
          <span
            data-testid={`${OLUMI_ATTENTION_CARD_TESTID}-stale`}
            title={ATTENTION_CARD_COPY.stale}
            className="mt-0.5 inline-flex h-5 w-5 flex-none items-center justify-center rounded-full bg-panel-hover text-warning"
          >
            <History className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="sr-only">{ATTENTION_CARD_COPY.stale}</span>
          </span>
        ) : chip ? (
          <span
            data-testid={`${OLUMI_ATTENTION_CARD_TESTID}-move`}
            title={chip.label}
            role="img"
            aria-label={chip.label}
            className="mt-0.5 inline-flex h-5 w-5 flex-none items-center justify-center rounded-full bg-info/10 text-info"
          >
            <chip.Icon className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        ) : null}
        <span className="min-w-0 flex-1">
          {note?.title ? (
            <span className={`${typography.panelHeader} text-text-header block mt-0.5`}>
              {note.title}
            </span>
          ) : null}
        </span>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="shrink-0 rounded p-0.5 text-text-light hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-info"
        >
          <X className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>

      {goalWaits ? (
        <div data-testid={`${OLUMI_ATTENTION_CARD_TESTID}-waits`} className="mt-1.5 space-y-0.5">
          {goalTarget ? <p className={`${typography.panelBody} text-text-body mb-0`}>{goalTarget}</p> : null}
          <p className={`${typography.panelBody} text-text-body mb-0`}>{'Waits on: '}<WaitsOnList items={waitsOn} testIdPrefix={`${OLUMI_ATTENTION_CARD_TESTID}-waits-on`} /></p>
        </div>
      ) : null}

      {note?.body ? (
        <p className={`${typography.panelBody} text-text-body mt-1.5 mb-0`}>{note.body}</p>
      ) : null}

      {note && !viewer && !link && isQuestion(note.body ?? note.title) ? (
        <form
          data-testid={`${OLUMI_ATTENTION_CARD_TESTID}-answer`}
          className="mt-2 flex items-center gap-1.5 rounded-full border border-panel-border bg-panel px-3 py-1 focus-within:ring-2 focus-within:ring-primary"
          onSubmit={(e) => {
            e.preventDefault()
            // The person's own words, about this item: CEE reads them as theirs and answers in the conversation.
            if (askAi({ userWords: answer, nodeIds: [anchorId] }) !== 'sent') return
            // The item keeps a tick with this question and answer (`AnsweredMark`).
            const scenarioId = useCanvasStore.getState().currentScenarioId
            const question = note.body ?? note.title ?? ''
            if (scenarioId) useAnsweredQuestionsStore.getState().record(scenarioId, anchorId, { question, answer: answer.trim(), at: new Date().toISOString() })
            setAnswer('')
            clearOlumiAttention()
            revealOlumiSurface()
          }}
        >
          <input
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={(e) => { if (e.key !== 'Escape') e.stopPropagation() }}
            placeholder={ATTENTION_CARD_COPY.answer}
            aria-label={ATTENTION_CARD_COPY.answer}
            className={`${typography.panelBody} min-w-0 flex-1 bg-transparent text-text-body placeholder:text-text-light focus:outline-none`}
          />
          <button
            type="submit"
            disabled={answer.trim() === ''}
            aria-label={ATTENTION_CARD_COPY.send}
            title={ATTENTION_CARD_COPY.send}
            className="inline-flex h-6 w-6 flex-none items-center justify-center rounded-full bg-primary text-text-on-color hover:bg-primary-hover disabled:bg-panel-hover disabled:text-text-light"
          >
            <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </form>
      ) : null}

      {caveat ? (
        <>
          <p
            className={`${typography.panelBody} text-warning mt-1.5 mb-0`}
            data-testid={`${OLUMI_ATTENTION_CARD_TESTID}-caveat`}
          >
            {caveat.text}
          </p>
          {caveat.sourceLine ? (
            <p
              className={`${typography.panelMeta} text-text-light mt-1 mb-0`}
              data-testid={`${OLUMI_ATTENTION_CARD_TESTID}-caveat-reason`}
            >
              {caveat.sourceLine}
            </p>
          ) : null}
        </>
      ) : null}


      {note && note.actions && note.actions.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {note.actions.map((a) => (
            <button
              key={a.id}
              type="button"
              data-testid={`${OLUMI_ATTENTION_CARD_TESTID}-action`}
              data-action-id={a.id}
              onClick={() => {
                // A held note's own press and dismissal (the canvas's suggested move: its press, its "Not now").
                if (a.kind === 'press') { onPress?.(a.id); return }
                if (a.kind === 'dismiss') { dismiss(); return }
                // "Open details": the inspector, where the item is edited. The note steps aside for it.
                if (a.kind === 'details') {
                  clearOlumiAttention()
                  openNodeInspector(anchorId)
                  return
                }
                /*
                 * ⭐ THE CARD IS A DOOR, NOT A NOTICE (30 Aug 2026, per the
                 * alignment principle: Olumi should point into the model,
                 * explain why something deserves thought, and then let the user
                 * EXPLORE it conversationally — one reasoning partner rather
                 * than a graph plus a chatbot).
                 *
                 * The ask carries the element it is about, so the conversation
                 * opens already knowing what is being discussed instead of
                 * asking the user to re-describe it. The draft is a QUESTION,
                 * because the product test is whether this improves the user's
                 * reasoning — a prefilled answer would fail it.
                 */
                openAskOlumi({
                  context: note.body,
                  draft: a.prompt ?? '',
                  label: a.label,
                  targetId: anchorId,
                  source: 'canvas_attention',
                })
              }}
              className={`${typography.panelBody} rounded-md bg-info/10 px-2 py-1 text-info hover:bg-info/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
            >
              {a.label}
            </button>
          ))}
        </div>
      ) : null}

      {note && note.sourceLine ? (
        <p className={`${typography.panelMeta} text-text-light mt-1.5 mb-0`}>{note.sourceLine}</p>
      ) : null}
    </div>
  )
}

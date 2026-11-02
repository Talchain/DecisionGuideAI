/**
 * v10: where Olumi is looking, said beside the record itself (design QA 8, 1 Nov 2026). In the current design the same
 * focus is a pill in the overlay band at the foot of the canvas, far from the card the focus ring is on; in v10 the note is
 * pinned beside that card, moves and zooms with the canvas, and stands on the side with the most room, inside the visible
 * canvas, with a short line to the record. One note at a time: while Olumi's coaching note is open, that is the note.
 *
 * It owns no focus of its own: the target, its expiry and its dismissal are `assistantFocusStore`'s, and the chip in the
 * band (`AssistantFocusChip`) still retires a target that has gone. Screen space, like `OlumiAttentionCard`, so its text keeps
 * its size at any zoom.
 */
import { memo, useLayoutEffect, useRef, useState } from 'react'
import { useStore } from '@xyflow/react'
import { X } from 'lucide-react'
import { useCanvasStore } from '../canvas/store'
import { dismissAssistantFocus, useAssistantFocusStore } from '../canvas/stores/assistantFocusStore'
import { OlumiAiIcon } from '../components/results/analysisNew/OlumiAiIcon'
import { ICON_STANDALONE } from '../canvas/conversation/panelIcons'
import { usePresentation } from './v10'
import { linkMidpoint } from '../canvas/components/OlumiAttentionCard'
import { V10_NOTE_WIDTH, boundsInFrame, connectorBetween, drawnCardsIn, measureVisibleCanvas, placeNoteBeside, useRelayoutOnResize, type Box } from './v10Note'

export const V10_FOCUS_NOTE_TESTID = 'v10-focus-note'

/** v10 words: "Olumi is looking at Per specialist". The label's first letter is capitalised for reading, nothing else. */
export const v10FocusLine = (label: string) => `Olumi is looking at ${label.charAt(0).toUpperCase()}${label.slice(1)}`

type Placed = { left: number; top: number; line: ReturnType<typeof connectorBetween> }

export const V10FocusNote = memo(function V10FocusNote() {
  const v10 = usePresentation() === 'v10'
  const target = useAssistantFocusStore((s) => s.target)
  const scenarioId = useCanvasStore((s) => s.currentScenarioId)
  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)
  const coachingOpen = useCanvasStore((s) => Boolean(s.olumiAttention && (s.olumiAttention.note || s.olumiAttention.caveat)))
  const [tx, ty, zoom] = useStore((s) => s.transform)
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  // eslint-disable-next-line react-hooks/exhaustive-deps -- after every render; an equal size bails out
  useLayoutEffect(() => {
    const w = ref.current?.offsetWidth ?? 0
    const h = ref.current?.offsetHeight ?? 0
    if (w !== size.w || h !== size.h) setSize({ w, h })
  })

  const scenarioMatches = target?.scenarioId == null || target.scenarioId === scenarioId
  const showing = v10 && Boolean(target) && scenarioMatches && !coachingOpen
  // A link is anchored on its drawn path (where its label sits), measured after render like `OlumiAttentionCard` does: the
  // middle of its two cards can fall inside a card the link is routed around.
  const linkId = showing && target?.kind === 'edge' ? target.id : null
  const [linkPoint, setLinkPoint] = useState<{ x: number; y: number } | null>(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- after every render; an equal point bails out
  useLayoutEffect(() => {
    const p = linkId ? linkMidpoint(linkId) : null
    if (p?.x !== linkPoint?.x || p?.y !== linkPoint?.y) setLinkPoint(p)
  })
  // The window, the canvas or the dock changing size re-places the note: its room is read while rendering.
  useRelayoutOnResize(ref.current?.offsetParent ?? null, showing)
  if (!showing || !target) return null

  // The record's box on screen: a card from its position and the camera; a link at the middle of its two cards.
  const boxOf = (n: { position: { x: number; y: number }; measured?: { width?: number; height?: number } }): Box => ({
    x: n.position.x * zoom + tx, y: n.position.y * zoom + ty, w: (n.measured?.width ?? 240) * zoom, h: (n.measured?.height ?? 80) * zoom })
  const node = target.kind === 'node' ? nodes.find((n) => n.id === target.id) : undefined
  const edge = target.kind === 'edge' ? edges.find((e) => e.id === target.id) : undefined
  const ends = edge ? [edge.source, edge.target].map((id) => nodes.find((n) => n.id === id)) : []
  let anchor: Box | null = null
  if (node) anchor = boxOf(node as never)
  else if (edge && linkPoint) anchor = { x: linkPoint.x * zoom + tx, y: linkPoint.y * zoom + ty, w: 0, h: 0 }
  else if (edge && ends[0] && ends[1]) {
    // Until the path is measured (or with none drawn): between its two cards.
    const [a, b] = [boxOf(ends[0] as never), boxOf(ends[1] as never)]
    anchor = { x: (a.x + a.w / 2 + b.x + b.w / 2) / 2, y: (a.y + a.h / 2 + b.y + b.h / 2) / 2, w: 0, h: 0 }
  }
  if (!anchor) return null

  let placed: Placed = { left: anchor.x + anchor.w + 14, top: anchor.y, line: null }
  const frame = ref.current?.offsetParent ?? null
  if (frame && size.h > 0) {
    const origin = frame.getBoundingClientRect()
    const w = Math.min(size.w, V10_NOTE_WIDTH)
    const others = drawnCardsIn(origin, frame, node?.id)
    const spot = placeNoteBeside(anchor, { w, h: size.h }, others, boundsInFrame(measureVisibleCanvas(frame), origin))
    placed = { left: spot.left, top: spot.top, line: connectorBetween(anchor, { x: spot.left, y: spot.top, w, h: size.h }) }
  }

  return (
    <div
      ref={ref}
      role="status"
      aria-live="polite"
      data-testid={V10_FOCUS_NOTE_TESTID}
      data-v10-note="anchored"
      data-focus-id={target.id}
      data-focus-kind={target.kind}
      style={{ position: 'absolute', left: placed.left, top: placed.top, maxWidth: V10_NOTE_WIDTH, zIndex: 95, borderRadius: 14 }}
      className="pointer-events-auto inline-flex items-center gap-2 border border-info bg-panel px-3 py-2 shadow-panel"
    >
      {placed.line ? (
        <svg aria-hidden="true" data-testid="v10-note-connector" className="pointer-events-none absolute overflow-visible" style={{ left: 0, top: 0, width: 1, height: 1 }}>
          <line x1={placed.line.x1 - placed.left} y1={placed.line.y1 - placed.top} x2={placed.line.x2 - placed.left} y2={placed.line.y2 - placed.top} stroke="var(--info)" strokeWidth={1.5} strokeLinecap="round" />
        </svg>
      ) : null}
      <OlumiAiIcon size={ICON_STANDALONE} className="olumi-glyph-ai shrink-0 text-info" aria-hidden="true" />
      <span className="min-w-0 text-sm text-text-body">{v10FocusLine(target.label)}</span>
      <button
        type="button"
        onClick={dismissAssistantFocus}
        className="shrink-0 rounded-full p-1 text-text-light transition-colors hover:bg-panel-hover hover:text-text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info motion-reduce:transition-none"
        aria-label={`Dismiss Olumi focus on ${target.label}`}
        title="Dismiss focus"
      >
        <X size={ICON_STANDALONE} aria-hidden="true" />
      </button>
    </div>
  )
})

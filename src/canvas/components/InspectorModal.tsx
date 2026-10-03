/**
 * Full inspector panel - opens on double-click or expand button
 * Positioned relative to selected node/edge, draggable
 * British English: visualisation, colour
 */

import { topLeftChromeBottomPx } from '../utils/topBarClearance'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { X, GripVertical } from 'lucide-react'
import { useViewport } from '@xyflow/react'
import { useCanvasStore } from '../store'
import { NodeInspector } from '../ui/NodeInspector'
import { EdgeInspector } from '../ui/EdgeInspector'
import { InspectorRouter } from '../ui/inspector-v2'
import { ICON_STANDALONE } from '../conversation/panelIcons'
import { useInspectorPresenceStore } from '../stores/inspectorPresenceStore'
import { CANVAS_LAYER_CLASS } from '../layers'
import { OVERLAY_BAND_SELECTOR, SIDEBAR_SELECTOR } from '../utils/computeFitPadding'
import { isGhostNode } from '../utils/fitTargets'

/** Feature flag: when true, uses the new per-type inspector panels */
const USE_INSPECTOR_V2 = true

interface InspectorModalProps {
  nodeId: string | null
  edgeId: string | null
  onClose: () => void
}

interface Position {
  x: number
  y: number
}

/** A screen rectangle (client px). */
export interface ScreenRect {
  left: number
  top: number
  right: number
  bottom: number
}

function overlapArea(a: ScreenRect, b: ScreenRect): number {
  const w = Math.min(a.right, b.right) - Math.max(a.left, b.left)
  const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
  return w > 0 && h > 0 ? w * h : 0
}

/**
 * ⭐ WHERE THE INSPECTOR OPENS — canvas visual contract v3.1 ("no overlap").
 *
 * Measured on the served dev build (pricing, 1280x800, dock open at x=853): a
 * Risk click opened the inspector at x=611..941, 88px over the right panel —
 * the placement kept clear of the WINDOW edge only, and the dock is the right
 * edge the canvas actually has. `rightLimit` is that edge (the dock's left, or
 * the window's width when there is no dock).
 *
 * ⭐⭐ THE PANEL NEVER COVERS THE CARD IT INSPECTS, THE FOCUS CHIP, OR (WHERE
 * THE CANVAS HAS ROOM) THE PATH THE SELECTION HIGHLIGHTS — audit SI-1/SI-2/
 * SI-3, 27 Sep 2026, pricing at 1280x800, reproduced local and served:
 *
 *   · SI-1: the anchor is the card's RIGHT edge (`computeAnchorPosition`), and
 *     the left flip was `anchor.x - width - gap` — so every flipped panel ended
 *     24px short of the card's right edge and covered 81% of a factor/option/
 *     outcome/risk card and 90% of the Question and the Goal. The flip now
 *     measures from the card's LEFT edge (`target`).
 *   · SI-2: the bottom bound was the window (784 at 800), so bottom-row
 *     selections sat over the canvas overlay band (y 724..788) and hid the
 *     "Showing paths from…" chip's Clear button. `bottomLimit` is the band's
 *     top edge.
 *   · SI-3: selecting a card turns on the path focus, and a 330x665 panel
 *     opened beside the card covered 45–89% of the cards it highlights. The
 *     placement now weighs the focused path's cards (`keepClear`) and, among
 *     the positions that keep off the inspected card, takes the one that
 *     hides the least of the path — the contract's own mock pins the panel
 *     beside the right panel, which is one of the candidates.
 *
 * Candidates: right of the card, left of the card, the free canvas's left
 * edge (beside the left rails), the free canvas's right edge (beside the
 * dock); each level with the card, above it, below it, and at the top and the
 * bottom of the room; each clamped by the one bounds rule (`clampInspector`). Chosen, in order: least cover of the inspected
 * card; least cover of the focused path; a side with genuine room (not
 * clamped) over a clamped one; then the order above. With no `target` and no
 * `keepClear` this is exactly the previous rule: right of the anchor, flip left
 * when blocked, clamp.
 */
export function placeInspector({
  anchor,
  panel,
  viewport,
  rightLimit,
  leftLimit = 0,
  topLimit = 0,
  bottomLimit = viewport.height,
  padding = 16,
  gap = 24,
  target,
  keepClear = [],
}: {
  anchor: Position
  panel: { width: number; height: number }
  viewport: { width: number; height: number }
  rightLimit: number
  /** The left canvas rails' right edge (tools, viewport controls); the panel never starts left of it. */
  leftLimit?: number
  /** The app bar's bottom edge (`--topbar-h`); the panel never starts above it. */
  topLimit?: number
  /** The canvas overlay band's top edge (the focus chip lives in it); the panel never ends below it. */
  bottomLimit?: number
  padding?: number
  gap?: number
  /** The inspected card's screen rect. Absent (an edge selection) → the anchor point. */
  target?: ScreenRect
  /** The focused path's cards (the selection's highlighted neighbourhood), inspected card excluded. */
  keepClear?: readonly ScreenRect[]
}): Position {
  const right = Math.min(rightLimit, viewport.width) - padding
  const card: ScreenRect = target ?? { left: anchor.x, right: anchor.x, top: anchor.y, bottom: anchor.y }
  const xs = [card.right + gap, card.left - gap - panel.width, leftLimit + padding, right - panel.width]
  const bottom = Math.min(bottomLimit, viewport.height) - padding
  const ys = [
    anchor.y - panel.height / 2, // level with the card (the previous rule)
    card.top - gap - panel.height, // above the card
    card.bottom + gap, // below the card
    topLimit + padding, // the top of the room
    bottom - panel.height, // the bottom of the room
  ]
  // Path cover below this is a tie: a sliver is not worth moving the panel
  // across the board for. 2% of the panel's own area (~a 126x33 strip at 330x640).
  const tolerance = 0.02 * panel.width * panel.height

  let best: { at: Position; onCard: number; onPath: number; clamped: boolean } | null = null
  for (const rawX of xs) {
    for (const rawY of ys) {
      const at = clampInspector({ at: { x: rawX, y: rawY }, panel, viewport, rightLimit, leftLimit, topLimit, bottomLimit, padding })
      const box: ScreenRect = { left: at.x, top: at.y, right: at.x + panel.width, bottom: at.y + panel.height }
      const onCard = overlapArea(box, card)
      const onPath = keepClear.reduce((sum, r) => sum + overlapArea(box, r), 0)
      const clamped = at.x !== rawX
      const better = best === null
        || onCard < best.onCard
        || (onCard === best.onCard && onPath < best.onPath - tolerance)
        || (onCard === best.onCard && Math.abs(onPath - best.onPath) <= tolerance && !clamped && best.clamped)
      if (better) best = { at, onCard, onPath, clamped }
    }
  }
  return best!.at
}

/**
 * ⭐ THE ONE BOUNDS RULE — used by the placement on open AND by every drag move.
 *
 * Measured on served UI `507d8ef8` (27 Sep 2026, pricing, 1280x800, D-2 case
 * c3): the inspector opened clear of the right panel (0px overlap), then ONE
 * drag of its header to the right left it at x 1066..1396 — 214px over the
 * panel and 116px past the window, owning 85 of 144 sampled points inside the
 * panel. The drag wrote the raw pointer delta; only the opening placement was
 * clamped. Anything the panel shows under it (its dialogs included, which sit
 * inside the dock's own stacking context) was covered.
 *
 * Never over the right edge (the dock's left, or the window); never over the
 * left rails (`leftLimit` — the canvas tools and the viewport controls: once
 * the placement weighs the free canvas's left edge, a panel at x=16 covered
 * both, measured on pricing's Goal); never above the app bar; never below the
 * canvas overlay band's top edge (`bottomLimit`, audit SI-2 — the band holds
 * the focus chip and its Clear button; the window's bottom edge when there is
 * no band). When the panel is wider or taller than the room, the left and top
 * edges win.
 */
export function clampInspector({
  at,
  panel,
  viewport,
  rightLimit,
  leftLimit = 0,
  topLimit = 0,
  bottomLimit = viewport.height,
  padding = 16,
}: {
  at: Position
  panel: { width: number; height: number }
  viewport: { width: number; height: number }
  rightLimit: number
  leftLimit?: number
  topLimit?: number
  bottomLimit?: number
  padding?: number
}): Position {
  const right = Math.min(rightLimit, viewport.width) - padding
  const bottom = Math.min(bottomLimit, viewport.height) - padding
  let { x, y } = at
  if (x + panel.width > right) x = right - panel.width
  if (x < leftLimit + padding) x = leftLimit + padding
  if (y + panel.height > bottom) y = bottom - panel.height
  if (y < topLimit + padding) y = topLimit + padding
  return { x, y }
}

/** The right panel's left edge, or the window's width when it is not showing. */
function canvasRightLimit(): number {
  const dock = document.querySelector('[data-testid="outputs-dock"]')
  const r = dock?.getBoundingClientRect()
  return r && r.width > 0 && r.left > 0 ? Math.min(r.left, window.innerWidth) : window.innerWidth
}

/**
 * The left rails' right edge — the canvas tools and the viewport controls, the
 * floating chrome at the canvas's left edge (`computeFitPadding` reserves the
 * same `nav[aria-label="Canvas tools"]` for the fit) — or 0 when neither shows.
 */
const LEFT_RAIL_SELECTORS = [SIDEBAR_SELECTOR, 'nav[aria-label="Viewport controls"]'] as const
function canvasLeftLimit(): number {
  let edge = 0
  for (const selector of LEFT_RAIL_SELECTORS) {
    const r = document.querySelector(selector)?.getBoundingClientRect()
    if (r && r.width > 0 && r.height > 0 && r.right < window.innerWidth / 2) edge = Math.max(edge, r.right)
  }
  return edge
}

/**
 * The canvas overlay band's top edge — the band holds the bottom-centre focus
 * chip ("Showing paths from … to the goal" + Clear) — or the window's height
 * when no band is mounted (audit SI-2).
 */
function canvasBottomLimit(): number {
  const r = document.querySelector(OVERLAY_BAND_SELECTOR)?.getBoundingClientRect()
  return r && r.height > 0 && r.top > 0 ? Math.min(r.top, window.innerHeight) : window.innerHeight
}

/** The app chrome's bottom edge in the top-left column (the pill, `TopBar.tsx`); 0 when none is mounted. */
function appBarBottom(): number {
  return topLeftChromeBottomPx()
}

/** The inset every bound keeps (`placeInspector` / `clampInspector` default). */
const INSPECTOR_PADDING = 16

/*
 * `--inspector-room` — the custom property the shell's `max-height` reads
 * (`inspectorStyle.ts`): the room between the app bar and the overlay band, so
 * a tall panel shrinks (and scrolls) rather than reaching the focus chip.
 * Measured on pricing at 1280x800: the room is 51+16 .. 724-16 = 641px; the
 * panel was 665px. Written per placement, below.
 */

/** A card's screen rect, by React Flow node id; null when it is not rendered. */
function nodeScreenRect(id: string): ScreenRect | null {
  // Matched by dataset rather than a `[data-id="…"]` selector: ids are
  // model-authored, and a selector would need `CSS.escape` (absent in jsdom).
  const el = Array.from(document.querySelectorAll<HTMLElement>('.react-flow__node')).find(n => n.dataset.id === id)
  const r = el?.getBoundingClientRect()
  return r && r.width > 0 && r.height > 0 ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom } : null
}

/**
 * The focused path's cards on screen (SI-3): every rendered card the selection
 * focus leaves undimmed, the inspected card and the frontier doors excluded.
 * Empty when no focus is active — the panel then only keeps off its own card.
 */
function focusedPathRects(inspectedId: string | null): ScreenRect[] {
  const dimmed = useCanvasStore.getState().dimmedNodeIds
  if (!dimmed || dimmed.size === 0) return []
  const rects: ScreenRect[] = []
  for (const el of document.querySelectorAll<HTMLElement>('.react-flow__node')) {
    const id = el.dataset.id
    if (!id || id === inspectedId || isGhostNode(id) || dimmed.has(id)) continue
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.height > 0) rects.push({ left: r.left, top: r.top, right: r.right, bottom: r.bottom })
  }
  return rects
}

export const InspectorModal = memo(({ nodeId, edgeId, onClose }: InspectorModalProps) => {
  const panelRef = useRef<HTMLDivElement>(null)
  const { x: viewportX, y: viewportY, zoom } = useViewport()

  // Get anchor position from selection
  const anchorPosition = useCanvasStore(s => s.selection.anchorPosition)

  // Design audit #14: the dock's "Selected" row stands down while this is open
  // (`SelectionPill`). Reported on mount, withdrawn on unmount.
  const hasTarget = Boolean(nodeId || edgeId)
  useEffect(() => {
    if (!hasTarget) return
    const { setOpen } = useInspectorPresenceStore.getState()
    setOpen(true)
    return () => setOpen(false)
  }, [hasTarget])

  // Dragging state
  const [isDragging, setIsDragging] = useState(false)
  const [position, setPosition] = useState<Position | null>(null)
  const dragStartRef = useRef<{ x: number; y: number; posX: number; posY: number } | null>(null)

  // Convert canvas coordinates to screen coordinates
  const canvasToScreen = useCallback((canvasPos: { x: number; y: number }) => {
    return {
      x: canvasPos.x * zoom + viewportX,
      y: canvasPos.y * zoom + viewportY,
    }
  }, [viewportX, viewportY, zoom])

  // Calculate initial position based on anchor (right side of node with gap)
  useEffect(() => {
    if (!anchorPosition || position) return

    // Wait for panel to render to get dimensions
    requestAnimationFrame(() => {
      if (!panelRef.current) return

      const topLimit = appBarBottom()
      const bottomLimit = canvasBottomLimit()
      // The room between the app bar and the overlay band caps the shell's
      // height BEFORE it is measured (SI-2): a panel taller than the room
      // would otherwise run into the focus chip whatever its position.
      // Written straight to the element (React never sets this property, so a
      // re-render does not clear it) so the measurement below already sees it.
      // (A literal name, not the constant: `scripts/css-var-census.mjs` finds
      // runtime definitions by the literal `setProperty('--…'` spelling.)
      panelRef.current.style.setProperty(
        '--inspector-room',
        `${Math.max(0, bottomLimit - topLimit - 2 * INSPECTOR_PADDING)}px`,
      )
      const rect = panelRef.current.getBoundingClientRect()
      // Convert canvas coordinates to screen coordinates, then place clear of
      // the right panel (v3.1 "no overlap" — see `placeInspector`) AND below the
      // app bar. Canvas v3.1 DESIGN-GAP #5 made the top bar the contract's
      // full-width 51px `.app-top`, so a y clamped to `padding` alone put this
      // panel's header over the bar at every x (the floating pill only spanned
      // x 12..450). `--topbar-h` is the bar's bottom edge, written by
      // `TopBar.tsx`; 0 when no bar is mounted.
      setPosition(placeInspector({
        anchor: canvasToScreen(anchorPosition),
        panel: { width: rect.width, height: rect.height },
        viewport: { width: window.innerWidth, height: window.innerHeight },
        rightLimit: canvasRightLimit(),
        leftLimit: canvasLeftLimit(),
        topLimit,
        bottomLimit,
        padding: INSPECTOR_PADDING,
        // SI-1: the card's own rect, so a flip clears its LEFT edge (the
        // anchor is its right edge). An edge selection has no card: the anchor
        // point stands in, as before.
        target: nodeId ? nodeScreenRect(nodeId) ?? undefined : undefined,
        // SI-3: the cards the selection focus highlights.
        keepClear: focusedPathRects(nodeId),
      }))
    })
  }, [anchorPosition, canvasToScreen, position, nodeId])

  // Reset position when node/edge changes
  useEffect(() => {
    setPosition(null)
  }, [nodeId, edgeId])

  // Handle escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  // Drag handlers — passed to InspectorShell header in v2 mode
  const handleDragStart = useCallback((event: React.PointerEvent) => {
    event.preventDefault()
    event.stopPropagation()

    if (!position) return

    setIsDragging(true)
    dragStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      posX: position.x,
      posY: position.y,
    }

    // Capture pointer for smooth dragging
    ;(event.target as HTMLElement).setPointerCapture(event.pointerId)
  }, [position])

  const handleDragMove = useCallback((event: React.PointerEvent) => {
    if (!isDragging || !dragStartRef.current) return

    const deltaX = event.clientX - dragStartRef.current.x
    const deltaY = event.clientY - dragStartRef.current.y

    // The same bounds as the opening placement (`clampInspector`): a drag can
    // move the panel anywhere on the free canvas, never over the right panel
    // or out of the window.
    const rect = panelRef.current?.getBoundingClientRect()
    setPosition(clampInspector({
      at: { x: dragStartRef.current.posX + deltaX, y: dragStartRef.current.posY + deltaY },
      panel: { width: rect?.width ?? 0, height: rect?.height ?? 0 },
      viewport: { width: window.innerWidth, height: window.innerHeight },
      rightLimit: canvasRightLimit(),
      leftLimit: canvasLeftLimit(),
      topLimit: appBarBottom(),
      bottomLimit: canvasBottomLimit(),
      padding: INSPECTOR_PADDING,
    }))
  }, [isDragging])

  const handleDragEnd = useCallback((event: React.PointerEvent) => {
    setIsDragging(false)
    dragStartRef.current = null
    ;(event.target as HTMLElement).releasePointerCapture(event.pointerId)
  }, [])

  if (!nodeId && !edgeId) return null

  // Calculate initial position from anchor while waiting for measured position
  const screenAnchor = anchorPosition ? canvasToScreen(anchorPosition) : { x: 200, y: 200 }

  const dragHandlers = {
    onPointerDown: handleDragStart,
    onPointerMove: handleDragMove,
    onPointerUp: handleDragEnd,
    onPointerCancel: handleDragEnd,
    isDragging,
  }

  if (USE_INSPECTOR_V2) {
    return (
      <div
        ref={panelRef}
        className={`fixed ${CANVAS_LAYER_CLASS.inspector}`}
        style={{
          left: position?.x ?? screenAnchor.x + 24,
          top: position?.y ?? screenAnchor.y,
          opacity: position ? 1 : 0,
          transition: isDragging ? 'none' : 'opacity 150ms ease-out',
        }}
        role="dialog"
        aria-modal="false"
        aria-label={nodeId ? 'Node inspector' : 'Edge inspector'}
      >
        <InspectorRouter
          nodeId={nodeId}
          edgeId={edgeId}
          onClose={onClose}
          dragHandlers={dragHandlers}
        />
      </div>
    )
  }

  // Legacy v1 path
  return (
    <div
      ref={panelRef}
      className={`fixed ${CANVAS_LAYER_CLASS.inspector} bg-panel rounded-lg shadow-3 max-w-md w-full max-h-[80vh] overflow-hidden border border-panel-border`}
      style={{
        left: position?.x ?? screenAnchor.x + 24,
        top: position?.y ?? screenAnchor.y,
        opacity: position ? 1 : 0,
        transition: isDragging ? 'none' : 'opacity 150ms ease-out',
      }}
      role="dialog"
      aria-modal="false"
      aria-labelledby="inspector-panel-title"
    >
      <div
        className={`sticky top-0 bg-panel border-b border-gray-200 px-4 py-3 flex items-center justify-between rounded-t-xl select-none ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        onPointerDown={handleDragStart}
        onPointerMove={handleDragMove}
        onPointerUp={handleDragEnd}
        onPointerCancel={handleDragEnd}
      >
        <div className="flex items-center gap-2">
          <GripVertical size={16} className="text-gray-400" aria-hidden="true" />
          <h2 id="inspector-panel-title" className="text-sm font-semibold text-gray-900">
            {nodeId ? 'Node Properties' : 'Edge Properties'}
          </h2>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label="Close inspector"
        >
          <X size={ICON_STANDALONE} />
        </button>
      </div>

      <div className="overflow-y-auto max-h-[calc(80vh-52px)]">
        {nodeId && (
          <NodeInspector
            nodeId={nodeId}
            onClose={onClose}
          />
        )}
        {edgeId && !nodeId && (
          <EdgeInspector
            edgeId={edgeId}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  )
})

InspectorModal.displayName = 'InspectorModal'

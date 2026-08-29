import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { MessageSquare, Minus, PanelRight } from 'lucide-react'
import { typo } from '../../styles/typography'
import { useCanvasStore } from '../store'
import { useConversationContext } from '../conversation/ConversationContext'
import { ConversationPanel } from '../conversation/ConversationPanel'
import { THREAD_TESTID_FLOATING } from '../conversation/zones/ChatThread'
import {
  useFloatingPanelState,
  revealWouldImposeFloating,
  type FloatingPanelPosition,
  type FloatingPanelSize,
} from '../hooks/useFloatingPanelState'
import { AIInputBar, type AIInputBarHandle } from './AIInputBar'
import { clearanceCandidates, COMFORT_OCCLUSION_GAP, type Box } from '../utils/cameraComfort'
import { registerFloatingFocus } from '../hooks/useFloatingFocus'
import { useUIStore } from '../../stores/uiStore'
import { isAiPanelV2Enabled } from '../../flags'
import { readPersistedActiveDockTab, readPersistedDockOpen } from './OutputsDock'
import { dockHostsOlumi, type OlumiDockTab } from './olumiSurface'
import {
  FLOATING_OLUMI_SIDE_TAB_WIDTH,
  requestFloatingOlumiSurface,
} from './panelComposition'

interface FloatingOlumiPanelProps {
  /** Called when the user clicks the Dock button. The host should switch the
   *  active tab to 'olumi' and ensure the dock is open. */
  onDock: () => void
  /** Called when the user clicks the cog icon in the floating composer. */
}

const MIN_WIDTH = 320
const MIN_HEIGHT = 300
const DEFAULT_MARGIN = 16
/** Side tab and drag handle dimensions. The side tab hosts minimise/dock
 *  controls at 32×32 hit areas to match the welcome-variant send/cog
 *  buttons elsewhere in the panel. The 36px column gives 2px breathing
 *  room around each button. Full 44×44 (WCAG strict touch target) would
 *  dominate the panel on smaller viewports; 32×32 is the established
 *  in-panel icon-button scale.
 *  The drag handle is a thin (6px) horizontal strip across the top. */
const SIDE_TAB_WIDTH = FLOATING_OLUMI_SIDE_TAB_WIDTH
const DRAG_HANDLE_HEIGHT = 6

/** V4 "one continuous shape" geometry: the floating panel and its top-left tab
 *  bump are drawn as ONE rounded outline so every corner shares a single radius
 *  (no pointed bottom-left) and the tab joins the body via concave fillets (no
 *  seam). SHAPE_RADIUS = convex corner radius; SHAPE_FILLET = concave join
 *  radius; the bump sits TAB_BUMP_TOP below the top, TAB_BUMP_HEIGHT tall. */
const SHAPE_RADIUS = 10
const SHAPE_FILLET = 9
const TAB_BUMP_TOP = 16
const TAB_BUMP_HEIGHT = 104

/** Build the SVG `d` for the panel+tab outline. The body occupies
 *  x in [tabW, tabW+panelW], y in [0, panelH]; the tab occupies x in [0, tabW],
 *  y in [tabTop, tabTop+tabH]. Exported for tests. */
export function buildPanelShapePath(
  panelW: number,
  panelH: number,
  tabW: number,
  tabTop: number,
  tabH: number,
  r: number,
  cf: number,
): string {
  const w = tabW + panelW
  const h = panelH
  const tb = tabTop + tabH
  return [
    `M ${tabW + r} 0`,
    `H ${w - r}`,
    `A ${r} ${r} 0 0 1 ${w} ${r}`,
    `V ${h - r}`,
    `A ${r} ${r} 0 0 1 ${w - r} ${h}`,
    `H ${tabW + r}`,
    `A ${r} ${r} 0 0 1 ${tabW} ${h - r}`,
    `V ${tb + cf}`,
    `A ${cf} ${cf} 0 0 0 ${tabW - cf} ${tb}`,
    `H ${r}`,
    `A ${r} ${r} 0 0 1 0 ${tb - r}`,
    `V ${tabTop + r}`,
    `A ${r} ${r} 0 0 1 ${r} ${tabTop}`,
    `H ${tabW - cf}`,
    `A ${cf} ${cf} 0 0 0 ${tabW} ${tabTop - cf}`,
    `V ${r}`,
    `A ${r} ${r} 0 0 1 ${tabW + r} 0`,
    'Z',
  ].join(' ')
}

/** Imperatively size the shape SVG + refresh its path to the current panel
 *  size. Called from the layout effect, the window-resize re-clamp, and the
 *  resize-drag rAF so the outline tracks the panel on every size path. */
function applyPanelShape(
  svg: SVGSVGElement | null,
  path: SVGPathElement | null,
  panelW: number,
  panelH: number,
): void {
  if (!svg || !path) return
  const totalW = SIDE_TAB_WIDTH + panelW
  svg.setAttribute('width', `${totalW}`)
  svg.setAttribute('height', `${panelH}`)
  svg.setAttribute('viewBox', `0 0 ${totalW} ${panelH}`)
  path.setAttribute(
    'd',
    buildPanelShapePath(panelW, panelH, SIDE_TAB_WIDTH, TAB_BUMP_TOP, TAB_BUMP_HEIGHT, SHAPE_RADIUS, SHAPE_FILLET),
  )
}

/** Which of the four corners is being dragged for resize. The compact side
 *  tab drives a top-left ('tl') resize; there are no other handle kinds. */
type ResizeCorner = 'tl' | 'tr' | 'bl' | 'br'

const noop = () => {}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min
  if (value > max) return max
  return value
}

/**
 * Absolute max size: the panel may grow to (nearly) the whole screen — the
 * full viewport minus edge margins and the side-tab column. The per-edge
 * caps in computeCornerResize further bound this at drag time by the dock
 * (right) and the top bar (top), so the panel keeps a minimal gap from the
 * surrounding chrome. (Previously hard-capped at 60% × 80%.)
 */
function computeMaxSize(viewportW: number, viewportH: number): FloatingPanelSize {
  return {
    width: Math.max(MIN_WIDTH, viewportW - 2 * DEFAULT_MARGIN - SIDE_TAB_WIDTH),
    height: Math.max(MIN_HEIGHT, viewportH - 2 * DEFAULT_MARGIN),
  }
}

function defaultCentredPosition(size: FloatingPanelSize, viewportW: number, viewportH: number): FloatingPanelPosition {
  return {
    x: Math.max(DEFAULT_MARGIN, Math.floor((viewportW - size.width) / 2)),
    y: Math.max(DEFAULT_MARGIN, Math.floor((viewportH - size.height) / 2)),
  }
}

/* ── FIT-THEN-PLACE ────────────────────────────────────────────────────────
 *
 * THE DEFECT (measured in real Chromium, 49 `elementFromPoint` probes per cell,
 * five committed starter drafts, 1200-1600px):
 *
 *   The user could not click the Decision node of their own model. The panel is
 *   a FIXED-SIZE, FIXED-ORIGIN window while the graph's fit box SCALES, so the
 *   two collide below a threshold at the panel's right edge. Decision-node
 *   hittable probes on the as-shipped placement: 1200 → 0/49 · 1250 → 0/49 ·
 *   1300 → 14 · 1350 → 28 · 1400 → 42 · clear only at ≥1450. The node's own hit
 *   area is correct — the SAME node in the SAME code is 49/49 at 1450 and 0/49
 *   at 1250, so this is placement, not hit-testing.
 *
 * THE RULE, and why it is this rule and not the obvious one.
 *
 * The obvious rule is "place the panel where it hides least of the model", and
 * IT DOES NOT WORK. Measured over 50 browser-captured geometry cells: minimising
 * overlap with the fitted node bbox leaves the Decision node partly buried in 7
 * of 50 cells even when solved EXHAUSTIVELY over every legal position (the best
 * possible such placement still scores 28/49 at 1250). Minimising total occluded
 * node area is worse (19/50); minimax per-node coverage is far worse (37/50).
 * They all fail the same way: a 400x550 panel plus its 36px tab is over half the
 * usable canvas at 1250, so SOME of the model is always hidden, and every
 * area-based objective happily trades the Decision away to hide less elsewhere.
 *
 * So the objective is LEXICOGRAPHIC, and its first term names what must never be
 * traded:
 *
 *   1. the panel must not cover the model's ANCHOR — the Decision node, the one
 *      node the whole graph is about, and the one the user must be able to click
 *      to steer their model;
 *   2. among placements that satisfy (1), hide as little of the rest of the
 *      model as possible.
 *
 * Measured: 50/50 cells at 49/49 hittable probes, worst cell included.
 *
 * ⭐ CANONICAL OWNER. The candidate placements are the four clearances of
 * `cameraComfort.clearanceCandidates` — the module that already owns "how do you
 * hold a frame clear of the floating companion" — read as TRANSLATIONS of the
 * panel rather than as insets on a frame. This adds NO second spelling of that
 * geometry, and it deliberately does not touch `computeFitPadding`, which still
 * reserves the companion exactly zero graph width (guard G2a). The panel moves;
 * the graph is never charged for it.
 *
 * ⚠ ALL FOUR CANDIDATES, NOT JUST `cheapestClearance`. The cheapest clearance is
 * frequently unreachable once `clampPositionToViewport` has had its say (the
 * panel cannot leave the canvas, cannot cross the dock, cannot ride under the top
 * bar), and a clamped-away move looks exactly like a move that was never needed.
 * Every candidate is therefore CLAMPED FIRST and scored AFTERWARDS, so the rule
 * chooses among placements that are actually reachable.
 */

/** Total area of the intersection of two boxes; 0 when they do not overlap. */
function overlapArea(a: Box, b: Box): number {
  const w = Math.min(a.right, b.right) - Math.max(a.left, b.left)
  const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
  return w > 0 && h > 0 ? w * h : 0
}

/**
 * The panel's OCCLUDING box for a candidate top-left.
 *
 * Includes the side tab, which is a sibling at `left: -SIDE_TAB_WIDTH` with the
 * panel `overflow: visible` — so it is NOT part of the panel's own
 * `getBoundingClientRect`. This is the same union
 * `cameraComfort.readFloatingCompanionBox` measures, for the same reason: omit it
 * and the box is 36px short of what the user sees.
 */
export function panelOccluderBox(pos: FloatingPanelPosition, size: FloatingPanelSize): Box {
  return {
    left: pos.x - SIDE_TAB_WIDTH,
    top: pos.y,
    right: pos.x + size.width,
    bottom: pos.y + size.height,
  }
}

/** What the placement rule needs to know about the model that is on screen. */
export interface ModelBoxes {
  /** Every rendered graph node's viewport-coordinate box. */
  nodes: Box[]
  /**
   * The box the placement must keep clear: the Decision node when the model has
   * one. `null` for a model with no decision (an imported or partial graph) — the
   * rule then degrades to term (2) alone, which is the best available when there
   * is no anchor to protect.
   */
  anchor: Box | null
}

/** React Flow renders each node as `.react-flow__node[data-id="<id>"]`
 *  (same spelling as `useGuidancePulseHighlight`). */
const GRAPH_NODE_SELECTOR = '.react-flow__node[data-id]'

/**
 * Read the model's on-screen boxes.
 *
 * ⚠ THE ANCHOR IS BOUND BY IDENTITY, NEVER BY POSITION (CLAUDE.md trap 19). The
 * caller passes the Decision node's STORE ID and this looks that exact node up in
 * the DOM; nothing here infers "the anchor" from where a box happens to sit, so a
 * different node cannot satisfy the lookup.
 *
 * Zero-size rects are dropped — an unmeasured or `display:none` node contributes
 * no occlusion and would otherwise drag the union to the origin.
 */
export function readModelBoxes(anchorNodeId: string | null): ModelBoxes {
  if (typeof document === 'undefined') return { nodes: [], anchor: null }
  const nodes: Box[] = []
  let anchor: Box | null = null
  for (const el of document.querySelectorAll(GRAPH_NODE_SELECTOR)) {
    const rect = el.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) continue
    const box: Box = { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }
    nodes.push(box)
    if (anchorNodeId !== null && (el as HTMLElement).dataset.id === anchorNodeId) anchor = box
  }
  return { nodes, anchor }
}

/** Union of every node box, or null when nothing is rendered. */
function unionOf(boxes: Box[]): Box | null {
  if (boxes.length === 0) return null
  return {
    left: Math.min(...boxes.map((b) => b.left)),
    top: Math.min(...boxes.map((b) => b.top)),
    right: Math.max(...boxes.map((b) => b.right)),
    bottom: Math.max(...boxes.map((b) => b.bottom)),
  }
}

/**
 * The panel's DEFAULT top-left: fit-then-place. See the FIT-THEN-PLACE block
 * above for the rule and the measurements behind it.
 *
 * Pure — the caller supplies the measured model — so the whole rule is testable
 * without a DOM, mirroring `cameraComfort.comfortInsets`.
 *
 * FAIL-OPEN TO TODAY'S BEHAVIOUR: with nothing rendered (`model.nodes` empty) this
 * returns exactly the clamped centred default it has always returned, so an empty
 * canvas, a pre-mount measurement and jsdom are all unchanged.
 *
 * This SUPERSEDES the bare centred default as the panel's default-placement
 * authority; `defaultCentredPosition` survives only as the base this starts from,
 * with this as its single call site.
 */
export function graphAwareDefaultPosition(
  size: FloatingPanelSize,
  viewportW: number,
  viewportH: number,
  rightInset: number,
  topInset: number,
  model: ModelBoxes,
): FloatingPanelPosition {
  const clampHere = (pos: FloatingPanelPosition) =>
    clampPositionToViewport(pos, size, viewportW, viewportH, rightInset, topInset)

  const base = clampHere(defaultCentredPosition(size, viewportW - rightInset, viewportH))
  if (model.nodes.length === 0) return base

  // The frame that must stay clear: the anchor when there is one, else the whole
  // model — see ModelBoxes.anchor for why the fallback is the honest one.
  const frame = model.anchor ?? unionOf(model.nodes)
  if (!frame) return base

  const candidates = clearanceCandidates(frame, panelOccluderBox(base, size))
  // `null` means the base placement already clears the frame — nothing to solve.
  if (!candidates) return base

  // Each clearance is taken WITH A BREATHING GAP, the same `COMFORT_OCCLUSION_GAP`
  // the comfort frame adds for the same reason — and here it also absorbs the
  // small vertical settle the graph makes after the layout store reports
  // quiescence (measured at ±13-21px between runs, pre-existing). A gap can only
  // move the panel FURTHER in the clearing direction and the clamp caps it, so it
  // can never reduce the clearance actually achieved.
  const placements: FloatingPanelPosition[] = [base]
  for (const c of candidates) {
    const step = c.amount + COMFORT_OCCLUSION_GAP
    placements.push(
      clampHere({
        x: base.x + (c.side === 'right' ? step : c.side === 'left' ? -step : 0),
        y: base.y + (c.side === 'bottom' ? step : c.side === 'top' ? -step : 0),
      }),
    )
  }

  // Lexicographic: anchor coverage first, then how much of the rest of the model
  // is hidden. `Number.MAX_SAFE_INTEGER` is never reached — both terms are
  // bounded by the viewport area — so the pair cannot alias.
  const score = (pos: FloatingPanelPosition): [number, number] => {
    const occ = panelOccluderBox(pos, size)
    const anchorCover = overlapArea(frame, occ)
    let modelCover = 0
    for (const node of model.nodes) modelCover += overlapArea(node, occ)
    return [anchorCover, modelCover]
  }

  let best = placements[0]
  let bestScore = score(best)
  for (const pos of placements) {
    const s = score(pos)
    if (s[0] < bestScore[0] || (s[0] === bestScore[0] && s[1] < bestScore[1])) {
      best = pos
      bestScore = s
    }
  }
  return best
}

/**
 * Clamp a candidate position into the visible canvas area so the panel
 * never sits partially (or fully) off-screen AND never lands under the
 * OutputsDock (z-900, would obscure the floating panel at z-300).
 *
 * `rightInset` reserves space from the viewport's right edge inward —
 * callers pass the dock's measured offset (see `measureDockInset`). It
 * captures both the dock's width and any right-edge gap so the floating
 * panel cannot land in the strip between the dock and the viewport edge.
 *
 * Round-10: the floating panel renders a side tab OUTSIDE its left edge
 * (positioned at `left: -SIDE_TAB_WIDTH`). The minimum x is therefore
 * `DEFAULT_MARGIN + SIDE_TAB_WIDTH` rather than just `DEFAULT_MARGIN`,
 * so the side tab stays fully on-screen regardless of drag position.
 */
export function clampPositionToViewport(
  pos: FloatingPanelPosition,
  size: FloatingPanelSize,
  viewportW: number,
  viewportH: number,
  rightInset: number = 0,
  topInset: number = DEFAULT_MARGIN,
): FloatingPanelPosition {
  const xMin = DEFAULT_MARGIN + SIDE_TAB_WIDTH
  const maxX = Math.max(xMin, viewportW - size.width - DEFAULT_MARGIN - rightInset)
  const yMin = Math.max(DEFAULT_MARGIN, topInset)
  return {
    x: clamp(pos.x, xMin, maxX),
    y: clamp(pos.y, yMin, Math.max(yMin, viewportH - size.height - DEFAULT_MARGIN)),
  }
}

const PILL_W = 84
const PILL_H = 28
/**
 * Compute the maximum size a panel may grow to during a bottom-right
 * resize drag, given the current top-left position and dock inset. The
 * panel's x/y do not move during resize, so the right edge of the panel
 * cannot extend past `vw - dockInset - DEFAULT_MARGIN`.
 *
 * Returns raw geometry only (floored at 0). Callers compose this with
 * `MIN_WIDTH` / `MIN_HEIGHT`. See `fitsAtMinSize` — when the available
 * space is smaller than MIN, the safe UX is to auto-minimise to the
 * restore pill rather than render a too-narrow panel.
 */
export function computeResizeBudget(
  x: number,
  y: number,
  viewportW: number,
  viewportH: number,
  rightInset: number = 0,
): { widthBudget: number; heightBudget: number } {
  return {
    widthBudget: Math.max(0, viewportW - x - DEFAULT_MARGIN - rightInset),
    heightBudget: Math.max(0, viewportH - y - DEFAULT_MARGIN),
  }
}

/**
 * Returns true when the available canvas (viewport minus dock inset and
 * margins on both sides) can fit a panel at MIN_WIDTH × MIN_HEIGHT.
 * When false, the panel should auto-minimise to the pill — rendering at
 * a sub-MIN_WIDTH size would be unusable.
 */
export function fitsAtMinSize(
  viewportW: number,
  viewportH: number,
  rightInset: number = 0,
): boolean {
  // Round-10: the side tab lives OUTSIDE the panel's left edge, so the
  // panel needs SIDE_TAB_WIDTH extra horizontal room beyond MIN_WIDTH.
  const availableW = viewportW - 2 * DEFAULT_MARGIN - SIDE_TAB_WIDTH - rightInset
  const availableH = viewportH - 2 * DEFAULT_MARGIN
  return availableW >= MIN_WIDTH && availableH >= MIN_HEIGHT
}

/**
 * Per-corner resize geometry. Given the drag start state (pre-pointerdown
 * panel rect), the pointer delta, the viewport and dock inset, returns the
 * panel's new x/y/w/h with all clamps applied (MIN_WIDTH/MIN_HEIGHT floor,
 * computeMaxSize cap, dock-aware right-edge cap, margin floor on every
 * edge). Pure function — easy to unit test and reuses the same constants
 * the BR resize path has used since rounds 1-2.
 *
 * The corner being dragged is the FREE corner; the opposite corner stays
 * fixed. For TL/TR/BL the panel's x and/or y shift so that the opposite
 * corner remains at its starting screen coordinate while w/h grow or shrink.
 */
export function computeCornerResize(
  corner: ResizeCorner,
  startLeft: number,
  startTop: number,
  startW: number,
  startH: number,
  dx: number,
  dy: number,
  viewportW: number,
  viewportH: number,
  rightInset: number = 0,
  topInset: number = DEFAULT_MARGIN,
): { x: number; y: number; w: number; h: number } {
  const max = computeMaxSize(viewportW, viewportH)
  const fixedRight = startLeft + startW
  const fixedBottom = startTop + startH

  // Width cap depends on which side is fixed. When the LEFT edge stays put
  // (BR/TR drags), the right edge can grow to the dock-aware boundary.
  // When the RIGHT edge stays put (BL/TL drags), the left edge can shrink
  // to the viewport margin.
  const wRoomFromLeftFixed = Math.max(0, viewportW - startLeft - DEFAULT_MARGIN - rightInset)
  // Round-10: the side tab lives OUTSIDE the panel's left edge. When the
  // RIGHT edge is fixed (BL/TL resize) and the panel is growing leftward,
  // the maximum width is bounded by viewport margin + side-tab width.
  const wRoomFromRightFixed = Math.max(0, fixedRight - DEFAULT_MARGIN - SIDE_TAB_WIDTH)
  const maxW = (corner === 'br' || corner === 'tr') ? wRoomFromLeftFixed : wRoomFromRightFixed

  const hRoomFromTopFixed = Math.max(0, viewportH - startTop - DEFAULT_MARGIN)
  // Top edge growing upward (TL/TR) must stop below the top bar, not just at
  // the viewport margin — keeps a gap from the top menu.
  const hRoomFromBottomFixed = Math.max(0, fixedBottom - Math.max(DEFAULT_MARGIN, topInset))
  const maxH = (corner === 'br' || corner === 'bl') ? hRoomFromTopFixed : hRoomFromBottomFixed

  // Target dimensions from the pointer delta. Sign flips when the dragged
  // corner is on the opposite side from the fixed corner.
  const wTarget = (corner === 'br' || corner === 'tr') ? startW + dx : startW - dx
  const hTarget = (corner === 'br' || corner === 'bl') ? startH + dy : startH - dy

  const w = Math.max(MIN_WIDTH, Math.min(max.width, maxW, wTarget))
  const h = Math.max(MIN_HEIGHT, Math.min(max.height, maxH, hTarget))

  // Place the panel so the FIXED corner stays put. Derive x/y from the
  // fixed corner's coordinates and the new width/height.
  const x = (corner === 'br' || corner === 'tr') ? startLeft : fixedRight - w
  const y = (corner === 'br' || corner === 'bl') ? startTop : fixedBottom - h
  return { x, y, w, h }
}

/**
 * The restore pill's permanent dock: the bottom-right corner of the visible
 * canvas, clear of the OutputsDock.
 *
 * R3 (Paul, 16 Aug 2026): "the Olumi bubble docks to a fixed corner
 * (bottom-right); never mid-canvas."
 *
 * Why a DERIVED corner and not a stored position. The pill used to render at
 * the PANEL's stored top-left. On the post-draft auto-minimise that anchor is
 * the top-left of a 400×550 panel — so on a 1280×800 viewport the 84×28 pill
 * landed at roughly (808, 234): a third of the way down the canvas, over the
 * graph, exactly as captured in Paul's manual test (S17). Two further paths
 * reached the same class of defect: the first-open auto-minimise committed a
 * TOP-left anchor, and a null position fell back to `left: 50%, top: 50%` —
 * the dead centre of the viewport.
 *
 * The pill is not draggable, so its position is never a user choice. Deriving
 * it from the live viewport on every render makes "pill mid-canvas"
 * structurally impossible rather than merely unlikely, and leaves the stored
 * `position` free to do its real job: remembering where the PANEL goes back to
 * on restore.
 */
export function computePillDockPosition(
  viewportW: number,
  viewportH: number,
  rightInset: number = 0,
): FloatingPanelPosition {
  return {
    x: Math.max(DEFAULT_MARGIN, viewportW - rightInset - PILL_W - DEFAULT_MARGIN),
    y: Math.max(DEFAULT_MARGIN, viewportH - PILL_H - DEFAULT_MARGIN),
  }
}

export function clampPillPositionToViewport(
  pos: FloatingPanelPosition,
  viewportW: number,
  viewportH: number,
  rightInset: number = 0,
): FloatingPanelPosition {
  const maxX = Math.max(DEFAULT_MARGIN, viewportW - PILL_W - DEFAULT_MARGIN - rightInset)
  return {
    x: clamp(pos.x, DEFAULT_MARGIN, maxX),
    y: clamp(pos.y, DEFAULT_MARGIN, Math.max(DEFAULT_MARGIN, viewportH - PILL_H - DEFAULT_MARGIN)),
  }
}

/**
 * Compute the reserved area at the right edge for the OutputsDock —
 * `vw - dock.left` captures the dock's width AND any right-edge gap
 * (e.g. `right: 12px`). The OutputsDock is the only element in the app
 * with this aria-label, so the selector is unambiguous.
 *
 * Returns 0 when the dock element is absent (FF-off path) or has zero
 * size (defensive — e.g. hidden via CSS). No half-viewport guard:
 * narrow viewports legitimately place a right-anchored dock with
 * `dock.left < vw/2`, and the inset must still be reserved so the
 * floating panel doesn't drift under it.
 */
export function measureDockInset(): number {
  if (typeof document === 'undefined' || typeof window === 'undefined') return 0
  const dock = document.querySelector('aside[aria-label="Outputs dock"]') as HTMLElement | null
  if (!dock) return 0
  const rect = dock.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return 0
  const inset = window.innerWidth - rect.left
  return inset > 0 ? inset : 0
}

/**
 * Top inset the panel must clear so it keeps a small gap below the app's
 * TopBar. Reads the `--topbar-h` CSS variable (set by TopBar; `0px` when no
 * fixed top bar). Returns the bar height + a margin, or DEFAULT_MARGIN when
 * there is no top bar. Mirrors measureDockInset for the top edge.
 */
export function measureTopInset(): number {
  if (typeof document === 'undefined' || typeof window === 'undefined') return DEFAULT_MARGIN
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--topbar-h')
  const h = parseFloat(raw) || 0
  return h > 0 ? h + DEFAULT_MARGIN : DEFAULT_MARGIN
}

/**
 * FloatingOlumiPanel — portaled draggable/resizable Olumi conversation window.
 *
 * Performance: pointer-move handlers update the panel's CSS via direct style
 * writes on the underlying DOM ref (NOT React state) and coalesce into one
 * rAF tick per frame. The Zustand store is updated only on pointerup so we
 * never re-render the React tree during a drag/resize. This keeps drags at
 * 60fps even with hundreds of conversation messages mounted.
 *
 * Portals to document.body to escape React Flow's CSS transforms — inside a
 * transformed ancestor, `position: fixed` is relative to that ancestor and
 * breaks alignment.
 *
 * Z-index: 300. Below popovers (400) and modals so a CogPopover or modal
 * stays on top.
 */
export const FloatingOlumiPanel = memo(function FloatingOlumiPanel({ onDock }: FloatingOlumiPanelProps) {
  const conversation = useConversationContext()
  // Subscribe to primitive slices to avoid re-render churn (returning a new
  // object from a selector breaks Zustand's referential equality check).
  const isOpen = useFloatingPanelState((s) => s.isOpen)
  const isMinimised = useFloatingPanelState((s) => s.isMinimised)
  const source = useFloatingPanelState((s) => s.source)
  // Subscribed (not read via getState) because the focus-channel registration
  // below branches on it: a getState read would not re-run the effect when the
  // user drags the panel, and the channel would stay deregistered after the
  // drag made it a user-owned surface again.
  const userRepositioned = useFloatingPanelState((s) => s.userRepositioned)
  // The pill-restore ownership fact. Subscribed for the same reason as
  // `userRepositioned`: the focus-channel registration branches on it.
  const userChoseFloating = useFloatingPanelState((s) => s.userChoseFloating)
  const position = useFloatingPanelState((s) => s.position)
  const size = useFloatingPanelState((s) => s.size)
  const setPosition = useFloatingPanelState((s) => s.setPosition)
  const setInitialPosition = useFloatingPanelState((s) => s.setInitialPosition)
  const setSize = useFloatingPanelState((s) => s.setSize)
  const close = useFloatingPanelState((s) => s.close)
  const minimise = useFloatingPanelState((s) => s.minimise)
  const restoreByUser = useFloatingPanelState((s) => s.restoreByUser)
  // First-use composer takes over rendering whenever the canvas is empty AND
  // the panel was opened by the system (initial first-use OR re-opened on a
  // canvas reset). This includes the post-submit / pre-graph window so the
  // hero doesn't blink out and the user doesn't see the panel jump to the
  // top-left while generation is in flight.
  const nodeCount = useCanvasStore((s) => s.nodes.length)
  const yieldToFirstUse = source === 'system-first-use' && nodeCount === 0

  // FIT-THEN-PLACE inputs. Both selectors return a PRIMITIVE so Zustand's
  // referential-equality check keeps them from re-rendering the panel on every
  // store write (returning a derived object here would churn on every tick).
  //
  // `anchorNodeId` is the Decision node's store id — the identity the placement
  // rule binds to. `layoutSettled` is the canvas store's OWN definition of
  // quiescence (the same three fields the visual harness waits on), not a timer
  // and not a guess: node rects are only worth measuring once the layout that
  // produced them has committed.
  const anchorNodeId = useCanvasStore((s) => s.nodes.find((n) => n.type === 'decision')?.id ?? null)
  const layoutSettled = useCanvasStore((s) => !s.pendingLayout && !s.layoutInProgress && s.layoutVersion > 0)

  // Render-time duplicate-surface guard. If AI Panel v2 is on AND the docked
  // Olumi tab is the active right-panel surface, the floating panel must
  // NOT paint — even for a single frame. OutputsDockBody's useEffect closes
  // the floating panel in this state (steady-state convergence), but the
  // effect runs after first paint.
  //
  // OutputsDock and useUIStore can disagree on the first paint: OutputsDock
  // restores `state.activeTab` from sessionStorage synchronously while
  // useUIStore.activeOutputTab is still the default 'results' until the
  // E1 sync effect runs (post-paint). Reading the persisted dock state
  // synchronously here aligns the yield gate with whatever OutputsDock is
  // about to paint. Falls back to useUIStore when no persisted state.
  const activeOutputTab = useUIStore((s) => s.activeOutputTab)
  const persistedDockTab = readPersistedActiveDockTab()
  const effectiveDockTab = persistedDockTab ?? activeOutputTab
  // Yield to the docked Olumi composer ONLY when it can actually be on screen
  // (dockHostsOlumi) — otherwise suppressing this surface would strand the user.
  // On an empty canvas the dock is always the collapsed first-use rail, so it
  // never hosts the composer. On a populated canvas the persisted isOpen
  // reflects the real open state (the rail override applies only to the empty
  // canvas); default true to match the dock's own default before anything is
  // persisted. Mirrors OutputsDock's close-effect — both derive from olumiSurface.ts.
  //
  // Caveat (tracked follow-up): this is a render-time sessionStorage READ, not a
  // live subscription, so a dock open/close that happens WHILE this panel stays
  // open won't re-render it until some other subscribed value does. All current
  // reachable flows re-render via `activeOutputTab` / nodeCount changes, so it's
  // not a live bug; a future path that mutates dock-open in isolation would need
  // the dock's open state lifted into a subscribable store.
  const dockEffectiveOpen = nodeCount > 0 ? (readPersistedDockOpen() ?? true) : false
  const yieldToDockedOlumi =
    isAiPanelV2Enabled() &&
    dockHostsOlumi({ dockEffectiveOpen, dockTab: effectiveDockTab as OlumiDockTab })

  // Post-graph auto-reposition: when FirstUseComposer commits the bottom-right
  // anchor, it flags `isAutoRepositioning` so the panel applies a scoped CSS
  // slide on left/top. The clearing timeout lives in the OWNER
  // (FirstUseComposer.performReposition) rather than here — if it lived in
  // a mounted effect on this panel, a yield/unmount during the transition
  // window would strand the flag at `true` and the next mount would
  // erroneously animate its initial position write.
  const isAutoRepositioning = useFloatingPanelState((s) => s.isAutoRepositioning)

  const containerRef = useRef<HTMLDivElement | null>(null)
  const shapeRef = useRef<SVGSVGElement | null>(null)
  const pathRef = useRef<SVGPathElement | null>(null)
  const inputBarRef = useRef<AIInputBarHandle | null>(null)
  const rafRef = useRef<number | null>(null)
  const dragStateRef = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null)
  // The pill's derived corner dock, cached so the resize/dock observer can
  // tell a real move from a no-op attach (see the minimised branch below).
  const pillDockRef = useRef<FloatingPanelPosition | null>(null)
  const [, setPillDockTick] = useState(0)

  // Resize state tracks which corner is being dragged plus the panel's
  // starting position/size. Pre-rounds-3 BR-only resize stored just
  // startX/startY/startW/startH; with all-corner resize we also need the
  // start left/top so the fixed (opposite) corner can stay put.
  const resizeStateRef = useRef<{
    pointerId: number
    corner: ResizeCorner
    startX: number
    startY: number
    startLeft: number
    startTop: number
    startW: number
    startH: number
  } | null>(null)

  // Apply position/size to DOM whenever isOpen flips to true OR the store
  // commits a new value (drag/resize end). During drag/resize this is bypassed
  // — handlers write directly to el.style.
  //
  // `isMinimised` is in the deps so this effect re-runs when restoring from
  // the pill: while minimised, the full panel isn't rendered (containerRef is
  // null) so the previous DOM-write is lost; on restore the panel remounts
  // with the JSX default styles (0, 0, 400, 500) and we need to reapply the
  // stored position/size or the user sees the panel jump back to default.
  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el || !isOpen || isMinimised) return
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1200
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800
    const dockInset = measureDockInset()
    // If the dock + margins leave less room than MIN_WIDTH × MIN_HEIGHT,
    // auto-minimise to the pill instead of rendering an unusably narrow
    // panel. User can close the dock to restore. This preserves the
    // brief's "MIN_WIDTH whenever possible, otherwise minimise" rule.
    if (!fitsAtMinSize(vw, vh, dockInset)) {
      // The pill's own placement needs nothing from us any more: it is
      // corner-docked and derived at render time (computePillDockPosition),
      // so the old "commit a safe top-left anchor before minimising" step —
      // which existed only to dodge a `left: 50%` fallback that no longer
      // exists — is gone. `position` stays whatever it was, because it is now
      // purely the PANEL's restore memory.
      minimise()
      return
    }
    const max = computeMaxSize(vw, vh)
    // Cap width/height at the available canvas (viewport − margins − dock
    // inset − side-tab width) so a stored size that exceeds the current
    // canvas shrinks to fit instead of overlapping the dock or pushing
    // the side tab off-screen. `fitsAtMinSize` above guarantees the cap
    // is ≥ MIN_WIDTH × MIN_HEIGHT (so the clamp floor is always reachable).
    const availableW = vw - 2 * DEFAULT_MARGIN - SIDE_TAB_WIDTH - dockInset
    const availableH = vh - 2 * DEFAULT_MARGIN
    const w = clamp(size.width, MIN_WIDTH, Math.min(max.width, availableW))
    const h = clamp(size.height, MIN_HEIGHT, Math.min(max.height, availableH))
    // Restored / stored positions can land outside the visible canvas when
    // the window has shrunk OR when the OutputsDock is open. Clamp so the
    // header is always visible, grabbable, and not under the dock. Mirrors
    // handlePointerMove's drag-time clamp so the same bounds apply across
    // entry points.
    const topInset = measureTopInset()
    // FIT-THEN-PLACE: the DEFAULT placement is taken off the model (see the
    // block above `graphAwareDefaultPosition`). A STORED position is never
    // touched — a panel the user dragged stays exactly where they put it.
    const model = readModelBoxes(anchorNodeId)
    const rawPos =
      position ?? graphAwareDefaultPosition({ width: w, height: h }, vw, vh, dockInset, topInset, model)
    const pos = clampPositionToViewport(rawPos, { width: w, height: h }, vw, vh, dockInset, topInset)
    // Apply the slide transition INLINE (not via React style prop) so the
    // browser sees: old el.style.left value → transition declaration → new
    // el.style.left value, animating between them. Setting it on the React
    // style prop would race with the layout effect's direct el.style writes.
    // Only active during the post-graph auto-reposition window — drag/resize
    // never trip this branch because they don't flip `isAutoRepositioning`.
    el.style.transition = isAutoRepositioning ? 'left 300ms ease, top 300ms ease' : 'none'
    el.style.width = `${w}px`
    el.style.height = `${h}px`
    el.style.left = `${pos.x}px`
    el.style.top = `${pos.y}px`
    applyPanelShape(shapeRef.current, pathRef.current, w, h)
    // Commit the computed default the FIRST time the panel opens so the store
    // and the DOM agree about where the panel is. Stored-position clamping is
    // reapplied on every render via this same effect, so we don't need to write
    // back — the DOM is always correct.
    //
    // ⚠ NOT WHILE THE MODEL IS STILL SETTLING. `setInitialPosition` is a
    // ONE-SHOT (it writes only while `position` is null), so committing a
    // placement measured against half-laid-out node rects would freeze the panel
    // at a position computed from geometry that no longer exists. Until the
    // canvas store reports quiescence AND something is actually rendered, the
    // placement is applied to the DOM but left uncommitted, so this effect
    // re-derives it on the next tick. An empty canvas has no model to settle and
    // commits immediately, exactly as before.
    if (position === null && (nodeCount === 0 || (layoutSettled && model.nodes.length > 0))) {
      setInitialPosition(pos)
    }
    // ⭐⭐ `yieldToFirstUse` / `yieldToDockedOlumi` / `nodeCount` / `layoutSettled`
    // ARE LOAD-BEARING DEPS, AND THEIR ABSENCE WAS A SECOND, SEPARATE DEFECT
    // (measured 19 Aug 2026). This component returns null — so `containerRef` is
    // null and this effect early-returns — for exactly `!isOpen ||
    // yieldToFirstUse || yieldToDockedOlumi`. Only `isOpen` was in the deps. So
    // on the path every seeded user reaches (hero yields once the first graph
    // lands) the container MOUNTED WITHOUT THIS EFFECT EVER RE-RUNNING: the panel
    // kept the JSX defaults `left: 0; top: 0`, `setInitialPosition` was never
    // called, and the re-clamp handler below then read that empty style as 0 and
    // pinned the panel to the clamp floor. Measured: DOM `left: 52px; top: 73px`,
    // BYTE-IDENTICAL FROM 1024 TO 1920, while the store still said
    // `position: null` and the design default for that state was x=226. Two
    // authorities for one fact, and the one that won had computed nothing.
    // Listing every condition the early return reads makes container-mount and
    // effect-run the same event by construction.
  }, [
    isOpen,
    isMinimised,
    position,
    size,
    isAutoRepositioning,
    setInitialPosition,
    minimise,
    yieldToFirstUse,
    yieldToDockedOlumi,
    nodeCount,
    layoutSettled,
    anchorNodeId,
  ])

  // Register a focus channel so the persistent status strip and Olumi-tab
  // click (when floating is open) can imperatively focus the input.
  //
  // - Skip when yielding to FirstUseComposer — that surface owns its own
  //   registration so focus lands in its textarea (otherwise our input ref
  //   would be null because the JSX below never mounts in yield mode).
  // - When the panel is minimised the input is unmounted; restore first and
  //   schedule the focus on the next frame so React can remount before we
  //   call .focus() on the ref.
  //
  // ⭐⭐ AND SKIP WHEN REGISTERING WOULD MAKE THIS CHANNEL LIE (19 Aug 2026 —
  // UX gate 7a). `revealOlumi`'s doctrine reads this registration as the
  // surface's OWN STATEMENT THAT IT IS VISIBLE: *"Both floating surfaces
  // register their focus channel under exactly the condition that makes them
  // paint."* That sentence was FALSE for one state, and the false case was the
  // one every fresh user reaches. A minimised panel is mounted at
  // `display: none` with `isOpen` still true, so it registered — and its
  // handler then CREATED the surface by calling `restore()`. The reveal
  // primitive asked "is there a floating surface the user already has?", got
  // "yes" from a pill, and put a 400x550 window over the model. Trap 21 exactly:
  // a channel that answers "can I take focus?" read as "am I on screen?".
  //
  // So a MINIMISED panel the user never chose does not register, `focusFloating()`
  // returns false, and `revealOlumiSurface` claims the DOCK — the same end state
  // as the `Dock to panel` control, which the gate measured taking hidden graph
  // area 40% → 0% and obscured nodes 9 → 1 at 1280x800.
  //
  // The predicate is `revealWouldImposeFloating`, defined once beside
  // `canAutoDock`; a minimised panel the user OPENED, MOVED or RESTORED FROM
  // THE PILL is excluded and still restores here, and the restore branch below
  // stays for exactly that. (The pill case is the ninth cell the first version
  // of this change missed — `restore()` confers no ownership, so the pill now
  // calls `restoreByUser`.)
  // The empty-canvas hero is untouched BY CONSTRUCTION rather than by a second
  // rule: `registerFloatingFocus` is a single module slot and `yieldToFirstUse`
  // already hands it to `FirstUseComposer` there, so no node count is consulted
  // and the "never strand the user with zero composers" invariant cannot move.
  useEffect(() => {
    if (!isOpen || yieldToFirstUse || yieldToDockedOlumi) return
    // ⚠ FLAG-GATED, exactly as `yieldToDockedOlumi` above is. Routing this cell
    // to the dock is only honest when the dock CAN host Olumi, and that is
    // `isAiPanelV2Enabled()`: with the flag OFF, `OutputsDock` redirects tab
    // `olumi` -> `results`, so an unconditional guard would deregister the
    // channel while nothing else can take it — `focusFloating()` false, the
    // dock branch skipped, and `revealOlumiSurface()` returning false having
    // fronted NOTHING. `VITE_FEATURE_AI_PANEL_V2` is set only under
    // `[context.staging.environment]`, so that is production and every
    // rollback posture. Not staging-reachable; it would silently disable the
    // documented rollback lever. The twin test pins the flag-OFF direction.
    if (isAiPanelV2Enabled() && revealWouldImposeFloating({ isMinimised, source, userRepositioned, userChoseFloating })) return
    return registerFloatingFocus(() => {
      const state = useFloatingPanelState.getState()
      if (state.isMinimised) {
        requestFloatingOlumiSurface(() => {
          state.restore()
          requestAnimationFrame(() => inputBarRef.current?.focus())
        })
      } else {
        inputBarRef.current?.focus()
      }
    })
  }, [isOpen, isMinimised, source, userRepositioned, userChoseFloating, yieldToFirstUse, yieldToDockedOlumi])

  // Clamp on viewport resize AND on dock resize/open/close so the panel
  // never leaves the visible area and never lands under the dock. The
  // ResizeObserver watches the dock element: it fires when the dock
  // mounts, unmounts (via the cleanup re-evaluation pass), expands, or
  // collapses to its rail width. Without this, a panel placed when the
  // dock was closed would be stranded under the dock when the user opens
  // it, since the layout effect's deps don't include dock state.
  useEffect(() => {
    if (!isOpen) return
    const handle = () => {
      const fp = useFloatingPanelState.getState()
      if (!fp.isOpen) return
      const vw = window.innerWidth
      const vh = window.innerHeight
      const dockInset = measureDockInset()

      // Minimised path: the full panel isn't rendered (containerRef is null)
      // but the corner-docked pill is, and its dock is derived from the live
      // viewport + dock inset at render time. So there is nothing to clamp —
      // we only need to force a re-render when the corner has actually MOVED
      // (viewport resize, dock expand/collapse). The equality guard matters:
      // the dock ResizeObserver fires on observe(), so an unconditional bump
      // would re-render on every attach. The panel's stored `position` is
      // deliberately left alone — it is the PANEL's restore memory, and the
      // layout effect re-clamps it on restore.
      if (fp.isMinimised) {
        const next = computePillDockPosition(vw, vh, dockInset)
        const prev = pillDockRef.current
        if (!prev || prev.x !== next.x || prev.y !== next.y) {
          pillDockRef.current = next
          setPillDockTick((t) => t + 1)
        }
        return
      }

      const el = containerRef.current
      if (!el) return
      // ⭐ ONE PLACEMENT AUTHORITY. This handler RE-CLAMPS a panel the layout
      // effect has already placed; it must never INVENT a placement. Without
      // this guard it read an unset `el.style.left` as `parseFloat('') || 0` →
      // 0 → clamped to the floor, which is how the panel came to sit at a
      // byte-identical (52, 73) at every viewport from 1024 to 1920 while the
      // store still held `position: null` (see the layout effect's dep note).
      // An unset style means the layout effect has not run yet, and the correct
      // answer to that is to wait for it, not to guess.
      if (!el.style.left || !el.style.top) return
      // Same MIN_WIDTH-or-minimise rule as the layout effect: if the
      // viewport-or-dock resize leaves no room for a MIN_WIDTH panel,
      // auto-minimise to the pill.
      if (!fitsAtMinSize(vw, vh, dockInset)) {
        useFloatingPanelState.getState().minimise()
        return
      }
      const max = computeMaxSize(vw, vh)
      // Mirror the layout effect's cap: when the available canvas
      // shrinks (viewport resize or dock expand), width/height must
      // shrink to fit. `fitsAtMinSize` above guarantees the cap is
      // ≥ MIN_WIDTH × MIN_HEIGHT.
      const availableW = vw - 2 * DEFAULT_MARGIN - SIDE_TAB_WIDTH - dockInset
      const availableH = vh - 2 * DEFAULT_MARGIN
      const w = clamp(parseFloat(el.style.width || '0') || size.width, MIN_WIDTH, Math.min(max.width, availableW))
      const h = clamp(parseFloat(el.style.height || '0') || size.height, MIN_HEIGHT, Math.min(max.height, availableH))
      // Round-10: xMin includes SIDE_TAB_WIDTH so the side tab (positioned
      // at left:-SIDE_TAB_WIDTH relative to the panel) stays on-screen.
      const xMin = DEFAULT_MARGIN + SIDE_TAB_WIDTH
      // Keep the panel below the top bar on window resize too (mirrors the
      // drag clamp + clampPositionToViewport). topInset defaults to
      // DEFAULT_MARGIN when there is no top bar, so behaviour is unchanged then.
      const topInset = measureTopInset()
      const x = clamp(parseFloat(el.style.left || '0'), xMin, Math.max(xMin, vw - w - DEFAULT_MARGIN - dockInset))
      const y = clamp(parseFloat(el.style.top || '0'), topInset, Math.max(topInset, vh - h - DEFAULT_MARGIN))
      el.style.width = `${w}px`
      el.style.height = `${h}px`
      el.style.left = `${x}px`
      el.style.top = `${y}px`
      applyPanelShape(shapeRef.current, pathRef.current, w, h)
    }
    window.addEventListener('resize', handle)
    // Track the dock element across mounts/unmounts so we re-clamp when
    // it appears, expands (rail → full), or collapses (full → rail).
    let dockObs: ResizeObserver | null = null
    let dockEl: Element | null = null
    const watchDock = () => {
      const next = typeof document !== 'undefined'
        ? document.querySelector('aside[aria-label="Outputs dock"]')
        : null
      if (next === dockEl) return
      if (dockObs && dockEl) dockObs.unobserve(dockEl)
      dockEl = next
      if (next && dockObs) dockObs.observe(next)
    }
    if (typeof ResizeObserver !== 'undefined') {
      dockObs = new ResizeObserver(handle)
      watchDock()
    }
    // Re-evaluate the watched element shortly after mount in case the
    // dock renders asynchronously (CSR boot, conditional rendering).
    const mountCheckId = typeof window !== 'undefined' ? window.setTimeout(watchDock, 100) : 0
    // The dock dispatches this event on tab clicks; piggy-back to also
    // recheck whether the watched element has changed.
    const onDockOpened = () => { watchDock(); handle() }
    window.addEventListener('outputs-dock-opened', onDockOpened)
    return () => {
      window.removeEventListener('resize', handle)
      window.removeEventListener('outputs-dock-opened', onDockOpened)
      if (mountCheckId) window.clearTimeout(mountCheckId)
      if (dockObs) dockObs.disconnect()
    }
  }, [isOpen, size])

  // Pointer-driven drag from the header bar.
  const handleHeaderPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    // Ignore drags initiated from header buttons.
    if ((e.target as HTMLElement).closest('button')) return
    const el = containerRef.current
    if (!el) return
    e.preventDefault()
    const rect = el.getBoundingClientRect()
    dragStateRef.current = {
      pointerId: e.pointerId,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
    }
    try {
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    } catch {
      // Some test envs don't implement pointer capture — fall back to window listeners.
    }
  }, [])

  const handlePointerMove = useCallback((e: PointerEvent) => {
    const el = containerRef.current
    if (!el) return
    const drag = dragStateRef.current
    const resize = resizeStateRef.current
    if (!drag && !resize) return

    // Coalesce all pointer-move work into one rAF tick.
    if (rafRef.current !== null) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      const vw = window.innerWidth
      const vh = window.innerHeight
      const dockInset = measureDockInset()
      const topInset = measureTopInset()
      const max = computeMaxSize(vw, vh)

      if (drag) {
        const w = parseFloat(el.style.width || '400')
        const h = parseFloat(el.style.height || '550')
        const xMin = DEFAULT_MARGIN + SIDE_TAB_WIDTH
        const x = clamp(e.clientX - drag.offsetX, xMin, Math.max(xMin, vw - w - DEFAULT_MARGIN - dockInset))
        const y = clamp(e.clientY - drag.offsetY, topInset, Math.max(topInset, vh - h - DEFAULT_MARGIN))
        el.style.left = `${x}px`
        el.style.top = `${y}px`
      } else if (resize) {
        // If the dock leaves no room for a MIN_WIDTH × MIN_HEIGHT panel,
        // auto-minimise instead of rendering a too-narrow surface. Cancel
        // the in-flight resize so pointerup doesn't commit a bad size.
        if (!fitsAtMinSize(vw, vh, dockInset)) {
          resizeStateRef.current = null
          useFloatingPanelState.getState().minimise()
          return
        }
        const dx = e.clientX - resize.startX
        const dy = e.clientY - resize.startY
        // Per-corner resize: the opposite corner stays fixed at its
        // starting screen coordinate; the dragged corner's pointer delta
        // drives the new width/height. computeCornerResize composes all
        // clamps (MIN floor, computeMaxSize cap, dock-aware right-edge
        // cap, margin floor) the same way the BR-only path did.
        // `max` is read inside computeCornerResize (it shadows our local
        // `max` here, which is fine — both call computeMaxSize on the
        // same inputs).
        void max
        const next = computeCornerResize(
          resize.corner,
          resize.startLeft,
          resize.startTop,
          resize.startW,
          resize.startH,
          dx,
          dy,
          vw,
          vh,
          dockInset,
          topInset,
        )
        el.style.width = `${next.w}px`
        el.style.height = `${next.h}px`
        el.style.left = `${next.x}px`
        el.style.top = `${next.y}px`
        applyPanelShape(shapeRef.current, pathRef.current, next.w, next.h)
      }
    })
  }, [])

  const handlePointerUp = useCallback((e: PointerEvent) => {
    const el = containerRef.current
    const drag = dragStateRef.current
    const resize = resizeStateRef.current
    if (drag && drag.pointerId === e.pointerId) {
      dragStateRef.current = null
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      if (el) {
        // Commit the final position to the store (single render).
        setPosition({
          x: parseFloat(el.style.left || '0'),
          y: parseFloat(el.style.top || '0'),
        })
      }
    }
    if (resize && resize.pointerId === e.pointerId) {
      resizeStateRef.current = null
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      if (el) {
        // For TL/TR/BL corners the panel's x or y shifts during resize.
        // Commit the position too so the store stays in sync with the DOM —
        // otherwise the next layout-effect re-render would snap the panel
        // back to its pre-resize position. Both setSize and setPosition
        // flip userRepositioned, which is the correct semantics for a
        // user-initiated resize (canAutoDock returns false after).
        setSize({
          width: parseFloat(el.style.width || '0'),
          height: parseFloat(el.style.height || '0'),
        })
        if (resize.corner !== 'br') {
          setPosition({
            x: parseFloat(el.style.left || '0'),
            y: parseFloat(el.style.top || '0'),
          })
        }
      }
    }
  }, [setPosition, setSize])

  useEffect(() => {
    if (!isOpen) return
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [isOpen, handlePointerMove, handlePointerUp])

  // Resize handle pointer-down. Captures the panel's current rect AND the
  // identity of the dragged corner so pointermove can compute the new
  // geometry with the opposite corner held fixed.
  const handleResizePointerDown = useCallback((corner: ResizeCorner) => {
    return (e: ReactPointerEvent<HTMLDivElement>) => {
      const el = containerRef.current
      if (!el) return
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      resizeStateRef.current = {
        pointerId: e.pointerId,
        corner,
        startX: e.clientX,
        startY: e.clientY,
        startLeft: rect.left,
        startTop: rect.top,
        startW: rect.width,
        startH: rect.height,
      }
      try {
        ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      } catch {
        // pointer capture optional
      }
    }
  }, [])

  // The compact side tab doubles as a top-left resize grip: dragging its body
  // resizes the panel from the top-left corner. Pointer-downs on the
  // minimise/dock buttons are ignored so their clicks still fire.
  const handleSideTabPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).closest('button')) return
      handleResizePointerDown('tl')(e)
    },
    [handleResizePointerDown],
  )

  const handleMinimise = useCallback(() => {
    minimise()
  }, [minimise])

  if (!isOpen || yieldToFirstUse || yieldToDockedOlumi) return null
  if (typeof document === 'undefined') return null

  // Minimised: render a small restore pill at the panel's last position.
  // Position is initialised on open via setInitialPosition, so this should
  // never fall back to 50%/50% in normal flow. Defensive fallback kept for
  // edge cases (SSR rehydrate, etc.).
  //
  // Run-path convergence: the full panel stays MOUNTED (display:none) while
  // minimised. ConversationPanel's registration in guidanceStore is what
  // powers every cross-surface run/ask CTA — unmounting it here used to kill
  // "Analyse first pass"/"Try Again" the moment the user minimised the chat.
  // display:none removes the hidden panel from paint, focus order and the
  // accessibility tree, so the pill remains the only perceivable surface.
  let pillEl: ReactNode = null
  if (isMinimised) {
    // R3: the pill docks to the bottom-right corner, derived from the live
    // viewport and dock inset. It is not draggable, so there is no user
    // position to honour — and deriving it means no stored panel anchor, and
    // no null-position fallback, can strand it mid-canvas.
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1200
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800
    const dockInset = measureDockInset()
    const pillPos = computePillDockPosition(vw, vh, dockInset)
    pillDockRef.current = pillPos
    pillEl = (
      <button
        type="button"
        onClick={() => requestFloatingOlumiSurface(restoreByUser)}
        className="fixed inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-panel border border-panel-border shadow-2 hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-info"
        style={{
          zIndex: 300,
          left: pillPos.x,
          top: pillPos.y,
        }}
        data-testid="floating-olumi-panel-pill"
        aria-label="Restore Olumi"
        title="Restore Olumi"
      >
        <MessageSquare className="w-3.5 h-3.5 text-text-light" aria-hidden="true" />
        <span className={typo('panelMeta', 'text-text-body')}>Olumi</span>
      </button>
    )
  }

  return createPortal(
    <>
    {pillEl}
    <div
      ref={containerRef}
      role="dialog"
      aria-label="Olumi conversation"
      data-testid="floating-olumi-panel"
      /* V4 "one continuous shape": the body + the top-left tab bump are drawn
         as a single rounded SVG outline (below), so this container is
         transparent — no bg/border/radius of its own. */
      className="fixed flex flex-col"
      style={{
        zIndex: 300,
        width: 400,
        height: 550,
        left: 0,
        top: 0,
        // Keep-mounted-while-minimised (see pill comment above).
        display: isMinimised ? 'none' : undefined,
        // Round-10: overflow is `visible` (not hidden) so the side tab can
        // extend OUTSIDE the panel's left edge. Inner regions
        // (conversation list, composer) have their own overflow handling.
        overflow: 'visible',
      }}
    >
      {/* V4 "one continuous shape": panel body + the top-left tab bump as a
         single rounded outline (every corner = SHAPE_RADIUS, the bump joins
         via concave fillets). Decorative + pointer-events-none so clicks fall
         through to the content and side tab; size/path tracked by
         applyPanelShape (layout effect, re-clamp, resize rAF). */}
      <svg
        ref={shapeRef}
        aria-hidden="true"
        width={SIDE_TAB_WIDTH + 400}
        height={550}
        viewBox={`0 0 ${SIDE_TAB_WIDTH + 400} 550`}
        className="absolute top-0 pointer-events-none"
        style={{
          left: -SIDE_TAB_WIDTH,
          overflow: 'visible',
          zIndex: -1,
          // drop-shadow() requires a SINGLE, spread-less shadow. --shadow-2 is
          // `0 4px 12px rgba(...)` today, which qualifies; if that token ever
          // gains a spread radius or a second layer, this filter silently
          // renders NOTHING. Use a dedicated drop-shadow token if that changes.
          filter: 'drop-shadow(var(--shadow-2))',
        }}
      >
        <path
          ref={pathRef}
          d={buildPanelShapePath(400, 550, SIDE_TAB_WIDTH, TAB_BUMP_TOP, TAB_BUMP_HEIGHT, SHAPE_RADIUS, SHAPE_FILLET)}
          style={{ fill: 'var(--bg-panel)', stroke: 'var(--border-default)' }}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* Thin top drag handle. Replaces the previous bulky h-8 header — saves
         conversation height while keeping a clear, pointer-driven drag
         affordance. Decorative for assistive tech: not focusable, not
         operable from the keyboard. Keyboard users reach Minimise + Dock
         via the side-tab buttons below. The strip carries
         `data-testid="floating-olumi-panel-header"` so existing drag tests
         continue to pass. */}
      <div
        onPointerDown={handleHeaderPointerDown}
        className="absolute top-0 left-0 right-0 select-none transition-colors hover:bg-panel-hover"
        style={{ height: DRAG_HANDLE_HEIGHT, cursor: 'grab', zIndex: 2 }}
        data-testid="floating-olumi-panel-header"
        aria-hidden="true"
      >
        <span
          aria-hidden="true"
          className="block absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 w-10 h-px bg-panel-border"
        />
      </div>

      {/* Side tab (OUTSIDE the panel, anchored to its top-left): the three
         icons (mark + minimise + dock). V4: the tab's visual (the bump) is
         drawn by the shape SVG above — this div is just the transparent
         hit-area for the icons and a drag-to-resize grip (top-left corner), so
         it has no background or border of its own. `left: -SIDE_TAB_WIDTH` +
         overflow-visible keep it on the bump; clampPositionToViewport reserves
         SIDE_TAB_WIDTH so it never lands off-screen. */}
      <div
        onPointerDown={handleSideTabPointerDown}
        className="absolute flex flex-col items-center justify-center gap-1.5 select-none cursor-nwse-resize"
        style={{ width: SIDE_TAB_WIDTH, left: -SIDE_TAB_WIDTH, top: TAB_BUMP_TOP, height: TAB_BUMP_HEIGHT, zIndex: 2 }}
        data-testid="floating-olumi-panel-side-tab"
        title="Drag to resize"
      >
        <MessageSquare
          className="w-4 h-4 text-text-light flex-shrink-0"
          aria-hidden="true"
          data-testid="floating-olumi-panel-side-mark"
        />
        <button
          type="button"
          onClick={handleMinimise}
          className="inline-flex items-center justify-center w-8 h-8 rounded cursor-pointer text-text-light hover:text-text-body hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-info"
          aria-label="Minimise"
          data-testid="floating-olumi-panel-minimise"
          title="Minimise"
        >
          <Minus className="w-4 h-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onDock}
          className="inline-flex items-center justify-center w-8 h-8 rounded cursor-pointer text-text-light hover:text-text-body hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-info"
          aria-label="Dock to panel"
          data-testid="floating-olumi-panel-dock"
          title="Dock to panel"
        >
          <PanelRight className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      {/* Main content column. Sits to the right of the side tab and below
         the thin drag handle. `floating-density` activates the scoped
         compact CSS overrides defined in Conversation.module.css (tighter
         message gap, bubble padding, chip sizing). `compact={true}` makes
         MessageBubble swap from typography.body (16px) to typography.panelBody
         (12px) and apply markdownContentCompact line-height — keeping the
         floating surface a compact assistant, not a second full dashboard. */}
      <div
        className="floating-density flex flex-1 min-h-0 flex-col"
        style={{ marginTop: DRAG_HANDLE_HEIGHT }}
      >
        <ConversationPanel
          conversation={conversation}
          onCollapse={close}
          /* Staging's ConversationPanel has no ChatTopBar render, so
             onAttach is never invoked at runtime here — pass no-op. */
          onAttach={noop}
          hideComposer
          compact
          /* Mount identity: this host and the docked Olumi tab can both be
             mounted at once, so they must not answer to one `data-testid`.
             The rationale and the canonical assignment live in one place —
             the note beside these constants in `zones/ChatThread.tsx`. */
          threadTestId={THREAD_TESTID_FLOATING}
        />
        <AIInputBar ref={inputBarRef} variant="floating" hideChevron />
      </div>

      {/* Four corner resize handles. Each is a 12×12 hit area at the panel
         edge with the appropriate diagonal cursor. The BR handle keeps its
         legacy testid; TL/TR/BL are new for the all-corner pass. */}
      <div
        onPointerDown={handleResizePointerDown('tl')}
        className="absolute left-0 top-0 w-3 h-3 cursor-nwse-resize"
        style={{ zIndex: 3 }}
        data-testid="floating-olumi-panel-resize-handle-tl"
        aria-hidden="true"
      />
      <div
        onPointerDown={handleResizePointerDown('tr')}
        className="absolute right-0 top-0 w-3 h-3 cursor-nesw-resize"
        style={{ zIndex: 3 }}
        data-testid="floating-olumi-panel-resize-handle-tr"
        aria-hidden="true"
      />
      <div
        onPointerDown={handleResizePointerDown('bl')}
        className="absolute left-0 bottom-0 w-3 h-3 cursor-nesw-resize"
        style={{ zIndex: 3 }}
        data-testid="floating-olumi-panel-resize-handle-bl"
        aria-hidden="true"
      />
      <div
        onPointerDown={handleResizePointerDown('br')}
        className="absolute right-0 bottom-0 w-3 h-3 cursor-nwse-resize"
        style={{ zIndex: 3 }}
        data-testid="floating-olumi-panel-resize-handle"
        aria-hidden="true"
      >
        <span
          aria-hidden="true"
          className="absolute right-0.5 bottom-0.5 w-1.5 h-1.5 border-r-2 border-b-2 border-text-light opacity-60"
        />
      </div>
    </div>
    </>,
    document.body,
  )
})

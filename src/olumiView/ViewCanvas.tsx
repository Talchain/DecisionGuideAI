/**
 * THE OLUMI-CORE LANE'S OWN CANVAS (DL 4 Nov: "draw the View on a small dedicated canvas"). The lane mounts this in place of the legacy
 * `ReactFlowGraph`: React Flow with only the View's cards, question and links, and one camera rule. None of the legacy canvas's hooks
 * run here, so nothing re-lays out, re-spreads or inspects core's cards (the three faults of 4 Nov were each legacy machinery acting on
 * them). Cards are placed as DGAI's causal graph (`causalPlaces`, via the dock's `useViewCanvas`); the person may pan, zoom and move a card.
 *
 * The camera: each version of core's model is framed once its cards are drawn and settled, the whole board (`wholeAtTopViewport`)
 * once the causal layout is in, and framed again if the new zoom changed the board, at most three times and never over the person's own
 * pan or zoom. The dock, the note and the zoom controls are the legacy canvas's own components, unchanged.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import {
  Background, BackgroundVariant, ReactFlow, ReactFlowProvider, getNodesBounds, useReactFlow, useStore, type Node, type NodeChange, type Viewport,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import './look/olumiLook.css'
import { useCanvasStore } from '../canvas/store'
import { CanvasContextMenu } from '../canvas/contextMenu/CanvasContextMenu'
import type { ContextTarget } from '../canvas/contextMenu/types'
import type { NodeType } from '../canvas/domain/nodes'
import { isStructuralEdge } from '../canvas/domain/edgeUtils'
import { KeyboardLegend, useKeyboardLegend } from '../canvas/help/KeyboardLegend'
import { REACT_FLOW_DELETE_KEY_CODE } from '../canvas/useKeyboardShortcuts'
import { registerFocusHelpers } from '../canvas/utils/focusHelpers'
import { ViewLinkEdge } from '../canvas/edges/ViewLinkEdge'
import { OlumiAttentionCard } from '../canvas/components/OlumiAttentionCard'
import { OutputsDock } from '../canvas/components/OutputsDock'
import { CanvasViewportControls } from '../components/layout/CanvasViewportControls'
import { CanvasOverlayBandProvider } from '../canvas/components/CanvasOverlayBand'
import { HighlightProvider } from '../canvas/highlighting/HighlightContext'
import { OptionChanceCellProvider } from '../canvas/nodes/shared/OptionChanceCellProvider'
import { ToastProvider } from '../canvas/ToastContext'
import { MaybeConversationProvider } from '../canvas/ReactFlowGraph'
import { computeFitPadding } from '../canvas/utils/computeFitPadding'
import { paddingToInsets } from '../canvas/utils/cameraComfort'
import { focusedCardOf, focusedLinkOf, placeViewCards, useViewFocusCard, useViewFocusLink, useViewHover, GROUP_LINK, ROOT_LINK, VIEW_CARD, VIEW_LINK, VIEW_QUESTION, viewLaying } from './canvas'
import { GroupLinkEdge } from './v12/bands/GroupLinkEdge'
import { drawKindOf, drawnModelOf } from './layout'
import { boardKeyOf, CORE_LANE_FIT_FLOOR, SIMPLE_FIT_FLOOR, openBadgesKeyOf, NOTICE_CLEAR_BOTTOM, READABLE_WHOLE_ZOOM, MIN_CARD_TEXT_PX, reducedFaceSize, wholeAtTopViewport } from './camera'
import { LOD_BODY_HIDDEN_ZOOM, LOD_BODY_RESTORED_ZOOM } from '../canvas/utils/zoomLegibility'
import { drawnHeightsKey, measuredOf, QUESTION, settleIdsOf, viewDrawnNodes } from './layout'
import { useViewStore } from './store'
import type { View } from './client'
import { FOOT_GUTTER, restClearOfFoot, zoomClearOfFoot } from './footClear'
import { CoreCard } from './previous/CoreCard'
import { useReplyInView, type Activity } from './replyInView'
import { RootLinkEdge } from './previous/RootLinkEdge'
import { LodSync } from '../canvas/components/LodSync'
import { CanvasLabelScaleSync } from '../canvas/components/CanvasLabelScaleSync'
import { useV10Lane } from './v10'
import { isOlumiCoreLane } from '../olumiCore/lane'
import { useDockFullHeight } from './dockFullHeight'
import { ViewLensBar } from './ViewLensBar'
import { AddFigure } from './AddFigure'
import { LeftSidebar } from '../components/layout/LeftSidebar'
import toolbarStyles from '../components/layout/CanvasFloatingToolbar.module.css'
import { BelowCue } from './BelowCue'
import { LaneHelp } from './v12/LaneHelp'
import { useLaneInspector } from './v12/edit/inspectorStore'
import { useSettingsStore } from '../canvas/settingsStore'
import { ViewZoomNotice } from './ViewZoomNotice'
import { frameTop, useCardClearOfRegions } from './regions'
import { DraftingBoard } from './DraftingBoard'
import { ViewWelcome } from './ViewWelcome'
import { ViewWhatIfKey } from './ViewWhatIfKey'
import { ViewTradeOffsKey } from './ViewTradeOffsKey'
import { ViewPreMortemKey } from './ViewPreMortemKey'
import { useOpenInView, useRevealInView, useTryInView } from './revealCamera'
import { registerRevealReturnCamera } from './revealReturn'
import { registerShowCameraPort, showHolds } from './v12/showInWorkspace/cameraPort'
import { makeShowCameraPort } from './v12/showInWorkspace/canvasSide'
import { useRevealLanding } from './revealLanding'
import { revealOf, useReveal, withChipsAbove, withOpenCard } from './reveal'
import { StrategyOverviewPage } from './strategy/overview/StrategyOverviewPage'
import { StrategyOverviewStage } from './strategy/overview/StrategyOverviewOpener'
export { showSimple, showWholeModel, toggleSimple } from './v12/simpleStore'
import { levelOf, useLevel, useSimpleLevel } from './v12/simpleStore'
import { LaneEditingLayer } from './v12/edit/LaneEditingLayer'
import { UndoControl } from './v12/UndoControl'
import { LensesMenu } from './v12/lenses/LensesMenu'
import { LayerCanvasStyle } from './v12/lenses/LayerCanvasStyle'
import { ViewsToggle } from './v12/views/ViewsToggle'
import { CompareViewsStage } from './v12/views/CompareViewsStage'
import { useQualitativeNotes } from './v12/qualitativeNotes'
import { clearLayoutUndo } from './v12/edit/undo'
import { BandLayer } from './v12/bands/BandLayer'
import { causalPathOf } from './v12/bands/bands'
import { fadeOffPath, focusIdOf, useFocusPath } from './v12/bands/focusPath'
import { FoldCard, IdeaCard, VIEW_FOLD, VIEW_IDEA } from './v12/bands/BandNodes'
import { IdeaPanel } from './v12/bands/IdeaPanel'
import { keptIdeasOf } from './v12/ideas'

// UI restore, 11 Nov (Paul: "the previous UI plugged into the alpha data model"): each card and the question are drawn on the previous
// product's card frame with core's words (./previous/CoreCard), on this canvas, so none of the previous canvas's own hooks run.
const nodeTypes = { [VIEW_CARD]: CoreCard, [VIEW_QUESTION]: CoreCard, [VIEW_IDEA]: IdeaCard, [VIEW_FOLD]: FoldCard }
const edgeTypes = { [VIEW_LINK]: ViewLinkEdge, [ROOT_LINK]: RootLinkEdge, [GROUP_LINK]: GroupLinkEdge }
/** Pan with the left button on empty canvas or the middle button anywhere; a card drags with the left. */
const PAN_BUTTONS = [0, 1]
const SELECT_PAN_BUTTONS = [1]
const MIN_ZOOM = 0.1, MAX_ZOOM = 2
/** The camera's own framing never zooms in past the real size (V12 spec: a small board sits at 1.0, in Simple and in Detailed); a person may still zoom in themselves, up to MAX_ZOOM. */
export const FRAME_MAX_ZOOM = 1
/** How long a camera move eases (ms), and how many times one version may be framed (the first fit, then a re-fit per zoom change). */
const DURATION = 400, MAX_FITS = 5
/**
 * When the board is framed: once it has settled, or after a bounded wait however it stands (DL, A13f cold reopen at 1510×910: the board was
 * never framed, the question cut at the top and three cards under the dock). The wait is in time, not frames: a throttled pane draws about
 * 3 frames a second, so 300 frames was about 100 s. A pan or zoom by the person still ends it (the caller).
 */
export const FRAME_WAIT_MS = 1500
export const frameDue = (settled: boolean, waitedMs: number): boolean => settled || waitedMs >= FRAME_WAIT_MS

/**
 * The person's own deliberate camera move from a control (Fit, the zoom buttons, "Zoom in for detail", the below and right cues, a Model
 * tab row putting its card in front, the reveal panel's return to where they were): it counts as their move (movedAt), so a pending
 * reveal, open-in-view, try-in-view or reply pan and a reply's pulse stand down, and the camera stays theirs for QUIET_MS (replyInView.ts).
 * A programmatic move fires no event-backed onMoveStart, so each control says so itself (Codex, pairing reads 15 Nov).
 */
export const handOf = (movedAt: { current: number }, activity: { current: Activity }) => (): void => {
  movedAt.current += 1
  activity.current = { at: Date.now(), active: false }
}

/** The View's nodes as drawn, with the store's measurements. */
const viewNodes = (nodes: readonly Node[]) => viewDrawnNodes(nodes, [VIEW_CARD, VIEW_QUESTION, VIEW_IDEA, VIEW_FOLD])

/**
 * The one camera rule for a board, in the free canvas (left of the dock, under the top bar): the WHOLE board, top-aligned and centred
 * across, never past 1 and never below the lane's floor (Paul, 10 Nov: the whole model in view at first open, as the previous product's).
 * Zoomed out, each card draws its reduced face (ViewCardNode), so the whole board stays readable.
 */
export function frameFor(nodes: readonly Node[], pane: { width: number; height: number }, free?: { top: number; right: number; bottom: number; left: number }, maxZoom = FRAME_MAX_ZOOM): Viewport | null {
  if (nodes.length === 0 || pane.width === 0) return null
  const bounds = getNodesBounds(nodes as Node[]), raw = free ?? paddingToInsets(computeFitPadding())
  // The frame's top is never above the head band (regions.ts frameTop), however early the padding was read.
  // DL 07:48Z (3): the whole board fits above the foot controls' gutter, never under them.
  const insets = { ...raw, top: frameTop(raw.top), bottom: Math.max(raw.bottom, FOOT_GUTTER) }
  const whole = wholeAtTopViewport(bounds, pane, insets, Math.min(maxZoom, FRAME_MAX_ZOOM), CORE_LANE_FIT_FLOOR)
  // Zoomed out the notice stands at the foot's middle (ViewZoomNotice): the board's foot clears it.
  return reducedFaceSize(whole.zoom) === 0 ? whole : wholeAtTopViewport(bounds, pane, { ...insets, bottom: Math.max(insets.bottom, NOTICE_CLEAR_BOTTOM) }, Math.min(maxZoom, FRAME_MAX_ZOOM), CORE_LANE_FIT_FLOOR)
}

/** The three faces a card draws by zoom, each with its own heights (live v4 at 1128x707, 13 Nov: 12 cards summed 2075 flow px with full
 *  faces, 3162 reduced with the body (labels counter-scaled up), 1662 with the body hidden): full from READABLE_WHOLE_ZOOM; reduced with
 *  its body down to LOD_BODY_HIDDEN_ZOOM (back above it only from LOD_BODY_RESTORED_ZOOM); below that, the body hidden. */
export type FaceRegime = 'full' | 'body' | 'line'
export const faceRegimeOf = (zoom: number): FaceRegime => (reducedFaceSize(zoom) === 0 ? 'full' : zoom >= LOD_BODY_HIDDEN_ZOOM ? 'body' : 'line')
const EPS = 0.001
/** The zooms each face is framed in: inside its own band, so the faces (and their heights) a frame was computed from are the ones drawn. */
export const FACE_RANGE: Record<FaceRegime, readonly [number, number]> = {
  full: [READABLE_WHOLE_ZOOM, 1], body: [LOD_BODY_RESTORED_ZOOM, READABLE_WHOLE_ZOOM - EPS], line: [CORE_LANE_FIT_FLOOR, LOD_BODY_HIDDEN_ZOOM - EPS],
}
/** The board as last drawn with each face: its places and heights, and the zoom it was drawn at. */
export type FaceSnap = { readonly zoom: number; readonly nodes: readonly Node[] }

/** The camera's stand-in for the top of the kept ideas' label room (never drawn). */
export const IDEAS_TOP = 'frame:ideas-top'
/**
 * The nodes the camera frames. Kept ideas with no model (Test pilot, pair v3, 06:29Z: "Ideas you kept" sat under the top bar at all three sizes):
 * ideasOnlyPlaces lays the first row out at SIMPLE_GAP_Y and leaves the band label's room above it, from y 0; the label is not a node, so a frame
 * from the nodes alone put the first row at the top of the free canvas and the label under the bar. That room is the board's top: a zero-size
 * stand-in at y 0 joins the nodes framed. A board with a model is framed from its nodes as before (its question card is its top).
 */
export function frameNodesOf(nodes: readonly Node[], ideasOnly: boolean): Node[] {
  if (!ideasOnly || nodes.length === 0) return [...nodes]
  const x = Math.min(...nodes.map((n) => n.position.x))
  return [...nodes, { id: IDEAS_TOP, position: { x, y: 0 }, data: {}, width: 0, height: 0, measured: { width: 0, height: 0 } }]
}

/**
 * ORDER-UI-5 (4), DL-408: the one frame for a board, from heights MEASURED with the faces that frame will draw. The old rule framed the
 * board as drawn at the moment, so a fit from one face's heights landed in another face's band, the cards changed height, and the camera
 * framed again the other way, up to three times: at 1128x707 it went 1 → 0.87 → 0.50 → 0.30 → 0.51 and stopped with the goal under the
 * foot and "more below" over the cards (live v4 copy, 13 Nov). Now, from the largest face down:
 *  - a face drawn at least once is framed whole on its own heights, at the largest zoom inside its band, if that zoom is in its band;
 *  - the first face not yet drawn under one that does not fit is drawn once to measure it: the body face at BODY_PROBE (its tallest), the
 *    line face at the top of its band (its shortest); the camera's loop then frames again on what was measured.
 * The heights a frame is computed from are the heights it draws, so it never swings back; a board too large for the floor opens at it.
 */
export function cameraFrame(snaps: Partial<Record<FaceRegime, FaceSnap>>, pane: { width: number; height: number }, free?: { top: number; right: number; bottom: number; left: number }, anchor?: string | null, simple = false): Viewport | null {
  const v = frameOf(snaps, pane, free, simple)
  // DL 07:48Z (3): at rest no card's label or figure is under the foot controls (footClear.ts); after the first approval, the aim in view.
  const nodes = (snaps.full ?? snaps.body ?? snaps.line)?.nodes
  // V12 Simple frames itself (simpleFrame): the whole board above the foot gutter where it fits at the floor or above; else from its top, as wide as the
  // room and no wider, at a zoom at which no card is cut by the foot (zoomClearOfFoot), and the cue counts what is below. restClearOfFoot is Detailed's.
  if (v === null || nodes === undefined || simple) return v
  return restClearOfFoot(v, nodes, pane.height, frameTop((free ?? paddingToInsets(computeFitPadding())).top), anchor)
}

function frameOf(snaps: Partial<Record<FaceRegime, FaceSnap>>, pane: { width: number; height: number }, free?: { top: number; right: number; bottom: number; left: number }, simple = false): Viewport | null {
  // DL-538 (14 Nov, the target screen): the board OPENS on its readable full face, never on a zoomed-out face. Until the full face has been
  // drawn, it is drawn once at the top of its band to measure it. Then: the whole board where it fits in the full band; else the full face
  // as wide as the stage allows (within the band), its top under the free canvas's top; what does not fit is panned to, never shrunk.
  // V12 Simple: compact faces at the type scale the board was laid out for, so their heights do not change with zoom and there is no face regime
  // to measure: the whole model at the largest zoom that fits (never past 1) where that is the floor, 0.5, or more; else from its top at the readable zoom.
  if (simple) { const n = snaps.full ?? snaps.body ?? snaps.line; return n === undefined ? null : simpleFrame(n.nodes, pane, free) }
  const full = snaps.full
  if (full === undefined) {
    const drawn = snaps.body ?? snaps.line
    return drawn === undefined ? null : atZoom(drawn.nodes, pane, free, FACE_RANGE.full[1])
  }
  const [lo, hi] = FACE_RANGE.full
  const whole = frameFor(full.nodes, pane, free, hi)
  if (whole !== null && whole.zoom >= lo) return whole
  // V12 Simple: a model that cannot fit whole opens at the readable floor (11 px text), never larger, so the most bands are in view; the top
  // bands are shown and the "N more below" cue stays. Detailed keeps the full band's own rule.
  if (simple) return atZoom(full.nodes, pane, free, lo)
  return atZoom(full.nodes, pane, free, Math.max(lo, Math.min(hi, acrossZoom(full.nodes, pane, free))))
}

function simpleFrame(nodes: readonly Node[], pane: { width: number; height: number }, free: { top: number; right: number; bottom: number; left: number } | undefined): Viewport | null {
  if (nodes.length === 0 || pane.width === 0) return null
  const bounds = getNodesBounds(nodes as Node[]), raw = free ?? paddingToInsets(computeFitPadding())
  const top = frameTop(raw.top), bottom = Math.max(raw.bottom, FOOT_GUTTER)
  const freeW = Math.max(1, pane.width - raw.left - raw.right), freeH = Math.max(1, pane.height - top - bottom)
  const across = freeW / Math.max(1, bounds.width), whole = Math.min(across, freeH / Math.max(1, bounds.height))
  // R1 priority 2 over 3: the whole model where it fits at the floor or above (type then draws as the zoom allows). Where it cannot fit even at the
  // floor (a 20-card model of long sentences, at 1232 x 704 with the panel open: the board is about 2.6 times the room), priority 2 is already lost,
  // so priority 3 holds: the board opens at the zoom its own type draws 11 px, top in view, and the cue counts what is below.
  if (whole >= SIMPLE_FIT_FLOOR) return atZoom(nodes, pane, free, Math.min(FRAME_MAX_ZOOM, whole))
  const scale = (nodes.find((n) => (n.data as { scale?: number } | undefined)?.scale !== undefined)?.data as { scale?: number } | undefined)?.scale ?? 1
  const readable = Math.min(FRAME_MAX_ZOOM, MIN_CARD_TEXT_PX / (12 * Math.max(scale, 1e-6)))
  // Never wider than the room: the board's width fits across (or the floor, where even that is too wide), and the foot-clear search only zooms OUT from
  // there, and only while the type still draws 11 px, so no card is put under the panel and no text is shrunk to clear the foot. Where no such zoom
  // clears it, the foot edge (BelowCue) covers what is below the line and the cue counts it.
  const base = Math.max(SIMPLE_FIT_FLOOR, Math.min(readable, across))
  const z = zoomClearOfFoot(nodes.map((n) => ({ y: n.position.y, h: n.measured?.height ?? n.height ?? 0 })), bounds.y, top, pane.height, base, Math.max(SIMPLE_FIT_FLOOR, Math.min(base, readable)))
  return atZoom(nodes, pane, free, z)
}

/** The zoom at which the board's width fills the free canvas across (its height not considered: what is below is panned to). */
function acrossZoom(nodes: readonly Node[], pane: { width: number; height: number }, free: { top: number; right: number; bottom: number; left: number } | undefined): number {
  if (nodes.length === 0 || pane.width === 0) return 1
  const bounds = getNodesBounds(nodes as Node[]), raw = free ?? paddingToInsets(computeFitPadding())
  return Math.max(1, pane.width - raw.left - raw.right) / Math.max(1, bounds.width)
}

/** The board framed at exactly `zoom` (top under the free canvas's top, centred across), to draw a face once and measure it. */
function atZoom(nodes: readonly Node[], pane: { width: number; height: number }, free: { top: number; right: number; bottom: number; left: number } | undefined, zoom: number): Viewport | null {
  if (nodes.length === 0 || pane.width === 0) return null
  zoom = Math.min(zoom, FRAME_MAX_ZOOM)
  const bounds = getNodesBounds(nodes as Node[]), raw = free ?? paddingToInsets(computeFitPadding())
  const insets = { ...raw, top: frameTop(raw.top) }, freeW = Math.max(1, pane.width - insets.left - insets.right)
  // DL-538: a board wider than the free canvas at this zoom starts at its left edge (the question bar and the first option readable; the
  // rest is panned to), never centred with its first card under the left toolbar.
  const x = bounds.width * zoom > freeW ? insets.left - bounds.x * zoom : insets.left + freeW / 2 - (bounds.x + bounds.width / 2) * zoom
  return { zoom, x, y: insets.top - bounds.y * zoom }
}

/**
 * Frames each version of core's model once its cards settle: every card measured, and its heights, places and the camera unchanged
 * across a frame (a measured signal; bounded). A new zoom can re-draw the cards' heights, so it frames again if the settled board
 * changed, at most `MAX_FITS` times; a pan or zoom by the person ends it.
 */
/** The primary aim: the goal card the options' headlines are read against most often (core's `headline.aim_id`), else the first goal. */
export function primaryAimOf(view: View | null): string | null {
  const cards = view?.model?.cards ?? [], count = new Map<string, number>()
  for (const c of cards) { const a = c.family === 'option' ? c.headline?.aim_id ?? null : null; if (a !== null) count.set(a, (count.get(a) ?? 0) + 1) }
  // The aim read most often; the first counted wins a tie. Counted, not ordered.
  let top: string | null = null, most = 0
  for (const [aim, n] of count) if (n > most) { top = aim; most = n }
  return top !== null && cards.some((c) => c.id === top) ? top : cards.find((c) => c.family === 'goal')?.id ?? null
}

/** What the camera remembers of the board it last framed: a proposal held, and the version. */
export type BoardSeen = { held: boolean; n: number | null }
export const boardSeenOf = (view: View | null): BoardSeen => ({ held: view?.proposal != null, n: typeof view?.version?.n === 'number' ? view.version.n : null })
/** The aim to bring into view: only on the FIRST approval (a first model held, no version; now version 1, nothing held). */
export function aimAfterFirstApproval(was: BoardSeen | null, now: View | null): string | null {
  const n = boardSeenOf(now)
  return was !== null && was.held && was.n === null && n.n === 1 && !n.held ? primaryAimOf(now) : null
}

function useViewCamera(userMoved: React.MutableRefObject<boolean>): () => Viewport | null {
  const { getNodes, getViewport, setViewport } = useReactFlow()
  const width = useStore((s) => s.width), height = useStore((s) => s.height)
  const pane = useRef({ width, height })
  pane.current = { width, height }
  // The board as last drawn with each face (`cameraFrame`); cleared per version.
  const snaps = useRef<Partial<Record<FaceRegime, FaceSnap>>>({})
  // DL 07:48Z / PL-1040: after the FIRST approval (a first model held, then version 1 with nothing held) the camera brings the primary aim
  // into view, its question readable without panning; never on a later approval, never on a reload (no held first model seen before).
  const seen = useRef<{ held: boolean; n: number | null } | null>(null)
  const aim = useRef<string | null>(null)
  const fit = useCallback(() => {
    const drawn = frameNodesOf(viewNodes(getNodes()), useViewStore.getState().view?.model == null), zoom = getViewport().zoom
    const simple = levelOf(useViewStore.getState().sid) === 'simple'
    if (drawn.length > 0) snaps.current = { ...snaps.current, [simple ? 'full' : faceRegimeOf(zoom)]: { zoom, nodes: drawn.map((n) => ({ ...n, position: { ...n.position }, measured: { ...n.measured } })) } }
    const v = cameraFrame(snaps.current, pane.current, undefined, aim.current, simple)
    if (v) void setViewport(v, { duration: DURATION })
    return v
  }, [getNodes, getViewport, setViewport])
  // Each version (or first model), and each set of badges open on it: a badge opened or closed frames the board it changed to.
  // V12: the level is part of the board's key, so switching Simple / Working frames the board it made (a reveal of one card does not).
  const level = useSimpleLevel((s) => levelOf(useViewStore.getState().sid, s))
  // Kept ideas with no model are a board too (one camera, pair v3): each kept set is framed once, as a version is.
  const version = useViewStore((s) => { const k = boardKeyOf(s.sid, s.view) || ideasBoardKeyOf(s.sid, s.view); return k === '' ? '' : `${k}|${openBadgesKeyOf(s.view)}|${level}` })
  /**
   * The bounded settle: frame the board once it has settled (every card measured; its heights, places, the camera and the free canvas's insets unchanged
   * across a frame), and again if the settled board changed, at most MAX_FITS times; a pan or zoom by the person ends it. Returns its stop.
   */
  const settle = useCallback((): (() => void) => {
    let raf = 0, since = performance.now(), last = '', fitted = '', fits = 0
    // V12 Simple: the frame it asked for, checked once its move has had time to finish. A move the canvas did not take (it was asked before the
    // pane was ready: the board then stood at 0,0 at scale 1 until Fit was pressed) is asked for again, up to MAX_FITS.
    let target: Viewport | null = null, targetAt = 0
    const tick = () => {
      // "Show in the workspace" is rearranging the board (v12/showInWorkspace): this framing waits, then goes on as if it had just begun.
      if (showHolds()) { since = performance.now(); last = ''; raf = requestAnimationFrame(tick); return }
      if (userMoved.current) return
      if (target !== null && performance.now() - targetAt > DURATION + 300) {
        const v = getViewport(), t = target
        target = null
        if (Math.abs(v.zoom - t.zoom) > 0.01 || Math.abs(v.x - t.x) > 2 || Math.abs(v.y - t.y) > 2) fitted = ''
      }
      // The cards the canvas holds (Simple may fold some inputs away, and draws kept ideas and group cards), so the settle signal waits for what is drawn.
      const held = new Set(getNodes().map((n) => n.id))
      const model = useViewStore.getState().view?.model ?? null
      const ids = settleIdsOf(held, model?.cards ?? [], model !== null)
      const drawn = measuredOf(getNodes(), ids)
      // D3 (17 Nov): the free canvas's insets are part of the board (the lens bar or the panel placed late, a resize): the camera frames the room it has.
      const room = JSON.stringify(paddingToInsets(computeFitPadding()))
      const board = `${drawnHeightsKey(drawn)}#${drawn.map((n) => `${n.position.x},${n.position.y}`).join('|')}#${room}`
      const now = `${board}@${getViewport().zoom}`
      const settled = drawn.length === ids.size && now === last && !viewLaying()
      last = now
      if (!frameDue(settled, performance.now() - since)) { raf = requestAnimationFrame(tick); return }
      if (drawn.length === 0 || board === fitted || fits >= MAX_FITS) {
        if (target !== null && fits < MAX_FITS) raf = requestAnimationFrame(tick)
        return
      }
      const asked = fit()
      if (levelOf(useViewStore.getState().sid) === 'simple') { target = asked; targetAt = performance.now() }
      fits += 1
      fitted = board
      since = performance.now()
      last = ''
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [fit, getNodes, getViewport, userMoved])
  // One settle at a time: a new one stops the one before it.
  const settling = useRef<() => void>(() => undefined)
  useEffect(() => () => settling.current(), [])
  useEffect(() => {
    if (version === '') return
    userMoved.current = false
    snaps.current = {}
    const now = useViewStore.getState().view
    aim.current = aimAfterFirstApproval(seen.current, now)
    seen.current = boardSeenOf(now)
    settling.current(); settling.current = settle()
  }, [version, settle, userMoved])
  // The free canvas changes size (the window, the dock): the board is laid out again for the new room (canvas.ts useSimpleBudgetKey), so the camera
  // settles again on what is then drawn (D3: a resize from 2000 to 1232 left the question behind the lens bar until Fit), never over the person's own move.
  useEffect(() => {
    if (userMoved.current) return
    snaps.current = {}
    settling.current(); settling.current = settle()
  }, [width, height, settle, userMoved])
  return fit
}

/** The board key of kept ideas with no model (camera.ts boardKeyOf has none: no version, no proposal): the scenario and the kept set. */
export const ideasBoardKeyOf = (sid: string | null, view: View | null): string => {
  if (sid === null || view === null || view.model != null) return ''
  const kept = keptIdeasOf(view)
  return kept.length === 0 ? '' : `${sid}:ideas:${kept.map((i) => i.id).join(',')}`
}

function ViewFlow() {
  const [tool, setTool] = useState<'select' | 'hand'>('hand')
  const stored = useCanvasStore((s) => s.nodes)
  // V11: the card whose chip is open is marked `v11-open` on its node, so the coaching ring (ring.ts) steps out of it: one focus per screen.
  const openCard = useReveal((s) => s.card)
  const view = useViewStore((s) => s.view)
  // A model that is only a question and its aims shows the purposes and tensions core folded behind the question (v12/qualitativeNotes).
  useQualitativeNotes(useViewStore((s) => s.sid), view)
  const chipCards = useMemo(() => new Set(revealOf(view)?.cardChips.keys() ?? []), [view])
  const simple = useSimpleLevel((s) => levelOf(useViewStore.getState().sid, s)) === 'simple'
  // The path lit while a card is hovered, else while one is selected (R1: production's rule; the cards and links off it fade, only then).
  const hovered = useViewHover((h) => h.id)
  const lit = useMemo(() => {
    if (!simple || view?.model == null) return null
    return causalPathOf(drawnModelOf(view.model), focusIdOf(stored, hovered, VIEW_CARD))
  }, [stored, hovered, simple, view])
  // The lit path is a module-wide store the links read: written while this canvas stands, dropped when it goes (a later canvas never inherits a fade).
  useEffect(() => { useFocusPath.setState({ path: lit }); return () => useFocusPath.setState({ path: null }) }, [lit])
  const nodes = useMemo(() => {
    const base = withOpenCard(withChipsAbove(stored, chipCards), openCard)
    // V12 Simple: the board is drawn at the type scale it was laid out for (layout.ts simpleScaleOf), the same on every card: heights then do not
    // change as the person zooms, so nothing re-flows under their hand. Both variables, the canvas's and the look's own (--o-s is substituted at the root).
    const scaled = !simple ? base : base.map((n) => { const s = (n.data as { scale?: number }).scale; return s === undefined ? n : { ...n, style: { ...n.style, '--canvas-label-scale': s, '--o-s': s } as CSSProperties } })
    return fadeOffPath(scaled, lit, QUESTION)
  }, [stored, chipCards, openCard, simple, lit])
  const edges = useCanvasStore((s) => s.edges)
  const onNodesChange = useCallback((changes: NodeChange[]) => useCanvasStore.getState().onNodesChange(changes), [])
  // The previous product's right-click menu on the lane's canvas: its own items, those that reach core (ask Olumi in the chat, the card's
  // figure), the rest left out (useMenuItems.ts, lane.ts). Nothing is written here: every item asks Olumi in the chat.
  // The menu is one of the five surfaces the one surface store holds (v12/edit/inspectorStore): opening it closes what else was open.
  const menu = useLaneInspector((s) => (s.current !== null && s.current.kind === 'menu' ? s.current.target : null))
  const closeMenu = useCallback(() => { useLaneInspector.getState().close('menu') }, [])
  const setMenu = useCallback((t: ContextTarget) => { useLaneInspector.getState().show({ kind: 'menu', target: t }) }, [])
  const legend = useKeyboardLegend()
  const { screenToFlowPosition } = useReactFlow()
  const userMoved = useRef(false)
  // Each move the person makes themselves: a card waiting to be brought in front never overrides one (checker, slice 2a).
  const movedAt = useRef(0)
  // When the person last moved the camera and whether a drag is under way (replyInView.ts: a reply never moves the board under their hand).
  const activity = useRef<Activity>({ at: 0, active: false })
  // Every control the person presses to move the camera says so through this one function (handOf, above).
  const hand = handOf(movedAt, activity)
  const fit = useViewCamera(userMoved)
  // V11: the team's disagreement is brought into view once per reveal, never over the person's own move (./revealCamera.ts).
  useRevealInView(movedAt)
  // P1 (DL 10 Nov): the dock lands on the contested card's panel, once per reveal (./revealLanding.ts).
  useRevealLanding()
  useOpenInView(movedAt)
  // AI and canvas as one partner: a new reply that points at cards brings them into view and pulses their ring once (./replyInView.ts).
  useReplyInView(movedAt, activity)
  useTryInView(movedAt)
  // The z-order rule (./regions.ts): an opened card, its editor included, is moved clear of the head band, the foot controls and the dock.
  useCardClearOfRegions()
  // A Model tab row puts its card in front (`focusNodeById`): selected, and the camera centred on it at the zoom the person has. Only the
  // node focus is registered: the legacy fit and pan seams stay unregistered on this lane, so the applied-edit pulse never moves the
  // camera off the question and options (fit-real-model, bakery).
  const { setCenter, getZoom, getInternalNode, getViewport, setViewport } = useReactFlow()
  useEffect(() => registerRevealReturnCamera(() => {
    const before = getViewport()
    return () => { userMoved.current = true; hand(); void setViewport(before, { duration: 0 }) }
  }), [getViewport, setViewport])
  // "Show in the workspace" under a reply (v12/showInWorkspace): its camera port, registered while the canvas is on the page. It runs no framing of
  // its own: it asks this canvas's `fit` and moves once as the person's own move. (`hand` is new each render and reads only refs: not a dependency,
  // as for the reveal-return above; a port registered again would let go of the place a show remembers.)
  useEffect(() => registerShowCameraPort(makeShowCameraPort({ getViewport, setViewport, getInternalNode, userMoved, hand, fit })), [getViewport, setViewport, getInternalNode, fit])
  const focusCall = useRef(0)
  useEffect(() => () => { focusCall.current += 1 }, [])
  // Which card or link holds keyboard focus is the canvas's while it is up: nothing is left open once it goes (checker, slice 1).
  // Focus anywhere on the page (the dock, the composer, a control outside the canvas) says which card or link holds it, if any; leaving reads
  // where it goes next, so a move between two controls of one card never closes it for a render (DL 7 Nov run 0717: focus moving to "Add
  // a figure" never reached a canvas handler, and a card stayed open beside another).
  useEffect(() => {
    const into = (e: FocusEvent) => { useViewFocusLink.setState({ id: focusedLinkOf(e.target) }); useViewFocusCard.setState({ id: focusedCardOf(e.target) }) }
    const out = (e: FocusEvent) => {
      // Focus going nowhere is decided once the page settles. A control replaced by its own press ("Remove link" → its ask; an editor that
      // closed) takes the page's focus with it: that is not the person leaving, so the link or card it was in stays named (7 Nov run 0758:
      // the ask vanished on its first press, so no line could be removed). Leaving to nothing focusable still names none.
      if (e.relatedTarget === null && e.target instanceof Node) {
        const left = e.target
        setTimeout(() => {
          const here = document.activeElement
          if (left.isConnected && (here === null || here === document.body)) { useViewFocusLink.setState({ id: null }); useViewFocusCard.setState({ id: null }) }
        }, 0)
        return
      }
      useViewFocusLink.setState({ id: focusedLinkOf(e.relatedTarget) }); useViewFocusCard.setState({ id: focusedCardOf(e.relatedTarget) })
    }
    document.addEventListener('focusin', into)
    document.addEventListener('focusout', out)
    return () => { document.removeEventListener('focusin', into); document.removeEventListener('focusout', out); useViewFocusCard.setState({ id: null }); useViewFocusLink.setState({ id: null }) }
  }, [])
  useEffect(() => registerFocusHelpers((id) => {
    // A card just added is in the canvas's nodes before React Flow has measured it, and its measured height lays the board out again: wait
    // until it is measured, no layout is running and it has kept its place for a frame (up to ~2 s), then bring it in front.
    let last = ''
    const call = ++focusCall.current, moves = movedAt.current
    const go = (tries: number) => {
      // A newer call, the person moving the board themselves, or the canvas leaving: this one is dropped.
      if (call !== focusCall.current || moves !== movedAt.current) return
      const n = getInternalNode(id)
      const here = n === undefined || !n.measured.width ? '' : `${n.internals.positionAbsolute.x},${n.internals.positionAbsolute.y}`
      const settled = here !== '' && !viewLaying() && here === last
      last = here
      if (!settled) { if (tries > 0) requestAnimationFrame(() => go(tries - 1)); return }
      useCanvasStore.getState().selectNodeWithoutHistory(id)
      const at = n!.internals.positionAbsolute, w = n!.measured.width ?? 0, h = n!.measured.height ?? 0
      userMoved.current = true; hand()
      void setCenter(at.x + w / 2, at.y + h / 2, { zoom: getZoom(), duration: 300 })
    }
    go(120)
  }, () => undefined), [setCenter, getZoom, getInternalNode])
  const { zoomIn, zoomOut, zoomTo } = useReactFlow()
  const hasModel = useViewStore((s) => (s.view?.model?.cards.length ?? 0) > 0)
  const showGrid = useSettingsStore((s) => s.showGrid), gridSize = useSettingsStore((s) => s.gridSize), snapToGrid = useSettingsStore((s) => s.snapToGrid)
  const snapGrid = useMemo<[number, number]>(() => [gridSize, gridSize], [gridSize])
  useEffect(() => { useSettingsStore.getState().loadSettings() }, [])
  // Codex 008e #1: kept ideas with no model are the board (their band alone), so the welcome does not stand over them. The dock's own message
  // box takes the words then (DockComposer draws it whenever no welcome is up). No toolbar or model control is shown for a model that is not there.
  const ideasOnly = useViewStore((s) => s.view !== null && s.view.model == null && keptIdeasOf(s.view).length > 0)
  const level = useLevel()
  const mine = (e: unknown) => { if (e) { userMoved.current = true; movedAt.current += 1; activity.current = { at: Date.now(), active: true } } }
  const mineEnd = (e: unknown) => { if (e) activity.current = { at: Date.now(), active: false } }
  return (
    <>
      <ReactFlow snapToGrid={snapToGrid} snapGrid={snapGrid}
        // Paul's option inspector (audit F34): a press on an option card opens its details, as right-click "Open details" does.
        onNodeClick={(e, n) => {
          // The lane's own (the older look keeps its press as it was): a press on one of the card's own controls (its pencil, a quick action) or the open figure editor's panel, label and padding included, is that control's, never also "open details": it would close what the control just opened.
          if (isOlumiCoreLane() && e.target instanceof Element && e.target.closest('button, a, input, textarea, select, [data-card-action], [data-figure-edit-panel]') !== null) return
          if (useViewStore.getState().view?.model?.cards.find((c) => c.id === n.id)?.family === 'option') useLaneInspector.getState().open({ kind: 'card', id: n.id })
        }}
        className="olumi-look" nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} onNodesChange={onNodesChange}
        onPaneContextMenu={(e) => { e.preventDefault(); setMenu({ kind: 'pane', screenPos: { x: e.clientX, y: e.clientY } }) }}
        onNodeContextMenu={(e, n) => {
          e.preventDefault()
          const m = useViewStore.getState().view?.model, card = m?.cards.find((c) => c.id === n.id)
          const nodeType = (n.id === QUESTION || card === undefined || m === undefined ? 'decision' : drawKindOf(card, m as Parameters<typeof drawKindOf>[1])) as NodeType
          useCanvasStore.getState().selectNodeWithoutHistory(n.id)
          setMenu({ kind: 'node', nodeId: n.id, nodeType, node: n, screenPos: { x: e.clientX, y: e.clientY } })
        }}
        onEdgeContextMenu={(e, edge) => {
          e.preventDefault()
          const kindOf = (id: string) => (useCanvasStore.getState().nodes.find((x) => x.id === id)?.data as { kind?: string } | undefined)?.kind
          setMenu({ kind: 'edge', edgeId: edge.id, edge: edge as never, isStructural: isStructuralEdge(edge as never, kindOf as never), screenPos: { x: e.clientX, y: e.clientY } })
        }}
        onNodeMouseEnter={(_, n) => useViewHover.setState({ id: n.id })} onNodeMouseLeave={() => useViewHover.setState({ id: null })}
        // A press on the empty canvas lets go of any card or link held by focus (a removed control fires no blur).
        onPaneClick={() => { useViewFocusLink.setState({ id: null }); useViewFocusCard.setState({ id: null }); useLaneInspector.getState().dismiss(false) }}
        onMoveStart={mine} onMoveEnd={mineEnd} selectionOnDrag={tool === 'select'} panOnDrag={tool === 'select' ? SELECT_PAN_BUTTONS : PAN_BUTTONS} minZoom={MIN_ZOOM} maxZoom={MAX_ZOOM}
        nodesConnectable={false} edgesFocusable elevateEdgesOnSelect={false} deleteKeyCode={REACT_FLOW_DELETE_KEY_CODE} selectionKeyCode={null} multiSelectionKeyCode={null}
        proOptions={{ hideAttribution: true }} data-testid="view-canvas"
      >
        {/* The three-dot menu's canvas settings (Paul's audit, 17 Nov): show the grid at its size, and snap a moved card to it. */}
        {showGrid ? <Background variant={BackgroundVariant.Dots} gap={gridSize} /> : null}
        {/* The previous card frame's zoomed-out face and label scale (the two syncs the previous canvas mounts; they write no model state). */}
        <LodSync /><CanvasLabelScaleSync />
        {/* V12 Simple: the band labels, the "not linked" marks and the inputs' fold control, in the canvas's own coordinates (v12/bands). */}
        <BandLayer />
      </ReactFlow>
      <CanvasViewportControls
        onZoomIn={() => { userMoved.current = true; hand(); void zoomIn({ duration: 200 }) }}
        onZoomOut={() => { userMoved.current = true; hand(); void zoomOut({ duration: 200 }) }}
        onZoomReset={() => { userMoved.current = true; hand(); void zoomTo(1, { duration: 200 }) }}
        // Fit is the person's own deliberate move too: a reply's pending pan and pulse (replyInView.ts) are cancelled, and the camera stays theirs for QUIET_MS.
        // Bumping movedAt also releases any reveal, open-in-view or try-in-view pan still pending (revealCamera.ts), so none of them moves the camera after Fit: deliberate.
        // Bound by fitHandler.spec.tsx (this handler, on the real canvas) and replyInView.spec.tsx F1, F2 and F4 (what the refs it writes cancel).
        onFitView={() => { userMoved.current = false; hand(); fit() }}
        onAutoArrange={() => { const model = useViewStore.getState().view?.model; clearLayoutUndo(); if (model) void placeViewCards(model) }}
      />
      {/* While a brief drafts, the empty board says so (plan v3 drafting state). */}
      {hasModel ? null : <DraftingBoard />}
      {/* UI restore stage 1, row 4: a scenario waiting for its brief shows the welcome (logo and one composer) on the empty canvas. */}
      {hasModel || ideasOnly ? null : <ViewWelcome />}
      <IdeaPanel />
      {hasModel ? <LeftSidebar className={toolbarStyles.neutralTools} interactionMode={tool} onSelectClick={() => setTool((t) => t === 'select' ? 'hand' : 'select')}
        showUndo undoControl={<UndoControl />} layers={<LensesMenu />} toolShortcuts={false} addControl={<AddFigure />} /> : null}
      {/* A board with cards below the window's foot says how many, and brings them up (V11 pixel pass, 9 Nov). */}
      {hasModel ? <BelowCue onPress={hand} edge={level === 'simple'} /> : null}
      <LaneHelp />
      {/* Paul, 18 Nov: Simple | Detailed moved into the left Lenses menu (v12/lenses/LensesMenu); the foot keeps only the Views switch, which
          draws nothing until a reveal is authorised, so there is no panel at the canvas foot at rest. */}
      {hasModel ? <div data-testid="view-foot-toggle" className="pointer-events-none absolute bottom-3 left-1/2 z-[1200] flex -translate-x-1/2 items-center gap-2 empty:hidden"><ViewsToggle view={view} className="pointer-events-auto" /></div> : null}
      {hasModel ? <LayerCanvasStyle /> : null}
      {/* Paul, 17 Nov: no always-on key at the bottom right; the one key is "How to read this" in the left foot menu (ViewLegend, KeyLines). */}
      {/* Hand edits (the right-click menu's forms, the details panel and Undo's keys), inside the toast provider. */}
      <LaneEditingLayer />
      {/* Paul, 10 Nov: zoomed out the cards draw less; the previous product's notice says so and zooms back in (./ViewZoomNotice.tsx). */}
      {hasModel ? <ViewZoomNotice onZoom={() => { userMoved.current = true; hand() }} /> : null}
      {/* The six lenses in the previous bar's place, every word and count core's (Paul 11 Nov withdrew Model · Explore · Team). */}
      {hasModel ? <ViewLensBar /> : null}
      {hasModel ? <ViewWhatIfKey /> : null}
      {hasModel ? <ViewTradeOffsKey /> : null}
      {hasModel ? <ViewPreMortemKey /> : null}
      {menu === null ? null : <CanvasContextMenu target={menu} onClose={closeMenu} screenToFlowPosition={screenToFlowPosition} interactionMode={tool} onSetInteractionMode={setTool} />}
      <KeyboardLegend isOpen={legend.isOpen} onClose={legend.close} />
      {/* V12: in Simple, Olumi's note is a badge on its card and its words are in the panel; the floating note card is Detailed's. */}
      {level === 'simple' ? null : <OlumiAttentionCard />}
      <OutputsDock />
    </>
  )
}

/** The lane's canvas with the providers its dock and note read (the same ones the legacy canvas gives them). */
export function ViewCanvas(): JSX.Element {
  useV10Lane()
  useDockFullHeight()
  return (
    <ToastProvider>
      <ReactFlowProvider>
        <HighlightProvider>
          <OptionChanceCellProvider>
            <CanvasOverlayBandProvider>
              <MaybeConversationProvider>
                <div className="relative h-full w-full" data-testid="view-canvas-root">
                  <ViewFlow />
                  {/* Strategy lane (7 Nov, by agreement with the V11 build): the Overview stands over the stage while the header's opener holds it open. */}
                  <StrategyOverviewStage>{(view, close) => <StrategyOverviewPage view={view} onClose={close} />}</StrategyOverviewStage>
                  {/* V12 (proposal 005, Codex 16:52Z): each member's view side by side, then where they differ, over the canvas beside the dock. */}
                  <CompareViewsStage />
                </div>
              </MaybeConversationProvider>
            </CanvasOverlayBandProvider>
          </OptionChanceCellProvider>
        </HighlightProvider>
      </ReactFlowProvider>
    </ToastProvider>
  )
}

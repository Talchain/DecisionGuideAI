/**
 * THE OLUMI-CORE LANE'S OWN CANVAS (DL 4 Nov: "draw the View on a small dedicated canvas"). The lane mounts this in place of the legacy
 * `ReactFlowGraph`: React Flow with only the View's cards, question and links, and one camera rule. None of the legacy canvas's hooks
 * run here, so nothing re-lays out, re-spreads or inspects core's cards (the three faults of 4 Nov were each legacy machinery acting on
 * them). Cards are placed as DGAI's causal graph (`causalPlaces`, via `useViewCanvas`); the person may pan, zoom and move a card.
 *
 * Fit and the opening camera follow the same committed layout. The person can take control while either request waits.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import {
  Background, BackgroundVariant, ReactFlow, ReactFlowProvider, getNodesBounds, useReactFlow, useStore, useStoreApi, type Node, type NodeChange, type Viewport,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import './look/olumiLook.css'
import { useCanvasStore } from '../canvas/store'
import { CanvasContextMenu } from '../canvas/contextMenu/CanvasContextMenu'
import { contextMenuOpener, type ContextTarget } from '../canvas/contextMenu/types'
import type { NodeType } from '../canvas/domain/nodes'
import { isStructuralEdge } from '../canvas/domain/edgeUtils'
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
import { focusedCardOf, focusedLinkOf, placeViewCards, useViewFocusCard, useViewFocusLink, useViewHover, GROUP_LINK, ROOT_LINK, VIEW_CARD, VIEW_LINK, VIEW_QUESTION, useLayoutSettled, viewLaying } from './canvas'
import { GroupLinkEdge } from './v12/bands/GroupLinkEdge'
import { drawKindOf, drawnModelOf } from './layout'
import { boardKeyOf, CORE_LANE_FIT_FLOOR, SIMPLE_FIT_FLOOR, openBadgesKeyOf, NOTICE_CLEAR_BOTTOM, READABLE_WHOLE_ZOOM, MIN_CARD_TEXT_PX, reducedFaceSize, simpleFrameFor, wholeAtTopViewport } from './camera'
import { farTitleScale, LOD_BODY_HIDDEN_ZOOM, LOD_BODY_RESTORED_ZOOM, resolveLodRung } from '../canvas/utils/zoomLegibility'
import { QUESTION, viewDrawnNodes } from './layout'
import { useViewStore } from './store'
import type { View, ViewCard } from './client'
import { whoseOf } from './v12/cards/marks'
import { FOOT_GUTTER, restClearOfFoot, zoomClearOfFoot } from './footClear'
import { CoreCard } from './previous/CoreCard'
import { useReplyInView, type Activity } from './replyInView'
import { RootLinkEdge } from './previous/RootLinkEdge'
import { LodSync, type LodFrame } from '../canvas/components/LodSync'
import { CanvasLabelScaleSync } from '../canvas/components/CanvasLabelScaleSync'
import { useV10Lane } from './v10'
import { isOlumiCoreLane } from '../olumiCore/lane'
import { useDockFullHeight } from './dockFullHeight'
import { ViewLensBar } from './ViewLensBar'
import { AddFigure } from './AddFigure'
import { LeftSidebar } from '../components/layout/LeftSidebar'
import { FootRow } from './look/FootRow'
import { installPlaceHost } from './look/placeHost'
import { lanePlaceHost } from './look/placeReaders'
import { LaneHelp } from './v12/LaneHelp'
import { useLaneInspector } from './v12/edit/inspectorStore'
import { useSettingsStore } from '../canvas/settingsStore'
import { frameTop, useCardClearOfRegions } from './regions'
import { DraftingBoard, LayingBoard } from './DraftingBoard'
import { ViewWelcome } from './ViewWelcome'
import { useOpenInView, useRevealInView, useTryInView } from './revealCamera'
import { registerRevealReturnCamera } from './revealReturn'
import { registerShowCameraPort, showHolds } from './v12/showInWorkspace/cameraPort'
import { makeShowCameraPort } from './v12/showInWorkspace/canvasSide'
import { revealOf, useReveal, withChipsAbove, withOpenCard } from './reveal'
import { StrategyOverviewPage } from './strategy/overview/StrategyOverviewPage'
import { FrameStage } from './v12/frame/FrameStage'
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
import { markPath, focusIdOf, useFocusPath } from './v12/bands/focusPath'
import { FoldCard, IdeaCard, VIEW_FOLD, VIEW_IDEA } from './v12/bands/BandNodes'
import { IdeaPanel } from './v12/bands/IdeaPanel'
import { keptIdeasOf } from './v12/ideas'

// UI restore, 11 Nov (Paul: "the previous UI plugged into the alpha data model"): each card and the question are drawn on the previous
// product's card frame with core's words (./previous/CoreCard), on this canvas, so none of the previous canvas's own hooks run.
const nodeTypes = { [VIEW_CARD]: CoreCard, [VIEW_QUESTION]: CoreCard, [VIEW_IDEA]: IdeaCard, [VIEW_FOLD]: FoldCard }
const edgeTypes = { [VIEW_LINK]: ViewLinkEdge, [ROOT_LINK]: RootLinkEdge, [GROUP_LINK]: GroupLinkEdge }
// The lane opens details for any model card. The older look opens them for options only.
function opensCardDetails(id: string): boolean {
  const card = useViewStore.getState().view?.model?.cards.find((c) => c.id === id)
  return card !== undefined && (card.family === 'option' || isOlumiCoreLane())
}
/** Pan with the left button on empty canvas or the middle button anywhere; a card drags with the left. */
const PAN_BUTTONS = [0, 1]
const SELECT_PAN_BUTTONS = [1]
const MIN_ZOOM = 0.1, MAX_ZOOM = 2
/** The camera's own framing never zooms in past the real size (V12 spec: a small board sits at 1.0, in Simple and in Detailed); a person may still zoom in themselves, up to MAX_ZOOM. */
export const FRAME_MAX_ZOOM = 1
/** How long a same-face camera move eases (ms). */
const DURATION = 400
/** How long cards can stay unpainted while the first layout settles. */
export const REVEAL_MS = 2500
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
  // Zoomed out the notice shares the foot row. The board's fit leaves room at the foot.
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

/** Detailed's readable full-face frame and Show's existing immediate refit. */
export function cameraFrame(snaps: Partial<Record<FaceRegime, FaceSnap>>, pane: { width: number; height: number }, free?: { top: number; right: number; bottom: number; left: number }, anchor?: string | null, simple = false): Viewport | null {
  const v = frameOf(snaps, pane, free, simple)
  // DL 07:48Z (3): at rest no card's label or figure is under the foot controls (footClear.ts); after the first approval, the aim in view.
  const nodes = (snaps.full ?? snaps.body ?? snaps.line)?.nodes
  if (v === null || nodes === undefined || simple) return v
  return restClearOfFoot(v, nodes, pane.height, frameTop((free ?? paddingToInsets(computeFitPadding())).top), anchor)
}

function frameOf(snaps: Partial<Record<FaceRegime, FaceSnap>>, pane: { width: number; height: number }, free?: { top: number; right: number; bottom: number; left: number }, simple = false): Viewport | null {
  // DL-538 (14 Nov, the target screen): the board OPENS on its readable full face, never on a zoomed-out face. Until the full face has been
  // drawn, it is drawn once at the top of its band to measure it. Then: the whole board where it fits in the full band; else the full face
  // as wide as the stage allows (within the band), its top under the free canvas's top; what does not fit is panned to, never shrunk.
  if (simple) { const n = snaps.full ?? snaps.body ?? snaps.line; return n === undefined ? null : showSimpleFrame(n.nodes, pane, free) }
  const full = snaps.full
  if (full === undefined) {
    const drawn = snaps.body ?? snaps.line
    return drawn === undefined ? null : atZoom(drawn.nodes, pane, free, FACE_RANGE.full[1])
  }
  const [lo, hi] = FACE_RANGE.full
  const whole = frameFor(full.nodes, pane, free, hi)
  if (whole !== null && whole.zoom >= lo) return whole
  return atZoom(full.nodes, pane, free, Math.max(lo, Math.min(hi, acrossZoom(full.nodes, pane, free))))
}

function showSimpleFrame(nodes: readonly Node[], pane: { width: number; height: number }, free: { top: number; right: number; bottom: number; left: number } | undefined): Viewport | null {
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

function useViewCamera(userMoved: React.MutableRefObject<boolean>, movedAt: React.MutableRefObject<number>) {
  const [framed, setFramed] = useState(false)
  const framedRef = useRef(false)
  const reveal = useCallback(() => { framedRef.current = true; setFramed(true) }, [])
  const holdsCards = useStore((s) => s.nodeLookup.size > 0)
  useEffect(() => {
    if (!holdsCards) return
    const timer = setTimeout(reveal, REVEAL_MS)
    return () => clearTimeout(timer)
  }, [holdsCards, reveal])

  const { getNodes, getViewport, setViewport } = useReactFlow()
  const width = useStore((s) => s.width), height = useStore((s) => s.height)
  const { layout, insetKey } = useLayoutSettled(isOlumiCoreLane())
  const lod = useRef<LodFrame>({ previous: undefined, probe: null })
  const active = useRef<AbortController | null>(null)
  const stop = useCallback(() => { active.current?.abort() }, [])
  useEffect(() => stop, [stop])

  const frame = useCallback(async (automatic: boolean, anchor?: string | null) => {
    stop()
    const request = new AbortController()
    active.current = request
    const { signal } = request
    const moves = movedAt.current
    const current = () => !signal.aborted && (automatic ? !userMoved.current : moves === movedAt.current)
    const simple = levelOf(useViewStore.getState().sid) === 'simple'
    const ideasOnly = useViewStore.getState().view?.model == null
    const initialRung = useCanvasStore.getState().lodRung
    const initialViewport = getViewport()
    const initialZoom = initialViewport.zoom
    let detailedProbe = false
    let far = false
    // Hold the transform while Simple lays out each face at the current row widths.
    const probe = () => {
      lod.current.probe = far ? 'line' : initialRung === 'quiet' ? 'quiet' : 'full'
      useCanvasStore.getState().setLodRung(lod.current.probe)
    }
    const releaseProbe = () => {
      if (lod.current.probe === null) return
      const rung = resolveLodRung(getViewport().zoom, initialRung)
      lod.current = { previous: rung, probe: null }
      useCanvasStore.getState().setLodRung(rung)
    }
    signal.addEventListener('abort', releaseProbe, { once: true })
    try {
      while (current()) {
        const snapshot = await layout.wait(signal)
        if (!current()) return
        if (snapshot === null) {
          if (detailedProbe) void setViewport(initialViewport, { duration: 0 })
          reveal()
          return
        }
        if (showHolds()) { releaseProbe(); far = false; continue }
        if (simple && snapshot.far !== far) {
          if (lod.current.probe === null) probe()
          continue
        }
        const nodes = frameNodesOf(snapshot.nodes, ideasOnly)
        const zoom = getViewport().zoom
        const face = faceRegimeOf(zoom)
        if (!simple && face === 'full' && snapshot.far) continue
        const vp = simple
          ? simpleFrameFor(getNodesBounds(nodes), snapshot.pane, snapshot.insets, far)
          : cameraFrame({ [face]: { zoom, nodes } }, snapshot.pane, snapshot.insets, anchor)
        if (layout.read()?.version !== snapshot.version) continue
        if (vp === null) {
          if (!simple || far) return
          far = true
          probe()
          continue
        }
        // A face change snaps so the seeded face never traverses a zoom band on the way to its landing.
        const changesFace = far !== (initialRung === 'line')
        const crossesBand = far !== (resolveLodRung(initialZoom, far ? 'line' : 'quiet') === 'line')
        const duration = !framedRef.current || (simple && (changesFace || crossesBand)) ? 0 : DURATION
        if (simple) {
          const rung = resolveLodRung(vp.zoom, far ? 'line' : lod.current.probe ?? initialRung)
          lod.current = { previous: rung, probe: null }
          useCanvasStore.getState().setLodRung(rung)
        }
        const probing = !simple && face !== 'full'
        const moving = setViewport(vp, { duration: probing ? 0 : duration })
        reveal()
        if (!probing) return
        detailedProbe = true
        await moving
      }
    } finally {
      signal.removeEventListener('abort', releaseProbe)
      if (active.current === request) {
        active.current = null
        releaseProbe()
      }
    }
  }, [getViewport, layout, movedAt, reveal, setViewport, stop, userMoved])

  const seen = useRef<BoardSeen | null>(null)
  const aim = useRef<string | null>(null)
  const lastVersion = useRef('')
  const level = useLevel()
  const version = useViewStore((s) => {
    const key = boardKeyOf(s.sid, s.view) || ideasBoardKeyOf(s.sid, s.view)
    return key === '' ? '' : `${key}|${openBadgesKeyOf(s.view)}|${level}`
  })
  useEffect(() => {
    if (version === '') { stop(); lastVersion.current = ''; return }
    if (version !== lastVersion.current) {
      lastVersion.current = version
      userMoved.current = false
      const now = useViewStore.getState().view
      aim.current = aimAfterFirstApproval(seen.current, now)
      seen.current = boardSeenOf(now)
    }
    if (!userMoved.current) void frame(true, aim.current)
  }, [version, width, height, insetKey, frame, stop, userMoved])

  // Show's refit keeps the port stable across resize and reads the pane when called.
  const flow = useStoreApi()
  const showFit = useCallback(() => {
    const { width, height } = flow.getState()
    const drawn = frameNodesOf(viewNodes(getNodes()), useViewStore.getState().view?.model == null)
    const zoom = getViewport().zoom
    const simple = levelOf(useViewStore.getState().sid) === 'simple'
    const vp = cameraFrame({ [simple ? 'full' : faceRegimeOf(zoom)]: { zoom, nodes: drawn } }, { width, height }, undefined, aim.current, simple)
    if (vp !== null) void setViewport(vp, { duration: DURATION })
    return vp
  }, [flow, getNodes, getViewport, setViewport])
  return { frame, framed, lod, showFit, stop }
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
  // The path lit while a card is hovered, else while one is selected (Paul, 21 Nov: highlight the path; everything else stays unchanged).
  const hovered = useViewHover((h) => h.id)
  const lit = useMemo(() => {
    if (!simple || view?.model == null) return null
    return causalPathOf(drawnModelOf(view.model), focusIdOf(stored, hovered, VIEW_CARD))
  }, [stored, hovered, simple, view])
  // The lit path is a module-wide store the links read: written while this canvas stands, dropped when it goes (a later canvas never inherits a highlight).
  useEffect(() => { useFocusPath.setState({ path: lit }); return () => useFocusPath.setState({ path: null }) }, [lit])
  const nodes = useMemo(() => {
    const base = withOpenCard(withChipsAbove(stored, chipCards), openCard)
    // Simple's layout scale fixes title wrapping and badge space within each face.
    const scaled = !simple ? base : base.map((n) => {
      const s = (n.data as { scale?: number }).scale
      return s === undefined ? n : { ...n, style: {
        ...n.style,
        '--o-s': s,
        '--canvas-label-scale': s,
        '--canvas-glyph-scale': s,
        '--canvas-small-label-scale': s,
        '--canvas-far-title-scale': Math.max(s, farTitleScale(CORE_LANE_FIT_FLOOR)),
      } as CSSProperties }
    })
    return markPath(scaled, lit, QUESTION, (n) => {
      const card = (n.data as { card?: ViewCard }).card
      return card != null && whoseOf(card) === 'olumi' ? 'olumi' : 'person'
    })
  }, [stored, chipCards, openCard, simple, lit])
  const edges = useCanvasStore((s) => s.edges)
  const onNodesChange = useCallback((changes: NodeChange[]) => useCanvasStore.getState().onNodesChange(changes), [])
  // The menu is one of the five surfaces the one surface store holds (v12/edit/inspectorStore): opening it closes what else was open.
  const menu = useLaneInspector((s) => (s.current !== null && s.current.kind === 'menu' ? s.current.target : null))
  const closeMenu = useCallback(() => { useLaneInspector.getState().close('menu') }, [])
  const setMenu = useCallback((t: ContextTarget) => { useLaneInspector.getState().show({ kind: 'menu', target: t }) }, [])
  const flowStore = useStoreApi()
  useEffect(() => {
    if (menu === null) return
    const selection = useCanvasStore.subscribe((next, prev) => {
      if (next.selection !== prev.selection) closeMenu()
    })
    const camera = flowStore.subscribe((next, prev) => {
      if (next.transform !== prev.transform) closeMenu()
    })
    return () => { selection(); camera() }
  }, [menu, closeMenu, flowStore])
  const { screenToFlowPosition } = useReactFlow()
  const userMoved = useRef(false)
  // Each move the person makes themselves: a card waiting to be brought in front never overrides one (checker, slice 2a).
  const movedAt = useRef(0)
  // When the person last moved the camera and whether a drag is under way (replyInView.ts: a reply never moves the board under their hand).
  const activity = useRef<Activity>({ at: 0, active: false })
  // Every control the person presses to move the camera says so through this one function (handOf, above).
  const hand = handOf(movedAt, activity)
  const { frame, framed, lod, showFit, stop } = useViewCamera(userMoved, movedAt)
  // An open claims the camera before its own settling timer starts.
  const claimCamera = useCallback(() => {
    userMoved.current = true
    handOf(movedAt, activity)()
    stop()
  }, [stop])
  useLayoutEffect(() => {
    const reveal = useReveal.subscribe((next, prev) => {
      if (next.opens !== prev.opens) claimCamera()
    })
    const inspector = useLaneInspector.subscribe((next, prev) => {
      const surface = next.current
      if (surface !== prev.current && surface?.kind === 'details' && surface.target.kind === 'card') claimCamera()
    })
    return () => { reveal(); inspector() }
  }, [claimCamera])
  // V11: the team's disagreement is brought into view once per reveal, never over the person's own move (./revealCamera.ts).
  useRevealInView(movedAt)
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
    return () => { claimCamera(); void setViewport(before, { duration: 0 }) }
  }), [claimCamera, getViewport, setViewport])
  // "Show in the workspace" under a reply (v12/showInWorkspace): its camera port, registered while the canvas is on the page. It runs no framing of
  // its own: it asks this canvas's `fit` and moves once as the person's own move. (`hand` is new each render and reads only refs: not a dependency,
  // as for the reveal-return above; a port registered again would let go of the place a show remembers.)
  useEffect(() => registerShowCameraPort(makeShowCameraPort({ getViewport, setViewport, getInternalNode, userMoved, hand, fit: showFit })), [getViewport, setViewport, getInternalNode, showFit])
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
      claimCamera()
      void setCenter(at.x + w / 2, at.y + h / 2, { zoom: getZoom(), duration: 300 })
    }
    go(120)
  }, () => undefined), [claimCamera, setCenter, getZoom, getInternalNode])
  const { zoomIn, zoomOut, zoomTo } = useReactFlow()
  const hasModel = useViewStore((s) => (s.view?.model?.cards.length ?? 0) > 0)
  const showGrid = useSettingsStore((s) => s.showGrid), gridSize = useSettingsStore((s) => s.gridSize), snapToGrid = useSettingsStore((s) => s.snapToGrid)
  const snapGrid = useMemo<[number, number]>(() => [gridSize, gridSize], [gridSize])
  useEffect(() => { useSettingsStore.getState().loadSettings() }, [])
  useEffect(() => {
    if (isOlumiCoreLane()) return installPlaceHost(lanePlaceHost)
  }, [])
  // Codex 008e #1: kept ideas with no model are the board (their band alone), so the welcome does not stand over them. The dock's own message
  // box takes the words then (DockComposer draws it whenever no welcome is up). No toolbar or model control is shown for a model that is not there.
  const ideasOnly = useViewStore((s) => s.view !== null && s.view.model == null && keptIdeasOf(s.view).length > 0)
  const level = useLevel()
  const mine = (e: unknown) => { if (e) { claimCamera(); activity.current = { at: Date.now(), active: true } } }
  const mineEnd = (e: unknown) => { if (e) activity.current = { at: Date.now(), active: false } }
  return (
    <>
      <ReactFlow snapToGrid={snapToGrid} snapGrid={snapGrid}
        // Paul's option inspector (audit F34): a press on an option card opens its details, as right-click "Open details" does.
        onNodeClick={(e, n) => {
          // The lane's own (the older look keeps its press as it was): a press on one of the card's own controls (its pencil, a quick action) or the open figure editor's panel, label and padding included, is that control's, never also "open details": it would close what the control just opened.
          if (isOlumiCoreLane() && e.target instanceof Element && e.target.closest('button, a, input, textarea, select, [data-card-action], [data-figure-edit-panel]') !== null) return
          if (opensCardDetails(n.id)) useLaneInspector.getState().open({ kind: 'card', id: n.id })
        }}
        onKeyDown={isOlumiCoreLane() ? (e) => {
          if ((e.key === 'Enter' || e.key === ' ') && e.target instanceof Element && e.target.classList.contains('react-flow__node')) {
            const id = e.target.getAttribute('data-id')
            if (id === null || !opensCardDetails(id)) return
            e.preventDefault()
            useLaneInspector.getState().open({ kind: 'card', id })
            return
          }
          if (e.key !== 'Enter') return
          if (!(e.target instanceof Element) || !e.target.matches(`.react-flow__edge-${VIEW_LINK}`)) return
          const id = focusedLinkOf(e.target)
          if (id === null) return
          e.preventDefault()
          useLaneInspector.getState().open({ kind: 'link', id })
        } : undefined}
        className={framed ? 'olumi-look' : 'olumi-look ok-board-unframed'} nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} onNodesChange={onNodesChange}
        onPaneContextMenu={(e) => { e.preventDefault(); setMenu({ kind: 'pane', screenPos: { x: e.clientX, y: e.clientY } }) }}
        onNodeContextMenu={(e, n) => {
          e.preventDefault()
          const m = useViewStore.getState().view?.model, card = m?.cards.find((c) => c.id === n.id)
          const nodeType = (n.id === QUESTION || card === undefined ? 'decision' : drawKindOf(card, m ?? null)) as NodeType
          useCanvasStore.getState().selectNodeWithoutHistory(n.id)
          setMenu({ kind: 'node', nodeId: n.id, nodeType, node: n, opener: contextMenuOpener(e), screenPos: { x: e.clientX, y: e.clientY } })
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
        nodesConnectable={false} edgesFocusable elevateEdgesOnSelect={false} deleteKeyCode={REACT_FLOW_DELETE_KEY_CODE} selectionKeyCode={null} multiSelectionKeyCode={null} panActivationKeyCode={null}
        proOptions={{ hideAttribution: true }} data-testid="view-canvas"
      >
        {/* The three-dot menu's canvas settings (Paul's audit, 17 Nov): show the grid at its size, and snap a moved card to it. */}
        {showGrid ? <Background variant={BackgroundVariant.Dots} gap={gridSize} /> : null}
        {/* The previous card frame's zoomed-out face and label scale (the two syncs the previous canvas mounts; they write no model state). */}
        <LodSync frame={lod} /><CanvasLabelScaleSync />
        {/* V12 Simple: the band labels, the "not linked" marks and the inputs' fold control, in the canvas's own coordinates (v12/bands). */}
        <BandLayer />
      </ReactFlow>
      <CanvasViewportControls
        onZoomIn={() => { claimCamera(); void zoomIn({ duration: 200 }) }}
        onZoomOut={() => { claimCamera(); void zoomOut({ duration: 200 }) }}
        onZoomReset={() => { claimCamera(); void zoomTo(1, { duration: 200 }) }}
        // Fit is the person's own deliberate move too: a reply's pending pan and pulse (replyInView.ts) are cancelled, and the camera stays theirs for QUIET_MS.
        // Bumping movedAt also releases any reveal, open-in-view or try-in-view pan still pending (revealCamera.ts), so none of them moves the camera after Fit: deliberate.
        // Bound by fitHandler.spec.tsx (this handler, on the real canvas) and replyInView.spec.tsx F1, F2 and F4 (what the refs it writes cancel).
        onFitView={() => { claimCamera(); void frame(false) }}
        onAutoArrange={() => { const model = useViewStore.getState().view?.model; clearLayoutUndo(); if (model) void placeViewCards(model) }}
      />
      {/* While a brief drafts, the empty board says so (plan v3 drafting state). */}
      {hasModel ? <LayingBoard /> : <DraftingBoard secondary={ideasOnly} />}
      {/* UI restore stage 1, row 4: a scenario waiting for its brief shows the welcome (logo and one composer) on the empty canvas. */}
      {hasModel || ideasOnly ? null : <ViewWelcome />}
      <IdeaPanel />
      {hasModel ? <LeftSidebar interactionMode={tool} onSelectClick={() => setTool((t) => t === 'select' ? 'hand' : 'select')}
        showUndo undoControl={<UndoControl />} layers={<LensesMenu />} toolShortcuts={false} addControl={<AddFigure />} /> : null}
      <LaneHelp />
      {/* Paul, 18 Nov ("one control row, no foot panel"): Simple | Detailed is in the left Lenses menu (v12/lenses/LensesMenu), and the team's
          Views and Compare views are icons on the lens bar's row (below). */}
      {hasModel ? <LayerCanvasStyle /> : null}
      {/* Paul, 17 Nov: no always-on key at the bottom right; the one key is "How to read this" in the left foot menu (ViewLegend, KeyLines). */}
      {/* Hand edits (the right-click menu's forms, the details panel and Undo's keys), inside the toast provider. */}
      <LaneEditingLayer />
      {/* The six lenses in the previous bar's place, every word and count core's (Paul 11 Nov withdrew Model · Explore · Team). */}
      {hasModel ? <ViewLensBar extra={<ViewsToggle view={view} marks={level !== 'simple'} />} /> : null}
      {hasModel ? <FootRow onPress={claimCamera} onZoom={claimCamera} edge={level === 'simple'} /> : null}
      {menu === null ? null : <CanvasContextMenu target={menu} onClose={closeMenu} screenToFlowPosition={screenToFlowPosition} interactionMode={tool} onSetInteractionMode={setTool} />}
      {/* The keyboard legend is LaneHelp's (above): one legend, one "?" listener. A second one here opened a second dialog under the first (surfaces step B). */}
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
                  {/* Paul, 19 Nov ("open on the question, with the aims beneath"): the Frame page over the canvas region, beside the dock. */}
                  <FrameStage />
                </div>
              </MaybeConversationProvider>
            </CanvasOverlayBandProvider>
          </OptionChanceCellProvider>
        </HighlightProvider>
      </ReactFlowProvider>
    </ToastProvider>
  )
}

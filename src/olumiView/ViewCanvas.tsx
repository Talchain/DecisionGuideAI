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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { LayerProvider } from '../canvas/components/LayerProvider'
import { HighlightProvider } from '../canvas/highlighting/HighlightContext'
import { OptionChanceCellProvider } from '../canvas/nodes/shared/OptionChanceCellProvider'
import { ToastProvider } from '../canvas/ToastContext'
import { MaybeConversationProvider } from '../canvas/ReactFlowGraph'
import { computeFitPadding } from '../canvas/utils/computeFitPadding'
import { paddingToInsets } from '../canvas/utils/cameraComfort'
import { focusedCardOf, focusedLinkOf, placeViewCards, useViewFocusCard, useViewFocusLink, useViewHover, ROOT_LINK, VIEW_CARD, VIEW_LINK, VIEW_QUESTION, viewLaying } from './canvas'
import { drawKindOf } from './layout'
import { boardKeyOf, CORE_LANE_FIT_FLOOR, openBadgesKeyOf, NOTICE_CLEAR_BOTTOM, READABLE_WHOLE_ZOOM, reducedFaceSize, wholeAtTopViewport } from './camera'
import { LOD_BODY_HIDDEN_ZOOM, LOD_BODY_RESTORED_ZOOM } from '../canvas/utils/zoomLegibility'
import { drawnHeightsKey, measuredOf, QUESTION, viewDrawnNodes } from './layout'
import { useViewStore } from './store'
import { CoreCard } from './previous/CoreCard'
import { RootLinkEdge } from './previous/RootLinkEdge'
import { LodSync } from '../canvas/components/LodSync'
import { CanvasLabelScaleSync } from '../canvas/components/CanvasLabelScaleSync'
import { useV10Lane } from './v10'
import { useDockFullHeight } from './dockFullHeight'
import { ViewLensBar } from './ViewLensBar'
import { AddFigure } from './AddFigure'
import { LeftSidebar } from '../components/layout/LeftSidebar'
import toolbarStyles from '../components/layout/CanvasFloatingToolbar.module.css'
import { BelowCue } from './BelowCue'
import { ViewZoomNotice } from './ViewZoomNotice'
import { frameTop, useCardClearOfRegions } from './regions'
import { DraftingBoard } from './DraftingBoard'
import { ViewWelcome } from './ViewWelcome'
import { ViewWhatIfKey } from './ViewWhatIfKey'
import { ViewTradeOffsKey } from './ViewTradeOffsKey'
import { ViewPreMortemKey } from './ViewPreMortemKey'
import { useOpenInView, useRevealInView, useTryInView } from './revealCamera'
import { useRevealLanding } from './revealLanding'
import { revealOf, useReveal, withChipsAbove, withOpenCard } from './reveal'
import { StrategyOverviewPage } from './strategy/overview/StrategyOverviewPage'
import { StrategyOverviewStage } from './strategy/overview/StrategyOverviewOpener'

// UI restore, 11 Nov (Paul: "the previous UI plugged into the alpha data model"): each card and the question are drawn on the previous
// product's card frame with core's words (./previous/CoreCard), on this canvas, so none of the previous canvas's own hooks run.
const nodeTypes = { [VIEW_CARD]: CoreCard, [VIEW_QUESTION]: CoreCard }
const edgeTypes = { [VIEW_LINK]: ViewLinkEdge, [ROOT_LINK]: RootLinkEdge }
/** Pan with the left button on empty canvas or the middle button anywhere; a card drags with the left. */
const PAN_BUTTONS = [0, 1]
const SELECT_PAN_BUTTONS = [1]
const MIN_ZOOM = 0.1, MAX_ZOOM = 2
/** How long a camera move eases (ms), and how many times one version may be framed (the first fit, then a re-fit per zoom change). */
const DURATION = 400, MAX_FITS = 5
/**
 * When the board is framed: once it has settled, or after a bounded wait however it stands (DL, A13f cold reopen at 1510×910: the board was
 * never framed, the question cut at the top and three cards under the dock). The wait is in time, not frames: a throttled pane draws about
 * 3 frames a second, so 300 frames was about 100 s. A pan or zoom by the person still ends it (the caller).
 */
export const FRAME_WAIT_MS = 1500
export const frameDue = (settled: boolean, waitedMs: number): boolean => settled || waitedMs >= FRAME_WAIT_MS

/** The View's nodes as drawn, with the store's measurements. */
const viewNodes = (nodes: readonly Node[]) => viewDrawnNodes(nodes, [VIEW_CARD, VIEW_QUESTION])

/**
 * The one camera rule for a board, in the free canvas (left of the dock, under the top bar): the WHOLE board, top-aligned and centred
 * across, never past 1 and never below the lane's floor (Paul, 10 Nov: the whole model in view at first open, as the previous product's).
 * Zoomed out, each card draws its reduced face (ViewCardNode), so the whole board stays readable.
 */
export function frameFor(nodes: readonly Node[], pane: { width: number; height: number }, free?: { top: number; right: number; bottom: number; left: number }, maxZoom = 1): Viewport | null {
  if (nodes.length === 0 || pane.width === 0) return null
  const bounds = getNodesBounds(nodes as Node[]), raw = free ?? paddingToInsets(computeFitPadding())
  // The frame's top is never above the head band (regions.ts frameTop), however early the padding was read.
  const insets = { ...raw, top: frameTop(raw.top) }
  const whole = wholeAtTopViewport(bounds, pane, insets, maxZoom, CORE_LANE_FIT_FLOOR)
  // Zoomed out the notice stands at the foot's middle (ViewZoomNotice): the board's foot clears it.
  return reducedFaceSize(whole.zoom) === 0 ? whole : wholeAtTopViewport(bounds, pane, { ...insets, bottom: Math.max(insets.bottom, NOTICE_CLEAR_BOTTOM) }, maxZoom, CORE_LANE_FIT_FLOOR)
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
export function cameraFrame(snaps: Partial<Record<FaceRegime, FaceSnap>>, pane: { width: number; height: number }, free?: { top: number; right: number; bottom: number; left: number }): Viewport | null {
  // DL-538 (14 Nov, the target screen): the board OPENS on its readable full face, never on a zoomed-out face. Until the full face has been
  // drawn, it is drawn once at the top of its band to measure it. Then: the whole board where it fits in the full band; else the full face
  // as wide as the stage allows (within the band), its top under the free canvas's top; what does not fit is panned to, never shrunk.
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

/** The zoom at which the board's width fills the free canvas across (its height not considered: what is below is panned to). */
function acrossZoom(nodes: readonly Node[], pane: { width: number; height: number }, free: { top: number; right: number; bottom: number; left: number } | undefined): number {
  if (nodes.length === 0 || pane.width === 0) return 1
  const bounds = getNodesBounds(nodes as Node[]), raw = free ?? paddingToInsets(computeFitPadding())
  return Math.max(1, pane.width - raw.left - raw.right) / Math.max(1, bounds.width)
}

/** The board framed at exactly `zoom` (top under the free canvas's top, centred across), to draw a face once and measure it. */
function atZoom(nodes: readonly Node[], pane: { width: number; height: number }, free: { top: number; right: number; bottom: number; left: number } | undefined, zoom: number): Viewport | null {
  if (nodes.length === 0 || pane.width === 0) return null
  const bounds = getNodesBounds(nodes as Node[]), raw = free ?? paddingToInsets(computeFitPadding())
  const insets = { ...raw, top: frameTop(raw.top) }, freeW = Math.max(1, pane.width - insets.left - insets.right)
  return { zoom, x: insets.left + freeW / 2 - (bounds.x + bounds.width / 2) * zoom, y: insets.top - bounds.y * zoom }
}

/**
 * Frames each version of core's model once its cards settle: every card measured, and its heights, places and the camera unchanged
 * across a frame (a measured signal; bounded). A new zoom can re-draw the cards' heights, so it frames again if the settled board
 * changed, at most `MAX_FITS` times; a pan or zoom by the person ends it.
 */
function useViewCamera(userMoved: React.MutableRefObject<boolean>): () => void {
  const { getNodes, getViewport, setViewport } = useReactFlow()
  const width = useStore((s) => s.width), height = useStore((s) => s.height)
  const pane = useRef({ width, height })
  pane.current = { width, height }
  // The board as last drawn with each face (`cameraFrame`); cleared per version.
  const snaps = useRef<Partial<Record<FaceRegime, FaceSnap>>>({})
  const fit = useCallback(() => {
    const drawn = viewNodes(getNodes()), zoom = getViewport().zoom
    if (drawn.length > 0) snaps.current = { ...snaps.current, [faceRegimeOf(zoom)]: { zoom, nodes: drawn.map((n) => ({ ...n, position: { ...n.position }, measured: { ...n.measured } })) } }
    const v = cameraFrame(snaps.current, pane.current)
    if (v) void setViewport(v, { duration: DURATION })
  }, [getNodes, getViewport, setViewport])
  // Each version (or first model), and each set of badges open on it: a badge opened or closed frames the board it changed to.
  const version = useViewStore((s) => { const k = boardKeyOf(s.sid, s.view); return k === '' ? '' : `${k}|${openBadgesKeyOf(s.view)}` })
  useEffect(() => {
    if (version === '') return
    userMoved.current = false
    snaps.current = {}
    let raf = 0, since = performance.now(), last = '', fitted = '', fits = 0
    const tick = () => {
      if (userMoved.current) return
      const cards = useViewStore.getState().view?.model?.cards ?? []
      const ids = new Set([QUESTION, ...cards.map((c) => c.id)])
      const drawn = measuredOf(getNodes(), ids)
      const board = `${drawnHeightsKey(drawn)}#${drawn.map((n) => `${n.position.x},${n.position.y}`).join('|')}`
      const now = `${board}@${getViewport().zoom}`
      const settled = drawn.length === ids.size && now === last && !viewLaying()
      last = now
      if (!frameDue(settled, performance.now() - since)) { raf = requestAnimationFrame(tick); return }
      if (drawn.length === 0 || board === fitted || fits >= MAX_FITS) return
      fit()
      fits += 1
      fitted = board
      since = performance.now()
      last = ''
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [version, fit, getNodes, getViewport, userMoved])
  // The free canvas changes size (the window, the dock): frame again, unless the person has taken the camera.
  useEffect(() => { if (!userMoved.current) fit() }, [width, height, fit, userMoved])
  return fit
}

function ViewFlow() {
  const [tool, setTool] = useState<'select' | 'hand'>('hand')
  const stored = useCanvasStore((s) => s.nodes)
  // V11: the card whose chip is open is marked `v11-open` on its node, so the coaching ring (ring.ts) steps out of it: one focus per screen.
  const openCard = useReveal((s) => s.card)
  const view = useViewStore((s) => s.view)
  const chipCards = useMemo(() => new Set(revealOf(view)?.cardChips.keys() ?? []), [view])
  const nodes = useMemo(() => withOpenCard(withChipsAbove(stored, chipCards), openCard), [stored, chipCards, openCard])
  const edges = useCanvasStore((s) => s.edges)
  const onNodesChange = useCallback((changes: NodeChange[]) => useCanvasStore.getState().onNodesChange(changes), [])
  // The previous product's right-click menu on the lane's canvas: its own items, those that reach core (ask Olumi in the chat, the card's
  // figure), the rest left out (useMenuItems.ts, lane.ts). Nothing is written here: every item asks Olumi in the chat.
  const [menu, setMenu] = useState<ContextTarget | null>(null)
  const legend = useKeyboardLegend()
  const { screenToFlowPosition } = useReactFlow()
  const userMoved = useRef(false)
  // Each move the person makes themselves: a card waiting to be brought in front never overrides one (checker, slice 2a).
  const movedAt = useRef(0)
  const fit = useViewCamera(userMoved)
  // V11: the team's disagreement is brought into view once per reveal, never over the person's own move (./revealCamera.ts).
  useRevealInView(movedAt)
  // P1 (DL 10 Nov): the dock lands on the contested card's panel, once per reveal (./revealLanding.ts).
  useRevealLanding()
  useOpenInView(movedAt)
  useTryInView(movedAt)
  // The z-order rule (./regions.ts): an opened card, its editor included, is moved clear of the head band, the foot controls and the dock.
  useCardClearOfRegions()
  // A Model tab row puts its card in front (`focusNodeById`): selected, and the camera centred on it at the zoom the person has. Only the
  // node focus is registered: the legacy fit and pan seams stay unregistered on this lane, so the applied-edit pulse never moves the
  // camera off the question and options (fit-real-model, bakery).
  const { setCenter, getZoom, getInternalNode } = useReactFlow()
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
      userMoved.current = true
      void setCenter(at.x + w / 2, at.y + h / 2, { zoom: getZoom(), duration: 300 })
    }
    go(120)
  }, () => undefined), [setCenter, getZoom, getInternalNode])
  const { zoomIn, zoomOut, zoomTo } = useReactFlow()
  const hasModel = useViewStore((s) => (s.view?.model?.cards.length ?? 0) > 0)
  const mine = (e: unknown) => { if (e) { userMoved.current = true; movedAt.current += 1 } }
  return (
    <>
      <ReactFlow
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
        onPaneClick={() => { useViewFocusLink.setState({ id: null }); useViewFocusCard.setState({ id: null }) }}
        onMoveStart={mine} selectionOnDrag={tool === 'select'} panOnDrag={tool === 'select' ? SELECT_PAN_BUTTONS : PAN_BUTTONS} minZoom={MIN_ZOOM} maxZoom={MAX_ZOOM}
        nodesConnectable={false} edgesFocusable elevateEdgesOnSelect={false} deleteKeyCode={REACT_FLOW_DELETE_KEY_CODE} selectionKeyCode={null} multiSelectionKeyCode={null}
        proOptions={{ hideAttribution: true }} data-testid="view-canvas"
      >
        <Background variant={BackgroundVariant.Dots} gap={16} />
        {/* The previous card frame's zoomed-out face and label scale (the two syncs the previous canvas mounts; they write no model state). */}
        <LodSync /><CanvasLabelScaleSync />
      </ReactFlow>
      <CanvasViewportControls
        onZoomIn={() => { userMoved.current = true; void zoomIn({ duration: 200 }) }}
        onZoomOut={() => { userMoved.current = true; void zoomOut({ duration: 200 }) }}
        onZoomReset={() => { userMoved.current = true; void zoomTo(1, { duration: 200 }) }}
        onFitView={() => { userMoved.current = false; fit() }}
        onAutoArrange={() => { const model = useViewStore.getState().view?.model; if (model) void placeViewCards(model) }}
      />
      {/* While a brief drafts, the empty board says so (plan v3 drafting state). */}
      {hasModel ? null : <DraftingBoard />}
      {/* UI restore stage 1, row 4: a scenario waiting for its brief shows the welcome (logo and one composer) on the empty canvas. */}
      {hasModel ? null : <ViewWelcome />}
      {hasModel ? <LeftSidebar className={toolbarStyles.neutralTools} interactionMode={tool} onSelectClick={() => setTool((t) => t === 'select' ? 'hand' : 'select')}
        showUndo={false} toolShortcuts={false} addControl={<AddFigure />} /> : null}
      {/* A board with cards below the window's foot says how many, and brings them up (V11 pixel pass, 9 Nov). */}
      {hasModel ? <BelowCue /> : null}
      {/* Paul, 10 Nov: zoomed out the cards draw less; the previous product's notice says so and zooms back in (./ViewZoomNotice.tsx). */}
      {hasModel ? <ViewZoomNotice onZoom={() => { userMoved.current = true }} /> : null}
      {/* The six lenses in the previous bar's place, every word and count core's (Paul 11 Nov withdrew Model · Explore · Team). */}
      {hasModel ? <ViewLensBar previousPlace /> : null}
      {hasModel ? <ViewWhatIfKey /> : null}
      {hasModel ? <ViewTradeOffsKey /> : null}
      {hasModel ? <ViewPreMortemKey /> : null}
      {menu === null ? null : <CanvasContextMenu target={menu} onClose={() => setMenu(null)} screenToFlowPosition={screenToFlowPosition} interactionMode={tool} onSetInteractionMode={setTool} />}
      <KeyboardLegend isOpen={legend.isOpen} onClose={legend.close} />
      <OlumiAttentionCard />
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
      <LayerProvider>
        <ReactFlowProvider>
          <HighlightProvider>
            <OptionChanceCellProvider>
              <CanvasOverlayBandProvider>
                <MaybeConversationProvider>
                  <div className="relative h-full w-full" data-testid="view-canvas-root">
                    <ViewFlow />
                    {/* Strategy lane (7 Nov, by agreement with the V11 build): the Overview stands over the stage while the header's opener holds it open. */}
                    <StrategyOverviewStage>{(view, close) => <StrategyOverviewPage view={view} onClose={close} />}</StrategyOverviewStage>
                  </div>
                </MaybeConversationProvider>
              </CanvasOverlayBandProvider>
            </OptionChanceCellProvider>
          </HighlightProvider>
        </ReactFlowProvider>
      </LayerProvider>
    </ToastProvider>
  )
}

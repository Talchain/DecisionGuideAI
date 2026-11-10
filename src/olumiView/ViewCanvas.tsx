/**
 * THE OLUMI-CORE LANE'S OWN CANVAS (DL 4 Nov: "draw the View on a small dedicated canvas"). The lane mounts this in place of the legacy
 * `ReactFlowGraph`: React Flow with only the View's cards, question and links, and one camera rule. None of the legacy canvas's hooks
 * run here, so nothing re-lays out, re-spreads or inspects core's cards (the three faults of 4 Nov were each legacy machinery acting on
 * them). Cards are placed as DGAI's causal graph (`causalPlaces`, via the dock's `useViewCanvas`); the person may pan, zoom and move a card.
 *
 * The camera: each version of core's model is framed once its cards are drawn and settled, readable first and whole when it fits
 * (`readableFirstViewport`) once the causal layout is in, and framed again if the new zoom changed the board, at most three times and never over the person's own
 * pan or zoom. The dock, the note and the zoom controls are the legacy canvas's own components, unchanged.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react'
import {
  Background, BackgroundVariant, ReactFlow, ReactFlowProvider, getNodesBounds, useReactFlow, useStore, type Node, type NodeChange, type Viewport,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useCanvasStore } from '../canvas/store'
import { REACT_FLOW_DELETE_KEY_CODE } from '../canvas/useKeyboardShortcuts'
import { registerFocusHelpers } from '../canvas/utils/focusHelpers'
import { ViewQuestionNode } from '../canvas/nodes/ViewQuestionNode'
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
import { focusedCardOf, focusedLinkOf, placeViewCards, useViewFocusCard, useViewFocusLink, useViewHover, VIEW_CARD, VIEW_LINK, VIEW_QUESTION, viewLaying } from './canvas'
import { boardKeyOf, readableFirstViewport, wholeAtTopViewport } from './camera'
import { drawnHeightsKey, headOf, measuredOf, QUESTION, viewDrawnNodes } from './layout'
import { useViewStore } from './store'
import { useV10Lane, ViewCardV10 } from './v10'
import { useDockFullHeight } from './dockFullHeight'
import { ViewLensBar } from './ViewLensBar'
import { AddFigure } from './AddFigure'
import { BelowCue } from './BelowCue'
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

// Each card is drawn with v10's controls (./v10): the card itself, and the Olumi corner that asks about it.
const nodeTypes = { [VIEW_CARD]: ViewCardV10, [VIEW_QUESTION]: ViewQuestionNode }
const edgeTypes = { [VIEW_LINK]: ViewLinkEdge }
/** Pan with the left button on empty canvas or the middle button anywhere; a card drags with the left. */
const PAN_BUTTONS = [0, 1]
const MIN_ZOOM = 0.1, MAX_ZOOM = 2
/** How long a camera move eases (ms), and how many times one version may be framed (the first fit, then a re-fit per zoom change). */
const DURATION = 400, MAX_FITS = 3

/** The View's nodes as drawn, with the store's measurements. */
const viewNodes = (nodes: readonly Node[]) => viewDrawnNodes(nodes, [VIEW_CARD, VIEW_QUESTION])

/**
 * The one camera rule for a board, in the free canvas (left of the dock, under the top bar): the board's width, top-aligned, when it
 * fits whole only below a readable zoom; else the whole board, top-aligned and centred across, never past 1 (J1 step 2).
 */
function frameFor(nodes: readonly Node[], pane: { width: number; height: number }): Viewport | null {
  if (nodes.length === 0 || pane.width === 0) return null
  const bounds = getNodesBounds(nodes as Node[]), padding = computeFitPadding()
  // The top of the causal graph, which the camera centres on when the board is too large to read whole: the question and the options.
  const model = useViewStore.getState().view?.model
  const head = model ? measuredOf(nodes, headOf(model)) : []
  // The frame's top is never above the head band (regions.ts frameTop), however early the padding was read.
  const raw = paddingToInsets(padding), insets = { ...raw, top: frameTop(raw.top) }
  // Too large to read whole: its top at the readable floor. Else whole, its top under the free canvas's top (J1 step 2, camera.ts).
  return readableFirstViewport(bounds, pane, insets, head.length > 0 ? getNodesBounds(head as Node[]) : bounds)
    ?? wholeAtTopViewport(bounds, pane, insets, 1)
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
  const fit = useCallback(() => {
    const v = frameFor(viewNodes(getNodes()), pane.current)
    if (v) void setViewport(v, { duration: DURATION })
  }, [getNodes, setViewport])
  const version = useViewStore((s) => boardKeyOf(s.sid, s.view))
  useEffect(() => {
    if (version === '') return
    userMoved.current = false
    let raf = 0, frames = 0, last = '', fitted = '', fits = 0
    const tick = () => {
      if (userMoved.current) return
      const cards = useViewStore.getState().view?.model?.cards ?? []
      const ids = new Set([QUESTION, ...cards.map((c) => c.id)])
      const drawn = measuredOf(getNodes(), ids)
      const board = `${drawnHeightsKey(drawn)}#${drawn.map((n) => `${n.position.x},${n.position.y}`).join('|')}`
      const now = `${board}@${getViewport().zoom}`
      const settled = drawn.length === ids.size && now === last && !viewLaying()
      last = now
      if (!settled && ++frames < 300) { raf = requestAnimationFrame(tick); return }
      if (drawn.length === 0 || board === fitted || fits >= MAX_FITS) return
      fit()
      fits += 1
      fitted = board
      frames = 0
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
  const stored = useCanvasStore((s) => s.nodes)
  // V11: the card whose chip is open is marked `v11-open` on its node, so the coaching ring (ring.ts) steps out of it: one focus per screen.
  const openCard = useReveal((s) => s.card)
  const view = useViewStore((s) => s.view)
  const chipCards = useMemo(() => new Set(revealOf(view)?.cardChips.keys() ?? []), [view])
  const nodes = useMemo(() => withOpenCard(withChipsAbove(stored, chipCards), openCard), [stored, chipCards, openCard])
  const edges = useCanvasStore((s) => s.edges)
  const onNodesChange = useCallback((changes: NodeChange[]) => useCanvasStore.getState().onNodesChange(changes), [])
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
        nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} onNodesChange={onNodesChange}
        onNodeMouseEnter={(_, n) => useViewHover.setState({ id: n.id })} onNodeMouseLeave={() => useViewHover.setState({ id: null })}
        // A press on the empty canvas lets go of any card or link held by focus (a removed control fires no blur).
        onPaneClick={() => { useViewFocusLink.setState({ id: null }); useViewFocusCard.setState({ id: null }) }}
        onMoveStart={mine} panOnDrag={PAN_BUTTONS} minZoom={MIN_ZOOM} maxZoom={MAX_ZOOM}
        nodesConnectable={false} edgesFocusable elevateEdgesOnSelect={false} deleteKeyCode={REACT_FLOW_DELETE_KEY_CODE} selectionKeyCode={null} multiSelectionKeyCode={null}
        proOptions={{ hideAttribution: true }} data-testid="view-canvas"
      >
        <Background variant={BackgroundVariant.Dots} gap={16} />
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
      {/* R25 slice 2: the board's own control to add a figure card in the person's words (core's …/figures), above the zoom controls. */}
      {/* The canvas's head controls sit on an opaque band (DL round 5): a card panned up goes under it. */}
      {hasModel ? <AddFigure /> : null}
      {/* A board with cards below the window's foot says how many, and brings them up (V11 pixel pass, 9 Nov). */}
      {hasModel ? <BelowCue /> : null}
      {/* V11 navigation (Paul 6 Nov): Model, Explore, Team; drop `nav` for the six lens pills. */}
      {hasModel ? <ViewLensBar nav /> : null}
      {hasModel ? <ViewWhatIfKey /> : null}
      {hasModel ? <ViewTradeOffsKey /> : null}
      {hasModel ? <ViewPreMortemKey /> : null}
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

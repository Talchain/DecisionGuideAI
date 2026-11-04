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
import { useCallback, useEffect, useRef } from 'react'
import {
  Background, BackgroundVariant, ReactFlow, ReactFlowProvider, getNodesBounds, useReactFlow, useStore, type Node, type NodeChange, type Viewport,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useCanvasStore } from '../canvas/store'
import { REACT_FLOW_DELETE_KEY_CODE } from '../canvas/useKeyboardShortcuts'
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
import { viewportCentredInFreePane } from '../canvas/utils/fitIntoFreePane'
import { placeViewCards, useViewHover, VIEW_CARD, VIEW_LINK, VIEW_QUESTION, viewLaying } from './canvas'
import { readableFirstViewport } from './camera'
import { drawnHeightsKey, headOf, measuredOf, QUESTION, viewDrawnNodes } from './layout'
import { useViewStore } from './store'
import { useV10Lane, ViewCardV10 } from './v10'
import { ViewLensBar } from './ViewLensBar'

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
 * fits whole only below a readable zoom; else the whole board, centred, never past 1.
 */
function frameFor(nodes: readonly Node[], pane: { width: number; height: number }): Viewport | null {
  if (nodes.length === 0 || pane.width === 0) return null
  const bounds = getNodesBounds(nodes as Node[]), padding = computeFitPadding()
  // The top of the causal graph, which the camera centres on when the board is too large to read whole: the question and the options.
  const model = useViewStore.getState().view?.model
  const head = model ? measuredOf(nodes, headOf(model)) : []
  return readableFirstViewport(bounds, pane, paddingToInsets(padding), head.length > 0 ? getNodesBounds(head as Node[]) : bounds)
    ?? viewportCentredInFreePane({ bounds, pane, padding, minZoom: MIN_ZOOM, maxZoom: 1 })
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
  const version = useViewStore((s) => (s.sid !== null && s.view?.version ? `${s.sid}:${s.view.version.id}` : ''))
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
  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)
  const onNodesChange = useCallback((changes: NodeChange[]) => useCanvasStore.getState().onNodesChange(changes), [])
  const userMoved = useRef(false)
  const fit = useViewCamera(userMoved)
  const { zoomIn, zoomOut, zoomTo } = useReactFlow()
  const hasModel = useViewStore((s) => (s.view?.model?.cards.length ?? 0) > 0)
  const mine = (e: unknown) => { if (e) userMoved.current = true }
  return (
    <>
      <ReactFlow
        nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} onNodesChange={onNodesChange}
        onNodeMouseEnter={(_, n) => useViewHover.setState({ id: n.id })} onNodeMouseLeave={() => useViewHover.setState({ id: null })}
        onMoveStart={mine} panOnDrag={PAN_BUTTONS} minZoom={MIN_ZOOM} maxZoom={MAX_ZOOM}
        nodesConnectable={false} edgesFocusable={false} elevateEdgesOnSelect={false} deleteKeyCode={REACT_FLOW_DELETE_KEY_CODE} selectionKeyCode={null} multiSelectionKeyCode={null}
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
      {hasModel ? <ViewLensBar /> : null}
      <OlumiAttentionCard />
      <OutputsDock />
    </>
  )
}

/** The lane's canvas with the providers its dock and note read (the same ones the legacy canvas gives them). */
export function ViewCanvas(): JSX.Element {
  useV10Lane()
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

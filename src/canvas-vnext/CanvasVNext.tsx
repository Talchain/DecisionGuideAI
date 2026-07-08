// Graph Experience vNext — opt-in alternative rendering of the same canvas
// graph. Default export, loaded ONLY via CanvasMVP's dynamic import (bundle
// fence). The current graph stays the default; this surface is read-mostly
// by construction:
//   - onNodesChange/onEdgesChange are NOT wired to the store
//   - nodesDraggable/nodesConnectable/edgesReconnectable are off,
//     deleteKeyCode is null, elementsSelectable is off
//   - selection/pinning live in vNext-local context (mode/contexts)
//   - the ONLY store-facing module is vm/useGraphExperienceVM
//
// OutputsDock mounts inside this surface (Paul's decision 1) so Analysis→
// graph pointing and Run/Rerun reuse the existing pipeline unchanged. Under
// aiPanelV2 it requires a ConversationProvider ancestor — replicated here
// exactly like RFG's MaybeConversationProvider (exactly ONE useConversation
// instance may be mounted at runtime; RFG is unmounted while this surface
// renders, so the invariant holds).

import { useMemo, useState, type ReactNode } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  MarkerType,
  type Node,
  type Edge,
  type EdgeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { isAiPanelV2Enabled } from '../flags'
import { ConversationProvider } from '../canvas/conversation/ConversationContext'
import { OutputsDock } from '../canvas/components/OutputsDock'
import { useGuidancePulseHighlight } from '../canvas/hooks/useGuidancePulseHighlight'
import {
  GraphExperienceVMProvider,
  useGraphExperienceVMContext,
  useVNextGraphInputs,
} from './vm/useGraphExperienceVM'
import { VNextSelectionProvider, useVNextSelection } from './mode/contexts'
import { VNextTopStrip } from './VNextTopStrip'
import { VNextViewportControls } from './controls/VNextViewportControls'
import { vnextNodeTypes } from './nodes/registry'
import { VNextEdge } from './edges/VNextEdge'
import { useVNextFocus } from './hooks/useVNextFocus'
import { demoNodes, demoEdges, buildDemoVM } from './fixtures'
import type { GraphExperienceVM } from './vm/types'

const vnextEdgeTypes: EdgeTypes = { vnext: VNextEdge }

export interface CanvasVNextProps {
  onExit: () => void
}

function MaybeConversationProvider({ children }: { children: ReactNode }) {
  if (isAiPanelV2Enabled()) {
    return <ConversationProvider>{children}</ConversationProvider>
  }
  return <>{children}</>
}

function VNextEmptyState({ onExit, onLoadDemo }: { onExit: () => void; onLoadDemo: () => void }) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center" data-testid="vnext-empty-state">
      <div className="w-80 rounded-lg border border-panel-border bg-panel p-5 text-center shadow-sm">
        <h2 className="text-sm font-semibold text-text-body">No decision map here yet</h2>
        <p className="mt-1 text-xs text-text-light">
          The preview shows the decision you are already working on. Start one in the standard canvas, or explore an
          example map.
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <button
            type="button"
            data-testid="vnext-open-standard"
            onClick={onExit}
            className="rounded-md bg-primary px-3 py-1.5 text-xs text-text-on-color"
          >
            Open standard canvas
          </button>
          <button
            type="button"
            data-testid="vnext-load-demo"
            onClick={onLoadDemo}
            className="rounded-md border border-panel-border bg-panel px-3 py-1.5 text-xs text-text-body hover:bg-panel-hover"
          >
            Load demo map
          </button>
        </div>
      </div>
    </div>
  )
}

function VNextFlow({ nodes, edges }: { nodes: Node[]; edges: Edge[] }) {
  const vm = useGraphExperienceVMContext()
  const { selectNode, pinEdge, clear } = useVNextSelection()

  useVNextFocus()
  useGuidancePulseHighlight()

  // Derived, read-only copies: strip any selection residue from the store and
  // route every edge through the vNext renderer (store edges may carry
  // type 'styled', 'default', or none). Direction arrowheads are added here,
  // stroke-coloured per polarity; structural edges get none.
  const derivedNodes = useMemo(() => nodes.map((n) => ({ ...n, selected: false })), [nodes])
  const derivedEdges = useMemo(
    () =>
      edges.map((e) => {
        const visual = vm.edgeVisuals[e.id]
        return {
          ...e,
          type: 'vnext',
          selected: false,
          markerEnd:
            visual && !visual.isStructural
              ? { type: MarkerType.ArrowClosed, width: 16, height: 16, color: visual.strokeColor }
              : undefined,
        }
      }),
    [edges, vm.edgeVisuals],
  )

  return (
    <ReactFlow
      nodes={derivedNodes}
      edges={derivedEdges}
      nodeTypes={vnextNodeTypes}
      edgeTypes={vnextEdgeTypes}
      nodesDraggable={false}
      nodesConnectable={false}
      edgesReconnectable={false}
      elementsSelectable={false}
      deleteKeyCode={null}
      fitView
      minZoom={0.2}
      onNodeClick={(_, node) => selectNode(node.id)}
      onEdgeClick={(_, edge) => pinEdge(edge.id)}
      onPaneClick={clear}
      proOptions={{ hideAttribution: true }}
    >
      <Background gap={16} />
    </ReactFlow>
  )
}

function CanvasVNextBody({ onExit }: CanvasVNextProps) {
  const { nodes: liveNodes, edges: liveEdges } = useVNextGraphInputs()
  const [demoLoaded, setDemoLoaded] = useState(false)

  // The demo map is vNext-local fixture state: rendered directly, NEVER
  // written into useCanvasStore. Its VM replaces the live VM wholesale and
  // carries provenance 'fixture' (persistent "Example data" pill).
  const fixtureVM: GraphExperienceVM | null = useMemo(() => (demoLoaded ? buildDemoVM() : null), [demoLoaded])
  const nodes = demoLoaded ? demoNodes : liveNodes
  const edges = demoLoaded ? demoEdges : liveEdges
  const showEmptyState = !demoLoaded && liveNodes.length === 0

  return (
    <GraphExperienceVMProvider fixtureVM={fixtureVM}>
      <MaybeConversationProvider>
        <div className="relative h-full w-full" data-testid="vnext-root">
          <VNextFlow nodes={nodes} edges={edges} />
          <VNextTopStrip onExit={onExit} />
          {showEmptyState && <VNextEmptyState onExit={onExit} onLoadDemo={() => setDemoLoaded(true)} />}
          <VNextViewportControls />
          {/* Dock only alongside LIVE data: pairing real results chrome with
              fixture content would blur the example-data fence. */}
          {!demoLoaded && !showEmptyState && <OutputsDock />}
        </div>
      </MaybeConversationProvider>
    </GraphExperienceVMProvider>
  )
}

export default function CanvasVNext({ onExit }: CanvasVNextProps) {
  return (
    <ReactFlowProvider>
      <VNextSelectionProvider>
        <CanvasVNextBody onExit={onExit} />
      </VNextSelectionProvider>
    </ReactFlowProvider>
  )
}

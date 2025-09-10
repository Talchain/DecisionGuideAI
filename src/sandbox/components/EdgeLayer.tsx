import React from 'react';
import { EdgeOverlayPill } from './EdgeOverlayPill';
import type { Node as SandboxNode, Edge } from '../../types/sandbox';

interface EdgeLayerProps {
  nodes: SandboxNode[];
  edges: Edge[];
  selectedEdge: Edge | null;
  // Legacy/compat props kept optional for tests/callers; not used internally
  setSelectedEdge?: (edge: Edge | null) => void;
  setSelectedNode?: (node: SandboxNode | null) => void;
  toolbarPos?: { x: number; y: number };
  setToolbarPos?: (pos: { x: number; y: number }) => void;
  onEdgeClick: (edge: Edge, e: React.MouseEvent<SVGPathElement>) => void;
  onEdgeContext: (edge: Edge, e: React.MouseEvent<SVGPathElement>) => void;
  onShowComments?: (id: string, opts?: { type?: 'node' | 'edge' }) => void;
  updateEdgeLikelihood?: (edgeId: string, likelihood: number) => void;
  dragPositions?: Record<string, { x: number; y: number }>;
}

export const EdgeLayer: React.FC<EdgeLayerProps> = ({
  nodes,
  edges,
  selectedEdge,
  onEdgeClick,
  onEdgeContext,
  onShowComments,
  updateEdgeLikelihood,
  dragPositions = {},
}) => {
  // Local state to track which edge overlay is hovered/focused
  const [hoveredEdgeId, setHoveredEdgeId] = React.useState<string | null>(null);
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none">
      <defs>
        <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" className="fill-purple-500" />
        </marker>
        <marker id="arrowhead-selected" markerWidth="12" markerHeight="8" refX="10" refY="4" orient="auto">
          <polygon points="0 0, 12 4, 0 8" className="fill-purple-700" />
        </marker>
      </defs>
      {(edges || []).map(edge => {
        const src = (nodes || []).find(n => n.id === edge.source);
        const tgt = (nodes || []).find(n => n.id === edge.target);
        if (!src || !tgt) return null;

        // Node dimensions must match NodeLayer constants
        const NODE_WIDTH = 256;
        const NODE_HEIGHT = 130;

        // Helper to get anchor point; handle must be respected as passed
        const getAnchor = (
          node: SandboxNode,
          handle: 'left' | 'right' | 'bottom' | 'top'
        ) => {
          const pos = dragPositions[node.id] ?? { x: node.x, y: node.y };
          const x = pos.x;
          const y = pos.y;
          switch (handle) {
            case 'left':
              return { x: x, y: y + NODE_HEIGHT / 2 };
            case 'right':
              return { x: x + NODE_WIDTH, y: y + NODE_HEIGHT / 2 };
            case 'bottom':
              return { x: x + NODE_WIDTH / 2, y: y + NODE_HEIGHT };
            case 'top':
            default:
              return { x: x + NODE_WIDTH / 2, y: y };
          }
        };

        // Legacy fallback: infer handles based on relative positions when not persisted
        function inferHandleFromRelative(
          other: { x: number; y: number },
          self: { x: number; y: number }
        ): 'left' | 'right' | 'bottom' | 'top' {
          const dx = other.x - self.x;
          const dy = other.y - self.y;
          if (Math.abs(dx) >= Math.abs(dy)) {
            return dx >= 0 ? 'right' : 'left';
          }
          return dy >= 0 ? 'bottom' : 'top';
        }

        const srcPos = dragPositions[src.id] ?? { x: src.x, y: src.y };
        const tgtPos = dragPositions[tgt.id] ?? { x: tgt.x, y: tgt.y };
        const srcHandle: 'left' | 'right' | 'bottom' | 'top' =
          (edge as any).sourceHandle ?? inferHandleFromRelative(tgtPos, srcPos);
        const tgtHandle: 'left' | 'right' | 'bottom' | 'top' =
          (edge as any).targetHandle ?? inferHandleFromRelative(srcPos, tgtPos);

        const sourceAnchor = getAnchor(src, srcHandle);
        const targetAnchor = getAnchor(tgt, tgtHandle);
        const midX = (sourceAnchor.x + targetAnchor.x) / 2;
        const midY = (sourceAnchor.y + targetAnchor.y) / 2;
        const d = `M${sourceAnchor.x},${sourceAnchor.y} Q${midX},${midY} ${targetAnchor.x},${targetAnchor.y}`;
        const sel = selectedEdge?.id === edge.id;

        return (
          <g key={edge.id}>
            {/* Invisible, thick hit area for easy edge selection */}
            <path
              d={d}
              fill="none"
              stroke="transparent"
              strokeWidth={20}
              className="pointer-events-auto"
              onClick={e => onEdgeClick(edge, e)}
              onContextMenu={e => onEdgeContext(edge, e)}
            />
            {/* The actual visible edge line */}
            <path
              d={d}
              fill="none"
              stroke={sel ? '#6d28d9' : '#8b5cf6'}
              strokeWidth={sel ? 3 : 2}
              strokeLinecap="round"
              markerEnd={`url(#${sel ? 'arrowhead-selected' : 'arrowhead'})`}
            />
            {/* Unified pill overlay for edge controls */}
            <foreignObject
              x={midX - 32}
              y={midY - 20}
              width={80}
              height={40}
              style={{ overflow: 'visible', pointerEvents: 'auto' }}
            >
              <EdgeOverlayPill
                edge={edge}
                likelihood={typeof edge.likelihood === 'number' ? edge.likelihood : 50}
                selected={sel}
                hovered={hoveredEdgeId === edge.id}
                onLikelihoodUpdate={updateEdgeLikelihood}
                onShowComments={(id, opts) => onShowComments?.(id, opts)}
                onPillFocus={() => setHoveredEdgeId(edge.id)}
                onPillBlur={() => setHoveredEdgeId(null)}
              />
            </foreignObject>
          </g>
        );
      })}
    </svg>
  );
};

export default EdgeLayer;
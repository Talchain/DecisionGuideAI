import React from 'react';
import { render, screen } from '@testing-library/react';
import { EdgeLayer } from '../components/EdgeLayer';
import type { Node as SandboxNode, Edge } from '../../types/sandbox';

// Constants must mirror NodeLayer/EdgeLayer
const NODE_WIDTH = 256;
const NODE_HEIGHT = 130;

function anchor(node: { x: number; y: number }, handle: 'left' | 'right' | 'bottom' | 'top' = 'right') {
  switch (handle) {
    case 'left':
      return { x: node.x, y: node.y + NODE_HEIGHT / 2 };
    case 'right':
      return { x: node.x + NODE_WIDTH, y: node.y + NODE_HEIGHT / 2 };
    case 'bottom':
      return { x: node.x + NODE_WIDTH / 2, y: node.y + NODE_HEIGHT };
    case 'top':
      return { x: node.x + NODE_WIDTH / 2, y: node.y };
    default:
      return { x: node.x + NODE_WIDTH, y: node.y + NODE_HEIGHT / 2 };
  }
}

function inferHandleFromRelative(other: { x: number; y: number }, self: { x: number; y: number }): 'left'|'right'|'bottom'|'top' {
  const dx = other.x - self.x;
  const dy = other.y - self.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? 'right' : 'left';
  }
  return dy >= 0 ? 'bottom' : 'top';
}

function expectedD(src: { x: number; y: number }, tgt: { x: number; y: number }, srcHandle?: 'left' | 'right' | 'bottom' | 'top', tgtHandle?: 'left' | 'right' | 'bottom' | 'top') {
  const sh = srcHandle ?? inferHandleFromRelative(tgt, src);
  const th = tgtHandle ?? inferHandleFromRelative(src, tgt);
  const a = anchor(src, sh);
  const b = anchor(tgt, th);
  const midX = (a.x + b.x) / 2;
  const midY = (a.y + b.y) / 2;
  return `M${a.x},${a.y} Q${midX},${midY} ${b.x},${b.y}`;
}

describe('Edge sync during drag', () => {
  const nodeA: SandboxNode = { id: 'A', type: 'default' as any, x: 100, y: 100, label: 'A' };
  const nodeB: SandboxNode = { id: 'B', type: 'default' as any, x: 500, y: 200, label: 'B' };
  const edgeAB: Edge = { id: 'e1', source: 'A', target: 'B', likelihood: 50 } as any;

  function renderLayer(dragPositions?: Record<string, { x: number; y: number }>) {
    const res = render(
      <svg data-testid="host" className="w-full h-full">
        <EdgeLayer
          nodes={[nodeA, nodeB]}
          edges={[edgeAB]}
          selectedEdge={null}
          setSelectedEdge={() => {}}
          setSelectedNode={() => {}}
          toolbarPos={{ x: 0, y: 0 }}
          setToolbarPos={() => {}}
          onEdgeClick={() => {}}
          onEdgeContext={() => {}}
          onShowComments={() => {}}
          updateEdgeLikelihood={() => {}}
          dragPositions={dragPositions}
        />
      </svg>
    );
    // visible edge is the path with a stroke color
    const path = res.container.querySelector('path[stroke]') as SVGPathElement;
    return { ...res, path };
  }

  test('Edges track during drag (d attribute updates with dragPositions)', () => {
    const startPos = { x: nodeA.x, y: nodeA.y };
    const { rerender, path } = renderLayer({ [nodeA.id]: startPos });
    const initialD = path.getAttribute('d');
    expect(initialD).toBe(
      expectedD(startPos, { x: nodeB.x, y: nodeB.y })
    );

    // Move A a few times; ensure d updates immediately with props
    const p1 = { x: 120, y: 140 };
    rerender(
      <svg>
        <EdgeLayer
          nodes={[nodeA, nodeB]}
          edges={[edgeAB]}
          selectedEdge={null}
          setSelectedEdge={() => {}}
          setSelectedNode={() => {}}
          toolbarPos={{ x: 0, y: 0 }}
          setToolbarPos={() => {}}
          onEdgeClick={() => {}}
          onEdgeContext={() => {}}
          onShowComments={() => {}}
          updateEdgeLikelihood={() => {}}
          dragPositions={{ [nodeA.id]: p1 }}
        />
      </svg>
    );
    expect(path.getAttribute('d')).toBe(expectedD(p1, { x: nodeB.x, y: nodeB.y }));

    const p2 = { x: 180, y: 80 };
    rerender(
      <svg>
        <EdgeLayer
          nodes={[nodeA, nodeB]}
          edges={[edgeAB]}
          selectedEdge={null}
          setSelectedEdge={() => {}}
          setSelectedNode={() => {}}
          toolbarPos={{ x: 0, y: 0 }}
          setToolbarPos={() => {}}
          onEdgeClick={() => {}}
          onEdgeContext={() => {}}
          onShowComments={() => {}}
          updateEdgeLikelihood={() => {}}
          dragPositions={{ [nodeA.id]: p2 }}
        />
      </svg>
    );
    expect(path.getAttribute('d')).toBe(expectedD(p2, { x: nodeB.x, y: nodeB.y }));
  });

  test('Final commit matches persisted position after clearing dragPositions', () => {
    // Simulate dragging then dropping to new position
    const drop = { x: 260, y: 260 };
    const { rerender, path } = renderLayer({ [nodeA.id]: drop });
    expect(path.getAttribute('d')).toBe(expectedD(drop, { x: nodeB.x, y: nodeB.y }));

    // Clear dragPositions (drop ended), persist new nodeA position
    const persistedA = { ...nodeA, x: drop.x, y: drop.y } as SandboxNode;
    rerender(
      <svg>
        <EdgeLayer
          nodes={[persistedA, nodeB]}
          edges={[edgeAB]}
          selectedEdge={null}
          setSelectedEdge={() => {}}
          setSelectedNode={() => {}}
          toolbarPos={{ x: 0, y: 0 }}
          setToolbarPos={() => {}}
          onEdgeClick={() => {}}
          onEdgeContext={() => {}}
          onShowComments={() => {}}
          updateEdgeLikelihood={() => {}}
          dragPositions={{}}
        />
      </svg>
    );
    expect(path.getAttribute('d')).toBe(expectedD({ x: persistedA.x, y: persistedA.y }, { x: nodeB.x, y: nodeB.y }));
  });

  test('No flicker when not dragging (stable d across identical renders)', () => {
    const { rerender, path } = renderLayer();
    const d1 = path.getAttribute('d');
    rerender(
      <svg>
        <EdgeLayer
          nodes={[nodeA, nodeB]}
          edges={[edgeAB]}
          selectedEdge={null}
          setSelectedEdge={() => {}}
          setSelectedNode={() => {}}
          toolbarPos={{ x: 0, y: 0 }}
          setToolbarPos={() => {}}
          onEdgeClick={() => {}}
          onEdgeContext={() => {}}
          onShowComments={() => {}}
          updateEdgeLikelihood={() => {}}
          dragPositions={{}}
        />
      </svg>
    );
    const d2 = path.getAttribute('d');
    expect(d2).toBe(d1);
  });
});

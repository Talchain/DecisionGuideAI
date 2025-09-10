import { render } from '@testing-library/react';
import { EdgeLayer } from '../components/EdgeLayer';
import type { Node as SandboxNode, Edge, Handle } from '../../types/sandbox';

// Keep in sync with NodeLayer/EdgeLayer
const NODE_WIDTH = 256;
const NODE_HEIGHT = 130;

function anchor(node: { x: number; y: number }, handle: Handle) {
  switch (handle) {
    case 'left':
      return { x: node.x, y: node.y + NODE_HEIGHT / 2 };
    case 'right':
      return { x: node.x + NODE_WIDTH, y: node.y + NODE_HEIGHT / 2 };
    case 'bottom':
      return { x: node.x + NODE_WIDTH / 2, y: node.y + NODE_HEIGHT };
    case 'top':
    default:
      return { x: node.x + NODE_WIDTH / 2, y: node.y };
  }
}

function expectedD(src: { x: number; y: number }, tgt: { x: number; y: number }, sh: Handle, th: Handle) {
  const a = anchor(src, sh);
  const b = anchor(tgt, th);
  const midX = (a.x + b.x) / 2;
  const midY = (a.y + b.y) / 2;
  return `M${a.x},${a.y} Q${midX},${midY} ${b.x},${b.y}`;
}

function inferHandleFromRelative(other: { x: number; y: number }, self: { x: number; y: number }): Handle {
  const dx = other.x - self.x;
  const dy = other.y - self.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? 'right' : 'left';
  }
  return dy >= 0 ? 'bottom' : 'top';
}

describe('Edge anchoring with persisted handles', () => {
  const A: SandboxNode = { id: 'A', type: 'decision', x: 100, y: 100, label: 'A' };
  const B: SandboxNode = { id: 'B', type: 'option', x: 480, y: 140, label: 'B' };
  const C: SandboxNode = { id: 'C', type: 'outcome', x: 100, y: 360, label: 'C' };

  test('Respects persisted handles even after node drag', () => {
    const sh: Handle = 'right';
    const th: Handle = 'left';
    const e: Edge = { id: 'eAB', source: 'A', target: 'B', sourceHandle: sh, targetHandle: th } as any;
    const { container, rerender } = render(
      <svg>
        <EdgeLayer
          nodes={[A, B]}
          edges={[e]}
          selectedEdge={null}
          setSelectedEdge={() => {}}
          setSelectedNode={() => {}}
          toolbarPos={{ x: 0, y: 0 }}
          setToolbarPos={() => {}}
          onEdgeClick={() => {}}
          onEdgeContext={() => {}}
          updateEdgeLikelihood={() => {}}
          dragPositions={{}}
        />
      </svg>
    );
    const path = container.querySelector('path[stroke]') as SVGPathElement;
    expect(path).toBeTruthy();
    expect(path.getAttribute('d')).toBe(expectedD({ x: A.x, y: A.y }, { x: B.x, y: B.y }, sh, th));

    // Drag A to new position; handles should remain same
    const dragA = { x: 300, y: 80 };
    rerender(
      <svg>
        <EdgeLayer
          nodes={[A, B]}
          edges={[e]}
          selectedEdge={null}
          setSelectedEdge={() => {}}
          setSelectedNode={() => {}}
          toolbarPos={{ x: 0, y: 0 }}
          setToolbarPos={() => {}}
          onEdgeClick={() => {}}
          onEdgeContext={() => {}}
          updateEdgeLikelihood={() => {}}
          dragPositions={{ A: dragA }}
        />
      </svg>
    );
    expect(path.getAttribute('d')).toBe(expectedD(dragA, { x: B.x, y: B.y }, sh, th));
  });

  test('Legacy edges infer sensible handles and remain stable after subsequent drags', () => {
    const eLegacy: Edge = { id: 'eAC', source: 'A', target: 'C' } as any;
    const { container, rerender } = render(
      <svg>
        <EdgeLayer
          nodes={[A, C]}
          edges={[eLegacy]}
          selectedEdge={null}
          setSelectedEdge={() => {}}
          setSelectedNode={() => {}}
          toolbarPos={{ x: 0, y: 0 }}
          setToolbarPos={() => {}}
          onEdgeClick={() => {}}
          onEdgeContext={() => {}}
          updateEdgeLikelihood={() => {}}
          dragPositions={{}}
        />
      </svg>
    );
    const path = container.querySelector('path[stroke]') as SVGPathElement;
    expect(path).toBeTruthy();

    // Initial inferred handles
    const sh0 = inferHandleFromRelative({ x: C.x, y: C.y }, { x: A.x, y: A.y });
    const th0 = inferHandleFromRelative({ x: A.x, y: A.y }, { x: C.x, y: C.y });
    expect(path.getAttribute('d')).toBe(expectedD({ x: A.x, y: A.y }, { x: C.x, y: C.y }, sh0, th0));

    // Drag C; inference should use current relative positions
    const dragC = { x: 220, y: 360 };
    rerender(
      <svg>
        <EdgeLayer
          nodes={[A, C]}
          edges={[eLegacy]}
          selectedEdge={null}
          setSelectedEdge={() => {}}
          setSelectedNode={() => {}}
          toolbarPos={{ x: 0, y: 0 }}
          setToolbarPos={() => {}}
          onEdgeClick={() => {}}
          onEdgeContext={() => {}}
          updateEdgeLikelihood={() => {}}
          dragPositions={{ C: dragC }}
        />
      </svg>
    );
    const sh1 = inferHandleFromRelative(dragC, { x: A.x, y: A.y });
    const th1 = inferHandleFromRelative({ x: A.x, y: A.y }, dragC);
    expect(path.getAttribute('d')).toBe(expectedD({ x: A.x, y: A.y }, dragC, sh1, th1));
  });
});

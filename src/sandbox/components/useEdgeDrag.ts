import { useState, useEffect, useCallback } from 'react';
import type { Node as SandboxNode } from '../../types/sandbox';

interface EdgeDragState {
  creatingEdge: boolean;
  dragSource: SandboxNode | null;
  dragPos: { x: number; y: number } | null;
  onEdgeHandleMouseDown: (e: React.MouseEvent, node: SandboxNode) => void;
  setCreatingEdge: React.Dispatch<React.SetStateAction<boolean>>;
  setDragSource: React.Dispatch<React.SetStateAction<SandboxNode | null>>;
  setDragPos: React.Dispatch<React.SetStateAction<{ x: number; y: number } | null>>;
}

export function useEdgeDrag(board: { nodes: SandboxNode[] }, addEdge: Function) : EdgeDragState {
  const [creatingEdge, setCreatingEdge] = useState(false);
  const [dragSource, setDragSource] = useState<SandboxNode | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!creatingEdge) return;
    const onMove = (e: Event) => {
      const mouseEvent = e as unknown as MouseEvent;
      const canvas = document.getElementById('sandbox-canvas-root') as HTMLDivElement | null;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      setDragPos({ x: mouseEvent.clientX - rect.left, y: mouseEvent.clientY - rect.top });
    };
    const onUp = (e: Event) => {
      const mouseEvent = e as unknown as MouseEvent;
      setCreatingEdge(false);
      setDragPos(null);
      if (!dragSource || !board) return;
      const canvas = document.getElementById('sandbox-canvas-root') as HTMLDivElement | null;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = mouseEvent.clientX - rect.left;
      const y = mouseEvent.clientY - rect.top;
      // Find target node
      // Use same dimensions as NodeLayer for accuracy
      const NODE_WIDTH = 256;
      const NODE_HEIGHT = 130;
      const target = board.nodes.find(n => x >= n.x && x <= n.x + NODE_WIDTH && y >= n.y && y <= n.y + NODE_HEIGHT);
      if (target && target.id !== dragSource.id) {
        try {
          // Infer handles based on relative position at time of drop
          const dx = target.x - dragSource.x;
          const dy = target.y - dragSource.y;
          let sourceHandle: 'left' | 'right' | 'bottom' | 'top';
          let targetHandle: 'left' | 'right' | 'bottom' | 'top';
          if (Math.abs(dx) >= Math.abs(dy)) {
            sourceHandle = dx >= 0 ? 'right' : 'left';
            targetHandle = dx >= 0 ? 'left' : 'right';
          } else {
            sourceHandle = dy >= 0 ? 'bottom' : 'top';
            targetHandle = dy >= 0 ? 'top' : 'bottom';
          }
          addEdge({ source: dragSource.id, target: target.id, likelihood: 50, sourceHandle, targetHandle });
        } catch (err) {
          // Error handling will be at the toast/modal level
        }
      }
      setDragSource(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [creatingEdge, dragSource, board, addEdge]);

  const onEdgeHandleMouseDown = useCallback((e: React.MouseEvent, node: SandboxNode) => {
    e.stopPropagation();
    setCreatingEdge(true);
    setDragSource(node);
    setDragPos({ x: node.x + 60, y: node.y + 30 });
  }, []);

  return {
    creatingEdge,
    dragSource,
    dragPos,
    onEdgeHandleMouseDown,
    setCreatingEdge,
    setDragSource,
    setDragPos
  };
}

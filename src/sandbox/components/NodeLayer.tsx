import React, { useState, useRef, useEffect } from 'react';
import { Node as SandboxNode } from '../../types/sandbox';

// Node dimensions and gap for contextual creation
const NODE_WIDTH = 256;
const NODE_HEIGHT = 130;
const NODE_GAP = 40;

// Added for per-type border colors (non-invasive, color only)
// Defaults to gray border when type is unknown.
const NODE_BORDER_BY_TYPE: Record<string, string> = {
  decision: 'border-emerald-400',
  option: 'border-blue-400',
  problem: 'border-rose-400',
  action: 'border-amber-400',
};

type Direction = 'left' | 'right' | 'bottom';

function getContextualNodePosition(origin: SandboxNode, direction: Direction) {
  let x = origin.x;
  let y = origin.y;
  switch (direction) {
    case 'right':
      x = origin.x + NODE_WIDTH + NODE_GAP;
      y = origin.y;
      break;
    case 'left':
      x = origin.x - NODE_WIDTH - NODE_GAP;
      y = origin.y;
      break;
    case 'bottom':
      x = origin.x;
      y = origin.y + NODE_HEIGHT + NODE_GAP;
      break;
  }
  // Clamp to non-negative
  x = Math.max(0, x);
  y = Math.max(0, y);
  return { x, y };
}

interface NodeLayerProps {
  nodes: SandboxNode[];
  selectedNodeId?: string | null;
  onNodeSelect?: (node: SandboxNode, e: React.MouseEvent<HTMLDivElement>) => void;
  onNodeDelete?: (nodeId: string) => void;
  onShowComments?: (id: string, opts?: { type?: 'node' | 'edge' }) => void;
  onNodeLabelEdit?: (nodeId: string, newLabel: string) => void;
  onNodeMove: (nodeId: string, x: number, y: number) => void;
  // Added for contextual node creation via edge handles.
  onAddNode?: (node: Omit<SandboxNode, 'id'>) => SandboxNode;
  onAddEdge?: (edge: { source: string; target: string; sourceHandle?: 'left' | 'right' | 'bottom'; targetHandle?: 'left' | 'right' | 'bottom' }) => void;
  // New: ephemeral visual drag position channel (null to clear)
  onDragVisual?: (nodeId: string, pos: { x: number; y: number } | null) => void;
}

// Helper: Edge Handle Button
const EdgeHandleButton = ({
  direction,
  onClick,
  tabIndex,
  style,
}: {
  direction: 'left' | 'right' | 'bottom';
  onClick: (e: React.MouseEvent | React.KeyboardEvent) => void;
  tabIndex?: number;
  style?: React.CSSProperties;
}) => {
  // Positioning offsets for handle
  const offset = 18; // px, distance from node edge
  const baseStyle: React.CSSProperties = {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: '50%',
    border: '2px solid #60a5fa',
    background: 'rgba(96,165,250,0.12)',
    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    outline: 'none',
    cursor: 'pointer',
    transition: 'border 0.15s, box-shadow 0.15s',
    ...style,
  };
  if (direction === 'right') baseStyle.right = -offset;
  if (direction === 'left') baseStyle.left = -offset;
  if (direction === 'bottom') baseStyle.bottom = -offset;
  if (direction === 'right' || direction === 'left') baseStyle.top = '50%';
  if (direction === 'bottom') baseStyle.left = '50%';
  if (direction === 'right' || direction === 'left') baseStyle.transform = 'translateY(-50%)';
  if (direction === 'bottom') baseStyle.transform = 'translateX(-50%)';

  return (
    <button
      tabIndex={tabIndex ?? 0}
      aria-label={`Add node ${direction}`}
      style={baseStyle}
      className="focus:ring-2 focus:ring-blue-400 hover:border-blue-500 hover:bg-blue-100"
      onClick={onClick}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(e);
        }
      }}
      type="button"
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" stroke="#60a5fa" strokeWidth="1.5" fill="none"/></svg>
    </button>
  );
};

const nodeTypes = [
  { key: 'decision', label: 'Decision' },
  { key: 'option', label: 'Option' },
  { key: 'problem', label: 'Problem' },
  { key: 'action', label: 'Action' },
];

export const NodeLayer: React.FC<NodeLayerProps> = ({
  nodes,
  selectedNodeId,
  onNodeSelect,
  onNodeDelete,
  onShowComments,
  onNodeLabelEdit,
  onNodeMove,
  onAddNode,
  onAddEdge,
  onDragVisual,
}) => {
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Drag state
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);

  // Which menu (nodeId + direction) is open
  const [openMenu, setOpenMenu] = useState<null | { nodeId: string; direction: 'left' | 'right' | 'bottom' }>(null);

  useEffect(() => {
    if (editingNodeId && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [editingNodeId]);

  // -- Node Editing Logic --
  const startEdit = (node: SandboxNode) => {
    setEditingNodeId(node.id);
    setEditValue(node.label);
  };
  const finishEdit = (nodeId: string) => {
    if (editingNodeId && editValue.trim() !== '') {
      onNodeLabelEdit?.(nodeId, editValue.trim());
    }
    setEditingNodeId(null);
    setEditValue('');
  };

  // Pointer event handlers for drag
  const handlePointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    node: SandboxNode
  ) => {
    if (
      editingNodeId === node.id ||
      (e.target instanceof HTMLElement &&
        (e.target.closest('button') || e.target.closest('textarea')))
    ) {
      return;
    }
    if (e.button !== 0 && e.pointerType !== 'touch') return;
    e.preventDefault();
    setDraggingId(node.id);
    setDragOffset({
      x: e.clientX - node.x,
      y: e.clientY - node.y,
    });
    setDragPos({ x: node.x, y: node.y });
    onDragVisual?.(node.id, { x: node.x, y: node.y });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingId) return;
    const node = nodes.find((n) => n.id === draggingId);
    if (!node) return;
    const container = containerRef.current;
    if (!container) return;
    const bounds = container.getBoundingClientRect();
    let newX = e.clientX - dragOffset.x;
    let newY = e.clientY - dragOffset.y;
    newX = Math.max(0, Math.min(newX, bounds.width - 48));
    newY = Math.max(0, Math.min(newY, bounds.height - 48));
    setDragPos({ x: newX, y: newY });
    onDragVisual?.(draggingId, { x: newX, y: newY });
    onNodeMove(draggingId, newX, newY);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingId) return;
    const id = draggingId;
    setDraggingId(null);
    setDragPos(null);
    setDragOffset({ x: 0, y: 0 });
    onDragVisual?.(id, null);
    if (e.target instanceof HTMLElement) {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    }
  };

  // ---- Toolbar styling ----
  const TOOLBAR_HEIGHT = 32; // px (icon + padding)
  const TOOLBAR_OVERLAP = 0.8; // 80% overlaps the node

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 10 }}
      data-testid="nodelayer"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {nodes.map((node) => {
        const isDragging = draggingId === node.id && dragPos;
        const dx = isDragging ? (dragPos!.x - node.x) : 0;
        const dy = isDragging ? (dragPos!.y - node.y) : 0;
        const isSelected = selectedNodeId === node.id || editingNodeId === node.id;

        return (
          <div
            key={node.id}
            className={`absolute w-64 h-[130px] bg-white rounded-xl border ${NODE_BORDER_BY_TYPE[(node as any).type] ?? 'border-gray-200'} select-none transition-all pointer-events-auto overflow-visible flex flex-col justify-start group ${isSelected ? 'ring-4 ring-blue-400' : ''} ${isDragging ? 'shadow-2xl scale-105 cursor-grabbing z-30' : 'shadow-lg cursor-grab'}`}
            style={{ left: node.x, top: node.y, zIndex: isDragging ? 30 : 10, userSelect: 'none', cursor: isDragging ? 'grabbing' : 'grab', transform: isDragging ? `translate3d(${dx}px, ${dy}px, 0)` : undefined }}
            tabIndex={0}
            onClick={e => onNodeSelect?.(node, e)}
            onPointerDown={e => handlePointerDown(e, node)}
          >
            {/* Toolbar/Menu: floats above node, always in sync */}
            <div
              className="absolute flex flex-row gap-1 z-20 bg-white rounded-xl shadow border border-gray-200 p-1"
              style={{
                left: 10,
                top: -(TOOLBAR_HEIGHT * TOOLBAR_OVERLAP),
                minHeight: TOOLBAR_HEIGHT,
                alignItems: 'center',
                pointerEvents: 'auto',
              }}
            >
              <button
                className="w-7 h-7 flex items-center justify-center bg-white rounded-full shadow border border-gray-200 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
                title="Comment"
                onClick={e => { e.stopPropagation(); onShowComments && onShowComments(node.id, { type: 'node' }); }}
                aria-label="Add comment"
                tabIndex={0}
              ><span aria-hidden="true" style={{ fontSize: '1.1rem' }}>💬</span></button>
              <button
                className="text-red-500 hover:bg-red-100 rounded-full px-1 py-0.5 text-xs focus:outline-none cursor-pointer"
                title="Delete"
                onClick={e => { e.stopPropagation(); onNodeDelete?.(node.id); }}
                aria-label="Delete node"
                tabIndex={0}
              >🗑️</button>
            </div>
            {/* Edge Handles */}
            <EdgeHandleButton direction="left" onClick={e => { e.stopPropagation(); setOpenMenu({ nodeId: node.id, direction: 'left' }); }} tabIndex={0} style={{ cursor: 'pointer' }} />
            <EdgeHandleButton direction="right" onClick={e => { e.stopPropagation(); setOpenMenu({ nodeId: node.id, direction: 'right' }); }} tabIndex={0} style={{ cursor: 'pointer' }} />
            <EdgeHandleButton direction="bottom" onClick={e => { e.stopPropagation(); setOpenMenu({ nodeId: node.id, direction: 'bottom' }); }} tabIndex={0} style={{ cursor: 'pointer' }} />
            {/* Context menu for node type selection (inside the node, next to the handle) */}
            {openMenu && openMenu.nodeId === node.id && (
              <div
                className="absolute z-30 bg-white rounded-lg shadow-xl border border-gray-200"
                style={{
                  ...(openMenu.direction === 'left' ? { left: -150, top: 30 } : openMenu.direction === 'right' ? { left: 260, top: 30 } : { left: 60, top: 140 }),
                  minWidth: 148,
                  padding: 4,
                }}
              >
                {nodeTypes.map((type) => (
                  <button
                    key={type.key}
                    className="block w-full text-left px-4 py-2 rounded hover:bg-blue-50 focus:bg-blue-100 focus:outline-none text-gray-800"
                    tabIndex={0}
                    onClick={() => {
                      if (!onAddNode || !onAddEdge) { setOpenMenu(null); return; }
                      const direction = openMenu.direction;
                      const { x: newX, y: newY } = getContextualNodePosition(node, direction);
                      const defaultLabel = type.label;
                      // Cast type.key to correct node type
                      const created = onAddNode({
                        type: type.key as SandboxNode['type'],
                        label: defaultLabel,
                        x: newX,
                        y: newY,
                      });
                      const newNodeId = created && (created as any).id;
                      if (newNodeId && node.id !== newNodeId) {
                        const opposite: Record<typeof direction, typeof direction> = { left: 'right', right: 'left', bottom: 'bottom' };
                        onAddEdge({
                          source: node.id,
                          target: newNodeId,
                          sourceHandle: direction,
                          targetHandle: opposite[direction],
                        } as any /* SandboxEdge */);
                        setEditingNodeId(newNodeId);
                        const newNodeObj = typeof created === 'object' ? created : null;
                        if (onNodeSelect && newNodeObj) {
                          onNodeSelect(newNodeObj, { preventDefault: () => {}, stopPropagation: () => {} } as any);
                        }
                      }
                      setOpenMenu(null);
                    }}
                  >
                    {type.label}
                  </button>
                ))}
                <button
                  className="block w-full px-4 py-1 text-xs text-gray-400 hover:bg-gray-100"
                  onClick={() => setOpenMenu(null)}
                >
                  Cancel
                </button>
              </div>
            )}
            {/* Node Label: Edit/View, always fills node, never resizes node */}
            <div className="flex-1 h-full flex flex-col items-center justify-center w-full">
              {editingNodeId === node.id ? (
                <textarea
                  ref={textareaRef}
                  className="w-full h-full p-3 rounded-xl border-none focus:outline-none resize-none text-base font-semibold text-gray-900 bg-white text-center"
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onBlur={e => { e.stopPropagation(); finishEdit(node.id); }}
                  onPointerDown={e => e.stopPropagation()}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); finishEdit(node.id); }
                    if (e.key === 'Escape') { setEditingNodeId(null); }
                  }}
                  style={{
                    zIndex: 10,
                    cursor: 'text',
                    minHeight: '100%',
                    minWidth: '100%',
                    boxSizing: 'border-box',
                    textAlign: 'center',
                  }}
                  maxLength={512}
                  rows={3}
                  autoFocus
                />
              ) : (
                <div
                  className="w-full h-full p-3 text-base font-semibold text-gray-900 cursor-text transition text-center flex items-center justify-center break-words whitespace-pre-line"
                  title={node.label}
                  onClick={() => startEdit(node)}
                  tabIndex={0}
                  role="textbox"
                  aria-label="Edit node label"
                  style={{
                    wordBreak: 'break-word',
                    boxSizing: 'border-box',
                  }}
                >
                  {node.label}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default NodeLayer;
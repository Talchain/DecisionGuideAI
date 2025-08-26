import React, { MouseEvent, useRef, useState } from 'react';
import { useBoardState } from '../state/boardState';
import { Node as SandboxNode, Edge } from '../../types/sandbox';
import { MiniMap } from './MiniMap';
import { DiffView } from './DiffView';
import { OnboardingCoach } from './OnboardingCoach';
import { useCommentState } from '../state/useCommentState';
import { CommentPanel } from './CommentPanel';
import { ConfirmModal } from './ConfirmModal';
import { useTheme } from '../../contexts/ThemeContext';
import { DraftWatermark } from './DraftWatermark';
import { NodeLayer } from './NodeLayer';
import { EdgeLayer } from './EdgeLayer';

interface SandboxCanvasProps {
  boardId?: string;
  onShowComments?: (nodeId: string) => void;
}

export const SandboxCanvas: React.FC<SandboxCanvasProps> = ({
  boardId: propBoardId,
  onShowComments,
}) => {
  // Guarantee boardId stability for the entire session/component
  const [stableBoardId] = useState(() => 'debug-test-board');

  // Board state and operations
  const {
    board,
    updateNode,
    deleteNode,
    updateEdgeLikelihood,
    addEdge,
    deleteEdge,
    isLoading,
    addNode,
    listSnapshots,
    saveSnapshot,
    loadSnapshot,
  } = useBoardState(stableBoardId);

  const { isDraft } = useTheme();
  const [selectedNode, setSelectedNode] = useState<SandboxNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [toolbarPos, setToolbarPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [showDiff, setShowDiff] = useState(false);

  // Comments state
  const {
    addComment,
    editComment,
    deleteComment,
    listComments,
  } = useCommentState();
  const [commentTarget, setCommentTarget] = useState<{ type: 'node' | 'edge'; id: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ nodeId: string } | null>(null);
  const author = 'User'; // TODO: Replace with real user

  // Toast state for error feedback
  const [toast, setToast] = useState<string | null>(null);

  // --- Node handlers for NodeLayer ---
  const handleNodeSelect = (node: SandboxNode, e: React.MouseEvent<HTMLDivElement>) => {
    setSelectedNode(node);
  };

  const handleNodeDelete = (nodeId: string) => {
    setConfirmDelete({ nodeId });
  };

  // Unified handler for showing comments on nodes or edges
// Unified handler for showing comments on nodes or edges
const handleShowComments = (id: string, opts?: { type?: 'node' | 'edge' }) => {
  if (opts?.type === 'edge') {
    setCommentTarget({ type: 'edge', id });
  } else {
    setCommentTarget({ type: 'node', id });
  }
};

  const handleNodeLabelEdit = (nodeId: string, newLabel: string) => {
    updateNode(nodeId, { label: newLabel });
    // Optionally, keep node selected after edit
  };

  // --- Drag handler for NodeLayer ---
  const handleNodeMove = (nodeId: string, x: number, y: number) => {
    updateNode(nodeId, { x, y });
  };


  // --- Edge handlers ---
  const handleEdgeClick = (edge: Edge, e: MouseEvent<SVGPathElement>) => {
    e.stopPropagation();
    setSelectedEdge(edge);
    setSelectedNode(null);
    const src = board?.nodes.find((n) => n.id === edge.source);
    const tgt = board?.nodes.find((n) => n.id === edge.target);
    if (src && tgt) {
      setToolbarPos({ x: (src.x + tgt.x) / 2 + 60, y: (src.y + tgt.y) / 2 });
    }
  };

  // --- Comments handler ---
  const handleEdgeContext = () => {}; // Define handleEdgeContext as a no-op

  const snapshots = listSnapshots();
  const lastSnapshotId = snapshots.length > 0 ? snapshots[snapshots.length - 1].id : '';

  return (
    <div className="w-full h-full bg-gray-50 relative overflow-hidden">
      <MiniMap />
      <OnboardingCoach />
      {showDiff && lastSnapshotId && (
        <DiffView lastSnapshotId={lastSnapshotId} onClose={() => setShowDiff(false)} />
      )}
      
      {import.meta.env.VITE_FEATURE_SCENARIO_SANDBOX === 'true' && commentTarget && (
        <CommentPanel
          targetId={commentTarget.id}
          comments={listComments(commentTarget.id)}
          author={author}
          addComment={addComment}
          editComment={editComment}
          deleteComment={deleteComment}
          onClose={() => setCommentTarget(null)}
        />
      )}
      {confirmDelete && (
        <ConfirmModal
          open={true}
          title="Delete Node"
          message="Are you sure you want to delete this node? This cannot be undone."
          onConfirm={() => {
            deleteNode(confirmDelete.nodeId);
            setConfirmDelete(null);
            setSelectedNode(null);
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
      <div className="absolute inset-0 bg-grid-gray-200 pointer-events-none" />
      <DraftWatermark />
      <div className="relative z-10 p-4 h-full flex flex-col">
        {/* Board Controls */}
        <div className="flex flex-row gap-2 items-center mb-4">
          <button
            className="px-3 py-1 rounded bg-green-600 text-white shadow hover:bg-green-700"
            aria-label="Save Draft"
            title="Save your work as a draft"
            onClick={() => {
              saveSnapshot();
              setToast('Draft saved!');
              setTimeout(() => setToast(null), 1500);
            }}
          >
            Save Draft
          </button>
          <button
            className="px-3 py-1 rounded bg-blue-600 text-white shadow hover:bg-blue-700"
            aria-label="View Diff"
            title={lastSnapshotId ? 'Show changes since last save' : 'Not yet implemented'}
            onClick={() => {
              if (lastSnapshotId) setShowDiff(true);
            }}
            disabled={!lastSnapshotId}
          >
            View Diff
          </button>
          <button
            className="px-3 py-1 rounded bg-gray-600 text-white shadow hover:bg-gray-700"
            aria-label="Show Guide"
            title="Coming soon"
            onClick={() => setToast('Coming soon!')}
          >
            Show Guide
          </button>
          {toast && (
            <span
              className="ml-4 px-3 py-1 bg-black text-white rounded shadow text-sm animate-fade-in"
              role="status"
            >
              {toast}
            </span>
          )}
        </div>
        {board && Array.isArray(board.nodes) && board.nodes.length === 0 && (
          <div className="flex flex-col items-center justify-center min-h-[280px] w-full">
            <h3 className="text-lg font-medium text-gray-500">Empty Board</h3>
            <p className="text-sm mb-4 text-gray-500">Add your first node</p>
            <button
              onClick={() => {
                addNode({ type: 'decision', label: 'New node', x: 320, y: 160 });
              }}
              disabled={!isDraft}
              className="bg-blue-600 text-white rounded-full px-8 py-4 shadow-lg text-xl font-semibold hover:bg-blue-700 transition min-w-[200px] min-h-[48px] cursor-pointer focus:outline-none focus:ring-4 focus:ring-blue-300"
            >
              Add your first node
            </button>
          </div>
        )}
        {/* Render NodeLayer only if nodes exist */}
        {board && Array.isArray(board.nodes) && board.nodes.length > 0 && (
          <NodeLayer
            nodes={board?.nodes || []}
            selectedNodeId={selectedNode?.id}
            onNodeSelect={handleNodeSelect}
            onNodeDelete={handleNodeDelete}
            onShowComments={handleShowComments}
            onNodeLabelEdit={handleNodeLabelEdit}
            onNodeMove={handleNodeMove}
            onAddNode={addNode}
            onAddEdge={addEdge}
          />
        )}
        {/* Render EdgeLayer if edges exist */}
        {board && Array.isArray(board.edges) && (
          <EdgeLayer
            nodes={board?.nodes}
            edges={board?.edges}
            selectedEdge={selectedEdge}
            setSelectedEdge={setSelectedEdge}
            setSelectedNode={setSelectedNode}
            toolbarPos={toolbarPos}
            setToolbarPos={setToolbarPos}
            onEdgeClick={handleEdgeClick}
            onEdgeContext={handleEdgeContext || (() => {})}
            onShowComments={handleShowComments}
            updateEdgeLikelihood={updateEdgeLikelihood}
          />
        )}
      </div>
    </div>
  );
};

export default SandboxCanvas;

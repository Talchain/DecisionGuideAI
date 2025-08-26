import { useMemo, useState } from 'react';
import { useBoardState } from '../state/boardState';

interface DiffViewProps {
  lastSnapshotId: string;
  onClose: () => void;
}

export function DiffView({ lastSnapshotId, onClose }: DiffViewProps) {
  if (import.meta.env.VITE_FEATURE_SCENARIO_SANDBOX !== 'true') return null;
  const { board, listSnapshots, loadSnapshot } = useBoardState();
  const [mergeError, setMergeError] = useState<string | null>(null);
  const snapshots = listSnapshots();
  const last = snapshots.find(s => s.id === lastSnapshotId);

  // Get previous snapshot board
  const prevBoard = useMemo(() => {
    if (!last) return null;
    loadSnapshot(last.id);
    return { ...board };
  }, [last, loadSnapshot, board]);

  // Diff logic
  const currentNodes = board?.nodes || [];
  const currentEdges = board?.edges || [];
  const prevNodes = prevBoard?.nodes || [];
  const prevEdges = prevBoard?.edges || [];

  const newNodes = currentNodes.filter(n => !prevNodes.some(p => p.id === n.id));
  const removedNodes = prevNodes.filter(n => !currentNodes.some(c => c.id === n.id));
  const newEdges = currentEdges.filter(e => !prevEdges.some(p => p.id === e.id));
  const removedEdges = prevEdges.filter(e => !currentEdges.some(c => c.id === e.id));

  // Merge handler (MVP: auto-merge non-conflicting)
  const handleMerge = () => {
    // For MVP: Accept all new nodes/edges, ignore conflicts
    try {
      // No-op for now; real merge logic would go here
      setMergeError(null);
    } catch (e) {
      setMergeError('Merge conflict detected. Please resolve manually.');
    }
  };

  if (!last) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
      <div className="bg-white rounded shadow-lg p-6 min-w-[400px] max-w-[90vw] max-h-[90vh] overflow-auto">
        <h2 className="text-lg font-bold mb-4">Diff View</h2>
        <div className="mb-2">
          <strong>New Nodes:</strong>
          {newNodes.length === 0 ? <span className="text-gray-400 ml-2">None</span> : (
            <ul>{newNodes.map(n => <li key={n.id} className="text-green-600">+ {n.label}</li>)}</ul>
          )}
        </div>
        <div className="mb-2">
          <strong>Removed Nodes:</strong>
          {removedNodes.length === 0 ? <span className="text-gray-400 ml-2">None</span> : (
            <ul>{removedNodes.map(n => <li key={n.id} className="text-red-600">- {n.label}</li>)}</ul>
          )}
        </div>
        <div className="mb-2">
          <strong>New Edges:</strong>
          {newEdges.length === 0 ? <span className="text-gray-400 ml-2">None</span> : (
            <ul>{newEdges.map(e => <li key={e.id} className="text-green-600">+ {e.source} → {e.target}</li>)}</ul>
          )}
        </div>
        <div className="mb-2">
          <strong>Removed Edges:</strong>
          {removedEdges.length === 0 ? <span className="text-gray-400 ml-2">None</span> : (
            <ul>{removedEdges.map(e => <li key={e.id} className="text-red-600">- {e.source} → {e.target}</li>)}</ul>
          )}
        </div>
        {mergeError && <div className="text-red-600 mb-2">{mergeError}</div>}
        <div className="flex gap-2 mt-4 justify-end">
          <button className="px-3 py-1 bg-gray-200 rounded" onClick={onClose}>Close</button>
          <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={handleMerge}>Merge</button>
        </div>
      </div>
    </div>
  );
}

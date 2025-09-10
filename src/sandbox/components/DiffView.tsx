import { useMemo, useState } from 'react';
import { useBoardState } from '../state/boardState';
import { useFlags } from '@/lib/flags';
import { loadSnapshot as loadStorageSnapshot, fromB64 } from '@/sandbox/state/snapshots';
import { BoardState } from '@/sandbox/state/boardState';
import { useEffect, useRef } from 'react';
import { useTelemetry } from '@/lib/useTelemetry';

interface DiffViewProps {
  lastSnapshotId: string;
  decisionId: string;
  onClose: () => void;
}

export function DiffView({ lastSnapshotId, decisionId, onClose }: DiffViewProps) {
  const flags = useFlags()
  if (!flags.scenarioSnapshots) return null;
  const { board } = useBoardState();
  const [mergeError, setMergeError] = useState<string | null>(null);
  const { track } = useTelemetry();
  // a11y focus management
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const invokerRef = useRef<HTMLElement | null>(typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null);

  // Get previous snapshot board
  const prevBoard = useMemo(() => {
    // Load storage-level snapshot non-destructively
    try {
      const payload = loadStorageSnapshot(decisionId, lastSnapshotId);
      if (!payload) return null;
      const bytes = fromB64(payload.ydoc);
      const s = new BoardState('diff-temp');
      s.replaceWithUpdate(bytes);
      return s.getBoard();
    } catch {
      return null;
    }
  }, [decisionId, lastSnapshotId]);

  // Diff logic
  const currentNodes = board?.nodes || [];
  const currentEdges = board?.edges || [];
  const prevNodes = prevBoard?.nodes || [];
  const prevEdges = prevBoard?.edges || [];

  const newNodes = currentNodes.filter(n => !prevNodes.some(p => p.id === n.id));
  const removedNodes = prevNodes.filter(n => !currentNodes.some(c => c.id === n.id));
  const labelChanged = currentNodes
    .filter(n => prevNodes.some(p => p.id === n.id && p.label !== n.label))
    .map(n => ({ id: n.id, before: prevNodes.find(p => p.id === n.id)?.label ?? '', after: n.label }));

  const newEdges = currentEdges.filter(e => !prevEdges.some(p => p.id === e.id));
  const removedEdges = prevEdges.filter(e => !currentEdges.some(c => c.id === e.id));
  const modifiedEdges = currentEdges
    .map(e => {
      const p = prevEdges.find(pe => pe.id === e.id);
      if (!p) return null;
      const changes: Array<string> = [];
      if ((p.likelihood ?? 50) !== (e.likelihood ?? 50)) changes.push('likelihood');
      if ((p.sourceHandle ?? '') !== (e.sourceHandle ?? '')) changes.push('sourceHandle');
      if ((p.targetHandle ?? '') !== (e.targetHandle ?? '')) changes.push('targetHandle');
      return changes.length ? { id: e.id, changes, before: p, after: e } : null;
    })
    .filter(Boolean) as Array<{ id: string; changes: string[]; before: any; after: any }>;

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

  if (!prevBoard) return null;

  // Telemetry: open on mount
  useEffect(() => {
    track('sandbox_diff', { op: 'open', decisionId, beforeId: lastSnapshotId, afterId: board?.id });
    // initial focus to Close for keyboard users
    closeBtnRef.current?.focus?.();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        invokerRef.current?.focus?.();
        track('sandbox_diff', { op: 'close', decisionId });
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const onClickClose = () => {
    invokerRef.current?.focus?.();
    track('sandbox_diff', { op: 'close', decisionId });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
      <div className="bg-white rounded shadow-lg p-6 min-w-[400px] max-w-[90vw] max-h-[90vh] overflow-auto">
        <h2 className="text-lg font-bold mb-4">Diff View</h2>
        <div role="status" aria-live="polite" className="sr-only">
          New Nodes {newNodes.length}, Removed Nodes {removedNodes.length}, Label Changes {labelChanged.length}, New Edges {newEdges.length}, Removed Edges {removedEdges.length}, Modified Edges {modifiedEdges.length}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="mb-2">
            <strong>New Nodes ({newNodes.length}):</strong>
            {newNodes.length === 0 ? <span className="text-gray-400 ml-2">None</span> : (
              <ul>{newNodes.map(n => <li key={n.id} className="text-green-600" tabIndex={0}>+ {n.label}</li>)}</ul>
            )}
          </div>
          <div className="mb-2">
            <strong>Removed Nodes ({removedNodes.length}):</strong>
            {removedNodes.length === 0 ? <span className="text-gray-400 ml-2">None</span> : (
              <ul>{removedNodes.map(n => <li key={n.id} className="text-red-600" tabIndex={0}>- {n.label}</li>)}</ul>
            )}
          </div>
          <div className="mb-2">
            <strong>Label Changes ({labelChanged.length}):</strong>
            {labelChanged.length === 0 ? <span className="text-gray-400 ml-2">None</span> : (
              <ul>{labelChanged.map(n => <li key={n.id} className="text-amber-700" tabIndex={0}>~ {n.before} → {n.after}</li>)}</ul>
            )}
          </div>
          <div className="mb-2">
            <strong>New Edges ({newEdges.length}):</strong>
            {newEdges.length === 0 ? <span className="text-gray-400 ml-2">None</span> : (
              <ul>{newEdges.map(e => <li key={e.id} className="text-green-600" tabIndex={0}>+ {e.source} → {e.target}</li>)}</ul>
            )}
          </div>
          <div className="mb-2">
            <strong>Removed Edges ({removedEdges.length}):</strong>
            {removedEdges.length === 0 ? <span className="text-gray-400 ml-2">None</span> : (
              <ul>{removedEdges.map(e => <li key={e.id} className="text-red-600" tabIndex={0}>- {e.source} → {e.target}</li>)}</ul>
            )}
          </div>
          <div className="mb-2 md:col-span-2">
            <strong>Modified Edges ({modifiedEdges.length}):</strong>
            {modifiedEdges.length === 0 ? <span className="text-gray-400 ml-2">None</span> : (
              <ul>{modifiedEdges.map(me => (
                <li key={me.id} className="text-amber-700" tabIndex={0}>
                  ~ {me.before.source} → {me.before.target} [{me.changes.join(', ')}]
                </li>
              ))}</ul>
            )}
          </div>
        </div>
        {mergeError && <div className="text-red-600 mb-2">{mergeError}</div>}
        <div className="flex gap-2 mt-4 justify-end">
          <button ref={closeBtnRef} className="px-3 py-1 bg-gray-200 rounded" onClick={onClickClose}>Close</button>
          <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={handleMerge}>Merge</button>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useBoardState } from '../state/boardState';
import { saveSnapshot as storageSaveSnapshot, listSnapshots as storageListSnapshots, loadSnapshot as storageLoadSnapshot, clearSnapshots as storageClearSnapshots, fromB64, type SnapshotMeta } from '@/sandbox/state/snapshots';
import { useToast } from '@/components/ui/use-toast';
import { useFlags } from '@/lib/flags';
import { useTelemetry } from '@/lib/useTelemetry';

interface SnapshotTrayProps {
  boardId?: string;
  className?: string;
  fixed?: boolean; // when false, render inline (no fixed overlay)
}

export function SnapshotTray({ className = '', boardId, fixed = true }: SnapshotTrayProps) {
  const { toast } = useToast();
  const flags = useFlags();
  const featureEnabled = flags.scenarioSnapshots;
  const { getUpdate, replaceWithUpdate } = useBoardState();
  const decisionId = boardId ?? 'debug-test-board';
  const { track: t } = useTelemetry();
  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>(() => storageListSnapshots(decisionId));
  const [isSaving, setIsSaving] = useState(false);
  const [isSolving, setIsSolving] = useState(false);
  const [snapshotName, setSnapshotName] = useState('');
  const [showNamePrompt, setShowNamePrompt] = useState(false);

  // Refresh snapshots when changed
  const refreshSnapshots = () => setSnapshots(storageListSnapshots(decisionId));

  const handleSaveSnapshot = () => {
    setIsSaving(true);
    try {
      const bytes = getUpdate();
      const meta = storageSaveSnapshot(decisionId, bytes, { note: snapshotName });
      try { t('sandbox_snapshot', { action: 'save', decisionId, snapshotId: meta.id, ts: Date.now() }) } catch {}
      setSnapshotName('');
      setShowNamePrompt(false);
      toast({ title: 'Snapshot saved!' });
      refreshSnapshots();
    } catch (err) {
      toast({ title: 'Failed to save snapshot', type: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadSnapshot = (id: string) => {
    try {
      const payload = storageLoadSnapshot(decisionId, id);
      if (payload) {
        const bytes = fromB64(payload.ydoc);
        replaceWithUpdate(bytes);
      }
      toast({ title: 'Snapshot loaded!' });
      try { t('sandbox_snapshot', { action: 'restore', decisionId, snapshotId: id, ts: Date.now() }) } catch {}
      refreshSnapshots();
    } catch {
      toast({ title: 'Failed to load snapshot', type: 'destructive' });
    }
  };

  const handleCommit = async () => {
    setIsSolving(true);
    toast({ title: 'Solving…' });
    try {
      // Stubbed solver: simulate async work
      await new Promise((resolve) => setTimeout(resolve, 800));
      toast({ title: 'Solver complete!' });
    } catch {
      toast({ title: 'Solver failed', type: 'destructive' });
    } finally {
      setIsSolving(false);
    }
  };

  if (!featureEnabled) return null;

  const positionClass = fixed ? 'fixed bottom-0 left-0 z-50' : 'relative z-10'
  return (
    <div className={`w-full bg-white border-t shadow-md p-4 ${positionClass} ${className}`} style={{ pointerEvents: 'auto' }}>
      <div className="flex items-center gap-4">
        <Button size="sm" onClick={() => setShowNamePrompt(true)} disabled={isSaving}>
          Save Snapshot
        </Button>
        <Button size="sm" onClick={handleCommit} disabled={isSolving}>
          {isSolving ? 'Solving…' : 'Commit'}
        </Button>
        <div className="flex-1" />
        <div className="flex gap-2 items-center">
          {snapshots.length === 0 && <span className="text-gray-400 text-sm">No snapshots yet.</span>}
          {snapshots.map(snap => (
            <div key={snap.id} className="flex items-center gap-1 border px-2 py-1 rounded bg-gray-50">
              <span className="font-medium text-xs">{snap.note || 'Snapshot'}</span>
              <span className="text-xs text-gray-400 ml-1">{formatDistanceToNow(new Date(snap.createdAt))} ago</span>
              <Button size="sm" variant="outline" onClick={() => handleLoadSnapshot(snap.id)}>
                Load
              </Button>
            </div>
          ))}
          {snapshots.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              aria-label="Clear all snapshots"
              onClick={() => {
                try {
                  storageClearSnapshots(decisionId);
                  refreshSnapshots();
                  toast({ title: 'All snapshots cleared' });
                } catch {
                  toast({ title: 'Failed to clear snapshots', type: 'destructive' });
                }
              }}
            >
              Clear all snapshots
            </Button>
          )}
        </div>
      </div>
      {/* Name prompt dialog */}
      {showNamePrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-lg p-6 min-w-[300px] flex flex-col items-stretch">
            <label className="mb-2 text-sm font-medium">Snapshot Name</label>
            <Input value={snapshotName} onChange={e => setSnapshotName(e.target.value)} placeholder="Optional name" className="mb-4" />
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={() => setShowNamePrompt(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSaveSnapshot} disabled={isSaving}>
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

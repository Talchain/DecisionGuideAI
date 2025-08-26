import { useState, useRef } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useBoardState } from '../state/boardState';
// Icons from lucide-react (ensure this package is installed)
import { Pencil, Trash, Loader2 } from 'lucide-react';
// import { runSolver } from '../../../lib/solver'; // Removed because file does not exist.
// If you need solver functionality, implement or stub it below.

interface SnapshotTrayProps {
  boardId?: string;
  className?: string;
}

export function SnapshotTray({ className = '' }: SnapshotTrayProps) {
  // Additional state for editing and deleting
  const [editingSnapshotId, setEditingSnapshotId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Handler stubs (implement as needed)
  const handleDeleteClick = (id: string) => {
    setIsDeleting(id);
    // TODO: implement delete logic
    setTimeout(() => setIsDeleting(null), 1000);
  };
  const handleCreateSnapshot = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    // TODO: implement create snapshot logic
    setTimeout(() => {
      setIsSubmitting(false);
      setIsCreateDialogOpen(false);
    }, 1000);
  };
  // If you need solver functionality, implement it here.
  // const handleCommit = () => {/* ... */};

  const featureEnabled = import.meta.env.VITE_FEATURE_SCENARIO_SANDBOX === 'true';
  const {
    board,
    saveSnapshot,
    listSnapshots,
    loadSnapshot,
    getCurrentDocument
  } = useBoardState();
  const [snapshots, setSnapshots] = useState(() => listSnapshots());
  const [isSaving, setIsSaving] = useState(false);
  const [isSolving, setIsSolving] = useState(false);
  const [snapshotName, setSnapshotName] = useState('');
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success'|'error'|'info' }|null>(null);

  // Refresh snapshots when changed
  const refreshSnapshots = () => setSnapshots(listSnapshots());

  const handleSaveSnapshot = () => {
    setIsSaving(true);
    try {
      saveSnapshot(snapshotName);
      setSnapshotName('');
      setShowNamePrompt(false);
      setToast({ msg: 'Snapshot saved!', type: 'success' });
      refreshSnapshots();
    } catch (err) {
      setToast({ msg: 'Failed to save snapshot', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadSnapshot = (id: string) => {
    try {
      loadSnapshot(id);
      setToast({ msg: 'Snapshot loaded!', type: 'success' });
      refreshSnapshots();
    } catch {
      setToast({ msg: 'Failed to load snapshot', type: 'error' });
    }
  };

  const handleCommit = async () => {
    setIsSolving(true);
    setToast({ msg: 'Solving...', type: 'info' });
    try {
      const doc = getCurrentDocument();
      await runSolver(doc);
      setToast({ msg: 'Solver complete!', type: 'success' });
    } catch {
      setToast({ msg: 'Solver failed', type: 'error' });
    } finally {
      setIsSolving(false);
      setTimeout(() => setToast(null), 2000);
    }
  };

  if (!featureEnabled) return null;

  return (
    <div className={`w-full fixed bottom-0 left-0 bg-white border-t shadow-md p-4 z-50 ${className}`} style={{ pointerEvents: 'auto' }}>
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
              <span className="font-medium text-xs">{snap.name}</span>
              <span className="text-xs text-gray-400 ml-1">{formatDistanceToNow(new Date(snap.timestamp))} ago</span>
              <Button size="xs" variant="outline" onClick={() => handleLoadSnapshot(snap.id)}>
                Load
              </Button>
            </div>
          ))}
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
      {/* Toast/notification */}
      {toast && (
        <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-4 py-2 rounded shadow text-white ${toast.type==='success'?'bg-green-600':toast.type==='error'?'bg-red-600':'bg-blue-500'}`}>{toast.msg}</div>
      )}
    </div>
  );
}
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingSnapshotId(snapshot.id);
                          setEditName(snapshot.name);
                          setEditDescription(snapshot.description || '');
                        }}
                      >
                        <PencilIcon className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClick(snapshot.id);
                        }}
                        disabled={isDeleting === snapshot.id}
                      >
                        {isDeleting === snapshot.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <TrashIcon className="h-3.5 w-3.5 text-destructive" />
                        )}
                      </Button>
                    </>
                  )}
                </div>
              </div>
              {editingSnapshotId === snapshot.id ? (
                <div className="mt-2">
                  <Input
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Add a description (optional)"
                    className="h-8 text-sm"
                  />
                </div>
              ) : snapshot.description ? (
                <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                  {snapshot.description}
                </p>
              ) : null}
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {formatDistanceToNow(new Date(snapshot.createdAt), { addSuffix: true })}
                </span>
                {snapshot.board_versions && (
                  <span className="px-2 py-0.5 bg-muted rounded-full text-xs">
                    v{snapshot.board_versions.version}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Snapshot</DialogTitle>
            <DialogDescription>
              Save the current state of your board as a new snapshot.
            </DialogDescription>
          </DialogHeader>
          <form ref={formRef} onSubmit={handleCreateSnapshot}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium">
                  Name <span className="text-destructive">*</span>
                </label>
                <Input
                  id="name"
                  name="name"
                  placeholder="e.g., Initial draft"
                  required
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="description" className="text-sm font-medium">
                  Description (optional)
                </label>
                <Input
                  id="description"
                  name="description"
                  placeholder="Add a brief description"
                  disabled={isSubmitting}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateDialogOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Snapshot'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Snapshot</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this snapshot? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={!!isDeleting}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={confirmDelete}
              disabled={!!isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

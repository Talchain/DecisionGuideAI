import { useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, GitCommit, GitPullRequest, GitMerge, GitBranch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { useSandboxState } from '../hooks/useSandboxState';

export function CommitWorkflow() {
  const { toast } = useToast();
  const { commitChanges, board } = useSandboxState({} as any);
  
  const [isOpen, setIsOpen] = useState(false);
  const [commitMessage, setCommitMessage] = useState('');
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState<{
    success: boolean;
    newVersion?: any;
    conflict?: any;
    error?: string;
  } | null>(null);
  
  const handleOpenChange = (open: boolean) => {
    if (!open && isCommitting) return; // Prevent closing while committing
    setIsOpen(open);
    if (!open) {
      // Reset state when closing
      setCommitMessage('');
      setCommitResult(null);
    }
  };
  
  const handleCommit = useCallback(async () => {
    if (!commitMessage.trim()) {
      toast({
        title: 'Commit message required',
        description: 'Please enter a commit message to proceed.',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      setIsCommitting(true);
      const result = await commitChanges({
        message: commitMessage,
        userId: board.createdBy,
        autoResolveConflicts: true,
      });
      
      setCommitResult(result);
      
      if (result.success) {
        // Show success toast with confetti
        toast({
          title: 'Changes committed!',
          description: `Version ${result.newVersion?.version} has been created.`,
          action: (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                // TODO: Show version history or diff view
              }}
            >
              View Changes
            </Button>
          ),
        });
        
        // Close the dialog after a short delay
        setTimeout(() => {
          setIsOpen(false);
        }, 2000);
      } else if (result.conflict) {
        // Show conflict resolution UI
        toast({
          title: 'Merge conflict detected',
          description: 'Please resolve the conflicts before committing.',
          variant: 'destructive',
        });
      } else {
        // Show error message
        toast({
          title: 'Failed to commit changes',
          description: result.error || 'An unknown error occurred.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error during commit:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred while committing changes.',
        variant: 'destructive',
      });
    } finally {
      setIsCommitting(false);
    }
  }, [commitChanges, commitMessage, board.createdBy, toast]);
  
  const renderCommitForm = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="commit-message">Commit Message</Label>
        <Textarea
          id="commit-message"
          placeholder="Describe the changes you're committing..."
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          disabled={isCommitting}
          className="min-h-[100px]"
        />
      </div>
      
      <div className="rounded-lg border p-4 bg-muted/50">
        <h4 className="font-medium mb-2 flex items-center gap-2">
          <GitBranch className="h-4 w-4" />
          Changes to commit
        </h4>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
            <GitPullRequest className="h-4 w-4" />
            <span>3 new nodes</span>
          </div>
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <GitMerge className="h-4 w-4" />
            <span>2 updated likelihoods</span>
          </div>
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <GitCommit className="h-4 w-4" />
            <span>1 removed edge</span>
          </div>
        </div>
      </div>
    </div>
  );
  
  const renderSuccessState = () => (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
      <h3 className="text-lg font-medium mb-2">Changes Committed Successfully!</h3>
      <p className="text-muted-foreground mb-6">
        Version {commitResult?.newVersion?.version} has been created.
      </p>
      <div className="flex gap-2">
        <Button onClick={() => setIsOpen(false)}>Done</Button>
        <Button variant="outline" onClick={() => {
          // TODO: Navigate to version history or diff view
          setIsOpen(false);
        }}>
          View Changes
        </Button>
      </div>
    </div>
  );
  
  const renderConflictResolution = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
        <AlertCircle className="h-5 w-5" />
        <h3 className="font-medium">Merge Conflict Detected</h3>
      </div>
      
      <p className="text-sm text-muted-foreground">
        There are conflicts that need to be resolved before committing. Please review the changes and resolve any conflicts.
      </p>
      
      <div className="rounded-lg border p-4 bg-muted/50">
        <h4 className="font-medium mb-2">Conflicting Changes</h4>
        <ul className="space-y-2 text-sm">
          <li className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-red-500"></span>
            <span>Node "Option A" was modified in both versions</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-red-500"></span>
            <span>Edge likelihood was changed in both versions</span>
          </li>
        </ul>
      </div>
      
      <div className="space-y-2">
        <Label>Resolution Strategy</Label>
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <input
              type="radio"
              id="keep-theirs"
              name="resolution"
              className="h-4 w-4 text-primary"
            />
            <label htmlFor="keep-theirs" className="text-sm">
              Keep their changes (discard my changes)
            </label>
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="radio"
              id="keep-mine"
              name="resolution"
              className="h-4 w-4 text-primary"
              defaultChecked
            />
            <label htmlFor="keep-mine" className="text-sm">
              Keep my changes (discard their changes)
            </label>
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="radio"
              id="manual"
              name="resolution"
              className="h-4 w-4 text-primary"
            />
            <label htmlFor="manual" className="text-sm">
              Manually resolve conflicts (advanced)
            </label>
          </div>
        </div>
      </div>
      
      <div className="pt-4">
        <Button 
          onClick={handleCommit}
          disabled={isCommitting}
          className="w-full"
        >
          {isCommitting ? 'Resolving conflicts...' : 'Resolve and Commit'}
        </Button>
      </div>
    </div>
  );
  
  return (
    <>
      <Button 
        onClick={() => setIsOpen(true)}
        className="gap-2"
      >
        <GitCommit className="h-4 w-4" />
        Commit Changes
      </Button>
      
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Commit Changes</DialogTitle>
            <DialogDescription>
              Save your changes to create a new version of this board.
            </DialogDescription>
          </DialogHeader>
          
          {commitResult?.success ? (
            renderSuccessState()
          ) : commitResult?.conflict ? (
            renderConflictResolution()
          ) : (
            renderCommitForm()
          )}
          
          {!commitResult && (
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setIsOpen(false)}
                disabled={isCommitting}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleCommit}
                disabled={isCommitting || !commitMessage.trim()}
              >
                {isCommitting ? 'Committing...' : 'Commit Changes'}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

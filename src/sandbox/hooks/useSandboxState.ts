import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { Board, BoardVersion, CommitOptions, CommitResult, Scenario, SnapshotOptions, VoteUpdate } from '../../../types/sandbox';
import * as sandboxApi from '../../../lib/supabase/sandbox';
import { isVotingEnabled } from '../../../lib/config';

export const useSandboxState = (initialBoard: Board) => {
  const { boardId } = useParams<{ boardId: string }>();
  const { user } = useAuth();
  
  const [board, setBoard] = useState<Board>(initialBoard);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<Scenario[]>([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState<Scenario | null>(null);
  const [votes, setVotes] = useState<Record<string, { upvotes: number; downvotes: number }>>({});
  const [userVotes, setUserVotes] = useState<Record<string, boolean>>({});

  // Load snapshots on mount
  useEffect(() => {
    if (!boardId) return;
    
    const loadSnapshots = async () => {
      try {
        setIsLoading(true);
        const data = await sandboxApi.getScenarios(boardId);
        setSnapshots(data);
      } catch (err) {
        console.error('Failed to load snapshots:', err);
        setError('Failed to load snapshots');
      } finally {
        setIsLoading(false);
      }
    };

    loadSnapshots();
  }, [boardId]);

  // Load votes for all nodes if voting is enabled
  useEffect(() => {
    if (!isVotingEnabled() || !boardId) return;

    const loadVotes = async () => {
      try {
        const votesMap: Record<string, { upvotes: number; downvotes: number }> = {};
        const userVotesMap: Record<string, boolean> = {};

        // Initialize with zero votes for all option nodes
        board.nodes.forEach(node => {
          if (node.type === 'option') {
            votesMap[node.id] = { upvotes: 0, downvotes: 0 };
          }
        });

        // Get all votes for the board
        const votes = await Promise.all(
          board.nodes
            .filter(node => node.type === 'option')
            .map(node => sandboxApi.getVotesForOption(node.id))
        );

        // Process votes
        votes.flat().forEach(vote => {
          const nodeId = vote.option_id;
          if (!votesMap[nodeId]) {
            votesMap[nodeId] = { upvotes: 0, downvotes: 0 };
          }
          
          if (vote.vote) {
            votesMap[nodeId].upvotes++;
          } else {
            votesMap[nodeId].downvotes++;
          }

          // Track current user's votes
          if (user?.id && vote.user_id === user.id) {
            userVotesMap[nodeId] = vote.vote;
          }
        });

        setVotes(votesMap);
        setUserVotes(userVotesMap);
      } catch (err) {
        console.error('Failed to load votes:', err);
      }
    };

    loadVotes();
  }, [boardId, board.nodes, user?.id]);

  // Subscribe to real-time updates for votes
  useEffect(() => {
    if (!isVotingEnabled() || !boardId) return () => {};

    const subscriptions: (() => void)[] = [];

    // Subscribe to vote changes for each option node
    board.nodes.forEach(node => {
      if (node.type === 'option') {
        const unsubscribe = sandboxApi.subscribeToVotes(node.id, (payload) => {
          setVotes(prevVotes => {
            const newVotes = { ...prevVotes };
            const nodeId = payload.new?.option_id || payload.old?.option_id;
            
            if (!newVotes[nodeId]) {
              newVotes[nodeId] = { upvotes: 0, downvotes: 0 };
            }

            // Handle vote changes
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              if (payload.new.vote) {
                newVotes[nodeId].upvotes++;
              } else {
                newVotes[nodeId].downvotes++;
              }
              
              // Update user's vote
              if (user?.id && payload.new.user_id === user.id) {
                setUserVotes(prev => ({
                  ...prev,
                  [nodeId]: payload.new.vote
                }));
              }
            } else if (payload.eventType === 'DELETE') {
              if (payload.old.vote) {
                newVotes[nodeId].upvotes = Math.max(0, newVotes[nodeId].upvotes - 1);
              } else {
                newVotes[nodeId].downvotes = Math.max(0, newVotes[nodeId].downvotes - 1);
              }
              
              // Clear user's vote if it was deleted
              if (user?.id && payload.old.user_id === user.id) {
                setUserVotes(prev => {
                  const newVotes = { ...prev };
                  delete newVotes[nodeId];
                  return newVotes;
                });
              }
            }

            return newVotes;
          });
        });
        
        subscriptions.push(unsubscribe);
      }
    });

    return () => {
      subscriptions.forEach(unsubscribe => unsubscribe());
    };
  }, [board.nodes, boardId, user?.id]);

  // Subscribe to snapshot changes
  useEffect(() => {
    if (!boardId) return () => {};

    const unsubscribe = sandboxApi.subscribeToScenarios(boardId, (payload) => {
      switch (payload.eventType) {
        case 'INSERT':
          setSnapshots(prev => [payload.new as Scenario, ...prev]);
          break;
        case 'UPDATE':
          setSnapshots(prev => 
            prev.map(snapshot => 
              snapshot.id === payload.new.id ? { ...snapshot, ...payload.new } : snapshot
            )
          );
          break;
        case 'DELETE':
          setSnapshots(prev => prev.filter(snapshot => snapshot.id !== payload.old.id));
          break;
      }
    });

    return () => {
      unsubscribe();
    };
  }, [boardId]);

  // Create a new snapshot
  const createSnapshot = useCallback(async (options: Omit<SnapshotOptions, 'userId'>) => {
    if (!boardId || !user?.id) return null;
    
    try {
      setIsLoading(true);
      setError(null);
      
      // Generate a thumbnail (simplified - in a real app, you'd render the board to a canvas)
      const thumbnail = ''; // TODO: Implement thumbnail generation
      
      const snapshot = await sandboxApi.createScenario({
        boardId,
        versionId: board.id,
        name: options.name,
        description: options.description,
        thumbnail,
        createdBy: user.id,
      });
      
      setSnapshots(prev => [snapshot, ...prev]);
      return snapshot;
    } catch (err) {
      console.error('Failed to create snapshot:', err);
      setError('Failed to create snapshot');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [board.id, boardId, user?.id]);

  // Delete a snapshot
  const deleteSnapshot = useCallback(async (snapshotId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      await sandboxApi.deleteScenario(snapshotId);
      setSnapshots(prev => prev.filter(s => s.id !== snapshotId));
      
      // If the deleted snapshot was selected, clear the selection
      if (selectedSnapshot?.id === snapshotId) {
        setSelectedSnapshot(null);
      }
      
      return true;
    } catch (err) {
      console.error('Failed to delete snapshot:', err);
      setError('Failed to delete snapshot');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [selectedSnapshot]);

  // Update a snapshot
  const updateSnapshot = useCallback(async (snapshotId: string, updates: Partial<Omit<Scenario, 'id' | 'boardId' | 'versionId' | 'createdBy' | 'createdAt'>>) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const updated = await sandboxApi.updateScenario(snapshotId, updates);
      setSnapshots(prev => 
        prev.map(snapshot => 
          snapshot.id === snapshotId ? { ...snapshot, ...updated } : snapshot
        )
      );
      
      // If the updated snapshot was selected, update the selection
      if (selectedSnapshot?.id === snapshotId) {
        setSelectedSnapshot(prev => prev ? { ...prev, ...updated } : null);
      }
      
      return updated;
    } catch (err) {
      console.error('Failed to update snapshot:', err);
      setError('Failed to update snapshot');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [selectedSnapshot]);

  // Load a snapshot
  const loadSnapshot = useCallback(async (snapshotId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Find the snapshot in the list
      const snapshot = snapshots.find(s => s.id === snapshotId);
      if (!snapshot) throw new Error('Snapshot not found');
      
      // Load the board version associated with the snapshot
      const version = await sandboxApi.getBoardVersion(snapshot.versionId);
      
      // Update the board state
      setBoard(prev => ({
        ...prev,
        nodes: version.nodes,
        edges: version.edges,
        version: version.version,
        updatedAt: version.updatedAt,
      }));
      
      setSelectedSnapshot(snapshot);
      return version;
    } catch (err) {
      console.error('Failed to load snapshot:', err);
      setError('Failed to load snapshot');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [snapshots]);

  // Handle voting
  const handleVote = useCallback(async (nodeId: string, vote: boolean | null) => {
    if (!user?.id || !isVotingEnabled()) return false;
    
    try {
      // Optimistic update
      setVotes(prev => {
        const newVotes = { ...prev };
        if (!newVotes[nodeId]) {
          newVotes[nodeId] = { upvotes: 0, downvotes: 0 };
        }
        
        // Remove previous vote if exists
        const currentVote = userVotes[nodeId];
        if (currentVote !== undefined) {
          if (currentVote) {
            newVotes[nodeId].upvotes = Math.max(0, newVotes[nodeId].upvotes - 1);
          } else {
            newVotes[nodeId].downvotes = Math.max(0, newVotes[nodeId].downvotes - 1);
          }
        }
        
        // Add new vote
        if (vote !== null) {
          if (vote) {
            newVotes[nodeId].upvotes++;
          } else {
            newVotes[nodeId].downvotes++;
          }
        }
        
        return newVotes;
      });
      
      // Update user's vote
      setUserVotes(prev => {
        const newVotes = { ...prev };
        if (vote === null) {
          delete newVotes[nodeId];
        } else {
          newVotes[nodeId] = vote;
        }
        return newVotes;
      });
      
      // Send to server
      await sandboxApi.updateVote({
        optionId: nodeId,
        userId: user.id,
        vote,
      });
      
      return true;
    } catch (err) {
      console.error('Failed to update vote:', err);
      // Revert optimistic update on error
      setVotes(prev => ({ ...prev })); // Trigger re-render
      return false;
    }
  }, [user?.id, userVotes]);

  // Commit changes
  const commitChanges = useCallback(async (options: CommitOptions): Promise<CommitResult> => {
    if (!boardId || !user?.id) {
      return {
        success: false,
        error: 'User not authenticated',
      };
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      // Create a new board version
      const result = await sandboxApi.commitBoardVersion(
        boardId,
        {
          title: board.title,
          nodes: board.nodes,
          edges: board.edges,
          isDraft: false,
          createdBy: user.id,
          parentVersionId: board.id,
        },
        {
          ...options,
          userId: user.id,
        }
      );
      
      if (result.success && result.newVersion) {
        // Update the board with the new version
        setBoard(prev => ({
          ...prev,
          id: result.newVersion!.id,
          version: result.newVersion!.version,
          isDraft: false,
          updatedAt: new Date().toISOString(),
        }));
        
        // Show success message (you might want to use a toast here)
        console.log('Changes committed successfully');
      }
      
      return result;
    } catch (err) {
      console.error('Failed to commit changes:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to commit changes',
      };
    } finally {
      setIsLoading(false);
    }
  }, [board, boardId, user?.id]);

  // Memoized value for the current vote stats for a node
  const getVoteStats = useCallback((nodeId: string) => {
    return votes[nodeId] || { upvotes: 0, downvotes: 0 };
  }, [votes]);

  // Memoized value for the current user's vote for a node
  const getUserVote = useCallback((nodeId: string) => {
    return userVotes[nodeId] ?? null;
  }, [userVotes]);

  return {
    // State
    board,
    setBoard,
    snapshots,
    selectedSnapshot,
    isLoading,
    error,
    
    // Actions
    createSnapshot,
    updateSnapshot,
    deleteSnapshot,
    loadSnapshot,
    
    // Voting
    handleVote,
    getVoteStats,
    getUserVote,
    
    // Commit
    commitChanges,
    
    // Utils
    isVotingEnabled: isVotingEnabled(),
  };
};

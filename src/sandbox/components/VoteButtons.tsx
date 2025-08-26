import { useState, useCallback } from 'react';
import { ThumbsUp, ThumbsDown, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSandboxState } from '../hooks/useSandboxState';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/contexts/AuthContext';
import { useCustomToast } from '@/hooks/use-toast';

interface VoteButtonsProps {
  nodeId: string;
  className?: string;
  size?: 'sm' | 'default' | 'lg';
  showCount?: boolean;
  blindVoting?: boolean; // If true, votes are hidden until user votes
}

export function VoteButtons({ 
  nodeId, 
  className = '',
  size = 'default',
  showCount = true,
  blindVoting = true
}: VoteButtonsProps) {
  const { user } = useAuth();
  const { error: showError } = useCustomToast();
  const [isLoading, setIsLoading] = useState(false);
  const { handleVote, getVoteStats, getUserVote, isVotingEnabled } = useSandboxState({} as any);
  
  if (!isVotingEnabled) return null;
  
  const { upvotes, downvotes } = getVoteStats(nodeId);
  const userVote = getUserVote(nodeId);
  const netVotes = upvotes - downvotes;
  
  // If blind voting is enabled and user hasn't voted, hide the counts
  const showResults = !blindVoting || userVote !== null || !user;
  
  // Disable buttons during loading or when user is not authenticated
  const isButtonDisabled = !user || isLoading;
  
  const buttonSizes = {
    sm: 'h-7 w-7',
    default: 'h-9 w-9',
    lg: 'h-10 w-10',
  };
  
  const iconSizes = {
    sm: 'h-3 w-3',
    default: 'h-4 w-4',
    lg: 'h-5 w-5',
  };
  
  const countSizes = {
    sm: 'text-xs',
    default: 'text-sm',
    lg: 'text-base',
  };
  
  const isUpvoted = userVote === true;
  const isDownvoted = userVote === false;
  
  const handleVoteClick = useCallback(async (voteType: 'up' | 'down') => {
    if (!user) {
      showError('Authentication required', 'Please sign in to vote');
      return;
    }

    const newVote = voteType === 'up' 
      ? (isUpvoted ? null : true)
      : (isDownvoted ? null : false);

    try {
      setIsLoading(true);
      await handleVote(nodeId, newVote);
    } catch (error) {
      console.error('Failed to update vote:', error);
      showError('Vote failed', 'There was an error processing your vote. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [user, nodeId, isUpvoted, isDownvoted, handleVote, showError]);

  const handleUpvote = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleVoteClick('up');
  };
  
  const handleDownvote = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleVoteClick('down');
  };
  
  const handleKeyDown = (e: React.KeyboardEvent, voteType: 'up' | 'down') => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      voteType === 'up' ? handleVoteClick('up') : handleVoteClick('down');
    }
  };
  
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <TooltipProvider>
        <div className="flex items-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  buttonSizes[size],
                  'rounded-r-none',
                  isUpvoted 
                    ? 'bg-green-50 hover:bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-800/30'
                    : 'hover:bg-muted',
                  'transition-colors',
                  !showResults && 'opacity-50 hover:opacity-100'
                )}
                onClick={handleUpvote}
                onKeyDown={(e) => handleKeyDown(e, 'up')}
                disabled={isButtonDisabled}
                aria-label={isUpvoted ? 'Remove upvote' : 'Upvote'}
                aria-pressed={isUpvoted}
              >
                {isLoading && isUpvoted !== null ? (
                  <Loader2 className={cn(iconSizes[size], 'animate-spin')} />
                ) : showResults ? (
                  <ThumbsUp 
                    className={cn(
                      iconSizes[size], 
                      isUpvoted ? 'fill-current' : '',
                      'transition-transform hover:scale-110'
                    )} 
                  />
                ) : (
                  <EyeOff className={cn(iconSizes[size], 'text-muted-foreground')} />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Vote up</p>
            </TooltipContent>
          </Tooltip>
          
          {showCount && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={cn(
                  'px-1.5 py-0.5 text-center min-w-[20px] border-t border-b border-border',
                  countSizes[size],
                  showResults 
                    ? netVotes > 0 
                      ? 'text-green-600 dark:text-green-400' 
                      : netVotes < 0 
                        ? 'text-red-600 dark:text-red-400' 
                        : 'text-muted-foreground'
                    : 'text-muted-foreground',
                  'font-medium cursor-default',
                  !showResults && 'opacity-50'
                )}>
                  {showResults 
                    ? (netVotes !== 0 ? Math.abs(netVotes) : '0')
                    : '?'}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>{showResults 
                  ? `Net votes: ${netVotes} (${upvotes} 👍 / ${downvotes} 👎)`
                  : 'Vote to see results'}</p>
              </TooltipContent>
            </Tooltip>
          )}
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  buttonSizes[size],
                  'rounded-l-none',
                  isDownvoted 
                    ? 'bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-800/30'
                    : 'hover:bg-muted',
                  'transition-colors',
                  !showResults && 'opacity-50 hover:opacity-100'
                )}
                onClick={handleDownvote}
                onKeyDown={(e) => handleKeyDown(e, 'down')}
                disabled={isButtonDisabled}
                aria-label={isDownvoted ? 'Remove downvote' : 'Downvote'}
                aria-pressed={isDownvoted}
              >
                {isLoading && isDownvoted !== null ? (
                  <Loader2 className={cn(iconSizes[size], 'animate-spin')} />
                ) : showResults ? (
                  <ThumbsDown 
                    className={cn(
                      iconSizes[size], 
                      isDownvoted ? 'fill-current' : '',
                      'transition-transform hover:scale-110'
                    )} 
                  />
                ) : (
                  <EyeOff className={cn(iconSizes[size], 'text-muted-foreground')} />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Vote down</p>
            </TooltipContent>
          </Tooltip>
        </div>
        
        {showCount && showResults && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={cn(
                'text-xs text-muted-foreground ml-1',
                countSizes[size],
                'flex items-center gap-1',
                'opacity-70 hover:opacity-100 transition-opacity'
              )}>
                <span className="text-green-600 dark:text-green-400">+{upvotes}</span>
                <span>/</span>
                <span className="text-red-600 dark:text-red-400">-{downvotes}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Upvotes / Downvotes</p>
            </TooltipContent>
          </Tooltip>
        )}
      </TooltipProvider>
    </div>
  );
}

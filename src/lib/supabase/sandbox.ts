import { supabase } from './client';
import { Board, BoardVersion, CommitOptions, CommitResult, OptionVote, Scenario, SnapshotOptions, VoteUpdate } from '../../types/sandbox';

// Board Versions

export const getBoardVersions = async (boardId: string) => {
  const { data, error } = await supabase
    .from('board_versions')
    .select('*')
    .eq('board_id', boardId)
    .order('version', { ascending: false });

  if (error) throw error;
  return data as BoardVersion[];
};

export const getBoardVersion = async (versionId: string) => {
  const { data, error } = await supabase
    .from('board_versions')
    .select('*')
    .eq('id', versionId)
    .single();

  if (error) throw error;
  return data as BoardVersion;
};

export const createBoardVersion = async (
  boardId: string,
  version: Omit<BoardVersion, 'id' | 'boardId' | 'version' | 'createdAt' | 'updatedAt'>
) => {
  const { data, error } = await supabase
    .from('board_versions')
    .insert({
      board_id: boardId,
      ...version,
    })
    .select()
    .single();

  if (error) throw error;
  return data as BoardVersion;
};

// Scenarios (Snapshots)

export const getScenarios = async (boardId: string) => {
  const { data, error } = await supabase
    .from('scenarios')
    .select(`
      *,
      board_versions (
        id,
        version,
        committed_at,
        commit_message
      )
    `)
    .eq('board_id', boardId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as (Scenario & { board_versions: Pick<BoardVersion, 'id' | 'version' | 'committed_at' | 'commit_message'> })[];
};

export const createScenario = async (scenario: Omit<Scenario, 'id' | 'createdAt' | 'updatedAt'>) => {
  const { data, error } = await supabase
    .from('scenarios')
    .insert(scenario)
    .select()
    .single();

  if (error) throw error;
  return data as Scenario;
};

export const updateScenario = async (
  id: string,
  updates: Partial<Omit<Scenario, 'id' | 'boardId' | 'versionId' | 'createdBy' | 'createdAt'>>
) => {
  const { data, error } = await supabase
    .from('scenarios')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as Scenario;
};

export const deleteScenario = async (id: string) => {
  const { error } = await supabase
    .from('scenarios')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return true;
};

// Option Votes

export const getVotesForOption = async (optionId: string) => {
  const { data, error } = await supabase
    .from('option_votes')
    .select('*')
    .eq('option_id', optionId);

  if (error) throw error;
  return data as OptionVote[];
};

export const getUserVote = async (optionId: string, userId: string) => {
  const { data, error } = await supabase
    .from('option_votes')
    .select('*')
    .eq('option_id', optionId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data as OptionVote | null;
};

export const updateVote = async (vote: VoteUpdate) => {
  // If vote is null, remove the vote
  if (vote.vote === null) {
    const { error } = await supabase
      .from('option_votes')
      .delete()
      .eq('option_id', vote.optionId)
      .eq('user_id', vote.userId);

    if (error) throw error;
    return null;
  }

  // Otherwise, upsert the vote
  const { data, error } = await supabase
    .from('option_votes')
    .upsert(
      {
        option_id: vote.optionId,
        user_id: vote.userId,
        vote: vote.vote,
      },
      { onConflict: 'option_id,user_id' }
    )
    .select()
    .single();

  if (error) throw error;
  return data as OptionVote;
};

// Commit Workflow

export const commitBoardVersion = async (
  boardId: string,
  version: Omit<BoardVersion, 'id' | 'boardId' | 'version' | 'createdAt' | 'updatedAt'>,
  options: CommitOptions
): Promise<CommitResult> => {
  try {
    // Call the database function to create a new version
    const { data, error } = await supabase
      .rpc('create_board_version', {
        p_board_id: boardId,
        p_title: version.title,
        p_nodes: version.nodes,
        p_edges: version.edges,
        p_commit_message: options.message,
        p_user_id: options.userId
      })
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      newVersion: data as BoardVersion
    };
  } catch (error) {
    console.error('Error committing board version:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to commit board version'
    };
  }
};

// Real-time Subscriptions

export const subscribeToVotes = (
  optionId: string,
  callback: (payload: any) => void
) => {
  const subscription = supabase
    .channel(`option_votes:${optionId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'option_votes',
        filter: `option_id=eq.${optionId}`
      },
      (payload) => {
        callback(payload);
      }
    )
    .subscribe();

  return () => {
    subscription.unsubscribe();
  };
};

export const subscribeToScenarios = (
  boardId: string,
  callback: (payload: any) => void
) => {
  const subscription = supabase
    .channel(`board_scenarios:${boardId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'scenarios',
        filter: `board_id=eq.${boardId}`
      },
      (payload) => {
        callback(payload);
      }
    )
    .subscribe();

  return () => {
    subscription.unsubscribe();
  };
};

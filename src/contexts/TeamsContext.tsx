// src/contexts/TeamsContext.tsx

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import type { Team } from '../types/teams';

interface TeamsContextType {
  teams: Team[];
  loading: boolean;
  error: string | null;
  fetchTeams: () => Promise<void>;
  createTeam: (name: string, description?: string) => Promise<Team>;
  updateTeam: (id: string, updates: { name: string; description?: string }) => Promise<void>;
  deleteTeam: (id: string) => Promise<void>;
  addTeamMember: (teamId: string, userId: string, role?: string) => Promise<void>;
  removeTeamMember: (teamId: string, userId: string) => Promise<void>;
  updateTeamMember: (teamId: string, userId: string, updates: { role?: string }) => Promise<void>;
}

const TeamsContext = createContext<TeamsContextType | undefined>(undefined);

export function TeamsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Fetch all teams created by this user, including their members */
  const fetchTeams = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      const { data, error: err } = await supabase
        .from('teams')
        .select(`
          id,
          name,
          description,
          created_by,
          created_at,
          updated_at,
          members:team_members(*)
        `)
        .eq('created_by', user.id)
        .order('created_at', { ascending: false });

      if (err) throw err;

      // Ensure `members` is always an array
      const list = (data ?? []).map((t) => ({
        ...t,
        members: t.members ?? [],
      }));

      setTeams(list);
    } catch (e) {
      console.error('[TeamsContext] fetchTeams raw error:', e);
      setError(e instanceof Error ? e.message : 'Failed to fetch teams');
    } finally {
      setLoading(false);
    }
  }, [user]);

  /** Create a new team */
  const createTeam = useCallback(
    async (name: string, description?: string) => {
      if (!user) throw new Error('Not authenticated');
      setLoading(true);
      setError(null);

      try {
        const { data, error: err } = await supabase
          .from('teams')
          .insert([{ name, description, created_by: user.id }])
          .select('id,name,description,created_by,created_at,updated_at')
          .single();

        if (err) throw err;
        setTeams((prev) => [data!, ...prev]);
        return data!;
      } finally {
        setLoading(false);
      }
    },
    [user]
  );

  /** Update team metadata */
  const updateTeam = useCallback(
    async (id: string, updates: { name: string; description?: string }) => {
      if (!user) return;
      setError(null);
      try {
        const { error: err } = await supabase
          .from('teams')
          .update(updates)
          .eq('id', id);
        if (err) throw err;
        setTeams((prev) =>
          prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
        );
      } catch (e) {
        console.error('[TeamsContext] updateTeam error:', e);
        setError(e instanceof Error ? e.message : 'Failed to update team');
        throw e;
      }
    },
    [user]
  );

  /** Delete a team */
  const deleteTeam = useCallback(
    async (id: string) => {
      if (!user) return;
      setError(null);
      try {
        const { error: err } = await supabase.from('teams').delete().eq('id', id);
        if (err) throw err;
        setTeams((prev) => prev.filter((t) => t.id !== id));
      } catch (e) {
        console.error('[TeamsContext] deleteTeam error:', e);
        setError(e instanceof Error ? e.message : 'Failed to delete team');
      }
    },
    [user]
  );

  /** Add a member to a team */
  const addTeamMember = useCallback(
    async (teamId: string, userId: string, role = 'member') => {
      if (!user) return;
      setError(null);
      try {
        const { error: err } = await supabase
          .from('team_members')
          .insert([{ team_id: teamId, user_id: userId, role }]);
        if (err) throw err;
        await fetchTeams();
      } catch (e) {
        console.error('[TeamsContext] addTeamMember error:', e);
        setError(e instanceof Error ? e.message : 'Failed to add team member');
        throw e;
      }
    },
    [user, fetchTeams]
  );

  /** Remove a member from a team */
  const removeTeamMember = useCallback(
    async (teamId: string, userId: string) => {
      if (!user) return;
      setError(null);
      try {
        const { error: err } = await supabase
          .from('team_members')
          .delete()
          .eq('team_id', teamId)
          .eq('user_id', userId);
        if (err) throw err;
        await fetchTeams();
      } catch (e) {
        console.error('[TeamsContext] removeTeamMember error:', e);
        setError(e instanceof Error ? e.message : 'Failed to remove team member');
        throw e;
      }
    },
    [user, fetchTeams]
  );

  /** Update a member’s role */
  const updateTeamMember = useCallback(
    async (teamId: string, userId: string, updates: { role?: string }) => {
      if (!user) return;
      setError(null);
      try {
        const { error: err } = await supabase
          .from('team_members')
          .update(updates)
          .eq('team_id', teamId)
          .eq('user_id', userId);
        if (err) throw err;
        await fetchTeams();
      } catch (e) {
        console.error('[TeamsContext] updateTeamMember error:', e);
        setError(e instanceof Error ? e.message : 'Failed to update team member');
        throw e;
      }
    },
    [user, fetchTeams]
  );

  return (
    <TeamsContext.Provider
      value={{
        teams,
        loading,
        error,
        fetchTeams,
        createTeam,
        updateTeam,
        deleteTeam,
        addTeamMember,
        removeTeamMember,
        updateTeamMember,
      }}
    >
      {children}
    </TeamsContext.Provider>
  );
}

export function useTeams() {
  const ctx = useContext(TeamsContext);
  if (!ctx) throw new Error('useTeams must be used within a TeamsProvider');
  return ctx;
}
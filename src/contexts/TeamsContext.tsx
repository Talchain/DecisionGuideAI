// src/contexts/TeamsContext.tsx
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import type { Team } from '../types/teams';

interface TeamsContextType {
  teams: Team[];
  loading: boolean;
  error: string | null;
  fetchTeams: () => Promise<void>;
  createTeam: (name: string, description?: string) => Promise<Team>;
  deleteTeam: (id: string) => Promise<void>;
}

const TeamsContext = createContext<TeamsContextType|undefined>(undefined);

export function TeamsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);

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
      
      // Transform the data to match our Team interface
      const teamsWithMembers = (data ?? []).map(team => ({
        ...team,
        members: team.members || []
      }));
      
      setTeams(teamsWithMembers);
    } catch (e) {
      console.error('[TeamsContext] fetchTeams raw error:', e);
      setError(e instanceof Error ? e.message : 'Failed to fetch teams');
    } finally {
      setLoading(false);
    }
  }, [user]);

  const createTeam = useCallback(async (name: string, description?: string) => {
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
      setTeams(prev => [data!, ...prev]);
      return data!;
    } finally {
      setLoading(false);
    }
  }, [user]);

  const deleteTeam = useCallback(async (id: string) => {
    if (!user) return;
    setError(null);
    try {
      const { error: err } = await supabase.from('teams').delete().eq('id', id);
      if (err) throw err;
      setTeams(prev => prev.filter(t => t.id !== id));
    } catch (e) {
      console.error('[TeamsContext] deleteTeam error:', e);
      setError(e instanceof Error ? e.message : 'Failed to delete team');
    }
  }, [user]);

  return (
    <TeamsContext.Provider value={{ teams, loading, error, fetchTeams, createTeam, deleteTeam }}>
      {children}
    </TeamsContext.Provider>
  );
}

export function useTeams() {
  const ctx = useContext(TeamsContext);
  if (!ctx) throw new Error('useTeams must be used within a TeamsProvider');
  return ctx;
}
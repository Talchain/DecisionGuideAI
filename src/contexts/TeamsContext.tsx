import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from './AuthContext';
import type { Team, TeamMember, TeamContextState, TeamContextActions } from '../types/teams';
import { supabase } from '../lib/supabase';

const STORAGE_KEY = 'dga_teams_state';
const TEAMS_CHANNEL = 'teams_changes';

type TeamsContextType = TeamContextState & TeamContextActions;

const TeamsContext = createContext<TeamsContextType | undefined>(undefined);

function loadStoredState(): Partial<TeamContextState> {
  if (import.meta.env.DEV) {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (err) {
      console.warn('Failed to load stored teams state:', err);
    }
  }
  return {};
}

export function TeamsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<TeamContextState>(() => ({
    teams: [],
    currentTeam: null,
    loading: true,
    error: null,
    ...loadStoredState()
  }));

  // Persist state to localStorage in dev mode
  useEffect(() => {
    if (import.meta.env.DEV) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }, [state]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!user) return;

    const subscription = supabase
      .channel(TEAMS_CHANNEL)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'teams' },
        (payload) => {
          console.log('Teams change received:', payload);
          // Refresh teams data
          fetchTeams();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user]);

  // Fetch teams data
  const fetchTeams = useCallback(async () => {
    if (!user) return;

    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      const { data: teams, error } = await supabase
        .from('teams')
        .select(`
          *,
          members:team_members(*)
        `)
        .eq('members.user_id', user.id);

      if (error) throw error;

      setState(prev => ({
        ...prev,
        teams: teams || [],
        loading: false
      }));
    } catch (err) {
      console.error('Error fetching teams:', err);
      setState(prev => ({
        ...prev,
        error: 'Failed to load teams',
        loading: false
      }));
    }
  }, [user]);

  // Initialize teams data
  useEffect(() => {
    if (user) {
      fetchTeams();
    } else {
      setState({
        teams: [],
        currentTeam: null,
        loading: false,
        error: null
      });
    }
  }, [user, fetchTeams]);

  const createTeam = useCallback(async (name: string, description?: string): Promise<Team> => {
    if (!user) throw new Error('Must be authenticated to create a team');

    const { data, error } = await supabase
      .from('teams')
      .insert({
        name,
        description,
        created_by: user.id
      })
      .select()
      .single();

    if (error) throw error;
    return data as Team;
  }, [user]);

  const updateTeam = useCallback(async (id: string, updates: Partial<Team>) => {
    const { error } = await supabase
      .from('teams')
      .update(updates)
      .eq('id', id);

    if (error) throw error;
  }, []);

  const deleteTeam = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('teams')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }, []);

  const setCurrentTeam = useCallback((teamId: string | null) => {
    setState(prev => ({
      ...prev,
      currentTeam: prev.teams.find(t => t.id === teamId) || null
    }));
  }, []);

  const addTeamMember = useCallback(async (
    teamId: string,
    userId: string,
    role: TeamMember['role'] = 'member'
  ) => {
    const { error } = await supabase
      .from('team_members')
      .insert({
        team_id: teamId,
        user_id: userId,
        role
      });

    if (error) throw error;
  }, []);

  const removeTeamMember = useCallback(async (teamId: string, userId: string) => {
    const { error } = await supabase
      .from('team_members')
      .delete()
      .eq('team_id', teamId)
      .eq('user_id', userId);

    if (error) throw error;
  }, []);

  const updateTeamMember = useCallback(async (
    teamId: string,
    userId: string,
    updates: Partial<TeamMember>
  ) => {
    const { error } = await supabase
      .from('team_members')
      .update(updates)
      .eq('team_id', teamId)
      .eq('user_id', userId);

    if (error) throw error;
  }, []);

  const value = {
    ...state,
    createTeam,
    updateTeam,
    deleteTeam,
    setCurrentTeam,
    addTeamMember,
    removeTeamMember,
    updateTeamMember
  };

  return (
    <TeamsContext.Provider value={value}>
      {children}
    </TeamsContext.Provider>
  );
}
// src/contexts/TeamsContext.tsx

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import { supabase } from '../lib/supabase';
import { sendInvitationEmail, sendInviteViaEdge } from '../lib/email';
import { useAuth } from './AuthContext';
import type { Team, TeamMember } from '../types/teams';
import type { Invitation, InviteResult } from '../types/invitations';

interface TeamsContextType {
  teams: Team[];
  loading: boolean;
  error: string | null;
  fetchTeams: () => Promise<void>;
  createTeam: (name: string, description?: string) => Promise<Team>;
  updateTeam: (id: string, updates: { name: string; description?: string }) => Promise<void>;
  deleteTeam: (id: string) => Promise<void>;
  addTeamMember: (teamId: string, userId: string, role?: string, decisionRole?: string) => Promise<void>;
  removeTeamMember: (teamId: string, userId: string) => Promise<void>;
  updateTeamMember: (teamId: string, userId: string, updates: { role?: string, decision_role?: string }) => Promise<void>;
  inviteTeamMember: (teamId: string, email: string, role?: string, decisionRole?: string) => Promise<InviteResult>;
  getTeamInvitations: (teamId: string) => Promise<Invitation[]>;
  revokeInvitation: (invitationId: string) => Promise<void>;
  resendInvitation: (invitationId: string) => Promise<void>;
  getUserIdByEmail: (email: string) => Promise<string | null>;
}

const TeamsContext = createContext<TeamsContextType | undefined>(undefined);

export function TeamsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getUserIdByEmail = useCallback(async (email: string): Promise<string | null> => {
    try {
      const { data, error: err } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single();
      if (err) throw err;
      return data?.id || null;
    } catch (e) {
      console.error('[TeamsContext] getUserIdByEmail error:', e);
      throw new Error('User not found');
    }
  }, []);

  const fetchTeams = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase.rpc(
        'get_teams_with_members',
        { user_uuid: user.id }
      );
      if (err) throw err;
      setTeams((data || []).sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ));
    } catch (e: any) {
      console.error('[TeamsContext] fetchTeams raw error:', e);
      setError(e.message);
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
        .select('*')
        .single();
      if (err) throw err;
      setTeams(prev => [data!, ...prev]);
      return data!;
    } finally {
      setLoading(false);
    }
  }, [user]);

  const updateTeam = useCallback(async (id: string, updates: { name: string; description?: string }) => {
    if (!user) return;
    setError(null);
    try {
      const { error: err } = await supabase
        .from('teams')
        .update(updates)
        .eq('id', id);
      if (err) throw err;
      setTeams(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    } catch (e: any) {
      console.error('[TeamsContext] updateTeam error:', e);
      setError(e.message);
      throw e;
    }
  }, [user]);

  const deleteTeam = useCallback(async (id: string) => {
    if (!user) return;
    setError(null);
    try {
      const { error: err } = await supabase.from('teams').delete().eq('id', id);
      if (err) throw err;
      setTeams(prev => prev.filter(t => t.id !== id));
    } catch (e: any) {
      console.error('[TeamsContext] deleteTeam error:', e);
      setError(e.message);
    }
  }, [user]);

  const addTeamMember = useCallback(async (teamId: string, userId: string, role = 'member', decisionRole = 'contributor') => {
    if (!user) return;
    setError(null);
    try {
      const { error: err } = await supabase.rpc('add_team_member', {
        p_team_id: teamId,
        p_user_id: userId,
        p_role: role,
        p_decision_role: decisionRole
      });
      if (err) throw err;
      await fetchTeams();
    } catch (e: any) {
      console.error('[TeamsContext] addTeamMember error:', e);
      setError(e.message);
      throw e;
    }
  }, [user, fetchTeams]);

  const removeTeamMember = useCallback(async (teamId: string, userId: string) => {
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
    } catch (e: any) {
      console.error('[TeamsContext] removeTeamMember error:', e);
      setError(e.message);
      throw e;
    }
  }, [user, fetchTeams]);

  const updateTeamMember = useCallback(async (teamId: string, userId: string, updates: { role?: string; decision_role?: string }) => {
    if (!user) return;
    setError(null);
    try {
      const { error: err } = await supabase
        .from('team_members')
        .update({ role: updates.role, decision_role: updates.decision_role })
        .eq('team_id', teamId)
        .eq('user_id', userId);
      if (err) throw err;
      await fetchTeams();
    } catch (e: any) {
      console.error('[TeamsContext] updateTeamMember error:', e);
      setError(e.message);
      throw e;
    }
  }, [user, fetchTeams]);

  const inviteTeamMember = useCallback(async (teamId: string, email: string, role = 'member', decisionRole = 'contributor') => {
    if (!user) throw new Error('Not authenticated');
    setError(null);
    console.log(`TeamsContext: Inviting ${email} to team ${teamId} with role ${role} and decision role ${decisionRole}`);
    try {
      // check if existing user
      const { data: userCheck, error: userCheckError } = await supabase.rpc('check_user_email_exists', { email_to_check: email });
      if (userCheckError) throw userCheckError;

      let result: InviteResult;

      if (userCheck && userCheck.exists) {
        // add directly
        const { error: addError } = await supabase.rpc('add_team_member', {
          p_team_id: teamId,
          p_user_id: userCheck.id,
          p_role: role,
          p_decision_role: decisionRole
        });
        if (addError) {
          if (addError.code === '23505') {
            result = { status: 'already_invited', user_id: userCheck.id, email, team_id: teamId, role, decision_role: decisionRole };
          } else throw addError;
        } else {
          result = { status: 'added', user_id: userCheck.id, email, team_id: teamId, role, decision_role: decisionRole };
        }
      } else {
        // insert invitation row
        const { data: invitation, error: inviteError } = await supabase
          .from('invitations')
          .insert({
            email,
            team_id: teamId,
            invited_by: user.id,
            role,
            decision_role: decisionRole,
            status: 'pending'
          })
          .select()
          .single();
        if (inviteError) {
          if (inviteError.code === '23505') {
            result = { status: 'already_invited', email, team_id: teamId, role, decision_role: decisionRole };
          } else throw inviteError;
        } else {
          // track creation
          await supabase.rpc('track_invitation_status', {
            invitation_uuid: invitation.id,
            status_value: 'invitation_created',
            details_json: {
              created_by: user.id,
              email,
              team_id: teamId,
              role,
              decision_role: decisionRole,
              timestamp: new Date().toISOString()
            }
          });
          // get team name
          const { data: teamData, error: teamError } = await supabase
            .from('teams')
            .select('name')
            .eq('id', teamId)
            .single();
          if (teamError) throw teamError;

          // send email
          let emailResult;
          if (import.meta.env.VITE_USE_EDGE_INVITES === 'true') {
            emailResult = await sendInviteViaEdge({
              invitation_id: invitation.id,
              email,
              team_id: teamId,
              team_name: teamData.name,
              inviter_id: user.id
            });
          } else {
            emailResult = await sendInvitationEmail(invitation.id, email, teamData.name, user.email || 'A team admin');
          }
          if (!emailResult.success) {
            console.warn('Failed to send invitation email:', emailResult.error);
            await supabase.rpc('track_invitation_status', {
              invitation_uuid: invitation.id,
              status_value: 'email_failed',
              details_json: {
                error: emailResult.error,
                status: emailResult.status,
                timestamp: new Date().toISOString()
              }
            });
          }
          result = {
            status: 'invited',
            id: invitation.id,
            email,
            team_id: teamId,
            role,
            decision_role: decisionRole,
            invited_at: invitation.invited_at
          };
        }
      }

      await fetchTeams();
      console.log(`TeamsContext: ${result.status === 'added' ? 'Addition' : 'Invitation'} successful for ${email}`);
      return result;
    } catch (e: any) {
      console.error(`TeamsContext: Error inviting ${email}:`, e);
      setError(e.message);
      throw e;
    }
  }, [user, fetchTeams]);

  const getTeamInvitations = useCallback(async (teamId: string) => {
    if (!user) throw new Error('Not authenticated');
    setError(null);
    const { data, error: err } = await supabase.rpc('get_team_invitations', { team_uuid: teamId });
    if (err) { console.error('[TeamsContext] getTeamInvitations error:', err); setError(err.message); throw err; }
    return data as Invitation[];
  }, [user]);

  const revokeInvitation = useCallback(async (invitationId: string) => {
    if (!user) throw new Error('Not authenticated');
    setError(null);
    const { error: err } = await supabase.from('invitations').update({ status: 'expired' }).eq('id', invitationId);
    if (err) { console.error('[TeamsContext] revokeInvitation error:', err); setError(err.message); throw err; }
  }, [user]);

  const resendInvitation = useCallback(async (invitationId: string) => {
    // deprecated—handled in-modal
    throw new Error('Use implementation in ManageTeamMembersModal');
  }, [user]);

  return (
    <TeamsContext.Provider value={{
      teams, loading, error,
      fetchTeams, createTeam, updateTeam, deleteTeam,
      addTeamMember, removeTeamMember, updateTeamMember,
      inviteTeamMember, getTeamInvitations, revokeInvitation,
      resendInvitation, getUserIdByEmail
    }}>
      {children}
    </TeamsContext.Provider>
  );
}

export function useTeams() {
  const ctx = useContext(TeamsContext);
  if (!ctx) throw new Error('useTeams must be used within a TeamsProvider');
  return ctx;
}
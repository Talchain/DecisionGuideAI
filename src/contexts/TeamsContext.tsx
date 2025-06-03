import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { sendInvitationEmail, sendInviteViaEdge } from '../lib/email';
import type { Team } from '../types/teams';
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

  const fetchTeams = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: e } = await supabase.rpc('get_teams_with_members', { user_uuid: user.id });
      if (e) throw e;
      setTeams((data ?? []).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ));
    } catch (e: any) {
      console.error('[TeamsContext] fetchTeams raw error:', e);
      setError(e.message || 'Failed to fetch teams');
    } finally {
      setLoading(false);
    }
  }, [user]);

  const createTeam = useCallback(async (name: string, description?: string) => {
    if (!user) throw new Error('Not authenticated');
    setLoading(true);
    setError(null);
    try {
      const { data, error: e } = await supabase
        .from('teams')
        .insert([{ name, description, created_by: user.id }])
        .select('*')
        .single();
      if (e) throw e;
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
      const { error: e } = await supabase.from('teams').update(updates).eq('id', id);
      if (e) throw e;
      setTeams(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    } catch (e: any) {
      console.error('[TeamsContext] updateTeam error:', e);
      setError(e.message || 'Failed to update team');
      throw e;
    }
  }, [user]);

  const deleteTeam = useCallback(async (id: string) => {
    if (!user) return;
    setError(null);
    try {
      const { error: e } = await supabase.from('teams').delete().eq('id', id);
      if (e) throw e;
      setTeams(prev => prev.filter(t => t.id !== id));
    } catch (e: any) {
      console.error('[TeamsContext] deleteTeam error:', e);
      setError(e.message || 'Failed to delete team');
    }
  }, [user]);

  const getUserIdByEmail = useCallback(async (email: string): Promise<string | null> => {
    try {
      const { data, error: e } = await supabase.from('users').select('id').eq('email', email).single();
      if (e) throw e;
      return data?.id || null;
    } catch (e) {
      console.error('[TeamsContext] getUserIdByEmail error:', e);
      return null;
    }
  }, []);

  const addTeamMember = useCallback(async (teamId: string, userId: string, role = 'member', decisionRole = 'contributor') => {
    if (!user) return;
    setError(null);
    try {
      const { error: e } = await supabase.rpc('add_team_member', {
        p_team_id: teamId,
        p_user_id: userId,
        p_role: role,
        p_decision_role: decisionRole
      });
      if (e) throw e;
      await fetchTeams();
    } catch (e: any) {
      console.error('[TeamsContext] addTeamMember error:', e);
      setError(e.message || 'Failed to add team member');
      throw e;
    }
  }, [user, fetchTeams]);

  const removeTeamMember = useCallback(async (teamId: string, userId: string) => {
    if (!user) return;
    setError(null);
    try {
      const { error: e } = await supabase.from('team_members')
        .delete()
        .eq('team_id', teamId)
        .eq('user_id', userId);
      if (e) throw e;
      await fetchTeams();
    } catch (e: any) {
      console.error('[TeamsContext] removeTeamMember error:', e);
      setError(e.message || 'Failed to remove team member');
      throw e;
    }
  }, [user, fetchTeams]);

  const updateTeamMember = useCallback(async (teamId: string, userId: string, updates: { role?: string; decision_role?: string }) => {
    if (!user) return;
    setError(null);
    try {
      const { error: e } = await supabase.from('team_members')
        .update({ role: updates.role, decision_role: updates.decision_role })
        .eq('team_id', teamId)
        .eq('user_id', userId);
      if (e) throw e;
      await fetchTeams();
    } catch (e: any) {
      console.error('[TeamsContext] updateTeamMember error:', e);
      setError(e.message || 'Failed to update team member');
      throw e;
    }
  }, [user, fetchTeams]);

  /** Invite a user to a team */
  const inviteTeamMember = useCallback(async (teamId: string, email: string, role = 'member', decisionRole = 'contributor') => {
    if (!user) throw new Error('Not authenticated');
    setError(null);
    console.log(`TeamsContext: Inviting ${email} to team ${teamId}…`);
    try {
      // check if user exists…
      const { data: userCheck, error: ucErr } = await supabase.rpc('check_user_email_exists', { email_to_check: email });
      if (ucErr) throw ucErr;

      let result: InviteResult;
      if (userCheck?.exists) {
        // add directly
        const { error: e } = await supabase.rpc('add_team_member', {
          p_team_id: teamId, p_user_id: userCheck.id, p_role: role, p_decision_role: decisionRole
        });
        if (e?.code === '23505') {
          console.info('[TeamsContext] duplicate member – already added:', email);
          result = { status: 'already_invited', user_id: userCheck.id, email, team_id: teamId, role, decision_role: decisionRole };
        } else if (e) {
          throw e;
        } else {
          result = { status: 'added', user_id: userCheck.id, email, team_id: teamId, role, decision_role: decisionRole };
        }
      } else {
        // new invitation row
        const { data: inv, error: ie } = await supabase.from('invitations')
          .insert({ email, team_id: teamId, invited_by: user.id, role, decision_role: decisionRole, status: 'pending' })
          .select('*').single();
        if (ie?.code === '23505') {
          console.info('[TeamsContext] duplicate invite – already invited:', email);
          result = { status: 'already_invited', email, team_id: teamId, role, decision_role: decisionRole };
        } else if (ie) {
          throw ie;
        } else {
          result = {
            status: 'invited',
            id: inv.id,
            email,
            team_id: teamId,
            role,
            decision_role: decisionRole,
            invited_at: inv.invited_at
          };
        }

        // track + send email
        await supabase.rpc('track_invitation_status', {
          invitation_uuid: inv.id,
          status_value: 'invitation_created',
          details_json: { created_by: user.id, email, team_id: teamId, role, decision_role: decisionRole, timestamp: new Date().toISOString() }
        });

        // choose path
        const teamRow = await supabase.from('teams').select('name').eq('id', teamId).single();
        const emailPayload = {
          invitation_id: (inv?.id || ''), email, team_id: teamId, team_name: teamRow.data!.name, inviter_id: user.id
        };
        const edgeEnv = import.meta.env.VITE_USE_EDGE_INVITES === 'true';
        const emailResult = edgeEnv
          ? await sendInviteViaEdge(emailPayload)
          : await sendInvitationEmail(inv!.id, email, teamRow.data!.name, user.email || 'A team admin');

        if (!emailResult.success) {
          console.warn('Email send failed:', emailResult.error);
          await supabase.rpc('track_invitation_status', {
            invitation_uuid: inv.id,
            status_value: 'email_failed',
            details_json: { error: emailResult.error, timestamp: new Date().toISOString() }
          });
        }
      }

      await fetchTeams();
      console.log(`TeamsContext: inviteTeamMember → ${result.status} for ${email}`);
      return result;
    } catch (e) {
      console.error('[TeamsContext] inviteTeamMember error:', e);
      setError(e.message || 'Failed to invite team member');
      throw e;
    }
  }, [user, fetchTeams]);

  const getTeamInvitations = useCallback(async (teamId: string) => {
    if (!user) throw new Error('Not authenticated');
    setError(null);
    try {
      const { data, error: e } = await supabase.rpc('get_team_invitations', { team_uuid: teamId });
      if (e) throw e;
      return data as Invitation[];
    } catch (e) {
      console.error('[TeamsContext] getTeamInvitations error:', e);
      setError(e.message || 'Failed to get team invitations');
      throw e;
    }
  }, [user]);

  const revokeInvitation = useCallback(async (invitationId: string) => {
    if (!user) throw new Error('Not authenticated');
    setError(null);
    try {
      const { error: e } = await supabase.from('invitations').update({ status: 'expired' }).eq('id', invitationId);
      if (e) throw e;
    } catch (e) {
      console.error('[TeamsContext] revokeInvitation error:', e);
      setError(e.message || 'Failed to revoke invitation');
      throw e;
    }
  }, [user]);

  const resendInvitation = useCallback(async (invitationId: string) => {
    // now handled in modal via sendInviteViaEdge
    throw new Error('Deprecated: use sendInviteViaEdge in the modal');
  }, [user]);

  return (
    <TeamsContext.Provider value={{
      teams, loading, error, fetchTeams, createTeam, updateTeam, deleteTeam,
      addTeamMember, removeTeamMember, updateTeamMember,
      inviteTeamMember, getTeamInvitations, revokeInvitation, resendInvitation,
      getUserIdByEmail
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
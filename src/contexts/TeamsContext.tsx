import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { sendInvitationEmail } from '../lib/email';
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

  /** Get user ID by email */
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

  /** Fetch all teams created by this user, including their members */
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

      // Sort teams by created_at
      const sortedTeams = (data ?? []).sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setTeams(sortedTeams);
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
    async (teamId: string, userId: string, role = 'member', decisionRole = 'contributor') => {
      if (!user) return;
      setError(null);
      try {
        const { error: err } = await supabase.rpc(
          'add_team_member',
          {
            p_team_id: teamId,
            p_user_id: userId,
            p_role: role,
            p_decision_role: decisionRole
          }
        );
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

  /** Update a member's role */
  const updateTeamMember = useCallback(
    async (teamId: string, userId: string, updates: { role?: string, decision_role?: string }) => {
      if (!user) return;
      setError(null);
      try {
        const { error: err } = await supabase
          .from('team_members')
          .update({
            role: updates.role,
            decision_role: updates.decision_role
          })
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

  /** Invite a user to a team */
  const inviteTeamMember = useCallback(
    async (teamId: string, email: string, role = 'member', decisionRole = 'contributor') => {
      if (!user) throw new Error('Not authenticated');
      setError(null);
      
      console.log(`TeamsContext: Inviting ${email} to team ${teamId} with role ${role} and decision role ${decisionRole}`);
      try {
        // First, check if user exists
        const { data: userCheck, error: userCheckError } = await supabase.rpc(
          'check_user_email_exists', 
          { email_to_check: email }
        );
        
        if (userCheckError) throw userCheckError;
        
        let result: InviteResult;
        
        if (userCheck && userCheck.exists) {
          // User exists, add directly to team
          const { error: addError } = await supabase.rpc(
            'add_team_member',
            {
              p_team_id: teamId,
              p_user_id: userCheck.id,
              p_role: role,
              p_decision_role: decisionRole
            }
          );
          
          if (addError) throw addError;
          
          result = {
            status: 'added',
            user_id: userCheck.id,
            email: email,
            team_id: teamId,
            role: role,
            decision_role: decisionRole
          };
        } else {
          // User doesn't exist, create invitation
          const { data: invitation, error: inviteError } = await supabase
            .from('invitations')
            .insert({
              email: email,
              team_id: teamId,
              invited_by: user.id,
              role: role,
              decision_role: decisionRole,
              status: 'pending'
            })
            .select()
            .single();
            
          if (inviteError) throw inviteError;
          
          // Track invitation creation
          await supabase.rpc(
            'track_invitation_status',
            { 
              invitation_uuid: invitation.id,
              status_value: 'invitation_created',
              details_json: { 
                created_by: user.id,
                email: email,
                team_id: teamId,
                role: role,
                decision_role: decisionRole,
                timestamp: new Date().toISOString()
              }
            }
          );
          
          // Get team name
          const { data: team, error: teamError } = await supabase
            .from('teams')
            .select('name')
            .eq('id', teamId)
            .single();
            
          if (teamError) throw teamError;
          
          // Send invitation email
          const emailResult = await sendInvitationEmail(
            invitation.id,
            email,
            team.name,
            user.email || 'A team admin'
          );
          
          if (!emailResult.success) {
            console.warn('Failed to send invitation email:', emailResult.error);
            // Continue anyway, we'll track the failure
            await supabase.rpc(
              'track_invitation_status',
              { 
                invitation_uuid: invitation.id,
                status_value: 'email_failed',
                details_json: { 
                  error: emailResult.error,
                  timestamp: new Date().toISOString()
                }
              }
            );
          }
          
          result = {
            status: 'invited',
            id: invitation.id,
            email: email,
            team_id: teamId,
            role: role,
            decision_role: decisionRole,
            invited_at: invitation.invited_at
          };
        }
        
        // Refresh teams to get updated member list
        await fetchTeams();
        
        console.log(`TeamsContext: ${result.status === 'added' ? 'Addition' : 'Invitation'} successful for ${email}`);
        return result;
      } catch (e) {
        console.error(`TeamsContext: Error inviting ${email}:`, e);
        console.error('[TeamsContext] inviteTeamMember error:', e);
        setError(e instanceof Error ? e.message : 'Failed to invite team member');
        throw e;
      }
    },
    [user, fetchTeams]
  );
  
  /** Get pending invitations for a team */
  const getTeamInvitations = useCallback(
    async (teamId: string) => {
      if (!user) throw new Error('Not authenticated');
      setError(null);
      
      try {
        const { data, error: err } = await supabase.rpc(
          'get_team_invitations',
          { team_uuid: teamId }
        );
        
        if (err) throw err;
        return data as Invitation[];
      } catch (e) {
        console.error('[TeamsContext] getTeamInvitations error:', e);
        setError(e instanceof Error ? e.message : 'Failed to get team invitations');
        throw e;
      }
    },
    [user]
  );
  
  /** Revoke a team invitation */
  const revokeInvitation = useCallback(
    async (invitationId: string) => {
      if (!user) throw new Error('Not authenticated');
      setError(null);
      
      try {
        const { error: err } = await supabase
          .from('invitations')
          .update({ status: 'expired' })
          .eq('id', invitationId);
          
        if (err) throw err;
      } catch (e) {
        console.error('[TeamsContext] revokeInvitation error:', e);
        setError(e instanceof Error ? e.message : 'Failed to revoke invitation');
        throw e;
      }
    },
    [user]
  );
  
  /** Resend a team invitation */
  const resendInvitation = useCallback(
    async (invitationId: string) => {
      // This function is now implemented directly in ManageTeamMembersModal
      // to use the new email service
      throw new Error('This function is deprecated. Use the implementation in ManageTeamMembersModal.');
    },
    [user]
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
        inviteTeamMember,
        getTeamInvitations,
        revokeInvitation,
        resendInvitation,
        getUserIdByEmail,
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
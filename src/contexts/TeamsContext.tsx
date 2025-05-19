// src/contexts/TeamsContext.tsx

import React, { createContext, useContext, useState } from 'react';
import { supabase } from '../lib/supabase';
import { sendInviteViaEdge, sendTestEmail } from '../lib/email';
import { getUserId } from '../lib/supabase';
import type { Team } from '../types/teams';

const USE_EDGE_INVITES = import.meta.env.VITE_USE_EDGE_INVITES === 'true';

interface TeamsContextType {
  teams: Team[];
  loading: boolean;
  error: string | null;
  inviteTeamMember: (teamId: string, email: string, role: string, decisionRole: string) => Promise<any>;
  getTeamInvitations: (teamId: string) => Promise<any[]>;
  revokeInvitation: (invitationId: string) => Promise<any>;
  resendInvitation: (invitationId: string, email: string, teamId: string, inviterId: string, teamName: string) => Promise<any>;
  invitations: any[];
  fetchTeams: () => Promise<void>;
  deleteTeam: (teamId: string) => Promise<void>;
}

const TeamsContext = createContext<TeamsContextType>({
  teams: [],
  loading: false,
  error: null,
  inviteTeamMember: async () => {},
  getTeamInvitations: async () => [],
  revokeInvitation: async () => {},
  resendInvitation: async () => {},
  invitations: [],
  fetchTeams: async () => {},
  deleteTeam: async () => {},
});

export const TeamsProvider = ({ children }) => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invitations, setInvitations] = useState([]);

  const fetchTeams = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('teams')
        .select(`
          *,
          members:team_members(*)
        `)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setTeams(data || []);
    } catch (err) {
      console.error('Error fetching teams:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteTeam = async (teamId: string) => {
    try {
      const { error: deleteError } = await supabase
        .from('teams')
        .delete()
        .eq('id', teamId);

      if (deleteError) throw deleteError;
    } catch (err) {
      console.error('Error deleting team:', err);
      throw err;
    }
  };

  const inviteTeamMember = async (teamId, email, role, decisionRole) => {
    try {
      const inviterId = await getUserId();
      if (!inviterId) throw new Error('User not authenticated');

      const { data, error } = await supabase.rpc('manage_team_invite', {
        p_team_id: teamId,
        p_email: email,
        p_inviter_id: inviterId,
        p_role: role,
        p_decision_role: decisionRole,
      });

      if (error && error.code === '23505') {
        return { status: 'already_invited' };
      }

      if (USE_EDGE_INVITES && data?.invitation_id) {
        await sendInviteViaEdge({
          invitation_id: data.invitation_id,
          email,
          team_id: teamId,
          inviter_id: inviterId,
          team_name: data?.team_name || 'Team'
        });
      }

      await supabase.rpc('track_invitation_status', {
        p_email: email,
        p_status: 'sent'
      });

      return { status: 'success' };
    } catch (err) {
      console.error('Invite error:', err);
      return { status: 'error', message: err.message };
    }
  };

  const resendInvitation = async (invitationId, email, teamId, inviterId, teamName) => {
    if (!USE_EDGE_INVITES) return { status: 'skipped' };
    try {
      await sendInviteViaEdge({
        invitation_id: invitationId,
        email,
        team_id: teamId,
        inviter_id: inviterId,
        team_name: teamName
      });
      return { status: 'resent' };
    } catch (err) {
      console.error('Resend error:', err);
      return { status: 'error', message: err.message };
    }
  };

  const getTeamInvitations = async (teamId) => {
    const { data, error } = await supabase
      .from('invitations')
      .select('*')
      .eq('team_id', teamId);

    if (error) {
      console.error('Fetch invitations error:', error);
      return [];
    }

    setInvitations(data);
    return data;
  };

  const revokeInvitation = async (invitationId) => {
    const { error } = await supabase
      .from('invitations')
      .delete()
      .eq('id', invitationId);

    if (error) {
      console.error('Revoke error:', error);
      return { status: 'error', message: error.message };
    }

    setInvitations((prev) => prev.filter((inv) => inv.id !== invitationId));
    return { status: 'revoked' };
  };

  return (
    <TeamsContext.Provider
      value={{
        teams,
        loading,
        error,
        inviteTeamMember,
        getTeamInvitations,
        revokeInvitation,
        resendInvitation,
        invitations: invitations || [],
        fetchTeams,
        deleteTeam,
      }}
    >
      {children}
    </TeamsContext.Provider>
  );
};

export const useTeams = () => useContext(TeamsContext);